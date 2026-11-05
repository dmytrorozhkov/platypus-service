# Independent GitHub CI Review 032

Date: November 5, 2026.
Branch: feature/github-ci.
Status: pre-publication review complete; no confirmed blocker found. Actual GitHub-hosted execution remains pending the coordinator's reviewed push and observation.

## Scope and independent checks

Read AGENTS.md, PROJECT_PLAN.md section 5.36, tasks 031/032, implementation report 031, the actual workflow, README instructions and the invoked package/test/browser/ZIP commands. Independently parsed the YAML with the installed Prettier YAML parser and checked explicit assertions for triggers, token permissions, checkout credentials, runner/shell, timeout/cancellation, absence of execution bypasses and exact sequential command coverage. These checks passed without changing dependencies or installing a parser.

Checked the official action release pages, their linked complete commits and action metadata. The workflow pins checkout v7.0.1 to 3d3c42e5aac5ba805825da76410c181273ba90b1 and setup-node v7.1.0 to 949feb2413d6458794dcd2491c4babbbce0c15c1; both pinned actions use the Node 24 action runtime. [Checkout release](https://github.com/actions/checkout/releases/tag/v7.0.1), [Setup Node release](https://github.com/actions/setup-node/releases/tag/v7.1.0).

No source/workflow change, Git mutation, cloud call, package installation, parallel build, listener or browser run was performed by this reviewer. Only this report was authored and formatted.

## Assessment

No confirmed defect requiring correction.

The workflow uses ordinary push and pull_request events, without branch filters or pull_request_target. Its optional workflow_dispatch is accurately documented: manual availability requires the workflow on the default branch. Publishing this feature branch can be verified through push without changing the existing default branch. [GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

One standard windows-2025 hosted job matches the existing powershell.exe ZIP implementation and installed Chromium browser detection. GitHub's current image inventory lists Edge and Chrome. Node 24.21.0 and npm 11.19.0 are explicit pins matching the project's current local tools; npm is installed globally only in the disposable runner. npm ci uses the existing lockfile, and setup-node caches npm downloads against that lockfile rather than reusing node_modules. The hosted image and package download services can change, so actual hosted verification is still necessary. [Windows runner inventory](https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-Readme.md).

The token grants only contents: read, and checkout disables persisted credentials. There are no repository secrets, identity-token permissions, AWS authentication/operations, production URL probe, deployment command, larger runner or artifact-upload step. Ordinary npm dependency caching is configured; this is separate from uploading generated build/browser artifacts. The standard public-repository runner choice matches current GitHub free-compute guidance without changing repository/billing settings. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

CI=true and disabled Angular analytics make the intended checks noninteractive. The 30-minute job timeout bounds a stalled run. The concurrency key distinguishes event types and branch/pull-request identity, cancelling superseded runs without letting a feature-branch push cancel the separate pull-request run.

Commands are ordered correctly: pinned tools, locked install, lint, formatting, typechecks, all five workspace builds, server tests against that build, integration contracts, startup/cleanup tests, offline infrastructure validation, then complete offline package/browser tests. Each validation/test is a separate PowerShell step with normal failure propagation. No continue-on-error, success-forcing suffix or condition skips failed checks. The offline tests do not need AWS credentials or contact the public application; test-owned temporary listeners are part of the existing test lifecycle.

## Local evidence and hosted gate

Implementation report 031 records the exact local commands passing under the CI environment settings:

- Lint, formatting and five workspace typechecks/builds.
- Eight built-server tests, two integration tests and three startup/cleanup tests.
- Local infrastructure schema/Guard validation with zero errors/warnings and the existing 21 informational replacement notes.
- Nine complete offline AWS preparation tests, including real deterministic ZIP/extracted-handler checks and installed headless Edge loading the packaged federation with recovery/private-path assertions.

These are implementer results inspected by the reviewer; the broad suite was not repeated concurrently. The implementer deliberately preserved the shared local installation, so local npm ci and global npm replacement were not performed. This is correctly disclosed rather than described as a clean hosted install.

The workflow is suitable for the coordinator to commit/push and observe. A hosted run for that exact commit must still establish action execution, Node/npm setup, clean dependency installation, all validation/build/test steps and the final job conclusion. A successful local suite, YAML parse or accepted push is not hosted verification. Report or correct any concrete failure before marking stage 031 hosted-verified. No AWS deployment capability is approved or added by this CI-only stage.
