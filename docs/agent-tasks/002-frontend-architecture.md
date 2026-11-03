# Agent Task 002 - Frontend Architecture

Status: completed and reviewed by the coordinator. Output: docs/architecture/002-frontend-architecture.md. Application implementation remains pending.
Date: November 3, 2026.
Role: architect.
Runtime task name: frontend_architecture.
Coordinator: primary conversation agent.

## Goal

Turn the compatibility research into a minimal, implementation-ready plan for an Angular shell with independent React Analytics and Vue Administration applications.

## Inputs

- PROJECT_PLAN.md
- AGENTS.md
- FIRST_STAGE.md
- docs/research/001-frontend-compatibility.md

## Boundaries

Read-only project inspection and public primary documentation research. No installs, scaffolding, file edits, Git initialization, cloud resources, paid connections, or further agents. Return an English document; the coordinator records it. Application implementation is a separate next step.

## Required decisions

- Minimal integration mechanism and rationale; independent builds and deployment.
- Directory tree distinguishing first-experiment files from future areas.
- Workspace package names and single ownership of shared files.
- Local ports and runtime configuration, including module and CSS addresses.
- Versioned mount/cleanup contract, route ownership, direct links, and history.
- Race-safe asynchronous loading, cleanup, styles, failures, retry, and cache handling.
- Browser module output, framework bundling, React environment constants, and runtime imports.
- Standalone development and integrated built-remote workflow; proposed commands clearly unimplemented.
- One initial integrator and subsequent independent review.
- Concrete checks for normal navigation, rapid navigation, missing remotes, independent builds, and a remote rebuild without a shell rebuild.

NgRx remains a future feature-state choice; do not add application features, backend, authentication, or cloud deployment.

## Acceptance

Explain choices using existing research and primary documentation. Separate design decisions from verified execution. No builds or browser checks are claimed. Include implementation risks, relevant source URLs, and a bounded handoff.
