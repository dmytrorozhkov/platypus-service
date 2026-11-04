import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { createLambdaHandler, handler } from '../dist/lambda.js';
import { createTicketServer } from '../dist/server.js';
import { FixtureTicketRepository } from '../dist/ticket-repository.js';

function event(method = 'GET', rawPath = '/api/tickets', headers = {}) {
  return {
    version: '2.0',
    rawPath,
    rawQueryString: '',
    headers,
    requestContext: { http: { method, path: rawPath, protocol: 'HTTP/1.1' } },
    isBase64Encoded: false,
  };
}
async function local(t, options) {
  const server = createTicketServer(options);
  server.listen(0, 'localhost');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  return 'http://localhost:' + server.address().port;
}
async function parity(
  base,
  lambda,
  { method = 'GET', path = '/api/tickets', headers = {}, query = '' },
) {
  const http = await fetch(base + path + query, { method, headers });
  const input = event(method, path, headers);
  input.rawQueryString = query.replace(/^\?/, '');
  const response = await lambda(input);
  assert.equal(response.statusCode, http.status);
  assert.equal(response.isBase64Encoded, false);
  assert.equal(typeof response.body, 'string');
  for (const header of [
    'cache-control',
    'x-content-type-options',
    'vary',
    'content-type',
    'access-control-allow-origin',
    'access-control-allow-methods',
    'allow',
  ]) {
    assert.equal(
      response.headers[header] ?? null,
      http.headers.get(header),
      header,
    );
  }
  assert.equal(response.body, await http.text());
  return response;
}

test('real HTTP and payload-v2 Lambda have matching routes, CORS, methods, no-store headers and complete fixture', async (t) => {
  const options = { repository: new FixtureTicketRepository() };
  const base = await local(t, options);
  const lambda = createLambdaHandler(options);
  for (const request of [
    {},
    { path: '/api/health' },
    { query: '?ignored=one&ignored=two' },
    { path: '/missing' },
    { path: '/api/tickets/' },
    { path: '/api/%74ickets' },
    { method: 'POST' },
    { method: 'PUT' },
    { method: 'HEAD' },
    { method: 'HEAD', path: '/missing' },
    { method: 'OPTIONS', headers: { Origin: 'http://localhost:4200' } },
    { method: 'OPTIONS', path: '/missing' },
    { headers: { Origin: 'http://localhost:4200' } },
    { headers: { origin: 'http://localhost:5175' } },
    { headers: { ORIGIN: 'https://unrelated.example' } },
    { method: 'OPTIONS', headers: { Origin: 'https://unrelated.example' } },
  ])
    await parity(base, lambda, request);
  const response = await lambda(event());
  assert.equal(response.statusCode, 200);
  const collection = JSON.parse(response.body);
  assert.equal(collection.total, 25);
  assert.equal(collection.items.length, 25);
  assert.deepEqual(collection, await options.repository.list());
  const head = await lambda(event('HEAD'));
  assert.equal(head.statusCode, 405);
  assert.equal(head.body, '');
  assert.equal(head.headers.allow, 'GET, OPTIONS');
});

test('empty and throwing repositories keep HTTP/Lambda parity and sanitize internal failures', async (t) => {
  for (const failure of [false, true]) {
    const errors = [];
    const options = {
      repository: {
        list: async () => {
          if (failure) throw new Error('sensitive database stack');
          return { items: [], total: 0 };
        },
      },
      logError: (error) => errors.push(error),
    };
    const base = await local(t, options);
    const response = await parity(base, createLambdaHandler(options), {});
    assert.equal(response.statusCode, failure ? 500 : 200);
    assert.deepEqual(
      JSON.parse(response.body),
      failure
        ? {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Tickets could not be loaded.',
            },
          }
        : { items: [], total: 0 },
    );
    assert.equal(response.body.includes('sensitive'), false);
    assert.equal(errors.length, failure ? 2 : 0);
  }
});

test('payload-v2 input rejects malformed consumed fields, normalizes header case and keeps raw paths authoritative', async () => {
  const lambda = createLambdaHandler({
    repository: new FixtureTicketRepository(),
  });
  const valid = event('GET', '/api/health');
  const malformed = [
    null,
    [],
    {},
    { ...valid, version: '1.0' },
    { ...valid, rawPath: undefined },
    { ...valid, rawPath: 42 },
    { ...valid, rawPath: 'api/health' },
    { ...valid, rawPath: '/api/health?x=1' },
    { ...valid, rawPath: '/api/health#fragment' },
    { ...valid, rawPath: '/api/health\n' },
    { ...valid, requestContext: null },
    { ...valid, requestContext: { http: {} } },
    { ...valid, requestContext: { http: { method: '' } } },
    { ...valid, requestContext: { http: { method: 42 } } },
    { ...valid, requestContext: { http: { method: 'GET\n' } } },
    { ...valid, headers: [] },
    { ...valid, headers: 'bad' },
    { ...valid, headers: { 'Origin ': 'http://localhost:4200' } },
    { ...valid, headers: { origin: ['http://localhost:4200'] } },
    {
      ...valid,
      headers: { origin: 'http://localhost:4200\r\nX-Other: unsafe' },
    },
    {
      ...valid,
      headers: {
        Origin: 'http://localhost:4200',
        origin: 'https://other.example',
      },
    },
  ];
  for (const input of malformed) {
    const response = await lambda(input);
    assert.equal(response.statusCode, 400, JSON.stringify(input));
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(JSON.parse(response.body).error.code, 'INVALID_REQUEST');
  }
  const normalized = await lambda(
    event('get', '/api/health', { OrIgIn: ' http://localhost:4200 ' }),
  );
  assert.equal(normalized.statusCode, 200);
  assert.equal(
    normalized.headers['access-control-allow-origin'],
    'http://localhost:4200',
  );
  const raw = event('GET', '/api/%68ealth');
  raw.requestContext.http.path = '/api/health';
  assert.equal((await lambda(raw)).statusCode, 404);
  const unknown = event('CUSTOM-METHOD', '/api/health');
  assert.equal((await lambda(unknown)).statusCode, 405);
});

test('exported handler respects deployment origins per invocation without a wildcard', async () => {
  const previous = process.env.ALLOWED_ORIGINS;
  try {
    process.env.ALLOWED_ORIGINS = 'https://example.cloudfront.net';
    const allowed = await handler(
      event('GET', '/api/health', { Origin: 'https://example.cloudfront.net' }),
    );
    assert.equal(allowed.statusCode, 200);
    assert.equal(
      allowed.headers['access-control-allow-origin'],
      'https://example.cloudfront.net',
    );
    const denied = await handler(
      event('GET', '/api/health', { origin: 'http://localhost:4200' }),
    );
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
  } finally {
    if (previous === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previous;
  }
});

test('importing compiled Lambda entry starts no listener or signal handler and needs no main module', () => {
  const entry = new URL('../dist/lambda.js', import.meta.url).href;
  const code = [
    "import net from 'node:net';",
    'let listens = 0;',
    "net.Server.prototype.listen = function(){ listens++; throw new Error('Unexpected listener at import'); };",
    "const before = ['SIGINT','SIGTERM'].map(signal => process.listenerCount(signal));",
    'const module = await import(' + JSON.stringify(entry) + ');',
    "const after = ['SIGINT','SIGTERM'].map(signal => process.listenerCount(signal));",
    'console.log(JSON.stringify({ listens, before, after, handler: typeof module.handler }));',
  ].join('\n');
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', code],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    },
  );
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    listens: 0,
    before: [0, 0],
    after: [0, 0],
    handler: 'function',
  });
});
