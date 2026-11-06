# Large Ticket Dataset 065

Date: November 6, 2026.
Status: implemented and locally checked as recorded below; actual large PostgreSQL SQL/integration verification awaits the coordinator's marked disposable GitHub test database. No native database, service, credentials, cloud resource or deployed release was accessed or changed by this lane.

## Deterministic content

`apps/server/database/large/dataset.mjs` exports `generateLargeDataset()`, `datasetChecksums(dataset)`, `LARGE_COUNTS` and `LARGE_SEED_KEY`. It produces exactly100000 fictional tickets numbered PS-1 through PS-100000,100 organizations and40 support-agent directory entries. Identities are stable version4-shaped UUID values derived from fixed namespaces and ordinals; no randomness or wall-clock seed is used. Every invocation returns fresh arrays/objects.

Each of the four accepted statuses occurs25000 times. There are14286 unassigned records and21600 distinct valid UTC creation instants, deliberately shared across several tickets to exercise stable sorting ties. Dates are anchored in2024 and vary deterministically; updated times never precede creation. Repeated subjects exercise secondary sorting. Exactly100 subjects contain literal percent, underscore and backslash characters for search-escaping checks. Directory IDs are not permissions.

Organizations/supportAgents contain `{id,displayName}`; tickets contain `{id,number,subject,organizationId,status,assigneeId,createdAt,updatedAt}`. No generated100000-record JSON is stored in Git. Existing25 fixtures, migration001 and ordinary demo/Lambda entry points are unchanged by this lane.

Golden seed checksum: `77433246b2db75a2da17d995124d65bd8e22147d641aec9df0ecf466acf1e2fb`. Ticket-content checksum: `1dfad9dd9844167f5adeb4e093aec68f727fcb6bd9f11ac91e9328305a673bd6`. The pure test pins these identities/content under `tickets-large-v1`; a deliberate later data change requires a new explicit seed design rather than overwriting that identity.

## Explicit loader and index provenance

`seed-large.mjs` exports `assertLargeTarget(client,environment?)`, `seedLarge(pool)` and `verifyLarge(pool)`. Operations inspect actual `current_database()` and reject everything except `platypus_service_large` and `platypus_service_large_test`. The latter additionally requires `PLATYPUS_LARGE_TEST_OWNED=1` and exactly the marker `platypus-service-large-disposable-tests` in `public.platypus_test_ownership`. Native population remains a later learner-run action; this implementation lane never connects to it.

The separate target must already have the unchanged migration001 applied. The loader verifies the actual migration ledger version/checksum against the tracked SQL before changing business data. It owns one checked-out client and one transaction, bounded three-second lock and five-second per-statement waits, and the same advisory lock as the existing migration/seed tools. Concurrent commands therefore serialize or fail clearly at the bounded wait. Rollback failures discard the affected connection.

First application requires empty organizations/support_agents/tickets, an empty seed ledger and no unrecorded large indexes. Directories use typed parameter arrays;1000-ticket batches use parameterized typed UNNEST inserts. Row counts must match each directory/batch. All rows, six indexes, ANALYZE and three provenance ledger entries commit together. Any late insertion/index/ledger failure rolls the transaction back. No truncate, reset, conflict-ignore repair or business upsert exists.

The existing `seed_runs` ledger receives independent entries for seed content, LF-normalized `large/indexes.sql` SHA-256 and the ordered actual PostgreSQL index definitions. An unchanged repeated seed validates those records and definitions, then performs no business writes. Edited subjects or deleted rows remain edited/deleted. Changed/incomplete/foreign provenance or renamed/dropped/replaced indexes fail without repair.

Six ordinary B-tree indexes support numeric ticket-number order, created/updated order, and status/organization/assignee plus creation-time filtering. Numeric suffix indexing uses length and C-collated text, avoiding arbitrary-size numeric casts. No extension is installed. Literal substring searches and joins may still require scanning/sorting; index presence is not a latency guarantee. PostgreSQL documents leading-column behavior in [multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html).

`verifyLarge(pool)` uses a repeatable-read, read-only transaction. It checks target/schema/provenance, exact counts, assignment/status/date summaries and complete current content fingerprints. PostgreSQL hashes the ordered dataset inside the database using built-in [SHA-256 binary functions](https://www.postgresql.org/docs/18/functions-binarystring.html); only small hashes/counts/summaries/index names return to Node. This still processes100000 database rows and generates expected data in Node; it is bounded output, not constant work or a measured speed claim. Its `contentMatchesSeed` flag reports later content edits as false; it never overwrites them. Changed counts fail explicitly. Seed timing/verification timing fields describe only that actual invocation and do not establish product performance.

## Commands and environment boundary

`large/cli.mjs` accepts exactly one explicit action, `migrate`, `seed` or `check`. It requires all existing PG connection variables, a loopback host and the allowlisted configured database; it also verifies the actual target/marker before invoking even the unchanged migration helper. It provisions no database/role and never starts/stops a service.

```powershell
node apps/server/database/large/cli.mjs migrate
node apps/server/database/large/cli.mjs seed
node apps/server/database/large/cli.mjs check
```

Owner credentials belong only to explicit setup commands and stay private in the child environment. CLI errors expose controlled setup descriptions or database error codes, not raw errors/connection strings/passwords. The runtime role later receives CONNECT, schema USAGE and SELECT on the three business tables, with no ledger/schema/business write privileges. Shared command wrappers, local hidden-password runner and runtime configuration remain coordinator-owned.

## Tests and observed verification

Pure command: `node --test apps/server/test/large-data.test.mjs`. It checks all generated records/relationships/UTC instants, exact distributions, golden fingerprints and independent invocation behavior, plus allowlisted target/marker refusal and CLI rejection of ordinary databases/remote hosts without connecting or leaking a supplied test password.

Real SQL command: `node --test apps/server/test/large-postgres-integration.test.mjs`. It deliberately fails rather than skips without all prerequisites: `GITHUB_ACTIONS=true`, `PLATYPUS_PG_TEST_OWNED=1`, `PLATYPUS_LARGE_TEST_OWNED=1`, explicit owner PG variables naming `platypus_service_large_test`, the matching actual marker, pre-applied migration001 and distinct precreated nonsuperuser runtime credentials in `PG_TEST_APP_USER`/`PG_TEST_APP_PASSWORD`.

The real suite checks partial-data refusal, failure in the final100000th-ticket batch rolling back everything, concurrent first load/retry, complete SQL-versus-generator fingerprints, exact distributions/indexes, no-op preservation of edits/deletions, checksum/index drift refusal, actual constraints and runtime read-only permissions. It restores canonical100000-row contents after test-owned mutations, grants only the known runtime role's reads and closes both pools, leaving the large database ready for the coordinator's HTTP/browser/query measurements. It never imports shared dist output or runs native/service/CI-setup operations itself.

Locally observed: final pure suite3/3 passed with no failures/skips; focused ESLint, Prettier verification and real-test syntax check passed. No actual PostgreSQL large test, native data load, endpoint timing or browser measurement is claimed here. Root owns full shared checks, actual hosted results, cross-layer integration and independent review069.
