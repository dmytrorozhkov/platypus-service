import assert from 'node:assert/strict';
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  cacheControl,
  contentType,
  files,
  flags,
  json,
  projectRoot,
  remotes,
  sha256,
  within,
} from '../aws/common.mjs';
import {
  NEON_CANDIDATE_LIMIT,
  prepareNeonCandidate,
  verifyNeonCandidate,
} from './package.mjs';
import { validateNeonRuntimeConfig } from './templates.mjs';

const kind = 'platypus-neon-release-candidate';
const manifestName = 'neon-release.json';
const safeName = (value) => {
  assert.match(
    value ?? '',
    /^[a-z0-9][a-z0-9-]{0,47}$/,
    'Bounded Neon release name required.',
  );
  return value;
};
const exactKeys = (value, keys, message) =>
  assert.deepEqual(Object.keys(value ?? {}).sort(), [...keys].sort(), message);
const safeKey = (value) => {
  assert(
    typeof value === 'string' &&
      value.length <= 512 &&
      /^[a-zA-Z0-9_][a-zA-Z0-9_./-]*$/.test(value) &&
      value === path.posix.normalize(value) &&
      value
        .split('/')
        .every(
          (part) =>
            part &&
            part !== '.' &&
            part !== '..' &&
            !part.endsWith('.') &&
            !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
        ),
    'Unsafe Neon release path.',
  );
  return value;
};
async function ordinary(filename, directory = false) {
  const info = await lstat(filename);
  assert(
    !info.isSymbolicLink() &&
      (directory ? info.isDirectory() : info.isFile() && info.nlink === 1),
    'Release paths must be ordinary unlinked entries.',
  );
  assert.equal(
    await realpath(filename),
    filename,
    'Release paths cannot resolve through links.',
  );
  return info;
}
async function parentDirectory(root, create) {
  root = path.resolve(root);
  await ordinary(root, true);
  const marker = path.join(root, 'package.json');
  assert(
    (await ordinary(marker)).size <= 1024 * 1024,
    'Bounded workspace marker required.',
  );
  assert.equal(
    JSON.parse(await readFile(marker, 'utf8')).name,
    '@platypus/workspace',
    'Expected Platypus workspace.',
  );
  let current = root;
  for (const part of ['.local', 'neon-aws', 'releases']) {
    current = within(root, path.join(current, part));
    if (create)
      await mkdir(current).catch((error) => {
        if (error.code !== 'EEXIST') throw error;
      });
    await ordinary(current, true);
  }
  return current;
}
async function inventory(directory) {
  const entries = [];
  const directories = [];
  const seen = new Set();
  let totalBytes = 0;
  async function visit(current, prefix = '') {
    await ordinary(current, true);
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const name = safeKey(prefix + entry.name);
      assert(!seen.has(name.toLowerCase()), 'Case-colliding release paths.');
      seen.add(name.toLowerCase());
      const filename = within(directory, path.join(current, entry.name));
      if (entry.isDirectory()) {
        directories.push(name);
        await visit(filename, name + '/');
      } else {
        const info = await ordinary(filename);
        totalBytes += info.size;
        assert(
          totalBytes <= NEON_CANDIDATE_LIMIT && entries.length < 4096,
          'Release exceeds 32 MiB/file-count limit.',
        );
        const bytes = await readFile(filename);
        assert.equal(
          bytes.length,
          info.size,
          'Release changed during inventory.',
        );
        entries.push({
          file: name,
          bytes: bytes.length,
          sha256: sha256(bytes),
        });
      }
    }
  }
  await visit(directory);
  assert(
    directories.every((name) =>
      entries.some((entry) => entry.file.startsWith(name + '/')),
    ),
    'Unexpected empty release directory.',
  );
  entries.sort((a, b) => a.file.localeCompare(b.file));
  return { entries, totalBytes };
}
function reference(origin, app, release) {
  const prefix = `${origin}/mfe/${app}/${release}/`;
  return {
    contractVersion: 1,
    exposedModule: './mount',
    remoteEntryUrl: prefix + 'remoteEntry.json',
    cssUrls: [prefix + (app === 'support' ? 'styles.css' : 'style.css')],
  };
}

export async function prepareNeonRelease({
  root = projectRoot,
  release,
  sourceSha,
  runtimeConfig,
}) {
  safeName(release);
  assert.match(sourceSha ?? '', /^[a-f0-9]{40}$/, 'Exact source SHA required.');
  assert(!/^0+$/.test(sourceSha), 'Placeholder source SHA rejected.');
  const config = validateNeonRuntimeConfig(runtimeConfig);
  const workspace = path.resolve(root);
  const parent = await parentDirectory(workspace, true);
  const directory = within(parent, path.join(parent, release));
  await mkdir(directory); // Reserve first. Every failed attempt remains owned and cannot be overwritten.
  await ordinary(directory, true);
  const backend = await prepareNeonCandidate({
    root: workspace,
    candidate: release,
    sourceSha,
    runtimeConfig: config,
  });
  await cp(backend.directory, path.join(directory, 'backend'), {
    recursive: true,
    force: false,
    errorOnExist: true,
  });
  const put = (name, body) =>
    writeFile(within(directory, path.join(directory, safeKey(name))), body, {
      flag: 'wx',
    });
  await put(
    'owner.json',
    json({ kind, project: 'platypus-service', release, sourceSha }),
  );
  const objects = [];
  const apps = {};
  const references = {};
  let objectBytes = backend.totalBytes;
  async function object(key, body, app) {
    safeKey(key);
    objectBytes += Buffer.byteLength(body);
    assert(
      objectBytes <= NEON_CANDIDATE_LIMIT && objects.length < 4000,
      'Release exceeds bounded object graph.',
    );
    const filename = 'objects/' + key;
    await mkdir(
      path.dirname(within(directory, path.join(directory, filename))),
      { recursive: true },
    );
    await put(filename, body);
    objects.push({
      key,
      file: filename,
      sha256: sha256(body),
      bytes: Buffer.byteLength(body),
      contentType: contentType(key),
      cacheControl: cacheControl(key),
      app,
    });
  }
  for (const app of remotes) {
    const sourceDirectory = path.join(
      workspace,
      'apps',
      app,
      'dist',
      app === 'support' ? 'browser' : 'remote',
    );
    await ordinary(sourceDirectory, true);
    const names = await files(sourceDirectory);
    assert(
      names.includes('remoteEntry.json') &&
        names.includes(app === 'support' ? 'styles.css' : 'style.css'),
      'Frontend federation build is incomplete.',
    );
    if (app === 'support')
      assert(
        names.includes('ticket-api-config.json'),
        'Support API config build missing.',
      );
    const metadata = JSON.parse(
      await readFile(path.join(sourceDirectory, 'remoteEntry.json'), 'utf8'),
    );
    assert(
      metadata.name === app &&
        Array.isArray(metadata.shared) &&
        metadata.shared.length === 0 &&
        Array.isArray(metadata.exposes) &&
        metadata.exposes.some(
          (entry) =>
            entry.key === './mount' && names.includes(entry.outFileName),
        ),
      'Unexpected frontend federation contract.',
    );
    const graph = [];
    const prefix = `mfe/${app}/${release}/`;
    for (const name of names) {
      if (name.endsWith('.html')) continue;
      const sourceFile = path.join(sourceDirectory, name);
      const info = await ordinary(sourceFile);
      assert(info.size <= NEON_CANDIDATE_LIMIT, 'Oversized frontend source.');
      const body =
        app === 'support' && name === 'ticket-api-config.json'
          ? Buffer.from(json({ apiBaseUrl: config.origin, queryMode: 'paged' }))
          : await readFile(sourceFile);
      await object(prefix + name, body, app);
      graph.push({ file: name, sha256: sha256(body) });
    }
    apps[app] = {
      release,
      graphSha256: sha256(json(graph)),
      objects: graph.map((entry) => ({
        key: prefix + entry.file,
        sha256: entry.sha256,
      })),
    };
    references[app] = reference(config.origin, app, release);
  }
  const shellDirectory = path.join(workspace, 'apps/shell/dist/browser');
  await ordinary(shellDirectory, true);
  const shellNames = await files(shellDirectory);
  assert(shellNames.includes('index.html'), 'Shell document missing.');
  const shellGraph = [];
  for (const name of shellNames) {
    if (name === 'runtime-config.json') continue;
    const sourceFile = path.join(shellDirectory, name);
    assert(
      (await ordinary(sourceFile)).size <= NEON_CANDIDATE_LIMIT,
      'Oversized shell source.',
    );
    const body = await readFile(sourceFile);
    await object(name, body, 'shell');
    shellGraph.push({ file: name, sha256: sha256(body) });
  }
  apps.shell = { release, graphSha256: sha256(json(shellGraph)) };
  const runtime = json({ schemaVersion: 1, remotes: references });
  await object('runtime-config.json', runtime, 'configuration');
  await object(`_releases/${release}/runtime-config.json`, runtime, 'rollback');
  await object(
    `_releases/${release}/index.html`,
    await readFile(path.join(shellDirectory, 'index.html')),
    'rollback',
  );
  const filesBeforeManifest = await inventory(directory);
  const manifest = {
    schemaVersion: 1,
    kind,
    project: 'platypus-service',
    release,
    sourceSha,
    origin: config.origin,
    runtimeVariant: backend.manifest.runtimeVariant,
    runtimeSha256: backend.manifest.runtimeSha256,
    templateSha256: backend.manifest.templateSha256,
    backend: {
      candidate: release,
      manifestSha256: backend.manifestSha256,
      archive: 'backend/backend.zip',
      key: `_deploy/backend/${release}.zip`,
      codeSha256: backend.codeSha256,
      backendRevision: backend.backendRevision,
    },
    apps,
    references,
    objects,
    inventory: filesBeforeManifest.entries,
    totalBytes: filesBeforeManifest.totalBytes,
  };
  const bytes = json(manifest);
  assert(
    Buffer.byteLength(bytes) + filesBeforeManifest.totalBytes <=
      NEON_CANDIDATE_LIMIT,
    'Full Neon release exceeds 32 MiB.',
  );
  await put(manifestName, bytes);
  return verifyNeonRelease({
    root: workspace,
    release,
    expectedSourceSha: sourceSha,
    expectedRuntimeConfig: config,
    expectedManifestSha256: sha256(bytes),
  });
}

export async function verifyNeonRelease({
  root = projectRoot,
  release,
  expectedSourceSha,
  expectedRuntimeConfig,
  expectedManifestSha256,
}) {
  safeName(release);
  assert.match(
    expectedSourceSha ?? '',
    /^[a-f0-9]{40}$/,
    'Exact externally selected source SHA required.',
  );
  assert(!/^0+$/.test(expectedSourceSha), 'Placeholder source SHA rejected.');
  assert.match(
    expectedManifestSha256 ?? '',
    /^[a-f0-9]{64}$/,
    'Externally selected full manifest SHA256 required.',
  );
  const config = validateNeonRuntimeConfig(expectedRuntimeConfig);
  const workspace = path.resolve(root);
  const directory = within(
    await parentDirectory(workspace, false),
    path.join(workspace, '.local/neon-aws/releases', release),
  );
  const all = await inventory(directory);
  const item = all.entries.find((entry) => entry.file === manifestName);
  assert(
    item && item.bytes <= 2 * 1024 * 1024,
    'Bounded full Neon manifest required.',
  );
  const read = (name) =>
    readFile(within(directory, path.join(directory, safeKey(name))));
  const bytes = await read(manifestName);
  assert.equal(
    sha256(bytes),
    expectedManifestSha256,
    'Full candidate manifest differs from reviewed selection.',
  );
  const manifest = JSON.parse(bytes.toString('utf8'));
  exactKeys(
    manifest,
    [
      'schemaVersion',
      'kind',
      'project',
      'release',
      'sourceSha',
      'origin',
      'runtimeVariant',
      'runtimeSha256',
      'templateSha256',
      'backend',
      'apps',
      'references',
      'objects',
      'inventory',
      'totalBytes',
    ],
    'Unexpected full candidate manifest fields.',
  );
  assert.equal(
    bytes.toString('utf8'),
    json(manifest),
    'Canonical full manifest required.',
  );
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.kind, kind, 'Unknown full candidate kind.');
  assert.equal(manifest.project, 'platypus-service');
  assert.equal(manifest.release, release);
  assert.equal(
    manifest.sourceSha,
    expectedSourceSha,
    'Full candidate source differs.',
  );
  assert.equal(
    manifest.origin,
    config.origin,
    'Full candidate origin differs.',
  );
  const entries = all.entries.filter((entry) => entry.file !== manifestName);
  assert.deepEqual(
    manifest.inventory,
    entries,
    'Full candidate has changed, missing or extra files.',
  );
  assert.equal(
    manifest.totalBytes,
    entries.reduce((sum, entry) => sum + entry.bytes, 0),
  );
  assert.equal(
    (await read('owner.json')).toString('utf8'),
    json({
      kind,
      project: 'platypus-service',
      release,
      sourceSha: expectedSourceSha,
    }),
    'Full candidate owner differs.',
  );
  exactKeys(
    manifest.backend,
    [
      'candidate',
      'manifestSha256',
      'archive',
      'key',
      'codeSha256',
      'backendRevision',
    ],
    'Unexpected backend binding fields.',
  );
  assert.equal(manifest.backend.candidate, release);
  assert.equal(manifest.backend.archive, 'backend/backend.zip');
  assert.equal(manifest.backend.key, `_deploy/backend/${release}.zip`);
  const backend = await verifyNeonCandidate({
    root: workspace,
    release,
    candidate: release,
    expectedSourceSha,
    expectedRuntimeConfig: config,
    expectedManifestSha256: manifest.backend.manifestSha256,
  });
  assert.equal(manifest.backend.codeSha256, backend.codeSha256);
  assert.equal(manifest.backend.backendRevision, backend.backendRevision);
  for (const key of ['runtimeVariant', 'runtimeSha256', 'templateSha256'])
    assert.equal(
      manifest[key],
      backend.manifest[key],
      'Full runtime/template variant binding differs.',
    );
  exactKeys(
    manifest.apps,
    [...remotes, 'shell'],
    'Full frontend graph required.',
  );
  exactKeys(manifest.references, remotes, 'Exact remote references required.');
  assert(
    Array.isArray(manifest.objects) &&
      manifest.objects.length > 0 &&
      manifest.objects.length < 4001,
    'Bounded frontend object graph required.',
  );
  const keys = new Set();
  for (const object of manifest.objects) {
    exactKeys(
      object,
      ['key', 'file', 'sha256', 'bytes', 'contentType', 'cacheControl', 'app'],
      'Unexpected frontend object fields.',
    );
    safeKey(object.key);
    assert(
      !keys.has(object.key.toLowerCase()),
      'Duplicate frontend object key.',
    );
    keys.add(object.key.toLowerCase());
    assert.equal(object.file, 'objects/' + object.key);
    assert.equal(object.contentType, contentType(object.key));
    assert.equal(object.cacheControl, cacheControl(object.key));
    const entry = entries.find((entry) => entry.file === object.file);
    assert(
      entry && entry.sha256 === object.sha256 && entry.bytes === object.bytes,
      'Frontend object inventory differs.',
    );
    assert(
      [...remotes, 'shell', 'configuration', 'rollback'].includes(object.app),
      'Unknown frontend application.',
    );
  }
  const objectFiles = entries.filter((entry) =>
    entry.file.startsWith('objects/'),
  );
  assert.equal(
    objectFiles.length,
    manifest.objects.length,
    'Unlisted frontend objects.',
  );
  assert(
    entries.every(
      (entry) =>
        entry.file === 'owner.json' ||
        entry.file.startsWith('objects/') ||
        entry.file.startsWith('backend/'),
    ),
    'Unexpected full candidate artifact.',
  );
  for (const app of remotes) {
    const graph = manifest.objects.filter((object) => object.app === app);
    const prefix = `mfe/${app}/${release}/`;
    assert(
      graph.length && graph.every((entry) => entry.key.startsWith(prefix)),
      'Remote graph prefix differs.',
    );
    assert.deepEqual(
      manifest.apps[app],
      {
        release,
        graphSha256: sha256(
          json(
            graph.map((entry) => ({
              file: entry.key.slice(prefix.length),
              sha256: entry.sha256,
            })),
          ),
        ),
        objects: graph.map((entry) => ({
          key: entry.key,
          sha256: entry.sha256,
        })),
      },
      'Remote complete graph differs.',
    );
    assert.deepEqual(
      manifest.references[app],
      reference(config.origin, app, release),
      'Remote origin/reference differs.',
    );
    const metadata = JSON.parse(
      (await read('objects/' + prefix + 'remoteEntry.json')).toString('utf8'),
    );
    assert(
      metadata.name === app &&
        Array.isArray(metadata.shared) &&
        metadata.shared.length === 0 &&
        Array.isArray(metadata.exposes) &&
        metadata.exposes.some(
          (entry) =>
            entry.key === './mount' &&
            graph.some((object) => object.key === prefix + entry.outFileName),
        ),
      'Remote metadata graph differs.',
    );
  }
  const shell = manifest.objects.filter((object) => object.app === 'shell');
  assert(
    shell.some((entry) => entry.key === 'index.html') &&
      shell.every(
        (entry) =>
          !entry.key.startsWith('mfe/') &&
          !entry.key.startsWith('_releases/') &&
          entry.key !== 'runtime-config.json',
      ),
    'Shell graph differs.',
  );
  assert.deepEqual(
    manifest.apps.shell,
    {
      release,
      graphSha256: sha256(
        json(shell.map((entry) => ({ file: entry.key, sha256: entry.sha256 }))),
      ),
    },
    'Shell complete graph differs.',
  );
  const expectedPointer = json({
    schemaVersion: 1,
    remotes: manifest.references,
  });
  for (const key of [
    'runtime-config.json',
    `_releases/${release}/runtime-config.json`,
  ])
    assert.equal(
      (await read('objects/' + key)).toString('utf8'),
      expectedPointer,
      'Runtime pointer differs.',
    );
  assert(
    (await read(`objects/_releases/${release}/index.html`)).equals(
      await read('objects/index.html'),
    ),
    'Rollback document differs.',
  );
  assert.equal(
    (
      await read(`objects/mfe/support/${release}/ticket-api-config.json`)
    ).toString('utf8'),
    json({ apiBaseUrl: config.origin, queryMode: 'paged' }),
    'Support must use same-origin paged API.',
  );
  assert.deepEqual(
    manifest.objects
      .filter((entry) => ['configuration', 'rollback'].includes(entry.app))
      .map((entry) => [entry.key, entry.app]),
    [
      ['runtime-config.json', 'configuration'],
      [`_releases/${release}/runtime-config.json`, 'rollback'],
      [`_releases/${release}/index.html`, 'rollback'],
    ],
    'Exact pointers and rollback graph required.',
  );
  return {
    directory,
    manifest,
    manifestSha256: sha256(bytes),
    backend,
    totalBytes: all.totalBytes,
  };
}

async function main() {
  const [operation, ...argv] = process.argv.slice(2);
  assert(
    ['prepare', 'verify'].includes(operation),
    'Explicit offline prepare or verify required.',
  );
  const options = flags(argv, [
    '--release',
    '--source-sha',
    '--runtime',
    ...(operation === 'verify' ? ['--manifest-sha256'] : []),
  ]);
  const configFile = within(
    projectRoot,
    path.resolve(projectRoot, options['--runtime'] ?? ''),
  );
  assert(
    (await ordinary(configFile)).size <= 16384,
    'Bounded nonsecret runtime JSON required.',
  );
  const runtimeConfig = JSON.parse(await readFile(configFile, 'utf8'));
  const result =
    operation === 'prepare'
      ? await prepareNeonRelease({
          release: options['--release'],
          sourceSha: options['--source-sha'],
          runtimeConfig,
        })
      : await verifyNeonRelease({
          release: options['--release'],
          expectedSourceSha: options['--source-sha'],
          expectedRuntimeConfig: runtimeConfig,
          expectedManifestSha256: options['--manifest-sha256'],
        });
  console.log(
    json({
      operation,
      kind,
      release: result.manifest.release,
      manifestSha256: result.manifestSha256,
      codeSha256: result.backend.codeSha256,
      backendRevision: result.backend.backendRevision,
    }),
  );
}
if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  main().catch(() => {
    console.error(
      'Offline full Neon candidate command failed; no publication was attempted.',
    );
    process.exitCode = 1;
  });
