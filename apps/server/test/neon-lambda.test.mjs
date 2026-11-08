import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNeonLambdaHandler,
  handler as defaultHandler,
} from '../dist/neon-lambda.js';
import { neonProbeSql } from '../dist/neon-runtime.js';

const account = '123456789012';
const origin = 'https://dexample.cloudfront.net';
const host = 'ep-offline-lambda-pooler.eu-central-1.aws.neon.tech';
const password = 'Private-Fake-App-Password-Only-32';
const environment = {
  AWS_REGION: 'eu-north-1',
  NEON_HOST: host,
  NEON_DATABASE: 'neondb',
  NEON_USER: 'platypus_app',
  NEON_CONFIRM_TARGET: host + '/neondb',
  ALLOWED_ORIGINS: origin,
  NEON_PASSWORD_PARAMETER_ARN: `arn:aws:ssm:eu-north-1:${account}:parameter/platypus-service/production/neon/password`,
  NEON_PASSWORD_PARAMETER_VERSION: '7',
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
const context = () => ({
  invokedFunctionArn: `arn:aws:lambda:eu-north-1:${account}:function:platypus:live`,
  getRemainingTimeInMillis: () => 30000,
});
const event = (
  rawPath = '/api/tickets/query',
  rawQueryString = '',
  method = 'GET',
  headers = { origin },
) => ({
  version: '2.0',
  rawPath,
  rawQueryString,
  requestContext: { http: { method } },
  headers,
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(options = {}) {
  const state = {
    secrets: 0,
    connections: [],
    secret: async () => password,
    query: async (sql) => ({
      rows:
        sql === neonProbeSql
          ? [{ ...accepted }]
          : sql.includes('AS organizations')
            ? [{ organizations: [], assignees: [] }]
            : [{ items: [ticket], total: '100000' }],
    }),
  };
  state.handler = createNeonLambdaHandler({
    environment,
    ...options,
    getPassword: async (args) => {
      state.secrets++;
      state.secretArgs = args;
      return state.secret(args);
    },
    createConnection: (configuration) => {
      const connection = {
        configuration,
        calls: [],
        closes: 0,
        async query(sql, values) {
          this.calls.push({ sql, values });
          return state.query(sql, values);
        },
        async close() {
          this.closes++;
          await state.close?.();
        },
      };
      state.connections.push(connection);
      return connection;
    },
  });
  return state;
}

test('Lambda is import-inert and health/preflight/invalid routes/CORS/queries/legacy list never load secret or SQL', async (t) => {
  const state = fixture();
  t.after(() => state.handler.close());
  assert.equal(state.secrets, 0);
  const cases = [
    [event('/api/health'), 200],
    [event('/api/tickets/query', '', 'OPTIONS'), 204],
    [event('/not-found'), 404],
    [event('/api/tickets/query', 'page=0'), 400],
    [event('/api/tickets/options', 'unexpected=1'), 400],
    [event('/api/tickets/query', '', 'POST'), 405],
    [
      event('/api/tickets/query', '', 'GET', {
        origin: 'https://wrong.invalid',
      }),
      403,
    ],
    [event('/api/tickets'), 500],
    [{}, 400],
  ];
  for (const [request, status] of cases)
    assert.equal((await state.handler(request)).statusCode, status);
  assert.equal(state.secrets, 0);
  assert.equal(state.connections.length, 0);
  assert.equal((await defaultHandler({})).statusCode, 500);
});

test('cold initialization probes before parameterized paged read and warm invocations reuse the bounded connection', async (t) => {
  const state = fixture();
  t.after(() => state.handler.close());
  const ctx = context();
  const first = await state.handler(
    event('/api/tickets/query', 'page=2&pageSize=25&status=New'),
    ctx,
  );
  assert.equal(first.statusCode, 200);
  assert.equal(JSON.parse(first.body).total, 100000);
  assert.equal(JSON.parse(first.body).page, 2);
  assert.equal(first.headers['cache-control'], 'no-store');
  assert.equal(first.headers['access-control-allow-origin'], origin);
  assert.equal(ctx.callbackWaitsForEmptyEventLoop, false);
  assert.equal(state.secrets, 1);
  assert.equal(state.connections.length, 1);
  const connection = state.connections[0];
  assert.equal(connection.configuration.operationTimeoutMillis, 8000);
  assert.equal(connection.configuration.closeTimeoutMillis, 3000);
  assert.equal(connection.configuration.environment.NEON_PASSWORD, password);
  assert.equal(connection.calls[0].sql, neonProbeSql);
  assert.deepEqual(connection.calls[1].values, ['New', 25, 25]);
  assert.equal((await state.handler(event(), context())).statusCode, 200);
  assert.equal(connection.calls.length, 3);
  assert.equal(state.secrets, 1);
});

test('concurrent cold invocations own one secret/probe initialization and both bounded reads', async (t) => {
  const state = fixture();
  t.after(() => state.handler.close());
  const secret = deferred();
  state.secret = () => secret.promise;
  const one = state.handler(event(), context()),
    two = state.handler(event(), context());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.secrets, 1);
  secret.resolve(password);
  assert.deepEqual(
    (await Promise.all([one, two])).map((value) => value.statusCode),
    [200, 200],
  );
  assert.equal(state.connections.length, 1);
  assert.equal(
    state.connections[0].calls.filter((call) => call.sql === neonProbeSql)
      .length,
    1,
  );
});

test('remaining time/account/region/config validation refuses business initialization before I/O', async () => {
  for (const ctx of [
    undefined,
    { ...context(), getRemainingTimeInMillis: () => 4000 },
    { ...context(), getRemainingTimeInMillis: () => NaN },
    {
      ...context(),
      invokedFunctionArn: context().invokedFunctionArn.replace(
        account,
        '999999999999',
      ),
    },
    {
      ...context(),
      invokedFunctionArn: context().invokedFunctionArn.replace(
        'eu-north-1',
        'us-east-1',
      ),
    },
  ]) {
    const state = fixture();
    assert.equal((await state.handler(event(), ctx)).statusCode, 500);
    assert.equal(state.secrets, 0);
    await state.handler.close();
  }
  for (const change of [
    { NEON_PASSWORD: 'unsafe-ambient-password' },
    { NEON_USER: 'neondb_owner' },
    { NEON_CONFIRM_TARGET: 'wrong' },
    { ALLOWED_ORIGINS: 'http://localhost:5177' },
  ]) {
    const state = fixture({ environment: { ...environment, ...change } });
    assert.equal((await state.handler(event(), context())).statusCode, 500);
    assert.equal(state.secrets, 0);
    await state.handler.close();
  }
});

test('failed secret/probe never falls back, is redacted, closes owned client and a later invocation retries explicitly', async () => {
  for (const stage of ['secret', 'probe']) {
    const state = fixture();
    if (stage === 'secret')
      state.secret = async () => {
        throw new Error(password);
      };
    else
      state.query = async () => ({
        rows: [{ ...accepted, business_write: true }],
      });
    const failed = await state.handler(event(), context());
    assert.equal(failed.statusCode, 500);
    assert(!failed.body.includes(password));
    assert(!failed.body.includes('PS-1001'));
    assert.equal(state.secrets, 1);
    if (stage === 'probe') assert.equal(state.connections[0].closes, 1);
    state.secret = async () => password;
    state.query = async (sql) => ({
      rows:
        sql === neonProbeSql
          ? [accepted]
          : [{ items: [ticket], total: '100000' }],
    });
    assert.equal((await state.handler(event(), context())).statusCode, 200);
    assert.equal(state.secrets, 2);
    await state.handler.close();
  }
});

test('request timeout during secret initialization aborts ownership and cannot create a late connection or resurrect cache', async () => {
  const state = fixture({ requestTimeoutMillis: 25 });
  const secret = deferred();
  state.secret = () => secret.promise;
  const failed = await state.handler(event(), context());
  assert.equal(failed.statusCode, 500);
  assert.equal(state.secretArgs.signal.aborted, true);
  secret.resolve(password);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.connections.length, 0);
  state.secret = async () => password;
  assert.equal((await state.handler(event(), context())).statusCode, 200);
  assert.equal(state.secrets, 2);
  await state.handler.close();
});

test('warm business failure and late timed-out work discard once with no replay; later explicit Retry initializes afresh', async () => {
  const state = fixture({ requestTimeoutMillis: 30 });
  assert.equal((await state.handler(event(), context())).statusCode, 200);
  const late = deferred();
  state.query = () => late.promise;
  assert.equal((await state.handler(event(), context())).statusCode, 500);
  assert.equal(state.connections[0].closes, 1);
  assert.equal(state.connections[0].calls.length, 3);
  late.resolve({ rows: [{ items: [ticket], total: '100000' }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.connections[0].calls.length, 3);
  state.query = async (sql) => ({
    rows:
      sql === neonProbeSql
        ? [accepted]
        : [{ items: [ticket], total: '100000' }],
  });
  assert.equal((await state.handler(event(), context())).statusCode, 200);
  assert.equal(state.connections.length, 2);
  assert.equal(state.secrets, 2);
  await state.handler.close();
});

test('close during pending secret or probe is bounded/idempotent and prevents later data/listener/cache startup', async () => {
  for (const stage of ['secret', 'probe']) {
    const state = fixture({ requestTimeoutMillis: 30 });
    const late = deferred();
    if (stage === 'secret') state.secret = () => late.promise;
    else state.query = () => late.promise;
    const pending = state.handler(event(), context());
    await new Promise((resolve) => setImmediate(resolve));
    const closed = state.handler.close();
    assert.strictEqual(state.handler.close(), closed);
    await closed;
    late.resolve(stage === 'secret' ? password : { rows: [accepted] });
    assert.equal((await pending).statusCode, 500);
    assert.equal((await state.handler(event(), context())).statusCode, 500);
    assert.equal(state.connections.length, stage === 'secret' ? 0 : 1);
    if (stage === 'probe') assert.equal(state.connections[0].closes, 1);
  }
});

test('unconfirmed owned cleanup poisons environment rather than opening an overlapping replacement pool', async () => {
  const state = fixture({ cleanupTimeoutMillis: 20 });
  assert.equal((await state.handler(event(), context())).statusCode, 200);
  state.close = () => new Promise(() => {});
  state.query = async () => {
    throw new Error(password);
  };
  assert.equal((await state.handler(event(), context())).statusCode, 500);
  await state.handler.close();
  assert.equal(state.connections[0].closes, 1);
  assert.equal((await state.handler(event(), context())).statusCode, 500);
  assert.equal(state.connections.length, 1);
});

test('factory snapshots environment, refuses enlarged deadlines and shares no caller-mutated warm configuration', async () => {
  const supplied = { ...environment };
  const state = fixture({ environment: supplied });
  supplied.NEON_USER = 'neondb_owner';
  supplied.NEON_PASSWORD_PARAMETER_VERSION = '99';
  assert.equal((await state.handler(event(), context())).statusCode, 200);
  assert.equal(
    state.secretArgs.environment.NEON_PASSWORD_PARAMETER_VERSION,
    '7',
  );
  await state.handler.close();
  for (const options of [
    { requestTimeoutMillis: 25001 },
    { operationTimeoutMillis: 8001 },
    { cleanupTimeoutMillis: 3001 },
  ])
    assert.throws(() => createNeonLambdaHandler(options));
});
