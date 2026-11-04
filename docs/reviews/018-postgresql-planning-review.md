# Independent PostgreSQL Planning Review 018

Date: November 4, 2026.
Status: complete. No blocking inconsistency found in proposals 016 and 017. Ready for coordinator synthesis and definition of the next bounded setup stage.

This is a proposal review, not approval to install software or evidence that a database implementation works. No installation, SQL, migration, seed, database restart or persistence test was executed by this review.

## Evidence and attribution

Personally inspected AGENTS.md, the relevant project plan, task 018, both staged proposals, the current server repository/HTTP boundary, the authoritative ticket fixture and Support's API response validation. A read-only fixture check confirmed 25 tickets, five organizations, three assignee names and strictly increasing creation dates from PS-1001 through PS-1025. A scoped Git diff showed no application, package, dependency or script changes from this planning work.

Personally checked consequential claims against primary PostgreSQL, EDB and node-postgres documentation. The environment planner's command/service/registry/WSL and port inventory was reviewed as reported evidence, not repeated independently. Its limits are stated appropriately: missing PATH commands alone do not prove absence; a refused connection is an observation at one instant; denied hardware inventory leaves prerequisites unknown.

## Data and application contract

The proposed three business tables and two operational ledgers fit the accepted read-only slice. The assignee directory does not introduce authentication or grant access. Future memberships, messages, roles, write operations and large-table pagination remain outside this stage.

The replacement repository retains the existing asynchronous list boundary and seven public ticket fields. An inner organization join and nullable assignee left join preserve all initial rows. The proposed explicit creation-time/number order reproduces the current fixture; insertion order is not assumed. Computing total from the returned items preserves the current client requirement that total equals items.length.

Original timestamp instants remain authoritative. The proposed millisecond timestamptz columns and checked Date.toISOString mapping fit JavaScript precision; acceptance compares normalized instants rather than requiring identical Z versus .000Z spelling. This agrees with [node-postgres type conversion](https://node-postgres.com/features/types).

## Setup, seed and process lifetime

Migration and seed commands have explicit owner credentials and share a bounded transaction-scoped lock. Changes and ledger entries commit together; immutable checksums detect altered applied inputs. The recorded seed becomes a no-op on an unchanged rerun, preserving edits and deletions. A first seed refuses ambiguous pre-existing data instead of hiding conflicts or overwriting it. Ordinary API startup does not seed or reset data.

The proposed runtime role receives only the read privileges needed by the three business tables. Browser configuration retains the Node API address; database credentials remain server-side. One bounded process-wide pool, checked-out clients for transactions, idle-error handling and explicit shutdown are consistent with the [node-postgres pool API](https://node-postgres.com/apis/pool). The existing health endpoint remains HTTP liveness; successful database access requires a separate real query.

Recovery acceptance correctly requires an actual database outage while Node remains alive, sanitized failure without fixture fallback, and Retry recovery without restarting Node or the frontend. Shutdown must close the application's pool while leaving the independently owned Windows database service running.

Carry forward proposal 016's explicit isolation condition: a second database in the same PostgreSQL instance does **not** isolate service restart. An outage test needs an agreed exclusive window for that instance or a separately owned cluster. Naming a disposable test database alone is insufficient authorization to stop a shared service. This qualification resolves how proposal 017's future restart procedure must be applied; no proposal correction is required before synthesis.

## Environment and remaining gates

The native Windows recommendation is reasonable for the reported machine prerequisites. PostgreSQL's current policy lists 18.6 as the supported minor release for major 18, with support through November 14, 2030. Recheck the minor release before setup. [PostgreSQL version policy](https://www.postgresql.org/support/versioning/).

The official Windows page links the EDB installer; exact compatibility with this desktop still needs actual setup verification. Administrator interaction, persistent storage selection and background-service ownership are documented installer behavior. [Windows downloads](https://www.postgresql.org/download/windows/), [EDB installation](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/windows/).

The following remain future setup/implementation gates, not planning defects:

- User acceptance of the native installation stage and any required local administrator interaction.
- Actual official installer filename/build, SHA-256, current version, free port, storage capacity and data-directory permissions. The dynamic Windows artifact was not verified; no download URL is invented.
- Published stable pg and declaration-package versions, compatibility checks and exact dependency pins. An upstream master manifest is not a registry release guarantee.
- Explicit owner/runtime configuration and a guarded database or cluster target for destructive and outage tests.
- Executed schema/seed rollback and rerun checks, SQL/API/browser value comparisons, saved-edit persistence, timezone checks, real outage recovery and existing application regressions.

No paid-service assumption is needed for the selected local proposal. Docker remains an unselected alternative with prerequisite and licensing conditions, not an installation dependency of this stage.

## Verdict

No blocking finding and no requested planner correction. Preserve the restart-isolation condition and the unverified artifact/package gates in the coordinator's consolidated plan. Installation approval and successful runtime verification remain separate later steps.
