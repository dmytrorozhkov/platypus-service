# Saved progress and learner-started Neon connection083

## Authorization and saved checkpoint

On November7 the learner accepted the plan: save progress, migrate existing local data to Neon, connect the backend and check connectivity. This permits the necessary bounded local Neon integration and learner-run database/access steps; it does not authorize AWS publication, paid upgrades, CodeBuild or automatic delivery. Existing native databases/services and the public fixture remain preserved.

Root reviewed the staged28-file checkpoint and saved implementation070-080 as `f02388cef69a8c594eae079331a7ffffe70dd003` on `feature/neon-connection`, then pushed it without changing main or dispatching a workflow. Actual ordinary [CI42355608827](https://github.com/dmytrorozhkov/platypus-service/actions/runs/42355608827) completed successfully: Real PostgreSQL integration and Checks and builds both passed. No Package/Deploy/CodeBuild execution occurred. Reviewed runtime081-084 was subsequently committed/pushed as d7d36708fef4c37e4d2503e181942f436df622d0. Its ordinary [CI42357274281](https://github.com/dmytrorozhkov/platypus-service/actions/runs/42357274281) passed actual PostgreSQL integration, lint, formatting, types and all builds, but failed Test built server. That hosted failure was subsequently localized to the mocked prompt and superseded by the reviewed correction and actual successful hosted run recorded below; local results alone did not override it. The anonymous log endpoint refused detailed logs, and browser access stopped because the tool could not reliably establish the current URL. The learner subsequently supplied that test log:97/98 groups passed; only the real PowerShell runtime substituted-prompt/fake-child success test failed at its expected exit-code assertion. It displayed the selected fake target then the wrapper's fixed catch diagnostic. No real database/network was used in this group; the11pure runtime groups passed. This rules out the previously unproven main-helper exit/close-output hypothesis as the cause of this specific failure.

## Actual live-operation position

The learner was handed this first action from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\neon-migration.ps1 -Action export -SnapshotId neon-transfer-20261107-01
```

Only the learner enters the local `platypus_app` password at the hidden prompt. This is a read-only source export, not a Neon import. The learner supplied the successful export receipt in a terminal screenshot. Coordinator offline inspect then passed with the exact exported SHA, canonical snapshot/schema validation and counts below. The learner subsequently completed the actual Neon import, recorded below. Explicit remote verify subsequently passed (receipt below); app-role activation/password reset and pooled application-runtime connectivity remain pending. Do not convert preparation or the owned test cluster into live evidence.

Confirmed snapshot: neon-transfer-20261107-01; counts:100000tickets,100organizations,40support_agents. SHA256: `2d36a41e90dcccee0c362b755917a0f67df07d8ab622385aae0d4dde84a442b5`. Data fingerprint: `9e68e4d9af66917bfe1be7b1be756f5fd06f0eca521e6a24867601c1b1335b60`. Only this receipt is recorded; snapshot rows remain in ignored .local. The first inspect invocation rejected a mistyped screenshot transcription before any network access; after correcting the transcription the exact receipt above passed. A further local full server run with CI=true passed98/98 with no skips; the independent reviewer also passed the13newgroups under CI=true without reproducing the hosted failure. This is diagnostic evidence, not a fix or hosted acceptance. Import was held during CI diagnosis; the successful corrected hosted result below now clears that test gate.

For the later learner-started import, preserve this exact snapshot and recorded SHA; do not rerun export over the same id. Save the displayed SHA256 separately. Run the same wrapper with `-Action inspect` and the same SnapshotId; it opens no connection. Then the learner explicitly uses `-Action import`, enters the recorded SHA, privately copies the **direct** Frankfurt hostname, confirms exact hostname/neondb and enters the private **Neon neondb_owner password**. Use `-Action verify` afterward. Runbook079 defines these reviewed steps and uncertain-COMMIT handling. No password, connection URI or screenshot containing one belongs in chat, Git or command arguments.

## Preparing the application identity after actual verified import

Use the intended project's production branch/neondb in Neon SQL Editor asneondb_owner. The learner first executes `apps/server/database/neon/runtime-role.sql`, which refuses an existing unexpected role and creates the restricted NOLOGIN `platypus_app`. It grants only CONNECT, schema USAGE and SELECT on the three current business tables. This role differs from the local role/password, even though the name is the same.

Set/reset the password on **that existing role** privately through Postgres database > Roles > platypus_app > Reset password; keep the generated password in a private password manager. This avoids placing a password in SQL Editor history. Do not add a new application role through the default Console admin-role flow. Next execute `apps/server/database/neon/activate-runtime-role.sql` asneondb_owner. It checks identity, role flags/memberships/ownership/effective grants, including column-only writes and ownership of any schema, before enabling LOGIN. A mismatch refuses; it does not silently modify unexpected grants. If an explicit SQL transaction fails, run ROLLBACK before reusing the same session. Effective runtime permissions are checked again with app credentials by the server.

These are separately performed necessary steps within the learner-approved connection stage, not actions an agent has already executed. SQL creation/login scripts contain no password. No owner credential is used by the serving backend.

## One-off real connection check

After role setup and a reviewed server build:

```powershell
npm.cmd run build --workspace @platypus/server
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\neon-runtime.ps1 -Action check
```

The runtime wrapper requests the **pooled** Frankfurt hostname (`-pooler`), exact hostname/neondb confirmation and the **Neon platypus_app password** privately. It fixes target database/user/ports/origin, neutralizes ambient values, uses the reviewed strictTLS adapter and closes after one probe. A successful check prints `Neon connection check passed.`. There are no polling/keepalive SQL requests or automatic retries. Private data is passed only to the owned child environment and is not saved in a configuration file. Owner/local passwords are not valid substitutes.

The probe verifies actual PostgreSQL18/UTF8, neondb, current/sessionuserplatypus_app, transactionREADONLY, LOGIN and nonadministrative flags, no memberships/ownership, schema USAGE, three-table SELECT and no table/column write or schema/databaseCREATE grants. Missing tables or unexpected permissions stop before HTTP opens. This does not implement Cognito or application-level tenant authorization.

## Serve and demonstrate locally against Neon

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\neon-runtime.ps1 -Action serve
```

After the same private prompts and successful startup probe, the backend listens only at `http://localhost:3002`. Keep this terminal running. In another terminal:

```powershell
npm.cmd run serve:support:neon
```

Open `http://localhost:5177`. This serves the existing built Angular Support in paged mode against localhost3002. Normal local modes3000/5175 and3001/5176 remain unchanged; no native service or other process is stopped. Rebuild Support only if its reviewed build is missing; the regular CI builds it. The cloud Neon endpoint/password stays server-side and never enters frontend configuration. Verify page total/content, filters and bounded pages; later explicitly check recovery after inactivity rather than keeping compute awake.

The new runtime reuses the existing repository/HTTP lifecycle, maximum2connections,15-second adapter operation bound,20-second HTTP drain and4-second pool drain. On Ctrl+C the wrapper requests owned-child stop through a bounded stdin control channel, waits for graceful cleanup and only then can terminate its own child tree. It never controls the shared PostgreSQL service. This stage does not reconfigure the public3-second Lambda or deploy anything to AWS.

## Prepared-code and test evidence

Backend implementation082 includes11 focused groups, independently rerun11/11. They cover effective identity/privilege refusal, real ephemeral HTTP with injected connection, probe/start/stop races, import-inert main, explicit CLI modes, bounded stdin/IPC cleanup and sanitized errors. Root adds two real Windows PowerShell tests using a copied wrapper and fake built child in an owned temporary project; console prompts are substituted only inside that test process, because redirected secure Read-Host requires an interactive console. The initial redirected-input test timed out and was corrected as a test harness limitation; the production private prompt was preserved. Both corrected groups pass. This does not claim automated entry of a real private password.

A fresh marked owned PostgreSQL18.6 cluster passed4 actualSQL/HTTP groups: column-only UPDATE or ownership of an unrelated schema makes role activation refuse and leaves NOLOGIN; exact limited role activates and the real probe passes; column-only grants/elevated flags are detected by the probe; real paged HTTP/options/health/CORS and idempotent shutdown work. This used three synthetic rows and injected local transport, not the100000learner database or a Neon TLS connection. Existing100000-row migration verification remains report079. All owned clients and only the owned cluster were stopped. Root hardened test-harness cleanup so a runtime.stop error does not skip client/cluster cleanup.

Final coordinator checks passed: server build, all five workspace typechecks, complete server suite98/98 with zero skips, startup4/4, integration7/7, lint and formatting. The corrected owned PostgreSQL18.6 integration was rerun after both activation guard corrections and passed all four SQL/HTTP groups with owned cluster teardown. Independent review084 records its separate13-group rerun and the attributed coordinator evidence. This reviewed runtime preparation is saved separately from f02388c; its ordinary push CI is observed after the checkpoint and is not implied by the earlier hosted result. No actual live Neon result or learner acceptance is inferred from local tests. Final cloud wiring/deadline alignment/publication remains a separate future stage.

## Hosted CI diagnostic follow-up

Local CI=true full98/98 and independent13groups did not reproduce the hosted failure. Four owned copied-wrapper variants with normal, PS7-like, empty and nonexistent PSModulePath all passed, so module-path drift is not an established cause.

The bounded follow-up changes only neon-runtime-runner.test.mjs: its exclusively owned temporary wrapper copy records constant stages and catches a numeric script line/HResult, while its fake child reports constant assertion stages. The host parses an exact allowlist and bounded numeric range, and emits a GitHub error annotation only on unexpected failure of the success path. Raw exception messages, source lines, credential/endpoint/environment values and captured process output are excluded from annotations/assertion messages. The original production wrapper is not modified and no test is skipped or retried. A third intentional-failure sentinel checks diagnostic redaction and invalid diagnostic rejection without emitting an expected-failure annotation. Author focused3/3 and lint/format passed; independent review084 and coordinator shared checks follow before the ordinary push CI. No actual fix or hosted acceptance is claimed from diagnostic preparation.

## Hosted prompt-boundary result and test-driver correction

Diagnostic commit ca05c161f553ac163d93eb95e608c924fd062864 was pushed. Actual [CI42361035120](https://github.com/dmytrorozhkov/platypus-service/actions/runs/42361035120) again failed; the bounded annotation was read through the public check API: stage=prompt_password, line=1, HResult=-2146233087. This locates the failure inside the old test-owned line1 Read-Host override, before password marshalling, Node child start or any database call. The generic numeric HResult does not distinguish redirected-input EOF/null, PowerShell parameter binding or ConvertTo-SecureString failure; none is claimed as established.

The correction changes only the already-substituted test prompt driver. Known public fake answers are now initialized in a process-local closure queue, without Console.In, redirected input or ConvertTo-SecureString/module loading. Every call validates the exact expected prompt/order and AsSecureString flag; the password response is an actual readonly .NET SecureString, which the original copied wrapper still marshals, passes only to its child environment and disposes. Original fake-child credential/target/argument checks remain. A new negative group rejects missing answers, unexpected/reordered prompts and insecure password mode without printing fake passwords or exceptions. The real interactive production wrapper, database/runtime implementation, export snapshot and cloud state are unchanged. Author focused4/4 and targeted lint/format passed; independent reviewer separately passed4/4 under CI=true and found no remaining test-driver blocker. Coordinator complete registered server suite under CI=true passed100/100 with no skips, plus repository lint and formatting. The reviewed correction is saved/pushed for its own ordinary hosted CI; no hosted acceptance is implied by these local checks. This removes an unnecessary mocked-input dependency rather than weakening or skipping the failing assertion. Real hosted success remains required before learner import.

## Confirmed final hosted checkpoint

Reviewed correction8d18ffad0acc76c3bda1b4efedc9d7ba23f24c60 was pushed to feature/neon-connection. Actual ordinary [CI42361746703](https://github.com/dmytrorozhkov/platypus-service/actions/runs/42361746703) completed successfully: Real PostgreSQL integration(job128371403459) and Checks and builds(job128371715620) both succeeded. This includes the corrected Windows server-test path and the ordinary required builds/checks. Coordinator local full CI=true100/100 and independent focused4/4 evidence remain separate from this observed hosted result. No assertion was skipped or relaxed and no production wrapper change was needed.

This supersedes the earlier pending/failed-hosted-verification statements. The precise internal cause of the old test-owned Console.In/ConvertTo-SecureString override is still not distinguished; the observed failure boundary and deterministic replacement are documented above. Main, public AWS fixture, CodeBuild, delivery enablement and the real Neon database are unchanged. No Package/Deploy was dispatched.

The learner's source export and offline inspect are confirmed; the learner has now completed the actual import of that exact snapshot (receipt below). Explicit remote verify also passed; next are restricted role setup and local runtime check. Only the learner enters the direct hostname confirmation and private owner/app passwords. The actual setup-role migration connection/import is confirmed by the learner receipt below; application-role/runtime connection success is not yet claimed. This final evidence update is a local documentation checkpoint after the tested code commit, not another application change requiring a new CI run.

## Actual learner-started Neon import

On November7 the learner supplied the terminal receipt for operation import of neon-transfer-20261107-01 into the confirmed direct Frankfurt neondb as neondb_owner. The reviewed runner returned imported:true with100000tickets,100organizations and40support_agents. artifactSha256 and snapshot sha256 both equal `2d36a41e90dcccee0c362b755917a0f67df07d8ab622385aae0d4dde84a442b5`; dataSha256 and dataFingerprint both equal `9e68e4d9af66917bfe1be7b1be756f5fd06f0eca521e6a24867601c1b1335b60`. These match the prior exported/inspected file. The learner entered the password privately; no credential was supplied to the agent or saved by this report. The local source was not changed by import.

This is learner-attributed evidence of the actual setup-role connection and committed reviewed import, including the importer's own precommit content/catalog checks. It supersedes earlier no-remote-import observations, but is not an independently executed post-import verification or application runtime demonstration. Next the learner runs the same wrapper with -Action verify and the same SnapshotId, SHA and direct target/owner credentials. Expect verified:true and matching counts/hash. Restricted app-role setup, password/login activation, pooled local backend and browser acceptance remain pending. AWS/default fixture/publication remain unchanged.

## Actual learner-started post-import verification

On November7 the learner supplied the terminal receipt for the separate operation verify against the same confirmed direct Frankfurt neondb as neondb_owner. Result: verified:true, snapshot neon-transfer-20261107-01, counts100000tickets/100organizations/40support_agents. Snapshot/artifact SHA256 is `2d36a41e90dcccee0c362b755917a0f67df07d8ab622385aae0d4dde84a442b5`; dataFingerprint/dataSha256 is `9e68e4d9af66917bfe1be7b1be756f5fd06f0eca521e6a24867601c1b1335b60`. Both match export, offline inspect and import. This was the reviewed read-only remote ledger/catalog/full-data verification, separately invoked after import; no source data was changed and no password was given to an agent.

The actual data-transfer/verification part is now confirmed by learner receipts. The next approved learner action is runtime-role.sql in the intended Neon project/production/neondb SQL Editor as neondb_owner, creating the restricted NOLOGIN platypus_app. Then private password reset of that existing role, guarded LOGIN activation and actual pooled app-role backend check/serve/browser evidence follow. No restricted role creation, password/login action or application connection is yet confirmed. AWS publication and application-level authentication remain separate.

## Source

[Neon role management](https://neon.com/docs/manage/roles) distinguishes restricted SQL-created roles from default Console-created administrative roles, describes existing-role password reset and LOGIN/NOLOGIN. Current live behavior still requires verification with the learner's actual project and private credentials.
