import assert from 'node:assert/strict';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { crc32, deflateRawSync } from 'node:zlib';
import {
  cacheControl,
  contentType,
  json,
  outputRoot,
  project,
  remotes,
  sha256,
} from '../aws/common.mjs';
import {
  createGithubHttpTransport,
  inspectArtifactZip,
  readSelectedArtifact,
  validateArtifactSelection,
  verifyArtifactArchive,
} from './artifact-reader.mjs';

const repo = 'dmytrorozhkov/platypus-service';
const api = 'https://api.github.com/repos/' + repo;
const clock = Date.parse('2026-11-05T13:00:00Z');
const token = 'ghp_offline_artifact_reader_fixture';
const selection = {
  repository: repo,
  repositoryId: '12345',
  repositoryOwnerId: '67890',
  workflowPath: '.github/workflows/package.yml',
  ref: 'refs/heads/main',
  sourceSha: 'c'.repeat(40),
  runId: '987654321',
  runAttempt: '2',
  artifactId: '432198765',
  release: 'gh-987654321-2-cccccccccccc',
  origin: 'https://dartifactfixture.cloudfront.net',
};
const created = new Set();

function zip(entries, descriptor = true) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const item of entries) {
    const name = Buffer.from(item.name);
    const body = Buffer.from(item.body ?? 'fixture');
    const method = item.method ?? 8;
    const compressed = method === 0 ? body : deflateRawSync(body);
    const flags = item.flags ?? (descriptor ? 0x0808 : 0x0800);
    const crc = crc32(body);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(flags, 6);
    header.writeUInt16LE(method, 8);
    if (!(flags & 8)) {
      header.writeUInt32LE(crc, 14);
      header.writeUInt32LE(compressed.length, 18);
      header.writeUInt32LE(body.length, 22);
    }
    header.writeUInt16LE(name.length, 26);
    const extra = item.extra ?? Buffer.alloc(0);
    header.writeUInt16LE(extra.length, 28);
    const tail = Buffer.alloc(flags & 8 ? 16 : 0);
    if (tail.length) {
      tail.writeUInt32LE(0x08074b50);
      tail.writeUInt32LE(crc, 4);
      tail.writeUInt32LE(compressed.length, 8);
      tail.writeUInt32LE(body.length, 12);
    }
    local.push(header, name, extra, compressed, tail);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50);
    record.writeUInt16LE(0x0314, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(flags, 8);
    record.writeUInt16LE(method, 10);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(compressed.length, 20);
    record.writeUInt32LE(item.size ?? body.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt16LE(extra.length, 30);
    record.writeUInt32LE(
      item.attributes ??
        (item.name.endsWith('/') ? 0x41ed0010 : 0x81a40000) >>> 0,
      38,
    );
    record.writeUInt32LE(offset, 42);
    central.push(record, name, extra);
    offset +=
      header.length +
      name.length +
      extra.length +
      compressed.length +
      tail.length;
  }
  const records = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(records.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, records, end]);
}

function fullArchive() {
  const map = new Map();
  const objects = [];
  const apps = {};
  const references = {};
  function object(key, body, app) {
    const bytes = Buffer.from(body);
    const file = 'objects/' + key;
    map.set(file, bytes);
    objects.push({
      key,
      file,
      bytes: bytes.length,
      sha256: sha256(bytes),
      contentType: contentType(key),
      cacheControl: cacheControl(key),
      app,
    });
  }
  for (const app of remotes) {
    const prefix = `mfe/${app}/${selection.release}/`;
    const graph = [];
    for (const [name, body] of [
      [
        'remoteEntry.json',
        json({
          name: app,
          shared: [],
          exposes: [{ key: './mount', outFileName: 'mount.js' }],
        }),
      ],
      ['mount.js', 'export function mount() {}\n'],
      [app === 'support' ? 'styles.css' : 'style.css', '/* fixture */\n'],
    ]) {
      object(prefix + name, body, app);
      graph.push({ file: name, sha256: sha256(body) });
    }
    apps[app] = {
      release: selection.release,
      graphSha256: sha256(json(graph)),
      objects: graph.map((item) => ({
        key: prefix + item.file,
        sha256: item.sha256,
      })),
    };
    references[app] = {
      contractVersion: 1,
      exposedModule: './mount',
      remoteEntryUrl: selection.origin + '/' + prefix + 'remoteEntry.json',
      cssUrls: [
        selection.origin +
          '/' +
          prefix +
          (app === 'support' ? 'styles.css' : 'style.css'),
      ],
    };
  }
  const shell = [
    ['index.html', '<html>fixture</html>\n'],
    ['main-fixture.js', 'export {};\n'],
    ['favicon.svg', '<svg/>\n'],
  ];
  for (const [name, body] of shell) object(name, body, 'shell');
  apps.shell = {
    release: selection.release,
    graphSha256: sha256(
      json(shell.map(([file, body]) => ({ file, sha256: sha256(body) }))),
    ),
  };
  const pointer = json({ schemaVersion: 1, remotes: references });
  object('runtime-config.json', pointer, 'configuration');
  object(
    `_releases/${selection.release}/runtime-config.json`,
    pointer,
    'rollback',
  );
  object(`_releases/${selection.release}/index.html`, shell[0][1], 'rollback');
  const lambda = [
    ['lambda.js', 'export async function handler() {}\n'],
    ['ticket-application.js', 'export {};\n'],
    ['ticket-query.js', 'export {};\n'],
    ['ticket-repository.js', 'export {};\n'],
    ['fixtures/tickets.json', '[]\n'],
    ['package.json', json({ private: true, type: 'module' })],
  ];
  const backend = zip(
    lambda.map(([name, body]) => ({ name, body })),
    false,
  );
  map.set('backend.zip', backend);
  object(`_deploy/backend/${selection.release}.zip`, backend, 'backend');
  const backendFiles = {};
  for (const [name, body] of lambda) {
    map.set('lambda/' + name, Buffer.from(body));
    map.set('lambda-extracted/' + name, Buffer.from(body));
    backendFiles[name] = sha256(body);
  }
  const manifest = {
    schemaVersion: 1,
    project,
    release: selection.release,
    origin: selection.origin,
    scope: 'full',
    previous: null,
    apps,
    references,
    objects,
    backend: {
      key: `_deploy/backend/${selection.release}.zip`,
      sha256: sha256(backend),
      codeSha256: Buffer.from(sha256(backend), 'hex').toString('base64'),
      files: backendFiles,
    },
  };
  map.set(
    'owner.json',
    Buffer.from(json({ project, release: selection.release })),
  );
  map.set('manifest.json', Buffer.from(json(manifest)));
  const inventory = [...map]
    .map(([file, body]) => ({ file, bytes: body.length, sha256: sha256(body) }))
    .sort((a, b) => a.file.localeCompare(b.file));
  const envelope = json({
    schemaVersion: 1,
    project,
    repository: repo,
    sourceSha: selection.sourceSha,
    runId: selection.runId,
    runAttempt: selection.runAttempt,
    origin: selection.origin,
    release: selection.release,
    manifestSha256: sha256(json(manifest)),
    inventory,
    totalBytes: inventory.reduce((sum, item) => sum + item.bytes, 0),
  });
  map.set('bundle-envelope.json', Buffer.from(envelope));
  const archive = zip([...map].map(([name, body]) => ({ name, body })));
  return {
    archive,
    selected: {
      ...selection,
      artifactDigest: sha256(archive),
      envelopeSha256: sha256(envelope),
    },
  };
}
const fixture = fullArchive();

function fake(changes = {}) {
  const repository = {
    id: 12345,
    full_name: repo,
    owner: { id: 67890, login: 'dmytrorozhkov' },
    fork: false,
  };
  const run = {
    id: 987654321,
    run_attempt: 2,
    workflow_id: 90,
    head_sha: selection.sourceSha,
    head_branch: 'main',
    path: selection.workflowPath,
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    pull_requests: [],
    repository,
    head_repository: repository,
    run_started_at: '2026-11-05T12:00:00Z',
    updated_at: '2026-11-05T12:10:00Z',
    ...changes.run,
  };
  const workflow = {
    id: 90,
    path: selection.workflowPath,
    state: 'active',
    ...changes.workflow,
  };
  const artifact = {
    id: 432198765,
    name: selection.release,
    size_in_bytes: fixture.archive.length,
    digest: 'sha256:' + fixture.selected.artifactDigest,
    expired: false,
    created_at: '2026-11-05T12:05:00Z',
    updated_at: '2026-11-05T12:06:00Z',
    expires_at: '2026-11-06T12:05:00Z',
    url: api + '/actions/artifacts/432198765',
    archive_download_url: api + '/actions/artifacts/432198765/zip',
    workflow_run: {
      id: 987654321,
      repository_id: 12345,
      head_repository_id: 12345,
      head_sha: selection.sourceSha,
      head_branch: 'main',
    },
    ...changes.artifact,
  };
  const calls = [];
  const storage =
    changes.location ??
    'https://fixture123.blob.core.windows.net/artifact/selected.zip?sig=synthetic-private-signature';
  return {
    calls,
    request: async (url, options) => {
      calls.push({ url, options });
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'manual');
      assert.equal(options.credentials, 'omit');
      if (url.startsWith('https://api.github.com/'))
        assert.equal(options.headers.Authorization, 'Bearer ' + token);
      else assert.equal(options.headers.Authorization, undefined);
      if (url.endsWith('/attempts/2')) return Response.json(run);
      if (url.endsWith('/workflows/package.yml'))
        return Response.json(workflow);
      if (url.endsWith('/artifacts/432198765')) return Response.json(artifact);
      if (url.endsWith('/432198765/zip'))
        return new Response(null, {
          status: changes.redirectStatus ?? 302,
          headers: { location: storage },
        });
      if (url === storage)
        return (
          changes.storageResponse?.() ??
          new Response(changes.archive ?? fixture.archive, { status: 200 })
        );
      throw new Error('Unexpected external request.');
    },
  };
}

test.before(async () => {
  for (const name of await readdir(path.join(outputRoot, 'releases')).catch(
    () => [],
  ))
    if (name.startsWith('artifact-')) created.add(name);
});
test.after(async () => {
  const root = path.resolve(outputRoot, 'releases');
  for (const name of await readdir(root).catch(() => []))
    if (name.startsWith('artifact-') && !created.has(name)) {
      const directory = path.resolve(root, name);
      assert.equal(path.dirname(directory), root);
      assert.match(name, /^artifact-[A-Za-z0-9]+$/);
      await rm(directory, { recursive: true, force: true });
    }
});

test('a realistic streaming-deflate ZIP verifies the exact selected full bundle without AWS writes', async () => {
  const transport = fake();
  const result = await readSelectedArtifact({
    selection: fixture.selected,
    token,
    transport,
    now: clock,
  });
  assert.equal(result.release, selection.release);
  assert.equal(result.envelopeSha256, fixture.selected.envelopeSha256);
  assert.equal(result.manifest.scope, 'full');
  assert.equal(transport.calls.length, 5);
  assert.equal(
    transport.calls.filter((call) => call.options.headers.Authorization).length,
    4,
  );
  assert(
    transport.calls.every(
      (call) => !/amazonaws|publish|dispatch|\/latest/.test(call.url),
    ),
  );
  assert.equal(
    inspectArtifactZip(fixture.archive).length,
    result.envelope.inventory.length + 1,
  );
});

test('exact reviewed receipt fields and immutable repository identities are mandatory before any request', async () => {
  for (const patch of [
    { repository: 'someone/fork' },
    { ref: 'refs/pull/1/merge' },
    { workflowPath: '.github/workflows/ci.yml' },
    { sourceSha: 'main' },
    { runAttempt: 'latest' },
    { artifactId: '' },
    { repositoryId: '' },
    { repositoryOwnerId: '' },
    { release: 'latest' },
    { envelopeSha256: '' },
    { artifactDigest: '' },
  ]) {
    const transport = fake();
    await assert.rejects(
      readSelectedArtifact({
        selection: { ...fixture.selected, ...patch },
        token,
        transport,
        now: clock,
      }),
    );
    assert.equal(transport.calls.length, 0);
  }
  assert.throws(() => validateArtifactSelection(null));
  await assert.rejects(
    readSelectedArtifact({
      selection: fixture.selected,
      token: '',
      transport: fake(),
      now: clock,
    }),
  );
});

test('wrong run/attempt/source/workflow/repository, forks and unsuccessful or nonmanual runs fail closed', async () => {
  for (const run of [
    { id: 99 },
    { run_attempt: 1 },
    { head_sha: 'd'.repeat(40) },
    { path: '.github/workflows/ci.yml' },
    { event: 'pull_request' },
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { head_branch: 'feature' },
    { repository: { id: 1 } },
    { head_repository: { id: 2 } },
    { pull_requests: [{ number: 1 }] },
  ]) {
    const transport = fake({ run });
    await assert.rejects(
      readSelectedArtifact({
        selection: fixture.selected,
        token,
        transport,
        now: clock,
      }),
    );
    assert(transport.calls.length <= 3);
  }
  for (const workflow of [
    { id: 91 },
    { state: 'disabled_manually' },
    { path: '.github/workflows/other.yml' },
  ])
    await assert.rejects(
      readSelectedArtifact({
        selection: fixture.selected,
        token,
        transport: fake({ workflow }),
        now: clock,
      }),
    );
});

test('expired, oversized, wrong-ID/name/digest/source/time artifacts are rejected before archive download', async () => {
  for (const artifact of [
    { expired: true },
    { expires_at: '2026-11-05T12:59:59Z' },
    { size_in_bytes: 40 * 1024 * 1024 + 1 },
    { id: 9 },
    { name: 'latest' },
    { digest: 'sha256:' + '0'.repeat(64) },
    { workflow_run: { id: 1 } },
    { created_at: '2026-11-05T11:59:59Z' },
    { archive_download_url: 'https://attacker.invalid/zip' },
  ]) {
    const transport = fake({ artifact });
    await assert.rejects(
      readSelectedArtifact({
        selection: fixture.selected,
        token,
        transport,
        now: clock,
      }),
    );
    assert.equal(transport.calls.length, 3);
  }
});

test('redirects require official HTTPS artifact storage and never forward API authorization', async () => {
  for (const location of [
    'http://fixture123.blob.core.windows.net/a',
    'https://api.github.com/anything',
    'https://fixture123.blob.core.windows.net.evil.invalid/a',
    'https://user:secret@fixture123.blob.core.windows.net/a',
    'https://127.0.0.1/a',
    'https://attacker.invalid/a?sig=secret',
  ]) {
    const transport = fake({ location });
    await assert.rejects(
      readSelectedArtifact({
        selection: fixture.selected,
        token,
        transport,
        now: clock,
      }),
      (error) =>
        !error.message.includes('secret') &&
        !error.message.includes('sig=') &&
        !error.message.includes(token),
    );
    assert.equal(transport.calls.length, 4);
  }
  const transport = fake({
    storageResponse: () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://attacker.invalid/?secret=hidden' },
      }),
  });
  await assert.rejects(
    readSelectedArtifact({
      selection: fixture.selected,
      token,
      transport,
      now: clock,
    }),
  );
  assert.equal(transport.calls.length, 5);
  assert.equal(transport.calls[4].options.headers.Authorization, undefined);
});

test('archive bytes, official length and externally bound envelope each independently gate approval', async () => {
  const changed = Buffer.from(fixture.archive);
  changed[40] ^= 1;
  await assert.rejects(
    readSelectedArtifact({
      selection: fixture.selected,
      token,
      transport: fake({ archive: changed }),
      now: clock,
    }),
  );
  await assert.rejects(
    readSelectedArtifact({
      selection: fixture.selected,
      token,
      transport: fake({
        artifact: { size_in_bytes: fixture.archive.length + 1 },
      }),
      now: clock,
    }),
  );
  await assert.rejects(
    verifyArtifactArchive({
      archive: fixture.archive,
      selection: { ...fixture.selected, envelopeSha256: '0'.repeat(64) },
    }),
  );
  await assert.rejects(
    readSelectedArtifact({
      selection: fixture.selected,
      token,
      transport: fake({
        storageResponse: () =>
          new Response('x', {
            headers: { 'content-length': String(40 * 1024 * 1024 + 1) },
          }),
      }),
      now: clock,
    }),
  );
});

test('ZIP traversal, aliases, duplicate/case collisions, links, devices and unsupported fields fail', () => {
  assert.equal(
    inspectArtifactZip(
      zip(
        [
          { name: 'folder/', body: '' },
          { name: 'folder/empty', body: '', method: 0 },
        ],
        false,
      ),
    ).length,
    2,
  );
  assert.throws(() =>
    inspectArtifactZip(zip([{ name: 'folder/a' }, { name: 'FOLDER/b' }])),
  );
  for (const name of [
    '../escape',
    '/absolute',
    'C:/absolute',
    'x\\escape',
    'a/../escape',
    'a//escape',
    'con.txt',
    'a/nul',
    'a/trailing.',
    'a\0hidden',
  ])
    assert.throws(() => inspectArtifactZip(zip([{ name }])));
  for (const entries of [
    [{ name: 'a' }, { name: 'a' }],
    [{ name: 'a' }, { name: 'A' }],
    [{ name: 'a' }, { name: 'a/file' }],
    [{ name: 'a/file' }, { name: 'a' }],
    [{ name: 'link', attributes: 0xa1ff0000 >>> 0 }],
    [{ name: 'device', attributes: 0x21ff0000 >>> 0 }],
    [{ name: 'hardlink', extra: Buffer.from([0x0d, 0, 0, 0]) }],
    [{ name: 'zip64', extra: Buffer.from([1, 0, 0, 0]) }],
    [{ name: 'encrypted', flags: 0x0809 }],
    [{ name: 'method', method: 12 }],
  ])
    assert.throws(() => inspectArtifactZip(zip(entries)));
});

test('ZIP checksum, local/central mismatch, descriptor, expansion and inventory bounds fail', () => {
  const archive = zip([{ name: 'safe', body: 'hello' }]);
  for (const mutate of [
    (bytes) => bytes.writeUInt32LE(1, 14),
    (bytes) => bytes.writeUInt16LE(0, 8),
    (bytes) => {
      bytes[30] = 120;
    },
    (bytes) => {
      bytes[bytes.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08])) + 4] ^= 1;
    },
    (bytes) => bytes.writeUInt16LE(65535, bytes.length - 12),
  ]) {
    const bytes = Buffer.from(archive);
    mutate(bytes);
    assert.throws(() => inspectArtifactZip(bytes));
  }
  assert.throws(() =>
    inspectArtifactZip(
      zip([{ name: 'bomb', body: 'x', size: 32 * 1024 * 1024 + 1 }]),
    ),
  );
  assert.throws(() =>
    inspectArtifactZip(
      zip([{ name: 'bomb', body: 'x'.repeat(4096), size: 1 }]),
    ),
  );
  const corrupt = Buffer.from(archive);
  corrupt[34] ^= 0xff;
  assert.throws(() => inspectArtifactZip(corrupt));
  assert.throws(() =>
    inspectArtifactZip(Buffer.concat([archive, Buffer.from('trailing')])),
  );
});

test('a bounded reader times out and sanitizes transport errors without exposing credentials or signed queries', async () => {
  await assert.rejects(
    readSelectedArtifact({
      selection: fixture.selected,
      token,
      transport: {
        request: async () => {
          throw new Error(token + '?sig=private');
        },
      },
      now: clock,
    }),
    (error) =>
      !error.message.includes(token) && !error.message.includes('sig='),
  );
  let signal;
  await assert.rejects(
    readSelectedArtifact({
      selection: fixture.selected,
      token,
      transport: {
        request: async (_url, options) => {
          signal = options.signal;
          return new Promise(() => {});
        },
      },
      now: clock,
      timeoutMs: 5,
    }),
  );
  assert.equal(signal.aborted, true);
  const seen = [];
  const transport = createGithubHttpTransport({
    fetchImpl: async (_url, options) => {
      seen.push(options);
      return Response.json({});
    },
  });
  await transport.request('https://api.github.com/', {});
  assert.equal(seen[0].redirect, 'manual');
  assert.equal(seen[0].credentials, 'omit');
  assert.equal(seen[0].method, 'GET');
});
