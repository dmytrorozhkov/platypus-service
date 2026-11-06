import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  createPostgresRuntime,
  readPostgresConfiguration,
} from '../dist/postgres-runtime.js';

const environment = {
  PGHOST: '127.0.0.1',
  PGPORT: '5432',
  PGDATABASE: 'platypus_service_test',
  PGUSER: 'test_reader',
  PGPASSWORD: 'private password',
};
const oneRow = {
  number: 'PS-1001',
  subject: 'Example',
  organization: 'Example organization',
  status: 'New',
  assignee: null,
  created_at: new Date('2026-11-01T00:00:00Z'),
  updated_at: new Date('2026-11-01T00:00:00Z'),
};
class FakePool extends EventEmitter {
  endCalls = 0;
  queries = 0;
  run = async () => ({ rows: [oneRow] });
  finish = async () => {};
  async query() {
    this.queries++;
    return this.run();
  }
  async end() {
    this.endCalls++;
    await this.finish();
  }
}
function example(options = {}) {
  const pool = options.pool ?? new FakePool();
  const signals = new EventEmitter();
  const logs = [];
  const runtime = createPostgresRuntime({
    configuration: { ...readPostgresConfiguration(environment), port: 0 },
    pool,
    signals,
    log: (...values) => logs.push(values),
    ...options,
  });
  return { runtime, pool, signals, logs };
}
async function running(t, options) {
  const state = example(options);
  await state.runtime.start();
  t.after(() => state.runtime.stop());
  return {
    ...state,
    url: 'http://localhost:' + state.runtime.server.address().port,
  };
}

test('explicit local database configuration has bounded limits and never guesses required credentials', () => {
  const config = readPostgresConfiguration(environment);
  assert.equal(config.database.max, 5);
  assert.equal(config.database.connectionTimeoutMillis, 3000);
  assert.equal(config.database.statement_timeout, 5000);
  assert.equal(config.database.query_timeout, 6000);
  assert.equal(config.database.options, '-c default_transaction_read_only=on');
  assert.equal(config.database.ssl, false);
  for (const field of [
    'PGHOST',
    'PGPORT',
    'PGDATABASE',
    'PGUSER',
    'PGPASSWORD',
  ]) {
    const missing = { ...environment };
    delete missing[field];
    assert.throws(() => readPostgresConfiguration(missing), new RegExp(field));
  }
  for (const change of [
    { PGHOST: 'database.example.com' },
    { PGPORT: '0' },
    { PGPORT: '65536' },
    { PGPORT: '5432extra' },
    { PORT: '-1' },
    { ALLOWED_ORIGINS: 'https://example.com/path' },
  ])
    assert.throws(() =>
      readPostgresConfiguration({ ...environment, ...change }),
    );
  assert.equal(
    readPostgresConfiguration({ ...environment, PGPASSWORD: ' ' }).database
      .password,
    ' ',
  );
});

test('real HTTP over an injected pool preserves liveness, sanitized failures and a later Retry', async (t) => {
  const { runtime, pool, logs, url } = await running(t);
  assert.deepEqual(await (await fetch(url + '/api/health')).json(), {
    status: 'ok',
  });
  assert.equal(pool.queries, 0);
  pool.run = async () => {
    throw Object.assign(new Error('password=secret database_url=private'), {
      code: '08006',
    });
  };
  const failure = await fetch(url + '/api/tickets');
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), {
    error: { code: 'INTERNAL_ERROR', message: 'Tickets could not be loaded.' },
  });
  pool.emit(
    'error',
    Object.assign(new Error('password=secret'), { code: '57P01' }),
  );
  pool.emit(
    'error',
    Object.assign(new Error('password=secret'), { code: 'password=secret' }),
  );
  assert.deepEqual(logs, [
    ['Ticket database request failed.', '08006'],
    ['PostgreSQL pool operation failed.', '57P01'],
    ['PostgreSQL pool operation failed.', 'UNKNOWN'],
  ]);
  pool.run = async () => ({ rows: [oneRow] });
  const retried = await fetch(url + '/api/tickets');
  assert.equal(retried.status, 200);
  assert.equal((await retried.json()).total, 1);
  const forbiddenWrite = await fetch(url + '/api/tickets', { method: 'POST' });
  assert.equal(forbiddenWrite.status, 405);
  await runtime.stop();
  assert.equal(pool.endCalls, 1);
  assert.equal(pool.listenerCount('error'), 0);
});

test(
  'shutdown drains an in-flight HTTP request before closing the pool and is idempotent',
  { timeout: 3000 },
  async () => {
    const { runtime, pool, signals } = example();
    let release;
    let entered;
    const queryEntered = new Promise((resolve) => {
      entered = resolve;
    });
    pool.run = () => {
      entered();
      return new Promise((resolve) => {
        release = resolve;
      });
    };
    await runtime.start();
    const response = fetch(
      'http://localhost:' + runtime.server.address().port + '/api/tickets',
    );
    await queryEntered;
    const stopped = runtime.stop();
    assert.strictEqual(runtime.stop(), stopped);
    assert.equal(pool.endCalls, 0);
    release({ rows: [oneRow] });
    assert.equal((await (await response).json()).total, 1);
    await stopped;
    assert.equal(pool.endCalls, 1);
    assert.equal(runtime.server.listening, false);
    assert.equal(signals.listenerCount('SIGINT'), 0);
    assert.equal(signals.listenerCount('SIGTERM'), 0);
  },
);

test(
  'startup interruption closes the owned listener and pool once',
  { timeout: 3000 },
  async () => {
    const { runtime, pool, signals } = example();
    const started = runtime.start();
    signals.emit('SIGTERM');
    const [startResult, stopResult] = await Promise.allSettled([
      started,
      runtime.stop(),
    ]);
    assert.equal(startResult.status, 'rejected');
    assert.equal(stopResult.status, 'fulfilled');
    assert.equal(runtime.server.listening, false);
    assert.equal(pool.endCalls, 1);
    assert.equal(signals.listenerCount('SIGTERM'), 0);
  },
);

test(
  'HTTP drain deadline closes an owned stuck request before pool cleanup',
  { timeout: 3000 },
  async () => {
    const { runtime, pool } = example({ httpDrainMillis: 25 });
    let entered;
    const queryEntered = new Promise((resolve) => {
      entered = resolve;
    });
    pool.run = () => {
      entered();
      return new Promise(() => {});
    };
    await runtime.start();
    const response = fetch(
      'http://localhost:' + runtime.server.address().port + '/api/tickets',
    ).then(
      () => false,
      () => true,
    );
    await queryEntered;
    await runtime.stop();
    assert.equal(await response, true);
    assert.equal(runtime.server.listening, false);
    assert.equal(pool.endCalls, 1);
  },
);

test('stopping before listen prevents later startup and does not attach signal listeners', async () => {
  const { runtime, pool, signals } = example();
  await runtime.stop();
  await assert.rejects(runtime.start(), /already stopping/);
  assert.equal(pool.endCalls, 1);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
  assert.equal(signals.listenerCount('SIGINT'), 0);
});

test(
  'a listen failure can be cleaned up without touching an independently owned listener',
  { timeout: 3000 },
  async (t) => {
    const occupied = createServer();
    occupied.listen(0, 'localhost');
    await once(occupied, 'listening');
    t.after(() => new Promise((resolve) => occupied.close(resolve)));
    const { runtime, pool } = example({
      configuration: {
        ...readPostgresConfiguration(environment),
        port: occupied.address().port,
      },
    });
    await assert.rejects(runtime.start(), { code: 'EADDRINUSE' });
    await runtime.stop();
    assert.equal(pool.endCalls, 1);
    assert.equal(occupied.listening, true);
  },
);

test(
  'pool shutdown has a deadline and reports failure without exposing database details',
  { timeout: 3000 },
  async () => {
    const pool = new FakePool();
    pool.finish = () => new Promise(() => {});
    const { runtime, signals } = example({ pool, poolDrainMillis: 20 });
    await runtime.start();
    await assert.rejects(runtime.stop(), /shutdown deadline exceeded/);
    assert.equal(runtime.server.listening, false);
    assert.equal(pool.endCalls, 1);
    assert.equal(signals.listenerCount('SIGTERM'), 0);
  },
);

test(
  'explicit PostgreSQL executable rejects missing credentials without starting a fixture API',
  { timeout: 5000 },
  async () => {
    const childEnvironment = { ...process.env };
    for (const key of Object.keys(childEnvironment))
      if (key.startsWith('PG')) delete childEnvironment[key];
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('../dist/postgres-main.js', import.meta.url))],
      { env: childEnvironment, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (bytes) => {
      stdout += bytes;
    });
    child.stderr.on('data', (bytes) => {
      stderr += bytes;
    });
    const [code] = await once(child, 'exit');
    assert.equal(code, 1);
    assert.equal(stdout, '');
    assert.match(stderr, /PGHOST must be explicitly configured/);
  },
);
