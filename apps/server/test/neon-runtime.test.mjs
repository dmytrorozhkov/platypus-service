import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  createNeonRuntime,
  probeNeonConnection,
  readNeonRuntimeConfiguration,
  neonProbeSql,
} from '../dist/neon-runtime.js';
import { attachNeonStdinControl } from '../dist/neon-main.js';

const environment = {
  NEON_HOST: 'ep-offline-example-pooler.eu-central-1.aws.neon.tech',
  NEON_DATABASE: 'neondb',
  NEON_USER: 'platypus_app',
  NEON_PASSWORD: 'fake-private-value',
  NEON_CONFIRM_TARGET:
    'ep-offline-example-pooler.eu-central-1.aws.neon.tech/neondb',
};
const accepted = {
  version_num: '180006',
  encoding: 'UTF8',
  read_only: 'on',
  database_name: 'neondb',
  database_user: 'platypus_app',
  session_user_name: 'platypus_app',
  can_login: true,
  superuser: false,
  create_database: false,
  create_role: false,
  replication: false,
  bypass_rls: false,
  inherit: false,
  has_memberships: false,
  owns_database: false,
  owns_schema: false,
  owns_business_table: false,
  schema_usage: true,
  schema_create: false,
  database_create: false,
  business_select: true,
  business_write: false,
};
const ticket = {
  number: 'PS-1001',
  subject: 'Offline example',
  organization: 'Example organization',
  status: 'New',
  assignee: null,
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
};
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function example(options = {}) {
  const queries = [];
  const signals = new EventEmitter();
  const logs = [];
  const connection = {
    closeCalls: 0,
    run: async (text) => ({
      rows:
        text === neonProbeSql
          ? [{ ...accepted }]
          : [{ items: [ticket], total: '100000' }],
    }),
    query(text, values) {
      queries.push({ text, values });
      return this.run(text, values);
    },
    async close() {
      this.closeCalls++;
    },
  };
  const runtime = createNeonRuntime({
    configuration: { ...readNeonRuntimeConfiguration(environment), port: 0 },
    connection,
    signals,
    log: (value) => logs.push(value),
    ...options,
  });
  return { runtime, connection, queries, signals, logs };
}
const url = (runtime) => 'http://localhost:' + runtime.server.address().port;

test('Neon runtime configuration accepts only explicit Frankfurt app identity and target confirmation', () => {
  const configuration = readNeonRuntimeConfiguration({
    ...environment,
    PGHOST: 'secret-host',
    PGPASSWORD: 'secret',
    DATABASE_URL: 'private',
  });
  assert.equal(configuration.port, 3002);
  assert.deepEqual(configuration.allowedOrigins, ['http://localhost:5177']);
  assert.equal(configuration.database.max, 2);
  assert.equal(configuration.database.ssl.rejectUnauthorized, true);
  assert.deepEqual(Object.keys(configuration.environment).sort(), [
    'NEON_DATABASE',
    'NEON_HOST',
    'NEON_PASSWORD',
    'NEON_USER',
  ]);
  assert.equal(
    readNeonRuntimeConfiguration({
      ...environment,
      NEON_HOST: 'ep-offline-example-pooler.c-2.eu-central-1.aws.neon.tech',
      NEON_CONFIRM_TARGET:
        'ep-offline-example-pooler.c-2.eu-central-1.aws.neon.tech/neondb',
      PORT: '3010',
      ALLOWED_ORIGINS: 'http://localhost:9000',
    }).port,
    3010,
  );
  for (const key of Object.keys(environment)) {
    const missing = { ...environment };
    delete missing[key];
    assert.throws(
      () => readNeonRuntimeConfiguration(missing),
      /^Error: Invalid explicit Neon runtime configuration\.$/,
    );
  }
  for (const change of [
    { NEON_USER: 'neondb_owner' },
    { NEON_DATABASE: 'other' },
    { NEON_CONFIRM_TARGET: 'wrong' },
    { NEON_HOST: 'ep-offline-example-pooler.us-east-1.aws.neon.tech' },
    { PORT: '0' },
    { PORT: '65536' },
    { PORT: '3002x' },
    { ALLOWED_ORIGINS: 'https://private/path' },
  ])
    assert.throws(
      () => readNeonRuntimeConfiguration({ ...environment, ...change }),
      /^Error: Invalid explicit Neon runtime configuration\.$/,
    );
});

test('single read-only probe checks effective grants, column writes, direct memberships, role flags and identity', async () => {
  const calls = [];
  assert.deepEqual(
    await probeNeonConnection({
      async query(text) {
        calls.push(text);
        return { rows: [accepted] };
      },
    }),
    {
      versionMajor: 18,
      database: 'neondb',
      user: 'platypus_app',
      readOnly: true,
    },
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0], /has_any_column_privilege/);
  assert.match(calls[0], /pg_auth_members/);
  for (const [key, value] of Object.entries(accepted)) {
    const bad = {
      ...accepted,
      [key]: typeof value === 'boolean' ? !value : 'private-invalid-value',
    };
    await assert.rejects(
      probeNeonConnection({
        async query() {
          return { rows: [bad] };
        },
      }),
      {
        message: 'Neon connection identity or permissions check failed.',
      },
    );
  }
  for (const rows of [
    [],
    [accepted, accepted],
    [{ ...accepted, business_write: 'false' }],
    [{ ...accepted, business_select: null }],
  ])
    await assert.rejects(
      probeNeonConnection({
        async query() {
          return { rows };
        },
      }),
    );
  await assert.rejects(
    probeNeonConnection({
      async query() {
        throw new Error('password=fake-private-value host=private');
      },
    }),
    {
      message: 'Neon connection identity or permissions check failed.',
    },
  );
});

test('real owned HTTP starts only after probe, keeps health query-free and preserves paged query/CORS/no-store', async (t) => {
  const { runtime, queries, connection } = example();
  assert.equal(queries.length, 0);
  assert.equal(runtime.server.listening, false);
  await runtime.start();
  t.after(() => runtime.stop());
  assert.equal(queries.length, 1);
  const health = await fetch(url(runtime) + '/api/health');
  assert.deepEqual(await health.json(), { status: 'ok' });
  assert.equal(queries.length, 1);
  const response = await fetch(
    url(runtime) + '/api/tickets/query?page=2&pageSize=25&status=New',
    { headers: { Origin: 'http://localhost:5177' } },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'http://localhost:5177',
  );
  const body = await response.json();
  assert.equal(body.total, 100000);
  assert.equal(body.page, 2);
  assert.equal(body.items[0].subject, ticket.subject);
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[1].values, ['New', 25, 25]);
  const forbidden = await fetch(url(runtime) + '/api/tickets', {
    method: 'POST',
  });
  assert.equal(forbidden.status, 405);
  await runtime.stop();
  assert.equal(connection.closeCalls, 1);
});

test('probe rejection cleans once, never listens or serves fixtures, and sanitizes errors', async () => {
  const { runtime, connection, queries, signals } = example();
  connection.run = async () => ({ rows: [{ ...accepted, superuser: true }] });
  const first = runtime.start();
  assert.strictEqual(runtime.start(), first);
  await assert.rejects(first, { message: 'Neon runtime could not start.' });
  await runtime.stop();
  assert.equal(queries.length, 1);
  assert.equal(connection.closeCalls, 1);
  assert.equal(runtime.server.listening, false);
  assert.equal(signals.listenerCount('SIGINT'), 0);
});

test('stop during a pending probe rejects startup before late query settlement and cannot listen later', async () => {
  const { runtime, connection, signals } = example();
  const pending = deferred();
  connection.run = () => pending.promise;
  const startup = runtime.start();
  const result = assert.rejects(startup, /could not start/);
  signals.emit('SIGTERM');
  const stopped = runtime.stop();
  assert.strictEqual(runtime.stop(), stopped);
  await Promise.all([result, stopped]);
  assert.equal(connection.closeCalls, 1);
  assert.equal(runtime.server.listening, false);
  pending.resolve({ rows: [accepted] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(runtime.server.listening, false);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});

test('stop before start owns close and never attaches signal listeners or runs SQL', async () => {
  const { runtime, queries, connection, signals } = example();
  await runtime.stop();
  await assert.rejects(runtime.start(), /could not start/);
  assert.equal(connection.closeCalls, 1);
  assert.equal(queries.length, 0);
  assert.equal(signals.listenerCount('SIGINT'), 0);
});

test('HTTP failure is sanitized and later explicit Retry succeeds without hidden replay', async (t) => {
  const { runtime, connection, queries, logs } = example();
  await runtime.start();
  t.after(() => runtime.stop());
  connection.run = async () => {
    throw Object.assign(new Error('password=fake-private-value'), {
      code: 'secret-code',
    });
  };
  const failure = await fetch(url(runtime) + '/api/tickets/query');
  assert.equal(failure.status, 500);
  assert.doesNotMatch(JSON.stringify(await failure.json()), /private|secret/);
  assert.deepEqual(logs, ['Neon ticket request failed.']);
  assert.equal(queries.length, 2);
  connection.run = async () => ({
    rows: [{ items: [ticket], total: '100000' }],
  });
  assert.equal((await fetch(url(runtime) + '/api/tickets/query')).status, 200);
  assert.equal(queries.length, 3);
});

test('shutdown drains real owned HTTP work before closing connection and removes signals', async () => {
  const { runtime, connection, signals } = example();
  await runtime.start();
  const entered = deferred(),
    result = deferred();
  connection.run = () => {
    entered.resolve();
    return result.promise;
  };
  const response = fetch(url(runtime) + '/api/tickets/query');
  await entered.promise;
  const stopped = runtime.stop();
  assert.equal(connection.closeCalls, 0);
  result.resolve({ rows: [{ items: [ticket], total: '100000' }] });
  assert.equal((await response).status, 200);
  await stopped;
  assert.equal(connection.closeCalls, 1);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});

test('listen failure preserves independently owned listener and cleanup is bounded', async (t) => {
  const occupied = createServer();
  occupied.listen(0, 'localhost');
  await once(occupied, 'listening');
  t.after(() => new Promise((resolve) => occupied.close(resolve)));
  const { runtime, connection } = example({
    configuration: {
      ...readNeonRuntimeConfiguration(environment),
      port: occupied.address().port,
    },
  });
  await assert.rejects(runtime.start(), /could not start/);
  assert.equal(connection.closeCalls, 1);
  assert.equal(occupied.listening, true);
  const hanging = example({ poolDrainMillis: 20 });
  hanging.connection.close = () => new Promise(() => {});
  await hanging.runtime.start();
  await assert.rejects(hanging.runtime.stop(), /cleanup failed/);
  assert.equal(hanging.runtime.server.listening, false);
  assert.equal(hanging.signals.listenerCount('SIGTERM'), 0);
});

test('parent stdin control handles split stop, EOF, invalid/oversized input and observes cleanup rejection', async () => {
  for (const kind of ['split', 'eof', 'oversized', 'invalid', 'rejection']) {
    const input = new PassThrough();
    let stops = 0,
      failures = 0;
    const cleanup = attachNeonStdinControl(
      input,
      {
        async stop() {
          stops++;
          if (kind === 'rejection') throw new Error('private');
        },
      },
      () => failures++,
    );
    if (kind === 'split') {
      input.write('st');
      input.write('op\r\n');
    } else if (kind === 'eof') input.end();
    else if (kind === 'oversized') input.write('x'.repeat(10000));
    else if (kind === 'invalid') input.write(Buffer.from([255]));
    else input.write('stop\n');
    await new Promise((resolve) => setImmediate(resolve));
    cleanup();
    assert.equal(stops, 1);
    assert.equal(input.listenerCount('data'), 0);
    assert.equal(input.listenerCount('end'), 0);
    assert.equal(input.isPaused(), true);
    assert.equal(failures, kind === 'rejection' ? 1 : 0);
    input.destroy();
  }
});

test('executable requires one exact command/config and module import has no startup side effects', async () => {
  const main = fileURLToPath(new URL('../dist/neon-main.js', import.meta.url));
  async function child(args) {
    const env = { ...process.env };
    for (const key of Object.keys(env))
      if (
        key.startsWith('NEON_') ||
        key.startsWith('PG') ||
        key === 'DATABASE_URL'
      )
        delete env[key];
    const processChild = spawn(process.execPath, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '',
      err = '';
    processChild.stdout.on('data', (value) => (out += value));
    processChild.stderr.on('data', (value) => (err += value));
    const [code] = await once(processChild, 'exit');
    return { code, out, err };
  }
  for (const args of [[], ['unknown'], ['check', 'extra']]) {
    const result = await child([main, ...args]);
    assert.equal(result.code, 1);
    assert.equal(result.out, '');
    assert.match(result.err, /Use neon-main.js check or serve/);
  }
  for (const command of ['check', 'serve']) {
    const result = await child([main, command]);
    assert.equal(result.code, 1);
    assert.equal(result.out, '');
    assert.equal(result.err.trim(), 'Neon command failed.');
  }
  const result = await child([
    '--input-type=module',
    '-e',
    `await import(${JSON.stringify(new URL('../dist/neon-main.js', import.meta.url).href)}); console.log('import-only');`,
  ]);
  assert.equal(result.code, 0);
  assert.equal(result.out.trim(), 'import-only');
  assert.equal(result.err, '');
});
