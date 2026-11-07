// Synthetic role/probe/HTTP checks on a fresh owned non-service PostgreSQL18.6 cluster.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { Client } from 'pg';
import { loadSchema } from '../apps/server/database/neon/snapshot.mjs';
import {
  probeNeonConnection,
  createNeonRuntime,
  readNeonRuntimeConfiguration,
} from '../apps/server/dist/neon-runtime.js';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const parent = path.join(root, '.local/neon-runtime-tests');
const directory = path.join(
  parent,
  `owned-${Date.now()}-${randomBytes(6).toString('hex')}`,
);
const dataDirectory = path.join(directory, 'data');
const marker = 'platypus-neon-runtime-disposable-only';
const password = randomBytes(24).toString('hex');
const binaryRoot =
  process.env.PLATYPUS_TEST_PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const binary = (name) =>
  path.join(binaryRoot, process.platform === 'win32' ? `${name}.exe` : name);
const clients = [];
const closed = new Set();
const checks = [];
let attempted = false;
let port;
let runtime;
async function owned() {
  const actual = await realpath(directory);
  assert.equal(path.dirname(actual), await realpath(parent));
  assert.equal(
    await readFile(path.join(actual, 'ownership.txt'), 'utf8'),
    marker,
  );
}
async function connect(database, user) {
  const client = new Client({
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
    query_timeout: 10000,
    application_name: 'platypus-owned-runtime-test',
  });
  client.on('error', () => {});
  await client.connect();
  clients.push(client);
  return client;
}
async function close(client) {
  if (!closed.has(client)) {
    closed.add(client);
    await client.end();
  }
}
async function cleanup() {
  let stopFailed = false;
  try {
    await runtime?.stop();
  } catch {
    stopFailed = true;
  }
  await Promise.allSettled(clients.map(close));
  if (!attempted) return;
  await owned();
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
      binary('pg_ctl'),
      ['stop', '-D', dataDirectory, '-m', 'fast', '-w', '-t', '20'],
      { windowsHide: true, timeout: 30000 },
    );
  }
  if (stopFailed)
    throw new Error('Owned runtime cleanup failed after cluster teardown.');
}

try {
  assert.match(
    (await execute(binary('initdb'), ['--version'], { windowsHide: true }))
      .stdout,
    /18\.6/,
  );
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'ownership.txt'), marker, {
    flag: 'wx',
  });
  const passwordFile = path.join(directory, 'test-password.txt');
  await writeFile(passwordFile, password, { flag: 'wx', mode: 0o600 });
  await owned();
  await execute(
    binary('initdb'),
    [
      '-D',
      dataDirectory,
      '--username=runtime_test_owner',
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
  attempted = true;
  await execute(
    binary('pg_ctl'),
    [
      'start',
      '-D',
      dataDirectory,
      '-l',
      path.join(directory, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p ${port} -c ssl=off -c max_connections=10 -c shared_buffers=32MB`,
      '-w',
      '-t',
      '20',
    ],
    { windowsHide: true, timeout: 30000 },
  );
  const admin = await connect('postgres', 'runtime_test_owner');
  await admin.query(
    `CREATE ROLE neondb_owner LOGIN CREATEROLE PASSWORD '${password}'`,
  );
  await admin.query('CREATE DATABASE neondb OWNER neondb_owner');
  const owner = await connect('neondb', 'neondb_owner');
  await owner.query('CREATE SCHEMA platypus');
  await owner.query((await loadSchema()).schemaSql);
  await owner.query(
    "INSERT INTO platypus.organizations VALUES ('00000000-0000-4000-8000-000000000001','Synthetic organization')",
  );
  for (let number = 1; number <= 3; number++)
    await owner.query(
      `INSERT INTO platypus.tickets(id,number,subject,organization_id,status,created_at,updated_at)
      VALUES ($1,$2,$3,'00000000-0000-4000-8000-000000000001','New','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z')`,
      [
        `00000000-0000-4000-8000-${String(number + 1).padStart(12, '0')}`,
        `PS-${1000 + number}`,
        'Synthetic ticket',
      ],
    );
  await owner.query(
    await readFile(
      new URL('../apps/server/database/neon/runtime-role.sql', import.meta.url),
      'utf8',
    ),
  );
  const activation = await readFile(
    new URL(
      '../apps/server/database/neon/activate-runtime-role.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await owner.query(
    'GRANT UPDATE(subject) ON platypus.tickets TO platypus_app',
  );
  assert.equal(
    (
      await owner.query(
        "SELECT has_table_privilege('platypus_app','platypus.tickets','UPDATE') AS table_write",
      )
    ).rows[0].table_write,
    false,
  );
  await assert.rejects(owner.query(activation));
  await owner.query('ROLLBACK');
  assert.equal(
    (
      await owner.query(
        "SELECT rolcanlogin FROM pg_roles WHERE rolname='platypus_app'",
      )
    ).rows[0].rolcanlogin,
    false,
  );
  await owner.query(
    'REVOKE UPDATE(subject) ON platypus.tickets FROM platypus_app',
  );
  const targetAdmin = await connect('neondb', 'runtime_test_owner');
  await targetAdmin.query(
    'CREATE SCHEMA unexpected_owned AUTHORIZATION platypus_app',
  );
  await assert.rejects(owner.query(activation));
  await owner.query('ROLLBACK');
  assert.equal(
    (
      await owner.query(
        "SELECT rolcanlogin FROM pg_roles WHERE rolname='platypus_app'",
      )
    ).rows[0].rolcanlogin,
    false,
  );
  await targetAdmin.query(
    'ALTER SCHEMA unexpected_owned OWNER TO neondb_owner',
  );
  await admin.query(`ALTER ROLE platypus_app PASSWORD '${password}'`);
  await owner.query(activation);
  checks.push(
    'SQL activation refuses column-only writes and unrelated schema ownership, preserves NOLOGIN on refusal, accepts exact restricted role',
  );

  const app = await connect('neondb', 'platypus_app');
  const connection = {
    async query(text, values) {
      await app.query('BEGIN READ ONLY');
      try {
        const result = await app.query(text, values);
        await app.query('COMMIT');
        return result;
      } catch (error) {
        await app.query('ROLLBACK');
        throw error;
      }
    },
    close: () => close(app),
  };
  assert.equal((await probeNeonConnection(connection)).readOnly, true);
  checks.push('real PostgreSQL18 exact effective-role identity probe succeeds');
  await owner.query(
    'GRANT UPDATE(subject) ON platypus.tickets TO platypus_app',
  );
  await assert.rejects(probeNeonConnection(connection));
  await owner.query(
    'REVOKE UPDATE(subject) ON platypus.tickets FROM platypus_app',
  );
  await admin.query('ALTER ROLE platypus_app CREATEDB');
  await assert.rejects(probeNeonConnection(connection));
  await admin.query('ALTER ROLE platypus_app NOCREATEDB');
  checks.push(
    'live probe refuses column-only grant drift and elevated role flags',
  );

  const host = 'ep-offline-example-pooler.eu-central-1.aws.neon.tech';
  const configuration = readNeonRuntimeConfiguration({
    NEON_HOST: host,
    NEON_CONFIRM_TARGET: `${host}/neondb`,
    NEON_DATABASE: 'neondb',
    NEON_USER: 'platypus_app',
    NEON_PASSWORD: 'unused-test-only-value',
  });
  runtime = createNeonRuntime({
    configuration: { ...configuration, port: 0 },
    connection,
  });
  await runtime.start();
  const base = 'http://localhost:' + runtime.server.address().port;
  const response = await fetch(base + '/api/tickets/query?page=1&pageSize=25', {
    headers: { Origin: 'http://localhost:5177' },
  });
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'http://localhost:5177',
  );
  const page = await response.json();
  assert.equal(page.total, 3);
  assert.equal(page.items.length, 3);
  assert.equal((await fetch(base + '/api/tickets/options')).status, 200);
  assert.equal((await fetch(base + '/api/health')).status, 200);
  await Promise.all([runtime.stop(), runtime.stop()]);
  assert.equal(runtime.server.listening, false);
  checks.push(
    'real HTTP paged API/options/health, exact localhost CORS and idempotent owned shutdown',
  );
  console.log(
    JSON.stringify({
      passed: checks.length,
      checks,
      remoteDatabase: false,
      nativeServiceTouched: false,
    }),
  );
} finally {
  await cleanup();
}
