import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from 'pg';
import {
  migrationConfiguration,
  withMigrationClient,
  assertMigrationIdentity,
} from '../database/neon/connection.mjs';
import { runMigration } from '../database/neon/cli.mjs';
import {
  buildSnapshot,
  encodeSnapshot,
  snapshotSha256,
} from '../database/neon/snapshot.mjs';

const host = 'ep-example-test.eu-central-1.aws.neon.tech';
const environment = {
  NEON_MIGRATION_HOST: host,
  NEON_MIGRATION_CONFIRM_TARGET: `${host}/neondb`,
  NEON_MIGRATION_PASSWORD: 'private-test-only',
  LOCAL_MIGRATION_PASSWORD: 'local-test-only',
};

test('migration connections fix local source and confirmed direct Frankfurt target, independent of PG environment', () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, {
      PGHOST: 'evil.invalid',
      PGPORT: '123',
      PGDATABASE: 'wrong',
      PGUSER: 'wrong',
      PGPASSWORD: 'wrong',
      PGOPTIONS: '-c default_transaction_read_only=off',
      PGSSLMODE: 'disable',
      PGREPLICATION: 'database',
      PGCLIENTENCODING: 'LATIN1',
      PGSSLNEGOTIATION: 'direct',
    });
    for (const operation of ['export', 'import', 'verify']) {
      const config = migrationConfiguration(operation, environment);
      const parameters = new Client(config).connectionParameters;
      assert.equal(
        parameters.host,
        operation === 'export' ? '127.0.0.1' : host,
      );
      assert.equal(
        parameters.database,
        operation === 'export' ? 'platypus_service_large' : 'neondb',
      );
      assert.equal(
        parameters.user,
        operation === 'export' ? 'platypus_app' : 'neondb_owner',
      );
      assert.equal(parameters.port, 5432);
      assert.equal(parameters.options, ' ');
      assert.equal(parameters.replication, 'false');
      assert.equal(parameters.client_encoding, 'UTF8');
      assert.equal(parameters.sslnegotiation, 'postgres');
      if (operation === 'export') assert.equal(parameters.ssl, false);
      else {
        assert.equal(parameters.ssl.rejectUnauthorized, true);
        assert.equal(parameters.ssl.minVersion, 'TLSv1.2');
        assert(
          parameters.ssl.checkServerIdentity('ignored', {
            subjectaltname: 'DNS:wrong.invalid',
          }) instanceof Error,
        );
      }
    }
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
  for (const badHost of [
    '127.0.0.1',
    'ep-example-pooler.eu-central-1.aws.neon.tech',
    'ep-example.us-east-1.aws.neon.tech',
    'ep-example.eu-central-1.aws.neon.tech.evil.invalid',
  ])
    assert.throws(() =>
      migrationConfiguration('import', {
        ...environment,
        NEON_MIGRATION_HOST: badHost,
        NEON_MIGRATION_CONFIRM_TARGET: `${badHost}/neondb`,
      }),
    );
  assert.throws(() =>
    migrationConfiguration('import', {
      ...environment,
      NEON_MIGRATION_CONFIRM_TARGET: 'wrong',
    }),
  );
  assert.throws(() => migrationConfiguration('export', {}));
});

test('connected identity must be the explicit PostgreSQL18 UTF8 database and role', async () => {
  const config = migrationConfiguration('import', environment);
  const expected = {
    database: 'neondb',
    username: 'neondb_owner',
    version: 180006,
    encoding: 'UTF8',
  };
  await assertMigrationIdentity(
    { query: async () => ({ rows: [expected] }) },
    config,
  );
  for (const changed of [
    { database: 'other' },
    { username: 'other' },
    { version: 170000 },
    { encoding: 'LATIN1' },
  ])
    await assert.rejects(
      assertMigrationIdentity(
        { query: async () => ({ rows: [{ ...expected, ...changed }] }) },
        config,
      ),
    );
});

class OwnedClient extends EventEmitter {
  calls = [];
  ends = 0;
  async connect() {}
  async query(text) {
    this.calls.push(text);
    return { rows: [] };
  }
  async end() {
    this.ends++;
  }
}

test('client deadline destroys late connect before any SQL and observes late rejection', async () => {
  const client = new OwnedClient();
  let connect;
  client.connect = () =>
    new Promise((resolve) => {
      connect = resolve;
    });
  await assert.rejects(
    withMigrationClient({}, (owned) => owned.query('SELECT 1'), {
      clientFactory: () => client,
      timeoutMillis: 15,
    }),
    /Migration connection or operation failed/,
  );
  connect();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(client.calls, []);
  assert.equal(client.ends, 1);
});

test('timed-out query cannot send later SQL, active errors are redacted and cleanup called once', async () => {
  const client = new OwnedClient();
  let settle;
  client.query = (text) => {
    client.calls.push(text);
    return new Promise((resolve) => {
      settle = resolve;
    });
  };
  await assert.rejects(
    withMigrationClient(
      {},
      async (owned) => {
        await owned.query('SELECT first');
        await owned.query('COMMIT');
      },
      { clientFactory: () => client, timeoutMillis: 15 },
    ),
    /Migration connection or operation failed/,
  );
  settle({ rows: [] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(client.calls, ['SELECT first']);
  assert.equal(client.ends, 1);
  const broken = new OwnedClient();
  broken.query = async () => {
    broken.emit('error', new Error('credential-leak-sentinel'));
    throw new Error('credential-leak-sentinel');
  };
  await assert.rejects(
    withMigrationClient({}, (owned) => owned.query('SELECT broken'), {
      clientFactory: () => broken,
    }),
    (error) => !error.message.includes('sentinel') && !error.cause,
  );
  assert.equal(broken.ends, 1);
});

test('owned cleanup has a separate bound and late rejection is observed', async () => {
  const client = new OwnedClient();
  let rejectEnd;
  let destroyed = 0;
  client.connection = {
    stream: {
      destroy: () => {
        destroyed++;
      },
    },
  };
  client.end = () => {
    client.ends++;
    return new Promise((_resolve, reject) => {
      rejectEnd = reject;
    });
  };
  await assert.rejects(
    withMigrationClient({}, async () => 'done', {
      clientFactory: () => client,
      cleanupMillis: 15,
    }),
  );
  assert.equal(destroyed, 1);
  rejectEnd(new Error('private-cleanup-sentinel'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.ends, 1);
});

test('inspect is offline, checksum failure precedes configuration/network and snapshots never overwrite', async (t) => {
  const prefix = path.join(tmpdir(), 'platypus-neon-unit-');
  const root = await mkdtemp(prefix);
  t.after(async () => {
    assert(path.resolve(root).startsWith(path.resolve(prefix)));
    await rm(root, { recursive: true, force: true });
  });
  const data = {
    organizations: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        display_name: 'Changed | name\n😀',
      },
    ],
    support_agents: [],
    tickets: [],
  };
  const bytes = await encodeSnapshot(await buildSnapshot(data));
  const sha256 = snapshotSha256(bytes);
  const directory = path.join(root, '.local/neon-migration');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'test-one.json'), bytes);
  let opened = 0;
  const runClient = () => {
    opened++;
    throw new Error('No connection allowed');
  };
  const result = await runMigration({
    operation: 'inspect',
    id: 'test-one',
    root,
    environment: { MIGRATION_EXPECTED_SHA256: sha256 },
    runClient,
  });
  assert.equal(result.sha256, sha256);
  assert.equal(opened, 0);
  await assert.rejects(
    runMigration({
      operation: 'import',
      id: 'test-one',
      root,
      environment: { MIGRATION_EXPECTED_SHA256: '0'.repeat(64) },
      runClient,
    }),
  );
  await assert.rejects(
    runMigration({
      operation: 'import',
      id: 'test-one',
      root,
      environment: { MIGRATION_EXPECTED_SHA256: sha256 },
      runClient,
    }),
  );
  await assert.rejects(
    runMigration({
      operation: 'export',
      id: 'test-one',
      root,
      environment,
      runClient,
    }),
  );
  assert.equal(opened, 0);
  assert.deepEqual(
    await readFile(path.join(directory, 'test-one.json')),
    bytes,
  );
  await assert.rejects(
    runMigration({
      operation: 'inspect',
      id: '../escape',
      root,
      environment,
      runClient,
    }),
  );
});

test(
  'real Windows PowerShell inspect displays the verified receipt without prompting for credentials',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const { spawn, execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const { randomBytes } = await import('node:crypto');
    const { fileURLToPath } = await import('node:url');
    const execute = promisify(execFile);
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const script = path.join(root, 'scripts/neon-migration.ps1');
    const literal = script.replaceAll("'", "''");
    await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        "$tokens=$null; $parseErrors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('" +
          literal +
          "',[ref]$tokens,[ref]$parseErrors); if($parseErrors.Count -gt 0){exit 1}",
      ],
      { windowsHide: true, timeout: 15000 },
    );
    const bytes = await encodeSnapshot(
      await buildSnapshot({
        organizations: [],
        support_agents: [],
        tickets: [],
      }),
    );
    const digest = snapshotSha256(bytes);
    const id = 'wrapper-test-' + randomBytes(6).toString('hex');
    const directory = path.join(root, '.local/neon-migration');
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, id + '.json');
    await writeFile(file, bytes, { flag: 'wx' });
    t.after(async () => {
      assert.equal(path.dirname(file), directory);
      await rm(file);
    });
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        '-Action',
        'inspect',
        '-SnapshotId',
        id,
      ],
      { cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    let closed = false;
    child.stdout.on('data', (part) => {
      stdout += part;
    });
    child.stderr.on('data', (part) => {
      stderr += part;
    });
    child.stdin.end(digest + '\n');
    const timeout = setTimeout(() => {
      if (!closed)
        execute('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
        }).catch(() => {});
    }, 20000);
    try {
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (value) => {
          closed = true;
          resolve(value);
        });
      });
      assert.equal(code, 0, stdout + stderr);
      assert(stdout.includes('"operation":"inspect"'));
      assert(stdout.includes(digest));
      assert.equal(stderr, '');
    } finally {
      clearTimeout(timeout);
    }
  },
);
