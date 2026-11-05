# Implementation 049 — Manual package preparation

Date: November 5, 2026. Status: locally implemented and independently reviewed050 without a confirmed blocker; root checks passed; hosted checks and manual workflow acceptance remain distinct pending evidence.

## Result

The new .github/workflows/package.yml defines a manual Package workflow. It accepts no free-form inputs and restricts both jobs to the exact repository and refs/heads/main. It reuses the existing CI with package_delivery=true and the repository DELIVERY_ORIGIN variable. Complete checks/builds precede the existing full bundle creation and bounded artifact upload. The origin variable was not created or changed.

The workflow grants only contents: read. It contains no AWS identity-token permission, credential action, environment, inherited secrets, cloud command or publication operation. Its concurrency group serializes manual package runs without canceling an active one. This prepares the accepted fixture application; it does not change product behavior or the public AWS deployment.

The only CI changes expose the existing upload-artifact artifact-digest through job and reusable-workflow outputs. Existing one-day retention, no-overwrite behavior, full inventory and 32 MiB bundle limit are unchanged. No new action or dependency is introduced: the summary job reuses the already pinned checkout/setup-node actions, checks out the exact github.sha and runs a dependency-free Node helper. It installs no dependencies and does not rebuild the applications.

## Preparation receipt

After successful reusable CI, the receipt job writes a GitHub job summary containing the exact repository, Package workflow, main ref, full source commit, run/attempt, release, artifact ID, GitHub artifact ZIP SHA-256 and bundle-envelope SHA-256. Links identify the exact commit, run attempt and authenticated artifact download.

scripts/delivery/package-summary.mjs validates all supplied metadata before rendering Markdown: repository/workflow/ref/manual event must match exactly, SHA/digests are complete lowercase hex, numeric identities are bounded, and the release must equal the same run/attempt/source-derived identifier. Values pass through environment variables rather than shell interpolation. Invalid/missing metadata or Markdown/newline/command-like text fails without rendering a successful receipt.

The GitHub artifact ZIP digest is the uploaded archive's digest, separate from the Lambda ZIP hash stored inside the bundle. Download still requires GitHub authentication despite the public repository. The artifact is retained for one day, and the summary is preparation evidence rather than durable deployment state.

No archive download or GitHub API metadata verification is added to the summary job. Its receipt binds the successful build's outputs to this workflow run; it does not prove authenticated artifact selection/extraction in CodeBuild or authorize a publisher. Contract044's trusted reader, bounded extraction and independent verification remain later work.

## Verification performed

- node --test scripts/delivery/package-summary.test.mjs: three groups passed. They cover complete receipt identity/digest output, missing/wrong repository/ref/event/workflow/SHA/run/attempt/release/artifact metadata, injection strings and overlong identities.
- npx.cmd eslint scripts/delivery/package-summary.mjs scripts/delivery/package-summary.test.mjs --max-warnings 0 passed.
- Both changed workflow files parsed with the existing Prettier YAML parser; owned formatting, full npm.cmd run lint, full npm.cmd run format:check and git diff --check passed.
- Official pinned upload-artifact metadata was rechecked for artifact-digest and authenticated download semantics. The GitHub manual-run documentation was rechecked for the default-branch prerequisite.

The author ran no application build, real bundle creation, cloud operation, Git mutation, workflow dispatch, main promotion, dependency install or repository-setting change. Root performs shared integration checks and independent review before considering publication of the workflow code.

The Package button is not yet demonstrated. GitHub requires workflow_dispatch files on the default branch, and this preparation has not promoted the file there. Even after a separately reviewed promotion, the learner must manually start the exact reviewed preparation run; the repository origin variable must already contain the reviewed public origin. No manual launch or deployment authorization is inferred from these local checks.

## Primary references

- [GitHub manual workflow execution](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow): workflow_dispatch requires the workflow on the default branch.
- [Pinned upload-artifact metadata](https://raw.githubusercontent.com/actions/upload-artifact/cf430e030ddbb5b0abf93d22962f4752f3646cd9/action.yml): existing artifact-digest output, retention behavior and authenticated artifact URLs.

## Coordinator integration verification

Root ran repository lint and format:check successfully, git diff --check passed, and all37 delivery groups passed with0 failures/skips. Independent code review050 found no confirmed blocker. Feature-branch ordinary CI follows a reviewed push; Package has not been dispatched or promoted to main. These checks do not establish CodeBuild artifact access or cloud publication.
