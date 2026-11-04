import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { createWorkspace } from './workspace-processes.mjs';
import { startTicketServer } from './server-process.mjs';
import { stopChild } from './serve-shell.mjs';

async function listener() {
  const server = createServer((request, response) =>
    response.end('frontend alive'),
  );
  server.listen(0, 'localhost');
  await once(server, 'listening');
  return server;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
async function freePort() {
  const server = await listener();
  const port = server.address().port;
  await close(server);
  return port;
}
test('cancellation while a real static listener is acquired closes it and starts no later app', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let acquired;
  const observed = new Promise((resolve) => {
    acquired = resolve;
  });
  let late;
  let calls = 0;
  const api = new EventEmitter();
  let apiStopped = 0;
  const workspace = createWorkspace({
    preview: true,
    startApi: async () => api,
    stopProcess: (child) => {
      if (child === api) apiStopped++;
    },
    startStatic: async () => {
      calls++;
      late = await listener();
      acquired();
      await gate;
      return late;
    },
  });
  await observed;
  workspace.stop();
  release();
  await assert.rejects(workspace.ready, /cancelled/);
  assert.equal(late.listening, false);
  assert.equal(calls, 1);
  assert.equal(apiStopped, 1);
  workspace.stop();
  assert.equal(apiStopped, 1);
});
test('real occupied API port fails before starting frontends and does not kill its owner', async () => {
  const occupied = await listener();
  let frontends = 0;
  try {
    const workspace = createWorkspace({
      startApi: () =>
        startTicketServer({ PORT: String(occupied.address().port) }),
      startStatic: async () => {
        frontends++;
        throw new Error('unexpected');
      },
    });
    await assert.rejects(workspace.ready, /before startup/);
    assert.equal(frontends, 0);
    assert.equal(workspace.exitCode, 1);
    assert.equal(occupied.listening, true);
    assert.equal(
      await (await fetch('http://localhost:' + occupied.address().port)).text(),
      'frontend alive',
    );
  } finally {
    await close(occupied);
  }
});
test('owned real API exit leaves frontends available; separate restart and workspace shutdown clean up their own resources', async () => {
  const port = await freePort();
  const staticServers = [];
  let api;
  const workspace = createWorkspace({
    preview: true,
    startApi: async () => {
      api = await startTicketServer({ PORT: String(port) });
      return api;
    },
    startStatic: async () => {
      const server = await listener();
      staticServers.push(server);
      return server;
    },
  });
  try {
    await workspace.ready;
    assert.deepEqual(
      await (await fetch('http://localhost:' + port + '/api/health')).json(),
      { status: 'ok' },
    );
    const exited = once(api, 'exit');
    stopChild(api);
    await exited;
    assert.equal(staticServers.length, 4);
    for (const server of staticServers) {
      assert.equal(server.listening, true);
      assert.equal(
        (await fetch('http://localhost:' + server.address().port)).status,
        200,
      );
    }
    const restarted = await startTicketServer({ PORT: String(port) });
    const stopped = once(restarted, 'exit');
    stopChild(restarted);
    await stopped;
    workspace.stop();
    assert(staticServers.every((server) => !server.listening));
    await assert.rejects(fetch('http://localhost:' + port + '/api/health'));
  } finally {
    workspace.stop();
    if (api && api.exitCode === null) {
      const exited = once(api, 'exit');
      stopChild(api);
      await exited;
    }
  }
});
