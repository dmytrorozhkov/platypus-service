# Private password input diagnostics088

On November 7, 2026 the learner's first-password wrapper displayed a generic refusal after its three private prompts. The learner then explicitly confirmed, in a length-only clarification, that the new app password contained fewer than20 characters. The existing wrapper's local length guard runs before child creation; this explains that refused password-setting attempt without inferring a password or length from screenshot stars. The separate failed app connection check does not establish another precise cause.

The bounded correction changes only `scripts/neon-role-password.ps1` and its owned-fake runner tests. The core password utility, SQL guard, TLS, Neon roles/data, native services and AWS are unchanged.

## Fixed local refusals

Before starting its owned Node child, the wrapper now reports an allowlisted code and fixed message for:

- `NEON_PASSWORD_INPUT_OWNER_EMPTY`: empty owner input.
- `NEON_PASSWORD_INPUT_APP_LENGTH`: app password outside20–128 characters.
- `NEON_PASSWORD_INPUT_APP_CONFIRMATION`: app/repeated input differs, including equal-length mismatches.
- `NEON_PASSWORD_INPUT_APP_ASCII`: app input contains a character outside printable ASCII32–126.
- `NEON_PASSWORD_INPUT_OWNER_REUSE`: the new app password equals the owner password.

Each local refusal also states: **“No child process was started; no remote password operation was attempted.”** Other pre-child preparation failures use a fixed preparation code and the same ownership statement. Actual values, measured lengths, exception details and private child output are never printed. After child start has been attempted, a distinct `NEON_PASSWORD_RESULT_UNCONFIRMED` diagnostic retains the existing uncertain-outcome guidance: check app connectivity with the new password before explicitly retrying, with no automatic retry.

Existing hidden SecureString prompts, pointer zeroing/disposal, environment scrubbing, bounded owned-child cleanup, strict receipt validation and password-only target boundary are preserved. The temporary owner plaintext used for the equality check is cleared alongside the app/repeated values. No credentials are added to command arguments or files. For the learner's next manual attempt, choose a distinct randomly generated32-character printable ASCII app password privately; no password or exact length needs to be shared in chat.

## Verification

Author verification uses only public fake values and exclusively owned Windows PowerShell/Node fixtures. The child-start marker now executes before fake assertions, making local-refusal absence a genuine no-child assertion. The new group covers empty owner, empty/short/oversized app input, different-length and equal-length confirmation mismatch, Unicode, a control character and owner reuse. It asserts exact fixed output, no secret/actual-length/raw error output, no child marker and no post-start retry guidance. Existing success and unexpected-child-output redaction groups remain; post-start tests require a real owned child marker and uncertainty/app-check guidance.

Author focused verification passed **4/4 groups** with no skip/cancel (39282ms), including the nine local-input scenarios. Targeted ESLint, Prettier check and `git diff --check` passed; the real PowerShell parser/success fixture also passed. Independent review and coordinator-wide checks remain separate evidence. These tests do not set a real Neon password or demonstrate live authentication. The learner's corrected private retry and pooled app check remain separate manual steps; no real password or Neon connection was used in this implementation.
