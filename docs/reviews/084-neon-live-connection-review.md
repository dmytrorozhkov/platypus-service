# Independent Neon local runtime review084

Date: November 7, 2026. Result: no remaining confirmed blocker in the reviewed local runtime and operator preparation; actual learner migration and Neon connectivity remain pending. Scope: approved contract081, local opt-in runtime preparation and learner-started migration/connectivity evidence. This review does not authorize or claim AWS publication. The reviewer never used learner credentials, the native project database or a Neon endpoint.

## Independently inspected source and checks

Reviewed contract081, the existing migration runbook079, restricted runtime-role.sql, activate-runtime-role.sql, the new neon-runtime.ts and neon-main.ts, their focused tests, scripts/neon-runtime.ps1, support-neon static frontend configuration and the reused PostgreSQL runtime/Neon connection lifecycle. The existing native runtime, fixture main/Lambda and AWS delivery paths remain separate.

The reviewer independently ran:

```powershell
node --test apps/server/test/neon-runtime.test.mjs
node --test apps/server/test/neon-runtime-runner.test.mjs
```

All 11 runtime groups passed, without skipped or cancelled tests, first in 3088ms and again in 2056ms after the final guarded IPC-disconnect correction was compiled. The two Windows runner groups also independently passed in 2267ms. These include real HTTP on owned ephemeral loopback listeners, fake database connections, child-process argument/import checks and real Windows PowerShell with substituted console prompts and a fake built child. No actual credential was entered. They do not establish a live Neon handshake, remote permissions or a real migrated dataset. The coordinator owns shared builds, integration and any learner-attributed live evidence.

## Assessment

- Explicit runtime configuration accepts only pooled Frankfurt Neon DNS, neondb, platypus_app and exact hostname/database confirmation. Owner credentials and unrelated regions are refused before connecting. Existing fieldwise configuration retains verified TLS, bounded two-connection pool, operation deadlines and no automatic SQL replay. Secrets stay server-side.
- A read-only startup probe runs before HTTP listen. It validates PostgreSQL18/UTF8, current/session identity, effective schema/table/column privileges, LOGIN and administrative flags, direct memberships and object ownership. Rejection closes the owned adapter and never serves fixture fallback. A database role is not application authentication or organization authorization.
- Existing localhost-only repository/routes and HTTP lifecycle are reused through an explicit adapter shim. Successful requests preserve paginated queries, no-store and allowed-origin behavior. Health remains query-free. Stop before/during probe prevents late listen; startup/listen failures own cleanup; in-flight HTTP drains before adapter close. Runtime and pool cleanup budgets are separately bounded.
- The executable is inert on module import and requires exactly check or serve. Check closes resources without opening HTTP. Optional parent stdin accepts only bounded stop control, observes EOF/error and removes listeners. Diagnostics are fixed messages; private driver text/codes are not forwarded.
- The PowerShell wrapper selects the reviewed built command, confirms the pooled target, privately prompts for the app password and passes explicit values only to its exclusively owned child environment. Temporary password copies are cleared; stderr is replaced with fixed diagnostics. Its stop/forced fallback targets only its own child tree. No service, arbitrary PID, cloud publisher or native PostgreSQL operation is invoked.
- The restricted role is created with SQL, rather than the default elevated new-role Console/API flow. Login activation is separate from private password reset of that existing role; effective permissions must be probed again afterward. No password is embedded in SQL/history/tracked configuration or requested in chat.

## Review finding and correction

Initial activation SQL tested table-level write privileges only. PostgreSQL can grant INSERT, UPDATE or REFERENCES on individual columns without a table-level grant; that would pass the original guard despite retained write access. The runtime probe already included has_any_column_privilege. The coordinator applied the same check to activation; the reviewer inspected the corrected guard and the owned PostgreSQL regression that first establishes table-level UPDATE=false, then requires activation to fail while preserving NOLOGIN. Its actual coordinator execution is recorded below. A second harness resilience finding was corrected: failure of runtime.stop must not skip closing owned clients and stopping the marked disposable cluster. No production permission check was weakened.

Activation initially refused ownership of only the business schema, while the runtime correctly rejected ownership of any schema. The coordinator aligned activation with the runtime's any-schema predicate and added an unrelated-schema ownership sentinel to the owned PostgreSQL check. This prevents activating an unexpected object-owning identity before the app-side probe can reject it. The final source predicate was independently inspected. The standalone-mode error message also now lists support-neon.

Primary sources checked during review: [PostgreSQL18 access privilege inquiry functions](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE) and [Neon role management](https://neon.com/docs/manage/roles). In particular, resetting an existing restricted role must not be confused with creating a default Console role with neon_superuser membership.

## Final integration and live evidence

The coordinator reports that the reviewed previous checkpoint070-080 was saved as f02388cef69a8c594eae079331a7ffffe70dd003 and ordinary push CI42355608827 passed both required jobs. This is not a new runtime publication, Package/Deploy run or default-branch promotion. Runtime081-084 has a separate subsequent checkpoint and ordinary CI boundary.

The coordinator's final checks passed: server build, all five workspace typechecks, complete registered server suite98/98 with no skips, startup4/4, integration7/7, repository lint and formatting. The reviewer independently ran the 13 new focused groups described above and independently checked whitespace; the shared totals are attributed to the coordinator rather than claimed as reviewer executions.

The coordinator's fresh owned PostgreSQL18.6 integration exited successfully with four real SQL/HTTP groups. Final activation refused both column-only UPDATE and unrelated-schema ownership, preserving NOLOGIN on refusal; the exact restricted identity then activated and passed the real probe. Privilege/flag drift was refused; actual paged HTTP/options/health, localhost CORS and idempotent owned shutdown passed on three synthetic rows. The owned cluster was stopped. This injected local transport bypasses Neon TLS/pooling; these results validate SQL/probe semantics, not the remote service. Earlier100000-row transfer evidence remains the separate migration stage079/080.

The reviewer did not initialize another database or rerun shared builds. [Report083](../implementation/083-neon-connection-progress.md) records the exact learner commands and live handoff. At review time the first hidden-password source export was handed to the learner, but no export receipt or actual import/verification/runtime result had been supplied. The reviewer confirms no live success from local tests.

The public fixture Lambda remains unchanged; its existing three-second timeout is not integrated with the opt-in fifteen-second Neon adapter. Real migration/TLS, pooled startup acceptance, cold/warm/wake behavior and final learner browser acceptance must be reported from actual observations rather than inferred from local tests. Existing native services/data remain preserved; no owner credential belongs in the serving runtime and no secret is needed in chat or tracked files.
