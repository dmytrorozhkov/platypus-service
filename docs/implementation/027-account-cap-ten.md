# Explicit shared account cap of ten

Date: November 5, 2026.
Status: implemented, integrated and independently reviewed without a confirmed blocker; see review 028.

The user explicitly accepted `account-cap-ten` after the coordinator reported fresh total/unreserved Lambda quotas of ten and explained the cost distinction. This change records that option in local planning and the backend template. It does not change an AWS quota, purchase provisioned capacity, upgrade the account plan, authorize resource deletion, or establish a maximum monthly bill.

## Behavior

`validateTarget` accepts the new mode only with integer quota evidence reviewed within 24 hours, an actual account limit no higher than ten, and the literal boolean `acceptedSharedAccountCap: true`. Stale evidence, limit eleven, absent/false/string acceptance, and an unresolved mode are rejected. Actual identity, quota and ownership checks remain in the operation plans.

`account-cap-five` retains its stricter maximum of five and therefore rejects a real account limit of ten. `reserved-two` still requires at least 102 unreserved executions to preserve the standard buffer of 100. Shared-cap acceptance now requires an actual boolean rather than accepting a truthy string.

Both offline bootstrap and publication carry the explicitly selected mode into backend parameters. The backend template's `ConcurrencyMode` enum includes `account-cap-ten` without a default. Its existing `UseReservedTwo` condition and `ReservedConcurrentExecutions` expression are unchanged: reserved mode selects two; both shared modes select `AWS::NoValue`. There is no per-function reservation of ten, automatic fallback, quota-change operation, or cloud executor.

The template context was read before editing. Its toolkit marker and resource purpose were preserved; stale statements tied to quota five were replaced with the durable reservation/shared-cap constraints. The generator reproduces the authored templates, and only the backend template changed. Edge and storage template bytes were not written or changed by this task.

The checked-in target example shows the reported quota ten but remains deliberately unusable: `mode: unresolved`, null review date, false acceptance, false verified ownership and no actual resource identifiers. Root owns the real ignored target, current AWS state and shared project records. Infrastructure documentation explains the new explicit mode and distinguishes the shared account cap from a function reservation and a spending cap.

## Verification

Executed only bounded local checks:

```powershell
node --test --test-name-pattern='offline defaults|account-cap-ten|template policies' scripts/aws/aws.test.mjs
npm.cmd run aws:validate
npm.cmd run lint
```

Four selected test groups passed. The new checks cover ten accepted, eleven rejected, missing/false/string acceptance rejected, unresolved/stale evidence rejected, five-mode rejection at quota ten, preserved five-mode acceptance at five, and the reserved boundary of 101 rejected versus 102 accepted. They verify the template enum has no default, the reservation condition is unchanged, and both actual bootstrap/publication plan builders pass through `account-cap-ten` while remaining offline and unauthorized for execution.

The bounded plan test reads a previously generated ignored cloud-test manifest when the full packaging group has not run in that process. It does not create a new package or release. A normal full preparation-test run supplies its earlier generated fixture; a standalone filtered rerun requires existing preparation-test evidence.

Project-local schema/lint and actual Guard validation passed with zero errors/warnings; the existing 21 informational I9001 replacement notices remain. Repository lint passed. Formatting checks passed for the owned changes. A read-only comparison confirmed that the generator's backend, edge and storage objects match their authored JSON templates.

No full AWS browser/ZIP suite, browser process, application listener, release preparation, AWS API/CLI call, cloud mutation/deletion, quota change, account upgrade, package edit, shared root-document edit, or Git mutation was performed. No release directories or package artifacts were written. Local validator evidence was refreshed under ignored `.local/aws-validation/`; the checked-in changes are limited to the assigned plan, generator, backend template, target example, infrastructure documentation, tests and this report.

Actual backend-stack parameter updates, cloud deployment or removal of the empty failed edge stack remain coordinator-owned actions with their own authorization boundary. Local acceptance of this mode is not evidence that any of those actions occurred.
