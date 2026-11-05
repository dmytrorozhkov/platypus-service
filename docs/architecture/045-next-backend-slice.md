# Next backend slice proposal 045

Date: November 5, 2026. Author lane: backend_next_slice. Planning only; no application, package or database changes or tests performed.

Implement one later increment: persistent read-only Tickets through existing TicketRepository.list(): Promise<TicketCollection>. Preserve044's seven-field unpaged response and errors. Both local main.ts and Lambda composition currently select fixtures; a driver implementation alone connects neither runtime. Reuse016's detailed repository/migration proposal. Cloud wiring waits for a separately verified environment, cost and connection strategy.

Backend owner: PostgreSQL repository, explicit row mapping, configuration validation, bounded query/pool lifetime, sanitized failures and lifecycle tests. Data owner: versioned SQL, deterministic identities, seed and integrity tests. Coordinator alone: shared dependencies/lockfile/scripts, runtime composition and integration. Agree the query row shape before parallel coding. Verify driver versions before installing; do not copy local max5 pools into ten concurrent Lambda environments without a connection budget.

Acceptance requires real25/5/3 ticket/organization/assignee counts and HTTP parity; a distinctive test-owned edit survives same-storage database and API restart; repeated seed/migrations preserve edits and IDs; drift/failure/concurrency are safe; runtime credentials cannot write/schema-edit; actual database outage gives a bounded existing500 and Retry recovers; missing configuration fails without fixture fallback or secrets; shutdown drains owned HTTP/pool resources and leaves the independently owned database alive. Preserve existing server/Lambda, frontend, lifecycle and package checks. Mocked success does not establish persistence.

Current origins are not authentication or organization isolation. Before business writes or real organization data, require server-verified Cognito sign-in and current user/role/organization/blocking checks with negative authorization tests. Defer writes,100000-row pagination and real Analytics/Admin until their own contracts. Frontend total===items.length forbids an uncoordinated paginated response.
