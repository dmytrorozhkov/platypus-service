# Parallel implementation contract 051-054

Date: November 5, 2026. User authorized PostgreSQL preparation in parallel with safe package reading; preparation only, no AWS deployment/setup.

## Ownership

- delivery_executor owns051: scripts/delivery/artifact-reader.mjs and its tests, report051. No publication transport or AWS call. Validate explicit successful main Package selection, immutable repository identities, archive/envelope hashes, bounded download and safe extraction. Test real ZIP bytes through injected HTTP only. No credentials or signed URLs in output; credential setup remains future work.
- backend_next_slice owns052: explicit PostgreSQL repository/runtime/postgres-main entry, focused tests and report052. Preserve seven-field response and existing error/health contract. No fixture fallback in this entry. Do not alter existing fixture main/Lambda or cloud package; they remain the explicit accepted demo until cloud database deployment is separately designed.
- data_next_slice owns053: apps/server/database, data/unit/real integration tests and report053. Three business tables, ledgers, explicit transactional/checksummed migration/seed, deterministic fixtures, owner/runtime separation and marked disposable test database.
- Root owns054 integration: exact dependencies/lockfile, commands, GitHub PostgreSQL test job, real HTTP/browser/outage/same-storage restart checks, shared records/Git and final independent review055. One owner builds shared output at a time. Authors do not mutate Git/settings/cloud or other lanes.

## Environment and contract

No local PostgreSQL executable/service or Docker command was discovered. Use a fresh Linux GitHub-hosted PostgreSQL18 service for real tests; no Windows service, Docker Desktop, WSL change or AWS database is installed/provisioned. Reviewed official image: postgres:18.6-bookworm@sha256:f1ea2a1a4fb7b68d4836be1fdcb8a6466a89b072158bf9d97663600538c294c5. This is a test environment, not a selected production host. Driver pg8.23.1 and types8.23.1 were checked in npm and pinned in the server workspace; npm audit reported0 vulnerabilities during installation.

The dedicated entry requires explicit PGHOST/PORT/DATABASE/USER/PASSWORD. Missing/wrong config fails; database outages produce bounded sanitized errors rather than selecting fixtures. Default demo entry and Lambda stay fixture-backed and are explicitly documented, preserving existing startup/package contracts. User-visible database verification must invoke the PostgreSQL entry, never infer persistence from the demo.

Existing TicketRepository.list returns {items,total}, exactly seven fields, four statuses, nullable assignment and UTC instants, total===items.length. SQL uses platypus.organizations/support_agents/tickets and deterministic created_at,number ordering per016/045-047. No business write routes or real user data. Test-only owner writes demonstrate persistence; they do not authorize public CRUD. Cognito and server-enforced access precede business writes.

Data exports migrate(pool,{migrationsDirectory?}), seed(pool,{fixturePath?,identitiesPath?}) and pure seed validation. The real suite requires PGDATABASE=platypus_service_test, PLATYPUS_PG_TEST_OWNED=1 and a matching actual ownership marker table before writes; separately provisioned platypus_app_test receives SELECT only. It restores the initial25-row content after mutation tests. Root controls only the exact current GitHub job's pinned-image PostgreSQL container when testing outage/restart; no arbitrary instance or Windows service is stopped.

## Verification gates

Root/author focused checks, complete lint/format/types/build/server/lifecycle/federation/package/delivery checks and independent code review must pass. The Linux job proves real PostgreSQL migration/seed/constraints/runtime-read-only behavior, real Node HTTP and Support browser requests, saved edit across actual same-container-storage/database and API restarts, and Retry recovery from a real database outage. Failure is not replaced by a mock or skipped silently. A hosted CI job is test execution, not AWS deployment. CI packaging must wait for the database gate as well as the existing checks.

The learner remains the only future manual publication starter. No CodeBuild job, AWS resource/role/state change, automatic deployment trigger, secret creation, main promotion or cloud publication is included. Exact artifact download credentials and production PostgreSQL networking/cost/Lambda connection budget remain separately reviewed gates.
