import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  flags,
  json,
  origin,
  ownedManifest,
  project,
  projectRoot,
  region,
  remotes,
  sha256,
} from './common.mjs';

const read = (service, operation, input, extra = {}) => ({
  kind: 'aws-read',
  service,
  operation,
  input,
  ...extra,
});
const write = (service, operation, input, extra = {}) => ({
  kind: 'aws-write-requires-future-approval',
  service,
  operation,
  input,
  ...extra,
});
const file = (filename) => ({ $file: filename });
const result = (step, output) => ({ $result: step, output });
const template = (name) =>
  file(path.join(projectRoot, 'infrastructure', name + '.template.json'));
const parameters = (values) =>
  Object.entries(values).map(([ParameterKey, ParameterValue]) => ({
    ParameterKey,
    ParameterValue,
  }));
const previousParameters = (names) =>
  names.map((ParameterKey) => ({ ParameterKey, UsePreviousValue: true }));
const backendParameters = [
  'PackageBucket',
  'PackageKey',
  'PackageSha256',
  'AllowedOrigin',
  'BackendRevision',
  'ConcurrencyMode',
  'RollbackVersion',
];
const revision = (manifest, allowedOrigin) =>
  sha256(manifest.backend.sha256 + '\n' + allowedOrigin);

export function validateTarget(target) {
  if (
    target.project !== project ||
    target.region !== region ||
    !/^[0-9]{12}$/.test(target.accountId ?? '') ||
    target.accountId === '000000000000' ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(target.profile ?? '') ||
    !/^platypus-[a-z0-9-]{1,20}$/.test(target.stackPrefix ?? '')
  )
    throw new Error(
      'Target must identify the reviewed Platypus project, real account, eu-north-1 and profile.',
    );
  const c = target.concurrency;
  if (!c || !['reserved-two', 'account-cap-five'].includes(c.mode))
    throw new Error(
      'Concurrency decision unresolved: actual account limit five cannot reserve two.',
    );
  if (
    !Number.isInteger(c.accountLimit) ||
    !Number.isInteger(c.unreserved) ||
    c.accountLimit < c.unreserved ||
    c.unreserved < 0
  )
    throw new Error('Fresh account quota evidence is required.');
  if (
    !c.reviewedAt ||
    !Number.isFinite(Date.parse(c.reviewedAt)) ||
    Math.abs(Date.now() - Date.parse(c.reviewedAt)) > 86400000
  )
    throw new Error(
      'Refresh concurrency evidence within 24 hours of preparing the target plan.',
    );
  if (c.mode === 'reserved-two' && c.unreserved < 102)
    throw new Error(
      'Reserved two requires two available executions above the unreserved buffer of 100.',
    );
  if (
    c.mode === 'account-cap-five' &&
    (!c.acceptedSharedAccountCap || c.accountLimit > 5)
  )
    throw new Error(
      'Account-cap-five requires explicit acceptance and a fresh account limit no higher than five.',
    );
  return target;
}

function deployedResources(target) {
  const r = target.resources;
  if (
    !r ||
    !target.ownershipVerified ||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(r.bucket ?? '') ||
    !/^[A-Z0-9]{8,32}$/.test(r.distributionId ?? '') ||
    !new RegExp(
      '^arn:aws:lambda:eu-north-1:' +
        target.accountId +
        ':function:[A-Za-z0-9_-]+$',
    ).test(r.functionArn ?? '') ||
    r.aliasArn !== r.functionArn + ':live'
  )
    throw new Error('Verified project-owned stack outputs are required.');
  origin(r.origin);
  if (!/^https:\/\/d[a-z0-9]+\.cloudfront\.net$/.test(r.origin))
    throw new Error('Use the generated CloudFront origin.');
  if (
    !/^https:\/\/[a-z0-9]+\.lambda-url\.eu-north-1\.on\.aws\/$/.test(
      r.functionUrl ?? '',
    )
  )
    throw new Error('Use the owned regional Function URL.');
  if (r.bucketDomain !== r.bucket + '.s3.eu-north-1.amazonaws.com')
    throw new Error('Unexpected bucket origin domain.');
  return r;
}

export async function makePlan({
  action = 'bootstrap',
  manifest,
  target,
  previous,
  remote,
  version,
  confirmDestroy,
}) {
  const actions = [
    'bootstrap',
    'publish',
    'remote',
    'rollback-remote',
    'rollback-backend',
    'check',
    'destroy',
  ];
  if (!actions.includes(action)) throw new Error('Unknown action.');
  const plan = {
    schemaVersion: 1,
    project,
    offline: true,
    executionAuthorized: false,
    action,
    notice:
      'This is an auditable command plan, not an executor. Resolve references and review each operation through AWS MCP after separate authorization.',
    gates: [],
    steps: [],
  };
  if (!target) {
    plan.gates = [
      'Copy infrastructure/target.example.json into ignored .local/aws/target.json and fill reviewed non-secret values.',
      'Choose the concurrency strategy explicitly: current account limit five cannot reserve two.',
      'Cloud publication and resource operations require a separate user-approved step.',
    ];
    return plan;
  }
  validateTarget(target);
  const names = Object.fromEntries(
    ['storage', 'backend', 'edge'].map((name) => [
      name,
      target.stackPrefix + '-' + name,
    ]),
  );
  plan.target = {
    accountId: target.accountId,
    region,
    profile: target.profile,
    stacks: names,
  };
  const steps = plan.steps;
  steps.push(
    read(
      'sts',
      'GetCallerIdentity',
      {},
      { assert: { Account: target.accountId }, id: 'identity' },
    ),
    read(
      'lambda',
      'GetAccountSettings',
      {},
      {
        assert: { quotaMatchesReviewedTarget: target.concurrency },
        id: 'quota',
      },
    ),
  );
  for (const StackName of Object.values(names))
    steps.push(
      read(
        'cloudformation',
        'DescribeStacks',
        { StackName },
        {
          assert: {
            expectedProjectTag: project,
            expectedAccount: target.accountId,
            allowMissingOnlyForBootstrap: action === 'bootstrap',
          },
        },
      ),
    );
  if (action === 'bootstrap') {
    const release = await ownedManifest(manifest);
    if (release.value.scope !== 'full')
      throw new Error('Bootstrap requires a full offline package.');
    const v = release.value;
    steps.push(
      write(
        'cloudformation',
        'CreateStack',
        {
          StackName: names.storage,
          TemplateBody: template('storage'),
          Tags: [{ Key: 'Project', Value: project }],
        },
        { id: 'create-storage', assert: { stackMustNotExist: true } },
      ),
      {
        kind: 'wait-and-read',
        service: 'cloudformation',
        operation: 'DescribeStacks',
        input: { StackName: names.storage },
        id: 'storage',
        until: 'CREATE_COMPLETE',
      },
    );
    const zip = v.objects.find((item) => item.app === 'backend');
    steps.push(
      write(
        's3',
        'PutObject',
        {
          Bucket: result('storage', 'BucketName'),
          Key: zip.key,
          Body: file(path.join(release.directory, zip.file)),
          ContentType: zip.contentType,
          CacheControl: 'no-store',
          ChecksumSHA256: v.backend.codeSha256,
          IfNoneMatch: '*',
          ExpectedBucketOwner: target.accountId,
        },
        { id: 'package' },
      ),
      write(
        'cloudformation',
        'CreateStack',
        {
          StackName: names.backend,
          TemplateBody: template('backend'),
          Capabilities: ['CAPABILITY_IAM'],
          Parameters: parameters({
            PackageBucket: result('storage', 'BucketName'),
            PackageKey: v.backend.key,
            PackageSha256: v.backend.codeSha256,
            AllowedOrigin: 'https://bootstrap.invalid',
            BackendRevision: revision(v, 'https://bootstrap.invalid'),
            ConcurrencyMode: target.concurrency.mode,
            RollbackVersion: '',
          }),
          Tags: [{ Key: 'Project', Value: project }],
        },
        { id: 'create-backend' },
      ),
      {
        kind: 'wait-and-read',
        service: 'cloudformation',
        operation: 'DescribeStacks',
        input: { StackName: names.backend },
        id: 'backend',
        until: 'CREATE_COMPLETE',
      },
      write(
        'cloudformation',
        'CreateStack',
        {
          StackName: names.edge,
          TemplateBody: template('edge'),
          Parameters: parameters({
            BucketDomain: result('storage', 'BucketRegionalDomainName'),
            AliasArn: result('backend', 'AliasArn'),
            ApiUrl: result('backend', 'FunctionUrl'),
            Enabled: 'false',
          }),
          Tags: [{ Key: 'Project', Value: project }],
        },
        { id: 'create-edge' },
      ),
      {
        kind: 'wait-and-read',
        service: 'cloudformation',
        operation: 'DescribeStacks',
        input: { StackName: names.edge },
        id: 'edge',
        until: 'CREATE_COMPLETE',
      },
      {
        kind: 'manual-local-checkpoint',
        action:
          'Record verified stack outputs in the ignored target. Prepare a NEW full release using the generated CloudFront HTTPS origin, then review a publish plan. Edge stays disabled and S3 stays private until that phase.',
      },
    );
    return plan;
  }
  const r = deployedResources(target);
  steps.push(
    read(
      's3',
      'GetBucketTagging',
      { Bucket: r.bucket, ExpectedBucketOwner: target.accountId },
      { assert: { Project: project } },
    ),
    read(
      'cloudformation',
      'ListStackResources',
      { StackName: names.storage },
      { assert: { Artifacts: r.bucket } },
    ),
    read(
      'cloudformation',
      'ListStackResources',
      { StackName: names.backend },
      { assert: { Function: r.functionArn.split(':').at(-1) } },
    ),
    read(
      'cloudformation',
      'ListStackResources',
      { StackName: names.edge },
      { assert: { Distribution: r.distributionId } },
    ),
  );
  if (action === 'check') {
    steps.push(
      read('lambda', 'GetAlias', { FunctionName: r.functionArn, Name: 'live' }),
      read(
        'lambda',
        'GetFunctionUrlConfig',
        { FunctionName: r.functionArn, Qualifier: 'live' },
        { assert: { AuthType: 'AWS_IAM', FunctionUrl: r.functionUrl } },
      ),
      read(
        'lambda',
        'GetPolicy',
        { FunctionName: r.functionArn, Qualifier: 'live' },
        {
          assert: { bothDistributionScopedInvocationGrants: r.distributionId },
        },
      ),
      read(
        'cloudfront',
        'GetDistribution',
        { Id: r.distributionId },
        { assert: { Status: 'Deployed', Origin: r.origin } },
      ),
      {
        kind: 'manual-browser-check',
        paths: [
          '/analytics',
          '/administration',
          '/support/tickets',
          '/api/health',
          '/api/tickets',
          '/mfe/missing.js',
        ],
        assert: [
          'Direct refresh',
          '25 tickets',
          'No localhost requests',
          'Missing assets stay non-HTML',
          'Anonymous origins denied',
          'Controlled API outage recovers through Retry',
        ],
      },
    );
    return plan;
  }
  if (action === 'rollback-backend') {
    if (!/^[1-9][0-9]*$/.test(version ?? ''))
      throw new Error('An existing numeric rollback version is required.');
    steps.push(
      read(
        'lambda',
        'GetFunction',
        { FunctionName: r.functionArn, Qualifier: version },
        {
          assert: {
            AllowedOrigin: r.origin,
            packageAndContractMustBeReviewed: true,
          },
        },
      ),
      write('cloudformation', 'UpdateStack', {
        StackName: names.backend,
        UsePreviousTemplate: true,
        Parameters: [
          ...previousParameters(
            backendParameters.filter((name) => name !== 'RollbackVersion'),
          ),
          ...parameters({ RollbackVersion: version }),
        ],
        Capabilities: ['CAPABILITY_IAM'],
      }),
      {
        kind: 'wait-and-read',
        service: 'cloudformation',
        operation: 'DescribeStacks',
        input: { StackName: names.backend },
        until: 'UPDATE_COMPLETE',
      },
      read(
        'lambda',
        'GetAlias',
        { FunctionName: r.functionArn, Name: 'live' },
        { assert: { FunctionVersion: version } },
      ),
    );
    return plan;
  }
  if (action === 'destroy') {
    if (confirmDestroy !== target.stackPrefix)
      throw new Error(
        'Destroy plan requires --confirm-destroy with the exact owned stack prefix. No execution occurs.',
      );
    steps.push(
      write('cloudformation', 'UpdateStack', {
        StackName: names.edge,
        UsePreviousTemplate: true,
        Parameters: [
          ...previousParameters(['BucketDomain', 'AliasArn', 'ApiUrl']),
          ...parameters({ Enabled: 'false' }),
        ],
      }),
      {
        kind: 'wait-and-read',
        service: 'cloudfront',
        operation: 'GetDistribution',
        input: { Id: r.distributionId },
        until: 'Deployed and Enabled=false',
      },
      write('cloudformation', 'DeleteStack', { StackName: names.edge }),
      {
        kind: 'wait-and-read',
        service: 'cloudformation',
        operation: 'DescribeStacks',
        input: { StackName: names.edge },
        until: 'DELETE_COMPLETE or confirmed absent',
      },
      write('cloudformation', 'DeleteStack', { StackName: names.backend }),
      {
        kind: 'wait-and-read',
        service: 'cloudformation',
        operation: 'DescribeStacks',
        input: { StackName: names.backend },
        until: 'DELETE_COMPLETE or confirmed absent',
      },
      read(
        's3',
        'GetBucketVersioning',
        { Bucket: r.bucket, ExpectedBucketOwner: target.accountId },
        { assert: { versioningMustNeverHaveBeenEnabled: true } },
      ),
      {
        kind: 'manual-paginated-object-deletion',
        service: 's3',
        listOperation: 'ListObjectsV2',
        deleteOperation: 'DeleteObjects',
        input: { Bucket: r.bucket, ExpectedBucketOwner: target.accountId },
        maximumBatch: 1000,
        assert: [
          'Confirm all pages and keys belong to reviewed Platypus release manifests.',
          'Stop on unknown objects, version history, retention or ownership changes.',
          'Explicitly review removal of _deploy and _releases backups.',
          'Continue only when the owned bucket is empty.',
        ],
      },
      write(
        'cloudformation',
        'DeleteStack',
        { StackName: names.storage },
        {
          note: 'Artifacts bucket is intentionally retained and transfers to explicit cleanup ownership.',
        },
      ),
      {
        kind: 'wait-and-read',
        service: 'cloudformation',
        operation: 'DescribeStacks',
        input: { StackName: names.storage },
        until: 'DELETE_COMPLETE or confirmed absent',
      },
      write('s3', 'DeleteBucket', {
        Bucket: r.bucket,
        ExpectedBucketOwner: target.accountId,
      }),
      {
        kind: 'manual-final-inventory',
        assert: [
          'No owned functions/versions, aliases, URL, edge resources, log group or bucket remain.',
          'Record DELETE_FAILED and retained resources; never claim teardown from a submitted delete request.',
        ],
      },
    );
    return plan;
  }
  const release = await ownedManifest(manifest);
  const v = release.value;
  if (v.origin !== r.origin)
    throw new Error(
      'Packaged origin must exactly match the verified distribution.',
    );
  let old;
  if (previous) old = await ownedManifest(previous);
  if ((action === 'remote' || action === 'rollback-remote') && !old)
    throw new Error(
      'A verified previous/current pointer manifest is required.',
    );
  if (
    action === 'remote' &&
    (v.scope !== remote ||
      !remotes.includes(remote) ||
      old.value.release !== v.previous)
  )
    throw new Error('Remote scope or its previous release does not match.');
  if (action === 'publish' && v.scope !== 'full')
    throw new Error('Publish requires a full release.');
  if (action === 'rollback-remote' && !remotes.includes(remote))
    throw new Error('Select exactly one remote for rollback.');
  const current = action === 'rollback-remote' ? old.value : old?.value;
  steps.push(
    read(
      's3',
      'GetObject',
      {
        Bucket: r.bucket,
        Key: 'runtime-config.json',
        ExpectedBucketOwner: target.accountId,
      },
      {
        id: 'pointer',
        assert: current
          ? {
              bodySha256: current.objects.find(
                (item) => item.key === 'runtime-config.json',
              ).sha256,
            }
          : { mustBeAbsent: true },
      },
    ),
  );
  if (action === 'rollback-remote') {
    const references = structuredClone(old.value.references);
    references[remote] = v.references[remote];
    for (const item of v.apps[remote].objects)
      steps.push(
        read(
          's3',
          'HeadObject',
          {
            Bucket: r.bucket,
            Key: item.key,
            ChecksumMode: 'ENABLED',
            ExpectedBucketOwner: target.accountId,
          },
          {
            assert: {
              ChecksumSHA256: Buffer.from(item.sha256, 'hex').toString(
                'base64',
              ),
            },
          },
        ),
      );
    steps.push(
      write('s3', 'PutObject', {
        Bucket: r.bucket,
        Key: 'runtime-config.json',
        Body: json({ schemaVersion: 1, remotes: references }),
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'no-store',
        IfMatch: result('pointer', 'ETag'),
        ExpectedBucketOwner: target.accountId,
      }),
      {
        kind: 'manual-local-checkpoint',
        action:
          'Record the merged pointer and its hash as the current deployment manifest; reload a document and verify the selected remote plus unchanged others.',
      },
    );
    return plan;
  }
  if (action === 'publish') {
    const zip = v.objects.find((item) => item.app === 'backend');
    steps.push(
      write('s3', 'PutObject', {
        Bucket: r.bucket,
        Key: zip.key,
        Body: file(path.join(release.directory, zip.file)),
        ContentType: zip.contentType,
        CacheControl: 'no-store',
        ChecksumSHA256: v.backend.codeSha256,
        IfNoneMatch: '*',
        ExpectedBucketOwner: target.accountId,
      }),
      write('cloudformation', 'UpdateStack', {
        StackName: names.backend,
        TemplateBody: template('backend'),
        Capabilities: ['CAPABILITY_IAM'],
        Parameters: parameters({
          PackageBucket: r.bucket,
          PackageKey: v.backend.key,
          PackageSha256: v.backend.codeSha256,
          AllowedOrigin: r.origin,
          BackendRevision: revision(v, r.origin),
          ConcurrencyMode: target.concurrency.mode,
          RollbackVersion: '',
        }),
      }),
      {
        kind: 'wait-and-read',
        service: 'cloudformation',
        operation: 'DescribeStacks',
        input: { StackName: names.backend },
        until: 'UPDATE_COMPLETE',
      },
      write('cloudformation', 'UpdateStack', {
        StackName: names.storage,
        UsePreviousTemplate: true,
        Parameters: parameters({ DistributionId: r.distributionId }),
      }),
      {
        kind: 'wait-and-read',
        service: 'cloudformation',
        operation: 'DescribeStacks',
        input: { StackName: names.storage },
        until: 'UPDATE_COMPLETE',
      },
    );
  }
  const pointer = v.objects.find((item) => item.key === 'runtime-config.json');
  const ordered = v.objects.filter(
    (item) =>
      item.key !== 'runtime-config.json' &&
      item.key !== 'index.html' &&
      item.app !== 'backend',
  );
  ordered.push(pointer);
  const index = v.objects.find((item) => item.key === 'index.html');
  if (index) ordered.push(index);
  for (const item of ordered) {
    if (item.key === 'runtime-config.json')
      for (const app of remotes)
        for (const object of v.apps[app].objects)
          steps.push(
            read(
              's3',
              'HeadObject',
              {
                Bucket: r.bucket,
                Key: object.key,
                ChecksumMode: 'ENABLED',
                ExpectedBucketOwner: target.accountId,
              },
              {
                assert: {
                  ChecksumSHA256: Buffer.from(object.sha256, 'hex').toString(
                    'base64',
                  ),
                },
              },
            ),
          );
    steps.push(
      write(
        's3',
        'PutObject',
        {
          Bucket: r.bucket,
          Key: item.key,
          Body: file(path.join(release.directory, item.file)),
          ContentType: item.contentType,
          CacheControl: item.cacheControl,
          ChecksumSHA256: Buffer.from(item.sha256, 'hex').toString('base64'),
          ExpectedBucketOwner: target.accountId,
          ...(item.key === 'runtime-config.json'
            ? current
              ? { IfMatch: result('pointer', 'ETag') }
              : { IfNoneMatch: '*' }
            : item.key.startsWith('mfe/') || item.key.startsWith('_')
              ? { IfNoneMatch: '*' }
              : {}),
        },
        {
          assert: {
            verifyReferenceGraphsBeforePointer:
              item.key === 'runtime-config.json',
            preserveExistingSameHash: true,
          },
        },
      ),
    );
  }
  if (action === 'publish')
    steps.push(
      write('cloudformation', 'UpdateStack', {
        StackName: names.edge,
        UsePreviousTemplate: true,
        Parameters: [
          ...previousParameters(['BucketDomain', 'AliasArn', 'ApiUrl']),
          ...parameters({ Enabled: 'true' }),
        ],
      }),
      {
        kind: 'wait-and-read',
        service: 'cloudfront',
        operation: 'GetDistribution',
        input: { Id: r.distributionId },
        until: 'Deployed and Enabled=true',
      },
    );
  steps.push({
    kind: 'manual-local-checkpoint',
    action:
      'Record verified outputs, active alias version, pointer ETag/hash and complete release graph. Run the check plan and actual browser acceptance before reporting success.',
  });
  return plan;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const options = flags(process.argv.slice(2), [
      '--action',
      '--manifest',
      '--target',
      '--previous',
      '--remote',
      '--version',
      '--confirm-destroy',
    ]);
    const target = options['--target']
      ? JSON.parse(await readFile(options['--target'], 'utf8'))
      : undefined;
    console.log(
      json(
        await makePlan({
          action: options['--action'],
          manifest: options['--manifest'],
          target,
          previous: options['--previous'],
          remote: options['--remote'],
          version: options['--version'],
          confirmDestroy: options['--confirm-destroy'],
        }),
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
