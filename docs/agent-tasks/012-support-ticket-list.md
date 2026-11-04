# Agent Task 012 - First Support Ticket List

Status: implemented and locally verified by support_angular; independent review 013 complete with no remaining confirmed blocker. User acceptance pending. The user approved the temporary 25-record source and later Node.js/PostgreSQL integration. Branch: feature/support-ticket-list.
Date: November 4, 2026.
Project: D:/Projects/Pet-projects/aws.

## User-visible goal

Opening Tickets from the Shell menu displays a readable support ticket list in the independent Angular Support application. This is a small read-only product slice, building on the verified Native Federation foundation.

## Approved first slice

- Add Support as a separately built Angular microfrontend, loaded through the existing Native Federation setup.
- Add a Tickets navigation item and the direct route /support/tickets. Preserve existing Analytics and Administration navigation and the current root redirect.
- Display 25 fictional tickets with number, subject, organization, status, assignee, creation date, and last update date.
- Use agreed statuses: New, In progress, Awaiting customer, and Closed. Show Unassigned where appropriate.
- Use the existing shared Tailwind theme with an application-specific prefix. Keep document-wide reset ownership in Shell.
- Present loading, empty, error, and retry states. Errors and empty results must be verifiable through the test data boundary, without developer switches in the product interface.
- Use NgRx SignalStore for Support feature state: loaded items, loading status, and error. Define a small asynchronous data-access boundary with local fictional data so a later server implementation can replace it.
- Start with a semantic HTML table and responsive overflow behavior; this does not select the final heavy-table library.

## Deliberately later capabilities

This slice does not implement sign-in or role enforcement, Node.js endpoints, database storage, ticket creation/details/conversations, search/filter/sort/pagination, bulk assignment, exports, or AI features. Do not add nonworking controls for those features.

The agreed complete product still uses server-side querying and access checks, page sizes of 25/50/100, and a 100,000-ticket learning dataset. The proposed local 25-record prototype is a temporary development data source, not a change to those requirements or a claim of secure user-specific access. It contains no real customer data.

## Architecture preparation inside the approved slice

Before scaffolding, verify the compatible way to build the first Angular remote with maintained Native Federation tooling and the current Angular version. Preserve the current mount/cleanup contract and explicitly handle asynchronous Angular startup if needed: navigation cancellation must dispose of late-created resources.

Choose a free local port and fixture delivery mechanism, add Support to runtime configuration and local startup, and update the existing type-only route contract. Use a distinct official federation runtime namespace consistent with the current no-cross-remote-sharing design; revisit that design before introducing shared Angular runtimes. Record exact dependency changes and decisions.

## Agent workflow and ownership

The user approved this slice. Execution workflow:

1. The coordinator assigns one Angular integrator ownership of the new Support app and required shared integration/configuration files.
2. The integrator verifies compatibility, implements the bounded slice, and runs relevant checks.
3. An independent reviewer checks requirements, lifecycle behavior, state/data boundaries, and verification evidence.
4. Confirmed issues are corrected; the coordinator demonstrates the result and explains it in Russian.
5. Save the reviewed stage in an intentional Git commit, preserving existing user changes. The user accepts the visible result before the next stage.

The Angular integrator support_angular completed implementation and released writer ownership. The independent reviewer frontend_review inspected source, artifacts and verification evidence; the coordinator owns planning/task records and the final Git handoff. Project artifacts, fixtures, interface text, and reports remain English. Implementation and exact command results: docs/implementation/012-support-ticket-list.md.

## Acceptance evidence

- Support builds independently and loads through real Native Federation metadata.
- Tickets navigation, the direct route, refresh, Back/Forward, and repeated switching among all three sections work.
- The list displays the 25 fictional records with all agreed columns and clear status/assignee presentation.
- Loading, empty, error, and recovery states are actually checked.
- Delayed Support startup cannot mount after leaving the route; cleanup removes its roots, styles, subscriptions, and other owned resources.
- Shared theme and existing Analytics/Administration behavior remain intact, with no unexplained healthy browser errors or horizontal page overflow.
- Lint, formatting, typechecks, applicable builds, and meaningful browser/feature checks pass. Report actual outcomes and any unverified cases.
- README and the implementation report document actual startup commands, fixture limitations, dependencies, and what comes next.

No cloud resources or paid connections are part of this stage.
