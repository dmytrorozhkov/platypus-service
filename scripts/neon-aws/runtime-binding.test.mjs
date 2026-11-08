import assert from 'node:assert/strict';
import test from 'node:test';
import { json, sha256 } from '../aws/common.mjs';
import { validateNeonRuntimeConfig } from './templates.mjs';
import { validateNeonLambdaConfiguration } from './runtime-binding.mjs';

function fixture() {
  const accountId = '111122223333';
  const origin = 'https://dtest123.cloudfront.net';
  const host = 'ep-offline-test-pooler.c-7.eu-central-1.aws.neon.tech';
  const role = `arn:aws:iam::${accountId}:role/offline-lambda`;
  const arn =
    `arn:aws:ssm:eu-north-1:${accountId}:parameter/` +
    'platypus-service/production/neon/password';
  const runtime = validateNeonRuntimeConfig({
    schemaVersion: 1,
    kind: 'platypus-neon-runtime',
    region: 'eu-north-1',
    accountId,
    origin,
    neonHost: host,
    database: 'neondb',
    user: 'platypus_app',
    passwordParameterArn: arn,
    passwordParameterVersion: 7,
  });
  const body = Buffer.from(json(runtime));
  return {
    target: {
      accountId,
      region: 'eu-north-1',
      lambdaExecutionRoleArn: role,
      resources: { origin },
    },
    manifest: {
      kind: 'platypus-neon-release-candidate',
      origin,
      runtimeSha256: sha256(body),
    },
    body,
    configuration: {
      Timeout: 30,
      Role: role,
      Environment: {
        Variables: {
          ALLOWED_ORIGINS: origin,
          NEON_HOST: host,
          NEON_DATABASE: 'neondb',
          NEON_USER: 'platypus_app',
          NEON_CONFIRM_TARGET: `${host}/neondb`,
          NEON_PASSWORD_PARAMETER_ARN: arn,
          NEON_PASSWORD_PARAMETER_VERSION: '7',
        },
      },
    },
  };
}

test('accepts exact canonical runtime, role and pinned parameter version', () => {
  const input = fixture();
  assert.deepEqual(
    validateNeonLambdaConfiguration(input),
    JSON.parse(input.body.toString('utf8')),
  );
});

test('rejects digest, canonical format and selected-target drift', () => {
  const cases = [
    [
      (input) => {
        input.manifest.runtimeSha256 = '0'.repeat(64);
      },
      /runtime digest differs/,
    ],
    [
      (input) => {
        input.body = Buffer.concat([input.body, Buffer.from(' ')]);
        input.manifest.runtimeSha256 = sha256(input.body);
      },
      /must be canonical/,
    ],
    [
      (input) => {
        input.target.accountId = '999900001111';
      },
      /selected AWS target/,
    ],
    [
      (input) => {
        input.target.region = 'eu-west-1';
      },
      /selected AWS target/,
    ],
    [
      (input) => {
        input.manifest.origin = 'https://dother123.cloudfront.net';
      },
      /selected AWS target/,
    ],
    [
      (input) => {
        const runtime = JSON.parse(input.body.toString('utf8'));
        runtime.user = 'neondb_owner';
        input.body = Buffer.from(json(runtime));
        input.manifest.runtimeSha256 = sha256(input.body);
      },
      /configuration is invalid/,
    ],
  ];
  for (const [change, message] of cases) {
    const input = fixture();
    change(input);
    assert.throws(() => validateNeonLambdaConfiguration(input), message);
  }
});

test('rejects wrong timeout, execution role or absent role selection', () => {
  const cases = [
    [
      (input) => {
        input.configuration.Timeout = 3;
      },
      /timeout/,
    ],
    [
      (input) => {
        input.configuration.Role = 'arn:aws:iam::999900001111:role/other';
      },
      /execution role/,
    ],
    [
      (input) => {
        delete input.target.lambdaExecutionRoleArn;
      },
      /execution role/,
    ],
  ];
  for (const [change, message] of cases) {
    const input = fixture();
    change(input);
    assert.throws(() => validateNeonLambdaConfiguration(input), message);
  }
});

test('rejects changed, missing or extra environment values without disclosure', () => {
  for (const key of Object.keys(
    fixture().configuration.Environment.Variables,
  )) {
    const input = fixture();
    input.configuration.Environment.Variables[key] += '-changed';
    assert.throws(
      () => validateNeonLambdaConfiguration(input),
      /environment differs/,
    );
  }

  const missing = fixture();
  delete missing.configuration.Environment.Variables
    .NEON_PASSWORD_PARAMETER_VERSION;
  assert.throws(
    () => validateNeonLambdaConfiguration(missing),
    /environment differs/,
  );

  const extra = fixture();
  const canary = 'PUBLIC-FAKE-SECRET-CANARY';
  extra.configuration.Environment.Variables.NEON_PASSWORD = canary;
  assert.throws(
    () => validateNeonLambdaConfiguration(extra),
    (error) => {
      assert.match(error.message, /environment differs/);
      assert(!error.message.includes(canary));
      return true;
    },
  );
});
