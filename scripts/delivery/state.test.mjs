import assert from 'node:assert/strict';
import test from 'node:test';
import { json, project, sha256 } from '../aws/common.mjs';
import {
  preflight,
  readState,
  stateKey,
  validateChangeSet,
} from './executor.mjs';

const accountId = '111122223333';
const functionArn = `arn:aws:lambda:eu-north-1:${accountId}:function:platypus-test-api`;
const target = {
  project,
  region: 'eu-north-1',
  accountId,
  ownershipVerified: true,
  serviceRoleArn: `arn:aws:iam::${accountId}:role/platypus-test-delivery-cfn`,
  lambdaExecutionRoleArn: `arn:aws:iam::${accountId}:role/platypus-test-lambda`,
  concurrency: { mode: 'account-cap-ten', acceptedSharedAccountCap: true },
  stacks: Object.fromEntries(
    ['storage', 'backend', 'edge'].map((kind) => [
      kind,
      `arn:aws:cloudformation:eu-north-1:${accountId}:stack/platypus-test-${kind}/11111111-2222-3333-4444-555555555555`,
    ]),
  ),
  resources: {
    bucket: 'platypus-test-delivery-artifacts',
    bucketDomain:
      'platypus-test-delivery-artifacts.s3.eu-north-1.amazonaws.com',
    functionArn,
    aliasArn: functionArn + ':live',
    origin: 'https://dfailurefixture.cloudfront.net',
    functionUrl: 'https://failurefixture.lambda-url.eu-north-1.on.aws/',
    distributionId: 'E123456789ABC',
  },
};
const identity = {
  accountId,
  region: target.region,
  resources: target.resources,
  stacks: target.stacks,
  serviceRoleArn: target.serviceRoleArn,
  lambdaExecutionRoleArn: target.lambdaExecutionRoleArn,
};
const completed = () => ({
  schemaVersion: 1,
  project,
  target: structuredClone(identity),
  status: 'completed',
  release: 'known-release',
  recordSha256: 'a'.repeat(64),
  operationId: 'gh-100-1',
});
const pending = () => ({
  schemaVersion: 1,
  project,
  target: structuredClone(identity),
  status: 'pending',
  operationId: 'gh-101-1',
  kind: 'publish',
  candidate: 'next-release',
  context: {
    sourceSha: 'b'.repeat(40),
    runId: '101',
    runAttempt: '1',
    repository: 'dmytrorozhkov/platypus-service',
  },
  previous: completed(),
  planKey: '_releases/delivery/operations/gh-101-1/plan.json',
  planSha256: 'c'.repeat(64),
});

function store(value, changes = {}) {
  const body = Buffer.from(json(value));
  let reads = 0;
  return {
    get reads() {
      return reads;
    },
    async getObject(input) {
      reads++;
      assert.deepEqual(input, {
        Bucket: target.resources.bucket,
        ExpectedBucketOwner: accountId,
        Key: stateKey,
      });
      return {
        body,
        ETag: '"opaque-concurrency-token"',
        ChecksumSHA256: Buffer.from(sha256(body), 'hex').toString('base64'),
        ...changes,
      };
    },
    async putObject() {
      assert.fail('State inspection must never write.');
    },
    async request() {
      assert.fail('State inspection must never call another service.');
    },
  };
}

test('durable state binds exact target and preserves opaque ETag independently from body SHA', async () => {
  for (const value of [completed(), pending()]) {
    const memory = store(value);
    const observed = await readState(memory, target);
    assert.deepEqual(observed.value, value);
    assert.equal(observed.ETag, '"opaque-concurrency-token"');
    assert.equal(memory.reads, 1);
  }
});

test('wrong-target or malformed state fails without an implicit baseline or repair write', async () => {
  const cases = [
    (value) => {
      value.target.accountId = '999988887777';
    },
    (value) => {
      value.target.resources.bucket = 'other-bucket';
    },
    (value) => {
      value.target.resources.origin = 'https://dforeign.cloudfront.net';
    },
    (value) => {
      value.target.stacks.backend = target.stacks.storage;
    },
    (value) => {
      value.project = 'foreign-project';
    },
    (value) => {
      value.schemaVersion = 2;
    },
    (value) => {
      value.status = 'success';
    },
    (value) => {
      value.recordSha256 = 'opaque-etag';
    },
    (value) => {
      value.release = '../escape';
    },
  ];
  for (const change of cases) {
    const value = completed();
    change(value);
    await assert.rejects(
      readState(store(value), target),
      /state|digest|Release/i,
    );
  }
  await assert.rejects(
    readState(
      store(completed(), {
        ChecksumSHA256: Buffer.alloc(32).toString('base64'),
      }),
      target,
    ),
    /checksum mismatch/,
  );
  await assert.rejects(
    readState(store(completed(), { body: Buffer.from('{') }), target),
    /checksum mismatch/,
  );
});

test('pending identity cannot redirect the operator to an unrelated or traversing plan', async () => {
  for (const change of [
    (value) => {
      value.operationId = '../other';
    },
    (value) => {
      value.planKey = '_releases/delivery/operations/gh-999-1/plan.json';
    },
    (value) => {
      value.planKey = '_releases/delivery/operations/gh-101-1/../plan.json';
    },
    (value) => {
      value.planSha256 = 'unknown';
    },
    (value) => {
      value.previous = null;
    },
    (value) => {
      value.kind = 'force-publish';
    },
  ]) {
    const value = pending();
    change(value);
    await assert.rejects(readState(store(value), target), /pending|previous/i);
  }
});

test('only genuine missing state is optional; denied access and service errors stay fatal', async () => {
  const missing = {
    async getObject() {
      throw Object.assign(new Error('absent'), { code: 'NoSuchKey' });
    },
  };
  assert.equal(await readState(missing, target, true), null);
  await assert.rejects(readState(missing, target), /absent/);
  for (const code of ['AccessDenied', 'ExpiredToken', 'ServiceUnavailable']) {
    const denied = {
      async getObject() {
        throw Object.assign(new Error(code), { code });
      },
    };
    await assert.rejects(readState(denied, target, true), new RegExp(code));
  }
});

function proposedChangeSet() {
  return {
    StackId: target.stacks.backend,
    ChangeSetName: 'delivery-gh-100-1',
    Status: 'CREATE_COMPLETE',
    ExecutionStatus: 'AVAILABLE',
    Changes: [
      ['Function', 'AWS::Lambda::Function', 'Code'],
      ['Version', 'AWS::Lambda::Version', 'CodeSha256'],
      ['LiveAlias', 'AWS::Lambda::Alias', 'FunctionVersion'],
    ].map(([LogicalResourceId, ResourceType, Name]) => ({
      Type: 'Resource',
      ResourceChange: {
        LogicalResourceId,
        ResourceType,
        Action: 'Modify',
        Replacement: LogicalResourceId === 'Version' ? 'True' : 'False',
        Scope: ['Properties'],
        Details: [{ Target: { Attribute: 'Properties', Name } }],
      },
    })),
  };
}

test('change-set review rejects topology, IAM, replacement and unexpected execution expansion', () => {
  assert.doesNotThrow(() =>
    validateChangeSet(proposedChangeSet(), target, 'delivery-gh-100-1'),
  );
  for (const change of [
    (value) => {
      value.StackId = target.stacks.storage;
    },
    (value) => {
      value.ExecutionStatus = 'EXECUTE_IN_PROGRESS';
    },
    (value) => {
      value.Status = 'CREATE_PENDING';
    },
    (value) => {
      value.NextToken = 'unreviewed-page';
    },
    (value) => {
      value.IncludeNestedStacks = true;
    },
    (value) => {
      value.ParentChangeSetId = 'parent';
    },
    (value) => {
      value.RootChangeSetId = 'root';
    },
    (value) => {
      value.ImportExistingResources = true;
    },
    (value) => {
      value.Changes[0].ResourceChange.Replacement = 'True';
    },
    (value) => {
      value.Changes[0].ResourceChange.Replacement = 'Conditional';
    },
    (value) => {
      value.Changes[0].ResourceChange.Action = 'Remove';
    },
    (value) => {
      value.Changes[0].ResourceChange.Details[0].Target.Name = 'Role';
    },
    (value) => {
      value.Changes[0].ResourceChange.Details[0].Target.Name =
        'ReservedConcurrentExecutions';
    },
    (value) => {
      value.Changes[0].ResourceChange.Scope.push('Metadata');
    },
    (value) => {
      value.Changes.push({
        Type: 'Resource',
        ResourceChange: {
          LogicalResourceId: 'Role',
          ResourceType: 'AWS::IAM::Role',
          Action: 'Modify',
          Replacement: 'False',
          Scope: ['Properties'],
          Details: [{ Target: { Attribute: 'Properties', Name: 'Policies' } }],
        },
      });
    },
  ]) {
    const proposal = proposedChangeSet();
    change(proposal);
    assert.throws(
      () => validateChangeSet(proposal, target, 'delivery-gh-100-1'),
      /change set|resource change|property change/i,
    );
  }
});

test('recovery change-set authority permits only the retained alias target', () => {
  const proposal = proposedChangeSet();
  proposal.Changes = proposal.Changes.slice(-1);
  assert.doesNotThrow(() =>
    validateChangeSet(proposal, target, 'delivery-gh-100-1', true),
  );
  assert.throws(
    () =>
      validateChangeSet(proposedChangeSet(), target, 'delivery-gh-100-1', true),
    /resource change/,
  );
  proposal.Changes[0].ResourceChange.Details[0].Target.Name = 'RoutingConfig';
  assert.throws(
    () => validateChangeSet(proposal, target, 'delivery-gh-100-1', true),
    /property change/,
  );
});

test('preflight rejects wrong account, plan and quota before any resource or state write', async () => {
  const free = {
    accountId,
    accountPlanType: 'FREE',
    accountPlanStatus: 'ACTIVE',
    accountPlanRemainingCredits: { amount: 100 },
    accountPlanExpirationDate: '2099-01-01T00:00:00Z',
  };
  for (const responses of [
    [{ Account: '999988887777' }],
    [{ Account: accountId }, { ...free, accountPlanType: 'PAID' }],
    [
      { Account: accountId },
      { ...free, accountPlanRemainingCredits: { amount: 0 } },
    ],
    [
      { Account: accountId },
      { ...free, accountPlanExpirationDate: '2020-01-01T00:00:00Z' },
    ],
    [
      { Account: accountId },
      free,
      {
        AccountLimit: {
          ConcurrentExecutions: 11,
          UnreservedConcurrentExecutions: 11,
        },
      },
    ],
    [
      { Account: accountId },
      free,
      {
        AccountLimit: {
          ConcurrentExecutions: 10,
          UnreservedConcurrentExecutions: 0,
        },
      },
    ],
  ]) {
    const expected = [
      'sts:get-caller-identity',
      'freetier:get-account-plan-state',
      'lambda:get-account-settings',
    ];
    let index = 0;
    const transport = {
      async request(service, operation) {
        assert.equal(service + ':' + operation, expected[index]);
        assert(
          index < responses.length,
          'Preflight must stop at the first failed gate.',
        );
        return responses[index++];
      },
      async getObject() {
        assert.fail('No state read is needed after failed preflight.');
      },
      async putObject() {
        assert.fail('Failed preflight must never write.');
      },
    };
    await assert.rejects(
      preflight({ target, transport }),
      /account differs|FREE plan|quota/i,
    );
    assert.equal(index, responses.length);
  }
});
