# Agent Task 017 - Local PostgreSQL Environment Proposal

Status: planning complete by postgres_environment; independent proposal review 018 found no blocking inconsistency. Report: docs/research/017-local-postgresql-environment.md. Research and read-only inventory only; installation remains a future stage.
Date: November 4, 2026.
Baseline: accepted local server commit 5532511 and acceptance record 792ea55.

## Goal and inputs

Recommend a practical local PostgreSQL launch method for this Windows learning project, prioritizing local/free tools and repeatability. Read AGENTS.md, PROJECT_PLAN.md relevant storage/cost rules and the current Node startup/report. The app is already running on localhost ports 3000/4200/4301/4302/4303; leave it running.

A previous command/service check found no docker, psql or pg_ctl command on PATH and no matching PostgreSQL/Docker service. This is not exhaustive proof of absence. Inspect only relevant machine prerequisites using read-only checks: OS/architecture, relevant installed products or executables, Windows virtualization/WSL state if needed, available local tools and the candidate database port. Do not print secrets, broad personal inventories or credentials. An empty Get-NetTCPConnection result was previously unreliable; use actual TCP connection probes where port availability matters.

## Deliverable

Prepare an English report comparing Docker-based local PostgreSQL with native Windows installation, and a project-local alternative only if it materially reduces setup. Verify current official PostgreSQL releases/platform downloads, Docker requirements/terms if recommended, persistence locations and install scope from primary sources. Clearly distinguish verified machine facts, source-backed requirements and assumptions. Do not promise that a cloud service or licensed tool is unconditionally free.

Recommend one method with prerequisites, exact proposed supported version/pinning strategy, setup effort, start/stop ownership, candidate port, persistent storage, connection configuration and removal procedure that preserves data by default. Give reviewable future commands without executing installs, downloads, image pulls, services, database initialization or file deletion. Keep real credentials out of reports and public frontend configuration; describe local configuration placeholders.

Explain how the database lifetime relates to npm start, how to prove persistence after restart, and what explicit next step depends on user/OS interaction. Coordinate connection assumptions with the data specialist. Do not design SQL tables or edit the Node application; these belong to the other planner and a later approved implementation.

## Parallel ownership and limits

Read-only relevant inventory and primary-source web research are authorized. Write only C:/Users/Dmytro/Documents/ChatGPT/AWS/.agent-staging/017-local-postgresql-environment.md. The coordinator copies the report and owns shared planning records/Git. No software installation/update, system-setting changes, database/container startup, existing process shutdown, repository mutation, cloud or paid action, commits or sub-agent delegation.

Record actual checks and any constraints. Send concise progress and material blockers to the coordinator; stop when the bounded report is ready.
