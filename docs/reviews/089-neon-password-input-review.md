# Independent review: private password input diagnostics089

Reviewed November 7, 2026 as a bounded follow-up to085–088. The learner explicitly confirmed that the new app password in the refused attempt had fewer than20characters. Source inspection establishes that the existing local length guard rejects that input before child creation, so this particular first-password attempt did not connect or alter the Neon role. This conclusion comes from the learner's length-only answer and execution order, not counting screenshot masking characters. The separate failed app check does not establish another precise cause or successful password setup.

## Source assessment

No remaining confirmed blocker was found in the wrapper-only change and focused fixture tests. The reviewer inspected `scripts/neon-role-password.ps1`, `apps/server/test/neon-role-password-runner.test.mjs`, their diff and implementation088. The core SQL utility, exact role guard, strict TLS and target validation are unchanged and retain review087. The reviewer edited only this report and performed no actual Neon/network, real credential, native service/database or publication action.

Five fixed local diagnostic categories cover empty owner input, unsupported app length, repeated-input mismatch, nonprintable/non-ASCII app input and owner-password reuse. Messages disclose neither supplied values nor measured lengths or raw exceptions. All categories are assigned before `Process.Start`; local refusal therefore safely states that no child or remote password operation was attempted. The child-start-attempt marker is set immediately before `Process.Start`, conservatively retaining uncertain-result/app-check guidance for every later failure, including spawn failure. There is no automatic retry or changed password acceptance policy in the underlying utility.

The three hidden prompts, SecureString disposal and BSTR zero-free paths remain intact. The added temporary owner string supports only the equality check and is cleared with the other temporary plaintext references. As before, this does not prove zeroing of every managed heap copy. Passwords remain child-environment-only; strict receipt shape validation emits a fresh fixed receipt, never raw child stdout/stderr or exception content. Owned timeout/tree cleanup remains unchanged.

The fake child's startup marker is now written before its assertions, strengthening proof that local-invalid cases never start the child. The nine negative cases cover empty owner; empty/short/oversized app input; both different-length and same-length repeat mismatch; Unicode; a control character; and owner reuse. Their expected output is exact allowlisted text with no app-check guidance or child marker. Existing post-start redaction cases require the marker and uncertain-result guidance, distinguishing actual attempted work from local rejection. Test leak checks include the supplied public fake private inputs as well as ambient sentinels.

## Independent verification

The reviewer independently ran `node --test test/neon-role-password-runner.test.mjs` using the current formatted source: **4/4groups passed, zero failed/skipped/cancelled**,65463ms. These are real Windows PowerShell/Node child fixture checks with substituted public fake prompt queues, not real interactive-console/password or Neon authentication proof. All nine local-invalid scenarios, success, wrong target/confirmation and post-start output-redaction cases passed. Only owned temporary fixture paths were used and cleaned.

## Remaining acceptance

Root separately reported the complete registered server suite under `CI=true`: **114/114 passed, zero skipped**,69953ms; repository lint and format also passed. These are attributed coordinator results, distinct from the reviewer's independent focused rerun. No core SQL/TLS source changed in this follow-up, so its already recorded owned PostgreSQL evidence was not repeated.

Coordinator-wide checks and the candidate's own ordinary hosted CI must be observed before handing over the corrected manual route. The learner must privately select a distinct20–128character printable-ASCII password (recommendation32randomcharacters), rerun setup and then perform the pooled app connection check. Actual initial-password success and pooled app authentication remain unconfirmed. Native data/services, imported business data, role grants, Free plan, main/public AWS release and learner-only publication are preserved.
