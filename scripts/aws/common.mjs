import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export const outputRoot = path.join(projectRoot, '.local', 'aws');
export const project = 'platypus-service';
export const region = 'eu-north-1';
export const remotes = ['analytics', 'administration', 'support'];
export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
export const json = (value) => JSON.stringify(value, null, 2) + '\n';

export function within(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Expected a child path inside ' + parent + '.');
  return path.resolve(candidate);
}

export function releaseId(value) {
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(value ?? ''))
    throw new Error(
      'Release must contain 1-48 lowercase letters, digits or hyphens.',
    );
  return value;
}

export function origin(value) {
  const parsed = new URL(value);
  if (
    parsed.origin !== value ||
    parsed.username ||
    parsed.password ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    (parsed.protocol === 'http:' && parsed.hostname !== 'localhost')
  )
    throw new Error(
      'Origin must be HTTPS, or HTTP localhost for offline preview.',
    );
  return parsed.origin;
}

export function flags(argv, allowed) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (!allowed.includes(flag) || options[flag] !== undefined)
      throw new Error('Unsupported or repeated option: ' + flag);
    const value = argv[++index];
    if (!value || value.startsWith('--'))
      throw new Error('Missing value for ' + flag);
    options[flag] = value;
  }
  return options;
}

export async function files(directory) {
  if ((await lstat(directory)).isSymbolicLink())
    throw new Error('Symlink directory rejected.');
  const result = [];
  async function visit(current, prefix = '') {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (entry.isSymbolicLink()) throw new Error('Symlink entry rejected.');
      if (entry.name === '.nf-cache') continue;
      if (entry.name.startsWith('.'))
        throw new Error('Hidden artifact rejected: ' + entry.name);
      const relative = prefix + entry.name;
      if (entry.isDirectory())
        await visit(path.join(current, entry.name), relative + '/');
      else if (entry.isFile()) result.push(relative);
      else throw new Error('Non-file artifact rejected.');
    }
  }
  await visit(directory);
  return result;
}

export async function ownedManifest(filename) {
  const resolved = await realpath(filename);
  within(outputRoot, resolved);
  const value = JSON.parse(await readFile(resolved, 'utf8'));
  if (
    value.project !== project ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.objects) ||
    !['full', ...remotes].includes(value.scope)
  )
    throw new Error('Not a Platypus release manifest.');
  releaseId(value.release);
  origin(value.origin);
  const owner = JSON.parse(
    await readFile(path.join(path.dirname(resolved), 'owner.json'), 'utf8'),
  );
  if (owner.project !== project || owner.release !== value.release)
    throw new Error('Release ownership marker does not match.');
  const seen = new Set();
  for (const object of value.objects) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(object.key) ||
      object.key.split('/').includes('..') ||
      object.key !== path.posix.normalize(object.key) ||
      object.key.startsWith('/') ||
      !/^[a-f0-9]{64}$/.test(object.sha256) ||
      object.contentType !== contentType(object.key) ||
      object.cacheControl !== cacheControl(object.key)
    )
      throw new Error('Unsafe object key.');
    if (seen.has(object.key)) throw new Error('Duplicate object key.');
    seen.add(object.key);
    const file = within(
      path.dirname(resolved),
      path.resolve(path.dirname(resolved), object.file),
    );
    if ((await realpath(file)) !== file || (await lstat(file)).isSymbolicLink())
      throw new Error('Manifest artifact must be a regular owned file.');
    if (sha256(await readFile(file)) !== object.sha256)
      throw new Error('Artifact hash mismatch: ' + object.key);
  }
  for (const app of remotes) {
    const version = releaseId(value.apps?.[app]?.release);
    const remote = value.references?.[app];
    const graph = value.apps[app].objects;
    const prefix = `mfe/${app}/${version}/`;
    if (
      !Array.isArray(graph) ||
      graph.length === 0 ||
      graph.some(
        (item) =>
          !item.key.startsWith(prefix) ||
          item.key !== path.posix.normalize(item.key) ||
          !/^[a-f0-9]{64}$/.test(item.sha256),
      ) ||
      sha256(
        json(
          graph.map((item) => ({
            file: item.key.slice(prefix.length),
            sha256: item.sha256,
          })),
        ),
      ) !== value.apps[app].graphSha256
    )
      throw new Error('Invalid complete remote graph.');
    if (
      (value.scope === 'full' || value.scope === app) &&
      graph.some(
        (item) =>
          !value.objects.some(
            (object) =>
              object.key === item.key && object.sha256 === item.sha256,
          ),
      )
    )
      throw new Error('Remote graph artifact is missing from this release.');
    if (
      remote?.contractVersion !== 1 ||
      remote.exposedModule !== './mount' ||
      remote.remoteEntryUrl !==
        value.origin + `/mfe/${app}/${version}/remoteEntry.json` ||
      JSON.stringify(remote.cssUrls) !==
        JSON.stringify([
          value.origin +
            `/mfe/${app}/${version}/` +
            (app === 'support' ? 'styles.css' : 'style.css'),
        ])
    )
      throw new Error('Invalid remote release reference.');
  }
  const pointer = value.objects.find(
    (item) => item.key === 'runtime-config.json',
  );
  if (
    !pointer ||
    JSON.stringify(
      JSON.parse(
        await readFile(path.join(path.dirname(resolved), pointer.file), 'utf8'),
      ),
    ) !== JSON.stringify({ schemaVersion: 1, remotes: value.references })
  )
    throw new Error('Runtime pointer does not match the manifest.');
  if (value.scope === 'full') {
    const directory = path.join(path.dirname(resolved), 'lambda-extracted');
    const names = await files(directory);
    if (
      JSON.stringify(names.sort()) !==
      JSON.stringify(Object.keys(value.backend.files).sort())
    )
      throw new Error('Extracted handler graph differs.');
    for (const filename of names)
      if (
        sha256(await readFile(path.join(directory, filename))) !==
        value.backend.files[filename]
      )
        throw new Error('Extracted handler hash mismatch.');
  }
  return { value, directory: path.dirname(resolved), filename: resolved };
}

export function contentType(filename) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.zip': 'application/zip',
  };
  const value = types[path.extname(filename)];
  if (!value) throw new Error('Unreviewed artifact type: ' + filename);
  return value;
}

export function cacheControl(key) {
  return /(?:^|\/)(?:index\.html|favicon\.svg|runtime-config\.json|remoteEntry\.json|importmap\.json|ticket-api-config\.json)$/.test(
    key,
  ) || key.startsWith('_')
    ? 'no-store'
    : 'public,max-age=31536000,immutable';
}

export function isPublicKey(key) {
  return (
    ['index.html', 'favicon.svg', 'runtime-config.json'].includes(key) ||
    /^(?:main|styles|chunk)-[a-zA-Z0-9_-]+\.(?:js|css)$/.test(key) ||
    /^mfe\/(?:analytics|administration|support)\/[a-z0-9-]+\/[a-zA-Z0-9_./-]+$/.test(
      key,
    )
  );
}
