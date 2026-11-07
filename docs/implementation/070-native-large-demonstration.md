# 070. Native large PostgreSQL demonstration

Date: November6,2026. This records the learner-local continuation after implemented/hosted-verified064-069.

## Learner-operated setup and observations

The learner ran the guided administrator psql command to create the separate platypus_service_large database OWNER platypus_owner; the screenshot showed CREATE DATABASE. A later administrator transaction revoked database privileges from PUBLIC and granted CONNECT to platypus_app, with BEGIN/REVOKE/GRANT/COMMIT shown. Existing instance storage is D:/PostgreSQL/18/data; no separate instance/service was created.

The hidden-password wrapper migrate-large as platypus_owner returned applied migration001. seed-large returned applied:true for tickets-large-v1 with exact counts100000 tickets/100 organizations/40 support agents and7989ms elapsed. check-large then returned those counts,14286unassigned rows,25000in each of four statuses, all six index names and contentMatchesSeed:true, with586ms elapsed. These elapsed values are learner setup/check observations, not request-performance measurements. Passwords stayed in local prompts and were not collected by agents.

The learner's explicit owner psql transaction in the new large database granted platypus_app schema USAGE and SELECT on organizations/support_agents/tickets; the screenshot showed BEGIN/two GRANT results/COMMIT. The learner then reported the serve-large runtime started on3001 and serve:support:large frontend on5176. After opening http://localhost:5176/, the learner confirmed the table works following the instruction to expect25rows and100000 matching tickets. This accepts the initial visible large-table slice; a manual status-filter exercise is next, not yet claimed as performed.

## Independent coordinator HTTP readback

At 2026-11-06T15:49:48.174Z, read-only HTTP checks against the learner-started services confirmed:

- Frontend runtime configuration exactly apiBaseUrl=http://localhost:3001 and ticketQueryMode=paged.
- Actual pages of25/50/100 items, each with total100000, exact page/size echoes and no-store. Natural ascending numbering starts PS-1 through the requested page size.
- Page2 of25 starts PS-26; the first two pages have50 distinct numbers.
- Options contain100organizations and40assignees.
- Status New returns filtered total25000 and only New rows in its bounded page.

Ignored .local/evidence/native-large-http.json stores the bounded evidence. No direct database connection, SQL write, credential read, browser automation or process/service restart was used in this coordinator readback. Default fixtures do not support these query routes; the explicit PostgreSQL entry has no fixture fallback.

## Current scope

Native large creation/migration/seed/verification/grants and initial learner-visible rendering are now demonstrated, superseding older pending statements in068/069/README/plan. Full cross-layer/constraint/cancellation/query/performance coverage remains the exact hosted source evidence documented in068/069; the native confirmation does not independently rerun that complete suite. Native bulk-service restart, edits and every UI filter combination are not inferred from initial acceptance.

The existing25-record project database and shared PostgreSQL service were not reset/restarted by this stage. No AWS database/resource/access/state/settings/secret change, Package/Deploy dispatch, CodeBuild run or publication occurred. Existing public AWS application remains fixture-backed. Preserve the learner-owned3001/5176 processes; the next small learner action is selecting Status New and checking25000 matching tickets.

## Learner status-filter acceptance

The learner selected Status New in the native5176 table and confirmed the expected25000 matching tickets and New rows. This follows independent native HTTP verification of that exact filtered count. The approved read-only100000-ticket slice is accepted; no inference is made that every native filter, write or service-restart scenario was manually repeated. The next proposed separate stage is current AWS PostgreSQL hosting/availability/cost planning before any cloud resource creation. No hosting choice, spending or cloud provisioning is authorized by accepting the local slice.
