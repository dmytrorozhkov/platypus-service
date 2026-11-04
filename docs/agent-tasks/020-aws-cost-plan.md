# Agent Task 020 - AWS Zero-Payment Learning Cost Plan

Status: planning complete; independent review 021 found no blocker. Proposal: docs/research/020-aws-cost-plan.md. Public research and calculations only; no paid action occurred.
Date: November 4, 2026.
Baseline: current local application and AWS-first assessment in PROJECT_PLAN.md section 5.25. User has no AWS account.

## Goal and inputs

Produce a conservative, reproducible estimate for the first cloud demonstration: four static frontend builds and Node serving 25 fictional requests, with no PostgreSQL yet. Target zero payments while eligible free usage/credits apply, and disclose gross cost, permanent allowances, credits and post-offer cost separately. Zero is a target under stated assumptions, not a guarantee or authorization to spend.

Coordinate with architecture planner aws_architecture. Default 30-day monthly scenario: one learner, 10,000 API requests, 100,000 frontend viewer requests including assets, 1 GiB frontend delivery, 0.1 GiB static storage, 0.05 GiB logs with seven-day retention, ten deployment batches. Prefer eu-central-1 for regional pricing as a planning assumption. Obtain memory/duration/architecture, request routing, storage operations and distribution/region details from the architecture planner. Include a clear low/high sensitivity comparison and label all unknowns.

## Deliverable

Prepare an English report with exact official source URLs/date, chosen region/currency, service quantities and unit-rate arithmetic. Distinguish new-account Free plan, service-specific free allowances, earned promotional credits and paid-plan usage. Verify the current signup experience rather than blindly combining older 12-month service offers with the 2026 new-account plan. Check service eligibility and CloudFront flat-rate Free plan versus AWS account Free plan restrictions. Do not assume advertised credits are all immediately granted or available indefinitely.

Compare cost-relevant ordinary Lambda Event Function/function URL or HTTP gateway against Lambda Web Functions; check free allowances and billing dimensions separately, including memory/environment idle time. Cover static S3 requests/storage, CloudFront traffic/requests, API compute/routing, deployment requests/invalidations, logs, monitoring and any proposed supporting resources. Omit unnecessary paid always-on components from the recommended first stage. Do not invent rates where pages are dynamic/unavailable: state bounded uncertainty and the verification gate instead of presenting an exact total as established.

Provide three views: selected baseline gross cost before allowances, expected out-of-pocket cost under explicitly eligible free conditions/credits, and estimated cost after promotional eligibility ends. Explain idle costs and what remains billable after stopping/deleting compute. Separate a later managed PostgreSQL comparison (RDS PostgreSQL versus compatible auto-pausing Aurora option if useful) from the first-demo estimate; cover storage/backups/networking and actual auto-pause/stop limits without claiming it is permanently free.

Propose practical cost controls: account-plan choice, visible usage/credit monitoring, alerts, bounded scaling/log retention, exact project-owned resource inventory and data-preserving teardown. Distinguish alerts from an actual enforced cap and state residual billing exposure. Explain what facts remain unknowable until the new account/region/service selection is inspected. No sign-up or spending is part of this task.

## Ownership and limits

Own pricing/eligibility/calculation research; architecture owns topology/application changes. Share consequential restrictions and assumptions promptly. Root alone owns tracked project documents/Git. Write only C:/Users/Dmytro/Documents/ChatGPT/AWS/.agent-staging/020-aws-cost-plan.md.

Use public primary AWS sources and read-only relevant local source/artifact inspection. No account/credential access, sign-up, AWS API provisioning calls, paid calculator account action, software installation, app/dependency/config/Git mutation, process shutdown or sub-agent delegation. No paid resources may be created merely to measure cost. Stop when the bounded decision-ready estimate is complete.
