# Platypus Service

A customer support platform for a fictional company, built as a practical course in Angular, Node.js, AWS and AI engineering. The project combines independently built microfrontends with a backend, and develops the product in small reviewed stages.

Coding agents research, implement and review bounded tasks. The learner defines requirements, follows the technical decisions and accepts demonstrated results. The course includes agent orchestration (coordinating tasks and handoffs), reusable skills, and retrieval-augmented generation (RAG: answering with relevant knowledge-base material).

## Current application

The locally verified application has an Angular Shell, Angular Support, React Analytics and Vue Administration connected through **Native Federation**. Support displays **25 fictional tickets fetched from the independent Node.js server**. The examples are temporary server-owned JSON data, with a repository boundary prepared for later database integration.

| Area           | Available now                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Shell          | Navigation, direct routes, remote loading, error recovery and cleanup                           |
| Support        | Read-only seven-column ticket table, loading/empty/error states, Retry and request cancellation |
| Analytics      | Independently built React demonstration page; business charts are planned                       |
| Administration | Independently built Vue demonstration page; role administration is planned                      |
| Backend        | Node.js HTTP API: `GET /api/health` and `GET /api/tickets`                                      |
| Shared tooling | Tailwind theme, ESLint, Prettier, typechecking, server/lifecycle and browser verification       |

The current slice runs locally. Sign-in, server-enforced permissions, database persistence, business charts, conversations and AI features are later stages. Application deployment to AWS has not been performed.

## Planned product

- Customer, support specialist, support lead and administrator roles, with organization and access checks on the server.
- Eight pages: sign-in, tickets, new ticket, ticket details, AI Chat, knowledge base, Analytics and Administration.
- A 100,000-ticket dataset with server-side search, filtering, sorting and pagination, followed by richer table interactions.
- Analytics charts using Apache ECharts, customer-support conversations, and a separate private AI chat for staff and administrators.
- Knowledge-grounded AI replies with source references, human-approved response drafts, and checks of AI answer quality.
- Amazon Cognito for sign-in, PostgreSQL for core support data, DynamoDB for private AI conversation history, and Lambda jobs for article preparation, large-table export and AI evaluation.

These are agreed targets, not a list of implemented features. Detailed requirements, decisions and acceptance evidence live in the [project plan](PROJECT_PLAN.md).

## Current AWS preparation

As of November 4, 2026, the learner has created the **Platypus Service** AWS project on the **Free plan** in **Europe (Stockholm), `eu-north-1`**. AWS CLI **2.39.3**, browser-based sign-in and the local `platypus-dev` profile were verified in the learner's terminal. The user installed **25 AWS skills**, `uv` **0.13.7** and Codex CLI **0.166.0**. The AWS wizard could not finish MCP configuration on Windows; a manual `codex.cmd mcp add` registered `aws-mcp` with profile `platypus-dev` and default operation Region `eu-north-1`. After a client restart, the coordinator successfully called **STS GetCallerIdentity through MCP**, matching the project identity previously checked in the terminal. This verifies authenticated agent access, not every permission needed for deployment.

The reviewed first-deployment proposal uses private S3 storage, CloudFront delivery and a Lambda Event Function serving the existing 25 examples. PostgreSQL follows as a separately estimated stage. Deployment preparation is implemented and locally verified: three CloudFormation templates, a Lambda adapter, immutable frontend/server packaging, offline operation plans and a packaged-layout preview. Independent review 024 records the findings and remaining cloud checks. No application resources have been created. Free-plan credits and allowances have conditions and expiry; deployment or spending requires a separately agreed step.

- [First AWS deployment architecture](docs/architecture/019-aws-first-deployment-architecture.md)
- [Cost assumptions, estimates and teardown](docs/research/020-aws-cost-plan.md)
- [Independent planning review](docs/reviews/021-aws-deployment-planning-review.md)

AWS access credentials stay outside the repository. AWS account access is not needed to run the current local application.

To inspect the already built application in its deployment layout, prepare a new local release and keep its preview terminal running:

```powershell
npm.cmd run aws:prepare -- --release preview-a --origin http://localhost:4400
npm.cmd run aws:preview -- --manifest .local/aws/releases/preview-a/manifest.json
```

Open **http://localhost:4400/support/tickets**. Use a new release identifier if that directory already exists. This serves packaged Angular/React/Vue assets and the ZIP-extracted Lambda handler locally; it is not an AWS deployment. Source localhost settings remain unchanged. See [deployment preparation commands and limits](infrastructure/README.md).

`npm.cmd run aws:validate` checks templates and Guard policies; `npm.cmd run test:aws` checks real packaging, browser loading, offline gates and update/rollback plans. The installed account currently has five concurrent Lambda executions available. The planned reservation of two is unavailable under that quota; the target stays unresolved until a separate, explicit concurrency decision. A concurrency quota is not a monthly spending limit.

## Start locally

On Windows, open PowerShell at the repository root (the learning workspace is `D:\Projects\Pet-projects\aws`). Use `npm.cmd` without changing execution policy.

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

Keep that terminal running. **Ctrl+C stops the owned Node API, Shell and all three remote servers.** The command fails if a reserved port is occupied; it does not choose another port. If a workspace session is already running, open its URL instead of starting a second copy.

Shell source changes rebuild automatically. Integrated Angular Support/React/Vue pages use their **built** artifacts: rebuild the changed remote, then reload the browser document.

## Applications and commands

| Application        | Workspace                  | Integrated address                     | Independent build                                        |
| ------------------ | -------------------------- | -------------------------------------- | -------------------------------------------------------- |
| Angular Shell      | `@platypus/shell`          | http://localhost:4200                  | `npm.cmd run build --workspace @platypus/shell`          |
| React Analytics    | `@platypus/analytics`      | http://localhost:4301/remoteEntry.json | `npm.cmd run build --workspace @platypus/analytics`      |
| Vue Administration | `@platypus/administration` | http://localhost:4302/remoteEntry.json | `npm.cmd run build --workspace @platypus/administration` |
| Angular Support    | `@platypus/support`        | http://localhost:4303/remoteEntry.json | `npm.cmd run build --workspace @platypus/support`        |

The Node API is another independent workspace: `@platypus/server`, http://localhost:3000, build with `npm.cmd run build --workspace @platypus/server`, start with `npm.cmd run start:server`.

For independent page development, keep the API running and use separate terminals:

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

For manual separate processes, use `npm.cmd run serve:analytics`, `npm.cmd run serve:administration`, `npm.cmd run serve:support`, `npm.cmd run dev --workspace @platypus/shell`, and `npm.cmd run start:server` in five terminals.

## Boundaries

- `apps/shell`: Angular menu, browser routes, loading/error/retry UI, runtime configuration and remote lifecycle.
- `apps/support`: Angular ticket list, component-scoped NgRx SignalStore, asynchronous server data adapter and private Angular runtime.
- `apps/server`: independent Node.js HTTP API and server-owned temporary fixture repository.
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

The local static hosting tool accepts only its mapped build directories, returns JavaScript/CSS content types, disables caching, permits the Shell localhost origin, and keeps real asset 404 responses. Built Shell hosting supports direct route refreshes. This server is for local verification only.

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
npm.cmd run test:server
npm.cmd run test:startup
```

With the integrated workspace running:

```powershell
npm.cmd run test:browser
npm.cmd run test:independent-build
```

The browser runner uses an installed Edge or Chrome executable in a new isolated headless session; it does not use an existing user profile or download a browser. For another Chromium location set `$env:PLATYPUS_BROWSER` to its executable path.

To include all three standalone pages, start their three development commands and run `npm.cmd run test:browser -- --standalone`.

The independent-build check temporarily changes one Analytics sentence, rebuilds only Analytics, verifies that Shell displays it while the Shell, Administration, and Support build hashes remain unchanged, then restores and rebuilds the original Analytics source. Run `npm.cmd run test:independent-build -- --support` for the equivalent Support-only proof, preserving Shell/Analytics/Administration hashes. Run either check only when no one else is editing or building that application.

Initial foundation checks (report 003): reproducible `npm.cmd ci`, three builds and typechecks, hosting/contract tests, browser tests against development and built Shell, standalone pages, repeated navigation, history, direct links/refresh, loading cancellation, controlled failure recovery, mobile layout, remote-only rebuild, strict occupied-port behavior, and Ctrl+C port release. Details and limits: [implementation report](docs/implementation/003-frontend-foundation.md).

npm 11 reported four dependency install scripts as not approved. The clean install and builds succeeded with their packaged binaries; no blanket script approval was added. Angular development reports that prebundling is unused because its cache is disabled in non-interactive mode. These messages were observed separately from application errors.

## Local ticket server and Support data

Support now loads `GET /api/tickets` from the independent Node.js workspace. The response is `{ "items": [...], "total": 25 }`; `GET /api/health` returns `{ "status": "ok" }`. The same 25 fictional requests live only in `apps/server/src/fixtures/tickets.json`, copied into the server build. No frontend fixture fallback remains. The seven-column table, four statuses, unassigned examples, UTC dates and mobile scrolling are unchanged.

The component-scoped SignalStore retains loading, empty, error and Retry states. Its `ApiTicketData` boundary reads deployment-relative `ticket-api-config.json`, fetches and validates the response, and passes one cancellation signal to configuration and ticket requests. Leaving Tickets cancels pending work; an unavailable server produces the existing error. Restart the server and select Retry to recover without restarting the frontend.

Build and start only the server, without rebuilding any frontend:

```powershell
npm.cmd run build --workspace @platypus/server
npm.cmd run start:server
```

The default address is **http://localhost:3000**, bound to localhost. `PORT` changes the server port; `ALLOWED_ORIGINS` optionally supplies comma-separated HTTP origins. Defaults are explicitly `http://localhost:4200` (Shell) and `http://localhost:5175` (Support source/built standalone). Browser cross-origin rules are not authorization; no sign-in or role/organization checks exist yet.

Support's public configuration is `apps/support/public/ticket-api-config.json`:

```json
{ "apiBaseUrl": "http://localhost:3000" }
```

The value must be an HTTP origin, with no path, credentials, query or fragment. When changing the server port, update this configuration too. For built Support, rebuild it or replace the deployed `apps/support/dist/browser/ticket-api-config.json`; source standalone serves the public file. No server address belongs in the table component and no secret belongs in public configuration.

Integrated start/preview owns its API child and all frontend listeners. An occupied API port fails before frontend startup, without killing the port's current owner. If the API exits after startup, the frontend stays available. A server restarted in a **separate terminal** is owned by that terminal and must be stopped there; the integrated command cannot adopt that new process. Ctrl+C in the integrated terminal stops its own children/listeners.

The repository interface (`apps/server/src/ticket-repository.ts`) is the later PostgreSQL replacement boundary. This stage is read-only, unfiltered and unpaged; `total` equals the returned collection length. The agreed 100,000-record dataset, server-side access/querying and page sizes of 25/50/100 remain later work.

Checks include real server responses, controlled empty/internal failures, explicit origins, unavailable/restarted real API recovery in Edge, cancellation, malformed responses, all three Support hosting modes, and existing federation/theme regressions. See [local server implementation and evidence](docs/implementation/014-local-ticket-server.md).

## Git and GitHub workflow

The repository is hosted at [dmytrorozhkov/platypus-service](https://github.com/dmytrorozhkov/platypus-service). The local remote `origin` points to that repository. Feature and planning work use separate branches; check the active one with `git branch --show-current`. A commit saves an intentional checkpoint locally; `git push` sends commits to GitHub. Synchronization is manual.

As of November 4, 2026, the published default branch is `planning/aws-first-deployment`. It contains the current application and reviewed plans; local `main` retains the earlier foundation checkpoint. Branch names do not indicate completed cloud deployment.

```powershell
git status
git diff
git add <specific-path>
git diff --cached
git commit -m "Describe the completed change"
git push -u origin HEAD
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
- [Support ticket-list implementation](docs/implementation/012-support-ticket-list.md)
- [Support ticket-list review](docs/reviews/013-support-ticket-list-review.md)
- [Local Node.js server implementation](docs/implementation/014-local-ticket-server.md)
- [Local Node.js server review](docs/reviews/015-local-ticket-server-review.md)
- [PostgreSQL data-design proposal](docs/architecture/016-postgresql-data-design.md)
- [Local PostgreSQL environment proposal](docs/research/017-local-postgresql-environment.md)
- [PostgreSQL planning review](docs/reviews/018-postgresql-planning-review.md)
- [First AWS deployment proposal](docs/architecture/019-aws-first-deployment-architecture.md)
- [AWS cost plan](docs/research/020-aws-cost-plan.md)
- [AWS planning review](docs/reviews/021-aws-deployment-planning-review.md)
- [Lambda adapter](docs/implementation/022-lambda-event-adapter.md)
- [Deployment preparation](docs/implementation/023-aws-deployment-preparation.md)
- [Deployment preparation review](docs/reviews/024-aws-deployment-preparation-review.md)
