# Task 034 — Parallel temporary-access planning

Date: November 5, 2026. Branch: planning/github-delivery. Status: proposal complete; independently reviewed in 036; implementation not approved.

The learner asks for the next step and maximum useful parallel agent work. This authorizes research/proposals, not implementation or cloud changes. Read AGENTS.md, PROJECT_PLAN.md 5.35–5.38, current section 9, infrastructure/README.md and relevant source/evidence only. aws_architecture owns only docs/architecture/034-github-aws-access.md; stage in the coordinator workspace if the sandbox prevents the assigned write. Root owns shared files/Git/integration.

Design temporary GitHub-to-AWS access with repository/ref/environment-scoped trust and least privileges for only the existing owned deployment. Use relevant local AWS skills and current official sources, including new-repository immutable subject claims. Separate initial setup/operator permissions from routine publishing and infrastructure changes; identify needed public repository metadata/settings and cost assumptions without guessing. No IAM/provider/role/policy/secret/repository mutation or live AWS inventory.

Produce a compact English proposal (about 60–90 lines maximum), with acceptance checks, dependencies/owner boundaries, current versus proposed facts and up to three current primary source links. Propose no paid service or repository visibility/default-branch change. No Git mutations, application/workflow/dependency writes, cloud settings, deployment, new installs, processes or subdelegation. Keep actual account/resource identifiers and credentials out of tracked content. Coordinate interface assumptions with the other two planners. Hand off without claiming execution.
