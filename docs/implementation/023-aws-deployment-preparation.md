# AWS deployment preparation 023

Date: November 4, 2026.
Status: implemented, locally verified and integrated; independent review 024 found no remaining confirmed blocker. No cloud deployment or resource operation was performed by this agent.

## Changes

Added three CloudFormation JSON templates under `infrastructure/`, a target example and an operational README. Added offline packaging, command-plan generation, a packaged-layout preview and meaningful tests under `scripts/aws/`. Root owns the package scripts/lockfile and project records; task 022 owns the shared server handler. No application code, source localhost configuration, account settings, credentials or running existing applications were changed by this task.

The templates define the accepted private S3 + pay-as-you-go CloudFront + ordinary Node.js 24 Arm64 Event Function candidate. The function has 256 MiB memory, a three-second timeout, scoped logging permissions, a seven-day log group, retained versions, a stable live alias and an IAM-signed Function URL. The edge owns two OACs, both distribution/account-scoped Lambda invocation grants, exact Shell-page rewriting, cache policies and response security headers. Mutable configuration/metadata and API responses have zero edge TTL; missing assets never become successful Shell HTML. Private package and rollback paths are not granted viewer access.

Three stacks replace the proposal's illustrative two-phase option to make bootstrap dependencies explicit: storage first; backend from its uploaded ZIP; disabled edge from backend outputs. A later reviewed publication updates the backend's exact allowed origin and immutable version, grants the distribution frontend access through the storage stack's single bucket policy, uploads complete graphs and switches control documents last, then enables edge delivery. No import/export cycle or automatically selected localhost/cloud hostname exists.

Function and version descriptions share a code-plus-origin configuration fingerprint, so origin-only updates publish a correct snapshot while unchanged code/configuration avoids duplicate publication. Backend rollback uses a CloudFormation parameter for the alias rather than an out-of-band alias update. Retained versions must belong to the same function and have the required origin before selection.

## Packaging and command behavior

`aws:prepare` writes an immutable owned release under ignored `.local/aws/releases/<release>`. It refuses existing output, links and invalid paths. It copies complete frontend graphs, generates absolute deployment-only configurations, excludes `.nf-cache` and remote standalone documents, records object MIME/cache metadata and hashes, and preserves original source configuration.

The Lambda archive uses standard .NET ZIP APIs through fixed local PowerShell code, ordered entries and fixed timestamps. It is really extracted, then its exact five-file graph and byte hashes are compared. The extracted handler is checked again before local execution. No new ZIP dependency, global installation or execution-policy change was needed.

Every manifest includes complete per-remote object/hash lists. Future publish plans verify all referenced graph checksums before switching the runtime pointer. Remote rollback verifies every retained selected-remote file, not just metadata/CSS, and merges only that application's pointer. Pointer replacement uses the verified current ETag; stale or conflicting deployment state must stop the operator.

`aws:plan` prints auditable structured API-operation descriptions for bootstrap, publish, check, independent remote publication/rollback, backend rollback and destroy. There is **no cloud executor and no accepted --execute flag**. Without a reviewed target it prints gates and no operations. The README explains how a future authorized MCP operator resolves local-file/result references, presigned S3 upload requirements, expected assertions, waits and browser checks. A submitted command is not reported as a completed deployment.

The current account quota reported by the coordinator is five concurrent executions with five unreserved. This cannot support reserved concurrency two under the normal unreserved-buffer rule. Target mode defaults to unresolved; a fresh reviewed quota permitting two reservations or explicit acceptance of the shared account-wide cap is required. The implementation does not silently remove the intended limit, request a quota increase or upgrade the plan. Neither mode is a monthly spending cap.

Full destroy plans require actual stack outputs, project/account/Region checks and the exact stack prefix. Private retained bucket/version ownership, paginated object review, edge-before-backend ordering, explicit retained-bucket deletion and final inventory are documented. Failed partial bootstrap needs the separate manual recovery instructions because full destroy cannot invent missing edge/backend outputs.

## Startup and checks

From `D:\Projects\Pet-projects\aws`, after the existing project build:

```powershell
npm.cmd run aws:prepare -- --release preview-a --origin http://localhost:4400
npm.cmd run aws:preview -- --manifest .local/aws/releases/preview-a/manifest.json
```

Open `http://localhost:4400/support/tickets`. Ctrl+C stops only that preview. It hosts the packaged files and invokes the ZIP-extracted handler on the same local origin. This is not AWS hosting, IAM/OAC/TLS emulation or a new deployment URL. Root reserves port 4400 for coordinator verification; implementation tests use their own ephemeral available ports and close only their own listeners/browser sessions.

Executed verification:

- `npm.cmd run test:aws`: **7 groups passed**. Real built artifacts were packaged twice; standard ZIP byte hashes were identical; extraction and the real exported handler returned 25 tickets. Source Support configuration stayed unchanged and overwrite attempts failed.
- In an isolated installed headless Edge session, actual prepared Shell/Angular Support/React/Vue files loaded through release-prefixed generated Native Federation metadata on all three direct routes. Tickets rendered 25 rows; a controlled API failure displayed the existing error and Retry recovered. No page exception occurred. Missing module/metadata and private package paths returned non-HTML errors.
- Plan tests covered fail-closed unresolved/quota/ownership/stale-target gates, unavailable reserved-two mode, rejected execution flags, bootstrap order, configuration-version fingerprints, pointer-last uploads, independent pointers, conditional replacement, every-file rollback checksum reads, alias rollback and teardown ordering. Negative integrity checks rejected altered object keys and extracted handler bytes.
- `npm.cmd run lint`: passed for the authored source and existing workspace at handoff.
- Scoped `prettier --check scripts/aws infrastructure`: passed. Root performs the final repository-wide format check after integration records are complete.
- `npm.cmd run aws:validate`: passed using root's exact project-local `@aws/cloudformation-validate` 1.15.0 setup and actual Guard rules. Final templates have zero errors/warnings; 21 informational I9001 entries explain create-only replacement properties. No diagnostics were suppressed. Template sizes: storage 5,744 bytes; backend 9,818 bytes; edge 19,571 bytes, below the 51,200-byte inline limit.

Final implementation-test evidence: `.local/aws/releases/test-mw2pkjuw-local`, `test-mw2pkjuw-cloud` and `test-mw2pkjuw-remote`. The local directory includes `packaged-tickets.png`; its complete table was visually inspected. Generated cloud-test target identifiers/hostnames are fictional and were never sent to AWS. The schema/Guard evidence is `.local/aws-validation/report.json`.

The coordinator separately reported read-only real account quota checks and preliminary AWS `ValidateTemplate` acceptance. Those are coordinator evidence, not calls performed here; service template syntax acceptance does not establish effective permissions, successful resource creation or runtime hosting.

## Remaining cloud-only work

The application is prepared for a separately approved deployment, not deployed. Required later checks include Free-plan/credit and quota decisions, actual IAM/PassRole/OAC permissions, signed origin denial, real HTTPS and edge propagation, actual cache behavior, published alias/configuration state, controlled real cloud update/rollback/teardown and billing. PostgreSQL, application sign-in/authorization, large-table querying, AI services and hosted delivery automation remain outside this stage.

Applied CloudFormation/IAM/CloudFront skills and current primary property references. Resource-context metadata and `aws-cloudformation@3` attribution are present. Intentional exceptions are recorded: no object versioning for immutable fictional artifacts; retained bucket and Lambda versions with explicit cleanup ownership; deletion of short-lived diagnostic logs during deliberate teardown; no paid optional protection/telemetry services or guessed CSP introduced by generic defaults. See `infrastructure/README.md` for exact commands, rationale, restrictions and source links.

## Coordinator completion checkpoint

Independent review 024 found no remaining confirmed blocker. After the final source handoff, the coordinator reran repository-wide lint, format:check and git diff --check successfully. The final offline schema/Guard check passed with zero errors/warnings and 21 informational replacement notices; its first restricted attempt could not save the report on D:, and the authorized retry completed without changing validation code. Three read-only MCP ValidateTemplate calls accepted the final storage/backend/edge template bodies (5,744 / 9,818 / 19,571 bytes), with CAPABILITY_IAM reported for backend. No stack or change set was created.

The coordinator's earlier integration runs passed all five workspace builds/typechecks, two integration groups, 25 existing built-Shell browser groups and three owned-process lifecycle groups. Review 024 independently reran eight server groups, two pure AWS groups and final artifact checks, including coordinator release coord-20261104-b. The packaged Tickets screenshot was visually inspected. The temporary coordinator-owned normal preview was stopped after verification; no unrelated process was stopped. To demonstrate the prepared package locally, run aws:preview with .local/aws/releases/coord-20261104-b/manifest.json and open http://localhost:4400/support/tickets. Generated artifacts and evidence remain ignored.

The source checkpoint belongs on feature/aws-deployment-preparation. User acceptance of the demonstration and authorization for actual cloud resources are separate next steps. The unresolved account concurrency decision remains visible; no quota, account plan or default branch was changed.
