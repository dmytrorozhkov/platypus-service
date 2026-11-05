# Task 039 — delivery workflow

Date: November 5, 2026. Branch: feature/github-delivery. Status: local implementation complete and reviewed in042; hosted CI pending; AWS setup/live proof blocked by connector availability.

The learner accepted Deploy implementation after completed main promotion037/038. Read AGENTS.md, PROJECT_PLAN.md5.40, proposals033–035/review036 and docs/architecture/039-delivery-contract.md. Owner: ci_implementation. Isolated write scope: .github/workflows/ci.yml, .github/workflows/deploy.yml, scripts/delivery/bundle.mjs, scripts/delivery/bundle.test.mjs and docs/implementation/039-delivery-workflow.md. Root owns package scripts, shared docs/configuration, Git and all live setup/execution.

Implement reusable checks/builds and manual main-only Deploy orchestration; package a portable exact-commit full release, artifact verification and bounded short retention. No AWS calls/settings or app/dependency changes.

Preserve the accepted fictional read-only application, existing resource ownership/topology/Free plan/shared-cap-ten, stopped local servers and deferred Sonar. No teardown, quota/upgrade, paid service, unrelated settings or subdelegation. Keep account/resource mapping in ignored local files, credentials out of files/logs/history. Tests use isolated temporary state; one owner builds/packages shared artifacts at a time. Apply relevant skills for AWS work, verify current primary sources and report actual checks/limitations. Stage assigned files in the coordinator workspace if writes are sandbox-blocked. Do not use Git mutations.
