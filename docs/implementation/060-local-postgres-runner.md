# Local PostgreSQL password runner 060

Date: November 6, 2026. Status: implemented and locally checked without a real database operation. Independent review061 and learner-run SQL/HTTP verification remain separate evidence.

## Scope

scripts/postgres-local.ps1 provides four explicit actions against the fixed local target127.0.0.1:5432/platypus_service:

| Action  | Existing root npm command | Database role  |
| ------- | ------------------------- | -------------- |
| migrate | db:migrate                | platypus_owner |
| seed    | db:seed                   | platypus_owner |
| check   | db:check                  | platypus_owner |
| serve   | start:server:postgres     | platypus_app   |

Each invocation performs exactly the selected existing command. There is no implicit build, migration, seed, provisioning, grant, service operation or chained action. The existing database commands retain their ledger/seed protection; the runner does not replace those rules. The serve action requires an independently built, reviewed PostgreSQL executable. The accepted fixture demo and Lambda remain unchanged.

The learner manually installed PostgreSQL18.6, verified loopback listening after their service restart, created owner/application LOGIN roles with restricted attributes and privately set their passwords, and created the project database owned by platypus_owner. Those are learner reports, not operations performed or verified by this runner author. Schema privileges and actual migrations/seed remain learner-guided steps.

## Local invocation

From the project folder, select one action, for example:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\postgres-local.ps1 -Action migrate
```

Replace migrate with seed, check or serve for the corresponding separate step. This example changes execution policy only for that new PowerShell process; it does not change a user/machine policy. There is no Set-ExecutionPolicy call. Where the current shell already permits the reviewed script, .\scripts\postgres-local.ps1 -Action migrate is sufficient. Enter the requested role password only at the local hidden prompt. Do not put passwords in commands, chat, tracked files or screenshots. For serve, leave the foreground terminal open; Ctrl+C stops its owned command. No other PostgreSQL service is stopped.

## Credential and command boundary

Parameter binding validates the action before entering the script. The runner resolves its own project root, verifies the expected package identity/script and resolves the exact npm.cmd application. It invokes the fixed Windows system cmd.exe with fixed argument structure and an allowlisted npm script. A command path containing expansion-sensitive percent/quote/exclamation/newline characters is rejected. No supplied password becomes a command argument, output, file or history entry.

Read-Host -AsSecureString collects the password. ProcessStartInfo gives the new command its own environment copy; the terminal's Process/User/Machine environment and working directory are never changed. The child receives fixed PGHOST/PGPORT/PGDATABASE/PGUSER, a transient PGPASSWORD, disabled local TLS and no inherited PGOPTIONS. All affected child environment entries are snapshotted/restored in finally, then local snapshot references are cleared. The transient password entry is removed immediately after child creation.

The temporary unmanaged BSTR is zeroed/freed immediately after the child starts, including a creation failure. The SecureString is disposed. This reduces exposure but cannot guarantee erasure of immutable managed strings or the native child environment: the password necessarily exists in process memory while the driver authenticates. This is not encryption of the running process environment, a secret vault or protection against an administrator inspecting local processes.

Child output remains visible so the learner can assess the existing command result. Native exit codes are preserved; runner exceptions report fixed generic messages without dumping exception/environment objects. Cleanup runs on normal completion, failure and ordinary PowerShell interruption. If interrupted while its child still exists, the runner requests termination of only that owned foreground process tree through the Windows system taskkill executable, with output suppressed and a bounded wait. It checks taskkill's exit code and separately waits up to5seconds on the original owned child handle to confirm exit. A failed termination command, remaining owned child or cleanup exception produces a generic message and runner exit1. It never enumerates/stops arbitrary Node/PostgreSQL services. Forced termination of PowerShell itself, closing the terminal process or a machine crash cannot guarantee finally execution; the parent environment still remains unchanged because it was never mutated.

## Verification actually performed

- Parsed the exact script with the installed Windows PowerShell5.1 parser; no syntax errors.
- A separate PowerShell5.1 harness mocked the password prompt with a nonsecret sentinel and resolved npm.cmd to a local fake child. All four actions passed their fixed script, role, host/port/database and child-only secret settings to that fake command.
- The harness prepopulated distinct nonsecret parent PG values and verified all remained unchanged after success and a native nonzero result.
- The fake child's exit7 was preserved. An invalid action was rejected before the mocked password prompt.
- Native child output was visible; no sentinel secret value was printed. The harness and fake child stayed in ignored coordinator staging, outside tracked project content.
- After review061 identified missing termination confirmation, the cleanup block was corrected to check both the termination command result and the original owned process handle. A standalone harness invoked that exact parsed cleanup block against a harmless owned Node timer process and confirmed the owned process exited successfully. This is not an interactive Ctrl+C test.

The test process used process-only ExecutionPolicy Bypass; no global execution policy was changed. No actual password was requested or collected by the author, no SQL/HTTP database command was executed, no dependency/tool was installed, and no service, PostgreSQL setting, grant, AWS resource or Git state was changed by this lane. Real interactive Ctrl+C and actual role authentication remain learner verification; fake-child lifecycle checks do not establish database persistence, permissions or migration results.
