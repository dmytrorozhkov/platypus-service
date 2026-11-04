# Implementation 022 — Lambda Event Function adapter

Date: November 4, 2026.
Status: implemented, locally verified and independently reviewed in 024. Deployment preparation is integrated; actual cloud deployment remains separate work.
Branch: feature/aws-deployment-preparation.
Scope: apps/server and this report. No cloud resource, AWS CLI operation, dependency installation, existing-service shutdown or Git mutation occurred.

## Result

The existing read-only ticket application now has two thin transports: the local Node HTTP server and a Lambda Event Function handler for Function URL payload version 2.0. Both use the same routing, repository, response headers, origin checks, collection envelope and public errors.

The selected cloud model remains an ordinary on-demand Event Function with a Function URL. No Web Function adapter, API Gateway, framework, database, identity feature or runtime dependency was introduced.

The original 25-record fixture is unchanged. Local main startup still binds localhost, accepts PORT and ALLOWED_ORIGINS, sends its IPC ready message and retains its existing signal shutdown. The root's integrated process ownership was not changed.

## Files and boundaries

- src/ticket-application.ts: transport-neutral request/response types, routing, origin configuration parsing and response serialization.
- src/server.ts: adapts Node requests to the shared application and writes its status, headers and body if the connection is still open. The existing defaultAllowedOrigins export remains available.
- src/main.ts: reuses the extracted environment-origin parser; listener/startup behavior stays in this local-only entry.
- src/lambda.ts: exports handler and an injectable createLambdaHandler test boundary. It imports no main module or HTTP listener.
- test/lambda.test.mjs: real HTTP/Lambda parity, malformed-event handling, configured deployment origins and isolated import checks.
- package.json: the existing test script now runs both server.test.mjs and lambda.test.mjs. Dependencies and compiler configuration are unchanged.

Function URL responses explicitly return statusCode, headers, a serialized string body and isBase64Encoded: false. They do not rely on Lambda's inferred-success defaults.

The adapter requires version 2.0, a valid rawPath and requestContext.http.method. Provided headers must be a string-valued object; Origin lookup ignores header-name case, trims surrounding header whitespace and rejects ambiguous duplicate Origin names or newline-bearing values. Missing or malformed routing fields return a readable JSON 400 INVALID_REQUEST response instead of throwing or defaulting to GET.

Raw paths remain authoritative and are not decoded into a different endpoint. Encoded unknown paths and trailing-slash variants retain 404 behavior. Query parameters, cookies and request bodies are unused by this read-only application. The adapter validates consumed routing fields; it does not claim to implement a complete AWS event-schema validator or additional request features.

HEAD remains unsupported with status 405 and Allow: GET, OPTIONS. Its body is suppressed explicitly for Lambda, matching the local HTTP wire behavior. HEAD is not silently treated as GET. Known-endpoint OPTIONS returns 204 with GET, OPTIONS; unknown endpoints and denied origins preserve their existing errors.

## Origin and error behavior

The original explicit local defaults are http://localhost:4200 and http://localhost:5175. ALLOWED_ORIGINS uses the same exact HTTP-origin validation for local and Lambda entries. The exported Lambda handler reads it per invocation; a deployed configuration should supply the exact CloudFront HTTPS origin.

No wildcard or new authorization behavior was added. Origin restrictions remain browser rules, not sign-in or role/organization enforcement. Requests without Origin keep the existing read-only contract.

Responses retain no-store, nosniff, Vary: Origin, JSON content type where applicable and the existing NOT_FOUND, METHOD_NOT_ALLOWED, ORIGIN_NOT_ALLOWED and INTERNAL_ERROR codes. Controlled repository failures return the public message Tickets could not be loaded. Internal exceptions stay out of the response body.

A malformed Lambda origin environment value produces a sanitized JSON 500 instead of crashing at import. Its log records that origin configuration is invalid without echoing the configured values. Malformed external events use the new INVALID_REQUEST code.

Function URL CORS configuration should remain omitted: the application already supplies the appropriate headers. The infrastructure owner confirmed application-owned CORS and forwarding the original browser Origin. CloudFront/Function URL permissions, resource provisioning and actual deployed routing remain outside this server task.

## Compiled packaging contract

The server builds with the existing TypeScript 6.0.3 NodeNext configuration and Node 24 type definitions. There are no native modules or runtime npm dependencies.

The infrastructure owner and server owner agreed on the following ZIP-root layout:

```text
lambda.js
ticket-application.js
ticket-repository.js
fixtures/tickets.json
package.json
```

The handler setting is lambda.handler. package.json must declare {"type":"module"} because the compiled .js files are ECMAScript modules. Preserve the fixture's relative path and its JSON import attribute.

The infrastructure owner creates the archive and minimal package metadata. Do not package main.js or server.js as cloud entry points; neither is needed by the Lambda import graph. No node_modules directory, credentials or frontend source belongs in this dependency-free archive.

Packaging and extraction verification are owned by task 023. This report verifies the compiled server entry locally, not an actual Lambda deployment.

## Local verification

Commands run from D:/Projects/Pet-projects/aws:

| Command                                                                                            | Actual result                                                                      |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| npm.cmd run build --workspace @platypus/server                                                     | Passed. Compiled Lambda, shared application, local entries and fixture JSON.       |
| npm.cmd run typecheck --workspace @platypus/server                                                 | Passed with the existing compiler configuration.                                   |
| npm.cmd run test --workspace @platypus/server                                                      | All 8 Node test groups passed: the original 3 HTTP groups and 5 new Lambda groups. |
| node_modules/.bin/eslint.cmd apps/server --max-warnings 0                                          | Passed with zero warnings or errors.                                               |
| node_modules/.bin/prettier.cmd --check apps/server docs/implementation/022-lambda-event-adapter.md | Passed for all owned authored files.                                               |
| git diff --check -- apps/server docs/implementation/022-lambda-event-adapter.md                    | Passed. The source fixture is unchanged.                                           |

The parity tests use real ephemeral localhost HTTP listeners and compare status, application headers and body with the Lambda event response. They cover health, full 25-record collection, ignored query strings, unknown/encoded/trailing-slash paths, POST/PUT/HEAD/OPTIONS, both allowed local origins, denied origins, empty data and controlled internal failures.

Malformed-event tests cover missing/invalid version/path/context/method/header fields, control characters, ambiguous Origin values and header normalization. The exported handler is checked with an exact configured CloudFront origin and rejects the old localhost origin under that configuration.

The import regression launches an isolated Node process, intercepts attempted Server.listen calls and compares SIGINT/SIGTERM listener counts before and after importing the compiled Lambda entry. Import completes with zero listener attempts, unchanged zero signal-listener counts and an exported handler function.

An initial build exposed a TypeScript inference mismatch on the optional CORS header object; an explicit Record<string, string> annotation resolved it. The successful build and test results above are from the corrected source.

## Sources and limits

Applied the installed aws-serverless skill and its local references/lambda.md for the already selected Event Function/Function URL and ZIP-packaging dimensions. The chosen model was retained rather than reopening the compute decision.

Current primary AWS documentation was read through the connected AWS MCP documentation tools:

- Function URL payload-v2 fields and explicit response structure: https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html
- Node.js ZIP-root entry and dependency packaging: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-package.html
- Node.js Event Function handler/export conventions and current Node 24 runtime: https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html

Only documentation reads occurred through AWS tools. No AWS service operation or paid invocation was run. No existing development service was stopped or rebound.

Local Node tests do not establish AWS permissions, regional quotas, CloudFront/OAC behavior, ARM64 managed-runtime behavior, deployment success or billing. Those require separately reviewed infrastructure preparation and an explicitly authorized deployment step.
