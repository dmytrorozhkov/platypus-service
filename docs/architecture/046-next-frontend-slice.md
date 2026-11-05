# Next frontend slice proposal 046

Date: November 5, 2026. Author lane: frontend_next_slice. Planning only; no application changes or tests performed.

The existing Support page should work unchanged with a persisted repository. TicketData.load(signal): Promise<Ticket[]> remains the data boundary. Preserve044's response, existing status/null/date handling and PS-1001 through PS-1025 initial order. Preserve runtime HTTP-origin-only configuration, loading/empty/error/Retry, request abort and stale-response rejection, delayed startup/unmount cleanup, federation mount contractVersion 1, /support/tickets and shared su: theme styles. No database credentials or role claims enter browser config.

Frontend owner: focused contract/browser acceptance and any necessary accurate learning-data copy. Current footer calls the source a local server in all environments; update it only in a later implementation and do not claim verified persistence prematurely. Preserve Angular Shell/Support, React Analytics and Vue Administration integration; no new library or application rewrite is necessary for this increment.

Acceptance: initial25 persisted rows through real HTTP in standalone and Shell; distinctive test-owned database edit visible and retained after the same-storage restart; true empty results; malformed/duplicate/inconsistent-total errors; actual isolated database outage followed by Retry without frontend restart; navigation during delayed work prevents stale rendering; healthy React/Vue styles/navigation remain. Distinguish transport mocks from actual database/restart evidence. Logical test databases do not isolate a shared instance restart; coordinate a dedicated instance or exclusive verification window.

Backend supplies unchanged sanitized INTERNAL_ERROR message Tickets could not be loaded.; health remains HTTP liveness. No fake sign-in, hidden-button permissions, public writes or loading100000 rows into the client. Pagination changes total semantics and needs a separate coordinated contract.
