# Neon transfer preparation078

Approved scope: contract076, November6,2026. This report covers the import-only transfer core and offline client sentinels. The coordinator owns the explicit runner, secret prompts, disposable PostgreSQL integration and runbook079; independent review080 follows.

## Implemented behavior

`apps/server/database/neon/transfer.mjs` exports `exportDatabase(client)`, `importDatabase(client,snapshot)` and `verifyDatabase(client,snapshot)`. It creates no connection and has no executable entry point, environment reading, fixture-generator import, native service access or client `end`/`release`. The caller owns the already connected client and its global deadline/cancellation.

Export runs only actual source SELECTs through snapshot077, under one `REPEATABLE READ READ ONLY` transaction. Its three-table data is consistent even if another transaction changes source records during the export. Source tables, native ledgers, permissions and passwords are not copied or changed. Limits and encoding are enforced by077.

Import validates the entire snapshot before its first SQL command, then rebinds the loaded schema/index SQL hashes to the validated snapshot before BEGIN; a concurrent checkout edit is refused before any SQL. It uses one repeatable-read transaction and a nonwaiting `pg_try_advisory_xact_lock(182746,76001)`. A new target `platypus` schema receives the reviewed001 table definitions, actual parameterized data batches of at most1000 rows, and reviewed large indexes. It records migration001/checksum, leaves `seed_runs` empty and writes a dedicated single-row `migration_imports` ledger. The ledger records canonical artifact/data/schema/index digests and the signature of the schema actually created from trusted local SQL. Arbitrary SQL, source seed provenance and role ownership are never read from snapshot contents.

Before COMMIT, the core validates the complete catalog shape, reads every business row back into a bounded canonical snapshot and compares its full data fingerprint and counts. Two bounded representative queries check joined organization/assignment content and status/date ordering. Exported edited text, delimiters, newlines and Unicode are preserved; this is actual-data transfer rather than regeneration of the initial100000 fixtures.

An existing `platypus` schema is accepted only when its exact import ledger, unchanged migration001, empty seed ledger, complete schema signature and full current data match this exact snapshot. A matching rerun reports `imported:false` and issues no DDL or business writes. Unknown/partial targets, changed snapshots and data/schema drift fail without adoption, deletion or repair.

## Catalog and transaction guards

Known inventory includes exactly six ordinary tables, all expected column types/nullability/defaults, named primary/unique/foreign/check constraints and14 indexes. Full signatures include column generated/identity flags, constraint definitions/enforcement/validation/deferral, index definitions/readiness/validity/uniqueness and table row-security flags. Unexpected user triggers are refused. PostgreSQL18 not-null constraints are checked against exact required column positions and included in the signature; no generated constraint name is guessed. Verification takes ACCESS SHARE locks on the six known tables before catalog/readback checks to prevent their concurrent ALTER/DROP while allowing the explicit read-only verify transaction.

Statement timeout is45seconds, lock timeout3seconds and idle transaction timeout60seconds, all transaction-local. `search_path` is restricted to `pg_catalog`; business tables are schema-qualified. Root provides the bounded whole-operation deadline and destroys its own client on cancellation. No automatic retry occurs.

Any pre-COMMIT failure attempts ROLLBACK; connection/rollback failures are sanitized. A failed COMMIT response explicitly reports an unknown outcome and requires separate verification before any retry. A rollback attempt after a lost COMMIT response is never claimed to prove that no commit occurred. The core does not create or activate application roles. The later explicit NOLOGIN/select-only role action belongs in079.

## Actual author verification

Focused command: `node --test apps/server/test/neon-transfer.test.mjs`.

All13 groups pass, covering read-only export/actual edited data, invalid input before SQL, atomic first import/parameterization,1000-row batches and late-batch rollback, exact no-write rerun/read-only verification, unknown target refusal, changed source/target content, column/constraint/index/trigger drift, incompatible ledgers, busy lock, lost COMMIT response and sanitized query/rollback failures. A separate child-process module-mock check changes either loaded schema digest after snapshot validation and proves zero SQL calls, without modifying trusted schema files. Clients are offline fakes that fail if the transfer tries to end/release them. The1001-row sentinel verifies actual batch value counts of8000+8 for eight-column tickets.

Own-file ESLint and Prettier pass. The first test run passed11/12: its invalid-input test tried mutating077's intentionally frozen snapshot. The test was corrected to make an explicit structured clone before corrupting it; no production change was needed for that failure. Later ACCESS SHARE and PostgreSQL18 catalog corrections were made before the actual database harness and the12 groups were rerun successfully. A later independent review requested an explicit schema-file reread/hash guard; this was added with the thirteenth group, and13/13 plus own-file lint/format passed.

The coordinator records actual isolated PostgreSQL results and shared checks in079. Fake-client success alone is not proof of SQL catalog behavior, Neon compatibility,100000-row performance, Free-plan storage/compute usage, remote connection or migration completion. No native project database, Neon, real credentials, AWS or publication operation was used by this author.

PostgreSQL18 constraint semantics were checked against [the official pg_constraint catalog reference](https://www.postgresql.org/docs/18/catalog-pg-constraint.html).
