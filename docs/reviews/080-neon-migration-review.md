# Independent Neon migration review080

Date: November 6, 2026. Scope: approved preparation076 only. Result: no remaining confirmed blocker for the prepared manual transfer; learner acceptance and the actual export/import remain pending. This review concerns a learner-started transfer of the actual local three-table dataset to Neon, rather than regenerating seed fixtures. No native project database, Neon endpoint, learner credentials, AWS resource or publication was used by the reviewer.

## Independently reviewed scope

Reviewed contract076, snapshot077, transfer078, connection/CLI/PowerShell runner, their focused tests, the trusted001.sql and large/indexes.sql, the installed pg8.23.1 connection lifecycle, the isolated PostgreSQL harness and the manual runbook079. Source selection remains fixed to127.0.0.1:5432/platypus_service_large as platypus_app. Target selection requires an explicitly confirmed direct Frankfurt Neon hostname/neondb and neondb_owner. The prepared commands do not automatically chain export and import, start deployment or change the application's runtime.

The reviewer independently executed:

```powershell
node --test apps/server/test/neon-snapshot.test.mjs apps/server/test/neon-transfer.test.mjs apps/server/test/neon-migration-runner.test.mjs
```

The initial 32 groups passed: 14 snapshot, 12 transfer and 6 runner. After review corrections, the reviewer reran the changed transfer/runner areas: all 19 passed, including the new thirteenth transfer group. After the coordinator's final lifecycle/output correction, the reviewer reran the 7 runner groups, including real Windows PowerShell parser/inspect execution and receipt/hash output. Together these independently cover the final 34 migration groups. These executions used in-memory datasets, fake clients and owned temporary files; they opened no database connections and prompted for no credentials. The snapshot execution includes an actual 100000-distinct-row in-memory canonical roundtrip, but that result alone does not establish SQL or Neon performance.

## Data, transaction and security assessment

- The artifact contains typed business data and current normalized schema/index hashes only. Exact fields, UUID order, limits, references, timestamps, UTF-8 encoding and canonical JSON are enforced. Hashing canonical typed JSON avoids ambiguous separator-based fingerprints. External SHA256 is mandatory before decoding/importing; full canonical re-encoding rejects duplicate keys and alternate encodings. Max+1 SELECT limits and byte preflight refuse oversized exports rather than silently truncating them.
- Export owns one repeatable-read read-only transaction. It preserves actual ids, edited subjects/names, status, nullable assignments and millisecond UTC timestamps. No source owner/password/permissions or seed provenance is exported; import uses trusted local SQL and parameterized batches instead of interpreting snapshot SQL.
- Import validates input before target SQL, acquires a nonwaiting transaction advisory lock and uses one transaction for schema, business rows, indexes and dedicated import provenance. Before commit, complete readback fingerprints/counts and bounded representative queries are checked. An unknown existing schema, changed snapshot, altered ledger, altered content or detected catalog drift causes refusal without deletion, adoption or repair. An identical rerun verifies without inserting again.
- The catalog signature covers exact table/column inventories, current column types/nullability/defaults, constraint definitions/enforcement and index definitions/readiness/validity, plus row-security flags. PostgreSQL18 not-null constraints are verified by required column positions. ACCESS SHARE locks protect known tables against concurrent ALTER/DROP during verification. Unexpected user triggers are refused.
- Failures attempt rollback without claiming that a failed rollback or lost COMMIT response proves an unchanged target. An uncertain import explicitly requires separate verification before retry. No SQL or connection operation automatically replays.
- The connection wrapper bounds its owned operation and cleanup, observes late settlement, ends only its own client and prevents late work from sending further SQL after cancellation. Fieldwise pg configuration neutralizes ambient PG target/TLS/options values. Target TLS requires a trusted chain and the explicit hostname; no insecure fallback is exposed.
- The PowerShell wrapper prompts privately for passwords, passes them only to the owned child environment, clears its temporary secret values and uses fixed redacted failure messages. The fixed ignored snapshot directory, safe id, exclusive creation and bounded file reads avoid arbitrary target paths or accidental export overwrite. No password or URI is requested in chat or written to a tracked file.
- The separate runtime-role SQL refuses a different setup database/user or an existing role. It prepares a NOLOGIN nonadministrative role with only explicit CONNECT/USAGE/three-table SELECT grants. Login/password activation and effective live Neon privileges remain later private integration work; application authentication is not introduced here.

## Findings and corrections

The final source/runbook review found no remaining confirmed blocker for this preparation. The following review findings were corrected:

- Import now rechecks the separately loaded executable schema/index hashes against the validated snapshot before any SQL. An isolated child module-mock test changes either loaded digest after validation and proves zero SQL, without modifying trusted schema files.
- Cancellation and cleanup timeout now force-destroy the owned pg stream as well as ending the client once. This prevents a stalled graceful shutdown from retaining an owned connection after its cleanup bound. The lifecycle sentinel verifies the destruction and observes late rejection.
- The runbook no longer implies that a generic redacted verify error distinguishes an absent schema from drift. A separate read-only SQL Editor identity/schema-absence check is required before an explicit initial retry; unknown or changed targets still require investigation.
- The owned integration harness uses the exact neondb_owner setup identity required by the role script. Effective role checks use a separate test-superuser session with SET ROLE, rather than weakening the production guard or assuming that CREATEROLE alone grants SET ROLE. Its cleanup checks the marked owned data path/PID even when startup was attempted but did not successfully return.
- An actual coordinator PowerShell smoke check exposed missing child stdout. The final wrapper explicitly drains both child streams asynchronously, prints the bounded successful JSON receipt and discards private stderr in favor of fixed failure text. The new real PowerShell offline-inspect test independently confirms the receipt and SHA are visible without a password prompt. The final connection cleanup refactor also satisfies the no-unsafe-finally lint rule without suppressing operation/cleanup failure.

## Coordinator-attributed database and shared evidence

The coordinator reports 7 passing groups in a newly initialized, marked PostgreSQL18.6 cluster on its own ephemeral loopback port. This was real SQL with 100000 synthetic test rows and a deliberately edited subject, not the learner's native project database and not Neon. The checks established concurrent-edit snapshot isolation; exact import/catalog/index/full-data verification and an identical no-write repeat; failure at ticket batch100 rolling back all imported DDL/data/ledger followed by explicit successful retry; preservation of an unknown existing target; data/index drift refusal; NOLOGIN business-table SELECT with write/schema/ledger denials and role-reuse refusal; and preservation of source contents throughout target operations.

The full harness took237925ms including initialization, population, exports, multiple imports and failure/retry checks. It is not a single import measurement or a Neon latency estimate. The initial harness role-probe actor lacked SET ROLE, and was corrected to a dedicated owned test-superuser session; the production role SQL was not weakened. The coordinator verified successful stop of only the owned cluster.

The coordinator's final shared checks passed: server build, all five workspace typechecks, repository lint, format check and complete registered server suite **85/85**, with no skipped or cancelled tests. The complete suite includes the 34 migration groups and 51 existing server/runtime/TLS groups. Git diff whitespace checking was clean. These results are attributed to the coordinator; the reviewer did not rerun the owned database harness or shared builds. No hosted workflow or new frontend/browser/AWS/delivery regression execution is claimed for this migration-only stage.

Final runbook079 review confirms separate export/inspect/import/verify actions, private prompts and exact target confirmation; the current expected100000/100/40 counts; no destructive repair; explicit handling of uncertain commit/schema absence; and a separate later NOLOGIN-role step. Existing native services/data and the public fixture remain outside the prepared operation. The scenario is ready for learner review, not an already completed migration.

## Remaining boundary

Local PostgreSQL tests are not live Neon proof. Remote TLS/startup acceptance, actual role permissions, direct-endpoint identity, sleeping-compute wake behavior,0.25CU latency, Free-plan storage/compute/egress use and the actual learner dataset transfer remain unverified until a separately accepted manual operation. The public fixture Lambda remains unchanged; its existing3-second timeout is not aligned with the prepared15-second runtime adapter. This preparation does not authorize cloud SQL, runtime wiring, secret activation, CodeBuild, Package/Deploy or publication by agents.
