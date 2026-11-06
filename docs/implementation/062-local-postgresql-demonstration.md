# 062. Native PostgreSQL read-only demonstration

Date: November 6, 2026. This coordinator record supplements the author-only verification scope in 060 and the independent source review in 061.

## Observed results

The learner ran the local password runner against the shared PostgreSQL18.6 instance at 127.0.0.1:5432/platypus_service. Passwords were entered locally and were not provided to agents.

- The migrate action as platypus_owner returned applied migration001.
- The seed action as platypus_owner returned applied:true for tickets-demo-v1.
- An explicit owner psql transaction granted schema USAGE and SELECT on platypus.organizations, platypus.support_agents and platypus.tickets to platypus_app. The screenshot showed BEGIN, both GRANT results and COMMIT.
- The serve action selected platypus_app and started dist/postgres-main.js. The learner's screenshot showed PostgreSQL ticket server ready at localhost:3000. Opening the root path returned the expected NOT_FOUND response; /api/tickets returned ticket records.
- The coordinator independently read /api/tickets: HTTP200, total25, all canonical fixture values equal, and no-store. Ignored evidence .local/evidence/local-postgres-http.json records observation time 2026-11-06T10:57:57.972Z and response SHA256 5326d6f1509875836f91ccd02cfed1f3fde64088d07449c0a84b43782b6ffc71. The explicit PostgreSQL entry has no fixture fallback; fixture content was inserted into the database by seed.
- In a separate terminal, the learner started node scripts/serve-local.mjs support-standalone and confirmed that http://localhost:5175/ displays the table while the PostgreSQL backend remains running.

Actual main CI [42205589456](https://github.com/dmytrorozhkov/platypus-service/actions/runs/42205589456) at fe8bb0533180bf6f0da703f51a6ff511d5b6cb2b succeeded in both required jobs, including disposable PostgreSQL tests and the complete Windows checks. This result belongs to that exact source commit.

## Startup and remaining verification

From the repository root, the learner starts the database backend with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\postgres-local.ps1 -Action serve
```

The hidden prompt expects the local platypus_app password. Start the frontend in a separate terminal with node scripts/serve-local.mjs support-standalone. The ordinary npm start command uses the fixture backend and should not be used for this database demonstration.

The learner accepted the visible database-backed read-only table and then performed the guided Ctrl+C/backend restart check. The outage screenshot showed the backend terminal returned to the PowerShell prompt, the frontend terminal remained active, and Support displayed Tickets are unavailable with Retry. After the learner reran the serve action, the next screenshot showed dist/postgres-main.js, PostgreSQL ticket server ready at localhost:3000 and the recovered 25-ticket table. This demonstrates visible native backend stop/restart recovery with the existing database. The screenshots do not separately establish every descendant-process cleanup condition or whether recovery used Retry versus page reload. The shared Windows PostgreSQL service remains running; do not stop/restart it as an application test. No native business-record edit or post-seed database-service restart preservation is claimed. Disposable CI persistence checks are separate evidence.

No Package or Deploy workflow was dispatched, no CodeBuild operation or cloud resource/access change occurred, and the public AWS application remains fixture-backed. Authentication, server-enforced permissions and record writes remain later agreed stages.
