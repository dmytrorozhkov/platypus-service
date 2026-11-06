# Independent large-ticket review 069

Date: November 6, 2026.
Initial implementation candidate: `9c33a1120364837110104de18e3a0004b416d17f` on `feature/large-ticket-query`; subsequent select-name/waiter and dynamic sort-selection corrections were also source-reviewed.
Final reviewed source candidate: `d080a619a95a2ac67539f9a06c3cddd1dc96ccc6`.
Reviewer did not author the data, backend, frontend or shared integration implementation.

## Result

No confirmed blocking finding remains after the reviewed corrections. Both required jobs passed in [CI run 42241329658](https://github.com/dmytrorozhkov/platypus-service/actions/runs/42241329658) for final source candidate `d080a619a95a2ac67539f9a06c3cddd1dc96ccc6`. The implementation is ready for guided learner-local setup of the separate large database; that setup and learner acceptance have not occurred.

The review covered contract064 and reports065/066/067, all implementation changes in the candidate, and the shared CI, local runner, static runtime override and package whitelists. Existing demonstration reports062/063 were preserved.

## Source assessment

- Large population uses only actual database names `platypus_service_large` or `platypus_service_large_test`; the disposable target additionally needs an explicit acknowledgment and exact ownership marker. First seed refuses nonempty business tables or unrecorded indexes. The ordinary `platypus_service` target, migration001, old seed and public fixture composition remain preserved.
- The deterministic generator yields 100000 unique tickets, 100 organizations and 40 agents, four statuses and assigned/unassigned examples. Parameterized batches, one transaction, bounded lock/statement waits and the advisory lock protect first/concurrent application. A repeated seed validates content/index provenance without replacing later business edits. Full bounded-output verification compares server-side hashes to the generator; edited content is reported through `contentMatchesSeed:false`, while count/provenance drift fails.
- Query parsing enforces raw-length, duplicate/unknown-key, page-size, search, enum, identifier and real UTC-date limits. Filters use bound values; ordering uses allowlists, explicit null placement/C collation and unique ticket-number ties. Numeric suffix ordering avoids arbitrary-size numeric casts. One SQL statement shares its snapshot between filtered count and bounded page, including empty out-of-range pages.
- Legacy PostgreSQL list reads at most101 rows and refuses more than100; each options directory reads at most1001 and refuses overflow. Existing read-only pool/timeouts remain. Fixture/Lambda repositories retain25 tickets and return404 for unsupported new routes. The new dependency-free `ticket-query.js` module is included in both package inventories, with corresponding archive fixtures and exact inventory assertions.
- Paged Support requests one selected page and bounded options, never all pages. Query changes reset page1, search requires submit, cancellation/request identity prevents stale completions, unmount aborts work and Retry retains current filters. Labelled native controls remain reachable in loading/error/empty states; totals and loaded rows are separate. The in-memory `support-large` override uses5176/API3001 without rewriting ordinary runtime assets.
- CI creates a fresh separate database only after checking the marked GitHub test source. Native runner actions use fixed separate targets and hidden child-only credentials; they create no database/role and perform no PostgreSQL service operation. Browser cleanup acts only on its test-owned child/browser/static server/pools. No new dependency, cloud/access/settings/secret change or publication trigger was introduced.

## Review follow-up

The initial measurement script recorded an EXPLAIN for a simplified illustrative SELECT rather than the actual materialized count/page statement. The coordinator changed it before the reviewed commit to import `buildTicketPageQuery`/`parseTicketQuery` and explain the emitted SQL with its bound values. The reviewer confirmed this correction in the candidate. Endpoint timing samples remain measurements of actual HTTP requests, not a selected product latency guarantee.

An existing bundle test's old five-file expectation failed after adding the required module. The coordinator replaced it with the exact six-file inventory and reported a successful full delivery rerun. The reviewer checked the final assertion and package whitelist consistency; no extra PostgreSQL dependency enters the fixture Lambda archive.

The first real hosted run reached the bounded Angular table and paging, but its exact select-name lookup prevented completion. All six selects now have explicit stable accessible names matching their visible labels. The browser response waiter and action now share `Promise.all`, so an action failure is handled without leaving an unhandled response timeout. The reviewer checked these corrections and the mocked browser evidence; that smoke is explicitly labelled as intercepted responses without SQL. The final corrected candidate subsequently passed the complete real hosted gate.

The coordinator also observed an initial visible sort mismatch: Number appeared while the query used createdAt, because the select value binding ran before dynamic `@for` options existed. Each dynamic sort option now binds its selected state to the current query. The reviewer checked this correction; actual initial/Reset select-value assertions passed in the final candidate's real hosted browser job.

## Verification and limits

Reviewer actually ran `node --test apps/server/test/large-data.test.mjs apps/support/src/app/tickets/ticket-query.test.mjs`:8 passed, zero failures/skips/cancellations. These were memory/source/stub checks, including generator fingerprints, target refusal, legacy/paged reading, actual NgRx cancellation/stale-completion handling and current-filter Retry. They used no database connection, shared build output or native credentials.

Coordinator-reported local verification: full lint/format/typecheck and all five workspace builds;36 server,7 integration,4 startup,9 offline AWS-package/browser and46 delivery groups; offline infrastructure validation; and all8 runner actions with fake child/target/role/credential, native-exit and parent-environment checks. The reviewer did not independently rerun those broad checks or shared builds.

The reviewer inspected the raw log and run metadata for first hosted CI run42239692325 at the initial candidate. Legacy PostgreSQL8 tests and HTTP/browser/restart checks passed; the separate large SQL suite passed8 tests with exact100000/100/40 counts and golden server-side fingerprints. It recorded first seed3207ms, concurrent no-op repeat2984ms and verification231ms. The real API's paging/filter/count/date/literal-search/all14sort checks passed. The later browser waiter timed out and the downstream Windows job was skipped; this is a failed overall attempt, not a successful stage. Source corrections and the coordinator's intercepted-response smoke do not replace a real rerun.

The reviewer inspected completed run metadata for42240575223 at corrected candidate `8c426031961f0bd5825afa5baead4901fd6be363`: both required PostgreSQL and Windows jobs succeeded. The later visible-sort correction and its real initial/Reset browser assertions are in the final source candidate; an earlier candidate's successful gate does not establish the final candidate's complete result.

The reviewer independently read final run42241329658 PostgreSQL job127972065040's raw log and extracted measurement JSON, matching `sourceSha` to `d080a619a95a2ac67539f9a06c3cddd1dc96ccc6`. Its legacy SQL8/8, five legacy HTTP/browser/restart groups, large SQL8/8, all large HTTP assertions and three large browser groups passed. The final harness also asserts initial and reset-createdAt selection and reset25-row size. Twenty successful browser query responses contained at most100 rows. This is actual database/API/Angular behavior on the separate disposable target, including API-only restart/Retry, rather than intercepted responses.

Measured environment: Linux x64, AMD EPYC7763, four logical CPUs,16760344576bytes RAM, Node24.21.0, PostgreSQL18.6. Five warm loopback HTTP sample medians were103.26ms first page,124.34ms page1000,134.93ms page4000,106.01ms subject sort,3.04ms combined organization/status filter and96.46ms literal search. Initial browser render measured330.25ms. EXPLAIN of the actual emitted combined-filter count/page SQL recorded2.346ms execution and the owned organization/status indexes. These narrowly describe that runner/scenario; they are not a chosen product limit, native-machine or cloud performance claim.

The reviewer independently inspected fresh `.local/ci/large-d080a619a95a.json`: run42241329658 is completed/success with the exact final SHA, and both PostgreSQL job127972065040 and Windows Checks and builds job127973067912 are completed/success. The Windows gate includes locked clean install, lint, formatting, types, builds, server/integration/startup tests, offline infrastructure/package/browser tests and delivery regressions. Package-only creation/upload remained skipped in this ordinary push run.

Raw ignored evidence: `.local/ci/large-d080a619a95a.json`, `.local/ci/job-127972065040.log`, `.local/evidence/large-hosted-d080a619a95a.json`. No hosted job was executed by this reviewer; the distinction is between independently reading actual hosted evidence and rerunning it.

No native large database was created, seeded or authenticated by this reviewer. Shared native services and the learner's25-ticket database were not operated on. This review authorizes no Package/Deploy/CodeBuild/AWS execution or publication. A guided learner-local separate database setup and demonstrated acceptance remain after the hosted gate.
