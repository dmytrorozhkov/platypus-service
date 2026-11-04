# AWS first-demo cost plan — proposal 020

Research date: November 4, 2026. Currency: USD, excluding tax and currency conversion. Billing country is unknown. No account, resource, installation, deployment or paid action was performed. Public sources and anonymous AWS Price List files were read; this is a reproducible estimate, not a measured bill or authorization to spend.

## Decision

The existing four frontends and the 25-example API can plausibly run with **zero out-of-pocket payments while a verified eligible AWS Free plan and credits remain active**. Recommend private S3, CloudFront **pay-as-you-go**, and an ordinary Lambda **Event Function** with a function URL. PostgreSQL is a separate later estimate. Continuing after the Free plan ends requires a deliberate Paid-plan decision; tiny usage is inexpensive, but not permanently zero-cost.

At the defined conservative baseline, continuing service allowances leave approximately **$0.0473/month in Frankfurt or $0.0440/month in Stockholm**, principally S3. Allow another approximately $0.0021 for the conservative origin-bound transfer sensitivity described below. Credits can cover these eligible costs. This is not a maximum bill: other account usage, traffic, retained artifacts and changed settings can increase it.

## Account and offer gates

Current [Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/) describes $100 initial credit and up to $100 earned through qualifying activities, not $200 immediately available. Eligible new customers start on Free plan, ending after six months or credit exhaustion; expiration suspends access rather than silently continuing normal paid usage. Recovery requires upgrading within the documented 90-day retention window. Paid usage beyond applicable credits/allowances is charged. Do not import old twelve-month S3/RDS offers into this new account estimate.

**Credit expiry is unresolved in AWS's public wording:** the same FAQ states six months in its general/advanced sections and twelve months in its upgrade/earned-credit sections. Service marketing pages also retain older twelve-month language. Budget on the earlier six-month boundary and inspect the actual credit grant's expiry/eligible-service conditions before creation; do not promise twelve months or spend to earn extra credits.

The [new signup guide](https://docs.aws.amazon.com/accounts/latest/reference/sign-in-new.html) warns that an ineligible applicant can be placed on Paid plan and might need payment verification, including a temporary $1 hold. Account creation belongs to the user. Stop before any Paid-plan or unfamiliar billing selection; never send passwords/payment details/codes through chat.

New signup and advanced signup are distinct from Free/Paid pricing plans. [Project-region documentation](https://docs.aws.amazon.com/accounts/latest/reference/project-regions.html) currently assigns Ohio, Stockholm or Sydney from the contact country. Frankfurt is **only a comparative pricing assumption**, not a selectable default for that flow. A European-address project would normally use Stockholm; the actual contact country and assigned region must be inspected. [Signup comparison](https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html) documents CloudFront and function URLs as supported ways to publish a project. [Supported services](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html) includes S3, CloudFront, Lambda, CloudWatch, IAM and CloudFormation; Lambda@Edge is excluded. Specific OAC/policy/runtime permissions remain a deployment gate, not proven by a service name alone.

[Advanced-feature activation](https://docs.aws.amazon.com/accounts/latest/reference/activate-advanced-features.html) requires upgrade, is irreversible, exposes more regions, and removes new-project spend limits. Do not activate it merely to obtain Frankfurt. Separately, [traditional plan guidance](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html) lists explicit organization/enterprise actions that can upgrade a traditional Free account automatically. The new signup's AWS-managed project organization is its documented default; do not mislabel it as an action we should independently perform.

The CloudFront **flat-rate Free product is not the AWS account Free plan**. [CloudFront restrictions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html#flat-rate-pricing-plan-account-level-constraints) exclude accounts using AWS Free Tier from flat-rate plans and disallow combining them with other offers. Therefore its $0 plan and S3 storage credits are **not included** here. Recheck eligibility later rather than upgrading the account to obtain this product.

## Shared architecture and quantities

Agreed with architecture planner 019: one private S3 Standard bucket, one standard CloudFront PAYG distribution, S3 origin plus Lambda function-URL origin, two origin access controls (OAC, authorization allowing CloudFront to reach its private origins), one CloudFront Function for exact Shell-page rewrites, one Lambda Event Function/alias, execution permissions and one log group with seven-day retention. Infrastructure definitions and logs remain project-owned. No API Gateway in the selected option.

The API goes through the same distribution at `/api/*`, without response caching. Its function URL requires IAM authorization and the proposed CloudFront OAC permission; it is not a second freely callable public origin. Frontend routes/assets preserve Native Federation and independently published releases. No database, VPC/NAT gateway, EC2, load balancer, public IPv4 allocation, custom domain/Route 53 hosted zone, customer KMS key, Secrets Manager secret, WAF subscription, provisioned concurrency, Lambda@Edge, paid CI or AI model is needed in the first inventory. IAM/CloudFormation control resources and default service metrics have no additional usage line in this estimate; enabling optional paid features changes it.

30-day baseline:

| Quantity                        | Assumption                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| API requests                    | 10,000; estimate 10 KiB response each, no request body                                                                  |
| Static frontend viewer requests | 100,000, including assets; total CloudFront requests 110,000                                                            |
| Viewer delivery                 | 1 GiB frontend plus `10,000 × 10 KiB / 2^30 = 0.095367 GiB` API                                                         |
| Lambda                          | ARM64, Node.js 24, 256 MiB, assumed average **billed** duration 100 ms; 250 GB-seconds                                  |
| S3 storage                      | 0.1 GiB-month, including retained releases and deployment packages                                                      |
| S3 GET/HEAD                     | Conservative 100,000: every frontend request misses cache; API does not read S3 per request                             |
| Deployments                     | 10 full batches; budget 300 PUT/COPY/POST and 40 LIST operations                                                        |
| Invalidation                    | 10 batches × 5 paths = 50 paths; no broad automated repeated invalidations                                              |
| Edge rewrite function           | Upper estimate 100,000 invocations, no API invocation                                                                   |
| CloudWatch                      | 0.05 GiB ingested, seven-day retention; storage upper estimate `0.05 × 7/30 = 0.011667 GiB-month`; one scan of 0.05 GiB |

Architect inspected 25 deployable frontend files totaling 1,170,427 bytes excluding `.nf-cache`. Thus 0.1 GiB retained storage is conservative, not an actual artifact measurement. Billed duration, compression, headers, requests and cache misses must be measured after an approved deployment. AWS catalogue GB/storage units are applied consistently as approximate GiB quantities for this small estimate; byte-level billing can differ slightly.

## Exact rates and baseline arithmetic

Dynamic marketing tables omit some region values. Anonymous official Price List JSON was retrieved and matching `products.attributes.usagetype` plus `terms.OnDemand.priceDimensions` inspected. These are public catalogue reads, not AWS account API calls:

- Lambda [Frankfurt catalogue](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/eu-central-1/index.json), published October 30, 2026: `EUC1-Request-ARM = $0.0000002/request`; first-tier `EUC1-Lambda-GB-Second-ARM = $0.0000133334/GB-second`.
- S3 [Frankfurt catalogue](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/eu-central-1/index.json), published October 15: Standard `EUC1-TimedStorage-ByteHrs = $0.0245/GB-month`, `Requests-Tier1 = $0.0000054/request`, `Requests-Tier2 = $0.00000043/request`.
- CloudWatch [Frankfurt catalogue](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonCloudWatch/current/eu-central-1/index.json), published October 7: Standard `DataProcessing-Bytes = $0.63/GB`, `TimedStorage-ByteHrs = $0.0324/GB-month`, ordinary `DataScanned-Bytes/StartQuery = $0.0063/GB`.

**Gross before allowances** below is a counterfactual at published chargeable marginal rates, including CloudFront's next paid traffic tier and paid invalidation rate. It intentionally removes included allowances for comparison; it is not a claim AWS bills its first free tier at these rates. Viewer geography is Europe, independent of origin region. [CloudFront PAYG rate table](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/) gives $0.012/10,000 HTTPS requests, $0.085/GB for the next 9 TB, $0.10/million function invocations and $0.005/invalidation path beyond its included allowance.

| Component                   | Counterfactual arithmetic            |    USD/month |
| --------------------------- | ------------------------------------ | -----------: |
| S3 storage                  | `0.1 × 0.0245`                       |     0.002450 |
| S3 uploads/list             | `(300 + 40) × 0.0000054`             |     0.001836 |
| S3 origin reads             | `100,000 × 0.00000043`               |     0.043000 |
| CloudFront HTTPS            | `110,000 / 10,000 × 0.012`           |     0.132000 |
| Viewer delivery             | `1.095367 × 0.085`                   |     0.093106 |
| CloudFront rewrite          | `100,000 / 1,000,000 × 0.10`         |     0.010000 |
| Invalidations               | `50 × 0.005`                         |     0.250000 |
| Lambda requests             | `10,000 × 0.0000002`                 |     0.002000 |
| Lambda duration             | `10,000 × 0.25 × 0.1 × 0.0000133334` |     0.003333 |
| Log ingestion               | `0.05 × 0.63`                        |     0.031500 |
| Log storage                 | `0.05 × 7/30 × 0.0324`               |     0.000378 |
| Log query                   | `0.05 × 0.0063`                      |     0.000315 |
| **Counterfactual subtotal** |                                      | **0.569919** |

Inbound deployment uploads are not internet egress. [AWS-origin fetch delivery to CloudFront](https://aws.amazon.com/cloudfront/faqs/) has no origin data-transfer-out charge, while origin requests/storage/compute still cost money. These are GET-only endpoints, so model forwarded request-body egress as zero. CloudFront also prices outgoing traffic to origins at $0.02/GB in Europe: a conservative sensitivity allowing 1 KiB of billable origin-bound material for each of 110,000 requests adds `110,000 × 1,024 / 2^30 × $0.02 = $0.002098`; actual meter treatment/headers are not established here. Include that small contingency rather than assuming all directions are always free.

## Continuing allowances, credits and after-offer cost

Service allowances are account-wide, shared with other projects/regions where applicable:

- [CloudFront PAYG](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/): 1 TB delivery, 10 million HTTP(S) requests and 2 million CloudFront Function invocations monthly. Use the primary rate/allowance tables; the page's examples contain inconsistent request counts, so do not derive quotas from those examples.
- [Invalidation documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PayingForInvalidation.html): first 1,000 paths/month across distributions; a wildcard is one path. Fifty is within this allowance.
- [Lambda Event Function pricing](https://aws.amazon.com/lambda/pricing/): 1 million requests and 400,000 GB-seconds/month. Baseline 10,000 and 250 are well inside; no provisioned concurrency or excess ephemeral storage.
- [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/): 5 GB log ingestion/archive/query allowance and standard free metrics/alarm allowances. Baseline quantities are inside; no Live Tail, enhanced monitoring or custom dashboard is required.

No continuing S3 storage/request allowance is assumed for this new signup; credits cover eligible S3 usage instead. Therefore:

| View                                                                                              | Defined baseline result                                                                   |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Gross before all allowances                                                                       | Frankfurt approximately **$0.5699**, or **$0.5721** including origin-transfer contingency |
| After continuing service allowances, before promotional credits                                   | Frankfurt **$0.047286–$0.049384**                                                         |
| Eligible Free plan with sufficient unexpired applicable credits                                   | Target **$0 out of pocket**; credit consumption approximately the preceding residual      |
| After promotion ends, if user deliberately continues on Paid plan and allowances remain available | Approximately **$0.05/month**, excluding tax, other usage and changed assumptions         |
| No Paid upgrade at Free-plan expiry                                                               | Account/projects lose access; this is not a continuously hosted free application          |

Stockholm variant: official [Lambda](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/eu-north-1/index.json), [S3](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/eu-north-1/index.json) and [CloudWatch](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonCloudWatch/current/eu-north-1/index.json) catalogues have the same publication dates above. Lambda Event rates are identical; S3 Standard is $0.023/GB-month, tier-1 $0.000005/request, tier-2 $0.0000004/request; log ingestion/storage/query are $0.54/GB, $0.028/GB-month, $0.0054/GB. Thus S3 `0.1 × 0.023 + 340 × 0.000005 + 100,000 × 0.0000004 = $0.044000`; counterfactual gross is **$0.562968**, and after-allowance residual **$0.044000–$0.046098**. Recalculate for an actually assigned Ohio/Sydney region instead of reusing these figures.

### Sensitivity, not an unlimited free promise

Same retained storage, ten deploy batches and 50 invalidation paths; vary traffic and log quantities. Frankfurt prices, before tax/credits, excluding the tiny origin-transfer sensitivity. All frontend reads conservatively miss cache.

| Scenario                    | API / static viewer requests | Frontend delivery / logs ingested | Gross before allowances | After continuing allowances |
| --------------------------- | ---------------------------- | --------------------------------- | ----------------------: | --------------------------: |
| Low                         | 1,000 / 10,000               | 0.1 GiB / 0.005 GiB               |               $0.285849 |                   $0.008586 |
| Baseline                    | 10,000 / 100,000             | 1 GiB / 0.05 GiB                  |               $0.569919 |                   $0.047286 |
| High, 100× baseline traffic | 1,000,000 / 10,000,000       | 100 GiB / 5 GiB                   |              $31.817544 |                   $6.304286 |

High-case residual: S3 $4.304286; 11 million CloudFront viewer requests exceed 10 million by 1 million → $1.20; 10 million rewrite invocations exceed 2 million by 8 million → $0.80. Lambda remains within 1 million requests/400,000 GB-seconds at the stated duration. Another workload consuming shared allowances, longer duration, bot traffic or larger logs changes these results. With actual cache hits, S3 GET charges should fall; retained release growth increases storage.

## Backend alternatives

1. **Selected ordinary Event Function + function URL:** $0.005333 gross backend compute/requests at baseline, $0 after its continuing allowances. [AWS HTTP invocation comparison](https://docs.aws.amazon.com/lambda/latest/dg/furls-http-invoke-decision.html) states that the URL itself has no added endpoint fee. Existing Node routes need an event handler/shared application boundary; do not pretend the current desktop HTTP server deploys unchanged.
2. **Event Function + HTTP API Gateway:** Frankfurt [API Gateway catalogue](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonApiGateway/current/eu-central-1/index.json), published October 13, gives `EUC1-ApiGatewayHttpRequest/ApiGatewayHttpApi = $1.20/million` first-tier requests. Adds `10,000 × $0.0000012 = $0.012` routing gross, plus Lambda; no gateway is needed for the initial two-route prototype. [Marketing pricing](https://aws.amazon.com/api-gateway/pricing/) mixes a twelve-month offer with newer credit terms: do not count that trial as permanent or automatically available to this November 2026 signup. Revisit richer gateway features at authentication stage.
3. **Lambda Web Function:** [documentation](https://docs.aws.amazon.com/lambda/latest/dg/web-functions.html) supports ordinary Node HTTP servers and scale-to-zero, but memory is billed for the whole execution-environment lifetime, including gaps between requests. Frankfurt catalogue rates: `$0.30/million requests`, `$0.0000349964/vCPU-second`, `$0.0000046334/memory-GB-second`. For comparison only, assume 10 ms active CPU/request and 0.25 GB consumed memory. For `T` total environment-seconds: `10,000 × 0.0000003 + 100 × 0.0000349964 + 0.25 × T × 0.0000046334`. This is **$0.00649964 + $0.00000115835 × T**. At 10,000 aggregate environment-seconds → $0.018083; one environment alive all 30 days → **$3.008943** before logs/transfer. Multiple environments add their lifetimes. Stockholm coefficients are $0.0000277088/vCPU-second and $0.0000036686/memory-GB-second; the same all-month case is **$2.383024**. Consumed memory/startup/retention lifetimes are unmeasured, so neither is a prediction. No independently established Web-Function-specific permanent allowance is applied; do not borrow Event Function's 400,000 GB-seconds blindly. Verify mode/region/account support and credit eligibility before selecting it. Its deployment convenience does not make it the lowest bounded first-demo cost.

## PostgreSQL later — excluded from first-demo totals

Frankfurt [RDS catalogue](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/eu-central-1/index.json), published October 29, 2026, gives these ordinary on-demand components:

| Later candidate                                          | Illustrative arithmetic, no free trial assumed | Monthly USD |
| -------------------------------------------------------- | ---------------------------------------------- | ----------: |
| RDS PostgreSQL `db.t4g.micro`, Single-AZ                 | `720 hours × $0.019`                           |       13.68 |
| Its minimum 20 GiB gp3 storage                           | `20 × $0.137`                                  |        2.74 |
| **RDS basic subtotal**                                   | Compute + storage, before extras               |   **16.42** |
| Aurora PostgreSQL Serverless v2 Standard, sparse example | `0.5 ACU × 20 active hours × $0.14/ACU-hour`   |        1.40 |
| Aurora initial 10 GiB storage + 1 million I/O            | `10 × $0.119 + 1,000,000 × $0.00000022`        |        1.41 |
| **Aurora sparse subtotal**                               | Active time includes wakeup/idle/maintenance   |    **2.81** |
| Aurora if 0.5 ACU never pauses                           | `0.5 × 720 × $0.14 + $1.41`                    |   **51.81** |

Minimum storage sources: [RDS gp3 storage](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Storage.html) and [Aurora storage scale](https://docs.aws.amazon.com/rds/latest/auroraextendedcontent/aurora-faq-scalability.html). These are base-component illustrations, not complete database quotes. Backups beyond included allocation, retained/deleted-instance snapshots, CPU surplus credits on burstable RDS, logs, secrets, network transfer, public IPv4 and connectivity/administration resources can add charges. No public database is proposed. Lambda-to-database networking and migrations need their own design; do not introduce a NAT gateway or proxy casually.

[RDS stop documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html) permits only seven consecutive stopped days, then automatic restart; stopped storage/backups remain billable. [Aurora auto-pause documentation](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html) requires supported engine/region and minimum capacity zero; five-minute minimum idle interval, open connections or RDS Proxy can prevent pause. Resume is typically about 15 seconds and can take longer. Storage persists while compute pauses. The sparse case therefore depends on real active hours, not just query duration; it is not permanently free and is not a database selection. Reprice the selected home region and version before approval.

## Controls, idle costs and teardown proposal

- Preserve eligible Free plan; inspect actual plan, region, credit grant/expiry and service access before deployment. The $0 target is grounded in that plan and sufficient credits, not a zero-dollar budget alert.
- One project/environment, tagged resources and explicit infrastructure inventory; local build/deploy commands first. No background health polling, paid APIs, cross-region replication or automatic spend-producing retry loops. Review deployment changes before creation.
- Lambda on-demand only: propose reserved concurrency 2, three-second timeout, 256 MiB and default included ephemeral storage. These bound work per request/concurrency, **not monthly billing**; a continuously hammered endpoint can still generate charges/consume credits. Confirm quota availability, and do not silently raise limits or fall back to paid provisioned capacity.
- Short application logs, seven-day retention, no response-body/secret logging; avoid optional tracing/enhanced metrics. Cap retained static releases explicitly and preserve only needed rollback assets; inspect full storage, including object versions/delete markers and unfinished multipart uploads. No customer KMS key is required for this fixture demo.
- Use free email-only [AWS Budgets notifications](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/) plus visible gross costs, credits remaining and usage. Proposed early alerts: $0.01 actual payable cost, $1 gross monthly usage, and credit/time reminders; these are suggestions, not a user-approved budget. [Budget data updates](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html) are delayed, so alerts and automatic actions are not an instantaneous cap. Do not add paid emailed budget reports.
- The [new Paid-plan project spend limit](https://docs.aws.amazon.com/accounts/latest/reference/create-spend-limit.html) is a different enforcement feature: it pauses a project at its limit, requires Paid plan, starts at the greater of $20 or AWS's conservative estimate, excludes credits and is pre-tax. It is **not a $0 control** and is not a reason to upgrade. Advanced features remove it. Ordinary advanced-account Budget alerts do not acquire that guarantee.
- At zero traffic, ordinary on-demand Lambda does not retain billable idle compute. S3 releases/deployment packages and logs already stored remain; continuing allowances/credits may mask their small cost. Stopping the local app does not stop public cloud endpoints. RDS later has a much larger persistent idle footprint.
- Before approved teardown, export desired project data/configuration and keep known local release artifacts. Disable public distribution access; set the owned Lambda's reserved concurrency to zero/revoke its URL permission as an immediate compute stop, then remove owned function/aliases/versions, URL, permissions, log group, CloudFront distribution/function/OAC associations, S3 artifacts/all versions/multipart uploads and bucket, and empty infrastructure stack where safe. Retained logs/snapshots/object versions or deliberately retained resources continue billing. Do not delete unrelated shared account resources. Distribution disable alone does not delete origin storage.
- Review billing/usage again after propagation and on the next billing update. Past usage can appear later and cannot be undone by deletion. Before Free-plan expiry export data; recovering it after expiry can require a Paid upgrade. Database snapshot retention/deletion needs a separate explicit data decision when that stage exists.

## Ready-to-proceed boundary

Architecture 019 and this estimate support a bounded first-demo proposal, subject to independent review 021. Next user step can be an explained **account-creation/eligibility check**, not provisioning. Record actual signup path, Free/Paid status, home region, initial grant/expiry, credit applicability and required CloudFront/Lambda permissions without copying secrets. Recalculate if any gate differs. Then prepare reviewable infrastructure/application changes, resource preview, bounded cost controls and rollback/teardown before separately approving creation. No cloud compatibility or billing behavior has been empirically tested by this research.
