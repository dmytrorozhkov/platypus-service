# Platypus Service

A local frontend foundation: an Angular shell opens independent Angular Support, React Analytics and Vue Administration applications through Native Federation.

This is the first integration experiment. It includes the first read-only Support list with 25 fictional local tickets. It contains no sign-in, persisted business data, charts, backend, cloud resources, or paid services.

## Start locally

Use PowerShell in `D:\Projects\Pet-projects\aws`. Use `npm.cmd` without changing execution policy.

Verified environment: Node.js **24.21.0**, npm **11.19.0**. This project now requires Node `^24.16.0 || >=26.0.0`, the intersection of Angular and the Native Federation orchestrator requirements.

First setup, or after dependency changes:

```powershell
npm.cmd ci
npm.cmd run build
```

Then start the integrated workspace:

```powershell
npm.cmd start
```

Open **http://localhost:4200**. The root opens Analytics; use the menu to open Tickets or Administration. Tickets also opens directly at http://localhost:4200/support/tickets.

Keep that terminal running. **Ctrl+C stops Shell and all three remote servers.** The command fails if a reserved port is occupied; it does not choose another port. If a workspace session is already running, open its URL instead of starting a second copy.

Shell source changes rebuild automatically. Integrated Angular Support/React/Vue pages use their **built** artifacts: rebuild the changed remote, then reload the browser document.

## Applications and commands

| Application        | Workspace                  | Integrated address                     | Independent build                                        |
| ------------------ | -------------------------- | -------------------------------------- | -------------------------------------------------------- |
| Angular Shell      | `@platypus/shell`          | http://localhost:4200                  | `npm.cmd run build --workspace @platypus/shell`          |
| React Analytics    | `@platypus/analytics`      | http://localhost:4301/remoteEntry.json | `npm.cmd run build --workspace @platypus/analytics`      |
| Vue Administration | `@platypus/administration` | http://localhost:4302/remoteEntry.json | `npm.cmd run build --workspace @platypus/administration` |
| Angular Support    | `@platypus/support`        | http://localhost:4303/remoteEntry.json | `npm.cmd run build --workspace @platypus/support`        |

For independent page development, use separate terminals:

```powershell
npm.cmd run dev --workspace @platypus/analytics
npm.cmd run dev --workspace @platypus/administration
npm.cmd run dev --workspace @platypus/support
```

Standalone pages use http://localhost:5173 (Analytics), http://localhost:5174 (Administration), and http://localhost:5175 (Support). Support uses the Angular source dev server; its command checks that the port is free before starting. To verify the built Support standalone page instead, stop its dev server and run `npm.cmd run preview --workspace @platypus/support` on the same port. Stop each with Ctrl+C.

To check the built Shell instead of its development server, stop `npm.cmd start`, then run:

```powershell
npm.cmd run preview
```

For manual separate processes, use `npm.cmd run serve:analytics`, `npm.cmd run serve:administration`, `npm.cmd run serve:support`, and `npm.cmd run dev --workspace @platypus/shell` in four terminals.

## Boundaries

- `apps/shell`: Angular menu, browser routes, loading/error/retry UI, runtime configuration and remote lifecycle.
- `apps/support`: Angular ticket list, component-scoped NgRx SignalStore, asynchronous fixture data adapter and private Angular runtime.
- `apps/analytics`: React page, independent ES module and scoped CSS.
- `apps/administration`: Vue page, independent ES module and scoped CSS.
- `packages/mfe-contract`: framework-independent types, with no runtime bundle.
- `packages/theme`: shared CSS theme tokens and standalone-only document baseline.
- `scripts`: local hosting, startup and verification tools. These are not a production backend.

All dependencies are pinned and installed through one root lockfile. The exact Angular runtime version is **22.2.4**, CLI/build **22.2.5**, TypeScript **6.0.3**, React/React DOM **19.3.1**, Vue **3.5.44**, and Vite **8.3.5**. Do not upgrade TypeScript to 7: the chosen Angular compiler requires `>=6.0 <6.1`.

## Runtime configuration

Shell fetches `/runtime-config.json` with caching disabled on route activation and Retry. Its source is `apps/shell/public/runtime-config.json`; the built copy is `apps/shell/dist/browser/runtime-config.json`.

The configuration supplies `remoteEntryUrl`, `exposedModule` (`./mount`), and `cssUrls` for each remote. URLs remain deployment-controlled; no secrets belong in this file. A deployment can update the served configuration independently; changing the source public file for production requires republishing or rebuilding that copy.

React and Vue build through **native-federation-vite 0.2.0**, a community Vite adapter backed by official **@softarc/native-federation 4.8.1**. Each `federation.config.mjs` exposes its existing mount adapter. The core generates `remoteEntry.json` and its content-hashed exposed module, plus `importmap.json`. The separate Tailwind `style.css` remains controlled by Shell's stylesheet lifecycle. Deploy those runtime artifacts together; exclude the generated `.nf-cache` build cache.

Angular Support uses the maintained **@angular-architects/native-federation 22.2.4** builder with Angular/build versions matching Shell and **@ngrx/signals 22.0.1**. It exposes `./mount` with private dependencies and generated federation artifacts in `apps/support/dist/browser`. Deploy that directory together; Shell loads only `styles.css`, while `standalone.css` is linked only by the standalone document. The adapter emits native `type="module"` for that document (`esmsInitOptions.shimMode: false`); Shell retains its own shim loader.

Shell uses official **@softarc/native-federation-orchestrator 4.9.0** and **es-module-shims 2.8.4**. It initializes and loads the selected remote lazily; the old custom direct-import loader has been removed. Ordinary Angular CLI builds are retained because Shell does not expose or share Angular modules.

Each remote deliberately declares `shared: {}` and bundles its own framework. Each gets an isolated official orchestrator storage namespace and additive shim import maps, preventing one failed metadata transaction from rolling back another remote's successful initialization. There is **no cross-remote shared-dependency version negotiation** in this setup; review that design before introducing shared Angular libraries or other shared runtimes.

Browser modules and registered remote metadata are cached within the document. After rebuilding a remote, **reload the page** to fetch the updated `remoteEntry.json`. Metadata failures are retryable; Retry refetches application configuration and retries failed metadata registration. Replacing an already registered remote URL or correcting a cached module/contract failure requires the offered Reload page action. In-memory federation state is recreated by a document reload; persistent caching is not enabled.

The adapter is an early community release, pinned to its declared Vite 8 and Native Federation 4.8.x compatibility ranges. It generates real federation artifacts through the core; it is not a first-party Vite adapter. Details, sources, verified behavior, and the resolved metadata rollback race: [Native Federation migration report](docs/implementation/008-native-federation.md).

Remotes mount only into the supplied container, return idempotent cleanup handles and receive an abort signal. Shell releases styles and ignores stale asynchronous results when a route changes. CSS isolation is a convention, not a security boundary.

The local Node server accepts only its mapped build directories, returns JavaScript/CSS content types, disables caching, permits the Shell localhost origin, and keeps real asset 404 responses. Built Shell hosting supports direct route refreshes. This server is for local verification only.

## Shared styling with Tailwind

All four applications use **Tailwind CSS 4.3.4**. Shared colors, typography, radius, shadow, and breakpoint values live in `packages/theme/tokens.css`, exported by the CSS-only `@platypus/theme` workspace. Each application compiles its own styles; there is no shared framework runtime or theme server.

Shell and Support use the Tailwind PostCSS plugin with `sh:` and `su:` utility classes respectively. React and Vue use the Tailwind Vite plugin with `an:` and `ad:` classes. Each stylesheet scans only its own application source. Existing layout and cards now use these utilities; small custom selectors remain for icons, active navigation, and Shell fallback views.

Only Shell includes **Preflight**, Tailwind's document-wide baseline reset. Remote styles omit it and retain their independent `style.css` artifacts. Standalone pages import `packages/theme/standalone.css` separately; that document baseline is absent from integrated remote bundles. Prefixes are a styling convention rather than complete isolation.

Edit shared tokens to change the design values, then rebuild each affected app using the existing build commands. A remote-only rebuild still requires a browser document reload, without rebuilding Shell. The existing Prettier formatter remains in use; automatic Tailwind class sorting is not installed.

The browser check also verifies compiled utilities, reset boundaries, actual shared-theme card styles, and Shell layout across remote navigation. See the [Tailwind implementation report](docs/implementation/006-tailwind-shared-theme.md).

## Code quality and formatting

ESLint checks code for likely mistakes; Prettier handles consistent formatting. These checks are shared by all applications and run from the repository root:

```powershell
npm.cmd run lint
npm.cmd run lint:fix
npm.cmd run format:check
npm.cmd run format
```

`lint` fails on errors or warnings; `lint:fix` applies only fixes supported by the rules, so some findings still need a code change. `format:check` is read-only; `format` rewrites authored source, configuration, styles, templates, and documentation to the shared format.

ESLint uses `eslint.config.mjs`: recommended JavaScript/TypeScript rules, Angular component and template rules (including inline templates and accessibility), React Hooks rules, and Vue essential template/script rules. React TSX syntax and common code checks come from TypeScript rules; the classic `eslint-plugin-react` recommended preset is not enabled. Type checking remains a separate `npm.cmd run typecheck` step. No type-aware ESLint rules are enabled yet.

Prettier uses `.prettierrc.json` and `.prettierignore`; generated builds, dependencies, local evidence, caches, test output, and the npm lockfile are excluded. `eslint-config-prettier` disables conflicting formatting rules rather than running Prettier inside ESLint. `.editorconfig` records shared UTF-8, two-space indentation, and LF line endings.

For optional VS Code integration, install the **ESLint** extension (`dbaeumer.vscode-eslint`) and **Prettier - Code formatter** extension (`esbenp.prettier-vscode`). Open the repository root so both use the local configuration and installed versions. For Vue diagnostics, ensure the ESLint extension validates the `vue` language. Set Prettier as your workspace formatter if you want formatting on save. Command-line checks work without either extension; no global editor settings are changed by this project.

Implementation details and verification: [code quality report](docs/implementation/005-code-quality-tooling.md).

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run test:integration
```

With the integrated workspace running:

```powershell
npm.cmd run test:browser
npm.cmd run test:independent-build
```

The browser runner uses an installed Edge or Chrome executable in a new isolated headless session; it does not use an existing user profile or download a browser. For another Chromium location set `$env:PLATYPUS_BROWSER` to its executable path.

To include all three standalone pages, start their three development commands and run `npm.cmd run test:browser -- --standalone`.

The independent-build check temporarily changes one Analytics sentence, rebuilds only Analytics, verifies that Shell displays it while the Shell, Administration, and Support build hashes remain unchanged, then restores and rebuilds the original Analytics source. Run `npm.cmd run test:independent-build -- --support` for the equivalent Support-only proof, preserving Shell/Analytics/Administration hashes. Run either check only when no one else is editing or building that application.

Checks completed: reproducible `npm.cmd ci`, three builds and typechecks, hosting/contract tests, browser tests against development and built Shell, standalone pages, repeated navigation, history, direct links/refresh, loading cancellation, controlled failure recovery, mobile layout, remote-only rebuild, strict occupied-port behavior, and Ctrl+C port release. Details and limits: [implementation report](docs/implementation/003-frontend-foundation.md).

npm 11 reported four dependency install scripts as not approved. The clean install and builds succeeded with their packaged binaries; no blanket script approval was added. Angular development reports that prebundling is unused because its cache is disabled in non-interactive mode. These messages were observed separately from application errors.

## First Support slice

Support currently reads `fixtures/tickets.json` from its own deployment origin. The fixture has 25 unique fictional requests, all four agreed statuses, seven columns, and unassigned examples. Dates are labelled and rendered in UTC. The semantic table scrolls inside its own region on narrow screens. There are no fake search, paging, sign-in or action controls.

The component-scoped SignalStore owns loading, data, error and Retry; an injected asynchronous `TicketData` adapter fetches and validates the fixture with cancellation. A later Node.js-to-PostgreSQL adapter will replace this temporary source. The agreed 100,000-ticket dataset, server access checks/querying, and page sizes of 25/50/100 remain later requirements. No browser database connection is intended.

Verification includes healthy rendering, actual fixture loading/error/empty/malformed results and recovery, delayed Angular startup, late-created application cleanup, repeated navigation and mobile layout. Fixtures are public local learning data and provide no access enforcement. See [Support implementation and evidence](docs/implementation/012-support-ticket-list.md).

## Local Git workflow

This project now has a local Git repository on the `main` branch. A commit is a saved checkpoint of intentionally staged files. No remote hosting or automatic synchronization is configured.

```powershell
git status
git diff
git add <specific-path>
git diff --cached
git commit -m "Describe the completed change"
```

Review the staged changes before committing. Dependencies, build output, caches, local evidence, test output, coverage, and `.env` secrets stay outside history; the root `package-lock.json` stays tracked. An `.env.example` must contain placeholders only. `.gitattributes` keeps text line endings consistent with the project's LF formatting.

See the [local Git baseline report](docs/implementation/010-git-baseline.md).

## Project documents

- [Project plan](PROJECT_PLAN.md)
- [Agent rules](AGENTS.md)
- [Stage criteria](FIRST_STAGE.md)
- [Compatibility research](docs/research/001-frontend-compatibility.md)
- [Architecture](docs/architecture/002-frontend-architecture.md)
- [Initial frontend review](docs/reviews/004-independent-frontend-review.md)
- [Quality and theme review](docs/reviews/007-quality-and-theme-review.md)
- [Native Federation review](docs/reviews/009-native-federation-review.md)
- [Local Git baseline](docs/implementation/010-git-baseline.md)
- [Git baseline review](docs/reviews/011-git-baseline-review.md)
