# Agent Task 014 - Local Ticket Server and Support Data Integration

Status: implemented and locally verified by local_ticket_integrator on feature/local-ticket-server. Independent review 015 complete with no remaining confirmed blocker. The user accepted the demonstrated slice after confirming the /api/tickets response. Reviewed implementation commit: 5532511. Evidence: docs/implementation/014-local-ticket-server.md and docs/reviews/015-local-ticket-server-review.md.
Date: November 4, 2026.
Project: D:/Projects/Pet-projects/aws.
Baseline: accepted task 012, independent review 013, implementation commit 9163b2d and acceptance record b43bf63.

## User-visible goal

Opening Tickets displays the same 25 fictional requests, now loaded from a local Node.js server instead of a public frontend fixture. If the server is unavailable, the existing readable error and Retry flow work. Restarting the server and selecting Retry recovers the list without restarting the frontend.

## Request and response contract

An endpoint is a server address for a particular operation. All response bodies below use JSON (JavaScript Object Notation), the structured data format already used by the fixture.

- GET /api/health returns status 200 and {"status":"ok"}. It indicates that this local server is running, not that authentication or a database exists.
- GET /api/tickets returns status 200 and an object with items and total. items contains the same 25 fictional tickets; total is 25, the number of available records in this unfiltered local collection. For an empty collection, return {"items":[],"total":0}.
- Each ticket retains number, subject, organization, status, assignee, createdAt and updatedAt. All fields are required; assignee may be null. Preserve the existing four statuses and UTC timestamps. Do not add product fields or change visible data during this integration.
- Responses use the application/json content type. Unknown endpoint paths return a JSON 404 response rather than an HTML application page. Unexpected server failures return a JSON 500 response with a readable public error and no internal stack trace.
- Define a small consistent error shape, for example {"error":{"code":"INTERNAL_ERROR","message":"Tickets could not be loaded."}}, and document actual codes in the implementation report. The client must not render arbitrary server text as HTML.

This is the first read-only contract. Query parameters, paging, sorting, filtering and permission-sensitive results are later work; total does not claim these features are already implemented.

## Implementation boundaries

- Create a separate Node.js npm workspace, preferably apps/server with name @platypus/server. Keep its startup/build boundary independent of frontend builds; use TypeScript and the existing compatible compiler unless a concrete constraint requires coordinator discussion.
- Select the smallest suitable server implementation. If adding a dependency, verify its maintained stable release, Node compatibility and official documentation, then pin it and record the choice. Do not introduce a large backend framework or upgrade unrelated frontend tooling.
- Move the authoritative 25-record fixture to the server side. Read it through a small repository/data-access boundary so a later PostgreSQL implementation can replace the fixture. Do not create duplicate independently maintained production datasets or make the server depend on an Angular source file.
- Preserve the Support TicketData/SignalStore boundary, loading/empty/error/Retry states, cancellation, stale-result guards and safe Angular startup/unmount. Adapt the response envelope at the data boundary. Do not fall back silently to frontend fixtures when the server fails.
- Keep the seven-column table, visual design, Analytics root redirect, existing navigation and all Native Federation/style lifecycle protections intact. Update the fixture-only UI wording to describe the actual local learning data without exposing implementation instructions in product controls.
- Make the server address configurable and document it; keep address/configuration details out of the table component. Support must work both through Shell and in its source and built standalone pages.
- Reserve a free local server port, preferably 3000. Bind for local learning use. Keep the actual allowed browser origins explicit for integrated Shell and Support standalone; configure cross-origin requests only as needed. Cross-origin rules do not provide user authorization.
- Extend the integrated startup/preview commands to own the server process and stop it on Ctrl+C. Occupied reserved ports fail clearly without selecting substitutes or killing unrelated processes. Keep independent server startup available.
- Keep all project artifacts and user-visible text English. The coordinator explains the result in Russian.

## Deliberately later work

PostgreSQL persistence, sign-in, organization/role checks, ticket creation/details/conversations, query controls, the final heavy-table library, the 100,000-record dataset, Lambda functions, AI, cloud deployment and paid services are outside this slice. This server exposes fictional local examples and must not be described as a secured production backend. Later server access checks and page sizes of 25/50/100 remain agreed requirements.

## Agent workflow and ownership

1. The user approved this assignment. The coordinator inspected the worktree and created feature/local-ticket-server from the accepted frontend state, carrying only the known task/plan drafts. Preserve the existing main baseline and user changes.
2. Assign one integrator ownership of apps/server, Support data integration, necessary shared contracts/configuration, dependencies, local startup scripts, focused tests, README and docs/implementation/014-local-ticket-server.md. One writer owns shared configuration.
3. The integrator verifies compatibility, implements the bounded slice and runs meaningful checks. The coordinator owns AGENTS.md, PROJECT_PLAN.md and task records.
4. An independent reviewer checks the contract, server/client boundaries, cancellation and failure recovery, process cleanup and evidence. Return confirmed defects for correction. Coordinate servers and builds to avoid concurrent interference.
5. The coordinator reviews the final snapshot, records verified results, demonstrates the result in Russian and saves an intentional local Git checkpoint. User acceptance precedes another stage.

The approved implementation uses one integrator followed by an independent reviewer. The coordinator owns planning records and the final Git handoff. Do not publish a remote repository, merge branches, create cloud resources or enable paid connections as part of it.

## Acceptance evidence

- Independently start the server and verify the actual health and ticket responses, content types, all 25 records, total, schema and JSON 404 behavior. Exercise a controlled internal failure through the server test boundary without a product debug endpoint.
- Verify the repository's empty result and server error handling with focused Node tests or a similarly small existing tool; avoid an unnecessary new test framework.
- In a real browser, prove Tickets requests the Node endpoint and no longer relies on a public ticket fixture. Verify all visible rows/columns, direct URL/refresh, navigation/history, theme and existing React/Vue behavior.
- Verify loading, empty and malformed responses, unavailable server, Retry/refetch and recovery after an actual server stop/restart. Test injection may control the data boundary; do not add product debug switches.
- Verify an outstanding ticket request is cancelled when leaving Tickets and cannot render a late result; preserve the existing delayed Angular bootstrap/application cleanup regression checks.
- Verify integrated Shell and both source/built Support standalone loading against the server with the actual browser-origin configuration.
- Verify occupied server port behavior, independent startup, integrated shutdown and no orphaned owned server process. Do not stop unrelated processes.
- Run lint, formatting, applicable typechecks/builds, focused server tests, existing hosting/contract checks and the necessary browser checks. Use actual commands and outcomes; disclose any unverified behavior.
- Record exact dependencies, server address configuration, startup/shutdown commands, successful checks, fixture limitations and the next PostgreSQL boundary in README and the implementation report. Generated output, dependencies and local evidence remain ignored by Git.
