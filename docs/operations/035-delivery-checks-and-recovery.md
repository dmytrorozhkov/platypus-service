# Delivery Checks and Recovery Proposal 035

Date: November 5, 2026. Status: planning only; no implementation or execution approval.
Scope: manual delivery of the existing fictional 25-ticket application; no extra service, paid capacity or teardown.

## Current evidence and boundaries

- Reports 029/030 establish the first live release, all three completed stacks and six HTTPS/browser groups; report 032 establishes one successful hosted CI run.
- Current stable Lambda alias version is 2 with the real distribution origin; retained version 1 contains bootstrap.invalid and is **ineligible for live rollback**.
- Existing aws:plan only prints plans. No hosted deployment executor, durable remote checkpoint or live full/remote/backend rollback is implemented or verified.
- Current manifests/current-deployment.json are ignored workstation files; a clean runner cannot use them. This proposal does not perform new cloud, HTTP, browser, inventory, build, test or rollback operations.

## Required state before a hosted writer

- Reuse a private namespace in the existing artifact bucket: immutable release manifests and run/phase receipts, plus a conditional mutable delivery-state checkpoint; keep it excluded from CloudFront reads.
- Record release/source SHA, complete per-app keys/hashes, contract versions, backend code/config hash, alias version/origin, runtime-pointer and index hashes/ETags, prior checkpoint and verification outcome.
- A trusted operator must first import/reconcile the existing release against actual stack outputs, alias, served controls and retained graph checksums; refuse missing or inconsistent baseline data.
- The current records lack an attested source SHA. Mark imported provenance unverified if it cannot be established; never substitute current HEAD. The first exact-SHA hosted release establishes new provenance.
- Store the canonical rollback documents/graphs and receipts outside disposable runner storage. GitHub logs/artifacts alone must not become the only recovery source.
- Retain current and preceding verified compatible releases; cleanup is a separate reviewed decision, not an automatic response to a failed deployment.
- Mark pending run/SHA/expected state before the first cloud mutation; append phase receipts and publish a completed checkpoint only after acceptance. A crash leaves pending state requiring explicit reconciliation.

## Preflight and mutation gates

1. Resolve canonical branch/manual-button prerequisites with 033 and scoped temporary access with 034; deliver the exact reviewed SHA whose required CI passed, not a moving branch tip.
2. Verify intended identity, region, owned resources, FREE/ACTIVE plan, usable credits and freshly accepted shared-cap-ten quota. Stop on mismatch; do not upgrade, increase quotas or add a service.
3. Check no stack operation or unresolved delivery is active; compare alias/config/hash, runtime pointer and index with the durable checkpoint and obtain their current ETags.
4. Serialize all delivery/recovery jobs for this environment with cancel-in-progress false; external operators must honor the same pending-state protocol. Workflow concurrency alone does not lock S3 or CloudFormation. [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
5. Require compatibility while old documents remain open: existing API and mount/config contracts must work across the intermediate old/new combinations. An incompatible transition needs its own staged design.
6. Upload new immutable graphs/package and verify every referenced checksum, MIME/cache metadata and exact origin before changing aliases or frontend controls; never overwrite an immutable graph with different bytes.
7. For a full release, complete and verify the backend stack/version first, then replace runtime configuration conditionally, then Shell HTML conditionally. Preserve old Shell hashes and remote releases; no routine wildcard invalidation or graph cleanup.
8. Use If-None-Match for new immutable keys and If-Match for observed mutable state/control ETags; treat ETags as concurrency tokens, not SHA-256 substitutes. On conflict, stop and reread before any approved recovery. [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html).

## Post-publication acceptance

- Wait for terminal successful stack state, correct alias version/code/config/origin, and deployed/enabled distribution; a submitted update is not success.
- Read back controls and verify pointer/index hashes plus every referenced graph; reject stale localhost configuration or metadata pointing outside the intended origin.
- Run the existing live checker with all three actual origins supplied: exact 25 API values/no-store, three direct routes/refresh, generated federation, cleanup, immutable assets, private/missing-path errors and denied anonymous origins.
- Preserve browser-controlled 503/Retry, mobile width/scroll checks and request/error evidence; label the 503 as simulated, not a real Lambda outage.
- Save run/SHA, hashes, alias/configuration, controls, acceptance receipts and observed plan/credits durably, then conditionally mark completed. A failed checkpoint write leaves reconciliation pending, not permission to redeploy blindly.

## Failure stops and compatible recovery

- Before alias/control changes: leave the current release serving; retain the failed run's immutable assets/receipts for inspection rather than deleting resources automatically.
- After an alias/control change: stop subsequent writes and mark the last confirmed phase; reread actual alias, pointer, index and stack state. CloudFormation rollback does not restore independent S3 publications.
- A pointer success followed by index conflict is a partial publication. Compare both objects with known old/new hashes and phase receipts; explicitly complete or recover only if ownership/state still matches. Never overwrite an unknown intervening publication.
- Full recovery: choose a previously verified complete compatible release, recheck all retained objects, restore its runtime pointer and index using current conditional ETags, then restore its compatible alias through the backend stack parameter; verify every completed step and rerun acceptance.
- Remote recovery: verify every retained selected-remote file, merge only that remote into the observed current pointer and replace it conditionally; preserve other remotes and backend, record the merged checkpoint and reload a document before checking it.
- Backend recovery: verify the chosen published version belongs to this function, has the exact live origin and compatible API/configuration; use stack-managed RollbackVersion, wait and verify alias/hash before acceptance. An alias points to a published version; retention alone does not prove suitability. [Lambda aliases](https://docs.aws.amazon.com/lambda/latest/dg/configuration-aliases.html).
- Version 2 is the present known-good candidate for the next compatible release; version 1 is not. Do not automatically choose the previous integer or silently republish an unknown package.
- On unknown state, failed recovery or expired credentials, preserve receipts/pending state and stop for operator review. No blind restart, automatic destructive rollback, IAM expansion or teardown belongs to recovery.

## Implementation ownership and first live proof

- 033 defines exact-SHA/manual flow and the single executor owner; 034 defines bootstrap/access boundaries; 035 supplies these gates. Root integrates shared state/configuration; an independent reviewer checks the consolidated proposal.
- First approved delivery should be full-release only with unchanged API/mount contracts. Independent remote delivery/recovery can follow; the distinctions above are requirements, not implemented buttons.
- Before enabling mutation, exercise failure injection locally around upload, alias, pointer, index and checkpoint phases; prove stale ETags, duplicate runs, interrupted runs and incompatible version 1 fail closed.
- A later explicitly authorized live proof must cover a controlled compatible release, full recovery and recovery acceptance with durable state. Per-remote/backend-only recovery require their own live evidence before being called verified.
- Already verified: the original public routes/private-origin checks and one CI run. Unverified: hosted delivery access/executor, durable state bootstrap, live rollback and real infrastructure outage recovery.
- Public fictional data remains unauthenticated. Stale LOCAL labels are a separate minor content issue; observed credits/parallelism never establish a zero bill or monthly spending cap.
