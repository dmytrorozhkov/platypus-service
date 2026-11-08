import assert from 'node:assert/strict';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { flags, json, projectRoot, sha256, within } from '../aws/common.mjs';
import { inspectArtifactZip } from '../delivery/artifact-reader.mjs';
import {
  computeNeonBackendRevision,
  neonBackendTemplate,
  validateNeonRuntimeConfig,
} from './templates.mjs';

export const NEON_CANDIDATE_LIMIT = 32 * 1024 * 1024;
const kind = 'platypus-neon-backend-candidate';
const runtimeVariant = 'neon-postgres-ssm-v1';
const manifestName = 'neon-candidate.json';
const packageValue = {
  name: '@platypus/neon-lambda-candidate',
  private: true,
  type: 'module',
};
const expectedNames = [
  'backend-template.json',
  'backend.zip',
  'lambda-extracted/lambda.js',
  'lambda-extracted/package.json',
  'lambda/lambda.js',
  'lambda/package.json',
  'owner.json',
  'runtime.json',
].sort();
const source = (value) => {
  assert.match(value ?? '', /^[a-f0-9]{40}$/, 'Exact source SHA required.');
  assert(!/^0+$/.test(value), 'Placeholder source SHA rejected.');
  return value;
};
const candidateName = (value) => {
  assert.match(
    value ?? '',
    /^[a-z0-9][a-z0-9-]{0,47}$/,
    'Bounded candidate name required.',
  );
  return value;
};
const exactKeys = (value, keys, message) =>
  assert.deepEqual(Object.keys(value ?? {}).sort(), [...keys].sort(), message);

async function ordinary(filename, directory = false) {
  const info = await lstat(filename);
  assert(
    !info.isSymbolicLink() &&
      (directory ? info.isDirectory() : info.isFile() && info.nlink === 1),
    'Candidate paths must be ordinary, unlinked entries.',
  );
  assert.equal(
    await realpath(filename),
    filename,
    'Candidate paths cannot resolve through links.',
  );
  return info;
}

async function checkedRoot(root) {
  const resolved = path.resolve(root);
  await ordinary(resolved, true);
  const marker = path.join(resolved, 'package.json');
  const info = await ordinary(marker);
  assert(info.size <= 1024 * 1024, 'Bounded workspace marker required.');
  assert.equal(
    JSON.parse(await readFile(marker, 'utf8')).name,
    '@platypus/workspace',
    'Expected explicit Platypus workspace.',
  );
  return resolved;
}

async function parentDirectory(root, create) {
  let current = root;
  for (const name of ['.local', 'neon-aws', 'candidates']) {
    current = within(root, path.join(current, name));
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
  const seen = new Set();
  let totalBytes = 0;
  async function visit(current, prefix = '') {
    await ordinary(current, true);
    for (const entry of await readdir(current, { withFileTypes: true })) {
      assert.match(
        entry.name,
        /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/,
        'Unsafe candidate filename.',
      );
      assert(
        !entry.name.endsWith('.') &&
          !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(entry.name),
        'Aliased candidate filename.',
      );
      const relative = prefix + entry.name;
      assert(
        !seen.has(relative.toLowerCase()),
        'Case-colliding candidate entries.',
      );
      seen.add(relative.toLowerCase());
      const filename = within(directory, path.join(current, entry.name));
      if (entry.isDirectory()) {
        assert(
          ['lambda', 'lambda-extracted'].includes(relative),
          'Unexpected candidate directory.',
        );
        await visit(filename, relative + '/');
      } else {
        const info = await ordinary(filename);
        totalBytes += info.size;
        assert(
          totalBytes <= NEON_CANDIDATE_LIMIT && entries.length < 16,
          'Candidate exceeds bounded inventory.',
        );
        const bytes = await readFile(filename);
        assert.equal(
          bytes.length,
          info.size,
          'Candidate changed during inventory.',
        );
        entries.push({
          file: relative,
          bytes: bytes.length,
          sha256: sha256(bytes),
        });
      }
    }
  }
  await visit(directory);
  entries.sort((a, b) => a.file.localeCompare(b.file));
  return { entries, totalBytes };
}

async function bundle(root) {
  const entry = path.join(root, 'apps/server/dist/neon-lambda.js');
  await ordinary(entry);
  const { build, version } = await import('esbuild');
  assert.equal(version, '0.28.2', 'Reviewed esbuild version required.');
  let result;
  try {
    result = await build({
      absWorkingDir: root,
      entryPoints: [entry],
      outfile: 'lambda.js',
      bundle: true,
      write: false,
      platform: 'node',
      target: 'node24',
      format: 'esm',
      packages: 'bundle',
      sourcemap: false,
      legalComments: 'none',
      metafile: true,
      logLevel: 'silent',
      define: { 'process.env.NODE_PG_FORCE_NATIVE': '""' },
      banner: {
        js: "import { createRequire as __platypusCreateRequire } from 'node:module'; const require = __platypusCreateRequire(import.meta.url);",
      },
      plugins: [
        {
          name: 'disable-native-postgresql',
          setup(build) {
            build.onResolve({ filter: /^pg-native$/ }, () => ({
              path: 'disabled',
              namespace: 'platypus-disabled-pg-native',
            }));
            build.onLoad(
              { filter: /.*/, namespace: 'platypus-disabled-pg-native' },
              () => ({
                contents:
                  'throw new Error("Native PostgreSQL is unavailable in this prepared runtime.");',
                loader: 'js',
              }),
            );
          },
        },
      ],
    });
  } catch {
    throw new Error('Offline Neon bundling failed. No candidate was accepted.');
  }
  assert.equal(
    result.outputFiles.length,
    1,
    'Exactly one JavaScript bundle required.',
  );
  const outputs = Object.values(result.metafile.outputs);
  assert.equal(outputs.length, 1, 'Unexpected bundle output graph.');
  for (const file of Object.keys(result.metafile.inputs))
    assert(
      !/\.(?:node|map)$/i.test(file),
      'Native or source-map bundle input rejected.',
    );
  for (const entry of outputs[0].imports)
    assert(
      entry.external && isBuiltin(entry.path),
      'External package or dynamic dependency remains.',
    );
  assert(
    !/\bimport\s*\(\s*[^'"\s]/.test(result.outputFiles[0].text),
    'Unbounded dynamic import rejected.',
  );
  return Buffer.from(result.outputFiles[0].contents);
}

function archive(root, directory) {
  assert.equal(
    process.platform,
    'win32',
    'Reviewed Windows archive helper required.',
  );
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      path.join(projectRoot, 'scripts/aws/archive.ps1'),
    ],
    {
      cwd: root,
      env: {
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR,
        PATH: process.env.PATH,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        PLATYPUS_PACKAGE_SOURCE: path.join(directory, 'lambda'),
        PLATYPUS_PACKAGE_ARCHIVE: path.join(directory, 'backend.zip'),
        PLATYPUS_PACKAGE_EXTRACT: path.join(directory, 'lambda-extracted'),
      },
      timeout: 120000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      encoding: 'utf8',
    },
  );
  if (result.error?.code === 'ETIMEDOUT') {
    throw new Error(
      'Owned ZIP creation/extraction timed out after 120 seconds.',
    );
  }
  assert.equal(
    result.status,
    0,
    'Owned standard ZIP creation/extraction failed.',
  );
}

export async function prepareNeonCandidate({
  root = projectRoot,
  candidate,
  sourceSha,
  runtimeConfig,
}) {
  source(sourceSha);
  candidateName(candidate);
  const config = validateNeonRuntimeConfig(runtimeConfig);
  const workspace = await checkedRoot(root);
  assert.equal(
    process.platform,
    'win32',
    'Reviewed Windows archive helper required.',
  );
  const code = await bundle(workspace);
  assert(
    code.length <= NEON_CANDIDATE_LIMIT / 4,
    'Bundled handler exceeds bounded candidate size.',
  );
  const parent = await parentDirectory(workspace, true);
  const directory = within(parent, path.join(parent, candidate));
  await mkdir(directory); // A failed attempt also remains reserved; never overwrite or repair it.
  await ordinary(directory, true);
  const put = (name, bytes) =>
    writeFile(within(directory, path.join(directory, name)), bytes, {
      flag: 'wx',
    });
  await put(
    'owner.json',
    json({ kind, project: 'platypus-service', sourceSha, candidate }),
  );
  await mkdir(path.join(directory, 'lambda'));
  await put('lambda/lambda.js', code);
  await put('lambda/package.json', json(packageValue));
  await put('runtime.json', json(config));
  await put('backend-template.json', json(neonBackendTemplate()));
  archive(workspace, directory);
  const files = await inventory(directory);
  const zip = await readFile(path.join(directory, 'backend.zip'));
  const codeSha256 = Buffer.from(sha256(zip), 'hex').toString('base64');
  const manifest = {
    schemaVersion: 1,
    kind,
    project: 'platypus-service',
    candidate,
    sourceSha,
    runtimeVariant,
    runtimeSha256: sha256(json(config)),
    templateSha256: sha256(json(neonBackendTemplate())),
    archiveSha256: sha256(zip),
    codeSha256,
    backendRevision: computeNeonBackendRevision(config, codeSha256),
    bundler: {
      name: 'esbuild',
      version: '0.28.2',
      target: 'node24',
      format: 'esm',
      nativePostgres: false,
    },
    inventory: files.entries,
    totalBytes: files.totalBytes,
  };
  const bytes = json(manifest);
  assert(
    Buffer.byteLength(bytes) + files.totalBytes <= NEON_CANDIDATE_LIMIT,
    'Candidate exceeds 32 MiB.',
  );
  await put(manifestName, bytes);
  return verifyNeonCandidate({
    root: workspace,
    candidate,
    expectedSourceSha: sourceSha,
    expectedRuntimeConfig: config,
    expectedManifestSha256: sha256(bytes),
  });
}

export async function verifyNeonCandidate({
  root = projectRoot,
  release,
  candidate,
  expectedSourceSha,
  expectedRuntimeConfig,
  expectedManifestSha256,
}) {
  source(expectedSourceSha);
  candidateName(candidate);
  assert.match(
    expectedManifestSha256 ?? '',
    /^[a-f0-9]{64}$/,
    'Externally selected candidate manifest SHA256 required.',
  );
  const config = validateNeonRuntimeConfig(expectedRuntimeConfig);
  const workspace = await checkedRoot(root);
  let directory;
  if (release !== undefined) {
    candidateName(release);
    let parent = workspace;
    for (const part of ['.local', 'neon-aws', 'releases', release]) {
      parent = within(workspace, path.join(parent, part));
      await ordinary(parent, true);
    }
    directory = within(parent, path.join(parent, 'backend'));
  } else {
    directory = within(
      await parentDirectory(workspace, false),
      path.join(workspace, '.local/neon-aws/candidates', candidate),
    );
  }
  const files = await inventory(directory);
  assert.deepEqual(
    files.entries.map((item) => item.file).sort(),
    [...expectedNames, manifestName].sort(),
    'Candidate exact file inventory differs.',
  );
  const read = (name) => readFile(path.join(directory, name));
  const bytes = await read(manifestName);
  assert(bytes.length <= 128 * 1024, 'Bounded candidate manifest required.');
  assert.equal(
    sha256(bytes),
    expectedManifestSha256,
    'Candidate manifest hash differs from reviewed selection.',
  );
  const manifest = JSON.parse(bytes.toString('utf8'));
  exactKeys(
    manifest,
    [
      'schemaVersion',
      'kind',
      'project',
      'candidate',
      'sourceSha',
      'runtimeVariant',
      'runtimeSha256',
      'templateSha256',
      'archiveSha256',
      'codeSha256',
      'backendRevision',
      'bundler',
      'inventory',
      'totalBytes',
    ],
    'Unexpected candidate manifest fields.',
  );
  assert.equal(
    bytes.toString('utf8'),
    json(manifest),
    'Canonical candidate manifest required.',
  );
  assert.equal(manifest.schemaVersion, 1, 'Unknown candidate schema.');
  assert.equal(manifest.kind, kind, 'Unknown candidate kind.');
  assert.equal(
    manifest.project,
    'platypus-service',
    'Candidate project differs.',
  );
  assert.equal(manifest.candidate, candidate, 'Candidate identity differs.');
  assert.equal(
    manifest.sourceSha,
    expectedSourceSha,
    'Candidate source differs.',
  );
  assert.equal(
    manifest.runtimeVariant,
    runtimeVariant,
    'Candidate runtime variant differs.',
  );
  assert.deepEqual(
    manifest.bundler,
    {
      name: 'esbuild',
      version: '0.28.2',
      target: 'node24',
      format: 'esm',
      nativePostgres: false,
    },
    'Candidate bundler differs.',
  );
  const entries = files.entries.filter((entry) => entry.file !== manifestName);
  assert.deepEqual(
    manifest.inventory,
    entries,
    'Candidate files are changed, missing or extra.',
  );
  assert.equal(
    manifest.totalBytes,
    entries.reduce((sum, item) => sum + item.bytes, 0),
    'Candidate byte count differs.',
  );
  assert.equal(
    (await read('owner.json')).toString('utf8'),
    json({
      kind,
      project: 'platypus-service',
      sourceSha: expectedSourceSha,
      candidate,
    }),
    'Candidate owner marker differs.',
  );
  assert.equal(
    (await read('runtime.json')).toString('utf8'),
    json(config),
    'Candidate runtime configuration differs.',
  );
  assert.equal(
    manifest.runtimeSha256,
    sha256(json(config)),
    'Candidate runtime fingerprint differs.',
  );
  const template = json(neonBackendTemplate());
  assert.equal(
    (await read('backend-template.json')).toString('utf8'),
    template,
    'Candidate template differs from reviewed generator.',
  );
  assert.equal(
    manifest.templateSha256,
    sha256(template),
    'Candidate template fingerprint differs.',
  );
  assert.equal(
    (await read('lambda/package.json')).toString('utf8'),
    json(packageValue),
    'Candidate module package differs.',
  );
  const zip = await read('backend.zip');
  assert.equal(
    manifest.archiveSha256,
    sha256(zip),
    'Candidate archive hash differs.',
  );
  assert.equal(
    manifest.codeSha256,
    Buffer.from(sha256(zip), 'hex').toString('base64'),
    'Candidate code hash differs.',
  );
  assert.equal(
    manifest.backendRevision,
    computeNeonBackendRevision(config, manifest.codeSha256),
    'Candidate backend revision differs.',
  );
  const zipped = inspectArtifactZip(zip);
  assert.deepEqual(
    zipped.map((entry) => entry.name).sort(),
    ['lambda.js', 'package.json'],
    'Candidate ZIP graph differs.',
  );
  for (const entry of zipped) {
    assert.equal(entry.directory, false, 'Candidate ZIP directories rejected.');
    assert(
      entry.body.equals(await read('lambda/' + entry.name)) &&
        entry.body.equals(await read('lambda-extracted/' + entry.name)),
      'Candidate archive and extracted/prepared copies differ.',
    );
  }
  return {
    directory,
    manifest,
    manifestSha256: sha256(bytes),
    codeSha256: manifest.codeSha256,
    backendRevision: manifest.backendRevision,
    totalBytes: files.totalBytes,
  };
}

async function main() {
  const [operation, ...argv] = process.argv.slice(2);
  assert(
    ['prepare', 'verify'].includes(operation),
    'Expected explicit offline prepare or verify.',
  );
  const options = flags(argv, [
    '--candidate',
    '--source-sha',
    '--runtime',
    ...(operation === 'verify' ? ['--manifest-sha256'] : []),
  ]);
  const filename = within(
    projectRoot,
    path.resolve(projectRoot, options['--runtime'] ?? ''),
  );
  const info = await ordinary(filename);
  assert(info.size <= 16384, 'Bounded nonsecret runtime JSON required.');
  const runtimeConfig = JSON.parse(await readFile(filename, 'utf8'));
  const result =
    operation === 'prepare'
      ? await prepareNeonCandidate({
          candidate: options['--candidate'],
          sourceSha: options['--source-sha'],
          runtimeConfig,
        })
      : await verifyNeonCandidate({
          candidate: options['--candidate'],
          expectedSourceSha: options['--source-sha'],
          expectedRuntimeConfig: runtimeConfig,
          expectedManifestSha256: options['--manifest-sha256'],
        });
  console.log(
    json({
      operation,
      kind,
      candidate: result.manifest.candidate,
      manifestSha256: result.manifestSha256,
      codeSha256: result.codeSha256,
      backendRevision: result.backendRevision,
    }),
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch(() => {
    console.error(
      'Offline Neon candidate command failed; no publication was attempted.',
    );
    process.exitCode = 1;
  });
}
