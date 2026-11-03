# Tailwind and Shared Theme — Task 006

Date: 2026-11-03.
Status: implemented and locally verified; user acceptance remains with the coordinator.
Scope: shared styling for the existing Angular Shell, React Analytics, and Vue Administration foundation. No product features, cloud resources, federation, or framework upgrades were added.

## Implementation

- Added private CSS-only workspace `@platypus/theme` at `packages/theme` with shared font, color, radius, shadow, and responsive breakpoint tokens.
- Each application imports `@platypus/theme/tokens.css` and compiles its own Tailwind output. No shared runtime framework, global store, or separately served theme bundle was introduced.
- Pinned `tailwindcss`, `@tailwindcss/postcss`, and `@tailwindcss/vite` to **4.3.4** where required. Shell also declares PostCSS **8.5.32**. Vite's Tailwind plugin declares support for the installed Vite 8 range.
- Angular uses `apps/shell/.postcssrc.json`; React and Vue use the Tailwind Vite plugin in their existing build configurations.
- Shell classes use the `sh:` prefix. Analytics uses `an:`; Administration uses `ad:`. Source scanning is disabled by default and explicitly enabled only for each application's `src` directory.
- Only Shell imports Tailwind Preflight, the document-wide baseline reset. Remote builds import theme and utilities without Preflight.
- Migrated the actual Shell layout, navigation, header, footer, and both remote placeholder cards to utility classes. Small CSS selectors remain for active navigation, icons, and existing Shell fallback views.
- Replaced the unused React CSS module. Both existing remote root selectors, `.ps-analytics` and `.ps-administration`, remain available.
- Standalone entry points import `@platypus/theme/standalone.css` for their document baseline. Inline document styles were moved into that stylesheet. Remote entries never import this baseline.
- Mount, cleanup, runtime configuration, routing, and ES-module integration behavior were preserved. The only remote adapter changes are CSS imports.
- Kept the existing plain Prettier configuration. Automatic Tailwind class sorting is optional and was not installed.

## Styling boundaries

`tokens.css` contains Tailwind theme definitions rather than framework components or resets. Its imported definitions become separately prefixed variables in each application's output.

Remote utility class prefixes prevent ordinary class-name collisions with Shell and the other remote. Shared token values currently match, while their compiled variable names remain distinct. This remains a styling convention, not a security boundary or complete DOM isolation.

Integrated remotes keep separate `dist/remote/style.css` artifacts. Shell's existing stylesheet registry loads and releases the active remote stylesheet. Standalone document styling is compiled only for independent development pages and is absent from remote library output.

Changing a shared token requires rebuilding each affected application. Rebuilding and publishing one application remains independent; there is no requirement to rebuild Shell for a compatible remote-only change.

## Commands

From the project root:

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
npm.cmd run typecheck
npm.cmd run test:integration
npm.cmd start
```

With the integrated workspace running, use another terminal:

```powershell
npm.cmd run test:browser
npm.cmd run test:independent-build
```

To include independent pages, run both existing remote development commands in separate terminals, then `npm.cmd run test:browser -- --standalone`. Use `npm.cmd run preview` instead of `npm.cmd start` to verify built Shell output; stop the current integrated process first.

## Verification performed

- Dependency installation completed with a single updated root lockfile and the new local theme workspace. No install-script approval policy was changed.
- ESLint passed after a test-only correction that qualifies browser computed-style access through `globalThis`.
- Prettier formatted the changed sources and configuration; the final format check passed.
- All three independent production builds and all three application typechecks passed.
- Both existing hosting and contract tests passed.
- Updated browser runner verified real used utility selectors in all three compiled CSS outputs, per-app theme variables, and the absence of Preflight resets from both remote outputs.
- Real headless Microsoft Edge checks passed **15 assertion groups** against development Shell and again against built Shell, including both standalone pages in each run.
- Computed-style checks verified white card backgrounds, **16px** corner radius, **52px** top padding, **1px** borders, shared ink color and font family, title weight, **42px** icon sizing, and flex layout. They passed in standalone and integrated pages.
- Across repeated remote switches, Shell retained its grid layout, **250px** desktop sidebar, sidebar background, and header text color. Exactly one active remote stylesheet remained.
- Navigation, history, direct route reload, unknown routes, delayed module and stylesheet cleanup, controlled failures, retry/reload recovery, and mobile horizontal-overflow checks passed.
- Independent-build check changed the existing Analytics sentence, rebuilt only Analytics, observed the changed text in Shell, and confirmed unchanged Shell and Administration build-directory hashes. It restored the original sentence and rebuilt Analytics afterward.
- Inspected the resulting Analytics screenshot; the established sidebar, page layout, colors, and placeholder card presentation were preserved. Screenshots are local evidence in `.local/evidence`.

Build CSS sizes: Analytics **6.20 kB**, Administration **6.18 kB**, Shell **9.88 kB** (uncompressed build output). These are observations, not performance targets.

## Limits and handoff

The existing dependency audit still reports **21 moderate** findings, as already recorded in Task 005; this task did not perform unrelated dependency remediation.

No production hosting or deployment was performed. Remote styling uses prefixes and conventions, not Shadow DOM. Generated Tailwind output includes its normal internal property rules; remote builds exclude the global Preflight reset.

README documents shared-theme ownership and the existing commands. The coordinator records stage acceptance and subsequent scope separately.

## Primary sources

- [Tailwind Angular installation](https://tailwindcss.com/docs/installation/framework-guides/angular)
- [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite)
- [Tailwind Preflight and partial imports](https://tailwindcss.com/docs/preflight)
- [Sharing Tailwind theme variables across projects](https://tailwindcss.com/docs/theme)
- [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files)

Exact package versions and plugin peer ranges were checked against the public npm registry before installation. Successful builds and browser execution establish the local integration result beyond the metadata checks.
