# Manual local-to-Neon migration079

## Prepared result and current evidence

This stage prepares a learner-started transfer of the actual three business tables from local `platypus_service_large` to the existing Neon `neondb`. It is not regeneration: changed text, identities, assignments, statuses and millisecond timestamps are preserved. It is not a full PostgreSQL backup: roles/passwords, arbitrary schemas, source migration/seed ledgers and future application tables are excluded. The target uses the reviewed migration001 and six large-query indexes. Imported content has its own ledger and never claims it was generated from a fixture.

The learner's screenshots confirm project `platypus-service`, branch `production`, Frankfurt, Free, PostgreSQL18.6 and database `neondb` owned by `neondb_owner`. They selected min/max0.25CU and five-minute idle sleep; the post-Save state has not been separately read. The current AWS application remains in Stockholm and fixture-backed. No agent has connected to this Neon project, exported the learner's local data or started a real import/publication in this stage.

## Before a real run

Read contract076, implementation077/078 and independent review080. Finish applicable tests and learner acceptance first. Execute one action at a time from the reviewed repository root in PowerShell; none of these commands is an automatic GitHub/CodeBuild deployment. Build the reviewed server once:

```powershell
npm.cmd run build --workspace @platypus/server
```

The wrapper requires existing Node.js/dependencies and the reviewed build. It installs nothing and starts no application or database service. Preserve native PostgreSQL and local servers. The source is fixed to `127.0.0.1:5432/platypus_service_large`, user `platypus_app`; a wrong local password or missing SELECT grant stops export. It never uses local owner/admin credentials or fallback fixtures.

The snapshot is consistent as of its read-only transaction, not a continuous replication stream. Existing app behavior is read-only; if writes are introduced before eventual cutover, agree a write freeze and a fresh final export. A later source edit is deliberately not included in an older snapshot.

## 1. Export actual local data

Choose a fresh lowercase snapshot id; the following example can be used once:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\neon-migration.ps1 -Action export -SnapshotId local-transfer-001
```

Enter the **local platypus_app password** at the hidden prompt. It is passed only to the owned child process, never to command arguments, tracked files, parent environment or output. The export opens a repeatable-read read-only transaction; no source data/schema/role is changed. Count/byte limits fail rather than truncate: at most100000tickets,10000rows per directory and128MiB canonical UTF-8 snapshot.

Success prints counts, `sha256` for the entire file and `dataFingerprint`. Keep the printed SHA256 separately as the expected identity. The file is `.local/neon-migration/local-transfer-001.json`, ignored by Git. It contains business data, not connection credentials; protect it as a private local data copy. No upload or GitHub artifact is performed. This is integrity checking, not encryption or a cryptographic author signature.

Existing files are never overwritten. A failed export may leave an unusable partial/empty file: retain it for diagnosis and use a new id for an explicit new export. There is no automatic delete, repair or retry.

## 2. Inspect without a connection

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\neon-migration.ps1 -Action inspect -SnapshotId local-transfer-001
```

Paste the separately recorded SHA256 when requested. Inspect opens no database/network connection. It checks exact file bytes, format, schema/index versions, canonical encoding, unique identities/numbers, dates, counts, field types and references. A wrong hash, changed schema files, invalid references or modified file stops here. No SQL is read from or executed from the data file. For the current accepted source, expect100000tickets,100organizations and40support_agents; stop if counts differ unexpectedly. Deliberate source changes must be understood before importing; the tool does not equate actual content with the canonical seed.

## 3. Learner-started Neon import, after accepting the prepared stage

Before this action, reconfirm Free plan, compute0.25CU, idle sleep and usage allowance. The source's measured54MB total/46MB ticket/index size is not a Neon metering or performance guarantee. This stage does not activate a paid plan or automate billing changes. Verify you are using the intended project/production branch; the unique direct endpoint identifies that branch. Do not copy a pooled endpoint.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\neon-migration.ps1 -Action import -SnapshotId local-transfer-001
```

The wrapper separately requests the expected snapshot SHA256, the **direct Frankfurt hostname** (not a URL or `-pooler` host), typed confirmation of the exact `hostname/neondb`, then the private **Neon neondb_owner password**. Retrieve these privately in Neon Connect with pooling disabled. Do not paste the connection string/password into chat, public screenshots, command arguments or tracked `.env` files. Public/frontend configuration never receives them.

The runner pins `neondb` / `neondb_owner`, validates PostgreSQL18/UTF8 and authenticated identity, and requires verified TLS chain and hostname. Ambient PG settings or a connection URL cannot redirect the destination or disable TLS. Source and target credentials are entered for separate actions; export never starts import.

First import requires the `platypus` schema to be absent. Within one transaction it acquires the migration lock, creates the schema/tables, inserts parameterized batches of at most1000, creates indexes, records the dedicated import identity, then reads back all data and verifies hashes/catalog shape plus representative joined/filter queries before commit. Unknown existing schemas, differing data, changed snapshot or drift stop without resetting, merging or adopting objects. No DROP/TRUNCATE/DELETE repair exists. A successful repeat of this exact snapshot verifies existing content and returns `imported:false`.

The owned connection has a six-minute overall budget, a60-second driver query bound,45-second SQL statement limit,3-second lock limit and60-second idle-transaction limit; cleanup has at most3additional seconds. These are explicit preparation limits, not measured Neon0.25CU promises. There is no automatic SQL replay. A genuine target constraint/index/permission error rolls back the transaction; a lost COMMIT response is inherently uncertain and must be resolved by the next read-only action.

## 4. Explicit post-import verification

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\neon-migration.ps1 -Action verify -SnapshotId local-transfer-001
```

The same SHA/host/database confirmation and hidden Neon setup-password prompts apply. Verify reads one consistent read-only snapshot, checks the dedicated import ledger, exact target column/constraint/index definitions, migration001 and empty seed ledger, every business row's fingerprint and bounded representative queries. A successful result reports `verified:true` and counts. This does not change the running AWS application or prove cloud-to-cloud latency.

If import reports any error or is interrupted, **run explicit verify before retrying**. If verification succeeds, the import committed; do not load again. If the connection cannot be established, resolve it without reissuing writes. The CLI deliberately emits fixed redacted errors, so its failure alone cannot distinguish an absent schema from drift. If verify fails, use this read-only query in the intended Neon SQL Editor:

```sql
SELECT current_database() AS database_name, session_user AS database_user,
       to_regnamespace('platypus') IS NULL AS import_schema_absent;
```

Only if the selected project/branch is the same confirmed endpoint, database_name is neondb, database_user is neondb_owner, and import_schema_absent is true may an initial failed import be explicitly retried with the same reviewed snapshot. If a partial/unknown schema, changed data/indexes or different ledger is present, stop and investigate; the tool deliberately offers no destructive cleanup. The local source remains available throughout.

## 5. Separate runtime role preparation

After a verified import and a separate learner decision to prepare access, the reviewed SQL file `apps/server/database/neon/runtime-role.sql` may be run as `neondb_owner` in `neondb`. It creates **NOLOGIN** `platypus_app` with no admin, role-creation, replication, RLS-bypass or inheritance flags, and grants only database CONNECT, schema USAGE and SELECT on the three business tables. An existing role causes refusal; it is never silently adopted or weakened. Failed explicit transactions require ROLLBACK before using the same session again.

Do not create this application role through the default Neon Console/API role flow: current Neon documentation says those default-created roles receive `neon_superuser` membership. The SQL role has no password and cannot log in yet. Private password/login activation, actual role-credential testing, Secrets Manager/Lambda configuration, pooling and API/frontend deployment remain a separate reviewed integration stage. This stage does not implement application user authentication or organization authorization.

## Verification commands and limits

Offline migration tests are included in the existing server suite:

```powershell
npm.cmd run test:server
```

The separate local integration command uses existing PostgreSQL18.6 binaries to initialize a **new marked disposable cluster** beneath ignored `.local/neon-migration-tests`, on its own ephemeral loopback port. It creates only synthetic test data and stops only that owned cluster; it never attaches to the Windows service or the learner's databases:

```powershell
npm.cmd run test:neon:migration:integration
```

`PLATYPUS_TEST_PG_BIN` may explicitly select an existing PostgreSQL18.6 binary directory. No package is installed. Test-only generated passwords and logs remain ignored under the owned test directory; they are not Neon or native user credentials.

Actual integrated outcomes, corrections and unverified live-Neon behavior are recorded below after execution. No offline or local PostgreSQL result proves a real Neon TLS handshake, compute wake/timeout fit, role grants, free allowance consumption or final cloud deployment. The unchanged public Lambda still has a3-second timeout and does not use the new adapter.

## Sources

- [PostgreSQL18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html): consistent repeatable-read snapshots.
- [Neon role management](https://neon.com/docs/manage/roles): default elevated Console roles versus SQL-created limited roles.
- [Neon secure connections](https://neon.com/docs/connect/connect-securely): verified TLS and hostname checking.
- [Neon migration guide](https://neon.com/docs/import/migrate-from-postgres): conventional full-database pg_dump/pg_restore alternatives. This bounded three-table transfer uses reviewed DDL plus typed data instead; it does not claim to replace a general backup/restore tool.

## Actual local verification and corrections

The coordinator ran a new isolated native PostgreSQL18.6 cluster with randomly generated test-only credentials, SCRAM, synthetic100000tickets/100organizations/40agents and an actual edited subject containing a delimiter, newline and Unicode. The complete owned-cluster script passed seven groups in237925ms total, including initialization/population and multiple imports/failures; this is not the elapsed time of a single deployment or a Neon benchmark. All owned clients closed and the owned cluster stopped with exit0. The user's native cluster/service was never used.

The actual groups establish: repeatable-read export excludes a concurrent later source edit; the restricted source user cannot write; typed file/hash roundtrip; full target data/catalog/migration/import-ledger verification; successful identical rerun without duplicate insertion; failed100thticket batch rolls back all target schema/data/ledger and an explicit retry succeeds; unknown existing schema/data survives refusal; target content/index drift is detected; the prepared NOLOGIN role can read only business tables and cannot mutate/create/read the private ledger; existing role reuse is refused; and source contents remain unchanged by import/failure/retry/verify.

The first actual run reached the role probe but stopped because the test setup role had CREATEROLE without SET membership in the new limited role. The harness now performs only the permission probe through its own disposable-cluster administrator; the production role SQL guard/grants were preserved. The corrected complete SQL run passed. This is not proof of Neon's managed-role capabilities.

Independent review prompted binding SQL digests again immediately before target SQL, a forced owned-stream teardown at cancellation/cleanup timeout, safer failed-start owned-cluster cleanup, and an explicit SQL Editor absent-schema check after generic redacted errors. Repository lint initially rejected throws inside finally; cleanup control flow was refactored and lint passed. A genuine PowerShell inspect test exposed lost child stdout, which would hide the exported SHA receipt; explicit asynchronous bounded stdout/stderr collection corrected it, and a registered real-Windows wrapper regression now passes. No credential or actual learner data was used in those tests.

Final server build and all five workspace typechecks passed. Focused migration tests cover14snapshot,13transfer and7runner groups, including real PowerShell offline inspect; the final complete registered server result and final lint/format evidence are consolidated in independent review080. No additional browser/AWS/delivery regression rerun is claimed for this migration-only stage because no frontend, deployed adapter or delivery code changed. The15existing Neon runtime connection/TLS groups remain in the full server suite. All live-Neon behavior and the real user-started transfer remain pending.
