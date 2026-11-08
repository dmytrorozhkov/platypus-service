import assert from 'node:assert/strict';
import test from 'node:test';
import { readCodeBuildInput } from './codebuild-input.mjs';
import { main as delivery } from '../delivery/cli.mjs';

function fixture() {
  const accountId = '111122223333';
  const functionArn = `arn:aws:lambda:eu-north-1:${accountId}:function:test-api`;
  const target = {
    project: 'platypus-service',
    region: 'eu-north-1',
    accountId,
    ownershipVerified: true,
    serviceRoleArn: `arn:aws:iam::${accountId}:role/test-cfn`,
    lambdaExecutionRoleArn: `arn:aws:iam::${accountId}:role/test-lambda`,
    concurrency: { mode: 'account-cap-ten', acceptedSharedAccountCap: true },
    stacks: Object.fromEntries(
      ['storage', 'backend', 'edge'].map((name) => [
        name,
        `arn:aws:cloudformation:eu-north-1:${accountId}:stack/platypus-test-${name}/11111111-2222-3333-4444-555555555555`,
      ]),
    ),
    resources: {
      bucket: 'test-artifacts',
      bucketDomain: 'test-artifacts.s3.eu-north-1.amazonaws.com',
      functionArn,
      aliasArn: functionArn + ':live',
      distributionId: 'DTEST123456',
      functionUrl: 'https://test.lambda-url.eu-north-1.on.aws/',
      origin: 'https://dtest123.cloudfront.net',
    },
  };
  const selection = {
    repository: 'dmytrorozhkov/platypus-service',
    repositoryId: '12345',
    repositoryOwnerId: '67890',
    workflowPath: '.github/workflows/package-neon.yml',
    ref: 'refs/heads/main',
    sourceSha: '3'.repeat(40),
    runId: '123456',
    runAttempt: '1',
    artifactId: '999999',
    artifactDigest: '4'.repeat(64),
    manifestSha256: '5'.repeat(64),
    release: 'neon-123456-1',
    origin: target.resources.origin,
  };
  const runtime = {
    schemaVersion: 1,
    kind: 'platypus-neon-runtime',
    region: target.region,
    accountId,
    origin: target.resources.origin,
    neonHost: 'ep-offline-test-pooler.c-7.eu-central-1.aws.neon.tech',
    database: 'neondb',
    user: 'platypus_app',
    passwordParameterArn: `arn:aws:ssm:eu-north-1:${accountId}:parameter/platypus-service/production/neon/password`,
    passwordParameterVersion: 1,
  };
  return {
    PLATYPUS_TARGET_JSON: JSON.stringify(target),
    PLATYPUS_SELECTION_JSON: JSON.stringify(selection),
    PLATYPUS_RUNTIME_JSON: JSON.stringify(runtime),
    PLATYPUS_PUBLISHER_SHA: '6'.repeat(40),
    PLATYPUS_ALLOW_NEON_TRANSITION: 'true',
    PLATYPUS_CONFIRM: 'publish-neon',
    CODEBUILD_PROJECT_ARN: `arn:aws:codebuild:eu-north-1:${accountId}:project/platypus-service-publisher`,
    CODEBUILD_BUILD_ARN: `arn:aws:codebuild:eu-north-1:${accountId}:build/platypus-service-publisher:11111111-2222-3333-4444-555555555555`,
  };
}

test('CodeBuild requires reviewed publisher source and exact project/runtime/target bindings', () => {
  const environment = fixture();
  const input = readCodeBuildInput(environment, '6'.repeat(40));
  assert.equal(input.allowNeonTransition, true);
  assert.equal(input.runtime.passwordParameterVersion, 1);
  assert.equal(input.selection.release, 'neon-123456-1');
  assert.equal(
    readCodeBuildInput(
      { ...environment, PLATYPUS_ALLOW_NEON_TRANSITION: 'false' },
      '6'.repeat(40),
    ).allowNeonTransition,
    false,
  );
});

test('CodeBuild refuses disabled/default input, local profiles, foreign resources and injected secrets', () => {
  const mutations = [
    (env) => {
      delete env.PLATYPUS_CONFIRM;
    },
    (env) => {
      env.PLATYPUS_CONFIRM = 'disabled';
    },
    (env) => {
      env.PLATYPUS_ALLOW_NEON_TRANSITION = 'yes';
    },
    (env) => {
      env.CODEBUILD_PROJECT_ARN += '-other';
    },
    (env) => {
      env.CODEBUILD_BUILD_ARN += '/../../other';
    },
    (env) => {
      env.PLATYPUS_PUBLISHER_SHA = '0'.repeat(40);
    },
    (env) => {
      env.PLATYPUS_RUNTIME_JSON = JSON.stringify({
        ...JSON.parse(env.PLATYPUS_RUNTIME_JSON),
        accountId: '999999999999',
      });
    },
    (env) => {
      env.PLATYPUS_TARGET_JSON = JSON.stringify({
        ...JSON.parse(env.PLATYPUS_TARGET_JSON),
        profile: 'local',
      });
    },
    (env) => {
      env.PLATYPUS_TARGET_JSON = JSON.stringify({
        ...JSON.parse(env.PLATYPUS_TARGET_JSON),
        password: 'synthetic-must-not-be-stored',
      });
    },
    (env) => {
      env.PLATYPUS_SELECTION_JSON = JSON.stringify({
        ...JSON.parse(env.PLATYPUS_SELECTION_JSON),
        token: 'synthetic-must-not-be-stored',
      });
    },
    (env) => {
      env.PLATYPUS_RUNTIME_JSON = 'x'.repeat(16385);
    },
  ];
  for (const mutate of mutations) {
    const env = fixture();
    mutate(env);
    assert.throws(
      () => readCodeBuildInput(env, '6'.repeat(40)),
      /^Error: CodeBuild publication requires/,
    );
  }
  assert.throws(() => readCodeBuildInput(fixture(), '7'.repeat(40)));
});

test('delivery CLI requires explicit complete commands and rejects credentials or widened bootstrap flags', async () => {
  await assert.rejects(delivery([]), /Explicit/);
  await assert.rejects(delivery(['publish-neon']), /Missing required option/);
  await assert.rejects(
    delivery(['publish-neon', '--password', 'synthetic']),
    /Unsupported/,
  );
  await assert.rejects(
    delivery(['recover', '--allow-neon-transition', 'true']),
    /Unsupported/,
  );
  await assert.rejects(
    delivery([
      'publish-neon',
      '--target',
      'unused',
      '--selection',
      'unused',
      '--runtime',
      'unused',
      '--allow-neon-transition',
      'yes',
    ]),
    /explicitly true or false/,
  );
});
