import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  cacheControl,
  contentType,
  json,
  outputRoot,
  project,
  remotes,
  sha256,
} from '../aws/common.mjs';
import { verifyDeliveryBundle } from './bundle.mjs';
import {
  importBaseline,
  preflight,
  publishDelivery,
  publishNeonDelivery,
  recoverDelivery,
  reconcileDelivery,
} from './executor.mjs';
import {
  backendTemplate,
  edgeTemplate,
  storageTemplate,
} from '../aws/templates.mjs';
import { neonBackendTemplate } from '../neon-aws/templates.mjs';
import { syntheticNeonRelease } from '../neon-aws/synthetic-neon-release.mjs';

const productionOrigin = 'https://dfailurefixture.cloudfront.net';
const repository = 'dmytrorozhkov/platypus-service';
let nextRun = BigInt(Date.now()) * 100n;

async function fixture(t, label = 'candidate') {
  const context = {
    sourceSha: (label === 'baseline' ? 'a' : 'b').repeat(40),
    runId: String(nextRun++),
    runAttempt: '1',
    repository,
  };
  const release = `gh-${context.runId}-1-${context.sourceSha.slice(0, 12)}`;
  const directory = path.join(outputRoot, 'releases', release);
  await mkdir(directory, { recursive: true });
  t.after(async () => {
    // The exact newly allocated fixture is a checked child of the owned release root.
    assert.equal(path.dirname(directory), path.join(outputRoot, 'releases'));
    assert.match(path.basename(directory), /^gh-[0-9]+-1-[ab]{12}$/);
    await rm(directory, { recursive: true, force: true });
  });
  const objects = [];
  async function file(relative, bytes) {
    const filename = path.join(directory, relative);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, bytes);
  }
  async function object(key, body, app) {
    const bytes = Buffer.from(body);
    const relative = 'objects/' + key;
    await file(relative, bytes);
    objects.push({
      key,
      file: relative,
      sha256: sha256(bytes),
      bytes: bytes.length,
      contentType: contentType(key),
      cacheControl: cacheControl(key),
      app,
    });
  }
  const apps = {};
  const references = {};
  for (const app of remotes) {
    const prefix = `mfe/${app}/${release}/`;
    const graph = [];
    for (const [name, body] of [
      [
        'remoteEntry.json',
        json({
          name: app,
          exposes: [{ key: './mount', outFileName: 'mount.js' }],
          shared: [],
        }),
      ],
      ['mount.js', 'export function mount() {}\n'],
      [app === 'support' ? 'styles.css' : 'style.css', '/* fixture */\n'],
    ]) {
      await object(prefix + name, body, app);
      graph.push({ file: name, sha256: sha256(body) });
    }
    apps[app] = {
      release,
      graphSha256: sha256(json(graph)),
      objects: graph.map((item) => ({
        key: prefix + item.file,
        sha256: item.sha256,
      })),
    };
    references[app] = {
      contractVersion: 1,
      exposedModule: './mount',
      remoteEntryUrl: productionOrigin + '/' + prefix + 'remoteEntry.json',
      cssUrls: [
        productionOrigin +
          '/' +
          prefix +
          (app === 'support' ? 'styles.css' : 'style.css'),
      ],
    };
  }
  const index = `<html><body>${label}<script src="/main-fixture.js"></script></body></html>\n`;
  const shell = [
    ['index.html', index],
    ['main-fixture.js', 'console.log("fixture");\n'],
    ['favicon.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>\n'],
  ];
  for (const [name, bytes] of shell) await object(name, bytes, 'shell');
  apps.shell = {
    release,
    graphSha256: sha256(
      json(shell.map(([file, body]) => ({ file, sha256: sha256(body) }))),
    ),
  };
  const runtime = json({ schemaVersion: 1, remotes: references });
  await object('runtime-config.json', runtime, 'configuration');
  await object(`_releases/${release}/runtime-config.json`, runtime, 'rollback');
  await object(`_releases/${release}/index.html`, index, 'rollback');
  // Synthetic bytes test publication ordering only; task039 separately verifies a real ZIP.
  const archive = Buffer.from(
    'PK\x03\x04synthetic-publication-fixture-' + label,
  );
  await file('backend.zip', archive);
  await object(`_deploy/backend/${release}.zip`, archive, 'backend');
  const backendFiles = {};
  for (const [name, body] of [
    ['lambda.js', 'export async function handler() {}\n'],
    ['ticket-application.js', 'export {};\n'],
    ['ticket-query.js', 'export {};\n'],
    ['ticket-repository.js', 'export {};\n'],
    ['fixtures/tickets.json', '[]\n'],
    ['package.json', json({ private: true, type: 'module' })],
  ]) {
    await file('lambda/' + name, body);
    await file('lambda-extracted/' + name, body);
    backendFiles[name] = sha256(body);
  }
  const manifest = {
    schemaVersion: 1,
    project,
    release,
    origin: productionOrigin,
    scope: 'full',
    previous: null,
    apps,
    references,
    objects,
    backend: {
      key: `_deploy/backend/${release}.zip`,
      sha256: sha256(archive),
      codeSha256: sha256base64(archive),
      files: backendFiles,
    },
  };
  await file('owner.json', json({ project, release }));
  await file('manifest.json', json(manifest));
  const inventory = [];
  async function walk(current, prefix = '') {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isDirectory())
        await walk(path.join(current, entry.name), relative + '/');
      else {
        const bytes = await readFile(path.join(current, entry.name));
        inventory.push({
          file: relative,
          bytes: bytes.length,
          sha256: sha256(bytes),
        });
      }
    }
  }
  await walk(directory);
  inventory.sort((a, b) => a.file.localeCompare(b.file));
  const envelope = {
    schemaVersion: 1,
    project,
    ...context,
    origin: productionOrigin,
    release,
    manifestSha256: sha256(json(manifest)),
    inventory,
    totalBytes: inventory.reduce((sum, item) => sum + item.bytes, 0),
  };
  await file('bundle-envelope.json', json(envelope));
  await verifyDeliveryBundle({
    directory,
    ...context,
    origin: productionOrigin,
  });
  return {
    directory,
    context,
    release,
    manifest,
    envelope,
    envelopeSha256: sha256(json(envelope)),
  };
}

function sha256base64(bytes) {
  return Buffer.from(sha256(bytes), 'hex').toString('base64');
}

function targetFixture() {
  const accountId = '111122223333';
  const functionArn = `arn:aws:lambda:eu-north-1:${accountId}:function:platypus-test-api`;
  return {
    project,
    region: 'eu-north-1',
    accountId,
    ownershipVerified: true,
    serviceRoleArn: `arn:aws:iam::${accountId}:role/platypus-test-delivery-cfn`,
    lambdaExecutionRoleArn: `arn:aws:iam::${accountId}:role/platypus-test-lambda`,
    concurrency: { mode: 'account-cap-ten', acceptedSharedAccountCap: true },
    stacks: Object.fromEntries(
      ['storage', 'backend', 'edge'].map((name) => [
        name,
        `arn:aws:cloudformation:eu-north-1:${accountId}:stack/platypus-test-${name}/11111111-2222-3333-4444-555555555555`,
      ]),
    ),
    resources: {
      bucket: 'platypus-test-delivery-artifacts',
      bucketDomain:
        'platypus-test-delivery-artifacts.s3.eu-north-1.amazonaws.com',
      functionArn,
      aliasArn: functionArn + ':live',
      distributionId: 'E123456789ABC',
      functionUrl: 'https://failurefixture.lambda-url.eu-north-1.on.aws/',
      origin: productionOrigin,
    },
  };
}

function cloudError(code) {
  return Object.assign(new Error(code), { name: code, code });
}

class MemoryObjects {
  objects = new Map();
  calls = [];
  sequence = 0;
  fault;

  constructor(target) {
    this.target = target;
  }

  seed(Key, body, metadata = {}) {
    const bytes = Buffer.from(body);
    const value = {
      body: bytes,
      ETag: '"fixture-' + ++this.sequence + '"',
      ChecksumSHA256: sha256base64(bytes),
      ContentType: metadata.ContentType ?? contentType(Key),
      CacheControl: metadata.CacheControl ?? cacheControl(Key),
    };
    this.objects.set(Key, value);
    return value;
  }

  async getObject(input) {
    this.calls.push({
      service: 's3',
      operation: 'get-object',
      input: structuredClone(input),
    });
    assert.equal(input.Bucket, this.target.resources.bucket);
    assert.equal(input.ExpectedBucketOwner, this.target.accountId);
    const value = this.objects.get(input.Key);
    if (!value) throw cloudError('NoSuchKey');
    return { ...value, body: Buffer.from(value.body) };
  }

  async putObject(input) {
    const call = {
      service: 's3',
      operation: 'put-object',
      input: { ...input, Body: Buffer.from(input.Body) },
    };
    this.calls.push(call);
    assert.equal(input.Bucket, this.target.resources.bucket);
    assert.equal(input.ExpectedBucketOwner, this.target.accountId);
    assert(
      input.IfMatch || input.IfNoneMatch === '*',
      'Every cloud object write must be conditional.',
    );
    if (this.fault) await this.fault(call, this);
    const old = this.objects.get(input.Key);
    if (
      (input.IfNoneMatch === '*' && old) ||
      (input.IfMatch && input.IfMatch !== old?.ETag)
    )
      throw cloudError('PreconditionFailed');
    const value = this.seed(input.Key, input.Body, input);
    assert.equal(
      input.ChecksumSHA256,
      value.ChecksumSHA256,
      'Every published object must bind its body SHA-256.',
    );
    return { ETag: value.ETag };
  }
}

class FakeAws extends MemoryObjects {
  versions = new Map();
  releases = new Map();
  aliasVersion = '2';
  backendStatus = 'UPDATE_COMPLETE';
  changes;
  requestFault;
  runtimes = new Map();

  constructor(target, baseline) {
    super(target);
    this.backendTemplate = backendTemplate();
    this.backendRoleArn = target.serviceRoleArn;
    this.releases.set(baseline.release, baseline.manifest);
    this.versions.set('2', baseline.manifest);
    this.parameters = this.parametersFor(baseline.manifest);
  }

  parametersFor(manifest) {
    return {
      PackageBucket: this.target.resources.bucket,
      PackageKey: manifest.backend.key,
      PackageSha256: manifest.backend.codeSha256,
      AllowedOrigin: productionOrigin,
      BackendRevision: sha256(
        manifest.backend.sha256 + '\n' + productionOrigin,
      ),
      ConcurrencyMode: 'account-cap-ten',
      RollbackVersion: '',
    };
  }

  configuration(version) {
    const manifest = this.versions.get(version);
    assert(manifest, 'Fake Lambda version must be explicitly seeded.');
    const runtime = this.runtimes.get(manifest.release);
    return {
      Version: version,
      CodeSha256: manifest.backend.codeSha256,
      Environment: {
        Variables: runtime
          ? {
              ALLOWED_ORIGINS: runtime.origin,
              NEON_HOST: runtime.neonHost,
              NEON_DATABASE: runtime.database,
              NEON_USER: runtime.user,
              NEON_CONFIRM_TARGET: runtime.neonHost + '/' + runtime.database,
              NEON_PASSWORD_PARAMETER_ARN: runtime.passwordParameterArn,
              NEON_PASSWORD_PARAMETER_VERSION: String(
                runtime.passwordParameterVersion,
              ),
            }
          : { ALLOWED_ORIGINS: productionOrigin },
      },
      Description:
        this.backendTemplate.Resources.Version.Properties.Description[
          'Fn::Sub'
        ].replace(
          '${BackendRevision}',
          manifest.backend.backendRevision ??
            sha256(manifest.backend.sha256 + '\n' + productionOrigin),
        ),
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Handler: 'lambda.handler',
      MemorySize: 256,
      Timeout: runtime ? 30 : 3,
      Role: `arn:aws:iam::${this.target.accountId}:role/platypus-test-lambda`,
      VpcConfig: {},
    };
  }

  async request(service, operation, input = {}) {
    const call = { service, operation, input: structuredClone(input) };
    this.calls.push(call);
    if (this.requestFault) {
      const answer = await this.requestFault(call, this);
      if (answer !== undefined) return answer;
    }
    const t = this.target;
    const r = t.resources;
    const kind = Object.keys(t.stacks).find(
      (name) => t.stacks[name] === input.StackName,
    );
    switch (service + ':' + operation) {
      case 'sts:get-caller-identity':
        return { Account: t.accountId };
      case 'freetier:get-account-plan-state':
        return {
          accountId: t.accountId,
          accountPlanType: 'FREE',
          accountPlanStatus: 'ACTIVE',
          accountPlanRemainingCredits: { amount: 100, unit: 'USD' },
          accountPlanExpirationDate: '2099-01-01T00:00:00Z',
        };
      case 'lambda:get-account-settings':
        return {
          AccountLimit: {
            ConcurrentExecutions: 10,
            UnreservedConcurrentExecutions: 10,
          },
        };
      case 'lambda:get-function-concurrency':
        return {};
      case 'cloudformation:describe-stacks': {
        assert(kind, 'Only exact owned stacks may be read.');
        const outputValues = {
          storage: {
            BucketName: r.bucket,
            BucketRegionalDomainName: r.bucketDomain,
          },
          backend: {
            FunctionArn: r.functionArn,
            AliasArn: r.aliasArn,
            FunctionUrl: r.functionUrl,
          },
          edge: { DistributionId: r.distributionId, Origin: r.origin },
        }[kind];
        return {
          Stacks: [
            {
              StackId: t.stacks[kind],
              StackStatus:
                kind === 'backend' ? this.backendStatus : 'UPDATE_COMPLETE',
              RoleARN: kind === 'backend' ? this.backendRoleArn : undefined,
              Tags: [{ Key: 'Project', Value: project }],
              Outputs: Object.entries(outputValues).map(
                ([OutputKey, OutputValue]) => ({ OutputKey, OutputValue }),
              ),
              Parameters: Object.entries(this.parameters).map(
                ([ParameterKey, ParameterValue]) => ({
                  ParameterKey,
                  ParameterValue,
                }),
              ),
            },
          ],
        };
      }
      case 'cloudformation:get-template':
        return {
          TemplateBody:
            kind === 'backend'
              ? input.ChangeSetName && this.changes.TemplateBody
                ? JSON.parse(this.changes.TemplateBody)
                : structuredClone(this.backendTemplate)
              : { storage: storageTemplate, edge: edgeTemplate }[kind](),
        };
      case 'cloudformation:list-stack-resources':
        return {
          StackResourceSummaries: [
            {
              LogicalResourceId: {
                storage: 'Artifacts',
                backend: 'Function',
                edge: 'Distribution',
              }[kind],
              PhysicalResourceId: {
                storage: r.bucket,
                backend: r.functionArn.split(':').at(-1),
                edge: r.distributionId,
              }[kind],
            },
          ],
        };
      case 's3api:get-bucket-tagging':
        return { TagSet: [{ Key: 'Project', Value: project }] };
      case 's3api:get-bucket-versioning':
        return {};
      case 'cloudfront:get-distribution':
        return {
          Distribution: {
            Id: r.distributionId,
            Status: 'Deployed',
            DomainName: new URL(r.origin).hostname,
            DistributionConfig: {
              Enabled: true,
              Origins: {
                Items: [
                  { Id: 'static', DomainName: r.bucketDomain },
                  { Id: 'api', DomainName: new URL(r.functionUrl).hostname },
                ],
              },
            },
          },
        };
      case 'lambda:get-function-url-config':
        return { AuthType: 'AWS_IAM', FunctionUrl: r.functionUrl };
      case 'lambda:get-alias':
        return { AliasArn: r.aliasArn, FunctionVersion: this.aliasVersion };
      case 'lambda:get-function-configuration':
        return this.configuration(input.Qualifier);
      case 'cloudformation:create-change-set': {
        assert.equal(
          input.StackName,
          t.stacks.backend,
          'Publication must never update storage/edge.',
        );
        if (input.TemplateBody) {
          assert.equal(input.UsePreviousTemplate, undefined);
          assert.deepEqual(
            JSON.parse(input.TemplateBody),
            neonBackendTemplate(),
          );
        } else assert.equal(input.UsePreviousTemplate, true);
        assert.equal(input.RoleARN, t.serviceRoleArn);
        this.changes = input;
        return {
          StackId: t.stacks.backend,
          Id:
            'arn:aws:cloudformation:eu-north-1:' +
            t.accountId +
            ':changeSet/fixture/one',
        };
      }
      case 'cloudformation:describe-change-set': {
        const parameters = this.changes.Parameters.map((item) => ({
          ParameterKey: item.ParameterKey,
          ParameterValue: item.UsePreviousValue
            ? this.parameters[item.ParameterKey]
            : item.ParameterValue,
        }));
        const recovery =
          parameters.find((item) => item.ParameterKey === 'RollbackVersion')
            .ParameterValue !== '';
        const changed = recovery
          ? [['LiveAlias', 'AWS::Lambda::Alias', 'FunctionVersion']]
          : [
              ['Function', 'AWS::Lambda::Function', 'Code'],
              ['Version', 'AWS::Lambda::Version', 'CodeSha256'],
              ['LiveAlias', 'AWS::Lambda::Alias', 'FunctionVersion'],
            ];
        if (this.changes.TemplateBody)
          changed.push(['ExecutionRole', 'AWS::IAM::Role', 'Policies']);
        return {
          StackId: t.stacks.backend,
          ChangeSetName: this.changes.ChangeSetName,
          Status: 'CREATE_COMPLETE',
          ExecutionStatus: 'AVAILABLE',
          Parameters: parameters,
          Changes: changed.map(([logical, type, property]) => ({
            Type: 'Resource',
            ResourceChange: {
              LogicalResourceId: logical,
              ResourceType: type,
              Action: 'Modify',
              Replacement: logical === 'Version' ? 'True' : 'False',
              Scope: ['Properties'],
              Details: [
                { Target: { Attribute: 'Properties', Name: property } },
              ],
            },
          })),
        };
      }
      case 'cloudformation:execute-change-set': {
        assert.equal(input.StackName, t.stacks.backend);
        this.backendStatus = 'UPDATE_COMPLETE';
        this.backendRoleArn = this.changes.RoleARN;
        if (this.changes.TemplateBody)
          this.backendTemplate = JSON.parse(this.changes.TemplateBody);
        for (const item of this.changes.Parameters)
          if (!item.UsePreviousValue)
            this.parameters[item.ParameterKey] = item.ParameterValue;
        if (this.parameters.RollbackVersion)
          this.aliasVersion = this.parameters.RollbackVersion;
        else {
          const manifest = [...this.releases.values()].find(
            (item) => item.backend.key === this.parameters.PackageKey,
          );
          assert(
            manifest,
            'Changed backend must match a known complete fixture.',
          );
          this.aliasVersion = String(
            Math.max(...[...this.versions.keys()].map(Number)) + 1,
          );
          this.versions.set(this.aliasVersion, manifest);
        }
        return {};
      }
      default:
        assert.fail('Unexpected cloud operation: ' + service + ':' + operation);
    }
  }

  state() {
    return JSON.parse(this.objects.get('_releases/delivery/current.json').body);
  }

  mutations() {
    return this.calls.filter(
      (call) =>
        call.operation === 'put-object' ||
        ['create-change-set', 'execute-change-set'].includes(call.operation),
    );
  }
}

async function scenario(t) {
  const baseline = await fixture(t, 'baseline');
  const candidate = await fixture(t);
  const target = targetFixture();
  const transport = new FakeAws(target, baseline);
  transport.releases.set(candidate.release, candidate.manifest);
  for (const item of baseline.manifest.objects)
    transport.seed(
      item.key,
      await readFile(path.join(baseline.directory, item.file)),
      { ContentType: item.contentType, CacheControl: item.cacheControl },
    );
  await importBaseline({
    directory: baseline.directory,
    target,
    expectedAliasVersion: '2',
    transport,
    liveCheck: async () => ({ success: true, fixture: 'baseline' }),
  });
  assert.equal(
    transport.state().status,
    'completed',
    'Successful import is the fixture control.',
  );
  transport.calls = [];
  const publish = (extra = {}) =>
    publishDelivery({
      bundle: candidate.directory,
      target,
      context: candidate.context,
      envelopeSha256: candidate.envelopeSha256,
      transport,
      liveCheck: async () => ({ success: true }),
      ...extra,
    });
  return { baseline, candidate, target, transport, publish };
}

test('full publication locks first, verifies live behavior and only then completes exact-source state', async (t) => {
  const s = await scenario(t);
  const baselineState = s.transport.state();
  const imported = JSON.parse(
    s.transport.objects.get(
      `_releases/delivery/records/${s.baseline.release}.json`,
    ).body,
  );
  assert.equal(imported.provenance, 'manual-import');
  assert.equal(
    imported.context,
    null,
    'An imported baseline must never invent a source commit.',
  );
  let checked = false;
  await s.publish({
    liveCheck: async (origins) => {
      assert.equal(s.transport.state().status, 'pending');
      assert.equal(s.transport.state().previous.release, baselineState.release);
      assert.equal(
        s.transport.objects.has(
          `_releases/delivery/records/${s.candidate.release}.json`,
        ),
        false,
      );
      assert.equal(s.transport.aliasVersion, '3');
      for (const key of ['runtime-config.json', 'index.html'])
        assert.equal(
          sha256(s.transport.objects.get(key).body),
          s.candidate.manifest.objects.find((item) => item.key === key).sha256,
        );
      assert.deepEqual(origins, {
        origin: productionOrigin,
        functionUrl: s.target.resources.functionUrl,
        bucketOrigin: 'https://' + s.target.resources.bucketDomain,
        runtimeVariant: 'fixture',
      });
      s.transport.calls.push({ operation: 'live-acceptance' });
      checked = true;
      return { success: true, groups: ['fixture-only'] };
    },
  });
  assert(checked);
  assert.equal(s.transport.state().status, 'completed');
  assert.equal(s.transport.state().release, s.candidate.release);
  const record = JSON.parse(
    s.transport.objects.get(
      `_releases/delivery/records/${s.candidate.release}.json`,
    ).body,
  );
  assert.deepEqual(record.context, s.candidate.context);
  const calls = s.transport.calls;
  const lock = calls.findIndex(
    (call) =>
      call.operation === 'put-object' &&
      call.input.Key === '_releases/delivery/current.json',
  );
  const execute = calls.findIndex(
    (call) => call.operation === 'execute-change-set',
  );
  const pointer = calls.findIndex(
    (call) =>
      call.operation === 'put-object' &&
      call.input.Key === 'runtime-config.json',
  );
  const index = calls.findIndex(
    (call) =>
      call.operation === 'put-object' && call.input.Key === 'index.html',
  );
  const acceptance = calls.findIndex(
    (call) => call.operation === 'live-acceptance',
  );
  const finish = calls.findLastIndex(
    (call) =>
      call.operation === 'put-object' &&
      call.input.Key === '_releases/delivery/current.json',
  );
  assert(
    lock >= 0 &&
      lock < execute &&
      execute < pointer &&
      pointer < index &&
      index < acceptance &&
      acceptance < finish,
  );
  assert(
    calls
      .filter(
        (call) =>
          call.operation === 'put-object' &&
          ['runtime-config.json', 'index.html', 'favicon.svg'].includes(
            call.input.Key,
          ),
      )
      .every((call) => call.input.IfMatch),
  );
  assert.equal(
    calls.some((call) =>
      [
        'delete-object',
        'delete-stack',
        'update-alias',
        'update-stack',
      ].includes(call.operation),
    ),
    false,
  );
});

test('changed source/run/origin and checked-artifact digest stop before cloud mutation', async (t) => {
  const s = await scenario(t);
  for (const extra of [
    { context: { ...s.candidate.context, sourceSha: 'c'.repeat(40) } },
    {
      context: {
        ...s.candidate.context,
        runId: String(BigInt(s.candidate.context.runId) + 1n),
      },
    },
    { context: { ...s.candidate.context, runAttempt: '2' } },
    {
      target: {
        ...s.target,
        resources: {
          ...s.target.resources,
          origin: 'https://dwrongorigin.cloudfront.net',
        },
      },
    },
    { envelopeSha256: '0'.repeat(64) },
  ]) {
    await assert.rejects(s.publish(extra), /differs|identity|SHA|origin|run/i);
    assert.equal(s.transport.mutations().length, 0);
  }
  const item = s.candidate.manifest.objects.find((value) =>
    value.key.endsWith('/mount.js'),
  );
  await writeFile(
    path.join(s.candidate.directory, item.file),
    'corrupt after checked packaging',
  );
  await assert.rejects(s.publish(), /inventory|hash/i);
  assert.equal(s.transport.mutations().length, 0);
});

test('a completed release cannot be republished or treated as a fresh successful run', async (t) => {
  const s = await scenario(t);
  await s.publish();
  s.transport.calls = [];
  await assert.rejects(s.publish(), /already current|cannot be republished/i);
  assert.equal(s.transport.mutations().length, 0);
});

test('existing pending work is never stolen even if its recorded source is old', async (t) => {
  const s = await scenario(t);
  const previous = s.transport.state();
  s.transport.seed(
    '_releases/delivery/current.json',
    json({
      ...previous,
      status: 'pending',
      operationId: 'gh-1-1',
      kind: 'publish',
      candidate: s.candidate.release,
      context: { ...s.candidate.context, runId: '1' },
      previous,
      planKey: '_releases/delivery/operations/gh-1-1/plan.json',
      planSha256: '1'.repeat(64),
    }),
  );
  await assert.rejects(s.publish(), /completed durable baseline|pending/i);
  assert.equal(s.transport.mutations().length, 0);
  assert.equal(s.transport.state().operationId, 'gh-1-1');
});

test('a concurrent checkpoint winner causes CAS failure before assets, backend or controls change', async (t) => {
  const s = await scenario(t);
  s.transport.fault = (call, aws) => {
    if (
      call.input.Key === '_releases/delivery/current.json' &&
      JSON.parse(call.input.Body).status === 'pending'
    ) {
      aws.seed(
        call.input.Key,
        json({ ...aws.state(), operationId: 'external-writer' }),
      );
    }
  };
  await assert.rejects(s.publish(), /PreconditionFailed/);
  assert.equal(s.transport.aliasVersion, '2');
  assert.equal(s.transport.state().operationId, 'external-writer');
  assert.equal(
    s.transport.calls.some((call) => call.operation === 'create-change-set'),
    false,
  );
  assert.equal(
    s.transport.calls.some(
      (call) =>
        call.operation === 'put-object' &&
        !call.input.Key.startsWith('_releases/delivery/'),
    ),
    false,
  );
});

test('an existing immutable candidate key with foreign bytes stops with pending evidence', async (t) => {
  const s = await scenario(t);
  const item = s.candidate.manifest.objects.find((value) =>
    value.key.endsWith('/mount.js'),
  );
  s.transport.seed(item.key, 'foreign bytes', {
    ContentType: item.contentType,
    CacheControl: item.cacheControl,
  });
  await assert.rejects(
    s.publish(),
    /Immutable object already contains different bytes/,
  );
  assert.equal(s.transport.state().status, 'pending');
  assert.equal(s.transport.aliasVersion, '2');
  assert.equal(
    s.transport.objects.get(item.key).body.toString(),
    'foreign bytes',
  );
  assert.equal(
    s.transport.calls.some((call) => call.operation === 'create-change-set'),
    false,
  );
  assert.equal(
    s.transport.calls.some(
      (call) =>
        call.operation === 'put-object' &&
        ['runtime-config.json', 'index.html'].includes(call.input.Key),
    ),
    false,
  );
});

test('runtime conflict stops before index and never invokes acceptance', async (t) => {
  const s = await scenario(t);
  let checked = false;
  s.transport.fault = (call) => {
    if (call.input.Key === 'runtime-config.json')
      throw cloudError('PreconditionFailed');
  };
  await assert.rejects(
    s.publish({
      liveCheck: async () => {
        checked = true;
        return { success: true };
      },
    }),
    /PreconditionFailed/,
  );
  assert.equal(checked, false);
  assert.equal(s.transport.state().status, 'pending');
  assert.equal(s.transport.aliasVersion, '3');
  assert.equal(
    sha256(s.transport.objects.get('runtime-config.json').body),
    s.baseline.manifest.objects.find(
      (item) => item.key === 'runtime-config.json',
    ).sha256,
  );
  assert.equal(
    s.transport.calls.some(
      (call) =>
        call.operation === 'put-object' && call.input.Key === 'index.html',
    ),
    false,
  );
});

test('index conflict preserves the mixed pointer/index state and blocks an ordinary retry', async (t) => {
  const s = await scenario(t);
  s.transport.fault = (call) => {
    if (call.input.Key === 'index.html') throw cloudError('PreconditionFailed');
  };
  await assert.rejects(s.publish(), /PreconditionFailed/);
  assert.equal(s.transport.state().status, 'pending');
  assert.equal(
    sha256(s.transport.objects.get('runtime-config.json').body),
    s.candidate.manifest.objects.find(
      (item) => item.key === 'runtime-config.json',
    ).sha256,
  );
  assert.equal(
    sha256(s.transport.objects.get('index.html').body),
    s.baseline.manifest.objects.find((item) => item.key === 'index.html')
      .sha256,
  );
  s.transport.calls = [];
  s.transport.fault = undefined;
  await assert.rejects(s.publish(), /completed durable baseline|pending/i);
  assert.equal(s.transport.mutations().length, 0);
});

test('a failed runtime receipt stops before the index despite successful pointer replacement', async (t) => {
  const s = await scenario(t);
  s.transport.fault = (call) => {
    if (call.input.Key.endsWith('/control-runtime-config-json.json'))
      throw cloudError('AccessDenied');
  };
  await assert.rejects(s.publish(), /AccessDenied/);
  assert.equal(s.transport.state().status, 'pending');
  assert.equal(
    sha256(s.transport.objects.get('runtime-config.json').body),
    s.candidate.manifest.objects.find(
      (item) => item.key === 'runtime-config.json',
    ).sha256,
  );
  assert.equal(
    s.transport.calls.some(
      (call) =>
        call.operation === 'put-object' && call.input.Key === 'index.html',
    ),
    false,
  );
});

test('failed live acceptance cannot create a completed release or checkpoint', async (t) => {
  const s = await scenario(t);
  await assert.rejects(
    s.publish({ liveCheck: async () => ({ success: false }) }),
    /acceptance failed/,
  );
  assert.equal(s.transport.state().status, 'pending');
  assert.equal(
    s.transport.objects.has(
      `_releases/delivery/records/${s.candidate.release}.json`,
    ),
    false,
  );
  assert.equal(
    s.transport.calls.filter(
      (call) =>
        call.operation === 'put-object' &&
        call.input.Key === '_releases/delivery/current.json',
    ).length,
    1,
  );
});

test('failed final checkpoint remains pending and explicit reconciliation completes without replaying publication', async (t) => {
  const s = await scenario(t);
  s.transport.fault = (call) => {
    if (
      call.input.Key === '_releases/delivery/current.json' &&
      JSON.parse(call.input.Body).status === 'completed'
    )
      throw cloudError('PreconditionFailed');
  };
  await assert.rejects(s.publish(), /PreconditionFailed/);
  const pending = s.transport.state();
  assert.equal(pending.status, 'pending');
  assert.equal(
    s.transport.objects.has(
      `_releases/delivery/records/${s.candidate.release}.json`,
    ),
    true,
  );
  s.transport.fault = undefined;
  s.transport.calls = [];
  await reconcileDelivery({
    expectedPending: pending.operationId,
    target: s.target,
    context: s.candidate.context,
    transport: s.transport,
    liveCheck: async () => ({ success: true }),
  });
  assert.equal(s.transport.state().status, 'completed');
  assert.equal(s.transport.state().release, s.candidate.release);
  assert.equal(
    s.transport.calls.some((call) =>
      ['create-change-set', 'execute-change-set'].includes(call.operation),
    ),
    false,
  );
  assert.equal(
    s.transport.calls.some(
      (call) =>
        call.operation === 'put-object' &&
        ['runtime-config.json', 'index.html', 'favicon.svg'].includes(
          call.input.Key,
        ),
    ),
    false,
  );
});

test('a retained bootstrap-origin Lambda version is ineligible before recovery mutations', async (t) => {
  const s = await scenario(t);
  await s.publish();
  s.transport.calls = [];
  const retainedKey = `_releases/delivery/records/${s.baseline.release}.json`;
  const ineligible = JSON.parse(s.transport.objects.get(retainedKey).body);
  ineligible.backend.version = '1';
  s.transport.seed(retainedKey, json(ineligible));
  s.transport.requestFault = (call) => {
    if (
      call.service === 'lambda' &&
      call.operation === 'get-function-configuration' &&
      call.input.Qualifier === '1'
    )
      return {
        ...s.transport.configuration('2'),
        Version: '1',
        Environment: {
          Variables: { ALLOWED_ORIGINS: 'https://bootstrap.invalid' },
        },
      };
  };
  await assert.rejects(
    recoverDelivery({
      release: s.baseline.release,
      expectedPending: 'none',
      target: s.target,
      context: { ...s.candidate.context, runAttempt: '2' },
      transport: s.transport,
      liveCheck: async () => ({ success: true }),
    }),
    /not compatible|incompatible/,
  );
  assert.equal(s.transport.mutations().length, 0);
  assert.equal(s.transport.aliasVersion, '3');
  assert.equal(s.transport.state().release, s.candidate.release);
});

test('full recovery restores compatible retained graphs and records fresh control ETags', async (t) => {
  const s = await scenario(t);
  const originalRecord = Buffer.from(
    s.transport.objects.get(
      `_releases/delivery/records/${s.baseline.release}.json`,
    ).body,
  );
  await s.publish();
  s.transport.calls = [];
  let checked = false;
  await recoverDelivery({
    release: s.baseline.release,
    expectedPending: 'none',
    target: s.target,
    context: { ...s.candidate.context, runAttempt: '2' },
    transport: s.transport,
    liveCheck: async () => {
      checked = true;
      assert.equal(s.transport.aliasVersion, '2');
      assert.equal(s.transport.state().status, 'pending');
      for (const key of ['runtime-config.json', 'index.html'])
        assert.equal(
          sha256(s.transport.objects.get(key).body),
          s.baseline.manifest.objects.find((item) => item.key === key).sha256,
        );
      return { success: true };
    },
  });
  assert(checked);
  assert.equal(s.transport.state().status, 'completed');
  assert.equal(s.transport.state().release, s.baseline.release);
  assert.deepEqual(
    s.transport.objects.get(
      `_releases/delivery/records/${s.baseline.release}.json`,
    ).body,
    originalRecord,
    'Recovery must preserve immutable original acceptance.',
  );
  const next = await fixture(t, 'next');
  s.transport.releases.set(next.release, next.manifest);
  await publishDelivery({
    bundle: next.directory,
    target: s.target,
    context: next.context,
    envelopeSha256: next.envelopeSha256,
    transport: s.transport,
    liveCheck: async () => ({ success: true }),
  });
  assert.equal(
    s.transport.state().release,
    next.release,
    'A clean later runner must accept recovered checkpoint ETags.',
  );
});

test('explicit recovery repairs a known mixed state while ordinary retries remain blocked', async (t) => {
  const s = await scenario(t);
  s.transport.fault = (call) => {
    if (call.input.Key === 'index.html') throw cloudError('PreconditionFailed');
  };
  await assert.rejects(s.publish(), /PreconditionFailed/);
  const pending = s.transport.state();
  s.transport.fault = undefined;
  s.transport.calls = [];
  await assert.rejects(
    recoverDelivery({
      release: s.baseline.release,
      expectedPending: 'gh-wrong-1',
      target: s.target,
      context: { ...s.candidate.context, runAttempt: '2' },
      transport: s.transport,
      liveCheck: async () => ({ success: true }),
    }),
    /Exact pending/,
  );
  assert.equal(s.transport.mutations().length, 0);
  await recoverDelivery({
    release: s.baseline.release,
    expectedPending: pending.operationId,
    target: s.target,
    context: { ...s.candidate.context, runAttempt: '2' },
    transport: s.transport,
    liveCheck: async () => ({ success: true }),
  });
  assert.equal(s.transport.state().status, 'completed');
  assert.equal(s.transport.state().release, s.baseline.release);
  assert.equal(s.transport.aliasVersion, '2');
  assert.equal(
    sha256(s.transport.objects.get('index.html').body),
    s.baseline.manifest.objects.find((item) => item.key === 'index.html')
      .sha256,
  );
});

test('a crashed recovery preserves the original mixed-state proof for the next explicit recovery', async (t) => {
  const s = await scenario(t);
  s.transport.fault = (call) => {
    if (call.input.Key === 'index.html') throw cloudError('PreconditionFailed');
  };
  await assert.rejects(s.publish(), /PreconditionFailed/);
  const publicationPending = s.transport.state();
  s.transport.fault = (call) => {
    if (call.input.Key === 'runtime-config.json')
      throw cloudError('AccessDenied');
  };
  await assert.rejects(
    recoverDelivery({
      release: s.baseline.release,
      expectedPending: publicationPending.operationId,
      target: s.target,
      context: { ...s.candidate.context, runAttempt: '2' },
      transport: s.transport,
      liveCheck: async () => ({ success: true }),
    }),
    /AccessDenied/,
  );
  const recoveryPending = s.transport.state();
  assert.equal(recoveryPending.status, 'pending');
  assert.equal(recoveryPending.kind, 'recover');
  assert.equal(s.transport.aliasVersion, '2');
  assert.equal(
    sha256(s.transport.objects.get('runtime-config.json').body),
    s.candidate.manifest.objects.find(
      (item) => item.key === 'runtime-config.json',
    ).sha256,
  );
  s.transport.fault = undefined;
  s.transport.calls = [];
  const knownRuntime = Buffer.from(
    s.transport.objects.get('runtime-config.json').body,
  );
  s.transport.seed('runtime-config.json', 'unknown intervening writer');
  const retry = () =>
    recoverDelivery({
      release: s.baseline.release,
      expectedPending: recoveryPending.operationId,
      target: s.target,
      context: { ...s.candidate.context, runAttempt: '3' },
      transport: s.transport,
      liveCheck: async () => ({ success: true }),
    });
  await assert.rejects(
    retry(),
    /Unknown mixed control|recovery stopped|state differs/i,
  );
  assert.equal(
    s.transport.mutations().length,
    0,
    'Foreign bytes cannot be legitimized by a recovery request.',
  );
  s.transport.seed('runtime-config.json', knownRuntime);
  await retry();
  assert.equal(s.transport.state().status, 'completed');
  assert.equal(s.transport.state().release, s.baseline.release);
  assert.equal(s.transport.aliasVersion, '2');
});

test('an interrupted first import resumes only the exact immutable original import plan', async (t) => {
  const baseline = await fixture(t, 'baseline');
  const target = targetFixture();
  const transport = new FakeAws(target, baseline);
  for (const item of baseline.manifest.objects)
    transport.seed(
      item.key,
      await readFile(path.join(baseline.directory, item.file)),
      { ContentType: item.contentType, CacheControl: item.cacheControl },
    );
  transport.fault = (call) => {
    if (
      call.input.Key.includes('/files/') &&
      call.input.Key.endsWith('/lambda/package.json')
    )
      throw cloudError('AccessDenied');
  };
  const originalImport = (extra) =>
    importBaseline({
      directory: baseline.directory,
      target,
      expectedAliasVersion: '2',
      transport,
      liveCheck: async () => ({ success: true }),
      ...extra,
    });
  await assert.rejects(originalImport(), /AccessDenied/);
  const pending = transport.state();
  assert.equal(pending.kind, 'import');
  assert.equal(pending.status, 'pending');
  assert.equal(pending.previous, null);
  const originalPlan = Buffer.from(transport.objects.get(pending.planKey).body);
  transport.fault = undefined;
  transport.calls = [];
  await assert.rejects(originalImport(), /exact pending import identity/);
  await assert.rejects(
    originalImport({ expectedPending: 'import-foreign' }),
    /exact pending import identity/,
  );
  assert.equal(transport.mutations().length, 0);
  await originalImport({ expectedPending: pending.operationId });
  assert.equal(transport.state().status, 'completed');
  assert.equal(transport.state().release, baseline.release);
  assert.deepEqual(transport.objects.get(pending.planKey).body, originalPlan);
  assert.equal(transport.aliasVersion, '2');
  assert.equal(
    transport.calls.some((call) =>
      ['create-change-set', 'execute-change-set'].includes(call.operation),
    ),
    false,
  );
});

test('a new explicit reconciliation attempt survives an earlier reconciliation checkpoint failure', async (t) => {
  const s = await scenario(t);
  s.transport.fault = (call) => {
    if (
      call.input.Key === '_releases/delivery/current.json' &&
      JSON.parse(call.input.Body).status === 'completed'
    )
      throw cloudError('PreconditionFailed');
  };
  await assert.rejects(s.publish(), /PreconditionFailed/);
  const pending = s.transport.state();
  const reconcile = (attempt) =>
    reconcileDelivery({
      expectedPending: pending.operationId,
      target: s.target,
      context: { ...s.candidate.context, runAttempt: attempt },
      transport: s.transport,
      liveCheck: async () => ({ success: true }),
    });
  await assert.rejects(reconcile('2'), /PreconditionFailed/);
  assert.equal(s.transport.state().status, 'pending');
  s.transport.fault = undefined;
  s.transport.calls = [];
  await reconcile('3');
  assert.equal(s.transport.state().status, 'completed');
  assert.equal(s.transport.state().release, s.candidate.release);
  assert.equal(
    s.transport.calls.some((call) =>
      ['create-change-set', 'execute-change-set'].includes(call.operation),
    ),
    false,
  );
  assert.equal(
    s.transport.calls.some(
      (call) =>
        call.operation === 'put-object' &&
        ['runtime-config.json', 'index.html', 'favicon.svg'].includes(
          call.input.Key,
        ),
    ),
    false,
  );
});

test('preflight binds runtime variant and explicitly limited role bootstrap', async (t) => {
  const s = await scenario(t);
  const original = s.transport.request.bind(s.transport);
  let variant = 'fixture';
  let role = 'unassigned';
  let alteredTemplate = false;

  s.transport.request = async (service, operation, input = {}) => {
    const response = await original(service, operation, input);
    if (
      service === 'cloudformation' &&
      input.StackName === s.target.stacks.backend
    ) {
      if (operation === 'describe-stacks') {
        if (role === 'unassigned') {
          delete response.Stacks[0].RoleARN;
        } else {
          response.Stacks[0].RoleARN =
            s.target.serviceRoleArn + (role === 'foreign' ? '-other' : '');
        }
      }
      if (operation === 'get-template') {
        response.TemplateBody =
          variant === 'neon' ? neonBackendTemplate() : backendTemplate();
        if (alteredTemplate)
          response.TemplateBody.Resources.Function.Properties.Timeout = 900;
      }
    }
    return response;
  };

  const input = { target: s.target, transport: s.transport };

  await assert.rejects(
    preflight(input),
    /reviewed CloudFormation service role/,
  );

  const bootstrap = await preflight({
    ...input,
    allowNeonTransition: true,
  });
  assert.equal(bootstrap.backendVariant, 'fixture');
  assert.equal(bootstrap.stacks.backend.RoleARN, undefined);

  variant = 'neon';
  await assert.rejects(
    preflight({ ...input, allowNeonTransition: true }),
    /reviewed CloudFormation service role/,
  );

  role = 'assigned';
  const established = await preflight(input);
  assert.equal(established.backendVariant, 'neon');
  assert.equal(established.stacks.backend.RoleARN, s.target.serviceRoleArn);

  role = 'foreign';
  await assert.rejects(
    preflight({ ...input, allowNeonTransition: true }),
    /reviewed CloudFormation service role/,
  );

  role = 'assigned';
  alteredTemplate = true;
  await assert.rejects(preflight(input), /Stack template drift/);

  alteredTemplate = false;
  await assert.rejects(s.publish(), /Fixture publisher/);
  assert.equal(s.transport.mutations().length, 0);
});

test('initial baseline registration explicitly permits an unassigned fixture role', async (t) => {
  const baseline = await fixture(t, 'bootstrap-baseline');
  const target = targetFixture();
  const transport = new FakeAws(target, baseline);

  for (const item of baseline.manifest.objects)
    transport.seed(
      item.key,
      await readFile(path.join(baseline.directory, item.file)),
      { ContentType: item.contentType, CacheControl: item.cacheControl },
    );

  const original = transport.request.bind(transport);
  transport.request = async (service, operation, input = {}) => {
    const response = await original(service, operation, input);
    if (
      service === 'cloudformation' &&
      operation === 'describe-stacks' &&
      input.StackName === target.stacks.backend
    )
      delete response.Stacks[0].RoleARN;
    return response;
  };

  const input = {
    directory: baseline.directory,
    target,
    expectedAliasVersion: '2',
    transport,
    liveCheck: async () => ({ success: true, fixture: 'baseline' }),
  };

  await assert.rejects(
    importBaseline(input),
    /reviewed CloudFormation service role/,
  );
  assert.equal(transport.mutations().length, 0);

  const baselineRevision = transport.parameters.BackendRevision;
  for (const description of [
    'Platypus revision ' + baselineRevision,
    'Revision ' + '0'.repeat(64),
  ]) {
    transport.requestFault = (call, aws) => {
      if (
        call.service === 'lambda' &&
        call.operation === 'get-function-configuration'
      )
        return { ...aws.configuration('2'), Description: description };
    };
    await assert.rejects(
      importBaseline({ ...input, allowNeonTransition: true }),
      /Backend code\/configuration\/origin is incompatible/,
    );
    assert.equal(transport.mutations().length, 0);
  }
  transport.requestFault = undefined;

  transport.fault = (call) => {
    if (
      call.input.Key === '_releases/delivery/current.json' &&
      JSON.parse(call.input.Body).status === 'completed'
    )
      throw cloudError('PreconditionFailed');
  };
  await assert.rejects(
    importBaseline({ ...input, allowNeonTransition: true }),
    /PreconditionFailed/,
  );
  const pending = transport.state();
  assert.equal(pending.status, 'pending');
  transport.fault = undefined;
  transport.calls = [];
  const reconciliation = {
    expectedPending: pending.operationId,
    target,
    context: baseline.context,
    transport,
    liveCheck: input.liveCheck,
  };
  await assert.rejects(
    reconcileDelivery(reconciliation),
    /reviewed CloudFormation service role/,
  );
  assert.equal(transport.mutations().length, 0);
  await assert.rejects(
    reconcileDelivery({ ...reconciliation, allowNeonTransition: 'true' }),
    /Explicit Neon transition/,
  );
  await reconcileDelivery({ ...reconciliation, allowNeonTransition: true });
  assert.equal(transport.state().status, 'completed');

  const record = JSON.parse(
    transport.objects
      .get('_releases/delivery/records/' + baseline.release + '.json')
      .body.toString('utf8'),
  );
  assert.equal(record.preflight.backendVariant, 'fixture');
  assert.equal(record.preflight.serviceRoleArn, null);
  assert.equal(
    transport.calls.some((call) =>
      ['create-change-set', 'execute-change-set'].includes(call.operation),
    ),
    false,
  );
});

test('complete Neon transition, routine publication, reconciliation and retained recovery', async (t) => {
  const s = await scenario(t);
  const first = await syntheticNeonRelease(t, s.target, String(nextRun++));
  const second = await syntheticNeonRelease(t, s.target, String(nextRun++), 2);
  for (const candidate of [first, second]) {
    s.transport.releases.set(candidate.release, candidate.manifest);
    s.transport.runtimes.set(candidate.release, candidate.runtimeConfig);
  }
  s.transport.backendRoleArn = undefined;
  const liveCheck = async ({ runtimeVariant, origin }) => {
    assert.equal(s.transport.state().status, 'pending');
    return runtimeVariant === 'neon'
      ? { success: true, kind: 'platypus-neon-live-check', origin }
      : { success: true };
  };
  const publish = (candidate, extra = {}) =>
    publishNeonDelivery({
      root: candidate.root,
      release: candidate.release,
      runtimeConfig: candidate.runtimeConfig,
      manifestSha256: candidate.manifestSha256,
      target: s.target,
      context: candidate.context,
      transport: s.transport,
      liveCheck,
      ...extra,
    });
  await assert.rejects(publish(first), /reviewed CloudFormation service role/);
  assert.equal(s.transport.mutations().length, 0);
  await publish(first, { allowNeonTransition: true });
  assert.equal(s.transport.backendRoleArn, s.target.serviceRoleArn);
  assert.equal(s.transport.aliasVersion, '3');
  assert.equal(s.transport.state().release, first.release);
  assert.equal(s.transport.parameters.NeonPasswordParameterVersion, '1');
  assert.deepEqual(s.transport.backendTemplate, neonBackendTemplate());
  const archive = s.transport.objects.get(first.manifest.backend.key);
  assert.equal(
    Buffer.from(sha256(archive.body), 'hex').toString('base64'),
    first.manifest.backend.codeSha256,
  );
  assert.equal(archive.ContentType, 'application/zip');
  const firstRecordKey = `_releases/delivery/records/${first.release}.json`;
  const firstRecord = Buffer.from(s.transport.objects.get(firstRecordKey).body);
  assert.equal(
    JSON.parse(firstRecord).context.sourceSha,
    first.context.sourceSha,
  );

  s.transport.fault = (call) => {
    if (
      call.input.Key === '_releases/delivery/current.json' &&
      JSON.parse(call.input.Body).status === 'completed'
    )
      throw cloudError('PreconditionFailed');
  };
  await assert.rejects(publish(second), /PreconditionFailed/);
  const pending = s.transport.state();
  assert.equal(pending.status, 'pending');
  assert.equal(s.transport.aliasVersion, '4');
  assert.equal(s.transport.parameters.NeonPasswordParameterVersion, '2');
  assert.equal(s.transport.changes.UsePreviousTemplate, true);
  s.transport.fault = undefined;
  const reconciliation = {
    expectedPending: pending.operationId,
    target: s.target,
    context: { ...second.context, runAttempt: '2' },
    transport: s.transport,
  };
  s.transport.calls = [];
  await assert.rejects(
    reconcileDelivery({
      ...reconciliation,
      liveCheck: async () => ({ success: true }),
    }),
    /mixed|acceptance/,
  );
  assert.equal(s.transport.state().status, 'pending');
  assert.equal(s.transport.mutations().length, 0);
  await reconcileDelivery({ ...reconciliation, liveCheck });
  assert.equal(s.transport.state().release, second.release);
  assert.equal(
    s.transport.calls.some((call) =>
      ['create-change-set', 'execute-change-set'].includes(call.operation),
    ),
    false,
  );

  await recoverDelivery({
    release: first.release,
    expectedPending: 'none',
    target: s.target,
    context: { ...second.context, runAttempt: '3' },
    transport: s.transport,
    liveCheck,
  });
  assert.equal(s.transport.state().release, first.release);
  assert.equal(s.transport.aliasVersion, '3');
  assert.equal(s.transport.parameters.RollbackVersion, '3');
  assert.deepEqual(s.transport.objects.get(firstRecordKey).body, firstRecord);
  await recoverDelivery({
    release: s.baseline.release,
    expectedPending: 'none',
    target: s.target,
    context: { ...second.context, runAttempt: '4' },
    transport: s.transport,
    liveCheck,
  });
  assert.equal(s.transport.state().release, s.baseline.release);
  assert.equal(s.transport.aliasVersion, '2');
  assert.equal(s.transport.parameters.NeonPasswordParameterVersion, '2');
  assert.deepEqual(s.transport.backendTemplate, neonBackendTemplate());
});

test('failed Neon live acceptance stays pending and explicitly restores the fixture baseline', async (t) => {
  const s = await scenario(t);
  const candidate = await syntheticNeonRelease(t, s.target, String(nextRun++));
  s.transport.releases.set(candidate.release, candidate.manifest);
  s.transport.runtimes.set(candidate.release, candidate.runtimeConfig);
  await assert.rejects(
    publishNeonDelivery({
      root: candidate.root,
      release: candidate.release,
      runtimeConfig: candidate.runtimeConfig,
      manifestSha256: candidate.manifestSha256,
      target: s.target,
      context: candidate.context,
      transport: s.transport,
      allowNeonTransition: true,
      liveCheck: async () => ({ success: true }),
    }),
    /Neon-specific/,
  );
  const pending = s.transport.state();
  assert.equal(pending.status, 'pending');
  assert.equal(
    s.transport.objects.has(
      `_releases/delivery/records/${candidate.release}.json`,
    ),
    false,
  );
  await recoverDelivery({
    release: s.baseline.release,
    expectedPending: pending.operationId,
    target: s.target,
    context: { ...candidate.context, runAttempt: '2' },
    transport: s.transport,
    liveCheck: async ({ runtimeVariant }) => {
      assert.equal(runtimeVariant, 'fixture');
      return { success: true };
    },
  });
  assert.equal(s.transport.state().status, 'completed');
  assert.equal(s.transport.state().release, s.baseline.release);
  assert.equal(s.transport.aliasVersion, '2');
});

test('reconciliation cannot add bootstrap authorization to an existing ordinary plan', async (t) => {
  const s = await scenario(t);
  s.transport.fault = (call) => {
    if (call.input.Key === 'index.html') throw cloudError('PreconditionFailed');
  };
  await assert.rejects(s.publish(), /PreconditionFailed/);
  const pending = s.transport.state();
  s.transport.fault = undefined;
  s.transport.backendRoleArn = undefined;
  s.transport.calls = [];
  await assert.rejects(
    reconcileDelivery({
      expectedPending: pending.operationId,
      target: s.target,
      context: s.candidate.context,
      transport: s.transport,
      allowNeonTransition: true,
      liveCheck: async () => ({ success: true }),
    }),
    /explicitly reviewed bootstrap plan/,
  );
  assert.equal(s.transport.mutations().length, 0);
});

test('completed backend rollback reconciles the previous baseline without replaying deployment', async (t) => {
  const s = await scenario(t);
  s.transport.requestFault = (call, aws) => {
    if (call.operation === 'execute-change-set') {
      aws.backendStatus = 'UPDATE_ROLLBACK_COMPLETE';
      return {};
    }
  };
  await assert.rejects(s.publish(), /Backend update failed/);
  const pending = s.transport.state();
  assert.equal(pending.status, 'pending');
  assert.equal(s.transport.aliasVersion, '2');
  s.transport.requestFault = undefined;
  s.transport.calls = [];
  await reconcileDelivery({
    expectedPending: pending.operationId,
    target: s.target,
    context: s.candidate.context,
    transport: s.transport,
    liveCheck: async () => ({ success: true }),
  });
  assert.equal(s.transport.state().status, 'completed');
  assert.equal(s.transport.state().release, s.baseline.release);
  assert.equal(
    s.transport.calls.some((c) =>
      ['create-change-set', 'execute-change-set'].includes(c.operation),
    ),
    false,
  );
  assert.equal(
    s.transport.calls.some(
      (c) =>
        c.operation === 'put-object' &&
        ['index.html', 'runtime-config.json', 'favicon.svg'].includes(
          c.input.Key,
        ),
    ),
    false,
  );
  for (const status of [
    'ROLLBACK_COMPLETE',
    'UPDATE_ROLLBACK_FAILED',
    'UPDATE_ROLLBACK_IN_PROGRESS',
    'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS',
  ]) {
    s.transport.backendStatus = status;
    await assert.rejects(
      preflight({ target: s.target, transport: s.transport }),
      /Owned stable stack required/,
    );
  }
});
