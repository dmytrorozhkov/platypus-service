# AWS PostgreSQL feasibility and base pricing071

Date: November 6, 2026. Status: account and regional reads verified; infrastructure choice, complete application cost and creation permissions remain proposals/unverified. This is planning, not provisioning approval.

## Scope and actual account evidence

The learner approved step1: verify the existing Free plan, credits, regional PostgreSQL availability and costs. After the learner reported renewed sign-in, official AWS MCP recovered. Actual successful API calls were inspected through their `api_calls`, not just the outer script status.

- STS GetCallerIdentity confirmed the existing project account171180524785 and AccountFullAccessRole session.
- FreeTier GetAccountPlanState returned FREE/ACTIVE, USD120.00 remaining credits, expiration2027-05-04T13:05:19.905000+00:00.
- FreeTier GetFreeTierUsage returned an empty list. This is not evidence of free RDS entitlement or a zero bill.
- RDS DescribeOrderableDBInstanceOptions in eu-north-1 returned PostgreSQL18.6 with db.t4g.micro, including gp3 with a20GiB minimum, encryption support and three regional Availability Zones. gp2/io1/io2 options also appeared; none was selected or created.
- RDS DescribeDBInstances returned no instances in eu-north-1. DescribeAccountAttributes returned DBInstances Used0/Max40. These are regional RDS service quota observations, not proof that a Free-plan account may create40 instances.
- IAM GetRole for AWSServiceRoleForRDS returned NoSuchEntity. An absent first-use service-linked role is not an AccessDenied finding: RDS normally creates this role on first DB instance creation, requiring the corresponding permission. IAM GetPolicy for AWSLambdaVPCAccessExecutionRole succeeded, but reading a policy does not prove permission to attach it.

RDS creation permissions, automatic service-linked-role creation, Lambda networking permissions and organization-policy exceptions have not been established. No Create API was used as a permission test. The earlier GitHub federation SCP denial is preserved; it is not generalized into a confirmed RDS denial.

## Public price evidence and deterministic calculation

The official public regional AmazonRDS catalog was downloaded without account credentials. Catalog publication2026-10-29T07:06:35Z, version20261029070635, observed2026-11-06T16:01:07.710Z,18623619bytes, SHA25674680f46e839a3b58cad437f756ee8fdb56683391d6dbba00c614149ef16c76c. On-Demand terms were selected by exact usage type, excluding unused capacity reservations and Reserved Instance offers.

| Item                               | Verified rate  | Assumption | Monthly USD |
| ---------------------------------- | -------------- | ---------- | ----------- |
| PostgreSQL db.t4g.micro Single-AZ  | 0.016/hour     | 730hours   | 11.68       |
| PostgreSQL gp3 Single-AZ           | 0.12/GiB-month | 20GiB      | 2.40        |
| RDS compute plus allocated storage |                |            | 14.08       |

Python Decimal calculated these values from the saved price fields. The same compute/storage assumptions for db.t3.micro yield USD16.27/month. These amounts precede credits and taxes. They are RDS base costs, not the full application bill or a spending ceiling. TwentyGiB gp3 is the proposed modern-storage baseline; the service also returned a smaller gp2 option, so it is not the smallest storage configuration technically advertised.

Excess backup storage has a catalog rate of USD0.09/GiB-month. RDS documents an included regional backup allocation tied to provisioned instance storage; do not assume every retained snapshot is free. Burstable T3/T4g surplus CPU credits, extra backups, Lambda, logs, data transfer, credentials storage and required private network paths must be estimated separately. No benchmark has demonstrated the100000-ticket workload on a1GiB micro instance, and GitHub runner timings are not an RDS sizing guarantee.

The existing local large-data CLI deliberately rejects remote hosts. A future cloud migration/seed mechanism must be prepared and reviewed; do not run the local wrapper against an RDS endpoint or silently remove that guard.

## Plan and operating constraints

Official current Free Tier guidance supports RDS PostgreSQL on db.t3.micro/db.t4g.micro under Free plan, using eligible credits. The older750-hour/12-month offer is not this account's entitlement. Free plan ends after six months or exhausted credits, whichever occurs first; do not automatically upgrade or describe credit exhaustion as automatic paid continuation.

The candidate remains an encrypted, private Single-AZ RDS PostgreSQL18.6 learning database in eu-north-1. Single-AZ aligns with the current Free-plan RDS restriction and is not production high availability. No production-ready Multi-AZ/KMS/monitoring defaults from rds-oss were silently provisioned or added to the cost estimate. Service-specific rds-oss was discovered and read after MCP recovered; aws-database, aws-billing-and-cost-management and aws-iam guidance also informed this research.

Stopping RDS is temporary: allocated storage/backups can remain chargeable, and RDS automatically starts an instance after seven consecutive stopped days. No stop/delete/schedule was configured. Before any learner-started launch, agree an explicit operating period, total architecture estimate, credit monitoring and a reviewed cleanup/recovery plan. A billing alert is not a hard spend cap.

## Next bounded proposal

Design and price the private backend-to-database path, credential retrieval and manual migration execution. Distinguish direct in-VPC PostgreSQL traffic from calls to public AWS services: a Secrets Manager API path may require an endpoint or other connectivity. Do not silently add NAT gateways, RDS Proxy, public IPv4 or compute hosts. Read-only regional/account verification is complete for the observations above; complete creation authorization and full-stack pricing remain open. Any service/access/resource change and exact spending step require the learner's separate decision, and only the learner starts publication.

No application code/dependencies, native database, running learner processes, AWS resources/access/settings, delivery flags or workflows were changed. No Package/Deploy/CodeBuild action was started.

## Sources

- [Official Stockholm AmazonRDS price catalog](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/eu-north-1/index.json)
- [RDS Free Tier](https://aws.amazon.com/rds/free/)
- [Free Tier account-plan terms](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html)
- [RDS storage](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Storage.html)
- [PostgreSQL pricing and surplus CPU credits](https://aws.amazon.com/rds/postgresql/pricing/)
- [RDS service-linked role](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAM.ServiceLinkedRoles.html)
- [Stopping RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)

Account observations are from actual authenticated AWS API responses on November6; public URLs do not establish this account's current credit balance or creation rights.
