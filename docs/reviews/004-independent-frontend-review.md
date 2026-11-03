# Independent Frontend Review — Task 004

Date: November 3, 2026.
Project: D:/Projects/Pet-projects/aws.
Reviewer: frontend_review, separate from the initial integrator.
Verdict: no confirmed blocking defects found within the approved minimal frontend stage. Ready for coordinator demonstration and user acceptance.

## Scope and independence

Reviewed AGENTS.md, FIRST_STAGE.md, the relevant project plan, architecture task 002, implementation task 003, review assignment 004, actual source and generated artifacts, README.md, and docs/implementation/003-frontend-foundation.md.

The reviewer made no application or planning changes, installed no packages, started no competing services, and did not rerun the integrator's builds or browser suite. The coordinator authorized this review artifact separately. Findings below distinguish direct inspection from results reported by the integrator.

## Independently inspected

- Workspace manifests and the single root version-3 lockfile: exact direct dependency specifications match all five workspace lock entries. No nested workspace lockfiles were found.
- Angular routes and Shell boundaries: Angular owns root redirection, Analytics, Administration, unknown routes, navigation, and remote loading states. Remote applications are not imported from their source into Shell.
- Runtime configuration and module validation in apps/shell/src/app/remote-host/runtime.ts: required remote names, supported versions, absolute HTTP/HTTPS URLs without credentials, stylesheet arrays, module exports, and cleanup handles are checked.
- Activation lifecycle in apps/shell/src/app/remote-host/remote-host.ts: current-activation checks follow asynchronous work; disposal aborts, unmounts, releases stylesheet leases, and clears the owned container. CSS leases are registered before waiting, so route cancellation releases pending styles. Late module imports do not mount an obsolete activation.
- React and Vue mounting adapters: independent roots, supplied containers, abort handling, idempotent cleanup, and framework error forwarding. Remote stylesheet output uses React CSS Modules or Vue scoped styles.
- Generated production output: Shell retains a native runtime import expression, both remotes have their own remote-entry.js and style.css, and the inspected bundles contain no unresolved process.env or require calls. Remote output does not require a runtime contract package.
- Local hosting: explicit build roots, decoded path validation, canonical path containment, real asset 404 responses, Shell route fallback, JavaScript/CSS MIME types, no-store, and the configured Shell CORS origin.
- Final startup wrappers: Shell port probing and CI mode prevent a replacement-port prompt; integrated startup owns both remote servers and its Shell child. The Windows shutdown helper targets the child process tree created by this startup.
- README commands match actual package scripts and artifact locations. Integrated remotes use built artifacts; standalone Vite development is documented separately. Browser module cache and reload behavior are disclosed.
- Final browser-check source uses real Shell and production remote artifacts for healthy integration. Interception is limited to deliberately delayed or failing requests. Module and stylesheet cancellation checks wait until the relevant request has actually been observed.
- The independent-build verification script changes only Analytics, checks the new text through Shell, compares the other applications' artifacts, and restores and rebuilds the original Analytics source. The restored source sentence is present.
- Recomputed current build-directory hashes using the verification script's algorithm match the implementation report: Shell 736de421fb5d0949388b8e4cc10fefd6291bef8320c83c1b53c3004f085bb5f6; Administration 1b433f1707544fcdaf21666b43ce9ede95e24a8ee8376805ba40cd45d2e04dd5. This confirms the current artifacts match the reported hashes; the before/after experiment itself was performed by the integrator.

## Review observations and resolutions

No confirmed application defect requiring a code correction was found.

An early browser test waited only for the loading heading before navigating away. That did not establish that module loading had begun. The reviewer reported this evidence gap to the integrator. The final test explicitly waits for the intercepted module request, holds it across navigation, and then releases it. A separate request-latched stylesheet cancellation scenario was added. Actual module contract rejection, unavailable-module recovery, standalone checks, and the independent remote rebuild check are also present in the final evidence.

The reviewer raised the requirement that occupied Shell port 4200 must fail without selecting another port. The final Shell wrapper explicitly probes that port and starts Angular non-interactively. The integrator reports that an occupied-port invocation exited with code 1 and an explicit message.

## Execution evidence reported by the integrator

The integrator's final report records these actual results from the D: project:

- Clean npm ci succeeded; all three builds and workspace typechecks passed.
- Hosting and contract tests passed, 2 of 2.
- Isolated headless Edge checks passed: 13 scenario groups against built Shell and 14 against development Shell, including standalone React/Vue pages.
- Healthy browser flows had no uncaught page or console errors. Coverage includes repeated navigation, history, direct links, refresh, unknown routes, loading cancellation, controlled failure recovery, and a mobile viewport.
- An Analytics-only change and rebuild appeared in Shell without changing Shell or Administration artifact hashes; original Analytics content was restored and rebuilt.
- Occupied-port behavior and Ctrl+C process/port cleanup were checked. A fresh integrated development session was left running for demonstration.

The reviewer inspected the scripts, resulting artifacts, and report, but did not independently execute these reported installation/build/browser/shutdown checks. Unexpected errors in healthy flows are distinguished from intentional failure-scenario errors in the implementation report.

## Remaining limits

- Coordinator demonstration and explicit user acceptance remain outstanding at review completion.
- Unavailable remote behavior was tested with an intercepted connection-refused module request; the integrator did not stop an unrelated server to simulate it.
- Verification covers this local integration stage. Production hosting, security roles, application features, cloud deployment, and performance targets remain outside its approved scope.
- Separate framework bundles, conventional CSS scoping, and document-level native module caching remain deliberate experimental tradeoffs, disclosed in README and the architecture.
- npm install-script notices and Angular non-interactive development cache/prebundling messages are recorded in the implementation report. The clean installation and builds succeeded in the verified environment; other environments were not tested.
