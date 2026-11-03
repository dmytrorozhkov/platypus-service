# Code Quality Tooling — Task 005

Date: 2026-11-03.
Status: implemented and locally verified; independent review follows.
Scope: ESLint, Prettier, shared formatting, and documented root commands. No product features, federation changes, cloud resources, or paid services were introduced.

## Changes

- Added the root flat ESLint configuration in `eslint.config.mjs`.
- Added `.prettierrc.json`, `.prettierignore`, and `.editorconfig`.
- Added root `lint`, `lint:fix`, `format`, and `format:check` scripts and updated the single npm lockfile.
- Documented commands, responsibilities, coverage, and optional local VS Code extensions in README.md. No editor extensions were installed and no global editor settings were changed.
- Formatted authored application source, configuration, templates, styles, scripts, and Markdown consistently. Planning documents received formatting only during this task; their meaning and approval status were not changed by the implementer.
- Clarified two intentional empty browser-executable probing catches with comments. The browser runner now accesses browser globals through `globalThis` inside its `page.evaluate` callback. These are lint-driven source clarifications; navigation and microfrontend behavior are unchanged.

## Pinned versions and compatibility

| Package                   | Version |
| ------------------------- | ------- |
| eslint                    | 10.14.0 |
| @eslint/js                | 10.0.1  |
| typescript-eslint         | 8.72.1  |
| angular-eslint            | 22.6.0  |
| eslint-plugin-react-hooks | 7.1.1   |
| eslint-plugin-vue         | 10.12.0 |
| vue-eslint-parser         | 10.4.1  |
| eslint-config-prettier    | 10.1.8  |
| prettier                  | 3.9.10  |
| globals                   | 17.14.0 |

Official npm registry metadata was checked before installation. The final packages accept ESLint 10 and Node.js 24.21.0; typescript-eslint supports TypeScript `>=4.8.4 <6.1.0`, including the project's pinned 6.0.3. Framework versions remain Angular 22.2.4, React 19.3.1, and Vue 3.5.44. `npm.cmd ls --depth=0` completed without invalid dependency declarations.

The initial candidate ESLint 9/classic `eslint-plugin-react` combination was replaced before handoff: ESLint 9 is deprecated, while the classic React plugin's current declared compatibility stops at ESLint 9. The final setup uses supported ESLint 10 with React Hooks rules and TypeScript/TSX checks. It does not include the classic React recommended preset or every possible JSX-specific rule. No peer dependency overrides or forced installation were used.

## Coverage

- JavaScript/MJS/CJS scripts and configuration: recommended JavaScript rules with Node globals.
- TypeScript/TSX, including the shared contract: recommended JavaScript and TypeScript rules; browser globals are scoped to application source.
- Angular TypeScript: Angular recommended component rules and `processInlineTemplates`.
- Angular templates: recommended and accessibility rules, both inline and future external HTML templates.
- React: TypeScript/TSX checks and recommended React Hooks rules.
- Vue single-file components: essential Vue template rules and TypeScript script rules through `vue-eslint-parser` and the TypeScript parser.
- Formatting: authored source, HTML, CSS, Vue, Markdown, JSON, and configuration. Dependencies, generated builds, Angular/Vite caches, local evidence, coverage/test reports, build metadata, and `package-lock.json` are excluded.

ESLint is not configured for type-aware rules. Keep running application type checks separately. CSS is formatted by Prettier; a CSS-specific linter was not added. `eslint-config-prettier` is applied last to disable conflicting stylistic rules. Prettier runs separately rather than as an ESLint rule.

## Verified commands

| Check                          | Result                                               |
| ------------------------------ | ---------------------------------------------------- |
| `npm.cmd run lint`             | Passed with zero errors and warnings.                |
| `npm.cmd run format:check`     | All matched files use the configured format.         |
| `npm.cmd run typecheck`        | Vue, React, and Angular checks passed.               |
| `npm.cmd run build`            | React, Vue, and Angular production builds passed.    |
| `npm.cmd run test:integration` | Both existing hosting/runtime-contract tests passed. |
| `npm.cmd ls --depth=0`         | Passed; exact direct versions resolved.              |

In-memory negative examples were checked through the installed ESLint API using real project file paths. No fixture files were left behind. Each example produced its expected rule finding without a parser failure:

| Example                                                        | Confirmed rule                       |
| -------------------------------------------------------------- | ------------------------------------ |
| Undefined JavaScript symbol in a Node script                   | `no-undef`                           |
| Explicit `any` in the shared TypeScript contract               | `@typescript-eslint/no-explicit-any` |
| Conditional React Hook in TSX                                  | `react-hooks/rules-of-hooks`         |
| Vue `v-if` combined with `v-for`                               | `vue/no-use-v-if-with-v-for`         |
| Unused variable in a Vue TypeScript script                     | `@typescript-eslint/no-unused-vars`  |
| Missing image alternative text in an Angular inline template   | `@angular-eslint/template/alt-text`  |
| Missing image alternative text in an external Angular template | `@angular-eslint/template/alt-text`  |

A clean TypeScript control produced no errors or warnings. No permanent tests that merely mirror the configuration were introduced.

## Runtime and remaining limits

Existing local URLs on ports 4200, 4301, and 4302 returned connection refused at handoff. This task did not stop, kill, or replace any development process. Browser checks were not repeated for this tooling-only change. Start the existing workspace with `npm.cmd start` when needed; the built remote artifacts are current.

The final dependency installation reported 21 moderate audit findings across the full development dependency tree and the four previously observed install-script approval warnings. This task did not perform an audit remediation, approve dependency scripts globally, or apply `npm audit fix --force`. Successful builds are recorded separately from those installation warnings.

Tailwind and a shared theme are a separately approved subsequent task. This report describes the completed code-quality baseline before that integration; the next implementer owns any necessary formatting plugin or theme changes.

## Primary sources

- [ESLint configuration files](https://eslint.org/docs/latest/use/configure/configuration-files)
- [ESLint version support](https://eslint.org/version-support/)
- [typescript-eslint setup](https://typescript-eslint.io/getting-started/)
- [typescript-eslint dependency versions](https://typescript-eslint.io/users/dependency-versions/)
- [Angular ESLint configuration and inline templates](https://github.com/angular-eslint/angular-eslint/blob/main/docs/CONFIGURING_ESLINT.md)
- [React Hooks ESLint plugin](https://react.dev/reference/eslint-plugin-react-hooks)
- [Vue ESLint setup](https://eslint.vuejs.org/user-guide/)
- [Prettier integration with linters](https://prettier.io/docs/integrating-with-linters)
- [Prettier ignored files](https://prettier.io/docs/ignore)

Exact version and peer dependency declarations were checked with `npm.cmd view <package> version peerDependencies engines --json` against the official npm registry, followed by local installation and verification.
