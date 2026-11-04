# Platypus Service — Learning Project Plan

Updated: November 4, 2026.
Project directory: D:/Projects/Pet-projects/aws.
Current phase: parallel PostgreSQL planning tasks 016/017 complete and independently reviewed under 018. Local installation and persistence implementation await the next approved stage.

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

- Use 100,000 fictional tickets in the shared learning dataset to test substantial data volumes. The dataset has not been generated yet.
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

## 9. Proposed next steps — subject to refinement

The user confirmed the Native Federation application works. Before checkpoint 010, a read-only Git check on November 4, 2026 confirmed that the directory was not yet inside a repository; checkpoint 010 subsequently created the baseline recorded below.

1. Completed checkpoint 010: local main repository, verified ignore/LF policies, independent review 011, and initial commit 6d07da7 containing 78 authored files. Post-commit checks confirmed a clean worktree and no remotes. Assignment: docs/agent-tasks/010-git-baseline.md; evidence: docs/implementation/010-git-baseline.md; review: docs/reviews/011-git-baseline-review.md. Completion documentation is recorded in a separate follow-up commit so no pre-commit claim substitutes for verification.
2. Task 012 is implemented and locally verified: independent Angular Support, Tickets navigation, 25 temporary fictional records, shared styling, SignalStore state, loading/empty/error/retry, and cancellation cleanup. Independent review 013 found no remaining confirmed blocker, commit 9163b2d saved the reviewed stage, and the user confirmed the visible table works. Server querying, authorization, PostgreSQL persistence, and full heavy-table behavior remain later agreed work.
3. Task 014 is implemented and locally verified: an independent local Node.js server supplies GET /api/health and GET /api/tickets with the same 25 examples in an items/total response. Support loads through its configurable adapter and retains loading/error/Retry/cancellation behavior. Independent review 015 found no remaining confirmed blocker; commit 5532511 saved the reviewed stage and the user confirmed the server response. See section 5.23 and docs/implementation/014-local-ticket-server.md. PostgreSQL persistence follows as a separate stage.
4. Completed parallel planning 016/017 and independent proposal review 018; see section 5.24. The recommended next route is native local PostgreSQL with a three-business-table model, explicit migration/seed commands and replacement of the existing repository. User selection/approval of local setup precedes installation; define the bounded persistence implementation afterward. Later stages add identity/access, large tables, analytics, RAG and AI quality checks.
5. Agree on costs before paid connections, then deploy to AWS.

Refine this plan throughout the course. Architectural assumptions and prepared plans must not be recorded as completed implementation.
