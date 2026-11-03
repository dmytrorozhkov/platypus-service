# Frontend Foundation — Task 003

Date: November 3, 2026.
Status: implementation and integrator verification complete. Independent review and user acceptance are tracked by the coordinator.
Project: D:/Projects/Pet-projects/aws.
Inputs: AGENTS.md, PROJECT_PLAN.md, FIRST_STAGE.md, research task 001 and architecture task 002.

## Delivered scope

One integrator implemented the selected npm workspace experiment. The planning and historical documents were preserved.

- Angular Shell with Platypus Service navigation, root redirect, Analytics and Administration routes, not-found page and responsive layout.
- Independent minimal React Analytics and Vue Administration pages with English headings and scoped modest styling. No invented business metrics or working product features.
- A type-only mount/cleanup contract, with runtime validation of configuration, module exports and cleanup handles.
- Runtime browser ES module loading using native `import(/* @vite-ignore */ url)`. The URL survives Angular production bundling and actual development serving. Both modes loaded real React/Vue production modules in a browser.
- Abort-driven cleanup, stale activation checks, reference-counted styles, loading/error/Retry/Reload states, and framework error forwarding.
- Local Node static servers with fixed ports, mapped directories, canonical path checks, MIME types, Shell-origin CORS and appropriate history/asset fallback.
- Independent standalone Vite pages, one root dependency lockfile, reproducible install, startup wrappers, verification scripts and README.
- No backend, authentication, NgRx, paid service, cloud resource, Git repository, or additional coding subagent was created by the integrator.

## Verified versions and primary metadata

Rechecked immediately before installation through public npm registry HTTPS metadata, then pinned exact versions.

| Dependency                                                           | Installed direct version |
| -------------------------------------------------------------------- | ------------------------ |
| Angular runtime/common/compiler/platform-browser/router/compiler-cli | 22.2.4                   |
| Angular CLI/build                                                    | 22.2.5                   |
| TypeScript                                                           | 6.0.3                    |
| React / React DOM                                                    | 19.3.1                   |
| Vue                                                                  | 3.5.44                   |
| Vite                                                                 | 8.3.5                    |
| Vite React / Vue plugins                                             | 6.2.1 / 6.0.10           |
| RxJS / tslib                                                         | 7.8.2 / 2.9.1            |
| Vue type checker                                                     | 3.3.14                   |
| Playwright test package                                              | 1.64.1                   |

Environment: Node.js 24.21.0, npm 11.19.0 on Windows. Primary metadata: https://registry.npmjs.org/@angular/compiler-cli/latest, https://registry.npmjs.org/@angular/build/latest, https://registry.npmjs.org/typescript/6.0.3, https://registry.npmjs.org/react/latest, https://registry.npmjs.org/react-dom/latest, https://registry.npmjs.org/vue/latest, https://registry.npmjs.org/vite/latest, https://registry.npmjs.org/@vitejs/plugin-react/latest, https://registry.npmjs.org/@vitejs/plugin-vue/latest, https://registry.npmjs.org/@playwright/test/latest.

The observed latest TypeScript 7.0.2 is deliberately excluded: Angular requires >=6.0 <6.1. This was confirmed from declared compiler/build peers, not inferred from the date.

## Commands and outcomes

All installation, builds and runtime checks ran in the actual D: project, not a staging copy.

| Check                                                                                              | Outcome                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd install --no-fund --no-audit`                                                             | Succeeded, 291 packages; created one root v3 lockfile.                                                                                                           |
| `npm.cmd ci --no-fund --no-audit`                                                                  | Succeeded, 291 packages in 39 seconds, clean reproducibility check.                                                                                              |
| `npm.cmd run build`                                                                                | All three independent application builds passed.                                                                                                                 |
| Final `npm.cmd run build --workspace @platypus/shell` after cleanup changes                        | Passed; initial production JS + CSS 228.18 kB.                                                                                                                   |
| `npm.cmd run typecheck`                                                                            | React TypeScript, Vue typechecker and Shell TypeScript passed. Angular build separately performed template compilation.                                          |
| `npm.cmd run test:integration`                                                                     | 2 meaningful tests passed: invalid configuration/module/handle rejection and HTTP MIME/CORS/fallback/path/method behavior.                                       |
| Built Shell `npm.cmd run preview`, then `npm.cmd run test:browser`                                 | 13 scenario groups passed using installed Edge headlessly.                                                                                                       |
| Development `npm.cmd start`, standalone dev pages, then `npm.cmd run test:browser -- --standalone` | 14 scenario groups passed, including standalone React and Vue headings.                                                                                          |
| `npm.cmd run test:independent-build`                                                               | Passed: changed React content appeared, other application artifacts unchanged, original source restored and React rebuilt.                                       |
| Shell dev command while port 4200 was occupied                                                     | Exited 1 with explicit occupied-port message; no alternate port.                                                                                                 |
| Ctrl+C on integrated developer command                                                             | Shell process tree and remote listeners stopped; a Node bind probe successfully acquired all ports 4200/4301/4302/5173/5174 after temporary standalone shutdown. |
| Fresh final `npm.cmd start`                                                                        | Started successfully; left running for coordinator/user demonstration.                                                                                           |

Independent remote build output: Analytics remote-entry.js 300.06 kB and style.css 1.59 kB; Administration remote-entry.js 75.55 kB and style.css 1.72 kB. Sizes are uncompressed build output, not performance targets.

## Browser acceptance evidence

New isolated headless Edge sessions used C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe; existing user browser profiles were untouched.

Both development and built Shell passed:

1. Root redirect to Analytics and exactly one remote stylesheet.
2. Repeated Analytics/Administration navigation with no old remote root or duplicate stylesheet.
3. Browser Back/Forward navigation.
4. Direct Administration URL and document reload.
5. Shell not-found route and no remote stylesheet.
6. An explicitly observed remote module request held during route change, then released without stale mounting.
7. An explicitly observed stylesheet request held during route change, then released without a stale style reference.
8. No uncaught page or console errors in healthy integration flows.
9. Invalid runtime configuration, controlled failure, correction and Retry recovery.
10. Missing stylesheet, controlled failure, released links and Retry recovery.
11. Actual module exporting contractVersion 2, rejection, corrected module and Reload recovery.
12. Simulated unavailable module request, usable Shell navigation and recovery in a new document.
13. 390 px mobile viewport without horizontal overflow.
14. Additionally in the development run: standalone React/Vue English headings on ports 5173/5174.

Failure scenarios intentionally produced expected console/network errors in separate contexts. They were not presented as healthy traffic. The unavailable-server condition was simulated by intercepting the actual module request with connection-refused; the test did not stop an unrelated process.

Screenshots generated under ignored .local/evidence/: analytics.png, administration.png, mobile.png. This is browser-automated evidence; no claim of user acceptance is made.

The independent build check changed only one Analytics sentence and invoked only its workspace build. A new browser document displayed the changed sentence through the existing Shell. SHA256 build-directory digests before and after were unchanged:

- Shell: 736de421fb5d0949388b8e4cc10fefd6291bef8320c83c1b53c3004f085bb5f6.
- Administration: 1b433f1707544fcdaf21666b43ce9ede95e24a8ee8376805ba40cd45d2e04dd5.
  The original sentence was restored and Analytics rebuilt successfully.

## Startup and independent artifacts

After `npm.cmd ci` and `npm.cmd run build`, run `npm.cmd start`, then open http://localhost:4200. Ctrl+C stops the integrated command. `npm.cmd run preview` runs built Shell instead; do not run both at once.

Runtime configuration: apps/shell/public/runtime-config.json; its served version comes from Angular public assets. Remotes have separate dist/remote directories. Angular owns routes/history; remotes export contractVersion and mount, bundle their own frameworks, and import the contract as types only. No remote source is part of the Shell source dependency graph.

## Limits and observed environment messages

- The local static server is a verification tool, not production infrastructure.
- Framework bundling is intentionally separate; download size and future caching need later measurement.
- Scoped CSS is a convention and not a security boundary.
- Native module caching means some failures and rebuilt content require a new document. Shell offers Reload.
- npm 11 warned about four unapproved install scripts: @parcel/watcher, esbuild, lmdb and msgpackr-extract. Installation/builds worked with packaged binaries; no blanket approval was enabled. Different environments may require targeted dependency investigation.
- Angular non-interactive development disables its cache and reports unused prebundling; the actual development integration still passed.
- Browser workflow coverage is a bounded acceptance suite, not exhaustive production testing.
- Independent review, coordinator demonstration and user acceptance remain separate from the integrator's checks.
