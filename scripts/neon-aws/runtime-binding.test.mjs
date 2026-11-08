import assert from 'node:assert/strict';
import test from 'node:test';
import { json, sha256 } from '../aws/common.mjs';
import { validateNeonRuntimeConfig } from './templates.mjs';
import { validateNeonLambdaConfiguration } from './runtime-binding.mjs';
import { buildNeonBackendUpdate } from './backend-update.mjs';
import {
  computeNeonBackendRevision,
  neonBackendTemplate,
} from './templates.mjs';
import { readBackendRuntime } from '../delivery/executor.mjs';

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

function updateFixture() {
  const { target, manifest, body } = fixture();
  target.resources.bucket = 'offline-artifacts';
  target.concurrency = { mode: 'account-cap-ten' };
  const templateBody = Buffer.from(json(neonBackendTemplate()));
  const runtime = JSON.parse(body.toString('utf8'));
  const codeSha256 = Buffer.alloc(32, 7).toString('base64');
  manifest.templateSha256 = sha256(templateBody);
  manifest.backend = {
    key: '_deploy/backend/offline-neon.zip',
    codeSha256,
    backendRevision: computeNeonBackendRevision(runtime, codeSha256),
  };
  return { target, manifest, runtimeBody: body, templateBody };
}

test('builds an offline Neon update bound to reviewed artifacts', () => {
  const input = updateFixture();
  const result = buildNeonBackendUpdate(input);
  assert.equal(Object.keys(result.selected).length, 11);
  assert.equal(result.selected.NeonPasswordParameterVersion, '7');
  assert.equal(result.selected.RollbackVersion, '');
  assert.equal(result.templateBody, input.templateBody.toString('utf8'));
});

test('rejects changed template, runtime, revision and target bindings', () => {
  const mutations = [
    (input) => {
      input.templateBody = Buffer.concat([
        input.templateBody,
        Buffer.from(' '),
      ]);
    },
    (input) => {
      const template = JSON.parse(input.templateBody.toString('utf8'));
      template.Resources.Function.Properties.Timeout = 900;
      input.templateBody = Buffer.from(json(template));
      input.manifest.templateSha256 = sha256(input.templateBody);
    },
    (input) => {
      const runtime = JSON.parse(input.runtimeBody.toString('utf8'));
      runtime.passwordParameterVersion += 1;
      input.runtimeBody = Buffer.from(json(runtime));
      input.manifest.runtimeSha256 = sha256(input.runtimeBody);
    },
    (input) => {
      input.manifest.backend.backendRevision = '0'.repeat(64);
    },
    (input) => {
      input.target.accountId = '999900001111';
    },
    (input) => {
      input.target.concurrency.mode = 'reserved-two';
    },
  ];
  for (const mutate of mutations) {
    const input = updateFixture();
    mutate(input);
    assert.throws(() => buildNeonBackendUpdate(input));
  }
});

test('loads recovery runtime from the exact owned release', async () => {
  const input = fixture();
  input.manifest.release = 'offline-neon';
  input.target.resources.bucket = 'offline-artifacts';
  let reads = 0;
  const transport = {
    async getObject(request) {
      reads += 1;
      assert.equal(request.Bucket, 'offline-artifacts');
      assert.equal(request.ExpectedBucketOwner, input.target.accountId);
      assert.equal(
        request.Key,
        '_releases/delivery/files/offline-neon/backend/runtime.json',
      );
      return {
        body: input.body,
        ETag: '"offline-runtime"',
        ChecksumSHA256: Buffer.from(sha256(input.body), 'hex').toString(
          'base64',
        ),
      };
    },
  };
  assert.deepEqual(
    await readBackendRuntime(transport, input.target, input.manifest),
    input.body,
  );
  assert.equal(reads, 1);
});

test('rejects substituted recovery runtime despite valid storage checksum', async () => {
  const input = fixture();
  input.manifest.release = 'offline-neon';
  input.target.resources.bucket = 'offline-artifacts';
  const runtime = JSON.parse(input.body.toString('utf8'));
  runtime.passwordParameterVersion += 1;
  const body = Buffer.from(json(runtime));
  const transport = {
    async getObject() {
      return {
        body,
        ETag: '"substituted-runtime"',
        ChecksumSHA256: Buffer.from(sha256(body), 'hex').toString('base64'),
      };
    },
  };
  await assert.rejects(
    readBackendRuntime(transport, input.target, input.manifest),
    /runtime digest differs/,
  );
});

test('legacy recovery requires no Neon runtime read', async () => {
  const transport = {
    async getObject() {
      assert.fail('Unexpected runtime read for a legacy release.');
    },
  };
  assert.equal(
    await readBackendRuntime(transport, {}, { scope: 'full' }),
    undefined,
  );
});
