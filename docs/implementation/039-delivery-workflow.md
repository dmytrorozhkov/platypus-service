# Implementation 039 — Manual delivery workflow and checked bundle

Date: November 5, 2026. Branch: feature/github-delivery.
Status: workflow/bundle implementation and owned local checks complete; integrated review and hosted/live delivery remain pending.

## Implemented boundaries

CI retains ordinary push/pull-request/manual checks and now exposes workflow_call. The same checks, five builds and offline tests run before optional delivery packaging; the root-owned test:delivery command exercises the delivery failure boundaries as well. The build job has only contents: read, checks out github.sha explicitly and never requests AWS access. Ordinary CI runs upload no artifact.

The Deploy workflow is manual, restricted to the exact repository and refs/heads/main, and supports full publication or explicit full recovery. It calls CI from the same source commit, waits for checks, then enters the aws-learning publisher environment. One workflow-wide deploy-aws-learning concurrency group uses cancel-in-progress: false, covering both publication and recovery. The reusable CI group has a distinct prefix and does not cancel manual checks.

Only the publisher job grants id-token: write. It uses a 25-minute timeout and requests an 1,800-second AWS session. The first publisher step requires protected-environment DELIVERY_ENABLED to equal the exact string true, a configured publisher role/account and a bounded private target JSON matching the expected origin/account. Missing configuration fails before authentication or publication. Environment branch/reviewer rules, OIDC trust, IAM permissions and any live setup belong to root/access task043; writing the workflow does not establish those protections.

The required configuration contract is:

- Repository variable DELIVERY_ORIGIN: public generated CloudFront HTTPS origin, available to the no-AWS build job.
- Protected environment variables DELIVERY_ENABLED, AWS_PUBLISHER_ROLE_ARN and AWS_ACCOUNT_ID.
- Protected environment secret DELIVERY_TARGET_JSON: private portable target, never uploaded or printed. The workflow writes it only to a known RUNNER_TEMP file and removes that exact file in an always-run cleanup step.

All shell input values enter environment variables or argument arrays rather than interpolated commands. Recovery requires an exact completed release and expected pending identity or none; publication rejects recovery-only inputs. There is no arbitrary ref, URL, artifact selector, quota change, deletion or default mutation mode. Recovery uses retained private state through executor040 and does not create or download a replacement build bundle.

## Bundle and handoff

createDeliveryBundle({sourceSha, runId, runAttempt, repository, origin}) calls the existing real prepareRelease once for gh-<run>-<attempt>-<sha12>. Inputs and the generated release are strictly bounded, including the existing 48-character release limit. The release contains the complete frontend graphs, ordinary backend ZIP, prepared/extracted five-file handler and ownership/manifest files. It remains under ignored .local/aws/releases; source localhost configuration is unchanged.

bundle-envelope.json binds schema/project/repository, exact source SHA, run/attempt, origin, release, manifest SHA-256 and a sorted inventory of every other file's relative path, size and hash. No private target is accepted by this API. A hard 32 MiB total bound, 4,096-file limit and bounded envelope apply. The verifier rejects missing/extra/changed files, hidden/unsafe names, directory links, hard links, case collisions, wrong context, non-full manifests, mismatched ZIP copies and changed extracted handlers.

verifyDeliveryBundle({directory, sourceSha, runId, runAttempt, repository, origin, expectedEnvelopeSha256?}) returns directory, release, manifestPath, manifest, envelope, envelopeSha256 and totalBytes. The checked build returns its envelope hash through workflow outputs; the publisher independently verifies that anchor before obtaining AWS credentials and passes it to executor040 for revalidation. The return shape and CLI flags were agreed directly with executor040 and verifier041.

The existing prepare/extract step proves ZIP content when packaging; the handoff then verifies the exact ZIP and extracted-file bytes against the checked builder's anchored inventory. It does not rebuild in the publisher. An imported manual baseline without an attested source SHA follows executor040's separate import path rather than pretending to be a checked GitHub bundle.

Pinned upload-artifact transfers only the verified release directory, with one-day retention, no overwrite and failure on missing files. Hidden-file inclusion is explicit because the parent .local path is hidden; the bundle verifier itself rejects hidden contents, and no target or credential directory is included. download-artifact selects only this run's returned artifact ID, with digest-mismatch: error; it accepts no cross-run token/URL. A GitHub artifact is a temporary byte handoff, not durable deployment state.

The retention and 32 MiB uncompressed bound limit artifact storage per publication. Existing public standard runners are preserved. Actual aggregate artifact usage and included allowance must be reviewed before enabling delivery; this implementation does not change billing settings or promise unlimited storage.

## Owned verification performed

- node --test scripts/delivery/bundle.test.mjs: five groups passed using one real preparation against existing builds, followed by isolated altered copies.
- Positive checks cover complete ZIP/extracted inventory and exact context. Negative checks cover wrong SHA/run/attempt/repository/origin/anchor, unsafe or overlong identity, out-of-root directories, extra/changed files, forged sizes, non-full scope, changed ZIP/extracted handler, hidden files, directory junctions and overlarge data.
- npx.cmd eslint scripts/delivery/bundle.mjs scripts/delivery/bundle.test.mjs --max-warnings 0 passed.
- Both workflow files parsed with the existing Prettier YAML parser; owned files were formatted and git diff --check passed. No YAML parser/actionlint/dependency was installed.
- No application build, dependency/global install, AWS operation, Git/settings mutation or persistent server was performed by this author. The test package uses deliberately fictional commit/run context; it is not a production-source attestation.

The root-owned integrated commands, executor/recovery tests and independent review042 must finish before publication. A local YAML parse does not prove GitHub workflow acceptance. No new hosted Deploy run, temporary-role assumption, imported remote checkpoint, real deployment or recovery has been observed by this author. DELIVERY_ENABLED must remain absent/false until root verifies the actual setup and durable state.

## Verified official action sources

- Existing checkout v7.0.1 and setup-node v7.1.0 remain pinned to the previously verified full commits.
- [Upload artifact v7.0.2](https://github.com/actions/upload-artifact/commit/cf430e030ddbb5b0abf93d22962f4752f3646cd9): full commit cf430e030ddbb5b0abf93d22962f4752f3646cd9; official metadata confirms retention/overwrite/hidden-file inputs and Node24 runtime.
- [Download artifact v8.0.2](https://github.com/actions/download-artifact/commit/9000827ccba6bdab643e8b6fd33ac0654aef8333): full commit 9000827ccba6bdab643e8b6fd33ac0654aef8333; official metadata confirms current-run artifact IDs, merge behavior and digest-mismatch error handling.
- [Configure AWS credentials v6.3.0](https://github.com/aws-actions/configure-aws-credentials/commit/e1253824e5c10ff9df46874f81ed3ec929e19cfd): full commit e1253824e5c10ff9df46874f81ed3ec929e19cfd; official metadata confirms audience, bounded role duration, allowed accounts, masking, credential cleanup and action timeout inputs.

Relevant aws-iam guidance was read for the temporary-role boundary; policy/provider creation remains outside this author's ownership. Final cloud authorization is the separately reviewed access/state contract, not the existence of this workflow.

## Coordinator hosted verification

Root observed successful feature-branch [CI run42109733203](https://github.com/dmytrorozhkov/platypus-service/actions/runs/42109733203) at exact source commit a0a08f0cc820e68098fe1cecacac4a9eae1b40db. The clean runner completed all required checks/builds/tests, including the 34 delivery groups; publication-only bundle/upload steps were skipped on this ordinary push. This is hosted CI evidence, not a manual Deploy/artifact transfer, AWS setup or live recovery proof. The implementation remains in feature/github-delivery and DELIVERY_ENABLED stays absent/false.
