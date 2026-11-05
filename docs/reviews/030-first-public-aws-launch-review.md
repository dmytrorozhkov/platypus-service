# Independent First Public AWS Launch Review 030

Date: November 5, 2026.
Status: complete; no confirmed deployment blocker found in the supplied live acceptance evidence.

Public origin: https://d2p7y3iystcl60.cloudfront.net.

The bounded first public demonstration is supported by actual deployment and browser evidence. It contains the accepted fictional 25-ticket slice, not the later authenticated, persistent or large-data application. Learner acceptance of the demonstration remains a separate interaction.

## Scope and attribution

Read task 029/030, original authorization and recovery records, current target/release manifest, deployed-state receipts and the live checker previously reviewed against actual application selectors. The user explicitly authorized deletion of only the empty failed edge stack and continuation of the existing launch; this supersedes the historical pending-deletion boundary in reviews 026/028. It does not authorize unrelated teardown or new services.

Primary local evidence inspected:

- .local/aws/recovery-20261105-evidence.json
- .local/aws/publication-20261105-evidence.json
- .local/aws/final-live-20261105-evidence.json
- .local/aws/current-deployment.json
- .local/aws/releases/cloud-live-20261105/manifest.json
- .local/evidence/aws-live-check.json and its desktop/mobile screenshots

Personally ran read-only assertions over these files: template target/release consistency, manifest ownership/hash validation, final stack/distribution/plan fields, active alias configuration/hash, private-origin policy scoping, complete object inventory and 26 frontend/control-object checksum/MIME/cache comparisons against the manifest. Visually inspected both screenshots.

The live AWS operations, HTTPS probes and real headless Edge run were performed by the coordinator. This reviewer checked their recorded results and successful API-call entries rather than repeating cloud/browser traffic. No AWS call, listener, application/Git edit, cloud mutation or process stop was performed during this review. Only this report was authored and formatted. Final implementation report 029 and shared completion records were still being finalized at this evidence cutoff; no claim of reading their final wording is made.

## Deployment and publication checks

The final inventory records 2026-11-05T16:35:40.317219+00:00. All three project stacks report UPDATE_COMPLETE. The raw distribution response reports Deployed and Enabled=true, with the hostname matching the target, manifest and browser evidence. This is stronger evidence than change-set execution alone.

Recovery records preserve the successful storage/backend stacks and replace only the authorized empty failed edge stack. The replacement edge was created disabled. Later publication updates the backend's exact origin and immutable live version, grants the distribution frontend-only storage access, uploads verified artifacts/control documents and enables the edge. The current deployment record includes the release, pointer hash/ETag and active alias version.

The live alias selects version 2. Its configuration records Node.js 24, Arm64, the exact CloudFront origin and the package CodeSha256 expected by the manifest. The Function URL remains AWS_IAM. Both required invocation grants target the live alias and CloudFront service principal with the exact distribution/account conditions; InvokeFunction additionally requires invocation through the Function URL.

The observed S3 bucket policy grants only frontend paths to that distribution and denies insecure transport. It excludes _deploy and _releases. The final inventory contains exactly 28 objects: all 27 objects in the current release plus the retained bootstrap backend ZIP. Read-only comparisons verified the uploaded frontend/control-object hashes, MIME types and cache metadata recorded in HeadObject receipts. The published backend configuration hash matches the current release package. No unrelated object or unexplained release object was identified in that inventory.

The selected shared account-cap-ten mode remains a shared account quota, not a per-function reservation. No database, custom domain, VPC/NAT, application authentication, paid model or hosted pipeline was added to this launch inventory.

## Live HTTP and browser acceptance

The checker reports success for six groups between 2026-11-05T16:34:52.445Z and 16:35:07.553Z:

- HTTPS health and tickets return 200 with no-store. Tickets match all 25 authoritative fixture values and ordering, with total 25.
- Runtime configuration and generated metadata for Analytics, Administration and Support use the actual same origin and no-store; release CSS has the expected immutable year-long cache metadata.
- Missing modules/metadata return non-HTML 403 errors, while private package/backup paths return non-HTML 404 errors. Anonymous S3 index and Function URL health requests return 403. An untrusted browser Origin receives an application JSON 403 with no-store.
- Real prepared Angular Shell/Support, React Analytics and Vue Administration load on their direct routes and survive refresh. Repeated navigation leaves only the active remote root; tickets render from PS-1001 through PS-1025.
- A browser-intercepted API 503 displays the existing error state; removing that interception and pressing Retry restores 25 cloud tickets. This is explicitly a browser-only failure simulation, not a real Lambda/CloudFront outage test.
- Mobile page width remains 390px for a 390px viewport; the 344px table region retains 1060px of horizontally scrollable content.

Recorded pageErrors, consoleErrors and unexpectedRequests are empty. Browser request evidence points exclusively to the actual CloudFront origin, including release-prefixed federation modules and the API; no localhost application server is required by the demonstrated requests. Screenshots show the full desktop table and a usable mobile layout with the table confined to its own scrolling region.

## Findings and remaining limits

No confirmed deployment blocker requiring correction.

Minor existing copy limitation: Shell still displays LOCAL/Local development, and Support's footer says data comes from the local server. These inherited labels are misleading for the deployed environment, but network evidence establishes that this run uses the cloud API. No source change was part of this launch review; record the wording issue for a later scoped content change.

The recorded final account state remains FREE/ACTIVE with USD 120 observed credits and expiration 2027-05-04T13:05:19.905000+00:00. Total/unreserved Lambda quota is ten. These are point-in-time observations, not a zero-dollar bill, permanent free hosting, a quota-change claim or a monthly spending cap. Prior cost assumptions and ongoing usage/credit monitoring still apply.

Live independent remote publication/rollback, backend rollback, full teardown and a real cloud outage/recovery were not performed by this acceptance run. Their prepared/local checks must not be relabeled as live verification. Exhaustive edge/cache propagation, account-wide security or billing audits, and durable CloudTrail trail retention are also not established. Origin restrictions/OAC do not provide end-user sign-in or organization authorization; the public data is fictional.

## Verdict

The supplied evidence supports completion of the bounded first public AWS launch and presentation of its actual HTTPS URL to the learner, with the minor copy limitation and remaining checks stated above. Prior CloudFront account verification is no longer the active launch blocker: the recorded replacement distribution is deployed and serving the accepted slice.
