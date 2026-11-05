# AWS deployment preparation

This directory defines the first fictional learning deployment. The scripts **prepare files and print plans offline**. They do not execute AWS operations, including when a target file is supplied. There is deliberately no `--execute` option. Actual publication, resource creation, updates and deletion require a separately authorized step through AWS MCP.

The topology is private S3, CloudFront **pay-as-you-go**, and a classic Node.js 24 Arm64 Lambda Event Function with an IAM-protected Function URL. It has no database, application sign-in, custom domain, VPC, NAT, paid model, hosted build pipeline, WAF subscription or Lambda@Edge. The generated CloudFront HTTPS hostname avoids certificate/domain setup. OAC means origin access control, which lets only the specified distribution reach an origin; it is not user authentication.

## Offline preparation

Build the existing workspaces first. In PowerShell at the repository root:

```powershell
npm.cmd run build
npm.cmd run aws:prepare -- --release preview-a --origin http://localhost:4400
npm.cmd run aws:preview -- --manifest .local/aws/releases/preview-a/manifest.json
```

Open `http://localhost:4400/support/tickets`. This is a local preview, not an AWS URL. It hosts the packaged Shell and three Native Federation remotes at `/mfe/<application>/<release>/`, and invokes the **extracted ZIP's handler** for `/api/*`. It does not emulate AWS IAM, TLS, billing, OAC or edge propagation. Port conflicts fail without stopping existing processes. Ctrl+C stops only this preview.

Preparation writes a new owned directory under ignored `.local/aws/releases/`. It refuses to overwrite an existing release, rejects path traversal/links and checks artifact hashes. A failed attempt remains for inspection; choose a new release identifier. No cleanup script recursively deletes a computed directory.

The ZIP uses standard .NET compression via a fixed local PowerShell command, deterministic entry ordering/timestamps, and real extraction with a complete file/hash comparison. This Windows preparation step changes no execution policy and installs no global tool. It includes `lambda.js`, `ticket-application.js`, `ticket-repository.js`, `fixtures/tickets.json`, and ESM `package.json`. No listener, TypeScript source, node_modules or credentials are bundled. The full frontend graph is copied, excluding build caches and remote standalone HTML whose document base differs from integrated hosting. Public runtime and API configurations are generated in the release; source localhost files are unchanged.

For a separately reviewed cloud release, prepare a **new** full release with the actual verified `https://<distribution>.cloudfront.net` origin after bootstrap has produced it. `https://deployment.invalid` is the offline default and can never pass the cloud publication target checks.

## Templates and bootstrap phases

The three JSON templates are human-reviewable CloudFormation documents, generated reproducibly by `node scripts/aws/templates.mjs`. JSON avoids an additional YAML parser dependency. `aws-cloudformation@3` attribution and resource rationale metadata are retained. All regional resources belong in `eu-north-1`; CloudFront is global.

| Stack                   | Owns                                                                                                               | Deliberate safety choice                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage.template.json` | Artifact bucket and its only bucket policy                                                                         | Starts without a viewer-read grant; add the verified distribution ID later. Bucket is retained on deletion/replacement.                               |
| `backend.template.json` | Seven-day log group, scoped execution role, function, retained version, stable `live` alias, signed URL            | Required explicit concurrency decision. Origin starts `https://bootstrap.invalid`; environment and published version are updated after edge creation. |
| `edge.template.json`    | Two OACs, cache/origin/header policies, exact-route CloudFront Function, disabled distribution, both Lambda grants | Starts disabled. Enable only after origins, configuration, package and quota checks are accepted.                                                     |

The future bootstrap plan orders storage creation → backend ZIP upload → backend creation → **disabled** edge creation. Record outputs, prepare the deployment-origin release, then review a separate publication plan. Publication updates the backend origin/version, updates the single storage policy with the distribution grant, uploads complete remote graphs and Shell assets, writes runtime configuration, writes Shell HTML last, then enables the edge. No stack imports another stack's exports; outputs are passed as parameters. This avoids bucket/package and hostname/origin/alias dependency cycles.

`BackendRevision` is the SHA-256 of the ZIP hash plus exact allowed origin. Both function and version descriptions use it. Configuration-only origin changes therefore update function configuration before replacing the version; unchanged code/configuration does not try to publish a duplicate version. `RollbackVersion` changes only the stack-managed alias target while retaining the current revision's resources. Clear it on the next normal publication. Verify the retained version belongs to this function and has the correct allowed origin before rollback.

The bucket intentionally has **no object versioning**: immutable release paths and retained prior graphs provide rollback for fictional build output without invisible object-version storage. `DeletionPolicy`/`UpdateReplacePolicy: Retain` prevent implicit bucket loss; the future teardown plan explicitly inventories, empties and deletes that retained bucket. Lambda versions are retained for rollback but disappear with deliberate function deletion. Diagnostic logs have explicit Delete policies: seven-day temporary logs contain no application records and are removed during authorized teardown. These are scoped exceptions to general stateful-data retention recommendations.

## Cache and origin rules

- `/api/*` uses the Lambda origin and a zero-TTL cache policy. The browser `Origin` header is forwarded; viewer `Host` is excluded so the actual origin host is signed. Function URL CORS configuration is omitted because the application owns origin handling and the deployment is same-origin.
- Shell `index.html`, runtime configuration, favicon, remote metadata/import maps and Support API configuration use zero edge TTL and `no-store` object metadata.
- Other immutable assets use a cache policy with minimum TTL zero and up to one year. Stable-named remote CSS remains immutable through its release directory.
- Only `/`, `/analytics`, `/administration`, and `/support/tickets` rewrite to `/index.html`. Missing modules/configuration keep non-HTML errors; there is no broad HTML error fallback. Private S3 may return 403 rather than 404 for missing keys, which is preserved.
- OAC policies grant only frontend object paths. `_deploy` packages and `_releases` backups are not viewer-readable and are also denied by the edge function. HTTPS-only origin access and public-access blocks remain enabled.
- Security headers include content-type protection, frame denial, referrer policy and HSTS. A guessed content-security policy is not imposed on federation shims and Angular inline styles; that requires separate browser-tested policy work.

## Auditable future-operation plans

```powershell
npm.cmd run aws:plan
```

Without a target, this prints unresolved gates and **zero AWS operations**. Copy `infrastructure/target.example.json` into ignored `.local/aws/target.json`; fill only reviewed non-secret values and actual stack outputs. Never put credentials in it. The checked-in example intentionally cannot pass target validation.

The coordinator's refreshed November 5, 2026 preflight reports ten total and ten unreserved Lambda executions. The user explicitly accepted `account-cap-ten` for this first deployment. It uses the **shared account-wide cap**, not an isolated function reservation or a monthly spending cap. The quota itself is not a paid capacity purchase; actual resource usage remains subject to the applicable plan, credits and prices.

The checked-in example deliberately stays `unresolved`, with no review date, acceptance or verified ownership. A real ignored target must explicitly select a mode and carry fresh quota evidence reviewed within 24 hours. `account-cap-ten` requires `acceptedSharedAccountCap: true` and an actual account limit no higher than ten. The stricter `account-cap-five` remains available but rejects an actual limit above five, including ten. `reserved-two` still requires at least 102 unreserved executions so two can be reserved above the standard buffer of 100. Shared modes omit the reservation through the existing condition; they do not reserve ten or silently fall back from another mode. Scripts do not choose or accept a mode, change quotas, or upgrade the account plan. Refresh identity/quota/ownership evidence before actual operations; see [implementation 027](../docs/implementation/027-account-cap-ten.md).

Commands below print structured API-operation plans only:

```powershell
npm.cmd run aws:plan -- --action bootstrap --target .local/aws/target.json --manifest .local/aws/releases/cloud-a/manifest.json
npm.cmd run aws:plan -- --action publish --target .local/aws/target.json --manifest .local/aws/releases/cloud-b/manifest.json
npm.cmd run aws:plan -- --action check --target .local/aws/target.json
npm.cmd run aws:prepare -- --release analytics-b --origin https://ACTUAL.cloudfront.net --remote analytics --previous .local/aws/releases/cloud-b/manifest.json
npm.cmd run aws:plan -- --action remote --target .local/aws/target.json --manifest .local/aws/releases/analytics-b/manifest.json --previous .local/aws/releases/cloud-b/manifest.json --remote analytics
npm.cmd run aws:plan -- --action rollback-remote --target .local/aws/target.json --manifest .local/aws/releases/cloud-b/manifest.json --previous .local/aws/releases/analytics-b/manifest.json --remote analytics
npm.cmd run aws:plan -- --action rollback-backend --target .local/aws/target.json --version 1
npm.cmd run aws:plan -- --action destroy --target .local/aws/target.json --confirm-destroy platypus-dev
```

`ACTUAL` and version `1` illustrate inputs, not existing resources or verified versions. Supply the actual generated lowercase hostname and reviewed retained version. `$file` values in a plan mean exact local bytes/text to materialize; `$result` values reference a preceding confirmed output. For future S3 uploads, use AWS MCP `get_presigned_url` and a local upload as required by that tool; the MCP execution environment cannot read this computer's local file path. Recheck its file hash before upload and resulting checksum afterward. Small CloudFormation JSON can be supplied as actual template text; do not pass its local filename as template content. `assert`, `wait-and-read`, browser checkpoints and paginated deletion entries are explicit obligations for the future MCP operator, not executable SDK payload fields. Do not pass the whole plan directly to an AWS API or treat submitted requests as completed operations. There is no automatic cloud executor.

Remote publication uses a new immutable directory, preserves other application pointers, verifies the current runtime pointer hash, and conditions replacement on its current ETag. Every manifest carries the complete remote key/hash lists. Before switching a pointer, the publication plan reads the checksums of every referenced remote file; a remote rollback similarly verifies every retained selected-remote file, including chunks rather than only metadata/CSS. A mismatch or conditional-write conflict requires refreshing the deployment state, not overwriting another publication. Rollback merges only the selected remote pointer and must record the resulting pointer/hash as the new deployment state. Browser-registered modules still require document reload; Retry applies to failed metadata/data loads.

For a later full publication onto an existing deployment, provide `--previous` with its verified current manifest so the runtime pointer update is conditional rather than an initial create. Initial publication expects no current pointer. Preserve old Shell hash files and prior remote graphs; do not routinely invalidate `/*` or immediately delete old graphs.

Destroy plans require the exact stack prefix and verified resource ownership. They disable and remove edge resources before backend resources, confirm no bucket version history, enumerate all object-list pages, and require explicit review of keys/batches before deletion. They then remove the storage stack and explicitly clean its retained, empty bucket. Stop on unknown objects, ownership changes, retention, `DELETE_FAILED`, or missing evidence. This task has not authorized any of those operations.

### Failed partial bootstrap

The full destroy planner requires verified outputs for all three stacks and therefore **does not handle an incomplete bootstrap automatically**. After separate cleanup authorization, the MCP operator must first use `DescribeStacks`/`ListStackResources` for the exact project stack names and check the account/Region/Project tag. If a failed stack has not rolled back completely, inspect its failure events and physical resources rather than assuming they disappeared.

- Storage-only failure: inventory any retained `Artifacts` bucket from stack resources, validate its expected owner/tag, and check for object versions. Delete the failed storage stack if it exists; retained bucket ownership transfers to explicit cleanup. List all object pages, review/delete only owned package keys in batches, confirm empty, then delete that bucket.
- Backend failure after storage/package upload: first inventory and delete any failed backend stack, confirm aliases/functions/logs or retained versions are gone, and resolve `DELETE_FAILED`. Then follow the storage-only cleanup, including the uploaded `_deploy/backend/<release>.zip`.
- Edge failure: inventory the edge stack. Disable any created distribution through an approved stack update if possible; otherwise a separately reviewed `UpdateDistribution` using its current ETag may be needed. Wait for disabled/deployed state, then remove the edge stack and check its OACs/function/policies. Delete backend resources next and the owned storage last, following the steps above. Do not call the full destroy planner using guessed missing IDs.

Record actual remaining resources after each step. These are explicit recovery instructions, not an executed rollback or a claim that CloudFormation always cleans partially created resources.

## Verification and remaining cloud checks

```powershell
npm.cmd run aws:validate
npm.cmd run test:aws
```

The project-local official `@aws/cloudformation-validate` validator checks schema/lint and actual Guard rules. Its JSON evidence is under ignored `.local/aws-validation/`. This differs from account-aware change-set validation; creating or executing a change set is not part of this stage. Root may separately perform the authorized read-only `ValidateTemplate` call.

Tests exercise real ZIP extraction/handler calls, deploy-style paths in an installed headless Edge/Chrome, API outage/Retry, missing/private assets, unchanged local configs, deterministic ZIP bytes, independent pointers, rollback order, ownership/hash failures and offline defaults. Test releases stay in ignored `.local/aws/releases/` for evidence; they create no AWS resources.

Actual IAM/PassRole/OAC effectiveness, region/plan restrictions, real edge HTTPS/cache propagation, reservations, resource creation, deployment/rollback/teardown and billing remain cloud-only checks. Keep Free plan; do not activate advanced features or paid services to bypass a failure.

Primary references consulted November 4, 2026: [Lambda Version replacement semantics](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-lambda-version.html), [Lambda URL alias qualifier](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-lambda-url.html), [Lambda OAC permissions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html), [S3 OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html), [conditional PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html), [Lambda execution-role trust](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html). Runtime uses bundled fixtures and no AWS SDK application calls; the execution role is a scoped platform-log policy, not a policy inferred from runtime SDK source. No Autopilot installation or policy upload is required for this explicit resource-policy/platform-permission design.
