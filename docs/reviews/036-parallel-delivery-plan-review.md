# Independent Review 036 — Parallel Delivery Plan

Date: November 5, 2026. Scope: proposals 033–035, planning only.
Reviewer: independent of the three proposal authors.

## Result and scope

- No confirmed architectural blocker remains in the proposed manual delivery design after the corrections below.
- This result accepts the proposals' internal consistency, not deployment readiness or authorization to implement them.
- Existing CI, application behavior, AWS resources, stopped local servers and the learner's deferred Sonar decision remain unchanged by this review.
- No hosted delivery workflow, role, durable checkpoint, executor or live recovery has been implemented or tested by task 036.

## Evidence examined

- Read AGENTS.md, PROJECT_PLAN.md sections 5.38 and 9, task 036, and staged proposals 033, 034 and 035.
- Inspected the current CI workflow, prepare/common/plan helpers and storage/backend/edge templates narrowly; no source modifications or broad test runs.
- Confirmed CI has no reusable-workflow entry, artifact handoff or AWS identity permission.
- Confirmed the current publication helper emits operations, including direct UpdateStack and storage/edge steps; it is not an authenticated executor.
- Confirmed runtime-pointer writes have conditions, while current full-publication index and fixed Shell writes lack equivalent conditional guards.
- Confirmed backend version/origin fingerprinting and stack-managed RollbackVersion exist, and private release/deployment namespaces are excluded from public reads.
- Checked current official GitHub immutable-subject and AWS claim-mapping documentation; no account, token or repository-settings inventory was performed.

## Concrete findings and corrections

1. Fixed Shell key classification needed clarification in 033. favicon.svg is a fixed key, unlike hashed Shell assets; treating every graph object as a new immutable key would reject changed bytes or encourage an unsafe overwrite. The corrected proposal preserves identical first-release bytes or requires an observed-ETag conditional replacement. Verify this classification in executor failure tests.
2. The original 034 permissions table rendered wildcard prefixes as Markdown emphasis. The corrected table preserves literal `mfe/analytics/*`, `mfe/administration/*`, `mfe/support/*`, `_deploy/backend/*` and `_releases/*` in code spans; verified in the final staged report before policy derivation.
3. CI evidence is hosted verification, not demonstrated learner acceptance. The final staged 034 now states that distinction; the public application's acceptance is separately recorded in earlier stages.

## Cross-proposal consistency

- Canonical main and environment aws-learning remain proposals. Current default is a different planning branch; dispatch prerequisites and the agreed merge/settings operation must be completed explicitly.
- Exact SHA flows consistently through checkout, checks, bundle, publisher validation and receipts. Imported manual baseline provenance remains unknown unless separately established; current HEAD must never be substituted.
- Complete private cloud manifests/state resolve the clean-runner gap. Absolute workstation paths must be reconstructed from portable object keys/hashes before using existing local manifest validation.
- Environment-wide serialization and conditional pending-state ownership cover both workflow and operator writers; cancel-in-progress false avoids terminating a publisher midway.
- Immutable phase receipts plus runtime/index/state ETags provide recovery observations. A partial publication must be reconciled from actual old/new hashes, not declared successful from an API response.
- Publication and recovery depend on compatibility across old/new frontend and backend combinations. Version 2 is the recorded current-origin candidate; retained version 1 is ineligible because of bootstrap.invalid.
- Both proposals preserve private origins, full graph verification, cache/MIME checks and the existing live checker; simulated browser failures remain explicitly simulated.
- Permissions separate operator setup from routine publication. The routine publisher must not execute existing planner storage/edge mutations verbatim.
- The dedicated CloudFormation role has persistent stack association and requires an explicit setup decision. Narrow stack access, service-role permissions and exact PassRole constraints work together; PassRole alone is insufficient.
- OIDC environment subjects omit the branch. Proposal 034 correctly adds an independent ref condition and environment branch restriction; current AWS documentation supports the stated claim keys.
- Trust and artifact integrity are separate gates. A valid cloud identity does not attest successful checks or the bytes being published.

## Conditions before implementation and first publication

1. Agree the canonical branch/environment, allowed reviewer arrangement, bounded implementation scope and persistent CloudFormation service-role association.
2. Derive exact call/action/resource mappings, verify repository claims/IDs, and review artifact/storage allowances without promising a zero bill.
3. Implement one shared executor/state owner and isolated workflow/access/recovery components; review their integrated source before any hosted writer.
4. Preserve the existing revision formula: SHA-256 of the backend ZIP hexadecimal SHA-256, newline, then exact allowed origin. Do not silently change this contract or confuse it with the base64 Lambda CodeSha256.
5. Prove stale ETags, duplicate/interrupted attempts, corrupt or wrong-run artifacts, wrong origin, unknown state and incompatible retained versions stop safely through meaningful local tests.
6. Import and reconcile the accepted baseline, then obtain a later authorized live proof of full publication and compatible recovery. Partial or failed checkpoint completion must remain pending until reconciled.

## Verification limits

- Review performed: documentation/code inspection and official-source checks only.
- Not performed: AWS reads/writes, role assumption, repository settings, workflow execution, builds, runtime/browser checks, failure injection or live rollback.
- Root owns integration, formatting/lint checks, corrected table verification and the final stage record; no check results are inferred here.
- Database hosting, Cognito, business writes, independent remote/backend delivery and Sonar remain separate future stages.

## Coordinator verification after integration

- Root integrated all three proposals and the independent review, then ran repository-wide npm.cmd run lint and npm.cmd run format:check successfully. git diff --check passed.
- Changes are limited to English planning/task/review documentation and working rules. No application/workflow/dependency or AWS/repository setting changes were made.

## Primary references

- [GitHub OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc).
- [AWS IAM and STS condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html).
