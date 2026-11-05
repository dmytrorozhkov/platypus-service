import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { flags, projectRoot, sha256 } from '../aws/common.mjs';
import {
  importBaseline,
  publishDelivery,
  recoverDelivery,
  reconcileDelivery,
  validateTarget,
} from './executor.mjs';
import { createAwsCliTransport } from './transport.mjs';

const execute = promisify(execFile);

export async function runLiveCheck({ origin, bucketOrigin, functionUrl }) {
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
  const evidence = JSON.parse(bytes);
  if (
    !evidence.success ||
    evidence.origin !== origin ||
    evidence.checks?.length !== 6
  )
    throw new Error(
      'Live checker did not produce complete acceptance evidence.',
    );
  return {
    success: true,
    evidenceSha256: sha256(bytes),
    checks: evidence.checks,
    finishedAt: evidence.finishedAt,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (!['publish', 'import', 'recover', 'reconcile'].includes(command))
    throw new Error(
      'Explicit publish, import, recover or reconcile command is required; no default mutation.',
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
    import: ['--bundle', '--expected-alias-version'],
    recover: [...contextFlags, '--release', '--expected-pending'],
    reconcile: [...contextFlags, '--expected-pending'],
  };
  const options = flags(argv.slice(1), [
    ...common,
    ...specific[command],
    ...(command === 'import' ? ['--expected-pending'] : []),
  ]);
  for (const key of [...common, ...specific[command]])
    if (!options[key]) throw new Error('Missing required option: ' + key);
  const target = validateTarget(
    JSON.parse(await readFile(options['--target'], 'utf8')),
  );
  const transport = createAwsCliTransport(target);
  const context = {
    sourceSha: options['--source-sha'],
    runId: options['--run-id'],
    runAttempt: options['--run-attempt'],
    repository: options['--repository'],
  };
  const shared = { target, transport, liveCheck: runLiveCheck };
  let result;
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
