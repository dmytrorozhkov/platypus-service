import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createStaticServer } from './serve-local.mjs';
import {
  validateConfiguration,
  validateModule,
  validateMountHandle,
} from '../apps/shell/src/app/remote-host/runtime.ts';

const valid = () => ({
  schemaVersion: 1,
  remotes: Object.fromEntries(
    ['analytics', 'administration', 'support'].map((name) => [
      name,
      {
        contractVersion: 1,
        remoteEntryUrl: 'http://localhost:4301/remoteEntry.json',
        exposedModule: './mount',
        cssUrls: ['http://localhost:4301/style.css'],
      },
    ]),
  ),
});

test('runtime configuration rejects executable URL schemes, missing remotes and unsupported versions', () => {
  assert.equal(
    validateConfiguration(valid()).remotes.analytics.contractVersion,
    1,
  );
  for (const bad of [
    null,
    {},
    { ...valid(), schemaVersion: 2 },
    { ...valid(), remotes: {} },
  ]) {
    assert.throws(() => validateConfiguration(bad));
  }
  for (const url of [
    'javascript:alert(1)',
    'data:text/javascript,x',
    '/relative.js',
    'https://user:pass@example.com/app.js',
  ]) {
    const config = valid();
    config.remotes.analytics.remoteEntryUrl = url;
    assert.throws(() => validateConfiguration(config));
  }
  const invalidExpose = valid();
  invalidExpose.remotes.analytics.exposedModule = './unexpected';
  assert.throws(() => validateConfiguration(invalidExpose));
  const config = valid();
  config.remotes.administration.contractVersion = 2;
  assert.throws(() => validateConfiguration(config));
  assert.throws(() => validateModule({ contractVersion: 2, mount() {} }));
  assert.throws(() => validateModule({ contractVersion: 1 }));
  assert.throws(() => validateMountHandle({}));
  assert.doesNotThrow(() => validateMountHandle({ unmount() {} }));
});

test('static hosting enforces MIME, CORS, route fallback and path boundaries', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'platypus-host-'));
  const root = path.join(temporary, 'public');
  await mkdir(root);
  await writeFile(path.join(root, 'index.html'), '<h1>Shell</h1>');
  await writeFile(
    path.join(root, 'remote-entry.js'),
    'export const contractVersion = 1;',
  );
  await writeFile(path.join(root, 'style.css'), '.remote { color: green; }');
  await writeFile(
    path.join(root, 'remoteEntry.json'),
    JSON.stringify({
      name: 'test-remote',
      shared: [],
      exposes: [{ key: './mount', outFileName: 'remote-entry.js' }],
    }),
  );
  await writeFile(path.join(temporary, 'secret.txt'), 'outside');
  const server = await createStaticServer({ root, fallback: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    let response = await fetch(origin + '/analytics');
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Shell/);
    response = await fetch(origin + '/missing.js');
    assert.equal(response.status, 404);
    response = await fetch(origin + '/remoteEntry.json', {
      headers: { Origin: 'http://localhost:4200' },
    });
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:4200',
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).exposes[0].key, './mount');
    response = await fetch(origin + '/remote-entry.js', {
      headers: { Origin: 'http://localhost:4200' },
    });
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:4200',
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    response = await fetch(origin + '/style.css', {
      headers: { Origin: 'https://other.example' },
    });
    assert.match(response.headers.get('content-type'), /text\/css/);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    response = await fetch(origin + '/remote-entry.js', { method: 'POST' });
    assert.equal(response.status, 405);
    for (const requestPath of [
      '/%2e%2e%5csecret.txt',
      '/bad%00.js',
      '/bad%.js',
    ]) {
      const status = await new Promise((resolve, reject) => {
        const request = http.get(origin + requestPath, (result) => {
          result.resume();
          resolve(result.statusCode);
        });
        request.on('error', reject);
      });
      assert.equal(status, 400);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(temporary, { recursive: true, force: true });
  }
  const remote = await createStaticServer({
    root: path.dirname(
      new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'),
    ),
    fallback: false,
  });
  await new Promise((resolve) => remote.listen(0, '127.0.0.1', resolve));
  try {
    assert.equal(
      (
        await fetch(
          'http://127.0.0.1:' + remote.address().port + '/missing-route',
        )
      ).status,
      404,
    );
  } finally {
    remote.closeAllConnections();
    await new Promise((resolve) => remote.close(resolve));
  }
});
