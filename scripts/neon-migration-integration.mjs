// Starts only a fresh, marked, non-service cluster on an ephemeral loopback port.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { Client } from 'pg';
import {
  loadSchema,
  dataFingerprint,
  encodeSnapshot,
  decodeSnapshot,
  snapshotSha256,
} from '../apps/server/database/neon/snapshot.mjs';
import {
  exportDatabase,
  importDatabase,
  verifyDatabase,
} from '../apps/server/database/neon/transfer.mjs';
import { generateLargeDataset } from '../apps/server/database/large/dataset.mjs';

const execute = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const binaryRoot =
  process.env.PLATYPUS_TEST_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const executable = (name) =>
  path.join(binaryRoot, process.platform === 'win32' ? `${name}.exe` : name);
const testId = `owned-${Date.now()}-${randomBytes(6).toString('hex')}`;
const directory = path.join(projectRoot, '.local/neon-migration-tests', testId);
const dataDirectory = path.join(directory, 'data');
const marker = 'platypus-neon-migration-disposable-only';
const password = randomBytes(24).toString('hex');
const checks = [];
const clients = [];
let started = false;
let launchAttempted = false;
let port;
const began = performance.now();
const fixedConfig = (database, user = 'migration_test_owner') => ({
  host: '127.0.0.1',
  port,
  database,
  user,
  password,
  ssl: false,
  options: ' ',
  replication: 'false',
  sslnegotiation: 'postgres',
  client_encoding: 'UTF8',
  connectionTimeoutMillis: 5000,
  query_timeout: 60000,
  application_name: 'platypus-owned-migration-test',
});
async function connect(database, user) {
  const client = new Client(fixedConfig(database, user));
  client.on('error', () => {});
  await client.connect();
  clients.push(client);
  return client;
}
async function checkOwned() {
  const resolved = await realpath(directory);
  const expectedParent = await realpath(
    path.join(projectRoot, '.local/neon-migration-tests'),
  );
  assert.equal(path.dirname(resolved), expectedParent);
  assert.equal(
    await readFile(path.join(resolved, 'ownership.txt'), 'utf8'),
    marker,
  );
  assert.equal(path.dirname(dataDirectory), directory);
}
async function populate(client) {
  const schema = await loadSchema();
  const generated = generateLargeDataset();
  await client.query('BEGIN');
  await client.query('CREATE SCHEMA platypus');
  await client.query(schema.schemaSql);
  for (const [table, rows] of [
    ['organizations', generated.organizations],
    ['support_agents', generated.supportAgents],
  ])
    await client.query(
      `INSERT INTO platypus.${table}(id,display_name) SELECT * FROM unnest($1::uuid[],$2::text[])`,
      [rows.map((row) => row.id), rows.map((row) => row.displayName)],
    );
  const columns = [
    'id',
    'number',
    'subject',
    'organizationId',
    'status',
    'assigneeId',
    'createdAt',
    'updatedAt',
  ];
  for (let start = 0; start < generated.tickets.length; start += 1000) {
    const batch = generated.tickets.slice(start, start + 1000);
    await client.query(
      `INSERT INTO platypus.tickets(id,number,subject,organization_id,status,assignee_id,created_at,updated_at)
      SELECT * FROM unnest($1::uuid[],$2::text[],$3::text[],$4::uuid[],$5::text[],$6::uuid[],$7::timestamptz[],$8::timestamptz[])`,
      columns.map((name) => batch.map((row) => row[name])),
    );
  }
  await client.query(schema.indexSql);
  await client.query('COMMIT');
  await client.query(
    "UPDATE platypus.tickets SET subject=$1 WHERE number='PS-1001'",
    ['Actual edited source | newline\nemoji 😀'],
  );
}

async function stopOwnedCluster() {
  if (launchAttempted) {
    await checkOwned();
    let pid;
    try {
      pid = await readFile(path.join(dataDirectory, 'postmaster.pid'), 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (pid) {
      assert.equal(
        path.resolve(pid.split(/\r?\n/)[1]),
        path.resolve(dataDirectory),
      );
      await execute(
        executable('pg_ctl'),
        ['stop', '-D', dataDirectory, '-m', 'fast', '-w', '-t', '20'],
        { windowsHide: true, timeout: 30000 },
      );
    } else if (started) {
      throw new Error('Owned cluster PID missing before cleanup.');
    }
  }
}

try {
  const version = await execute(executable('initdb'), ['--version'], {
    windowsHide: true,
  });
  assert.match(version.stdout, /18\.6/);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'ownership.txt'), marker, {
    flag: 'wx',
  });
  const passwordFile = path.join(directory, 'test-password.txt');
  await writeFile(passwordFile, password, { flag: 'wx', mode: 0o600 });
  await checkOwned();
  await execute(
    executable('initdb'),
    [
      '-D',
      dataDirectory,
      '--username=migration_test_owner',
      '--encoding=UTF8',
      '--locale=C',
      '--auth-host=scram-sha-256',
      '--auth-local=scram-sha-256',
      `--pwfile=${passwordFile}`,
    ],
    { windowsHide: true, timeout: 60000 },
  );
  const lease = net.createServer();
  await new Promise((resolve, reject) => {
    lease.once('error', reject);
    lease.listen(0, '127.0.0.1', resolve);
  });
  port = lease.address().port;
  await new Promise((resolve) => lease.close(resolve));
  launchAttempted = true;
  await execute(
    executable('pg_ctl'),
    [
      'start',
      '-D',
      dataDirectory,
      '-l',
      path.join(directory, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p ${port} -c ssl=off -c max_connections=12 -c shared_buffers=32MB`,
      '-w',
      '-t',
      '20',
    ],
    { windowsHide: true, timeout: 30000 },
  );
  started = true;
  const admin = await connect('postgres');
  await admin.query(
    `CREATE ROLE neondb_owner LOGIN CREATEROLE PASSWORD '${password}'`,
  );
  for (const database of [
    'source_owned',
    'neondb',
    'rollback_owned',
    'refusal_owned',
  ])
    await admin.query(
      `CREATE DATABASE ${database}${database === 'neondb' ? ' OWNER neondb_owner' : ''}`,
    );
  const sourceOwner = await connect('source_owned');
  await populate(sourceOwner);
  await admin.query(
    `CREATE ROLE migration_source_app LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
  );
  await sourceOwner.query(
    'GRANT CONNECT ON DATABASE source_owned TO migration_source_app; GRANT USAGE ON SCHEMA platypus TO migration_source_app; GRANT SELECT ON ALL TABLES IN SCHEMA platypus TO migration_source_app',
  );
  const source = await connect('source_owned', 'migration_source_app');
  // A concurrent edit after the snapshot's first statement must not enter that snapshot.
  let edited = false;
  const snapshot = await exportDatabase({
    query: async (...args) => {
      const result = await source.query(...args);
      if (!edited && args[0].includes('AS bytes')) {
        edited = true;
        await sourceOwner.query(
          "UPDATE platypus.tickets SET subject='After snapshot' WHERE number='PS-1001'",
        );
      }
      return result;
    },
  });
  assert.equal(snapshot.data.tickets.length, 100000);
  assert.equal(snapshot.data.organizations.length, 100);
  assert.equal(snapshot.data.support_agents.length, 40);
  assert.equal(
    snapshot.data.tickets.find((row) => row.number === 'PS-1001').subject,
    'Actual edited source | newline\nemoji 😀',
  );
  assert.equal(edited, true);
  const currentSource = await exportDatabase(source);
  assert.equal(
    currentSource.data.tickets.find((row) => row.number === 'PS-1001').subject,
    'After snapshot',
  );
  await assert.rejects(
    source.query("UPDATE platypus.tickets SET subject='not allowed'"),
    (error) => error.code === '42501',
  );
  checks.push('consistent read-only100000-row actual edited-data export');

  const encoded = await encodeSnapshot(snapshot);
  const verified = await decodeSnapshot(encoded, snapshotSha256(encoded));
  assert.equal(dataFingerprint(verified), dataFingerprint(snapshot));
  const target = await connect('neondb', 'neondb_owner');
  const imported = await importDatabase(target, snapshot);
  assert.equal(imported.imported, true);
  assert.equal((await verifyDatabase(target, snapshot)).verified, true);
  assert.equal((await importDatabase(target, snapshot)).imported, false);
  assert.equal(
    (
      await target.query(
        'SELECT count(*)::integer AS count FROM platypus.seed_runs',
      )
    ).rows[0].count,
    0,
  );
  checks.push(
    'atomic import/exact fingerprints/schema/indexes/explicit verify/idempotent repeat',
  );

  const rollback = await connect('rollback_owned');
  let ticketBatches = 0;
  await assert.rejects(
    importDatabase(
      {
        query: async (...args) => {
          if (
            args[0].startsWith('INSERT INTO platypus.tickets') &&
            ++ticketBatches === 100
          )
            throw new Error('owned late-batch failure');
          return rollback.query(...args);
        },
      },
      snapshot,
    ),
  );
  assert.equal(ticketBatches, 100);
  assert.equal(
    (
      await rollback.query(
        "SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='platypus') AS present",
      )
    ).rows[0].present,
    false,
  );
  assert.equal((await importDatabase(rollback, snapshot)).imported, true);
  checks.push(
    'last-batch failure rolls back all DDL/data/ledger then explicit retry succeeds',
  );

  const refused = await connect('refusal_owned');
  await refused.query(
    "CREATE SCHEMA platypus; CREATE TABLE platypus.unrelated(value text); INSERT INTO platypus.unrelated VALUES ('preserve me')",
  );
  await assert.rejects(importDatabase(refused, snapshot));
  assert.deepEqual(
    (await refused.query('SELECT value FROM platypus.unrelated')).rows,
    [{ value: 'preserve me' }],
  );
  checks.push('unknown existing target is refused without modification');

  await target.query(
    "UPDATE platypus.tickets SET subject='Tampered' WHERE number='PS-1001'",
  );
  await assert.rejects(verifyDatabase(target, snapshot));
  await assert.rejects(importDatabase(target, snapshot));
  await target.query('UPDATE platypus.tickets SET subject=$1 WHERE number=$2', [
    'Actual edited source | newline\nemoji 😀',
    'PS-1001',
  ]);
  await target.query('DROP INDEX platypus.large_tickets_created_order_idx');
  await assert.rejects(verifyDatabase(target, snapshot));
  checks.push('content and index drift are detected without repair');

  const roleSql = await readFile(
    new URL('../apps/server/database/neon/runtime-role.sql', import.meta.url),
    'utf8',
  );
  await target.query(roleSql);
  assert.equal(
    (
      await target.query(
        "SELECT rolcanlogin AS login,rolsuper AS superuser,rolcreaterole AS create_role FROM pg_roles WHERE rolname='platypus_app'",
      )
    ).rows[0].login,
    false,
  );
  const roleProbe = await connect('neondb');
  await roleProbe.query('SET ROLE platypus_app');
  assert.equal(
    (
      await roleProbe.query(
        'SELECT count(*)::integer AS count FROM platypus.tickets',
      )
    ).rows[0].count,
    100000,
  );
  for (const sql of [
    "INSERT INTO platypus.organizations VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff','forbidden')",
    "UPDATE platypus.tickets SET subject='forbidden'",
    'DELETE FROM platypus.tickets',
    'CREATE TABLE platypus.forbidden(id integer)',
    'SELECT * FROM platypus.migration_imports',
  ])
    await assert.rejects(
      roleProbe.query(sql),
      (error) => error.code === '42501',
    );
  await roleProbe.query('RESET ROLE');
  await assert.rejects(target.query(roleSql));
  // A failed standalone SQL batch may leave an explicit transaction aborted.
  await target.query('ROLLBACK');
  checks.push(
    'NOLOGIN least-privilege role reads only business tables and refuses role reuse',
  );
  assert.equal(
    dataFingerprint(await exportDatabase(source)),
    dataFingerprint(currentSource),
  );
  checks.push('source unchanged by import/failure/retry/verification');
  console.log(
    JSON.stringify({
      passed: checks.length,
      checks,
      tickets: 100000,
      elapsedMs: Math.round(performance.now() - began),
      remoteDatabase: false,
      nativeServiceTouched: false,
    }),
  );
} finally {
  await Promise.allSettled(clients.map((client) => client.end()));
  await stopOwnedCluster();
}
