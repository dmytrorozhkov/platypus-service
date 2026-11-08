# Platypus Service — Learning Project Plan

Updated: November 4, 2026.
Project directory: D:/Projects/Pet-projects/aws.
Current phase: user-approved first AWS deployment preparation 022/023 is in progress, followed by independent review 024. Authenticated MCP access is verified. Build and verify locally; cloud resource creation and paid usage remain separate stages.

This file is the primary source of agreed decisions. Proposals and open questions are not approved requirements. Mark work as completed only after verification.

## 1. Goal and learning format — agreed

Build a customer support center for the fictional company Platypus Service to learn Angular, Node.js, AWS, and AI engineering through practice.

Agents write the code. The user learns to describe requirements, assign tasks to agents, coordinate their work, review changes, and accept results. Direct conversation with the user remains in Russian, using simple language and small steps. Explain new terms and abbreviations when introducing them. All content saved in the project is in English, as specified in section 5.3.

The course covers:

- Development with coding agents.
- Orchestration: assigning tasks and coordinating the order of agent work.
- Building AI features within the application itself.
- RAG (Retrieval-Augmented Generation): finding relevant materials and using them to ground model responses.
- Quality evaluation, tool use, and troubleshooting.

Research, architecture, implementation, and local verification of the minimal frontend foundation are complete. Independent review found no confirmed blocking defects. The user subsequently confirmed the application works and approved quality tooling plus shared Tailwind styling.

## 2. Required technical scope — agreed

- Angular and microfrontends: interface areas that can be developed, built, and deployed independently.
- Multiple pages, charts, tables, and chats.
- Large tables that work with substantial data volumes.
- User sign-in, role-based access, and administration.
- A Node.js backend and AWS Lambda functions.
- SQL and NoSQL databases.
- Deployment to AWS.

Detailed implementation library and AWS service choices remain open; the agreed choices are recorded in the relevant sections below. Microfrontend boundaries and the Angular, React, and Vue allocation are agreed in section 5.6. This scope describes the complete project; the implementation sequence is determined separately.

## 3. Company and access boundaries — agreed

- Name: Platypus Service. The previous proposed name, Mayak Soft, is no longer used.
- One fictional company serves customers from multiple organizations.
- Each customer organization can have multiple users.
- Customers can view their organization's tickets.
- Tickets belonging to other customer organizations are inaccessible to them.
- Platypus Service support staff handle customer tickets.

## 4. Human application roles — agreed

| Role               | Capabilities                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer           | Creates tickets, views tickets belonging to their organization, and participates in conversations.                                            |
| Support specialist | Handles assigned tickets, replies to customers, changes ticket status, and uses AI Chat.                                                      |
| Support lead       | Views all tickets, assigns support specialists, views analytics, and uses AI Chat.                                                            |
| Administrator      | Manages users, organizations, roles, application settings, and knowledge base articles (section 5.2); uses AI Chat to evaluate the assistant. |

These are product user roles. Coding-agent roles are defined separately. A detailed action-level permissions matrix has not been prepared yet.

## 5. Main ticket workflow — agreed

1. A customer enters a subject and a description of the problem.
2. The ticket receives the New status.
3. A support lead assigns a support specialist.
4. The specialist moves the ticket to In progress and replies in the ticket conversation.
5. When clarification is needed, the specialist sets the status to Awaiting customer.
6. After the customer replies, the ticket returns to In progress.
7. When the issue is resolved, the specialist closes the ticket.
8. The customer can reopen the ticket if the problem remains.

Conversation history is persisted and available to participants after signing in again.

Agreed statuses: New, In progress, Awaiting customer, Closed.

Open details: status and assignee after reopening; reassignment rules; status-change permissions for support leads and customers; access to conversations in other tickets belonging to the same organization.

## 5.1. First AI assistant workflow — agreed

The assistant is available in the support specialist's workspace.

1. The specialist opens a ticket and selects Generate draft.
2. The assistant considers the ticket text and conversation history.
3. It searches for relevant materials in the Platypus Service knowledge base.
4. It presents a draft reply and links to the materials used.
5. The specialist reviews the text, edits it if necessary, and sends it to the customer.

If suitable materials are unavailable, the assistant states that it lacks sufficient information and suggests a clarifying question.

A human controls sending the reply to the customer. This is the first agreed RAG workflow: search documents and prepare an answer grounded in the results. Real model calls are introduced under the cost rules.

Automatic topic classification, conversation summaries, and more autonomous actions remain proposals for later stages.

Open questions: article format, detailed knowledge base permissions, and retrieval and answer quality checks. Agreed knowledge base rules are in section 5.2.

## 5.2. Initial knowledge base — agreed

- A shared internal Platypus Service knowledge base for support staff.
- Fictional articles covering account setup, access management, data imports, common errors, and troubleshooting.
- Agents will prepare the initial articles, after which the user and assistant will review their content. Article preparation has not started in the current phase.
- Administrators can add, edit, and publish articles.
- The AI assistant uses published articles only.
- Documents belonging to individual customer organizations may be added later; their stage and access rules have not been defined.

Open questions: article format, editing interface, draft access, updates to published articles, and content review criteria. The language is agreed in section 5.3.

## 5.3. Project and conversation languages — agreed

- All content stored in the project is in English: documentation, plans, agent instructions, skills, code comments, log messages, application text, examples, fixtures, knowledge base articles, sample tickets, AI assistant responses, and written project reports.
- Direct conversation with the user, explanations, and interactive course discussions remain in Russian.
- Project planning documents are written in English even when the decisions are discussed with the user in Russian.
- Language switching in the application may be considered as a separate later stage; it is not currently approved for implementation.

## 5.4. Dedicated AI Chat — core rules agreed

- A dedicated AI Chat page supports free-form questions to the assistant.
- This feature supplements customer-support conversations within tickets and the draft-generation workflow in section 5.1.
- The interface and assistant responses are in English, following section 5.3.
- Initial AI Chat access is available to support specialists, support leads, and administrators.
- Administrators can use AI Chat to evaluate assistant answers and the published knowledge base.
- Customer access to AI Chat is not approved for the initial stage.
- Knowledge base retrieval follows section 5.2: the assistant uses published articles only.
- Initially, AI Chat answers from the published knowledge base, shows source links, and asks clarifying questions.
- When information is insufficient, the assistant explicitly says so.
- Finding individual tickets, changing statuses, and other tool-driven actions belong to later stages. They are outside the initial AI Chat scope. The separate ticket draft-generation workflow in section 5.1 remains agreed.
- Users can create separate AI conversations and return to them after signing in again; history is persisted.
- The AI Chat interface shows the conversation list on the left and the selected conversation on the right.
- The assistant considers previous messages in the current conversation and interprets follow-up questions in that context.
- Each user can view their own AI conversations only. This rule also applies to administrators.
- Administrators evaluate the assistant through their own questions. A separate quality evaluation dashboard has not been approved.
- Access to AI Chat does not itself grant additional permissions to internal articles or other organizations' tickets. Data remains subject to the agreed access boundaries.

The layout of the ticket description, conversation, and draft panel on Ticket details remains a proposal. The agreed AI Chat layout is described above.

## 5.5. Pages — agreed

| Page           | Purpose                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Sign in        | User sign-in.                                                                                                             |
| Tickets        | Ticket table with access determined by role and organization.                                                             |
| New ticket     | Customer ticket creation.                                                                                                 |
| Ticket details | Ticket description, status, and customer-support conversation; AI-assisted reply preparation for support specialists.     |
| AI Chat        | Private assistant conversations for support specialists, support leads, and administrators; rules are in section 5.4.     |
| Knowledge base | Article reading for support specialists and support leads; article creation, editing, and publication for administrators. |
| Analytics      | Support charts and metrics for support leads.                                                                             |
| Administration | Management of organizations, users, roles, and settings.                                                                  |

All eight pages are agreed. Access to pages and actions is determined by user role and organization boundaries. Microfrontend boundaries are agreed in section 5.6; the implementation order will be determined separately.

## 5.6. Microfrontends — boundaries and technologies agreed

A shared shell and four microfrontends are agreed:

- Shell: sign-in, shared menu, navigation, and loading the other applications.
- Support: Tickets, New ticket, and Ticket details, including conversations and AI-assisted reply preparation.
- Knowledge & AI: the knowledge base and dedicated AI Chat.
- Analytics: support charts and metrics.
- Administration: organizations, users, roles, and settings.

The user requested one Vue application and one React application while keeping the core on the latest Angular. The single-spa documentation confirms that mixed-framework microfrontends are possible; compatibility between the selected integration approach and versions must be verified before implementation.

Agreed technology allocation:

| Application    | Technology |
| -------------- | ---------- |
| Shell          | Angular    |
| Support        | Angular    |
| Knowledge & AI | Angular    |
| Analytics      | React      |
| Administration | Vue        |

Use the latest stable Angular version available at the start of implementation. The official release page checked on November 3, 2026 listed Angular 22 as the current major release family. Verify and pin the exact version and compatibility with Node.js, the build tools, and the integration mechanism when preparing the project. Prerelease versions have not been selected.

The shared shell combines the applications into one interface. Each application has its own build and can be deployed independently. Repository organization is agreed in section 5.18; automation details remain open.

For the mixed-framework setup, shared colors, typography, spacing, and component guidelines have been proposed. An Angular component library alone cannot serve as the common component library for all three frameworks. Choose the specific component, shared-function, navigation, and communication approach after a small compatibility check. Current integration uses Native Federation after task 008, with its generated metadata and official host orchestrator. The mounting/cleanup contract remains explicit. Historically, task 002 selected plain runtime-loaded browser modules for the first experiment. See docs/architecture/002-frontend-architecture.md. The selected design passed bounded local integration checks in task 003; it is not a final production architecture decision. Single-spa remains an alternative if later requirements justify reevaluation.

Verification sources:

- https://angular.dev/reference/releases
- https://single-spa.js.org/docs/microfrontends-concept/

## 5.7. State management — agreed

NgRx SignalStore is agreed for feature state management within the Angular applications.

Use NgRx SignalStore for feature areas in the Angular applications. Classic NgRx Store with actions, reducers, and effects is not mandatory at the start. The official NgRx documentation describes both approaches; SignalStore can be provided at component, route, or application scope.

State examples:

- Support: filters, sorting, the current table page, selected tickets, loaded data, and request status.
- Knowledge & AI: articles and conversations, the selected conversation, displayed messages, and reply-generation progress.
- Shell: minimal current-user and navigation data; choose its storage and exchange mechanisms together with the integration approach.

Agreed boundaries: each application manages its own state. Microfrontends exchange information through explicitly defined functions or events and use agreed server requests. A single NgRx Store shared across Angular, React, and Vue is not proposed. React and Vue will use their own solutions as needed; specific libraries have not been selected.

Data that must persist between sign-ins is stored on the server. Client state supports display and interaction and does not replace server-side access checks. Large tables load data in pages; a large dataset does not require loading every record into browser state. Dataset size and main operations are agreed in section 5.8; numerical performance targets and detailed behavior remain open.

Sources:

- https://ngrx.io/guide/store/why
- https://ngrx.io/guide/signals/signal-store

## 5.8. Large ticket table — agreed

- Use 100,000 fictional tickets in the shared learning dataset to test substantial data volumes. The deterministic generator and exact100000-row disposable PostgreSQL dataset are implemented and hosted-verified in064-069; learner-local large database setup and initial visible rendering are now demonstrated in070.
- Columns: ticket number, subject, organization, status, assignee, creation date, and last update date.
- Search by ticket number and subject.
- Filters by status, organization, assignee, and dates.
- Page sizes of 25, 50, or 100 records.
- Search, filtering, and sorting run on the server; the browser loads the required page.
- Users can resize, reorder, and hide columns.
- Support leads can select multiple tickets and assign a support specialist.
- Queries and bulk actions respect role permissions and organization boundaries. Customers cannot access another organization's data through filters, search, or direct requests.
- Measure performance on a specified computer and dataset. Numerical thresholds, measurement conditions, and performance acceptance criteria have not been selected.

Open details: sortable fields and sorting rules, exact search and date-filter behavior, persistence of table preferences, selection across pages, and bulk-assignment error handling. A table library has not been selected; prioritize free resources.

## 5.9. Support lead analytics — metrics agreed

Implement this area in the React Analytics microfrontend.

Four metrics are agreed:

1. New tickets by day: incoming ticket counts.
2. Tickets by status: current counts of New, In progress, Awaiting customer, and Closed tickets.
3. Staff workload: assigned, non-closed tickets per specialist; show unassigned tickets separately.
4. Average first-response time: elapsed time from ticket creation to the first support specialist message. Include tickets that have received a reply; show the number of unanswered tickets separately.

Period and organization selection are agreed. The server calculates metrics across the entire matching dataset, subject to access permissions.

Open questions: precise period semantics for each metric, timezone and day boundaries, time units and rounding, empty dataset behavior, and calculation verification criteria. Define formulas and time boundaries before implementation.

## 5.10. Chart library and presentation — agreed

Apache ECharts is selected: a free, open-source library under Apache License 2.0. Dependencies have not been installed yet.

Agreed presentation:

- New tickets by day: line chart.
- Tickets by status: bar chart.
- Staff workload: horizontal bar chart, with unassigned tickets displayed separately.
- Average first-response time: a numeric metric card, with unanswered ticket count nearby.

Agreed data flow: Node.js calculates metrics and returns aggregate data; React receives it and passes it to a chart component; ECharts renders the visualization. For example, a monthly chart receives daily counts rather than all 100,000 tickets.

Implementation must handle filter-driven data updates, container resizing, and resource cleanup when leaving the page. Choosing a React wrapper or direct ECharts integration, pinning versions, and checking compatibility are technical decisions for the next stage.

Verification sources:

- https://echarts.apache.org/en/faq.html
- https://echarts.apache.org/handbook/en/get-started/
- https://echarts.apache.org/handbook/en/concepts/chart-size/

## 5.11. Invitations and access provisioning — agreed

1. An administrator creates a customer organization.
2. The administrator specifies the user's email, organization, and role.
3. The user receives an invitation, sets a password, and signs in.
4. The administrator invites support specialists and support leads separately.
5. The administrator can block a user while preserving their ticket and message history.

The administrator assigns customer organization membership and roles. Users do not select them when signing in. The initial approach uses invitations; public self-registration is outside the selected scope.

Open details: provisioning the first administrator, invitation expiry and resend behavior, account recovery, blocking active sessions, and synchronizing the sign-in service with the application database.

## 5.12. Identity and permission storage — AWS target architecture agreed

Agreed AWS target architecture: Amazon Cognito for sign-in and PostgreSQL for application profiles and permissions.

- Amazon Cognito manages sign-in accounts, password verification, and account recovery. Do not store password copies in the application database.
- PostgreSQL stores profiles, roles, customer organization membership, blocking status, and the identifier linking a profile to its Cognito account. A PostgreSQL hosting service has not been selected.
- Application data determines permissions within Platypus Service. Node.js validates authentication evidence and current permissions, organization, and user status for every protected request.
- Shell page visibility reflects permitted actions; the server makes the final access decision.

Amazon Cognito and PostgreSQL are agreed as target choices for AWS. Architecture approval does not authorize spending or cloud resource creation. Cognito, databases, and other cloud resources have not been created under this plan. Check free-use conditions and potential charges before connecting services. The authentication approach for initial local development has not been selected.

Cognito capability verification sources:

- https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html
- https://docs.aws.amazon.com/cognito/latest/developerguide/how-to-create-user-accounts.html

## 5.13. SQL and NoSQL data allocation — agreed

Agreed data allocation:

| Storage                 | Data                                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL (SQL)        | Organizations, user profiles and roles (already agreed in section 5.12), tickets, assignments, status history, customer-support messages within tickets, knowledge base articles, and publication metadata. |
| Amazon DynamoDB (NoSQL) | Private AI conversations, their messages, and links to the sources used.                                                                                                                                    |

Rationale: tickets, assignments, support conversations, and first-response metrics are related and remain together in SQL storage. The main AI Chat queries are known: retrieve the owner's conversations and retrieve an individual conversation's messages in order. This provides a separate area for learning NoSQL.

The personal access rule from section 5.4 remains in effect: the server checks AI conversation ownership, role, and user blocking status. PostgreSQL determines application permissions, while Cognito handles sign-in. Client microfrontends access data through the server.

For initial development, DynamoDB can run locally through DynamoDB Local without accessing the cloud service. Installation and the exact startup approach have not been selected. Connect cloud DynamoDB only after checking terms and costs.

The knowledge base search index, file storage, key and table schemas, article update rules, and other data details will be defined separately.

Verification sources:

- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html
- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html

## 5.14. Main backend and Lambda — three Lambda tasks agreed

The main Node.js application serves application requests: authentication and authorization checks, tickets, support conversations, PostgreSQL and DynamoDB access, private AI conversations, analytics calculations, tables, article management, and AI response preparation. Technical module boundaries remain open.

The user selected three Lambda tasks:

### 1. Prepare articles for RAG

- Run after an article is published or a published article changes.
- Split content into fragments and update the search index: the structure used to find relevant materials.
- Notify the application when materials are ready for retrieval.
- The event mechanism, processing statuses, updates, and exclusion of outdated or unpublished versions still need to be designed.

### 2. Export the large table

- A support lead requests an export using the selected filters.
- The function prepares a file in the background, respecting access permissions.
- After completion, the user receives a download link.
- File format, file storage, availability period, job status presentation, export content rules, and retry behavior have not been selected.

### 3. Evaluate AI quality after knowledge base changes

- After a knowledge base change and preparation of its corresponding search index, run a set of evaluation questions.
- Produce a report on retrieved sources and detected retrieval or answer errors.
- Evaluation questions, expected results, evaluation method, quality thresholds, report access, and failure handling have not been defined.
- Real model calls follow the cost rules; initially, evaluations can use prepared responses.

All three tasks belong to future implementation. Functions and cloud resources have not been created. Attachment processing, reminders, automatic topic classification, and daily summaries were discussed as alternatives and are outside the currently selected set.

Lambda functions can also run on Node.js. Choose the main backend hosting service separately after assessing terms and costs. Background jobs can run locally during the local development stage.

Design the event mechanism, error handling, and safe behavior when the same job is received again. A retry must not duplicate results or trigger uncontrolled repeated paid calls.

Sources:

- https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html
- https://docs.aws.amazon.com/lambda/latest/dg/welcome.html
- https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-error-handling.html

## 5.15. Coding agents — expandable catalogue for discussion

The researcher completed task 001 and the architect completed task 002. The initial integrator completed task 003; independent review task 004 is complete with no confirmed blocking defects. Assignments and results are saved under docs/. No persistent agent launch configuration has been created.

Proposed project profiles:

| Profile                  | Responsibility                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Coordinator              | Breaks down work, assigns tasks, tracks dependencies, and integrates results.                 |
| Requirements analyst     | Clarifies user workflows, constraints, and acceptance criteria.                               |
| Architect                | Defines application boundaries, data relationships, and interaction contracts.                |
| Documentation researcher | Verifies capabilities, versions, compatibility, and usage conditions against primary sources. |
| Interface designer       | Defines screen structure, interface states, and shared visual guidelines.                     |
| Angular developer        | Implements Shell, Support, and Knowledge & AI.                                                |
| React developer          | Implements Analytics.                                                                         |
| Vue developer            | Implements Administration.                                                                    |
| Node.js developer        | Implements the main backend and background functions.                                         |
| Data specialist          | Designs PostgreSQL and DynamoDB models, queries, and schema changes.                          |
| RAG specialist           | Designs article preparation, retrieval, and grounded response generation.                     |
| AI quality specialist    | Defines evaluation questions, expected sources, and answer evaluation.                        |
| AWS specialist           | Prepares deployment, configuration, monitoring, recovery, and cost estimates.                 |
| Test specialist          | Verifies user workflows, errors, and application integration.                                 |
| Code reviewer            | Independently reviews changes and requirement compliance.                                     |
| Security specialist      | Reviews permissions, organization isolation, private conversations, sign-in, and tool access. |
| Performance specialist   | Measures table, query, and chart performance and investigates bottlenecks.                    |
| Documentation author     | Updates startup instructions, decision records, and verified progress.                        |

This is a proposed catalogue of 18 profiles, not a requirement to run 18 agents continuously. Each profile still needs defined input materials, responsibility boundaries, permitted tools and files, expected output, and verification criteria.

Profile count and concurrent task count are separate. The current session supports up to four active agents including the primary agent; this is a session constraint, not a universal project limit. The plan does not change runtime capabilities or spending limits.

Agreed initial workflow: coordinator, implementer, and independent reviewer; engage additional specialists for suitable tasks. Requirements analysis, architecture, and research are most relevant during planning. Parallel tasks receive independent change areas; shared-file ownership and integration order must be defined beforehand.

Sources:

- https://developers.openai.com/api/docs/guides/agents/orchestration
- https://learn.chatgpt.com/docs/agent-configuration/subagents

## 5.16. Skills and persistent instructions — proposal for discussion

A skill is a reusable instruction set for a particular workflow. It is usually a directory containing SKILL.md and, when useful, examples, references, or scripts. Agents can use relevant skills across tasks. A skill alone does not grant tools or permissions.

Distinguish:

- Agent role: responsibility within a task.
- Skill: a repeatable procedure for performing a particular kind of work.
- AGENTS.md: persistent project rules and links to agreed requirements.
- Tool: a concrete capability to read files, run checks, use a browser, or interact with an external service.

Shared rules are recorded in AGENTS.md. One initial feature-planning skill is under consideration: read requirements, identify open questions, formulate verifiable outcomes, and split implementation into bounded tasks. Keep unresolved decisions marked as proposals.

Candidates for later stages:

- Change review: requirements, actual defects, access permissions, and verification results.
- RAG evaluation: questions, sources, insufficient-evidence responses, and a report.
- AWS deployment: an agreed plan, cost estimate, health checks, and recovery.

These remain candidates. Shared rules have been created in AGENTS.md. Project skills and agent launch configurations have not been created. Package repeatable procedures after their content is defined; assess third-party skills against the task and their contents.

Sources:

- https://learn.chatgpt.com/docs/build-skills
- https://learn.chatgpt.com/docs/customization/overview

## 5.17. Coordinator autonomy — agreed

1. The user and coordinator agree on a small learning stage and its expected outcome.
2. Within that stage, the coordinator independently selects suitable agents, assigns tasks, and organizes verification.
3. Implementers and an independent reviewer resolve findings within the agreed stage.
4. The coordinator demonstrates the result and explains changes, verification, and behavior to the user in Russian. Written project artifacts and reports remain in English.
5. The user accepts the stage, after which the next stage is defined.

Discuss substantial changes to agreed requirements and paid resource connections separately. The user approved the first compatibility research assignment after discussing FIRST_STAGE.md. Review findings before application implementation. Technical limits on runs, correction cycles, and stop conditions for unresolved problems remain open.

## 5.18. Repository organization — agreed

The user wants to choose a repository structure and experiment with different approaches.

Initially, use one Git repository (a monorepo) containing separate Shell, Support, Knowledge & AI, Analytics, and Administration applications, the backend, Lambda functions, shared materials, and documentation.

Each application retains separate boundaries, builds, checks, and independent deployment capability. Explicitly define request, response, and event formats between applications. One repository enables related changes to be made and verified together.

Alternatives for comparison:

- Two repositories: all frontend applications separate from the backend.
- One repository for each application or service.

Agreed learning path: first create a working scenario in the monorepo and deploy applications independently; then perform a separate exercise extracting React Analytics into another repository. Define the exercise details and timing later.

Parallel development in one repository can use separate Git branches and working directories (worktrees). The coordinator owns change boundaries, shared files, integration, and combined verification. Use npm workspaces for the first experiment and one initial integrator to own shared files. Parallel working-directory isolation and any later monorepo task framework remain separate decisions.

The local Git repository is initialized on main. Checkpoint 010 saved initial commit 6d07da7 with 78 reviewed authored files, including the root lockfile and final review/task records. The coordinator verified the actual commit, main branch, clean worktree, and absence of remotes before recording completion. The existing npm workspace layout is the monorepo source tree. Choose a remote hosting platform separately.

Sources:

- https://nx.dev/docs/kb/what-is-a-monorepo
- https://nx.dev/docs/guides/nx-release/release-projects-independently
- https://git-scm.com/docs/git-worktree

## 5.19. Preparing the first agent assignment

Shared rules are in AGENTS.md, and FIRST_STAGE.md records the first local integration stage: a local Angular shell that loads minimal React Analytics and Vue Administration applications, with independent builds and verified navigation.

Stage status: tasks 001-004 complete, including implementation, bounded local runtime verification, and independent review. The user subsequently confirmed the application works. Assignment: docs/agent-tasks/001-frontend-compatibility.md. Report: docs/research/001-frontend-compatibility.md. The research proposed npm workspaces, Angular CLI, Vite, and runtime browser modules; task 002 subsequently selected that design for the first experiment, and task 003 verified it in local development and built-Shell browser checks. Exact candidate versions and source evidence are in the report. Angular requires a compatible TypeScript range, so selecting the latest version of every dependency independently is unsuitable. These documents are instructions and evidence, not executable agent configurations or skills.

Before implementation, the user requested removal of the old app directory and its contents. The legacy learning server and dependencies were removed, and AGENTS.md and FIRST_STAGE.md were updated to start from the planning documents. No implementation agents were launched as part of this cleanup.

The user approved architecture task 002 after receiving the research summary. Assignment: docs/agent-tasks/002-frontend-architecture.md. Completed design: docs/architecture/002-frontend-architecture.md. The coordinator selected npm workspaces, Angular CLI inside apps/shell, Vite-built React Analytics and Vue Administration, and a versioned runtime module mounting contract for the first experiment. Angular owns navigation; application builds remain independent. The plan defines ports, styles, cleanup, failures, and acceptance checks. Task 002 itself performed no scaffolding, installation, or runtime verification; those results are recorded under task 003.

The user approved implementation task 003 after receiving the architecture summary. Assignment: docs/agent-tasks/003-frontend-foundation.md. One integrator owns the scaffold and shared configuration; an independent reviewer checks the result before the coordinator presents it. Backend, product features, paid services, and cloud deployment remain outside this stage.

### Verified implementation outcome — tasks 003 and 004

- Sources now exist in apps/shell (Angular), apps/analytics (React), apps/administration (Vue), packages/mfe-contract, and scripts/. One root manifest and lockfile manage dependencies.
- README.md records actual startup: after npm.cmd ci and npm.cmd run build, use npm.cmd start and open http://localhost:4200. Ctrl+C stops the integrated workspace. Do not start a second copy while its reserved ports are occupied.
- Verified installation, all three independent builds and typechecks, two hosting/contract tests, 13 built-Shell browser scenario groups, and 14 development-Shell groups including standalone pages.
- Verified an Analytics-only rebuild updates content through Shell while Shell and Administration artifact hashes remain unchanged; the test modification was restored.
- Browser checks include history, direct links, refresh, route cancellation, stylesheet cleanup, controlled failures and recovery. The unavailable-module case used an intercepted failed request, as disclosed in the report.
- Verified occupied-port failure and Ctrl+C cleanup. The coordinator independently checked local HTTP responses and inspected a generated screenshot.
- Implementation report: docs/implementation/003-frontend-foundation.md. Independent review: docs/reviews/004-independent-frontend-review.md. The reviewer inspected source, artifacts, lockfile consistency and evidence, without rerunning the integrator's entire suite.
- No confirmed blocking defects remain within this minimal stage. The user subsequently confirmed the application works. No backend, sign-in, business features, cloud resources, remote repository, or paid application connections were added.

## 5.20. Quality tooling and shared styling — implemented and verified

The user confirmed the frontend works and requested a linter and Prettier. Task 005 adds a shared ESLint configuration covering Angular templates/code, React, Vue, TypeScript and local scripts, plus Prettier and root commands. The implementation agent verifies compatible exact tool versions and meaningful coverage.

After discussing the existing custom CSS, the user explicitly selected Tailwind with a shared theme. Task 006 integrates shared colors, spacing and sizing across Angular, React and Vue while preserving independent builds, controlling utility collisions, and giving Shell ownership of global resets. Tasks run sequentially to avoid conflicts in dependencies, configuration and formatted source; one independent review follows.

Tasks 005 and 006 retained runtime-loaded standard browser modules with explicit mounting and cleanup. The user subsequently approved a separate Native Federation migration in task 008; its progress and evidence are tracked separately below.

Assignments: docs/agent-tasks/005-code-quality-tooling.md and docs/agent-tasks/006-tailwind-shared-theme.md. Both tasks are implemented and locally verified. Reports: docs/implementation/005-code-quality-tooling.md and docs/implementation/006-tailwind-shared-theme.md. Independent review 007 found no confirmed blocking defects; see docs/reviews/007-quality-and-theme-review.md.

Verified outcomes:

- Root commands: npm.cmd run lint, lint:fix, format, and format:check. ESLint covers JavaScript/TypeScript, Angular code and inline/external templates, React TSX and Hooks, and Vue scripts/templates. Prettier handles source, styles, templates, configuration and documentation. Type-aware ESLint and the classic React recommended preset are not enabled; application typechecks remain separate.
- Shared theme: packages/theme/tokens.css, exposed by the CSS-only @platypus/theme workspace. Angular uses the Tailwind PostCSS integration; React and Vue use Vite integration. Tailwind packages are pinned to 4.3.4. Actual application layout/cards now use utilities.
- All applications compile independent CSS with sh:/an:/ad: prefixes and application-local source scanning. Shell alone imports Preflight. A separate standalone baseline does not enter integrated remote output. Some custom selectors remain for icons and Shell-specific views.
- Lint with zero warnings, formatting checks, three production builds/typechecks, and two existing integration tests passed. The quality agent also used invalid examples to establish framework rule coverage.
- Real headless Edge checks passed 15 groups against development Shell and again against built Shell, including standalone pages, computed theme styles, unchanged Shell layout across routes, normal navigation, lifecycle cleanup and controlled failures.
- An Analytics-only rebuild updated content without changing Shell or Administration artifacts; the original source was restored and rebuilt. The coordinator independently checked HTTP responses and visually inspected the resulting screenshot.
- Shared-token changes require rebuilding each affected application. Prefixes and CSS conventions do not provide complete DOM isolation. The user subsequently confirmed the application works after the Native Federation migration, preserving this styling/tooling baseline; task 006 itself added no federation migration, product features, paid resources, or cloud deployment.

## 5.21. Native Federation migration — implemented and verified

The user requested applying Native Federation. Task 008 replaced the custom module loader with actual Native Federation tooling, preserving Angular/React/Vue allocation, independent builds, Tailwind/shared theme, routes, mounting cleanup, controlled error behavior, and quality checks. Work started November 3 and completed November 4, 2026.

Selected exact tooling: native-federation-vite 0.2.0, official @softarc/native-federation 4.8.1, official @softarc/native-federation-orchestrator 4.9.0, and es-module-shims 2.8.4. The Vite adapter is an early community release with compatible declared peers; the core generates real v4 remoteEntry.json files exposing ./mount. Angular uses the official host loader without an Angular federation builder because it exposes/shares no Angular modules. Framework versions are unchanged. Node requirements are now ^24.16.0 || >=26.0.0; the installed 24.21.0 fits.

Each remote deliberately uses shared: {} and an isolated official orchestrator namespace with additive shim import maps. This resolved a reproduced concurrent-registration rollback defect without serializing slow network requests. The reviewer observed 8 failures in 45 shared-runtime schedules and zero in the corresponding isolated-runtime schedules; real browser regressions also passed. Cross-remote dependency version negotiation is not enabled and requires a later design review before shared Angular runtimes are added.

Assignment: docs/agent-tasks/008-native-federation.md. Implementation: docs/implementation/008-native-federation.md. Independent review: docs/reviews/009-native-federation-review.md; no migration blocker remains.

Verified: three independent builds/typechecks, lint, hosting/contract tests, and 18 real Edge browser groups in both development and built-Shell modes, including standalone pages. Browser evidence confirms actual generated metadata/modules and the official loader, preserved styles/lifecycle, metadata retry, and failure isolation. An Analytics-only federation rebuild appeared through Shell without changing Shell/Administration artifacts; the source was restored. The coordinator separately checked HTTP metadata and exposed modules.

Commands remain npm.cmd ci, npm.cmd run build, and npm.cmd start; open http://localhost:4200. Metadata registration failures support Retry; changed registered URLs or cached module corrections can require Reload. A local ignored rollback snapshot with 67 files and hashes is retained under .local/backups/008-native-federation-20261103-234745. No vendor patch, framework downgrade, paid resource, business feature, or cloud deployment was added. Older reports remain historical records. The user subsequently confirmed that the migrated application works.

## 5.22. First Support ticket list — implemented and locally verified

The user approved task 012 after confirming that the 25 local records are temporary examples and that later data comes through Node.js from PostgreSQL. The independent Angular Support application now opens through Tickets at /support/tickets, preserving the Analytics root redirect and existing React/Vue routes. It displays all seven agreed columns, the four statuses, Unassigned, and dates labelled UTC (Coordinated Universal Time). Shared Tailwind utilities use the su: prefix without remote Preflight.

Support uses component-scoped NgRx SignalStore and a small asynchronous TicketData adapter fetching validated fictional JSON. Loading, empty, error and Retry states are implemented. Store destruction aborts the active request; late results cannot replace state. The synchronous mounting handle safely disposes an Angular application created after navigation cancellation. These behaviors were exercised in a real browser.

Maintained @angular-architects/native-federation 22.2.4 and @ngrx/signals 22.0.1 were added after compatibility checks. Angular 22.2.4, CLI/build 22.2.5 and TypeScript 6.0.3 are preserved. The builder emits real federation v4 metadata with ./mount and private dependencies; the existing isolated host namespaces and additive import maps remain. Independent review identified a built standalone module-script issue, corrected using the builder's public configuration and verified in the built standalone browser run.

Verified: four application builds/typechecks, lint with zero warnings, formatting, both hosting/contract tests, 24 development-Shell browser scenario groups, 26 built-Shell/standalone groups, and a further 26-group source-Support-standalone variant. Browser checks cover all rows/columns, direct links, refresh, repeated navigation/history, states and recovery, cancelled requests, late startup destruction, theme and contained mobile table overflow. Analytics-only and Support-only modifications appeared through Shell after their own rebuilds while the other three build-directory hashes stayed unchanged; original sources were restored and rebuilt. Temporary standalone servers were stopped, leaving one integrated development stack. The coordinator separately checked HTTP metadata/fixtures and visually inspected desktop/mobile screenshots.

This first read-only view does not choose the final heavy-table library or add query controls, backend, authentication, databases, ticket details, or AI. The complete agreed table retains server-side querying/access checks, page sizes of 25/50/100, and the 100,000-record learning dataset. Local fixtures are a temporary development source. Existing development-tool audit findings remain documented in the implementation report; this stage adds no paid/cloud resource.

Commands remain npm.cmd ci, npm.cmd run build, and npm.cmd start; open http://localhost:4200/support/tickets. Support can also build and run independently. Work is on feature/support-ticket-list, preserving the main baseline. Assignment: docs/agent-tasks/012-support-ticket-list.md. Implementation: docs/implementation/012-support-ticket-list.md. Independent review task: docs/agent-tasks/013-support-ticket-list-review.md. Independent review 013 found no remaining confirmed blocker; see docs/reviews/013-support-ticket-list-review.md. The reviewed stage was saved in commit 9163b2d; post-commit checks confirmed a clean worktree and responding local services. The user subsequently confirmed that Tickets opens and displays the table, accepting the visible slice. This confirmation does not claim that the user personally exercised every automated test scenario. The next implementation stage is not yet approved.

## 5.23. Local ticket server — implemented and locally verified

The user approved task 014 after reviewing its prepared contract. The independent apps/server workspace now compiles TypeScript and runs Node's built-in HTTP server. GET /api/health returns status ok; GET /api/tickets returns the unchanged 25 fictional records with items and total. Unknown paths, methods and internal failures have consistent JSON errors. No runtime server framework was added; the only new dependency graph entries are the server workspace/link and its private Node 24 development types.

The authoritative fixture moved from Support's public assets to the server repository boundary. Support now loads deployment-relative server configuration, requests and validates the response, and retains SignalStore loading/empty/error/Retry behavior. The same cancellation signal covers configuration and data requests. No frontend fixture fallback remains. PostgreSQL can later replace the server repository; this first contract is unpaged and requires total to equal the returned collection length.

Integrated start/preview owns the API child and frontend listeners. An occupied API port fails without killing its owner. An API exit after startup leaves frontends available for error/Retry recovery. A separately restarted API belongs to its own terminal. Independent review identified a shutdown-during-startup race; guarded listener acquisition and a real-listener regression test corrected it.

Verified: five workspace builds/typechecks, zero-warning lint, formatting, three Node HTTP tests, three startup/lifecycle tests and both existing hosting/contract tests. Real Edge checks passed 25 development-Shell groups, 27 built-Shell/standalone groups and a focused Support source-standalone API check. Actual API stop/restart recovers through Retry; cancellation, prior federation/Angular lifecycle checks and shared styling remain passing. Independent server startup returned health and ticket data without frontend processes. Actual TCP connection probes established that owned Ctrl+C shutdown closed all checked ports before a fresh integrated development stack was retained. The coordinator separately verified HTTP responses and inspected desktop/mobile screenshots.

Commands: npm.cmd ci, npm.cmd run build, npm.cmd start; open http://localhost:4200/support/tickets. Default API: http://localhost:3000. Independent server: npm.cmd run build --workspace @platypus/server, then npm.cmd run start:server. README records address/origin configuration and process ownership. The server still uses public fictional learning data; persistence, identity/access checks, server querying, the 100,000-record dataset, cloud and paid resources remain later work.

Work uses feature/local-ticket-server. Assignment: docs/agent-tasks/014-local-ticket-server.md. Implementation: docs/implementation/014-local-ticket-server.md. Independent review: docs/reviews/015-local-ticket-server-review.md; no remaining confirmed blocker. The reviewed stage was saved in commit 5532511; the coordinator verified a clean worktree afterward. The user subsequently confirmed the /api/tickets response is present, accepting the demonstrated slice. This confirmation does not claim the user personally executed every automated recovery or shutdown check.

## 5.24. Parallel PostgreSQL planning — complete; recommendations await setup approval

The user requested several agents in parallel. Data specialist postgres_data_design owned schema/migration/seed/repository planning (016); environment specialist postgres_environment owned read-only Windows inventory and local launch research (017). Each authored a separate staged report and coordinated connection assumptions. Only the coordinator edited shared tracked planning files. Reviewer frontend_review subsequently inspected both proposals and primary sources under task 018, finding no blocking inconsistency. This phase produced documents, not installed software or an implemented database integration.

Consolidated recommendations:

- Start with organizations, a fictional support_agents directory and tickets, plus small schema/seed ledgers. Internal stable identifiers remain outside the existing seven-field response. Directory entries are not human application accounts or permissions. Preserve all 25 examples, four statuses, null assignments, explicit ordering and timestamp instants. The unpaged response retains total = items.length.
- Apply explicit versioned migrations and a deterministic seed with transactions, bounded setup locking and immutable input checksums. An already recorded unchanged seed does not overwrite later edits or deletions. Ordinary HTTP startup does not initialize/reset business data.
- Replace the existing server repository with a PostgreSQL implementation and one bounded connection pool. Keep configuration and credentials server-side, use separate setup/runtime database accounts, retain readable errors and Retry, and close the pool while leaving the independently owned database alive. Exact stable pg/type package pins require registry verification during implementation.
- Recommend native Windows PostgreSQL from the official-linked EDB installer. Bounded inventory found no relevant Docker/PostgreSQL products or commands; WSL explicitly reported not installed. A native install avoids additional virtualization setup for this slice. Version 18.6 was checked against official sources during research; recheck the supported 18.x patch and verify the exact Windows installer artifact before installation. Docker remains a later alternative. The actual installer build/checksum, directory permissions, storage capacity and successful installation are not yet verified.
- Propose 127.0.0.1:5432, database platypus_service, owner platypus_owner and read-only runtime platypus_app, with credentials entered locally. Port probes observed no listener on 5432/5433 at research time; recheck at setup. Persistent storage should live outside source control. Windows service installation/startup policy and ownership must be made explicit during the approved setup.
- Future verification must prove SQL/API/browser values, saved edits surviving restart, safe migration/seed reruns and rollback, no fixture runtime fallback, and real outage/Retry recovery. A logical test database in a shared PostgreSQL instance does not isolate a service restart: use a coordinated exclusive verification window or a separately owned test cluster. Guard destructive test targets explicitly.

Evidence: docs/architecture/016-postgresql-data-design.md; docs/research/017-local-postgresql-environment.md; docs/reviews/018-postgresql-planning-review.md. The reports separate direct inventory/source checks, assumptions and proposed commands. Application sources, dependencies, running services and databases were not changed. Documentation lint/format/whitespace checks are appropriate to this phase; they do not establish PostgreSQL runtime behavior.

The next proposed step is selecting and approving local database setup, including required user/administrator interaction. Database installation, credential entry, migrations/seeds, Node integration, persistence tests, paid/cloud resources and remote publication were not authorized by the parallel planning request. Define the bounded implementation after the setup route is accepted.

## 5.25. AWS-first deployment alternative — assessment, not provisioning approval

The user asked whether to prepare AWS infrastructure now instead of installing PostgreSQL on the computer, and what blocks frontend/backend deployment. In response to clarification, the user confirmed there is no AWS account yet. The native Windows recommendation in 017 remains a proposal; no installer or database setup has begun.

A reasonable proposed sequence is an early cloud demonstration of the existing frontend and Node server with the same 25 fictional examples, followed by managed PostgreSQL as a separately estimated persistence stage. Local PostgreSQL is not a prerequisite for that first demonstration. The schema/repository design in 016 remains reusable with cloud PostgreSQL; cloud networking, credentials and restart-test ownership require a new environment design.

Current source inspection: all four frontends and the independent Node workspace already have verified build boundaries. Shell runtime-config.json and Support ticket-api-config.json still point to localhost. Node binds localhost and has local browser-origin defaults. Local launch scripts manage desktop processes, not cloud resources; AWS packaging/configuration, infrastructure definitions, deployment/rollback and cloud verification have not been prepared.

Candidates for review, not selected services: private S3 object storage and CloudFront delivery for independently published frontend artifacts; an AWS Node hosting option, including Lambda Web Functions, whose current documentation describes running HTTP servers directly; RDS for PostgreSQL for the later database stage. Before selection, verify target-region availability, compatibility, account-plan access and the complete cost profile. Do not assume every Lambda mode needs an event-handler rewrite or that every Free plan allows every advertised service/plan.

Frontend work includes cloud-controlled asset/API addresses, separate application paths, correct direct-route handling without turning missing federation assets into HTML, metadata/configuration cache policy and independent update/rollback checks. Backend work includes a deployment package/startup suited to the chosen host, public HTTPS request routing, origin configuration, logging, bounded resource settings and deployment checks. Managed database work includes provisioning/access rules, server-only credentials, migrations/seed, repository integration and real persistence/recovery checks. The first public demo uses fictional data; application authentication remains a later agreed capability.

Prepare a minimal architecture and cost/shutdown estimate before account/service setup. Infrastructure should be described in code for reproducible review/deployment. Automated delivery can be added gradually; a remote Git repository or automated pipeline is not a prerequisite for a controlled first deployment.

Official sources checked November 4, 2026:

- https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/deploy-a-react-based-single-page-application-to-amazon-s3-and-cloudfront.html
- https://docs.aws.amazon.com/lambda/latest/dg/web-functions.html
- https://aws.amazon.com/free/free-tier-faqs/
- https://aws.amazon.com/rds/postgresql/pricing/
- https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html

The current new-customer offer describes up to USD 200 credits and up to six months on the Free plan, with eligibility, credit and service-access conditions. It is not a permanent zero-cost architecture guarantee. RDS charges include compute/storage; stopping an instance retains storage/backup charges and it can restart automatically after seven days. Check the actual new-account experience and selected services before any chargeable action. No account, cloud resource, spending authorization or final hosting choice resulted from this assessment.

## 5.26. AWS-first architecture and cost planning — complete; proposal awaits acceptance

The user approved parallel architecture 019 and cost planning 020, followed by independent review 021. Architecture specialist aws_architecture and cost specialist aws_cost_plan inspected the accepted application and current primary AWS sources, coordinating one inventory and workload. Independent reviewer frontend_review checked the source contracts, consequential account/OAC/allowance documentation and all scenario arithmetic; no blocking inconsistency was found. Exact regional catalogue extraction and local artifact sizes remain attributed to the planners, not independently repeated by the reviewer. Root consolidated the staged English reports; no application, dependency, running service, account or cloud resource was changed.

Recommended first-demo candidate, conditional on actual account access:

- One private S3 bucket stores four frontend builds and backend deployment packages. One CloudFront pay-as-you-go distribution provides its generated HTTPS address, exact Shell-page routing and private-origin access. An ordinary Node.js 24 Arm64 Lambda Event Function with a protected function URL handles /api/*; its proposed settings are 256 MiB, a three-second timeout and reserved concurrency two if quotas permit. S3 and Lambda origin access does not implement human application authorization.
- Keep the existing 25 server-owned fictional examples and items/total contract. A small event adapter and shared request logic will preserve local HTTP hosting; no cloud code or infrastructure template has been implemented. Private federation dependencies, isolated orchestrators, complete versioned remote releases and origin-only Support API configuration remain required. Missing modules/configuration must retain non-HTML errors. Mutable control files have zero cache lifetime; independent update, rollback and real cloud Retry checks are future acceptance work.
- Describe resources in plain CloudFormation YAML with small project-owned deployment scripts. A remote Git repository and paid delivery pipeline are unnecessary for the first controlled deployment. No database, VPC/NAT gateway, custom domain, paid model or continuously running compute is included.

Cost proposal 020 uses a 30-day month: 10,000 API requests, 100,000 static viewer requests, 1 GiB frontend delivery plus approximately 0.095 GiB API delivery, 0.1 GiB retained artifacts, 0.05 GiB logs with seven-day retention and ten deployment batches. Assumed average billed Lambda duration is 100 ms, not measured runtime. Conservative S3 reads assume every frontend request misses cache.

- Frankfurt comparison: approximately USD 0.5699 gross before all allowances; USD 0.047286 after current continuing allowances, plus up to approximately USD 0.002098 in the labeled origin-transfer sensitivity. Gross is counterfactual marginal-rate comparison, including paths that are actually within the free invalidation allowance; it is not the expected payable bill.
- Stockholm comparison: approximately USD 0.562968 gross and USD 0.044000 after continuing allowances, before the same transfer sensitivity. At 100 times the Frankfurt baseline traffic, the modeled residual rises to approximately USD 6.304286. These are estimates excluding tax, currency conversion, other account usage and changes in assumptions; no maximum bill is promised.
- With an eligible active Free plan and sufficient applicable unexpired credits, target out-of-pocket payment is zero. If the user later deliberately continues on Paid and current allowances remain available, the baseline without a database is about USD 0.05/month. Free-plan expiry without upgrade suspends access; it does not provide permanent hosting. AWS's public credit-expiry wording conflicts, so inspect the actual grant and plan conservatively around the earlier six-month boundary.
- PostgreSQL is excluded. A later Frankfurt RDS PostgreSQL example is USD 16.42/month for 720 hours of db.t4g.micro plus 20 GiB storage, before networking, backups and other extras. Aurora auto-pause scenarios have separate usage/version/connection assumptions and persistent storage costs. These comparisons do not select or approve a database.

The new signup experience assigns Ohio, Stockholm or Sydney from contact-country information; Frankfurt is a comparison, not a presumed selectable default. Do not infer the billing country from the Windows timezone. AWS account Free plan and CloudFront flat-rate Free are different offerings: current restrictions exclude Free Tier accounts from flat-rate plans. Preserve pay-as-you-go plus eligible allowances/credits and never activate advanced features or upgrade automatically just to bypass a restriction. Actual CloudFormation/IAM/PassRole/OAC operations, function URL availability and concurrency quotas require inspection after account creation. Service listing alone does not prove full feature access.

Scaling settings and delayed budget notifications are not a zero-dollar billing cap. Retain explicit resource ownership, short logs, bounded release retention and complete teardown of owned origins, functions/versions, distribution/associations, artifacts and logs. Stopping local applications does not stop cloud endpoints or remove stored cloud resources.

Evidence: docs/architecture/019-aws-first-deployment-architecture.md; docs/research/020-aws-cost-plan.md; docs/reviews/021-aws-deployment-planning-review.md. Planning is complete; recommendations await user acceptance. The next proposed small step is user-owned account creation and inspection of the actual Free plan, assigned Region and credit grant without sharing credentials. Application/infrastructure implementation and resource creation must be defined and approved separately. No registration, installation, cloud resource, paid action or empirical cloud compatibility/billing check occurred in this phase.

## 5.27. AWS access and GitHub setup — user-confirmed progress

During guided setup, the user created an AWS project and renamed it Platypus Service. Console screenshots showed Free plan, USD 100 credits remaining, USD 0 due and a trial end date of May 4, 2027, as observed on November 4, 2026. The project's assigned Region is Europe (Stockholm), eu-north-1. These are account observations at that time, not permanent balances, credit-expiry guarantees or authorization for paid usage.

The user installed AWS CLI 2.39.3 on Windows. Refreshing the current PowerShell process's executable search path resolved command discovery in VS Code. The user configured profile platypus-dev for eu-north-1, completed browser-based aws login, and demonstrated a successful aws sts get-caller-identity response. The screenshots identify the active role as AccountFullAccessRole; identity lookup does not prove that every deployment operation is allowed. No identifiers, tokens, credentials or sign-in links are recorded here. The user also installed uv 0.13.7 with WinGet and verified it in the VS Code terminal.

The next proposed access step is the interactive Agent Toolkit setup. No successful wizard output, configured agent connection, installed AWS skill set or agent-side AWS invocation has been demonstrated yet. The toolkit's service-region parameter is separate from the Stockholm project Region. Review generated configuration and the named-profile selection before claiming completion; do not interpret access setup as approval to provision resources.

The user created https://github.com/dmytrorozhkov/platypus-service.git. The coordinator configured origin; the user subsequently published the current branch. A live read-only Git check confirmed HEAD and the only remote branch planning/aws-first-deployment at commit 55319fe. Local main remains the earlier foundation checkpoint. GitHub visibility was not independently established. Later branch organization must preserve these histories; no force push or history rewrite is needed.

The user requested an updated README after publication. It now describes the product goal, implemented local slice, future features, current AWS preparation, GitHub workflow and links to recent evidence. Existing local launch and verification commands are retained. Historical research reports describe their dated evidence; current account/readiness status is recorded in this section. Application code, infrastructure resources and Agent Toolkit configuration were not changed by the documentation refresh.

## 5.28. AWS agent connection — authenticated MCP call verified

After the GitHub/README step, the user resumed Agent Toolkit setup. Screenshots showed all 25 default AWS skills installed to the user-level .agents/skills directory. The wizard initially lacked the codex executable on its search path. The user installed Codex CLI with npm and verified version 0.166.0 using codex.cmd. A repeat wizard attempt failed with WinError 2 during MCP configuration; its exact missing file/root cause was not established, so no particular Windows packaging defect is claimed.

The user demonstrated that the existing MCP list contained no aws-mcp entry. Guided manual registration then succeeded with codex.cmd mcp add: launch uvx with mcp-proxy-for-aws-cli@latest, use the managed endpoint https://aws-mcp.us-east-1.api.aws/mcp, pass AWS_MCP_PROXY_PROFILES=platypus-dev and metadata AWS_REGION=eu-north-1. These values select the existing profile and the default operation Region; the endpoint Region does not relocate the project. Existing unrelated connections were preserved.

After the user restarted the client, AWS MCP tools became available to the coordinator. A single run_script call invoked STS GetCallerIdentity with explicit Region eu-north-1. The tool returned status success, an api_calls entry identifying sts/GetCallerIdentity as successful, and the same project identity/AccountFullAccessRole shown in the earlier terminal check. No credentials or personal account identifiers are stored here. This directly verifies authenticated agent access; a configured/enabled entry alone would not have proved it. Regional provisioning permissions, resource quotas, frontend/backend deployment and actual billing behavior remain untested.

The coordinator read the installed signing-in-to-aws and aws-sdk-python-usage skills, used the official MCP tool for the identity call, and read AWS's new-experience rules. Relevant project guidance is recorded in AGENTS.md with existing project decisions taking precedence. README and the current phase now reflect the verified connection. No application code, dependency, infrastructure resource or credential was changed by this verification/documentation step. Next proposed work is a bounded, reviewable first-deployment preparation stage; creation of resources and paid usage remain separately approved actions.

## 5.29. First deployment preparation — implemented and locally verified

The user approved starting the described preparation stage: infrastructure definitions, a Lambda-ready backend preserving local behavior, deployment-specific frontend artifacts, publication/check/rollback/teardown commands and an independently reviewed verification report. This approval covers application and infrastructure code plus local checks. It does not create AWS resources or authorize paid usage. Read-only account preflight and template validation may use the existing MCP connection; do not execute a change set, publish objects/functions or deploy/delete stacks.

Work is isolated on feature/aws-deployment-preparation from 26827c1. Server specialist local_ticket_integrator owns task 022 and apps/server. Infrastructure specialist aws_architecture owns task 023, infrastructure and scripts/aws. Root owns shared package files, integration and project records. Reviewer frontend_review owns subsequent review 024. Owners coordinate the compiled handler/package interface before final artifact verification. No database, application identity, 100,000-record expansion, framework migration or cloud pipeline is included.

Acceptance: existing local runtime and tests remain passing; local/Lambda contracts agree; complete packaged frontends load together at deployment-style paths; source localhost configuration stays usable; templates/policies and safe default command plans are validated; updates/rollback preserve complete remote graphs; generated artifacts/secrets stay outside Git. Reports must separate local evidence from cloud-only permissions, quota, routing and actual-billing checks. Final cloud deployment requires its own explained step.

Tasks 022/023 are implemented, with independent review 024. The server now shares transport-independent behavior between local HTTP and an import-safe Function URL payload-v2 handler. Infrastructure uses three CloudFormation JSON stacks to resolve bootstrap dependencies: private storage, backend, then a disabled edge distribution. Immutable complete frontend graphs, an actually extracted deterministic five-file Lambda ZIP, same-origin runtime configuration and integrity manifests are prepared under ignored .local/. Source development configuration and all 25 fictional fixture values are preserved. No runtime server dependency was added. The project-local official @aws/cloudformation-validate 1.15.0 is a pinned development dependency for schema/lint and actual Guard policy validation.

The aws:prepare/aws:preview commands provide a deploy-style local demonstration. aws:plan generates auditable operation descriptions for bootstrap/publication/check, independent remote publication/rollback, backend alias rollback and teardown; it deliberately has no cloud executor. Its default is offline with zero operations. Actual target ownership, exact current pointers, fresh quotas, complete file checksums and conditional pointer writes are mandatory future execution checks. Partial-bootstrap cleanup is separately documented rather than claimed as automatically handled. Read infrastructure/README.md before future cloud operations.

Verification completed: all five workspace builds/typechecks; two integration groups; eight server groups independently rerun by the reviewer; three lifecycle groups; 25 existing browser groups; seven AWS preparation groups including real Edge packaged routes/25 rows/API failure and Retry, ZIP extraction/determinism, unchanged source configuration, ownership failures and rollback graph checks. The coordinator prepared .local/aws/releases/coord-20261104-b for the local demonstration and visually inspected the packaged Tickets evidence. Full lint/format checks and the final independent review are recorded in the stage reports. No AWS hosting or real cloud update/rollback behavior is inferred from these local checks.

Read-only MCP preflight in eu-north-1 returned account concurrency five, unreserved five and zero functions. The proposed reserved concurrency two cannot fit the normal unreserved-buffer requirement. The target remains unresolved: do not silently remove the reservation, request increases or upgrade the plan. A later decision may explicitly accept the shared account-wide cap of five, after refreshing evidence; it is not a per-function cap or a spending limit. AWS ValidateTemplate accepted all three final template bodies through three successful API calls; offline schema/Guard validation found zero errors/warnings and 21 informational replacement notices. This is not account-aware change-set validation, permission proof or resource creation.

No cloud stack, function, bucket, distribution, object upload or billable model invocation was created by this preparation stage. Actual creation, signed-origin access, cloud cache behavior, HTTPS/edge propagation, live update/rollback/teardown and costs remain separately authorized work. PostgreSQL and application identity remain later stages. On November 5, 2026, the user launched aws:preview with .local/aws/releases/coord-20261104-b/manifest.json, opened the local packaged Tickets page and confirmed that the table is visible. This accepts the demonstrated prepared slice; it does not authorize cloud provisioning or spending.

## 5.30. First AWS launch — concurrency choice accepted, preflight next

On November 5, 2026, the user accepted using the shared account-wide cap of five simultaneous Lambda executions for the first learning deployment (account-cap-five), after the coordinator refreshed GetAccountSettings in eu-north-1: total five, unreserved five, zero functions. This replaces the proposed reserved-two choice for this slice. It is not an isolated function reservation or a monthly spending cap. Refresh actual quotas before execution; do not increase them or upgrade the account plan automatically.

This decision does not authorize provisioning, publication, paid-plan conversion or spending. The next bounded step is read-only verification of the active Free plan, remaining applicable credits/expiry, identity and required access, followed by a concrete first-launch proposal with cost assumptions, checks and teardown instructions. Subject to separate approval, launch the existing 25-ticket slice through private S3, CloudFront and Lambda; verify its public HTTPS URL, origins and data. Database persistence, application sign-in, business charts and AI features remain later stages. Keep the checked-in target example deliberately incomplete; any real local target still needs fresh reviewed evidence and actual resource outputs.

Read-only preflight was approved next on November 5. The coordinator read the cost-management skill and its Free Tier reference, checked current time, and attempted the official MCP identity/plan/usage calls. The MCP dispatch returned Unknown tool for run_script on both attempts and search_documentation on the initial attempt; no AWS API execution/result was returned. This is a tool-availability failure, not evidence of expired credentials, denied billing permissions or a changed account plan. Current plan/credits/expiry remain unverified. Official GetAccountPlanState documentation confirms that one read-only call returns plan type/status, remaining credits and plan expiration. The fallback is a learner-run CLI query using the existing platypus-dev profile; no infrastructure or billing setting was changed.

The learner then demonstrated a successful GetAccountPlanState result: FREE, ACTIVE, USD 100.00 remaining, accountPlanExpirationDate 2027-05-04T13:05:19.905000+00:00. On the same day the coordinator's official MCP tools became usable again. Successful STS GetCallerIdentity matched the intended project; GetAccountPlanState independently confirmed those plan values; GetAccountSettings confirmed total five/unreserved five/zero functions in eu-north-1. GetFreeTierUsage returned an empty array; this does not establish a zero bill, absence of all account usage or future service eligibility. No personal account identifier or credentials are stored here. Earlier Unknown tool dispatch errors are historical observations, not a proven consequence of credential expiry. The CLI separately reported expired credentials before the learner renewed sign-in.

## 5.31. First cloud launch — partial deployment; account verification required

The preparation is implemented, reviewed (024) and accepted locally. The next concrete proposal is to provision the three reviewed CloudFormation stacks in this existing project: one private S3 artifact bucket, the ordinary Node.js 24 Arm64 Lambda function/live alias/signed URL with scoped role and seven-day logs, and a pay-as-you-go CloudFront distribution with its two OACs, exact-route function and related policies. Regional resources stay in eu-north-1. Use the accepted shared account-cap-five mode; do not request quota increases. Upload the reviewed complete 25-ticket package, configure the actual generated HTTPS origin, and enable delivery only after origin grants/configuration checks.

Expected result: a public HTTPS application URL with Analytics, Administration and the 25-ticket Support page, without a locally running application server. Verify exact data, direct-route refresh, loading/failure recovery where feasible, protected origins and missing assets; inspect actual stack outcomes and report remaining cloud-only gaps. Routine correction/update of only these owned resources belongs to this proposed launch. Keep retained releases and the prepared check/rollback/teardown procedures in infrastructure/README.md; any failed partial creation must be inventoried using its documented recovery steps, without deleting unrelated resources. This proposal is not approval for destructive cleanup or later independent feature deployment.

Cost conditions: preserve the verified active Free plan and use applicable continuing allowances/credits, with zero intended out-of-pocket payment. No Paid-plan/advanced-feature activation, new paid-only service, database, custom domain, VPC/NAT, model calls or hosted CI. Cost estimate 020 remains a workload-based estimate, not an enforced spending cap; the five-execution limit is not a monthly cap. Recheck plan/credit/ownership before creation and after verification. If the plan/credit assumptions fail or an upgrade/extra service is needed, stop and explain before proceeding. AWS Free Tier FAQ and plan guidance were checked November 5: the free period ends at the earlier of plan expiry or credit exhaustion, and continuation requires a deliberate upgrade. The user explicitly approved creating this reviewed resource set and deploying the current application on November 5, 2026. This authorizes the bounded launch and routine owned-resource corrections while preserving Free plan; it does not authorize account upgrades, additional services or destructive teardown. Root performs AWS mutations; aws_architecture independently checks launch sequencing and frontend_review will review actual evidence.

Sources: https://aws.amazon.com/free/free-tier-faqs/ and https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html. Prepared exact templates and operational sequences: infrastructure/README.md and infrastructure/*.template.json; local implementation evidence: docs/implementation/023-aws-deployment-preparation.md; independent review: docs/reviews/024-aws-deployment-preparation-review.md.

Actual attempt 025 on November 5 created the private storage and backend stacks successfully. Change sets and scoped service validation were inspected before execution. S3 checksums/privacy and a real version-1 Lambda invocation were verified: all 25 fixture values matched, and anonymous direct ZIP/Function URL requests returned 403. CloudFront distribution creation was denied because AWS requires account verification through Support. Automatic edge rollback reached ROLLBACK_COMPLETE; all eight logical resources are DELETE_COMPLETE and no distribution ID/public application URL exists. The successful storage/backend and bootstrap ZIP remain; no manual teardown was performed. Current plan remains FREE/ACTIVE with USD 120 observed and the same May 4, 2027 expiry. Balance changes do not establish a zero bill or their cause. Details: docs/implementation/025-first-aws-launch.md; independent review: docs/reviews/026-first-aws-launch-review.md. An English Support draft is prepared but unsent in docs/operations/025-cloudfront-account-verification.md. User-owned account verification is the next step. Initial-create ROLLBACK_COMPLETE needs separately reviewed deletion/recreation of the empty owned edge stack or another concrete recovery; never promise UpdateStack retry-in-place. No public browser/cloud caching/update/rollback/teardown acceptance is claimed.

## 5.32. Account-verification case submitted by the learner

On November 5, 2026, the learner manually submitted a support case titled CloudFront account verification required. The screenshot shows its case-details page and the initial correspondence containing the exact CloudFront account-verification error and a request to preserve Free plan. The preceding visible form selected Account and billing, Account Activation, Account Verification, General question, English and Web. No Support case ID was captured or stored in tracked content.

The new Support interface routed Create case through an assistant interaction: the learner entered the issue, selected Create a case after the recommendation, completed the form and selected Submit. This was learner-operated correspondence; no agent sent a message or created the case through a tool. The longer operational document remains reference wording rather than a verbatim copy of the submitted shorter description. The case is submitted; verification is not yet confirmed and no AWS reply is visible in the provided screenshot. Await the reply in Correspondence/email, then inspect any required account action before resuming the bounded launch. Preserve the existing partial deployment and Free plan. Do not infer CloudFront permission from case creation or retry provision/deletion while the verification gate is unchanged.

## 5.33. Support verification confirmed; recovery decision pending

On November 5, 2026, the learner supplied an AWS Support reply stating that the account was successfully verified and asking them to retry CloudFront creation. This is confirmation from Support, not proof that a new distribution has been created. No case closure, reply or new deployment was performed by the coordinator.

Fresh read-only MCP checks matched the intended project identity. Storage and backend remain CREATE_COMPLETE with the expected Project tag. The edge stack remains ROLLBACK_COMPLETE with all eight logical resources DELETE_COMPLETE, no surviving distribution and the expected Project tag. Preserve the successful storage/backend and the existing ZIP. The empty failed edge stack record must be explicitly reviewed for deletion/recreation; it cannot use a normal UpdateStack recovery.

Free plan remains FREE/ACTIVE with USD 120 observed, and the plan expiration remains May 4, 2027. The important changed condition is Lambda ConcurrentExecutions=10 and UnreservedConcurrentExecutions=10. The coordinator did not request a quota change and does not infer why it changed. The previously accepted account-cap-five mode cannot be used against this new evidence: its validator deliberately rejects an account quota above five. Reserved-two also remains unavailable under the documented unreserved-buffer requirement.

Proposed bounded recovery: separately accept the currently observed shared account-wide cap of ten, update the explicit concurrency-mode option and tests/documentation without removing fresh quota checks, and authorize deletion/recreation of only the empty platypus-dev-edge stack record in eu-north-1. Recheck exact account/stack ownership and all resource states immediately before deletion. Do not delete or recreate storage/backend, upgrade Free plan or introduce services. Continue the previously approved disabled-edge bootstrap, actual-origin packaging, scoped grants, publication and public acceptance once those decisions are approved. No mutation dependent on the ten-execution decision or empty-stack deletion has occurred.

## 5.34. Shared account cap ten — local plan update approved

On November 5, after an explanation of simultaneous requests and usage-based pricing, the learner accepted updating the project's explicit shared-cap choice to ten. The quota itself has no standalone fee; unchanged workload does not become more expensive merely because a higher quota exists. Actual traffic/duration/memory still determine consumption, and parallelism is not a monthly spending limit. The coordinator will not request a quota increase or provision paid capacity.

Bounded task 027 adds account-cap-ten while preserving the stricter account-cap-five option, reserved-two guards, fresh reviewed evidence, explicit acceptance and unresolved defaults. aws_architecture owns plan/templates/pure tests/infrastructure instructions; root owns shared records and the ignored actual target; frontend_review independently verifies task 028. No cloud mutation, stack deletion, application change, dependency or local server startup belongs to this local update. The deployed backend still has its historical account-cap-five parameter label until a later authorized stack update; it does not enforce a five-function reservation, and the actual shared AWS quota is already ten.

The latest approval accepts ten; it is not a direct instruction to delete the empty failed edge stack. That deletion/recreation decision remains pending. Preserve S3/backend, Free plan and the stopped local-server state. After the local change and checks, explain the exact empty-stack recovery step separately.

Local update 027 is implemented and integrated; independent review 028 found no confirmed blocker. Four bounded offline test groups passed, including cap/acceptance/freshness boundaries and bootstrap/publication parameter propagation. Template/schema/Guard validation passed with no errors/warnings; lint and formatting passed. The ignored actual target now records account-cap-ten, ten total/unreserved, explicit acceptance and the fresh November 5 review timestamp; verified ownership remains false and resource outputs remain unresolved. No AWS mutation, quota change, stack deletion, server startup, browser or release packaging was performed. See docs/implementation/027-account-cap-ten.md and docs/reviews/028-account-cap-ten-review.md.

## 5.35. Verified-account edge recovery — deployed and verified

On November 5, 2026, the learner directly approved deleting only the empty failed platypus-dev-edge stack and continuing the existing first deployment. This satisfies the direct deletion authorization; do not request it again for this exact recovery. Fresh MCP checks matched identity, FREE/ACTIVE with USD 120 observed, ten total/unreserved executions, successful storage/backend, and eight DELETE_COMPLETE edge resources. The old exact edge ARN was deleted and confirmed DELETE_COMPLETE; its name was confirmed absent. Storage/backend were preserved. A new CREATE change set for the unchanged disabled edge passed scoped DescribeEvents validation with no validation-error events and was executed with ordinary rollback enabled. Root owns cloud mutations; aws_architecture independently reviewed sequencing. No new service, plan upgrade or quota increase is authorized. The resumed launch is now deployed. See the verification below; the learner subsequently opened the public application and confirmed it works on November 5, 2026.

The unchanged new edge completed creation while disabled. A fresh cloud-live-20261105 release used its actual generated origin https://d2p7y3iystcl60.cloudfront.net. Root verified all uploaded object checksums/lengths/cache metadata before the runtime pointer, then published runtime-config.json and index.html last. The backend updated in place to version 2 with the matching code hash, actual ALLOWED_ORIGINS and account-cap-ten. The existing storage policy grants only the new distribution frontend paths. Scoped change-set validation showed no validation errors before each execution; standard rollback remained enabled. The final inventory at November 5 16:35 UTC showed all three stacks UPDATE_COMPLETE, CloudFront Deployed/Enabled true and 28 owned S3 objects (27 current manifest objects plus the prior bootstrap ZIP). The current release, pointer ETag/hash, actual outputs and active alias version are recorded in ignored local evidence.

Six real public HTTP/browser groups passed: exact 25 fixture values and no-store API, same-origin metadata/immutable remote assets, non-HTML missing/private paths and private S3/Function URL denial, three direct routes/refresh/repeated cleanup, browser-controlled 503/Retry, and mobile table scrolling without document overflow. No page/console or unexpected-origin errors occurred. Root visually inspected desktop/mobile screenshots. Existing LOCAL/local-development/local-server labels remain inherited copy, although every observed application request uses the cloud origin. That copy does not establish local execution.

Post-check Free plan remains FREE/ACTIVE with USD 120 observed and the same May 4, 2027 expiration; total/unreserved concurrency remains ten. These observations do not establish a zero bill or future guaranteed free service. No new service, paid upgrade, quota increase, persistent database, paid AI, application feature or local server was introduced. The browser-controlled 503 is not a real cloud outage; independent feature publication/rollback and full teardown were not demonstrated. Support correspondence/case closure was not performed by the agent. Independent review 030 read the saved cloud/browser evidence, ran local consistency assertions and visually inspected both screenshots; it found no confirmed deployment blocker. The inherited interface labels remain a minor copy limitation. Read implementation 029 and review 030. The learner opened the public application and confirmed it works, accepting the demonstrated AWS slice. This confirmation does not authorize a new implementation stage, extra service or spending change.

## 5.36. GitHub Actions CI-only stage — implemented and hosted-verified

The learner accepted starting with automated checks/builds before any deployment integration and stated that dmytrorozhkov/platypus-service is Public. Public API verification matched this and the existing default branch planning/aws-first-deployment. Stage 031 adds a standard Windows GitHub Actions workflow on a new feature/github-ci branch: pinned Node/npm/actions, clean install, lint/format/typechecks, all workspace builds, server/lifecycle/integration tests, local infrastructure validation and complete offline packaged-browser tests. Root coordinates shared records, implementation is assigned to ci_implementation and independent review to frontend_review (032). Public-repository standard hosted runners are free under current GitHub guidance; no larger runner or artifact storage is requested.

Only checks/builds are authorized. No AWS access/deployment, role/OIDC setup, secret, paid runner/service, repository/default-branch change or application/dependency migration belongs to this stage. Hosted npm installation occurs only inside the temporary GitHub runner; local verification preserves the shared installed worktree. Test-owned temporary listeners may run and must clean up; existing manually started local servers remain stopped. Root will commit/push the reviewed workflow, observe its actual public run and correct CI failures. The workflow is not considered hosted-verified merely because its file exists. Sources: https://docs.github.com/en/actions/reference/runners/github-hosted-runners and https://docs.github.com/en/billing/concepts/product-billing/github-actions.

Local implementation 031 and pre-publication independent review 032 are complete without a confirmed blocker. The workflow grants only contents:read, persists no checkout credential and has no AWS/secret/deployment/artifact-upload step. Local Windows CI-environment lint, formatting, typechecks, all five builds, built-server tests (8), integration (2), startup (3), schema/Guard validation (no errors/warnings; 21 informational notes) and complete offline package/browser tests (9) passed. Full-commit action pins and YAML structure were independently checked. Clean npm ci/global npm pin and the actual hosted job remain pending the reviewed push; do not claim hosted success yet.

The reviewed workflow was published on feature/github-ci in commit 28d5c39cf3c7aa5fc9f4550fd6dd8af173358556. The actual public push run https://github.com/dmytrorozhkov/platypus-service/actions/runs/42072669079 completed successfully: its Windows job ran 2026-11-05T17:14:35Z–2026-11-05T17:17:34Z, with all 18 recorded steps successful, including the clean dependency installation, exact Node/npm setup, all checks/builds/tests and cleanup. Raw public API evidence is ignored in .local/ci/first-run-28d5c39.json. This establishes actual hosted execution rather than only local success. Workflow permissions and source did not change after the verified commit; later documentation checkpoints may trigger ordinary CI again. Independent review 032 supplements the evidence; learner-visible acceptance of this CI stage remains pending. The existing default branch and running AWS deployment were preserved; automatic or button-driven AWS publication remains a future stage.

## 5.37. Status checkpoint and Sonar deferral

The learner explicitly deferred Sonar: do not install a Sonar server, create/connect a SonarQube Cloud account, add a token/scanner or change CI for Sonar at this point. The coordinator reviewed the actual plan, README and server routes for the requested status explanation. The frontend foundation, read-only fixture backend, accepted AWS deployment and CI checks/builds are implemented. Public GitHub API reads confirmed both CI runs for commits 28d5c39 and 3a03c17 completed successfully; the latter is run https://github.com/dmytrorozhkov/platypus-service/actions/runs/42073707226. This is runtime evidence, not additional user acceptance or approval of a new stage.

Database persistence, business write operations, application sign-in/server-enforced permissions, heavy-table queries, real analytics/admin functions, chat/knowledge/RAG and background AI jobs remain unimplemented. GitHub-to-AWS delivery also remains unimplemented: current CI can check/build but has no AWS access or deployment command. PostgreSQL design 016–018 remains reusable, while its old native-Windows setup recommendation was not selected after the AWS-first direction. Choose the eventual PostgreSQL hosting service and estimate its full cost before database provisioning. The revised section 9 is a proposed sequence, not authorization to configure a new stage.

## 5.38. Maximum useful parallelism — bounded delivery planning

The learner asks what comes next and how to parallelize agents in upcoming stages. Root starts three independent, file-isolated planning lanes for the proposed manual GitHub-to-AWS delivery: release/workflow flow (033), temporary scoped AWS access (034), and verification/failure recovery (035). A fourth independent proposal review (036) follows their handoffs. The active environment has four concurrent slots including the coordinator: root plus up to three workers. Shared integration, identity decisions and actual publication must remain coordinated rather than concurrently mutated. This is research/proposal work only; it does not authorize deployment implementation, IAM changes, repository/default-branch changes, database provisioning, extra paid services or Sonar.

Proposals must first resolve the canonical branch and default-branch requirement for a Deploy button, current deployed state outside this computer, exact reviewed-commit delivery, scoped temporary trust, immutable releases/conditional pointers and recovery with a compatible backend version. Root owns shared documents and Git; planners own separate reports. Existing AWS resources, CI, application code, dependencies and stopped local servers are preserved. Later PostgreSQL/authentication implementation can use similarly separate data/backend/frontend lanes once the shared data/access contract and hosting cost are agreed.

Parallel planning reports 033/034/035 are integrated, with independent review 036. The first author turns were interrupted by a usage limit; the delivery-flow and recovery drafts survived, the access author resumed, and a separate reviewer checked the combined proposals. Root corrected the fixed Shell asset classification identified during review. This is completed planning, not a working Deploy button or a hosted publication test.

The proposal recommends main as the future canonical/default branch, a manual full-release workflow with exact checked source and immutable artifacts, temporary GitHub identity access scoped to one protected environment, and private durable deployment state in the existing bucket. Import the current live baseline with unknown/manual source provenance unless independently established; never label it with current HEAD. Add conditional writes for every mutable control, serialize publishers without cancelling an active writer, and reconcile partial publications before recovery. Current stable Lambda version 2 is the known compatible baseline; retained version 1 is ineligible. The existing offline planner is not an executor and its broad update sequence must not be replayed unchanged.

Next implementation can use three isolated lanes: reusable checks/package/manual workflow; durable-state/publication executor; and independent failure/acceptance checks. Root owns shared interfaces, branch integration and any separately agreed initial access/state setup; an independent final review follows the authors. No runtime/cloud/settings changes occurred in this planning stage. Branch/default selection and the concrete implementation stage remain learner decisions; database/authentication and Sonar are unchanged.

## 5.39. Canonical main branch — authorized promotion verified

The learner explicitly approved the next small step: promote the reviewed project history to main and make it the GitHub default. Root refreshed origin, confirmed clean status and ancestry, fast-forwarded main from 62acadd to reviewed planning commit 1ae1665, published it, and changed only default_branch through the existing authenticated GitHub connection. A separate readback confirmed main and public visibility; origin/HEAD now points to origin/main. No commit was rewritten or branch deleted. See implementation 037 and independent review 038: no remaining blocker after correcting outdated README branch guidance. Repository-wide lint/format checks and whitespace checks passed.

This completes the canonical-branch prerequisite for later manual delivery planning. Existing CI is now on the default branch. Actual main push run https://github.com/dmytrorozhkov/platypus-service/actions/runs/42103045381 completed successfully at exact promoted commit 1ae1665, with all recorded job steps successful; ignored raw evidence is .local/ci/main-promotion-1ae1665.json. Later documentation pushes may start separate CI runs whose outcomes are not inferred here. The Deploy workflow, AWS identity roles, private durable state, publication executor and recovery proof remain unimplemented proposals033–035. This approval covers the repository branch step only; no environment/IAM/cloud/deployment or paid-service change occurred.

## 5.40. Manual GitHub delivery — implementation authorized

After completed canonical-main promotion037/038, the learner accepted starting manual Deploy implementation. Root creates feature/github-delivery and three isolated lanes039–041: reusable workflow/bundle, state/publication executor, and independent failure tests. Root owns access preparation043/shared interfaces/Git; independent integrated review042 follows authors. Read contract039 and proposals033–035. Prepare and verify concrete code/configuration before live identity/state setup or publication. No paid service, teardown, quota/upgrade, Sonar or database work is included. Persistent CloudFormation service-role association requires the concrete explained setup decision; the earlier planning review is not evidence that live setup occurred.

Local implementation039–043 is integrated and independent review042 found no remaining confirmed local blocker after crash/retry corrections. The coordinator ran repository-wide lint, format:check and 34 delivery test groups successfully (five real-bundle groups, 24 deterministic state/failure groups and five access-document groups). Existing app/templates/dependencies were preserved; the root adds only the delivery commands. Feature-branch hosted CI was subsequently observed successful as recorded below.

The preparation includes a reusable checked-SHA build, one-day bounded artifact handoff, disabled manual main-only publisher/recovery, conditional private checkpoints/full records/receipts, typed import/recovery/reconcile and scoped access-document preparation. Two read-only AWS connector attempts returned Unknown tool: aws___run_script with no recorded API execution. Fresh inventory, roles/provider/service-role association, protected environment/secret setup, baseline import and hosted/live publication/recovery therefore remain unperformed. Keep DELIVERY_ENABLED absent/false. This is a concrete prepared implementation awaiting tool reconnection, not completed cloud delivery or an expired-session diagnosis. See reports039–043 and preserve the accepted running AWS release.

The actual feature-branch CI push run https://github.com/dmytrorozhkov/platypus-service/actions/runs/42109733203 completed successfully for exact implementation commit a0a08f0cc820e68098fe1cecacac4a9eae1b40db. Its clean install, lint/format/type checks, all five builds, server/integration/startup tests, infrastructure validation, offline AWS/browser suite and 34 delivery groups passed. Publication-only bundle upload steps were correctly skipped in ordinary push CI. Raw public evidence is ignored in .local/ci/delivery-a0a08f0.json. This verifies hosted checks, not the manual workflow/artifact handoff, role access or live deployment. The reviewed implementation stays on feature/github-delivery; canonical main and the accepted AWS application remain unchanged while the AWS connector is unavailable. Later documentation pushes may trigger another ordinary CI run whose result is not inferred.

On November 5, after the learner renewed sign-in, the AWS connector recovered without a Codex restart. Actual STS identity, plan, Lambda and stack reads succeeded. FREE/ACTIVE plan has USD 120 remaining credits, expiry May 4, 2027; total/unreserved concurrency remains 10, all three owned stacks are UPDATE_COMPLETE, live alias remains version 2 and backend RoleARN is absent. IAM ListOpenIDConnectProviders and exact GitHub GetOpenIDConnectProvider were both explicitly denied by an organization service control policy. The successful iam-toolbox GetRequestAuthorizationDetails read confirms DenyIAMActions overrides AdministratorAccess at the organization root. This is now a confirmed authorization blocker, replacing the earlier connector-availability blocker. No cloud or repository-setting mutation occurred; keep DELIVERY_ENABLED absent/false. The complete policy body could not be read with current access, so do not claim a tested exception or guarantee that an upgrade alone resolves it. Preserve Free plan: advanced activation requires an account upgrade and is irreversible according to current AWS documentation. Next, inspect the linked authorization details or clarify supported GitHub federation with AWS before proposing any account change.

Sources: https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html and https://docs.aws.amazon.com/accounts/latest/reference/activate-advanced-features.html. Ignored evidence: .local/aws/delivery-access-denial-20261105.json.

## 5.41. Preparation first; human-controlled publication and parallel planning

The learner authorized preparation of the deployment path and requires code, applicable tests and independent review before any publication. Only the learner manually starts an exact reviewed release. This supersedes earlier coordinator live-execution permission. No publication, recovery, durable-state import, CodeBuild execution (even rehearsal), cloud provisioning/access change, automatic trigger or account upgrade is authorized by this preparation step. Access separation must be verified before claiming agents are technically unable to deploy; it is not configured now.

Root dispatched three independent planning lanes045-047 for backend, frontend and data, while preparing delivery contract044. Recommendation: parallel work within one small read-only persistence slice; sequential shared-contract agreement, integration, independent review and user acceptance. Keep delivery preparation of the existing fixture demo separate from future database deployment. No full application, native database installation, public writes or paid database service is implied. Read docs/architecture/044-controlled-preparation.md and reports045-047. Their data contract reuses016 without treating its historical Windows environment as selected.

Actual read-only CodeBuild ListProjects succeeded in eu-north-1 with no projects. This proves read access only. Cloud create/start/role/compute permissions remain unverified. Current CI does not provide a standalone package-only manual workflow, ordinary Actions archives require authenticated download, and the live browser checker needs an explicit installed browser path outside Windows. These are concrete preparation requirements, not completed CodeBuild delivery. Existing application, AWS resources and GitHub settings were preserved. Independent review048 found no confirmed blocking inconsistency in the preparation plan. Root lint, format:check and all34 existing offline delivery groups passed; the first sandboxed test attempt hit filesystem EPERM and the correctly permitted rerun passed without code changes. These are current local baseline checks, not CodeBuild timing or real database proof. No product implementation or new cloud timing evidence is claimed here.

## 5.42. Manual package-only preparation 049

The learner accepted continued preparation and asked for the next step. Root assigned ci_implementation the bounded package-only workflow049 and independent review050. Reuse complete CI and existing full bundle validation; add a main-only manual entry point and an exact-source artifact receipt without AWS access. Read task049 and contract044. Root owns shared integration/Git. No cloud execution/setup, publication/recovery/import, GitHub configuration/secret or canonical-main promotion is included. The new button is not considered available or hosted-verified merely because its file is written.

Local implementation049 and independent code review050 are complete without a confirmed blocker. Root lint, format:check and all37 delivery groups passed; no new dependency or application/cloud behavior changed. The manual Package definition reuses complete CI, provides one-day bounded full bundles and an exact-source archive/envelope receipt without AWS access. Feature CI verification follows the reviewed push; canonical-main promotion, origin-variable configuration and actual Package execution remain unperformed. No CodeBuild handoff or deployment is claimed.

Actual ordinary feature-branch CI for implementation commit 536b3b383882018a3a6708550cab0368480404f3 succeeded: https://github.com/dmytrorozhkov/platypus-service/actions/runs/42118681609. Clean install, lint/format/types, all five builds, server/integration/startup, offline infrastructure/package/browser and all37 delivery groups passed. Package-only creation/upload steps were correctly skipped for the push event. Raw public evidence is ignored in .local/ci/manual-package-536b3b3.json. This is hosted verification of the changed checks/source, not a manual Package run, authenticated artifact download, CodeBuild handoff or cloud publication. Canonical main, repository variables and AWS resources are unchanged. Later documentation commits may start separate CI runs whose outcomes are not inferred here.

## 5.43. Parallel PostgreSQL and safe package reader — implemented and hosted-verified

The learner explicitly authorized database work alongside safe archive receipt/version/integrity verification before CodeBuild, with no real publication. Root assigned three isolated implementation lanes051-053 and owns integration054/review055. Read docs/architecture/051-054-parallel-contract.md. This supersedes prior planning-only status for this bounded database increment; public writes/authentication/heavy-table behavior remain later work.

No local PostgreSQL service/binaries or Docker command were found. Root selects a fresh disposable GitHub-hosted PostgreSQL18 test service instead of a machine installation or paid AWS database. Exact pg8.23.1/types8.23.1 were registry-verified and installed in the workspace. The database-backed server is an explicit separate entry requiring PG settings; existing default demo and live Lambda remain fixture-backed until separately reviewed deployment/environment decisions. Root must distinguish actual CI persistence/restart/browser proof from preparation and simulated tests. No AWS resource, setting, secret, CodeBuild execution, main promotion or live publication is authorized here.

Local integration054 is prepared with implementations051/052/053 and independent source reviews055/056 reporting no confirmed blocker within this preparation scope. All five builds,24 server tests,46 delivery groups,2 federation contract tests,3 startup tests,9 offline package/browser groups and offline template validation passed. Real database/HTTP/browser/restart evidence is still pending the reviewed feature CI run, not inferred from mocks. See implementation054 for explicit commands, separate owner/runtime roles and remaining gates. No PostgreSQL installation is needed on the learner's computer for this hosted test.

Actual implementation commit 70939bed45ba582bdf3153ef1cc51b78589211ef passed https://github.com/dmytrorozhkov/platypus-service/actions/runs/42194402776 on November6,2026: real PostgreSQL18.6 SQL8/8 and HTTP/browser5/5, including saved data across actual same-container/storage/endpoint and HTTP restarts, real outage/Retry, no fixture fallback and SELECT-only grants. The required Windows job then passed clean install, lint/format/types, all five builds,24 server,2 federation,3 startup,9 offline package/browser and46 delivery groups. Earlier failed workflow/test runs and their narrow corrections are preserved in report054; none was relabeled successful. Independent follow-up review found no confirmed correction blocker. Actual GitHub artifact download, CodeBuild and cloud database/deployment remain unperformed; main/settings/AWS and stopped local servers are preserved. See implementations051-054 and reviews055/056. The user can inspect the actual run before accepting this stage.

## 5.44. Main Package readiness and local PostgreSQL preparation — authorized

The learner accepted the proposed next main/manual-archive step and parallel local database preparation on November6,2026. Root owns057: fresh-ref/CI review, fast-forward main, only the public DELIVERY_ORIGIN prerequisite, observation of actual main CI and user-started Package handoff. data_next_slice owns058 installer preparation/report; frontend_next_slice independently reviews059 main/Package readiness. Earlier no-main/no-settings rules are superseded only for this bounded main/origin work. No AWS, CodeBuild, secret, delivery flag/access setup, automatic publication or agent-started Package/Deploy is authorized. The learner remains the manual workflow/publication starter.

Root verified actual latest feature CI42195237272 atcc34dfa, clean worktree and fast-forward ancestry after fetch, then published main from6976ca9 tocc34dfa without rewriting history/deleting branches. Only the public exact DELIVERY_ORIGIN was set/read back; repository DELIVERY_ENABLED is absent and aws-learning environment does not exist. Package is registered/active. Independent review059 found no confirmed source blocker. Actual main CI42196363418 is pending observation; ordinary CI is not a manual Package run. Native Windows PostgreSQL installer preparation does not establish installed binaries/service, local credentials or a running database. Read057/058 for current exact evidence and learner steps.

Local installer preparation058 is complete: the actual official PostgreSQL18.6-5 Windowsx64 installer was downloaded under ignored .local/postgres/setup; exact414966472bytes/hash match the published EDB sidecar and Authenticode is Valid for EnterpriseDB Corporation. Root independently verified the saved hash/signature. No installer was executed or local service/cluster created. The next local learner action is only opening the verified file and stopping at Welcome. Main CI remains at browser installation at this checkpoint; user-started Package handoff waits for observed main success. Save the record locally and avoid a second main push cancelling the active main run.

Main CI42196363418 atcc34dfa has now actually completed successfully in both required jobs; ordinary CI is distinct from a manual Package run. The learner completed the native PostgreSQL installer using the general multi-project D:\PostgreSQL\18\data path, port5432 and observed service postgresql-x64-18. Root verified client18.6, Running service and a ready loopback listener. No authenticated SQL session, project database/roles, actual SQL configuration or local persistence is established yet; administrator credentials stay local. Respect the now-shared instance and do not use CI restart/setup helpers against it. Next guided step is a password-prompting local psql connection. Reports057/058 distinguish preparation from installed status; no AWS or Package/Deploy action occurred.

## 5.45. Guided local database and password runner060 — in progress

The learner continued the approved local PostgreSQL preparation. Actual psql output showed PostgreSQL18.6, UTF8, D:/PostgreSQL/18/data and5432; listen_addresses was initially*. The learner executed ALTER SYSTEM SET listen_addresses='127.0.0.1', exited psql and explicitly restarted only postgresql-x64-18 in Windows Services. A later actual SHOW listen_addresses returned127.0.0.1. Service/readiness checks were successful; OS connection inventory did not return usable rows and is not the listening-address proof. The actual authenticated SQL output is the evidence. The learner then queried pg_hba_file_rules: six local/loopback records use scram-sha-256, with empty error fields. This view describes current authentication-file contents, not an independent record of the last reload.

The learner reported successful creation of platypus_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE, privately set its password through psql password prompt, created platypus_service OWNER platypus_owner, created platypus_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT and privately set its password. A transaction revoked all database privileges from PUBLIC and granted only CONNECT to platypus_app; the screenshot included GRANT/COMMIT. No secret was collected by agents. These names/grants have not yet been independently queried by the application driver; do not silently adopt/reset another existing database.

Root assigned backend_next_slice the bounded local runner060 and frontend_next_slice independent review061. The runner provides only explicit migrate/seed/check/serve actions using existing commands, fixed local project target, owner for setup and app for serve, a hidden private password prompt and child-only environment. It neither provisions roles/databases nor controls the shared service, installs tools or stores passwords. No automatic sequence, build, seed, cloud operation or fixture/Lambda change. Root owns shared records/Git. Actual local migration/schema/seed, runtime table SELECT grants, owner/application authentication and local HTTP/browser demonstration remain pending the learner's explicit next commands. Do not use CI-only disposable database helpers or restart the shared instance as an application test.

Actual main documentation checkpoint2874a4473b0d047d51a9f275b37a247f29c425c2 passed CI42201229476 in both required jobs. Package remains user-started and unperformed; no CodeBuild or AWS setup/execution/publication occurred. Preparing this runner does not expand application write/authentication or cloud scope.

Runner060 is implemented and independently reviewed061 for migration-only preparation. An initial owned-child cleanup status gap was corrected and rereviewed. PowerShell5.1 syntax, fake child/action/role/secret-environment guards, parent-environment preservation, invalid action/native exit, harmless owned-child cleanup and lint/format checks passed; root also reran the fake sentinel harness. No real password or database operation was performed by agents. Next learner command is powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\postgres-local.ps1 -Action migrate with the private owner password. The execution-policy override applies only to that new process; no global policy change. Actual local migration result is pending and separate from already verified disposable CI SQL. See060/061.

Native demonstration062: the learner successfully applied migration001, seeded tickets-demo-v1, granted the runtime role schema USAGE/table SELECT, and started the explicit PostgreSQL backend with the private app password. Root independently verified HTTP200, all25 canonical records and no-store; the learner then confirmed the standalone Support page on5175 displays them. Actual main CI42205589456 atfe8bb0533180bf6f0da703f51a6ff511d5b6cb2b passed both required jobs. Earlier pending statements above describe the prior checkpoint. Native interactive Ctrl+C/API restart recovery remains the next check; preserve the shared database service and do not claim native post-seed database-service restart or edit persistence yet. No cloud/Package/CodeBuild execution occurred. See docs/implementation/062-local-postgresql-demonstration.md.

Native backend recovery062 is now demonstrated by learner screenshots: after the guided Ctrl+C step the backend terminal returned to a prompt while Support remained available and showed the unavailable/Retry state. Restarting the explicit PostgreSQL serve entry restored the25-ticket table without a reported migration or reseed. The shared database service was not part of this stop/restart action. This supersedes the pending native API recovery statement above; native database-service restart/edit persistence and exact descendant-process cleanup assertions are not inferred from screenshots. Local read-only demonstration is accepted; safe real artifact receipt remains pending and only the learner may start Package/publication.

## 5.46. Real Package archive validation063 - completed

The learner manually started Package #1 on main atfe8bb0533180bf6f0da703f51a6ff511d5b6cb2b. Actual run42210518228/attempt1 succeeded in real PostgreSQL, complete checks/builds and receipt jobs. Root bound the externally recorded receipt job127869263864 to immutable repository/owner IDs and artifact13497649360, then used unchanged reader051 to authenticate/download and verify the real archive locally. Archive SHA256, external envelope SHA256, exact source/run/origin, bounded ZIP and full bundle inventory passed. The actual archive was337499bytes; unpacked result1008699bytes with39 inventory files plus envelope. Local altered bytes and wrong external envelope were rejected; no failed extraction remained. See report063 and ignored .local/ci/package-one-verified.json.

This supersedes earlier pending manual Package/authenticated-download statements. No agents dispatched Package, and no Deploy, CodeBuild, cloud setup/access/state/import/publication or delivery enablement occurred. Actual CodeBuild access/execution and human-only AWS credential separation remain unverified. Artifact retention is one day; verification is preparation evidence and does not authorize publication. Local PostgreSQL read-only recovery062 is also demonstrated. The100000-ticket data/querying and later cloud database stages remain separately scoped future work, with costs verified before provisioning.

## 5.47. Parallel100000-ticket local querying064-069 - implemented and hosted-verified

The learner approved the coordinator contract plus parallel data/backend/frontend implementation. Read docs/architecture/064-large-ticket-contract.md for exact bounded query semantics, response shape, lane ownership and verification. Use separate platypus_service_large / marked platypus_service_large_test databases; preserve the existing25-record local/public demo and running native services. Data065 owns deterministic generator/transactional repeat-safe loader, backend066 owns validated parameterized bounded queries, frontend067 owns paged Angular controls, root068 owns shared integration/CI/runtime modes and measurement, independent review069 follows. Exactly100000 fictional records, server-side search/filter/sort and25/50/100-page sizes are the acceptance target. Native database/password actions remain learner-local; agents can test only owned disposable GitHub databases. No AWS/CodeBuild/Package/Deploy execution, cloud access/settings/state/secret changes or paid dependency. Hosting costs/authentication/writes remain later stages.

Integrated064-068 checkpoint: all three authors handed off source/reports. Root full types/builds passed;36 server,7 integration,4 startup,9 offline AWS-package/browser and46 delivery checks passed. Root corrected old five-file inventory expectation for the new dependency-free parser module and reviewer measurement feedback to explain the actual HTTP query SQL. Native runner fake-child sentinel checks passed all8 actions without any real DB connection. Initial independent source review069 found no confirmed blocker; actual marked100000-row hosted SQL/browser/measurements and final review are still pending. Only ordinary feature-branch CI may be started through an authorized source push; no agent Package/Deploy/CodeBuild/AWS operation. See report068.

Final064-069 source d080a619a95a2ac67539f9a06c3cddd1dc96ccc6 passed complete CI42241329658 in both actual PostgreSQL and Windows jobs. The separate real SQL100000-row suite8/8, bounded HTTP/all14sorts/date/filter/search checks and actual Angular paging/empty/Retry/initial-sort/reset assertions passed. Twenty browser responses never exceeded100 rows. Final warm loopback first-page median103.26ms, deep-page124.34ms, last-page134.93ms and initial browser render330.25ms on the recorded GitHub runner; not AWS forecasts/product limits. Reports068/069 preserve the initial browser failure and fixes (exact accessible select labels and dynamic initial/reset sort selection). Native platypus_service_large creation/seed/grants and learner acceptance are still pending; existing local25-record/publicdemo unchanged. No Package/Deploy/CodeBuild/AWS/settings/access/state changes.

## 5.48. Native100000-ticket database and visible table070 - demonstrated

The learner explicitly created separate platypus_service_large, restricted database CONNECT, applied migration001 and seeded100000 tickets/100organizations/40agents. Actual check output showed contentMatchesSeed:true,14286unassigned,25000eachstatus and six indexes. The learner granted only business-table SELECT/schema USAGE to app, started the large API3001/frontend5176 with private passwords and confirmed the visible table works. Root independently read actual local pages25/50/100 with total100000, page2nonoverlap,100/40directory counts and New filtered total25000. See report070 and ignored .local/evidence/native-large-http.json.

This supersedes pending native large setup/initial-render statements above; full native UI exercise is not inferred. The learner then selected Status New and confirmed25000matching tickets with New rows, accepting the approved local read-only100000-ticket slice. Next proposed separate stage: verify current AWS PostgreSQL hosting availability and costs before choosing/provisioning cloud resources. Current native services/data and publicfixture are preserved; no AWS/CodeBuild/Package/Deploy/access/state/settings changes occurred. Cloud database/authentication/write/column-interaction stages remain separate.

## 5.49. AWS PostgreSQL feasibility071 - read-only account and base pricing verified

The learner approved step1 research on November6. After learner-local renewed login, official AWS MCP actual STS/FreeTier/RDS reads succeeded: existing project account, FREE/ACTIVE, USD120credits, expirationMay4,2027; PostgreSQL18.6/db.t4g.micro/gp3 minimum20GiB is orderable in eu-north-1, with no existing regional RDS instances. Public regional catalog plus Python Decimal yields USD14.08/month for730hours of Single-AZ micro compute and20GiB gp3, before credits/tax and additional architecture costs. This is not a full application estimate or a cost cap. Read docs/research/071-aws-postgresql-feasibility.md.

AWSServiceRoleForRDS is absent (NoSuchEntity), which is normal before first use and does not prove a permission denial. Full creation/service-linked-role/Lambda-networking authorization and private network/credential/migration costs remain unverified. No mutation was used as a permission test. Next separate proposal: design/price the private application connection and learner-controlled cloud migration path. Preserve Free plan, existing publicfixture, local databases/processes and learner-only publication. No cloud/access/settings/Package/Deploy/CodeBuild or application changes occurred.

## 5.50. Neon Free research072 - proposal, no hosting selection or provisioning

The learner asked to study Neon after comparing RDS costs and free PostgreSQL options. Primary current docs confirm PostgreSQL18,1GB/project,100CU-hours/month,5GB egress and mandatory five-minute idle suspension. Exhausted compute/egress pauses service; this is not an unlimited always-on promise. Neon currently lists Frankfurt/London but not Stockholm; Frankfurt is a proposed external data-placement exception, not an agreed move. See docs/research/072-neon-feasibility.md for limits, repository gaps and a staged validation plan.

Current runtime/setup guards are deliberately local-only and current Lambda uses fixtures. Separate TLS/cloud setup/runtime/package work and actual Neon checks remain necessary. Next small step is learner-private app-role read-only local database-size measurement; no native password or Neon connection string is requested in chat. No account/project/role/data/cloud/access/settings/dependency/publication change is authorized by research. Native services/publicfixture,100000-ticket requirement, Cognito direction and learner-only publication are preserved.

## 5.51. Neon connection preparation073-075 - locally verified, awaiting learner acceptance

The learner's private app-role size query showed54MB whole native database and46MB tickets including indexes. These are rounded physical measurements, not actual Neon storage metering. The learner then explicitly approved step1 of the Neon preparation plan: separate opt-in TLS/bounded pool/failure recovery code and offline checks. Read docs/architecture/073-neon-connection-contract.md for scope, ownership and acceptance. Root owns shared integration/Git; backend author074 owns connection module/tests/report and independent reviewer075 follows.

Implementation074 is complete on feature/neon-connection: explicit validated configuration, verified TLS, maximum two connections/outstanding operations, bounded read-only transactions, sanitized failure handling, late-work cleanup and idempotent close. Failed SQL is never replayed automatically; a later explicit Retry starts a fresh operation. New tests are registered in the existing server test command; no workflow was dispatched or changed.

Coordinator verification passed: server build; all five workspace typechecks; repository lint and formatting; 51/51 server groups including 15 new Neon groups; 7/7 integration, 4/4 startup, 9/9 offline AWS-package and 46/46 offline delivery groups. The author and independent reviewer each also ran the focused 15/15 groups. Real pg TLS checks use owned loopback protocol fixtures, not a real database. Independent review075 found no remaining confirmed blocker within step1. See reports074/075 for resolved initial failures and unverified service behavior.

No remote connection/account/project/role/schema/seed/Lambda wiring/package publication/AWS/access/settings/secret change occurred. Current Lambda remains at a 3-second timeout, while this opt-in adapter uses a 15-second overall operation deadline; future integration must align these budgets. Native processes, local guards, public fixture, Free plan and learner-only publication are preserved. Actual Neon compatibility, sleep/wake, grants and quota consumption remain unverified. Regional placement and creating Neon remain separate future decisions. Next proposed step is preparing migration/100000-ticket loading tools after learner acceptance; it is not started by this completion.

## 5.52. Actual local-to-Neon migration076-080 - locally verified preparation

After step1 the learner created Neon platypus-service/production in Frankfurt on Free. Screenshots confirm PostgreSQL18.6, neondb and neondb_owner. The learner selected fixed0.25CU/five-minute idle sleep; a post-Save state read is not separately demonstrated. This supersedes earlier no-project/no-placement observations and preserves AWS app regionStockholm. The learner approved a clear, tested migration scenario on November6,2026, with manual execution only after code/tests/review.

Contract076 defines a bounded actual-data transfer of the three current business tables, not fixture regeneration or a full database backup. Snapshot author077 and transfer author078 work separately; root owns runner/CLI/shared tests/isolated actualSQL/runbook079 and independent reviewer080 checks integration. Preserve native source/services, current publicfixture and learner-only publication. No user-data export, real Neon connection/import, account/access/secret/cloud changes, Package/Deploy/CodeBuild or runtime wiring is authorized by preparation. Root may use only a new marked ephemeral local PostgreSQL cluster with synthetic100000rows for actual test verification; no native project/password or service helper is used.

Preparation076-079 is implemented locally: consistent actual-data export, canonical bounded typed snapshot/SHA pinning, offline inspect, confirmed strict-TLS direct-Neon import and read-only verification; unchanged source/unknown target refusal, one transaction for target DDL/data/indexes/ledger, exact rerun checks and no automatic replay/cleanup. The separate limited runtime role is NOLOGIN; password/login activation and application integration remain later work. See runbook079 and independent review080.

Actual new marked disposable PostgreSQL18.6 integration passed seven groups with100000edited synthetic rows, including concurrent-edit snapshot consistency, late-batch fullrollback/retry, exact hashes/indexes, role permissions, drift/unknown-data refusal and source preservation. Total testelapsed237925ms includes multiple full operations and is not a Neon timing estimate. Final local server build/all five typechecks passed; focused migration groups14+13+7passed. The complete server/lint/format result is recorded in review080. No learner-data export, Neon connection/import, cloud/settings/access/secret change or publication occurred. Stage acceptance and first learner-local export remain pending; no runtime cutover is implied.

## 5.53. Saved checkpoint, learner migration and local Neon backend081-084 - approved and in progress

The learner explicitly approved saving progress, actual migration to Neon, connecting the backend and checking connectivity on November7. Root saved reviewed070-080 in f02388cef69a8c594eae079331a7ffffe70dd003 on feature/neon-connection and pushed it. Actual ordinary CI42355608827 succeeded in both jobs; main and AWS remained unchanged. This supersedes older uncommitted/unpushed and preparation-only limits only for the approved manual Neon/local backend stage. AWS/CodeBuild/paid upgrades/publication remain outside scope, and only the learner enters passwords and starts the actual migration/access operations.

Contract081 defines isolated backend082, rootintegration/evidence083 and independentreview084. Explicit Neon runtime uses restricted app credentials, startup effective-role/identity probe before localhostHTTP3002 and separate frontend5177. Source local modes/guards/services and the publicfixture are preserved. Necessary app-role setup uses reviewedNOLOGINSQL, existing-role privatepasswordreset and guardedLOGINactivation; owner credentials never serve application requests.

Local runtime preparation passed server98/98, startup4/4, integration7/7, server build, all5types, lint/format and4isolated actualSQL/HTTP groups, including column-only write and unrelated-schema ownership refusal beforeLOGIN. Independent review084 records its separate13group rerun. Real Neon verification still requires the learner steps below.

The learner completed read-only source export neon-transfer-20261107-01; receipt and coordinator offline inspect confirm100000tickets,100organizations,40agents and matching SHA/fingerprint (report083). Runtime checkpoint d7d3670 is saved/pushed. Its hostedCI42357274281 passed actual PostgreSQL/lint/format/types/builds but failed Test built server; the learner supplied the detailed log, identifying only the PowerShell runtime fake-child success test (97/98 passed). A test-only diagnostic follow-up adds bounded stage/line/HResult annotations to owned temporary copies; production wrapper and database logic remain unchanged. Diagnostic CI42361035120 exposed failure inside the old test-only mocked secure prompt before Node/database startup; generic HResult does not establish EOF versus conversion cause. The corrected test driver uses a deterministic private fixture queue and actual SecureString, retaining all assertions and the unchanged production wrapper. Focused4/4 passed; independent/full/hosted verification follows before import. Local full CI=true98/98 and independent13newgroups did not reproduce it. Hold actual Neon import until that CI failure is understood; no real Neon import/verify/roleactivation/connection is yet confirmed. Preserve source/snapshot and keep passwords private.

Final correction8d18ffad0acc76c3bda1b4efedc9d7ba23f24c60 passed actual ordinary CI42361746703 in both required jobs, superseding the preceding hosted-pending statements. The failure was inside the old test-owned mocked secure prompt; a deterministic queue preserves real SecureString/child credential assertions and the unchanged production wrapper. Coordinator local100/100 and independent4/4 also passed. This clears the test gate for the already approved learner-started exact-snapshot import/verify and subsequent restricted-role/local runtime connection. No real Neon SQL or AWS publication has yet been confirmed. Reports083/084 record full evidence.

Latest November7 live import: learner terminal receipt confirms exact snapshot neon-transfer-20261107-01 imported:true into confirmed direct Frankfurt neondb as neondb_owner,100000tickets/100organizations/40agents, with snapshot/artifact SHA and data fingerprint matching prior export/inspect(record083). This supersedes no-real-Neon-SQL/import observations above. The importer performed its reviewed checks before commit; next is learner-started explicit read-only verify, then restricted app identity/private password setup and local pooled backend check. No agent received a password, source data was unchanged and no AWS publication occurred.

Latest November7 remote verification: learner separately ran -Action verify on the exact imported snapshot/directtarget and received verified:true with100000/100/40, matching snapshot/artifact SHA and full data fingerprint in083. This supersedes pending post-import verification statements above. Data transfer/verification is confirmed by learner receipts; next approved steps are restricted NOLOGINapp-roleSQL, private existing-role password setup, guardedLOGIN and real pooled local backend/browser verification. No app-role/runtime connection or AWS publication is yet confirmed.

Latest November7 role/password follow-up085-087: learner guardedLOGIN succeeded and app role appeared in Roles; actual ConsoleReset then failed because the role has no initial password. A reviewed local hidden-prompt alternative is implemented, preserving exact restricted role/TLS/target guards and changing only the password, with no secret in SQL Editor history/files/arguments/output. Author10unit/root3PSfake/independent13newgroups passed; rootfull113/113/lint/format and freshownedPostgreSQL6SQL/HTTPgroups passed with owned teardown. Reviewed implementation f3ec41d is saved/pushed; actual ordinary CI42380207600 passed both PostgreSQL and Windows jobs, including all113 server tests. The learner-only initial-password command is ready, then existing pooled check/serve/browser. Actual app password and runtime connection remain pending; no AWS publication. Reports085/086/087 and083 hold details.

Latest November7 input recovery088-089: On November 7, the learner ran the initial-password command and received its generic unconfirmed result, then ran the pooled app check and received failure. In a subsequent length-only question the learner explicitly confirmed the new app password had fewer than20characters; no password was shared. The reviewed wrapper rejects that length before Process.Start, so this invocation did not start the password child, connect to Neon or attempt ALTER ROLE. The separate failed app check does not establish a specific authentication/network cause. Follow-up088 adds fixed allowlisted local input diagnostics for empty owner input, app length20..128, repeat mismatch, printable ASCII and owner reuse, before child startup. It prints neither actual values/lengths nor raw exceptions. Local refusal explicitly states no child/remote attempt; after attempted child startup, failure retains the app-check-before-explicit-retry uncertainty handoff. The SQL utility, TLS/target/effective-role guards, grants and data are unchanged. Actual new app password setup and backend connection remain pending. See implementation088 and independent review089.

Reviewed input-diagnostic correction138bca86e33ac9240aa612f7d5b4d736171d24fd was saved/pushed on feature/neon-connection. Actual ordinary GitHub CI42381749299 succeeded in both PostgreSQL integration and Windows checks/builds, including114/114 server tests. Local CI=true114/114, lint/format and independent reviewer4/4 focused Windows fixtures also passed. This is a wrapper/input diagnostic change only; no core SQL/TLS change or actual Neon credential operation was performed. The learner-confirmed short-input refusal preceded child creation. Next: learner privately selects/saves a distinct random32-character printable-ASCII app password, reruns neon-role-password.ps1, then runs the pooled app check only after a confirmed safe receipt. Actual app password setup and connection remain unverified.

Latest actual app acceptance: On November 7, 2026, learner terminal screenshots confirmed a corrected learner-started initial-password run returned operation=set-runtime-password, role=platypus_app, database=neondb, passwordConfigured:true. The learner then separately ran neon-runtime.ps1 -Action check against ep-noisy-smoke-b9rsyiia-pooler.c-7.eu-central-1.aws.neon.tech/neondb as platypus_app with private input and received "Neon connection check passed." This is actual learner-attributed application credential/TLS/identity/effective read-only privilege probe evidence, superseding earlier pending password/check statements. No password was shared with an agent. It does not yet establish HTTP serving, browser data rendering, measured performance or sleep/wake behavior. Next learner step is the existing -Action serve launcher on localhost3002, then Support on5177. Existing native source data/services, imported100000/100/40 dataset, role grants, main/public AWS demo and learner-only publication remain preserved.

Latest local Neon UI acceptance: Following the successful actual app check and guided API3002/Support5177 startup instructions, the learner supplied a populated Support screenshot with status New selected, matching fictional large-data rows and25loaded for the current page. After clarification that Next means table pagination, the learner explicitly confirmed it works. This is learner-attributed visible UI/pagination acceptance of the guided frontend-to-local-backend-to-Neon slice. The screenshot does not show the pagination footer or exact total counts, so it does not separately establish visible25000/100000 totals; full100000/100/40 imported contents were verified earlier. No measured cold/warm latency or actual idle-to-wake recovery has yet been demonstrated. Those remain the next bounded checks before a separately scoped cloud-backend integration. No AWS publication occurred.

Latest idle recovery acceptance: On November 7, 2026, after the guided idle-then-page-request check, the learner reported that everything worked and no delay was noticeable. This confirms learner-observed recovery after idle without a visible error or noticeable delay. It is a qualitative user observation, not measured latency or independent telemetry proving the Neon compute actually suspended. Together with the separate successful pooled app probe, populated New rows and accepted pagination, this completes the demonstrated local frontend/local backend/Neon read-only slice. Actual imported100000tickets/100organizations/40agents were already verified by full-data receipts. The next proposed stage is preparing AWS backend integration with Neon; implementation/publication remains separately scoped, and only the learner starts publication. The learner deferred the custom-domain topic as unimportant for now; do not purchase/register a domain or change DNS/certificates. Existing AWS public demo remains the25-fixture version, main and all data/services remain preserved.

## 5.54. AWS-to-Neon connection preparation090-095 - approved

On November7 the learner accepted preparation after discussing complexity and parallel agents, then asked whether any input was needed. Root proceeds without requiring credentials or extra permission. Contract090 assigns separate backend091, infrastructure092 and candidate packaging/testing093 authors; root owns shared integration094 and independent reviewer095 follows. Prepare and verify source/templates/offline artifacts only; ordinary feature-branch CI is allowed. Existing public AWS fixture release, imported/source data, Free plan and manual-only publication remain unchanged. Actual IAM/SSM availability, learner secret creation and later publication are not performed or implied.

## 5.55. Neon publisher continuation096 — locally verified preparation

On November8 the learner delegated the remaining source edits and local checks to the coordinator, requesting economical work and progress updates. The earlier manual-edit restriction is superseded for this preparation; learner-only cloud setup/publication remains. Existing uncommitted publisher changes are preserved and integrated. The candidate now supports a shared Neon-aware acceptance path, explicit initial role bootstrap/reconciliation, scoped CFN transition, immutable ZIP/inventory publication, retained Neon/fixture recovery, authenticated Package Neon artifact verification, CLI, and a disabled-by-default CodeBuild adapter/buildspec/access-document generator. Read docs/implementation/096-neon-publisher-handoff.md for exact boundaries and remaining operator order. Local120/120 AWS/package/delivery/Neon groups, lint, formatting and diff checks passed; bounded independent read-only review found no confirmed blocker. Hosted CI is pending for this final source; do not claim CodeBuild validation or public cutover from this entry. No main promotion, cloud action or credential read occurs in this preparation.

## 6. Costs — agreed approach

- The monthly budget is unknown; no amount or currency is fixed.
- For learning, prioritize free resources, local execution, free libraries, and fictional data.
- Early AI features can use prepared responses instead of real paid model calls.
- Check cloud service free-use conditions before connection; do not promise resources will be free.
- Before the first action that may create new charges, estimate costs, select limits and a shutdown method, and agree on the specific step with the user.
- Track coding-agent limits and costs separately from application operating costs.
- Consider additional paid services separately as needed.

The user handles AWS account creation, sign-in, and billing details. Do not request passwords, keys, or one-time codes in chat.

## 7. Historical learning exercise — legacy files removed

The following records prior hands-on work completed by the user. The legacy app directory was removed at the user's request before starting the first implementation stage. These entries are retained as learning history, not as a current runnable starting point:

- Former server directory: app/server (removed).
- package.json was initialized, "type": "module" was enabled, and Express was installed.
- server.js was written and started.
- GET /api/health returned {"status":"ok"} in the browser.
- curl.exe confirmed HTTP 200 OK and Content-Type: application/json.
- Server shutdown, connection refusal after shutdown, and response recovery after restarting were verified.
- The user explained why closing the terminal stopped the server with the startup approach used in that exercise.

GET /api/tasks was proposed as the next exercise; its completion was not verified. The course then changed to agent-assisted development.

The source files and installed dependencies for this exercise have been removed. This historical record does not describe a currently runnable application. Future backend implementation and its health checks will be defined in a later stage.

## 8. Decisions still required

The following remain planning questions:

- Detailed permissions and technical implementation of sign-in, invitations, and blocking. Invitations are agreed in section 5.11; the target Cognito and PostgreSQL identity/permission architecture is agreed in section 5.12.
- Ticket channels: the form and conversation are agreed in the main workflow; email integration has not been approved.
- Priorities, categories, attachments, notifications, response targets, and reopening details.
- Visual design and light/dark themes. Eight pages are agreed in section 5.5, dedicated AI Chat in section 5.4, and language rules in section 5.3.
- Detailed large-table behavior, table library selection, and measurable performance targets. Main capabilities and 100,000 sample tickets are agreed in section 5.8.
- Detailed analytics formulas and time boundaries; core metrics are agreed in section 5.9. Apache ECharts and chart presentation are agreed in section 5.10.
- Detailed data schemas, keys, relationships, update rules, and the search index. PostgreSQL/DynamoDB allocation is agreed in section 5.13 and Cognito sign-in in section 5.12.
- Microfrontend integration, shared components, and concrete interaction contracts. Application boundaries and framework allocation are agreed in section 5.6; NgRx SignalStore and state boundaries in section 5.7.
- Backend module boundaries, background job delivery, error handling, and backend hosting. Three Lambda tasks are agreed in section 5.14: article preparation, table export, and AI quality evaluation.
- Article format, detailed permissions, and knowledge base update rules. Core rules are agreed in section 5.2; insufficient-evidence response behavior is in section 5.1.
- AI quality checks and later assistant actions. Conversation history, permissions, and initial AI Chat behavior are agreed in section 5.4; reply drafts and human-controlled sending in section 5.1.
- Agent profile details, isolation, limits, handoffs, and verification. The catalogue is proposed in section 5.15 and skills in section 5.16. Coordinator autonomy is agreed in section 5.17; the monorepo and the repository comparison exercise are agreed in section 5.18.
- Model providers and tools: select them after defining the relevant requirements.
- Stage acceptance checks, AI response evaluation, and error logging.
- AWS architecture, environments, deployment, updates, recovery, and cost estimates.

The 100,000-ticket dataset is agreed in section 5.8. Light/dark themes are not yet approved. Project and conversation language rules are agreed in section 5.3. Draft preparation is agreed in section 5.1, and initial AI Chat roles, history, and behavior in section 5.4. Evaluation details and additional AI features require clarification.

## 9. Current position and proposed next steps

Status assessed November7,2026 from the current checkout, saved reports and the learner's screenshots. This assessment did not refresh live AWS/Neon state. Historical stage sections preserve their dated observations; current results below supersede older pending statements.

| Area                     | Verified position                                                                                                                                                                                                                                                                                                                                                                                                | Remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Application foundation   | Angular Shell/Support, React Analytics and Vue Administration integrate through Native Federation with a shared theme and independent builds.                                                                                                                                                                                                                                                                    | Knowledge & AI application and remaining functional pages; Analytics/Admin currently show placeholders.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Tickets and Node.js      | Real local PostgreSQL read-only API/UI with100000tickets,100organizations and40agents; server search/filter/sort,25/50/100paging, cancellation and Retry. Learner accepted local rendering and New25000filter.                                                                                                                                                                                                   | Column resize/reorder/hide, selection/bulk assignment; protected writes, ticket details and conversations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Local database           | PostgreSQL18.6; shared native data on D:/PostgreSQL/18/data; separate small/large project databases and restricted runtime role. Actual large data is not limited to25fixtures.                                                                                                                                                                                                                                  | Further application identity, permission, conversation and audit models as their features are implemented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Existing AWS demo        | Last verified privateS3/CloudFront/Lambda deployment remains the public25-fixture demonstration.                                                                                                                                                                                                                                                                                                                 | Current100000-row/Neon code is not deployed. Lambda runtime/deadline/credentials integration and learner-started publication need a separate stage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Neon                     | Learner created Free/Frankfurt/production, PostgreSQL18.6/neondb/neondb_owner. Runtime adapter073-075, manual migration076-080 and local backend081-084 are implemented and reviewed; actual hosted CI42355608827 passed for preparation checkpoint f02388c.                                                                                                                                                     | Source export/offline inspect and learner actual import now passed(imported:true,100000/100/40, matching hashes); explicit remote verify also passed(verified:true, matching full-data hashes/counts). Restricted app role and guarded LOGIN are confirmed; reviewed first-password helper passed hosted CI42380207600. Learner private password setup and separate pooled app connection/privilege probe are now confirmed. Guided populated UI and pagination are accepted by learner evidence. Learner also accepted idle recovery without visible error or noticeable delay. Remaining: cloud integration preparation and usage/measured latency checks; exact UI total counts were not separately visible. Selected0.25CU Save result is not separately read. |
| Migration verification   | Review080 is saved with no remaining confirmed preparation blocker. Coordinator98/98servergroups, build, all5typechecks, startup4/4, integration7/7 and lint/format passed; local backend role/probe/HTTP additionally passed4ownedSQLgroups; isolated realPostgreSQL18.6 integration7groups passed on100000edited synthetic rows, including rollback/retry, drift/refusal, permissions and source preservation. | Learner actual export and coordinator offline inspect passed; corrected hostedCI42361746703 at8d18ffa resolved the earlier mocked-prompt failure; learner actual import returned imported:true with matching hashes/counts. Separate learner remote verify returned verified:true with the same counts/hashes. Restricted role, LOGIN, private password setup and pooled app probe are confirmed; populated UI, pagination and qualitative idle recovery are learner-accepted; measured latency/usage and further cloud integration remain pending.                                                                                                                                                                                                                |
| Git/CI                   | Public repository and ordinary GitHub Actions CI have been successfully hosted-verified in earlier stages. Package#1 and its actual downloaded archive were checked in063.                                                                                                                                                                                                                                       | Reviewed preparation070-080 is saved/pushed as f02388c on feature/neon-connection and ordinary CI42355608827 passed both jobs. Runtime081-084 and test-driver correction are saved/pushed on feature/neon-connection; final8d18ffa ordinaryCI42361746703 passed both jobs after mocked-prompt diagnosis. Main/publication remain unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Delivery                 | Exact-source packaging, archive identity/integrity checking and offline publication/recovery preparation exist.                                                                                                                                                                                                                                                                                                  | CodeBuild setup/access/artifact handoff and human-only publisher credentials remain unconfigured; no agent-started Package/Deploy/CodeBuild or automatic deployment. Keep DELIVERY_ENABLED absent/false.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Sign-in and permissions  | Cognito sign-in plus PostgreSQL application profiles/roles/organization boundaries are agreed.                                                                                                                                                                                                                                                                                                                   | Implementation, invitations/recovery/blocking, server token checks and effective request-level permissions. A database role is not application authentication.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Further product features | Requirements exist for analytics, administration, knowledge base, private AI Chat/RAG and background jobs.                                                                                                                                                                                                                                                                                                       | Functional React metrics/charts, Vue management, Knowledge & AI, DynamoDB private conversations and the3agreed article/export/quality-evaluation jobs. Sonar remains deferred.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Proposed next sequence, with separately agreed execution/integration stages:

1. Reviewed migration preparation is saved in Git with ordinary hosted CI passed. Final runtime/test checkpoint8d18ffa is saved/pushed and actual hostedCI42361746703 passed both jobs. Source export, offline inspect, learner-started Neon import and separate full-data verification have all passed using runbook079. The reviewed initial-password follow-up f3ec41d also passed hostedCI42380207600. Keep source data/services intact.
2. The limited local Neon backend/check launcher is implemented and reviewed. Privately activate/validate the actual runtime identity and server-only credentials, connect Node.js to the real database, test cold/warm access/recovery and align the current3secondLambda budget with the prepared15secondadapter. Prepare the cloud change for review; only the learner starts publication. Application remains in Stockholm and Neon in the selectedFrankfurtregion.
3. Add Cognito sign-in and server-enforced current profile/role/organization/blocking checks, then authorized ticket creation/update/deletion policy, details, assignments/history and customer-support conversations. Define deletion semantics before introducing it; no deletion endpoint exists now.
4. Complete agreed large-table interactions and bulk actions, real React Analytics and Vue Administration within those access boundaries.
5. Implement the knowledge base/private AI Chat, source-grounded retrieval, DynamoDB history and the agreed background jobs with separately scoped model costs/evaluation.

Sonar remains deferred at the learner's request. There is no percentage-complete estimate or implied provisioning, paid upgrade, remote SQL or publication authorization in this status assessment.
