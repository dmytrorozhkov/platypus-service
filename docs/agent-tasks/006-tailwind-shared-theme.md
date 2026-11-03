# Agent Task 006 - Tailwind and Shared Theme

Status: implemented and locally verified after the task 005 ownership handoff; independent review 007 found no confirmed blocking defects. Report: docs/implementation/006-tailwind-shared-theme.md. User inspection pending.
Date: November 3, 2026.
Assigned agent: frontend_architecture, acting as styling integrator after explicit coordinator handoff.

## Goal

Use Tailwind across Angular Shell, React Analytics, and Vue Administration, sharing framework-independent theme values and retaining independent builds. The user explicitly selected Tailwind with a shared theme.

## Preparation and implementation boundaries

Read current project instructions, actual source, and current official Tailwind integration/theme/Preflight documentation and compatible registry metadata. Do not edit or install until the coordinator transfers ownership after task 005.

After handoff, own theme package, Tailwind build/config integration, scoped application style/class migration, necessary root dependencies/lockfile, compatible Prettier class sorting if used, README styling instructions, and docs/implementation/006-tailwind-shared-theme.md. No simultaneous source writer. Coordinator retains semantic planning/task edits.

Preserve the current visual design, lifecycle contract, runtime loader, and independent builds. Use one shared theme rather than three divergent copies. Keep global reset ownership in Shell; remotes must not reset the host document. Compile used utilities for each application and control selector collisions. Keep standalone pages functional. Do not switch federation mechanisms or add product features, a component library, authentication, cloud services, or paid assets.

## Verification and output

Run lint and format checks, three builds/typechecks as relevant, inspect generated theme/utility CSS, and use the existing real browser suite against the integrated applications. Verify no layout/style leaks and that standalone pages work. Fix confirmed issues within scope. Document exact commands, versions, files, sources, and limitations in English. Independent review follows; coordinator explains the result in Russian.
