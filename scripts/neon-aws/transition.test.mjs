import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateChangeSet } from '../delivery/executor.mjs';

const target = {
  stacks: { backend: 'reviewed-backend-stack' },
  serviceRoleArn: 'arn:aws:iam::111122223333:role/reviewed-cfn',
};
const name = 'delivery-neon-transition';

function candidate() {
  return {
    StackId: target.stacks.backend,
    ChangeSetName: name,
    Status: 'CREATE_COMPLETE',
    ExecutionStatus: 'AVAILABLE',
    Changes: [
      ['ExecutionRole', 'AWS::IAM::Role', 'Policies'],
      ['Function', 'AWS::Lambda::Function', 'Timeout'],
      ['Version', 'AWS::Lambda::Version', 'CodeSha256'],
      ['LiveAlias', 'AWS::Lambda::Alias', 'FunctionVersion'],
    ].map(([LogicalResourceId, ResourceType, property]) => ({
      Type: 'Resource',
      ResourceChange: {
        LogicalResourceId,
        ResourceType,
        Action: 'Modify',
        Replacement: LogicalResourceId === 'Version' ? 'True' : 'False',
        Scope: ['Properties'],
        Details: [{ Target: { Attribute: 'Properties', Name: property } }],
      },
    })),
  };
}

test('Neon transition requires explicit mode and excludes recovery', () => {
  assert.doesNotThrow(() =>
    validateChangeSet(candidate(), target, name, false, true),
  );
  assert.throws(() => validateChangeSet(candidate(), target, name));
  assert.throws(() => validateChangeSet(candidate(), target, name, true, true));
});

test('Neon transition rejects resource and property drift', () => {
  const mutations = [
    (value) => {
      value.Changes.pop();
    },
    (value) => {
      value.Changes.push(value.Changes[0]);
    },
    (value) => {
      value.Changes[0].ResourceChange.Action = 'Add';
    },
    (value) => {
      value.Changes[0].ResourceChange.Replacement = 'True';
    },
    (value) => {
      value.Changes[0].ResourceChange.Details[0].Target.Name =
        'AssumeRolePolicyDocument';
    },
    (value) => {
      value.Changes[1].ResourceChange.Details[0].Target.Name = 'VpcConfig';
    },
    (value) => {
      value.Changes[1].ResourceChange.Details[0].Target.Name = 'MemorySize';
    },
    (value) => {
      value.Changes[0].ResourceChange.LogicalResourceId = 'FunctionUrl';
    },
  ];
  for (const mutate of mutations) {
    const value = candidate();
    mutate(value);
    assert.throws(() => validateChangeSet(value, target, name, false, true));
  }
});

// Sanitized structural capture from the November 9 AWS response; no property values.
const observed = JSON.parse(
  readFileSync(
    new URL('./fixtures/transition-change-set.json', import.meta.url),
    'utf8',
  ),
);
test('AWS transition response omits RoleARN and includes metadata and derived Role changes', () => {
  assert.equal(Object.hasOwn(observed, 'RoleARN'), false);
  assert.doesNotThrow(() =>
    validateChangeSet(observed, target, name, false, true),
  );
  assert.throws(() => validateChangeSet(observed, target, name));
  const mutations = [
    (value) => {
      value.Changes[0].ResourceChange.Scope.push('Tags');
    },
    (value) => {
      value.Changes[0].ResourceChange.Details[0].ChangeSource =
        'ResourceAttribute';
    },
    (value) => {
      value.Changes[0].ResourceChange.Details[0].Target.Name = 'Unreviewed';
    },
    (value) => {
      value.Changes[1].ResourceChange.Details.find(
        (d) => d.Target.Name === 'Role',
      ).CausingEntity = 'OtherRole.Arn';
    },
    (value) => {
      value.Changes[1].ResourceChange.Details.find(
        (d) => d.Target.Name === 'Role',
      ).ChangeSource = 'DirectModification';
    },
    (value) => {
      value.Changes[1].ResourceChange.Details.find(
        (d) => d.Target.Name === 'Role',
      ).Evaluation = 'Static';
    },
    (value) => {
      value.Changes[1].ResourceChange.Details.find(
        (d) => d.Target.Name === 'Role',
      ).Target.RequiresRecreation = 'Always';
    },
    (value) => {
      value.Changes[2].ResourceChange.Scope.push('Metadata');
    },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(observed);
    mutate(value);
    assert.throws(() => validateChangeSet(value, target, name, false, true));
  }
});
