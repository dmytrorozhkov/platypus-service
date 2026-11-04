# Implementation 014 - Local Ticket Server

Date: November 4, 2026.
Status: implemented and locally verified; independent review 015 complete with no remaining confirmed blocker. The user accepted the demonstrated slice after confirming the /api/tickets response. Reviewed implementation commit: 5532511; the coordinator verified a clean worktree afterward. Review: docs/reviews/015-local-ticket-server-review.md.
Branch: feature/local-ticket-server. The coordinator owns the reviewed Git checkpoint and acceptance record.

## Result and scope

Tickets still displays the same 25 fictional requests, now obtained from a separate Node.js server. The authoritative dataset moved unchanged from Support's public assets to apps/server/src/fixtures/tickets.json. Support no longer serves a ticket fixture or silently substitutes local data when the API fails. No ticket fields, status values, rows or table controls were added.

The seven-column table, shared Tailwind theme, NgRx SignalStore, independent Angular Native Federation build, private dependencies, isolated orchestrator state, additive import maps and asynchronous Angular cleanup remain. Analytics stays the default route; React and Vue behavior is preserved.

This read-only local learning server has no authentication, authorization or database. The later PostgreSQL repository, server-side role/organization checks, querying, 100,000-record dataset and page sizes of 25/50/100 remain requirements for later stages.

## Implementation and compatibility

The independent @platypus/server npm workspace uses Node's built-in HTTP module. It adds no runtime dependency or backend framework. Its pinned development dependencies are TypeScript 6.0.3 (already used by the frontend) and @types/node 24.19.2, matching the Node 24 runtime family. The latter resolves undici-types 7.24.6 in its nested development dependency tree. Existing frontend versions and their resolved graph are unchanged; the root lockfile contains only 32 added lines for the new workspace, link and type packages.

The compiler uses strict checking, NodeNext module resolution, ES2022 output and explicit .js import specifiers. It emits an independent apps/server/dist directory, including the imported fixture JSON. Starting that output requires no Angular source, frontend build or frontend dev server.

Primary references inspected before implementation:

- Node 24 HTTP server, listener and shutdown APIs: https://nodejs.org/docs/latest-v24.x/api/http.html
- TypeScript NodeNext guidance: https://www.typescriptlang.org/tsconfig/module.html
- Published Node 24 type versions: npm.cmd view @types/node@24 version --json, from https://registry.npmjs.org/@types%2fnode

Actual local compilation and tests supplement those references. Verified environment: Node 24.21.0, npm 11.19.0. The existing ^24.16.0 || >=26.0.0 workspace requirement is retained.

FixtureTicketRepository implements TicketRepository.list(), returning an independent items/total collection. A PostgreSQL implementation can replace that boundary later. The server factory accepts a repository and local error logger, allowing controlled empty and failure tests without adding any product debug endpoint.

ApiTicketData loads deployment-relative ticket-api-config.json, validates its apiBaseUrl, requests /api/tickets and validates the items/total envelope and existing ticket schema. This first unpaged contract requires total to equal items.length. Configuration and data requests both use no-store and the store's AbortSignal. Existing SignalStore cancellation and stale-request guards remain unchanged. Arbitrary server error text is not rendered as HTML or exposed in the user message.

## HTTP contract and configuration

| Request                                | Result                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------- |
| GET /api/health                        | 200, {"status":"ok"}                                                        |
| GET /api/tickets                       | 200, {"items":[25 existing tickets],"total":25}                             |
| Empty injected repository              | 200, {"items":[],"total":0}                                                 |
| Unknown path                           | 404, error.code NOT_FOUND                                                   |
| Unsupported method on a known endpoint | 405, error.code METHOD_NOT_ALLOWED, Allow: GET, OPTIONS                     |
| Disallowed browser origin              | 403, error.code ORIGIN_NOT_ALLOWED                                          |
| Unexpected repository failure          | 500, error.code INTERNAL_ERROR, public message Tickets could not be loaded. |

JSON responses use application/json; charset=utf-8, no-store and nosniff. Error bodies consistently have {"error":{"code":"...","message":"..."}}. The 500 response omits internal exception details; the local logger receives the original exception.

The server binds localhost, port 3000 by default. PORT accepts an integer from 1 through 65535. ALLOWED_ORIGINS optionally replaces the comma-separated origin list; defaults are explicitly http://localhost:4200 and http://localhost:5175. Allowed origins receive their exact Access-Control-Allow-Origin and Vary: Origin. Known endpoints accept OPTIONS with GET, OPTIONS advertised. No wildcard or credential sharing is enabled. These browser rules do not authenticate users.

Support's public apps/support/public/ticket-api-config.json contains {"apiBaseUrl":"http://localhost:3000"}. The value must be an HTTP origin without credentials, path, query or fragment. When changing the API port, change this configuration too. Source standalone serves the public configuration; built deployments use apps/support/dist/browser/ticket-api-config.json and require a rebuild or an explicit deployed-config update. No address is embedded in the table component.

## Startup and process ownership

From the repository root:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Open http://localhost:4200/support/tickets. Integrated start uses built remotes, the live Shell dev server and its own built Node API subprocess. npm.cmd run preview uses built Shell as well. Both commands reserve API port 3000 by default, Shell 4200, Analytics 4301, Administration 4302 and Support 4303.

Build and run the backend independently:

```powershell
npm.cmd run build --workspace @platypus/server
npm.cmd run start:server
```

Rebuild the server after editing TypeScript or its dataset, then restart it. Stop the independent terminal with Ctrl+C. Frontend builds remain independently available.

The integrated process waits for the API's explicit ready message before starting frontends. An occupied API port returns a clear startup error and starts no frontends, without killing the owner of the occupied port. An API exit after startup leaves frontend listeners available so the error and Retry flow remains usable. Ctrl+C stops only the integrated command's owned API/Shell children and static listeners.

An API restarted manually in another terminal belongs to that new terminal and must be stopped there. The integrated command does not adopt arbitrary replacement processes.

The reviewer identified an interruption race in the initial startup implementation: a static listener could finish acquisition after shutdown had already closed the recorded listeners. The final workspace-processes helper checks stopping before acquisition and closes a listener that arrives after cancellation, then prevents later startup. A controlled asynchronous acquisition test holds a real HTTP listener and verifies this cleanup and idempotence. No product debug switch was added.

## Verified evidence

| Command or action                                     | Actual result                                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm.cmd install --ignore-scripts                      | Installed the pinned development type dependency and workspace link. Existing 21 moderate audit findings remain; no forced fixes or install-script approval was applied.                                                                                            |
| npm.cmd run test:server                               | Independent server compilation and all 3 Node HTTP test groups passed: health/schema/25 rows/statuses/UTC/404/405; empty/internal-failure envelope; explicit origins/preflight.                                                                                     |
| npm.cmd run test:startup                              | All 3 Node lifecycle groups passed: cancellation during actual late listener acquisition; real occupied API port with original owner preserved; actual API exit leaves four frontend listeners alive and separately owned restart/shutdown cleans up its resources. |
| npm.cmd run build                                     | All 5 workspaces built: server, Analytics, Administration, Support and Shell.                                                                                                                                                                                       |
| npm.cmd run typecheck                                 | All 5 workspace typechecks passed.                                                                                                                                                                                                                                  |
| npm.cmd run lint                                      | Zero errors and warnings.                                                                                                                                                                                                                                           |
| npm.cmd run format:check                              | All matched authored files use shared formatting.                                                                                                                                                                                                                   |
| npm.cmd run test:integration                          | Both existing federation configuration/contract and static-hosting boundary tests passed.                                                                                                                                                                           |
| npm.cmd run test:browser                              | 25 Edge scenario groups passed against development Shell and all three built remotes.                                                                                                                                                                               |
| npm.cmd run test:browser -- --standalone              | 27 groups passed against built Shell, React/Vue standalone and the actual built Support standalone.                                                                                                                                                                 |
| npm.cmd run test:browser -- --support-standalone-only | The focused additional Support source-standalone check passed with its actual allowed origin and real API response.                                                                                                                                                 |
| Independent npm.cmd run start:server                  | Actual localhost:3000 health returned 200 ok; tickets returned 200 application/json, 25 items and total 25 without any frontend process running.                                                                                                                    |
| Ctrl+C cleanup                                        | Both temporary integrated stacks and standalone processes were stopped. Reserved ports were confirmed closed before independent API startup and again before the final integrated development stack.                                                                |
| git diff --check                                      | No whitespace errors. Lockfile normalized to the existing two-space/LF format without dependency graph changes.                                                                                                                                                     |

Browser checks used the installed Microsoft Edge executable in an isolated headless session. Healthy paths have zero unexplained page or console errors. Existing expected Angular/Vite shim-analysis warnings remain; controlled failure contexts deliberately exercise errors.

The real recovery check creates a test-owned Node server on an ephemeral free local port and overrides only the served public configuration response in its isolated browser context. It verifies an initial real API response, stops that actual child process, observes readable unavailable and Retry states, restarts a real child on the same port, and recovers through Retry without restarting the frontend. The context and separately owned API are closed afterward; no source/deployed config file is changed. A separate lifecycle test proves an owned integrated API exit leaves frontend listeners alive.

Other browser assertions verify the actual /api/tickets request and envelope, all 25 visible rows/seven columns, the former public fixture's 404, direct links/refresh/history, shared theme/mobile overflow, loading/empty/malformed/503/Retry states, an aborted outstanding API fetch, delayed Angular bootstrap and destruction of a real late-created ApplicationRef exactly once. Existing React/Vue and metadata-concurrency regressions remain passing.

The source and built Support standalone pages both requested the real Node endpoint and received Access-Control-Allow-Origin: http://localhost:5175. The integrated Shell received its corresponding allowed origin.

Screenshots remain ignored under .local/evidence/support-tickets.png and support-mobile.png. The coordinator inspected both and reported no visual blocker.

One final integrated development stack remains on 3000/4200/4301/4302/4303. Temporary 5173/5174/5175 listeners are closed. The coordinator receives the current owned session/process identifiers separately; they are not permanent configuration.

## Remaining limits

This is a public fictional local collection, without persistence or access enforcement. Query parameters, filtering, sorting and paging are not implemented. Health means this HTTP process is running; it does not test a database or identity service. No cloud, paid service, Git remote, CI hook or global configuration was introduced. Independent review 015 found no remaining confirmed blocker. Commit 5532511 saved the reviewed stage; the user subsequently confirmed the demonstrated server response.
