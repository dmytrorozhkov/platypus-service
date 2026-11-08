import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptance } from '../delivery/executor.mjs';

const target = {
  resources: {
    origin: 'https://dtest123.cloudfront.net',
    functionUrl: 'https://example.lambda-url.eu-north-1.on.aws/',
    bucketDomain: 'test.s3.eu-north-1.amazonaws.com',
  },
};
const manifest = {
  kind: 'platypus-neon-release-candidate',
  origin: target.resources.origin,
};

test('Neon acceptance selects the runtime and requires matching evidence', async () => {
  let selected;
  const result = await acceptance(
    async (options) => {
      selected = options;
      return {
        success: true,
        kind: 'platypus-neon-live-check',
        origin: target.resources.origin,
      };
    },
    target,
    manifest,
  );
  assert.equal(selected.runtimeVariant, 'neon');
  assert.equal(selected.origin, target.resources.origin);
  assert.equal(result.success, true);
  assert.match(result.evidenceSha256, /^[a-f0-9]{64}$/);
});

test('Neon acceptance rejects fixture, foreign-origin and failed evidence', async () => {
  const evidence = [
    { success: true },
    {
      success: true,
      kind: 'platypus-neon-live-check',
      origin: 'https://other.invalid',
    },
    {
      success: false,
      kind: 'platypus-neon-live-check',
      origin: target.resources.origin,
    },
  ];
  for (const result of evidence)
    await assert.rejects(acceptance(async () => result, target, manifest));
});

test('fixture acceptance preserves the existing checker contract', async () => {
  const result = await acceptance(
    async ({ runtimeVariant }) => {
      assert.equal(runtimeVariant, 'fixture');
      return { success: true };
    },
    target,
    { scope: 'full', origin: target.resources.origin },
  );
  assert.equal(result.success, true);
});

test('acceptance rejects a foreign release before invoking the checker', async () => {
  let calls = 0;
  await assert.rejects(
    acceptance(
      async () => {
        calls++;
        return { success: true };
      },
      target,
      { ...manifest, origin: 'https://other.invalid' },
    ),
    /origin differs/,
  );
  assert.equal(calls, 0);
});
