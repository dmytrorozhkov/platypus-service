# PostgreSQL Data Preparation 053

Date: November 5, 2026.
Status: implementation prepared; pure-input checks passed locally. Actual PostgreSQL integration, outage/restart and browser evidence remain pending the coordinator's isolated hosted test job. No database installation, AWS resource, setting change or deployment was performed by this lane.

## Bounded model and preserved contract

`apps/server/database/001.sql` implements the three business tables from design016: `platypus.organizations`, `platypus.support_agents` and `platypus.tickets`. Explicit stable UUIDs in `seed-identities.json` separate internal relationships from display names and PS ticket numbers. This file contains identities/references, not a second copy of ticket subjects or dates. The authoritative content remains `apps/server/src/fixtures/tickets.json`.

The schema enforces primary keys, unique human-facing numbers, required and nonblank text, four accepted statuses, restrictive directory foreign keys, finite millisecond timestamps and noninverted creation/update times. Display names need not be unique. An unassigned ticket is valid; status/assignment combinations are not prematurely restricted. The created-time/number index matches the current stable read order, without claiming measured large-table performance.

The backend's existing seven-field `{items,total}` collection remains unchanged. This stage does not implement writes, authentication, 100,000-ticket pagination or public database connectivity. Fictional support-agent directory entries do not grant application permissions. Cognito/PostgreSQL/DynamoDB allocation remains as agreed.

## Explicit operations

`migrate-seed.mjs` exports:

- `migrate(pool, { migrationsDirectory? })`: apply numbered SQL files with immutable LF-normalized SHA-256 checksums; return `{applied: string[]}`.
- `seed(pool, { fixturePath?, identitiesPath?, migrationsDirectory? })`: validate authoritative content and stable identities before mutation; return `{applied,seedKey,checksum}`.
- `check(pool)`: verify expected migration checksums and a real ticket read. This is a setup check, not a change to HTTP liveness semantics.
- `loadSeedInput(options)`, `validateSeedInput(tickets,identities)` and `explicitConnectionFromEnvironment(environment)` for integration/tests.

Each mutating operation acquires one pool client, starts a transaction, sets bounded lock/statement waits, acquires the shared transaction-scoped advisory lock and commits the data/ledger changes together. Failures roll back; a connection with failed rollback is discarded. Migration and seed are never run during HTTP requests or ordinary server startup. Applied files cannot be changed, removed, replaced by older checkouts or inserted before an already applied version.

The first seed requires empty business tables and records `tickets-demo-v1` atomically. An unchanged repeated seed is a no-op, preserving edits/deletions/identities. A changed recorded seed or ambiguous partial prepopulation is rejected. Canonical checksums normalize input ordering, UUID case and equivalent timestamp instants; a content or identity change remains detectable. Seed values use query parameters.

The explicit operator commands, run from the repository root, are:

```powershell
node apps/server/database/migrate-seed.mjs migrate
node apps/server/database/migrate-seed.mjs seed
node apps/server/database/migrate-seed.mjs check
```

All five connection variables must be explicitly supplied outside tracked content: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`. Owner credentials run migration/seed; runtime credentials receive only database CONNECT, schema USAGE and SELECT on the three business tables. The CLI never prints a password/connection string or raw database error details. It prints explicit configuration/ledger validation failures or the database's five-character error code.

## Focused tests and isolation

`node --test apps/server/test/postgres-data.test.mjs` covers canonical authoritative content, all stable directory references, nonblank/status/time validation, ambiguous identity rejection, checksum stability/change and explicit connection configuration. It needs no live database.

`node --test apps/server/test/postgres-integration.test.mjs` requires a freshly provisioned disposable PostgreSQL service, not a developer's existing database:

- `PGDATABASE=platypus_service_test`, explicit owner connection variables and `PLATYPUS_PG_TEST_OWNED=1`.
- Actual `current_database()` must match, and `public.platypus_test_ownership` must contain exactly the marker `platypus-service-disposable-tests` before any test mutation.
- A distinct, precreated nonsuperuser runtime role supplied through `PG_TEST_APP_USER` and `PG_TEST_APP_PASSWORD`. The test does not create roles or print passwords. It grants this known role only the intended runtime reads.
- The `platypus` schema must initially be absent, so the first failed migration can prove complete initial-batch rollback. Missing setup causes a failure, never a successful skip.

The real suite covers concurrent migration/seed serialization, late seed failure rollback, partial-data refusal, exact five/three/25 content parity, no-op preservation of edits/deletions/IDs, changed migration/seed refusal, constraints and restrictive references, timezone-independent instants, allowed duplicate directory names and valid nullable assignment. Runtime UPDATE/DELETE/INSERT/CREATE/DROP and ledger reads must fail. Permission probes run inside rolled-back transactions. The suite restores original 25-ticket contents and closes its own pools.

The coordinator owns provisioning this disposable GitHub Actions PostgreSQL 18 service, exact dependency verification/pins, commands/workflow integration, actual same-storage instance restart and HTTP/browser recovery orchestration. A logical database alone does not isolate an instance restart. These real tests have not yet been run by this lane; SQL files and pure tests are not evidence of persistence.

## Verification performed and limits

Local pure-input suite: three groups passed, zero failures/skips. Focused ESLint, Prettier verification and integration-test syntax checks passed. Real PostgreSQL tests await the hosted environment; no local database was available or installed. Existing deployed fixture-backed Lambda/local entry points are preserved by the separate backend boundary. PostgreSQL AWS hosting, networking, Lambda connection budgets, migration ownership, availability and full cost remain unresolved deployment-design gates. This preparation authorizes no cloud database or publication.
