# Agent Working Rules — Platypus Service

## Sources and current phase

- Read PROJECT_PLAN.md, then read only the sections and files relevant to the task. Agreed decisions and proposals have different statuses in the plan.
- Native Federation migration 008 is implemented and locally verified; independent review 009 found no remaining migration blocker after a concurrency correction. The frontend, shared Tailwind theme, and quality tooling are preserved. See docs/implementation/008-native-federation.md and docs/reviews/009-native-federation-review.md. The user confirmed that the migrated application works. Local Git baseline checkpoint 010 is complete on main: initial commit 6d07da7 contains the reviewed foundation, and post-commit verification confirmed a clean worktree and no remotes. Review 011 found no blocking findings. Support ticket-list task 012 is implemented and locally verified: an independent Angular remote, 25 temporary fictional fixtures, NgRx SignalStore, loading/empty/error/retry states and safe asynchronous startup cleanup. Independent review 013 found no remaining confirmed blocker; see docs/implementation/012-support-ticket-list.md and docs/reviews/013-support-ticket-list-review.md. The reviewed stage uses feature/support-ticket-list for its intentional local Git checkpoint. User acceptance is pending. The final 100,000-ticket/server-querying and later Node.js/PostgreSQL requirements remain unchanged.
- Start implementing a stage after the user's explicit approval. Once approved, perform routine technical work within the stage autonomously, subject to the environment's actual permissions, without requesting approval for every routine action.
- Discuss substantial changes to agreed requirements and services that may create new charges separately. Approval of the AWS architecture does not authorize spending.
- Do not modify other projects, including D:/Projects/node-js. Preserve existing user changes.

## Language and communication

- Write all repository content in English: documentation, plans, agent instructions, skills, code comments, logs, interface text, examples, fixtures, knowledge base articles, sample tickets, AI assistant responses, and written project reports.
- Keep direct conversation with the user in Russian, using simple language and small steps. Explain new terms when first introduced. Discuss planning decisions in Russian and record them in English.
- Agents write the code. The user defines the scenario, approves a stage, and accepts its result after an explanation and demonstration.
- Report significant findings and problems. Distinguish prepared plans, written code, and behavior that has actually been verified.

## Coordination

- The coordinator defines a bounded task, required inputs, change boundaries, expected output, and acceptance checks.
- Default workflow: coordinator → implementer → independent reviewer → corrections → user demonstration.
- The 18 profiles in PROJECT_PLAN.md are available specializations. Select specialists for the task and respect actual runtime limits.
- Agreed research and documentation tasks are allowed during planning. Application implementation and implementation-agent launches require stage approval.
- Assign independent change areas to parallel implementers. Give one owner responsibility for shared configuration, dependencies, and integration.
- Define change and environment isolation before parallel execution. When using separate working directories, account for ports, configuration files, and test data.
- Give reviewers the original requirements, changes, and verification evidence. Findings must identify an actual problem, its impact, and a way to verify it.
- Implementers run the necessary checks themselves; independent review supplements these checks.
- Assess dependencies and work limits before dispatch. Escalate a recurring unresolved problem to the coordinator with its cause, attempted solutions, and a proposed next step.

## Implementation boundaries

- Use one monorepo. Microfrontends and the backend retain separate boundaries, builds, and independent deployment capability.
- Inspect git status before changes and preserve existing user work. Review git diff and the staged snapshot before committing intentional changes. Keep generated output, local evidence/backups, dependencies, and credentials out of version control; do not discard user changes or rewrite history without authorization.
- Angular: Shell, Support, Knowledge & AI. React: Analytics. Vue: Administration.
- Current integration uses generated Native Federation remoteEntry.json artifacts and the official orchestrator. Keep mount/cleanup and CSS lifecycle contracts. Current remotes have private dependencies, separate orchestrator storage namespaces and additive shim maps; revisit this isolation before enabling cross-remote shared dependencies. Do not restore the previous plain-import loader.
- Choose the latest stable, compatible Angular version when preparing the applications. Check current official sources and pin versions.
- Use NgRx SignalStore for Angular feature state. Each application manages its own state. Define exchange formats between applications explicitly.
- Use Tailwind with the CSS-only @platypus/theme workspace. Keep shared design values in packages/theme/tokens.css, compile styles per application, preserve sh:/an:/ad:/su: prefixes, and let Shell alone include Preflight. Standalone document styles must stay outside integrated remote output.
- Persistent data belongs on the server. Enforce roles, organization boundaries, private conversation ownership, and blocking status on the server, independently of button visibility.
- Agreed target architecture: Cognito for sign-in, PostgreSQL for core data and customer-support conversations, DynamoDB for private AI conversations.
- Introduce paid model calls and cloud resources after estimation and approval. Initially, prioritize local tools and prepared responses where possible.
- Do not request passwords, keys, or one-time codes in chat. Do not store secrets in tracked files.
- Choose technical details that are not fixed in the plan within the approved stage and explain the choice. Do not treat substantial requirement changes as implementation details.

## Verification and progress

- Use checks appropriate to the change. File generation or dependency installation alone does not establish completion.
- Run npm.cmd run lint and npm.cmd run format:check for authored changes; keep typechecking separate. Use npm.cmd run format to apply shared formatting. Keep generated output, dependencies, caches, local evidence and lockfiles outside formatter scope.
- Read actual project commands before running checks. Use meaningful checks supported by the current project; a default test placeholder is not an application test.
- The legacy app/server exercise was removed at the user's request during project preparation. PROJECT_PLAN.md retains its verified learning history. Determine current applications and startup commands from the actual project files.
- For integration changes, verify applications together, independent builds, and browser navigation. Report browser checks only when actually performed.
- When a check cannot be performed, state exactly what remains unverified and why.
- Update PROJECT_PLAN.md after agreed decisions. Record verified outcomes and actual startup commands after implementation. Keep proposals marked as proposals.
- Stage report: changes, startup instructions, checks performed, and remaining questions. Write the project report in English and explain the result to the user in Russian. The user accepts the demonstrated stage before the next stage is defined.
