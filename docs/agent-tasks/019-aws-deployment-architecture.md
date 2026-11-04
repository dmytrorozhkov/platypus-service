# Agent Task 019 - Minimal AWS Deployment Architecture

Status: planning complete; independent review 021 found no blocker. Proposal: docs/architecture/019-aws-first-deployment-architecture.md. No account or cloud resource was created.
Date: November 4, 2026.
Baseline: accepted Node server 5532511, acceptance 792ea55, PostgreSQL proposals 016-018, AWS-first assessment 717ac11.

## Goal

Propose a reviewable first AWS deployment of the existing Angular Shell/Support, React Analytics, Vue Administration and Node server with the same 25 fictional requests. Target zero out-of-pocket payments within applicable free offers/credits and show the later non-promotional cost. PostgreSQL is a later separately estimated stage. The user has no AWS account and has not authorized registration, resource provisioning or spending.

Read AGENTS.md, PROJECT_PLAN.md section 5.25 and cost rules, README, runtime configuration, independent build outputs and Node source/contract. Inspect relevant current files/artifact sizes read-only; do not rebuild unchanged applications.

## Deliverable and choices

Recommend a minimal named service topology, a deployment layout and bounded implementation work. Compare ordinary Lambda Event Functions with direct function URL or an HTTP gateway against Lambda Web Functions on actual Node adaptation, regional/account availability, limits and cost inputs. Do not assume their free allowances are interchangeable. Private S3 plus CloudFront is a candidate for static microfrontend files; check the current new-account Free plan and CloudFront pricing-plan compatibility before selecting a plan. Prefer eu-central-1 for regional resources as an explicit planning assumption; explain any availability-driven alternative.

Keep each remote independently publishable. Define URL prefixes that do not collide with Angular page routes; asset/metadata/config caching; correct refresh/direct-route handling without masking missing JavaScript/remote metadata with HTML; relative chunk/config paths; backend request routing; allowed browser origins and HTTPS; update order, rollback and cache expiry/invalidation. Preserve Native Federation private dependencies, isolated namespaces, mount cleanup and items/total contract. Existing Support apiBaseUrl accepts an origin, then requests /api/tickets; accommodate it or identify a concrete bounded change.

Explain server deployment packaging/entry point, role of the current localhost bind, health semantics, logs/retention, request/concurrency limits and resource ownership. Choose an appropriate infrastructure-as-code approach (AWS resources described in source files), without implementing templates now. A first scripted deployment can precede remote Git/automated delivery. Include proposed install/setup dependencies and a short next-stage acceptance checklist covering real cloud navigation, four independent artifacts, API/Retry, controlled update/rollback and teardown.

Coordinate a concrete bill of materials and traffic/size/request assumptions with cost planner aws_cost_plan. Default estimate inputs: one learner, 10,000 API requests/month, 100,000 total frontend viewer requests/month including assets, 1 GiB frontend delivery/month, 0.1 GiB deployed static storage, 0.05 GiB logs/month retained seven days, ten deployment batches/month, 30-day month. Measure local artifact sizes where useful and correct assumptions explicitly. These are estimates, not enforced limits or measured usage. Supply Lambda duration/memory/architecture and deployment S3 operation counts needed for reproducible pricing. Provide a higher-traffic sensitivity case.

Check primary current AWS documentation/pricing, record URLs/date, and distinguish documented compatibility from cloud behavior not yet tested. Spell out unresolved account-plan/region gates. Preserve the later PostgreSQL/identity/100,000-record requirements; first deployment is fictional public learning data only.

## Ownership and limits

Own architecture/application-adaptation planning. The parallel cost planner owns price/free-plan/account eligibility verification and cost arithmetic; share facts instead of editing each other's files. Root alone owns tracked task/plan files on planning/aws-first-deployment.

Read-only project inspection and public primary-source research only. Write only C:/Users/Dmytro/Documents/ChatGPT/AWS/.agent-staging/019-aws-first-deployment-architecture.md. No application/config/dependency/Git changes, account sign-up, downloads/installs, AWS CLI account calls, credentials, resource creation, stopping existing apps, paid action or sub-agent delegation. Report material blockers promptly and finish the bounded proposal.
