import { backendTemplate } from '../aws/templates.mjs';
import { json, sha256 } from '../aws/common.mjs';

const keys = [
  'schemaVersion',
  'kind',
  'region',
  'accountId',
  'origin',
  'neonHost',
  'database',
  'user',
  'passwordParameterArn',
  'passwordParameterVersion',
];
const hostPattern =
  '^ep-[a-z0-9]+(?:-[a-z0-9]+)*-pooler\\.(?:c-[1-9][0-9]*\\.)?eu-central-1\\.aws\\.neon\\.tech$';
const originPattern = '^https://d[a-z0-9]{1,62}\\.cloudfront\\.net$';
const parameterPath = '/platypus-service/production/neon/password';
const ref = (name) => ({ Ref: name });
const string = (Description, AllowedPattern) => ({
  Type: 'String',
  Description,
  AllowedPattern,
});
const failure = () =>
  new Error('Invalid nonsecret Neon AWS runtime configuration.');

export function validateNeonRuntimeConfig(config) {
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(config)) ||
    Reflect.ownKeys(config).length !== keys.length ||
    keys.some(
      (key) =>
        !Object.hasOwn(config, key) ||
        !('value' in Object.getOwnPropertyDescriptor(config, key)),
    )
  )
    throw failure();
  const value = Object.fromEntries(keys.map((key) => [key, config[key]]));
  if (
    value.schemaVersion !== 1 ||
    value.kind !== 'platypus-neon-runtime' ||
    value.region !== 'eu-north-1' ||
    typeof value.accountId !== 'string' ||
    !/^[0-9]{12}$/.test(value.accountId) ||
    value.accountId === '000000000000' ||
    typeof value.origin !== 'string' ||
    !new RegExp(originPattern).test(value.origin) ||
    typeof value.neonHost !== 'string' ||
    value.neonHost.length > 253 ||
    !new RegExp(hostPattern).test(value.neonHost) ||
    value.neonHost.split('.').some((label) => label.length > 63) ||
    value.database !== 'neondb' ||
    value.user !== 'platypus_app' ||
    value.passwordParameterArn !==
      `arn:aws:ssm:eu-north-1:${value.accountId}:parameter${parameterPath}` ||
    !Number.isSafeInteger(value.passwordParameterVersion) ||
    value.passwordParameterVersion < 1
  )
    throw failure();
  return value;
}

export function computeNeonBackendRevision(config, codeSha256) {
  if (
    typeof codeSha256 !== 'string' ||
    !/^[A-Za-z0-9+/]{43}=$/.test(codeSha256) ||
    Buffer.from(codeSha256, 'base64').toString('base64') !== codeSha256
  )
    throw failure();
  return sha256(
    json({
      kind: 'platypus-neon-backend-revision',
      packageSha256: codeSha256,
      runtime: validateNeonRuntimeConfig(config),
    }),
  );
}

export function neonBackendParameters(config, packageInputs) {
  const value = validateNeonRuntimeConfig(config);
  if (
    !packageInputs ||
    typeof packageInputs !== 'object' ||
    Array.isArray(packageInputs) ||
    Object.keys(packageInputs).some(
      (key) =>
        ![
          'bucket',
          'key',
          'sha256',
          'concurrencyMode',
          'rollbackVersion',
        ].includes(key),
    )
  )
    throw failure();
  const {
    bucket,
    key,
    sha256: codeSha256,
    concurrencyMode = 'account-cap-ten',
    rollbackVersion = '',
  } = packageInputs;
  const BackendRevision = computeNeonBackendRevision(value, codeSha256);
  if (
    typeof bucket !== 'string' ||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
    typeof key !== 'string' ||
    !/^_deploy\/backend\/[a-z0-9-]{1,48}\.zip$/.test(key) ||
    concurrencyMode !== 'account-cap-ten' ||
    typeof rollbackVersion !== 'string' ||
    !/^$|^[1-9][0-9]*$/.test(rollbackVersion)
  )
    throw failure();
  return {
    PackageBucket: bucket,
    PackageKey: key,
    PackageSha256: codeSha256,
    AllowedOrigin: value.origin,
    BackendRevision,
    ConcurrencyMode: concurrencyMode,
    RollbackVersion: rollbackVersion,
    NeonHost: value.neonHost,
    NeonDatabase: value.database,
    NeonUser: value.user,
    NeonPasswordParameterVersion: String(value.passwordParameterVersion),
  };
}

export function neonBackendTemplate() {
  const template = backendTemplate();
  template.Description =
    'Opt-in read-only PostgreSQL event handler with runtime-pinned encrypted parameter access and retained alias rollback.';
  template.Metadata['com.aws.cloudformation.Context'].ref.push({
    at: 'docs/architecture/090-neon-aws-preparation-contract.md',
    has: 'Offline preparation, learner-only publication, exact runtime and secret-version binding',
    scope: 'shared',
  });
  template.Metadata['com.aws.cloudformation.Context'].must = [
    'Update the existing backend stack; preserve function logical identity and signed CloudFront origin.',
    'Only learner-created Standard SecureString under AWS-managed alias/aws/ssm; no secret value in template or environment.',
    'Use eu-north-1, exact same-account parameter and the accepted account-cap-ten mode; validate target before publication.',
  ];
  template.Parameters.AllowedOrigin = string(
    'Exact reviewed CloudFront HTTPS origin; no bootstrap origin for this opt-in runtime.',
    originPattern,
  );
  template.Parameters.BackendRevision.Description =
    'SHA-256 binds exact ZIP and canonical runtime config including account, origin, pooled endpoint and pinned parameter version.';
  template.Parameters.ConcurrencyMode.AllowedValues = ['account-cap-ten'];
  Object.assign(template.Parameters, {
    NeonHost: string(
      'Confirmed Frankfurt pooled hostname only; no URI or port.',
      hostPattern,
    ),
    NeonDatabase: {
      Type: 'String',
      AllowedValues: ['neondb'],
      Description: 'Verified imported database.',
    },
    NeonUser: {
      Type: 'String',
      AllowedValues: ['platypus_app'],
      Description:
        'Existing restricted read-only application role; never the owner.',
    },
    NeonPasswordParameterVersion: {
      Type: 'Number',
      MinValue: 1,
      MaxValue: Number.MAX_SAFE_INTEGER,
      Description:
        'Explicit immutable parameter version; never latest or a label.',
    },
  });
  template.Resources.ExecutionRole.Properties.Policies.push({
    PolicyName: 'ReadOnlyExactNeonPassword',
    PolicyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'ReadOnlyExactNeonPassword',
          Effect: 'Allow',
          Action: 'ssm:GetParameter',
          Resource: {
            'Fn::Sub':
              'arn:${AWS::Partition}:ssm:eu-north-1:${AWS::AccountId}:parameter/platypus-service/production/neon/password',
          },
        },
      ],
    },
  });
  template.Resources.ExecutionRole.Metadata['com.aws.cloudformation.Context'] =
    {
      why: 'Keep existing role/log permissions and add one named GetParameter operation; same-account aws/ssm provides default key access.',
      must: [
        'Only the exact production password parameter may be read; no list, history, writes, wildcard retrieval or customer-managed key permissions.',
        'Keep the documented Lambda service trust unchanged; actual SCP/IAM/KMS availability must be verified before publication.',
      ],
    };
  const fn = template.Resources.Function;
  fn.Properties.Timeout = 30;
  fn.Properties.Environment.Variables = {
    ALLOWED_ORIGINS: ref('AllowedOrigin'),
    NEON_HOST: ref('NeonHost'),
    NEON_DATABASE: ref('NeonDatabase'),
    NEON_USER: ref('NeonUser'),
    NEON_CONFIRM_TARGET: { 'Fn::Sub': '${NeonHost}/neondb' },
    NEON_PASSWORD_PARAMETER_ARN: {
      'Fn::Sub':
        'arn:${AWS::Partition}:ssm:eu-north-1:${AWS::AccountId}:parameter/platypus-service/production/neon/password',
    },
    NEON_PASSWORD_PARAMETER_VERSION: ref('NeonPasswordParameterVersion'),
  };
  fn.Metadata['com.aws.cloudformation.Context'] = {
    why: 'No HTTP listener/VPC/NAT or new database. Lazy verified pooled TLS reads reuse an initialized bounded pool across warm invocations.',
    must: [
      'No password or dynamic secret reference in the environment; AWS_REGION is provided by Lambda.',
      'Pool max two; database operations at most eight seconds, secret request at most three seconds, total request at most 25 seconds and bounded by Lambda remaining time.',
      'Only SELECT role and parameterized bounded reads; no fixture fallback.',
      'Preserve explicit accepted account-cap-ten choice, runtime architecture, handler identity and stack-owned logs.',
    ],
  };
  template.Resources.Version.Metadata['com.aws.cloudformation.Context'] = {
    why: 'Replacement snapshots bundled code and nonsecret configuration including the pinned parameter version; retain earlier versions for deliberate rollback.',
    must: [
      'Change BackendRevision whenever ZIP or any runtime configuration changes.',
      'Retain the existing logical identity, retained versions and stack-managed alias rollback.',
      'An old Lambda version still needs a compatible database password/SSM version; alias rollback alone cannot undo credential rotation.',
    ],
  };
  return template;
}
