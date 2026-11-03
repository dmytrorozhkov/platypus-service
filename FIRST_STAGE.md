# First Implementation Stage — Local Microfrontend Integration

Status: implementation and local verification complete; independent review found no confirmed blocking defects. The user confirmed the application works. Follow-up quality tooling and shared styling are tracked separately as tasks 005 and 006. Implementation evidence: docs/implementation/003-frontend-foundation.md. Review: docs/reviews/004-independent-frontend-review.md.
Project directory: D:/Projects/Pet-projects/aws.
Requirement sources: PROJECT_PLAN.md and AGENTS.md.

## Goal

Verify a local Angular shell working with independent React and Vue applications. The result should provide a verified foundation for Platypus Service and the user's first practical experience of delegating work to agents.

## Browser outcome

- The Angular Platypus Service shell opens.
- The menu includes Analytics and Administration.
- Analytics opens a minimal React page with the English heading Analytics.
- Administration opens a minimal Vue page with the English heading Administration.
- The shell manages navigation between applications within one interface.
- This stage verifies technical integration. User roles, actual charts, and administration forms belong to later stages.

## Agent workflow

1. The coordinator checks stage approval, current project contents, and actual environment capabilities.
2. A researcher verifies stable Angular, React, and Vue versions, a compatible Node.js version, and integration options against official documentation.
3. An architect proposes a minimal monorepo structure and selects a compatible application integration approach. Record application mounting and cleanup behavior, route ownership, and shared configuration ownership.
4. An implementer prepares the shell and two minimal pages. If work is parallelized, the coordinator first defines independent change areas and a single owner of shared files.
5. An independent reviewer checks the result against the criteria below; the implementer fixes confirmed issues within this stage.
6. The coordinator demonstrates the result and explains delegation, changes, and verification to the user in Russian. Project artifacts and reports are written in English.

The profiles in this document describe responsibilities. Specific configurations and the subagent launch mechanism will be prepared within the approved stage, subject to the client's capabilities. Skills are not a prerequisite for the technical integration check.

## Scope

Included:

- Minimal monorepo structure and required local development configuration.
- Verification and documentation of selected versions and the integration approach.
- Local startup of Shell, Analytics, and Administration.
- Independent builds for the three applications and startup instructions.
- Necessary integration checks and an agent workflow report.

Later stages cover complete Support and Knowledge & AI applications, sign-in and permissions, ECharts charts, large tables, databases, model calls, RAG retrieval, Lambda, and AWS.

The user requested removal of the legacy app directory before implementation. Start from the planning documents and scaffold the new monorepo layout within this project. Preserve user changes and do not modify other projects.

Remote repository hosting, cloud resources, and paid connections are outside this stage. If the environment requires permission for an action, explain the actual reason. The first experiment uses npm workspaces, an Angular CLI Shell, and Vite-built React/Vue browser modules with an explicit mount/cleanup contract, as specified in docs/architecture/002-frontend-architecture.md. The bounded local development and production-build integration checks passed; see the implementation and review reports. Future production deployment is separate.

## Acceptance criteria

- Actual stable versions and compatibility are documented; dependencies can be installed reproducibly from saved files.
- Exact startup and build commands are documented and verified.
- Shell opens locally and loads React Analytics and Vue Administration as separate applications with their own builds.
- Navigation works, including repeated visits, direct links, and page refreshes.
- Navigation does not create duplicate pages or confirmed lifecycle errors; console and request errors are investigated and reported.
- Each of the three applications builds independently. Document how the shell obtains the applications' build addresses.
- The stage uses the new monorepo layout. Startup and verification instructions do not depend on the removed legacy app/server exercise.
- Necessary checks and independent review are completed. Issues and unverified behavior are explicitly listed.
- The user sees a working demonstration and receives an explanation of application boundaries and agent work.

The user accepts the stage after verification. Selecting a repository structure and approving the general coordinator workflow do not themselves authorize starting this stage.
