# PostgreSQL Data Design Proposal 016

Date: November 4, 2026.
Status: planning report only. No database, schema, migration, dependency or application change was implemented or tested.
Baseline: accepted Node server task 014, commit 5532511, acceptance record 792ea55.

## Recommendation and scope

Use three small business tables: organizations, support_agents and tickets. Add two operational ledgers, schema_migrations and seed_runs. Replace FixtureTicketRepository in the production server entry point with PostgresTicketRepository through the existing TicketRepository.list() interface. Keep GET /api/health and GET /api/tickets unchanged.

The initial database contains the existing 25 fictional tickets, five organizations and three assignee directory entries. This is persistence for the accepted read-only slice, not the whole future support system. There are no passwords, invitations, role tables, customer accounts, messages, identity-provider links or new application controls in this stage. The support_agents table is a directory of fictional assignees, not an authentication system or a grant of permissions. The current local API remains unauthenticated; real data and public deployment remain later work.

### Alternatives considered

| Choice                                                           | Benefit                                                                                                                  | Cost and reason for decision                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One flat tickets table containing organization and assignee text | Fewest tables and simplest first query                                                                                   | Repeats labels; a rename can diverge between tickets; later organization boundaries and stable assignee identity require a data migration. Acceptable for a short SQL exercise, but weaker fit for the already agreed product. |
| Three small related business tables                              | Stable relationships, one current name per organization/person, nullable assignment, explicit missing-reference failures | One inner join and one left join. Recommended bounded model; no requirement to build the later identity system now.                                                                                                            |
| Full users/roles/memberships/messages/history model              | Closer to the eventual product                                                                                           | Depends on unanswered access and workflow questions, expands the learning step substantially. Defer.                                                                                                                           |

## Observed contract that must remain

Inspection covered AGENTS.md, PROJECT_PLAN.md, task/report 014, apps/server/src/ticket-repository.ts, its authoritative fixtures/tickets.json, apps/server/test/server.test.mjs, server.ts/main.ts, Support ticket-data.ts/ticket.ts and scripts/ticket-api-browser-check.mjs.

- The server returns {items, total}; each item has exactly number, subject, organization, status, assignee, createdAt and updatedAt. Internal identifiers are not added to this response.
- The four statuses are New, In progress, Awaiting customer and Closed. Only assignee may be null; null still reaches the browser as null, where the existing view presents Unassigned.
- The fixture is PS-1001 through PS-1025, in that order. It contains Northstar Studio, Cedar Labs, Harbor Works, Maple Logistics and Orbit Learning; assignees are Jordan Lee, Sam Rivera and Avery Morgan. New tickets currently have null assignees. This coincidence is not a new permanent database rule.
- The current client requires total === items.length. This remains an unpaged collection of 25 initial examples. Do not prematurely return total:100000 with only 25 items: the existing client correctly rejects it.
- Existing timestamps are absolute UTC instants. They must not be replaced with seed execution time or reinterpreted as Windows local clock time.
- The final 100,000-ticket dataset, server search/filter/sort/access checks and page sizes 25/50/100 are unchanged later requirements. Their contract and performance checks require their own stage.

## Proposed schema

Use a dedicated platypus schema inside the project database. Qualify SQL table names explicitly rather than relying on a mutable search path. All identifiers below are proposed names.

| Table             | Initial columns and rules                                                                                                                                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| organizations     | id uuid primary key; display_name text not null with a nonblank check. Names are not identity and are not globally unique.                                                                                                                                                                            |
| support_agents    | id uuid primary key; display_name text not null with a nonblank check. Duplicate human names must remain possible.                                                                                                                                                                                    |
| tickets           | id uuid primary key; number text not null unique; subject text not null/nonblank; organization_id uuid not null references organizations(id); status text not null with the four-value check; assignee_id uuid null references support_agents(id); created_at and updated_at timestamptz(3) not null. |
| schema_migrations | version text primary key; checksum text not null; applied_at timestamptz not null. This records applied immutable migration files.                                                                                                                                                                    |
| seed_runs         | seed_key text primary key; checksum text not null; applied_at timestamptz not null. This records the explicitly applied initial seed.                                                                                                                                                                 |

UUID means universally unique identifier. It is an internal stable key; PS-1001 is the separate human-facing number. Use explicit fixed UUIDs in a small seed identity map keyed by fixture number and explicit organization/assignee seed keys. This makes the initial seed deterministic without treating names as permanent identity. A future create operation can generate a fresh internal identifier; selecting a concurrent ticket-number allocation strategy belongs to that write stage. Do not use MAX(number)+1.

Reference deletion should be RESTRICT: removing an organization or assignee must not silently delete tickets or erase assignment history. Blocking a real user later must preserve records. A future migration will connect directory entries to the actual application identity model; do not invent Cognito subjects or passwords now.

Named checks should reject blank number/subject/names, unknown statuses, nonfinite timestamps and updated_at < created_at. A simple number pattern such as ^PS-[1-9][0-9]*$ preserves current values without imposing a four-digit lifetime limit. Do not enforce status transitions or require a particular status/assignment pairing: reopening and reassignment details are still open. Do not add an automatic updated_at trigger in this read-only slice; seed timestamps are authoritative, and future writes will define how the value changes.

These are design choices using PostgreSQL's primary-key, unique, check and foreign-key facilities. CHECK alone does not replace NOT NULL. Primary/unique constraints supply their supporting indexes; foreign keys do not automatically create indexes on referencing columns. See [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).

Keep primary/unique indexes and add a (created_at, number) B-tree index matching the fixed initial order. At 25 rows, the planner may sensibly choose a sequential scan; index presence is not a performance claim. Further organization/assignee/status/search indexes should follow the actual 100,000-row query design and measurements, rather than indexing every future filter speculatively. See [CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html).

## Read mapping and time

Illustrative SQL only; not an executed migration or implementation:

```sql
SELECT t.number, t.subject, o.display_name AS organization,
       t.status, a.display_name AS assignee,
       t.created_at, t.updated_at
FROM platypus.tickets AS t
JOIN platypus.organizations AS o ON o.id = t.organization_id
LEFT JOIN platypus.support_agents AS a ON a.id = t.assignee_id
ORDER BY t.created_at ASC, t.number ASC;
```

This reproduces the fixture order because creation dates increase from PS-1001 onward. The unique number breaks creation-time ties. Explicit ordering is required; insertion order is not guaranteed by SQL. See [PostgreSQL ORDER BY](https://www.postgresql.org/docs/18/queries-order.html).

Map the database rows explicitly to the existing seven properties, then set total = items.length for this unpaged response. One result query gives a consistent items/total pair and avoids a separate count race. The left join preserves unassigned rows. Do not select *, expose UUIDs or pass driver metadata to the client.

timestamptz stores an instant; it does not retain the original timezone label. Requiring explicit-offset seed timestamps preserves their meaning. Use millisecond precision to match JavaScript Date, and serialize checked finite driver Date values with toISOString() into UTC strings. A .000Z suffix instead of Z is equivalent; contract comparisons should normalize instants rather than demand the old text spelling. PostgreSQL session timezone changes must not shift the API instant. See [PostgreSQL date/time types](https://www.postgresql.org/docs/18/datatype-datetime.html) and [node-postgres type conversion](https://node-postgres.com/features/types).

## Migration workflow

A migration is a versioned database structure change. A seed inserts the initial example content. Both are explicit owner commands, never a side effect of an HTTP request or ordinary server startup.

1. Provision the project database and its owner outside the migration transaction, according to environment task 017. The runtime database role must not create databases or schema objects. The migration command requires an explicit owner connection.
2. Use a small reviewed pg-based runner for the initial numbered SQL files. Introduce a migration package only if the implementation review finds the bounded runner unnecessarily complex; verify and pin any selected dependency then. Never use CREATE TABLE IF NOT EXISTS everywhere as a substitute for schema versioning: it does not detect changed columns or constraints.
3. On one checked-out connection, BEGIN, acquire the same transaction-scoped advisory lock used by migration and seed commands, bootstrap the schema/ledger if necessary, and read applied versions. Check the tracked LF-normalized file checksums. Reject changed/missing applied migrations or an incompatible newer schema; do not silently rewrite ledger rows.
4. Apply pending files in version order and insert their ledger entries in the same transaction. This first small batch uses ordinary transactional table/index statements. On failure ROLLBACK the batch and return a clear nonzero result. COMMIT only after the whole pending batch succeeds. Release the checked-out connection in finally; destroy a broken connection when rollback/connection recovery fails. Re-running an unchanged successful batch reports no pending changes.
5. Keep future changes append-only. Do not edit 001 after it has run. Rebuild only an explicitly disposable test database when testing a deliberately broken migration; do not automatically drop a developer database.

The shared advisory lock serializes these cooperative project commands; it is not a substitute for database constraints or a block on arbitrary SQL clients. Use a bounded lock wait and report another setup command is active. A transaction-scoped lock is released when the transaction finishes. See [advisory lock functions](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS). BEGIN/COMMIT/ROLLBACK make the schema changes and ledger updates one unit; see [PostgreSQL BEGIN](https://www.postgresql.org/docs/18/sql-begin.html). With pg, every transaction statement must use the same checked-out client, not independent pool.query calls; see [node-postgres transactions](https://node-postgres.com/features/transactions).

## Deterministic seed without silent resets

Keep apps/server/src/fixtures/tickets.json as the single existing example-content asset. Production request handling must not import it. The seed/test tooling may read it and the explicit stable-identity map; no separately maintained copy of the 25 subjects/dates is needed.

Use seed key tickets-demo-v1. Validate fixture schema, numbers/statuses/times and identity references before mutation. Compute a checksum over a documented canonical representation of both content and the identity map so formatting alone does not change seed identity.

- Begin a transaction and acquire the same setup advisory lock. Require the expected schema version.
- If tickets-demo-v1 is already recorded with the same checksum, report already applied and make no business-data changes. Later local edits, deletions and identifiers stay as they are. This command is not a repair/reset tool.
- If the recorded checksum differs, fail with an explanation. A changed fixture needs an explicit new data-change plan; never silently update already seeded tickets.
- If there is no seed entry, require all three business tables to be empty. Refuse an ambiguous partly populated database. Insert the five organizations, three directory entries and 25 tickets with their fixed IDs and original timestamps, then the seed ledger row; commit together. Any error rolls the entire seed back.
- Do not use an upsert that updates subjects/statuses/dates on every run, TRUNCATE at startup, or ON CONFLICT DO NOTHING that hides a partial or conflicting first seed. Concurrent attempts must result in one successful application and the other observing the recorded no-op.

The first empty-database seed yields 25 tickets. A later legitimate deletion may yield 24; repeating seed must not secretly restore it. Initial baseline checks run on a newly prepared isolated database, while edit-preservation checks intentionally expect their changed content.

## Node integration and lifetime

Use the pure JavaScript node-postgres package pg. An object-relational mapper is not needed for this one read query. The project's Node 24 runtime is explicitly covered in the [official compatibility documentation](https://node-postgres.com/). Verify the published stable pg release and its TypeScript declarations against the package registry before pinning/installing during implementation. No install was performed here. The inspected upstream manifest currently says 8.23.1; a master-branch manifest is not proof of the registry's latest stable tag, so this report does not prescribe that number. See [upstream pg manifest](https://github.com/brianc/node-postgres/blob/master/packages/pg/package.json).

Create one process-wide pool, pass it into PostgresTicketRepository, and keep repository list() side-effect-free. Propose max 5 connections for this local slice. Set explicit bounded acquisition and server-side statement timeouts, for example 3 and 5 seconds; these are local policy starting points to verify, not performance promises. Set a recognizable application_name. Pool and statement configuration are documented in the [pool API](https://node-postgres.com/apis/pool) and [client API](https://node-postgres.com/apis/client).

Use pool.query for the single list query; checked-out clients belong only to explicit multi-statement migration/seed transactions. Every value in seed or future parameterized operations goes through $1-style parameters; never interpolate names/subjects into SQL. Dynamic SQL identifiers are not value parameters, so keep the initial identifiers fixed. See [parameterized queries](https://node-postgres.com/features/queries).

Attach a pool error listener. A request failure returns the accepted 500 INTERNAL_ERROR envelope and readable existing message; a database outage must not cause silent fixture fallback or an unhandled idle-pool error that kills the API. Log a sanitized operation and error code locally, excluding credentials/connection strings. After PostgreSQL recovers, a new request through Retry must acquire a usable connection without restarting the frontend or API. This behavior remains to be tested.

On SIGINT/SIGTERM, stop accepting new HTTP work, allow bounded in-flight work to settle, close remaining owned HTTP connections at the deadline, await pool.end(), then disconnect the launcher IPC channel. Make shutdown idempotent, including failures before listen completes. The integrated launcher owns its Node child; it must not stop the independently managed PostgreSQL service. Pool draining and client release rules come from [node-postgres pooling](https://node-postgres.com/features/pooling).

Retain GET /api/health as HTTP-process liveness only; do not claim database readiness from its 200 response. Provide an explicit setup/check command to validate credentials, expected schema and a real query before the user demo. Valid configuration may still yield a running HTTP process and readable Tickets error while the database is unavailable. The launcher ready event keeps its existing HTTP-listening meaning. Missing/invalid required connection settings should fail clearly rather than connecting to a guessed default user/database.

Keep FixtureTicketRepository available only to deliberate unit tests if useful, with no production mode switch that silently selects it. Independent server tests can continue injecting repositories. Real PostgreSQL tests and browser recovery checks must explicitly use their intended database connection.

## Parallel environment agreement

Task 017 reports that Docker/WSL are not available and proposes a native Windows PostgreSQL 18 installation, with the exact stable patch/install verification owned by that task. This schema requires no extension, no database superuser during migrations and no virtualization. This report does not claim software is installed.

Agreed interface proposal: PGHOST=127.0.0.1, PGPORT=5432, PGDATABASE=platypus_service; platypus_owner runs setup, platypus_app runs the read-only API. These are technical database accounts, distinct from the future human Customer/Support/Administrator application roles. Give the application database account CONNECT, schema USAGE and SELECT on the three business tables, with no schema ownership or business writes. Keep owner/runtime credentials separate and local. Database connection settings never enter browser runtime configuration. Supply secret values locally, not in chat or tracked files; a tracked example may contain placeholders only.

Use a separately provisioned platypus_service_test database for destructive tests. Require both its explicit test connection/name and a test-owned marker before teardown/mutation; never infer a destructive target from the ordinary application connection. The Windows database service and persistent storage outlive npm server shutdown. Its exact paths, occupied-port behavior and installation steps remain environment-task responsibilities.

A separate logical database does not isolate a PostgreSQL instance restart. If development and tests share the same Windows service, verify an actual outage/restart only in a coordinated exclusive verification window, or use a separately owned test cluster on an explicitly free different port. Do not describe a mocked failure or logical test database alone as proof of instance-restart recovery.

## Required future acceptance evidence

These checks are proposed, not performed:

1. In an isolated database, run migration and seed, then inspect actual PostgreSQL counts and foreign-key relationships: five organizations, three directory entries, 25 tickets. Verify exact item fields, values, statuses, nulls and normalized instants against the authoritative asset, including PS-1001-to-PS-1025 order. The real HTTP response must be the unchanged items/total contract.
2. Commit a distinctive valid subject change through a test-owned database connection. Read it through the real API and browser. Restart that test-owned database service/instance with the same data storage and restart its API; the edit and identifiers must remain. This proves persistence and helps detect a hidden runtime fixture. Restore the test-owned baseline explicitly when needed.
3. Re-run unchanged migrations and seed; neither duplicates rows nor changes saved edits/IDs. Deliberately alter a copy of an applied migration/seed input: the command must refuse the checksum mismatch. Inject a failing first setup batch/seed on a fresh test database and verify no partial tables/data/ledger success remains. Two concurrent setup commands must serialize or fail clearly without duplicate application.
4. Test invalid status, missing organization/assignee, blank required text, duplicate number, nonfinite/inverted timestamps; PostgreSQL must reject them. Valid null assignee must survive the left join. A test-only cleared ticket collection produces items:[]/total:0 without fake seeded rows appearing.
5. Stop only a test-owned PostgreSQL instance while its real Node server stays running. Verify the bounded public error and readable Retry state, no leaked secrets, and no API crash from idle pool errors. Restart the same instance; Retry recovers without restarting frontend/API. Do not stop another project's service or the user's currently running application merely to create a test failure.
6. Verify the runtime role can read but cannot write/create/drop. Check wrong credentials/missing schema produce clear local setup errors and no fallback. Query results must preserve UTC instants under a different database session timezone.
7. Test owned API startup interruption/shutdown with pool clients open: one cleanup, no dangling API process, and database service left alive. Reuse the existing lifecycle checks and add the database boundary rather than replacing them with mocks alone.
8. Preserve meaningful existing server, hosting/federation, development/built Shell and Support standalone/browser checks: actual API request, all 25 rows, loading/empty/error/Retry, request cancellation, delayed Angular cleanup and healthy React/Vue navigation/styles. Existing isolated server-recovery helpers need an explicit suitable database configuration, not an inherited accidental developer target. Run lint, formatting, applicable typechecks/builds and focused real-database checks after implementation.

## Decisions to consolidate before implementation

The coordinator should approve the three-table scope, explicit ledger-based seed policy and the environment task's native setup proposal, then assign one implementation owner for the shared backend/configuration changes and an independent reviewer. There is no unresolved product question blocking this bounded proposal. Exact driver/types pins, database installation, credentials, migration SQL, scripts and actual persistence/recovery results remain future implementation work. No AWS resource or paid service is required for this local stage.
