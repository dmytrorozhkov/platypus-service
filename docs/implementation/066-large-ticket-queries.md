# Bounded PostgreSQL ticket queries 066

Date: November 6, 2026. Status: implemented and focused locally verified; real100000-row SQL/browser/performance verification belongs to integration068 and is not established by the injected-query tests below.

## Routes and compatibility

TicketRepository retains list() and adds optional query(TicketQuery) and options() methods. Only supporting repositories expose GET /api/tickets/query and GET /api/tickets/options. The default fixture repository, ordinary main.ts and Lambda composition retain the25-ticket legacy behavior; new routes return404 there. The PostgreSQL repository supports the new routes. Its legacy list query reads at most101 records and rejects collections above100 instead of returning an unbounded100000-row response.

The local HTTP adapter now preserves the raw query string; the payload-v2 adapter consumes an optional string rawQueryString without rebuilding it from a lossy key/value map. Existing fixture routes continue to ignore legacy query parameters. Root adds the new dependency-free ticket-query.js module to the Lambda package whitelist; no pg dependency or PostgreSQL runtime is introduced into that package by this lane.

Query responses are {items,total,page,pageSize}; each item retains exactly the seven public fields. A requested page beyond available rows returns empty items with the correct filtered total. Options are {organizations:[{id,name}],assignees:[{id,name}]}; labels/IDs are not authorization. All routes preserve existing method/CORS/no-store behavior, sanitized500 responses and HTTP-only health. No authentication, business write, cloud or native database operation was added.

## Validation and SQL behavior

ticket-query.ts exports parseTicketQuery(rawQuery=''), InvalidTicketQuery, isTicketDirectoryId and ticketSortFields. TicketQuery is type-reexported by ticket-repository.ts. Parsing bounds the raw string at2048 characters and rejects unknown/duplicate parameters, invalid percent/UTF8 encoding, control characters, unsupported enums, malformed UUIDs, invalid/reversed calendar dates and invalid page/page-size limits. Defaults are page1/pageSize25/createdAt descending. Search trims surrounding whitespace, permits empty search and bounds the remaining value at100 characters. Directory IDs normalize to lowercase; a valid but absent ID naturally matches no tickets. The unassigned assignee filter means a SQL null. Year0000 is rejected; UTC dates0001-01-01 through9999-12-31 remain valid.

The SQL builder binds all search/filter/date/limit/offset values as parameters. Sort fields and direction use explicit allowlists. Literal percent, underscore and backslash characters are escaped for ILIKE instead of granting wildcard syntax. Inclusive created-date filters use UTC midnight, with the end bound computed as date+1 exclusively inside PostgreSQL. See [PostgreSQL pattern matching](https://www.postgresql.org/docs/18/functions-matching.html).

One statement materializes the filtered rows, selects the bounded ordered page and returns its JSON rows alongside the filtered count. This avoids separate count/page queries observing different commits; PostgreSQL SELECT uses a statement snapshot. Materialization also makes the reused filtered set explicit. See [transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html) and [WITH materialization](https://www.postgresql.org/docs/18/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION). This does not imply index use or a measured speed guarantee: materialization/count/sort still perform database work over the filtered dataset.

Text sorts use explicit C collation. Both directions place nulls last and use a unique C-collated ticket-number ascending tie-break. Natural ticket-number sorting compares positive decimal suffix length and then C-collated digits, without integer/bigint/numeric casting or overflow for arbitrarily long valid numbers. The page aggregation repeats the explicit order so response ordering does not rely on unspecified aggregate input order.

Options use one statement with stable C-collated name/id order, bounded at1001 per directory. The repository rejects an overflowing directory instead of silently returning an incomplete1000-entry prefix. Returned rows, totals, per-page limits, option identifiers and duplicate IDs are checked before public mapping. Existing read-only pool configuration and timeouts remain unchanged; they are local safeguards, not user authorization or product performance targets.

## Verification actually performed

- Server typecheck --noEmit passed.
- Server compilation used isolated ignored output .local/backend066/dist, never shared apps/server/dist. Copies of five focused/regression test files ran against that isolated output:30 passed, zero failures/cancellations/skips.
- Existing real HTTP/Lambda parity, fixture fields, CORS/methods/errors, PostgreSQL row mapping and injected-pool lifecycle checks remained passing.
- Nine new groups cover parser defaults/bounds/duplicates/dates/encoding; all sort/direction combinations; parameterized literal search/date/filter preparation; one-call count/page mapping and empty out-of-range pages; invalid/oversized result rejection and legacy cap; directory overflow/shape; actual HTTP validation before repository work; unsupported fixture routes; Lambda raw-query forwarding and safe failures.

These checks validate transport, mapping and generated SQL boundaries with injected query results. They do not claim that the SQL has executed against PostgreSQL, that indexes are effective, that100000 rows exist locally, or that the paged browser has been demonstrated. Lane065 supplies deterministic dataset and real disposable SQL tests; root owns actual hosted SQL/browser/performance integration, full checks and independent review069.

No shared package/dependency, CI, frontend, runtime mode, default demo composition, system service, credential, database, AWS, Git or repository setting was changed by this lane. The reviewer/integration must verify the exact candidate before the learner's separate local large-database setup or any future manual publication.
