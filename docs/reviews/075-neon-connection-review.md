# Independent Neon connection review075

Date: November 6, 2026. Scope: approved connection preparation073 only. Result: no remaining confirmed blocker for this import-only, offline-verified adapter. This is not approval to connect to Neon, migrate data or publish a cloud backend.

## Reviewed evidence

Reviewed the original contract073, current `apps/server/src/neon-connection.ts`, all focused tests, report074, shared test registration and the relevant installed pg8.23.1/pg-pool implementations. Inspected actual driver environment fallback, TLS upgrade, startup serialization, client error handling, checkout/release, active-query end and pool shutdown behavior. The independent reviewer reran `node --test apps/server/test/neon-connection.test.mjs`: all 15 groups passed, including real pg with owned loopback TLS fixtures. The certificate/key are public test-only fixtures; no OS trust change or external database connection was used.

Coordinator-reported integration evidence: server build, all five workspace typechecks, lint and format checks passed; registered server tests 51/51, integration 7/7, startup 4/4, offline AWS/package tests 9/9 and offline delivery tests 46/46 passed. These shared results are attributed to the coordinator rather than claimed as additional reviewer executions. No hosted workflow or real SQL verification was performed for this stage.

## Findings and corrections

The driver's configuration fallback treats an empty `options` value as missing and would import ambient `PGOPTIONS`. The reviewed implementation uses an explicit whitespace startup value and verifies actual pg configuration and serialized startup fields. Explicit target, TLS, negotiation, encoding and disabled replication values prevent hostile ambient configuration from changing the intended endpoint or weakening certificate checks. Host validation rejects URLs, IPs, spoofed suffixes and overlong DNS labels before pool construction. Diagnostics never echo supplied values.

Earlier implementation verification exposed a full pg Result versus rows-only interface mismatch. The final adapter returns `{ rows }`; all focused tests pass after this correction. DNS-label bounds and lint-safe control-character checks are present in the reviewed source. No unresolved finding remains from these corrections.

## Lifecycle and security assessment

- TLS requires certificate-chain validation and hostname verification against the configured Neon host. Owned loopback tests prove untrusted-certificate rejection, trusted wrong-host rejection and a trusted matching handshake without plaintext fallback. Fixture-only CA and transport injection are confined to tests.
- Each operation owns one client for `BEGIN READ ONLY`, transaction-local limits, the parameterized business statement and `COMMIT`. Failure attempts rollback only inside the remaining operation budget, discards the client and never replays SQL. A subsequent explicit Retry checks out a fresh client.
- Fixed max2 connections and max2 outstanding operations bound admission, checkout ownership and timers. The overall 15-second deadline covers checkout and statements; driver connect/query deadlines are 10/6 seconds. Late checkout is destroyed before any SQL; late business completion cannot commit or return data after cancellation. Ownership stays tracked until the underlying work settles, preventing an unbounded accumulation of late checkouts.
- Active client errors have an adapter listener. On release the pinned pool installs its own error listener before the adapter removes its listener. Idle-pool errors are contained; pg-pool already removes the faulty idle client. For an active non-pipelined query, the pinned driver's `end()` destroys the stream, supporting discard of hung work. Error causes and raw driver diagnostics are not retained in public errors or logs.
- `close()` rejects new work, cancels owned operations, calls this pool's end once and shares one bounded promise across concurrent calls. Late promise settlements are observed. No shared process, PostgreSQL service or independently owned pool is stopped.

## Remaining validation and scope boundary

The TLS fixture is a small PostgreSQL protocol responder, not a PostgreSQL engine or Neon service. Fake lifecycle tests establish ownership behavior, not actual sleeping-compute recovery. Current Neon/PgBouncer acceptance of the exact startup fields, SQL/timeouts, real least-privilege role grants, remote identity and data placement, cold/warm latency and free-plan storage/compute/egress remain unverified. The read-only transaction is defense in depth around trusted application SQL; it does not replace future server-side authorization or verified table grants.

The public Lambda still has its existing 3-second timeout and fixture repository. It is deliberately not wired to this adapter's 15-second operation budget. A separate reviewed integration must align those deadlines and package/secret/access requirements before publication. Existing local-only runtimes, native databases and learner servers remain outside this change. No Neon resources, remote SQL, migrations, secrets, AWS changes, CodeBuild or Package/Deploy execution were authorized or performed by this review.
