import { json, sha256 } from '../aws/common.mjs';
import { validateNeonRuntimeConfig } from './templates.mjs';

const need = (condition, message) => {
  if (!condition) throw new Error(message);
};

export function validateStoredNeonRuntime({ target, manifest, body }) {
  need(
    manifest?.kind === 'platypus-neon-release-candidate',
    'Expected a Neon release manifest.',
  );
  need(
    Buffer.isBuffer(body) && body.length <= 16384,
    'Invalid stored Neon runtime size.',
  );
  need(
    sha256(body) === manifest.runtimeSha256,
    'Stored Neon runtime digest differs.',
  );

  let runtime;
  try {
    runtime = validateNeonRuntimeConfig(JSON.parse(body.toString('utf8')));
  } catch {
    throw new Error('Stored Neon runtime configuration is invalid.');
  }

  need(
    body.toString('utf8') === json(runtime),
    'Stored Neon runtime must be canonical.',
  );
  need(
    runtime.accountId === target.accountId &&
      runtime.region === target.region &&
      runtime.origin === target.resources.origin &&
      manifest.origin === target.resources.origin,
    'Stored Neon runtime differs from the selected AWS target.',
  );
  return runtime;
}

export function validateNeonLambdaConfiguration({
  target,
  manifest,
  configuration,
  body,
}) {
  const runtime = validateStoredNeonRuntime({ target, manifest, body });
  need(configuration.Timeout === 30, 'Unexpected Neon Lambda timeout.');

  const role = target.lambdaExecutionRoleArn;
  need(
    typeof role === 'string' &&
      role.startsWith(`arn:aws:iam::${runtime.accountId}:role/`) &&
      configuration.Role === role,
    'Unexpected Neon Lambda execution role.',
  );

  const expected = {
    ALLOWED_ORIGINS: runtime.origin,
    NEON_HOST: runtime.neonHost,
    NEON_DATABASE: runtime.database,
    NEON_USER: runtime.user,
    NEON_CONFIRM_TARGET: `${runtime.neonHost}/${runtime.database}`,
    NEON_PASSWORD_PARAMETER_ARN: runtime.passwordParameterArn,
    NEON_PASSWORD_PARAMETER_VERSION: String(runtime.passwordParameterVersion),
  };
  const variables = configuration.Environment?.Variables;
  need(
    variables &&
      typeof variables === 'object' &&
      Object.keys(variables).length === Object.keys(expected).length &&
      Object.entries(expected).every(
        ([key, value]) =>
          Object.hasOwn(variables, key) && variables[key] === value,
      ),
    'Neon Lambda environment differs from the pinned runtime.',
  );
  return runtime;
}
