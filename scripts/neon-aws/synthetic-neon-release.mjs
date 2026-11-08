import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { json, projectRoot, within } from '../aws/common.mjs';
import { prepareNeonRelease } from './release.mjs';

// Owned synthetic files only. No network or real credentials are used.
export async function syntheticNeonRelease(t, target, runId, version = 1) {
  const local = path.join(projectRoot, '.local');
  await mkdir(local, { recursive: true });
  const root = await mkdtemp(path.join(local, 'neon-publish-test-'));
  t.after(() => rm(within(local, root), { recursive: true, force: true }));
  const context = {
    repository: 'dmytrorozhkov/platypus-service',
    sourceSha: '3'.repeat(40),
    runId,
    runAttempt: '1',
  };
  const runtimeConfig = {
    schemaVersion: 1,
    kind: 'platypus-neon-runtime',
    region: target.region,
    accountId: target.accountId,
    origin: target.resources.origin,
    neonHost: 'ep-offline-test-pooler.c-7.eu-central-1.aws.neon.tech',
    database: 'neondb',
    user: 'platypus_app',
    passwordParameterArn: `arn:aws:ssm:eu-north-1:${target.accountId}:parameter/platypus-service/production/neon/password`,
    passwordParameterVersion: version,
  };
  const put = async (file, body) => {
    const destination = path.join(root, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, body);
  };
  await put('package.json', json({ name: '@platypus/workspace' }));
  await put(
    'apps/server/dist/neon-lambda.js',
    'export async function handler() { return {statusCode:503}; }',
  );
  for (const app of ['analytics', 'administration', 'support']) {
    const directory = `apps/${app}/dist/${app === 'support' ? 'browser' : 'remote'}/`;
    await put(
      directory + 'remoteEntry.json',
      json({
        name: app,
        shared: [],
        exposes: [{ key: './mount', outFileName: 'mount.js' }],
      }),
    );
    await put(directory + 'mount.js', 'export function mount() {}');
    await put(
      directory + (app === 'support' ? 'styles.css' : 'style.css'),
      'body{}',
    );
    if (app === 'support')
      await put(
        directory + 'ticket-api-config.json',
        json({ apiBaseUrl: 'http://localhost:3001' }),
      );
  }
  await put(
    'apps/shell/dist/browser/index.html',
    `<html><body>synthetic ${runId}</body></html>`,
  );
  await put(
    'apps/shell/dist/browser/favicon.svg',
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  await put(
    'apps/shell/dist/browser/main-example.js',
    'console.log("synthetic");',
  );
  await put('apps/shell/dist/browser/runtime-config.json', json({}));
  const release = `neon-${runId}-1`;
  const packaged = await prepareNeonRelease({
    root,
    release,
    sourceSha: context.sourceSha,
    runtimeConfig,
  });
  return { ...packaged, root, release, runtimeConfig, context };
}
