# Frontend Compatibility Research - Task 001

Research date: November 3, 2026.
Researcher: frontend_compatibility_research.
Status: research complete; package installation, builds, and browser integration have not been performed.
Coordinator review: the Angular compatibility page and React lifecycle documentation were independently opened. Remaining package metadata and environment observations are researcher evidence, not an independent second execution.

## Scope and method

Read the project plan, agent rules, and first-stage proposal. Inspect public primary documentation, public npm package metadata, and installed tools. No dependencies were installed, application code written, Git repository created, cloud resources connected, or further agents launched. Where browser retrieval of registry data failed, the researcher used read-only PowerShell Invoke-RestMethod.

## Version evidence

These are candidate exact versions observed during research, not installed project dependencies. Mutable latest URLs must be rechecked before installation. Keep matching Angular framework packages aligned; CLI and framework patch numbers can differ.

| Component              | Observed stable candidate | Declared compatibility / primary source                                                                                                                      |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Angular runtime        | 22.2.4                    | Node ^22.22.3 or ^24.15.0 or >=26.0.0; compiler peer exactly 22.2.4. https://registry.npmjs.org/@angular/core/latest                                         |
| Angular compiler tools | 22.2.4                    | TypeScript >=6.0 <6.1; matching Angular compiler. https://registry.npmjs.org/@angular/compiler-cli/latest                                                    |
| Angular CLI and build  | 22.2.5                    | Build accepts Angular ^22.0.0 and TypeScript >=6.0 <6.1. https://registry.npmjs.org/@angular/cli/latest and https://registry.npmjs.org/@angular/build/latest |
| TypeScript             | 6.0.3                     | Highest stable 6.0.x found in registry; observed latest 7.0.2 is outside Angular's supported range. https://registry.npmjs.org/typescript                    |
| React and React DOM    | 19.3.1                    | React DOM requires React ^19.3.1. https://registry.npmjs.org/react/latest and https://registry.npmjs.org/react-dom/latest                                    |
| Vue                    | 3.5.44                    | Related Vue runtime/compiler packages align at the same patch. https://registry.npmjs.org/vue/latest                                                         |
| Vite                   | 8.3.5                     | Node ^20.19.0 or >=22.12.0. https://registry.npmjs.org/vite/latest                                                                                           |
| Vite React plugin      | 6.2.1                     | Vite ^8.0.0. https://registry.npmjs.org/@vitejs/plugin-react/latest                                                                                          |
| Vite Vue plugin        | 6.0.10                    | Supports Vite 5-8; stable Vue ^3.2.25 includes 3.5.44. https://registry.npmjs.org/@vitejs/plugin-vue/latest                                                  |
| NgRx Signals           | 22.0.1                    | Angular ^22.0.0; RxJS ^6.5.3 or ^7.4.0. https://registry.npmjs.org/@ngrx/signals/latest                                                                      |
| RxJS                   | 7.8.2                     | Fits Angular/NgRx declared ranges. https://registry.npmjs.org/rxjs/latest                                                                                    |
| Node.js                | Installed 24.21.0         | Satisfies the observed Angular, Vite, and plugin Node ranges. https://nodejs.org/en/about/previous-releases                                                  |

NgRx is a future feature-state dependency; the minimal integration experiment does not require installing it.

Official Angular compatibility: https://angular.dev/reference/versions
Official Angular releases: https://angular.dev/reference/releases
React versions: https://react.dev/versions
Vue release policy: https://vuejs.org/about/releases

The Angular compatibility table explicitly lists 22.0.x, while package metadata establishes the candidate 22.2.x constraints. A release schedule alone does not establish that a later release exists. No releases were inferred from the client date.

Declared dependency ranges do not establish successful installation, compilation, or three-framework runtime compatibility.

## Integration options

| Approach                                                           | Advantages                                                                                              | Costs and limits                                                                                                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime browser ES modules with an explicit mount/cleanup contract | Independent Angular CLI and Vite builds, runtime-configured addresses, separate framework dependencies. | Project owns module loading, cleanup, styles, errors, and contract compatibility; separate runtimes increase download size.                                                     |
| Web Components                                                     | Browser element boundary; Vue supports custom elements; Shadow DOM can isolate styles.                  | React requires a wrapper; registration and reconnection need care; routing and deployment still require design.                                                                 |
| Federation tooling                                                 | Existing remote discovery and dependency sharing.                                                       | More adapters and version constraints; cross-framework lifecycle contracts remain necessary; Angular's internal development server cannot simply accept arbitrary Vite plugins. |

Primary-source primitives:

- React rendering into an existing page region and root.unmount cleanup: https://react.dev/reference/react-dom/client/createRoot
- Vue createApp, mount, and unmount: https://vuejs.org/api/application.html
- Vite library output and CSS handling: https://vite.dev/guide/build.html#library-mode
- Angular application build system and encapsulated development server: https://angular.dev/tools/cli/build-system-migration
- Vue custom elements: https://vuejs.org/guide/extras/web-components.html
- Angular custom element schema: https://angular.dev/api/core/CUSTOM_ELEMENTS_SCHEMA
- Federation maintainer repository: https://github.com/angular-architects/module-federation-plugin
- Vite federation integration: https://module-federation.io/integrations/build-tool/vite.html

The federation comparison is preliminary and does not verify a complete Angular/React/Vue adapter matrix.

## Recommendation - proposal, not an adopted integration decision

Start with npm workspaces, Angular CLI for Shell, and Vite for React Analytics and Vue Administration. npm workspace documentation: https://docs.npmjs.com/cli/v11/using-npm/workspaces/

Use runtime-loaded browser modules with a small mounting contract:

- Angular owns /analytics, /administration, browser history, and route fallback.
- Each remote receives a container plus explicit inputs/callbacks and returns cleanup behavior.
- Remotes bundle their own frameworks; do not share framework internals or state stores.
- Remote build addresses come from runtime configuration.
- Preserve standalone pages for independent React/Vue development.
- Validate built remote output first; integrated development hot replacement is a separate concern.

This is an architectural inference from documented primitives. No official source certifies this exact composition, and it has not been executed.

## Smallest follow-up experiment

1. Build Shell, Analytics, and Administration separately; serve Shell and built remotes locally.
2. Lazy-load the matching remote for each Angular route and show loading/failure states.
3. Check repeated navigation, Back/Forward, rapid navigation while loading, direct URLs, and refresh.
4. Confirm cleanup, no duplicate roots, no stale mounts, and no unexplained console or network errors.
5. Verify module content types, cross-origin permissions, relative chunk/asset paths, and CSS loading.
6. Change and rebuild one remote; verify Shell consumes its compatible entry without a Shell rebuild.

Risks requiring execution: runtime import handling, unresolved package imports, React production environment replacement in library output, CSS leakage, asynchronous loading races, incompatible contracts, and deployment caching.

## Local environment observations

| Read-only check                            | Result                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| node --version                             | v24.21.0                                                                                |
| npm.cmd --version                          | 11.19.0                                                                                 |
| git --version                              | 2.56.0.windows.1                                                                        |
| Bare npm command                           | npm.ps1 is blocked by PowerShell execution policy; use npm.cmd without changing policy. |
| Get-Command for ng, nx, pnpm, yarn, docker | Not found through this lookup; not proof of absence elsewhere on disk.                  |

At initial researcher inspection the project contained its three planning documents. The coordinator subsequently added this task record and report.

## Pinning and remaining decisions

Pin direct dependencies to exact verified versions, align Angular runtime/compiler packages, keep TypeScript within Angular's supported range, and save the lockfile after installation. Record Node/npm versions; reproduce installations with npm.cmd ci once the lockfile exists. Recheck candidates before scaffolding.

The architect still needs to select the final integration approach, directory/package names, local ports, runtime configuration and contract formats, CSS boundaries, loading failure behavior, development workflow, and browser verification tooling.

## Coordination record

- The user approved the first compatibility research step.
- The coordinator assigned a bounded read-only task and preserved it in docs/agent-tasks/001-frontend-compatibility.md.
- One researcher returned this evidence and recommendation; no implementation agents were launched.
- The coordinator checked the report against the assignment and independently confirmed the key Angular TypeScript constraint and React cleanup primitives.
- Application scaffolding and runtime validation are the next distinct work item; research completion is not completion of FIRST_STAGE.md.
