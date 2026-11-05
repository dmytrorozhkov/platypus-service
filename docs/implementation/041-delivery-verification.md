# Implementation 041 — Independent delivery failure verification

Date: November 5, 2026. Branch: feature/github-delivery.
Scope: scripts/delivery/publish.test.mjs and scripts/delivery/state.test.mjs.

## Result

Implemented 24 deterministic tests against the actual delivery executor and bundle verifier. All passed locally. The author did not change production implementation, workflow, dependencies, Git history, repository settings or AWS resources.

The fake transport enforces object checksums, ownership fields and conditional writes; unknown cloud calls fail instead of receiving permissive defaults. Each publication scenario first successfully imports a complete baseline. Fixtures contain tiny complete remote graphs, fixed Shell controls, retained controls and the five-file Lambda inventory. Their synthetic archive bytes exercise publication and recovery ordering; the separate task039 packaging tests prove actual ZIP creation/extraction.

## Verified invariants

- Successful full publication acquires the pending checkpoint before backend/control changes, changes the backend before the runtime pointer and index, and completes only after the supplied acceptance callback succeeds. Imported source provenance remains manual-import with no invented commit; a hosted release records its exact source/run context.
- Wrong source SHA, run, attempt, origin, checked envelope digest and corrupted artifact bytes stop before cloud mutation. Duplicate/current releases and unresolved pending operations cannot become fresh publications.
- A competing checkpoint ETag wins without an overwrite. Candidate immutable-key collisions retain the foreign bytes, pending evidence and the original serving controls/backend.
- Runtime and index conflicts, a failed pointer receipt, failed acceptance and failed final checkpoint stop later unsafe writes. Ordinary retries remain blocked. Explicit checkpoint reconciliation completes an already accepted release without replaying backend/control changes.
- A retained version1 with bootstrap.invalid is rejected before recovery mutations. Successful full recovery preserves the immutable original record, records fresh control ETags and permits a later fresh publication.
- Known mixed pointer/index state can be recovered only with the exact pending identity. Regression for review042: a recovery that itself crashes after lock/backend changes preserves its inherited mixed-state proof for the next explicit recovery; unknown intervening control bytes are rejected without writes.
- A failed first import resumes private-file copying only with its exact original pending identity and unchanged immutable plan. A new explicit reconciliation attempt succeeds after an earlier reconciliation checkpoint failure, without replaying publication or conflicting with the prior attempt receipt.
- State inspection distinguishes an absent object from denied/expired/service errors, validates body SHA independently of opaque ETags and rejects wrong target, schema, status, digest and pending-plan paths.
- Change-set review rejects storage/topology changes, IAM expansion, unexpected properties, function replacement, pagination/nested/import expansion and recovery changes beyond the alias version. Preflight stops on wrong account, paid/expired/exhausted plan or unaccepted quota/capacity.

## Checks performed

- node --test scripts/delivery/publish.test.mjs scripts/delivery/state.test.mjs — 24 passed, zero failed/skipped.
- npx.cmd prettier --write scripts/delivery/publish.test.mjs scripts/delivery/state.test.mjs — formatted assigned files.
- npx.cmd eslint scripts/delivery/publish.test.mjs scripts/delivery/state.test.mjs --max-warnings 0 — passed.

Root owns repository-wide lint/format checks, integration and independent review042. No application rebuild, shared release preparation, listener, browser, network call, AWS call or real deployment/recovery was performed by task041. The fake acceptance callback verifies executor ordering; it does not establish live HTTP/browser success. Actual AWS identity/policy behavior, hosted artifact handoff and the first authorized live publication/recovery remain separate evidence gates.

## Coordinator hosted verification

Root observed successful feature-branch [CI run42109733203](https://github.com/dmytrorozhkov/platypus-service/actions/runs/42109733203) at exact source commit a0a08f0cc820e68098fe1cecacac4a9eae1b40db. The clean runner completed all required checks/builds/tests, including the 34 delivery groups; publication-only bundle/upload steps were skipped on this ordinary push. This is hosted CI evidence, not a manual Deploy/artifact transfer, AWS setup or live recovery proof. The implementation remains in feature/github-delivery and DELIVERY_ENABLED stays absent/false.
