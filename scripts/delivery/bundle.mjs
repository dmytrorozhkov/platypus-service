import assert from 'node:assert/strict';
import {
  appendFile,
  lstat,
  readFile,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  json,
  outputRoot,
  ownedManifest,
  project,
  projectRoot,
  releaseId,
  sha256,
  within,
} from '../aws/common.mjs';
import { prepareRelease } from '../aws/prepare.mjs';

export const DELIVERY_BUNDLE_LIMIT = 32 * 1024 * 1024;
const envelopeName = 'bundle-envelope.json';
const backendNames = [
  'fixtures/tickets.json',
  'lambda.js',
  'package.json',
  'ticket-application.js',
  'ticket-repository.js',
];
const contextKeys = [
  'repository',
  'sourceSha',
  'runId',
  'runAttempt',
  'origin',
];

function context(options) {
  assert.equal(
    options.repository,
    'dmytrorozhkov/platypus-service',
    'Unexpected delivery repository.',
  );
  assert.match(
    options.sourceSha ?? '',
    /^[a-f0-9]{40}$/,
    'An exact source SHA is required.',
  );
  for (const key of ['runId', 'runAttempt'])
    assert.match(
      options[key] ?? '',
      /^[1-9][0-9]{0,19}$/,
      'A bounded numeric run identity is required.',
    );
  assert.match(
    options.origin ?? '',
    /^https:\/\/d[a-z0-9]+\.cloudfront\.net$/,
    'A reviewed CloudFront origin is required.',
  );
  const release = releaseId(
    `gh-${options.runId}-${options.runAttempt}-${options.sourceSha.slice(0, 12)}`,
  );
  return {
    ...Object.fromEntries(contextKeys.map((key) => [key, options[key]])),
    release,
  };
}

async function inventory(directory) {
  const result = [];
  const names = new Set();
  let totalBytes = 0;
  async function visit(current, prefix = '') {
    assert(
      !(await lstat(current)).isSymbolicLink(),
      'Bundle links are forbidden.',
    );
    for (const entry of (await readdir(current, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      assert.match(
        entry.name,
        /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/,
        'Unsafe bundle filename.',
      );
      const file = prefix + entry.name;
      const filename = within(directory, path.join(current, entry.name));
      assert(
        !names.has(file.toLowerCase()),
        'Case-colliding bundle paths are forbidden.',
      );
      names.add(file.toLowerCase());
      assert(!entry.isSymbolicLink(), 'Bundle links are forbidden.');
      if (entry.isDirectory()) await visit(filename, file + '/');
      else {
        assert(entry.isFile(), 'Bundle entries must be ordinary files.');
        const info = await lstat(filename);
        assert(info.nlink === 1, 'Bundle hard links are forbidden.');
        totalBytes += info.size;
        assert(
          totalBytes <= DELIVERY_BUNDLE_LIMIT,
          'Delivery bundle exceeds 32 MiB.',
        );
        assert(result.length < 4096, 'Too many bundle files.');
        result.push({
          file,
          bytes: info.size,
          sha256: sha256(await readFile(filename)),
        });
      }
    }
  }
  await visit(directory);
  result.sort((a, b) => a.file.localeCompare(b.file));
  return { entries: result, totalBytes };
}

async function validateManifest(directory, expected) {
  const manifestPath = path.join(directory, 'manifest.json');
  const { value: manifest } = await ownedManifest(manifestPath);
  assert.equal(manifest.scope, 'full', 'Delivery requires a full release.');
  assert.equal(
    manifest.release,
    expected.release,
    'Bundle release identity differs.',
  );
  assert.equal(manifest.origin, expected.origin, 'Bundle origin differs.');
  assert.deepEqual(
    Object.keys(manifest.backend.files).sort(),
    backendNames,
    'Expected exactly the five reviewed backend files.',
  );
  const zip = manifest.objects.filter((item) => item.app === 'backend');
  assert.equal(zip.length, 1, 'Expected one backend ZIP.');
  assert.equal(zip[0].key, `_deploy/backend/${manifest.release}.zip`);
  assert.equal(manifest.backend.key, zip[0].key);
  assert.equal(manifest.backend.sha256, zip[0].sha256);
  assert.equal(
    manifest.backend.codeSha256,
    Buffer.from(zip[0].sha256, 'hex').toString('base64'),
  );
  assert.equal(
    sha256(await readFile(path.join(directory, 'backend.zip'))),
    zip[0].sha256,
    'Archive copies differ.',
  );
  for (const file of backendNames)
    assert.equal(
      sha256(await readFile(path.join(directory, 'lambda', file))),
      manifest.backend.files[file],
      'Prepared backend and extracted bytes differ.',
    );
  return { manifest, manifestPath };
}

export async function createDeliveryBundle(options) {
  const expected = context(options);
  const { directory } = await prepareRelease({
    release: expected.release,
    deploymentOrigin: expected.origin,
  });
  const { manifestPath } = await validateManifest(directory, expected);
  const files = await inventory(directory);
  const envelope = {
    schemaVersion: 1,
    project,
    ...expected,
    manifestSha256: sha256(await readFile(manifestPath)),
    inventory: files.entries,
    totalBytes: files.totalBytes,
  };
  const bytes = json(envelope);
  assert(
    Buffer.byteLength(bytes) + files.totalBytes <= DELIVERY_BUNDLE_LIMIT,
    'Delivery bundle exceeds 32 MiB.',
  );
  await writeFile(path.join(directory, envelopeName), bytes, { flag: 'wx' });
  return verifyDeliveryBundle({
    ...options,
    directory,
    expectedEnvelopeSha256: sha256(bytes),
  });
}

export async function verifyDeliveryBundle(options) {
  const expected = context(options);
  const directory = path.resolve(options.directory);
  within(path.join(outputRoot, 'releases'), directory);
  assert.equal(
    await realpath(directory),
    directory,
    'Bundle directory must not resolve through links.',
  );
  const files = await inventory(directory);
  const item = files.entries.find((entry) => entry.file === envelopeName);
  assert(
    item && item.bytes <= 1024 * 1024,
    'A bounded bundle envelope is required.',
  );
  const body = await readFile(path.join(directory, envelopeName));
  const envelopeSha256 = sha256(body);
  if (options.expectedEnvelopeSha256 !== undefined) {
    assert.match(
      options.expectedEnvelopeSha256,
      /^[a-f0-9]{64}$/,
      'Expected envelope hash is invalid.',
    );
    assert.equal(
      envelopeSha256,
      options.expectedEnvelopeSha256,
      'Bundle envelope hash differs from checked build output.',
    );
  }
  const envelope = JSON.parse(body.toString('utf8'));
  assert.deepEqual(
    Object.keys(envelope).sort(),
    [
      'schemaVersion',
      'project',
      ...contextKeys,
      'release',
      'manifestSha256',
      'inventory',
      'totalBytes',
    ].sort(),
    'Unexpected envelope fields.',
  );
  assert.equal(envelope.schemaVersion, 1, 'Unknown bundle schema.');
  assert.equal(envelope.project, project, 'Unexpected bundle project.');
  for (const key of [...contextKeys, 'release'])
    assert.equal(
      envelope[key],
      expected[key],
      `Bundle ${key} differs from the checked run.`,
    );
  const entries = files.entries.filter((entry) => entry.file !== envelopeName);
  assert.deepEqual(
    envelope.inventory,
    entries,
    'Bundle inventory differs: missing, extra or changed file.',
  );
  assert.equal(
    envelope.totalBytes,
    entries.reduce((sum, entry) => sum + entry.bytes, 0),
    'Bundle byte count differs.',
  );
  const { manifest, manifestPath } = await validateManifest(
    directory,
    expected,
  );
  assert.equal(
    envelope.manifestSha256,
    sha256(await readFile(manifestPath)),
    'Manifest hash differs.',
  );
  return {
    directory,
    release: expected.release,
    manifestPath,
    manifest,
    envelope,
    envelopeSha256,
    totalBytes: files.totalBytes,
  };
}

async function main() {
  const options = {
    sourceSha: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    repository: process.env.GITHUB_REPOSITORY,
    origin: process.env.DELIVERY_ORIGIN,
  };
  assert.equal(
    process.env.GITHUB_REF,
    'refs/heads/main',
    'Delivery packaging requires main.',
  );
  assert.equal(
    process.env.GITHUB_EVENT_NAME,
    'workflow_dispatch',
    'Delivery packaging requires a manual run.',
  );
  const action = process.argv[2];
  assert.equal(
    process.argv.length,
    3,
    'Use bundle.mjs create or verify with checked workflow environment.',
  );
  assert(['create', 'verify'].includes(action), 'Unknown bundle action.');
  const result =
    action === 'create'
      ? await createDeliveryBundle(options)
      : await verifyDeliveryBundle({
          ...options,
          directory: process.env.DELIVERY_BUNDLE_DIRECTORY,
          expectedEnvelopeSha256: process.env.DELIVERY_ENVELOPE_SHA256,
        });
  if (action === 'create' && process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `release=${result.release}\ndirectory=${path.relative(projectRoot, result.directory).replaceAll('\\', '/')}\nenvelope-sha256=${result.envelopeSha256}\n`,
    );
  console.log(
    `Verified delivery bundle ${result.release}: ${result.totalBytes} bytes.`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  main().catch(() => {
    console.error(
      'Delivery bundle validation failed; publication is not permitted.',
    );
    process.exitCode = 1;
  });
