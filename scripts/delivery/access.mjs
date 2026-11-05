import assert from 'node:assert/strict';

const policy = (Statement) => ({ Version: '2012-10-17', Statement });
const allow = (Sid, Action, Resource, Condition) => ({
  Sid,
  Effect: 'Allow',
  Action,
  Resource,
  ...(Condition ? { Condition } : {}),
});

// This compiles a named, reviewed deployment-operation envelope, not application SDK code.
// It never calls AWS or installs/attaches a policy. Verify actual identifiers before setup.
export function buildAccessDocuments({
  target,
  github,
  lambdaExecutionRoleArn,
}) {
  assert.equal(target.project, 'platypus-service');
  assert.equal(target.region, 'eu-north-1');
  assert.match(target.accountId, /^[1-9][0-9]{11}$/);
  assert.equal(github.repository, 'dmytrorozhkov/platypus-service');
  assert.match(github.repositoryId, /^[1-9][0-9]*$/);
  assert.match(github.ownerId, /^[1-9][0-9]*$/);
  assert.equal(github.environment, 'aws-learning');
  assert.equal(github.ref, 'refs/heads/main');
  const account = target.accountId;
  const region = target.region;
  const resources = target.resources;
  const functionPrefix = `arn:aws:lambda:${region}:${account}:function:`;
  assert.ok(resources.functionArn.startsWith(functionPrefix));
  assert.match(
    resources.functionArn.slice(functionPrefix.length),
    /^[A-Za-z0-9_-]+$/,
  );
  assert.equal(resources.aliasArn, resources.functionArn + ':live');
  assert.match(resources.bucket, /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/);
  assert.match(resources.distributionId, /^[A-Z0-9]+$/);
  const rolePrefix = `arn:aws:iam::${account}:role/`;
  for (const role of [target.serviceRoleArn, lambdaExecutionRoleArn]) {
    assert.ok(role.startsWith(rolePrefix));
    assert.match(role.slice(rolePrefix.length), /^[A-Za-z0-9_+=,.@/-]+$/);
    assert.ok(!role.endsWith('/'));
  }
  assert.notEqual(target.serviceRoleArn, lambdaExecutionRoleArn);
  assert.deepEqual(Object.keys(target.stacks).sort(), [
    'backend',
    'edge',
    'storage',
  ]);
  for (const name of ['storage', 'backend', 'edge']) {
    assert.ok(
      target.stacks[name].startsWith(
        `arn:aws:cloudformation:${region}:${account}:stack/`,
      ),
    );
    assert.match(
      target.stacks[name].split(':stack/')[1],
      /^[A-Za-z][A-Za-z0-9-]*\/[a-f0-9-]+$/,
    );
  }
  const [owner, repository] = github.repository.split('/');
  const subject = `repo:${owner}@${github.ownerId}/${repository}@${github.repositoryId}:environment:${github.environment}`;
  const claims = {
    'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
    'token.actions.githubusercontent.com:sub': subject,
    'token.actions.githubusercontent.com:repository_id': github.repositoryId,
    'token.actions.githubusercontent.com:repository_owner_id': github.ownerId,
    'token.actions.githubusercontent.com:ref': github.ref,
    'token.actions.githubusercontent.com:environment': github.environment,
  };
  const publisherTrust = policy([
    {
      Effect: 'Allow',
      Principal: {
        Federated: `arn:aws:iam::${account}:oidc-provider/token.actions.githubusercontent.com`,
      },
      Action: 'sts:AssumeRoleWithWebIdentity',
      Condition: { StringEquals: claims },
    },
  ]);
  const bucket = `arn:aws:s3:::${resources.bucket}`;
  const objectKeys = [
    'index.html',
    'runtime-config.json',
    'favicon.svg',
    'main-*.js',
    'styles-*.css',
    'chunk-*.js',
    'chunk-*.css',
    'mfe/analytics/*',
    'mfe/administration/*',
    'mfe/support/*',
    '_deploy/backend/*.zip',
    '_releases/*',
  ];
  const backend = target.stacks.backend;
  const publisherPermissions = policy([
    allow(
      'ObserveOwnedBucket',
      ['s3:GetBucketTagging', 's3:GetBucketVersioning', 's3:ListBucket'],
      bucket,
    ),
    allow(
      'ReadReleaseAndControlBytes',
      ['s3:GetObject'],
      objectKeys.map((key) => `${bucket}/${key}`),
    ),
    allow(
      'CreateOnlyAbsentReleaseBytes',
      ['s3:PutObject'],
      objectKeys.map((key) => `${bucket}/${key}`),
      {
        StringEquals: { 's3:if-none-match': '*' },
      },
    ),
    allow(
      'ConditionallyReplaceControls',
      ['s3:PutObject'],
      [
        'index.html',
        'runtime-config.json',
        'favicon.svg',
        '_releases/delivery/current.json',
      ].map((key) => `${bucket}/${key}`),
      {
        Null: { 's3:if-match': 'false' },
      },
    ),
    allow(
      'ObserveOwnedStacks',
      [
        'cloudformation:DescribeStacks',
        'cloudformation:ListStackResources',
        'cloudformation:GetTemplate',
      ],
      Object.values(target.stacks),
    ),
    allow(
      'CreateBackendChangeSet',
      ['cloudformation:CreateChangeSet'],
      backend,
      {
        StringEquals: { 'cloudformation:RoleArn': target.serviceRoleArn },
        StringLike: { 'cloudformation:ChangeSetName': 'delivery-*' },
      },
    ),
    allow(
      'InspectAndExecuteBackendChangeSet',
      ['cloudformation:DescribeChangeSet', 'cloudformation:ExecuteChangeSet'],
      backend,
      {
        StringLike: {
          'cloudformation:ChangeSetName': [
            'delivery-*',
            `arn:aws:cloudformation:${region}:${account}:changeSet/delivery-*/*`,
          ],
        },
      },
    ),
    allow(
      'PreserveBackendTags',
      ['cloudformation:TagResource', 'cloudformation:UntagResource'],
      backend,
    ),
    allow(
      'PassOnlyBackendServiceRole',
      ['iam:PassRole'],
      target.serviceRoleArn,
      {
        StringEquals: { 'iam:PassedToService': 'cloudformation.amazonaws.com' },
      },
    ),
    allow(
      'ObserveOwnedFunction',
      [
        'lambda:GetAlias',
        'lambda:GetFunctionConfiguration',
        'lambda:GetFunctionUrlConfig',
        'lambda:GetFunctionConcurrency',
      ],
      [resources.functionArn, resources.functionArn + ':*'],
    ),
    allow(
      'ObserveOwnedDistribution',
      ['cloudfront:GetDistribution'],
      `arn:aws:cloudfront::${account}:distribution/${resources.distributionId}`,
    ),
    // These account-level read APIs do not support individual resource ARNs.
    allow(
      'ReadAccountPreflight',
      [
        'lambda:GetAccountSettings',
        'freetier:GetAccountPlanState',
        'cloudformation:ListStacks',
      ],
      '*',
    ),
  ]);
  const serviceTrust = policy([
    {
      Effect: 'Allow',
      Principal: { Service: 'cloudformation.amazonaws.com' },
      Action: 'sts:AssumeRole',
    },
  ]);
  const servicePermissions = policy([
    allow(
      'ReadOnlyOwnedBackendPackage',
      ['s3:GetObject'],
      `${bucket}/_deploy/backend/*.zip`,
    ),
    allow(
      'ObserveOwnedFunction',
      [
        'lambda:GetFunction',
        'lambda:GetFunctionConfiguration',
        'lambda:ListVersionsByFunction',
        'lambda:ListTags',
      ],
      [resources.functionArn, resources.functionArn + ':*'],
    ),
    allow(
      'PublishOwnedFunction',
      [
        'lambda:UpdateFunctionCode',
        'lambda:UpdateFunctionConfiguration',
        'lambda:PublishVersion',
      ],
      resources.functionArn,
    ),
    allow(
      'ManageOnlyLiveAlias',
      ['lambda:GetAlias', 'lambda:UpdateAlias'],
      resources.aliasArn,
    ),
    allow('ObserveExistingLambdaRole', ['iam:GetRole'], lambdaExecutionRoleArn),
    allow(
      'PassOnlyExistingLambdaRole',
      ['iam:PassRole'],
      lambdaExecutionRoleArn,
      {
        StringEquals: { 'iam:PassedToService': 'lambda.amazonaws.com' },
      },
    ),
  ]);
  return {
    schemaVersion: 1,
    project: target.project,
    provider: {
      Url: 'https://token.actions.githubusercontent.com',
      ClientIDList: ['sts.amazonaws.com'],
    },
    publisherTrust,
    publisherPermissions,
    serviceTrust,
    servicePermissions,
    setupRequiresFreshInventory: true,
    setupRequiresReviewedServiceRoleAssociation: true,
  };
}
