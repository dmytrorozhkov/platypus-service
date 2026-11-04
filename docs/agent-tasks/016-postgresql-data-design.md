# Agent Task 016 - PostgreSQL Data Design Proposal

Status: planning complete by postgres_data_design; independent proposal review 018 found no blocking inconsistency. Report: docs/architecture/016-postgresql-data-design.md. Installation and application implementation remain future stages.
Date: November 4, 2026.
Baseline: accepted local server commit 5532511 and acceptance record 792ea55.

## Goal and inputs

Design the first bounded PostgreSQL persistence slice for Platypus Service. Read AGENTS.md, PROJECT_PLAN.md, task 014/report, apps/server/src/ticket-repository.ts, the authoritative 25-record fixture and server/client contract tests. Preserve the items/total response, seven ticket fields, four statuses, null assignees and timestamp meaning. Keep the agreed later 100,000-record/server-querying/access boundaries.

## Deliverable

Prepare an English design report with a recommended initial schema, reasons for its scope, migration and seed workflow, Node repository integration, and meaningful acceptance checks. Compare a minimal flat ticket table with a small relational model; choose and justify a bounded first model without implementing the entire future product. Explain identifiers versus visible ticket numbers, organization/assignee relationships, nullability, status/time constraints, deterministic ordering and useful initial indexes. Distinguish future identity/permissions/history tables from the immediate persistence slice.

Define repeatable schema creation, versioned changes, transaction behavior and a deterministic 25-record seed that can be rerun without duplicating records or silently overwriting later edits. Show concise illustrative SQL or mappings only where needed for review. Describe Node connection/pool shutdown, parameters, timestamp serialization, errors and replacement of FixtureTicketRepository through the existing interface. Preserve local browser behavior and the current HTTP contract; expose no database connection to the frontend.

Propose checks that actually prove PostgreSQL is used, persisted changes survive database/server restart, errors recover, migration/seed reruns behave, and healthy frontend/federation behavior remains. Identify how the fixture can remain a deliberate seed/test asset without becoming a silent runtime fallback. If recommending packages or database-specific behavior, verify primary official sources and cite URLs/date; no guessed current versions.

## Parallel ownership and limits

The other planner owns machine inventory and local PostgreSQL launch options. You own data/schema/repository design. Share requirements with the other planner through messages and keep proposals compatible; neither writes shared tracked files.

Read-only project inspection and primary-source research are authorized. Write only C:/Users/Dmytro/Documents/ChatGPT/AWS/.agent-staging/016-postgresql-data-design.md. The coordinator copies approved reports into the project and owns plan/task records and Git. Do not change source/dependencies, run migrations/seeds, install/start a database, stop current applications, create cloud resources, commit or spawn sub-agents.

Record open choices and unverified behavior honestly. Send concise progress and material blockers to the coordinator; stop when the bounded report is ready.
