# Independent Support Ticket List Review — Task 013

Date: November 4, 2026.
Implementation: task 012, branch feature/support-ticket-list.
Project: D:/Projects/Pet-projects/aws.
Verdict: the confirmed built-standalone defect was corrected. No remaining confirmed blocking defect was found within the approved first Support slice. Ready for coordinator demonstration and the intentional Git checkpoint; user acceptance remains separate.

## Scope and independence

Reviewed AGENTS.md, tasks 012/013, project-plan section 5.22, actual new Support source and shared integration changes, installed package manifests/schema, generated federation/HTML/CSS artifacts, verification scripts, README, and the completed implementation report.

The reviewer did not change application/configuration files, install dependencies, run competing builds or services, execute the project browser suite, stage files, or commit. Direct checks were read-only source/artifact inspection, fixture inventory, effective ESLint configuration through its API, manifest/lockfile comparison, and inspection of the generated desktop screenshot. Runtime command results below are attributed to the integrator.

## Independently inspected

- Support uses maintained @angular-architects/native-federation 22.2.4. Its Angular build peer matches the pinned build 22.2.5; @angular/localize is optional and absent in the final manifest. @ngrx/signals 22.0.1 accepts Angular 22 and the existing RxJS version.
- The official builder/schema and generated remoteEntry.json were inspected. Metadata identifies support, version v4, ./mount, and shared: []. Generated mount and separate bootstrap chunks retain private Angular dependencies. Existing React/Vue build integration is preserved.
- Shell's per-name official orchestrator instances, isolated storage namespaces and additive shim maps remain unchanged, so adding Support does not restore the previously corrected shared-repository rollback design. No cross-remote Angular sharing is introduced.
- Tickets navigation and /support/tickets are wired through Angular routes, runtime configuration and the type-only route contract. The root still redirects to Analytics; existing Analytics and Administration routes remain.
- The mount function returns a synchronous, idempotent cleanup handle. Cancellation is checked after importing the bootstrap and after asynchronous createApplication. An ApplicationRef arriving after cancellation is destroyed before rendering. Normal cleanup destroys the application, removes the host and abort listener, while Shell retains stylesheet ownership.
- TicketStore is a component-scoped NgRx SignalStore with items, loading/ready/error state and retryable loading. Its injected asynchronous data boundary accepts an AbortSignal. Destruction cancels the active request; stale or aborted results cannot update current state.
- FixtureTicketData fetches deployment-relative public JSON with no-store and validates it before storing. Fixture inventory contains 25 unique ticket numbers, all four agreed statuses and seven unassigned examples.
- The semantic table has all seven agreed columns, UTC-labelled dates, clear status/assignee presentation, a caption and a keyboard-focusable horizontal overflow region. Loading, empty, error and Retry views are present without product debug switches or unfinished feature controls.
- Support imports shared theme tokens and compiles su: utilities independently. Generated remote CSS has no Preflight or document body reset; standalone baseline CSS is separate. The desktop screenshot shows a readable table and the established Shell layout.
- Effective ESLint API checks confirm Support TypeScript has Angular inline-template processing and external Support HTML uses the Angular template parser and accessibility rules.
- Root scripts build four independent applications and start the three built remotes plus Shell. Local serving maps Support artifacts to 4303; source and built standalone commands share reserved 5175 with occupied-port checking. Current direct dependency specifications match the single root lockfile.

## Confirmed finding and resolution

### P2 — built Support standalone could not execute: resolved

The initial generated apps/support/dist/browser/index.html used type="module-shim" for main.js but included no shim loader. A native browser would ignore that script, leaving the advertised built standalone preview blank even if the integrated remote or source development page worked.

The integrator corrected apps/support/angular.json through the official esmsInitOptions: { shimMode: false } setting. The reviewer inspected rebuilt HTML and confirmed main.js now uses native type="module". Support has no shared bare imports requiring a standalone import map; Shell's independent shim-mode federation loading is preserved. The integrator subsequently reports successful browser runs against both built and source Support standalone pages.

No other confirmed source or configuration defect remains from this review.

## Integrator execution evidence

The completed implementation report and handoff record:

- Four application builds and typechecks, zero-warning lint, formatting, both hosting/contract tests, and Git whitespace checks passed.
- Development Shell with all three built remotes passed 24 browser scenario groups; the final development run also passed all 24.
- Built Shell with React/Vue standalone pages and built Support standalone passed 26 groups. A further built-Shell run with source Support standalone also passed all 26.
- Real federation metadata/module requests, all 25 rendered rows and seven columns, direct links, refresh, repeated three-section navigation, history, shared styles, mobile table scrolling and absence of document overflow were checked.
- Actual fixture interception verified loading, HTTP 503, empty and malformed data, Retry/refetch and recovery. A request-failure observation confirms outstanding fixture fetch cancellation on navigation.
- A held generated Angular bootstrap request cannot mount a stale route. A separate isolated test wraps the real public factory, waits for an actual ApplicationRef to exist, holds its return until navigation cancels the activation, then verifies destruction exactly once. This instrumentation is confined to the browser test response, not product code.
- Existing Native Federation failure/isolation regression assertions remain in the suite.
- Analytics-only and Support-only modification/build checks both passed, preserving all other application artifact hashes; both original source files were restored and rebuilt.
- Support standalone startup rejected occupied port 5175. Temporary standalone/preview servers were stopped, and one integrated development stack was retained for demonstration.

The reviewer inspected these assertions and resulting artifacts but did not personally rerun those commands or browser flows. The report distinguishes caught/interrupted attempts from completed successful runs; an initial favicon failure was corrected without suppressing the healthy-error assertion.

## Limits and handoff

This is the approved read-only list using public fictional fixtures. It does not implement authentication, organization/role enforcement, persistence, server queries, ticket actions, final heavy-table behavior or AI. The agreed Node.js/PostgreSQL data path, 100,000-ticket dataset and server-side page sizes remain future requirements.

Coordinator demonstration, final staged-diff review, the intentional local commit and user acceptance remain separate. No cloud service, publication, paid resource or broader architecture change is required by this review.

Primary documentation checked alongside installed sources: [Angular federation builder](https://native-federation.com/docs/v4/angular-adapter/builder/) and [Angular createApplication](https://angular.dev/api/platform-browser/createApplication). Actual generated artifacts and reported browser execution provide the integration evidence beyond documentation compatibility.
