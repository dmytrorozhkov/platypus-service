# Independent AWS Deployment Planning Review 021

Date: November 4, 2026.
Status: complete. No blocking inconsistency found between architecture proposal 019, cost proposal 020 and the accepted application slice.

This verdict supports coordinator synthesis and a separately explained account/eligibility step. It does not approve account creation, installation, resource provisioning, application implementation or spending, and does not establish cloud compatibility or a guaranteed zero bill.

## Evidence and attribution

Personally read AGENTS.md, project-plan section 5.25, task 021 and both final staged proposals. Inspected the current Node HTTP route/origin/error handling, Support's origin-only API configuration and collection validation, and Shell route definitions. Independently recomputed the estimate's quantities and low/baseline/high arithmetic in JavaScript. Consulted primary AWS documentation for consequential account, pricing-plan, Function URL, OAC and allowance claims.

Exact regional Price List SKU extraction, publication dates and artifact-size inventory are planner evidence. This reviewer attempted anonymous catalogue retrieval, but shell network access failed and the browser research tool could not open those JSON URLs; no independent catalogue extraction is claimed. Public documentation and arithmetic checks supplement that evidence. No account access, authenticated AWS call, deployment, installation, application/Git mutation or process operation occurred.

## Architecture and existing contracts

Both reports select the same bounded inventory: private S3, one CloudFront pay-as-you-go distribution, separate S3 and Lambda OACs, one exact-route CloudFront Function, one ordinary on-demand Lambda Event Function/alias, permissions and a seven-day log group. Both use Arm64, Node.js 24, 256 MiB, assumed 100 ms billed duration, three-second timeout and proposed reserved concurrency two subject to actual quota availability. No database, API Gateway, VPC/NAT, custom domain, paid model or authentication is included in the first demonstration.

The server currently uses node:http and needs a real event adapter/shared application boundary; the proposal does not claim an unchanged localhost server will run as an ordinary Event Function. Packaging compiled modules, fixture JSON and module metadata preserves the server-owned 25-example repository. Health remains application liveness, and tickets retain items/total and seven public properties. Origin restrictions and OAC are not application-user authorization.

Support rejects API addresses containing a path prefix. The proposed CloudFront origin alone is correct; forwarding /api/* without stripping the path matches current endpoints. Forwarding Origin while excluding viewer Host is consistent with a signed Function URL origin. The proposed resource policy includes both invocation permissions documented for CloudFront OAC, with AWS_IAM on the URL. Actual alias policies, PassRole, execution-role and bucket-policy operations still require account-specific validation. [Lambda OAC documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html).

The /mfe/<application>/<release>/ layout avoids the Support page route. Exact Shell rewrites preserve Analytics as the default and direct refresh of the three accepted pages. Missing modules, metadata and configuration retain non-HTML errors; a private S3 origin may return 403 rather than 404. Mutable document/configuration caching has zero TTL, independent of immutable release assets. The proposal explicitly prevents a positive minimum TTL from overriding no-store metadata. Complete release graphs, independent runtime pointers, retained previous assets and document reload for registered federation updates make update/rollback expectations coherent.

## Account conditions and cost checks

The new signup experience assigns Ohio, Stockholm or Sydney from contact-country information. Frankfurt is only a comparison case; the actual account is unknown. The reports correctly preserve permissions/service-feature gates instead of inferring full access from a supported service name. [Project Regions](https://docs.aws.amazon.com/accounts/latest/reference/project-regions.html), [supported services](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html).

The CloudFront flat-rate Free product must not be confused with the AWS account Free plan: current documentation excludes accounts using AWS Free Tier from flat-rate plans. Selecting pay-as-you-go without upgrading merely to obtain that product is consistent with the learning preference. [Flat-rate account constraints](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html#flat-rate-pricing-plan-account-level-constraints).

Independent recalculation reproduced these USD values before tax and credits, using the report's rates:

| Check                                                   |  Recalculated result |
| ------------------------------------------------------- | -------------------: |
| Baseline CloudFront viewer requests                     |              110,000 |
| Baseline Lambda duration                                |       250 GB-seconds |
| Baseline frontend plus API delivery                     |         1.095367 GiB |
| Frankfurt baseline gross, before allowances             |             0.569919 |
| Frankfurt baseline residual after continuing allowances |             0.047286 |
| Origin-bound transfer contingency                       |             0.002098 |
| Stockholm baseline residual, before that contingency    |             0.044000 |
| Frankfurt low scenario gross / residual                 |  0.285849 / 0.008586 |
| Frankfurt 100-times-traffic gross / residual            | 31.817544 / 6.304286 |

Request, per-10,000-request, per-million-request, GB-second and storage-month conversions are internally consistent. Gross is explicitly counterfactual before included allowances, including invalidations; it is not a payable quote. The current CloudFront rate/allowance tables support the request and rewrite allowances used; inconsistent marketing examples are appropriately not used as the calculation basis. [CloudFront pay-as-you-go pricing](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/).

The model includes API viewer delivery, conservative cache-miss S3 reads, deployment PUT/LIST operations, retained packages/releases, logs and a separately labeled origin-bound transfer contingency. Average billed duration, compression, request headers, actual cache misses and storage growth remain assumptions to measure. Regional SKU prices and approximate GiB treatment must be refreshed for the actual selected account/Region before provisioning.

Zero out-of-pocket usage is conditional on an eligible active plan and sufficient applicable unexpired credits. It is not permanent free hosting or a monthly traffic cap. The report conservatively handles AWS's conflicting credit-expiry wording and requires inspecting actual grants. Free-plan expiry can suspend access; continuing on Paid is a separate decision. [AWS Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/).

Reserved concurrency, timeouts and alerts do not impose a monthly zero-dollar cap. The newer project spend limit is a distinct Paid-plan feature with a minimum at least $20 and pre-tax, credit-excluding accounting; it cannot serve as this project's $0 control. [Spend-limit documentation](https://docs.aws.amazon.com/accounts/latest/reference/create-spend-limit.html).

## Remaining gates and verdict

No planner correction is required. Preserve these gates in the consolidated plan:

- Verify signup route, actual Free/Paid status, assigned Region, credit eligibility/expiry, quotas and required CloudFormation/IAM/OAC operations before any creation. Do not automatically upgrade or activate advanced features to bypass restrictions.
- Separately approve implementation and provisioning, then verify real HTTPS routes, private origins, non-HTML missing assets, uncached API failure/Retry, federation cleanup and independent release/rollback.
- Measure duration, transfer, logs and retained storage; reprice if assumptions or shared allowances differ. Billing country, VAT and currency conversion remain unknown.
- Keep PostgreSQL outside first-demo totals. The RDS/Aurora figures are later base-component scenarios with persistent storage, pause/restart and connectivity costs still requiring a separate design and estimate.
- Retain explicit stop and teardown ownership for both infrastructure phases, all artifacts, versions and logs. Stopping local applications or deleting templates does not remove cloud resources or erase prior usage charges.

The proposals are suitable for the next bounded discussion. Cloud execution, effective permissions and actual billing behavior remain unverified.
