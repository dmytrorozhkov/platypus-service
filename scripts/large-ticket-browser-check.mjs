import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { chromium, expect } from '@playwright/test';
import { buildTicketPageQuery } from '../apps/server/dist/postgres-ticket-repository.js';
import { parseTicketQuery } from '../apps/server/dist/ticket-query.js';
import { projectRoot, createStaticServer } from './serve-local.mjs';
import { explicitConnectionFromEnvironment } from '../apps/server/database/migrate-seed.mjs';

assert.equal(
  process.env.GITHUB_ACTIONS,
  'true',
  'Only the marked disposable GitHub database is supported.',
);
assert.equal(process.env.PLATYPUS_PG_TEST_OWNED, '1');
assert.equal(process.env.PLATYPUS_LARGE_TEST_OWNED, '1');
assert.equal(process.env.PGDATABASE, 'platypus_service_large_test');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.equal(process.env.PG_TEST_APP_USER, 'platypus_app_test');
const owner = new pg.Pool({ ...explicitConnectionFromEnvironment(), max: 1 });
const checks = [];
const passed = (description) => {
  checks.push(description);
  console.log('PASS ' + description);
};
const probe = createServer();
probe.listen(0, 'localhost');
await once(probe, 'listening');
const apiPort = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const apiOrigin = 'http://localhost:' + apiPort;
let child;
let staticServer;
let browser;
let frontendOrigin;
let cleanupFailure;
async function startApi() {
  assert(!child);
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
        ALLOWED_ORIGINS: frontendOrigin,
      },
    },
  );
  child = owned;
  await new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      owned.off('message', ready);
      owned.off('exit', exit);
      owned.off('error', exit);
      error ? reject(error) : resolve();
    };
    const ready = (message) => {
      if (message?.type === 'ready') finish();
    };
    const exit = () =>
      finish(new Error('Owned large PostgreSQL API failed to start.'));
    const timer = setTimeout(
      () => finish(new Error('Owned large PostgreSQL API startup timed out.')),
      10000,
    );
    owned.on('message', ready);
    owned.once('exit', exit);
    owned.once('error', exit);
  });
}
async function stopApi() {
  if (!child) return;
  const owned = child;
  if (owned.exitCode !== null || owned.signalCode !== null) {
    child = undefined;
    return;
  }
  const done = once(owned, 'exit');
  owned.kill('SIGTERM');
  let timer;
  try {
    await Promise.race([
      done,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Owned large API shutdown timed out.')),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (owned.exitCode === null && owned.signalCode === null) {
      owned.kill('SIGKILL');
      await done;
    }
    child = undefined;
  }
}
async function query(parameters = {}, expectedStatus = 200) {
  const url = new URL('/api/tickets/query', apiOrigin);
  for (const [name, value] of Object.entries(parameters))
    url.searchParams.set(name, String(value));
  const started = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
  assert.equal(response.status, expectedStatus);
  const body = await response.json();
  if (expectedStatus === 200) {
    assert(Number.isSafeInteger(body.total));
    assert(
      body.items.length <= body.pageSize &&
        [25, 50, 100].includes(body.pageSize),
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  return {
    body,
    milliseconds: Number((performance.now() - started).toFixed(2)),
  };
}
const metrics = [];
try {
  assert.equal(
    (await owner.query('SELECT current_database() AS name')).rows[0].name,
    'platypus_service_large_test',
  );
  assert.deepEqual(
    (await owner.query('SELECT marker FROM public.platypus_test_ownership'))
      .rows,
    [{ marker: 'platypus-service-large-disposable-tests' }],
  );
  assert.equal(
    (await owner.query('SELECT count(*)::int AS count FROM platypus.tickets'))
      .rows[0].count,
    100000,
  );
  staticServer = await createStaticServer({
    root: path.join(projectRoot, 'apps/support/dist/browser'),
    fallback: true,
    ticketApiConfig: { apiBaseUrl: apiOrigin, ticketQueryMode: 'paged' },
  });
  staticServer.listen(0, 'localhost');
  await once(staticServer, 'listening');
  frontendOrigin = 'http://localhost:' + staticServer.address().port;
  await startApi();
  const first = (await query()).body;
  assert.equal(first.total, 100000);
  assert.equal(first.items.length, 25);
  assert.equal(first.page, 1);
  const second = (await query({ page: 2 })).body;
  assert.equal(
    new Set([...first.items, ...second.items].map((item) => item.number)).size,
    50,
  );
  const beyond = (await query({ page: 100000 })).body;
  assert.equal(beyond.total, 100000);
  assert.deepEqual(beyond.items, []);
  const optionsResponse = await fetch(apiOrigin + '/api/tickets/options');
  assert.equal(optionsResponse.status, 200);
  const options = await optionsResponse.json();
  assert.equal(options.organizations.length, 100);
  assert.equal(options.assignees.length, 40);
  const organization = options.organizations[0];
  const filter = (await query({ organization: organization.id, status: 'New' }))
    .body;
  const expected = (
    await owner.query(
      'SELECT count(*)::int AS count FROM platypus.tickets WHERE organization_id=$1 AND status=$2',
      [organization.id, 'New'],
    )
  ).rows[0].count;
  assert.equal(filter.total, expected);
  assert(
    filter.items.every(
      (item) =>
        item.organization === organization.name && item.status === 'New',
    ),
  );
  const unassigned = (await query({ assignee: 'unassigned' })).body;
  assert(unassigned.total > 0);
  assert(unassigned.items.every((item) => item.assignee === null));
  const assignee = options.assignees[0];
  const assigned = (await query({ assignee: assignee.id })).body;
  const assignedCount = (
    await owner.query(
      'SELECT count(*)::int AS count FROM platypus.tickets WHERE assignee_id=$1',
      [assignee.id],
    )
  ).rows[0].count;
  assert.equal(assigned.total, assignedCount);
  assert(assigned.items.every((item) => item.assignee === assignee.name));
  const compareText = (left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right));
  function compareTickets(left, right, field, direction) {
    const a = left[field],
      b = right[field];
    if (a === null && b !== null) return 1;
    if (a !== null && b === null) return -1;
    let comparison = 0;
    if (a !== null && b !== null) {
      if (field === 'number')
        comparison =
          a.slice(3).length - b.slice(3).length ||
          compareText(a.slice(3), b.slice(3));
      else comparison = compareText(a, b);
      if (direction === 'desc') comparison = -comparison;
    }
    return comparison || compareText(left.number, right.number);
  }
  for (const field of [
    'number',
    'subject',
    'organization',
    'status',
    'assignee',
    'createdAt',
    'updatedAt',
  ])
    for (const direction of ['asc', 'desc']) {
      const sorted = (await query({ sort: field, direction, pageSize: 100 }))
        .body;
      for (let index = 1; index < sorted.items.length; index++)
        assert(
          compareTickets(
            sorted.items[index - 1],
            sorted.items[index],
            field,
            direction,
          ) <= 0,
          'Real SQL sorting differs for ' + field + '/' + direction,
        );
    }
  for (const needle of ['%', '_', '\\', 'PS-99999']) {
    const expectedCount = (
      await owner.query(
        'SELECT count(*)::int AS count FROM platypus.tickets WHERE strpos(lower(number),lower($1))>0 OR strpos(lower(subject),lower($1))>0',
        [needle],
      )
    ).rows[0].count;
    assert.equal((await query({ search: needle })).body.total, expectedCount);
  }
  assert.deepEqual(
    (await query({ sort: 'number', direction: 'asc' })).body.items
      .slice(0, 3)
      .map((item) => item.number),
    ['PS-1', 'PS-2', 'PS-3'],
  );
  const date = (
    await owner.query(
      "SELECT to_char(min(created_at) AT TIME ZONE 'UTC','YYYY-MM-DD') AS day FROM platypus.tickets",
    )
  ).rows[0].day;
  const dateCount = (
    await owner.query(
      "SELECT count(*)::int AS count FROM platypus.tickets WHERE created_at >= $1::date::timestamp AT TIME ZONE 'UTC' AND created_at < ($1::date + 1)::timestamp AT TIME ZONE 'UTC'",
      [date],
    )
  ).rows[0].count;
  assert.equal(
    (await query({ createdFrom: date, createdTo: date })).body.total,
    dateCount,
  );
  for (const invalid of [
    { page: 0 },
    { pageSize: 100000 },
    { sort: 'number;DROP TABLE x' },
    { createdFrom: '2026-02-30' },
    { createdFrom: '2026-03-01', createdTo: '2026-02-01' },
    { extra: '1' },
    { organization: 'wrong' },
    { search: 'x'.repeat(101) },
  ])
    await query(invalid, 400);
  assert.equal(
    (await fetch(apiOrigin + '/api/tickets/query?page=1&page=2')).status,
    400,
  );
  const legacy = await fetch(apiOrigin + '/api/tickets');
  assert.equal(legacy.status, 500);
  passed(
    'Real100000-row API has bounded unique pages, exact filtered totals, literal search, numeric sorting, UTC date boundaries and rejects invalid/unbounded input; legacy endpoint never leaks100000 records.',
  );

  for (const [name, parameters] of [
    ['first-page', {}],
    ['deep-page', { page: 1000 }],
    ['last-page', { page: 4000 }],
    ['subject-sort', { sort: 'subject', direction: 'asc' }],
    ['combined-filter', { organization: organization.id, status: 'New' }],
    ['literal-search', { search: 'PS-99999' }],
  ]) {
    const samples = [];
    for (let i = 0; i < 5; i++)
      samples.push((await query(parameters)).milliseconds);
    const ordered = [...samples].sort((a, b) => a - b);
    metrics.push({
      name,
      parameters,
      samplesMs: samples,
      medianMs: ordered[2],
      maximumMs: ordered.at(-1),
    });
  }
  const actualStatement = buildTicketPageQuery(
    parseTicketQuery(
      new URLSearchParams({
        organization: organization.id,
        status: 'New',
      }).toString(),
    ),
  );
  const plan = (
    await owner.query(
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + actualStatement.text,
      actualStatement.values,
    )
  ).rows[0]['QUERY PLAN'];
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  const pageResponses = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      response.url().startsWith(apiOrigin + '/api/tickets/query') &&
      response.ok()
    )
      pageResponses.push(
        response.json().then((body) => {
          assert(body.items.length <= body.pageSize && body.pageSize <= 100);
          return {
            page: body.page,
            pageSize: body.pageSize,
            total: body.total,
            items: body.items.length,
          };
        }),
      );
  });
  async function change(action, match) {
    const response = page.waitForResponse((response) => {
      if (!response.url().startsWith(apiOrigin + '/api/tickets/query'))
        return false;
      const params = new URL(response.url()).searchParams;
      return Object.entries(match).every(
        ([key, value]) => (params.get(key) ?? '') === String(value),
      );
    });
    await action();
    const data = await (await response).json();
    await expect(page.locator('.ps-support tbody tr')).toHaveCount(
      data.items.length,
    );
    return data;
  }
  const started = performance.now();
  await page.goto(frontendOrigin + '/');
  await expect(page.locator('.ps-support tbody tr')).toHaveCount(25);
  await expect(
    page.getByText('100000 matching tickets', { exact: false }),
  ).toBeVisible();
  const initialRenderMs = Number((performance.now() - started).toFixed(2));
  await change(
    () => page.getByRole('button', { name: 'Next page', exact: true }).click(),
    { page: 2 },
  );
  await change(
    () => page.getByLabel('Rows per page', { exact: true }).selectOption('100'),
    { page: 1, pageSize: 100 },
  );
  await change(
    () => page.getByLabel('Rows per page', { exact: true }).selectOption('50'),
    { page: 1, pageSize: 50 },
  );
  const changedStatus = await change(
    () => page.getByLabel('Status', { exact: true }).selectOption('New'),
    { page: 1, status: 'New' },
  );
  assert(changedStatus.items.every((item) => item.status === 'New'));
  const changedOrg = await change(
    () =>
      page
        .getByLabel('Organization', { exact: true })
        .selectOption(organization.id),
    { organization: organization.id, status: 'New' },
  );
  assert.equal(changedOrg.total, expected);
  await change(
    () => page.getByLabel('Organization', { exact: true }).selectOption(''),
    { organization: '', status: 'New' },
  );
  await change(
    () => page.getByLabel('Status', { exact: true }).selectOption(''),
    { status: '' },
  );
  await change(
    () =>
      page.getByLabel('Assignee', { exact: true }).selectOption('unassigned'),
    { assignee: 'unassigned' },
  );
  await change(
    () => page.getByLabel('Assignee', { exact: true }).selectOption(''),
    { assignee: '' },
  );
  await change(
    () => page.getByLabel('Sort by', { exact: true }).selectOption('number'),
    { sort: 'number' },
  );
  await change(
    () =>
      page.getByLabel('Sort direction', { exact: true }).selectOption('asc'),
    { sort: 'number', direction: 'asc' },
  );
  await expect(page.locator('.ps-support tbody tr').first()).toContainText(
    'PS-1',
  );
  await change(
    async () => {
      await page.getByLabel('Created from', { exact: true }).fill(date);
      await page.getByLabel('Created from', { exact: true }).blur();
    },
    { createdFrom: date },
  );
  const dated = await change(
    async () => {
      await page.getByLabel('Created to', { exact: true }).fill(date);
      await page.getByLabel('Created to', { exact: true }).blur();
    },
    { createdFrom: date, createdTo: date },
  );
  assert.equal(dated.total, dateCount);
  await change(
    async () => {
      await page.getByLabel('Created from', { exact: true }).fill('');
      await page.getByLabel('Created from', { exact: true }).blur();
    },
    { createdFrom: '', createdTo: date },
  );
  await change(
    async () => {
      await page.getByLabel('Created to', { exact: true }).fill('');
      await page.getByLabel('Created to', { exact: true }).blur();
    },
    { createdFrom: '', createdTo: '' },
  );
  await page
    .getByLabel('Search tickets', { exact: true })
    .fill('no-matching-ticket-064');
  const empty = await change(
    () => page.getByRole('button', { name: 'Search', exact: true }).click(),
    { search: 'no-matching-ticket-064' },
  );
  assert.equal(empty.total, 0);
  await expect(
    page.getByLabel('Search tickets', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Search tickets', { exact: true }).fill('');
  await change(
    () => page.getByRole('button', { name: 'Search', exact: true }).click(),
    { search: '' },
  );
  passed(
    'Actual Angular frontend requests pages25/50/100, resets paging for filters, shows filtered counts and can recover from empty search without loading all records.',
  );
  await stopApi();
  await page.reload();
  await page
    .getByRole('heading', { name: 'Tickets are unavailable', exact: true })
    .waitFor();
  await startApi();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.ps-support tbody tr')).toHaveCount(25);
  await expect(
    page.getByText('100000 matching tickets', { exact: false }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  passed(
    'Only the test-owned API is stopped/restarted; frontend Retry recovers all100000 matching database records while rendering one25-row page.',
  );
  const responses = await Promise.all(pageResponses);
  assert(responses.length >= 10);
  const result = {
    success: true,
    sourceSha: process.env.GITHUB_SHA ?? null,
    finishedAt: new Date().toISOString(),
    checks,
    machine: {
      platform: os.platform(),
      architecture: os.arch(),
      node: process.version,
      logicalCpus: os.cpus().length,
      cpu: os.cpus()[0]?.model,
      totalMemoryBytes: os.totalmem(),
      postgres: (await owner.query('SHOW server_version')).rows[0]
        .server_version,
    },
    dataset: { tickets: 100000, organizations: 100, assignees: 40 },
    metrics,
    initialRenderMs,
    queryPlan: plan,
    browserResponses: responses,
  };
  const evidence = path.join(projectRoot, '.local/evidence');
  await mkdir(evidence, { recursive: true });
  await page.screenshot({
    path: path.join(evidence, 'large-postgres-support.png'),
    fullPage: true,
  });
  await writeFile(
    path.join(evidence, 'large-postgres-check.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log('LARGE_MEASUREMENTS ' + JSON.stringify(result));
} finally {
  const cleanup = await Promise.allSettled([
    browser?.close(),
    stopApi(),
    owner.end(),
    staticServer
      ? new Promise((resolve) => {
          staticServer.closeAllConnections();
          staticServer.close(resolve);
        })
      : undefined,
  ]);
  cleanupFailure = cleanup.find((result) => result.status === 'rejected');
}

if (cleanupFailure) throw cleanupFailure.reason;
