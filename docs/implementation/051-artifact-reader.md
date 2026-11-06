# Implementation 051 — selected GitHub artifact reader

Date: November 5, 2026. Status: offline preparation; no authenticated download, Package dispatch, CodeBuild execution or publication performed.

## Result and interfaces

- Added only `scripts/delivery/artifact-reader.mjs`, its focused test file and this report. No dependency, workflow, application, cloud resource, credential, setting or Git change was performed by this author.
- `readSelectedArtifact({selection, token, transport, now?, timeoutMs?})` validates exact metadata and downloaded bytes, then returns the existing `verifyDeliveryBundle` result from a fresh owned extraction directory. The transport provides `request(url, options)` returning a standard Response; offline tests inject it. `createGithubHttpTransport({fetchImpl?})` prepares an explicit GET-only, manual-redirect transport without making a request on import/construction.
- `verifyArtifactArchive({archive: Buffer, selection, signal?})` provides offline verification/extraction without HTTP. `inspectArtifactZip(Buffer)` validates and returns ordinary bounded entries in memory; `validateArtifactSelection` validates reviewed receipt fields. There is no execution-on-import, default network command, AWS import or call to a publisher.
- Selection requires repository, externally reviewed immutable repositoryId/repositoryOwnerId, `.github/workflows/package.yml`, `refs/heads/main`, exact sourceSha/runId/runAttempt/artifactId, derived release, production origin, archive artifactDigest and externally supplied envelopeSha256. IDs/digests are explicit inputs; no latest, branch-tip resolution or trust in a checksum taken only from the archive.

## Metadata, authentication and download

The reader requests only the exact run-attempt endpoint, reviewed workflow and exact artifact ID. It requires a successful completed workflow_dispatch run from the same non-fork repository/head repository and immutable owner/repository IDs, matching workflow identity/path, main source and no pull requests. Artifact identity/name/digest/source/expiry/size and timestamps within the selected attempt must match. The contextual envelope independently binds the otherwise absent artifact run-attempt field.

An explicit GitHub read credential is required and kept only in memory; none is obtained, configured or written here. Authorization goes only to exact api.github.com GETs. The archive endpoint must return one 302 to an HTTPS results-receiver.actions.githubusercontent.com or a single Azure blob.core.windows.net storage-account host, following the official artifact egress list. Storage gets no Authorization/cookie/referrer, and additional redirects are refused. URL credentials, ports, HTTP, lookalike domains, metadata redirects and automatically followed redirects fail. Signed query strings and upstream exceptions are not logged or included in the reader's sanitized failure.

Total network deadline defaults to 90 seconds, capped at 120; requests and body readers receive cancellation. Metadata is limited to 1 MiB and the archive to 40 MiB, with streamed/count/header/official-size checks. The downloaded archive must match both the selected external archive digest and GitHub's metadata digest before extraction.

## ZIP and bundle verification

- Pure Node implementation uses node:zlib CRC32 and bounded raw deflate; no extraction subprocess, package installation or new dependency.
- Supports standard ZIP32 stored/deflated entries, UTF-8/ASCII reviewed paths, ordinary directories/files and signed/unsigned streaming descriptors. Central/local names, flags, methods, sizes, CRCs, offsets and descriptors must agree; compressed streams must be fully consumed and local data must be complete/nonoverlapping without hidden entries.
- Rejects traversal/absolute/Windows-reserved/aliased names, duplicate paths, case collisions including implicit ancestor directories, file/directory conflicts, symlinks/devices, link-bearing or unsupported extras, encryption, unsupported methods, multi-disk/ZIP64 and comments. Accepted timestamp/UID extras do not control extraction names or entry types. Extraction creates fresh ordinary files with exclusive writes; it does not materialize archive links/hard links.
- Limits total expansion to the existing 32 MiB bundle bound, 4096 files and 8192 total ZIP entries. Per-entry output limits apply during decompression, including false small declared-size bombs.
- The exact pinned upload-artifact cf430e0 distribution was read: its writer uses archiver.create('zip', {highWaterMark, zlib:{level}}), without forceZip64; the bundled library documents forceZip64=false. Thus small bounded archives from this pinned writer fit the supported standard format; this is source compatibility evidence, not a real authenticated GitHub archive test.
- After all archive checks, extraction occurs under a fresh `.local/aws/releases/artifact-*` directory, then the existing full bundle verifier rechecks the externally anchored envelope, exact file inventory, hashes, complete frontend graphs, backend archive copies/extracted inventory and source/run/origin. Failed extraction/bundle validation removes only its checked fresh child directory. Successful output remains available for a separately reviewed consumer.

## Verification and remaining gates

Nine offline groups passed: realistic valid streaming-deflate archive/full bundle (including a real nested Lambda ZIP), exact selection identities, metadata/fork/run failures, artifact expiry/size/digest/source failures, HTTPS redirects and credential isolation, independent archive/envelope tampering, unsafe ZIP entries, malformed/CRC/expansion cases, timeout cancellation and secret-safe errors. Focused ESLint/Prettier checks are recorded after final source corrections. Tests perform no real network or AWS request and exercise no publication operation.

GitHub read-access provisioning, receipt/immutable-ID selection by the learner, authenticated real download, Linux/CodeBuild environment and human-only AWS launch separation remain unresolved. Existing Package is not dispatched; CodeBuild is not provisioned or started; no cloud state is imported or published. A verified directory is byte-validation evidence and does not authorize release.

## Primary references checked

- [GitHub artifact metadata and authenticated archive download](https://docs.github.com/en/rest/actions/artifacts).
- [Exact workflow run attempts](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run-attempt).
- [Official artifact storage egress hosts](https://docs.github.com/en/actions/reference/runners/github-hosted-runners#communication-requirements-for-github-hosted-runners).
- [Exact pinned upload action distribution](https://raw.githubusercontent.com/actions/upload-artifact/cf430e030ddbb5b0abf93d22962f4752f3646cd9/dist/upload/index.js), [its locked artifact 6.3.1 dependency](https://raw.githubusercontent.com/actions/upload-artifact/cf430e030ddbb5b0abf93d22962f4752f3646cd9/package-lock.json), and [PKWARE ZIP format](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT).
