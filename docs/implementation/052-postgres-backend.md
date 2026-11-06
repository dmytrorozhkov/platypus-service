# Explicit PostgreSQL backend preparation 052

Date: November 5, 2026. Status: implemented with focused local tests; real database, browser, restart and hosted integration are coordinator-owned checks and are not established by this report.

## Scope and compatibility

The existing local main.ts and Lambda lambda.ts keep their deliberate fictional fixture repository. The accepted public application and its dependency-free Lambda package are not switched to a database. New postgres-main.ts is a separate explicit local entry point. It does not migrate, seed, create, start, stop or provision a database. Root owns package scripts/dependency integration; PostgreSQL schema and seed tooling are lane053.

PostgresTicketRepository implements the unchanged TicketRepository.list() interface. One fixed schema-qualified query joins organizations and nullable support-agent directory entries and orders by created_at ASC, number ASC. Explicit row mapping returns only the seven accepted fields, preserves null assignees and four statuses, serializes valid instants to UTC and sets total to the returned collection length. Empty results remain empty. Invalid row values and driver failures reject the query; there is no fixture fallback. No pagination, write route, authorization placeholder or customer data is added.

## Explicit local configuration and lifecycle

Set PGHOST, PGPORT, PGDATABASE, PGUSER and PGPASSWORD explicitly in the owned local process environment. PGHOST accepts localhost, 127.0.0.1 or ::1 only; this adapter uses ssl:false for the explicitly local instance and is not cloud database connection configuration. PORT defaults to3000 and ALLOWED_ORIGINS retains the existing origin validation. Values are never printed. Start the reviewed build through the coordinator-owned npm.cmd run start:server:postgres command. Run the separately owned database readiness/check command before a demonstration.

The process owns one pg pool: maximum5 connections, acquisition timeout3seconds, idle timeout10seconds, database statement timeout5seconds and client query timeout6seconds. application_name identifies this process; default_transaction_read_only adds defense in depth. Actual database grants, verified independently, remain the authority for read-only access. These local limits are not a Lambda connection budget.

The runtime attaches an idle-pool error listener. HTTP/database and idle-pool failures log only a fixed operation description and a bounded alphanumeric error code. The existing public500 envelope remains unchanged. GET /api/health remains HTTP liveness, performs no database query and does not claim readiness. A running process can therefore show the existing Tickets error while database access is unavailable.

SIGINT/SIGTERM share idempotent shutdown registered before listen. Stop accepting HTTP work, drain existing requests for up to5seconds, close newly idle keep-alive connections and destroy remaining owned HTTP sockets at the deadline. Then await pool.end() for up to7seconds. Remove signal listeners and disconnect an owned launcher IPC channel. An unrecoverable cleanup deadline makes this explicit executable exit with failure rather than leave its process running indefinitely. Startup interruption and listen failure follow the same cleanup path. No independently managed PostgreSQL service is stopped.

Exports for integration: readPostgresConfiguration(environment); createPostgresRuntime({configuration,pool?,signals?,log?,onShutdownFailure?,onStopped?,httpDrainMillis?,poolDrainMillis?}), returning server/start()/stop()/stopping; PostgresTicketRepository(queryable) and ticketListSql. Narrow injected pool/query/signal interfaces support deterministic boundary tests without pretending to prove a database.

## Focused verification

Server TypeScript compilation passed against coordinator-installed exact pg8.23.1 and @types/pg8.23.1. Thirteen focused tests passed with no failure, cancellation or skip:

- All25 authoritative examples mapped through an injected query; exact public fields, fixed query ordering/joins, nulls, normalized instants and an empty result.
- Invalid rows reject the whole collection; a query rejection reaches the existing application boundary.
- Explicit configuration requirements and bounded local pool policy.
- Actual HTTP liveness, safe500, later successful Retry and method restrictions over an injected pool; sanitized request and idle-pool logs.
- In-flight HTTP draining before pool closure; newly idle keep-alive cleanup; forced owned-request deadline; repeated stop; stop-before-start; signal interruption during startup; occupied-port cleanup preserving the independent listener; bounded pool shutdown.
- A real child invocation with missing PG settings exits nonzero with no fixture startup.

The graceful-drain test initially exposed keep-alive sockets becoming idle after shutdown began. The runtime now closes them on response finish while stopping; the corrected test passes.

Commands: npm.cmd run build --workspace @platypus/server; node --test apps/server/test/postgres-repository.test.mjs apps/server/test/postgres-lifecycle.test.mjs. The tests deliberately use injected pools except for the child missing-configuration check. They do not establish actual SQL, network recovery, grants, persisted edits, migration behavior, service restart or database performance. Coordinator integration must supply real PostgreSQL tests and browser evidence before acceptance. No AWS, CodeBuild, deployment, settings, credentials or Git mutation was performed by this lane.

## Remaining gates

Run shared lint/format/type/build/integration checks after consolidation, then independently review the exact candidate. Verify real25/5/3 counts, runtime grants, saved edits across same-storage restart and actual outage/Retry behavior in an explicitly isolated test database. Cloud database hosting, network/TLS/credentials and connection budgets remain a separately reviewed decision. Sign-in and server-enforced user/role/organization/blocking checks precede business writes or real organization data. Successful local preparation never authorizes deployment; the learner controls the later exact-release manual launch.
