# Task 049 — Manual checked package without AWS access

Date: November 5, 2026. Status: locally implemented and independently reviewed050 on feature/github-delivery; actual hosted Package run remains pending.

The learner approved preparation before deployment and asked for the next small step. Implement a manual package-only workflow, reusing the complete checked-SHA CI and existing bounded delivery bundle. This is the first concrete item in044's CodeBuild preparation backlog. No publication, CodeBuild execution, cloud setup, account/repository setting change, artifact credential creation or promotion to main is included.

Owner ci_implementation: .github/workflows/package.yml, minimal ci.yml output plumbing, scripts/delivery/package-summary.mjs and focused pure tests, docs/implementation/049-manual-package.md. Root owns shared records, integration/Git/verification; delivery_plan_review independently reviews finished code in050. Preserve all existing coordinator planning/status changes and stopped local servers. No new dependency, application/runtime/template change or AWS transport call.

The workflow is workflow_dispatch-only, exact repository dmytrorozhkov/platypus-service and refs/heads/main, with read-only contents permissions. Reuse CI package_delivery=true and the configured public DELIVERY_ORIGIN variable; missing setup fails closed. CI still runs complete tests/builds before packaging; artifact is bounded, one-day retention, no overwrite. Expose the upload action's archive digest in addition to the separate bundle-envelope digest. Do not inherit secrets or attach an AWS environment/identity permission.

After successful checks/package, render a receipt with exact commit/run/attempt/repository/release/artifact ID/archive digest/envelope digest through validated environment input. No interpolated shell or unchecked Markdown values, no extra app build. Label the receipt as preparation only, not deployed or a verified CodeBuild handoff. Do not imply a hosted button exists before the reviewed workflow reaches the default branch.

Verify malformed/missing metadata refusal and success bindings, existing delivery compatibility, syntax/format/lint and required integrated checks. Report actual tests separately from hosted manual execution, which is not performed. Do not claim download permissions, role isolation, cloud readiness or deployment timing from this step.
