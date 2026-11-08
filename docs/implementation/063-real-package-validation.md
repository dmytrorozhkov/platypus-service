# 063. Learner-started Package and real archive validation

Date: November 6, 2026. Status: actual GitHub package creation and authenticated local validation completed; CodeBuild and cloud publication remain unperformed.

## Selected run and externally anchored identity

The learner manually started Package #1 through GitHub's Run workflow button on main. Agents did not dispatch it. [Run42210518228, attempt1](https://github.com/dmytrorozhkov/platypus-service/actions/runs/42210518228) completed successfully at source fe8bb0533180bf6f0da703f51a6ff511d5b6cb2b. All three jobs succeeded: real PostgreSQL integration127867745253, complete checks/builds127868292570 and receipt127869263864.

The coordinator selected that exact numbered manual run/source/attempt, not a latest artifact. Immutable repository1445706174 and owner6371438 matched the previously recorded readiness evidence. Package receipt fields were independently obtained from the environment block in the successful exact receipt job's GitHub logs, outside the downloaded archive. Artifact metadata independently matched that receipt.

| Field                    | Observed value                                                   |
| ------------------------ | ---------------------------------------------------------------- |
| Repository               | dmytrorozhkov/platypus-service                                   |
| Workflow / ref           | .github/workflows/package.yml / refs/heads/main                  |
| Artifact ID              | 13497649360                                                      |
| Release                  | gh-42210518228-1-fe8bb0533180                                    |
| GitHub ZIP bytes         | 337499                                                           |
| Archive SHA256           | f4fc70e2c43f45af5fb7cdc0294236bdcef092ec2e86784f2be06411c8e3ed48 |
| External envelope SHA256 | 5b861df265f2af9cb5128b590624b09f23a8d76840b989d406ab2094aab345a8 |
| Intended origin          | https://d2p7y3iystcl60.cloudfront.net                            |

## Actual download and verification

The unchanged051 reader readSelectedArtifact used existing GitHub access held only in memory. Exact run-attempt, workflow and artifact metadata passed its identity, event, success, source, expiry, timestamp and byte-bound checks. Authenticated GET requests went only to api.github.com; the signed storage download received no Authorization header. No credential or signed URL was printed or stored in the evidence.

The real337499-byte ZIP passed the external archive digest and bounded ZIP verification. Extraction into a newly owned ignored directory passed the external envelope digest, exact source/run/origin, full inventory, file hashes, frontend graphs and backend archive verification. Result:1008699 total unpacked bytes and39 inventory files, plus the envelope. The verified local directory is .local/aws/releases/artifact-5CCFcU.

Two additional local checks used the real downloaded bytes. A single-byte-altered copy was rejected. The intact archive with a deliberately wrong external envelope hash was also rejected, and no failed extraction directory remained. The successful extraction was preserved. These checks operated only on local copies and invoked no publisher.

Ignored machine evidence: .local/ci/package-one.json, package-one-selection.json and package-one-verified.json. The first records exact actual run/jobs/artifact metadata; the selection records receipt-job provenance; the last records validation, negative results and redacted network routing. No raw credential-bearing response was saved. No new tracked implementation, dependency, workflow or application change was required.

## Limits and next decisions

This establishes actual GitHub artifact creation and authenticated verification on this local Windows machine. It does not establish CodeBuild access, Linux execution, human-only AWS credential separation, cloud publication or database hosting. The existing workflow retains the GitHub artifact for one day; this exact retained local extraction is evidence, not durable release state or publication authority. A future consumer must explicitly validate its selected unexpired artifact again rather than trust a generic latest version.

No Deploy/CodeBuild run, AWS resource/access mutation, delivery enablement or cloud application update occurred. Keep DELIVERY_ENABLED absent/false and preserve the Free plan. Any future publication remains separately reviewed and manually started by the learner. Local PostgreSQL demonstration062 is complete; the agreed100000-ticket dataset, server-side querying, authentication and cloud database remain future separately bounded work. The next stage is to be agreed with the learner.
