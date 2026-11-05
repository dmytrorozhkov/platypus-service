# Task 035 — Parallel delivery verification/recovery planning

Date: November 5, 2026. Branch: planning/github-delivery. Status: proposal complete; independently reviewed in 036; implementation not approved.

The learner asks for the next step and maximum useful parallel agent work. This authorizes research/proposals, not implementation or cloud changes. Read AGENTS.md, PROJECT_PLAN.md 5.35–5.38, current section 9, infrastructure/README.md and relevant source/evidence only. frontend_review owns only docs/operations/035-delivery-checks-and-recovery.md; stage in the coordinator workspace if the sandbox prevents the assigned write. Root owns shared files/Git/integration.

Design bounded preflight/post-publication checks, failure stops and recovery using actual launch evidence, existing live runner and prior offline rollback plans. Distinguish full release, per-remote and backend rollback; initial retained backend version 1 has bootstrap.invalid origin and is not a valid live-origin rollback target. Identify shared-state/pointer/current-manifest gaps, test ownership and first deployment proof. No browser/HTTP/cloud calls, build, server startup, source changes or actual rollback.

Produce a compact English proposal (about 60–90 lines maximum), with acceptance checks, dependencies/owner boundaries, current versus proposed facts and up to three current primary source links. Propose no paid service or repository visibility/default-branch change. No Git mutations, application/workflow/dependency writes, cloud settings, deployment, new installs, processes or subdelegation. Keep actual account/resource identifiers and credentials out of tracked content. Coordinate interface assumptions with the other two planners. Hand off without claiming execution.
