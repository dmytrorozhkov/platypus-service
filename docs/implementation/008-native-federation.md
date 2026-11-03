# Native Federation Migration — Task 008

Started: 2026-11-03. Completed: 2026-11-04 (Europe/Warsaw).
Status: implemented and locally verified; user acceptance remains with the coordinator.
Scope: replace the existing custom remote import with real Native Federation while preserving the current Angular, React, Vue, Tailwind, routing, and mount lifecycle foundation.

## Result and selected tooling

Shell now uses the official Native Federation orchestrator to discover and load the React and Vue applications. Both remotes build through a Vite adapter that calls the official Native Federation core. The core emits actual `remoteEntry.json` metadata and generated exposed modules; the previous direct-import loader has been removed.

| Package                                   | Pinned version | Reason                                                                                |
| ----------------------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| `@softarc/native-federation`              | 4.8.1          | Matches the Vite adapter's declared `~4.8.1` peer range.                              |
| `native-federation-vite`                  | 0.2.0          | Community adapter declaring Vite `^8.0.0` and using the official core build pipeline. |
| `@softarc/native-federation-orchestrator` | 4.9.0          | Maintained official browser runtime; its optional core peer accepts `^4.8.0`.         |
| `es-module-shims`                         | 2.8.4          | Officially supported import-map implementation for dynamic remote initialization.     |

Angular runtime remains 22.2.4, CLI/build 22.2.5, React/React DOM 19.3.1, Vue 3.5.44, Vite 8.3.5, and TypeScript 6.0.3. No framework downgrade, Webpack migration, forced peer installation, or blanket dependency sharing was used.

Node.js 24.21.0 was already installed. Orchestrator 4.9.0 requires Node `>=24.16.0`; the root package and README now declare the supported intersection with Angular: `^24.16.0 || >=26.0.0`.

The official adapters page still links the old `@gioboa/vite-module-federation`; registry inspection found that package deprecated and tied to a Native Federation 1 beta peer. It was not installed. The selected replacement is an early community release, not a first-party Vite adapter. Its published source and installed artifact were inspected, and its exact version and peer-compatible core were pinned.

## Preserved backup

Before migration, 67 authored source/configuration/document files, manifests, and the root lockfile were copied to:

`.local/backups/008-native-federation-20261103-234745`

That directory is excluded by the existing `.gitignore`. `backup-manifest.json` records SHA-256 hashes. Installed dependencies, generated builds, caches, and previous local evidence were excluded. No Git repository or remote was created.

## Build and runtime protocol

- Each remote has `federation.config.mjs` exposing `./mount` from its existing `src/remote.tsx` or `src/remote.ts`.
- Each declares `shared: {}` and `sharedMappings: []`. React and Vue keep their own bundled framework runtimes; the shared theme remains a build-time CSS dependency.
- Existing workspace build commands now call `native-federation-vite build --config federation.config.mjs --out dist/remote` after their typechecks.
- The adapter reuses the existing framework and Tailwind Vite plugins. A small build-only plugin preserves the production constants, relative asset base, and separate stable `style.css` output.
- The official core writes `remoteEntry.json`, `importmap.json`, and content-hashed exposed-module files such as `mount-<hash>.js`. These are generated artifacts, not application-authored federation metadata.
- `apps/shell/public/runtime-config.json` supplies the absolute `remoteEntryUrl`, `exposedModule: "./mount"`, and `cssUrls` for each remote.
- Shell's `federation.ts` uses official `initFederation`, `initRemoteEntry`, and the resulting `loadRemoteModule`. It uses the official shim preset; there is no custom plain-import fallback.
- Shell remains an ordinary Angular CLI application because it does not expose or share Angular modules. Adding the Angular-specific federation builder is unnecessary for this host-only integration.
- The local server already serves JSON with the correct content type, Shell-origin cross-origin headers, and `no-store`. Hosting checks now explicitly verify Native Federation JSON responses as well as modules and CSS.
- Deploy runtime metadata, exposed modules, import-map output, and styles together. Exclude the generated `.nf-cache` build cache from deployment artifacts. No production deployment was performed here.

## Lifecycle, retry, and runtime isolation

Angular retains browser routes and history. Both applications retain the existing versioned mount/unmount contract, supplied container, abort signal, stale-activation checks, and cleanup behavior. The stylesheet registry still acquires and releases the active remote's CSS separately.

Initialization is lazy: a route loads only its selected remote. Failed metadata registration can be retried; failed promise tracking is removed. Configuration is refetched on Retry. A changed URL for an already registered remote, or a corrected module already cached in the document, requires the existing Reload page action. A document reload recreates in-memory federation state and fetches current metadata; persistent federation storage is not enabled.

Independent review found a concurrency defect in an intermediate design using one official orchestrator instance: a failed metadata transaction could roll back another remote's successful concurrent initialization. The reviewer reproduced this in 8 of 45 controlled schedules against installed orchestrator 4.9.0.

The fix uses public configuration only: each remote has its own official orchestrator instance and `storageNamespace` (`__PLATYPUS_ANALYTICS__` or `__PLATYPUS_ADMINISTRATION__`). The official shim import-map setter is wrapped with `override: false`, so an instance's initialization does not clear another instance's maps. No vendor code or private cache API was patched.

The reviewer independently reran the controlled schedules with separate namespaces and observed 0 of 45 failures. The project browser regression also holds Administration's first metadata request while opening previously uninitialized Analytics, then fails the delayed Administration request, recovers Administration, and revisits Analytics. The healthy page and its stylesheet remain usable throughout.

This isolation deliberately provides **no cross-remote shared-dependency version negotiation**. It matches the current explicit `shared: {}` design. Revisit the orchestration strategy before adding shared Angular runtimes or other cross-remote shared libraries.

## Styling and quality tools

The shared `@platypus/theme` package, `sh:`/`an:`/`ad:` prefixes, per-application Tailwind compilation, Shell-only Preflight, standalone document baseline, and existing layout remain unchanged. ESLint and Prettier continue to use the existing shared configuration. No new UI features or paid/cloud services were added.

## Verification performed

- Installed exact dependencies and confirmed a valid deduplicated dependency tree with `npm.cmd ls`; no invalid peer flags were used. The root lockfile and Node engine metadata were updated.
- All three production builds and application typechecks passed.
- ESLint and final Prettier checks passed.
- Both hosting/contract tests passed, including the new metadata content-type/cross-origin/cache assertions and exposed-module configuration validation.
- Real headless Microsoft Edge checks passed **18 assertion groups** against development Shell and again against built Shell, including both independently served React/Vue development pages.
- Browser network evidence confirms successful requests for both real `remoteEntry.json` files and their generated exposed modules. The browser exposes official orchestrator version **4.9.0** and live shim import maps; no legacy `remote-entry.js` request occurs.
- Existing repeated navigation, Back/Forward, direct links, refresh, unknown routes, delayed modules/styles, contract mismatch, stylesheet failure, retry/reload, unavailable remote, and mobile overflow checks passed.
- Added real metadata-fetch failure/retry and overlapping delayed-metadata-failure checks. These include cleanup and healthy-route recovery rather than only heading checks.
- Existing compiled-utility, Preflight boundary, card/font/color/layout, and standalone styling assertions passed without weakening their expected values.
- Independent Analytics rebuild changed the existing sentence, rebuilt only that remote through the Native Federation adapter, and displayed it inside Shell. Shell and Administration build hashes remained unchanged. The original Analytics source was restored and rebuilt afterward.

Current commands remain:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Open `http://localhost:4200`. The integrated command owns ports 4200, 4301, and 4302. Standalone development retains ports 5173 and 5174. Stop the integrated command before switching between `npm.cmd start` and `npm.cmd run preview`.

## Known limits

The community Vite adapter is an early release with exact compatible pins. Independent runtime contexts intentionally do not negotiate shared dependencies across applications. Cloud hosting, production caching, production security headers, and shared-runtime federation are outside this task.

Angular's development Vite server reports import-analysis warnings for dynamic imports inside bundled `es-module-shims`; those library imports are intentional and the actual development and built-browser flows were verified. Healthy application checks produced no browser console errors. Controlled failure tests intentionally generate handled error messages.

Dependency installation still reports the existing 21 moderate audit findings; no unrelated dependency remediation was performed. The user has not yet accepted this migration demonstration.

## Primary sources and inspected implementation

- [Native Federation orchestrator documentation](https://native-federation.com/docs/v4/orchestrator/)
- [Orchestrator configuration and public storage/import-map options](https://native-federation.com/docs/v4/orchestrator/configuration/)
- [Dynamic initialization and caching constraints](https://native-federation.com/docs/v4/orchestrator/version-resolver/)
- [Native Federation adapters and the stale community link](https://native-federation.com/docs/v4/adapters/)
- [Core build adapter contract](https://native-federation.com/docs/v4/core/build-adapters/)
- [Selected community adapter repository](https://github.com/jonmferreira/native-federation-vite)
- [Adapter builder source calling the official core](https://github.com/jonmferreira/native-federation-vite/blob/main/src/builder.ts)
- [Vite adapter implementation](https://github.com/jonmferreira/native-federation-vite/blob/main/src/vite-adapter.ts)
- [Official orchestrator source](https://github.com/native-federation/orchestrator)

Exact versions and peer/engine ranges were read from the public npm registry. Where browser retrieval of repository source failed, read-only HTTPS requests fetched the primary raw GitHub files; the installed package implementation was also inspected. Metadata compatibility was followed by actual builds and browser execution.
