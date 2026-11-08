import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createStaticServer } from './serve-local.mjs';

test('large runtime config is an explicit in-memory override and leaves ordinary static assets unchanged', async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'platypus-large-static-'),
  );
  const legacy = { apiBaseUrl: 'http://localhost:3000' };
  const paged = {
    apiBaseUrl: 'http://localhost:3001',
    ticketQueryMode: 'paged',
  };
  await writeFile(
    path.join(directory, 'ticket-api-config.json'),
    JSON.stringify(legacy),
  );
  const servers = [];
  try {
    for (const configuration of [undefined, paged]) {
      const server = await createStaticServer({
        root: directory,
        ticketApiConfig: configuration,
      });
      servers.push(server);
      server.listen(0, 'localhost');
      await once(server, 'listening');
      const url =
        'http://localhost:' + server.address().port + '/ticket-api-config.json';
      const response = await fetch(url);
      assert.deepEqual(await response.json(), configuration ?? legacy);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const head = await fetch(url, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
      assert.equal((await fetch(url, { method: 'POST' })).status, 405);
      assert.deepEqual(
        JSON.parse(
          await readFile(
            path.join(directory, 'ticket-api-config.json'),
            'utf8',
          ),
        ),
        legacy,
      );
    }
  } finally {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise((resolve) => {
            server.closeAllConnections();
            server.close(resolve);
          }),
      ),
    );
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert(path.basename(resolved).startsWith('platypus-large-static-'));
    await rm(resolved, { recursive: true, force: true });
  }
});
