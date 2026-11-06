# 064. Parallel large-ticket implementation contract

Date: November 6, 2026. Learner approved implementation after the three-lane proposal. Scope: local/disposable PostgreSQL read-only querying of exactly100000 fictional tickets, Angular controls, integration and independent review. This is not AWS/database hosting or business-write authorization.

## Shared interface, fixed before parallel implementation

Keep existing GET /api/tickets and the default fixture/Lambda/packaged demo compatible with25 records. Add optional repository methods and GET /api/tickets/query and GET /api/tickets/options only where supported; unsupported repositories return404 for new paths. Legacy PostgreSQL list must cap reads at101 and fail safely if more than100 rows would be returned; it must never return100000 rows through the old collection contract.

GET /api/tickets/query accepts each known parameter at most once. Unknown or invalid parameters return400 with existing sanitized error shape. Entire query string is bounded at2048 characters. Parameters:

- page: decimal integer1..100000, default1; pageSize:25,50,100, default25.
- search: trimmed literal case-insensitive substring of ticket number OR subject, maximum100 characters; %, _ and backslash are literals, not user-controlled SQL wildcards. Empty means no search.
- status: one exact existing English status, optional.
- organization: UUID from organizations, optional. assignee: UUID or unassigned, optional.
- createdFrom and createdTo: real YYYY-MM-DD calendar dates, inclusive UTC dates, optional; from must not exceed to. End date is implemented as an exclusive next-day bound.
- sort: number, subject, organization, status, assignee, createdAt or updatedAt; default createdAt. direction: asc or desc, default desc. Explicit null placement and a unique ticket-number tie-break make paging deterministic. Number ordering compares the numeric suffix without unsafe arbitrary-size casting; other text sorts use a stable explicit PostgreSQL collation.

Successful page response: {items: Ticket[], total: number, page: number, pageSize:25|50|100}. Ticket retains exactly its seven fields. total is the filtered count; items is at most pageSize. Beyond the last page returns empty items while retaining the correct total. Query values use SQL parameters and sort columns/direction use allowlists. A single request must not produce mixed count/page snapshots. Existing local pool read-only/timeouts remain enforced.

Options response: {organizations:[{id,name}], assignees:[{id,name}]}, stable label/id order; cap each directory at1000 and fail safely rather than silently omit entries. Statuses are the existing client constants. IDs stay identifiers; organizations/assignees are labels, not authorization. This local fictional-data stage provides no real user access boundary.

Support runtime configuration adds optional ticketQueryMode:"paged". Absent means the unchanged legacy25-record flow. Paged mode uses query/options endpoints, defaults25 per page, displays filtered total separately from loaded count and resets page1 when search/filters/sort/pageSize change. Cancel superseded requests and ignore stale completions. Do not fetch all pages. Search uses explicit submit, other filters may apply immediately. Provide labelled keyboard-operable controls, deterministic loading/error/empty/Retry behavior and current-query retry. No paid table dependency, column resizing/reordering/hiding or bulk assignment in this bounded slice; those remain agreed later requirements.

## Data and environment isolation

Use a separate database platypus_service_large for a future learner-owned native demonstration and platypus_service_large_test for fresh marked GitHub tests. Keep the current platypus_service25-record database untouched. Reuse existing schema migration001 in the separate database; do not edit the old migration/seed or reset ordinary data. New generator/loader lives under apps/server/database/large/.

Data lane exports generateLargeDataset() producing deterministic organizations/supportAgents/tickets with stable UUIDs, exactly100000 unique ticket numbers,100 organizations and40 support agents, all four statuses, assigned/unassigned cases and varied valid UTC dates. Export seedLarge(pool) for explicit separately initialized empty large database, and verifyLarge(pool) for bounded read verification/reporting. Restrict actual target by current_database() allowlist above, require the existing checked schema and use an independent checksummed seed ledger. Refuse adopting nonempty business tables without the matching owned seed record. Transactional batch inserts; repeat same seed must not duplicate or overwrite records. No huge generated JSON in Git. Add query-driven B-tree indexes with recorded SQL/checksum under owned large directory; no extensions required. Coordinate exact counts/IDs/generator exports with root. Ordinary main/Lambda fixture remains25.

Native roles/passwords remain learner-local. Agents do not create/adopt/reset native databases, collect secrets, stop existing servers or restart the shared Windows PostgreSQL service. Root prepares separate hidden-password commands targeting only the named large database/port3001 and a frontend-only support-large mode on5176 with an in-memory paged runtime-config override. Existing user-owned3000/5175 processes stay intact; tests use other owned ephemeral ports.

Real100000-row checks use the existing pinned disposable GitHub PostgreSQL service with an additional explicitly named marked test database. Setup is GitHub-only and refuses ordinary targets. Seed repeat/count/constraints, real parameterized query accuracy/paging/filters/sorting/invalid input, app-role read-only behavior and actual Angular HTTP/browser flow must be demonstrated. Record machine/runtime, dataset, query times and browser observations; do not invent an unmeasured performance claim. Existing5-second statement timeout is a safety bound, not a selected product-speed target. No shared native instance service operation.

## Ownership and sequence

- Root owns this contract064, shared package/dependency/lockfiles, CI, static-server runtime override, local runner, cross-layer integration/browser/performance tests and report068, Git and shared records. Only root builds shared dist outputs; authors use noEmit or isolated temporary outDir for focused verification.
- data_next_slice owns065: apps/server/database/large/**, apps/server/test/large-data.test.mjs, apps/server/test/large-postgres-integration.test.mjs and docs/implementation/065-large-dataset.md. No package/shared/backend/frontend edits or native database access. Coordinate real tests with root's marked CI DB.
- backend_next_slice owns066: apps/server/src ticket repository/application/server/PostgreSQL query implementation and focused server tests (excluding data-lane tests), report066. Preserve main.ts/lambda.ts behavior; only necessary nonbreaking URL-query propagation in shared adapters. Root owns frontend/CI/commands. No shared dist builds.
- frontend_next_slice owns067: apps/support/src/** and report067. No shared scripts/config/package/dependency changes. Root provides optional runtime override and browser integration. Preserve Native Federation mount/style lifecycle and legacy demo acceptance.
- Authors implement independently against the fixed contract, run meaningful focused checks and hand off actual evidence/limits. Root resolves interfaces, performs full lint/format/types/build/regression/real hosted tests. Independent reviewer069 follows integration; corrections then learner demonstration. Branch publication may start ordinary CI only. Agents do not dispatch Package/Deploy or start CodeBuild/AWS publication.

All repository content English; conversation Russian, small learner actions. No cloud resource/access/state/settings/secret/delivery-enable changes, Sonar, dependencies or spending under this stage. Cloud PostgreSQL selection/costs and authentication/business writes remain later decisions.
