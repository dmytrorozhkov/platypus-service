# Independent Native Federation Review — Task 009

Completed: 2026-11-04 (Europe/Warsaw).
Implementation task: 008, started 2026-11-03.
Project: D:/Projects/Pet-projects/aws.
Reviewer: frontend_review, separate from the integrator.
Verdict: the confirmed intermediate concurrency defect has been corrected. No remaining confirmed blocking defect was found within the approved migration scope. Ready for coordinator demonstration and user acceptance.

## Review scope and independence

Reviewed current AGENTS.md, task 008, the established frontend/theme boundaries, actual source and installed package implementation, generated metadata and modules, README.md, the adapted verification scripts, and docs/implementation/008-native-federation.md.

The reviewer did not change project source, install packages, run competing builds or servers, or repeat the integrator's browser suite. Direct execution comprised read-only manifest checks and isolated official-runtime concurrency probes using mocked network/import-map/module adapters in a separate Node process. Those probes used no application ports and left no fixture files.

## Independently inspected implementation

- Both remote build scripts use native-federation-vite 0.2.0 with federation.config.mjs. The installed adapter source implements NFBuildAdapter, normalizes federation options, registers its adapter, and calls buildForFederation from official @softarc/native-federation 4.8.1. This is a genuine core build pipeline, not application-authored federation metadata.
- Adapter peers require Vite ^8.0.0 and core ~4.8.1, matching the project's Vite 8.3.5 and core 4.8.1 pins. Orchestrator 4.9.0 accepts optional core ^4.8.0. Existing Angular, React, Vue, TypeScript, and Tailwind versions were retained.
- Generated remoteEntry.json files identify version v4 and the correct remote name, with ./mount pointing to a generated content-hashed module. Both generated shared arrays are empty, matching the deliberate shared: {} and sharedMappings: [] configuration.
- Shell uses official initFederation, initRemoteEntry, and the resulting loadRemoteModule in apps/shell/src/app/remote-host/federation.ts. The earlier importRemote/plain-import implementation is removed. Angular remains the host application and does not expose or share its own Angular modules.
- Runtime configuration supplies remoteEntryUrl, ./mount, and CSS URLs. Configuration, exported mount contract, and cleanup handle validation remain present. Changed registered deployment URLs produce an explicit Reload requirement; failed registration promise tracking is removed for Retry.
- Final runtime instances are separate for Analytics and Administration, with distinct storage namespaces. Their official shim import-map setter uses additive maps and does not clear the other remote's mappings. No vendor source or private cache implementation was patched.
- Angular retains route/history ownership, stale-activation checks, abort-driven disposal, mounting containers, idempotent remote cleanup, and stylesheet leases. Tailwind prefixes, shared theme, independent style.css files, and Shell-only Preflight remain intact.
- The adapted browser runner resolves exposed-module URLs from real generated metadata. It checks successful browser metadata/module requests, official orchestrator version and shim maps, and the absence of legacy remote-entry.js requests. Deliberate failure interception is separate from healthy integration evidence.
- The final root Node requirement and lockfile engine metadata both use ^24.16.0 || >=26.0.0. This removes the earlier advertised Node versions incompatible with orchestrator 4.9.0's >=24.16.0 engine requirement. Actual Node 24.21.0 fits.
- All current direct dependency specifications match the single root lockfile. The ignored migration backup directory and its manifest are present; the integrator records the backup's creation and contents in task 008.

## Confirmed finding and correction

### P1 — concurrent failed registration could invalidate a healthy remote: resolved

Location: the intermediate apps/shell/src/app/remote-host/federation.ts implementation that issued concurrent initRemoteEntry calls against one orchestrator instance.

Reproduction used installed official orchestrator 4.9.0 with an empty initial manifest, strict mode, no host entry, and no shared dependencies:

1. Start Analytics and Administration metadata registration concurrently on the same instance.
2. Resolve valid Analytics metadata while rejecting the Administration metadata fetch at controlled microtask offsets.
3. Await both registrations, then load Analytics through the official loader.

In 8 of 45 controlled schedules, Analytics initialization fulfilled but the failed Administration transaction rolled the shared repository back to an empty committed state. Analytics module loading then failed. The application wrapper would retain Analytics' fulfilled registration promise, so a normal Retry could not reconstruct the missing registration.

The final implementation isolates the official runtime repositories by remote namespace and keeps shim maps additive. This prevents one remote's rollback from affecting the other's committed or pending registration without serializing network waits across routes. The reviewer repeated the same 45 schedules with separate official instances/namespaces and observed zero failures. These are isolated runtime probes with mocked network and module loading, not a claim that the reviewer personally ran the project browser regression.

The integrator also added a real browser regression: hold the first Administration metadata request, open previously uninitialized Analytics, fail the delayed Administration request, recover Administration, and revisit Analytics. The final reported development and built suites pass that scenario.

## Execution evidence reported by the integrator

The final task 008 report and integrator handoff record:

- Exact dependency installation and a valid dependency tree without forced peer overrides.
- Three independent production builds, application typechecks, lint, and both hosting/contract tests passing. At final handoff, a repository-wide formatting check still flagged three coordinator-owned planning documents; the coordinator retained that formatting step before presentation.
- Real headless Edge integration: 18 assertion groups against development Shell and again against built Shell, including both standalone pages.
- Successful network requests for both generated remoteEntry.json files and their exposed modules through official orchestrator 4.9.0, with live shim import maps and no legacy entry request.
- Preserved navigation, history, direct links, refresh, not-found behavior, delayed module/style cleanup, controlled contract and stylesheet failures, metadata Retry, unavailable-remote recovery, styling invariants, and mobile checks.
- An Analytics-only Native Federation rebuild appearing in Shell while Shell and Administration artifact hashes remain unchanged. Original Analytics source was restored and rebuilt; the reviewer confirmed the original sentence is present.

The reviewer inspected these scripts, reports, and generated artifacts rather than rerunning the installation/build/browser suites. Source inspection and the independent concurrency probes directly support the identified defect and its correction; project browser execution outcomes remain attributed to the integrator.

## Design limits and remaining acceptance

- The selected Vite adapter is an early pinned community release, not a first-party adapter. Its implementation and declared compatibility were inspected; the local builds and browser results establish this experiment's execution outcome.
- Separate orchestrator namespaces and shared: {} deliberately provide no cross-remote shared-dependency negotiation. Review this design before introducing shared Angular runtimes or other shared libraries. That future exercise is not required for this mixed-framework migration.
- Native module and registered metadata caches are document-scoped. Metadata failures support Retry; cached module/contract corrections or a changed registered URL can require the offered Reload action. Persistent federation caching is not enabled.
- The runtime deployment set comprises metadata, generated exposed modules/import-map artifacts, and styles; generated .nf-cache is a build cache to exclude from deployment.
- The integrator documents intentional library import-analysis warnings in Angular development and existing dependency notices separately from healthy browser errors. This review did not broaden into dependency remediation, SSR, production policies, or cloud deployment.
- Coordinator final checks, demonstration, and user acceptance remain separate from this technical review. No user acceptance of the migration is claimed.

## Primary references checked

- [Official orchestrator overview](https://native-federation.com/docs/v4/orchestrator/) — framework-independent host runtime and metadata contract.
- [Official configuration](https://native-federation.com/docs/v4/orchestrator/configuration/) — host entry, shim map functions, document cache options, and storage namespaces for multiple runtime instances.
- [Dynamic initialization constraints](https://native-federation.com/docs/v4/orchestrator/version-resolver/) — additive dynamic registration and retry/commit behavior.
- [Build adapter contract](https://native-federation.com/docs/v4/adapters/build-your-own/) — the adapter/core boundary.
- [Community adapter source](https://github.com/jonmferreira/native-federation-vite) — repository identified by the installed package; published adapter/builder implementation was directly inspected locally.

The review relies on the actual installed versions and source in addition to documentation, particularly where the runtime concurrency behavior required an executable reproduction.
