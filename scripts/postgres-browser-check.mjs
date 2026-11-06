import assert from 'node:assert/strict';
import { fork, execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import { chromium } from '@playwright/test';
import { projectRoot, startApplication } from './serve-local.mjs';
import { seed } from '../apps/server/database/migrate-seed.mjs';

const execute = promisify(execFile);
const image =
  'postgres:18.6-bookworm@sha256:f1ea2a1a4fb7b68d4836be1fdcb8a6466a89b072158bf9d97663600538c294c5';
assert.equal(
  process.env.GITHUB_ACTIONS,
  'true',
  'Container restart tests run only in the disposable GitHub job.',
);
assert.equal(process.env.PLATYPUS_PG_TEST_OWNED, '1');
assert.equal(process.env.PGDATABASE, 'platypus_service_test');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.equal(process.env.PG_TEST_APP_USER, 'platypus_app_test');
const containerId = process.env.PG_TEST_CONTAINER_ID;
assert.match(
  containerId ?? '',
  /^[a-f0-9]{64}$/,
  'Exact current job service container is required.',
);
const inspected = JSON.parse(
  (await execute('docker', ['inspect', containerId], { timeout: 10000 }))
    .stdout,
);
assert.equal(inspected.length, 1);
assert.equal(inspected[0].Id, containerId);
assert.equal(
  inspected[0].Config.Image,
  image,
  'Only the pinned test service image may be controlled.',
);

async function ownerQuery(sql, values) {
  const pool = new pg.Pool({
    connectionTimeoutMillis: 1000,
    statement_timeout: 3000,
    max: 1,
  });
  try {
    return await pool.query(sql, values);
  } finally {
    await pool.end();
  }
}
assert.equal(
  (await ownerQuery('SELECT current_database() AS name')).rows[0].name,
  'platypus_service_test',
);
assert.equal(
  (await ownerQuery('SELECT marker FROM public.platypus_test_ownership'))
    .rows[0]?.marker,
  'platypus-service-disposable-tests',
);

async function databaseReady() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      await ownerQuery('SELECT 1');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error('Owned test database did not recover within its deadline.');
}
const portProbe = createServer();
portProbe.listen(0, 'localhost');
await once(portProbe, 'listening');
const apiPort = portProbe.address().port;
await new Promise((r) => portProbe.close(r));
const apiOrigin = 'http://localhost:' + apiPort;
let child;
async function startApi() {
  const owned = fork(
    path.join(projectRoot, 'apps/server/dist/postgres-main.js'),
    [],
    {
      cwd: projectRoot,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: {
        ...process.env,
        PGUSER: process.env.PG_TEST_APP_USER,
        PGPASSWORD: process.env.PG_TEST_APP_PASSWORD,
        PORT: String(apiPort),
        ALLOWED_ORIGINS: 'http://localhost:4200,http://localhost:5175',
      },
    },
  );
  child = owned;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('PostgreSQL HTTP process did not become ready.')),
      10000,
    );
    const done = (error) => {
      clearTimeout(timer);
      owned.off('message', message);
      owned.off('error', fail);
      owned.off('exit', exited);
      error ? reject(error) : resolve();
    };
    const message = (value) => {
      if (value?.type === 'ready') done();
    };
    const fail = () =>
      done(new Error('PostgreSQL HTTP process failed to start.'));
    const exited = () =>
      done(new Error('PostgreSQL HTTP process exited before readiness.'));
    owned.once('message', message);
    owned.once('error', fail);
    owned.once('exit', exited);
  });
}
async function stopApi() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const owned = child;
  const exited = once(owned, 'exit');
  owned.kill('SIGTERM');
  let timer;
  try {
    await Promise.race([
      exited,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Owned HTTP shutdown timed out.')),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (owned.exitCode === null && owned.signalCode === null) {
      owned.kill('SIGKILL');
      await exited;
    }
    child = undefined;
  }
}
async function readTickets() {
  const response = await fetch(apiOrigin + '/api/tickets', {
    signal: AbortSignal.timeout(7000),
  });
  assert.equal(response.status, 200);
  return response.json();
}
const checks = [];
const passed = (value) => {
  checks.push(value);
  console.log('PASS ' + value);
};
const servers = [];
let browser;
let stopped = false;
let cleanupFailure;
try {
  const initial = await ownerQuery(
    'SELECT count(*)::int AS count FROM platypus.tickets',
  );
  assert.equal(initial.rows[0].count, 25);
  const subject = 'Persistent subject from the isolated PostgreSQL test';
  await ownerQuery('UPDATE platypus.tickets SET subject=$1 WHERE number=$2', [
    subject,
    'PS-1001',
  ]);
  const seedPool = new pg.Pool({ connectionTimeoutMillis: 3000, max: 1 });
  try {
    assert.equal((await seed(seedPool)).applied, false);
  } finally {
    await seedPool.end();
  }
  await startApi();
  let tickets = await readTickets();
  assert.equal(tickets.total, 25);
  assert.equal(tickets.items[0].subject, subject);
  passed(
    'Real PostgreSQL owner edit appears through the read-only HTTP entry; repeating seed preserves it.',
  );
  for (const name of [
    'analytics',
    'administration',
    'support',
    'support-standalone',
    'shell',
  ])
    servers.push(await startApplication(name));
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.route('**/ticket-api-config.json', (route) =>
    route.fulfill({ json: { apiBaseUrl: apiOrigin } }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://localhost:5175/');
  await page.getByText('25 tickets', { exact: true }).waitFor();
  await page.getByText(subject, { exact: true }).waitFor();
  assert.equal(await page.locator('.ps-support tbody tr').count(), 25);
  await page.goto('http://localhost:4200/support/tickets');
  await page.getByText(subject, { exact: true }).waitFor();
  passed(
    'Standalone Support and the Angular Shell render the real persisted subject and all 25 rows.',
  );
  for (const name of ['Analytics', 'Administration', 'Tickets']) {
    await page.getByRole('link', { name, exact: true }).click();
    await page.getByRole('heading', { name, exact: true }).waitFor();
  }
  await page.getByText(subject, { exact: true }).waitFor();
  await execute('docker', ['stop', '--time', '5', containerId], {
    timeout: 20000,
  });
  stopped = true;
  assert.equal((await fetch(apiOrigin + '/api/health')).status, 200);
  await page.reload();
  await page
    .getByRole('heading', { name: 'Tickets are unavailable', exact: true })
    .waitFor();
  const broken = await fetch(apiOrigin + '/api/tickets');
  assert.equal(broken.status, 500);
  assert.deepEqual(await broken.json(), {
    error: { code: 'INTERNAL_ERROR', message: 'Tickets could not be loaded.' },
  });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Tickets are unavailable', exact: true })
    .waitFor();
  passed(
    'Stopping only the marked job database leaves HTTP health alive and causes real bounded API/browser failure without fixture fallback.',
  );
  await execute('docker', ['start', containerId], { timeout: 20000 });
  stopped = false;
  await databaseReady();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByText(subject, { exact: true }).waitFor();
  tickets = await readTickets();
  assert.equal(tickets.items[0].subject, subject);
  passed(
    'The same database container and storage restart; Retry recovers the saved edit without restarting the frontend or API.',
  );
  await stopApi();
  await startApi();
  tickets = await readTickets();
  assert.equal(tickets.items[0].subject, subject);
  assert.equal(tickets.total, 25);
  passed(
    'Restarting the actual PostgreSQL HTTP process retains the same saved database edit.',
  );
  assert.deepEqual(errors, []);
  const directory = path.join(projectRoot, '.local/evidence');
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, 'postgres-support.png'),
    fullPage: true,
  });
  await writeFile(
    path.join(directory, 'postgres-check.json'),
    JSON.stringify(
      {
        success: true,
        checks,
        databaseVersion: (await ownerQuery('SHOW server_version')).rows[0]
          .server_version,
        finishedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  if (stopped)
    await execute('docker', ['start', containerId], { timeout: 20000 }).catch(
      () => {},
    );
  const cleanup = await Promise.allSettled([
    browser?.close(),
    stopApi(),
    ...servers.map(
      (server) =>
        new Promise((resolve) => {
          server.closeAllConnections();
          server.close(resolve);
        }),
    ),
  ]);
  cleanupFailure = cleanup.find((result) => result.status === 'rejected');
}
if (cleanupFailure) throw cleanupFailure.reason;
