import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePendingManifest } from '../delivery/executor.mjs';

const target = {
  resources: { origin: 'https://dtest123.cloudfront.net' },
};

function fixture() {
  const context = {
    repository: 'dmytrorozhkov/platypus-service',
    sourceSha: '3'.repeat(40),
    runId: '123456',
    runAttempt: '1',
  };
  return {
    schemaVersion: 1,
    kind: 'publish',
    release: 'neon-123456-1',
    allowNeonTransition: true,
    context,
    manifest: {
      schemaVersion: 1,
      project: 'platypus-service',
      kind: 'platypus-neon-release-candidate',
      release: 'neon-123456-1',
      sourceSha: context.sourceSha,
      origin: target.resources.origin,
      objects: [{ key: 'index.html' }],
    },
  };
}

test('pending Neon publication binds source and packaging run', () => {
  const plan = fixture();
  assert.equal(validatePendingManifest(plan, target), plan.manifest);
});

test('recovery may select an older release from a different source run', () => {
  const plan = fixture();
  plan.kind = 'recover';
  plan.context = {
    ...plan.context,
    sourceSha: '4'.repeat(40),
    runId: '999',
  };
  delete plan.allowNeonTransition;
  assert.equal(validatePendingManifest(plan, target), plan.manifest);
});

test('legacy baseline import remains supported', () => {
  const plan = fixture();
  plan.kind = 'import';
  plan.context = null;
  plan.release = 'fixture-baseline';
  plan.manifest = {
    schemaVersion: 1,
    project: 'platypus-service',
    scope: 'full',
    release: plan.release,
    origin: target.resources.origin,
    objects: [{ key: 'index.html' }],
  };
  assert.equal(validatePendingManifest(plan, target), plan.manifest);
});

test('rejects unknown manifests and changed Neon publication identity', () => {
  const mutations = [
    (plan) => {
      plan.manifest.project = 'other';
    },
    (plan) => {
      plan.manifest.origin = 'https://other.invalid';
    },
    (plan) => {
      plan.manifest.kind = 'unknown';
    },
    (plan) => {
      plan.manifest.objects = [];
    },
    (plan) => {
      plan.context.sourceSha = '4'.repeat(40);
    },
    (plan) => {
      plan.context.repository = 'other/repository';
    },
    (plan) => {
      delete plan.allowNeonTransition;
    },
    (plan) => {
      plan.release = 'neon-999-1';
      plan.manifest.release = plan.release;
    },
    (plan) => {
      plan.context.sourceSha = '0'.repeat(40);
      plan.manifest.sourceSha = plan.context.sourceSha;
    },
    (plan) => {
      plan.kind = 'import';
    },
  ];
  for (const mutate of mutations) {
    const plan = fixture();
    mutate(plan);
    assert.throws(() => validatePendingManifest(plan, target));
  }
});
