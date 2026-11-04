# Implementation 012 - First Support Ticket List

Date: November 4, 2026.
Status: implemented and locally verified; independent review 013 complete with no remaining confirmed blocker. The user accepted the visible slice after confirming that Tickets opens and displays the table. Reviewed implementation commit: 9163b2d; the coordinator verified a clean worktree after committing. Review: docs/reviews/013-support-ticket-list-review.md.

## Result and limits

Added an independently built Angular Support microfrontend at /support/tickets and a Tickets navigation link. The existing Analytics root redirect and React/Vue sections remain. Support displays 25 fictional requests in a semantic table with number, subject, organization, the four agreed statuses, assignee or Unassigned, and UTC-labelled created/updated dates. A keyboard-focusable overflow region contains the wide table on mobile. No unfinished search, pagination, authorization, ticket actions or database functionality is presented.

These fixtures are a temporary public local learning source. PostgreSQL persistence via Node.js, role/organization checks on the server, the 100,000-ticket learning dataset and server-side page sizes of 25/50/100 remain agreed future work. This stage does not implement authentication or secure data access.

## Compatibility and tooling

- Preserved Angular runtime/compiler 22.2.4, CLI/build 22.2.5, TypeScript 6.0.3 and RxJS 7.8.2.
- Added maintained official @angular-architects/native-federation 22.2.4, whose build peer ~22.2.0 matches the installed Angular builder. Its @angular/localize peer is optional and is not installed because localization is not needed.
- Added @ngrx/signals 22.0.1; its peers accept Angular ^22.0.0 and the existing RxJS.
- The new adapter resolves official federation core 4.9.0 and the existing orchestrator 4.9.0; React/Vue retain their existing core 4.8.1 adapter chain. Exact transitive versions are recorded in package-lock.json.
- Support declares shared: {} and sharedMappings: []; generated metadata has shared: []. Angular is privately bundled, not negotiated across remotes. Shell uses its existing per-remote storage namespace and additive shim maps.
- Official Angular builder generates remoteEntry.json, a content-hashed mount expose, a separate Angular bootstrap chunk and all referenced assets. No custom metadata writer or community Angular/Vite compilation hack was added.
- Tailwind 4.3.4 compiles Support with su: utilities and the existing shared theme; Support omits Preflight. Its separate standalone baseline never loads through Shell.
- ESLint Angular TypeScript/template/accessibility coverage now includes Support. No new test framework or runtime UI library was needed.

Primary sources checked before implementation:

- https://native-federation.com/docs/v4/angular-adapter/getting-started/
- https://native-federation.com/docs/v4/angular-adapter/builder/
- https://angular.dev/api/platform-browser/createApplication
- https://angular.dev/api/core/ApplicationRef
- https://ngrx.io/guide/signals/signal-store
- https://registry.npmjs.org/@angular-architects%2Fnative-federation/22.2.4
- https://registry.npmjs.org/@ngrx%2Fsignals/22.0.1

Installed package schemas, public types and builder implementation were also inspected. Documentation/registry compatibility was followed by actual builds and browser checks.

## State, data and lifecycle

The Support component provides TicketStore locally. SignalStore owns items, loading/ready/error state and a readable error; Retry starts a new request. A small injected TicketData interface has one asynchronous load(signal) method. FixtureTicketData fetches and validates the deployment-relative fixtures/tickets.json. Requests use no-store and AbortSignal. Store destruction aborts its active request; stale or aborted results cannot patch current state. Replacing the adapter later preserves the list component/store boundary.

The mount contract remains synchronous. Support immediately returns an idempotent cleanup handle, loads its Angular bootstrap asynchronously, checks cancellation before and after createApplication(), and destroys an ApplicationRef that arrives after cancellation. Successful startup uses public ApplicationRef.bootstrap into the supplied host. Unmount destroys Angular (including its component/store), removes the host and releases its abort listener; Shell separately releases CSS. Bootstrap failures use the existing onError contract.

The independent reviewer found a real early built-standalone issue: the Angular federation builder rewrote main.js to module-shim without installing a shim. Fixed using its public esmsInitOptions: { shimMode: false }, which emits a native module for the independent document. Support has no shared bare imports and does not require a standalone import map. Shell's separate shim-mode federation loading remains unchanged. The builder's skipHtmlTransform flag only bypasses the dev-server transform in the installed implementation, so it was removed rather than relied on for production.

## Commands and ports

From the repository root:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Shell: http://localhost:4200. Integrated remote ports: Analytics 4301, Administration 4302, Support 4303. Open http://localhost:4200/support/tickets. npm start uses built remotes and the live Shell dev server; rebuild a changed remote then reload the document. Ctrl+C stops the owned servers; occupied ports fail without choosing substitutes.

Support commands: npm.cmd run build --workspace @platypus/support; npm.cmd run dev --workspace @platypus/support (source standalone 5175); npm.cmd run preview --workspace @platypus/support (built standalone 5175, stop dev first); npm.cmd run serve:support (integrated artifacts 4303). npm.cmd run preview starts the integrated built Shell plus all three remotes.

## Verification evidence

All of the following checks passed:

| Check                                           | Actual result                                                                                                                                                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm.cmd run lint                                | Zero errors or warnings across all applications and scripts.                                                                                                                                                   |
| npm.cmd run format:check                        | All matched authored files use shared Prettier formatting.                                                                                                                                                     |
| npm.cmd run typecheck                           | All four application typechecks passed.                                                                                                                                                                        |
| npm.cmd run build                               | All four independent application builds passed; final Support was rebuilt after its standalone fixes.                                                                                                          |
| npm.cmd run test:integration                    | Both runtime contract and static hosting/MIME/CORS/path-boundary tests passed with required Support configuration.                                                                                             |
| npm.cmd run test:browser                        | 24 scenario groups passed against the development Shell with all three built remotes.                                                                                                                          |
| npm.cmd run test:browser -- --standalone        | 26 scenario groups passed against built Shell, React/Vue source standalone pages, and the actual built Support standalone page. A later run also passed all 26 with Support source standalone on 5175 instead. |
| npm.cmd run test:independent-build              | Analytics-only modification/build appeared in Shell; Shell, Administration and Support build hashes stayed unchanged; original source was restored and rebuilt.                                                |
| npm.cmd run test:independent-build -- --support | Support-only modification/build appeared in Shell; Shell, Analytics and Administration build hashes stayed unchanged; original source was restored and rebuilt.                                                |
| Occupied standalone port                        | Support dev startup refused occupied 5175 and did not choose a substitute.                                                                                                                                     |
| Stop/start cleanup                              | Temporary integrated preview and all standalone servers were stopped; ports 5173/5174/5175 were confirmed closed. One integrated development stack remains on 4200/4301/4302/4303.                             |
| git diff --check and content scan               | No whitespace issues; Support source and scripts contain English content.                                                                                                                                      |

The browser runner used installed Microsoft Edge in an isolated headless context. Healthy paths have zero unexplained console/page errors. Controlled failure contexts deliberately produce expected failures.

An initial full standalone run correctly caught a missing favicon request; Support now uses the existing data:, standalone icon convention. The healthy error assertion was retained. One run was interrupted during switching the owned development stack to built preview; verification restarted in a fresh browser context and the complete built matrix passed. Failed/interrupted attempts were not counted as successful evidence.

Screenshots stay excluded in .local/evidence/support-tickets.png (desktop) and .local/evidence/support-mobile.png. The coordinator visually inspected both and reported no visual blocker. Other existing browser evidence remains in that same excluded directory.

The final retained npm start session serves http://localhost:4200/support/tickets. Runtime PID/port details are handed to the coordinator rather than treated as stable startup configuration.

The expanded existing browser runner preserves prior federation concurrency/style/failure assertions and adds a small Support helper. It verifies actual served fixture data, state transitions by intercepting that boundary, actual generated federation metadata/bootstraps, and an isolated test wrapper that holds a real created Angular ApplicationRef until after route cancellation, then confirms destroy exactly once. Product code contains no test/debug toggles.

Dependency installation reported 21 moderate audit findings in the existing ESLint/minimatch chain, no high or critical findings; no forced dependency downgrade or blanket install-script approval was applied. This is development-tool dependency debt, not evidence of runtime authorization.
