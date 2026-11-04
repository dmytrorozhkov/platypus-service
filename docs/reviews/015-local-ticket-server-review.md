# Independent Local Ticket Server Review — Task 015

Date: November 4, 2026.
Implementation: approved task 014, branch feature/local-ticket-server.
Project: D:/Projects/Pet-projects/aws.
Verdict: the identified startup-cancellation defect was corrected. No remaining confirmed blocking defect was found within the approved local server integration. Ready for coordinator demonstration and the intentional Git checkpoint; user acceptance remains separate.

## Scope and independence

Read AGENTS.md, tasks 014/015, the implementation report, README, actual server/client/configuration/process source, focused tests and browser assertions. Inspected generated fixture ownership and dependency changes.

The reviewer made no application/configuration/Git changes, installed no packages, and started no competing builds or servers. Direct execution was limited to read-only fixture comparison, generated-file checks, effective ESLint configuration and manifest/lockfile inspection. The project HTTP, process and browser executions below were performed by the integrator rather than repeated by the reviewer.

## Independently inspected

- apps/server is an independent TypeScript/Node workspace using built-in HTTP and no runtime framework dependency. NodeNext compilation emits its own server and imported fixture JSON without depending on Angular source or a frontend build.
- The server-owned source fixture exactly matches the accepted frontend dataset from Git: 25 unchanged records and unique numbers. The old public Support fixture is absent from both source and rebuilt frontend output; the server build contains its own fixture.
- TicketRepository.list() is a small replaceable data boundary. FixtureTicketRepository returns an independently cloned items/total collection. The server factory supports injected repositories and logging for controlled empty/failure tests without a product debug endpoint.
- The HTTP implementation returns health, ticket and consistent error JSON; unknown paths return 404, unsupported methods 405, and repository failures a sanitized 500. Internal failure details go to local logging, not the response. The public error codes are documented.
- Server binding is localhost with validated PORT configuration. Browser origins are explicitly localhost:4200 and localhost:5175 by default, optionally replaced through ALLOWED_ORIGINS. These restrictions are correctly documented as browser-origin controls rather than user authorization.
- ApiTicketData fetches deployment-relative ticket-api-config.json, validates its HTTP origin, requests /api/tickets and validates the existing ticket schema and items/total envelope. Configuration and data use the same AbortSignal and no-store. No fixture fallback or arbitrary server HTML rendering was introduced.
- The component/store and asynchronous Angular mount lifecycle remain intact. Feature state is still local NgRx SignalStore; request cancellation, stale-result protection, late ApplicationRef destruction, stylesheet ownership and isolated Native Federation namespaces remain unchanged.
- Process ownership waits for the API ready message before frontend startup. A later API exit leaves frontend listeners alive for error/Retry recovery. Shutdown targets only owned children/listeners. A separately restarted API belongs to its new terminal, and README/report now say so explicitly.
- Effective ESLint configuration covers server TypeScript with Node globals without applying browser globals or Angular template processing.
- All current manifest dependency specifications match the root lockfile. Existing locked package versions are unchanged; additions are the server workspace/link and its private Node 24 type/undici-type packages.
- Verification scripts retain real Native Federation, styling, navigation and Angular lifecycle assertions. The new real-recovery test starts and stops its own Node child on an ephemeral port and changes only the served public configuration response in an isolated browser context.

## Confirmed finding and correction

### P2 — shutdown during asynchronous listener acquisition could leave a late listener running: resolved

The intermediate integrated starter closed only listeners already recorded when stop() ran. If Ctrl+C arrived while startApplication() was pending, the promise could later return a new listener, push it after shutdown and continue starting other applications. Repeated stop() calls would return through the idempotence guard, leaving those late listeners unclosed.

The final scripts/workspace-processes.mjs checks stopping before acquisition, closes a listener returned after cancellation and prevents subsequent startup. The source correction was independently inspected. The integrator added a focused regression that holds an actual HTTP listener acquisition, calls shutdown, releases the acquisition, and verifies closure, no later startup and idempotent cleanup. Its reported passing result supports the correction; the reviewer did not rerun that process test.

No additional confirmed blocker remains.

## Integrator execution evidence

The completed task 014 report and final handoff record:

- Three Node HTTP test groups passed: real health/schema/25-record responses and JSON 404/405, injected empty/sanitized 500, and explicit allowed/disallowed origins with preflight.
- Three startup/lifecycle groups passed: late listener cancellation, real occupied API port with its original owner preserved, and actual API exit leaving frontend listeners alive with separately owned restart/cleanup.
- Five workspace builds/typechecks, zero-warning lint, formatting, both existing hosting/contract tests and Git whitespace checks passed.
- Real Edge browser verification passed 25 development-Shell groups and 27 built-Shell groups including built Support standalone and existing React/Vue standalones. A focused additional check verified Support source standalone against the actual Node API and allowed origin.
- Healthy browser flows request the Node endpoint and render the same rows/columns; the former public fixture returns 404. Loading, empty/malformed/503 responses, Retry/refetch, cancelled API requests and prior late Angular application/Native Federation regressions remain checked.
- The actual recovery scenario stops a test-owned API child, observes unavailable/error and Retry behavior, starts another real child on the same port, then recovers through Retry without restarting frontends. It uses an isolated served-configuration override, not source edits or a fake response standing in for the server.
- The backend was independently started and returned real health/ticket JSON without frontend processes.
- Final TCP connection probes confirmed the five integrated ports open and temporary standalone ports closed; after owned Ctrl+C all eight checked ports were closed. A fresh integrated development stack was then retained. The final shutdown claim relies on those actual probes, not an empty platform process-inventory result.

These command/runtime outcomes are attributed to the integrator. The reviewer inspected their implementation, assertions and final report but did not personally execute the full suites or shutdown probes.

## Limits and handoff

This remains a fictional public local collection without persistence, sign-in or role/organization enforcement. The first unpaged contract requires total to equal items.length. PostgreSQL, server-side access/querying, the 100,000-ticket dataset and page sizes of 25/50/100 remain later requirements.

No cloud resource, paid connection, remote publication or unrelated dependency remediation was added. The coordinator owns final planning records, staged-diff verification, the local commit and demonstration. This technical review does not claim user acceptance.
