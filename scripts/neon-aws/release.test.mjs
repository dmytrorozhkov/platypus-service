import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cp,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  files,
  json,
  outputRoot,
  projectRoot,
  sha256,
  within,
} from '../aws/common.mjs';
import { verifyDeliveryBundle } from '../delivery/bundle.mjs';
import { prepareNeonRelease, verifyNeonRelease } from './release.mjs';
import { publishNeonDelivery, restoreFiles } from '../delivery/executor.mjs';

const sourceSha = '3'.repeat(40);
const config = {
  schemaVersion: 1,
  kind: 'platypus-neon-runtime',
  region: 'eu-north-1',
  accountId: '111122223333',
  origin: 'https://dtest123.cloudfront.net',
  neonHost: 'ep-offline-test-pooler.c-7.eu-central-1.aws.neon.tech',
  database: 'neondb',
  user: 'platypus_app',
  passwordParameterArn:
    'arn:aws:ssm:eu-north-1:111122223333:parameter/platypus-service/production/neon/password',
  passwordParameterVersion: 1,
};
test(
  'distinct full Neon release owns complete same-origin paged frontend and pinned backend',
  { timeout: 120000 },
  async (t) => {
    const local = path.join(projectRoot, '.local');
    await mkdir(local, { recursive: true });
    const base = await mkdtemp(path.join(local, 'neon-release-tests-'));
    const root = path.join(base, 'workspace');
    const release = 'neon-123456-1';
    await mkdir(path.join(root, 'apps/server/dist'), { recursive: true });
    await writeFile(
      path.join(root, 'package.json'),
      json({ name: '@platypus/workspace' }),
    );
    await writeFile(
      path.join(root, 'apps/server/dist/neon-lambda.js'),
      'export async function handler() { return {statusCode:503}; }',
    );
    const supportConfig = path.join(
      root,
      'apps/support/dist/browser/ticket-api-config.json',
    );
    for (const app of ['analytics', 'administration', 'support']) {
      const directory = path.join(
        root,
        'apps',
        app,
        'dist',
        app === 'support' ? 'browser' : 'remote',
      );
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, 'remoteEntry.json'),
        json({
          name: app,
          shared: [],
          exposes: [{ key: './mount', outFileName: 'mount.js' }],
        }),
      );
      await writeFile(
        path.join(directory, 'mount.js'),
        'export function mount() {}',
      );
      await writeFile(
        path.join(directory, app === 'support' ? 'styles.css' : 'style.css'),
        'body{}',
      );
      await writeFile(
        path.join(directory, 'index.html'),
        'standalone document must not be copied',
      );
      if (app === 'support')
        await writeFile(
          supportConfig,
          json({ apiBaseUrl: 'http://localhost:3001' }),
        );
    }
    const shell = path.join(root, 'apps/shell/dist/browser');
    await mkdir(shell, { recursive: true });
    await writeFile(
      path.join(shell, 'favicon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    );
    await writeFile(
      path.join(shell, 'index.html'),
      '<html><body>synthetic shell</body></html>',
    );
    await writeFile(
      path.join(shell, 'main-example.js'),
      'console.log("synthetic");',
    );
    await writeFile(
      path.join(shell, 'runtime-config.json'),
      json({ unsafeOriginal: 'must be replaced in the copy only' }),
    );
    let result;
    let count = 0;
    async function copy() {
      const copyRoot = path.join(base, 'copy-' + ++count);
      await mkdir(copyRoot);
      await writeFile(
        path.join(copyRoot, 'package.json'),
        json({ name: '@platypus/workspace' }),
      );
      const directory = path.join(
        copyRoot,
        '.local/neon-aws/releases',
        release,
      );
      await cp(result.directory, directory, {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
      return {
        root: copyRoot,
        directory,
        release,
        expectedSourceSha: sourceSha,
        expectedRuntimeConfig: config,
        expectedManifestSha256: result.manifestSha256,
      };
    }
    async function reseal(selection, changeManifest = () => {}) {
      const filename = path.join(selection.directory, 'neon-release.json');
      const value = JSON.parse(await readFile(filename, 'utf8'));
      for (const entry of value.inventory) {
        const bytes = await readFile(
          path.join(selection.directory, entry.file),
        );
        entry.bytes = bytes.length;
        entry.sha256 = sha256(bytes);
      }
      value.totalBytes = value.inventory.reduce(
        (sum, entry) => sum + entry.bytes,
        0,
      );
      changeManifest(value);
      const bytes = json(value);
      await writeFile(filename, bytes);
      selection.expectedManifestSha256 = sha256(bytes);
    }
    try {
      await t.test(
        'packages all frontend graphs, unchanged source builds and exact nested backend',
        async () => {
          result = await prepareNeonRelease({
            root,
            release,
            sourceSha,
            runtimeConfig: config,
          });
          assert.equal(result.manifest.kind, 'platypus-neon-release-candidate');
          assert.deepEqual(Object.keys(result.manifest.apps).sort(), [
            'administration',
            'analytics',
            'shell',
            'support',
          ]);
          assert.equal(
            await readFile(supportConfig, 'utf8'),
            json({ apiBaseUrl: 'http://localhost:3001' }),
          );
          assert.equal(
            await readFile(
              path.join(
                result.directory,
                'objects/mfe/support',
                release,
                'ticket-api-config.json',
              ),
              'utf8',
            ),
            json({ apiBaseUrl: config.origin, queryMode: 'paged' }),
          );
          assert(
            !result.manifest.objects.some(
              (entry) =>
                entry.key.startsWith('mfe/') && entry.key.endsWith('.html'),
            ),
          );
          await verifyNeonRelease({
            root,
            release,
            expectedSourceSha: sourceSha,
            expectedRuntimeConfig: config,
            expectedManifestSha256: result.manifestSha256,
          });
        },
      );
      await t.test(
        'Neon publication checks package pins before cloud access',
        async () => {
          const account = config.accountId;
          const functionArn = `arn:aws:lambda:eu-north-1:${account}:function:offline-backend`;
          const target = {
            project: 'platypus-service',
            region: config.region,
            accountId: account,
            ownershipVerified: true,
            serviceRoleArn: `arn:aws:iam::${account}:role/offline-cfn`,
            lambdaExecutionRoleArn: `arn:aws:iam::${account}:role/offline-lambda`,
            concurrency: {
              mode: 'account-cap-ten',
              acceptedSharedAccountCap: true,
            },
            stacks: Object.fromEntries(
              ['storage', 'backend', 'edge'].map((kind) => [
                kind,
                `arn:aws:cloudformation:eu-north-1:${account}:stack/platypus-test-${kind}/offline`,
              ]),
            ),
            resources: {
              bucket: 'offline-artifacts',
              bucketDomain: 'offline-artifacts.s3.eu-north-1.amazonaws.com',
              functionArn,
              aliasArn: functionArn + ':live',
              functionUrl: 'https://offline.lambda-url.eu-north-1.on.aws/',
              distributionId: 'DTEST123456',
              origin: config.origin,
            },
          };
          const context = {
            repository: 'dmytrorozhkov/platypus-service',
            sourceSha,
            runId: '123456',
            runAttempt: '1',
          };
          let calls = 0;
          const stop = new Error('Offline preflight boundary');
          const transport = {
            async request(service, operation) {
              calls += 1;
              assert.equal(service, 'sts');
              assert.equal(operation, 'get-caller-identity');
              throw stop;
            },
            async getObject() {
              calls += 1;
              assert.fail('Unexpected object read.');
            },
            async putObject() {
              calls += 1;
              assert.fail('Unexpected object write.');
            },
          };
          const input = {
            root,
            release,
            runtimeConfig: config,
            manifestSha256: result.manifestSha256,
            target,
            context,
            transport,
            liveCheck: async () => ({
              success: true,
              kind: 'platypus-neon-live-check',
              origin: config.origin,
            }),
          };
          await assert.rejects(
            publishNeonDelivery(input),
            (error) => error === stop,
          );
          assert.equal(calls, 1);

          for (const override of [
            { manifestSha256: '0'.repeat(64) },
            { context: { ...context, sourceSha: '4'.repeat(40) } },
            { runtimeConfig: { ...config, passwordParameterVersion: 2 } },
            { release: 'neon-123456-2' },
            { liveCheck: undefined },
            { allowNeonTransition: 'yes' },
          ]) {
            calls = 0;
            await assert.rejects(
              publishNeonDelivery({ ...input, ...override }),
            );
            assert.equal(calls, 0);
          }
        },
      );
      await t.test(
        'requires external source/config/manifest pins and never overwrites',
        async () => {
          await assert.rejects(
            verifyNeonRelease({
              root,
              release,
              expectedSourceSha: sourceSha,
              expectedRuntimeConfig: config,
            }),
            /Externally selected/,
          );
          await assert.rejects(
            verifyNeonRelease({
              root,
              release,
              expectedSourceSha: '4'.repeat(40),
              expectedRuntimeConfig: config,
              expectedManifestSha256: result.manifestSha256,
            }),
            /source differs/,
          );
          await assert.rejects(
            verifyNeonRelease({
              root,
              release,
              expectedSourceSha: sourceSha,
              expectedRuntimeConfig: { ...config, passwordParameterVersion: 2 },
              expectedManifestSha256: result.manifestSha256,
            }),
          );
          await assert.rejects(
            prepareNeonRelease({
              root,
              release,
              sourceSha,
              runtimeConfig: config,
            }),
            /EEXIST/,
          );
          await assert.rejects(
            prepareNeonRelease({
              root,
              release: '../unsafe',
              sourceSha,
              runtimeConfig: config,
            }),
            /Bounded Neon release/,
          );
        },
      );
      await t.test(
        'refuses extra/missing/changed frontend and nested backend bytes',
        async () => {
          const extra = await copy();
          await writeFile(path.join(extra.directory, 'extra.json'), '{}');
          await assert.rejects(
            verifyNeonRelease(extra),
            /changed, missing or extra/,
          );
          const missing = await copy();
          await rm(path.join(missing.directory, 'objects/main-example.js'));
          await assert.rejects(
            verifyNeonRelease(missing),
            /changed, missing or extra/,
          );
          const backend = await copy();
          await writeFile(
            path.join(backend.directory, 'backend/backend.zip'),
            'corrupt',
          );
          await assert.rejects(
            verifyNeonRelease(backend),
            /changed, missing or extra/,
          );
        },
      );
      await t.test(
        'refuses resealed Support query mode/origin drift and frontend graph metadata drift',
        async () => {
          const selection = await copy();
          const relative = `objects/mfe/support/${release}/ticket-api-config.json`;
          const changedBytes = json({
            apiBaseUrl: config.origin,
            queryMode: 'fixture',
          });
          await writeFile(
            path.join(selection.directory, relative),
            changedBytes,
          );
          await reseal(selection, (value) => {
            const object = value.objects.find(
              (entry) => entry.file === relative,
            );
            object.bytes = Buffer.byteLength(changedBytes);
            object.sha256 = sha256(changedBytes);
            const graph = value.objects.filter(
              (entry) => entry.app === 'support',
            );
            value.apps.support.objects = graph.map((entry) => ({
              key: entry.key,
              sha256: entry.sha256,
            }));
            value.apps.support.graphSha256 = sha256(
              json(
                graph.map((entry) => ({
                  file: entry.key.slice(`mfe/support/${release}/`.length),
                  sha256: entry.sha256,
                })),
              ),
            );
          });
          await assert.rejects(
            verifyNeonRelease(selection),
            /same-origin paged API/,
          );
          const refs = await copy();
          await reseal(refs, (value) => {
            value.references.analytics.remoteEntryUrl =
              'https://other.invalid/remoteEntry.json';
          });
          await assert.rejects(
            verifyNeonRelease(refs),
            /origin\/reference differs/,
          );
        },
      );
      await t.test(
        'existing fixture publisher refuses new manifest even at a fixture release path',
        async () => {
          const runId = String(Date.now());
          const fixtureRelease = `gh-${runId}-1-${sourceSha.slice(0, 12)}`;
          const directory = within(
            path.join(outputRoot, 'releases'),
            path.join(outputRoot, 'releases', fixtureRelease),
          );
          await mkdir(path.dirname(directory), { recursive: true });
          try {
            await cp(result.directory, directory, {
              recursive: true,
              errorOnExist: true,
              force: false,
            });
            // The legacy publisher must reject without ever considering these bytes a fixture package.
            await assert.rejects(
              verifyDeliveryBundle({
                directory,
                repository: 'dmytrorozhkov/platypus-service',
                sourceSha,
                runId,
                runAttempt: '1',
                origin: config.origin,
              }),
              /envelope is required/,
            );
          } finally {
            assert.equal(
              path.dirname(directory),
              path.join(outputRoot, 'releases'),
            );
            assert.equal(path.basename(directory), fixtureRelease);
            await rm(directory, { recursive: true, force: true });
          }
        },
      );
      await t.test(
        'refuses empty extra directories, path graph aliases and oversized files',
        async () => {
          const empty = await copy();
          await mkdir(path.join(empty.directory, 'empty-extra'));
          await assert.rejects(
            verifyNeonRelease(empty),
            /empty release directory/,
          );
          const alias = await copy();
          await reseal(alias, (manifest) => {
            manifest.objects[0].file = 'objects/../owner.json';
          });
          await assert.rejects(verifyNeonRelease(alias));
          const huge = await copy();
          const handle = await open(
            path.join(huge.directory, 'oversized.bin'),
            'wx',
          );
          await handle.truncate(32 * 1024 * 1024 + 1);
          await handle.close();
          await assert.rejects(verifyNeonRelease(huge), /32 MiB/);
        },
      );
      await t.test(
        'CLI accepts no credentials, profile, AWS execution or arbitrary output options',
        () => {
          const canary = 'PUBLIC-FAKE-RELEASE-CANARY';
          const output = spawnSync(
            process.execPath,
            [
              path.join(projectRoot, 'scripts/neon-aws/release.mjs'),
              'prepare',
              '--output',
              canary,
            ],
            { encoding: 'utf8', windowsHide: true },
          );
          assert.equal(output.status, 1);
          assert(
            !output.stdout.includes(canary) && !output.stderr.includes(canary),
          );
          assert.match(output.stderr, /no publication was attempted/);
        },
      );
      await t.test(
        'restores a pinned Neon candidate using only stored-object reads',
        async () => {
          const stored = new Map(
            await Promise.all(
              (await files(result.directory)).map(async (file) => [
                file,
                await readFile(path.join(result.directory, file)),
              ]),
            ),
          );
          const record = {
            release,
            provenance: 'github',
            context: { sourceSha },
            manifest: result.manifest,
            manifestSha256: result.manifestSha256,
            inventory: [...stored].map(([file, body]) => ({
              file,
              bytes: body.length,
              sha256: sha256(body),
            })),
          };
          const target = {
            accountId: config.accountId,
            region: config.region,
            resources: {
              bucket: 'offline-recovery-fixture',
              origin: config.origin,
            },
          };
          let reads = 0;
          const transport = {
            async getObject(input) {
              assert.equal(input.Bucket, target.resources.bucket);
              assert.equal(input.ExpectedBucketOwner, config.accountId);
              const prefix = `_releases/delivery/files/${release}/`;
              assert(input.Key.startsWith(prefix));
              const body = stored.get(input.Key.slice(prefix.length));
              assert(Buffer.isBuffer(body));
              reads++;
              return {
                body,
                ETag: '"offline-fixture"',
                ChecksumSHA256: Buffer.from(sha256(body), 'hex').toString(
                  'base64',
                ),
              };
            },
            async putObject() {
              assert.fail('Recovery verification must not write to AWS.');
            },
            async request() {
              assert.fail('Recovery verification must not call AWS services.');
            },
          };
          let restored;
          try {
            restored = await restoreFiles(transport, target, record);
            assert.deepEqual(restored.value, result.manifest);
            assert.equal(reads, stored.size);
            assert.deepEqual(
              JSON.parse(
                await readFile(
                  path.join(restored.directory, 'backend/runtime.json'),
                  'utf8',
                ),
              ),
              config,
            );
          } finally {
            if (restored) {
              const parent = path.join(outputRoot, 'recovery');
              const recoveryRoot = within(
                parent,
                path.resolve(restored.directory, '../../../..'),
              );
              assert.equal(path.dirname(recoveryRoot), parent);
              assert(path.basename(recoveryRoot).startsWith('restore-'));
              await rm(recoveryRoot, { recursive: true, force: true });
            }
          }
        },
      );
    } finally {
      assert.equal(path.dirname(base), local);
      assert(path.basename(base).startsWith('neon-release-tests-'));
      within(local, base);
      await rm(base, { recursive: true, force: true });
    }
  },
);
