import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repository = 'dmytrorozhkov/platypus-service';
const workflowRef =
  repository + '/.github/workflows/package.yml@refs/heads/main';

export function createPackageSummary(options) {
  assert.equal(
    options.repository,
    repository,
    'Unexpected package repository.',
  );
  assert.equal(
    options.ref,
    'refs/heads/main',
    'Package receipt requires main.',
  );
  assert.equal(
    options.eventName,
    'workflow_dispatch',
    'Package receipt requires a manual run.',
  );
  assert.equal(
    options.workflowRef,
    workflowRef,
    'Unexpected package workflow.',
  );
  assert.match(
    options.sourceSha ?? '',
    /^[a-f0-9]{40}$/,
    'Exact source SHA is required.',
  );
  for (const key of ['runId', 'runAttempt', 'artifactId'])
    assert.match(
      options[key] ?? '',
      /^[1-9][0-9]{0,19}$/,
      'Bounded numeric package metadata is required.',
    );
  for (const key of ['artifactDigest', 'envelopeSha256'])
    assert.match(
      options[key] ?? '',
      /^[a-f0-9]{64}$/,
      'Complete package digests are required.',
    );
  const release = `gh-${options.runId}-${options.runAttempt}-${options.sourceSha.slice(0, 12)}`;
  assert(release.length <= 48, 'Package release identifier is too long.');
  assert.equal(
    options.release,
    release,
    'Package release differs from this exact run.',
  );
  const runUrl = `https://github.com/${repository}/actions/runs/${options.runId}`;
  const artifactUrl = runUrl + '/artifacts/' + options.artifactId;
  return [
    '## Package preparation receipt',
    '',
    'The checked source was built and packaged. This workflow has no AWS access or publication step.',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Repository | ${repository} |`,
    '| Workflow | .github/workflows/package.yml |',
    '| Ref | refs/heads/main |',
    `| Source commit | [${options.sourceSha}](https://github.com/${repository}/commit/${options.sourceSha}) |`,
    `| Run / attempt | [${options.runId} / ${options.runAttempt}](${runUrl}/attempts/${options.runAttempt}) |`,
    `| Release | ${release} |`,
    `| Artifact ID | [${options.artifactId}](${artifactUrl}) |`,
    `| GitHub artifact ZIP SHA-256 | ${options.artifactDigest} |`,
    `| Bundle envelope SHA-256 | ${options.envelopeSha256} |`,
    '',
    'Artifact retention: one day. Download requires GitHub authentication. The artifact ZIP digest covers the complete GitHub archive; it is separate from the Lambda ZIP hash inside the bundle.',
    '',
    'This receipt is preparation evidence. It does not authorize publication or prove an authenticated, validated handoff to CodeBuild. Source/run/artifact selection and archive verification remain required before any separately approved publisher can use it.',
    '',
  ].join('\n');
}

async function main() {
  assert.equal(
    process.argv.length,
    2,
    'Package summary accepts no command arguments.',
  );
  const summary = createPackageSummary({
    repository: process.env.GITHUB_REPOSITORY,
    ref: process.env.GITHUB_REF,
    eventName: process.env.GITHUB_EVENT_NAME,
    workflowRef: process.env.GITHUB_WORKFLOW_REF,
    sourceSha: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    release: process.env.PACKAGE_RELEASE,
    artifactId: process.env.PACKAGE_ARTIFACT_ID,
    artifactDigest: process.env.PACKAGE_ARTIFACT_DIGEST,
    envelopeSha256: process.env.PACKAGE_ENVELOPE_SHA256,
  });
  assert(
    process.env.GITHUB_STEP_SUMMARY,
    'GitHub job summary destination is required.',
  );
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log('Validated package preparation receipt recorded.');
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  main().catch(() => {
    console.error(
      'Package receipt metadata is missing or invalid; no success receipt was written.',
    );
    process.exitCode = 1;
  });
