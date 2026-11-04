import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { json, ownedManifest, projectRoot, sha256 } from './common.mjs';
import { prepareRelease } from './prepare.mjs';
import { makePlan, validateTarget } from './plan.mjs';
import { startPreview } from './preview.mjs';
import {
  backendTemplate,
  edgeTemplate,
  storageTemplate,
} from './templates.mjs';

async function port() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, 'localhost', resolve);
  });
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}

const run = 'test-' + Date.now().toString(36);
let local;
let cloud;
let remote;
const target = () => ({
  project: 'platypus-service',
  accountId: '111122223333',
  region: 'eu-north-1',
  profile: 'offline-test',
  stackPrefix: 'platypus-test',
  concurrency: {
    mode: 'account-cap-five',
    accountLimit: 5,
    unreserved: 5,
    reviewedAt: new Date().toISOString(),
    acceptedSharedAccountCap: true,
  },
  ownershipVerified: true,
  resources: {
    bucket: 'platypus-test-artifacts',
    bucketDomain: 'platypus-test-artifacts.s3.eu-north-1.amazonaws.com',
    functionArn:
      'arn:aws:lambda:eu-north-1:111122223333:function:platypus-test-api',
    aliasArn:
      'arn:aws:lambda:eu-north-1:111122223333:function:platypus-test-api:live',
    distributionId: 'E123456789ABC',
    functionUrl: 'https://offlineexample.lambda-url.eu-north-1.on.aws/',
    origin: 'https://dofflineexample.cloudfront.net',
  },
});
const manifestPath = (release) => path.join(release.directory, 'manifest.json');

test('prepare real immutable frontend graphs and a reproducible, extracted standard ZIP', async () => {
  const localOrigin = 'http://localhost:' + (await port());
  const sourceConfig = await readFile(
    path.join(projectRoot, 'apps/support/public/ticket-api-config.json'),
  );
  local = await prepareRelease({
    release: run + '-local',
    deploymentOrigin: localOrigin,
  });
  cloud = await prepareRelease({
    release: run + '-cloud',
    deploymentOrigin: target().resources.origin,
  });
  assert.equal(
    local.value.backend.sha256,
    cloud.value.backend.sha256,
    'Backend ZIP bytes must be reproducible.',
  );
  assert.deepEqual(
    await readFile(
      path.join(projectRoot, 'apps/support/public/ticket-api-config.json'),
    ),
    sourceConfig,
  );
  assert.equal(
    local.value.objects.filter((item) => item.key.endsWith('/remoteEntry.json'))
      .length,
    3,
  );
  assert.ok(
    local.value.objects.every(
      (item) =>
        !item.key.includes('.nf-cache') && !item.key.includes('node_modules'),
    ),
  );
  assert.ok(
    !local.value.objects.some((item) => /^mfe\/.*\.html$/.test(item.key)),
  );
  await ownedManifest(manifestPath(local));
  await assert.rejects(
    prepareRelease({
      release: local.value.release,
      deploymentOrigin: localOrigin,
    }),
    /exist/,
  );
  const module = await import(
    new URL(
      'file:///' +
        path
          .join(local.directory, 'lambda-extracted/lambda.js')
          .replaceAll('\\', '/'),
    ).href
  );
  const original = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = localOrigin;
  try {
    const response = await module.handler({
      version: '2.0',
      rawPath: '/api/tickets',
      requestContext: { http: { method: 'GET' } },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).total, 25);
  } finally {
    if (original === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = original;
  }
});

test('offline defaults and target gates reject execution and the unavailable reserved-two mode', async () => {
  const initial = await makePlan({});
  assert.equal(initial.offline, true);
  assert.equal(initial.executionAuthorized, false);
  assert.equal(initial.steps.length, 0);
  const reserved = target();
  reserved.concurrency.mode = 'reserved-two';
  assert.throws(() => validateTarget(reserved), /unreserved buffer/);
  const unresolved = target();
  unresolved.concurrency.mode = 'unresolved';
  assert.throws(() => validateTarget(unresolved), /unresolved/);
  const unaccepted = target();
  unaccepted.concurrency.acceptedSharedAccountCap = false;
  assert.throws(() => validateTarget(unaccepted), /explicit acceptance/);
  const foreign = target();
  foreign.project = 'another-project';
  assert.throws(() => validateTarget(foreign), /reviewed Platypus/);
  const stale = target();
  stale.concurrency.reviewedAt = '2020-01-01T00:00:00.000Z';
  assert.throws(() => validateTarget(stale), /Refresh/);
  const result = spawnSync(
    process.execPath,
    ['scripts/aws/plan.mjs', '--execute', 'true'],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported/);
});

test('bootstrap phases avoid hostname cycles and update versions from code plus exact origin', async () => {
  const plan = await makePlan({
    action: 'bootstrap',
    target: target(),
    manifest: manifestPath(cloud),
  });
  const creates = plan.steps.filter((item) => item.operation === 'CreateStack');
  assert.deepEqual(
    creates.map((item) => item.input.StackName),
    ['platypus-test-storage', 'platypus-test-backend', 'platypus-test-edge'],
  );
  const backend = creates[1].input.Parameters;
  assert.equal(
    backend.find((item) => item.ParameterKey === 'AllowedOrigin')
      .ParameterValue,
    'https://bootstrap.invalid',
  );
  assert.equal(
    creates[2].input.Parameters.find((item) => item.ParameterKey === 'Enabled')
      .ParameterValue,
    'false',
  );
  const publish = await makePlan({
    action: 'publish',
    target: target(),
    manifest: manifestPath(cloud),
  });
  const updatedBackend = publish.steps.find(
    (item) =>
      item.operation === 'UpdateStack' &&
      item.input.StackName.endsWith('-backend'),
  );
  assert.notEqual(
    backend.find((item) => item.ParameterKey === 'BackendRevision')
      .ParameterValue,
    updatedBackend.input.Parameters.find(
      (item) => item.ParameterKey === 'BackendRevision',
    ).ParameterValue,
  );
  const uploads = publish.steps.filter(
    (item) => item.operation === 'PutObject',
  );
  assert.deepEqual(
    uploads.slice(-2).map((item) => item.input.Key),
    ['runtime-config.json', 'index.html'],
  );
  const pointer = uploads.at(-2);
  assert.equal(pointer.input.IfNoneMatch, '*');
  const version = backendTemplate().Resources.Version;
  assert.equal(version.UpdateReplacePolicy, 'Retain');
  assert.match(
    version.Properties.Description['Fn::Sub'],
    /\$\{BackendRevision\}/,
  );
  assert.match(
    backendTemplate().Resources.Function.Properties.Description['Fn::Sub'],
    /\$\{BackendRevision\}/,
  );
});

test('remote publication and rollback preserve other pointers and condition the pointer replacement', async () => {
  remote = await prepareRelease({
    release: run + '-remote',
    deploymentOrigin: cloud.value.origin,
    remote: 'analytics',
    previous: manifestPath(cloud),
  });
  for (const app of ['shell', 'support', 'administration'])
    assert.deepEqual(remote.value.apps[app], cloud.value.apps[app]);
  assert.deepEqual(
    remote.value.references.support,
    cloud.value.references.support,
  );
  const plan = await makePlan({
    action: 'remote',
    target: target(),
    manifest: manifestPath(remote),
    previous: manifestPath(cloud),
    remote: 'analytics',
  });
  assert.ok(
    plan.steps
      .filter((item) => item.operation === 'PutObject')
      .every(
        (item) =>
          item.input.Key.startsWith('mfe/analytics/') ||
          item.input.Key.startsWith('_releases/') ||
          item.input.Key === 'runtime-config.json',
      ),
  );
  assert.deepEqual(
    plan.steps.find(
      (item) =>
        item.operation === 'PutObject' &&
        item.input.Key === 'runtime-config.json',
    ).input.IfMatch,
    { $result: 'pointer', output: 'ETag' },
  );
  const rollback = await makePlan({
    action: 'rollback-remote',
    target: target(),
    manifest: manifestPath(cloud),
    previous: manifestPath(remote),
    remote: 'analytics',
  });
  const body = JSON.parse(
    rollback.steps.find((item) => item.operation === 'PutObject').input.Body,
  );
  assert.equal(
    rollback.steps.filter((item) => item.operation === 'HeadObject').length,
    cloud.value.apps.analytics.objects.length,
  );
  assert.ok(
    rollback.steps
      .filter((item) => item.operation === 'HeadObject')
      .every(
        (item) =>
          item.input.ChecksumMode === 'ENABLED' && item.assert.ChecksumSHA256,
      ),
  );
  assert.deepEqual(body.remotes.analytics, cloud.value.references.analytics);
  assert.deepEqual(body.remotes.support, remote.value.references.support);
  const backend = await makePlan({
    action: 'rollback-backend',
    target: target(),
    version: '1',
  });
  const update = backend.steps.find(
    (item) => item.operation === 'UpdateStack',
  ).input;
  assert.equal(update.UsePreviousTemplate, true);
  assert.equal(
    update.Parameters.find((item) => item.ParameterKey === 'BackendRevision')
      .UsePreviousValue,
    true,
  );
  assert.equal(
    update.Parameters.find((item) => item.ParameterKey === 'RollbackVersion')
      .ParameterValue,
    '1',
  );
  await assert.rejects(
    makePlan({ action: 'destroy', target: target() }),
    /confirm-destroy/,
  );
  const destroy = await makePlan({
    action: 'destroy',
    target: target(),
    confirmDestroy: 'platypus-test',
  });
  assert.ok(
    destroy.steps.findIndex(
      (item) =>
        item.operation === 'DeleteStack' &&
        item.input.StackName.endsWith('-edge'),
    ) <
      destroy.steps.findIndex(
        (item) =>
          item.operation === 'DeleteStack' &&
          item.input.StackName.endsWith('-backend'),
      ),
  );
  assert.equal(
    destroy.steps.filter((item) => item.operation === 'DeleteBucket').length,
    1,
  );
});

test('template policies keep both origins private, zero-TTL controls, exact routes and private backups', () => {
  const storage = storageTemplate();
  assert.equal(storage.Resources.Artifacts.DeletionPolicy, 'Retain');
  assert.equal(
    storage.Resources.Artifacts.Properties.VersioningConfiguration,
    undefined,
  );
  const statement = JSON.stringify(
    storage.Resources.ArtifactsPolicy.Properties.PolicyDocument,
  );
  assert.ok(
    !statement.includes('/_deploy/') && !statement.includes('/_releases/'),
  );
  const edge = edgeTemplate();
  assert.equal(
    edge.Resources.InvokeUrl.Properties.Action,
    'lambda:InvokeFunctionUrl',
  );
  assert.equal(
    edge.Resources.InvokeFunction.Properties.InvokedViaFunctionUrl,
    true,
  );
  assert.equal(edge.Resources.NoCache.Properties.CachePolicyConfig.MaxTTL, 0);
  assert.equal(
    edge.Resources.StaticCache.Properties.CachePolicyConfig.MinTTL,
    0,
  );
  assert.ok(
    edge.Resources.Distribution.Properties.DistributionConfig.CustomErrorResponses.every(
      (item) => !item.ResponsePagePath && !item.ResponseCode,
    ),
  );
  const backend = backendTemplate();
  assert.equal(backend.Resources.FunctionUrl.Properties.Qualifier, 'live');
  assert.equal(backend.Parameters.ConcurrencyMode.Default, undefined);
  for (const template of [storage, backend, edge]) {
    assert.ok(Buffer.byteLength(json(template)) < 51200);
    for (const value of Object.values(template.Resources))
      assert.ok(value.Metadata['com.aws.cloudformation.Context'].why);
  }
});

test('real packaged HTTP and Edge browser load federation paths, recover API failure, and reject private/missing assets', async () => {
  const preview = await startPreview({ manifest: manifestPath(local) });
  let browser;
  try {
    const api = await fetch(preview.origin + '/api/tickets');
    assert.equal(api.headers.get('cache-control'), 'no-store');
    assert.equal((await api.json()).total, 25);
    for (const key of [
      '/mfe/analytics/missing/remoteEntry.json',
      '/missing.js',
      '/_deploy/backend/example.zip',
    ]) {
      const response = await fetch(preview.origin + key);
      assert.equal(response.status, 404);
      assert.match(response.headers.get('content-type'), /text\/plain/);
    }
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
        /* Next installed executable. */
      }
    }
    assert.ok(
      executablePath,
      'An installed Chromium browser is required; no download is attempted.',
    );
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    const errors = [];
    const modules = new Set();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.ok() && response.url().includes('/mfe/'))
        modules.add(response.url());
    });
    for (const [route, heading] of [
      ['/analytics', 'Analytics'],
      ['/administration', 'Administration'],
      ['/support/tickets', 'Tickets'],
    ]) {
      await page.goto(preview.origin + route);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      if (heading === 'Tickets')
        await page.waitForFunction(
          () => globalThis.document.querySelectorAll('tbody tr').length === 25,
        );
    }
    for (const app of ['analytics', 'administration', 'support'])
      assert.ok(
        [...modules].some(
          (url) =>
            url.includes('/mfe/' + app + '/') &&
            url.endsWith('remoteEntry.json'),
        ),
      );
    await page.route('**/api/tickets', (route) =>
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
    await page.unroute('**/api/tickets');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.waitForFunction(
      () => globalThis.document.querySelectorAll('tbody tr').length === 25,
    );
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: path.join(local.directory, 'packaged-tickets.png'),
      fullPage: true,
    });
  } finally {
    await browser?.close();
    await preview.stop();
  }
});

test('manifest integrity rejects rewritten keys and changed extracted handler bytes', async () => {
  const filename = manifestPath(remote);
  const original = await readFile(filename, 'utf8');
  const changed = JSON.parse(original);
  changed.objects[0].key = 'mfe//analytics/file.js';
  try {
    await writeFile(filename, json(changed));
    await assert.rejects(ownedManifest(filename), /Unsafe object key/);
  } finally {
    await writeFile(filename, original);
  }
  const handler = path.join(local.directory, 'lambda-extracted/lambda.js');
  const bytes = await readFile(handler);
  try {
    await writeFile(
      handler,
      Buffer.concat([bytes, Buffer.from('\n// changed\n')]),
    );
    await assert.rejects(ownedManifest(manifestPath(local)), /handler hash/);
  } finally {
    await writeFile(handler, bytes);
  }
  assert.equal(
    sha256(await readFile(handler)),
    local.value.backend.files['lambda.js'],
  );
});
