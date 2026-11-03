import assert from 'node:assert/strict';
import { access, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { projectRoot } from './serve-local.mjs';

const candidates = [
  process.env.PLATYPUS_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean);
let executablePath;
for (const candidate of candidates) {
  try {
    await access(candidate);
    executablePath = candidate;
    break;
  } catch {
    /* Try the next browser executable candidate. */
  }
}
if (!executablePath)
  throw new Error('Set PLATYPUS_BROWSER to a Chromium executable path.');
const browser = await chromium.launch({ executablePath, headless: true });
const evidenceDirectory = path.join(projectRoot, '.local/evidence');
await mkdir(evidenceDirectory, { recursive: true });
const report = [];
function passed(description) {
  report.push(description);
  console.log('PASS ' + description);
}
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
const errors = [];
const standalone = process.argv.includes('--standalone');
const page = await context.newPage();
const federationRequests = new Set();
page.on('response', (response) => {
  if (response.ok()) federationRequests.add(response.url());
});
const administrationEntryUrl = 'http://localhost:4302/remoteEntry.json';
const administrationEntry = await (
  await context.request.get(administrationEntryUrl)
).json();
const administrationModuleUrl = new URL(
  administrationEntry.exposes.find((entry) => entry.key === './mount')
    .outFileName,
  administrationEntryUrl,
).href;
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
async function heading(name) {
  await page.getByRole('heading', { name, exact: true }).waitFor();
}
async function checkTheme() {
  const styles = await page
    .locator('[data-workspace-card]')
    .evaluate((card) => {
      const section = card.closest('section');
      const title = section.querySelector('h1');
      const icon = card.querySelector('svg');
      return {
        cardBackground: globalThis.getComputedStyle(card).backgroundColor,
        radius: globalThis.getComputedStyle(card).borderRadius,
        padding: globalThis.getComputedStyle(card).paddingTop,
        border: globalThis.getComputedStyle(card).borderTopWidth,
        titleColor: globalThis.getComputedStyle(title).color,
        titleWeight: globalThis.getComputedStyle(title).fontWeight,
        iconWidth: globalThis.getComputedStyle(icon).width,
        titleRow: globalThis.getComputedStyle(title.parentElement).display,
        family: globalThis.getComputedStyle(section).fontFamily,
      };
    });
  assert.deepEqual(styles, {
    cardBackground: 'rgb(255, 255, 255)',
    radius: '16px',
    padding: '52px',
    border: '1px',
    titleColor: 'rgb(36, 41, 65)',
    titleWeight: '650',
    iconWidth: '42px',
    titleRow: 'flex',
    family: '"Segoe UI", Inter, Arial, sans-serif',
  });
}
async function checkStyles() {
  assert.equal(await page.locator('link[data-ps-remote-style]').count(), 1);
  await checkTheme();
  const shell = await page.locator('.workspace').evaluate((workspace) => ({
    display: globalThis.getComputedStyle(workspace).display,
    sidebar: globalThis.getComputedStyle(workspace.querySelector('aside'))
      .backgroundColor,
    headingColor: globalThis.getComputedStyle(workspace.querySelector('header'))
      .color,
    columns: globalThis.getComputedStyle(workspace).gridTemplateColumns,
  }));
  assert.equal(shell.display, 'grid');
  assert.equal(shell.sidebar, 'rgb(23, 27, 52)');
  assert.equal(shell.headingColor, 'rgb(105, 113, 137)');
  assert(shell.columns.startsWith('250px '));
}
try {
  for (const [app, prefix] of [
    ['analytics', 'an'],
    ['administration', 'ad'],
  ]) {
    const css = await readFile(
      path.join(projectRoot, 'apps', app, 'dist/remote/style.css'),
      'utf8',
    );
    assert(css.includes('.' + prefix + '\\:flex'));
    assert(css.includes('--' + prefix + '-color-ink'));
    assert(!css.includes('box-sizing:border-box'));
    assert(!css.includes('font-family:inherit'));
  }
  const shellFiles = await readdir(
    path.join(projectRoot, 'apps/shell/dist/browser'),
  );
  const shellCss = await readFile(
    path.join(
      projectRoot,
      'apps/shell/dist/browser',
      shellFiles.find((file) => /^styles-.*\.css$/.test(file)),
    ),
    'utf8',
  );
  assert(shellCss.includes('.sh\\:grid'));
  assert(shellCss.includes('box-sizing:border-box'));
  passed(
    'Independent CSS outputs include used prefixed utilities; only Shell includes Preflight.',
  );
  if (standalone) {
    await page.goto('http://localhost:5173/');
    await heading('Analytics');
    await checkTheme();
    await page.goto('http://localhost:5174/');
    await heading('Administration');
    await checkTheme();
    passed(
      'React and Vue standalone pages render headings and independent shared-theme card styles.',
    );
  }
  await page.goto('http://localhost:4200/');
  await heading('Analytics');
  assert.equal(new URL(page.url()).pathname, '/analytics');
  await checkStyles();
  passed('Root redirects to React Analytics; exactly one remote stylesheet.');
  await page.screenshot({
    path: path.join(evidenceDirectory, 'analytics.png'),
    fullPage: true,
  });
  for (let iteration = 0; iteration < 4; iteration++) {
    await page
      .getByRole('link', { name: 'Administration', exact: true })
      .click();
    await heading('Administration');
    assert.equal(await page.locator('.ps-analytics').count(), 0);
    await checkStyles();
    await page.getByRole('link', { name: 'Analytics', exact: true }).click();
    await heading('Analytics');
    assert.equal(await page.locator('.ps-administration').count(), 0);
    await checkStyles();
  }
  passed('Repeated React/Vue navigation cleans previous roots and styles.');
  for (const [port, name] of [
    [4301, 'analytics'],
    [4302, 'administration'],
  ]) {
    const entryUrl = 'http://localhost:' + port + '/remoteEntry.json';
    const entry = await (await context.request.get(entryUrl)).json();
    assert.equal(entry.name, name);
    assert.equal(entry.$version, 'v4');
    const exposedUrl = new URL(
      entry.exposes.find((exposed) => exposed.key === './mount').outFileName,
      entryUrl,
    ).href;
    assert(
      federationRequests.has(entryUrl),
      'Browser requested Native Federation metadata: ' + name,
    );
    assert(
      federationRequests.has(exposedUrl),
      'Browser requested generated exposed module: ' + name,
    );
    assert.equal(
      federationRequests.has('http://localhost:' + port + '/remote-entry.js'),
      false,
    );
  }
  const orchestratorVersion = await page.evaluate(
    () => globalThis.__NF_ORCHESTRATOR__.storage.__PLATYPUS_ANALYTICS__.version,
  );
  assert.equal(orchestratorVersion, '4.9.0');
  assert((await page.locator('script[type="importmap-shim"]').count()) > 0);
  passed(
    'Browser fetched real remoteEntry.json and generated exposes through official Native Federation orchestrator4.9.0.',
  );
  await page.goBack();
  await heading('Administration');
  await page.goForward();
  await heading('Analytics');
  passed(
    'Browser Back/Forward keeps Angular routing and remote content aligned.',
  );
  await page.goto('http://localhost:4200/administration');
  await heading('Administration');
  await page.reload();
  await heading('Administration');
  await page.screenshot({
    path: path.join(evidenceDirectory, 'administration.png'),
    fullPage: true,
  });
  passed('Direct Administration URL and document refresh mount Vue.');
  await page.goto('http://localhost:4200/missing-page');
  await heading('This page is not available.');
  assert.equal(await page.locator('link[data-ps-remote-style]').count(), 0);
  passed(
    'Unknown route shows Shell-owned not-found view with no remote styles.',
  );
  await page.goto('http://localhost:4200/analytics');
  await heading('Analytics');

  let moduleObserved;
  const moduleRequested = new Promise((resolve) => {
    moduleObserved = resolve;
  });
  let releaseModule;
  const moduleGate = new Promise((resolve) => {
    releaseModule = resolve;
  });
  await page.route(administrationModuleUrl, async (route) => {
    moduleObserved();
    await moduleGate;
    await route.continue();
  });
  await page.getByRole('link', { name: 'Administration', exact: true }).click();
  await moduleRequested;
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  await heading('Analytics');
  releaseModule();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.ps-administration').count(), 0);
  await checkStyles();
  await page.unroute(administrationModuleUrl);
  passed(
    'Observed late module request finishes without mounting a stale route.',
  );
  // Fresh document clears the module cache and deliberately holds stylesheet loading.
  await page.goto('http://localhost:4200/analytics');
  await heading('Analytics');
  let stylesheetObserved;
  const stylesheetRequested = new Promise((resolve) => {
    stylesheetObserved = resolve;
  });
  let releaseStylesheet;
  const stylesheetGate = new Promise((resolve) => {
    releaseStylesheet = resolve;
  });
  await page.route('http://localhost:4302/style.css', async (route) => {
    stylesheetObserved();
    await stylesheetGate;
    await route.continue().catch(() => {});
  });
  await page.getByRole('link', { name: 'Administration', exact: true }).click();
  await stylesheetRequested;
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  await heading('Analytics');
  releaseStylesheet();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.ps-administration').count(), 0);
  await checkStyles();
  await page.unroute('http://localhost:4302/style.css');
  passed(
    'Navigation during observed stylesheet loading releases stale style references.',
  );
  assert.deepEqual(errors, []);
  passed(
    'Shared-theme computed styles and Shell layout survive navigation; healthy integration has no browser errors.',
  );

  // Separate context: controlled failures must remain recoverable and isolated.
  const failureContext = await browser.newContext();
  const failure = await failureContext.newPage();
  const configResponse = await failure.request.get(
    'http://localhost:4200/runtime-config.json',
  );
  const config = await configResponse.json();
  let badVersion = true;
  await failure.route('**/runtime-config.json', (route) =>
    route.fulfill({
      json: badVersion ? { ...config, schemaVersion: 99 } : config,
    }),
  );
  await failure.goto('http://localhost:4200/analytics');
  await failure
    .getByRole('heading', { name: 'We could not open Analytics.', exact: true })
    .waitFor();
  assert.equal(await failure.locator('link[data-ps-remote-style]').count(), 0);
  badVersion = false;
  await failure.getByRole('button', { name: 'Retry', exact: true }).click();
  await failure
    .getByRole('heading', { name: 'Analytics', exact: true })
    .waitFor();
  passed(
    'Invalid config fails safely; Retry refetches fixed config and recovers.',
  );
  let blockStyles = true;
  await failure.route('http://localhost:4302/style.css', (route) =>
    blockStyles ? route.abort('failed') : route.continue(),
  );
  await failure
    .getByRole('link', { name: 'Administration', exact: true })
    .click();
  await failure
    .getByRole('heading', {
      name: 'We could not open Administration.',
      exact: true,
    })
    .waitFor();
  assert.equal(await failure.locator('link[data-ps-remote-style]').count(), 0);
  blockStyles = false;
  await failure.getByRole('button', { name: 'Retry', exact: true }).click();
  await failure
    .getByRole('heading', { name: 'Administration', exact: true })
    .waitFor();
  passed(
    'Missing stylesheet fails safely, releases styles and recovers with Retry.',
  );
  await failureContext.close();

  const contractContext = await browser.newContext();
  const contractPage = await contractContext.newPage();
  await contractPage.route(administrationModuleUrl, (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'export const contractVersion = 2; export function mount() {}',
    }),
  );
  await contractPage.goto('http://localhost:4200/administration');
  await contractPage
    .getByRole('heading', {
      name: 'We could not open Administration.',
      exact: true,
    })
    .waitFor();
  assert.equal(
    await contractPage.locator('link[data-ps-remote-style]').count(),
    0,
  );
  await contractPage.unroute(administrationModuleUrl);
  await contractPage
    .getByRole('button', { name: 'Reload page', exact: true })
    .click();
  await contractPage
    .getByRole('heading', { name: 'Administration', exact: true })
    .waitFor();
  passed(
    'Unsupported actual module contract fails safely and Reload recovers after correction.',
  );
  await contractContext.close();

  const metadataContext = await browser.newContext();
  const metadataPage = await metadataContext.newPage();
  let unavailableMetadata = true;
  let metadataAttempts = 0;
  await metadataPage.route(administrationEntryUrl, (route) => {
    metadataAttempts++;
    return unavailableMetadata
      ? route.abort('connectionrefused')
      : route.continue();
  });
  await metadataPage.goto('http://localhost:4200/administration');
  await metadataPage
    .getByRole('heading', {
      name: 'We could not open Administration.',
      exact: true,
    })
    .waitFor();
  assert.equal(
    await metadataPage.locator('link[data-ps-remote-style]').count(),
    0,
  );
  unavailableMetadata = false;
  await metadataPage
    .getByRole('button', { name: 'Retry', exact: true })
    .click();
  await metadataPage
    .getByRole('heading', { name: 'Administration', exact: true })
    .waitFor();
  assert(metadataAttempts >= 2);
  passed(
    'Failed remoteEntry metadata leaves no styles; Retry performs actual metadata refetch and recovers.',
  );
  await metadataContext.close();

  const slowContext = await browser.newContext();
  const slowPage = await slowContext.newPage();
  let metadataObserved;
  const metadataRequested = new Promise((resolve) => {
    metadataObserved = resolve;
  });
  let releaseMetadata;
  const metadataGate = new Promise((resolve) => {
    releaseMetadata = resolve;
  });
  let heldMetadata = true;
  await slowPage.route(administrationEntryUrl, async (route) => {
    if (!heldMetadata) return route.continue();
    metadataObserved();
    await metadataGate;
    heldMetadata = false;
    await route.abort('connectionrefused').catch(() => {});
  });
  await slowPage.goto('http://localhost:4200/administration');
  await metadataRequested;
  await slowPage.getByRole('link', { name: 'Analytics', exact: true }).click();
  await slowPage
    .getByRole('heading', { name: 'Analytics', exact: true })
    .waitFor();
  assert.equal(await slowPage.locator('.ps-administration').count(), 0);
  releaseMetadata();
  await slowPage.waitForTimeout(300);
  assert.equal(await slowPage.locator('.ps-administration').count(), 0);
  assert.equal(await slowPage.locator('link[data-ps-remote-style]').count(), 1);
  await slowPage.unroute(administrationEntryUrl);
  await slowPage
    .getByRole('link', { name: 'Administration', exact: true })
    .click();
  await slowPage
    .getByRole('heading', { name: 'Administration', exact: true })
    .waitFor();
  passed(
    'Held Administration metadata does not block fresh Analytics; late metadata failure leaves healthy route usable.',
  );
  await slowPage.getByRole('link', { name: 'Analytics', exact: true }).click();
  await slowPage
    .getByRole('heading', { name: 'Analytics', exact: true })
    .waitFor();
  assert.equal(await slowPage.locator('link[data-ps-remote-style]').count(), 1);
  await slowContext.close();

  const offlineContext = await browser.newContext();
  const offlinePage = await offlineContext.newPage();
  await offlinePage.route(administrationModuleUrl, (route) =>
    route.abort('connectionrefused'),
  );
  await offlinePage.goto('http://localhost:4200/administration');
  await offlinePage
    .getByRole('heading', {
      name: 'We could not open Administration.',
      exact: true,
    })
    .waitFor();
  await offlinePage
    .getByRole('link', { name: 'Analytics', exact: true })
    .click();
  await offlinePage
    .getByRole('heading', { name: 'Analytics', exact: true })
    .waitFor();
  await offlinePage.unroute(administrationModuleUrl);
  await offlinePage.goto('http://localhost:4200/administration');
  await offlinePage
    .getByRole('heading', { name: 'Administration', exact: true })
    .waitFor();
  passed(
    'Unavailable remote leaves Shell navigation usable; new document recovers.',
  );
  await offlineContext.close();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4200/analytics');
  await heading('Analytics');
  assert.equal(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: path.join(evidenceDirectory, 'mobile.png'),
    fullPage: true,
  });
  passed(
    'Mobile viewport preserves navigation and has no horizontal overflow.',
  );
} finally {
  await browser.close();
}
console.log(
  JSON.stringify(
    { browser: executablePath, assertions: report.length, evidenceDirectory },
    null,
    2,
  ),
);
