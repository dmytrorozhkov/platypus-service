# 068. Large-ticket integration and verification

Date: November 6, 2026. Contract064 is learner-approved. Data065, backend066 and frontend067 are integrated on feature/large-ticket-query. This checkpoint records completed local checks; real hosted large-database/browser measurements and final independent review069 are pending until appended below.

## Result and compatibility

The separate large-database workflow generates100000 fictional tickets,100 organizations and40 support agents without tracking a generated JSON dataset. It uses the existing001 schema in a separate database and a guarded, checksummed, transactional seed with provenance for six query-driven indexes. Repeating a seed preserves later changes instead of overwriting them; verification checks exact counts and complete database content hashes. The current platypus_service25-record database was not modified.

The explicit PostgreSQL adapter adds bounded query/options routes with validated server search/filter/sort and25/50/100-record pages. The filtered count and page share one SQL statement snapshot. Angular's opt-in paged mode distinguishes loaded rows from filtered totals and includes search, status/organization/assignee/date filters, seven sort fields, paging, loading/empty/error/Retry and cancellation/stale-result guards. Existing default fixture/Lambda collections and default runtime configuration retain the25-record demo. Column resizing/reordering/hiding and bulk assignment remain later requirements.

Root integrated command aliases, a frontend-only support-large mode and a fixed-target password runner. support-large serves5176 with an in-memory ticket-api-config.json override for localhost:3001 and paged mode; built/default configuration files stay unchanged. Runtime mode isolation is tested using owned ephemeral listeners. The password runner adds explicit migrate-large/seed-large/check-large/serve-large actions for platypus_service_large; large serving uses port3001, origin5176 and the existing app role. Parent environment is unchanged; no secrets are written or passed in command arguments. No ordinary database is created/adopted or service restarted by the scripts.

The shared application now imports a dependency-free ticket-query module. Root added ticket-query.js to the exact six-file Lambda ZIP/bundle inventory and synthetic fixtures so the old public collection still starts correctly. A regression initially retained an obsolete five-file count; root replaced it with the complete explicit file-name assertion and repeated the delivery suite successfully. No publication was performed.

## Local checks actually completed

- Full lint and formatting passed after a control-character regex lint correction and moving cleanup failure propagation outside finally.
- Workspace typechecking and all five application builds passed.
- Server/generator/query suite:36 passed, zero skipped/failed. Root rebuilt the final server and reran the suite after backend hardening.
- Federation/static integration plus actual Angular/NgRx in-memory query/store checks:7 passed. Covers stale completion cancellation, page reset, current-filter Retry and initial options failure recovery.
- Startup/runtime isolation:4 passed, including occupied-port ownership and independent API restart behavior.
- Offline package/browser suite:9 passed. These use test-owned local listeners and an isolated browser; no AWS call.
- Offline delivery/failure suite:46 passed after the exact module-inventory correction.
- Existing infrastructure schema/Guard validation passed offline with informational create-only diagnostics only.
- Windows PowerShell5.1 fake-child sentinel harness passed all eight allowed actions, fixed role/database/port/origin settings, native exit7, invalid-action-before-prompt and parent environment preservation. It used no real credential or database connection. Prior native Ctrl+C demonstration062 is historical evidence for the old serve action; it does not establish a native large-database demonstration.

Independent reviewer069 also ran eight pure/data/Angular checks and found no confirmed source blocker in the initial pass. Reviewer requested that EXPLAIN use the actual materialized count/page statement rather than a simplified predicate query. Root changed the hosted harness to import buildTicketPageQuery/parseTicketQuery and explain the actual emitted SQL and bound values. Actual HTTP timing samples were already planned; no index-use or product-speed claim is inferred from source alone.

## Real hosted verification design

Ordinary GitHub CI retains all existing PostgreSQL25-record migration/permission/browser/same-storage restart gates. Afterwards, GitHub-only setup verifies the current ownership marker and refuses an existing large test database, creates platypus_service_large_test in that same disposable pinned service, marks it independently and applies unchanged migration001. The data suite requires both test flags and the exact marker, checks rollback/repeat/concurrency/content/constraints/readonly privileges, restores canonical100000 rows and leaves them for actual HTTP/browser measurement.

The large harness runs the actual postgres-main process with the test app role on an owned free port. It asserts all fourteen field/direction sort combinations, literal wildcard search, all filters/date boundaries, filtered counts, unique bounded pages, empty out-of-range pages, input limits/errors and legacy read cap. Actual Angular requests pages25/50/100 and checks filter/page reset, dates/sorting/assignee, empty recovery, then stops/restarts only its owned API and exercises Retry. Native Windows PostgreSQL and learner-owned servers remain untouched.

Measurements include five loopback HTTP samples for six query scenarios after warm-up, actual emitted query EXPLAIN ANALYZE/BUFFERS, machine/runtime/database version, initial browser render and observed page sizes. These are controlled learning measurements on a temporary GitHub runner, not AWS sizing, cold-start or production-speed guarantees. Full JSON is saved under ignored .local/evidence/large-postgres-check.json and a bounded LARGE_MEASUREMENTS log entry for coordinator readback.

## Future learner-local demonstration

Only after observed hosted checks and independent review, guide one learner action at a time. The planned separate database is platypus_service_large owned by the existing platypus_owner; an administrator must explicitly create it and grant app CONNECT while revoking PUBLIC database access. Then:

1. Run powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\postgres-local.ps1 -Action migrate-large with the private owner password.
2. Run the same wrapper with seed-large, then check-large, as owner.
3. Grant platypus_app only schema USAGE and SELECT on the three business tables in that new database.
4. Run serve-large with the private app password, then npm.cmd run serve:support:large in a separate terminal and open http://localhost:5176/.

These are future interactive steps, not actions claimed as executed. Do not silently reuse/reset an existing database, stop shared services or ask for passwords in chat. Existing3000/5175 demonstration can stay running; the large mode uses3001/5176. The native large database does not exist by this checkpoint's evidence.

No AWS/database hosting, CodeBuild, Package/Deploy dispatch, access/state/settings/secret mutation, delivery enablement, paid service or Sonar work occurred. Authentication/server-enforced organization permissions and business writes remain later stages. Cloud PostgreSQL selection/costs require separate current verification and agreement before provisioning.
