# Agent Task 005 - Code Quality Tooling

Status: implemented and locally verified by frontend_quality_tooling; independent review 007 found no confirmed blocking defects. Report: docs/implementation/005-code-quality-tooling.md.
Date: November 3, 2026.

## Goal and scope

Add root ESLint and Prettier tooling for the existing Angular, React, and Vue workspace. Read AGENTS.md, PROJECT_PLAN.md, actual manifests, and architecture. Select exact compatible dependencies using primary documentation and registry metadata.

ESLint covers JavaScript/MJS, TypeScript, React TSX and hooks, Vue single-file component scripts/templates, and Angular code plus inline/external templates. Prefer a recommended baseline and disable formatter-conflicting rules through eslint-config-prettier. Prettier covers authored source, styles, configuration, and documentation, excluding dependencies, generated output, caches, local evidence, and lockfiles.

Provide lint, lint:fix, format, and format:check commands and concise README instructions. Make minimal justified source corrections and formatting changes; preserve behavior. Do not add Tailwind in this task.

## Ownership and verification

The integrator owns quality configs, root package/lockfile edits, source formatting, README tooling instructions, and docs/implementation/005-code-quality-tooling.md. Coordinator owns semantic planning/task edits and will avoid concurrent formatting edits. No other source writer until handoff.

Verify lint with zero warnings, formatting checks, applicable typechecks/builds, and meaningful invalid-input checks proving framework coverage. No unnecessary test framework or paid resources. Preserve the running application. No delegation. Return versions, commands, actual findings/fixes, and remaining limitations. Independent review follows the combined tooling/theme work.
