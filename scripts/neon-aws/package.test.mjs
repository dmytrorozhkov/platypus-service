import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cp,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { json, projectRoot, sha256, within } from '../aws/common.mjs';
import { computeNeonBackendRevision } from './templates.mjs';
import {
  prepareNeonCandidate,
  verifyNeonCandidate,
  NEON_CANDIDATE_LIMIT,
} from './package.mjs';

const sourceSha = '1'.repeat(40);
const runtimeConfig = () => ({
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
});
const fakeEntry = `
import pg from 'pg';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
export const dependencyTypes = [typeof pg.Pool, typeof SSMClient, typeof GetParameterCommand];
export async function handler() { return {statusCode: 503, body: JSON.stringify({error: {code: 'UNAVAILABLE'}})}; }
`;

test(
  'offline Neon candidate exact identity, ZIP, dependencies and refusal boundaries',
  { timeout: 120000 },
  async (t) => {
    const local = path.join(projectRoot, '.local');
    await mkdir(local, { recursive: true });
    const base = await mkdtemp(path.join(local, 'neon-package-tests-'));
    const root = path.join(base, 'workspace');
    const candidate = 'synthetic-candidate';
    const config = runtimeConfig();
    await mkdir(path.join(root, 'apps/server/dist'), { recursive: true });
    await writeFile(
      path.join(root, 'package.json'),
      json({ name: '@platypus/workspace' }),
    );
    await writeFile(
      path.join(root, 'apps/server/dist/neon-lambda.js'),
      fakeEntry,
    );
    let result;
    let number = 0;
    async function copy() {
      const duplicateRoot = path.join(base, 'copy-' + ++number);
      await mkdir(duplicateRoot);
      await writeFile(
        path.join(duplicateRoot, 'package.json'),
        json({ name: '@platypus/workspace' }),
      );
      const directory = path.join(
        duplicateRoot,
        '.local/neon-aws/candidates',
        candidate,
      );
      await cp(result.directory, directory, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
      return {
        root: duplicateRoot,
        directory,
        candidate,
        expectedSourceSha: sourceSha,
        expectedRuntimeConfig: config,
        expectedManifestSha256: result.manifestSha256,
      };
    }
    async function reseal(selection, changeManifest = () => {}) {
      const filename = path.join(selection.directory, 'neon-candidate.json');
      const value = JSON.parse(await readFile(filename, 'utf8'));
      for (const item of value.inventory) {
        const bytes = await readFile(path.join(selection.directory, item.file));
        item.bytes = bytes.length;
        item.sha256 = sha256(bytes);
      }
      value.totalBytes = value.inventory.reduce(
        (sum, item) => sum + item.bytes,
        0,
      );
      changeManifest(value);
      const bytes = json(value);
      await writeFile(filename, bytes);
      selection.expectedManifestSha256 = sha256(bytes);
    }
    try {
      await t.test(
        'bundles and validates pure JavaScript pg/SDK without cloud I/O or native dependencies',
        async () => {
          result = await prepareNeonCandidate({
            root,
            candidate,
            sourceSha,
            runtimeConfig: config,
          });
          assert.equal(result.manifest.kind, 'platypus-neon-backend-candidate');
          assert.equal(result.manifest.runtimeVariant, 'neon-postgres-ssm-v1');
          assert(result.totalBytes < NEON_CANDIDATE_LIMIT);
          const module = await import(
            pathToFileURL(
              path.join(result.directory, 'lambda-extracted/lambda.js'),
            ).href
          );
          assert.deepEqual(module.dependencyTypes, [
            'function',
            'function',
            'function',
          ]);
          assert.equal((await module.handler()).statusCode, 503);
          assert.deepEqual(
            (
              await verifyNeonCandidate({
                root,
                candidate,
                expectedSourceSha: sourceSha,
                expectedRuntimeConfig: config,
                expectedManifestSha256: result.manifestSha256,
              })
            ).manifest,
            result.manifest,
          );
        },
      );
      await t.test(
        'requires externally selected source, configuration and manifest; rejects secrets and traversal before output',
        async () => {
          await assert.rejects(
            verifyNeonCandidate({
              root,
              candidate,
              expectedSourceSha: sourceSha,
              expectedRuntimeConfig: config,
            }),
            /Externally selected/,
          );
          await assert.rejects(
            verifyNeonCandidate({
              root,
              candidate,
              expectedSourceSha: '2'.repeat(40),
              expectedRuntimeConfig: config,
              expectedManifestSha256: result.manifestSha256,
            }),
            /source differs/,
          );
          await assert.rejects(
            verifyNeonCandidate({
              root,
              candidate,
              expectedSourceSha: sourceSha,
              expectedRuntimeConfig: { ...config, passwordParameterVersion: 2 },
              expectedManifestSha256: result.manifestSha256,
            }),
            /configuration differs/,
          );
          await assert.rejects(
            prepareNeonCandidate({
              root,
              candidate: '../escape',
              sourceSha,
              runtimeConfig: config,
            }),
            /Bounded candidate/,
          );
          await assert.rejects(
            prepareNeonCandidate({
              root,
              candidate: 'secret',
              sourceSha,
              runtimeConfig: { ...config, password: 'PUBLIC-FAKE-MUST-REFUSE' },
            }),
          );
          await assert.rejects(
            prepareNeonCandidate({
              root,
              candidate: 'placeholder',
              sourceSha: '0'.repeat(40),
              runtimeConfig: config,
            }),
            /Placeholder source/,
          );
        },
      );
      await t.test(
        'never overwrites a candidate and never accepts hidden extra, missing or linked entries',
        async () => {
          await assert.rejects(
            prepareNeonCandidate({
              root,
              candidate,
              sourceSha,
              runtimeConfig: config,
            }),
            /EEXIST/,
          );
          const extra = await copy();
          await writeFile(path.join(extra.directory, '.secret'), 'public fake');
          await assert.rejects(verifyNeonCandidate(extra), /Unsafe candidate/);
          const missing = await copy();
          await rm(
            path.join(missing.directory, 'lambda-extracted/package.json'),
          );
          await assert.rejects(
            verifyNeonCandidate(missing),
            /inventory differs/,
          );
          const hard = await copy();
          await link(
            path.join(hard.directory, 'lambda/lambda.js'),
            path.join(hard.directory, 'extra.js'),
          );
          await assert.rejects(verifyNeonCandidate(hard), /unlinked entries/);
          const extraDirectory = await copy();
          await mkdir(path.join(extraDirectory.directory, 'unexpected'));
          await assert.rejects(
            verifyNeonCandidate(extraDirectory),
            /Unexpected candidate directory/,
          );
        },
      );
      await t.test(
        'rejects modified archive, prepared copy and extracted copy',
        async () => {
          for (const name of [
            'backend.zip',
            'lambda/lambda.js',
            'lambda-extracted/lambda.js',
          ]) {
            const selection = await copy();
            const filename = path.join(selection.directory, name);
            await writeFile(
              filename,
              Buffer.concat([await readFile(filename), Buffer.from('CORRUPT')]),
            );
            await assert.rejects(
              verifyNeonCandidate(selection),
              /changed, missing or extra/,
            );
          }
        },
      );
      await t.test(
        'rejects resealed config, template, owner and module-type drift against external expectations',
        async () => {
          for (const [name, message] of [
            ['runtime.json', /configuration differs/],
            ['backend-template.json', /template differs/],
            ['owner.json', /owner marker differs/],
            ['lambda/package.json', /module package differs/],
          ]) {
            const selection = await copy();
            await writeFile(path.join(selection.directory, name), '{}\n');
            await reseal(selection);
            await assert.rejects(verifyNeonCandidate(selection), message);
          }
          const manifest = await copy();
          await reseal(manifest, (value) => {
            value.runtimeVariant = 'fixture';
          });
          await assert.rejects(
            verifyNeonCandidate(manifest),
            /runtime variant differs/,
          );
        },
      );
      await t.test(
        'parses corrupt ZIP even when all public manifest/inventory archive hashes are recomputed',
        async () => {
          const selection = await copy();
          const filename = path.join(selection.directory, 'backend.zip');
          const archive = await readFile(filename);
          archive[0] ^= 1;
          await writeFile(filename, archive);
          await reseal(selection, (value) => {
            value.archiveSha256 = sha256(archive);
            value.codeSha256 = Buffer.from(value.archiveSha256, 'hex').toString(
              'base64',
            );
            value.backendRevision = computeNeonBackendRevision(
              config,
              value.codeSha256,
            );
          });
          await assert.rejects(verifyNeonCandidate(selection), /ZIP/);
        },
      );
      await t.test(
        'CLI rejects missing/repeated/arbitrary options without echoing inputs or ambient credentials',
        () => {
          const canary = 'PUBLIC-FAKE-CLI-CANARY';
          const output = spawnSync(
            process.execPath,
            [
              path.join(projectRoot, 'scripts/neon-aws/package.mjs'),
              'prepare',
              '--profile',
              canary,
            ],
            {
              encoding: 'utf8',
              windowsHide: true,
              env: { ...process.env, NEON_PASSWORD: canary },
            },
          );
          assert.equal(output.status, 1);
          assert(
            !output.stdout.includes(canary) && !output.stderr.includes(canary),
          );
          assert.match(output.stderr, /no publication was attempted/);
        },
      );
    } finally {
      assert.equal(path.dirname(base), local);
      assert(path.basename(base).startsWith('neon-package-tests-'));
      within(local, base);
      await rm(base, { recursive: true, force: true });
    }
  },
);

test(
  'actual compiled Lambda bundle imports inertly and supports injected paged cold/warm/failure/recovery',
  { timeout: 60000 },
  async () => {
    const candidate = 'bundle-smoke-' + Date.now().toString(36);
    const config = runtimeConfig();
    const prepared = await prepareNeonCandidate({
      candidate,
      sourceSha,
      runtimeConfig: config,
    });
    const candidateParent = path.join(
      path.resolve(projectRoot),
      '.local/neon-aws/candidates',
    );
    let handler;
    try {
      const module = await import(
        pathToFileURL(
          path.join(prepared.directory, 'lambda-extracted/lambda.js'),
        ).href
      );
      assert.equal(typeof module.handler, 'function');
      assert.equal(typeof module.createNeonLambdaHandler, 'function');
      assert.equal((await module.handler({})).statusCode, 500);
      const environment = {
        AWS_REGION: config.region,
        ALLOWED_ORIGINS: config.origin,
        NEON_HOST: config.neonHost,
        NEON_CONFIRM_TARGET: config.neonHost + '/neondb',
        NEON_DATABASE: 'neondb',
        NEON_USER: 'platypus_app',
        NEON_PASSWORD_PARAMETER_ARN: config.passwordParameterArn,
        NEON_PASSWORD_PARAMETER_VERSION: '1',
      };
      const accepted = {
        version_num: '180006',
        encoding: 'UTF8',
        read_only: 'on',
        database_name: 'neondb',
        database_user: 'platypus_app',
        session_user_name: 'platypus_app',
        can_login: true,
        superuser: false,
        create_database: false,
        create_role: false,
        replication: false,
        bypass_rls: false,
        inherit: false,
        has_memberships: false,
        owns_database: false,
        owns_schema: false,
        owns_business_table: false,
        schema_usage: true,
        schema_create: false,
        database_create: false,
        business_select: true,
        business_write: false,
      };
      const state = {
        secrets: 0,
        connections: 0,
        probes: 0,
        closes: 0,
        fail: false,
      };
      handler = module.createNeonLambdaHandler({
        environment,
        getPassword: async () => {
          state.secrets++;
          return 'PUBLIC-FAKE-APP-PASSWORD-32-ONLY';
        },
        createConnection: () => {
          state.connections++;
          return {
            async query(sql, values) {
              if (sql.includes('AS version_num')) {
                state.probes++;
                return { rows: [{ ...accepted }] };
              }
              if (state.fail) {
                state.fail = false;
                throw new Error('PUBLIC-FAKE-DRIVER-CANARY');
              }
              assert.deepEqual(values, [25, 0]);
              return {
                rows: [
                  {
                    items: [
                      {
                        number: 'PS-1001',
                        subject: 'Offline bundled example',
                        organization: 'Example organization',
                        status: 'New',
                        assignee: null,
                        created_at: '2026-11-01T00:00:00.000Z',
                        updated_at: '2026-11-01T00:00:00.000Z',
                      },
                    ],
                    total: '100000',
                  },
                ],
              };
            },
            async close() {
              state.closes++;
            },
          };
        },
      });
      const event = {
        version: '2.0',
        rawPath: '/api/tickets/query',
        rawQueryString: '',
        requestContext: { http: { method: 'GET' } },
        headers: { origin: config.origin },
      };
      const context = () => ({
        invokedFunctionArn: `arn:aws:lambda:eu-north-1:${config.accountId}:function:platypus:live`,
        getRemainingTimeInMillis: () => 30000,
      });
      assert.equal(state.secrets, 0);
      for (let invocation = 0; invocation < 2; invocation++) {
        const response = await handler(event, context());
        assert.equal(response.statusCode, 200);
        assert.equal(JSON.parse(response.body).total, 100000);
        assert.equal(response.headers['cache-control'], 'no-store');
      }
      assert.deepEqual(
        [state.secrets, state.connections, state.probes],
        [1, 1, 1],
      );
      state.fail = true;
      const failed = await handler(event, context());
      assert.equal(failed.statusCode, 500);
      assert(!failed.body.includes('PUBLIC-FAKE-DRIVER-CANARY'));
      assert.equal(state.closes, 1);
      assert.equal((await handler(event, context())).statusCode, 200);
      assert.deepEqual(
        [state.secrets, state.connections, state.probes],
        [2, 2, 2],
      );
      await handler.close();
      handler = undefined;
      assert.equal(state.closes, 2);
    } finally {
      await handler?.close();
      assert.equal(path.dirname(prepared.directory), candidateParent);
      assert.equal(path.basename(prepared.directory), candidate);
      within(candidateParent, prepared.directory);
      await rm(prepared.directory, { recursive: true, force: true });
    }
  },
);
