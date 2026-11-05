# Implementation 040 — conditional full delivery executor

Date: November 5, 2026. Branch: feature/github-delivery. Status: implementation prepared; independent integrated review and live setup remain separate evidence.

## Scope and interfaces

- Added `scripts/delivery/executor.mjs`, `transport.mjs` and `cli.mjs`; no application, dependency, template, topology or source API change.
- Executor accepts an injected transport: `request(service, kebabOperation, PascalCaseInput)`, `getObject(input)` returning bytes/checksum/ETag/metadata, and `putObject(input)` accepting Buffer Body with a required condition.
- The production transport invokes installed AWS CLI through argument arrays and private temporary JSON/body files. Its operation allowlist excludes deletion, direct alias/function writes and arbitrary services. AWS stderr/request bodies and signed credentials are not echoed.
- Exported operations are `importBaseline`, `publishDelivery`, `recoverDelivery` and `reconcileDelivery`; `validateTarget`, `validateContext`, `preflight`, `readState` and `validateChangeSet` support integration and verification.
- Publisher calls the CI owner's independent bundle verifier and requires the build job's bound envelope SHA-256, exact repository/source SHA/run/attempt and production origin. No publisher rebuild occurs.

## Durable state and publication

- Portable private `_releases/delivery/` records retain complete full manifests, all owned release files with hashes, operation plans and immutable phase receipts. Records contain no workstation absolute path.
- Conditional `current.json` changes from completed to pending before application mutation. Its ETag serializes hosted and cooperating operator writers. Pending state is never reclaimed by age or automatically cancelled.
- Imported manual provenance stays `manual-import` with null context; no current Git SHA is invented. Import proves owned stable stacks/templates/outputs, current alias/code/configuration/origin, complete graphs and fixed control bytes/ETags, then runs live acceptance before completion.
- An interrupted first import can resume only with its exact typed pending import ID and identical manifest/inventory/configuration/control observations; immutable existing files must still match. It never replaces another completed state.
- Every preflight verifies actual account, active FREE plan/usable credits/expiry, fresh accepted shared cap of at most ten with positive unreserved capacity, no function reservation, project-owned resources, unchanged reviewed templates and existing CloudFormation service-role association.
- Existing backend changes use UPDATE change sets and previous templates only. Resource/property inspection permits bounded Function/Version/live-alias changes; recovery permits alias-only changes. Parameters and role association are checked before execution; unexpected IAM, topology, replacement or nested operations stop.
- Immutable assets/packages use absent-key conditions and SHA/MIME/cache readback. Favicon, runtime configuration and HTML use observed ETags; index is last. Identical fixed bytes remain untouched. No historical graph or package is deleted.
- Existing live HTTP/browser checking receives actual CloudFront, bucket and Function URL origins. A completed immutable record/checkpoint follows successful acceptance and final resource/object readback, never API submission alone.

## Recovery and failures

- Errors leave pending state and the last verified phase receipts. There is no automatic rollback or blind control overwrite.
- Explicit recovery selects a previously completed private full release, reconstructs and revalidates its owned files, verifies retained code/origin/configuration before alias/control writes and accepts only known old/new/inherited mixed states. The bootstrap-origin version is incompatible.
- Recovery plans preserve validated starting control hashes and backend manifest/fingerprint, so a second typed recovery remains possible after an interrupted recovery. Foreign bytes/configuration stop before mutation.
- Recovered control ETags are fresh checkpoint observations, independent of historical immutable completion records. This permits a later publication while preserving those original records.
- Reconciliation changes no alias or public control. It completes only an observed fully accepted compatible state; per-reconciliation-attempt receipts allow retry after a final checkpoint conflict.

## Operator commands

All commands require an ignored private target file. There is no default action.

```text
node scripts/delivery/cli.mjs import --bundle <owned-release-directory> --target <private-target.json> --expected-alias-version <version>
node scripts/delivery/cli.mjs import --bundle <same-owned-release-directory> --target <private-target.json> --expected-alias-version <version> --expected-pending import-<release>
node scripts/delivery/cli.mjs publish --bundle <same-run-bundle-directory> --target <private-target.json> --source-sha <40hex> --run-id <decimal> --run-attempt <decimal> --repository dmytrorozhkov/platypus-service --envelope-sha256 <checked-build-64hex>
node scripts/delivery/cli.mjs recover --release <completed-release> --expected-pending <exact-operation-id-or-none> --target <private-target.json> --source-sha <40hex> --run-id <decimal> --run-attempt <decimal> --repository dmytrorozhkov/platypus-service
node scripts/delivery/cli.mjs reconcile --expected-pending <exact-operation-id> --target <private-target.json> --source-sha <40hex> --run-id <decimal> --run-attempt <decimal> --repository dmytrorozhkov/platypus-service
```

## Verification and limits

- Author ran targeted ESLint successfully and formatted the three owned source files. Invoking CLI without a command failed explicitly before creating a transport or making AWS calls.
- Independent task 041 reports all 24 offline failure/state tests passed, including interrupted recovery followed by typed recovery, publication after recovery, partial private-file import resumption and a new reconciliation attempt after a final checkpoint conflict. Its scoped ESLint/Prettier checks also passed. Integrated review and live proof remain separate evidence.
- No AWS/HTTP/browser call, cloud publication/recovery, service-role association, repository setting, credential creation, server start, broad build or Git mutation was performed by this author. Live transport/service behavior requires coordinator proof after integrated review.
- Existing fictional read-only application, stopped servers, Free plan/shared cap ten and deferred Sonar remain the scope.

## Primary references

- [S3 PutObject conditional writes and checksums](https://docs.aws.amazon.com/cli/latest/reference/s3api/put-object.html).
- [CloudFormation UPDATE change sets](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/create-change-set.html).
- [DescribeChangeSet output and property details](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/describe-change-set.html). It does not return RoleARN; the executor checks the existing stack association before creation/execution.
