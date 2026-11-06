# Local PostgreSQL Setup Preparation 058

Date: November 6, 2026.
Status: official-source research, bounded machine probes and installer download/integrity verification completed. The installer has **not** been executed. No cluster, role, password, database, Windows service, PATH, firewall, WSL, Docker or AWS setting was created or changed.

## Purpose and current baseline

Prepare a native Windows PostgreSQL 18 environment for the already implemented explicit database-backed backend. Hosted integration054 actually passed against PostgreSQL18.6; this preparation selects the same server patch where the official Windows installer is available. It does not claim that Linux/container evidence establishes Windows installation or local persistence.

The PostgreSQL project's [current version policy](https://www.postgresql.org/support/versioning/) lists18.6 as the supported current minor for major18, matching the [EDB download table](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads). The [community Windows page](https://www.postgresql.org/download/windows/) links the EDB installer. Its listed tested platforms for18 are Windows Server2025/2022; it expects comparable desktop Windows releases generally to work. Exact Windows11 installation compatibility remains to be demonstrated on this machine.

## Exact installer and source verification

The official EDB page's **18.6 / Windows x86-64** cell was resolved from its actual HTML, rather than constructing a guessed filename. The real link [EDB file1260607](https://sbp.enterprisedb.com/getfile.jsp?fileid=1260607) returned HTTP302 to [postgresql-18.6-5-windows-x64.exe](https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64.exe). The final HTTPS response was200 with414,966,472 bytes. Its Last-Modified header was `Mon, 05 Oct 2026 07:57:34 GMT`. The multipart ETag is not treated as a cryptographic checksum.

The downloaded installer is staged at:

```text
D:\Projects\Pet-projects\aws\.local\postgres\setup\postgresql-18.6-5-windows-x64.exe
```

`git check-ignore` confirmed this location is ignored. The download used an exclusive new file, checked the expected byte count and recomputed SHA-256 from the saved bytes. Receipt timestamp: `2026-11-06T09:38:16.108Z`.

| Field                             | Verified value                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Server patch / installer revision | PostgreSQL18.6 / EDB revision5, Windows x64                                                                                   |
| Exact bytes                       | 414,966,472                                                                                                                   |
| Local SHA-256                     | `227e2bc08091b4c2b8338c7d61b11d057f895711480b006f90bfcfcd2410a58a`                                                            |
| Vendor checksum endpoint          | [Official EDB EXE checksum](https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64.exe.sha256), actual HTTP200 |
| Vendor comparison                 | Exact match with the saved installer                                                                                          |
| Authenticode result               | `Valid`, `Signature verified.`                                                                                                |
| Signer subject                    | `CN=EnterpriseDB Corporation, O=EnterpriseDB Corporation, L=Wilmington, S=Delaware, C=US`                                     |
| Signer issuer                     | `CN=DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1, O="DigiCert, Inc.", C=US`                                       |
| Signer certificate thumbprint     | `7BEDD1269FCCF7A5D95F18274750B79893C06C70`                                                                                    |
| Signer certificate validity       | `2026-01-30T00:00:00Z` through `2029-01-31T23:59:59Z`                                                                         |
| Timestamp certificate subject     | `CN=DigiCert SHA256 RSA4096 Timestamp Responder 2026 1, O="DigiCert, Inc.", C=US`                                             |
| Execution                         | Not executed                                                                                                                  |

The exact vendor sidecar content was the following line followed by CRLF:

```text
227e2bc08091b4c2b8338c7d61b11d057f895711480b006f90bfcfcd2410a58a  postgresql-18.6-5-windows-x64.exe
```

The same exact installer checksum is explicitly confirmed by a contributor in the official EDB installer repository's [issue746](https://github.com/EnterpriseDB/edb-installers/issues/746). This is independently published expected data, not merely a hash calculated from our own download. The same-origin sidecar alone is not a separate trust authority from the binary host. Windows Authenticode additionally verified the publisher signature. The timestamp certificate was observed, but the precise signing/countersigning instant was not extracted. [Microsoft Get-AuthenticodeSignature](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/get-authenticodesignature?view=powershell-7.5) documents the signature inspection used.

Ignored evidence: `.local/postgres/setup/download-evidence.json` and `signature-evidence.json`. No installer or evidence file belongs in Git. Before a later launch, verify this same local file again; a replacement download requires fresh identity checks.

## Fresh bounded machine observations

| Probe on November6         | Observation and limit                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL service names   | No `*postgres*` match returned. This is not a complete arbitrary-location inventory.                                                                                                                                      |
| Commands on PATH           | `psql`, `pg_ctl` and `docker` were not found.                                                                                                                                                                             |
| Common paths               | `C:\Program Files\PostgreSQL` and proposed `D:\PlatypusData\PostgreSQL\18\data` were not found by the bounded probe. Nothing was created.                                                                                 |
| Actual local TCP attempts  | Both127.0.0.1 and::1 returned ECONNREFUSED on5432 and5433. Recheck immediately before selecting a port; this observation reserves nothing.                                                                                |
| OS registry / architecture | EditionCore, DisplayVersion25H2, build26200.9818, 64-bit OS. Microsoft's [release information](https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information) maps that build to Windows11 25H2. |
| Physical memory            | 34,258,067,456 bytes observed through read-only CIM inventory.                                                                                                                                                            |
| Disk before download       | C:7,229,374,464 bytes free; D:142,396,121,088 bytes free. Download was saved onD. These are momentary values, not a complete installer-space guarantee.                                                                   |

No full Windows update/reboot-pending, CPU-frequency, security-policy, administrator-token or future service-account directory-permission audit was performed. The [EDB requirements](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/requirements/) specify administrator privileges on Windows, current Windows updates, and baseline hardware of1GHz CPU/2GB RAM/512MB disk, with additional storage for data/components. Observed memory exceeds that baseline; exact installation remains untested.

## Proposed settings for the later guided installation

These are project choices, not claims about the unexecuted installer's actual defaults:

| Setting                 | Proposed choice                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation type       | Interactive native Windows x64; user handles Windows permission prompts.                                                                                                   |
| Binaries                | `C:\Program Files\PostgreSQL\18`, subject to actual wizard review.                                                                                                         |
| Required components     | PostgreSQL Server and Command Line Tools.                                                                                                                                  |
| Optional components     | pgAdmin may be omitted; Stack Builder and its exit launcher are unnecessary for this slice.                                                                                |
| Persistent cluster data | New empty `D:\PlatypusData\PostgreSQL\18\data`, outside source/dependency cleanup. Verify service-account access during actual setup. Never initialize over existing data. |
| Port                    | 5432 if still free;5433 only after identifying a genuine conflict. Do not stop an unrelated owner.                                                                         |
| Locale                  | Review the actual available choices; retain a valid UTF-8-capable cluster configuration and record it. Do not assume a Linux locale name exists on Windows.                |
| Credentials             | User enters a fresh administrator password only into the local installer; never in chat, screenshots, tracked files or command arguments.                                  |
| PATH                    | Leave unchanged; use explicit PostgreSQL binary paths.                                                                                                                     |

EDB documents the interactive administrator wizard, selectable components/data directory/port/locale, service installation and unchanged PATH by default. The actual service name/account, installed locale and runtime dependencies still need inspection. Do not copy an unattended installation example with a shared default password. [EDB Windows installation](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/windows/)

Local-only configuration must be verified before application use: intended `listen_addresses = '127.0.0.1'`, chosen port and password-based loopback authentication. Do not assume the EDB installer's generated configuration already matches the community defaults. Do not add public interfaces or open firewall ports. PostgreSQL documents address binding as a startup setting in [connection settings](https://www.postgresql.org/docs/18/runtime-config-connection.html). Review the actual ordered `pg_hba.conf` rules; use SCRAM-SHA-256 password checks rather than trust. [Authentication rules](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html)

## Beginner handoff: give only the first action

After the coordinator completes independent verification, the first learner-facing action should be:

> Open the verified installer file shown above. If Windows requests permission, check that the publisher is EnterpriseDB Corporation. Stop at the Welcome screen and report that it opened. Do not click Next yet.

This report does not launch it. Continue through the actual screens one small step at a time; the coordinator should not send every installer/password/database operation at once.

## Remaining work after installation

Installation alone does not create the application roles/database or prove persistence. Later explicit setup must verify the exact version and service/data paths, local listener/authentication, and a real administrator connection without collecting the password in chat. Then provision only `platypus_service`, separate `platypus_owner` and least-privileged `platypus_app` credentials, run the existing explicit migration/seed/check commands with owner credentials and launch the separate PostgreSQL entry with runtime credentials. No administrator credentials belong in the application or browser.

Local service start/stop remains independent of Node/frontend shutdown. Record the actual service identity before any deliberate restart; never mix service control and pg_ctl for the same live cluster. Do not run the CI-only setup/restart helpers against the ordinary local database. Local saved-data/outage/Retry demonstration remains pending; a separate logical test database does not isolate a whole-instance restart. Existing public Lambda/demo remains fixture-backed and no cloud database/deployment is implied.
