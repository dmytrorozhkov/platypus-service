import assert from 'node:assert/strict';

// The imported demonstration is read-only: its reviewed count remains fixed.
export async function checkNeonApi({ origin, request, noStore }) {
  async function query(parameters = {}) {
    const values = {
      page: 1,
      pageSize: 25,
      sort: 'createdAt',
      direction: 'desc',
      ...parameters,
    };
    const url = new URL('/api/tickets/query', origin);
    for (const [name, value] of Object.entries(values))
      url.searchParams.set(name, String(value));
    const response = await request(url.href);
    assert.equal(response.status, 200, 'Paged Neon API must succeed.');
    noStore(response);
    assert.match(
      response.headers.get('content-type') ?? '',
      /application\/json/i,
    );
    const body = await response.json();
    assert.equal(body.page, values.page);
    assert.equal(body.pageSize, values.pageSize);
    assert(Number.isSafeInteger(body.total) && body.total >= 0);
    assert(Array.isArray(body.items));
    assert.equal(
      body.items.length,
      Math.min(
        values.pageSize,
        Math.max(0, body.total - (values.page - 1) * values.pageSize),
      ),
    );
    assert(
      body.items.every(
        (item) =>
          typeof item.number === 'string' && /^PS-[0-9]+$/.test(item.number),
      ),
    );
    assert.equal(
      new Set(body.items.map((item) => item.number)).size,
      body.items.length,
    );
    return body;
  }
  const first = await query();
  assert.equal(
    first.total,
    100000,
    'Expected the verified imported dataset, never the fixture demo.',
  );
  const second = await query({ page: 2 });
  assert.equal(second.total, first.total);
  const numbers = new Set(first.items.map((item) => item.number));
  assert(
    second.items.every((item) => !numbers.has(item.number)),
    'Pages must not overlap.',
  );
  const large = await query({ pageSize: 100 });
  assert.equal(large.total, first.total);
  assert.deepEqual(large.items.slice(0, 25), first.items);
  const filtered = await query({ status: 'New' });
  assert(filtered.total > 25 && filtered.total < first.total);
  assert(filtered.items.every((item) => item.status === 'New'));
  assert.deepEqual(
    await query(),
    first,
    'Warm access must preserve the same page.',
  );
  const optionsResponse = await request(origin + '/api/tickets/options');
  assert.equal(optionsResponse.status, 200);
  noStore(optionsResponse);
  const options = await optionsResponse.json();
  for (const [name, count] of [
    ['organizations', 100],
    ['assignees', 40],
  ]) {
    assert.equal(options[name]?.length, count);
    assert.equal(new Set(options[name].map((item) => item.id)).size, count);
  }
  for (const suffix of ['pageSize=100000', 'page=1&page=2']) {
    const response = await request(origin + '/api/tickets/query?' + suffix);
    assert.equal(
      response.status,
      400,
      'Invalid or unbounded queries must fail.',
    );
    noStore(response);
  }
  const legacy = await request(origin + '/api/tickets');
  assert.equal(
    legacy.status,
    500,
    'Legacy endpoint must not return a fixture fallback or the full dataset.',
  );
  noStore(legacy);
  assert.deepEqual(await legacy.json(), {
    error: { code: 'INTERNAL_ERROR', message: 'Tickets could not be loaded.' },
  });
  return { first, second, large, filtered };
}
