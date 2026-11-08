import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { crc32 } from 'node:zlib';
import { files, projectRoot, sha256, within } from '../aws/common.mjs';
import {
  readSelectedNeonArtifact,
  validateArtifactSelection,
  validateNeonArtifactSelection,
} from '../delivery/artifact-reader.mjs';
import { syntheticNeonRelease } from './synthetic-neon-release.mjs';

function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name: filename, body } of entries) {
    const name = Buffer.from(filename);
    const crc = crc32(body);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(body.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, body);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50);
    record.writeUInt16LE(0x0314, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x0800, 8);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(body.length, 20);
    record.writeUInt32LE(body.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(0x81a40000, 38);
    record.writeUInt32LE(offset, 42);
    central.push(record, name);
    offset += header.length + name.length + body.length;
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

test('Neon reader binds successful Package Neon metadata, archive and external runtime pins', async (t) => {
  const candidate = await syntheticNeonRelease(
    t,
    {
      region: 'eu-north-1',
      accountId: '111122223333',
      resources: { origin: 'https://dtest123.cloudfront.net' },
    },
    '888888',
  );
  const entries = await Promise.all(
    (await files(candidate.directory)).map(async (name) => ({
      name,
      body: await readFile(path.join(candidate.directory, name)),
    })),
  );
  const archive = zip(entries);
  const selection = {
    ...candidate.context,
    repositoryId: '12345',
    repositoryOwnerId: '67890',
    workflowPath: '.github/workflows/package-neon.yml',
    ref: 'refs/heads/main',
    artifactId: '999999',
    artifactDigest: sha256(archive),
    manifestSha256: candidate.manifestSha256,
    release: candidate.release,
    origin: candidate.runtimeConfig.origin,
  };
  assert.equal(validateNeonArtifactSelection(selection), selection);
  assert.throws(() => validateArtifactSelection(selection));
  const token = 'ghp_synthetic_neon_reader_fixture';
  const api = 'https://api.github.com/repos/' + selection.repository;
  const storage =
    'https://fixture123.blob.core.windows.net/artifact/selected.zip?sig=synthetic';
  function fixture(patch = {}) {
    const repository = {
      id: 12345,
      full_name: selection.repository,
      owner: { id: 67890, login: 'dmytrorozhkov' },
      fork: false,
    };
    const run = {
      id: 888888,
      run_attempt: 1,
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
      run_started_at: '2026-11-08T10:00:00Z',
      updated_at: '2026-11-08T10:10:00Z',
      ...patch.run,
    };
    const workflow = {
      id: 90,
      state: 'active',
      path: selection.workflowPath,
      ...patch.workflow,
    };
    const artifact = {
      id: 999999,
      name: selection.release,
      size_in_bytes: archive.length,
      digest: 'sha256:' + selection.artifactDigest,
      expired: false,
      created_at: '2026-11-08T10:05:00Z',
      updated_at: '2026-11-08T10:06:00Z',
      expires_at: '2026-11-09T10:05:00Z',
      url: api + '/actions/artifacts/999999',
      archive_download_url: api + '/actions/artifacts/999999/zip',
      workflow_run: {
        id: 888888,
        repository_id: 12345,
        head_repository_id: 12345,
        head_sha: selection.sourceSha,
        head_branch: 'main',
      },
      ...patch.artifact,
    };
    const calls = [];
    return {
      calls,
      async request(url, options) {
        calls.push(url);
        if (url.startsWith(api))
          assert.equal(options.headers.Authorization, 'Bearer ' + token);
        else assert.equal(options.headers.Authorization, undefined);
        if (url.endsWith('/attempts/1')) return Response.json(run);
        if (url.endsWith('/workflows/package-neon.yml'))
          return Response.json(workflow);
        if (url.endsWith('/artifacts/999999')) return Response.json(artifact);
        if (url.endsWith('/999999/zip'))
          return new Response(null, {
            status: 302,
            headers: { location: patch.location ?? storage },
          });
        if (url === storage) return new Response(patch.archive ?? archive);
        assert.fail('Unexpected request.');
      },
    };
  }
  const input = {
    selection,
    runtimeConfig: candidate.runtimeConfig,
    token,
    now: Date.parse('2026-11-08T11:00:00Z'),
  };
  await t.test(
    'verified artifact extracts into an owned workspace and never calls AWS',
    async () => {
      const transport = fixture();
      const verified = await readSelectedNeonArtifact({ ...input, transport });
      t.after(() =>
        rm(
          within(
            path.join(projectRoot, '.local/neon-aws/artifacts'),
            verified.root,
          ),
          { recursive: true, force: true },
        ),
      );
      assert.equal(verified.manifestSha256, selection.manifestSha256);
      assert.equal(verified.manifest.sourceSha, selection.sourceSha);
      assert.equal(verified.manifest.release, selection.release);
      assert.equal(transport.calls.length, 5);
    },
  );
  await t.test(
    'foreign workflow, source, attempt, expiry and archive digest never approve a package',
    async () => {
      for (const patch of [
        { run: { head_sha: '4'.repeat(40) } },
        { run: { run_attempt: 2 } },
        { run: { conclusion: 'failure' } },
        { workflow: { path: '.github/workflows/package.yml' } },
        { artifact: { expired: true } },
        { artifact: { digest: 'sha256:' + '0'.repeat(64) } },
        { location: 'https://untrusted.invalid/private' },
        { archive: Buffer.alloc(archive.length) },
      ])
        await assert.rejects(
          readSelectedNeonArtifact({ ...input, transport: fixture(patch) }),
          /no package is approved/,
        );
    },
  );
  await t.test(
    'external manifest and runtime pins cannot be substituted',
    async () => {
      await assert.rejects(
        readSelectedNeonArtifact({
          ...input,
          selection: { ...selection, manifestSha256: '0'.repeat(64) },
          transport: fixture(),
        }),
      );
      await assert.rejects(
        readSelectedNeonArtifact({
          ...input,
          runtimeConfig: {
            ...candidate.runtimeConfig,
            passwordParameterVersion: 2,
          },
          transport: fixture(),
        }),
      );
      const transport = fixture();
      await assert.rejects(
        readSelectedNeonArtifact({
          ...input,
          selection: { ...selection, workflowPath: '.github/workflows/ci.yml' },
          transport,
        }),
      );
      assert.equal(transport.calls.length, 0);
    },
  );
});
