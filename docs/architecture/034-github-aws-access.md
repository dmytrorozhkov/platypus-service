# Proposal 034 — Temporary GitHub-to-AWS access

Date: November 5, 2026. Status: planning only; no access or delivery implementation approved.
Scope: the existing private S3, CloudFront and Lambda deployment; apply the local aws-iam skill.

## Current facts and decisions still needed

- The learner accepted the public application; hosted CI passed its recorded checks, with learner acceptance not established. CI has no AWS access. Actual ownership records remain private and local.
- Current default is planning/aws-first-deployment. Following 033, propose main as the future canonical branch and aws-learning as the delivery environment; neither setting changes here.
- The repository was created in November 2026 according to the task context. Numeric repository/owner IDs, actual OIDC customization, provider and role availability have not been inspected in this task.
- The imported manual deployment has no attested source SHA. Preserve that unknown provenance; every new hosted release must carry the exact checked SHA, run/attempt and complete byte hashes.
- Before implementation, approve the canonical branch/environment, trusted reviewers, initial state import and exact owned-resource mapping. Do not infer these from a moving HEAD or runner files.

## Exact trust boundary proposed

- OIDC means OpenID Connect: GitHub supplies a short-lived identity token; AWS STS exchanges it for temporary role credentials. Store no long-lived AWS access key in GitHub.
- Trust only the intended account's provider for https://token.actions.githubusercontent.com, using sts:AssumeRoleWithWebIdentity and exact audience sts.amazonaws.com.
- For a new post-July-15-2026 repository, the expected environment subject is repo:<owner>@<owner-id>/<repository>@<repository-id>:environment:aws-learning. Replace every placeholder from verified metadata; this is an exact StringEquals value, never a wildcard policy. [GitHub subject format](https://docs.github.com/en/actions/reference/security/oidc).
- Verify the actual subject configuration and a redacted claim comparison before installing trust. A customized or unexpected format stops setup; never silently allow the legacy name-only subject.
- Require StringEquals for token.actions.githubusercontent.com:aud, :sub, :repository_id, :repository_owner_id, :ref = refs/heads/main and :environment = aws-learning, with the same verified identities throughout.
- Current AWS documentation maps these GitHub claims into trust conditions; they are unavailable as later session keys. Use the AWS mapping rather than older guidance claiming custom claims are unsupported. [AWS condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html).
- The environment subject omits the branch, so retain the independent ref condition and an environment selected-branch rule for main only. Allow no tags, pull-request refs, fork identities or other environments.
- Configure a required human reviewer. Public repositories support reviewers and branch restrictions on GitHub Free; a sole learner must leave self-review possible unless another reviewer exists. Avoid protected-branches-only, which permits all branches if none are protected. [Environment rules](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).
- Only the approved publisher job receives id-token:write and contents:read. Build/PR jobs get no AWS role; request a bounded session, proposed 30 minutes, with run/attempt in its session name.
- Trust establishes identity/ref/environment, not successful CI or artifact integrity. The 033 executor must independently bind checked SHA, run/attempt, origin and hashes before cloud writes.
- Do not invent workflow_ref conditions. A future reusable publisher may additionally require supported job_workflow_ref after its actual claim is verified; ordinary jobs do not supply that reusable-workflow claim.

## Operator setup versus routine publisher

- Setup operator: verify ownership and Free-plan permissions; create or reuse the exact provider, publisher role and a dedicated CloudFormation service role; review their trust and permissions. No role/provider operation is performed by this proposal.
- Associating a service role changes the existing stack execution authority and needs explicit setup approval. The association persists and cannot simply be removed later; it must not grant a general infrastructure administrator to CI.
- Publisher may pass only that exact service-role ARN to cloudformation.amazonaws.com, constrained with iam:PassedToService; never grant PassRole on arbitrary roles.
- The service role trusts CloudFormation and may manage only the existing function's reviewed code/configuration, published versions and live alias, with necessary reads and the existing ZIP prefix.
- If required, its PassRole is limited to the existing Lambda execution role and lambda.amazonaws.com. No IAM role/policy mutation, new function, URL permission expansion, topology change or log retention change belongs to routine publication.
- Existing backend-template IAM resources must remain unchanged. Derive and validate exact action/resource mappings during approved implementation; a denied operation is a review stop, not permission to add AdministratorAccess.
- CloudFormation service-role permissions can remain usable by actors allowed to operate its stack. Restrict backend stack/change-set access as well as PassRole; protecting PassRole alone is insufficient.
- Infrastructure changes, IAM setup, ownership repair and initial state reconciliation remain separate operator work; routine recovery uses the same bounded publication authority.

## Routine permission envelope to implement

| Purpose                | Proposed boundary                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3 object reads/writes | One verified existing bucket: `mfe/analytics/*`, `mfe/administration/*`, `mfe/support/*`, `_deploy/backend/*`, `_releases/*`, exact public controls/favicon and approved root Shell hash filename patterns. |
| S3 listing             | Only that bucket and required prefixes; list/read old compatible release graphs for verification. No account-wide bucket listing.                                                                           |
| Backend change set     | Create UPDATE change sets, inspect/execute and read status/template/resources for the existing backend stack only; bind the dedicated service-role ARN and owned change-set namespace.                      |
| Backend observation    | Read only the owned function/version/alias/configuration/URL policy needed for compatibility and ownership checks; backend mutation stays stack-managed.                                                    |
| Edge observation       | Read the existing distribution/configuration and storage/edge stack outputs needed for ownership; no distribution, bucket policy or origin grant updates.                                                   |
| Recovery state         | Private immutable manifests/phase receipts and conditional shared checkpoint in the same _releases namespace; no deletion or teardown authority.                                                            |

- No CreateStack, DeleteStack, direct alias update, DeleteObject, bucket administration, IAM administration, quota change, account upgrade or unrelated resources.
- Root Shell objects currently live at the bucket root; S3 ARN patterns cannot validate a manifest or byte hashes. Review filename scopes and enforce hashes/absent-key writes in the executor rather than claiming IAM alone guarantees immutability.
- A stack-scoped change-set permission does not constrain arbitrary template bytes. Review the proposed diff, deny resource additions/replacements/permission changes, and rely on the narrow service role as the separate AWS permission ceiling.
- Account identity, ownership, plan/credit and quota preflight may require additional read-only actions; enumerate the chosen calls and any unavoidable non-resource-scoped reads explicitly before approval. Do not add broad billing or service wildcards implicitly.

## State, cost and ownership contracts

- Root owns verified private target identity, initial import, explicit service-role setup approval and shared configuration. Public numeric GitHub IDs are not secrets; never publish account/resource inventory or credentials in tracked reports or artifacts.
- 033 owns the manual exact-SHA workflow, validated artifact handoff and executor; 034 owns this access contract; 035 owns pending/completed state, conditional writes, compatible recovery and acceptance.
- Keep _deploy and _releases private to CloudFront. Use 035's complete graph checks and conditional checkpoint/control writes; temporary runner storage and GitHub logs cannot be the only recovery source.
- Preserve existing Free plan, accepted shared-cap-ten and reviewed services. This proposal adds no paid service, larger runner or account/repository plan upgrade; artifact/state storage and requests still need the bounded allowance review in 033.
- If Free-plan IAM capabilities cannot support these roles or restrictions, stop and present the concrete restriction. Do not weaken trust or upgrade automatically.

## Acceptance before enabling publication

1. Record verified repository/owner IDs, actual subject format, canonical ref, environment reviewer/branch settings and exact existing-resource ARNs privately; require a reviewed minimal permission diff.
2. Prove trust rejects wrong audience, repository/owner IDs, ref, tag/PR context and environment; approve only the intended publisher. Do not log raw tokens or temporary credentials.
3. With later authorization, assume the role and perform bounded read-only ownership checks before any write; prove forbidden IAM, deletion, unrelated-resource and topology operations are excluded through policy review/simulation, not destructive probes.
4. Verify the checked-SHA bundle and imported baseline, fail closed on unknown/drifted state, then use 033/035 publication and compatible recovery gates. Baseline version 1 with bootstrap.invalid is never a rollback candidate.
5. Independently review policy/action mappings and executor failure tests before the first authorized live delivery. No provider, role, trust, workflow, account setting, live assumption or publish/recovery test has been executed by task 034.
