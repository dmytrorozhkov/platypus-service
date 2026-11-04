import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { startTicketServer } from './server-process.mjs';
import { stopChild } from './serve-shell.mjs';

export async function checkSupportStandalone(page, passed) {
  const api = page.waitForResponse('http://localhost:3000/api/tickets');
  await page.goto('http://localhost:5175/');
  await page.getByText('25 tickets', { exact: true }).waitFor();
  assert.equal(await page.locator('.ps-support tbody tr').count(), 25);
  const response = await api;
  assert.equal(response.status(), 200);
  assert.equal(
    response.headers()['access-control-allow-origin'],
    'http://localhost:5175',
  );
  assert.equal((await response.json()).total, 25);
  passed(
    'Support standalone requests the real Node API with its allowed browser origin and renders 25 rows.',
  );
}

export async function checkRealServerRecovery(browser, passed) {
  // A test-owned real server avoids stopping another session's API process.
  const probe = createServer();
  probe.listen(0, 'localhost');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  let child;
  const context = await browser.newContext();
  try {
    child = await startTicketServer({ PORT: String(port) });
    const page = await context.newPage();
    const apiUrl = 'http://localhost:' + port + '/api/tickets';
    let attempts = 0;
    page.on('request', (request) => {
      if (request.url() === apiUrl) attempts++;
    });
    await page.route('**/ticket-api-config.json', (route) =>
      route.fulfill({ json: { apiBaseUrl: 'http://localhost:' + port } }),
    );
    await page.goto('http://localhost:4200/support/tickets');
    await page.getByText('25 tickets', { exact: true }).waitFor();
    const exited = once(child, 'exit');
    stopChild(child);
    await exited;
    child = undefined;
    await page.reload();
    await page
      .getByRole('heading', { name: 'Tickets are unavailable', exact: true })
      .waitFor();
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Tickets are unavailable', exact: true })
      .waitFor();
    child = await startTicketServer({ PORT: String(port) });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByText('25 tickets', { exact: true }).waitFor();
    assert.equal(await page.locator('.ps-support tbody tr').count(), 25);
    assert(attempts >= 4);
    passed(
      'A test-owned real Node server is stopped, unavailable Retry stays readable, and restart plus Retry recovers without restarting frontends.',
    );
  } finally {
    await context.close();
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit');
      stopChild(child);
      await exited;
    }
  }
}
