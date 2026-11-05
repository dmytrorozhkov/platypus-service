# Controlled delivery preparation and parallel product planning 044

Date: November 5, 2026. Status: preparation authorized; next product implementation remains bounded by the contracts and environment gates below. No deployment authorized.

## Learner control and current boundary

The learner requested preparation first, review of code and all applicable tests before deployment, and personal manual control of publication. This supersedes earlier permission for the coordinator to execute live delivery. Agents may prepare code, configuration, tests and documentation and perform relevant read-only checks. They must not publish, recover a live release, import durable cloud state, create/change cloud resources or access policies, start a CodeBuild job (including a rehearsal), enable delivery or set up an automatic deployment trigger under this preparation approval. Cloud setup and the learner's exact-release manual launch are later explicit steps. Successful tests never imply publication authorization.

The existing public fictional demo stays as it is. Keep Free plan, accepted shared cap-ten, stopped local servers and deferred Sonar. GitHub checks are allowed; do not merge or promote deployment code to canonical main as a side effect of planning.

An instruction is not an enforced permission boundary. The currently connected AWS identity has broad administrator permissions subject to managed organization restrictions. A human-only launch claim requires a separately verified agent identity without deployment/start/retry, project/trigger/policy mutation, role-passing or role-assumption paths, and without access to the learner's administrator credentials. Repository and deployment-script approval must also cover the exact selected code. Feasibility of that separation in the current simplified AWS experience is unresolved; do not claim it exists. No agent role or account setting was changed here.

## Delivery lane stays first; product planning can overlap

Prepare publication of the already accepted fixture application first. The proposed alternative is checked GitHub packaging followed by a human-started CodeBuild publisher. The three parallel product lanes design the next incremental slice while delivery preparation continues. They do not silently make a database migration a prerequisite for publishing the current demo.

The coordinator successfully called CodeBuild ListProjects in eu-north-1: the result was empty. This proves this read operation is available; it does not prove CreateProject, role configuration, compute capacity, source connection or StartBuild permissions. Existing GitHub-provider observation is denied by organization policy as recorded in043. No creation or trial start was attempted.

## Concrete CodeBuild preparation backlog

1. Separate a manual package-only workflow from publication. Current CI uploads a bundle only when called with package_delivery=true; ordinary pushes and the standalone manual CI workflow do not currently produce one. Preserve exact main commit, successful checks, no AWS credentials, bounded artifact retention and complete bundle inventory.
2. Prepare an authenticated artifact reader scoped to this repository. GitHub's download-artifact endpoint requires Actions read access; a public repository does not make its ordinary Actions archive anonymously downloadable. Public run metadata alone is not an authenticated handoff. Select a reviewed credential mechanism with no AWS administrator key in GitHub; do not assume the AWS GitHub connector grants artifact-download permissions.
3. Require explicit repository, reviewed workflow, main ref, exact source commit, successful run, run attempt, artifact ID and trusted digest/envelope binding. Reject fork/PR, expired, oversized, mismatched or changed artifacts. Do not select latest or take a checksum from inside the same untrusted archive as its only integrity anchor. Downloaded redirects and extraction need bounded origin handling, no credential forwarding, path/link/size checks. Reuse039's byte and target checks; keep unknown manual baseline provenance.
4. Prepare a CodeBuild publisher with one writer, no automatic trigger and no build of application source. It must install/provision its own pinned execution dependencies and browser, use the exact reviewed publisher code and invoke the existing publication/recovery boundaries. Setup, downloads, waits and acceptance checks consume time even though application compilation stays in GitHub.
5. The current live checker supports PLATYPUS_BROWSER but otherwise discovers Windows Edge/Chrome paths. It is not proven on a Linux CodeBuild image. Prepare a Linux browser/runtime dependency path and run the existing complete acceptance groups there before choosing a small Linux machine; do not weaken checks or assume Windows is covered by the advertised free small-machine minutes. Source and current hosted CI are Windows-verified only.
6. Prepare scoped CodeBuild service access, CloudFormation role ceiling, private target/state and human runbook. Reuse043's operation limits with a CodeBuild service trust, not GitHub OIDC trust. Any persistent backend service-role association, baseline import or access installation waits for a concrete separately reviewed cloud setup step. Preserve conditional state/control writes, index-last publication and compatible version2 recovery.
7. Offline fault tests and local/in-CI rehearsal may validate downloads, hashes, selection, command preparation and simulated transitions without AWS mutation. Label those timings by measured phases. They do not measure CodeBuild provisioning, actual Lambda/CloudFormation waits or the full monthly allowance. An actual CodeBuild rehearsal is still a cloud execution and requires the learner's manual decision.

The advertised CodeBuild allowance is 100 monthly minutes on specified small on-demand compute types. This is conditional usage, not guaranteed zero cost. Additional artifact storage, logs, transfers, dependency installation and retained releases need a bounded estimate before setup. No CodePipeline, persistent runner, new paid service or database hosting was selected.

## Shared contract for the next product slice

Next proposed increment: replace the fixture repository with persistent PostgreSQL reads for the same 25 fictional tickets. Preserve GET /api/tickets returning {items,total}, total===items.length, exactly number/subject/organization/status/assignee/createdAt/updatedAt, four statuses, nullable assignee and equivalent UTC instants in deterministic order. Preserve the existing sanitized500 error envelope and HTTP-process-only /api/health. No pagination, write route, authentication placeholder, real customer data or new frontend library is included.

Three independent planning reports045-047 define backend, frontend and data ownership. Freeze their row/query and response contract before implementation. PostgreSQL hosting, complete cloud costs, network/credentials/connection management and an isolated real test environment remain unresolved. Both main.ts and lambda.ts currently construct FixtureTicketRepository; do not silently wire the live Lambda to an unprovisioned database. Preparation against a fake repository cannot establish persistence.

Implementers may work in parallel inside this one increment; integration and acceptance remain sequential. Existing016 remains the detailed model proposal, not an instruction to install native Windows PostgreSQL. Cognito sign-in and server-enforced access precede business writes; heavy-table queries, real Analytics/Admin, AI chat/RAG and background jobs follow as separately tested increments.

## Gates before a release decision

| Gate                    | Required evidence                                                                                   | Present status                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Shared interfaces       | One agreed response, artifact, identity and ownership contract                                      | Existing039 and proposed044-047; adaptation pending                         |
| Code and focused tests  | Relevant changed modules, negative cases and fault/retry tests                                      | Existing039-043 verified at a0a08f0; new CodeBuild adapter not implemented  |
| Integrated checks       | Lint, formatting, types, builds, server, lifecycle, federation, package/browser and delivery suites | Prior hosted run42109733203 passed for a0a08f0; not proof for a new adapter |
| Independent review      | No unresolved blocking finding on the exact candidate                                               | Review048 covers this preparation plan only                                 |
| Environment/access/cost | Actual allowed service configuration, bounded costs and verified human-only access                  | Unresolved; no cloud setup authorized                                       |
| Rehearsal               | No-mutation preparation evidence; timings explicitly limited                                        | New transport/CodeBuild timing not measured                                 |
| Release                 | Learner sees exact commit/bundle/digest, checks and rollback target, then manually starts           | Not authorized or performed                                                 |

For a later persistence release add real database constraint, migration/seed, same-storage restart, outage/Retry and runtime-read-only evidence from045-047. Local acceptance can precede cloud setup; environment validation and actual post-publication checks necessarily remain later. Never describe all cloud behavior as tested before the first actual cloud execution.

Sources: [CodeBuild service roles](https://docs.aws.amazon.com/codebuild/latest/userguide/setting-up-service-role.html), [manual start](https://docs.aws.amazon.com/codebuild/latest/userguide/run-build-console.html), [CodeBuild pricing](https://aws.amazon.com/codebuild/pricing/), [artifact download access](https://docs.github.com/en/rest/actions/artifacts#download-an-artifact). Actual source inspection: scripts/delivery/cli.mjs, executor.mjs, bundle.mjs; scripts/aws-live-check.mjs; .github/workflows/ci.yml.
