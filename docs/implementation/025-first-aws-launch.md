# First AWS launch 025 — partial deployment

Date: November 5, 2026. Branch: feature/aws-first-launch. Preparation checkpoint: 1cb3b7d.
Status: incomplete; external CloudFront account verification is required. No public application URL exists.

## Authorization and owners

The user explicitly approved the reviewed first S3/CloudFront/Lambda deployment after accepting the shared account-wide concurrency cap of five and checking Free plan/credits. Root performed AWS mutations through the official MCP. aws_architecture independently checked sequence, parameter patterns, version/origin coupling and signed origins, with no confirmed source defect. frontend_integrator prepared a future read-only browser runner in coordinator staging; it has not run against AWS. frontend_review independently checks actual outcomes in report 026. No application/template/dependency changes were needed for this attempt.

## Real preflight and deployment

STS identity matched the intended project. Initial read-only plan state was FREE/ACTIVE with USD 100 remaining and plan expiration 2027-05-04T13:05:19.905000+00:00. Lambda quota was five total/five unreserved with zero functions. DescribeStacks returned no pre-existing stacks in eu-north-1. Local schema/Guard validation passed before deployment: zero errors/warnings and 21 informational replacement notices. This is distinct from AWS service validation.

Three CREATE change sets were created and individually inspected before execution. Each reached CREATE_COMPLETE/AVAILABLE, listed only the reviewed Add resources, and its scoped DescribeEvents operation succeeded. The backend required CAPABILITY_IAM. Normal STANDARD deployment and rollback remained enabled; no validation bypass or Express mode was used. Successful change-set creation did not prove CloudFront account eligibility.

The storage stack reached CREATE_COMPLETE. Read-back verified the project/CloudFormation tags, all four public-access blocks and AES256 encryption. The new full bootstrap package cloud-bootstrap-20261105 was built from the reviewed existing workspace outputs. Its actual five-file deterministic ZIP was extracted and hash-checked locally, then uploaded through an official short-lived presigned URL with If-None-Match, expected owner and SHA-256 checksum. S3 HeadObject returned the same checksum and no-store metadata. The uploaded ZIP is 4,160 bytes. No frontend object, runtime pointer or final-origin release was uploaded.

The backend stack reached CREATE_COMPLETE: Node.js 24, Arm64, 256 MiB, three-second timeout, published version 1/live alias, AWS_IAM Function URL, scoped execution role and seven-day log group. The configuration deliberately remains ALLOWED_ORIGINS=https://bootstrap.invalid. The account-cap-five choice leaves the accepted shared account quota in effect; no quota or plan change was requested.

## CloudFront failure and actual rollback

Distribution creation failed with HTTP 403 and the service message: Your account must be verified before you can add new CloudFront resources. AWS instructed the account owner to contact Support. This is an account-verification gate, not evidence of a template defect or a need for Paid plan. The full error/request ID is saved in the support draft and ignored receipts.

CloudFormation automatically rolled back the edge stack. Final independent and coordinator reads confirm ROLLBACK_COMPLETE, all eight logical edge resources DELETE_COMPLETE, and no distribution physical ID ever assigned. No alias invocation grants were created. ListDistributions returned an empty normalized object; no absent quantity field is used as a numeric inventory claim. No manual deletion, Support message, upgrade, policy weakening or alternate public-hosting path was attempted. Storage and backend remain created for resume; the failed empty edge stack container also remains. This is not a completed teardown.

## Verified partial behavior

One authenticated Lambda Invoke through MCP executed live version 1. Both API and handler returned 200; all 25 ticket values deep-equal the authoritative local fixture, with cache-control no-store. This verifies deployed handler behavior, not public HTTPS delivery through CloudFront. Anonymous HTTP requests to the actual existing private ZIP and the Function URL's /api/health both returned 403. The source localhost configuration was not changed and the learner's local preview remains independent.

Current S3 object inventory contains only the bootstrap backend ZIP, with no truncated listing. Actual resource/response identifiers, receipts and detailed evidence remain in ignored .local/aws/launch-20261105-receipts.json, lambda-smoke-20261105.json and partial-launch-checks-20261105.json. The ignored target stays intentionally incomplete until real edge outputs exist; do not fill it with guessed IDs.

Latest read-back after the attempt shows FREE/ACTIVE with USD 120 remaining and the same plan expiration; this is an observed balance, not a computed cost/refund or an assertion about why the balance changed. GetFreeTierUsage previously returned an empty array, which does not prove a zero bill. Billing can lag. Preserve Free plan; applicable retained S3/log storage and invocation usage can consume allowances/credits. No database, paid model, hosted pipeline, custom domain, VPC/NAT or optional paid telemetry was introduced.

DescribeTrails returned no configured trail. Durable CloudTrail audit retention is therefore not established; service operation records, MCP evidence and ordinary event history are the available evidence. No new audit-logging resource or charge was enabled automatically.

## Unverified and next action

The full deployment remains incomplete. A public site, actual-origin release, distribution-scoped S3 grant, CloudFront-to-Lambda invocation, HTTPS/cache propagation, browser navigation, live update/rollback and teardown have not been verified. Local browser evidence from preparation 023 is not cloud browser evidence. An English, unsent case draft is in docs/operations/025-cloudfront-account-verification.md. The next learner action is opening AWS Support and requesting account verification while retaining Free plan.

After verification, inspect the current state before recovery. Initial-create ROLLBACK_COMPLETE cannot use a normal UpdateStack; removal/recreation of the empty owned edge stack needs a reviewed explicit cleanup decision. Preserve the successful storage/backend and existing package. Then continue the prepared sequence and perform real public acceptance checks. Do not mark the launch complete or repeatedly retry until the external gate changes.

## Repository checkpoint

Independent review 026 confirmed the partial state through six read-only AWS calls and inspected the final receipts/smoke evidence. It found no confirmed source correction; the public launch remains incomplete. Repository-wide lint, format:check and git diff --check passed. Actual account identifiers, presigned URLs, targets and detailed resource receipts are excluded from tracked content; the ignored paths were checked. Only project records and the unsent support draft changed in this live-launch checkpoint; local application code and the reviewed infrastructure templates remain at preparation checkpoint 1cb3b7d.
