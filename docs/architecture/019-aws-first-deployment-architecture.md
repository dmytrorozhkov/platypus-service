# First AWS deployment architecture proposal

Status: planning proposal, not an implemented or cloud-tested deployment.
Research date: November 4, 2026.
Scope: the accepted frontend and Node.js application with 25 fictional tickets. No account registration, resource creation, software installation, application modification, or spending occurred in this task.

## Recommendation and prerequisites

Propose one private Amazon S3 bucket for static files and deployment packages, one Amazon CloudFront pay-as-you-go distribution, and one ordinary Lambda Event Function running Node.js 24 on Arm64. CloudFront serves the frontend and forwards `/api/*` to the function URL. Protect both origins with origin access control (OAC); use the distribution's generated HTTPS address. Keep PostgreSQL, Cognito, DynamoDB, paid AI, custom domains, networking appliances, and delivery pipelines outside this first demonstration.

This is the preferred technical candidate, conditional on the account gates below. It is not a promise that every necessary permission is available in the eventual signup experience. Detailed prices, credit eligibility, and the zero-payment scenarios belong to the parallel cost report 020.

Important distinctions:

- The **AWS account Free plan** and **CloudFront's flat-rate Free pricing plan** are different products. AWS explicitly excludes Free Tier accounts from CloudFront flat-rate plans. Select CloudFront pay-as-you-go while using the account Free plan; do not upgrade the account just to obtain the advertised $0 flat-rate distribution. [CloudFront flat-rate account requirements](https://docs.aws.amazon.com/PricingPlanManager/latest/UserGuide/pricingplanmanager-ug.pdf).
- The new signup experience assigns a project Region from contact information: Ohio, Stockholm, or Sydney. Frankfurt (`eu-central-1`) remains a comparison assumption, not the selectable Region for that experience. If the account's contact country maps to Stockholm, use `eu-north-1`; do not infer the actual contact country from the Windows timezone. [Project Regions](https://docs.aws.amazon.com/accounts/latest/reference/project-regions.html).
- New-signup projects list CloudFormation, IAM, Lambda, S3, CloudFront, and CloudWatch as supported services. They disallow Lambda@Edge and cross-Region service features. The proposed edge rewrite uses **CloudFront Functions**, not Lambda@Edge. Service listing does not prove that every requested policy operation is available. [Supported services](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html).
- The new experience manages human roles and organization policies. Programmatic IAM roles can be created, but this does not establish that a custom least-privilege execution role, `iam:PassRole`, Lambda resource policies, and S3 OAC bucket policies work unchanged under its managed restrictions. Before deployment, inspect actual account access and validate the proposed CloudFormation operations. Never automatically activate advanced features or move to Paid to bypass a restriction. If a gate fails, revise the candidate or present the exact tradeoff for a separate decision. [Signup access comparison](https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html).

## What was inspected

Read `AGENTS.md`, relevant project-plan requirements, README, both frontend deployment configurations, Shell validation/routes, Support's data adapter and bootstrap, server source/repository/package metadata, and existing build artifacts. No unchanged application was rebuilt.

The current server is plain `node:http`, not Express. It has no production npm dependency. `main.ts` binds `localhost`, uses `PORT`, and supplies `ALLOWED_ORIGINS`. `createTicketServer` combines transport handling and application routing. `FixtureTicketRepository` imports the server-owned JSON with 25 records; `/api/health` returns `{ "status": "ok" }`; `/api/tickets` returns `items` and `total`. Current origin checks are browser-origin restrictions, not user authorization.

Support resolves `ticket-api-config.json` relative to its bootstrap module using `import.meta.url`. `apiBaseUrl` must be an HTTP(S) **origin**, then Support requests `/api/tickets`. Therefore `https://example.cloudfront.net/api` is invalid; use `https://example.cloudfront.net`. Shell remote URLs must be absolute HTTP(S) URLs. No browser credential or secret is needed in either public configuration file.

Existing uncompressed deployable output, excluding `.nf-cache`:

| Artifact                     | Files |     Bytes |
| ---------------------------- | ----: | --------: |
| Shell `dist/browser`         |     5 |   385,044 |
| Support `dist/browser`       |    11 |   274,131 |
| Analytics `dist/remote`      |     5 |   449,371 |
| Administration `dist/remote` |     4 |    61,881 |
| Frontend total               |    25 | 1,170,427 |
| Server `dist`                |     4 |    11,514 |

These are local build sizes, not measured compressed CloudFront traffic or a Lambda ZIP. Deployment metadata and a cloud handler will add small files. Keep the estimate's 0.1 GiB stored-data allowance rather than pretending current source size equals long-term storage.

## Runtime comparison

| Candidate                                      | Concrete application work                                                                                                           | Selection                                                                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event Function + Function URL + CloudFront OAC | Extract shared request-to-response logic; add a small payload-v2 handler; retain local HTTP entry point                             | Recommended for the first tiny read-only API; no API Gateway meter or continuously running server                                                   |
| Event Function + API Gateway HTTP API          | Same event adapter; add HTTP API routes/integration, deployment configuration, and its cost meter                                   | Useful later if gateway authorization, routing, and explicit gateway throttling are required; not needed for two current endpoints                  |
| Event Function + direct public Function URL    | Same handler; `NONE` authentication and exact browser-origin configuration                                                          | Fewer CloudFront API settings but publicly bypassable endpoint and separate origin; not selected                                                    |
| Lambda Web Function                            | Keep HTTP server, change startup to read the host and port from `AWS_LAMBDA_HTTP_ENDPOINT`, configure entry file/revisions/endpoint | Valid alternative for preserving HTTP hosting semantics; not selected until account/Region access and measured memory-lifetime cost are established |

Function URLs use the HTTP API payload format version 2.0. The proposed adapter reads `requestContext.http.method`, `rawPath`, and normalized headers, then returns status, headers, and serialized body. Extract application behavior once so local and Lambda entry points share the repository, status codes, origin rules, and error contract. Do not run a localhost listener inside an ordinary Event Function or add a loopback HTTP proxy merely to reuse transport code. Package the compiled handler/shared modules, fixture JSON and an ESM `package.json` (`type: module`) in the ZIP; set the matching Lambda handler entry point. Neither TypeScript source nor the monorepo node_modules is a deployment entry point. [Function URL payloads](https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html).

Web Functions are actual direct Node.js HTTP hosting in the current documentation, not the older Lambda Web Adapter. Their runtime supports Node.js 24 and instructs servers to use the supplied endpoint address; simply changing localhost to `0.0.0.0` is not the documented contract. They have 2 GiB execution environments and a different billing model based on active CPU and consumed memory over environment lifetime. Their documented scaling controls include a minimum configured `maxEnvironments` of 2, and minimum positive rate-limit increments of 100 requests/second. This is not equivalent to a 256 MiB Event Function or the Event Function monthly quota. [Web runtime](https://docs.aws.amazon.com/lambda/latest/dg/web-functions-runtimes.html), [Web scaling](https://docs.aws.amazon.com/lambda/latest/dg/web-functions-scaling.html), [Lambda pricing](https://aws.amazon.com/lambda/pricing/).

Public Web Function documentation does not establish that this specific future account can create a HomeRegion Web endpoint in its assigned project Region. Leave this as an explicit gate; do not assert universal regional/account availability from a generic Lambda listing. The selected Event Function also requires checking Function URL availability and actual account quotas in the assigned Region. [Function URL configuration](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html).

## Resource inventory and request flow

1. One S3 Standard general-purpose bucket in the allowed project Region; Block Public Access enabled, Bucket owner enforced, default S3-managed encryption. No website endpoint, customer-managed KMS key, replication, or object versioning is necessary for these fictional artifacts. Use immutable release keys and local deployment manifests instead of accumulating hidden object versions.
2. One CloudFront standard pay-as-you-go distribution with the AWS-managed `cloudfront.net` certificate and HTTPS redirect. Two origins: the S3 REST endpoint and the Function URL. No purchased domain, Route 53 hosted zone, custom certificate, WAF subscription, real-time access logging, or CloudFront flat-rate plan.
3. S3 OAC signing plus a bucket policy restricted to this distribution and the frontend object namespaces; deployment ZIPs under `_deploy/backend/` are not granted viewer read access. Lambda OAC uses `AWS_IAM` on the function URL and distribution-scoped resource permissions. AWS documents both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` grants. This stops direct anonymous origin calls but does **not** authenticate application users: the CloudFront API remains public fictional learning data. [S3 OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html), [Lambda OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html).
4. One Event Function, Node.js 24, Arm64, 256 MiB, 512 MiB default ephemeral storage, timeout 3 seconds, no VPC or provisioned concurrency. One stable alias points to a published version. Set reserved concurrency to 2 **if the new account quota permits that reservation**; otherwise resolve the cap before publishing rather than silently removing it. A low concurrency cap limits simultaneous execution, not total monthly charges.
5. One explicitly managed CloudWatch Logs group with seven-day retention. Restrict the execution role to logging to this group; fixture data requires no S3 read from the running function. Use concise errors and request identifiers, not ticket bodies. No continuous synthetic health poller, custom metrics, or paid tracing is needed initially.
6. One small CloudFront Function on static viewer requests for exact Shell-page rewrites; leave `/api/*` on its separate behavior without that function. Avoid function logging during ordinary successful routing.

Browser → CloudFront → private S3 for HTML/modules/styles/configuration; Browser → the same CloudFront origin `/api/tickets` → uncached Function URL → fixture repository. This preserves the current Support origin-only configuration and avoids browser cross-origin requests.

For the API origin, forward the browser `Origin` header so existing explicit origin rejection is retained, but do not forward the viewer `Host` header: CloudFront must address/sign the Lambda origin host. Set `ALLOWED_ORIGINS` to the exact deployed HTTPS origin. Keep local development defaults for the local entry point; no wildcard origin or duplicate function-URL CORS response headers are needed for same-origin cloud requests. The cloud behavior needs GET/HEAD/OPTIONS only; preserve current method errors rather than introducing write endpoints.

## Static layout, routing, and caching

Use root Shell files and separate immutable remote release namespaces:

```text
/index.html                         # current Shell document
/main-<hash>.js, /styles-<hash>.css  # additive Shell assets
/favicon.svg
/runtime-config.json                # independent remote release pointer
/mfe/support/<release>/...           # Support federation artifacts + API config
/mfe/analytics/<release>/...         # React federation artifacts
/mfe/administration/<release>/...    # Vue federation artifacts
/_releases/shell/<release>/...       # private rollback manifest/document backup
/_deploy/backend/<release>.zip      # private deployment package
/api/health, /api/tickets            # Lambda origin, never S3
```

The `/mfe/` prefix deliberately avoids colliding with the Angular page `/support/tickets`. Shell root remains Analytics; preserve exact routes `/analytics`, `/administration`, and `/support/tickets`.

Proposed CloudFront behavior order: `/api/*` → Lambda, cache disabled; `/runtime-config.json` → S3, cache disabled; `/mfe/*` → S3; default → S3. The viewer function rewrites **only** `/`, `/analytics`, `/administration`, and `/support/tickets` to `/index.html`. Reject or leave genuinely unknown non-page paths as errors. Do not configure a blanket 403/404 → `index.html` custom error response. A URI rewrite does not change the selected cache behavior or origin. [CloudFront function request rules](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html).

Missing JavaScript, CSS, metadata, and configuration must stay non-HTML errors. A private S3 REST origin without `ListBucket` can return 403 for a nonexistent object instead of 404; preserve that distinction rather than masking policy failures as successful HTML. Exact 404 behavior requires an explicit, reviewed permission/routing decision and cloud verification; it is not assumed in this proposal. [S3 missing-object status rules](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html).

Set object metadata and cache policies deliberately:

| Content                                                                       | Proposed cache behavior                                                                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Shell `index.html`, favicon, runtime config                                   | `no-store`; edge minimum/default/maximum TTL 0 for mutable control documents                                             |
| Remote `remoteEntry.json`, `importmap.json`, `ticket-api-config.json`         | `no-store`, edge TTL 0; a release path is immutable nevertheless                                                         |
| Fingerprinted JavaScript/CSS and other immutable files under a remote release | `public,max-age=31536000,immutable`; include stable-named remote styles in this class because the release prefix changes |
| API responses and API failures                                                | `no-store`, caching-disabled policy; retain JSON error responses                                                         |
| Static missing-object failures                                                | Short error-cache TTL; no HTML fallback; verify policy propagation and permissions separately                            |

Implement metadata/config-specific cache behaviors or an equivalent reviewed cache policy so immutable `/mfe/*` defaults cannot override no-store with a positive minimum TTL. CloudFront policy TTLs are a separate control from browser fetch options. [Cache policy controls](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html).

Generated `remoteEntry.json` retains relative exposed-module names. Preserve each complete dependency graph and relative chunk paths, with JavaScript/CSS/JSON MIME types. Analytics/Vue federation builds already use `base: './'`; Support's imports and API config use module-relative URLs. Never upload `.nf-cache`, node_modules, local evidence, or source secrets. Remote standalone HTML is not required for the integrated first deployment; if published later, Support's existing `<base href="/">` must be adjusted for its release prefix and independently tested.

Runtime config points to absolute URLs such as `https://<distribution>/mfe/support/<release>/remoteEntry.json` and the matching `styles.css`. Support's colocated API config is `{ "apiBaseUrl": "https://<distribution>" }`. Keep private framework dependencies, separate orchestrator namespaces, additive import maps, and mount/cancellation cleanup unchanged.

## Publish, update, and rollback

First publish the backend ZIP/version/alias, then remote release directories, then deployment-specific non-secret API configuration and Shell assets. Verify all referenced artifacts exist before writing root `runtime-config.json` and finally Shell `index.html`. If the generated distribution hostname is needed, create its configuration first, obtain the hostname, then upload public runtime configuration and test before sharing the page.

A remote-only update uploads a new release directory and atomically replaces only its pointer in `runtime-config.json`; it does not rebuild or republish other application bundles. Keep at least the previous release and preserve old Shell hash assets for existing documents. Limit retained unused remote releases with a deployment manifest and a documented cleanup window; do not delete the preceding release immediately.

Rollback restores the prior complete runtime pointer/document or moves the Lambda alias to the prior version. Do not mix old metadata and new chunks in one release directory. Existing documents retain registered federation modules: user-visible module updates require the existing Reload page action or document reload. A metadata failure can use Retry. Do not promise hot module replacement across release changes.

No invalidation is normally necessary for no-store control files and new immutable URLs. Budget at most ten batches of five named invalidation paths as a defensive upper bound; do not routinely invalidate `/*`. Keep release manifest/hash evidence locally, and record the actual deployment outputs after eventual implementation.

## Reproducible infrastructure and bounded implementation

Use plain **AWS CloudFormation YAML** plus small project-owned PowerShell/Node deployment scripts. This directly describes this small AWS-only inventory, avoids a Terraform state service and CDK bootstrap bucket, and requires no remote Git repository or hosted pipeline. CloudFormation's service fee and underlying resource costs are distinct. CloudFormation templates can own the function URL and OAC resources. [CloudFormation overview](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html), [CloudFormation Function URL resource](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-lambda-url.html).

Prepare two stacks or equivalent phases to avoid a package-bucket/function bootstrap cycle: storage first; application/edge resources after uploading the reviewed ZIP. Explicitly include both in teardown ownership. Future setup needs an approved AWS account, current AWS CLI v2 supporting the chosen signup login, existing Node/npm/Git, and an authorized authenticated session. No Docker, SAM CLI, database installation, global npm package, or cloud-hosted build service is required for this candidate. Select exact CLI/package versions during implementation, not by an unverified pin in this proposal.

Next implementation boundary: shared API handler + Lambda entry point; adapter tests preserving current responses; deployment configuration generation; CloudFormation resources/policies; deterministic frontend/backend packaging; publish/rollback/destroy commands; cloud browser verification. The entire stage still requires user approval. CloudFormation change-set validation is useful but does not prove runtime permissions or successful deployment; actual IAM/OAC behavior remains an acceptance check, not a current claim.

## Inputs handed to cost planning

Assume one learner, 30-day month, 10,000 API requests, 100,000 frontend viewer requests including assets, 1 GiB frontend delivery, 0.1 GiB retained static/package storage, 0.05 GiB log ingestion with seven-day retention, and ten full deployment batches. These are workload assumptions, not enforced quotas.

- Event Function: Arm64, 256 MiB, assumed average billed duration 100 ms including a conservative allowance for initialization: `10,000 × 0.25 × 0.1 = 250 GB-seconds`; benchmark after deployment. No provisioned concurrency, additional ephemeral storage, or database network traffic.
- API response assumption: 10 KiB average, larger than the current minified ticket JSON; approximately 0.09537 GiB additional viewer delivery. Count **110,000 total CloudFront viewer requests**, not only 100,000 frontend requests.
- At most 100,000 static S3 GETs if every frontend request misses edge cache; no API GETs to S3. Use 300 S3 PUT/COPY-class operations, 40 LIST operations, and up to 50 named invalidation paths for ten full releases, including package and rollback-document overhead. Actual incremental remote deployments should be lower.
- CloudFront Function: conservatively 100,000 static viewer invocations; no API invocations. No extra always-on monitoring requests.
- Sensitivity case: 100× requests/delivery/log ingestion with the same retained storage and release batches gives 1,000,000 API calls, 25,000 Lambda GB-seconds, 10,000,000 frontend requests, 11,000,000 total viewer requests, 100 GiB frontend plus about 9.537 GiB API delivery, and 5 GiB log ingestion. This illustrates exposure rather than a promised permitted load; caps/credits/allowances are account-wide and may be shared.

Reserved concurrency 2 bounds in-flight function execution; Function URLs also apply the documented request-rate relationship to reserved concurrency. It is not a monthly dollar cap. A shutoff can set concurrency to zero and disable public distribution access, but residual S3/log storage still exists. [Function URL throttling/deactivation](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html).

## Future acceptance and teardown

Before any provisioning: confirm exact signup path, plan, assigned Region, credits/expiry, supported Function URL/OAC/CloudFront Function operations, CloudFormation/IAM permissions and account quotas; select the reviewed limits and cost estimate. Do not exchange credentials in chat or save them in tracked files.

After a separately approved deployment, demonstrate:

1. HTTPS and direct refresh of all three Shell routes, preserving root Analytics; zero localhost requests and no unexplained browser errors.
2. Each of the four independently built frontend artifacts loads through real generated Native Federation metadata; styles, repeated navigation, cancellation, and cleanup remain correct.
3. `/api/health` reports application liveness, not database readiness; `/api/tickets` returns 25 valid items and total 25. No database or authorization is claimed.
4. A controlled API disable/re-enable causes the existing error UI and recovers through Retry. No cached API success masks the outage.
5. Missing module/metadata paths return non-HTML 403/404 errors; direct anonymous S3 and Function URL access is denied; valid CloudFront access works.
6. A remote-only deployment preserves other artifact hashes, a controlled rollback restores the prior release, and new documents load the correct version without stale configuration.
7. Logs obey seven-day retention; resource inventory and actual costs are reviewed against the estimate.
8. Execute a reviewed teardown of only project-owned resources: disable/delete distribution and associations as required; remove function URL/alias/versions/function, CloudFront Function/OACs/policies, log group, all owned S3 objects including rollback/packages, then both stacks/bucket. Check for `DELETE_FAILED`, retained resources, or unexpected remaining versions. Stopping the application or merely deleting stack files does not remove stored resources.

PostgreSQL and authentication follow in separate estimated stages. The accepted long-term PostgreSQL repository boundary, server-enforced roles/organizations, 100,000-ticket target, server filtering/sorting/pagination, and later AI/DynamoDB/Lambda workflows remain unchanged.
