# First public AWS launch 029

Date: November 5, 2026.
Status: deployed and live verification passed; independent review 030 found no deployment blocker. Learner-visible acceptance remains pending.

## Scope and authorization

The learner directly authorized deleting only the empty failed `platypus-dev-edge` stack and continuing the previously approved first S3/CloudFront/Lambda deployment. The accepted concurrency choice is the shared account-wide cap of ten. Preserve Free plan, the successful storage/backend, existing fictional data and the reviewed service inventory; do not request quota increases or activate paid/advanced account features.

The coordinator owns all AWS operations and shared project records. This report's author inspected task 029, the saved recovery/publication/final inventory, live-runner evidence, current deployment record and prepared release manifest. Cloud operations, live HTTP/browser execution and desktop/mobile visual inspection described below were performed by the coordinator. The report author reviewed those saved results; no AWS operation, repository edit, Git mutation, application listener, build or test execution was performed while drafting this report.

## Recovery and publication evidence

Fresh coordinator preflight matched the intended project identity, active Free plan, remaining credits and ten total/unreserved Lambda executions. Storage and backend were `CREATE_COMPLETE`. The old edge record was `ROLLBACK_COMPLETE`, with all eight recorded logical resources already `DELETE_COMPLETE` and no surviving distribution. The coordinator verified the exact stack identity/tag before deleting only that empty stack record; a subsequent read confirmed its `DELETE_COMPLETE` state.

The unchanged edge template then created a new disabled distribution and its reviewed origin controls/policies. Storage/backend were preserved rather than recreated. The new distribution's actual output supplied the deployment origin:

**https://d2p7y3iystcl60.cloudfront.net**

The coordinator verified that this public HTTPS origin serves the deployed application without a locally running application server.

The fresh immutable release is `.local/aws/releases/cloud-live-20261105/manifest.json`. It contains complete Angular Shell/Support, React Analytics and Vue Administration graphs, deployment-only runtime/API addresses, retained rollback documents and the same five-file Lambda ZIP. Application features, source localhost configuration and the 25 fictional ticket values are unchanged. No database, application identity, additional service or paid AI functionality was introduced.

The coordinator uploaded and verified 24 non-control frontend/rollback objects, one backend ZIP and two control objects: 27 manifest objects in total. SHA-256 checksums, lengths, MIME types and cache metadata were compared against the prepared manifest. Complete remote graphs were checked before switching `runtime-config.json`; Shell `index.html` was written last. Both control objects were subsequently confirmed with the expected checksums and `no-store` metadata.

Backend/storage updates completed before edge enablement:

| Component                       | Recorded result                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Backend stack                   | `UPDATE_COMPLETE`, explicit `account-cap-ten` parameter                                                             |
| Live alias                      | Version `2`; its actual code hash matches the prepared ZIP                                                          |
| Published backend configuration | Exact generated CloudFront HTTPS origin in `ALLOWED_ORIGINS`                                                        |
| Function URL                    | IAM-protected alias origin; distribution-scoped invocation policy present in coordinator evidence                   |
| Storage stack                   | `UPDATE_COMPLETE`; the existing bucket's single policy grants the new distribution only the reviewed frontend paths |
| Edge before enablement          | Newly created and disabled; origin/grant/artifact gates reviewed                                                    |
| Final edge state                | `UPDATE_COMPLETE`; distribution `Deployed` and `Enabled: true`                                                      |

The edge-enablement change set was inspected: it modifies the distribution without replacement. Recorded change-set validation evidence contains no `VALIDATION_ERROR` events; the coordinator then executed it with standard deployment/rollback behavior and waited for completion. Final reads confirmed all three stacks `UPDATE_COMPLETE`, the distribution `Deployed` with delivery enabled, and live backend version `2`.

The final S3 inventory contained exactly 28 expected objects: the 27-object current manifest plus the retained prior bootstrap ZIP. Retaining that earlier ZIP is deliberate; no unknown object or unexpected resource replacement was reported. The ignored current-deployment record stores the verified release, live alias version, runtime-pointer ETag/hash, remote references and stack states.

## Public verification completed

The coordinator executed the read-only `scripts/aws-live-check.mjs` runner against the actual public origin and protected origins. The equivalent command using the verified outputs retained in the ignored local target is:

```powershell
$launchTarget = Get-Content -LiteralPath '.local/aws/target.json' -Raw -Encoding utf8 | ConvertFrom-Json
node scripts/aws-live-check.mjs --origin $launchTarget.resources.origin --bucket-origin ("https://" + $launchTarget.resources.bucketDomain) --function-url $launchTarget.resources.functionUrl
```

Six actual HTTP/browser groups passed, with `success: true` recorded in the saved runner result:

1. HTTPS health and tickets returned `no-store` responses; all 25 fictional ticket records matched the existing fixture values exactly.
2. Runtime configuration and generated federation metadata used the deployed same-origin HTTPS addresses and `no-store`; remote assets used immutable caching.
3. Missing/private paths retained non-HTML errors. Anonymous S3 and Function URL access, and an untrusted API Origin, were denied.
4. Analytics, Administration and Tickets opened by direct route and refreshed correctly; all generated remotes loaded, 25 table rows rendered and repeated navigation removed previous remote roots.
5. A **browser-only** API 503 interception displayed the controlled error; removing the interception and selecting Retry restored all 25 cloud tickets. This did not disable Lambda or simulate an AWS infrastructure outage.
6. Mobile layout preserved page width and the scrollable table, with no localhost or other-origin requests. The recorded page and viewport widths were both 390 pixels; wider table content remained horizontally scrollable.

The runner recorded no unexpected requests, page exceptions or unexpected console errors. The coordinator also visually inspected the resulting desktop and mobile screenshots. These are live cloud HTTP/browser results rather than a reuse of earlier local preview results. They establish the demonstrated slice at verification time, not global availability or a load/production-readiness guarantee.

An inherited cosmetic limitation remains: the interface still contains `LOCAL`, `Local development` and a local-server footer label from the original demonstration. Network evidence confirms cloud-only application requests; the labels do not indicate a dependency on the local server. No new application-code change was added to this deployment stage to rewrite that copy.

## Cost and evidence limits

Recorded preflight and final post-verification reads showed `FREE` / `ACTIVE` with USD 120 observed remaining credits; account-plan expiration remains May 4, 2027. Final quota reads still showed ten total/unreserved Lambda executions. These are observed plan/credit/quota readouts, not a measured zero bill, an invoice result, a guaranteed future balance or permanent free hosting. Cost proposal 020 remains a workload-based estimate; actual usage and applicable allowances/credits determine consumption. The shared account-wide concurrency cap is neither a per-function reservation nor a monthly spending limit. The coordinator did not request a quota change or upgrade the account plan in this recovery.

Raw account/resource identifiers, stack/change-set receipts, policy details, object checksums and configuration reads stay in ignored local evidence:

- `.local/aws/recovery-20261105-evidence.json`: fresh preflight, exact empty-stack recovery, disabled replacement edge and non-control artifact evidence.
- `.local/aws/publication-20261105-evidence.json`: backend/storage updates and verification, control-object checks, reviewed enablement change set, validation and execution receipt.
- `.local/aws/releases/cloud-live-20261105/manifest.json`: complete prepared release graph, public origin and object integrity metadata.
- `.local/aws/final-live-20261105-evidence.json`: completed stack/distribution states, refreshed plan/quota reads and exact expected object inventory.
- `.local/evidence/aws-live-check.json`: six passing HTTP/browser groups, request/error evidence, mobile measurements and successful completion.
- `.local/evidence/aws-live-desktop.png` and `.local/evidence/aws-live-mobile.png`: screenshots visually inspected by the coordinator.
- `.local/aws/current-deployment.json`: verified current release, alias version, pointer integrity and stack references.

No live independent feature publication/rollback or full teardown has been demonstrated by this stage. The authorized deletion of the empty failed stack record is not a teardown test of the running application. No dedicated CloudTrail trail or durable audit-retention guarantee is established here; local operation evidence does not constitute that service guarantee. PostgreSQL, sign-in, server-enforced application permissions, large-table querying and AI workflows remain later course stages.
