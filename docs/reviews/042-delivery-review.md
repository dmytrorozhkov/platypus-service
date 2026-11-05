# Independent Review 042 — Manual Delivery Preparation

Date: November 5, 2026. Branch: feature/github-delivery.
Scope: integrated implementation 039–043, reviewed independently of its authors.

## Result

No remaining confirmed blocker was found in the reviewed local preparation after the corrections below. This is not approval to enable delivery or evidence of hosted/cloud operation. Root's final repository-wide checks and the actual access/state setup gates remain separate.

The learner-approved scope is manual full publication and explicit compatible recovery of the existing application. It preserves the fictional read-only data, existing topology, Free plan, accepted shared cap, stopped local servers and deferred Sonar work.

## Review performed

- Read current AGENTS.md, PROJECT_PLAN.md5.40, task042, contract039, proposals033–035/review036 and implementation reports039–041/043.
- Inspected both workflows, bundle validation, executor/state/recovery paths, CLI/transport, access documents, target example and the independent failure tests.
- Applied the local aws-iam skill and its policy-generation reference. This review validates an explicit CLI-operation envelope; it does not derive application SDK policies or generate/attach live policies.
- Examined root's staged programmatic Service Authorization Reference evidence for operation/action/resource mappings; checked current official guidance where needed.
- Performed read-only source/document inspection only. No tests, builds, service starts, AWS calls, Git mutations, repository changes or policy simulation were run by this reviewer.

## Findings resolved during review

1. **Interrupted recovery lost its source-state proof.** Replacing a pending publication with a recovery plan originally discarded the still-visible publication candidate. A later recovery could reject legitimate mixed controls after a crash. The immutable recovery plan now retains validated starting controls and the starting backend manifest/fingerprint. The independent regression exercises recovery interruption, rejection of foreign bytes and a second typed recovery that completes safely.
2. **Reconciliation receipts prevented a later retry.** A single immutable reconciled receipt contained the requesting run context, so a failed final checkpoint write could make a different attempt conflict with that receipt. Receipts now include the requesting run/attempt in their key. The independent regression fails a reconciliation checkpoint write and then completes through a new explicit attempt without replaying publication.
3. **Initial-import interruption needed an explicit continuation.** The operator can now resume only the exact pending import with identical manifest, inventory, control and backend observations; normal import still rejects existing state. The independent partial-copy regression verifies that bounded continuation.
4. **CloudFormation Lambda observation requires its own read envelope.** The final access code includes narrowly scoped GetFunction/ListTags in the CloudFormation service role and GetFunctionConcurrency in publisher preflight. The publisher receives no GetFunction download capability. These declarations remain unproved live permissions, not a reason to broaden access after an unexplained failure.

The reviewer reread the corrected source and the added regression tests. Report041 records 24 passing independent state/publication tests after these corrections; this reviewer did not rerun them.

## Integrated boundaries checked

- Deploy is manual and canonical-main/repository restricted. Only the publisher job receives identity-token permission and enters aws-learning; publication/recovery share a non-cancelling concurrency group.
- Missing DELIVERY_ENABLED, role/account/target configuration or recovery identity stops before authentication. The placeholder target remains disabled and ownershipVerified false.
- Reusable CI checks out the immutable source SHA. Ordinary checks remain read-only and upload no bundle; publication packaging belongs to the same checked run.
- The bundle binds exact SHA/run/attempt/repository/origin, a full manifest and every file's hash/size. Path containment, link/case/hidden-file rejection and total-size limits constrain artifact reconstruction.
- The publisher selects only its run's artifact ID, checks the builder's envelope hash before AWS access and revalidates in the executor. It never rebuilds the accepted bytes.
- Temporary trust requires exact audience, immutable repository/owner identity, ref and environment. Actual claim shape, environment reviewer/branch rules and resulting roles still need live verification.
- Publisher rights cover conditional writes in one owned bucket and bounded backend UPDATE change sets. The dedicated service role limits backend mutation and exact PassRole; neither role grants teardown, IAM administration, topology changes or unrelated resources.
- Service Authorization Reference mappings constrain change-set actions to the backend stack and allow only the reviewed names/role. Template/parameter/resource inspection supplements IAM; the old planner's storage/edge writes are not executed.
- Preflight checks account, plan/credits/expiry, shared capacity without a function reservation, stable owned stacks/templates/outputs, existing service-role association and actual origins.
- Every object mutation is conditional and verified by independent SHA-256/readback. Fixed controls use observed ETags; immutable graphs remain retained; index is last.
- Portable private records preserve complete release bytes, immutable plans/receipts and conditional pending/completed state. Imported provenance remains manual-import/null; new hosted releases require exact source context.
- Ordinary retries cannot steal pending work. Explicit recovery admits only known baseline/candidate/inherited observations, checks retained code/configuration/origin and preserves historical immutable records with fresh checkpoint ETags.
- Real acceptance is mandatory through the existing live HTTP/browser checker before completion. The tests' supplied acceptance callbacks prove ordering only and are labelled accordingly.
- CLI/transport use explicit operations, argument arrays and temporary files; they do not execute an arbitrary operation plan or print AWS stderr, target secrets or signed download URLs.

## Evidence and remaining gates

- Report039 records five passing real-package/bundle groups and scoped formatting/lint checks; report041 records 24 passing fake-transport state/failure groups; report043 records five passing access-document groups. These are author/test-owner results, not this reviewer's executions.
- Root still owns final lint/format/type/build/integration/offline-suite execution, staged-diff review and the feature-branch CI result. Local YAML parsing does not prove hosted workflow acceptance.
- The AWS connector returned Unknown tool on root's read-only attempts. That is tool availability evidence, not an expired-session diagnosis or an AWS denial. No fresh inventory or cloud operation is inferred.
- No provider/role setup, persistent service-role association, environment/secret configuration, durable baseline import, hosted Deploy, real role assumption or live publication/recovery has been demonstrated in this stage.
- Keep DELIVERY_ENABLED absent/false. Refresh exact ownership/claims/permissions and review the concrete persistent service-role association before setup; then import the accepted baseline and prove bounded access before enabling a controlled live run.
- GitHub artifact handoff, AWS CLI/provider behavior and compatible live recovery remain empirical gates. Standard-runner/artifact and existing AWS usage limits need the recorded allowance review; no zero-bill guarantee is established.
- No database, sign-in, product AI/RAG, independent remote delivery, automatic push publication or Sonar implementation is implied by this preparation.

## Primary references checked

- [GitHub OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc) and [AWS IAM condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html).
- [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html).
- [AWS guidance for CloudFormation Lambda state observation](https://aws.amazon.com/blogs/compute/coming-soon-expansion-of-aws-lambda-states-to-all-functions/).

## Coordinator local integration evidence

After author handoffs, root ran npm.cmd run lint, npm.cmd run format:check and npm.cmd run test:delivery successfully: 34 tests, zero failures/skips. git diff --check passed. The broader existing checks/builds/offline suites will execute in the actual feature-branch CI run after the reviewed push; their new hosted result remains pending. No live AWS/setup evidence is inferred.
