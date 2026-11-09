import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { json, sha256 } from '../aws/common.mjs';
import { backendTemplate } from '../aws/templates.mjs';
import {
  computeNeonBackendRevision,
  neonBackendTemplate,
} from './templates.mjs';
import { updateBackend } from '../delivery/executor.mjs';

const observedChanges = JSON.parse(
  readFileSync(
    new URL('./fixtures/transition-change-set.json', import.meta.url),
    'utf8',
  ),
).Changes;

const checksum = (body) => Buffer.from(sha256(body), 'hex').toString('base64');

function fixture(fault) {
  const accountId = '111122223333';
  const origin = 'https://dtest123.cloudfront.net';
  const functionArn = `arn:aws:lambda:eu-north-1:${accountId}:function:offline-backend`;
  const target = {
    accountId,
    region: 'eu-north-1',
    stacks: { backend: 'offline-backend-stack' },
    serviceRoleArn: `arn:aws:iam::${accountId}:role/offline-cfn`,
    lambdaExecutionRoleArn: `arn:aws:iam::${accountId}:role/offline-lambda`,
    concurrency: { mode: 'account-cap-ten' },
    resources: {
      bucket: 'offline-artifacts',
      origin,
      functionArn,
      aliasArn: functionArn + ':live',
    },
  };
  const runtime = {
    schemaVersion: 1,
    kind: 'platypus-neon-runtime',
    region: target.region,
    accountId,
    origin,
    neonHost: 'ep-offline-test-pooler.c-7.eu-central-1.aws.neon.tech',
    database: 'neondb',
    user: 'platypus_app',
    passwordParameterArn:
      `arn:aws:ssm:eu-north-1:${accountId}:parameter/` +
      'platypus-service/production/neon/password',
    passwordParameterVersion: 7,
  };
  const runtimeBody = Buffer.from(json(runtime));
  const templateBody = Buffer.from(json(neonBackendTemplate()));
  const oldZip = Buffer.from('offline fixture backend');
  const codeSha256 = checksum(Buffer.from('offline Neon backend'));
  const legacy = {
    scope: 'full',
    release: 'fixture-base',
    origin,
    backend: {
      key: '_deploy/backend/fixture-base.zip',
      sha256: sha256(oldZip),
      codeSha256: checksum(oldZip),
    },
  };
  const manifest = {
    kind: 'platypus-neon-release-candidate',
    release: 'offline-neon',
    origin,
    runtimeSha256: sha256(runtimeBody),
    templateSha256: sha256(templateBody),
    backend: {
      key: '_deploy/backend/offline-neon.zip',
      codeSha256,
      backendRevision: computeNeonBackendRevision(runtime, codeSha256),
    },
  };
  let parameters = {
    PackageBucket: target.resources.bucket,
    PackageKey: legacy.backend.key,
    PackageSha256: legacy.backend.codeSha256,
    AllowedOrigin: origin,
    BackendRevision: sha256(legacy.backend.sha256 + '\n' + origin),
    ConcurrencyMode: 'account-cap-ten',
    RollbackVersion: '',
  };
  let currentTemplate = backendTemplate();
  let role =
    fault === 'initial-role' ? target.serviceRoleArn + '-other' : undefined;
  let alias = '2';
  let requested;
  let stackReads = 0;
  let executions = 0;
  let writes = 0;

  function configuration(version, values) {
    const neon = Boolean(values.NeonHost);
    return {
      Version: version,
      CodeSha256: values.PackageSha256,
      Description: currentTemplate.Resources.Version.Properties.Description[
        'Fn::Sub'
      ].replace('${BackendRevision}', values.BackendRevision),
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Handler: 'lambda.handler',
      MemorySize: 256,
      Timeout: neon ? 30 : 3,
      Role: target.lambdaExecutionRoleArn,
      Environment: {
        Variables: {
          ALLOWED_ORIGINS: values.AllowedOrigin,
          ...(neon
            ? {
                NEON_HOST: values.NeonHost,
                NEON_DATABASE: values.NeonDatabase,
                NEON_USER: values.NeonUser,
                NEON_CONFIRM_TARGET:
                  values.NeonHost + '/' + values.NeonDatabase,
                NEON_PASSWORD_PARAMETER_ARN: runtime.passwordParameterArn,
                NEON_PASSWORD_PARAMETER_VERSION:
                  values.NeonPasswordParameterVersion,
              }
            : {}),
        },
      },
    };
  }

  const versions = new Map([['2', configuration('2', parameters)]]);
  const objects = new Map();
  function store(key, body, metadata = {}) {
    objects.set(key, {
      body: Buffer.from(body),
      ETag: '"offline-' + objects.size + '"',
      ChecksumSHA256: checksum(body),
      ContentType: metadata.ContentType,
      CacheControl: metadata.CacheControl,
    });
  }
  const releasePrefix = '_releases/delivery/files/offline-neon/backend/';
  store(releasePrefix + 'runtime.json', runtimeBody);
  store(releasePrefix + 'backend-template.json', templateBody);

  const transport = {
    async getObject(input) {
      assert.equal(input.Bucket, target.resources.bucket);
      assert.equal(input.ExpectedBucketOwner, accountId);
      const value = objects.get(input.Key);
      if (!value)
        throw Object.assign(new Error('Missing offline object'), {
          code: 'NoSuchKey',
        });
      return value;
    },
    async putObject(input) {
      assert.equal(input.Bucket, target.resources.bucket);
      assert.equal(input.ExpectedBucketOwner, accountId);
      assert(input.Key.startsWith('_releases/delivery/operations/'));
      assert.equal(input.IfNoneMatch, '*');
      assert.equal(objects.has(input.Key), false);
      assert.equal(input.ChecksumSHA256, checksum(input.Body));
      writes += 1;
      store(input.Key, input.Body, input);
      return { ETag: objects.get(input.Key).ETag };
    },
    async request(service, operation, input) {
      if (service === 'cloudformation')
        assert.equal(input.StackName, target.stacks.backend);
      if (service === 'lambda') assert.equal(input.FunctionName, functionArn);

      switch (service + ':' + operation) {
        case 'cloudformation:describe-stacks': {
          stackReads += 1;
          const values = { ...parameters };
          let selectedRole = role;
          if (stackReads === 2 && fault === 'before-role')
            selectedRole = target.serviceRoleArn + '-other';
          if (stackReads === 2 && fault === 'before-parameters')
            values.AllowedOrigin = 'https://other.invalid';
          return {
            Stacks: [
              {
                StackId: target.stacks.backend,
                StackStatus: 'UPDATE_COMPLETE',
                RoleARN: selectedRole,
                Parameters: Object.entries(values).map(
                  ([ParameterKey, ParameterValue]) => ({
                    ParameterKey,
                    ParameterValue,
                  }),
                ),
              },
            ],
          };
        }
        case 'cloudformation:get-template': {
          const body = input.ChangeSetName
            ? JSON.parse(requested.TemplateBody)
            : structuredClone(currentTemplate);
          if (input.ChangeSetName && fault === 'created-template')
            body.Resources.Function.Properties.Timeout = 900;
          if (input.ChangeSetName && fault === 'created-metadata')
            body.Resources.Function.Metadata = { Unreviewed: true };
          if (input.ChangeSetName && fault === 'created-role-binding')
            body.Resources.Function.Properties.Role =
              'arn:aws:iam::111122223333:role/other';
          return { TemplateBody: body };
        }
        case 'cloudformation:create-change-set':
          assert.equal(input.RoleARN, target.serviceRoleArn);
          assert.equal(input.Parameters.length, 11);
          if (input.TemplateBody) {
            assert.equal(input.TemplateBody, templateBody.toString('utf8'));
            assert.equal(input.UsePreviousTemplate, undefined);
          } else {
            assert.equal(input.UsePreviousTemplate, true);
          }
          requested = structuredClone(input);
          return { StackId: target.stacks.backend, Id: 'offline-change-set' };

        case 'cloudformation:describe-change-set': {
          const resolved = requested.Parameters.map((item) => ({
            ParameterKey: item.ParameterKey,
            ParameterValue: item.UsePreviousValue
              ? parameters[item.ParameterKey]
              : item.ParameterValue,
          }));
          const rollback = resolved.find(
            (item) => item.ParameterKey === 'RollbackVersion',
          ).ParameterValue;
          const resources = rollback
            ? [['LiveAlias', 'AWS::Lambda::Alias', 'FunctionVersion']]
            : [
                ['ExecutionRole', 'AWS::IAM::Role', 'Policies'],
                ['Function', 'AWS::Lambda::Function', 'Timeout'],
                ['Version', 'AWS::Lambda::Version', 'CodeSha256'],
                ['LiveAlias', 'AWS::Lambda::Alias', 'FunctionVersion'],
              ];
          let changes = resources.map(([logical, type, property]) => ({
            Type: 'Resource',
            ResourceChange: {
              LogicalResourceId: logical,
              ResourceType: type,
              Action: 'Modify',
              Replacement: logical === 'Version' ? 'True' : 'False',
              Scope: ['Properties'],
              Details: [
                {
                  Target: { Attribute: 'Properties', Name: property },
                },
              ],
            },
          }));
          if (!rollback) changes = structuredClone(observedChanges);
          if (fault === 'change-parameters')
            resolved[0].ParameterValue = 'unreviewed';
          if (fault === 'change-policy')
            changes[0].ResourceChange.Details.find(
              (detail) => detail.Target.Attribute === 'Properties',
            ).Target.Name = 'AssumeRolePolicyDocument';
          if (fault === 'change-role-reference')
            changes[1].ResourceChange.Details.find(
              (detail) => detail.Target.Name === 'Role',
            ).CausingEntity = 'OtherRole.Arn';
          return {
            StackId: target.stacks.backend,
            ChangeSetName: requested.ChangeSetName,
            Status: 'CREATE_COMPLETE',
            ExecutionStatus: 'AVAILABLE',
            Parameters: resolved,
            Changes: changes,
          };
        }
        case 'cloudformation:execute-change-set':
          assert.equal(input.ChangeSetName, 'offline-change-set');
          executions += 1;
          parameters = Object.fromEntries(
            requested.Parameters.map((item) => [
              item.ParameterKey,
              item.UsePreviousValue
                ? parameters[item.ParameterKey]
                : item.ParameterValue,
            ]),
          );
          role = target.serviceRoleArn;
          if (requested.TemplateBody)
            currentTemplate = JSON.parse(requested.TemplateBody);
          if (parameters.RollbackVersion) {
            alias = parameters.RollbackVersion;
            assert(versions.has(alias));
          } else {
            alias = '3';
            versions.set(alias, configuration(alias, parameters));
          }
          return {};

        case 'lambda:get-alias':
          return {
            AliasArn: target.resources.aliasArn,
            FunctionVersion: alias,
          };
        case 'lambda:get-function-configuration':
          assert(versions.has(input.Qualifier));
          return structuredClone(versions.get(input.Qualifier));
        default:
          assert.fail(
            'Unexpected offline operation: ' + service + ':' + operation,
          );
      }
    },
  };
  return {
    target,
    manifest,
    legacy,
    transport,
    state: () => ({ executions, writes, alias, role, parameters, requested }),
  };
}

test('first Neon update assigns role and preserves fixture alias rollback', async () => {
  const cloud = fixture();
  const updated = await updateBackend(
    cloud.transport,
    cloud.target,
    cloud.manifest,
    { operationId: 'gh-1-1' },
    undefined,
    true,
  );
  assert.equal(updated.version, '3');
  assert.equal(cloud.state().role, cloud.target.serviceRoleArn);
  assert.equal(cloud.state().executions, 1);
  assert(cloud.state().requested.TemplateBody);
  const pinned = { ...cloud.state().parameters };

  const recovered = await updateBackend(
    cloud.transport,
    cloud.target,
    cloud.legacy,
    { operationId: 'recover-2-1' },
    '2',
  );
  assert.equal(recovered.version, '2');
  assert.equal(cloud.state().executions, 2);
  assert.equal(cloud.state().requested.UsePreviousTemplate, true);
  assert.equal(cloud.state().parameters.RollbackVersion, '2');
  for (const [key, value] of Object.entries(pinned))
    if (key !== 'RollbackVersion')
      assert.equal(cloud.state().parameters[key], value);
});

test('first Neon update requires explicit transition selection', async () => {
  const cloud = fixture();
  await assert.rejects(
    updateBackend(cloud.transport, cloud.target, cloud.manifest, {
      operationId: 'gh-1-1',
    }),
    /explicit selection/,
  );
  assert.equal(cloud.state().executions, 0);
  assert.equal(cloud.state().writes, 0);
});

test('changed review evidence prevents change-set execution', async () => {
  for (const fault of [
    'created-template',
    'created-metadata',
    'created-role-binding',
    'initial-role',
    'change-parameters',
    'change-policy',
    'change-role-reference',
    'before-role',
    'before-parameters',
  ]) {
    const cloud = fixture(fault);
    await assert.rejects(
      updateBackend(
        cloud.transport,
        cloud.target,
        cloud.manifest,
        { operationId: 'gh-1-1' },
        undefined,
        true,
      ),
      undefined,
      fault,
    );
    assert.equal(cloud.state().executions, 0, fault);
    assert.equal(cloud.state().alias, '2', fault);
  }
});
