import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createTicketServer } from '../dist/server.js';
import { FixtureTicketRepository } from '../dist/ticket-repository.js';

async function running(t, repository, options = {}) {
  const server = createTicketServer({ repository, ...options });
  server.listen(0, 'localhost');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    return new Promise((r) => server.close(r));
  });
  return 'http://localhost:' + server.address().port;
}
test('HTTP health, authoritative collection, JSON404 and methods', async (t) => {
  const base = await running(t, new FixtureTicketRepository());
  const health = await fetch(base + '/api/health');
  assert.equal(health.status, 200);
  assert.match(health.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const response = await fetch(base + '/api/tickets');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { items, total } = await response.json();
  assert.equal(total, 25);
  assert.equal(items.length, 25);
  assert.equal(new Set(items.map((item) => item.number)).size, 25);
  assert.deepEqual([...new Set(items.map((item) => item.status))].sort(), [
    'Awaiting customer',
    'Closed',
    'In progress',
    'New',
  ]);
  for (const item of items) {
    assert.deepEqual(Object.keys(item).sort(), [
      'assignee',
      'createdAt',
      'number',
      'organization',
      'status',
      'subject',
      'updatedAt',
    ]);
    assert(item.assignee === null || typeof item.assignee === 'string');
    assert.match(item.createdAt, /Z$/);
    assert.match(item.updatedAt, /Z$/);
    assert(Number.isFinite(Date.parse(item.createdAt)));
    assert(Number.isFinite(Date.parse(item.updatedAt)));
  }
  const missing = await fetch(base + '/missing');
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'NOT_FOUND');
  const post = await fetch(base + '/api/tickets', { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal((await post.json()).error.code, 'METHOD_NOT_ALLOWED');
});
test('empty repository and controlled internal failure return stable envelopes without internal details', async (t) => {
  const empty = await running(t, {
    list: async () => ({ items: [], total: 0 }),
  });
  assert.deepEqual(await (await fetch(empty + '/api/tickets')).json(), {
    items: [],
    total: 0,
  });
  const failures = [];
  const broken = await running(
    t,
    {
      list: async () => {
        throw new Error('private database password stack');
      },
    },
    { logError: (error) => failures.push(error) },
  );
  const response = await fetch(broken + '/api/tickets');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: { code: 'INTERNAL_ERROR', message: 'Tickets could not be loaded.' },
  });
  assert.equal(failures.length, 1);
});
test('allowed browser origins and preflight are explicit; other origins are rejected', async (t) => {
  const base = await running(t, new FixtureTicketRepository());
  for (const origin of ['http://localhost:4200', 'http://localhost:5175']) {
    const response = await fetch(base + '/api/tickets', {
      headers: { Origin: origin },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('vary'), 'Origin');
    const preflight = await fetch(base + '/api/tickets', {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get('access-control-allow-methods'),
      'GET, OPTIONS',
    );
  }
  const forbidden = await fetch(base + '/api/tickets', {
    headers: { Origin: 'https://unrelated.example' },
  });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get('access-control-allow-origin'), null);
  assert.equal((await forbidden.json()).error.code, 'ORIGIN_NOT_ALLOWED');
});
