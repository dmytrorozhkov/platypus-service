import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { json, projectRoot } from './common.mjs';

const ref = (name) => ({ Ref: name });
const sub = (value) => ({ 'Fn::Sub': value });
const get = (name, attribute) => ({ 'Fn::GetAtt': [name, attribute] });
const iff = (condition, yes, no) => ({ 'Fn::If': [condition, yes, no] });
const equals = (left, right) => ({ 'Fn::Equals': [left, right] });
const parameter = (description, extra = {}) => ({
  Type: 'String',
  Description: description,
  ...extra,
});
const context = (why, must) => ({
  'com.aws.cloudformation.Context': { why, must },
});
const resource = (Type, Properties, why, must = [], extra = {}) => ({
  Type,
  Metadata: context(why, must),
  Properties,
  ...extra,
});
const output = (Description, Value) => ({ Description, Value });
const tags = [
  { Key: 'Project', Value: 'platypus-service' },
  { Key: 'ManagedBy', Value: 'cloudformation' },
];
const header = (Description) => ({
  AWSTemplateFormatVersion: '2010-09-09',
  Description,
  Metadata: {
    AWSToolsMetrics: { AWSAgentToolkit: 'aws-cloudformation@3' },
    'com.aws.cloudformation.Context': {
      ref: [
        {
          at: 'infrastructure/README.md',
          has: 'Bootstrap, ownership, release and deletion constraints',
          scope: 'shared',
        },
      ],
    },
  },
});

export function storageTemplate() {
  return {
    ...header(
      'Private fictional application artifacts with explicit retained-bucket ownership and distribution-scoped access.',
    ),
    Parameters: {
      DistributionId: parameter(
        'Set only after the edge stack exists; empty keeps the bucket private.',
        { Default: '', AllowedPattern: '^$|^[A-Z0-9]{8,32}$' },
      ),
    },
    Conditions: {
      HasDistribution: { 'Fn::Not': [equals(ref('DistributionId'), '')] },
    },
    Resources: {
      Artifacts: resource(
        'AWS::S3::Bucket',
        {
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            BlockPublicPolicy: true,
            IgnorePublicAcls: true,
            RestrictPublicBuckets: true,
          },
          OwnershipControls: {
            Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }],
          },
          BucketEncryption: {
            ServerSideEncryptionConfiguration: [
              { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
            ],
          },
          Tags: tags,
        },
        'Immutable release keys replace object versioning for public fictional build output. Retain prevents implicit data deletion.',
        [
          'No website endpoint or public access.',
          'No versioning: releases retain prior complete graphs under distinct keys.',
          'Retained bucket must be inventoried, emptied and explicitly removed after reviewed teardown.',
        ],
        { DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain' },
      ),
      ArtifactsPolicy: resource(
        'AWS::S3::BucketPolicy',
        {
          Bucket: ref('Artifacts'),
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'DenyInsecureTransport',
                Effect: 'Deny',
                Principal: '*',
                Action: 's3:*',
                Resource: [get('Artifacts', 'Arn'), sub('${Artifacts.Arn}/*')],
                Condition: { Bool: { 'aws:SecureTransport': 'false' } },
              },
              iff(
                'HasDistribution',
                {
                  Sid: 'AllowOnlyFrontendFromThisDistribution',
                  Effect: 'Allow',
                  Principal: { Service: 'cloudfront.amazonaws.com' },
                  Action: 's3:GetObject',
                  Resource: [
                    'index.html',
                    'runtime-config.json',
                    'favicon.svg',
                    'main-*.js',
                    'styles-*.css',
                    'chunk-*.js',
                    'mfe/*',
                  ].map((key) => sub('${Artifacts.Arn}/' + key)),
                  Condition: {
                    StringEquals: {
                      'AWS:SourceAccount': ref('AWS::AccountId'),
                      'AWS:SourceArn': sub(
                        'arn:${AWS::Partition}:cloudfront::${AWS::AccountId}:distribution/${DistributionId}',
                      ),
                    },
                  },
                },
                ref('AWS::NoValue'),
              ),
            ],
          },
        },
        'One stack owns the entire bucket policy. Adding the distribution later breaks bootstrap dependency cycles.',
        [
          'Never grant CloudFront read access to _deploy or _releases.',
          'Keep HTTPS denial and both distribution/account conditions.',
        ],
      ),
    },
    Outputs: {
      BucketName: output(
        'Owned artifact bucket; retained on stack deletion.',
        ref('Artifacts'),
      ),
      BucketRegionalDomainName: output(
        'S3 REST origin, never its website endpoint.',
        get('Artifacts', 'RegionalDomainName'),
      ),
    },
  };
}

export function backendTemplate() {
  return {
    ...header(
      'Read-only Node event handler with explicit concurrency choice, immutable published revisions and stack-managed alias rollback.',
    ),
    Parameters: {
      PackageBucket: parameter('Artifact bucket from the storage stack.', {
        AllowedPattern: '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$',
      }),
      PackageKey: parameter('Immutable reviewed backend ZIP key.', {
        AllowedPattern: '^_deploy/backend/[a-z0-9-]{1,48}\\.zip$',
      }),
      PackageSha256: parameter('Base64 SHA-256 of the actual ZIP.', {
        AllowedPattern: '^[A-Za-z0-9+/]{43}=$',
      }),
      AllowedOrigin: parameter(
        'Exact distribution HTTPS origin; bootstrap.invalid denies browser access before edge setup.',
        {
          AllowedPattern: '^https://[a-z0-9.-]+$',
          Default: 'https://bootstrap.invalid',
        },
      ),
      BackendRevision: parameter(
        'SHA-256 of ZIP plus exact allowed origin; forces code/configuration version publication.',
        { AllowedPattern: '^[a-f0-9]{64}$' },
      ),
      ConcurrencyMode: parameter(
        'No default. reserved-two needs available quota; shared account-cap-five or account-cap-ten needs explicit acceptance and fresh matching quota evidence.',
        {
          AllowedValues: [
            'reserved-two',
            'account-cap-five',
            'account-cap-ten',
          ],
        },
      ),
      RollbackVersion: parameter(
        'Existing version of this same function for alias-only rollback; empty selects this revision.',
        { Default: '', AllowedPattern: '^$|^[1-9][0-9]*$' },
      ),
    },
    Conditions: {
      UseReservedTwo: equals(ref('ConcurrencyMode'), 'reserved-two'),
      UseRollback: { 'Fn::Not': [equals(ref('RollbackVersion'), '')] },
    },
    Resources: {
      Logs: resource(
        'AWS::Logs::LogGroup',
        { RetentionInDays: 7, Tags: tags },
        'Own the log group before invocation so the execution role needs no CreateLogGroup permission.',
        [
          'Seven-day retention; no ticket bodies or credentials in logs.',
          'Delete this temporary diagnostic group during explicit teardown; no application records belong here.',
        ],
        { DeletionPolicy: 'Delete', UpdateReplacePolicy: 'Delete' },
      ),
      ExecutionRole: resource(
        'AWS::IAM::Role',
        {
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { Service: 'lambda.amazonaws.com' },
                Action: 'sts:AssumeRole',
              },
            ],
          },
          Policies: [
            {
              PolicyName: 'WriteOnlyOwnLogs',
              PolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                    Resource: get('Logs', 'Arn'),
                  },
                ],
              },
            },
          ],
          Tags: tags,
        },
        'Runtime imports bundled fictional fixtures and only needs platform log writes. No AWS SDK application calls or broad managed role.',
        [
          'Scope log actions to this log group.',
          'Lambda service trust follows the documented execution-role policy; do not invent unsupported trust context keys.',
        ],
      ),
      Function: resource(
        'AWS::Lambda::Function',
        {
          Runtime: 'nodejs24.x',
          Architectures: ['arm64'],
          Handler: 'lambda.handler',
          MemorySize: 256,
          Timeout: 3,
          EphemeralStorage: { Size: 512 },
          Role: get('ExecutionRole', 'Arn'),
          Code: { S3Bucket: ref('PackageBucket'), S3Key: ref('PackageKey') },
          Description: sub('Platypus revision ${BackendRevision}'),
          Environment: { Variables: { ALLOWED_ORIGINS: ref('AllowedOrigin') } },
          LoggingConfig: { LogGroup: ref('Logs') },
          ReservedConcurrentExecutions: iff(
            'UseReservedTwo',
            2,
            ref('AWS::NoValue'),
          ),
          Tags: tags,
        },
        'Classic Event Function has no HTTP listener, VPC, provisioned capacity or database. Configuration fingerprint changes even for configuration-only releases.',
        [
          'Reserved two needs two available executions above the unreserved buffer of 100.',
          'Shared account caps five or ten require fresh matching quota evidence and explicit acceptance; never use them as automatic fallbacks.',
          'Do not remove the required concurrency-mode decision.',
        ],
      ),
      Version: resource(
        'AWS::Lambda::Version',
        {
          FunctionName: ref('Function'),
          CodeSha256: ref('PackageSha256'),
          Description: sub('Revision ${BackendRevision}'),
        },
        'Replacement snapshots the updated code and exact origin. Retain previous versions for deliberate rollback; deleting the function eventually removes versions.',
        [
          'Change BackendRevision whenever code or origin changes.',
          'Version depends on completed function configuration update.',
        ],
        { DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain' },
      ),
      LiveAlias: resource(
        'AWS::Lambda::Alias',
        {
          Name: 'live',
          FunctionName: ref('Function'),
          FunctionVersion: iff(
            'UseRollback',
            ref('RollbackVersion'),
            get('Version', 'Version'),
          ),
        },
        'A stable alias keeps the URL unchanged and supports rollback through stack parameters without out-of-band alias drift.',
        [
          'RollbackVersion must be verified as a retained version of this function.',
        ],
      ),
      FunctionUrl: resource(
        'AWS::Lambda::Url',
        {
          AuthType: 'AWS_IAM',
          InvokeMode: 'BUFFERED',
          TargetFunctionArn: ref('Function'),
          Qualifier: 'live',
        },
        'Only signed origin requests reach the read-only API; edge stack owns distribution-scoped invoke grants.',
        [
          'No NONE auth or duplicate CORS settings.',
          'URL qualifier is the stable alias name.',
        ],
        { DependsOn: 'LiveAlias' },
      ),
    },
    Outputs: {
      FunctionArn: output(
        'Unqualified owned function ARN.',
        get('Function', 'Arn'),
      ),
      FunctionName: output(
        'Owned function name for checks and teardown.',
        ref('Function'),
      ),
      AliasArn: output(
        'Live alias ARN for distribution permissions.',
        ref('LiveAlias'),
      ),
      Version: output(
        'Published revision version, even when live alias is rolled back.',
        get('Version', 'Version'),
      ),
      FunctionUrl: output(
        'Signed API origin URL.',
        get('FunctionUrl', 'FunctionUrl'),
      ),
      LogGroup: output('Owned seven-day log group.', ref('Logs')),
    },
  };
}

export const rewriteCode = `function handler(event) {\n  var request = event.request;\n  if (request.uri === '/' || request.uri === '/analytics' || request.uri === '/administration' || request.uri === '/support/tickets') request.uri = '/index.html';\n  if (request.uri.indexOf('/_deploy/') === 0 || request.uri.indexOf('/_releases/') === 0) return { statusCode: 404, statusDescription: 'Not Found', headers: { 'content-type': { value: 'text/plain; charset=utf-8' }, 'cache-control': { value: 'no-store' } }, body: 'Not found' };\n  return request;\n}`;

export function edgeTemplate() {
  const zero = ref('NoCache');
  const headers = ref('SecurityHeaders');
  const staticBehavior = (cache = ref('StaticCache')) => ({
    TargetOriginId: 'static',
    ViewerProtocolPolicy: 'redirect-to-https',
    AllowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    CachedMethods: ['GET', 'HEAD'],
    Compress: true,
    CachePolicyId: cache,
    ResponseHeadersPolicyId: headers,
    FunctionAssociations: [
      {
        EventType: 'viewer-request',
        FunctionARN: get('PageRoutes', 'FunctionARN'),
      },
    ],
  });
  const cache = (name, ttl) =>
    resource(
      'AWS::CloudFront::CachePolicy',
      {
        CachePolicyConfig: {
          Name: sub('${AWS::StackName}-' + name),
          MinTTL: 0,
          DefaultTTL: ttl,
          MaxTTL: ttl,
          ParametersInCacheKeyAndForwardedToOrigin: {
            EnableAcceptEncodingGzip: ttl > 0,
            EnableAcceptEncodingBrotli: ttl > 0,
            CookiesConfig: { CookieBehavior: 'none' },
            HeadersConfig: { HeaderBehavior: 'none' },
            QueryStringsConfig: { QueryStringBehavior: 'none' },
          },
        },
      },
      ttl
        ? 'Immutable file caching respects explicit no-store because the minimum is zero.'
        : 'All mutable control documents and API responses bypass edge caching.',
      [
        'Minimum TTL remains zero.',
        ...(ttl ? [] : ['Default and maximum TTL stay zero.']),
      ],
    );
  return {
    ...header(
      'One pay-as-you-go HTTPS distribution serves private static releases and a signed read-only Lambda origin; starts disabled.',
    ),
    Parameters: {
      BucketDomain: parameter('Storage stack regional REST domain.', {
        AllowedPattern: '^[a-z0-9.-]+\\.s3\\.eu-north-1\\.amazonaws\\.com$',
      }),
      AliasArn: parameter(
        'Backend live alias ARN in the same account/Region.',
        {
          AllowedPattern:
            '^arn:aws:lambda:eu-north-1:[0-9]{12}:function:[A-Za-z0-9_-]+:live$',
        },
      ),
      ApiUrl: parameter(
        'Backend FunctionUrl output including its trailing slash.',
        {
          AllowedPattern:
            '^https://[a-z0-9]+\\.lambda-url\\.eu-north-1\\.on\\.aws/$',
        },
      ),
      Enabled: parameter(
        'Enable only after origin, artifact, quota and policy checks are accepted.',
        { Default: 'false', AllowedValues: ['true', 'false'] },
      ),
    },
    Conditions: { IsEnabled: equals(ref('Enabled'), 'true') },
    Resources: {
      StaticOac: resource(
        'AWS::CloudFront::OriginAccessControl',
        {
          OriginAccessControlConfig: {
            Name: sub('${AWS::StackName}-static'),
            OriginAccessControlOriginType: 's3',
            SigningBehavior: 'always',
            SigningProtocol: 'sigv4',
          },
        },
        'Signed REST access keeps S3 private.',
        ['Use the S3 REST origin and distribution-scoped bucket policy.'],
      ),
      ApiOac: resource(
        'AWS::CloudFront::OriginAccessControl',
        {
          OriginAccessControlConfig: {
            Name: sub('${AWS::StackName}-api'),
            OriginAccessControlOriginType: 'lambda',
            SigningBehavior: 'always',
            SigningProtocol: 'sigv4',
          },
        },
        'Sign API origin requests without making the Function URL public.',
        ['Keep URL AWS_IAM and both invoke permissions.'],
      ),
      NoCache: cache('no-cache', 0),
      StaticCache: cache('static', 31536000),
      ApiOriginPolicy: resource(
        'AWS::CloudFront::OriginRequestPolicy',
        {
          OriginRequestPolicyConfig: {
            Name: sub('${AWS::StackName}-api-origin'),
            CookiesConfig: { CookieBehavior: 'none' },
            HeadersConfig: { HeaderBehavior: 'whitelist', Headers: ['Origin'] },
            QueryStringsConfig: { QueryStringBehavior: 'all' },
          },
        },
        'Retain explicit origin rejection while CloudFront signs the actual origin host.',
        [
          'Never forward viewer Host or browser credentials in this public fictional slice.',
        ],
      ),
      SecurityHeaders: resource(
        'AWS::CloudFront::ResponseHeadersPolicy',
        {
          ResponseHeadersPolicyConfig: {
            Name: sub('${AWS::StackName}-security'),
            SecurityHeadersConfig: {
              ContentTypeOptions: { Override: true },
              FrameOptions: { FrameOption: 'DENY', Override: true },
              ReferrerPolicy: {
                ReferrerPolicy: 'strict-origin-when-cross-origin',
                Override: true,
              },
              StrictTransportSecurity: {
                AccessControlMaxAgeSec: 31536000,
                IncludeSubdomains: false,
                Preload: false,
                Override: true,
              },
            },
          },
        },
        'Add supported security headers without a guessed CSP that breaks federation shims or Angular inline styles.',
        ['Review CSP only after testing the actual module/style graph.'],
      ),
      PageRoutes: resource(
        'AWS::CloudFront::Function',
        {
          Name: sub('${AWS::StackName}-routes'),
          AutoPublish: true,
          FunctionConfig: {
            Comment: 'Exact Shell page rewrites; assets keep errors.',
            Runtime: 'cloudfront-js-2.0',
          },
          FunctionCode: rewriteCode,
          Tags: tags,
        },
        'Exact pages alone become Shell HTML. Private artifact namespaces fail at the edge and missing assets keep origin errors.',
        [
          'No extensionless catch-all or 403/404 HTML fallback.',
          'Keep /mfe separate from /support/tickets.',
        ],
      ),
      Distribution: resource(
        'AWS::CloudFront::Distribution',
        {
          DistributionConfig: {
            Comment: 'Platypus Service public fictional learning demo',
            Enabled: iff('IsEnabled', true, false),
            HttpVersion: 'http2and3',
            IPV6Enabled: true,
            PriceClass: 'PriceClass_100',
            ViewerCertificate: { CloudFrontDefaultCertificate: true },
            Origins: [
              {
                Id: 'static',
                DomainName: ref('BucketDomain'),
                S3OriginConfig: { OriginAccessIdentity: '' },
                OriginAccessControlId: ref('StaticOac'),
              },
              {
                Id: 'api',
                DomainName: {
                  'Fn::Select': [2, { 'Fn::Split': ['/', ref('ApiUrl')] }],
                },
                CustomOriginConfig: {
                  HTTPSPort: 443,
                  OriginProtocolPolicy: 'https-only',
                  OriginSSLProtocols: ['TLSv1.2'],
                },
                OriginAccessControlId: ref('ApiOac'),
              },
            ],
            DefaultCacheBehavior: staticBehavior(),
            CacheBehaviors: [
              {
                PathPattern: '/api/*',
                TargetOriginId: 'api',
                ViewerProtocolPolicy: 'https-only',
                AllowedMethods: ['GET', 'HEAD', 'OPTIONS'],
                CachedMethods: ['GET', 'HEAD'],
                Compress: true,
                CachePolicyId: zero,
                OriginRequestPolicyId: ref('ApiOriginPolicy'),
                ResponseHeadersPolicyId: headers,
              },
              ...[
                '/runtime-config.json',
                '/index.html',
                '/favicon.svg',
                '/mfe/*/remoteEntry.json',
                '/mfe/*/importmap.json',
                '/mfe/*/ticket-api-config.json',
              ].map((pattern) => ({
                PathPattern: pattern,
                ...staticBehavior(zero),
              })),
              { PathPattern: '/mfe/*', ...staticBehavior() },
            ],
            CustomErrorResponses: [
              { ErrorCode: 403, ErrorCachingMinTTL: 0 },
              { ErrorCode: 404, ErrorCachingMinTTL: 0 },
            ],
          },
          Tags: tags,
        },
        'Generated cloudfront.net HTTPS avoids a domain/certificate. No pricing-plan resource means ordinary pay-as-you-go.',
        [
          'No WAF subscription, Lambda@Edge, custom domain or paid optional services.',
          'Starts disabled; enable only after deployment gates.',
          'No error ResponsePagePath or success status substitution.',
        ],
      ),
      InvokeUrl: resource(
        'AWS::Lambda::Permission',
        {
          FunctionName: ref('AliasArn'),
          Action: 'lambda:InvokeFunctionUrl',
          Principal: 'cloudfront.amazonaws.com',
          FunctionUrlAuthType: 'AWS_IAM',
          SourceAccount: ref('AWS::AccountId'),
          SourceArn: sub(
            'arn:${AWS::Partition}:cloudfront::${AWS::AccountId}:distribution/${Distribution}',
          ),
        },
        'The first required OAC permission applies only to this distribution and URL auth mode.',
        [
          'Keep both permissions scoped to the same alias/distribution/account.',
        ],
      ),
      InvokeFunction: resource(
        'AWS::Lambda::Permission',
        {
          FunctionName: ref('AliasArn'),
          Action: 'lambda:InvokeFunction',
          Principal: 'cloudfront.amazonaws.com',
          InvokedViaFunctionUrl: true,
          SourceAccount: ref('AWS::AccountId'),
          SourceArn: sub(
            'arn:${AWS::Partition}:cloudfront::${AWS::AccountId}:distribution/${Distribution}',
          ),
        },
        'The second required OAC permission permits invocation only through a function URL.',
        ['Do not omit InvokedViaFunctionUrl or expand the principal.'],
      ),
    },
    Outputs: {
      DistributionId: output(
        'Owned distribution ID for storage policy and checks.',
        ref('Distribution'),
      ),
      DomainName: output(
        'Generated HTTPS hostname; no custom domain.',
        get('Distribution', 'DomainName'),
      ),
      Origin: output(
        'Public origin to package and publish explicitly after approval.',
        sub('https://${Distribution.DomainName}'),
      ),
    },
  };
}

export async function writeTemplates() {
  const templates = {
    storage: storageTemplate(),
    backend: backendTemplate(),
    edge: edgeTemplate(),
  };
  await mkdir(path.join(projectRoot, 'infrastructure'), { recursive: true });
  for (const [name, value] of Object.entries(templates)) {
    const body = json(value);
    if (Buffer.byteLength(body) > 51200)
      throw new Error('Template exceeds inline size limit.');
    await writeFile(
      path.join(projectRoot, 'infrastructure', name + '.template.json'),
      body,
    );
  }
  return templates;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  await writeTemplates();
  console.log(
    'Wrote three local CloudFormation templates; no AWS command was executed.',
  );
}
