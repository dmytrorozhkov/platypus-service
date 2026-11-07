# Neon actual-data snapshot preparation077

Approved scope is [migration contract076](../architecture/076-neon-migration-contract.md). This implements only the typed snapshot boundary and its offline tests. It does not connect to the shared native databases, Neon, AWS or any other service, and does not regenerate the learner's actual data from fixture seeds.

## Files and API

- `apps/server/database/neon/snapshot.mjs` exports the contract API: `MAX_SNAPSHOT_BYTES`, `loadSchema`, `buildSnapshot`, `validateSnapshot`, `encodeSnapshot`, `decodeSnapshot`, `snapshotSha256`, `dataFingerprint` and `readSnapshot`. `SnapshotError` is an additional fixed-message error type.
- `apps/server/test/neon-snapshot.test.mjs` contains fourteen offline groups, including a genuine100000-distinct-row in-memory roundtrip with a changed subject.

The exact artifact has four keys: format, current schema digest, current large-index digest and data. Data has only organizations, support_agents and tickets. Rows use current SQL snake_case columns, lowercase UUIDs and UTC millisecond timestamps. `buildSnapshot` sorts rows by UUID without modifying its input; validation requires canonical sorted rows. Objects and arrays reject extra, missing, inherited, symbol or accessor-backed fields; JSON decoding additionally rejects duplicate keys through exact canonical re-encoding comparison. Validated outputs are frozen copies.

`loadSchema` reads current reviewed001.sql and large/indexes.sql only, normalizes CRLF to LF exactly as the existing migration runner does, and hashes the normalized SQL. This keeps migration identities stable between Windows and GitHub checkouts. Unexpected schema/index hashes are rejected by validation before transfer. No snapshot SQL is ever executable input.

Directory ids/names and actual ticket ids/numbers/subjects/statuses/assignment/timestamps are preserved, including quotes, backslashes, delimiters, newlines and well-formed Unicode. Invalid UUIDs, ticket-number/status constraints, duplicate ids/numbers, missing references, noncanonical or invalid calendar timestamps, reversed updates, NUL, lone surrogates and blank required text are refused. There is no seedKey, source seed ledger, username, password or endpoint field.

## Bounds and integrity

Directories are individually bounded at10000 and tickets at100000; an empty database is representable. A snapshot may occupy at most134217728bytes. Before creating the complete JSON string, validation accounts for exact UTF-8 JSON string escaping, field names, row separators, null values and envelope overhead. Escaped controls cannot first expand into an oversized intermediate JSON string. Encoded buffers are checked again.

Decoding checks buffer size and a mandatory externally supplied lowercase SHA256 before parsing with fatal UTF-8 decoding. Exact compact UTF-8 canonical JSON, with no BOM or trailing newline, is required. Unknown versions, changed bytes, duplicate keys and alternate field order/whitespace are rejected. Canonical encoding makes the imported artifact digest identical to the externally pinned file hash. `dataFingerprint` hashes canonical typed JSON data rather than ambiguous delimiter-joined cells; expected schema validation belongs to the async validation API and is required before transfer.

## Source read ownership

`readSnapshot(client)` issues SELECT statements only; it never begins, commits, rolls back, releases or closes the caller's connection. The export/verification layer must own a consistent transaction. First, a bounded aggregate SELECT estimates JSON row bytes across each id-ordered max+1 subset and refuses oversized text before fetching business rows into JavaScript. Three subsequent id-ordered SELECTs use limits10001/10001/100001, so over-limit datasets fail rather than truncate. SQL `to_char(... AT TIME ZONE 'UTC', ...)` supplies explicit canonical timestamp strings independently of the session timezone and node-postgres Date parsing. Subsequent canonical validation enforces the full exact artifact size.

Unexpected driver errors are converted to fixed-message SnapshotError without a raw cause. Failed reads do not replay SQL; transaction and connection cancellation remain the transfer/root lifecycle layer's responsibility.

## Verification

Author verification uses no database/server credentials and opens no sockets:

```powershell
node --test apps/server/test/neon-snapshot.test.mjs
npx.cmd eslint apps/server/database/neon/snapshot.mjs apps/server/test/neon-snapshot.test.mjs
npx.cmd prettier --check apps/server/database/neon/snapshot.mjs apps/server/test/neon-snapshot.test.mjs docs/implementation/077-neon-snapshot.md
```

The initial thirteen groups passed. Follow-up author hardening added exact pre-allocation escaping/structure budgets and a fourteenth adversarial escaped-text test; all fourteen passed. Coordinator feedback then aligned schema line endings with migration001's existing normalized checksums. Final author rerun passed14/14 with no skipped or cancelled tests in25.7seconds; isolated ESLint and Prettier checks also passed. No failing test has been concealed or relabelled as a passing attempt.

Coverage includes exact current schema hashes; edited Unicode roundtrip; sorting/nonmutation; separator-safe fingerprints; unknown/missing/duplicate fields; getters/prototype/symbol/sparse-array rejection; duplicate ids/numbers; references/null assignments; strict dates; PostgreSQL-compatible text; directory/ticket limits;100000 actual generated-in-test identities independent of production seed logic; required external SHA; alternate JSON/malformed UTF-8/BOM rejection; oversized input; fixed error redaction; no escaped-string over-allocation; SELECT-only max+1/UTC source SQL and byte-preflight refusal before fetching business data.

## Unverified boundaries

The in-memory100000-row test is not a PostgreSQL transfer, a Neon size measurement or a latency forecast. Root separately owns disposable PostgreSQL integration evidence and the manual runbook; reviewer080 owns independent review. Native project reads, real export/import, Neon TLS/service compatibility, quota/wake behavior, runtime role activation and application/deployment changes remain unperformed under this preparation. The shared PostgreSQL service and existing public fixture are unchanged.
