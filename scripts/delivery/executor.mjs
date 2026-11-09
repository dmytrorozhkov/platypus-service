import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  files,
  json,
  origin,
  outputRoot,
  ownedManifest,
  project,
  releaseId,
  sha256,
  within,
} from '../aws/common.mjs';
import {
  backendTemplate,
  edgeTemplate,
  storageTemplate,
} from '../aws/templates.mjs';
import { verifyDeliveryBundle } from './bundle.mjs';
import { verifyNeonRelease } from '../neon-aws/release.mjs';
import {
  validateNeonLambdaConfiguration,
  validateStoredNeonRuntime,
} from '../neon-aws/runtime-binding.mjs';
import { buildNeonBackendUpdate } from '../neon-aws/backend-update.mjs';
import { neonBackendTemplate } from '../neon-aws/templates.mjs';

export const stateKey = '_releases/delivery/current.json';
const prefix = '_releases/delivery/';
const fixedKeys = new Set(['runtime-config.json', 'index.html', 'favicon.svg']);
const maximumBytes = 32 * 1024 * 1024;
const same = (a, b) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const need = (condition, message) => {
  if (!condition) throw new Error(message);
};
const missing = (error) =>
  ['NoSuchKey', 'NotFound', '404'].includes(error.code);
const base = (target) => ({
  Bucket: target.resources.bucket,
  ExpectedBucketOwner: target.accountId,
});
const recordKey = (release) =>
  prefix + 'records/' + releaseId(release) + '.json';
const now = () => new Date().toISOString();
const revision = (manifest) => {
  if (manifest.kind === 'platypus-neon-release-candidate') {
    const value = manifest.backend?.backendRevision;
    need(
      typeof value === 'string' && /^[a-f0-9]{64}$/.test(value),
      'Invalid Neon backend revision.',
    );
    return value;
  }
  return sha256(manifest.backend.sha256 + '\n' + manifest.origin);
};
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
};

export function validateTarget(target) {
  need(
    target?.project === project &&
      target.region === 'eu-north-1' &&
      /^[0-9]{12}$/.test(target.accountId) &&
      target.accountId !== '000000000000',
    'Invalid delivery target identity.',
  );
  need(
    target.ownershipVerified === true,
    'Explicit resource ownership review is required.',
  );
  need(
    target.concurrency?.mode === 'account-cap-ten' &&
      target.concurrency.acceptedSharedAccountCap === true,
    'Accepted shared account-cap-ten is required.',
  );
  const r = target.resources;
  need(
    r && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(r.bucket),
    'Invalid private artifact bucket.',
  );
  need(
    r.bucketDomain === r.bucket + '.s3.eu-north-1.amazonaws.com',
    'Invalid bucket domain.',
  );
  need(
    origin(r.origin) === r.origin &&
      /^https:\/\/d[a-z0-9]+\.cloudfront\.net$/.test(r.origin),
    'Expected actual CloudFront origin.',
  );
  need(
    /^[A-Z0-9]{8,32}$/.test(r.distributionId),
    'Invalid distribution identity.',
  );
  need(
    new RegExp(
      '^arn:aws:lambda:eu-north-1:' +
        target.accountId +
        ':function:[A-Za-z0-9_-]+$',
    ).test(r.functionArn) && r.aliasArn === r.functionArn + ':live',
    'Invalid owned Lambda identity.',
  );
  need(
    /^https:\/\/[a-z0-9]+\.lambda-url\.eu-north-1\.on\.aws\/$/.test(
      r.functionUrl,
    ),
    'Invalid Function URL.',
  );
  need(
    new RegExp(
      '^arn:aws:iam::' + target.accountId + ':role/[A-Za-z0-9_+=,.@/-]+$',
    ).test(target.serviceRoleArn),
    'Reviewed CloudFormation service role is required.',
  );
  need(
    new RegExp(
      '^arn:aws:iam::' + target.accountId + ':role/[A-Za-z0-9_+=,.@/-]+$',
    ).test(target.lambdaExecutionRoleArn),
    'Reviewed existing Lambda execution role is required.',
  );
  for (const kind of ['storage', 'backend', 'edge'])
    need(
      new RegExp(
        '^arn:aws:cloudformation:eu-north-1:' +
          target.accountId +
          ':stack/platypus-[a-z0-9-]+-' +
          kind +
          '/[A-Za-z0-9-]+$',
      ).test(target.stacks?.[kind]),
      'Exact owned stack ARN required: ' + kind,
    );
  if (target.profile !== undefined)
    need(
      /^[A-Za-z0-9_-]{1,64}$/.test(target.profile),
      'Invalid local AWS profile.',
    );
  return target;
}

export function validateContext(context) {
  need(
    context?.repository === 'dmytrorozhkov/platypus-service' &&
      /^[a-f0-9]{40}$/.test(context.sourceSha) &&
      /^[1-9][0-9]{0,19}$/.test(context.runId) &&
      /^[1-9][0-9]{0,5}$/.test(context.runAttempt),
    'Exact canonical repository/SHA/run context is required.',
  );
  return context;
}

async function object(transport, target, key, optional = false) {
  try {
    const value = await transport.getObject({ ...base(target), Key: key });
    need(
      Buffer.isBuffer(value.body) &&
        value.body.length <= maximumBytes &&
        typeof value.ETag === 'string',
      'Invalid object response: ' + key,
    );
    const digest = sha256(value.body);
    need(
      value.ChecksumSHA256 === Buffer.from(digest, 'hex').toString('base64'),
      'Object checksum mismatch: ' + key,
    );
    return { ...value, sha256: digest };
  } catch (error) {
    if (optional && missing(error)) return null;
    throw error;
  }
}

async function put(transport, target, key, body, condition, metadata = {}) {
  need(
    Buffer.isBuffer(body) && body.length <= maximumBytes,
    'Invalid object upload.',
  );
  need(
    condition.IfMatch || condition.IfNoneMatch === '*',
    'Every delivery write requires a condition.',
  );
  const digest = sha256(body);
  const result = await transport.putObject({
    ...base(target),
    Key: key,
    Body: body,
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'no-store',
    ChecksumSHA256: Buffer.from(digest, 'hex').toString('base64'),
    ...metadata,
    ...condition,
  });
  need(typeof result.ETag === 'string', 'S3 did not return an ETag.');
  const observed = await object(transport, target, key);
  need(
    observed.sha256 === digest && observed.ETag === result.ETag,
    'Written object changed before verification: ' + key,
  );
  return observed;
}

async function immutable(transport, target, key, body, metadata = {}) {
  const old = await object(transport, target, key, true);
  if (old) {
    need(
      old.sha256 === sha256(body),
      'Immutable object already contains different bytes: ' + key,
    );
    for (const name of ['ContentType', 'CacheControl'])
      need(
        !metadata[name] || metadata[name] === old[name],
        'Immutable metadata mismatch: ' + key,
      );
    return old;
  }
  return put(transport, target, key, body, { IfNoneMatch: '*' }, metadata);
}

function identity(target) {
  return {
    accountId: target.accountId,
    region: target.region,
    resources: target.resources,
    stacks: target.stacks,
    serviceRoleArn: target.serviceRoleArn,
    lambdaExecutionRoleArn: target.lambdaExecutionRoleArn,
  };
}

export async function readState(transport, target, optional = false) {
  const value = await object(transport, target, stateKey, optional);
  if (!value) return null;
  const state = JSON.parse(value.body);
  need(
    state.schemaVersion === 1 &&
      state.project === project &&
      same(state.target, identity(target)) &&
      ['completed', 'pending'].includes(state.status),
    'Unknown or wrong-target delivery state.',
  );
  if (state.status === 'completed') {
    releaseId(state.release);
    need(
      /^[a-f0-9]{64}$/.test(state.recordSha256),
      'Invalid completed record digest.',
    );
  } else {
    need(
      /^[a-z0-9-]{1,80}$/.test(state.operationId) &&
        ['publish', 'recover', 'import'].includes(state.kind),
      'Invalid pending operation.',
    );
    releaseId(state.candidate);
    need(
      typeof state.planKey === 'string' &&
        state.planKey ===
          prefix + 'operations/' + state.operationId + '/plan.json' &&
        /^[a-f0-9]{64}$/.test(state.planSha256),
      'Invalid pending plan identity.',
    );
    if (state.kind !== 'import')
      need(
        state.previous?.status === 'completed',
        'Pending operation lacks previous completed checkpoint.',
      );
  }
  return { value: state, ETag: value.ETag };
}

export async function preflight({
  target,
  transport,
  allowNeonTransition = false,
}) {
  validateTarget(target);
  const call = (service, operation, input = {}) =>
    transport.request(service, operation, input);
  const caller = await call('sts', 'get-caller-identity');
  need(
    caller.Account === target.accountId,
    'AWS account differs from the reviewed target.',
  );
  const plan = await call('freetier', 'get-account-plan-state');
  need(
    plan.accountId === target.accountId &&
      plan.accountPlanType === 'FREE' &&
      plan.accountPlanStatus === 'ACTIVE' &&
      Number(plan.accountPlanRemainingCredits?.amount) > 0 &&
      Date.parse(plan.accountPlanExpirationDate) > Date.now(),
    'Active FREE plan with usable credits is required.',
  );
  const quota = await call('lambda', 'get-account-settings');
  const q = quota.AccountLimit;
  need(
    Number.isInteger(q?.ConcurrentExecutions) &&
      q.ConcurrentExecutions <= 10 &&
      q.ConcurrentExecutions > 0 &&
      Number.isInteger(q.UnreservedConcurrentExecutions) &&
      q.UnreservedConcurrentExecutions > 0 &&
      q.UnreservedConcurrentExecutions <= q.ConcurrentExecutions,
    'Fresh Lambda quota exceeds the accepted shared cap or has no capacity.',
  );
  const expectedTemplates = {
    storage: storageTemplate(),
    backend: backendTemplate(),
    edge: edgeTemplate(),
  };
  const stacks = {};
  let backendVariant;
  for (const kind of ['storage', 'backend', 'edge']) {
    const response = await call('cloudformation', 'describe-stacks', {
      StackName: target.stacks[kind],
    });
    const stack = response.Stacks?.[0];
    need(
      response.Stacks.length === 1 &&
        stack.StackId === target.stacks[kind] &&
        ['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(stack.StackStatus) &&
        stack.Tags?.some(
          (tag) => tag.Key === 'Project' && tag.Value === project,
        ),
      'Owned stable stack required: ' + kind,
    );
    const template = await call('cloudformation', 'get-template', {
      StackName: target.stacks[kind],
      TemplateStage: 'Original',
    });
    const body =
      typeof template.TemplateBody === 'string'
        ? JSON.parse(template.TemplateBody)
        : template.TemplateBody;
    const fixtureTemplate = same(body, expectedTemplates[kind]);
    const neonTemplate =
      kind === 'backend' && same(body, neonBackendTemplate());
    need(fixtureTemplate || neonTemplate, 'Stack template drift: ' + kind);
    if (kind === 'backend') {
      backendVariant = neonTemplate ? 'neon' : 'fixture';
      need(
        stack.RoleARN === target.serviceRoleArn ||
          (allowNeonTransition === true &&
            fixtureTemplate &&
            stack.RoleARN === undefined),
        'Backend stack must already use the reviewed CloudFormation service role.',
      );
    }
    stacks[kind] = stack;
    const inventory = await call('cloudformation', 'list-stack-resources', {
      StackName: target.stacks[kind],
    });
    need(!inventory.NextToken, 'Unexpected paginated stack inventory.');
    const logical = {
      storage: 'Artifacts',
      backend: 'Function',
      edge: 'Distribution',
    }[kind];
    const expected = {
      storage: target.resources.bucket,
      backend: target.resources.functionArn.split(':').at(-1),
      edge: target.resources.distributionId,
    }[kind];
    need(
      inventory.StackResourceSummaries?.some(
        (item) =>
          item.LogicalResourceId === logical &&
          item.PhysicalResourceId === expected,
      ),
      'Resource ownership mismatch: ' + kind,
    );
  }
  const output = (kind, key) =>
    stacks[kind].Outputs?.find((item) => item.OutputKey === key)?.OutputValue;
  const r = target.resources;
  need(
    output('storage', 'BucketName') === r.bucket &&
      output('storage', 'BucketRegionalDomainName') === r.bucketDomain &&
      output('backend', 'FunctionArn') === r.functionArn &&
      output('backend', 'AliasArn') === r.aliasArn &&
      output('backend', 'FunctionUrl') === r.functionUrl &&
      output('edge', 'DistributionId') === r.distributionId &&
      output('edge', 'Origin') === r.origin,
    'Live stack outputs differ from target.',
  );
  const tags = await call('s3api', 'get-bucket-tagging', base(target));
  need(
    tags.TagSet?.some(
      (item) => item.Key === 'Project' && item.Value === project,
    ),
    'Artifact bucket project ownership changed.',
  );
  const versioning = await call('s3api', 'get-bucket-versioning', base(target));
  need(
    !versioning.Status,
    'Unexpected bucket version history; manual review required.',
  );
  const distribution = (
    await call('cloudfront', 'get-distribution', { Id: r.distributionId })
  ).Distribution;
  need(
    distribution?.Id === r.distributionId &&
      distribution.Status === 'Deployed' &&
      distribution.DomainName === new URL(r.origin).hostname &&
      distribution.DistributionConfig?.Enabled === true,
    'Distribution is not the reviewed enabled deployed origin.',
  );
  const origins = distribution.DistributionConfig.Origins?.Items;
  need(
    origins?.find((item) => item.Id === 'static')?.DomainName ===
      r.bucketDomain &&
      origins?.find((item) => item.Id === 'api')?.DomainName ===
        new URL(r.functionUrl).hostname,
    'Distribution origin drift.',
  );
  const url = await call('lambda', 'get-function-url-config', {
    FunctionName: r.functionArn,
    Qualifier: 'live',
  });
  need(
    url.AuthType === 'AWS_IAM' && url.FunctionUrl === r.functionUrl,
    'Function URL auth/origin drift.',
  );
  const concurrency = await call('lambda', 'get-function-concurrency', {
    FunctionName: r.functionArn,
  });
  need(
    concurrency.ReservedConcurrentExecutions === undefined,
    'Shared account-cap mode cannot have a function reservation.',
  );
  return {
    plan: {
      type: plan.accountPlanType,
      status: plan.accountPlanStatus,
      credits: plan.accountPlanRemainingCredits,
      expires: plan.accountPlanExpirationDate,
    },
    quota: q,
    checkedAt: now(),
    stacks,
    backendVariant,
  };
}

export async function readBackendRuntime(transport, target, manifest) {
  if (manifest.kind !== 'platypus-neon-release-candidate') return undefined;
  const stored = await object(
    transport,
    target,
    prefix + 'files/' + releaseId(manifest.release) + '/backend/runtime.json',
  );
  validateStoredNeonRuntime({ target, manifest, body: stored.body });
  return stored.body;
}

async function backend(transport, target, manifest, expectedVersion) {
  const alias = await transport.request('lambda', 'get-alias', {
    FunctionName: target.resources.functionArn,
    Name: 'live',
  });
  need(
    /^[1-9][0-9]*$/.test(alias.FunctionVersion) &&
      alias.AliasArn === target.resources.aliasArn &&
      !Object.keys(alias.RoutingConfig?.AdditionalVersionWeights ?? {}).length,
    'Unexpected live alias or weighted routing.',
  );
  if (expectedVersion)
    need(
      alias.FunctionVersion === expectedVersion,
      'Unexpected live alias version.',
    );
  const config = await transport.request(
    'lambda',
    'get-function-configuration',
    {
      FunctionName: target.resources.functionArn,
      Qualifier: alias.FunctionVersion,
    },
  );
  const runtimeBody = await readBackendRuntime(transport, target, manifest);
  return configuration(
    target,
    manifest,
    alias.FunctionVersion,
    config,
    runtimeBody,
  );
}

function configuration(target, manifest, version, config, runtimeBody) {
  const neon = manifest.kind === 'platypus-neon-release-candidate';
  if (neon) {
    validateNeonLambdaConfiguration({
      target,
      manifest,
      configuration: config,
      body: runtimeBody,
    });
  }
  need(
    config.Version === version &&
      config.CodeSha256 === manifest.backend.codeSha256 &&
      config.Environment?.Variables?.ALLOWED_ORIGINS ===
        target.resources.origin &&
      // Qualified configuration reports the Version description, not Function.
      config.Description === 'Revision ' + revision(manifest) &&
      config.Runtime === 'nodejs24.x' &&
      same(config.Architectures, ['arm64']) &&
      config.Handler === 'lambda.handler' &&
      config.MemorySize === 256 &&
      config.Timeout === (neon ? 30 : 3) &&
      !config.VpcConfig?.VpcId,
    'Backend code/configuration/origin is incompatible.',
  );
  if (target.lambdaExecutionRoleArn)
    need(
      config.Role === target.lambdaExecutionRoleArn,
      'Lambda execution role drift.',
    );
  return {
    version,
    codeSha256: config.CodeSha256,
    revision: revision(manifest),
    origin: target.resources.origin,
    configurationSha256: sha256(
      json(
        canonical({
          Runtime: config.Runtime,
          Architectures: config.Architectures,
          Handler: config.Handler,
          MemorySize: config.MemorySize,
          Timeout: config.Timeout,
          Role: config.Role,
          Environment: config.Environment,
          Description: config.Description,
        }),
      ),
    ),
  };
}

async function verifyObjects(
  transport,
  target,
  manifest,
  { controls = true } = {},
) {
  const observed = {};
  for (const item of manifest.objects) {
    if (!controls && fixedKeys.has(item.key)) continue;
    const value = await object(transport, target, item.key);
    need(
      value.sha256 === item.sha256 &&
        value.body.length === item.bytes &&
        value.ContentType === item.contentType &&
        value.CacheControl === item.cacheControl,
      'Live artifact/metadata mismatch: ' + item.key,
    );
    if (fixedKeys.has(item.key))
      observed[item.key] = {
        sha256: value.sha256,
        ETag: value.ETag,
        contentType: value.ContentType,
        cacheControl: value.CacheControl,
      };
  }
  return observed;
}

async function snapshot(directory, manifest) {
  const inventory = [];
  const manifestFile =
    manifest.kind === 'platypus-neon-release-candidate'
      ? 'neon-release.json'
      : 'manifest.json';
  let total = 0;
  for (const file of await files(directory)) {
    need(
      file === path.posix.normalize(file) &&
        !file.startsWith('/') &&
        !file.split('/').includes('..'),
      'Unsafe portable release filename.',
    );
    const body = await readFile(
      within(directory, path.join(directory, ...file.split('/'))),
    );
    total += body.length;
    need(total <= maximumBytes, 'Release exceeds the private recovery bound.');
    inventory.push({ file, bytes: body.length, sha256: sha256(body) });
  }
  need(
    inventory.some(
      (item) =>
        item.file === manifestFile && item.sha256 === sha256(json(manifest)),
    ),
    'Manifest bytes must use the canonical release format.',
  );
  return inventory;
}

async function persistFiles(transport, target, directory, release, inventory) {
  for (const item of inventory)
    await immutable(
      transport,
      target,
      prefix + 'files/' + release + '/' + item.file,
      await readFile(path.join(directory, ...item.file.split('/'))),
      { ContentType: 'application/octet-stream', CacheControl: 'no-store' },
    );
}

async function readRecord(transport, target, release, expectedHash) {
  const value = await object(transport, target, recordKey(release));
  if (expectedHash)
    need(
      value.sha256 === expectedHash,
      'Completed release record digest mismatch.',
    );
  const record = JSON.parse(value.body);
  need(
    record.schemaVersion === 1 &&
      record.project === project &&
      record.status === 'completed' &&
      record.release === release &&
      same(record.target, identity(target)) &&
      (record.manifest?.kind === 'platypus-neon-release-candidate'
        ? record.provenance === 'github' &&
          record.manifest.sourceSha === record.context?.sourceSha
        : record.manifest?.scope === 'full') &&
      record.manifest.release === release &&
      record.manifest.origin === target.resources.origin &&
      record.backend?.origin === target.resources.origin &&
      /^[1-9][0-9]*$/.test(record.backend.version) &&
      record.acceptance?.success === true,
    'Unknown or incompatible completed release.',
  );
  need(
    record.manifestSha256 === sha256(json(record.manifest)) &&
      record.inventory?.length > 0 &&
      record.inventory.length <= 10000,
    'Invalid complete recovery inventory.',
  );
  if (record.provenance === 'github') validateContext(record.context);
  else
    need(
      record.provenance === 'manual-import' && record.context === null,
      'Invalid release provenance.',
    );
  return record;
}

export async function restoreFiles(transport, target, record) {
  await mkdir(path.join(outputRoot, 'recovery'), { recursive: true });
  const recoveryRoot = await mkdtemp(
    path.join(outputRoot, 'recovery', 'restore-'),
  );
  const neon = record.manifest?.kind === 'platypus-neon-release-candidate';
  if (neon) {
    await writeFile(
      path.join(recoveryRoot, 'package.json'),
      json({ name: '@platypus/workspace' }),
      { flag: 'wx' },
    );
  }
  const directory = neon
    ? within(
        recoveryRoot,
        path.join(
          recoveryRoot,
          '.local/neon-aws/releases',
          releaseId(record.release),
        ),
      )
    : recoveryRoot;
  let total = 0;
  const seen = new Set();
  for (const item of record.inventory) {
    need(
      typeof item.file === 'string' &&
        !item.file.startsWith('/') &&
        item.file === path.posix.normalize(item.file) &&
        /^[A-Za-z0-9_./-]+$/.test(item.file) &&
        !item.file.split('/').includes('..') &&
        !seen.has(item.file) &&
        /^[a-f0-9]{64}$/.test(item.sha256),
      'Unsafe stored recovery inventory.',
    );
    seen.add(item.file);
    const value = await object(
      transport,
      target,
      prefix + 'files/' + record.release + '/' + item.file,
    );
    need(
      value.sha256 === item.sha256 && value.body.length === item.bytes,
      'Stored recovery bytes changed.',
    );
    total += value.body.length;
    need(total <= maximumBytes, 'Stored recovery release exceeds bound.');
    const filename = within(
      directory,
      path.join(directory, ...item.file.split('/')),
    );
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, value.body, { flag: 'wx' });
  }
  if (neon) {
    need(
      record.provenance === 'github' &&
        record.context?.sourceSha === record.manifest.sourceSha,
      'Stored Neon source provenance differs.',
    );
    const runtimeConfig = JSON.parse(
      await readFile(path.join(directory, 'backend/runtime.json'), 'utf8'),
    );
    need(
      runtimeConfig.accountId === target.accountId &&
        runtimeConfig.region === target.region &&
        runtimeConfig.origin === target.resources.origin,
      'Stored Neon runtime differs from the selected AWS target.',
    );
    const verified = await verifyNeonRelease({
      root: recoveryRoot,
      release: record.release,
      expectedSourceSha: record.context.sourceSha,
      expectedRuntimeConfig: runtimeConfig,
      expectedManifestSha256: record.manifestSha256,
    });
    need(
      same(verified.manifest, record.manifest),
      'Stored Neon manifest differs from completed record.',
    );
    return {
      value: verified.manifest,
      directory: verified.directory,
      filename: path.join(verified.directory, 'neon-release.json'),
    };
  }
  const owned = await ownedManifest(path.join(directory, 'manifest.json'));
  need(
    same(owned.value, record.manifest),
    'Stored manifest differs from completed record.',
  );
  return owned;
}

async function receipt(transport, target, pending, phase, value = {}) {
  return immutable(
    transport,
    target,
    prefix + 'operations/' + pending.operationId + '/' + phase + '.json',
    Buffer.from(
      json({
        schemaVersion: 1,
        operationId: pending.operationId,
        phase,
        ...value,
      }),
    ),
    {
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'no-store',
    },
  );
}

async function acquire(
  transport,
  target,
  previous,
  plan,
  expectedPending = 'none',
) {
  const current = await readState(transport, target, true);
  need(
    (current?.value.status === 'pending'
      ? current.value.operationId
      : 'none') === expectedPending,
    'Unresolved pending delivery or changed expected operation.',
  );
  if (expectedPending === 'none')
    need(
      same(current, previous),
      'Completed checkpoint changed before lock acquisition.',
    );
  const operationId = plan.operationId;
  const planKey = prefix + 'operations/' + operationId + '/plan.json';
  const planBody = Buffer.from(json(plan));
  await immutable(transport, target, planKey, planBody);
  const pending = {
    schemaVersion: 1,
    project,
    target: identity(target),
    status: 'pending',
    operationId,
    kind: plan.kind,
    candidate: plan.release,
    context: plan.context,
    previous: previous?.value ?? null,
    planKey,
    planSha256: sha256(planBody),
  };
  const lock = await put(
    transport,
    target,
    stateKey,
    Buffer.from(json(pending)),
    current ? { IfMatch: current.ETag } : { IfNoneMatch: '*' },
  );
  return { value: pending, ETag: lock.ETag };
}

async function finish(
  transport,
  target,
  pending,
  record,
  controls = record.controls,
) {
  const recordBody = Buffer.from(json(record));
  await immutable(transport, target, recordKey(record.release), recordBody);
  const value = {
    schemaVersion: 1,
    project,
    target: identity(target),
    status: 'completed',
    release: record.release,
    recordSha256: sha256(recordBody),
    operationId: pending.value.operationId,
    controls,
  };
  const lock = await readState(transport, target);
  need(
    lock.value.status === 'pending' &&
      lock.value.operationId === pending.value.operationId &&
      lock.ETag === pending.ETag,
    'Pending checkpoint changed; completion stopped.',
  );
  await receipt(transport, target, pending.value, 'accepted', {
    release: record.release,
    recordSha256: value.recordSha256,
  });
  await put(transport, target, stateKey, Buffer.from(json(value)), {
    IfMatch: pending.ETag,
  });
  return value;
}

export async function acceptance(liveCheck, target, manifest) {
  need(
    typeof liveCheck === 'function',
    'A live HTTP/browser checker is mandatory.',
  );
  need(
    manifest?.origin === target.resources.origin,
    'Live acceptance origin differs from the selected release.',
  );
  const neon = manifest.kind === 'platypus-neon-release-candidate';
  const result = await liveCheck({
    origin: target.resources.origin,
    functionUrl: target.resources.functionUrl,
    bucketOrigin: 'https://' + target.resources.bucketDomain,
    runtimeVariant: neon ? 'neon' : 'fixture',
  });
  need(result?.success === true, 'Live HTTP/browser acceptance failed.');
  if (neon)
    need(
      result.kind === 'platypus-neon-live-check' &&
        result.origin === target.resources.origin,
      'Neon-specific live acceptance evidence is required.',
    );
  return {
    success: true,
    checkedAt: now(),
    evidenceSha256: sha256(json(result)),
  };
}

async function verifyCurrent(transport, target, checkpoint) {
  need(
    checkpoint?.value.status === 'completed',
    'A completed durable baseline is required.',
  );
  const record = await readRecord(
    transport,
    target,
    checkpoint.value.release,
    checkpoint.value.recordSha256,
  );
  need(
    same(
      await backend(transport, target, record.manifest, record.backend.version),
      record.backend,
    ),
    'Backend configuration drift since completed release.',
  );
  const controls = await verifyObjects(transport, target, record.manifest);
  need(
    same(controls, checkpoint.value.controls ?? record.controls),
    'Fixed control ETags changed since completion.',
  );
  return { ...record, controls };
}

async function waitFor(read, terminal, label) {
  for (let attempt = 0; attempt < 180; attempt++) {
    const result = await read();
    const state = terminal(result);
    if (state === true) return result;
    need(state !== 'failed', label + ' failed; pending state retained.');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(label + ' timed out; pending state retained.');
}

export function validateChangeSet(
  changeSet,
  target,
  name,
  recovery = false,
  neonTransition = false,
) {
  need(
    changeSet.StackId === target.stacks.backend &&
      changeSet.ChangeSetName === name &&
      changeSet.Status === 'CREATE_COMPLETE' &&
      changeSet.ExecutionStatus === 'AVAILABLE' &&
      !changeSet.NextToken &&
      !changeSet.IncludeNestedStacks &&
      !changeSet.ParentChangeSetId &&
      !changeSet.RootChangeSetId &&
      !changeSet.DeploymentMode &&
      !changeSet.ImportExistingResources,
    'Unexpected or incomplete backend change set.',
  );
  need(changeSet.Changes?.length > 0, 'Empty backend change set.');
  const allowed = recovery
    ? { LiveAlias: ['AWS::Lambda::Alias', ['FunctionVersion']] }
    : {
        Function: [
          'AWS::Lambda::Function',
          ['Code', 'Environment', 'Description'],
        ],
        Version: ['AWS::Lambda::Version', ['CodeSha256', 'Description']],
        LiveAlias: ['AWS::Lambda::Alias', ['FunctionVersion']],
      };
  need(
    typeof neonTransition === 'boolean',
    'Explicit Neon transition mode required.',
  );
  if (neonTransition) {
    need(
      !recovery &&
        changeSet.RoleARN === target.serviceRoleArn &&
        same(
          changeSet.Changes.map(
            (change) => change.ResourceChange?.LogicalResourceId,
          ).sort(),
          ['ExecutionRole', 'Function', 'LiveAlias', 'Version'],
        ),
      'Neon transition requires the reviewed role and exact resource set.',
    );
    allowed.ExecutionRole = ['AWS::IAM::Role', ['Policies']];
    allowed.Function[1].push('Timeout');
  }
  for (const change of changeSet.Changes) {
    const item = change.ResourceChange;
    const spec = allowed[item?.LogicalResourceId];
    need(
      change.Type === 'Resource' &&
        spec &&
        item.Action === 'Modify' &&
        item.ResourceType === spec[0] &&
        (item.LogicalResourceId === 'Version'
          ? item.Replacement === 'True'
          : item.Replacement === 'False'),
      'Unreviewed backend resource change.',
    );
    need(
      item.Scope?.every((scope) => scope === 'Properties') &&
        item.Details?.length > 0 &&
        item.Details.every(
          (detail) =>
            detail.Target?.Attribute === 'Properties' &&
            spec[1].includes(detail.Target.Name),
        ),
      'Unreviewed backend property change.',
    );
  }
}

export async function updateBackend(
  transport,
  target,
  manifest,
  pending,
  recoveryVersion,
  allowNeonTransition = false,
) {
  need(
    typeof allowNeonTransition === 'boolean',
    'Explicit Neon transition selection required.',
  );
  const stack = (
    await transport.request('cloudformation', 'describe-stacks', {
      StackName: target.stacks.backend,
    })
  ).Stacks?.[0];
  need(
    stack?.StackId === target.stacks.backend &&
      ['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(stack.StackStatus) &&
      Array.isArray(stack.Parameters),
    'Backend stack is not ready for a reviewed update.',
  );
  const oldParameters = Object.fromEntries(
    stack.Parameters.map((item) => [item.ParameterKey, item.ParameterValue]),
  );
  need(
    Object.keys(oldParameters).length === stack.Parameters.length,
    'Duplicate backend stack parameters.',
  );
  const fixtureNames = Object.keys(backendTemplate().Parameters);
  const neonNames = Object.keys(neonBackendTemplate().Parameters);
  const actualNames = Object.keys(oldParameters).sort();
  const fixtureStack = same(actualNames, [...fixtureNames].sort());
  const neonStack = same(actualNames, [...neonNames].sort());
  need(fixtureStack || neonStack, 'Unknown backend stack parameters.');

  const neon = manifest.kind === 'platypus-neon-release-candidate';
  const transition = neon && fixtureStack && !recoveryVersion;
  need(
    !transition || allowNeonTransition,
    'First Neon transition requires explicit selection.',
  );
  need(
    !(neon && recoveryVersion && !neonStack),
    'Neon recovery requires an established Neon stack.',
  );
  need(
    !neonStack || neon || Boolean(recoveryVersion),
    'Fixture publication into a Neon stack requires explicit recovery.',
  );
  const initialRole = stack.RoleARN;
  need(
    initialRole === target.serviceRoleArn ||
      (transition && initialRole === undefined),
    'Unexpected backend CloudFormation service role.',
  );
  need(
    oldParameters.ConcurrencyMode === 'account-cap-ten',
    'Backend concurrency decision drift.',
  );

  if (neon || neonStack) {
    const current = await transport.request('cloudformation', 'get-template', {
      StackName: target.stacks.backend,
      TemplateStage: 'Original',
    });
    const currentBody =
      typeof current.TemplateBody === 'string'
        ? JSON.parse(current.TemplateBody)
        : current.TemplateBody;
    need(
      same(
        currentBody,
        fixtureStack ? backendTemplate() : neonBackendTemplate(),
      ),
      'Backend template differs from the reviewed runtime variant.',
    );
  }

  let planned;
  if (neon && !recoveryVersion) {
    const runtimeBody = await readBackendRuntime(transport, target, manifest);
    const template = await object(
      transport,
      target,
      prefix +
        'files/' +
        releaseId(manifest.release) +
        '/backend/backend-template.json',
    );
    planned = buildNeonBackendUpdate({
      target,
      manifest,
      runtimeBody,
      templateBody: template.body,
    });
  }
  const selected = recoveryVersion
    ? { RollbackVersion: recoveryVersion }
    : (planned?.selected ?? {
        PackageBucket: target.resources.bucket,
        PackageKey: manifest.backend.key,
        PackageSha256: manifest.backend.codeSha256,
        AllowedOrigin: target.resources.origin,
        BackendRevision: revision(manifest),
        RollbackVersion: '',
      });
  if (
    Object.entries(selected).every(
      ([key, value]) => oldParameters[key] === value,
    )
  )
    return backend(transport, target, manifest, recoveryVersion);

  const names = neon || neonStack ? neonNames : fixtureNames;
  const name = 'delivery-' + pending.operationId;
  const parameters = names.map((ParameterKey) =>
    selected[ParameterKey] === undefined
      ? { ParameterKey, UsePreviousValue: true }
      : { ParameterKey, ParameterValue: selected[ParameterKey] },
  );
  const request = {
    StackName: target.stacks.backend,
    ChangeSetName: name,
    ChangeSetType: 'UPDATE',
    ...(transition
      ? { TemplateBody: planned.templateBody }
      : { UsePreviousTemplate: true }),
    Parameters: parameters,
    Capabilities: ['CAPABILITY_IAM'],
    RoleARN: target.serviceRoleArn,
    ClientToken: name,
  };
  await receipt(transport, target, pending, 'backend-intent', {
    parameters,
    changeSetName: name,
  });
  const created = await transport.request(
    'cloudformation',
    'create-change-set',
    request,
  );
  need(
    created.StackId === target.stacks.backend && typeof created.Id === 'string',
    'Unexpected created change set identity.',
  );
  const input = {
    StackName: target.stacks.backend,
    ChangeSetName: created.Id,
    IncludePropertyValues: true,
  };
  const changes = await waitFor(
    () => transport.request('cloudformation', 'describe-change-set', input),
    (value) =>
      value.Status === 'CREATE_COMPLETE'
        ? true
        : value.Status === 'FAILED' || value.Status === 'DELETE_COMPLETE'
          ? 'failed'
          : false,
    'Change set creation',
  );
  validateChangeSet(
    changes,
    target,
    name,
    Boolean(recoveryVersion),
    transition,
  );
  if (transition) {
    const reviewed = await transport.request('cloudformation', 'get-template', {
      StackName: target.stacks.backend,
      ChangeSetName: created.Id,
      TemplateStage: 'Original',
    });
    const reviewedBody =
      typeof reviewed.TemplateBody === 'string'
        ? JSON.parse(reviewed.TemplateBody)
        : reviewed.TemplateBody;
    need(
      same(reviewedBody, JSON.parse(planned.templateBody)),
      'Created change set template differs from the reviewed Neon template.',
    );
  }
  need(
    same(
      canonical(
        Object.fromEntries(
          (changes.Parameters ?? []).map((item) => [
            item.ParameterKey,
            item.ParameterValue,
          ]),
        ),
      ),
      canonical(
        Object.fromEntries(
          names.map((key) => [key, selected[key] ?? oldParameters[key]]),
        ),
      ),
    ),
    'Change set parameters differ from reviewed request.',
  );
  const beforeExecution = (
    await transport.request('cloudformation', 'describe-stacks', {
      StackName: target.stacks.backend,
    })
  ).Stacks?.[0];
  need(
    beforeExecution?.StackId === target.stacks.backend &&
      (beforeExecution.RoleARN === initialRole ||
        (transition && beforeExecution.RoleARN === target.serviceRoleArn)) &&
      same(
        Object.fromEntries(
          (beforeExecution.Parameters ?? []).map((item) => [
            item.ParameterKey,
            item.ParameterValue,
          ]),
        ),
        oldParameters,
      ) &&
      ['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(
        beforeExecution.StackStatus,
      ),
    'Backend ownership/service role changed before execution.',
  );
  await receipt(transport, target, pending, 'backend-reviewed', {
    changeSetId: created.Id,
    changesSha256: sha256(json(changes)),
  });
  await transport.request('cloudformation', 'execute-change-set', {
    StackName: target.stacks.backend,
    ChangeSetName: created.Id,
    ClientRequestToken: name,
  });
  await waitFor(
    () =>
      transport.request('cloudformation', 'describe-stacks', {
        StackName: target.stacks.backend,
      }),
    (value) =>
      value.Stacks?.[0]?.StackStatus === 'UPDATE_COMPLETE' &&
      value.Stacks[0].StackId === target.stacks.backend &&
      value.Stacks[0].RoleARN === target.serviceRoleArn &&
      Object.entries(selected).every(([key, expected]) =>
        value.Stacks[0].Parameters?.some(
          (item) =>
            item.ParameterKey === key && item.ParameterValue === expected,
        ),
      )
        ? true
        : /FAILED|ROLLBACK/.test(value.Stacks?.[0]?.StackStatus ?? '')
          ? 'failed'
          : false,
    'Backend update',
  );
  const observed = await backend(transport, target, manifest, recoveryVersion);
  await receipt(transport, target, pending, 'backend-complete', observed);
  return observed;
}

async function publishControls(
  transport,
  target,
  directory,
  manifest,
  expected,
  pending,
) {
  const controls = {};
  for (const key of ['favicon.svg', 'runtime-config.json', 'index.html']) {
    const item = manifest.objects.find((value) => value.key === key);
    need(item && expected[key], 'Missing fixed control contract: ' + key);
    const live = await object(transport, target, key);
    need(
      live.sha256 === expected[key].sha256 && live.ETag === expected[key].ETag,
      'Fixed control changed before conditional publication: ' + key,
    );
    const body = await readFile(path.join(directory, item.file));
    const result =
      live.sha256 === item.sha256
        ? live
        : await put(
            transport,
            target,
            key,
            body,
            { IfMatch: live.ETag },
            { ContentType: item.contentType, CacheControl: item.cacheControl },
          );
    controls[key] = {
      sha256: result.sha256,
      ETag: result.ETag,
      contentType: result.ContentType,
      cacheControl: result.CacheControl,
    };
    await receipt(
      transport,
      target,
      pending,
      'control-' + key.replaceAll('.', '-'),
      controls[key],
    );
  }
  return controls;
}

export async function importBaseline({
  directory,
  target,
  expectedAliasVersion,
  expectedPending = 'none',
  transport,
  liveCheck,
  allowNeonTransition = false,
}) {
  validateTarget(target);
  need(
    typeof allowNeonTransition === 'boolean',
    'Explicit Neon transition selection required.',
  );
  need(
    /^[1-9][0-9]*$/.test(expectedAliasVersion),
    'Explicit expected baseline alias version is required.',
  );
  const owned = await ownedManifest(path.join(directory, 'manifest.json'));
  const manifest = owned.value;
  need(
    manifest.scope === 'full' && manifest.origin === target.resources.origin,
    'Import requires complete actual-origin baseline.',
  );
  const gate = await preflight({
    target,
    transport,
    allowNeonTransition,
  });
  const existing = await readState(transport, target, true);
  need(
    !existing ||
      (existing.value.status === 'pending' &&
        existing.value.kind === 'import' &&
        existing.value.operationId === expectedPending),
    'Baseline import never replaces existing state without its exact pending import identity.',
  );
  need(
    existing || expectedPending === 'none',
    'No matching pending baseline import exists.',
  );
  const observed = await backend(
    transport,
    target,
    manifest,
    expectedAliasVersion,
  );
  const controls = await verifyObjects(transport, target, manifest);
  const inventory = await snapshot(owned.directory, manifest);
  const operationId = 'import-' + manifest.release;
  const importPlan = {
    schemaVersion: 1,
    operationId,
    kind: 'import',
    ...(allowNeonTransition ? { allowNeonTransition: true } : {}),
    release: manifest.release,
    context: null,
    manifest,
    inventory,
    backend: observed,
    controls,
  };
  let pending;
  if (existing) {
    need(
      same(
        await pendingPlan(transport, target, existing, expectedPending),
        importPlan,
      ),
      'Resumed import bytes/controls/backend differ from its immutable plan.',
    );
    pending = existing;
  } else pending = await acquire(transport, target, null, importPlan);
  await persistFiles(
    transport,
    target,
    owned.directory,
    manifest.release,
    inventory,
  );
  const accepted = await acceptance(liveCheck, target, manifest);
  await backend(transport, target, manifest, expectedAliasVersion);
  need(
    same(await verifyObjects(transport, target, manifest), controls),
    'Baseline changed during acceptance.',
  );
  const record = {
    schemaVersion: 1,
    project,
    status: 'completed',
    target: identity(target),
    release: manifest.release,
    provenance: 'manual-import',
    context: null,
    manifest,
    manifestSha256: sha256(json(manifest)),
    inventory,
    backend: observed,
    controls,
    acceptance: accepted,
    preflight: {
      plan: gate.plan,
      quota: gate.quota,
      checkedAt: gate.checkedAt,
      backendVariant: gate.backendVariant,
      serviceRoleArn: gate.stacks.backend.RoleARN ?? null,
    },
  };
  const retained = await object(
    transport,
    target,
    recordKey(manifest.release),
    true,
  );
  return finish(
    transport,
    target,
    pending,
    retained ? await readRecord(transport, target, manifest.release) : record,
    controls,
  );
}

export async function publishNeonDelivery({
  root,
  release,
  runtimeConfig,
  manifestSha256,
  target,
  context,
  transport,
  liveCheck,
  allowNeonTransition = false,
}) {
  validateTarget(target);
  validateContext(context);
  need(
    release === 'neon-' + context.runId + '-' + context.runAttempt,
    'Neon release must match the selected packaging run.',
  );
  need(
    typeof allowNeonTransition === 'boolean',
    'Explicit Neon transition selection required.',
  );
  need(
    typeof liveCheck === 'function',
    'A Neon live acceptance checker is mandatory.',
  );
  const packaged = await verifyNeonRelease({
    root,
    release,
    expectedSourceSha: context.sourceSha,
    expectedRuntimeConfig: runtimeConfig,
    expectedManifestSha256: manifestSha256,
  });
  validateStoredNeonRuntime({
    target,
    manifest: packaged.manifest,
    body: await readFile(path.join(packaged.directory, 'backend/runtime.json')),
  });
  need(
    [...fixedKeys].every((key) =>
      packaged.manifest.objects.some((item) => item.key === key),
    ),
    'Full Neon release requires all fixed controls.',
  );
  return publishPackaged({
    packaged,
    target,
    context,
    transport,
    allowNeonTransition,
    liveCheck,
  });
}

export async function publishDelivery({
  bundle,
  target,
  context,
  envelopeSha256,
  transport,
  liveCheck,
}) {
  validateTarget(target);
  validateContext(context);
  const boundHash = envelopeSha256 ?? context.expectedEnvelopeSha256;
  need(
    /^[a-f0-9]{64}$/.test(boundHash ?? ''),
    'Checked build envelope SHA-256 is required.',
  );
  const packaged = await verifyDeliveryBundle({
    directory: bundle,
    ...context,
    origin: target.resources.origin,
    expectedEnvelopeSha256: boundHash,
  });
  return publishPackaged({
    packaged,
    target,
    context,
    transport,
    liveCheck,
  });
}

async function publishPackaged({
  packaged,
  target,
  context,
  transport,
  liveCheck,
  allowNeonTransition = false,
}) {
  const manifest = packaged.manifest;
  const neon = manifest.kind === 'platypus-neon-release-candidate';
  const backendArchive = neon
    ? await readFile(path.join(packaged.directory, manifest.backend.archive))
    : undefined;
  if (neon)
    need(
      Buffer.from(sha256(backendArchive), 'hex').toString('base64') ===
        manifest.backend.codeSha256,
      'Neon backend ZIP differs from the selected release.',
    );
  const gate = await preflight({
    target,
    transport,
    allowNeonTransition: neon && allowNeonTransition,
  });
  if (neon) {
    need(
      gate.backendVariant === 'neon' || allowNeonTransition === true,
      'First Neon transition requires explicit selection.',
    );
  } else {
    need(
      gate.backendVariant === 'fixture',
      'Fixture publisher cannot publish into a Neon backend stack.',
    );
  }
  const checkpoint = await readState(transport, target);
  const previous = await verifyCurrent(transport, target, checkpoint);
  need(manifest.release !== previous.release, 'Release is already current.');
  need(
    !(await object(transport, target, recordKey(manifest.release), true)),
    'A completed release cannot be republished.',
  );
  const inventory = await snapshot(packaged.directory, manifest);
  const operationId = 'gh-' + context.runId + '-' + context.runAttempt;
  const pending = await acquire(transport, target, checkpoint, {
    schemaVersion: 1,
    operationId,
    kind: 'publish',
    ...(neon ? { allowNeonTransition } : {}),
    release: manifest.release,
    context,
    manifest,
    inventory,
    previousRecordSha256: checkpoint.value.recordSha256,
  });
  await persistFiles(
    transport,
    target,
    packaged.directory,
    manifest.release,
    inventory,
  );
  if (neon)
    await immutable(transport, target, manifest.backend.key, backendArchive, {
      ContentType: 'application/zip',
      CacheControl: 'no-store',
    });
  for (const item of manifest.objects.filter(
    (item) => !fixedKeys.has(item.key),
  ))
    await immutable(
      transport,
      target,
      item.key,
      await readFile(path.join(packaged.directory, item.file)),
      { ContentType: item.contentType, CacheControl: item.cacheControl },
    );
  await verifyObjects(transport, target, manifest, { controls: false });
  await receipt(transport, target, pending.value, 'assets-verified', {
    manifestSha256: sha256(json(manifest)),
  });
  const observed = await updateBackend(
    transport,
    target,
    manifest,
    pending.value,
    undefined,
    neon && allowNeonTransition,
  );
  await publishControls(
    transport,
    target,
    packaged.directory,
    manifest,
    previous.controls,
    pending.value,
  );
  const accepted = await acceptance(liveCheck, target, manifest);
  await backend(transport, target, manifest, observed.version);
  const controls = await verifyObjects(transport, target, manifest);
  const record = {
    schemaVersion: 1,
    project,
    status: 'completed',
    target: identity(target),
    release: manifest.release,
    provenance: 'github',
    context,
    manifest,
    manifestSha256: sha256(json(manifest)),
    inventory,
    backend: observed,
    controls,
    acceptance: accepted,
    preflight: {
      plan: gate.plan,
      quota: gate.quota,
      checkedAt: gate.checkedAt,
      backendVariant: gate.backendVariant,
      serviceRoleArn: gate.stacks.backend.RoleARN ?? null,
    },
  };
  return finish(transport, target, pending, record);
}

export function validatePendingManifest(plan, target) {
  const manifest = plan?.manifest;
  const neon = manifest?.kind === 'platypus-neon-release-candidate';
  need(
    plan?.schemaVersion === 1 &&
      ['publish', 'recover', 'import'].includes(plan.kind) &&
      manifest?.schemaVersion === 1 &&
      manifest.project === project &&
      manifest.release === plan.release &&
      manifest.origin === target.resources.origin &&
      Array.isArray(manifest.objects) &&
      manifest.objects.length > 0 &&
      (neon || manifest.scope === 'full'),
    'Unknown or incompatible pending release manifest.',
  );
  releaseId(manifest.release);
  if (neon) {
    need(
      ['publish', 'recover'].includes(plan.kind) &&
        /^[a-f0-9]{40}$/.test(manifest.sourceSha ?? '') &&
        !/^0+$/.test(manifest.sourceSha),
      'Invalid pending Neon source or operation.',
    );
    validateContext(plan.context);
    if (plan.kind === 'publish')
      need(
        manifest.sourceSha === plan.context.sourceSha &&
          manifest.release ===
            'neon-' + plan.context.runId + '-' + plan.context.runAttempt &&
          typeof plan.allowNeonTransition === 'boolean',
        'Pending Neon publication differs from its checked run.',
      );
  }
  return manifest;
}

async function pendingPlan(transport, target, checkpoint, expectedPending) {
  need(
    checkpoint?.value.status === 'pending' &&
      checkpoint.value.operationId === expectedPending,
    'Exact pending operation identity is required.',
  );
  const objectValue = await object(transport, target, checkpoint.value.planKey);
  need(
    objectValue.sha256 === checkpoint.value.planSha256,
    'Pending immutable plan digest differs.',
  );
  const plan = JSON.parse(objectValue.body);
  need(
    plan.operationId === expectedPending &&
      plan.kind === checkpoint.value.kind &&
      plan.release === checkpoint.value.candidate &&
      same(plan.context, checkpoint.value.context),
    'Pending operation plan differs from checkpoint.',
  );
  validatePendingManifest(plan, target);
  return plan;
}

export async function reconcileDelivery({
  expectedPending,
  target,
  context,
  transport,
  liveCheck,
  allowNeonTransition = false,
}) {
  validateTarget(target);
  validateContext(context);
  need(
    typeof allowNeonTransition === 'boolean',
    'Explicit Neon transition selection required.',
  );
  const gate = await preflight({ target, transport, allowNeonTransition });
  const checkpoint = await readState(transport, target);
  const plan = await pendingPlan(
    transport,
    target,
    checkpoint,
    expectedPending,
  );
  if (gate.stacks.backend.RoleARN === undefined)
    need(
      allowNeonTransition === true && plan.allowNeonTransition === true,
      'Unassigned service role requires an explicitly reviewed bootstrap plan.',
    );
  // Reconcile never changes alias or controls. It completes only an already accepted full old/new state.
  const candidates = [plan.release, checkpoint.value.previous?.release].filter(
    Boolean,
  );
  for (const candidate of candidates) {
    const recordObject = await object(
      transport,
      target,
      recordKey(candidate),
      true,
    );
    if (
      !recordObject &&
      !(plan.kind === 'import' && candidate === plan.release)
    )
      continue;
    const record = recordObject
      ? await readRecord(
          transport,
          target,
          candidate,
          candidate === checkpoint.value.previous?.release
            ? checkpoint.value.previous.recordSha256
            : undefined,
        )
      : {
          schemaVersion: 1,
          project,
          status: 'completed',
          target: identity(target),
          release: plan.release,
          provenance: 'manual-import',
          context: null,
          manifest: plan.manifest,
          manifestSha256: sha256(json(plan.manifest)),
          inventory: plan.inventory,
          backend: plan.backend,
          controls: plan.controls,
        };
    let controls;
    try {
      need(
        same(
          await backend(
            transport,
            target,
            record.manifest,
            record.backend.version,
          ),
          record.backend,
        ),
        'Backend differs from selected complete configuration.',
      );
      controls = await verifyObjects(transport, target, record.manifest);
      need(
        same(
          controls,
          candidate === checkpoint.value.previous?.release
            ? (checkpoint.value.previous.controls ?? record.controls)
            : record.controls,
        ),
        'Controls differ from completed release.',
      );
      const accepted = await acceptance(liveCheck, target, record.manifest);
      need(
        same(
          await backend(
            transport,
            target,
            record.manifest,
            record.backend.version,
          ),
          record.backend,
        ) &&
          same(
            await verifyObjects(transport, target, record.manifest),
            controls,
          ),
        'Live state changed during reconciliation acceptance.',
      );
      if (!recordObject) {
        await restoreFiles(transport, target, record);
        record.acceptance = accepted;
      }
    } catch {
      continue;
    }
    await receipt(
      transport,
      target,
      checkpoint.value,
      'reconciled-gh-' + context.runId + '-' + context.runAttempt,
      {
        release: candidate,
        requestedBy: context,
      },
    );
    return finish(transport, target, checkpoint, record, controls);
  }
  throw new Error(
    'Pending state is mixed or lacks completed acceptance; explicit compatible recovery is required.',
  );
}

export async function recoverDelivery({
  release,
  expectedPending,
  target,
  context,
  transport,
  liveCheck,
}) {
  validateTarget(target);
  validateContext(context);
  releaseId(release);
  need(
    expectedPending === 'none' ||
      /^[a-z0-9-]{1,80}$/.test(expectedPending ?? ''),
    'Explicit expected pending identity or none is required.',
  );
  await preflight({ target, transport });
  const checkpoint = await readState(transport, target);
  let previous = checkpoint;
  let candidate;
  let sourcePlan;
  if (checkpoint.value.status === 'pending') {
    const plan = await pendingPlan(
      transport,
      target,
      checkpoint,
      expectedPending,
    );
    sourcePlan = plan;
    need(
      checkpoint.value.previous?.status === 'completed',
      'Unfinished first import requires operator evidence, never lock takeover.',
    );
    previous = { value: checkpoint.value.previous, ETag: checkpoint.ETag };
    candidate = plan.manifest;
  } else need(expectedPending === 'none', 'No such pending operation.');
  const baseline = await readRecord(
    transport,
    target,
    previous.value.release,
    previous.value.recordSha256,
  );
  const record = await readRecord(transport, target, release);
  const owned = await restoreFiles(transport, target, record);
  // Check the exact retained target version before ANY alias/control mutation, even when current is mixed.
  const config = await transport.request(
    'lambda',
    'get-function-configuration',
    {
      FunctionName: target.resources.functionArn,
      Qualifier: record.backend.version,
    },
  );
  need(
    same(
      configuration(
        target,
        record.manifest,
        record.backend.version,
        config,
        await readBackendRuntime(transport, target, record.manifest),
      ),
      record.backend,
    ),
    'Recovery version is not compatible with the actual origin/code/configuration.',
  );
  await verifyObjects(transport, target, record.manifest, { controls: false });
  const actualControls = {};
  for (const key of fixedKeys) {
    const live = await object(transport, target, key);
    const old = baseline.manifest.objects.find((item) => item.key === key);
    const next = candidate?.objects.find((item) => item.key === key);
    const inherited = sourcePlan?.startingControls?.[key];
    need(
      (live.sha256 === old?.sha256 ||
        live.sha256 === next?.sha256 ||
        live.sha256 === inherited?.sha256) &&
        live.ContentType === old?.contentType &&
        live.CacheControl === old?.cacheControl,
      'Unknown mixed control bytes; recovery stopped: ' + key,
    );
    actualControls[key] = { sha256: live.sha256, ETag: live.ETag };
  }
  const alias = await transport.request('lambda', 'get-alias', {
    FunctionName: target.resources.functionArn,
    Name: 'live',
  });
  need(
    alias.AliasArn === target.resources.aliasArn &&
      !Object.keys(alias.RoutingConfig?.AdditionalVersionWeights ?? {}).length,
    'Unexpected recovery alias routing.',
  );
  const liveConfiguration = await transport.request(
    'lambda',
    'get-function-configuration',
    {
      FunctionName: target.resources.functionArn,
      Qualifier: alias.FunctionVersion,
    },
  );
  let startingManifest;
  let startingBackend;
  const knownBackends = [
    { manifest: baseline.manifest, observed: baseline.backend },
    ...(candidate ? [{ manifest: candidate }] : []),
    ...(sourcePlan?.startingManifest
      ? [
          {
            manifest: sourcePlan.startingManifest,
            observed: sourcePlan.startingBackend,
          },
        ]
      : []),
  ];
  for (const known of knownBackends) {
    try {
      const observed = configuration(
        target,
        known.manifest,
        alias.FunctionVersion,
        liveConfiguration,
        await readBackendRuntime(transport, target, known.manifest),
      );
      if (known.observed && !same(observed, known.observed)) continue;
      startingManifest = known.manifest;
      startingBackend = observed;
      break;
    } catch {
      /* A different known code/configuration may match this mixed state. */
    }
  }
  need(
    startingManifest && startingBackend,
    'Unknown current backend version/configuration.',
  );
  const operationId = 'recover-' + context.runId + '-' + context.runAttempt;
  const pending = await acquire(
    transport,
    target,
    previous,
    {
      schemaVersion: 1,
      operationId,
      kind: 'recover',
      release,
      context,
      manifest: record.manifest,
      inventory: record.inventory,
      startingControls: actualControls,
      startingManifest,
      startingBackend,
    },
    expectedPending,
  );
  await updateBackend(
    transport,
    target,
    record.manifest,
    pending.value,
    record.backend.version,
  );
  await publishControls(
    transport,
    target,
    owned.directory,
    record.manifest,
    actualControls,
    pending.value,
  );
  await acceptance(liveCheck, target, record.manifest);
  await backend(transport, target, record.manifest, record.backend.version);
  const controls = await verifyObjects(transport, target, record.manifest);
  // Original immutable completed record remains unchanged; fresh observations belong to this operation.
  await receipt(transport, target, pending.value, 'recovery-accepted', {
    controls,
    backend: record.backend,
    context,
  });
  return finish(transport, target, pending, record, controls);
}
