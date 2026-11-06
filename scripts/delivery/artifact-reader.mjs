import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { crc32, inflateRawSync } from 'node:zlib';
import { outputRoot, sha256, within } from '../aws/common.mjs';
import { DELIVERY_BUNDLE_LIMIT, verifyDeliveryBundle } from './bundle.mjs';

export const ARTIFACT_ARCHIVE_LIMIT = 40 * 1024 * 1024;
const repository = 'dmytrorozhkov/platypus-service';
const workflowPath = '.github/workflows/package.yml';
const apiRoot = 'https://api.github.com/repos/' + repository;
const check = (condition, message) => assert(condition, message);
const numberId = (value) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? String(value)
    : typeof value === 'string' && /^[1-9][0-9]{0,19}$/.test(value)
      ? value
      : null;

export function validateArtifactSelection(selection) {
  check(
    selection?.repository === repository &&
      selection.workflowPath === workflowPath &&
      selection.ref === 'refs/heads/main',
    'Exact reviewed repository, Package workflow and main ref are required.',
  );
  for (const key of [
    'repositoryId',
    'repositoryOwnerId',
    'runId',
    'runAttempt',
    'artifactId',
  ])
    check(
      typeof selection[key] === 'string' && numberId(selection[key]),
      'Explicit bounded numeric selection identities are required.',
    );
  check(
    /^[a-f0-9]{40}$/.test(selection.sourceSha ?? ''),
    'Exact selected source SHA is required.',
  );
  for (const key of ['artifactDigest', 'envelopeSha256'])
    check(
      /^[a-f0-9]{64}$/.test(selection[key] ?? ''),
      'Externally reviewed archive and envelope digests are required.',
    );
  check(
    /^https:\/\/d[a-z0-9]+\.cloudfront\.net$/.test(selection.origin ?? ''),
    'Reviewed production origin is required.',
  );
  const release = `gh-${selection.runId}-${selection.runAttempt}-${selection.sourceSha.slice(0, 12)}`;
  check(
    release.length <= 48 && selection.release === release,
    'Selected release must derive from the exact source/run/attempt.',
  );
  return selection;
}

export function createGithubHttpTransport({
  fetchImpl = globalThis.fetch,
} = {}) {
  return {
    request: (url, options) =>
      fetchImpl(url, {
        ...options,
        method: 'GET',
        redirect: 'manual',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      }),
  };
}

function safeUrl(value, storage = false) {
  const url = new URL(value);
  check(
    url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash,
    'Unapproved artifact URL.',
  );
  check(
    storage
      ? url.hostname === 'results-receiver.actions.githubusercontent.com' ||
          /^[a-z0-9]{3,24}\.blob\.core\.windows\.net$/.test(url.hostname)
      : url.origin === 'https://api.github.com' && !url.search,
    'Unapproved artifact origin.',
  );
  return url;
}

async function bodyBytes(response, maximum, signal) {
  const declared = response.headers.get('content-length');
  check(
    declared === null ||
      (/^[0-9]+$/.test(declared) && Number(declared) <= maximum),
    'Artifact response exceeds its byte limit.',
  );
  check(
    response.body && !response.headers.get('content-encoding'),
    'Expected a raw bounded artifact response.',
  );
  const chunks = [];
  let count = 0;
  const reader = response.body.getReader();
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    for (;;) {
      signal?.throwIfAborted();
      const item = await reader.read();
      signal?.throwIfAborted();
      if (item.done) break;
      count += item.value.byteLength;
      check(count <= maximum, 'Artifact response exceeds its byte limit.');
      chunks.push(Buffer.from(item.value));
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
  }
  check(
    declared === null || Number(declared) === count,
    'Artifact response length differs.',
  );
  return Buffer.concat(chunks, count);
}

function checkRepository(value, selection) {
  check(
    value?.full_name === repository &&
      numberId(value.id) === selection.repositoryId &&
      numberId(value.owner?.id) === selection.repositoryOwnerId &&
      value.owner?.login === 'dmytrorozhkov' &&
      value.fork === false,
    'Repository identity or ownership differs.',
  );
}

function validateMetadata(run, workflow, artifact, selection, clock) {
  checkRepository(run.repository, selection);
  checkRepository(run.head_repository, selection);
  check(
    numberId(run.id) === selection.runId &&
      numberId(run.run_attempt) === selection.runAttempt &&
      run.head_sha === selection.sourceSha &&
      run.head_branch === 'main' &&
      run.path === workflowPath &&
      run.event === 'workflow_dispatch' &&
      run.status === 'completed' &&
      run.conclusion === 'success' &&
      Array.isArray(run.pull_requests) &&
      run.pull_requests.length === 0,
    'Run is not the selected successful main Package attempt.',
  );
  check(
    workflow.path === workflowPath &&
      workflow.state === 'active' &&
      numberId(workflow.id) === numberId(run.workflow_id),
    'Reviewed Package workflow identity differs.',
  );
  check(
    numberId(artifact.id) === selection.artifactId &&
      artifact.name === selection.release &&
      artifact.expired === false &&
      Number.isSafeInteger(artifact.size_in_bytes) &&
      artifact.size_in_bytes > 0 &&
      artifact.size_in_bytes <= ARTIFACT_ARCHIVE_LIMIT &&
      artifact.digest === 'sha256:' + selection.artifactDigest,
    'Artifact identity, archive digest, expiry or size differs.',
  );
  check(
    artifact.url === `${apiRoot}/actions/artifacts/${selection.artifactId}` &&
      artifact.archive_download_url ===
        `${apiRoot}/actions/artifacts/${selection.artifactId}/zip`,
    'Artifact API location differs.',
  );
  const source = artifact.workflow_run;
  check(
    numberId(source?.id) === selection.runId &&
      numberId(source.repository_id) === selection.repositoryId &&
      numberId(source.head_repository_id) === selection.repositoryId &&
      source.head_sha === selection.sourceSha &&
      source.head_branch === 'main',
    'Artifact is not from the selected repository/run/source.',
  );
  const started = Date.parse(run.run_started_at);
  const ended = Date.parse(run.updated_at);
  const created = Date.parse(artifact.created_at);
  const changed = Date.parse(artifact.updated_at);
  const expiry = Date.parse(artifact.expires_at);
  check(
    [started, ended, created, changed, expiry].every(Number.isFinite) &&
      started <= created &&
      created <= changed &&
      changed <= ended &&
      ended <= clock &&
      expiry > clock,
    'Artifact timestamps do not belong to the selected completed attempt or it has expired.',
  );
}

function extras(bytes) {
  let offset = 0;
  const seen = new Set();
  while (offset < bytes.length) {
    check(offset + 4 <= bytes.length, 'Truncated ZIP extra field.');
    const id = bytes.readUInt16LE(offset);
    const length = bytes.readUInt16LE(offset + 2);
    offset += 4;
    check(
      !seen.has(id) && offset + length <= bytes.length,
      'Duplicate or truncated ZIP extra field.',
    );
    seen.add(id);
    // These timestamp/UID fields carry no alternate path, link or size semantics.
    check(
      (id === 0x5455 && [1, 5, 9, 13].includes(length)) ||
        (id === 0x7875 && length >= 3 && length <= 19),
      'Unsupported ZIP extra field, link metadata or ZIP64.',
    );
    offset += length;
  }
}

function zipName(bytes) {
  const name = bytes.toString('utf8');
  check(
    Buffer.from(name).equals(bytes) &&
      name.length <= 512 &&
      /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(name),
    'Unsafe ZIP path.',
  );
  const directory = name.endsWith('/');
  const plain = directory ? name.slice(0, -1) : name;
  check(
    plain === path.posix.normalize(plain) &&
      plain
        .split('/')
        .every(
          (part) =>
            part &&
            part !== '.' &&
            part !== '..' &&
            !part.endsWith('.') &&
            !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
        ),
    'Traversal, alias or reserved ZIP path.',
  );
  return { name: plain, directory };
}

// Parse first, inflate with per-file bounds second, and write ordinary files only after all checks pass.
export function inspectArtifactZip(archive) {
  check(
    Buffer.isBuffer(archive) &&
      archive.length >= 22 &&
      archive.length <= ARTIFACT_ARCHIVE_LIMIT,
    'Invalid bounded ZIP archive.',
  );
  const end = archive.length - 22;
  check(
    archive.readUInt32LE(end) === 0x06054b50 &&
      archive.readUInt16LE(end + 20) === 0,
    'Unsupported ZIP footer/comment or ZIP64.',
  );
  const count = archive.readUInt16LE(end + 10);
  const centralSize = archive.readUInt32LE(end + 12);
  const centralOffset = archive.readUInt32LE(end + 16);
  check(
    archive.readUInt16LE(end + 4) === 0 &&
      archive.readUInt16LE(end + 6) === 0 &&
      archive.readUInt16LE(end + 8) === count &&
      count > 0 &&
      count <= 8192 &&
      centralOffset + centralSize === end &&
      centralOffset < end,
    'Unsupported multi-disk, ZIP64 or oversized ZIP inventory.',
  );
  const entries = [];
  const paths = new Map();
  const explicitPaths = new Set();
  let cursor = centralOffset;
  let expanded = 0;
  let files = 0;
  for (let index = 0; index < count; index++) {
    check(
      cursor + 46 <= end && archive.readUInt32LE(cursor) === 0x02014b50,
      'Truncated ZIP central record.',
    );
    const host = archive.readUInt16LE(cursor + 4) >>> 8;
    const version = archive.readUInt16LE(cursor + 6);
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const crc = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const size = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const attributes = archive.readUInt32LE(cursor + 38);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    check(
      next <= end &&
        nameLength > 0 &&
        commentLength === 0 &&
        archive.readUInt16LE(cursor + 34) === 0 &&
        [0, 3, 19].includes(host) &&
        version <= 20 &&
        (flags & ~0x080e) === 0 &&
        [0, 8].includes(method) &&
        (method !== 0 || (flags & 6) === 0),
      'Unsupported ZIP entry, flags, version or compression.',
    );
    const rawName = archive.subarray(cursor + 46, cursor + 46 + nameLength);
    const entry = {
      ...zipName(rawName),
      rawName,
      flags,
      method,
      crc,
      compressedSize,
      size,
      localOffset,
      version,
    };
    const mode = attributes >>> 16;
    const type = mode & 0xf000;
    check(
      [0, entry.directory ? 0x4000 : 0x8000].includes(type) &&
        (attributes & 0x08) === 0 &&
        Boolean(attributes & 0x10) === entry.directory,
      'ZIP links, devices or unsupported entry types are forbidden.',
    );
    const lower = entry.name.toLowerCase();
    check(!explicitPaths.has(lower), 'Duplicate or case-colliding ZIP entry.');
    const segments = entry.name.split('/');
    for (let part = 1; part <= segments.length; part++) {
      const spelling = segments.slice(0, part).join('/');
      const key = spelling.toLowerCase();
      const directory = part < segments.length || entry.directory;
      const known = paths.get(key);
      check(
        !known || (known.spelling === spelling && known.directory && directory),
        'ZIP file/directory or ancestor case collision.',
      );
      paths.set(key, { spelling, directory });
    }
    explicitPaths.add(lower);
    extras(
      archive.subarray(
        cursor + 46 + nameLength,
        cursor + 46 + nameLength + extraLength,
      ),
    );
    expanded += size;
    files += Number(!entry.directory);
    check(
      expanded <= DELIVERY_BUNDLE_LIMIT &&
        files <= 4096 &&
        size <= DELIVERY_BUNDLE_LIMIT &&
        compressedSize <= ARTIFACT_ARCHIVE_LIMIT &&
        (!entry.directory || (size === 0 && crc === 0)),
      'ZIP expansion/count limit exceeded.',
    );
    entries.push(entry);
    cursor = next;
  }
  check(cursor === end, 'Extra ZIP central records are forbidden.');
  let previousEnd = 0;
  for (const entry of [...entries].sort(
    (a, b) => a.localOffset - b.localOffset,
  )) {
    const offset = entry.localOffset;
    check(
      offset === previousEnd &&
        offset + 30 <= centralOffset &&
        archive.readUInt32LE(offset) === 0x04034b50,
      'Unlisted, overlapping or truncated ZIP local record.',
    );
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    const endData = start + entry.compressedSize;
    check(
      endData <= centralOffset &&
        archive.readUInt16LE(offset + 4) === entry.version &&
        archive.readUInt16LE(offset + 6) === entry.flags &&
        archive.readUInt16LE(offset + 8) === entry.method &&
        archive
          .subarray(offset + 30, offset + 30 + nameLength)
          .equals(entry.rawName),
      'ZIP local and central metadata differ.',
    );
    extras(archive.subarray(offset + 30 + nameLength, start));
    for (const [field, expected] of [
      [14, entry.crc],
      [18, entry.compressedSize],
      [22, entry.size],
    ])
      check(
        archive.readUInt32LE(offset + field) === expected ||
          ((entry.flags & 8) !== 0 &&
            archive.readUInt32LE(offset + field) === 0),
        'ZIP local sizes/checksum differ.',
      );
    let next = endData;
    if (entry.flags & 8) {
      check(next + 12 <= centralOffset, 'Truncated ZIP descriptor.');
      if (archive.readUInt32LE(next) === 0x08074b50) next += 4;
      check(
        next + 12 <= centralOffset &&
          archive.readUInt32LE(next) === entry.crc &&
          archive.readUInt32LE(next + 4) === entry.compressedSize &&
          archive.readUInt32LE(next + 8) === entry.size,
        'ZIP streaming descriptor differs.',
      );
      next += 12;
    }
    const compressed = archive.subarray(start, endData);
    let body;
    if (entry.method === 0) body = Buffer.from(compressed);
    else {
      const result = inflateRawSync(compressed, {
        maxOutputLength: Math.max(1, entry.size),
        info: true,
      });
      check(
        result.engine.bytesWritten === compressed.length,
        'Trailing compressed ZIP data is forbidden.',
      );
      body = result.buffer;
    }
    check(
      body.length === entry.size && crc32(body) === entry.crc,
      'ZIP expanded size or CRC differs.',
    );
    entry.body = body;
    previousEnd = next;
  }
  check(previousEnd === centralOffset, 'Unlisted ZIP data is forbidden.');
  return entries.map(({ name, directory, body }) => ({
    name,
    directory,
    body,
  }));
}

export async function verifyArtifactArchive({ archive, selection, signal }) {
  signal?.throwIfAborted();
  validateArtifactSelection(selection);
  check(
    sha256(archive) === selection.artifactDigest,
    'Downloaded artifact archive digest differs from the selected receipt.',
  );
  const entries = inspectArtifactZip(archive);
  const root = path.join(outputRoot, 'releases');
  await mkdir(root, { recursive: true });
  check(
    (await realpath(root)) === root,
    'Release extraction root must not resolve through links.',
  );
  const directory = await mkdtemp(path.join(root, 'artifact-'));
  try {
    for (const entry of entries) {
      signal?.throwIfAborted();
      const filename = within(
        directory,
        path.join(directory, ...entry.name.split('/')),
      );
      await mkdir(entry.directory ? filename : path.dirname(filename), {
        recursive: true,
      });
      if (!entry.directory)
        await writeFile(filename, entry.body, { flag: 'wx', mode: 0o600 });
    }
    signal?.throwIfAborted();
    const verified = await verifyDeliveryBundle({
      directory,
      repository,
      sourceSha: selection.sourceSha,
      runId: selection.runId,
      runAttempt: selection.runAttempt,
      origin: selection.origin,
      expectedEnvelopeSha256: selection.envelopeSha256,
    });
    signal?.throwIfAborted();
    return verified;
  } catch (error) {
    // Only this newly allocated directory is eligible for local cleanup.
    const cleanup = path.resolve(directory);
    check(
      path.dirname(cleanup) === root &&
        /^artifact-[A-Za-z0-9]+$/.test(path.basename(cleanup)) &&
        (await realpath(cleanup)) === cleanup,
      'Unsafe extraction cleanup target.',
    );
    await rm(cleanup, { recursive: true, force: true });
    throw error;
  }
}

export async function readSelectedArtifact({
  selection,
  token,
  transport,
  now = Date.now(),
  timeoutMs = 90000,
}) {
  validateArtifactSelection(selection);
  check(
    typeof token === 'string' && /^[A-Za-z0-9_.-]{20,512}$/.test(token),
    'Explicit GitHub read credential is required.',
  );
  check(
    transport?.request &&
      Number.isFinite(now) &&
      Number.isInteger(timeoutMs) &&
      timeoutMs > 0 &&
      timeoutMs <= 120000,
    'Explicit bounded reader transport is required.',
  );
  const controller = new AbortController();
  let timer;
  const timedOut = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Artifact reader deadline exceeded.'));
    }, timeoutMs);
  });
  async function request(url, storage = false) {
    controller.signal.throwIfAborted();
    safeUrl(url, storage);
    const headers = storage
      ? { 'Accept-Encoding': 'identity' }
      : {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10',
          Authorization: 'Bearer ' + token,
          'Accept-Encoding': 'identity',
        };
    const response = await transport.request(url, {
      method: 'GET',
      headers,
      redirect: 'manual',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    controller.signal.throwIfAborted();
    check(
      !response.redirected && (!response.url || response.url === url),
      'Transport followed an unreviewed redirect.',
    );
    return response;
  }
  async function metadata(url) {
    const response = await request(url);
    check(response.status === 200, 'Selected GitHub metadata is unavailable.');
    return JSON.parse(
      (await bodyBytes(response, 1024 * 1024, controller.signal)).toString(
        'utf8',
      ),
    );
  }
  try {
    return await Promise.race([
      timedOut,
      (async () => {
        const run = await metadata(
          `${apiRoot}/actions/runs/${selection.runId}/attempts/${selection.runAttempt}`,
        );
        const workflow = await metadata(
          `${apiRoot}/actions/workflows/package.yml`,
        );
        const artifact = await metadata(
          `${apiRoot}/actions/artifacts/${selection.artifactId}`,
        );
        validateMetadata(run, workflow, artifact, selection, now);
        const response = await request(
          `${apiRoot}/actions/artifacts/${selection.artifactId}/zip`,
        );
        check(
          response.status === 302,
          'Expected an authenticated archive redirect.',
        );
        const location = response.headers.get('location');
        check(location, 'Archive redirect is missing.');
        safeUrl(location, true);
        const download = await request(location, true);
        check(
          download.status === 200,
          'Artifact storage redirect or failure is forbidden.',
        );
        const archive = await bodyBytes(
          download,
          ARTIFACT_ARCHIVE_LIMIT,
          controller.signal,
        );
        check(
          archive.length === artifact.size_in_bytes,
          'Archive length differs from official artifact metadata.',
        );
        return await verifyArtifactArchive({
          archive,
          selection,
          signal: controller.signal,
        });
      })(),
    ]);
  } catch {
    // Do not expose token headers, response text, signed query strings or upstream exceptions.
    throw new Error(
      'Selected artifact validation failed; no package is approved for publication.',
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
