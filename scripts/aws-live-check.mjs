import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  assert.ok(
    ['--origin', '--bucket-origin', '--function-url', '--timeout-ms'].includes(
      key,
    ),
    'Unsupported argument.',
  );
  assert.ok(process.argv[index + 1], 'Argument value is missing.');
  assert.equal(options[key], undefined, 'Duplicate argument.');
  options[key] = process.argv[index + 1];
}

function httpsOrigin(value, hostnamePattern) {
  const url = new URL(value);
  assert.ok(
    url.protocol === 'https:' && hostnamePattern.test(url.hostname),
    'Use the reviewed production HTTPS hostname.',
  );
  assert.ok(
    !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      url.pathname === '/',
    'Use an HTTPS origin without credentials, port, path, or query.',
  );
  return url.origin;
}

async function run() {
  if (!options['--origin']) {
    console.log(
      'No --origin supplied; no network requests made. Supply --origin and --bucket-origin to run the read-only cloud check.',
    );
    return;
  }
  const origin = httpsOrigin(
    options['--origin'],
    /^d[a-z0-9]+\.cloudfront\.net$/,
  );
  assert.ok(
    options['--bucket-origin'],
    '--bucket-origin is required to verify private storage.',
  );
  const bucketOrigin = httpsOrigin(
    options['--bucket-origin'],
    /^[a-z0-9][a-z0-9.-]+\.s3\.eu-north-1\.amazonaws\.com$/,
  );
  const functionOrigin = options['--function-url']
    ? httpsOrigin(
        options['--function-url'],
        /^[a-z0-9]+\.lambda-url\.eu-north-1\.on\.aws$/,
      )
    : undefined;
  const timeout = Number(options['--timeout-ms'] ?? 90000);
  assert.ok(
    Number.isSafeInteger(timeout) && timeout >= 1000 && timeout <= 600000,
    'Timeout must be between 1000 and 600000 milliseconds.',
  );
  const evidenceDirectory = path.join(projectRoot, '.local/evidence');
  await mkdir(evidenceDirectory, { recursive: true });
  const evidence = {
    origin,
    bucketOrigin,
    functionOrigin,
    startedAt: new Date().toISOString(),
    checks: [],
    http: [],
    requests: [],
    unexpectedRequests: [],
    pageErrors: [],
    consoleErrors: [],
    expectedFailureRequests: [],
  };
  let browser;
  let failure;
  const passed = (description) => {
    evidence.checks.push(description);
    console.log('PASS ' + description);
  };
  async function request(url, init = {}) {
    const response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(Math.min(timeout, 30000)),
    });
    evidence.http.push({
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      cacheControl: response.headers.get('cache-control'),
    });
    return response;
  }
  function noStore(response) {
    assert.match(
      response.headers.get('cache-control') ?? '',
      /(?:^|,)\s*no-store(?:,|$)/i,
      'Expected no-store for ' + response.url,
    );
  }
  try {
    const readyDeadline = Date.now() + timeout;
    let health;
    while (Date.now() < readyDeadline) {
      try {
        health = await request(origin + '/api/health');
        if (health.status === 200) break;
      } catch {
        /* Edge deployment may still be becoming reachable. */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(
      health?.status,
      200,
      'Cloud API did not become ready within timeout.',
    );
    assert.deepEqual(await health.json(), { status: 'ok' });
    noStore(health);
    const ticketsResponse = await request(origin + '/api/tickets');
    assert.equal(ticketsResponse.status, 200);
    noStore(ticketsResponse);
    const tickets = await ticketsResponse.json();
    const fixtures = JSON.parse(
      await readFile(
        path.join(projectRoot, 'apps/server/src/fixtures/tickets.json'),
        'utf8',
      ),
    );
    assert.equal(tickets.total, 25);
    assert.equal(tickets.items.length, 25);
    assert.deepEqual(
      tickets.items,
      fixtures,
      'Cloud tickets must preserve all fixture IDs and fields.',
    );
    passed(
      'HTTPS health and ticket API return no-store responses and all 25 exact fictional fixtures.',
    );

    const configResponse = await request(origin + '/runtime-config.json');
    assert.equal(configResponse.status, 200);
    noStore(configResponse);
    const config = await configResponse.json();
    for (const app of ['analytics', 'administration', 'support']) {
      const remote = config.remotes[app];
      const metadataUrl = new URL(remote.remoteEntryUrl);
      assert.equal(metadataUrl.origin, origin);
      assert.ok(metadataUrl.pathname.startsWith('/mfe/' + app + '/'));
      const metadata = await request(metadataUrl.href);
      assert.equal(metadata.status, 200);
      noStore(metadata);
      assert.equal((await metadata.json()).name, app);
      assert.ok(remote.cssUrls.length > 0);
      for (const stylesheet of remote.cssUrls) {
        assert.equal(new URL(stylesheet).origin, origin);
        const asset = await request(stylesheet);
        assert.equal(asset.status, 200);
        assert.match(
          asset.headers.get('cache-control') ?? '',
          /max-age=31536000/,
        );
        assert.match(asset.headers.get('cache-control') ?? '', /immutable/);
      }
    }
    passed(
      'Runtime and generated federation metadata use same-origin no-store URLs; remote assets are immutable.',
    );

    for (const pathname of [
      '/missing-aws-check.js',
      '/mfe/analytics/missing/remoteEntry.json',
      '/_deploy/backend/example.zip',
      '/_releases/example/runtime-config.json',
    ]) {
      const response = await request(origin + pathname);
      assert.ok(
        [403, 404].includes(response.status),
        'Missing/private path must fail: ' + pathname,
      );
      assert.doesNotMatch(
        response.headers.get('content-type') ?? '',
        /text\/html/i,
      );
      assert.doesNotMatch(await response.text(), /<!doctype html|<html[\s>]/i);
    }
    assert.equal((await request(bucketOrigin + '/index.html')).status, 403);
    if (functionOrigin)
      assert.equal((await request(functionOrigin + '/api/health')).status, 403);
    const badOrigin = await request(origin + '/api/tickets', {
      headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(badOrigin.status, 403);
    noStore(badOrigin);
    passed(
      'Missing/private paths keep real non-HTML errors; anonymous S3, optional Function URL and untrusted API Origin are denied.',
    );

    let executablePath;
    for (const candidate of [
      process.env.PLATYPUS_BROWSER,
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ].filter(Boolean)) {
      try {
        await access(candidate);
        executablePath = candidate;
        break;
      } catch {
        /* Try next installed browser; never download. */
      }
    }
    assert.ok(
      executablePath,
      'Set PLATYPUS_BROWSER to an installed Chromium executable.',
    );
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      serviceWorkers: 'block',
    });
    context.setDefaultTimeout(timeout);
    context.setDefaultNavigationTimeout(timeout);
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
        evidence.unexpectedRequests.push(url.href);
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    const page = await context.newPage();
    let controlledFailure = false;
    const remoteRequests = new Set();
    page.on('request', (request) => {
      evidence.requests.push(request.url());
    });
    page.on('response', (response) => {
      if (response.ok() && response.url().endsWith('/remoteEntry.json'))
        remoteRequests.add(response.url());
      if (!response.ok())
        (controlledFailure
          ? evidence.expectedFailureRequests
          : evidence.consoleErrors
        ).push(response.status() + ' ' + response.url());
    });
    page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !controlledFailure)
        evidence.consoleErrors.push(message.text());
    });
    const headings = [
      ['/analytics', 'Analytics'],
      ['/administration', 'Administration'],
      ['/support/tickets', 'Tickets'],
    ];
    async function rows() {
      await page.waitForFunction(
        () => globalThis.document.querySelectorAll('tbody tr').length === 25,
      );
    }
    async function view(name) {
      await page.getByRole('heading', { name, exact: true }).waitFor();
      if (name === 'Tickets') await rows();
    }
    for (const [pathname, heading] of headings) {
      await page.goto(origin + pathname);
      await view(heading);
      await page.reload();
      await view(heading);
    }
    for (const app of ['analytics', 'administration', 'support'])
      assert.ok(
        [...remoteRequests].some((url) =>
          new URL(url).pathname.startsWith('/mfe/' + app + '/'),
        ),
        'Expected generated remoteEntry request: ' + app,
      );
    assert.match(await page.locator('tbody tr').first().innerText(), /PS-1001/);
    assert.match(await page.locator('tbody tr').last().innerText(), /PS-1025/);
    for (let index = 0; index < 2; index++) {
      for (const [, heading] of headings) {
        await page.getByRole('link', { name: heading, exact: true }).click();
        await view(heading);
        assert.equal(
          await page
            .locator('.ps-analytics, .ps-administration, .ps-support')
            .count(),
          1,
          'Only the active remote may remain mounted.',
        );
      }
    }
    assert.deepEqual(evidence.pageErrors, []);
    assert.deepEqual(evidence.consoleErrors, []);
    assert.deepEqual(evidence.unexpectedRequests, []);
    await page.screenshot({
      path: path.join(evidenceDirectory, 'aws-live-desktop.png'),
      fullPage: true,
    });
    passed(
      'Three direct routes refresh correctly, all generated remotes load, 25 rows render and repeated navigation cleans previous roots.',
    );

    controlledFailure = true;
    await page.route(origin + '/api/tickets', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    await page.reload();
    await page
      .getByRole('heading', { name: 'Tickets are unavailable', exact: true })
      .waitFor();
    await page.unroute(origin + '/api/tickets');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await rows();
    controlledFailure = false;
    passed(
      'A browser-only API503 leaves a controlled error and Retry restores all 25 cloud tickets.',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await rows();
    const layout = await page.evaluate(() => {
      const table = globalThis.document.querySelector(
        '[role="region"][aria-label="Ticket table, scroll horizontally for all columns"]',
      );
      return {
        pageWidth: globalThis.document.documentElement.scrollWidth,
        viewport: globalThis.innerWidth,
        tableWidth: table?.clientWidth,
        tableScrollWidth: table?.scrollWidth,
      };
    });
    assert.ok(
      layout.pageWidth <= layout.viewport,
      'Mobile page must not overflow horizontally.',
    );
    assert.ok(
      layout.tableWidth > 0 && layout.tableScrollWidth >= layout.tableWidth,
      'Ticket table must retain its own scroll container.',
    );
    evidence.mobileLayout = layout;
    assert.deepEqual(evidence.pageErrors, []);
    assert.deepEqual(evidence.unexpectedRequests, []);
    await page.screenshot({
      path: path.join(evidenceDirectory, 'aws-live-mobile.png'),
      fullPage: true,
    });
    passed(
      'Mobile layout keeps page width within viewport while preserving the ticket table; no localhost or other-origin requests.',
    );
  } catch (error) {
    failure = error;
    evidence.failure = error.message;
  } finally {
    await browser?.close();
    evidence.finishedAt = new Date().toISOString();
    evidence.success = !failure;
    evidence.requests = [...new Set(evidence.requests)];
    await writeFile(
      path.join(evidenceDirectory, 'aws-live-check.json'),
      JSON.stringify(evidence, null, 2) + '\n',
    );
  }
  if (failure) throw failure;
  console.log(
    JSON.stringify({
      origin,
      checks: evidence.checks.length,
      evidenceDirectory,
    }),
  );
}

run().catch((error) => {
  console.error('Cloud check failed: ' + error.message);
  process.exitCode = 1;
});
