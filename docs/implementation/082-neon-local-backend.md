# Explicit local Neon backend082

Implemented November7,2026 under [contract081](../architecture/081-neon-live-connection-contract.md). This is the separately selected local backend for the learner-created Free Frankfurt project. Existing local PostgreSQL entry points, fixture main/Lambda, native services and public AWS deployment are unchanged. A database role is not application authentication or organization authorization.

## Configuration and runtime ownership

`apps/server/src/neon-runtime.ts` exports `readNeonRuntimeConfiguration`, `probeNeonConnection` and `createNeonRuntime`.

Configuration requires explicit `NEON_HOST` with an AWS Frankfurt pooled endpoint, `NEON_DATABASE=neondb`, `NEON_USER=platypus_app`, a private `NEON_PASSWORD` and `NEON_CONFIRM_TARGET` exactly matching `host/neondb`. No owner identity, ambient PG variables or connection-URL fallback is accepted. Configuration diagnostics never include supplied values. The default API port is3002; the default allowed frontend origin is `http://localhost:5177`. An explicit valid numeric port and origins can be selected. The existing local-only HTTP listener is preserved.

The runtime composes the existing `createPostgresRuntime` with a connection shim: queries delegate to the reviewed `createNeonConnection`, cleanup delegates to its `close`, and redundant pool error hooks do nothing because the connection adapter owns driver failures. It does not construct another pool. Existing bounded ticket query parsing, PostgreSQL repository, API errors/CORS/no-store and HTTP shutdown machinery are reused. The adapter retains strict certificate/hostname validation, at most2 connections, read-only transactions, its15second operation budget and3second close budget; no SQL replay is added.

Startup completes one adapter-owned read-only probe before HTTP listens. The probe requires PostgreSQL18/UTF8, database `neondb`, both current/session identities `platypus_app`, LOGIN with no superuser/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS/INHERIT flags, no direct role memberships and no ownership of the database, any schema or the three business tables. It checks schema USAGE with no CREATE, no database CREATE, SELECT on all three business tables and no effective INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER grants. The write check includes column-only INSERT/UPDATE/REFERENCES privileges. `transaction_read_only` must be `on`. Missing relations or malformed/ambiguous probe rows fail closed. The exported probe returns only fixed safe identity metadata, never endpoint/password or raw driver failure details.

Stop before/during a pending probe prevents a late HTTP listen; the startup promise observes cancellation even if the injected query settles later. Probe/listen failure cleans up the owned connection. SIGINT/SIGTERM use the same idempotent stop path. The reused HTTP drain defaults to20seconds and pool drain to4seconds, covering the adapter's bounded operation and close periods. `/api/health` stays a query-free HTTP liveness route rather than waking the database periodically. The frontend performs deliberate data requests; no keepalive/polling loop was introduced.

## Explicit executable and operator interface

`apps/server/src/neon-main.ts` accepts exactly one command: `check` or `serve`. Importing either new module performs no connection query, HTTP listen or process-listener registration.

After the root-owned password-prompting wrapper is integrated, the intended learner commands are:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\neon-runtime.ps1 -Action check
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\neon-runtime.ps1 -Action serve
```

The wrapper asks privately for the endpoint/target confirmation and hidden runtime-role password. No password belongs in chat, shell arguments, SQL history or a tracked file. The runtime uses the app role, never `neondb_owner`. One-off `check` probes, reports `Neon connection check passed.`, closes its pool and exits without HTTP. `serve` probes then prints a local ready URL and optional safe `{type:'ready',port}` IPC notification.

For an explicitly parent-owned foreground process, `NEON_CONTROL_STDIN=1` enables only a bounded ASCII stop-control channel; split `stop` lines and EOF call the same stop path. Invalid/oversized control data also stops the owned process safely. It is not a credential/input command shell. Listeners are removed and stdin paused on cleanup; cleanup rejection is observed. An IPC parent disconnect stops only this runtime, and disconnect calls are guarded against already-closed channels. Check mode never reads stdin.

## Verification actually performed

- Server typecheck passed with no output generation.
- Coordinator's server build passed; author subsequently ran the11 new focused test groups, all11 passed without skip/cancel.
- Targeted ESLint passed on both new TypeScript modules and the test file.
- Formatting and coordinator-wide checks are recorded by the coordinator after integration; they are not inferred from targeted checks.

The11 groups cover explicit configuration and malformed targets; every identity/privilege predicate and sanitized query failure; startup gated by probe; real owned ephemeral HTTP pagination, parameter forwarding, CORS/no-store and POST refusal; query-free health; probe rejection with one cleanup/no fixtures; cancellation before/during probe and late settlement; sanitized API error followed by explicit Retry with no hidden replay; drain of an in-flight HTTP request; independently owned occupied port preservation and bounded cleanup failure; split/EOF/invalid/oversized stdin control and cleanup rejection; exact CLI argument refusal, missing configuration refusal and import-only child process exit.

Fake database objects and owned loopback HTTP listeners were used. These tests did not use real Neon, native database credentials or any native PostgreSQL service. Root owns separate disposable real PostgreSQL effective-role/SQL validation and its evidence. No live migration, real TLS/cold/warm/wake results or application-data acceptance can be claimed from these tests. Those steps require learner-local private input and are recorded separately in083. No AWS/Lambda publication, CodeBuild, Package/Deploy dispatch, secret upload, service installation/restart or default runtime change occurred in this author's work.
