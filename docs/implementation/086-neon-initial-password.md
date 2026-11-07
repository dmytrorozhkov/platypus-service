# Private first password for the existing Neon runtime role086

Prepared November 7, 2026, as a bounded follow-up to081–084. The learner completed the actual import/verification and guarded activation of the existing restricted `platypus_app` role. Neon Console then rejected its first password reset with “cannot update password for role without password.” This report describes the local alternative; it does not claim that an app password or real runtime connection has subsequently succeeded.

## Operator route and scope

`apps/server/database/neon/runtime-password.mjs` exports import-inert `setRuntimePassword({environment, runClient})`; its explicit CLI accepts only `set`, without extra arguments. The coordinator-owned PowerShell wrapper privately prompts for the confirmed **direct Frankfurt hostname**, owner password and distinct new app password. No password belongs in chat, SQL Editor/history, tracked files or command arguments. The app password is supplied only as `NEON_APP_NEW_PASSWORD` in the owned child environment; the existing setup password remains `NEON_MIGRATION_PASSWORD`. Recommended input is32 randomly generated printable ASCII characters. The utility accepts20–128 printable ASCII characters, rejects controls/non-ASCII/empty/short/oversized values and owner-password reuse before any connection. It does not generate or reveal a password.

The module reuses reviewed `migrationConfiguration('import', environment)` and `assertMigrationIdentity`: explicit confirmed direct Frankfurt endpoint, `neondb`, `neondb_owner`, PostgreSQL18, UTF8, verified certificate/hostname TLS and no ambient target override. Limits are60seconds overall with3seconds owned cleanup,15second query timeout,10second server statement timeout,3second lock timeout and15second idle-in-transaction timeout. There is no automatic retry or replay.

The fixed sibling `activate-runtime-role.sql` is read from the repository. Its recognized transaction/LOGIN structure and SHA256 of the exact effective-role DO block must match; unknown structure or guard drift is refused before a connection. The existing guard executes unchanged, including flags, memberships, any schema ownership and table/column write-grant checks. The utility never executes that file's LOGIN mutation. A separate exact single-row check requires that `platypus_app` already has LOGIN.

After owner identity verification, a single transaction begins, sets transaction-local SCRAM password encryption, runs the guard/LOGIN check, executes **only** `ALTER ROLE platypus_app PASSWORD` with `pg.escapeLiteral`, then commits. Quotes/backslashes are supported through the pinned driver's literal escaping. No role is created, adopted, granted privileges or switched to LOGIN by this utility. A pre-COMMIT failure attempts one rollback; owned cleanup is bounded even if rollback fails. If COMMIT was sent but its response or subsequent cleanup fails, the fixed error declares the outcome uncertain and requires an explicit app connection check before an operator-chosen retry. It does not promise rollback certainty.

Success prints only:

```json
{
  "operation": "set-runtime-password",
  "role": "platypus_app",
  "database": "neondb",
  "passwordConfigured": true
}
```

No password, password hash/digest, hostname, raw driver cause/code or private value is included in receipts/errors. The guard's digest binds public source SQL, not credentials.

## Verification and remaining proof

Author-focused tests passed **10/10**, with no skip/cancel. They cover target/TLS/limits, validation-before-connection, exact guard reuse and SQL escaping, wrong owner/version/encoding, role/LOGIN refusal, rollback and failed rollback, uncertain COMMIT/cleanup, no replay, a real bounded ownership helper with fake late work, source-guard drift before connection, import-inert behavior and exact CLI refusal. Tests use public fake password fixtures, fake clients and temporary owned guard copies; no native service, actual Neon endpoint or real password was accessed. Coordinator-owned actual PostgreSQL SQL/escaping tests, full checks and independent084 review are separate evidence.

After the reviewed wrapper is integrated and accepted, the learner alone runs the private password-setting action. Then run the existing pooled app `check` using the new app password. Successful owner password setup is not proof of app authentication/TLS or effective runtime privileges. Actual learner receipt, pooled connection check, HTTP/UI and cold/warm/wake behavior remain in083. Existing native databases/services, AWS/demo/Lambda, Free plan and user-only publication boundaries are preserved.
