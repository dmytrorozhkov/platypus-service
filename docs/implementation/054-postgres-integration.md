# Integration 054 — PostgreSQL and safe archive preparation

Date: November 6, 2026. Status: locally integrated and source reviewed; actual hosted PostgreSQL execution pending the reviewed feature push. No AWS or CodeBuild execution/publication.

## Result

Integrated artifact-reader051, explicit PostgreSQL backend052 and data model/tools053. Exact pg8.23.1 and types8.23.1 are pinned in the server workspace/lockfile. The default demo main and Lambda deliberately remain fixture-backed; only postgres-main selects the database repository, and it has no fixture fallback. Public write routes, authentication, cloud database hosting and production connection/TLS/pooling design remain future work.

No PostgreSQL or Docker was installed on the learner's computer. The CI workflow adds a disposable Ubuntu job with pinned PostgreSQL18.6 image/digest, a fresh marked platypus_service_test database and distinct owner/runtime roles. These example credentials exist only for that temporary test service; they are not cloud or user credentials. Only this exact current-job container may be stopped/restarted, after image, ID, actual database and ownership marker checks. GitHub cleans up the runner/service after the job.

The database gate runs actual transactional migration/seed/concurrency/rollback/checksum/constraint and runtime privilege tests. A real Node HTTP child then queries PostgreSQL, with real browser requests from standalone Support and the integrated Shell. Test-owned owner edits must survive repeated seed, actual same-container/storage database stop/start and HTTP process restart. During actual database outage, HTTP liveness remains available while tickets return a sanitized error and Retry cannot substitute examples. Recovery must succeed through Retry without frontend/API restart. React/Vue navigation is included. Ordinary Windows checks and optional package creation depend on this database gate.

## Commands and operation boundaries

The usual npm.cmd start command remains the fixture demo. For a separately prepared local database, explicitly set PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD in the process environment; do not paste credentials into chat or commit them. The database entry accepts loopback hosts only. Use setup-owner credentials for npm.cmd run db:migrate, npm.cmd run db:seed and npm.cmd run db:check; the check reads the migration ledger. Migration and initial seed are explicit commands, never application startup behavior. Seed is not a repair/reset command: unchanged seed preserves later edits/deletions and drift fails.

After build, use distinct least-privileged runtime credentials with CONNECT, schema USAGE and SELECT on the three business tables, then npm.cmd run start:server:postgres. The program never provisions a service or database or grants roles. CLI setup does not configure production networking/TLS. No local service or demonstration is claimed here because none exists on the learner's computer.

CI-only commands are node scripts/postgres-ci-setup.mjs, npm run test:postgres:integration and npm run test:postgres:browser. The setup/restart helpers refuse ordinary local execution. Browser evidence is written under ignored .local/evidence in the runner; no screenshot persistence/upload is claimed. Review055 inspected database/integration source; review056 independently inspected the archive reader. Root owns dependencies, shared workflow, integration and Git.

## Verification observed before feature publication

All five workspace builds passed locally. Server tests:24/24; microfrontend integration:2/2; startup/cleanup:3/3; delivery:46/46 including nine actual-byte archive reader groups. Lint, formatting and types passed during integration. Final offline infrastructure/package/browser checks and actual hosted database results are recorded below after execution; these results are not inferred from written test files.

The archive reader has no authenticated real artifact download evidence: its network is injected in offline tests, including a realistic streaming ZIP and full nested Lambda package. GitHub access provisioning, reviewed receipt selection, actual Package run/download, CodeBuild setup/start and technical human-only publication credentials remain separate gates. No main promotion, repository settings/secret, delivery enablement, AWS mutation or live publication occurred.

Local offline infrastructure validation completed successfully with no errors/warnings (21 create-only informational notes), and all9 offline packaged/browser groups passed. These checks used local owned temporary listeners and closed them afterward. They made no AWS calls/publication. All46 delivery groups and24 server groups had no skips/cancellations/failures. Actual PostgreSQL tests remain pending the hosted push; the local injected-pool checks are not SQL execution evidence.
