# Frontend Architecture — Task 002

Date: 2026-11-03.
Status: architecture selected for the first implementation experiment; not implemented or runtime-verified.
Inputs: PROJECT_PLAN.md, AGENTS.md, FIRST_STAGE.md, and docs/research/001-frontend-compatibility.md.
No packages were installed, files changed, builds executed, browser checks performed, or additional agents launched during the architecture research; this document was subsequently saved as the authorized task artifact.

## 1. Selected experiment

Use npm workspaces, an Angular CLI Shell, and separate Vite-built React Analytics and Vue Administration applications.
Load built remote applications as browser ECMAScript modules through runtime-configured URLs.
Each remote exports an explicit mount function and manages its own framework lifecycle.
This is a project architectural decision inferred from documented primitives, not an officially certified three-framework integration.
Keep the research report's versions as candidates; recheck and pin exact compatible versions before installation.
Do not install NgRx for this experiment; retain SignalStore as the agreed choice for later Angular feature state.

Federation remains an alternative if the runtime experiment exposes a material limitation.
The selected approach avoids federation adapters and shared framework dependency negotiation.
Its costs are separate framework downloads and project-owned loading, lifecycle, styling, and error handling.
Revisit that tradeoff after measuring a working baseline.

## 2. Directory and package boundaries

The following application structure is prospective; existing planning and research documents remain in place.

```text
aws/
  package.json                    # private @platypus/workspace; workspaces apps/* and packages/*
  package-lock.json               # the only dependency lockfile
  .gitignore
  README.md                       # verified commands and results after implementation
  scripts/serve-local.mjs          # local static serving only; Node built-ins
  apps/
    shell/                        # private @platypus/shell
      package.json
      angular.json                # Angular CLI workspace lives here
      tsconfig.json
      public/runtime-config.json
      src/app/remote-host/         # runtime validation, loading, lifecycle wrapper
      src/app/                     # navigation, routes, minimal pages
      dist/browser/               # generated Shell deployment artifact
    analytics/                    # private @platypus/analytics
      package.json
      vite.config.ts
      index.html
      src/standalone.tsx
      src/remote.tsx
      src/App.tsx
      dist/remote/                # generated remote-entry.js, style.css, optional chunks
    administration/               # private @platypus/administration
      package.json
      vite.config.ts
      index.html
      src/standalone.ts
      src/remote.ts
      src/App.vue
      dist/remote/                # generated remote-entry.js, style.css, optional chunks
  packages/mfe-contract/           # private @platypus/mfe-contract, initial version 0.1.0
    package.json
    src/index.ts                  # framework-independent, type-only exports
```

Framework dependencies belong to the application that uses them; do not rely on accidental root hoisting.
The contract package has no runtime framework dependencies and requires no separate runtime bundle.
Configure Shell output explicitly as apps/shell/dist/browser rather than assuming generator defaults.
Support, Knowledge & AI, backend, Lambda, database, and infrastructure folders are future-only; do not scaffold placeholders.
No shared component library, design system package, state store, or monorepo task framework is needed yet.

## 3. Ownership and installation

Assign one initial integrator ownership of the entire experimental scaffold.
That owner controls root scripts, workspace declarations, dependency versions, the single lockfile, contract, local server, and runtime configuration.
Application scripts run in their workspace directory; root scripts delegate using npm's workspace option.
Keep Angular configuration inside apps/shell; do not create a second root Angular workspace.
Use npm.cmd on this Windows environment; do not change PowerShell execution policy.
After the initial installation creates the lockfile, use root npm.cmd ci for reproducible installation.
Do not generate nested lockfiles or independent node_modules installation workflows.
A separate reviewer assesses the resulting changes and evidence after implementation.

## 4. Local addresses and runtime configuration

Reserve Shell port 4200, built Analytics port 4301, and built Administration port 4302.
Standalone Vite development uses Analytics 5173 and Administration 5174.
Fail clearly if a port is occupied; do not silently move to another port.
Use localhost consistently so allowed origins match.

Shell fetches /runtime-config.json from its own origin with cache: no-store.
Fetch at startup; fetch again on explicit Retry. A configuration failure leaves navigation and an error message available.

```json
{
  "schemaVersion": 1,
  "remotes": {
    "analytics": {
      "contractVersion": 1,
      "entryUrl": "http://localhost:4301/remote-entry.js",
      "cssUrls": ["http://localhost:4301/style.css"]
    },
    "administration": {
      "contractVersion": 1,
      "entryUrl": "http://localhost:4302/remote-entry.js",
      "cssUrls": ["http://localhost:4302/style.css"]
    }
  }
}
```

Validate the object, required remote names, supported versions, URL protocols, and CSS URL arrays before loading.
Configuration URLs are deployment-controlled application configuration; never take executable module URLs from user input.
Configuration contains no secrets. Each application artifact can be served and changed independently.
Shell must not import a remote application's source files or bundle its remote address as a build-time constant.

## 5. Mount contract and lifecycle

Place these framework-independent types in @platypus/mfe-contract:

```ts
export type AppRoute = '/analytics' | '/administration';
export interface MountContext {
  container: HTMLElement;
  route: AppRoute;
  locale: 'en';
  signal: AbortSignal;
  navigate: (route: AppRoute) => void;
  onError: (error: unknown) => void;
}
export interface MountedApplication {
  unmount(): void;
}
export interface RemoteModuleV1 {
  contractVersion: 1;
  mount(context: MountContext): MountedApplication;
}
```

Each entry exports contractVersion and mount; importing the entry must not mount anything.
Use type-only package imports so no contract-package browser import survives compilation.
Validate actual module exports and the returned cleanup handle at runtime; TypeScript types alone are insufficient.
Mount is synchronous; later asynchronous work must observe signal and clean up its resources.
React creates one root and calls root.unmount; Vue creates one application and calls app.unmount.
Unmount must be idempotent and remove application listeners, timers, subscriptions, and requests.
If mount throws after allocating resources, the remote must release those resources before rethrowing.
No remote may mount outside its supplied container or mutate Shell navigation.

Each route activation receives a new generation identifier and AbortController.
After configuration, stylesheet, or module awaits, confirm that the activation is still current.
On navigation or destruction, invalidate the generation, abort its signal, and unmount any active instance.
Native module imports cannot be cancelled; late imports may finish, but must never mount a stale route.
If cancellation happens during style loading, release that activation's style references even after late completion.
Use Shell-owned loading/error UI; surface later React/Vue render errors through onError and appropriate framework error handling.

## 6. Routing, history, and styles

Angular owns browser history, /analytics, /administration, and the navigation menu.
Redirect / to /analytics; show a Shell-owned not-found page for other paths.
Remote navigation requests pass through the supplied callback to Angular Router.
The initial remotes have no nested router and never directly call history.pushState.
Standalone pages provide their own small callback adapter; they do not assume Angular exists.
Direct links and refresh require Shell hosting to return index.html for application routes.
Remote servers must return a real 404 for missing modules and styles, never an HTML fallback.

Shell styles its own layout; remote CSS uses a dedicated .ps-analytics or .ps-administration root.
Use CSS Modules for React and scoped styles for Vue where appropriate.
Avoid remote body/html resets, global element selectors, and portals outside the supplied container.
Shell loads configured stylesheet links before mounting and releases them after unmount.
Track stylesheet references by absolute URL to prevent duplicates and handle late completion safely.
This is a scoped-CSS convention, not hard isolation or a security boundary.

## 7. Browser build and serving rules

Configure each remote's Vite library build for ES output, a stable remote-entry.js entry, and separate style.css.
Bundle its framework and dependencies; do not externalize React, React DOM, Vue, or JSX runtime imports.
Use a relative asset base; publish all generated chunks and assets together.
Explicitly replace process.env.NODE_ENV with the production string for production remote builds.
Inspect output for unresolved bare imports and Node-only globals; verify Vue build constants if the selected tooling reports them.
Standalone index.html loads only standalone.tsx/standalone.ts, which invokes the same mount implementation.
The integrated Shell loads built remote output, not Vite development entries or hot-update clients.

First attempt loading with native import(absoluteUrl) inside the Shell loader.
Inspect both Angular development output and production output to confirm the browser receives the runtime URL.
Angular's internal Vite server is encapsulated; a Vite plugin or ignore comment is not automatically a supported Angular solution.
If runtime import is transformed or rejected, report the evidence and resolve the loader design before expanding implementation.
Do not treat documentation compatibility as evidence that this experiment has passed.

The local Node server serves only explicitly mapped build directories, validates paths, sets JavaScript/CSS content types, and uses no-store.
Remote servers allow the Shell's localhost:4200 origin through Cross-Origin Resource Sharing headers.
Shell preview mode supplies route fallback while preserving real asset 404 responses.
Keep this server a local verification tool; it is not the future production backend.

## 8. Prospective commands and workflow

These commands describe scripts to create; none exists or has been executed as part of this architecture task.

```powershell
npm.cmd ci
npm.cmd run build --workspace @platypus/analytics
npm.cmd run build --workspace @platypus/administration
npm.cmd run build --workspace @platypus/shell
npm.cmd run serve:analytics
npm.cmd run serve:administration
npm.cmd run dev --workspace @platypus/shell
```

The three long-running commands use separate terminals; serve scripts delegate to scripts/serve-local.mjs.
For standalone work, run npm.cmd run dev --workspace @platypus/analytics or @platypus/administration.
For production-Shell verification, stop its development server and run npm.cmd run preview --workspace @platypus/shell.
Rebuild one remote independently, then reload the browser document; Shell rebuilding must not be necessary.
A document reload is intentional: browser module namespaces are cached by URL within the existing document.
Retry refetches configuration and attempts loading again; module evaluation failures may require Reload after correction.
Future production publishing should use immutable versioned remote directories and a separately updated, revalidated runtime configuration.
Publish new files before pointing configuration at them; keep previous releases available for open sessions and rollback.
No production publishing mechanism or cloud resource is implemented in this stage.

## 9. Acceptance evidence and handoff

- Record final Node/npm/package versions, commands, dependency installation outcome, and three independent build outcomes.
- Open standalone React and Vue pages and confirm their English headings.
- Open Shell and confirm the correct remote heading, menu, URL, and stylesheet for each route.
- Exercise repeated navigation, Back/Forward, direct URLs, refresh, and unknown paths using development and built Shell.
- Throttle loading and rapidly switch routes; confirm no stale page mounts, duplicate roots, leaked styles, or lifecycle errors.
- Stop a remote server; confirm Shell remains usable, shows failure, and recovers through Retry or clearly offered Reload.
- Supply a bad contract version and a missing stylesheet; confirm controlled failure and cleanup.
- Inspect console/network output for module MIME, cross-origin, missing asset, and bare-import failures.
- Change and rebuild Analytics only; reload Shell and prove updated content appears without rebuilding Shell or Administration.
- Record browser checks only if performed; investigate unexplained errors and have an independent reviewer verify the evidence.

## 10. Primary sources and remaining risks

- [npm workspaces and workspace commands](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)
- [Angular build system and encapsulated development server](https://angular.dev/tools/cli/build-system-migration)
- [Vite ES library output, CSS, relative base, and environment replacement](https://vite.dev/guide/build.html)
- [React root creation and cleanup](https://react.dev/reference/react-dom/client/createRoot)
- [Vue application mount and cleanup](https://vuejs.org/api/application.html)

Open execution risks: Angular runtime import handling, Vite output dependencies and constants, CSS conventions, asynchronous navigation races, hosting headers, and module caching.
Application implementation remains pending; this document is the bounded handoff for one initial integrator.
