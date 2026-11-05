# Proposal 033 — Manual GitHub-to-AWS delivery

Date: November 5, 2026. Branch: planning/github-delivery. Status: proposal only.

## Current facts

- CI has passed on GitHub, including a clean Windows install, five builds and offline ZIP/Edge checks.
- CI currently has push/pull_request/dispatch triggers, no workflow_call, artifact handoff or AWS access.
- aws:prepare produces owned full releases and hashes; aws:plan prints operations without executing them.
- The running private S3/CloudFront/Lambda deployment is accepted. Actual state/manifests remain in ignored .local/aws; a clean hosted runner cannot recover them from Git.
- Current runtime-pointer replacement is conditional. Existing full publication does not condition index.html writes or persist a durable cloud checkpoint; these are implementation gaps.

## Canonical branch and exact source

1. Recommend main as the future canonical/default branch, established from the reviewed current history through an agreed merge. The current default remains planning/aws-first-deployment; no branch/default change is authorized here.
2. Add a manual Deploy workflow only after that decision. workflow_dispatch requires the file on the default branch. Restrict delivery to the agreed canonical ref; no automatic push deployment initially.
3. Capture github.sha once and require checkout, checks, packaging, release manifest and publication receipts to use that exact immutable commit. Reject branch-name inputs that could resolve differently between jobs.
4. Reuse existing CI through a proposed workflow_call entry rather than duplicating its commands. Its build/package job checks out that SHA, keeps read-only GitHub access and has no AWS identity-token permission.
5. A separate publisher job waits for successful checks and the agreed environment gate. It accepts only this run's validated package output, not a PR artifact or a user-supplied download URL.

## Build-to-publisher contract

- Retain the existing Windows runner, pinned tools/actions, lockfile install, checks and real packaging/browser verification.
- The build job creates one full release for the configured public distribution origin. The publisher independently verifies that origin against owned live resources before any write.
- Use a bounded identifier derived from commit/run/attempt within the existing 48-character release limit; reject collisions instead of overwriting immutable paths.
- Proposed bundle: release owner marker, complete manifest, all object bytes, extracted-handler verification evidence and a release envelope containing schema, source SHA, workflow run/attempt, full scope, origin and hashes.
- Transfer that bundle through a short-retention GitHub artifact with a pinned official action and verified digest; document/check the included storage allowance before enabling it. Do not upload credentials or account/resource identity records.
- No shared mutable build directory, dependency cache or runner filesystem is the source of deployment truth. Rebuilding during publication is forbidden; verified bundle bytes are the publication bytes.

## Durable state and first hosted writer

- Reuse private _releases paths in the existing bucket for immutable manifest/bundle records, pending phase receipts and a conditionally updated current checkpoint; add no new AWS service.
- Before first use, the operator imports the accepted local release and reconciles it with live stack outputs, current alias/code/origin, runtime/index bodies and ETags, and all referenced object hashes.
- The existing baseline has no attested deployed source SHA. Mark that provenance unverified unless independently established; never assign current HEAD to old deployed bytes. The first checked-SHA hosted release establishes the new provenance.
- Current local records include an absolute manifest path; design a portable schema using object keys/hashes, never a computer path. Reconstruct validated owned files locally when existing ownedManifest requires them.
- The checkpoint must identify the completed source/release, manifest hash, backend version/revision, runtime/index hashes and ETags, and owned target identity. Keep identity details private.
- The publisher reads and verifies fresh state, identity, project ownership, Free plan and accepted concurrency before writing. Missing state, drift, an unresolved pending attempt or stale ownership stops delivery.
- Reconcile stale checkpoints from observed resources and immutable receipts; never infer success from a finished API call or from one current pointer alone.

## Publication order and serialization

1. Use one environment-wide deployment concurrency group across dispatch/recovery, with cancel-in-progress false. Do not cancel an in-flight publisher; queued-run behavior is not a durable work queue.
2. Conditionally transition shared state from completed to pending using its observed ETag, then append immutable phase receipts. All writers, including operator tools, must honor this ownership; stale pending state requires reconciliation, not timeout takeover.
3. Upload the immutable backend package, retained previous controls and complete new Shell/remote graphs using absent-key conditions; reuse existing identical objects only after hash verification.
4. Inspect a bounded change set for the existing backend stack and wait for completion through the scoped access contract in 034. Preserve storage/edge topology and stop on unexpected replacement, IAM expansion or policy drift.
5. Confirm the resulting version's code/origin and compatibility with the still-visible frontend. The first delivery preserves the current API/mount contract; later incompatible changes require another design.
6. Verify every object, checksum and cache header referenced by the next runtime/index, then replace runtime-config.json with its observed If-Match ETag and index.html last with its own observed If-Match ETag.
   Classify all fixed Shell keys, including favicon.svg: preserve identical bytes for the first delivery or condition their replacement on observed ETags. Hashed assets use immutable absent-key writes.
7. Verify the live application using existing aws-live-check HTTP/browser groups. Only then conditionally advance the completed checkpoint and record the resulting alias/pointer/index observations.
8. Preserve prior immutable graphs and packages. Partial writes, conditional conflicts, validation failures or interrupted runs leave pending evidence and follow 035; no blind overwrite, automatic destructive cleanup or unverified rollback.

## Missing work and isolated ownership

- Root: obtain implementation/branch decision, integrate contracts, manage shared configuration and approved first-use import.
- CI owner: reusable check/package interface, portable release envelope, bounded artifact handoff and manual workflow orchestration.
- Delivery owner: authenticated executor interpreting verified plans, change-set validation/waits, full-object verification, conditional index/control/checkpoint writes and idempotent phase receipts. Plans are not executable SDK payloads.
- Access owner 034: operator-created temporary trust/roles, environment restrictions and narrow existing-resource permissions; no runtime IAM bootstrap.
- Recovery owner 035: observation schema, failure boundaries, compatible recovery ordering and acceptance tests. Independent review follows integration.
- Initial delivery updates the complete release. Independent remote/backend buttons, automatic deployment, database changes, new paid services and cleanup remain later decisions.

## Acceptance before enabling Deploy

- A clean runner produces a complete checked-SHA bundle; corrupt/wrong-run/wrong-origin artifacts and untrusted refs are rejected before AWS writes.
- A first-use import proves existing live state without this computer; a second run reads the durable checkpoint and refuses drift or unresolved attempts.
- Concurrent publication and injected pointer/index/state conflicts preserve evidence and stop; recovery verifies the observed mixed state before any correction.
- An authorized real manual deployment passes live HTTP/browser/private-origin/cache checks and records exact source, artifacts and final state. This proposal has executed none of these operations.

## Primary references

- [GitHub workflow events and dispatch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).
- [GitHub reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows).
- [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html).
