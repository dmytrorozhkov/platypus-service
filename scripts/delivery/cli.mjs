import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { flags, projectRoot, sha256 } from '../aws/common.mjs';
import {
  importBaseline,
  publishDelivery,
  publishNeonDelivery,
  recoverDelivery,
  reconcileDelivery,
  validateTarget,
} from './executor.mjs';
import { createAwsCliTransport } from './transport.mjs';
import {
  createGithubHttpTransport,
  readSelectedNeonArtifact,
} from './artifact-reader.mjs';

const execute = promisify(execFile);

export function validateLiveEvidence(
  evidence,
  { origin, bucketOrigin, functionUrl, runtimeVariant = 'fixture', startedAt },
) {
  const started = Date.parse(evidence?.startedAt);
  const finished = Date.parse(evidence?.finishedAt);
  if (
    !['fixture', 'neon'].includes(runtimeVariant) ||
    evidence?.success !== true ||
    evidence.origin !== origin ||
    evidence.bucketOrigin !== bucketOrigin ||
    evidence.functionOrigin !== new URL(functionUrl).origin ||
    evidence.runtimeVariant !== runtimeVariant ||
    evidence.kind !==
      (runtimeVariant === 'neon'
        ? 'platypus-neon-live-check'
        : 'platypus-fixture-live-check') ||
    !Array.isArray(evidence.checks) ||
    evidence.checks.length !== 6 ||
    !evidence.checks.every(
      (item) => typeof item === 'string' && item.length > 0,
    ) ||
    !Number.isFinite(startedAt) ||
    !Number.isFinite(started) ||
    !Number.isFinite(finished) ||
    started < startedAt ||
    finished < started ||
    finished > Date.now() + 1000
  )
    throw new Error(
      'Live checker did not produce fresh, complete runtime-specific acceptance evidence.',
    );
  return evidence;
}

export async function runLiveCheck({
  origin,
  bucketOrigin,
  functionUrl,
  runtimeVariant = 'fixture',
}) {
  if (!['fixture', 'neon'].includes(runtimeVariant))
    throw new Error('Unknown live runtime variant.');
  const startedAt = Date.now();
  try {
    await execute(
      process.execPath,
      [
        path.join(projectRoot, 'scripts/aws-live-check.mjs'),
        '--origin',
        origin,
        '--bucket-origin',
        bucketOrigin,
        '--function-url',
        functionUrl,
        '--runtime-variant',
        runtimeVariant,
      ],
      {
        cwd: projectRoot,
        windowsHide: true,
        timeout: 600000,
        maxBuffer: 1024 * 1024,
      },
    );
  } catch {
    throw new Error(
      'Live HTTP/browser acceptance failed; completion remains pending.',
    );
  }
  const bytes = await readFile(
    path.join(projectRoot, '.local/evidence/aws-live-check.json'),
  );
  const evidence = validateLiveEvidence(JSON.parse(bytes), {
    origin,
    bucketOrigin,
    functionUrl,
    runtimeVariant,
    startedAt,
  });
  return {
    success: true,
    kind: evidence.kind,
    origin,
    evidenceSha256: sha256(bytes),
    checks: evidence.checks,
    finishedAt: evidence.finishedAt,
  };
}

async function readBoundedJson(filename) {
  try {
    const info = await lstat(filename);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 16384)
      throw new Error();
    return JSON.parse(await readFile(filename, 'utf8'));
  } catch {
    throw new Error(
      'A bounded ordinary nonsecret JSON configuration file is required.',
    );
  }
}

export async function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (
    !['publish', 'publish-neon', 'import', 'recover', 'reconcile'].includes(
      command,
    )
  )
    throw new Error(
      'Explicit publish, publish-neon, import, recover or reconcile command is required; no default mutation.',
    );
  const common = ['--target'];
  const contextFlags = [
    '--source-sha',
    '--run-id',
    '--run-attempt',
    '--repository',
  ];
  const specific = {
    publish: [...contextFlags, '--bundle', '--envelope-sha256'],
    'publish-neon': ['--selection', '--runtime'],
    import: ['--bundle', '--expected-alias-version'],
    recover: [...contextFlags, '--release', '--expected-pending'],
    reconcile: [...contextFlags, '--expected-pending'],
  };
  const options = flags(argv.slice(1), [
    ...common,
    ...specific[command],
    ...(command === 'import' ? ['--expected-pending'] : []),
    ...(['publish-neon', 'import', 'reconcile'].includes(command)
      ? ['--allow-neon-transition']
      : []),
  ]);
  for (const key of [...common, ...specific[command]])
    if (!options[key]) throw new Error('Missing required option: ' + key);
  const transition = options['--allow-neon-transition'];
  if (transition !== undefined && !['true', 'false'].includes(transition))
    throw new Error('Neon transition option must be explicitly true or false.');
  const allowNeonTransition = transition === 'true';
  const target = validateTarget(await readBoundedJson(options['--target']));
  const transport = createAwsCliTransport(target);
  const context = {
    sourceSha: options['--source-sha'],
    runId: options['--run-id'],
    runAttempt: options['--run-attempt'],
    repository: options['--repository'],
  };
  const shared = { target, transport, liveCheck: runLiveCheck };
  let result;
  if (command === 'publish-neon') {
    const selection = await readBoundedJson(options['--selection']);
    const runtimeConfig = await readBoundedJson(options['--runtime']);
    const packaged = await readSelectedNeonArtifact({
      selection,
      runtimeConfig,
      token: process.env.PLATYPUS_GITHUB_READ_TOKEN,
      transport: createGithubHttpTransport(),
    });
    result = await publishNeonDelivery({
      ...shared,
      root: packaged.root,
      release: selection.release,
      runtimeConfig,
      manifestSha256: selection.manifestSha256,
      allowNeonTransition,
      context: {
        repository: selection.repository,
        sourceSha: selection.sourceSha,
        runId: selection.runId,
        runAttempt: selection.runAttempt,
      },
    });
  }
  if (command === 'publish')
    result = await publishDelivery({
      ...shared,
      context,
      bundle: path.resolve(options['--bundle']),
      envelopeSha256: options['--envelope-sha256'],
    });
  if (command === 'import')
    result = await importBaseline({
      ...shared,
      directory: path.resolve(options['--bundle']),
      expectedAliasVersion: options['--expected-alias-version'],
      allowNeonTransition,
      expectedPending: options['--expected-pending'] ?? 'none',
    });
  if (command === 'recover')
    result = await recoverDelivery({
      ...shared,
      context,
      release: options['--release'],
      expectedPending: options['--expected-pending'],
    });
  if (command === 'reconcile')
    result = await reconcileDelivery({
      ...shared,
      context,
      allowNeonTransition,
      expectedPending: options['--expected-pending'],
    });
  console.log(
    JSON.stringify({
      status: result.status,
      release: result.release,
      operationId: result.operationId,
    }),
  );
  return result;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  main().catch((error) => {
    console.error('Delivery stopped: ' + error.message);
    process.exitCode = 1;
  });
