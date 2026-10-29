# TigerGraph Savanna application integration

**2026-10-30 wizard update:** local browser/security checks pass. Latest required-live rerun returned 503; separate fixed-query transport probe timed out. Recheck workspace connectivity and rerun live mode before demo. The successful 2026-10-29 run below is historical evidence for the previous split UI, not a pass for this wizard revision.

**Latest verification (2026-10-29):** the merged split UI passed `test:e2e:live` independently from this workspace against the configured public Savanna endpoint (12.2 seconds): actual path/source/review/revocation with no graph mocks. T11/T12 acceptance now passes. No graph installation/loading or exact-source compiler verification was performed; T09/T10 operator checks remain pending. The initial-state evidence below is historical.

## Evidence and current status (2026-10-29)

The user reports successfully creating, loading, compiling, installing and executing the three core queries on Savanna for `CaseGraphDemoV1`. This is user-provided runtime evidence, not a run independently performed from this workspace. Returned metadata was `edition: enterprise`, `api: v2`, `schema: 4`; these fields do **not** establish the server version. The local Community 4.2.5 deployment candidate is not proof of Savanna's version.

Reported inventory: CaseReport 20, UPI_VPA 20, BankAccount 19, PhoneNumber 20, SocialHandle 20, PhishingDomain 19, EvidenceRef 100: **218 vertices**. Primary edges: CASE_REPORTED_VPA 20, CASE_REPORTED_PHONE 20, CASE_REPORTED_HANDLE 20, CASE_REPORTED_DOMAIN 20, VPA_SETTLED_TO_ACCOUNT 20, RELATION_SUPPORTED_BY_EVIDENCE 100: **200 primary edges**. Reverse edges are additional, not part of that total. Counts alone do not establish query semantics.

The reported path connects cases `30000000-0000-4000-8000-000000000001` and `30000000-0000-4000-8000-000000000002`, through `fx:vpa:01`, `fx:account:shared-01`, `fx:vpa:02`. Four reported EvidenceRefs resolve to the two case-report and two settlement relations, with exact case/from/to bindings. All are authored `SYSTEM_INFERENCE`, `UNVERIFIED`, `SYNTHETIC_FIXTURE`; the lead is `NEEDS_REVIEW`. They are not uploaded evidence, independent bank records or proof of guilt.

The regression JSON in `apps/api/test/fixtures/savanna-observed.json` transcribes the handoff's result shapes; its REST envelope is reconstructed for tests. Mocks are not live connectivity proof. This workspace had no configured public endpoint or application credential. HTTPS execution, exact revised local GSQL compilation, application-to-Savanna scope negatives and live browser acceptance remain **pending**. Existing T09–T12 unchecked acceptance items remain unchanged. Generated bundle manifests retain their original `liveVerified:false` semantics.

## Sources and contracts

Schema: `graph/gsql/schema.gsql`. CaseReport uses `case_id`; identifier vertices use `id`. EvidenceRef stores case attribution, relation, fixture kind, provenance/verification, synthetic flag and from/to identifiers. Edges retain case/evidence attribution and trust labels. Reverse VPA_REPORTED_BY_CASE and ACCOUNT_SETTLED_FROM_VPA support the backward half of the path.

The three core definitions are:

| Source | Parameters | Output |
| --- | --- | --- |
| `graph/gsql/verify_fixture_inventory.gsql` | none | Seven named vertex counts; operator-only |
| `graph/gsql/find_case_links.gsql` | `case_id`, `max_hops` exactly 4, `allowed_case_ids` at most 20 | `classification: SYNTHETIC_INVESTIGATIVE_LEAD`, `paths` of four-hop tuples; invalid bounds/scope give empty paths and `INVALID_SCOPE_OR_HOP_BOUND` |
| `graph/gsql/get_lead_sources.gsql` | `evidence_ids` at most 80, `allowed_case_ids` at most 20 | `classification: SYNTHETIC_FIXTURE_SOURCES`, `sources` with id, case_id, from_id, to_id, relation_type, fixture_kind, source_kind, verification_status, data_origin, synthetic |

Path fields: source_case_id, source_vpa_id, account_id, target_vpa_id, target_case_id, source_report_ref, source_settlement_ref, target_settlement_ref, target_report_ref, source_kind, verification_status, review_status, data_origin. The application caps returned paths at 20 and validates every source against its exact relation and endpoints. REST envelopes must have `error:false` and exactly one result object. Empty permitted results are valid; failures never substitute demo paths.

The handoff's working V2 directed-edge spelling is `-(TYPE>:alias)-`, replacing `-(TYPE:alias)->`. Both functional query sources now use that spelling, including `RELATION_SUPPORTED_BY_EVIDENCE`. Scope filters, edge provenance, tuple names and limits are preserved. The exact final installed sources were not exported; these local files are synchronized with the reported syntax/logic, not asserted byte-identical or newly compiler-verified. Inventory source is unchanged. No installation or loading command was executed here.

## Endpoint mapping incident — already resolved by the user

CSV edge source and target columns must map to `from` and `to`. `case_id` and `evidence_id` are attributes, not substitute endpoints. The earlier incorrect mapping auto-created 120 invalid vertices (338 total). The user reports deleting faulty edges, confirming zero, removing those invalid vertices, then loading correct mappings and confirming 218 vertices/200 primary edges. Do not repeat that cleanup or load old configurations.

The existing graph/data and `.local/graph-t10-bundle` were preserved. No DROP, recreation, seed reload, cleanup or CSV overwrite belongs in application startup. Historical administrative queries such as delete_fixture_edges/delete_invalid_vertices must never be exposed to end users. Avoid regenerating an existing bundle merely to connect the app; bundle generation refuses conflicting existing files.

## Backend connectivity and credentials

Graph flags are read from **exported process environment**, not automatically from `.env`:

| Setting | Meaning |
| --- | --- |
| `TIGERGRAPH_ENABLED` | `false` default; explicitly `true` to query |
| `TIGERGRAPH_ENDPOINT` | Optional public origin `https://<workspace-id>.i.tgcloud.io` or `https://<workspace-id>.<workgroup-id>.i.tgcloud.io`; no path, query, credentials, fragment or non-443 port |
| `TIGERGRAPH_LOCAL_PORT` | Default 14240; numeric 1024–65535, used only when no public endpoint |
| `TIGERGRAPH_AUTH_MODE` | `bearer` default or `secret` |

Put the chosen graph-scoped bearer token or database secret in ignored `.local/tigergraph-app.token`, a real non-symlink mode-0600 file. Use a private editor; do not put credentials in shell arguments/history, URLs, VITE variables, source, browser storage or logs. Keep `.local` private (0700). The file accepts 16–4096 characters from letters/digits/dot/underscore/tilde/hyphen, with surrounding whitespace trimmed. Missing, unsafe or invalid files fail closed. Use a dedicated database user with only required query privileges; rotate/revoke exposed credentials. No secret exchange, cloud provisioning or billing operation is performed by the app.

Savanna's database data plane supports `Authorization: Bearer <token>` and `Authorization: GSQL-Secret <secret>`. The `x-api-key` for `api.tgcloud.io` is the management/control plane and is not used here. Obtain the public workspace origin through Savanna's Connect interface; internal `.svc` service names are rejected. Custom domains are deliberately unsupported pending explicit review.

Requests use only POST `/restpp/query/CaseGraphDemoV1/find_case_links` and `/restpp/query/CaseGraphDemoV1/get_lead_sources`. TLS uses Node's normal certificate verification; redirects are rejected. Each transport request has a 10-second deadline combined with the service's 12-second overall path/source budget, and a 128-KiB response ceiling. No raw error body or credential is returned/logged. Upstream HTTP 401/403 maps to application **502 GRAPH_AUTHENTICATION_FAILED**, preserving the analyst session; network/timeout/malformed/oversize/disabled errors map to **503 UNAVAILABLE**. End-user 401/403 remain application authentication/authorization failures. Other upstream error responses, including JSON error envelopes, fail closed as unavailable.

Without a public endpoint, the original `http://127.0.0.1:<port>` loopback/tunnel mode remains. Never disable TLS validation to fix public connectivity. The separate administrative `graph:verify-live` remains loopback-only and uses `.local/tigergraph.token`; it is not a public Savanna verifier.

Primary references reviewed: [Savanna data-plane authentication and installed queries](https://www.tigergraph.com/docs/savanna/main/rest-api/data-plane-apis), [control-plane API](https://www.tigergraph.com/docs/savanna/main/rest-api/), [Connect via APIs](https://www.tigergraph.com/docs/savanna/main/workgroup-workspace/workspaces/connect-via-api).

## Application flow and endpoints

No new application route is required. Existing routes under `/api/v1` remain:

- POST `/investigations/:caseId/graph-leads` with only `{ "maxHops": 4 }` executes the two fixed queries.
- GET `/investigations/:caseId/graph-leads` reads labeled saved snapshots.
- GET `/graph-leads/:leadId/sources/:sourceId` reads an authorized source snapshot.
- PATCH `/graph-leads/:leadId/review` accepts REVIEWED or NOT_RELEVANT.

Backend identity, organization and current INVESTIGATE grants derive the allowed set. The browser cannot provide allowed_case_ids, query names, credentials or arbitrary GSQL. Both cases/sources are validated and grants rechecked before persistence/return, including revocation during execution. Snapshot reads/review also recheck current access. PostgreSQL remains the case/grant/snapshot source of truth. Revoked access cannot be bypassed by saved leads.

The existing analyst panel displays five nodes, four source drilldowns, capture time, synthetic/unverified provenance and review state. No runtime fixture provider is added. Auth failures display the controlled backend message; outages clear prior results. Human review does not change source verification.

## Demo commands

With dependencies and local PostgreSQL configured, first prepare the local synthetic app database (initial setup, not a graph reload):

```bash
npm run infra:up
npm run db:migrate
npm run seed:synthetic
```

After privately creating the credential file and confirming the deployed queries/privileges, replace the placeholder origin with your actual public workspace origin:

```bash
TIGERGRAPH_ENABLED=true TIGERGRAPH_ENDPOINT=https://YOUR-WORKSPACE.i.tgcloud.io TIGERGRAPH_AUTH_MODE=bearer npm run dev:demo
```

Use `TIGERGRAPH_AUTH_MODE=secret` if the private file contains a database secret. For a secured existing local tunnel, omit TIGERGRAPH_ENDPOINT and set TIGERGRAPH_LOCAL_PORT=14240. Open the Vite URL printed by the dev server. Sign in as the seeded owners and grant the fictional analyst organization INVESTIGATE on both cases. Sign in as the analyst, select case 01, run the scoped query, inspect each source and record review. Unrelated/denied cases must not appear. No upload is required to view the separately authored graph scenarios.

Offline/local regression commands:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:investigations
npm run test:e2e
```

Required real public graph browser check, only after endpoint/private credential configuration:

```bash
TIGERGRAPH_ENDPOINT=https://YOUR-WORKSPACE.i.tgcloud.io TIGERGRAPH_AUTH_MODE=bearer npm run test:e2e:live
```

Default E2E forces graph disabled. Required-live mode uses the public configuration, executes actual queries and must pass path/source/review/revocation assertions; no interception or success fallback. Do not report the default E2E or mocked transport suite as this live test. Confirm actual server version, exact installed GSQL and all negative-scope cases before closing remaining live acceptance. Stop local PostgreSQL with `npm run infra:down` when finished; its working volume is preserved.

## Split UI update
Victim filing is `/`; fictional analyst/officer view is `/officer`. Victims deliberately use **Share for investigation** and can revoke the resulting grant. New cases are not automatically shared or projected to TigerGraph. Show urgent guidance before intake. Use **Run similar-case search** for a new live query; distinguish it from saved snapshots. See DEMO.md for current button names and supported extraction limits.
