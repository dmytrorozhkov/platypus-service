# AWS Neon integration and manual handoff094

Prepared November 7, 2026 under contract090 and learner-only publication. Actual prior evidence remains in083: imported and separately verified100000tickets/100organizations/40agents, private initial password, pooled app identity/SELECT probe, populated local UI/pagination and qualitative idle recovery. This stage prepares AWS source/templates/offline candidates only. The public AWS demo still serves25fixtures; no SSM parameter, IAM mutation, AWS publication, CodeBuild run or Neon operation was performed by agents.

## Integrated components

Backend091 provides a separate import-inert Event Function entry, lazy pinned SSM retrieval, one successfully probed bounded pool per environment, parameterized paged/options reads and sanitized failure/recovery. The original fixture handler remains unchanged. Lambda uses eu-north-1; the database remains pooledFrankfurt/neondb/platypus_app. Owner credentials never serve requests. Health/preflight/invalid inputs need no secret/SQL; legacy unbounded collection does not load the database.

Infrastructure092 derives its additive template from the existing backend template and preserves six logical resources, function identity, AWS_IAM Function URL, stack-owned logging, explicit concurrency choice and retained versions/alias rollback. Timeout changes to30seconds only in the opt-in template. ARN derives from actual AWS account and fixed parameter path; target confirmation derives from the pooled host. Only exact ssm:GetParameter is added. There is no secret value, dynamic plaintext secret reference, parameter creation, VPC/NAT or paid customer KMS key in this template.

Packaging093 prepares a self-contained Node24 ESM ZIP and a distinct full frontend/backend candidate. It binds external sourceSHA, nonsecret runtime config, exact parameter version, generated template, code/config revision, complete inventory and hashes. Support config is paged/same-origin only in the candidate copy. Current fixture-only delivery is intentionally unable to publish this new candidate format; a reviewed publisher adaptation and human-only CodeBuild access remain explicit later prerequisites. Do not use the old Package/Deploy workflow to publish this candidate, rename it into a fixture artifact, weaken its verifier or directly publish from an agent.

The coordinator pins @aws-sdk/client-ssm3.1164.0 (registry Node>=20) and direct esbuild0.28.2, compatible with existing Node24.21 CI. Two overlapping initial npm installs were mistakenly started; the coordinator stopped the exact owned remaining installer, reconciled the lockfile with package-lock-only, then completed one clean npm ci --ignore-scripts --no-audit (515packages). Installed versions/lockfile agree. A separate npm audit --omit=dev returned zero known vulnerabilities. No forced dependency upgrades occurred; dev-tool advisory output is not a production security guarantee. Existing runtime processes/services were not stopped.

## Runtime and secret boundaries

The planned parameter is /platypus-service/production/neon/password, same-account eu-north-1 Standard SecureString, standard throughput, encrypted under existing AWS-managed alias/aws/ssm. Its value is only the private Neon platypus_app password. Runtime reference pins an explicit positive version; latest/labels and response ARN/name/type/version drift are refused. SDK endpoint overrides are ignored, maxAttempts=1 and abort/transport enforce a maximum3second retrieval. The existing adapter maximum15seconds remains unchanged; Lambda injects8second operations, a25second request bound and a4second remaining-time margin under30secondLambda timeout. Failed/late work is retired, no SQL invocation is replayed and later explicit requests may initialize afresh. Uncertain or failed cleanup fails closed.

According to current official pricing, Standard parameters and standard-throughput Parameter Store calls have no additional Parameter Store charge. KMS usage is separately metered and its allowance is shared; this is not a guarantee of zero total cost or Free-account eligibility. No account upgrade, paid tier, higher throughput, new CMK, provisioned capacity or concurrency increase is authorized. Historical SCP denial concerned IAM federation; it is not proof that this specific SSM/role update will fail or succeed. Fresh operator permission/plan checks are required before any real setup.

## Verification evidence

Backend author15/15 focused groups and reviewer independent15/15 passed. Infrastructure author6/6 and reviewer independent6/6 passed; existing CloudFormation1.15.0 schema plus embedded project Guard returned zero errors/warnings and seven informational replacement notices. The opt-in template is12977bytes and retains all six original resource logicalIDs.

Coordinator extended the marked disposable PostgreSQL18.6 integration and actually passed9/9SQL/HTTP groups, exit0 with all owned clients/cluster stopped. Three new groups use the real Lambda event adapter with an injected synthetic secret and explicit loopback transport: cold/warm paged/options actualSELECTs with no SQL for health/invalid input; disconnected warm client fails once and a later explicit invocation reconnects; actual column-only write drift refuses startup before business data and succeeds after reviewed test restoration. The tests use three synthetic rows, not the native source/Neon. They do not prove SSM access, AWS execution or Neon TLS in Lambda. Complete integration tests, full package/bundle evidence, independent095 review and hostedCI results are recorded below as observed.

## Later learner-only setup order

No cloud command needs to be run during this offline stage. The eventual reviewed handoff must supply the command and all subsequent input steps together, per learner preference, without embedding passwords.

1. Review the exact candidate sourceSHA, externally retained manifest hashes, template diff, cost assumptions, account/region and publisher compatibility. Confirm real account/SSM/KMS/IAM/CloudFormation capabilities without silently upgrading or broadening permissions. Human-only publisher access remains a prerequisite.
2. Learner privately creates the fixed parameter in AWS Systems Manager Parameter Store: name /platypus-service/production/neon/password; tier Standard; type SecureString; key alias/aws/ssm; value the existing Neon platypus_app password. Do not create an advanced parameter, print/decrypt its value in CLI output, put it in a command argument/file or send it to an agent. Verify parameter metadata/version only. Existing parameters require ownership review, not overwrite/adoption.
3. Learner prepares ignored nonsecret runtime JSON from infrastructure/neon-runtime.example.json with verified accountID, exact CloudFront origin, pooledFrankfurt hostname and actual parameter version. The illustrative placeholder example intentionally fails validation. No owner/app password belongs in this JSON.
4. Build/review exact source, prepare the distinct full candidate offline with release.mjs and verify again using an externally retained manifestSHA plus expected source/config. Root supplies complete exact commands only after the real nonsecret inputs and publisher adapter are reviewed. CI tests use public synthetic values and perform no cloud operation.
5. After the separately reviewed human-only publishing path is configured, the learner alone starts publication. Change-set review must preserve storage/edge/function identity and show only scoped execution-role/config/code/version updates. Do not widen role grants or change imported database data. Publish version/alias and frontend graph in the reviewed recoverable sequence.
6. Learner verifies the public HTTPS app's paged data, filters, startup after idle and sanitized failure/recovery. Alias rollback alone does not restore a rotated database password: retain credential/version compatibility or plan a separate explicit credential recovery. No real credential rotation is needed for this preparation.

## Sources

- [Lambda Event Function reuse and idle connection behavior](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Parameter Store Standard and throughput pricing](https://aws.amazon.com/systems-manager/pricing/)
- [SecureString KMS and aws/ssm behavior](https://docs.aws.amazon.com/systems-manager/latest/userguide/secure-string-parameter-kms-encryption.html)
- Reports091/092/093 and independent review095 record their isolated authorship and actual verification.
