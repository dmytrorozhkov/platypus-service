import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter, once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setRuntimePassword } from '../database/neon/runtime-password.mjs';
import { withMigrationClient } from '../database/neon/connection.mjs';

const host = 'ep-offline-password.eu-central-1.aws.neon.tech';
const environment = {
  NEON_MIGRATION_HOST: host,
  NEON_MIGRATION_CONFIRM_TARGET: `${host}/neondb`,
  NEON_MIGRATION_PASSWORD: 'Owner-Private-Fixture-Only',
  NEON_APP_NEW_PASSWORD: 'App-Private-Fixture-Only-123456789',
};
const receipt = {
  operation: 'set-runtime-password',
  role: 'platypus_app',
  database: 'neondb',
  passwordConfigured: true,
};
const identity = {
  database: 'neondb',
  username: 'neondb_owner',
  version: 180006,
  encoding: 'UTF8',
};
const failureMessage =
  'Runtime password setup failed. No automatic retry was attempted.';
const uncertainMessage =
  'Runtime password commit outcome is uncertain. Run the app connection check before an explicit retry. No automatic retry was attempted.';

function fake() {
  const calls = [];
  const state = {
    calls,
    runs: 0,
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith('SELECT current_database()'))
        return { rows: [{ ...identity }] };
      if (sql.startsWith('SELECT rolcanlogin'))
        return { rows: [{ rolcanlogin: true }] };
      return { rows: [] };
    },
    async runClient(configuration, work, bounds) {
      state.runs++;
      state.configuration = configuration;
      state.bounds = bounds;
      return work({ query: (sql) => state.query(sql) });
    },
  };
  return state;
}

test('private password utility fixes direct confirmed owner target, TLS and independent app value with bounded ownership', async () => {
  const state = fake();
  assert.deepEqual(
    await setRuntimePassword({
      environment: {
        ...environment,
        PGHOST: 'untrusted.invalid',
        PGPASSWORD: 'ambient',
      },
      runClient: state.runClient,
    }),
    receipt,
  );
  assert.equal(state.runs, 1);
  const config = state.configuration;
  assert.equal(config.host, host);
  assert.equal(config.database, 'neondb');
  assert.equal(config.user, 'neondb_owner');
  assert.equal(config.password, environment.NEON_MIGRATION_PASSWORD);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.minVersion, 'TLSv1.2');
  assert.equal(config.query_timeout, 15000);
  assert.equal(config.statement_timeout, 10000);
  assert.equal(config.lock_timeout, 3000);
  assert.equal(config.idle_in_transaction_session_timeout, 15000);
  assert.equal(config.application_name, 'platypus-runtime-password');
  assert.deepEqual(state.bounds, { timeoutMillis: 60000, cleanupMillis: 3000 });
  assert(!JSON.stringify(receipt).includes('Private'));
  assert.equal(Object.keys(receipt).length, 4);
});

test('app password validation precedes every connection and rejects owner reuse, nonprintable input and invalid target config', async () => {
  for (const password of [
    undefined,
    null,
    123,
    '',
    'x'.repeat(19),
    'x'.repeat(129),
    'x'.repeat(20) + '\0',
    'x'.repeat(20) + '\n',
    'x'.repeat(20) + '\x7f',
    'x'.repeat(20) + 'é',
    environment.NEON_MIGRATION_PASSWORD,
  ]) {
    const state = fake();
    await assert.rejects(
      setRuntimePassword({
        environment: { ...environment, NEON_APP_NEW_PASSWORD: password },
        runClient: state.runClient,
      }),
      { message: failureMessage },
    );
    assert.equal(state.runs, 0);
  }
  for (const change of [
    { NEON_MIGRATION_HOST: '127.0.0.1' },
    {
      NEON_MIGRATION_HOST:
        'ep-offline-password-pooler.eu-central-1.aws.neon.tech',
    },
    { NEON_MIGRATION_CONFIRM_TARGET: 'wrong' },
    { NEON_MIGRATION_PASSWORD: undefined },
  ]) {
    const state = fake();
    await assert.rejects(
      setRuntimePassword({
        environment: { ...environment, ...change },
        runClient: state.runClient,
      }),
      { message: failureMessage },
    );
    assert.equal(state.runs, 0);
  }
  for (const password of ['x'.repeat(20), 'x'.repeat(128)]) {
    const state = fake();
    assert.deepEqual(
      await setRuntimePassword({
        environment: { ...environment, NEON_APP_NEW_PASSWORD: password },
        runClient: state.runClient,
      }),
      receipt,
    );
  }
});

test('transaction reuses exact reviewed effective-role guard, requires already active LOGIN and escapes quotes/backslashes for fixed role only', async () => {
  const state = fake();
  await setRuntimePassword({
    environment: {
      ...environment,
      NEON_APP_NEW_PASSWORD: "Alpha'\\Beta-1234567890!",
    },
    runClient: state.runClient,
  });
  const guardFile = (
    await readFile(
      new URL('../database/neon/activate-runtime-role.sql', import.meta.url),
      'utf8',
    )
  ).replaceAll('\r\n', '\n');
  const guard = /^DO \$guard\$\n[\s\S]+?\n\$guard\$;/m.exec(guardFile)[0];
  assert.equal(state.calls[1], 'BEGIN');
  assert.equal(
    state.calls[2],
    "SET LOCAL password_encryption = 'scram-sha-256'",
  );
  assert.equal(state.calls[3], guard);
  assert.match(guard, /has_any_column_privilege/);
  assert.match(guard, /pg_auth_members/);
  assert.match(guard, /pg_namespace WHERE nspowner/);
  assert.equal(
    state.calls[4],
    "SELECT rolcanlogin FROM pg_roles WHERE rolname = 'platypus_app'",
  );
  assert.equal(
    state.calls[5],
    "ALTER ROLE platypus_app PASSWORD  E'Alpha''\\\\Beta-1234567890!'",
  );
  assert.equal(state.calls[6], 'COMMIT');
  assert.equal(
    state.calls.filter((sql) => sql.startsWith('ALTER ROLE')).length,
    1,
  );
  assert(
    !state.calls.some((sql) =>
      /CREATE ROLE|ALTER ROLE platypus_app LOGIN|GRANT /.test(sql),
    ),
  );
});

test('wrong connected owner/version/encoding stops before transaction or password mutation', async () => {
  for (const difference of [
    { database: 'other' },
    { username: 'platypus_app' },
    { version: 170006 },
    { encoding: 'LATIN1' },
  ]) {
    const state = fake();
    state.query = async (sql) => {
      state.calls.push(sql);
      return { rows: [{ ...identity, ...difference }] };
    };
    await assert.rejects(
      setRuntimePassword({ environment, runClient: state.runClient }),
      { message: failureMessage },
    );
    assert.equal(state.calls.length, 1);
  }
});

test('effective-role guard failure and NOLOGIN/malformed role rows roll back before ALTER without raw error exposure', async () => {
  for (const scenario of [
    'guard',
    'nologin',
    'missing',
    'ambiguous',
    'string',
  ]) {
    const state = fake(),
      query = state.query.bind(state);
    state.query = async (sql) => {
      if (scenario === 'guard' && sql.startsWith('DO $guard$')) {
        state.calls.push(sql);
        throw Object.assign(
          new Error('private owner endpoint password detail'),
          { code: 'PRIVATE' },
        );
      }
      if (scenario !== 'guard' && sql.startsWith('SELECT rolcanlogin')) {
        state.calls.push(sql);
        return {
          rows:
            scenario === 'missing'
              ? []
              : scenario === 'ambiguous'
                ? [{ rolcanlogin: true }, { rolcanlogin: true }]
                : [{ rolcanlogin: scenario === 'string' ? 'true' : false }],
        };
      }
      return query(sql);
    };
    await assert.rejects(
      setRuntimePassword({ environment, runClient: state.runClient }),
      (error) => {
        assert.equal(error.message, failureMessage);
        assert.equal(error.cause, undefined);
        assert.equal(error.code, undefined);
        return true;
      },
    );
    assert.equal(state.calls.at(-1), 'ROLLBACK');
    assert(!state.calls.some((sql) => sql.startsWith('ALTER ROLE')));
    assert.equal(state.runs, 1);
  }
});

test('password mutation failure attempts one bounded-owner rollback and never replays, including rollback failure', async () => {
  for (const rollbackFails of [false, true]) {
    const state = fake(),
      query = state.query.bind(state);
    state.query = async (sql) => {
      if (
        sql.startsWith('ALTER ROLE') ||
        (rollbackFails && sql === 'ROLLBACK')
      ) {
        state.calls.push(sql);
        throw new Error(environment.NEON_APP_NEW_PASSWORD);
      }
      return query(sql);
    };
    await assert.rejects(
      setRuntimePassword({ environment, runClient: state.runClient }),
      { message: failureMessage },
    );
    assert.equal(state.runs, 1);
    assert.equal(
      state.calls.filter((sql) => sql.startsWith('ALTER ROLE')).length,
      1,
    );
    assert.equal(state.calls.filter((sql) => sql === 'ROLLBACK').length, 1);
    assert(!state.calls.includes('COMMIT'));
  }
});

test('lost COMMIT response or cleanup after COMMIT yields uncertain outcome and requires app check, without rollback certainty or replay', async () => {
  for (const cleanupFailure of [false, true]) {
    const state = fake(),
      query = state.query.bind(state);
    state.query = async (sql) => {
      if (!cleanupFailure && sql === 'COMMIT') {
        state.calls.push(sql);
        throw new Error('private COMMIT response');
      }
      return query(sql);
    };
    const runClient = async (...args) => {
      const result = await state.runClient(...args);
      if (cleanupFailure) throw new Error('private end error');
      return result;
    };
    await assert.rejects(setRuntimePassword({ environment, runClient }), {
      message: uncertainMessage,
    });
    assert.equal(state.calls.filter((sql) => sql === 'COMMIT').length, 1);
    assert(!state.calls.includes('ROLLBACK'));
    assert.equal(
      state.calls.filter((sql) => sql.startsWith('ALTER ROLE')).length,
      1,
    );
    assert.equal(state.runs, 1);
  }
});

test('real owned client deadline aborts late password work, closes once and prevents late COMMIT', async () => {
  class Owned extends EventEmitter {
    calls = [];
    ends = 0;
    destroyed = 0;
    late;
    connection = {
      stream: {
        destroy: () => {
          this.destroyed++;
        },
      },
    };
    async connect() {}
    async end() {
      this.ends++;
    }
    async query(sql) {
      this.calls.push(sql);
      if (sql.startsWith('SELECT current_database()'))
        return { rows: [{ ...identity }] };
      if (sql.startsWith('SELECT rolcanlogin'))
        return { rows: [{ rolcanlogin: true }] };
      if (sql.startsWith('ALTER ROLE'))
        return new Promise((resolve) => {
          this.late = resolve;
        });
      return { rows: [] };
    }
  }
  const owned = new Owned();
  await assert.rejects(
    setRuntimePassword({
      environment,
      runClient: (config, work) =>
        withMigrationClient(config, work, {
          clientFactory: () => owned,
          timeoutMillis: 25,
        }),
    }),
    { message: failureMessage },
  );
  assert.equal(owned.ends, 1);
  assert.equal(owned.destroyed, 1);
  assert.equal(typeof owned.late, 'function');
  owned.late({ rows: [] });
  await new Promise((resolve) => setImmediate(resolve));
  assert(!owned.calls.includes('COMMIT'));
  assert.equal(
    owned.calls.filter((sql) => sql.startsWith('ALTER ROLE')).length,
    1,
  );
});

test('guard file drift or unrecognized activation structure is refused before opening a connection', async (t) => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const parent = path.join(root, '.local');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(
    path.join(parent, 'runtime-password-guard-test-'),
  );
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(parent));
    assert(path.basename(directory).startsWith('runtime-password-guard-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  const source = await readFile(
    new URL('../database/neon/runtime-password.mjs', import.meta.url),
    'utf8',
  );
  const activation = await readFile(
    new URL('../database/neon/activate-runtime-role.sql', import.meta.url),
    'utf8',
  );
  await writeFile(path.join(directory, 'runtime-password.mjs'), source);
  await writeFile(
    path.join(directory, 'connection.mjs'),
    `export * from ${JSON.stringify(new URL('../database/neon/connection.mjs', import.meta.url).href)};`,
  );
  const copied = await import(
    pathToFileURL(path.join(directory, 'runtime-password.mjs'))
  );
  for (const changed of [
    activation.replace('has_any_column_privilege', 'has_table_privilege'),
    activation.replace(
      'ALTER ROLE platypus_app LOGIN;',
      'ALTER ROLE platypus_app CREATEDB;',
    ),
    activation + '\nSELECT 1;',
  ]) {
    await writeFile(path.join(directory, 'activate-runtime-role.sql'), changed);
    const state = fake();
    await assert.rejects(
      copied.setRuntimePassword({ environment, runClient: state.runClient }),
      { message: failureMessage },
    );
    assert.equal(state.runs, 0);
  }
});

test('CLI is import-inert, accepts exactly set and refuses missing app config without connection or private output', async () => {
  const file = fileURLToPath(
    new URL('../database/neon/runtime-password.mjs', import.meta.url),
  );
  async function child(args) {
    const env = { ...process.env };
    for (const key of Object.keys(env))
      if (key.startsWith('NEON_') || key.startsWith('PG')) delete env[key];
    const proc = spawn(process.execPath, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '',
      err = '';
    proc.stdout.on('data', (bytes) => (out += bytes));
    proc.stderr.on('data', (bytes) => (err += bytes));
    const [code] = await once(proc, 'close');
    return { code, out, err };
  }
  for (const args of [[], ['other'], ['set', 'Private-Argument-Sentinel']]) {
    const result = await child([file, ...args]);
    assert.equal(result.code, 1);
    assert.equal(result.out, '');
    assert.equal(
      result.err.trim(),
      'Choose runtime-password.mjs set without additional arguments.',
    );
  }
  const missing = await child([file, 'set']);
  assert.equal(missing.code, 1);
  assert.equal(missing.err.trim(), failureMessage);
  assert.equal(missing.out, '');
  const imported = await child([
    '--input-type=module',
    '-e',
    `await import(${JSON.stringify(pathToFileURL(file).href)}); console.log('import-only');`,
  ]);
  assert.equal(imported.code, 0);
  assert.equal(imported.err, '');
  assert.equal(imported.out.trim(), 'import-only');
});
