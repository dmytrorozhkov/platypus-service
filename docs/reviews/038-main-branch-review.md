# Independent Review 038 — Canonical Main Promotion

Date: November 5, 2026. Scope: approved stage 037, Git/settings/documentation only.

## Result

No confirmed blocker remains after the README correction. The reviewed history is published on main, and the public repository's default is main. Final coordinator checks are noted below.

## Independent evidence

- Read current AGENTS.md, PROJECT_PLAN.md sections 5.39 and 9, tasks 037/038, implementation 037 and the relevant README sections.
- `git merge-base --is-ancestor` succeeded for original main `62acaddf0174d162b9ec3288cb24563561e05717` to reviewed `1ae166523aff6321010d3b7a76be6cbe90adfa15`; the original commit remains in history.
- Local main, origin/main and origin/HEAD resolve to that reviewed commit; the checked-out branch is main.
- A fresh `git ls-remote --symref origin HEAD refs/heads/main` independently returned HEAD pointing to refs/heads/main and both remote references at the exact reviewed commit.
- A separate public GitHub API GET returned default_branch main, private false and visibility public.
- The currently tracked stage diff contains only AGENTS.md, PROJECT_PLAN.md and README.md; new task/implementation records are documentation. No new application, workflow or dependency changes were observed beyond the already reviewed promoted history.
- Promotion brings previously reviewed application/CI history onto an older main. The difference from old main must not be described as a newly authored runtime change in stage 037.

## Finding

The README's Git and GitHub workflow section initially described the previous default and old local main as current operational guidance, while its updated CI section correctly described main. This could send the learner to an outdated branch. Root replaced that paragraph with the current main/origin/main/origin/HEAD state, retained branches and the distinction between Git publication and AWS deployment. The reviewer reread the corrected integrated paragraph and confirmed the issue resolved.

## Scope and evidence limits

- Root's supplied mutation record states that its repository PATCH contained only default_branch: main, followed by response and separate GET checks. Independent reads confirm the resulting default and visibility; they do not reconstruct every server-side setting before and after the PATCH.
- No rewriting is required by the observed ancestry. Root reports using fast-forward-only publication and preserving existing branches; this reviewer performed no Git mutation or branch deletion.
- The workflow already existed in promoted history. Its default-branch presence enables the manual checks/builds dispatch prerequisite; no Deploy workflow or AWS access was added by this step.
- Existing hosted CI results remain earlier evidence. This review did not execute or infer success for a new main-branch CI run.
- No AWS calls, source changes, settings mutations, builds, runtime/browser tests, service startup or deployment were performed by the reviewer.
- Final lint, formatting, whitespace/staged-diff checks and the documentation checkpoint belong to root and remain pending in this report.
- Delivery/IAM/environment setup, durable deployment state, database/authentication implementation and Sonar remain outside stage 037.

## Coordinator integration evidence

Root subsequently observed successful main push CI run [42103045381](https://github.com/dmytrorozhkov/platypus-service/actions/runs/42103045381) for exact promoted commit1ae1665, including every recorded job step. This is coordinator API evidence, not a reviewer-run workflow. Root lint/format and whitespace checks passed; the final documentation checkpoint is inspected separately before commit.
