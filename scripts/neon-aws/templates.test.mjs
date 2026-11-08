import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { backendTemplate } from '../aws/templates.mjs';
import { json, sha256 } from '../aws/common.mjs';
import {
  computeNeonBackendRevision,
  neonBackendParameters,
  neonBackendTemplate,
  validateNeonRuntimeConfig,
} from './templates.mjs';

const config = () => ({
  schemaVersion: 1,
  kind: 'platypus-neon-runtime',
  region: 'eu-north-1',
  accountId: '123456789012',
  origin: 'https://dexample.cloudfront.net',
  neonHost: 'ep-public-fake-pooler.c-7.eu-central-1.aws.neon.tech',
  database: 'neondb',
  user: 'platypus_app',
  passwordParameterArn:
    'arn:aws:ssm:eu-north-1:123456789012:parameter/platypus-service/production/neon/password',
  passwordParameterVersion: 1,
});
const zipHash = Buffer.alloc(32, 1).toString('base64');
const packageInputs = () => ({
  bucket: 'public-example-artifacts',
  key: '_deploy/backend/neon-example.zip',
  sha256: zipHash,
});

test('Neon runtime config is canonical, cloned and explicitly pinned without credential fields', () => {
  const source = config();
  const result = validateNeonRuntimeConfig(
    Object.fromEntries(Object.entries(source).reverse()),
  );
  assert.deepEqual(result, source);
  assert.notEqual(result, source);
  assert.deepEqual(Object.keys(result), Object.keys(source));
  for (const patch of [
    { schemaVersion: 2 },
    { kind: 'platypus-release' },
    { region: 'us-east-1' },
    { accountId: '000000000000' },
    { origin: 'https://example.com' },
    { origin: 'https://dexample.cloudfront.net/' },
    { origin: 'http://dexample.cloudfront.net' },
    { neonHost: 'ep-public-fake.c-7.eu-central-1.aws.neon.tech' },
    { neonHost: 'ep-public-fake-pooler.c-7.eu-west-1.aws.neon.tech' },
    {
      neonHost:
        'postgresql://user:password@ep-public-fake-pooler.eu-central-1.aws.neon.tech',
    },
    { neonHost: `ep-${'a'.repeat(64)}-pooler.eu-central-1.aws.neon.tech` },
    { database: 'postgres' },
    { user: 'neondb_owner' },
    {
      passwordParameterArn:
        'arn:aws:ssm:eu-north-1:999999999999:parameter/platypus-service/production/neon/password',
    },
    { passwordParameterArn: config().passwordParameterArn + ':1' },
    { passwordParameterVersion: '1' },
    { passwordParameterVersion: 0 },
    { passwordParameterVersion: 1.5 },
    { passwordParameterVersion: Number.MAX_SAFE_INTEGER + 1 },
    { NEON_PASSWORD: 'must-not-be-accepted' },
    { profile: 'default' },
    { endpoint: 'https://example.com' },
  ])
    assert.throws(
      () => validateNeonRuntimeConfig({ ...source, ...patch }),
      /^Error: Invalid nonsecret Neon AWS runtime configuration\.$/,
    );
  const missing = config();
  delete missing.user;
  assert.throws(() => validateNeonRuntimeConfig(missing));
  const accessor = config();
  Object.defineProperty(accessor, 'user', {
    get() {
      throw new Error('Accessor must not execute.');
    },
  });
  assert.throws(() => validateNeonRuntimeConfig(accessor), /Invalid nonsecret/);
  for (const value of [undefined, null, [], 'config', Object.create(config())])
    assert.throws(() => validateNeonRuntimeConfig(value));
});

test('backend revision binds immutable ZIP, every runtime value and version independent of input key order', () => {
  const source = config();
  const original = computeNeonBackendRevision(source, zipHash);
  assert.equal(
    original,
    sha256(
      json({
        kind: 'platypus-neon-backend-revision',
        packageSha256: zipHash,
        runtime: source,
      }),
    ),
  );
  assert.equal(
    original,
    computeNeonBackendRevision(
      Object.fromEntries(Object.entries(source).reverse()),
      zipHash,
    ),
  );
  for (const patch of [
    { origin: 'https://dother.cloudfront.net' },
    { neonHost: 'ep-other-pooler.eu-central-1.aws.neon.tech' },
    { passwordParameterVersion: 2 },
    {
      accountId: '999999999999',
      passwordParameterArn: source.passwordParameterArn.replace(
        '123456789012',
        '999999999999',
      ),
    },
  ])
    assert.notEqual(
      original,
      computeNeonBackendRevision({ ...source, ...patch }, zipHash),
    );
  assert.notEqual(
    original,
    computeNeonBackendRevision(source, Buffer.alloc(32, 2).toString('base64')),
  );
  for (const hash of [
    '',
    'a'.repeat(64),
    zipHash.slice(0, -1),
    zipHash.slice(0, -2) + 'B=',
  ])
    assert.throws(() => computeNeonBackendRevision(source, hash));
});

test('parameter construction binds runtime and retains accepted account cap and explicit rollback', () => {
  const source = config();
  const result = neonBackendParameters(source, packageInputs());
  assert.equal(
    result.BackendRevision,
    computeNeonBackendRevision(source, zipHash),
  );
  assert.equal(result.NeonPasswordParameterVersion, '1');
  assert.equal(result.ConcurrencyMode, 'account-cap-ten');
  assert.equal(result.RollbackVersion, '');
  assert.equal(
    neonBackendParameters(source, { ...packageInputs(), rollbackVersion: '2' })
      .RollbackVersion,
    '2',
  );
  for (const patch of [
    { concurrencyMode: 'account-cap-five' },
    { concurrencyMode: 'reserved-two' },
    { rollbackVersion: '0' },
    { rollbackVersion: 'latest' },
    { bucket: 'bad/target' },
    { key: '../target.zip' },
    { key: '_deploy/backend/neon.zip?x' },
    { password: 'fake' },
  ])
    assert.throws(() =>
      neonBackendParameters(source, { ...packageInputs(), ...patch }),
    );
  const template = neonBackendTemplate();
  assert.deepEqual(
    Object.keys(result).sort(),
    Object.keys(template.Parameters).sort(),
  );
  for (const [name, value] of Object.entries(result)) {
    const parameter = template.Parameters[name];
    if (parameter.AllowedPattern)
      assert.match(value, new RegExp(parameter.AllowedPattern));
    if (parameter.AllowedValues)
      assert.ok(parameter.AllowedValues.includes(value));
  }
});

test('opt-in template preserves original function/resource identities, URL protection, logs and retained alias rollback', () => {
  const original = backendTemplate();
  const result = neonBackendTemplate();
  assert.deepEqual(
    Object.keys(result.Resources),
    Object.keys(original.Resources),
  );
  for (const name of ['Logs', 'LiveAlias', 'FunctionUrl'])
    assert.deepEqual(result.Resources[name], original.Resources[name]);
  assert.deepEqual(result.Outputs, original.Outputs);
  assert.deepEqual(result.Conditions, original.Conditions);
  assert.deepEqual(
    result.Resources.ExecutionRole.Properties.AssumeRolePolicyDocument,
    original.Resources.ExecutionRole.Properties.AssumeRolePolicyDocument,
  );
  assert.deepEqual(
    result.Resources.ExecutionRole.Properties.Policies[0],
    original.Resources.ExecutionRole.Properties.Policies[0],
  );
  for (const property of [
    'Runtime',
    'Architectures',
    'Handler',
    'MemorySize',
    'EphemeralStorage',
    'Role',
    'Code',
    'ReservedConcurrentExecutions',
    'LoggingConfig',
    'Tags',
  ])
    assert.deepEqual(
      result.Resources.Function.Properties[property],
      original.Resources.Function.Properties[property],
    );
  assert.equal(result.Resources.Function.Properties.Timeout, 30);
  assert.equal(result.Resources.Version.DeletionPolicy, 'Retain');
  assert.equal(result.Resources.Version.UpdateReplacePolicy, 'Retain');
  assert.deepEqual(
    result.Resources.Version.Properties,
    original.Resources.Version.Properties,
  );
  assert.deepEqual(
    backendTemplate(),
    original,
    'Derivation must never mutate the fixture generator.',
  );
});

test('only exact same-account SSM GetParameter is added; no secret resources, plaintext or reserved environment keys', () => {
  const result = neonBackendTemplate();
  const role = result.Resources.ExecutionRole.Properties;
  assert.equal(role.Policies.length, 2);
  assert.deepEqual(role.Policies[1].PolicyDocument, {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'ReadOnlyExactNeonPassword',
        Effect: 'Allow',
        Action: 'ssm:GetParameter',
        Resource: {
          'Fn::Sub':
            'arn:${AWS::Partition}:ssm:eu-north-1:${AWS::AccountId}:parameter/platypus-service/production/neon/password',
        },
      },
    ],
  });
  const environment =
    result.Resources.Function.Properties.Environment.Variables;
  assert.deepEqual(
    Object.keys(environment).sort(),
    [
      'ALLOWED_ORIGINS',
      'NEON_HOST',
      'NEON_DATABASE',
      'NEON_USER',
      'NEON_CONFIRM_TARGET',
      'NEON_PASSWORD_PARAMETER_ARN',
      'NEON_PASSWORD_PARAMETER_VERSION',
    ].sort(),
  );
  assert.deepEqual(environment.NEON_CONFIRM_TARGET, {
    'Fn::Sub': '${NeonHost}/neondb',
  });
  assert.deepEqual(
    environment.NEON_PASSWORD_PARAMETER_ARN,
    role.Policies[1].PolicyDocument.Statement[0].Resource,
  );
  assert.equal(result.Parameters.NeonPasswordParameterArn, undefined);
  assert.equal(result.Parameters.NeonConfirmTarget, undefined);
  assert.equal(environment.NEON_PASSWORD, undefined);
  assert.equal(environment.AWS_REGION, undefined);
  assert.ok(
    Object.values(result.Resources).every(
      (item) =>
        ![
          'AWS::SSM::Parameter',
          'AWS::SecretsManager::Secret',
          'AWS::KMS::Key',
        ].includes(item.Type),
    ),
  );
  const body = json(result);
  assert.doesNotMatch(
    body,
    /\{\{resolve:|ssm:GetParameters|kms:Decrypt|neondb_owner|VpcConfig|ProvisionedConcurrency/,
  );
  assert.equal(result.Parameters.AllowedOrigin.Default, undefined);
  assert.deepEqual(result.Parameters.ConcurrencyMode.AllowedValues, [
    'account-cap-ten',
  ]);
  assert.equal(result.Parameters.ConcurrencyMode.Default, undefined);
});

test('checked-in candidate template matches generator, has durable context/attribution and bounded size; example is intentionally incomplete', async () => {
  const result = neonBackendTemplate();
  const stored = JSON.parse(
    await readFile(
      new URL(
        '../../infrastructure/neon-backend.template.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.deepEqual(stored, result);
  assert.equal(
    result.Metadata.AWSToolsMetrics.AWSAgentToolkit,
    'aws-cloudformation@3',
  );
  assert.ok(Buffer.byteLength(result.Description) <= 1024);
  assert.ok(Buffer.byteLength(json(result)) <= 51200);
  for (const resource of Object.values(result.Resources)) {
    assert.ok(resource.Metadata['com.aws.cloudformation.Context'].why);
    assert.ok(
      resource.Metadata['com.aws.cloudformation.Context'].must.length > 0,
    );
  }
  const example = JSON.parse(
    await readFile(
      new URL(
        '../../infrastructure/neon-runtime.example.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.throws(() => validateNeonRuntimeConfig(example), /Invalid nonsecret/);
  assert.equal(example.accountId, '000000000000');
  assert.doesNotMatch(json(example), /NEON_PASSWORD"|password"\s*:/);
});
