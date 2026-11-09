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
  logGroupArn,
  neonBackend = false,
}) {
  assert.equal(typeof neonBackend, 'boolean');
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
  if (neonBackend) {
    const logPrefix = 'arn:aws:logs:' + region + ':' + account + ':log-group:';
    assert.equal(typeof logGroupArn, 'string');
    assert.ok(logGroupArn.startsWith(logPrefix));
    assert.match(
      logGroupArn.slice(logPrefix.length),
      /^[./_#A-Za-z0-9-]{1,512}$/,
    );
  }
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
    // Scope inspection to the backend; keep name restrictions on execution.
    allow(
      'InspectBackendChangeSets',
      ['cloudformation:DescribeChangeSet'],
      backend,
    ),
    allow(
      'ExecuteBackendChangeSet',
      ['cloudformation:ExecuteChangeSet'],
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
    // CloudFormation resolves GetAtt(LogGroup.Arn) when the existing role changes.
    // The registry LogGroup read handler needs these five metadata APIs. List
    // APIs lack resource-level ARN support; the other reads pin one owned group.
    ...(neonBackend
      ? [
          allow(
            'DiscoverLogGroupMetadata',
            [
              'logs:DescribeLogGroups',
              'logs:DescribeIndexPolicies',
              'logs:DescribeResourcePolicies',
            ],
            '*',
            {
              StringEquals: { 'aws:RequestedRegion': region },
            },
          ),
          allow(
            'ReadOnlyOwnedLogGroupMetadata',
            ['logs:ListTagsForResource', 'logs:GetDataProtectionPolicy'],
            [logGroupArn, logGroupArn + ':*'],
            {
              StringEquals: { 'aws:RequestedRegion': region },
            },
          ),
        ]
      : []),
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
    allow(
      'ObserveExistingLambdaRole',
      neonBackend
        ? [
            'iam:GetRole',
            'iam:GetRolePolicy',
            'iam:ListRolePolicies',
            'iam:ListAttachedRolePolicies',
          ]
        : ['iam:GetRole'],
      lambdaExecutionRoleArn,
    ),
    ...(neonBackend
      ? [
          allow(
            'ManageOnlyExistingLambdaInlinePolicies',
            ['iam:PutRolePolicy', 'iam:DeleteRolePolicy'],
            lambdaExecutionRoleArn,
          ),
        ]
      : []),
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

// Generates reviewable documents only; never creates roles or reads secret values.
export function buildCodeBuildAccessDocuments({
  target,
  github,
  lambdaExecutionRoleArn,
  projectName,
  logGroupArn,
}) {
  assert.equal(projectName, 'platypus-service-publisher');
  const documents = buildAccessDocuments({
    target,
    github,
    lambdaExecutionRoleArn,
    logGroupArn,
    neonBackend: true,
  });
  const account = target.accountId;
  const region = target.region;
  const projectArn =
    'arn:aws:codebuild:' + region + ':' + account + ':project/' + projectName;
  const group =
    'arn:aws:logs:' +
    region +
    ':' +
    account +
    ':log-group:/aws/codebuild/' +
    projectName;
  return {
    schemaVersion: 1,
    project: target.project,
    publisherTrust: policy([
      {
        Effect: 'Allow',
        Principal: { Service: 'codebuild.amazonaws.com' },
        Action: 'sts:AssumeRole',
        Condition: {
          StringEquals: {
            'aws:SourceAccount': account,
            'aws:SourceArn': projectArn,
          },
        },
      },
    ]),
    publisherPermissions: policy([
      ...documents.publisherPermissions.Statement,
      allow(
        'ReadOnlyGithubArtifactCredential',
        ['ssm:GetParameters'],
        'arn:aws:ssm:' +
          region +
          ':' +
          account +
          ':parameter/platypus-service/delivery/github-read-token',
      ),
      allow('CreateOnlyPublisherLogGroup', ['logs:CreateLogGroup'], group),
      allow(
        'WriteOnlyPublisherLogs',
        ['logs:CreateLogStream', 'logs:PutLogEvents'],
        group + ':log-stream:*',
      ),
    ]),
    serviceTrust: documents.serviceTrust,
    servicePermissions: documents.servicePermissions,
    setupRequiresFreshInventory: true,
    setupAllowsExplicitNeonBootstrap: true,
  };
}
