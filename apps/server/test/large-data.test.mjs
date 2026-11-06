import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  generateLargeDataset,
  datasetChecksums,
  LARGE_COUNTS,
} from '../database/large/dataset.mjs';
import { assertLargeTarget } from '../database/large/seed-large.mjs';

test('large generator yields deterministic exact counts, identities, references and valid varied data', () => {
  const dataset = generateLargeDataset();
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(dataset).map(([key, rows]) => [key, rows.length]),
    ),
    LARGE_COUNTS,
  );
  const organizations = new Set(dataset.organizations.map((row) => row.id));
  const agents = new Set(dataset.supportAgents.map((row) => row.id));
  assert.equal(organizations.size, 100);
  assert.equal(agents.size, 40);
  assert.equal(new Set(dataset.tickets.map((row) => row.id)).size, 100000);
  assert.equal(new Set(dataset.tickets.map((row) => row.number)).size, 100000);
  const seenOrganizations = new Set();
  const seenAgents = new Set();
  const statuses = new Map();
  const times = new Set();
  for (const [index, row] of dataset.tickets.entries()) {
    assert.match(row.id, /^[0-9a-f]{8}-0000-4000-8000-[0-9a-f]{12}$/);
    assert.equal(row.number, `PS-${index + 1}`);
    assert(organizations.has(row.organizationId));
    assert(row.assigneeId === null || agents.has(row.assigneeId));
    assert(row.subject.trim().length > 0);
    assert.equal(new Date(row.createdAt).toISOString(), row.createdAt);
    assert.equal(new Date(row.updatedAt).toISOString(), row.updatedAt);
    assert(row.updatedAt >= row.createdAt);
    seenOrganizations.add(row.organizationId);
    if (row.assigneeId !== null) seenAgents.add(row.assigneeId);
    statuses.set(row.status, (statuses.get(row.status) ?? 0) + 1);
    times.add(row.createdAt);
  }
  assert.equal(seenOrganizations.size, 100);
  assert.equal(seenAgents.size, 40);
  assert.equal(
    dataset.tickets.filter((row) => row.assigneeId === null).length,
    14286,
  );
  assert.equal(
    dataset.tickets.filter((row) =>
      row.subject.includes('100% _ underscore \\ path'),
    ).length,
    100,
  );
  assert.equal(times.size, 21600);
  assert.deepEqual([...statuses].sort(), [
    ['Awaiting customer', 25000],
    ['Closed', 25000],
    ['In progress', 25000],
    ['New', 25000],
  ]);
  const expected = {
    organizations:
      'd9746a1e0314b9a389e80f9ebd957b1f8fcd6adcad07911eaf2654fa9b00863d',
    supportAgents:
      '74c628b77d35148b52e727f37a2ac0e1dff6c18e1502ab7f114282ada78de269',
    tickets: '1dfad9dd9844167f5adeb4e093aec68f727fcb6bd9f11ac91e9328305a673bd6',
    seed: '77433246b2db75a2da17d995124d65bd8e22147d641aec9df0ecf466acf1e2fb',
  };
  assert.deepEqual(datasetChecksums(dataset), expected);
  const again = generateLargeDataset();
  assert.deepEqual(datasetChecksums(again), expected);
  dataset.tickets[0].subject =
    'External mutation must not change a later generation';
  assert.deepEqual(datasetChecksums(again), expected);
  assert.notEqual(datasetChecksums(dataset).seed, expected.seed);
});

test('large target guard rejects ordinary, ambiguous and unmarked databases before writes', async () => {
  for (const database of [
    'platypus_service',
    'postgres',
    'platypus_service_test',
    'platypus_service_large ',
    'platypus_service_large;DROP',
  ]) {
    const queries = [];
    await assert.rejects(
      assertLargeTarget(
        {
          query: async (sql) => {
            queries.push(sql);
            return { rows: [{ name: database }] };
          },
        },
        {},
      ),
      /explicitly named/,
    );
    assert.equal(queries.length, 1);
  }
  await assert.rejects(
    assertLargeTarget(
      {
        query: async () => ({
          rows: [{ name: 'platypus_service_large_test' }],
        }),
      },
      {},
    ),
    /ownership acknowledgment/,
  );
  for (const marker of [
    [],
    [{ marker: 'platypus-service-disposable-tests' }],
    [
      { marker: 'platypus-service-large-disposable-tests' },
      { marker: 'extra' },
    ],
  ]) {
    await assert.rejects(
      assertLargeTarget(
        {
          query: async (sql) => ({
            rows: sql.includes('current_database')
              ? [{ name: 'platypus_service_large_test' }]
              : marker,
          }),
        },
        { PLATYPUS_LARGE_TEST_OWNED: '1' },
      ),
      /ownership marker/,
    );
  }
  assert.equal(
    await assertLargeTarget(
      {
        query: async (sql) => ({
          rows: sql.includes('current_database')
            ? [{ name: 'platypus_service_large_test' }]
            : [{ marker: 'platypus-service-large-disposable-tests' }],
        }),
      },
      { PLATYPUS_LARGE_TEST_OWNED: '1' },
    ),
    'platypus_service_large_test',
  );
  assert.equal(
    await assertLargeTarget(
      { query: async () => ({ rows: [{ name: 'platypus_service_large' }] }) },
      {},
    ),
    'platypus_service_large',
  );
});

test('explicit large CLI refuses legacy targets and remote hosts without connection or secret output', () => {
  const cli = fileURLToPath(
    new URL('../database/large/cli.mjs', import.meta.url),
  );
  const environment = {
    ...process.env,
    PGHOST: '127.0.0.1',
    PGPORT: '5432',
    PGDATABASE: 'platypus_service',
    PGUSER: 'not-a-real-user',
    PGPASSWORD: 'test-password-must-never-appear',
  };
  for (const change of [
    {},
    {
      PGHOST: 'database.example.invalid',
      PGDATABASE: 'platypus_service_large',
    },
  ]) {
    const result = spawnSync(process.execPath, [cli, 'migrate'], {
      env: { ...environment, ...change },
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /explicitly named|loopback/);
    assert(!result.stderr.includes(environment.PGPASSWORD));
  }
});
