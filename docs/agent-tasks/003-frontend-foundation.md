# Agent Task 003 - Minimal Frontend Foundation

Status: implementation and local verification complete; independent review complete with no confirmed blocking defects. User acceptance pending. Reports: docs/implementation/003-frontend-foundation.md and docs/reviews/004-independent-frontend-review.md.
Date: November 3, 2026.
Role: initial integrator.
Runtime task name: frontend_integrator.
Coordinator: primary conversation agent.

## Goal and inputs

Implement the architecture in docs/architecture/002-frontend-architecture.md and verify the minimal Angular Shell, React Analytics, and Vue Administration. Read PROJECT_PLAN.md, AGENTS.md, FIRST_STAGE.md, and the compatibility research.

## Change ownership

The integrator owns root package.json/package-lock.json, apps/, packages/, scripts/, README.md, .gitignore, and docs/implementation/003-frontend-foundation.md. The coordinator owns planning documents and task records. No parallel implementation edits are allowed. Preserve all existing content outside the owned areas.

## Scope

- Recheck primary package metadata; pin compatible exact versions.
- Create one npm workspace root and lockfile, Angular CLI Shell, independently built Vite React/Vue remotes, and a framework-independent type-only mounting contract.
- Implement Angular navigation, runtime-configured loading, lifecycle cleanup, scoped styles, and controlled loading/error/retry behavior.
- Provide local serving and independent development/build commands.
- Keep the visible interface minimal and coherent, with English headings and navigation.
- No backend, authentication, product tables/charts, NgRx feature state, cloud resources, Git initialization, or paid connections.

## Verification

Run actual dependency installation, the three independent builds, appropriate typechecks, and meaningful integration checks. Verify runtime module output and serving behavior. Check browser navigation and lifecycle when supported; disclose unverified behavior and coordinate browser verification otherwise. Record commands, outcomes, errors, and active local processes.

## Workflow and output

Implementation -> independent review -> confirmed fixes -> coordinator demonstration.
The independent reviewer will receive requirements, actual source, and verification evidence. All project artifacts and the integrator's report are English. Direct user explanations remain Russian.

## Permissions

Reversible local implementation and dependency installation are authorized. Use actual sandbox escalation for target-path writes or network access when required. Do not modify other projects or weaken PowerShell policy. Do not delegate further.
