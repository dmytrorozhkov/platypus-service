import assert from 'node:assert/strict';
import {
  cp,
  lstat,
  mkdir,
  open,
  readFile,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { json, outputRoot, sha256 } from '../aws/common.mjs';
import {
  createDeliveryBundle,
  DELIVERY_BUNDLE_LIMIT,
  verifyDeliveryBundle,
} from './bundle.mjs';

const options = {
  sourceSha: 'a'.repeat(40),
  runId: String(Date.now()),
  runAttempt: '1',
  repository: 'dmytrorozhkov/platypus-service',
  origin: 'https://dofflineexample.cloudfront.net',
};
let bundle;
test.before(async () => {
  bundle = await createDeliveryBundle(options);
});

async function copy(name) {
  const directory = path.join(
    outputRoot,
    'releases',
    `bundle-check-${options.runId}-${name}`,
  );
  await cp(bundle.directory, directory, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  return directory;
}

async function reseal(directory) {
  const filename = path.join(directory, 'bundle-envelope.json');
  const envelope = JSON.parse(await readFile(filename, 'utf8'));
  for (const entry of envelope.inventory) {
    const body = await readFile(path.join(directory, entry.file));
    entry.bytes = body.length;
    entry.sha256 = sha256(body);
  }
  envelope.manifestSha256 = sha256(
    await readFile(path.join(directory, 'manifest.json')),
  );
  envelope.totalBytes = envelope.inventory.reduce(
    (sum, entry) => sum + entry.bytes,
    0,
  );
  await writeFile(filename, json(envelope));
}

test('a real full bundle binds exact checked context, ZIP and extracted files within the size limit', async () => {
  const verified = await verifyDeliveryBundle({
    ...options,
    directory: bundle.directory,
    expectedEnvelopeSha256: bundle.envelopeSha256,
  });
  assert.equal(
    verified.release,
    `gh-${options.runId}-1-${options.sourceSha.slice(0, 12)}`,
  );
  assert(verified.totalBytes < DELIVERY_BUNDLE_LIMIT);
  assert.equal(verified.manifest.scope, 'full');
  assert.deepEqual(Object.keys(verified.manifest.backend.files).sort(), [
    'fixtures/tickets.json',
    'lambda.js',
    'package.json',
    'ticket-application.js',
    'ticket-query.js',
    'ticket-repository.js',
  ]);
  for (const name of [
    'backend.zip',
    'manifest.json',
    'owner.json',
    'lambda-extracted/lambda.js',
  ])
    assert(verified.envelope.inventory.some((entry) => entry.file === name));
  assert(
    !verified.envelope.inventory.some(
      (entry) => entry.file === 'bundle-envelope.json',
    ),
  );
});

test('wrong SHA, run, attempt, repository, origin and build envelope hash are rejected', async () => {
  for (const change of [
    { sourceSha: 'b'.repeat(40) },
    { runId: '2' },
    { runAttempt: '2' },
    { repository: 'other/repository' },
    { origin: 'https://dother.cloudfront.net' },
    { expectedEnvelopeSha256: '0'.repeat(64) },
  ])
    await assert.rejects(
      verifyDeliveryBundle({
        ...options,
        directory: bundle.directory,
        ...change,
      }),
    );
  await assert.rejects(
    createDeliveryBundle({ ...options, sourceSha: 'refs/heads/main' }),
  );
  await assert.rejects(
    createDeliveryBundle({
      ...options,
      runId: '9'.repeat(20),
      runAttempt: '9'.repeat(20),
    }),
  );
  await assert.rejects(
    verifyDeliveryBundle({ ...options, directory: path.dirname(outputRoot) }),
  );
});

test('extra files, changed object bytes and forged inventory byte counts are rejected', async () => {
  const extra = await copy('extra');
  await writeFile(path.join(extra, 'unexpected.json'), '{}');
  await assert.rejects(
    verifyDeliveryBundle({ ...options, directory: extra }),
    /inventory differs/,
  );
  const changed = await copy('changed');
  await writeFile(
    path.join(changed, bundle.manifest.objects[0].file),
    'changed',
  );
  await assert.rejects(
    verifyDeliveryBundle({ ...options, directory: changed }),
    /inventory differs/,
  );
  const counts = await copy('counts');
  const envelopePath = path.join(counts, 'bundle-envelope.json');
  const envelope = JSON.parse(await readFile(envelopePath, 'utf8'));
  envelope.inventory[0].bytes++;
  await writeFile(envelopePath, json(envelope));
  await assert.rejects(
    verifyDeliveryBundle({ ...options, directory: counts }),
    /inventory differs/,
  );
});

test('self-consistent envelope edits cannot change full scope, backend archive or extracted-handler graph', async () => {
  const scope = await copy('scope');
  const manifestPath = path.join(scope, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.scope = 'analytics';
  await writeFile(manifestPath, json(manifest));
  await reseal(scope);
  await assert.rejects(
    verifyDeliveryBundle({ ...options, directory: scope }),
    /full release/,
  );
  const zip = await copy('zip');
  await writeFile(path.join(zip, 'backend.zip'), 'not the checked archive');
  await reseal(zip);
  await assert.rejects(
    verifyDeliveryBundle({ ...options, directory: zip }),
    /Archive copies differ/,
  );
  const extracted = await copy('extracted');
  await writeFile(
    path.join(extracted, 'lambda-extracted/lambda.js'),
    'export const handler = () => null;',
  );
  await reseal(extracted);
  await assert.rejects(
    verifyDeliveryBundle({ ...options, directory: extracted }),
    /Extracted handler hash mismatch/,
  );
});

test('hidden files, directory junctions and overlarge data fail before publication', async () => {
  const hidden = await copy('hidden');
  await writeFile(path.join(hidden, '.env'), 'fixture-only');
  await assert.rejects(
    verifyDeliveryBundle({ ...options, directory: hidden }),
    /Unsafe bundle filename/,
  );
  const linked = await copy('linked');
  const destination = path.join(
    outputRoot,
    'bundle-link-target-' + options.runId,
  );
  await mkdir(destination);
  await symlink(destination, path.join(linked, 'linked-directory'), 'junction');
  assert((await lstat(path.join(linked, 'linked-directory'))).isSymbolicLink());
  await assert.rejects(
    verifyDeliveryBundle({ ...options, directory: linked }),
    /links are forbidden/,
  );
  const large = await copy('large');
  const file = await open(path.join(large, 'large.bin'), 'wx');
  try {
    await file.truncate(DELIVERY_BUNDLE_LIMIT + 1);
  } finally {
    await file.close();
  }
  await assert.rejects(
    verifyDeliveryBundle({ ...options, directory: large }),
    /exceeds 32 MiB/,
  );
});
