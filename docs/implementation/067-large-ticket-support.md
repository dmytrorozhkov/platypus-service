# Support server-query controls 067

Date: November 6, 2026. Status: implemented with focused source/template/state verification; integrated builds, real API/database/browser acceptance and independent review remain coordinator work.

## Result and boundaries

Added an optional paged Support flow without changing the Native Federation mount/bootstrap contract, shared packages, dependencies, public runtime file or legacy demo entry. Runtime configuration still loads from ticket-api-config.json. A missing ticketQueryMode preserves the existing /api/tickets collection, total-equals-loaded-count validation, 25-ticket table and existing loading/empty/error/Retry states. Only ticketQueryMode:"paged" selects the new /api/tickets/query and /api/tickets/options endpoints; unknown explicit modes fail safely.

The paged view keeps the existing seven-column table and shared scoped theme. It offers an explicit-submit number/subject search; status, organization, assignee/unassigned and inclusive created-date filters; all seven sort fields/directions; 25/50/100-row choices; previous/next navigation; and separate loaded/filtered-total/page counts. Labels are Search tickets, Search, Reset filters, Status, Organization, Assignee, Created from, Created to, Sort by, Sort direction, Rows per page, Previous page and Next page. Search is not sent while typing. Query-setting changes reset page1; paging alone retains filters and search. Reset restores the default query.

Defaults are page1, pageSize25, createdAt descending with no optional filters. URLSearchParams preserves literal search symbols; the server remains responsible for parameterized literal matching. The client checks page/size/sort/status/directory IDs, maximum100 search characters, control characters, real nonzero-year calendar dates and date order. Invalid input leaves the query controls accessible and gives a readable error; fixing it or resetting resumes requests. No client filtering, fetching of all pages, authentication simulation, write controls, table dependency, column resizing/reordering/hiding or bulk assignment was added.

## Data and lifecycle contract

TicketData exposes configuration(signal), load(configuration,query,signal) and options(configuration,signal). Configuration returns a validated HTTP origin and legacy/paged mode. Paged reads require matching numeric page/pageSize echoes, a safe filtered total and at most the selected row count. Oversized item arrays reject before parsing every ticket. Existing ticket parsing preserves the four statuses, nullable assignee, date validation and duplicate-number rejection. Option directories require valid unique UUIDs/nonblank names and at most1000 entries each. No database setting or credential enters frontend configuration.

TicketStore owns the current query, mode, page items, filtered total and option directories. It exposes the paged controls as soon as configuration establishes paged mode, before query/options completion. Controls remain reachable through initial options failure, later errors, empty results and loading. Each load reads current runtime configuration, then requests only its page and bounded options; option directories are refreshed with the request, not used as authorization. Retry uses the current query. Errors do not substitute fixtures or silently revert to the legacy endpoint.

Superseded requests share an aborted signal across configuration/page/options and cannot commit stale results. A latest-request identity check additionally guards implementations that resolve after cancellation. Failing page/options work aborts its siblings. Destroying the injected store aborts pending work; the existing remote unmount and delayed Angular startup cleanup remain unchanged. An empty page retains its filtered count and previous-page navigation.

## Focused verification performed

- npm.cmd run typecheck --workspace @platypus/support passed without emission.
- npx.cmd ngc -p apps/support/tsconfig.app.json --noEmit passed, including strict Angular template checks.
- npx.cmd eslint apps/support/src --max-warnings 0 passed.
- Focused Prettier checks passed for the authored source/template/style/test files.
- node --test apps/support/src/app/tickets/ticket-query.test.mjs passed5/5 groups with no failure, skip or cancellation. No environment variables are needed.

The retained Node tests compile owned TypeScript in memory and use actual installed Angular/NgRx state APIs with injected HTTP/data stubs. They verify literal encoded filters and invalid dates/limits; unchanged legacy endpoint/count/no-options behavior; bounded paged rows, count/page/option/config rejection; superseded request cancellation and stale completion rejection; query reset/current-query Retry; store destruction; and initial options failure retaining paged mode before empty filtered-result recovery. No shared dist output or new test dependency is required. This is frontend behavior evidence, not actual PostgreSQL/network/browser performance evidence.

## Remaining verification

Root owns shared builds and browser/real100000-row integration, the frontend-only support-large5176 runtime override and API3001 setup, full regression checks and independent review069. Browser acceptance must confirm the actual native controls and submitted requests, all seven sorts/filters, bounded25/50/100 rows, filtered totals, empty/error/Retry recovery and unchanged legacy/federated behavior. No browser session or native database operation was performed by this author. No cloud, Package/Deploy/CodeBuild, Git, secret, settings, service or shared configuration change was performed.
