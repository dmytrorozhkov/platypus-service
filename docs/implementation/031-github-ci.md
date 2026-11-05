# Implementation 031 — GitHub Actions checks and builds

Date: November 5, 2026. Branch: feature/github-ci.
Status: implemented and locally verified; hosted execution remains pending coordinator publication and observation.

## Change and boundaries

The new .github/workflows/ci.yml runs the existing monorepo checks on ordinary push and pull_request events. It also declares workflow_dispatch; GitHub requires the workflow to exist on the default branch before manual dispatch becomes available. The current default branch remains planning/aws-first-deployment, so publishing this feature branch is verified through its push event. No default-branch or repository-setting change is part of this implementation.

One standard windows-2025 job uses pinned Node.js 24.21.0 and npm 11.19.0. Windows preserves the existing powershell.exe real-ZIP path and installed-Edge browser test path. The official checkout v7.0.1 and setup-node v7.1.0 actions are pinned to complete commit identifiers. npm is pinned only in the temporary hosted runner, followed by npm ci against the existing root lockfile; setup-node caches npm downloads using that lockfile. Neither local node_modules nor the lockfile was replaced.

The workflow grants only contents: read, disables persisted checkout credentials and uses no repository secrets, AWS credentials, identity-token permissions or deployment operation. The job has a 30-minute timeout. Concurrency cancels superseded runs for the same event and branch or pull request, while a push does not cancel a separate pull-request check. CI and disabled Angular analytics make commands noninteractive. There is no matrix, larger runner, artifact upload, production probe or persistent workspace server.

The sequence is lint, formatting, typechecking, all five workspace builds, tests against the built server, integration contracts, startup cleanup, local infrastructure validation and complete offline package/browser tests. aws:validate and test:aws are existing local commands: they do not authenticate to AWS or publish resources. Their generated validation reports and packages remain ignored local output; hosted evidence is available in workflow logs.

## Verification performed

The implementer read the task, plan, working rules, root/workspace commands, ZIP creation, installed browser detection, integration tests and startup cleanup before implementing. Local Node/npm versions matched the workflow pins. The existing Prettier YAML parser successfully parsed the workflow; full formatting verification also passed. Official action metadata confirms the selected inputs and Node 24 action runtime. No parser or action-validation dependency was added.

All following local commands exited successfully on Windows:

| Command                                       | Observed result                                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm.cmd run lint                              | No lint errors or warnings                                                                                                                                 |
| npm.cmd run format:check                      | All matched authored files formatted                                                                                                                       |
| npm.cmd run typecheck                         | All five application workspaces passed                                                                                                                     |
| npm.cmd run build                             | Server, Analytics, Administration, Support and Shell built                                                                                                 |
| npm.cmd run test --workspace @platypus/server | 8 tests passed against the preceding build                                                                                                                 |
| npm.cmd run test:integration                  | 2 tests passed                                                                                                                                             |
| npm.cmd run test:startup                      | 3 tests passed, including occupied-port ownership and shutdown cleanup                                                                                     |
| npm.cmd run aws:validate                      | Three templates and actual Guard negative control passed; no errors/warnings, 21 informational replacement notices                                         |
| npm.cmd run test:aws                          | 9 tests passed, including reproducible real ZIP/extracted Lambda handler and real packaged HTTP/headless Edge federation, recovery and private-path checks |

Typechecking, builds and tests used CI=true and NG_CLI_ANALYTICS=false. Temporary listeners belonged to existing tests and were cleaned up through those tests; no manual development or preview server was started. The startup suite's occupied-port message is expected evidence of its ownership guard, not an unhandled test failure.

npm ci and the global npm pin were deliberately not executed in the shared installed local worktree. A clean hosted install and actual GitHub workflow execution have not yet been observed by this implementer. The coordinator must publish the reviewed workflow, inspect the resulting push run and record its conclusion before claiming hosted verification. A local successful run does not prove that hosted dependency downloads, runner environment or browser execution will succeed.

## Usage and next boundary

After publication, open the repository Actions page, select CI and inspect the run for the pushed commit. Future pushes and pull requests containing this workflow trigger the same checks. There is no Deploy action in this stage, and the already running AWS application is unchanged. AWS delivery, temporary AWS identity and environment approval remain a separate stage.

## Official sources checked

- [Checkout v7.0.1 release](https://github.com/actions/checkout/releases/tag/v7.0.1) and [pinned action metadata](https://raw.githubusercontent.com/actions/checkout/3d3c42e5aac5ba805825da76410c181273ba90b1/action.yml).
- [Setup Node v7.1.0 release](https://github.com/actions/setup-node/releases/tag/v7.1.0) and [pinned action metadata](https://raw.githubusercontent.com/actions/setup-node/949feb2413d6458794dcd2491c4babbbce0c15c1/action.yml).
- [Windows Server 2025 runner software](https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-Readme.md), including installed Microsoft Edge. The runner image is maintained by GitHub and is not immutable; an actual hosted run remains the final compatibility check.
- [Playwright browser guidance](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge), covering installed branded browsers.
- [GitHub manual workflow dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), including the default-branch requirement.
