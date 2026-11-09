import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAccessDocuments,
  buildCodeBuildAccessDocuments,
} from './access.mjs';

function config() {
  return {
    target: {
      project: 'platypus-service',
      region: 'eu-north-1',
      accountId: '123456789012',
      serviceRoleArn: 'arn:aws:iam::123456789012:role/platypus-cfn',
      stacks: Object.fromEntries(
        ['storage', 'backend', 'edge'].map((name) => [
          name,
          `arn:aws:cloudformation:eu-north-1:123456789012:stack/platypus-${name}/1234-abcd`,
        ]),
      ),
      resources: {
        bucket: 'fictional-platypus-bucket',
        functionArn:
          'arn:aws:lambda:eu-north-1:123456789012:function:fixture-api',
        aliasArn:
          'arn:aws:lambda:eu-north-1:123456789012:function:fixture-api:live',
        distributionId: 'EXAMPLE',
      },
    },
    github: {
      repository: 'dmytrorozhkov/platypus-service',
      repositoryId: '456',
      ownerId: '123',
      ref: 'refs/heads/main',
      environment: 'aws-learning',
    },
    lambdaExecutionRoleArn: 'arn:aws:iam::123456789012:role/existing-lambda',
  };
}

test('trust excludes alternate repositories, refs, audiences and absent environment claims', () => {
  const trust = buildAccessDocuments(config()).publisherTrust.Statement[0];
  assert.equal(trust.Action, 'sts:AssumeRoleWithWebIdentity');
  const expected = trust.Condition.StringEquals;
  assert.equal(
    expected['token.actions.githubusercontent.com:sub'],
    'repo:dmytrorozhkov@123/platypus-service@456:environment:aws-learning',
  );
  const accepts = (claims) =>
    Object.entries(expected).every(([name, value]) => claims[name] === value);
  assert.equal(accepts(expected), true);
  for (const name of Object.keys(expected)) {
    assert.equal(accepts({ ...expected, [name]: 'untrusted' }), false);
    const missing = { ...expected };
    delete missing[name];
    assert.equal(accepts(missing), false);
  }
});

test('routine publisher cannot delete resources, mutate IAM or directly publish backend code', () => {
  const documents = buildAccessDocuments(config());
  const statements = documents.publisherPermissions.Statement;
  const actions = statements.flatMap((statement) => statement.Action);
  for (const action of [
    's3:DeleteObject',
    'cloudformation:DeleteStack',
    'cloudformation:CreateStack',
    'cloudformation:UpdateStack',
    'iam:CreateRole',
    'iam:PutRolePolicy',
    'lambda:UpdateAlias',
    'lambda:UpdateFunctionCode',
  ])
    assert.equal(actions.includes(action), false);
  for (const statement of statements) {
    assert.ok(statement.Action.every((action) => !action.includes('*')));
    if (statement.Resource === '*')
      assert.equal(statement.Sid, 'ReadAccountPreflight');
  }
  const pass = statements.find(
    (statement) => statement.Sid === 'PassOnlyBackendServiceRole',
  );
  assert.equal(pass.Resource, config().target.serviceRoleArn);
  assert.equal(
    pass.Condition.StringEquals['iam:PassedToService'],
    'cloudformation.amazonaws.com',
  );
  const changes = statements.find(
    (statement) => statement.Sid === 'CreateBackendChangeSet',
  );
  assert.equal(changes.Resource, config().target.stacks.backend);
  assert.equal(
    changes.Condition.StringLike['cloudformation:ChangeSetName'],
    'delivery-*',
  );
  assert.equal(
    changes.Condition.StringEquals['cloudformation:RoleArn'],
    config().target.serviceRoleArn,
  );
  const inspect = statements.find((s) =>
    s.Action.includes('cloudformation:DescribeChangeSet'),
  );
  assert.deepEqual(inspect.Action, ['cloudformation:DescribeChangeSet']);
  assert.equal(inspect.Resource, config().target.stacks.backend);
  assert.equal(inspect.Condition, undefined);
  const execute = statements.find((s) =>
    s.Action.includes('cloudformation:ExecuteChangeSet'),
  );
  assert.deepEqual(execute.Action, ['cloudformation:ExecuteChangeSet']);
  assert.equal(execute.Resource, config().target.stacks.backend);
  assert.deepEqual(
    execute.Condition.StringLike['cloudformation:ChangeSetName'],
    [
      'delivery-*',
      'arn:aws:cloudformation:eu-north-1:123456789012:changeSet/delivery-*/*',
    ],
  );
});

test('CloudFormation role has no role, topology, deletion or invocation authority', () => {
  const documents = buildAccessDocuments(config());
  const actions = documents.servicePermissions.Statement.flatMap(
    (statement) => statement.Action,
  );
  assert.ok(
    !actions.some((action) =>
      /(?:Delete|Create|Invoke|PutRole|Attach|AddPermission)/.test(action),
    ),
  );
  assert.ok(
    documents.servicePermissions.Statement.every(
      (statement) => statement.Resource !== '*',
    ),
  );
  assert.equal(
    documents.serviceTrust.Statement[0].Principal.Service,
    'cloudformation.amazonaws.com',
  );
  const alias = documents.servicePermissions.Statement.find(
    (statement) => statement.Sid === 'ManageOnlyLiveAlias',
  );
  assert.equal(alias.Resource, config().target.resources.aliasArn);
});

test('S3 writes require absence or observed ETag and cannot replace an immutable graph', () => {
  const statements = buildAccessDocuments(
    config(),
  ).publisherPermissions.Statement.filter((statement) =>
    statement.Action.includes('s3:PutObject'),
  );
  assert.equal(statements.length, 2);
  const create = statements.find(
    (statement) => statement.Sid === 'CreateOnlyAbsentReleaseBytes',
  );
  assert.equal(create.Condition.StringEquals['s3:if-none-match'], '*');
  const replace = statements.find(
    (statement) => statement.Sid === 'ConditionallyReplaceControls',
  );
  assert.equal(replace.Condition.Null['s3:if-match'], 'false');
  assert.deepEqual(
    replace.Resource.map(
      (value) => value.split('fictional-platypus-bucket/')[1],
    ),
    [
      'index.html',
      'runtime-config.json',
      'favicon.svg',
      '_releases/delivery/current.json',
    ],
  );
  assert.ok(replace.Resource.every((value) => !value.includes('*')));
});

test('invalid cross-account target and widened trust configuration are rejected', () => {
  for (const mutate of [
    (value) => {
      value.target.serviceRoleArn = 'arn:aws:iam::999999999999:role/other';
    },
    (value) => {
      value.target.resources.functionArn += ':other';
    },
    (value) => {
      value.target.stacks.backend =
        'arn:aws:cloudformation:us-east-1:123456789012:stack/other/1234';
    },
    (value) => {
      value.github.repository = 'attacker/fork';
    },
    (value) => {
      value.github.ref = 'refs/heads/feature';
    },
    (value) => {
      value.github.environment = '*';
    },
    (value) => {
      value.github.ownerId = '*';
    },
  ]) {
    const value = config();
    mutate(value);
    assert.throws(() => buildAccessDocuments(value));
  }
});

test('Neon CFN policy changes are limited to the existing Lambda role and never reach secrets', () => {
  const input = config();
  const documents = buildAccessDocuments({ ...input, neonBackend: true });
  const writes = documents.servicePermissions.Statement.filter((statement) =>
    statement.Action.some((action) => /PutRole|DeleteRole/.test(action)),
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].Resource, input.lambdaExecutionRoleArn);
  assert.deepEqual(writes[0].Action, [
    'iam:PutRolePolicy',
    'iam:DeleteRolePolicy',
  ]);
  assert.equal(
    documents.servicePermissions.Statement.some((statement) =>
      statement.Action.some((action) =>
        /ssm:|kms:|iam:Create|iam:Attach|iam:UpdateAssumeRole/.test(action),
      ),
    ),
    false,
  );
});

test('CodeBuild trust pins the project and publisher can read only its distinct artifact credential', () => {
  const input = config();
  const result = buildCodeBuildAccessDocuments({
    ...input,
    projectName: 'platypus-service-publisher',
  });
  const trust = result.publisherTrust.Statement[0];
  assert.equal(trust.Principal.Service, 'codebuild.amazonaws.com');
  assert.deepEqual(trust.Condition.StringEquals, {
    'aws:SourceAccount': input.target.accountId,
    'aws:SourceArn':
      'arn:aws:codebuild:eu-north-1:123456789012:project/platypus-service-publisher',
  });
  const secrets = result.publisherPermissions.Statement.filter((statement) =>
    statement.Action.some((action) => action.startsWith('ssm:')),
  );
  assert.equal(secrets.length, 1);
  assert.deepEqual(secrets[0].Action, ['ssm:GetParameters']);
  assert.equal(
    secrets[0].Resource,
    'arn:aws:ssm:eu-north-1:123456789012:parameter/platypus-service/delivery/github-read-token',
  );
  assert.equal(
    result.publisherPermissions.Statement.some((statement) =>
      statement.Action.some((action) =>
        /iam:Put|iam:Delete|lambda:Update|kms:Decrypt/.test(action),
      ),
    ),
    false,
  );
  assert.throws(() =>
    buildCodeBuildAccessDocuments({ ...input, projectName: 'other' }),
  );
});
