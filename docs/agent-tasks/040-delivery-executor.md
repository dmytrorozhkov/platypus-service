# Task 040 — delivery executor

Date: November 5, 2026. Branch: feature/github-delivery. Status: local implementation complete and reviewed in042; hosted CI verified at a0a08f0; AWS setup/live proof blocked by connector availability.

The learner accepted Deploy implementation after completed main promotion037/038. Read AGENTS.md, PROJECT_PLAN.md5.40, proposals033–035/review036 and docs/architecture/039-delivery-contract.md. Owner: delivery_executor. Isolated write scope: scripts/delivery/ excluding bundle.mjs, _.test.mjs and access_; docs/implementation/040-delivery-executor.md. Root owns package scripts, shared docs/configuration, Git and all live setup/execution.

Implement portable durable state, baseline import/reconciliation, serialized conditional full publication, narrow backend change sets, fail-closed phase receipts and explicit compatible full recovery. Inject AWS transport for meaningful offline tests; use existing AWS CLI, no SDK/dependency install. No live AWS call, settings/Git/dependency/app/template mutation.

Preserve the accepted fictional read-only application, existing resource ownership/topology/Free plan/shared-cap-ten, stopped local servers and deferred Sonar. No teardown, quota/upgrade, paid service, unrelated settings or subdelegation. Keep account/resource mapping in ignored local files, credentials out of files/logs/history. Tests use isolated temporary state; one owner builds/packages shared artifacts at a time. Apply relevant skills for AWS work, verify current primary sources and report actual checks/limitations. Stage assigned files in the coordinator workspace if writes are sandbox-blocked. Do not use Git mutations.
