import assert from 'node:assert/strict';
import test from 'node:test';
import { checkNeonApi } from './live-api.mjs';

function fixture(mutate = () => {}) {
  const calls = [];
  return {
    calls,
    input: {
      origin: 'https://dtest123.cloudfront.net',
      noStore(response) {
        assert.equal(response.headers.get('cache-control'), 'no-store');
      },
      async request(url) {
        calls.push(url);
        const parsed = new URL(url);
        const query = parsed.searchParams;
        let status = 200;
        let body;
        if (parsed.pathname.endsWith('/options')) {
          body = Object.fromEntries(
            [
              ['organizations', 100],
              ['assignees', 40],
            ].map(([key, count]) => [
              key,
              Array.from({ length: count }, (_, i) => ({
                id: String(i),
                name: String(i),
              })),
            ]),
          );
        } else if (parsed.pathname.endsWith('/query')) {
          const page = Number(query.get('page') ?? 1);
          const pageSize = Number(query.get('pageSize') ?? 25);
          if (pageSize > 100 || query.getAll('page').length > 1) {
            status = 400;
            body = {};
          } else {
            body = {
              page,
              pageSize,
              total: query.has('status') ? 25000 : 100000,
              items: Array.from({ length: pageSize }, (_, i) => ({
                number: 'PS-' + ((page - 1) * pageSize + i + 1),
                status: 'New',
              })),
            };
          }
        } else {
          status = 500;
          body = {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Tickets could not be loaded.',
            },
          };
        }
        const headers = {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        };
        const value = { status, body, headers };
        mutate(value, parsed);
        return new Response(JSON.stringify(value.body), {
          status: value.status,
          headers: value.headers,
        });
      },
    },
  };
}

test('Neon live API check verifies pages, count, filtering, warm reads and refusal boundaries', async () => {
  const s = fixture();
  const result = await checkNeonApi(s.input);
  assert.equal(result.first.total, 100000);
  assert.equal(result.large.items.length, 100);
  assert.equal(s.calls.length, 9);
});

test('Neon live API check refuses fixture fallback, overlapping pages, wrong filter and caching', async () => {
  for (const mutate of [
    (value, url) => {
      if (url.pathname.endsWith('/query') && value.status === 200)
        value.body.total = 25;
    },
    (value, url) => {
      if (url.searchParams.get('page') === '2')
        value.body.items[0].number = 'PS-1';
    },
    (value, url) => {
      if (url.searchParams.has('status')) value.body.items[0].status = 'Closed';
    },
    (value) => {
      value.headers['cache-control'] = 'public, max-age=60';
    },
    (value, url) => {
      if (url.pathname === '/api/tickets') {
        value.status = 200;
        value.body = { items: [], total: 25 };
      }
    },
  ])
    await assert.rejects(checkNeonApi(fixture(mutate).input));
});
