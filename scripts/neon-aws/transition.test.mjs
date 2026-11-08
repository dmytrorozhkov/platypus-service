import assert from 'node:assert/strict';
import test from 'node:test';
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
    RoleARN: target.serviceRoleArn,
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

test('Neon transition rejects role, resource and property drift', () => {
  const mutations = [
    (value) => {
      value.RoleARN += '-other';
    },
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
