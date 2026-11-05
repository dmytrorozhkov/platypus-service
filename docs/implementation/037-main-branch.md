# Implementation 037 — Main as the canonical repository branch

Date: November 5, 2026. Status: complete; promotion and hosted CI verified; independently reviewed in 038.

## Authorization and result

The learner approved promoting the reviewed project history to main and making it the default GitHub branch. Root performed this bounded repository step. The remote repository remains public. Application code, workflow content and AWS resources were not changed by this stage.

## Verified operations

- The worktree was clean and origin was refreshed before mutation.
- Previous main: 62acaddf0174d162b9ec3288cb24563561e05717. Promoted reviewed history: 1ae166523aff6321010d3b7a76be6cbe90adfa15, from planning/github-delivery.
- git merge-base --is-ancestor returned success; git merge --ff-only advanced main without conflicts or rewritten commits.
- git push -u origin main published main at that exact reviewed commit. Existing branches were retained.
- Authenticated GitHub metadata confirmed administrator access and the previous default planning/aws-first-deployment. Existing local Git credentials were used only in memory; no token was printed or stored in project files.
- A repository PATCH supplied only default_branch: main. The response and a separate GET both confirmed main and public visibility.
- git remote set-head origin -a confirmed origin/HEAD now points to main.
- Current plan, working rules and README were updated to describe the completed branch decision. Historical reports retain their dated observations.

## Meaning and limits

New clones and pull requests now use main by default. Existing checks/builds workflow is present there, so its manual dispatch prerequisite is satisfied. The Deploy workflow, temporary AWS publisher access, durable state and executor from proposals 033–035 remain future implementation; this branch step creates none of them.

The actual main push run [42103045381](https://github.com/dmytrorozhkov/platypus-service/actions/runs/42103045381) completed successfully for promoted commit 1ae166523aff6321010d3b7a76be6cbe90adfa15. Public API evidence confirms every recorded job step succeeded; raw evidence is ignored in .local/ci/main-promotion-1ae1665.json. A later documentation-only checkpoint may trigger another ordinary CI run; that is not inferred to have completed. Local servers remain stopped, and the running AWS release is unchanged. No merge strategy, branch protection, required review environment, quota, billing or repository visibility change was made.

## Verification

Git ancestry, fast-forward output, published commit, default-branch readback and origin/HEAD were verified. Independent review 038 found no remaining blocker after correcting a second stale README branch paragraph. Repository-wide lint and format checks passed, and whitespace checks passed. Root checks the final staged snapshot before saving the documentation checkpoint; no additional local runtime build was needed for this Git/documentation-only step.

Reference: [GitHub default branch](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/changing-the-default-branch).
