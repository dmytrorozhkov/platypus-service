import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLiveEvidence } from '../delivery/cli.mjs';

const selection = {
  origin: 'https://dtest123.cloudfront.net',
  bucketOrigin: 'https://test.s3.eu-north-1.amazonaws.com',
  functionUrl: 'https://test.lambda-url.eu-north-1.on.aws/',
  runtimeVariant: 'neon',
  startedAt: Date.now() - 1000,
};
function evidence() {
  return {
    success: true,
    kind: 'platypus-neon-live-check',
    runtimeVariant: 'neon',
    origin: selection.origin,
    bucketOrigin: selection.bucketOrigin,
    functionOrigin: new URL(selection.functionUrl).origin,
    startedAt: new Date(selection.startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    checks: ['api', 'assets', 'protection', 'browser', 'retry', 'mobile'],
  };
}
test('live evidence binds freshness, exact origins, runtime and all check groups', () => {
  const value = evidence();
  assert.equal(validateLiveEvidence(value, selection), value);
  const fixture = {
    ...value,
    kind: 'platypus-fixture-live-check',
    runtimeVariant: 'fixture',
  };
  assert.equal(
    validateLiveEvidence(fixture, { ...selection, runtimeVariant: 'fixture' }),
    fixture,
  );
});
test('stale, mismatched or incomplete live evidence cannot finish a deployment', () => {
  for (const patch of [
    { success: false },
    { kind: 'platypus-fixture-live-check' },
    { runtimeVariant: 'fixture' },
    { origin: 'https://other.invalid' },
    { bucketOrigin: 'https://other.invalid' },
    { functionOrigin: 'https://other.invalid' },
    { checks: ['api'] },
    { checks: [1, 2, 3, 4, 5, 6] },
    { startedAt: new Date(selection.startedAt - 1).toISOString() },
    { finishedAt: 'invalid' },
    { finishedAt: new Date(selection.startedAt - 1).toISOString() },
  ])
    assert.throws(() =>
      validateLiveEvidence({ ...evidence(), ...patch }, selection),
    );
});
