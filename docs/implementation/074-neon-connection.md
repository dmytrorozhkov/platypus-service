# Neon connection preparation074

## Scope and interface

Prepared an explicit import-only `createNeonConnection({ environment })` adapter implementing the existing `TicketQueryable` interface and `close()`. `readNeonConfiguration(environment)` validates separate `NEON_HOST`, `NEON_DATABASE`, `NEON_USER` and `NEON_PASSWORD` fields. There is no executable, startup command, server/Lambda wiring, dependency update, migration or cloud connection in this step. Existing local guards and the public fixture remain unchanged.

Hosts must be AWS Neon pooled endpoint DNS names, accepting both the older regional shape and the optional `c-N` routing label. This is syntax validation, not endpoint ownership, regional availability or approval of a new data location. Database and user identifiers are explicit, with a deliberately narrow identifier alphabet. Passwords are never included in diagnostics; connection URLs are not supported.

## TLS and driver settings

The already pinned pg8.23.1 driver receives fieldwise configuration and verified TLS (`rejectUnauthorized: true`, TLS1.2 minimum, explicit hostname verification against the configured endpoint). A hostile connection URL or `PGSSLMODE` cannot disable TLS. Target fields, PostgreSQL SSL negotiation, UTF8 client encoding, application name, connect timeout and disabled replication are explicit. `options: ' '` is intentional: pg's `val()` treats an empty string as absent, which would otherwise import `PGOPTIONS`. A single whitespace character is a no-op startup value. No session-level read-only/timeout flags are sent through startup options.

`replication: 'false'` prevents the truthy environment fallback to `PGREPLICATION`. The owned real-driver TLS fixture verifies this explicit startup value. Compatibility with the actual Neon/PgBouncer service remains a future live check; it is not inferred from the protocol fixture.

The pool permits at most two physical connections, no warm minimum, a 10-second connect deadline, 10-second idle eviction and 300-second maximum lifetime. TCP keepalive is disabled, idle connections permit process exit, and there are no background wake-up/health requests. At most two outstanding adapter operations are accepted, including pending checkouts, so queued work and its timers are also bounded.

## Operation ownership and recovery

One read owns one checked-out client for `BEGIN READ ONLY`, transaction-local statement/lock/idle-transaction timeouts, the parameterized business statement and `COMMIT`. The existing repository supplies the SQL. The transaction's read-only setting complements future least-privilege role grants; it does not establish those grants or replace the trust boundary around application SQL.

The default overall 15-second operation deadline covers checkout and all statements. Per-query client timeout is 6 seconds; PostgreSQL transaction-local statement timeout is 5 seconds, lock timeout 2 seconds and idle-in-transaction timeout 6 seconds. Timeout test seams can only shorten the default budgets. The current public Lambda's 3-second timeout is unchanged and is not ready for this adapter without the separately agreed integration stage.

On a statement failure, rollback is attempted only while the same overall deadline remains active. The suspect client is always discarded. A deadline or active client error also discards the client, prevents late statements/commit and returns a fixed diagnostic. Late checkout is explicitly discarded before any SQL. There is no automatic query or connection replay: a later explicit user Retry starts a fresh operation.

The adapter owns checked-out client error events. pg-pool already removes/destroys an idle client before emitting its pool error; the adapter handles that event without retaining or logging the raw error. Logs contain fixed messages only, including when a diagnostic sink itself throws. Public operation errors have a fixed message and no raw cause, code or detail.

`close()` stops new queries, cancels active operations and calls this adapter's pool end once. Concurrent calls share one promise. Cleanup has a 3-second deadline; late connect/query/end settlement is observed and cannot produce an unhandled rejection. No database service, process or independently owned pool is stopped.

## Offline verification

Authored focused offline tests for invalid/missing configuration before factory use; actual pg connection parameters under hostile ambient settings; same-client transaction ordering; rollback/discard/redaction; stale-client failure followed by explicit Retry; hung and late checkout/query cleanup; active and idle errors; bounded outstanding calls; and concurrent/idempotent/deadline-limited close.

Additional real pg TLS tests use an owned ephemeral 127.0.0.1 listener and embedded public test-only certificate/key. A fixture-only TCP stream redirects every connection to that listener while retaining the configured Neon hostname for TLS verification. A fixture-only CA enables a trusted handshake, without changing production configuration or the OS trust store. Untrusted certificates and a trusted wrong-host certificate must be rejected before PostgreSQL startup; a trusted matching certificate must complete the read-only transaction. These are protocol/TLS fixtures, not a PostgreSQL or Neon server.

Author verification after the coordinated server rebuild: `node --test apps/server/test/neon-connection.test.mjs` passed all 15 groups, including all three real-driver TLS cases. The initial run passed 14/15: the trusted matching handshake completed, but the adapter returned the complete pg Result object rather than the intentionally narrow rows-only shape expected by the test. Returning `{ rows }` corrected that interface boundary; DNS-label validation and lint-safe control-character checks were also added before the final successful run. The coordinator records shared lint, format, types, complete regression results and independent review075 separately. No live Neon wake-up, actual role grants, SQL compatibility, storage/compute/egress metering, AWS credentials/secrets or deployment behavior has been verified by these offline tests.

## Integrated verification

The coordinator completed the server build and all five workspace typechecks, repository lint and formatting. All registered server tests passed (51/51, including the 15 new Neon groups); integration 7/7, startup 4/4, offline AWS-package 9/9 and offline delivery 46/46 also passed. The independent reviewer reran the focused 15/15 cases and found no remaining confirmed step1 blocker; see [review075](../reviews/075-neon-connection-review.md).

These are local results. No hosted workflow, CodeBuild run or real publication was started. Existing native databases/services and public fixture behavior were preserved. The code remains opt-in and is not wired into a server or Lambda. Actual Neon validation and any subsequent migration or hosting setup remain separate stages.

## Sources

- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling): pooled endpoint and transaction pooling constraints.
- [Neon securing connections](https://neon.com/docs/connect/connect-securely): TLS and certificate/hostname verification.
- [PgBouncer startup parser](https://github.com/pgbouncer/pgbouncer/blob/master/src/client.c): `set_replication` accepts false as ordinary non-replication startup; not a live test of Neon's deployed pooler.
- Installed pg8.23.1 `connection-parameters.js`, `connection.js`, `client.js` and pg-pool source: actual fallback, startup, checkout/release and idle-error behavior inspected during implementation.

No cloud resource, remote SQL operation, native database operation, secret file or deployment was created or performed.
