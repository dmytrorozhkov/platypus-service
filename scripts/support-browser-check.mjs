import {
  checkRealServerRecovery,
  checkSupportStandalone,
} from './ticket-api-browser-check.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from './serve-local.mjs';
const ticketApiUrl = 'http://localhost:3000/api/tickets';
const entryUrl = 'http://localhost:4303/remoteEntry.json';
const ticketsUrl = 'http://localhost:4200/support/tickets';
const heading = (page) =>
  page.getByRole('heading', { name: 'Tickets', exact: true }).waitFor();
const rows = (page) => page.locator('.ps-support tbody tr');
async function loaded(page) {
  await heading(page);
  await page.getByText('25 tickets', { exact: true }).waitFor();
  assert.equal(await rows(page).count(), 25);
}
async function layout(page) {
  assert.equal(await page.locator('link[data-ps-remote-style]').count(), 1);
  assert.equal(await page.locator('ps-support').count(), 1);
  const values = await page.locator('.ps-support').evaluate((section) => ({
    font: globalThis.getComputedStyle(section).fontFamily,
    title: globalThis.getComputedStyle(section.querySelector('h1')).color,
    background: globalThis.getComputedStyle(
      section.querySelector('table').closest('div').parentElement,
    ).backgroundColor,
    overflow:
      globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
  }));
  assert.equal(values.font, '"Segoe UI", Inter, Arial, sans-serif');
  assert.equal(values.title, 'rgb(36, 41, 65)');
  assert.equal(values.background, 'rgb(255, 255, 255)');
  assert.equal(values.overflow, false);
}
export async function checkSupport({
  browser,
  page,
  standalone,
  evidenceDirectory,
  passed,
}) {
  const css = await readFile(
    path.join(projectRoot, 'apps/support/dist/browser/styles.css'),
    'utf8',
  );
  assert(css.includes('.su\\:flex'));
  assert(css.includes('--su-color-ink'));
  assert(!css.includes('box-sizing:border-box'));
  assert(!css.includes('font-family:inherit'));
  assert(!css.includes('#support-root'));
  const fixture = JSON.parse(
    await readFile(
      path.join(projectRoot, 'apps/server/src/fixtures/tickets.json'),
      'utf8',
    ),
  );
  assert.equal(fixture.length, 25);
  assert.equal(new Set(fixture.map((t) => t.number)).size, 25);
  assert.deepEqual([...new Set(fixture.map((t) => t.status))].sort(), [
    'Awaiting customer',
    'Closed',
    'In progress',
    'New',
  ]);
  if (standalone) await checkSupportStandalone(page, passed);
  const requestedApi = page.waitForResponse(ticketApiUrl);
  await page.goto(ticketsUrl);
  await loaded(page);
  const actualApi = await requestedApi;
  assert.equal(actualApi.status(), 200);
  assert.equal((await actualApi.json()).total, 25);
  assert.equal(
    (
      await page.request.get('http://localhost:4303/fixtures/tickets.json')
    ).status(),
    404,
  );
  await layout(page);
  const headers = await page.locator('.ps-support th').allTextContents();
  assert.deepEqual(headers, [
    'Number',
    'Subject',
    'Organization',
    'Status',
    'Assignee',
    'Created (UTC)',
    'Updated (UTC)',
  ]);
  for (let i = 0; i < 25; i++) {
    const cells = (await rows(page).nth(i).locator('td').allTextContents()).map(
      (value) => value.trim(),
    );
    assert.deepEqual(cells.slice(0, 5), [
      fixture[i].number,
      fixture[i].subject,
      fixture[i].organization,
      fixture[i].status,
      fixture[i].assignee ?? 'Unassigned',
    ]);
    assert.equal(await rows(page).nth(i).locator('time').count(), 2);
  }
  await page.screenshot({
    path: path.join(evidenceDirectory, 'support-tickets.png'),
    fullPage: true,
  });
  await page.reload();
  await loaded(page);
  await layout(page);
  passed(
    'Support real Native Federation metadata and private Angular runtime renders all 25 fictional rows/seven columns; direct URL and refresh work.',
  );
  for (let i = 0; i < 3; i++) {
    for (const name of ['Analytics', 'Administration']) {
      await page.getByRole('link', { name, exact: true }).click();
      await page.getByRole('heading', { name, exact: true }).waitFor();
      assert.equal(await page.locator('ps-support').count(), 0);
      assert.equal(await page.locator('link[data-ps-remote-style]').count(), 1);
      await page.getByRole('link', { name: 'Tickets', exact: true }).click();
      await loaded(page);
      await layout(page);
      assert.equal(
        await page.locator('.ps-analytics,.ps-administration').count(),
        0,
      );
    }
  }
  await page.goBack();
  await page
    .getByRole('heading', { name: 'Administration', exact: true })
    .waitFor();
  await page.goForward();
  await loaded(page);
  passed(
    'Repeated navigation across all 3 sections removes Support Angular roots/styles; Back/Forward remain aligned.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await loaded(page);
  await layout(page);
  const overflow = await page
    .getByRole('region', {
      name: 'Ticket table, scroll horizontally for all columns',
    })
    .evaluate((el) => el.scrollWidth > el.clientWidth);
  assert(overflow);
  await page.screenshot({
    path: path.join(evidenceDirectory, 'support-mobile.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  passed(
    'Support mobile table scrolls within its region with no document overflow.',
  );
  const controlled = await browser.newContext();
  const data = await controlled.newPage();
  let ticketAborted = false;
  data.on('requestfailed', (request) => {
    if (request.url() === ticketApiUrl) ticketAborted = true;
  });
  let release;
  let observed;
  const gate = new Promise((r) => (release = r));
  const requested = new Promise((r) => (observed = r));
  await data.route(ticketApiUrl, async (route) => {
    observed();
    await gate;
    await route.continue().catch(() => {});
  });
  await data.goto(ticketsUrl);
  await requested;
  await data.getByText('Loading tickets...', { exact: true }).waitFor();
  await data.getByRole('link', { name: 'Analytics', exact: true }).click();
  await data.getByRole('heading', { name: 'Analytics', exact: true }).waitFor();
  release();
  await data.waitForTimeout(150);
  assert.equal(await data.locator('ps-support').count(), 0);
  assert.equal(await data.locator('link[data-ps-remote-style]').count(), 1);
  assert(
    ticketAborted,
    'Leaving Support aborts its outstanding ticket API fetch.',
  );
  await data.unroute(ticketApiUrl);
  passed(
    'Observed Support API loading state is cancellable; leaving route cannot render a late table.',
  );
  let mode = 'error';
  let attempts = 0;
  await data.route(ticketApiUrl, (route) => {
    attempts++;
    return mode === 'error'
      ? route.fulfill({ status: 503, json: { message: 'Unavailable' } })
      : mode === 'empty'
        ? route.fulfill({ json: { items: [], total: 0 } })
        : mode === 'malformed'
          ? route.fulfill({ json: { items: [{ number: 'bad' }], total: 1 } })
          : route.continue();
  });
  await data.goto(ticketsUrl);
  await data
    .getByRole('heading', { name: 'Tickets are unavailable', exact: true })
    .waitFor();
  mode = 'ok';
  await data.getByRole('button', { name: 'Retry', exact: true }).click();
  await loaded(data);
  assert(attempts >= 2);
  mode = 'empty';
  await data.reload();
  await data
    .getByRole('heading', { name: 'No tickets yet', exact: true })
    .waitFor();
  assert.equal(await rows(data).count(), 0);
  mode = 'ok';
  await data.reload();
  await loaded(data);
  mode = 'malformed';
  await data.reload();
  await data
    .getByRole('heading', { name: 'Tickets are unavailable', exact: true })
    .waitFor();
  mode = 'ok';
  await data.getByRole('button', { name: 'Retry', exact: true }).click();
  await loaded(data);
  passed(
    'Actual data boundary verifies HTTP 503 error, Retry refetch, empty result, malformed data and recovery without product debug controls.',
  );
  await controlled.close();
  await checkRealServerRecovery(browser, passed);
  const delayed = await browser.newContext();
  const slow = await delayed.newPage();
  const errs = [];
  slow.on('pageerror', (e) => errs.push(e.message));
  const entry = await (await delayed.request.get(entryUrl)).json();
  assert.equal(entry.name, 'support');
  assert.equal(entry.$version, 'v4');
  assert.deepEqual(entry.shared, []);
  const mountUrl = new URL(
    entry.exposes.find((e) => e.key === './mount').outFileName,
    entryUrl,
  ).href;
  const mountCode = await (await delayed.request.get(mountUrl)).text();
  const match = mountCode.match(/import\("(\.\/bootstrap-[^"]+\.js)"\)/);
  assert(
    match,
    'Generated mount has a separately loadable Angular startup chunk.',
  );
  const bootstrapUrl = new URL(match[1], mountUrl).href;
  let bootRelease, bootObserved;
  const bootGate = new Promise((r) => (bootRelease = r));
  const bootRequest = new Promise((r) => (bootObserved = r));
  await slow.route(bootstrapUrl, async (route) => {
    bootObserved();
    await bootGate;
    await route.continue().catch(() => {});
  });
  await slow.goto(ticketsUrl);
  await bootRequest;
  await slow.getByRole('link', { name: 'Analytics', exact: true }).click();
  await slow.getByRole('heading', { name: 'Analytics', exact: true }).waitFor();
  bootRelease();
  await slow.waitForTimeout(200);
  assert.equal(await slow.locator('ps-support').count(), 0);
  assert.equal(await slow.locator('link[data-ps-remote-style]').count(), 1);
  await slow.unroute(bootstrapUrl);
  passed(
    'Observed delayed Angular bootstrap chunk cannot mount Support after navigation.',
  );
  // Wrap only the actual public application factory in this isolated document: let Angular create
  // its real ApplicationRef, then hold its promise until the Shell has cancelled this activation.
  const bootstrapCode = await (await delayed.request.get(bootstrapUrl)).text();
  const exports = bootstrapCode.match(
    /export\{(\w+) as createSupportApplication,(\w+) as renderSupport\};/,
  );
  assert(
    exports,
    'Generated public factory exports are inspectable for the late-application test.',
  );
  const wrapped = bootstrapCode.replace(
    exports[0],
    'export async function createSupportApplication(){const app=await ' +
      exports[1] +
      '();globalThis.__supportCreated=true;const destroy=app.destroy.bind(app);app.destroy=()=>{globalThis.__supportDestroyed=(globalThis.__supportDestroyed??0)+1;destroy();};await new Promise(resolve=>{globalThis.__supportRelease=resolve;});return app;}export{' +
      exports[2] +
      ' as renderSupport};',
  );
  await slow.route(bootstrapUrl, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: wrapped }),
  );
  await slow.goto(ticketsUrl);
  await slow.waitForFunction(() => globalThis.__supportCreated === true);
  await slow.getByRole('link', { name: 'Administration', exact: true }).click();
  await slow
    .getByRole('heading', { name: 'Administration', exact: true })
    .waitFor();
  await slow.evaluate(() => globalThis.__supportRelease());
  await slow.waitForFunction(() => globalThis.__supportDestroyed === 1);
  assert.equal(await slow.locator('ps-support').count(), 0);
  assert.equal(await slow.locator('link[data-ps-remote-style]').count(), 1);
  assert.deepEqual(errs, []);
  passed(
    'Real late-created Angular ApplicationRef is destroyed exactly once after navigation cancellation.',
  );
  await delayed.close();
}
