import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import {
  parseTicketQuery,
  InvalidTicketQuery,
  ticketSortFields,
} from '../dist/ticket-query.js';
import {
  PostgresTicketRepository,
  buildTicketPageQuery,
} from '../dist/postgres-ticket-repository.js';
import { createTicketServer } from '../dist/server.js';
import { createLambdaHandler } from '../dist/lambda.js';
import { FixtureTicketRepository } from '../dist/ticket-repository.js';

const id = '10000000-0000-4000-8000-000000000001';
const row = {
  number: 'PS-9',
  subject: 'Example',
  organization: 'Example organization',
  status: 'New',
  assignee: null,
  created_at: '2026-11-01T00:00:00+00:00',
  updated_at: '2026-11-01T00:00:00+00:00',
};

async function local(t, repository) {
  const server = createTicketServer({ repository, logError: () => {} });
  server.listen(0, 'localhost');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  return 'http://localhost:' + server.address().port;
}

test('query parser supplies defaults and retains explicit bounded query/filter values', () => {
  assert.deepEqual(parseTicketQuery(), {
    page: 1,
    pageSize: 25,
    search: '',
    sort: 'createdAt',
    direction: 'desc',
  });
  const raw = new URLSearchParams({
    page: '100000',
    pageSize: '100',
    search: '  A%_\\ literal  ',
    status: 'Awaiting customer',
    organization: id.toUpperCase(),
    assignee: 'unassigned',
    createdFrom: '2024-02-29',
    createdTo: '2024-02-29',
    sort: 'number',
    direction: 'asc',
  });
  assert.deepEqual(parseTicketQuery(raw.toString()), {
    page: 100000,
    pageSize: 100,
    search: 'A%_\\ literal',
    status: 'Awaiting customer',
    organization: id,
    assignee: 'unassigned',
    createdFrom: '2024-02-29',
    createdTo: '2024-02-29',
    sort: 'number',
    direction: 'asc',
  });
  assert.equal(parseTicketQuery('assignee=' + id).assignee, id);
  assert.equal(
    parseTicketQuery('createdFrom=0001-01-01&createdTo=9999-12-31').createdTo,
    '9999-12-31',
  );
  for (const sort of ticketSortFields)
    for (const direction of ['asc', 'desc'])
      assert.equal(
        parseTicketQuery(`sort=${sort}&direction=${direction}`).sort,
        sort,
      );
});

test('invalid query parameters fail before repository work, including duplicates, calendar errors and encoding', () => {
  for (const raw of [
    'unknown=1',
    '?page=1',
    'page=1&page=2',
    'search=a&search=b',
    'page=0',
    'page=-1',
    'page=100001',
    'page=1.5',
    'page=1e2',
    'page=',
    'pageSize=24',
    'pageSize=1000',
    'pageSize=',
    'status=Done',
    'status=',
    'organization=Example',
    'assignee=any',
    'createdFrom=2023-02-29',
    'createdTo=2026-04-31',
    'createdFrom=0000-01-01',
    'createdTo=2026-1-01',
    'createdFrom=2026-11-02&createdTo=2026-11-01',
    'sort=number;DROP+TABLE+tickets',
    'direction=DESC',
    'search=%ZZ',
    'search=%C3%28',
    'search=%00',
    'search=%0A',
    'search=' + 'a'.repeat(101),
    'search=' + '%20'.repeat(700),
  ])
    assert.throws(() => parseTicketQuery(raw), InvalidTicketQuery, raw);
});

test('query parameters stay outside SQL, literal wildcard escaping and UTC date bounds are explicit', () => {
  const search = "%_\\' OR true --";
  const parsed = parseTicketQuery(
    new URLSearchParams({
      search,
      status: 'New',
      organization: id,
      assignee: id,
      createdFrom: '2026-11-01',
      createdTo: '2026-11-02',
      page: '2',
      pageSize: '50',
    }).toString(),
  );
  const query = buildTicketPageQuery(parsed);
  assert(!query.text.includes(search));
  assert(!query.text.includes(id));
  assert.deepEqual(query.values, [
    "%\\%\\_\\\\' OR true --%",
    'New',
    id,
    id,
    '2026-11-01',
    '2026-11-02',
    50,
    50,
  ]);
  assert.match(query.text, /ILIKE \$1 ESCAPE E'\\\\'/);
  assert.match(query.text, /AT TIME ZONE 'UTC'/);
  assert.match(query.text, /::date \+ 1/);
  const unassigned = buildTicketPageQuery(
    parseTicketQuery('assignee=unassigned'),
  );
  assert.match(unassigned.text, /t\.assignee_id IS NULL/);
  assert.deepEqual(unassigned.values, [25, 0]);
});

test('numeric ticket ordering never casts arbitrary suffixes and every order has explicit stable ties/null placement', () => {
  for (const sort of ticketSortFields)
    for (const direction of ['asc', 'desc']) {
      const { text } = buildTicketPageQuery(
        parseTicketQuery(`sort=${sort}&direction=${direction}`),
      );
      assert.match(text, /NULLS LAST/);
      assert.match(text, /number COLLATE "C" ASC/);
      if (sort === 'number') {
        assert.match(text, /length\(substring\(number FROM 4\)\)/);
        assert(!/::(?:integer|bigint|numeric)/.test(text));
      } else if (!['createdAt', 'updatedAt'].includes(sort))
        assert.match(text, /COLLATE "C"/);
    }
  assert.throws(
    () =>
      buildTicketPageQuery({ ...parseTicketQuery(), sort: 'number;select 1' }),
    /ordering/,
  );
  assert.throws(
    () => buildTicketPageQuery({ ...parseTicketQuery(), sort: 'constructor' }),
    /ordering/,
  );
  assert.throws(
    () =>
      buildTicketPageQuery({
        ...parseTicketQuery(),
        direction: 'asc;select 1',
      }),
    /ordering/,
  );
  assert.throws(
    () => buildTicketPageQuery({ ...parseTicketQuery(), pageSize: 100000 }),
    /page/,
  );
});

test('repository obtains bounded page and total in one statement and retains total beyond the last page', async () => {
  const calls = [];
  const repository = new PostgresTicketRepository({
    query: async (...args) => {
      calls.push(args);
      return { rows: [{ total: '100000', items: [row] }] };
    },
  });
  const page = await repository.query(parseTicketQuery('page=2&pageSize=50'));
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /WITH filtered AS MATERIALIZED/);
  assert.deepEqual(calls[0][1], [50, 50]);
  assert.deepEqual(Object.keys(page).sort(), [
    'items',
    'page',
    'pageSize',
    'total',
  ]);
  assert.equal(page.total, 100000);
  assert.equal(page.page, 2);
  assert.equal(page.pageSize, 50);
  assert.equal(page.items[0].createdAt, '2026-11-01T00:00:00.000Z');
  assert.deepEqual(Object.keys(page.items[0]).sort(), [
    'assignee',
    'createdAt',
    'number',
    'organization',
    'status',
    'subject',
    'updatedAt',
  ]);
  const beyond = new PostgresTicketRepository({
    query: async () => ({ rows: [{ total: '7', items: [] }] }),
  });
  assert.deepEqual(await beyond.query(parseTicketQuery('page=100000')), {
    items: [],
    total: 7,
    page: 100000,
    pageSize: 25,
  });
});

test('repository rejects oversized/invalid pages and legacy reads cannot return an unbounded dataset', async () => {
  for (const result of [
    { total: '-1', items: [] },
    { total: '9007199254740992', items: [] },
    { total: '0', items: [row] },
    { total: '100', items: Array(26).fill(row) },
    { total: '1', items: [null] },
  ]) {
    const repository = new PostgresTicketRepository({
      query: async () => ({ rows: [result] }),
    });
    await assert.rejects(
      repository.query(parseTicketQuery()),
      /PostgreSQL returned/,
    );
  }
  let sql;
  const legacy = new PostgresTicketRepository({
    query: async (statement) => {
      sql = statement;
      return { rows: Array(101).fill(row) };
    },
  });
  await assert.rejects(legacy.list(), /legacy ticket collection is too large/);
  assert.match(sql, /LIMIT 101$/);
});

test('options are bounded, stable-schema directories with explicit overflow rejection', async () => {
  let sql;
  const repository = new PostgresTicketRepository({
    query: async (statement) => {
      sql = statement;
      return {
        rows: [
          {
            organizations: [{ id, name: 'Example', private: 'omitted' }],
            assignees: [],
          },
        ],
      };
    },
  });
  assert.deepEqual(await repository.options(), {
    organizations: [{ id, name: 'Example' }],
    assignees: [],
  });
  assert.equal((sql.match(/LIMIT 1001/g) ?? []).length, 2);
  for (const directories of [
    { organizations: Array(1001).fill({ id, name: 'Example' }), assignees: [] },
    { organizations: [{ id: 'not-an-id', name: 'Example' }], assignees: [] },
    {
      organizations: [
        { id, name: 'Example' },
        { id, name: 'Duplicate' },
      ],
      assignees: [],
    },
  ]) {
    const invalid = new PostgresTicketRepository({
      query: async () => ({ rows: [directories] }),
    });
    await assert.rejects(invalid.options(), /PostgreSQL/);
  }
});

test('real HTTP query/options routes validate before work and preserve unsupported fixture behavior', async (t) => {
  const seen = [];
  const repository = {
    list: async () => ({ items: [], total: 0 }),
    query: async (query) => {
      seen.push(query);
      return {
        items: [],
        total: 100000,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
    options: async () => ({
      organizations: [{ id, name: 'Example' }],
      assignees: [],
    }),
  };
  const base = await local(t, repository);
  const success = await fetch(
    base + '/api/tickets/query?page=3&pageSize=100&search=Example',
  );
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await success.json(), {
    items: [],
    total: 100000,
    page: 3,
    pageSize: 100,
  });
  assert.equal(seen[0].search, 'Example');
  for (const path of [
    '/api/tickets/query?page=0',
    '/api/tickets/query?unknown=1',
    '/api/tickets/query?page=1&page=2',
    '/api/tickets/options?unknown=1',
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_REQUEST');
  }
  assert.equal(seen.length, 1);
  assert.deepEqual(await (await fetch(base + '/api/tickets/options')).json(), {
    organizations: [{ id, name: 'Example' }],
    assignees: [],
  });
  assert.equal(
    (await fetch(base + '/api/tickets/query', { method: 'POST' })).status,
    405,
  );
  assert.equal(
    (await fetch(base + '/api/tickets/query', { method: 'OPTIONS' })).status,
    204,
  );
  const fixture = await local(t, new FixtureTicketRepository());
  assert.equal((await fetch(fixture + '/api/tickets/query')).status, 404);
  assert.equal((await fetch(fixture + '/api/tickets/options')).status, 404);
  assert.equal(
    (await (await fetch(fixture + '/api/tickets')).json()).total,
    25,
  );
});

test('Lambda adapter forwards a raw query only to supported repository routes and sanitizes their failures', async () => {
  const seen = [];
  const repository = {
    list: async () => ({ items: [], total: 0 }),
    query: async (query) => {
      seen.push(query);
      return {
        items: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
  };
  const handler = createLambdaHandler({ repository, logError: () => {} });
  const event = {
    version: '2.0',
    rawPath: '/api/tickets/query',
    rawQueryString: 'page=4&search=hello',
    requestContext: { http: { method: 'GET' } },
  };
  assert.equal((await handler(event)).statusCode, 200);
  assert.equal(seen[0].page, 4);
  assert.equal(
    (await handler({ ...event, rawQueryString: 'page=0' })).statusCode,
    400,
  );
  assert.equal(
    (await handler({ ...event, rawQueryString: 42 })).statusCode,
    400,
  );
  const broken = createLambdaHandler({
    repository: {
      ...repository,
      query: async () => {
        throw new Error('private query credentials');
      },
    },
    logError: () => {},
  });
  const failure = await broken(event);
  assert.equal(failure.statusCode, 500);
  assert.deepEqual(JSON.parse(failure.body), {
    error: { code: 'INTERNAL_ERROR', message: 'Tickets could not be loaded.' },
  });
  const fixture = createLambdaHandler({
    repository: new FixtureTicketRepository(),
  });
  assert.equal((await fixture(event)).statusCode, 404);
});
