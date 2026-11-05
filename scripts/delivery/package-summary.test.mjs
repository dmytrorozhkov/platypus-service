import assert from 'node:assert/strict';
import test from 'node:test';
import { createPackageSummary } from './package-summary.mjs';

const valid = () => ({
  repository: 'dmytrorozhkov/platypus-service',
  ref: 'refs/heads/main',
  eventName: 'workflow_dispatch',
  workflowRef:
    'dmytrorozhkov/platypus-service/.github/workflows/package.yml@refs/heads/main',
  sourceSha: 'a'.repeat(40),
  runId: '12345',
  runAttempt: '2',
  release: 'gh-12345-2-aaaaaaaaaaaa',
  artifactId: '67890',
  artifactDigest: 'b'.repeat(64),
  envelopeSha256: 'c'.repeat(64),
});

test('package receipt identifies the exact source, run attempt, artifact and distinct digests', () => {
  const options = valid();
  const summary = createPackageSummary(options);
  for (const value of [
    options.repository,
    options.sourceSha,
    options.release,
    options.artifactId,
    options.artifactDigest,
    options.envelopeSha256,
  ])
    assert(summary.includes(value));
  assert(summary.includes('/actions/runs/12345/attempts/2'));
  assert(summary.includes('/actions/runs/12345/artifacts/67890'));
  assert.match(summary, /GitHub artifact ZIP SHA-256/);
  assert.match(summary, /Bundle envelope SHA-256/);
  assert.match(summary, /one day/);
  assert.match(summary, /preparation evidence/);
  assert.match(summary, /no AWS access or publication step/);
});

test('missing metadata and noncanonical or nonmanual identities cannot produce a receipt', () => {
  for (const key of Object.keys(valid())) {
    const options = valid();
    delete options[key];
    assert.throws(() => createPackageSummary(options), key);
  }
  for (const change of [
    { repository: 'fork/platypus-service' },
    { ref: 'refs/heads/feature/package' },
    { eventName: 'pull_request' },
    {
      workflowRef:
        'dmytrorozhkov/platypus-service/.github/workflows/ci.yml@refs/heads/main',
    },
    { sourceSha: 'a'.repeat(39) },
    { runId: '0' },
    { runAttempt: '01' },
    { artifactId: 'not-an-id' },
    { artifactDigest: '' },
    { envelopeSha256: 'g'.repeat(64) },
    { release: 'gh-12345-1-aaaaaaaaaaaa' },
  ])
    assert.throws(() => createPackageSummary({ ...valid(), ...change }));
});

test('Markdown, command and newline injection and overlong run identities are rejected', () => {
  for (const key of Object.keys(valid()))
    for (const value of [
      'value\n| injected | value |',
      '[link](https://invalid.example)',
      '`command`',
      '$(command)',
    ])
      assert.throws(
        () => createPackageSummary({ ...valid(), [key]: value }),
        key,
      );
  assert.throws(
    () =>
      createPackageSummary({
        ...valid(),
        runId: '9'.repeat(20),
        runAttempt: '9'.repeat(20),
        release: 'gh-too-long',
      }),
    /too long/,
  );
});
