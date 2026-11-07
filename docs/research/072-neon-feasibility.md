# Neon Free feasibility072

Date: November 6, 2026. Status: researched proposal, not a selected hosting service or a live Neon demonstration.

## Recommendation and scope

Neon Free is a credible candidate for the fictional100000-ticket learning database, conditional on measured storage, compute usage, regional latency and recovery tests. Keep the Angular frontend and Node.js Lambda backend in AWS; preserve the agreed Cognito authentication direction. This proposal does not introduce Neon Auth, Functions, a Data API, an ORM or a new application database engine. RDS PostgreSQL remains the alternative when keeping data in Stockholm or requiring dedicated always-on capacity becomes more important than avoiding recurring database charges.

The learner authorized research only. No Neon account/project/role/branch/API key was created, no database connected or populated, and no AWS or repository setting/publication changed. Native databases and learner-owned servers remain untouched. Source inspection is not evidence that the current application already connects to Neon.

## Current published offer

The current [pricing page](https://neon.com/pricing) advertises Free with no trial deadline or required card. A project receives1GB Postgres storage,100CU-hours/month and5GB monthly public egress; compute can scale to2CU and suspends after five idle minutes. One CU is capacity, not an ordinary elapsed hour. Current limits supersede older articles describing0.5GB/50CU-hours.

The [plan documentation](https://neon.com/docs/introduction/plans) says exhausted compute or egress suspends compute until renewal or an upgrade. Storage exhaustion blocks storage-growing operations; quotas do not delete data. Included recovery is short: six hours of history bounded by1GB changes and one manual snapshot; scheduled backups are excluded. These are service limits, not an automatic paid-upgrade instruction. Do not add a payment method or upgrade under this proposal.

Python Decimal calculations from the published100CU-hour allowance: at fixed0.25CU it provides400 active hours; at2CU,50 active hours. A hypothetical730-hour month continuously at0.25CU consumes182.50CU-hours and exceeds the allowance. Two active hours/day for30days at0.25CU consume15CU-hours before idle tails, migration, verification, branches or scaling. These are illustrations, not measured workload forecasts. Keep-alive queries would defeat useful idle suspension; no scheduled wake-up is proposed.

## Regions and connection route

The complete [region list](https://neon.com/docs/introduction/regions) includes AWS Frankfurt and London but not Stockholm. Candidate Neon region: aws-eu-central-1 (Frankfurt), explicitly a proposal requiring acceptance of data placement outside the application's selected Stockholm region. Existing AWS resources stay in eu-north-1. The choice introduces a network round trip between regions/providers; no numeric latency or network-cost guarantee is made. A Neon project's region is fixed after creation; moving later requires a new project and migration.

[Neon's Lambda guide](https://neon.com/docs/guides/aws-lambda) demonstrates ordinary Node.js `pg` connectivity. Retain our own CloudFormation and handler architecture instead of copying its sample deployment or obsolete runtime example. A public TLS endpoint can be reached from Lambda's default network without introducing a customer VPC/NAT just for the database; [AWS networking documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html) distinguishes this from a VPC-attached function. This is a candidate architecture, not a fresh readback of the live function's networking. Neon Free has no private-network option. AWS Lambda, logging, credential retrieval and outbound transfer remain independently metered; free database hosting does not promise a zero application bill.

Database credentials stay on the server and outside tracked files, frontend artifacts, CLI arguments, logs, chat and screenshots. The future secret source and its AWS access permissions must be priced and reviewed. Neon does not automatically resolve existing organization-policy restrictions or the incomplete human-only delivery credential separation.

## Repository compatibility and actual gaps

Inspected source: apps/server/src/postgres-runtime.ts, postgres-ticket-repository.ts, lambda.ts; apps/server/database/001.sql, migrate-seed.mjs and large/{cli.mjs,seed-large.mjs}; infrastructure/backend.template.json and scripts/aws/prepare.mjs.

| Area                    | Observed implementation                                                                                                            | Required future preparation                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL version      | Native18.6; ordinary SQL, UUID, foreign keys, constraints, C collation, B-tree indexes, materialized CTE and parameterized queries | [Neon supports PostgreSQL18](https://neon.com/docs/reference/compatibility); verify the actual provisioned minor version and run existing real SQL checks before calling compatibility proven |
| Runtime configuration   | Explicit loopback-only host, ssl:false, five local pool connections, startup session options and short deadlines                   | Separate cloud adapter with validated project/database identity, verified TLS and a bounded Lambda connection budget; preserve local restrictions                                             |
| Lambda                  | Current handler explicitly constructs FixtureTicketRepository; no database driver in the reviewed six-file package                 | Prepare a separate PostgreSQL handler and dependency-complete package, review inventory/receipts and failure handling before any publication                                                  |
| Timeouts and reconnects | Template Lambda timeout3seconds; local connect timeout3seconds/query timeout6seconds                                               | Align deadlines and test the first request after Neon sleep, stale warm connections and bounded Retry; no unbounded retries or keep-alive scheduler                                           |
| Setup and seed          | Local large CLI refuses remote hosts; exact database allowlist, transaction lock, immutable schema/seed/index provenance           | Separate explicitly owned cloud setup path with direct connection, TLS, preflight identity and safe empty-target/repeat checks; do not weaken the local CLI guard                             |
| Permissions             | Owner and SELECT-only app roles are separate locally                                                                               | Apply equivalent scoped roles in Neon; Lambda must not use the default administrative Neon owner credential                                                                                   |

[Neon role documentation](https://neon.com/docs/manage/roles) distinguishes administrative console-created roles from narrowly granted SQL-created roles. Use SQL-managed least-privilege runtime access in the future design and verify denied business writes, ledger access and DDL explicitly.

[Connection pooling](https://neon.com/docs/connect/connection-pooling) uses transaction-mode PgBouncer: a pooled endpoint is a candidate for runtime reads; direct connections are preferable for migrations/admin. Persistent session settings and session advisory locks are restricted. Our loader uses transaction-scoped advisory locks and explicit transactions, but the migration path will still use direct connections. Existing startup options/timeouts must not simply be copied to the pooled endpoint: enforce read-only capability through real grants and verify compatible role/transaction timeout settings. Fully qualified platypus table names already avoid reliance on mutable search_path. Pooling's advertised client ceiling is not the amount of simultaneous SQL work a small compute can perform.

[node-postgres TLS guidance](https://node-postgres.com/features/ssl) warns that connection-string SSL parameters can overwrite an explicit SSL object. Select one validated configuration path, require certificate/hostname verification and never use rejectUnauthorized:false. The special Neon serverless driver is not required for ordinary Node TCP connectivity and is not proposed merely because Lambda is serverless.

## Small next step: measure local storage

The current native database's real size has not been measured. Row count or JSON size cannot establish whether it fits the free quota. A learner-run read-only query with the existing app role can report the whole database and ticket/index size. No owner/admin access or password sharing is required:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -X -h 127.0.0.1 -p 5432 -U platypus_app -d platypus_service_large -W -c "SELECT pg_database_size(current_database()) AS database_bytes, pg_size_pretty(pg_database_size(current_database())) AS database_size, pg_size_pretty(pg_total_relation_size('platypus.tickets')) AS tickets_with_indexes;"
```

[PostgreSQL size functions](https://www.postgresql.org/docs/18/functions-admin.html) include table/index/TOAST totals. Local physical size is a conservative planning input, not an exact measurement of Neon's metered storage; later verify the Neon dashboard and leave room for updates, vacuum, schema growth and subsequent features. The oneGB limit must support the project, not merely the current ticket table. If adequate headroom cannot be shown, revise the dataset/hosting proposal explicitly rather than silently reducing the agreed100000 tickets.

## Proposed bounded validation sequence

1. Receive the local size output and compare capacity with explicit headroom. No secret is sent.
2. If the learner selects Neon/Frankfurt/Free, prepare separate cloud configuration and owned-target migration tools, tests and an independent review before any data-writing operation. The learner creates the account/project and handles terms/sign-in; registration is not covered by research approval.
3. Separately authorize the exact fictional-data setup. Through a direct setup connection, verify project/branch/database/version, create scoped roles/schema and load canonical100000 rows; prove checksums, six indexes, safe reruns and write denial for the runtime role. Preserve native databases.
4. First validate the prepared application locally against the explicitly authorized remote test database: all14sorts, filters,25/50/100 bounded pages, totals, error recovery, sleep/wake and connection cleanup. Compare cold/warm timings and observe actual Neon storage/CU/egress usage. No public application switch is implied.
5. Before AWS publication, review the full artifact, credentials/access, costs and remaining learner-only delivery mechanism. Only the learner starts the reviewed cloud publication. Retain the public fixture version until acceptance and an explicit switch decision. Authentication/authorization precede public business CRUD.

Research checks: primary vendor/AWS/PostgreSQL documentation, inspected repository paths and deterministic compute calculations. No Neon runtime, storage-fit, account eligibility, credentials, load test, billing outcome or cloud publication was verified. No application/dependency/infrastructure changes were made.
