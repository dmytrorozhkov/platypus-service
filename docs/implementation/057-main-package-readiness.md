# Main promotion and manual Package readiness 057

Date: November6,2026. Status: reviewed fast-forward and Package prerequisites completed; actual main CI is being observed. No manual Package run, authenticated archive download or publication is claimed yet.

## Authorized scope and result

The learner accepted the proposed next step: prepare/promote reviewed changes into main for a real archive check without AWS, in parallel with local PostgreSQL preparation. This supersedes earlier preparation-only prohibitions on main promotion and the single public origin variable for this stage only. It does not authorize cloud access/setup, CodeBuild execution, delivery enablement, secrets, automatic publication or an agent-started Package/Deploy workflow.

Root refreshed origin and verified a clean worktree, identical local/remote feature head cc34dfa266efeb0913a51a433ecf2f06871e7248, identical main/origin-main6976ca929df717b09ca8a610961a4eb384ce2e75 and an ancestor relationship. Actual latest feature CI42195237272 succeeded, including both real PostgreSQL and full Windows jobs. Independent source review059 found no confirmed readiness blocker. Root switched main, fast-forwarded to the exact reviewed feature head and pushed only main. Both refs read back cc34dfa; no history rewrite, merge-conflict resolution or branch deletion occurred.

Root verified the public exact repository/default main through existing authenticated GitHub access. Only the previously absent repository variable DELIVERY_ORIGIN was created with https://d2p7y3iystcl60.cloudfront.net and independently read back. DELIVERY_ENABLED is absent at repository scope; aws-learning environment does not exist, so no environment flag or secret was created. The active Package workflow is registered as409156338. Raw bounded prerequisite evidence is ignored in .local/ci/package-readiness.json. This prepares package assembly; it grants no AWS access.

Only CI runs on push. Package and Deploy require manual dispatch. Package has contents:read only, no AWS credentials or identity-token permission; it waits for actual PostgreSQL and complete checks before uploading a one-day exact-source bundle/receipt. Deploy also appears on main, but its publisher first requires enabled/configured access before AWS authentication; keep it disabled. Technical separation ensuring only a human can obtain publication credentials remains a future access task, not a property established by this setup.

## Learner's next small action

After root confirms actual main CI success, open https://github.com/dmytrorozhkov/platypus-service/actions/workflows/package.yml. Select Run workflow, main, then manually start Package. This only checks/builds/uploads an archive. Do not select Deploy. The learner starts this workflow; agents do not dispatch it. A successful ordinary CI is not a Package run and does not prove artifact download.

After the learner starts and completes Package, read the exact successful run/attempt/source and externally anchored archive/envelope receipt, validate immutable repository/owner/artifact identities, and use the prepared bounded reader for an authenticated real download without any publisher. One-day retention means that proof must use the selected unexpired archive. No latest selection or hash trusted only from inside its own archive is acceptable.

## Parallel local database work

data_next_slice owns report058: reverify/stage the official PostgreSQL18 Windows installer and its identity/signature without running it. Native installation, local administrator/password entry, actual service/data directory/authentication checks, database/role provisioning and real local demonstration remain interactive later steps. Root integrates reports/shared records/Git. No machine-wide installer, WSL/Docker/PATH/firewall change or PostgreSQL service/cluster is created by preparation. Cloud hosting/costs and business writes remain unchanged.

## Verified local installer handoff

Report058 is complete. The official PostgreSQL18.6-5 Windows x64 installer is staged at ignored .local/postgres/setup/postgresql-18.6-5-windows-x64.exe (414966472bytes). Its SHA256227e2bc08091b4c2b8338c7d61b11d057f895711480b006f90bfcfcd2410a58a matches EDB's actual published sidecar. Root independently recomputed the same hash and verified Windows Authenticode StatusValid with EnterpriseDB Corporation signer and DigiCert timestamp certificate. The installer was not executed. A native local service/database and role/grant setup remain pending user/OS interaction. Give only the first installer action: open this file and stop at Welcome.

At the handoff checkpoint, main run42196363418 is still in progress at browser installation; actual SQL tests succeeded, browser/recovery and downstream full Windows completion are not yet established for this main run. The equivalent exact feature commit previously passed42195237272. Do not relabel main as successful or ask the learner to run Package until main's required result is observed. Root will resume observation after the installer-screen reply. These documentation changes can be saved locally, but defer another main push while the current main run is active, to avoid cancelling it through the existing CI concurrency policy.
