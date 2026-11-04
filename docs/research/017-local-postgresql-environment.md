# Local PostgreSQL Environment Proposal 017

Date: November 4, 2026.
Status: researched proposal; no software installed, database initialized, service started, or application code changed.
Scope: approved read-only environment planning, coordinated with data proposal 016.

## Recommendation

Use the native Windows PostgreSQL installer linked by the PostgreSQL project for this first database lesson. Docker is valuable later for repeatable infrastructure, but this machine would first need its missing Windows Subsystem for Linux (WSL) environment prepared. Native PostgreSQL avoids adding virtualization setup to the database lesson. This is a recommendation, not an approved installation.

Proposed server version: PostgreSQL **18.6**, x64. The official version policy currently lists 18.6 as the supported current minor release for major 18, with support through November 14, 2030. PostgreSQL 19 is currently a release candidate, so do not choose it for this stage. Recheck the current minor immediately before installation; intentionally record any newer 18.x patch instead of silently drifting. Major upgrades require a separate data migration procedure. [PostgreSQL version policy](https://www.postgresql.org/support/versioning/).

The community Windows page links EDB's installer and also offers an advanced binary ZIP route. Its tested-platform table names Windows Server versions and says comparable desktop Windows versions can generally run the installer; this is not a claim of exact certification for this machine. [PostgreSQL Windows downloads](https://www.postgresql.org/download/windows/).

## Verified local facts and limits

| Read-only check                       | Actual result                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Get-Command docker, psql, pg_ctl`    | No matching commands on PATH. This alone does not prove absence.                                                                                                    |
| Relevant service-name inventory       | No PostgreSQL, Docker, WslService or LxssManager match returned. No process was stopped.                                                                            |
| Filtered HKLM/HKCU uninstall registry | No product names matching PostgreSQL, Docker or Windows Subsystem for Linux returned.                                                                               |
| Common executable/directory checks    | Machine-wide Docker Desktop, its current documented per-user location, and `C:\Program Files\PostgreSQL` were absent. Arbitrary custom locations were not searched. |
| `wsl.exe --status` and `--version`    | Both explicitly reported that Windows Subsystem for Linux is not installed. The executable itself exists.                                                           |
| OS registry and runtime architecture  | Core/Home edition, version 25H2, build 26200.9818, x64. Registry ProductName retains the legacy label Windows 10 Home.                                              |
| OS/CPU CIM inventory                  | Access denied in this session. Firmware virtualization state, physical memory and CPU virtualization capabilities remain unverified.                                |
| Actual Node TCP connection probes     | `ECONNREFUSED` for 127.0.0.1 and ::1 on ports 5432 and 5433. No accepting listener was observed at that instant; availability must be rechecked at setup.           |

Microsoft's release information maps build 26200.9818 to Windows 11 25H2. Therefore Windows 11 Home 25H2 x64 is the inferred platform despite the legacy registry ProductName. [Microsoft Windows release information](https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information).

Existing application ports 3000, 4200, 4301, 4302 and 4303 were left untouched. No comprehensive machine inventory, credential inspection, downloads, image pulls, package installation, system configuration changes or database operations were performed.

## Launch options

| Option                                                             | Setup and ownership                                                                                                                                                                                                        | Persistence and tradeoff                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native Windows installer — recommended now                         | User launches the official linked installer with administrator permission, selects PostgreSQL Server and command-line tools, and supplies an administrator database password locally. Windows owns the background service. | Explicit data directory; fewest missing platform prerequisites here. Machine-level installation and local account/service changes must be reviewed. Installer need not modify PATH.                                                                         |
| Docker Desktop with Linux PostgreSQL container — later alternative | Install and prepare WSL 2, confirm hardware prerequisites, install Docker Desktop, accept applicable terms, then create a project-owned Compose service. User owns Desktop; project owns its container.                    | A named volume separates database data from container replacement. Most repeatable across developers, but presently more setup than native PostgreSQL.                                                                                                      |
| Official-linked binary ZIP — fallback only                         | Extract binaries locally; explicitly initialize, configure and control a cluster with `pg_ctl`; confirm any runtime dependencies first. No service registration is necessary.                                              | Can avoid a machine service, but adds manual authentication, process lifetime, dependency and cluster initialization work. The documented advanced route does not materially simplify this beginner stage unless administrator installation is unavailable. |

The installer documentation requires administrator privileges, describes selecting components/data directory/port, and states that PostgreSQL runs as a background Windows service. Keep pgAdmin optional and omit Stack Builder for this slice. Default installer port is 5432. [EDB Windows installation](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/windows/).

Docker's current Windows documentation requires modern WSL 2 (at least 2.1.5), hardware virtualization, appropriate Windows support and 8 GB system RAM for that backend. Windows Home can run Linux containers; Windows containers are unnecessary here. Current per-user Docker installation does not itself require administrator privileges, but missing Windows features or firmware changes can require administrator/user interaction and a restart. Machine readiness is not established by the mere presence of wsl.exe. [Docker Windows requirements](https://docs.docker.com/desktop/setup/install/windows-install/).

Docker Desktop's published terms include personal and educational use within its free conditions, while some professional/government uses require a paid subscription. The learner must review the terms applicable to the actual device/use; no unconditional licensing guarantee is made. [Docker Desktop license](https://docs.docker.com/subscription-billing/desktop-license/). PostgreSQL itself grants use under its open-source license; no AWS or hosted database account is involved. [PostgreSQL license](https://www.postgresql.org/about/licence/).

If Docker is selected later, pin the reviewed `postgres:18.6-bookworm` image by resolved digest rather than `latest`. PostgreSQL 18's official image uses `/var/lib/postgresql/18/docker` and its volume mount belongs at `/var/lib/postgresql`, which differs from pre-18 examples. Use a project-specific named volume and publish only `127.0.0.1:5432:5432`. Image initialization variables affect an empty cluster only; changing a password variable does not change an existing database password. [Official PostgreSQL image](https://hub.docker.com/_/postgres). Volumes persist independently of containers; ordinary stop/down must preserve them. [Docker volumes](https://docs.docker.com/engine/storage/volumes/).

## Proposed native setup contract

- Binaries: installer default `C:\Program Files\PostgreSQL\18` unless the reviewed installer differs.
- Persistent cluster: propose **`D:\PlatypusData\PostgreSQL\18\data`**, outside the source repository and generated-output cleanup. Do not create it yet. During installation verify that the service account receives suitable access and record the actual chosen path. An empty new directory is required; never initialize over an existing cluster.
- Port: 5432, with 5433 only if a fresh check finds a genuine conflict. Configure the Node server to match; do not terminate an unrelated port owner.
- Local listener: explicitly keep `listen_addresses = '127.0.0.1'`; local password authentication only, no network-facing database/firewall opening. Review the installed authentication rules before use. PostgreSQL client access is controlled by ordered `pg_hba.conf` records. [PostgreSQL authentication configuration](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html).
- Database: `platypus_service`; separate disposable `platypus_service_test` with explicit ownership/name guards for tests.
- Provisioning: interactive administrator connection creates the database and the roles agreed with proposal 016. `platypus_owner` runs explicit migration/seed commands; `platypus_app` receives only CONNECT, schema USAGE and SELECT on the three business tables for this read-only stage. Application startup never uses the administrator role or silently reruns a seed.
- Passwords: enter locally; never send them in chat or store them in tracked scripts, frontend assets, logs or command history. Later implementation supplies ignored server-side environment configuration and a tracked placeholder example.

Proposed server-only placeholders:

```dotenv
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=platypus_service
PGUSER=platypus_app
PGPASSWORD=<set locally; do not commit>
```

Migration credentials belong to a separate explicit command/configuration boundary. The browser retains only its existing Node API address. PostgreSQL runs independently of `npm.cmd start`: stopping Angular/Node must not remove or shut down the cluster. The integrated application command must not adopt or kill a Windows service. Database start/stop stays an explicit local operation; record the installed service's actual name and startup policy instead of assuming them.

Pin the selected installer filename/build and SHA-256 checksum in the implementation report and confirm `SELECT version()` after setup. The EDB download page currently displays version 18.6, but this browsing interface did not expose its dynamic Windows download links. The exact Windows installer build filename/checksum has **not** been verified; resolve them through the official download flow before installation, without inventing a URL. [EDB downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).

## Future commands for review — not executed

After the approved installer finishes, use explicit binary paths without changing the global PATH:

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
& "$pgBin\psql.exe" --version
& "$pgBin\pg_isready.exe" -h 127.0.0.1 -p 5432 -t 3
& "$pgBin\psql.exe" -X -h 127.0.0.1 -p 5432 -U postgres -d postgres -W
```

`-W` requests a local interactive password. In that administrator session, inspect version/listening/data/authentication configuration and provision only the project database/roles. SQL schema and seed commands are owned by proposal 016. A successful `pg_isready` response establishes listener readiness, not that the application's credentials, database or query work. [pg_isready](https://www.postgresql.org/docs/18/app-pg-isready.html).

Discover the installed service and verify that exactly the intended instance is selected before operating it. The following name is a placeholder, not a verified service:

```powershell
Get-Service -Name '*postgres*'
$pgServiceName = '<verified project PostgreSQL service name>'
Stop-Service -Name $pgServiceName
Start-Service -Name $pgServiceName
```

These future service operations may require administrator permission. Do not mix service control with `pg_ctl` against the same running cluster. For the unselected ZIP alternative, `pg_ctl` provides data-directory-specific start/status/stop and controlled shutdown, which would need a separately reviewed local launcher. [pg_ctl](https://www.postgresql.org/docs/18/app-pg-ctl.html).

## Persistence, recovery and removal acceptance

After the implementation is approved: migrate and seed exactly once; read all 25 original ticket values through SQL, Node and Angular; stop Node/frontends and restart them; verify unchanged data. Then deliberately stop/start only the identified database instance, confirm temporary API failure without a fixture fallback, and use Retry after recovery. Compare rows and seed/migration ledgers before and after; repeat the seed command and prove it does not duplicate or overwrite existing rows. A database restart must not initialize a new directory.

For removal, stop application clients and retain the cluster directory by default. Before uninstalling binaries, export the project database and verify a restore into a separate database. A reviewed future example, with its destination directory explicitly prepared, is:

```powershell
& "$pgBin\pg_dump.exe" -h 127.0.0.1 -p 5432 -U platypus_owner -d platypus_service -W -Fc -f 'D:\PlatypusData\Backups\platypus_service.dump'
```

`pg_dump` exports one database; cluster roles require separately retained provisioning instructions. [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html). The Windows uninstaller can remove components, but its documentation does not provide the same explicit data-preservation statement shown for macOS. Do not assume Windows uninstallation is a backup: inspect every prompt and retain a verified external export plus the stopped cluster. No data-directory, volume or account deletion belongs to ordinary cleanup. [EDB uninstallation](https://www.enterprisedb.com/docs/supported-open-source/postgresql/uninstalling/).

## Next decision and unverified work

Coordinator should reconcile this recommendation with data proposal 016, review it, and present the bounded implementation stage. The next user/OS-dependent step is choosing the native installation route and completing its administrator/interactive installation, including a password entered only on the machine. If that route is unavailable, revisit ZIP or Docker instead of attempting an unapproved platform change. No implementation agent, installer or database was launched by this planning task. Actual installer compatibility, available disk space, chosen data-directory permissions, database credentials and restart persistence remain unverified until that approved setup.
