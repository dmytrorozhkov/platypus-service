import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createServer, Socket } from 'node:net';
import { createSecureContext, TLSSocket } from 'node:tls';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Client, Pool } from 'pg';
import {
  createNeonConnection,
  readNeonConfiguration,
} from '../dist/neon-connection.js';

const environment = {
  NEON_HOST: 'ep-test-example-pooler.eu-central-1.aws.neon.tech',
  NEON_DATABASE: 'platypus_service',
  NEON_USER: 'platypus_reader',
  NEON_PASSWORD: 'private fictional password',
};
const failed = { message: 'Neon database operation failed.' };
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
class FakeClient extends EventEmitter {
  statements = [];
  releases = [];
  run = async () => ({ rows: [] });
  async query(text, values) {
    this.statements.push({ text, values });
    return this.run(text, values);
  }
  release(destroy = false) {
    this.releases.push(destroy);
  }
}
class FakePool extends EventEmitter {
  clients = [];
  connects = 0;
  ends = 0;
  finish = async () => {};
  async connect() {
    this.connects++;
    return this.clients.shift();
  }
  async end() {
    this.ends++;
    await this.finish();
  }
}
function setup(options = {}) {
  const pool = new FakePool();
  const logs = [];
  const connection = createNeonConnection({
    environment,
    poolFactory: () => pool,
    log: (message) => logs.push(message),
    ...options,
  });
  return { connection, pool, logs };
}

test('explicit pooled AWS configuration is bounded, strict and never guesses missing fields', () => {
  const configuration = readNeonConfiguration(environment);
  assert.equal(configuration.max, 2);
  assert.equal(configuration.min, 0);
  assert.equal(configuration.connectionTimeoutMillis, 10000);
  assert.equal(configuration.idleTimeoutMillis, 10000);
  assert.equal(configuration.maxLifetimeSeconds, 300);
  assert.equal(configuration.keepAlive, false);
  assert.equal(configuration.ssl.rejectUnauthorized, true);
  assert.equal(configuration.options, ' ');
  assert.equal(configuration.replication, 'false');
  for (const NEON_HOST of [
    environment.NEON_HOST,
    'ep-test-example-pooler.c-2.eu-central-1.aws.neon.tech',
    'ep-test-example-pooler.us-east-2.aws.neon.tech',
  ])
    assert.equal(
      readNeonConfiguration({ ...environment, NEON_HOST }).host,
      NEON_HOST,
    );
  for (const key of Object.keys(environment)) {
    const missing = { ...environment };
    delete missing[key];
    assert.throws(
      () => readNeonConfiguration(missing),
      /Invalid explicit Neon/,
    );
  }
  let factories = 0;
  for (const change of [
    { NEON_HOST: '127.0.0.1' },
    { NEON_HOST: 'localhost' },
    { NEON_HOST: 'ep-test.eu-central-1.aws.neon.tech' },
    { NEON_HOST: environment.NEON_HOST + '.evil.test' },
    { NEON_HOST: environment.NEON_HOST + '\n' },
    {
      NEON_HOST: 'ep-' + 'x'.repeat(64) + '-pooler.eu-central-1.aws.neon.tech',
    },
    { NEON_HOST: 'postgres://' + environment.NEON_HOST },
    { NEON_HOST: 'ep-test-pooler.eu-central-1.azure.neon.tech' },
    { NEON_HOST: 'ep-test-pooler.c-0.eu-central-1.aws.neon.tech' },
    { NEON_DATABASE: '' },
    { NEON_DATABASE: 'x/y' },
    { NEON_USER: 'x?sslmode=disable' },
    { NEON_USER: 'x'.repeat(64) },
    { NEON_PASSWORD: '' },
    { NEON_PASSWORD: 'postgres://private@secret' },
    { NEON_PASSWORD: 'secret\0value' },
  ]) {
    assert.throws(
      () =>
        createNeonConnection({
          environment: { ...environment, ...change },
          poolFactory: () => {
            factories++;
            return new FakePool();
          },
        }),
      /Invalid explicit Neon/,
    );
  }
  assert.equal(factories, 0);
  for (const value of [0, -1, 15001, Infinity, NaN, 1.1])
    assert.throws(
      () => setup({ operationTimeoutMillis: value }),
      /Invalid explicit Neon/,
    );
  assert.throws(
    () => setup({ closeTimeoutMillis: 3001 }),
    /Invalid explicit Neon/,
  );
});

test('real pg parameters cannot inherit hostile PG target, TLS or startup values', () => {
  const hostile = {
    PGHOST: 'attacker.invalid',
    PGPORT: '1',
    PGUSER: 'attacker',
    PGDATABASE: 'wrong',
    PGPASSWORD: 'wrong secret',
    PGOPTIONS: '-c default_transaction_read_only=off',
    PGSSLMODE: 'no-verify',
    PGSSLNEGOTIATION: 'invalid secret',
    PGREPLICATION: 'database',
    PGCLIENT_ENCODING: 'SQL_ASCII',
    PGAPPNAME: 'wrong',
    PGCONNECT_TIMEOUT: '900',
    DATABASE_URL:
      'postgres://wrong:secret@attacker.invalid/wrong?sslmode=disable',
  };
  const before = Object.fromEntries(
    Object.keys(hostile).map((key) => [key, process.env[key]]),
  );
  try {
    Object.assign(process.env, hostile);
    const config = readNeonConfiguration({ ...environment, ...hostile });
    const parameters = new Client(config).connectionParameters;
    for (const key of [
      'host',
      'database',
      'user',
      'password',
      'port',
      'options',
      'sslnegotiation',
      'client_encoding',
      'replication',
      'application_name',
    ])
      assert.equal(parameters[key], config[key]);
    assert.equal(parameters.ssl.rejectUnauthorized, true);
    assert.equal(parameters.connect_timeout, 10);
    assert.equal(config.connectionString, undefined);
    assert.ok(
      parameters.ssl.checkServerIdentity('ignored', {
        subjectaltname: 'DNS:attacker.invalid',
      }),
    );
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('each successful read uses exactly one client and commits its own local read-only transaction', async () => {
  const { connection, pool } = setup();
  const client = new FakeClient();
  pool.clients.push(client);
  client.run = async (text) => ({
    rows: text === 'SELECT $1' ? [{ number: 'PS-1' }] : [],
  });
  assert.deepEqual(await connection.query('SELECT $1', ['PS-1']), {
    rows: [{ number: 'PS-1' }],
  });
  assert.deepEqual(client.statements, [
    { text: 'BEGIN READ ONLY', values: undefined },
    { text: "SET LOCAL statement_timeout = '5000ms'", values: undefined },
    { text: "SET LOCAL lock_timeout = '2000ms'", values: undefined },
    {
      text: "SET LOCAL idle_in_transaction_session_timeout = '6000ms'",
      values: undefined,
    },
    { text: 'SELECT $1', values: ['PS-1'] },
    { text: 'COMMIT', values: undefined },
  ]);
  assert.equal(pool.connects, 1);
  assert.deepEqual(client.releases, [false]);
  assert.equal(client.listenerCount('error'), 0);
  await connection.close();
});

test('business failures roll back and discard with no SQL replay or secret-bearing error cause/log', async () => {
  const { connection, pool, logs } = setup();
  const client = new FakeClient();
  pool.clients.push(client);
  client.run = async (text) => {
    if (text === 'SELECT private')
      throw Object.assign(new Error('PASSWORD secret host URL'), {
        code: 'SECRET-CODE',
      });
    return { rows: [] };
  };
  await assert.rejects(connection.query('SELECT private'), (error) => {
    assert.equal(error.message, failed.message);
    assert.equal(error.cause, undefined);
    assert.deepEqual(Object.keys(error), []);
    return true;
  });
  assert.equal(client.statements.at(-1).text, 'ROLLBACK');
  assert.equal(
    client.statements.filter(({ text }) => text === 'SELECT private').length,
    1,
  );
  assert.deepEqual(client.releases, [true]);
  assert.deepEqual(logs, [failed.message]);
  await connection.close();
});

test('a stale client fails once and a later explicit Retry checks out a fresh client', async () => {
  const { connection, pool } = setup();
  const stale = new FakeClient();
  const healthy = new FakeClient();
  stale.run = async () => {
    throw new Error('secret auth/TLS/network error');
  };
  pool.clients.push(stale, healthy);
  await assert.rejects(connection.query('SELECT 1'), failed);
  assert.equal(pool.connects, 1);
  assert.equal(stale.statements.length, 1);
  await connection.query('SELECT 1');
  assert.equal(pool.connects, 2);
  assert.deepEqual(stale.releases, [true]);
  assert.deepEqual(healthy.releases, [false]);
  await connection.close();
});

test('hung checkout is bounded and late ownership is discarded without executing SQL', async () => {
  const { connection, pool } = setup({ operationTimeoutMillis: 20 });
  const checkout = deferred();
  pool.connect = () => checkout.promise;
  await assert.rejects(connection.query('SELECT 1'), failed);
  const late = new FakeClient();
  checkout.resolve(late);
  await delay(0);
  assert.deepEqual(late.releases, [true]);
  assert.deepEqual(late.statements, []);
  await connection.close();
});

test('hung business query is discarded at the overall deadline; late success never commits', async () => {
  const { connection, pool } = setup({ operationTimeoutMillis: 20 });
  const query = deferred();
  const client = new FakeClient();
  pool.clients.push(client);
  client.run = (text) =>
    text === 'SELECT slow' ? query.promise : Promise.resolve({ rows: [] });
  await assert.rejects(connection.query('SELECT slow'), failed);
  assert.deepEqual(client.releases, [true]);
  query.resolve({ rows: [{ private: true }] });
  await delay(0);
  assert.equal(client.statements.at(-1).text, 'SELECT slow');
  assert.equal(client.releases.length, 1);
  await connection.close();
});

test('active client errors are owned, sanitized and discarded even while query does not settle', async () => {
  const { connection, pool } = setup();
  const client = new FakeClient();
  pool.clients.push(client);
  const started = deferred();
  const query = deferred();
  client.run = (text) => {
    if (text === 'SELECT slow') {
      started.resolve();
      return query.promise;
    }
    return Promise.resolve({ rows: [] });
  };
  const pending = connection.query('SELECT slow');
  await started.promise;
  client.emit('error', new Error('secret'));
  await assert.rejects(pending, failed);
  assert.deepEqual(client.releases, [true]);
  query.reject(new Error('late secret'));
  await delay(0);
  await connection.close();
});

test('idle pool errors and diagnostic sink failures are contained', async () => {
  const { connection, pool, logs } = setup();
  pool.emit('error', new Error('secret idle error'));
  assert.deepEqual(logs, ['Neon idle connection discarded.']);
  await connection.close();
  const throwing = setup({
    log: () => {
      throw new Error('secret log failure');
    },
  });
  throwing.pool.emit('error', new Error('secret'));
  await throwing.connection.close();
});

test('close is concurrent/idempotent, cancels active work and prevents new checkout', async () => {
  const { connection, pool } = setup();
  const checkout = deferred();
  pool.connect = () => checkout.promise;
  const pending = connection.query('SELECT 1');
  const rejection = assert.rejects(pending, failed);
  const first = connection.close();
  assert.equal(connection.close(), first);
  await first;
  await rejection;
  await assert.rejects(connection.query('SELECT 2'), failed);
  const late = new FakeClient();
  checkout.resolve(late);
  await delay(0);
  assert.deepEqual(late.releases, [true]);
  assert.equal(pool.ends, 1);
});

test('close deadline is bounded and never repeats pool.end or exposes its raw failure', async () => {
  const { connection, pool } = setup({ closeTimeoutMillis: 20 });
  const end = deferred();
  pool.finish = () => end.promise;
  const first = connection.close();
  await assert.rejects(first, { message: 'Neon connection cleanup failed.' });
  assert.equal(connection.close(), first);
  assert.equal(pool.ends, 1);
  end.reject(new Error('late close secret'));
  await delay(0);
});

test('at most two outstanding operations exist, including hung checkout ownership', async () => {
  const { connection, pool } = setup();
  const checkout = deferred();
  pool.connect = () => checkout.promise;
  const one = connection.query('SELECT 1');
  const two = connection.query('SELECT 2');
  const results = [assert.rejects(one, failed), assert.rejects(two, failed)];
  await assert.rejects(connection.query('SELECT 3'), failed);
  await connection.close();
  await Promise.all(results);
  checkout.reject(new Error('late secret'));
  await delay(0);
});

// Public test-only key/certificate: owned loopback fixtures, never production credentials.
const fixtureCertificate = String.raw`-----BEGIN CERTIFICATE-----
MIIDmTCCAoGgAwIBAgIUIjywEKIcBYAyg9VUDM+tNEmqLI0wDQYJKoZIhvcNAQEL
BQAwPDE6MDgGA1UEAwwxZXAtdGVzdC1leGFtcGxlLXBvb2xlci5ldS1jZW50cmFs
LTEuYXdzLm5lb24udGVjaDAeFw0yNjExMDYyMTExMjBaFw0zNjExMDMyMTExMjBa
MDwxOjA4BgNVBAMMMWVwLXRlc3QtZXhhbXBsZS1wb29sZXIuZXUtY2VudHJhbC0x
LmF3cy5uZW9uLnRlY2gwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC6
HdLLi/gCCXhFJ+aCDpwPiiKO01nwcoKufa0yA/66ZTXhCfw9bLw+A/UDaf5VZDTA
7MoTeh4Rlx/M1I19Ourql3s/wTdYz6QRhVxVA3aIBUMYoWmWtELRMSbH86RYNcyp
ZyhEDbR34r2tlOBPZFOHpPKOp0twPKJ1Zu67r6jYXTWyWkwmp4H6+EjPa748Zvg9
74BGSeHrZsjiiMYamY7b4Ww9tL5WMBn3zzZklxjD71SxvnDRY+1KJNQ4Dqwm5SZU
L8PJOJ+X7L0S3O7Q57PXW3DpTQrcBvlFmw/+BuTRdqollB+UqoanoPHkel/D3cXh
3l2pMwvGu2SiG2a92sNbAgMBAAGjgZIwgY8wHQYDVR0OBBYEFI2euS9ujd3iEYsl
uwnGjul3iP2+MB8GA1UdIwQYMBaAFI2euS9ujd3iEYsluwnGjul3iP2+MA8GA1Ud
EwEB/wQFMAMBAf8wPAYDVR0RBDUwM4IxZXAtdGVzdC1leGFtcGxlLXBvb2xlci5l
dS1jZW50cmFsLTEuYXdzLm5lb24udGVjaDANBgkqhkiG9w0BAQsFAAOCAQEAHH5W
fDpD8Aa76ZEYaL6plrThBfd7siIKPFF+V9U41XREozntrfccF6/7TOOzvDD8lY77
UhAWbtcydnpcLB4PdnKjrVAA5O23aS8o7SIb01YIP1SrBxNGUxWfMsbCmkZy5MA3
jhbcJ4TyGr7diQX1FS4f2c1GJJmETG+TnzaWvauQxfSUdZXAlDDmbr9rTSu5PZSi
Rr9UREkDpcs/UFD2dBpPucIRC7hUyErk8HsHiFOSqgoL6tw9VmSb41qSl5HzeUFu
Amf+pHfBKvpFAwX8CpzU57hg9epEj7X6AkRMZZPQVmbsN/3a1mBA+gyV8JYN9eJM
dvcG9/h77eTJqtQTTQ==
-----END CERTIFICATE-----`;
const fixtureKey = String.raw`-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC6HdLLi/gCCXhF
J+aCDpwPiiKO01nwcoKufa0yA/66ZTXhCfw9bLw+A/UDaf5VZDTA7MoTeh4Rlx/M
1I19Ourql3s/wTdYz6QRhVxVA3aIBUMYoWmWtELRMSbH86RYNcypZyhEDbR34r2t
lOBPZFOHpPKOp0twPKJ1Zu67r6jYXTWyWkwmp4H6+EjPa748Zvg974BGSeHrZsji
iMYamY7b4Ww9tL5WMBn3zzZklxjD71SxvnDRY+1KJNQ4Dqwm5SZUL8PJOJ+X7L0S
3O7Q57PXW3DpTQrcBvlFmw/+BuTRdqollB+UqoanoPHkel/D3cXh3l2pMwvGu2Si
G2a92sNbAgMBAAECggEACQcnUX5Rom+pKNmdodNpmItfz8PKyhIT6rjn7NQqyAne
yjK8zJH4s51nhinfD29T68PQrY8v5DSLc1kgH+H6wTRl4xrRP3qa/8qTRwBrAIAY
2BoEUC4gS5txwSM9ZpX9fn4lgt+TUHlsL/5XvyIjtyG2LltJGoGmc8FxdSM5Mn2F
qPKF5YFGvvx/DM1AyB7ISmA07cXmWz4YIwbS2Cgxj3hMUm1l53fL4Jx2kDIATh96
RqvM2kIA/t6FWOyirErEH4Qf/B63emQAOaeOl/LoZU/v8Lis9+bTXJ94omW0DB/1
SWm27ormjnlzszkqg7Gp+7IiXMd2gwM8fAewR7Z1AQKBgQD1wySRl8jbr0kGKSzY
/lYIsnpyFE/EjRAlCudHXuNh4ySA/3L4vwHia2EJv7HvrYeWklr0wD68jAGHcBNv
Y9R0Raa7rEa4XzrVJXiSsgJoU+S6fk3qC6/cqYnotia/pE5eHkDEFi5DAIDyXmkQ
sd4VhWKAisVv1RYkhXnmG89G2wKBgQDB3ps1CiUXf11HiaI4epQAw94e3cIOdZMq
t76oIF6Av5L69+XIGQQ73UDnQY7fy+8UMhCowW8DvM7O4RuPyuvw7UHN3wrmPxlB
QtmreyQUVXSEmSua2TcKSyY7Lo/7zHE4/nel4bXA7MgMCCHB/uYv+EwGb9tD9/Jv
7J85AsfdgQKBgQCUG+7F73uVKaYQmG/2thCTXTx908/e3ESGjnOjh4PxUjqFo21e
i35PPfdVMLnDgAjerYUzS0iDyLyDKwALeVZoXDGHmONl6b5DBjoL7kuVJDoMSmIa
UsDBc0sxe9UOWa8A+ap+gf+PUZZkepFHBmqY/bHHVdp28yxNBkPYcZoRUQKBgGIb
kbWknaKnfH/wQZyNQ4qjlCtQk5yXmVL7y0rvnoNO70V739eD+WWGEQs2XOQaIrG4
qD+OK+zbRljhB/6bdQzmM+/H2I8uDUy+VML3vQlhOWbE0JE7LSRTZVR7urd0/TMX
a1sRvtWTvaSBFPxETx6la2uyfWaG+jPzrZu/MX+BAoGAL8jeRK0CH4BZ2BliZ63f
dGwxLRcrSemeO4/GeWxNtXs1zeZUP1zzgeUx9Tnl3iMKNU2TMD5x+thf3S6S5UtB
2oCFfYrXjXH7ph6jVpHIBTP766ywTi8uOwVCOSf6o/kFbM8gfb/GONKKmOES8Rjh
FS/sjVDWb+WQORBusEWsmwQ=
-----END PRIVATE KEY-----`;

async function tlsFixture(t) {
  const sockets = new Set();
  const startup = [];
  const secure = [];
  const secureContext = createSecureContext({
    cert: fixtureCertificate,
    key: fixtureKey,
  });
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.once('data', (packet) => {
      assert.equal(packet.readInt32BE(4), 80877103);
      socket.write('S');
      const tls = new TLSSocket(socket, { isServer: true, secureContext });
      tls.on('error', () => {});
      tls.on('secure', () => secure.push(true));
      let buffer = Buffer.alloc(0);
      let initialized = false;
      tls.on('data', (part) => {
        buffer = Buffer.concat([buffer, part]);
        if (
          !initialized &&
          buffer.length >= 4 &&
          buffer.length >= buffer.readInt32BE(0)
        ) {
          const size = buffer.readInt32BE(0);
          startup.push(buffer.subarray(8, size).toString('utf8'));
          buffer = buffer.subarray(size);
          initialized = true;
          // AuthenticationOk + ReadyForQuery: this fixture accepts no password.
          tls.write(Buffer.from('5200000008000000005a0000000549', 'hex'));
        }
        while (
          initialized &&
          buffer.length >= 5 &&
          buffer.length >= 1 + buffer.readInt32BE(1)
        ) {
          const size = 1 + buffer.readInt32BE(1);
          const kind = String.fromCharCode(buffer[0]);
          buffer = buffer.subarray(size);
          if (kind === 'X') {
            tls.end();
            break;
          }
          if (kind === 'Q')
            tls.write(
              Buffer.from('430000000d53454c4543542030005a0000000549', 'hex'),
            );
        }
      });
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  const factory = (trusted) => (configuration) =>
    new Pool({
      ...configuration,
      port: server.address().port,
      ssl: {
        ...configuration.ssl,
        ...(trusted ? { ca: fixtureCertificate } : {}),
      },
      stream: () => {
        const socket = new Socket();
        const connect = socket.connect.bind(socket);
        // Real driver/TLS protocol, but all TCP traffic is forced to this owned loopback listener.
        socket.connect = () => connect(server.address().port, '127.0.0.1');
        return socket;
      },
    });
  return { factory, startup, secure };
}

test('real pg TLS rejects an untrusted certificate without plaintext fallback', async (t) => {
  const fixture = await tlsFixture(t);
  const connection = createNeonConnection({
    environment,
    poolFactory: fixture.factory(false),
  });
  await assert.rejects(connection.query('SELECT 1'), failed);
  await connection.close();
  assert.deepEqual(fixture.startup, []);
});

test('real pg TLS rejects a trusted certificate for the wrong hostname', async (t) => {
  const fixture = await tlsFixture(t);
  const connection = createNeonConnection({
    environment: {
      ...environment,
      NEON_HOST: 'ep-wrong-pooler.eu-central-1.aws.neon.tech',
    },
    poolFactory: fixture.factory(true),
  });
  await assert.rejects(connection.query('SELECT 1'), failed);
  await connection.close();
  assert.deepEqual(fixture.startup, []);
});

test('real pg TLS accepts a trusted matching certificate and transmits only explicit startup parameters', async (t) => {
  const fixture = await tlsFixture(t);
  const connection = createNeonConnection({
    environment,
    poolFactory: fixture.factory(true),
  });
  assert.deepEqual(await connection.query('SELECT 1'), { rows: [] });
  await connection.close();
  assert.equal(fixture.secure.length, 1);
  assert.equal(fixture.startup.length, 1);
  assert.ok(fixture.startup[0].includes('user\0platypus_reader\0'));
  assert.ok(fixture.startup[0].includes('database\0platypus_service\0'));
  assert.ok(fixture.startup[0].includes('options\0 \0'));
  assert.ok(fixture.startup[0].includes('replication\0false\0'));
});
