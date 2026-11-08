# Independent review: initial Neon runtime password087

Reviewed November 7, 2026 against contract085 and repository coordination rules. The learner's screenshots establish successful actual import and separate full-data verification for100000tickets/100organizations/40agents, creation of the restricted role and successful guarded LOGIN activation. Console Reset password then failed with `cannot update password for role without password`. This review concerns the necessary bounded local initial-password alternative, not actual credential setup or app connection success.

## Scope and result

No remaining confirmed source blocker was found in `runtime-password.mjs`, its focused tests, `neon-role-password.ps1`, its owned PowerShell fixture tests, server test registration or the owned PostgreSQL integration delta. Existing activation SQL and connection ownership/configuration were read as dependencies. The reviewer changed only this report and did not connect to Neon, read real credentials, operate the native database/service, change grants/data or perform publication.

The utility validates the distinct20–128 printable-ASCII app password and rejects owner-password reuse before connecting. It reuses explicit confirmed direct Frankfurt/neondb/neondb_owner configuration, certificate/hostname-verified TLS and authenticated PostgreSQL18/UTF8 identity. Connection/query/statement/lock/idle/overall cleanup budgets remain bounded. Import alone is inert and the explicit CLI accepts only `set`.

The effective-role DO guard is extracted from the checked-in activation SQL only if the surrounding structure and exact guard hash match. It includes flags, memberships, ownership and schema/table/column privilege checks. LOGIN must already be enabled. The sole persistent mutation is an escaped password literal for the fixed existing `platypus_app` role; no CREATE/adoption, grants, LOGIN flag mutation or business data changes occur. SCRAM selection is transaction local. Failure before COMMIT attempts one rollback, while COMMIT response/cleanup uncertainty is explicitly distinguished and requires the app connection check before any operator-chosen retry. No automatic replay occurs.

The PowerShell wrapper validates and confirms the direct target, uses three hidden password prompts, compares repeated app input and passes secrets solely in its own child's environment. It zero-frees allocated BSTRs, disposes SecureStrings and clears temporary references/environment entries after launch and on failure. This is not a claim that every managed string copy can be provably zeroed. Secret values are absent from real command arguments/files; raw child stdout/stderr and exceptions are never forwarded. Success requires the exact safe receipt shape and emits a newly constructed fixed receipt. Failure is fixed text with an uncertainty/app-check handoff. Timeout termination is scoped to the owned child tree.

## Independent verification

The reviewer executed:

```text
node --test test/neon-runtime-password.test.mjs test/neon-role-password-runner.test.mjs
```

Result: **13/13 passed, zero failed/skipped/cancelled**,32145ms. The10unit groups cover explicit target/TLS/bounds, preconnection validation, exact guard reuse, SQL quote/backslash escaping, connected identity refusal, guard/LOGIN refusal, rollback and failed rollback, uncertain COMMIT/cleanup/no replay, late query deadline ownership, source guard drift, import-inert CLI and invalid arguments. The3real Windows PowerShell groups cover exact child-only inputs/receipt, input/target refusal before child startup and rejection/redaction of unexpected stdout/stderr/extra receipt fields.

PowerShell test prompts are deliberately substituted with public fixture queues in the owned test process; actual PowerShell parsing, SecureString/BSTR conversion and child environment/output handling execute. This is neither real interactive-console/password proof nor a live Neon connection. All fixture secrets are public synthetic values. Owned temporary paths are checked before recursive cleanup. No shared service/database is used.

The integration delta was also source-reviewed: only the marked owned disposable PostgreSQL cluster is used. Root separately reported **6/6 actual PostgreSQL18.6 SQL/HTTP groups passed**, exit0 and owned cluster stopped: activation guards; column-write drift refusal/rollback with the initial NULL password retained; valid quoted/backslash password setup from NULL and successful app authentication; effective-role probe; privilege/flag drift refusal; and real paged API/options/health/CORS/idempotent shutdown. These checks use three synthetic rows and an injected local connection, not actual Neon TLS. No native5432/service operation was performed. This root execution evidence is distinct from the reviewer's independent13group rerun. Complete coordinator checks and hosted-CI evidence belong in083 before handoff.

## Remaining acceptance

Root subsequently reported the complete registered server suite under `CI=true` **113/113 passed, zero skipped**, plus lint and format checks passed. No application source change followed those checks; final record updates are documentation only. These are attributed coordinator results rather than an independent rerun by this reviewer.

Observe the new source's ordinary hosted CI after the coordinator's complete applicable checks. Only then hand the learner the private initial-password command. No actual successful password setup, pooled app authentication/TLS, HTTP/UI or cold/warm/wake behavior is established by these synthetic tests. Existing main/public AWS release, Free plan, source data/services and learner-only publication remain unchanged.
