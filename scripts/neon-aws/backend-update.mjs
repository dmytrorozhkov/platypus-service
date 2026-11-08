import assert from 'node:assert/strict';
import { json, sha256 } from '../aws/common.mjs';
import { validateStoredNeonRuntime } from './runtime-binding.mjs';
import { neonBackendParameters, neonBackendTemplate } from './templates.mjs';

export function buildNeonBackendUpdate({
  target,
  manifest,
  runtimeBody,
  templateBody,
}) {
  const runtime = validateStoredNeonRuntime({
    target,
    manifest,
    body: runtimeBody,
  });
  assert(
    Buffer.isBuffer(templateBody) && templateBody.length <= 51200,
    'Bounded Neon template bytes required.',
  );
  assert.equal(
    sha256(templateBody),
    manifest.templateSha256,
    'Neon template digest differs from the selected release.',
  );
  assert.equal(
    templateBody.toString('utf8'),
    json(neonBackendTemplate()),
    'Neon template differs from the reviewed generator.',
  );
  const selected = neonBackendParameters(runtime, {
    bucket: target.resources.bucket,
    key: manifest.backend.key,
    sha256: manifest.backend.codeSha256,
    concurrencyMode: target.concurrency.mode,
  });
  assert.equal(
    selected.BackendRevision,
    manifest.backend.backendRevision,
    'Neon backend revision differs from the pinned runtime and ZIP.',
  );
  return { selected, templateBody: templateBody.toString('utf8') };
}
