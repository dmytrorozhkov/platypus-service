# Independent First AWS Launch Review 026

Date: November 5, 2026.
Status: review complete; **first public launch incomplete, blocked by AWS account verification for CloudFront**.

The partial result must not be described as a deployed public application, successful end-to-end launch or completed teardown. No application/template defect requiring a correction was established by this failure.

## Scope and independent evidence

Read AGENTS.md, approved project-plan section 5.31, the reviewed templates/recovery instructions, coordinator evidence and the current ignored receipts:

- .local/aws/launch-20261105-receipts.json
- .local/aws/partial-launch-checks-20261105.json

Applied aws-investigation and aws-sdk-python-usage guidance. Personally issued one bounded, read-only AWS MCP script in eu-north-1 containing DescribeStacks for the three named project stacks, ListStackResources and DescribeStackEvents for the edge stack, and GetAccountPlanState. The response recorded all six API calls as successful. Edge resource/event results had no remaining pagination token. This establishes the named launch's state; it is not an account-wide resource or billing audit.

The reviewer performed no AWS mutation, invocation, CLI operation, support message, account change, deletion or application/Git edit. The Lambda invocation and anonymous-origin probes below are coordinator evidence, inspected in the receipts rather than repeated.

## Verified partial state

| Component               | Independently observed state                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| platypus-dev-storage    | CREATE_COMPLETE; DistributionId remains empty                                                               |
| platypus-dev-backend    | CREATE_COMPLETE; account-cap-five selected; AllowedOrigin remains https://bootstrap.invalid                 |
| platypus-dev-edge       | ROLLBACK_COMPLETE after failed initial creation; Enabled parameter false                                    |
| Edge resource inventory | All eight listed logical resources report DELETE_COMPLETE; Distribution has no physical resource identifier |
| Account plan            | FREE, ACTIVE; USD 120.00 remaining credits; expiration 2027-05-04T13:05:19.905000+00:00                     |

The event at 2026-11-05T08:45:51.213000+00:00 records Distribution CREATE_FAILED with CloudFront HTTP 403 and HandlerErrorCode AccessDenied. Its operative message is:

> Your account must be verified before you can add new CloudFront resources. To verify your account, please contact AWS Support (https://console.aws.amazon.com/support/home#/) and include this error message.

The stack subsequently reached ROLLBACK_COMPLETE at 2026-11-05T08:48:26.751000+00:00. CloudFormation automatically removed the edge resources created during that operation. The failed edge stack record still exists, and the two successful stacks remain. This automatic rollback must not be confused with a user-authorized full teardown or manual DeleteStack operation.

The final ListDistributions receipt is an empty object without a quantity field. It is not used as proof of an account-wide distribution count. The named distribution's failed creation, lack of a physical identifier and edge rollback inventory support the scoped conclusion that this launch produced no public CloudFront site.

## Coordinator checks and their limits

The coordinator's Lambda smoke check records AWS Invoke status 200, executed version 1, handler response 200, total 25, fixture-value equality and no-store headers. The observed deployed configuration is Node.js 24 on Arm64, 256 MiB, three-second timeout, with the live alias pointing to version 1 and AWS_IAM on its Function URL. The stored code hash agrees with the bootstrap package parameter. These checks establish useful backend deployment progress, not public Function URL or CloudFront routing success.

Anonymous requests to the actual private ZIP and Function URL health path each returned 403. These are successful denial checks for the tested requests; they do not establish eventual signed CloudFront access, complete authorization coverage or user authentication.

The S3 object inventory in the receipts contains the bootstrap backend ZIP. There is no final distribution hostname, final-origin frontend package/publication or public browser check. Direct-route refresh, remote loading/styles, real HTTPS/cache propagation, signed origin access and public error/Retry recovery remain unperformed. Prior local browser checks are local preparation evidence only.

The latest credit balance is an observation, not an explanation of why it increased, a measured zero bill or a guarantee of future free usage. Storage, the function/alias/URL, role and logs still exist. Local process shutdown and edge rollback do not remove those resources. No database or additional hosting service was introduced. The receipt also notes that durable CloudTrail trail retention was not configured; local receipts and service event history should not be described as equivalent durable auditing.

## Safe continuation

1. Explain the exact verification response to the learner and let the learner use the official AWS Support/account-verification route. No support case was opened by this review. The recorded CloudFront service Request ID can accompany the error; it is not an existing Support case ID. There is no evidence that a Paid-plan upgrade, broader IAM grant, different Region or public-origin bypass is required or would resolve it.
2. Leave existing resources and the failed stack untouched while verification is unresolved. Preserve the Free plan and the accepted shared account-cap-five choice. Do not repeatedly create distributions, open S3 publicly or switch to an anonymously callable URL to bypass the restriction.
3. After AWS verification, refresh plan/credit/quota/ownership evidence and inspect the failed stack again. ROLLBACK_COMPLETE from an initial create is not an updateable working stack: AWS documents that only deletion is allowed in that state. A later recovery must explicitly review and authorize removal/recreation of the empty owned edge stack, or another concrete recovery plan, while preserving storage/backend. The existing launch approval does not authorize destructive teardown. [CloudFormation stack statuses](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/view-stack-events.md).
4. Once an actual distribution exists, finish the reviewed sequence: generate its exact-origin configuration, update the backend version/origin, grant only its frontend access, publish complete graphs/control files, then enable and verify the public application. Do not treat the bootstrap placeholder as a final deployed origin.

## Verdict

Evidence and the partial-deployment interpretation are consistent. No confirmed corrective source change is required at this checkpoint. The external CloudFront verification restriction blocks the requested public launch, and successful browser acceptance remains outstanding. The appropriate handoff is a factual partial-launch report and the learner's next account-verification step, with no upgrade, bypass or destructive action performed automatically.
