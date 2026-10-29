# REST API Contract

All application endpoints use `/api/v1` unless noted. JSON success format: `{"data":...,"requestId":"..."}`. Errors: `{"error":{"code":"...","message":"..."},"requestId":"..."}`. No stack traces or evidence content in error details.

| Method | Path | Role | Expected result |
|---|---|---|---|
| GET | `/health/live` | internal | process alive |
| GET | `/health/ready` | internal | required dependencies ready |
| POST | `/cases` | victim | 201 new owned draft |
| GET | `/cases/:id` | owner/granted analyst | authorized case only |
| POST | `/cases/:id/evidence` | owner | bounded upload, hash and metadata |
| GET | `/cases/:id/evidence` | authorized | evidence metadata only |
| GET | `/cases/:id/evidence/:evidenceId/view` | authorized | controlled binary stream with safe headers |
| POST | `/cases/:id/extractions` | authorized | queue/run extraction |
| GET | `/cases/:caseId/claims` | owner/granted analyst | claims plus source refs, revisions and status |
| POST | `/cases/:caseId/claims` | owner | OCR amount promotion or recollection |
| PATCH | `/cases/:caseId/claims/:claimId` | owner | revision appended; no source overwrite |
| GET | `/cases/:caseId/timeline` | owner/granted analyst | ordered events linked to claims |
| POST | `/cases/:caseId/timeline` | owner | event linked to one or more supporting claims |
| GET | `/cases/:id/clarifications` | authorized | open questions |
| POST | `/cases/:id/clarifications/:questionId/answer` | owner | answer/UNKNOWN recorded |
| POST | `/cases/:id/exports` | authorized | versioned draft export |
| POST | `/cases/:id/shares` | case owner | scoped case access grant |
| POST | `/investigations/:caseId/graph-leads` | analyst with grant | permitted path(s) only |
| PATCH | `/graph-leads/:id/review` | granted analyst | lead reviewed/irrelevant |

## Validation and safety
- Derive current identity from server-side auth, never trust `userId`/`tenantId` in request body.
- Enforce authorization before file existence checks and again when returning graph paths.
- Bounded multipart upload with MIME/sniffing, size limits, no remote URL fetch, no uploaded-code execution.
- `POST /cases/:id/extractions` must be idempotent per immutable file + engine/version where possible.
- Use conventional 201/200/202/400/401/403/404/409/413/415/422/429/500/503 statuses according to outcome.
- Do not serve private objects via unprotected public links.
- Clients cannot submit arbitrary GSQL or raw SQL; accept pre-defined query parameters only.
- Treat `NOT_AVAILABLE` as an honest integration result; never substitute fake results silently.

## Sample minimal source-linked claim response
```json
{
  "data": [{
    "id": "synthetic_claim_001",
    "field": "payment_amount",
    "rawValue": "₹40,000",
    "sourceKind": "OBSERVED_IN_UPLOAD",
    "verificationStatus": "UNVERIFIED",
    "source": {
      "evidenceId": "synthetic_receipt_001",
      "boundingBox": {"x": 0.41, "y": 0.53, "width": 0.37, "height": 0.07},
      "coordinates": "relative_0_to_1"
    }
  }],
  "requestId": "demo-request-123"
}
```

Request/response DTOs should be generated in code and reflected here after implementation rather than leaving stale examples.

## Implemented T06 claim and timeline routes

Paths below are under `/api/v1`. All require a valid session and current case scope.

| Method/path | Access | Request and behavior |
|---|---|---|
| `GET /cases/:caseId/claims` | owner or granted analyst | Lists values, source observations, verification status and append-only revision history. |
| `POST /cases/:caseId/claims` | owner | `{type, sourceKind, rawValue}` for a recollection, or `{type:"payment_amount", sourceKind:"OBSERVED_IN_UPLOAD", evidenceId, regionId}` to promote stored OCR. Text and coordinates come from the database, not the client. |
| `PATCH /cases/:caseId/claims/:claimId` | owner | `{rawValue, reason?}`; appends before/after revision and changes interpreted value only. |
| `GET /cases/:caseId/timeline` | owner or granted analyst | Lists events chronologically with linked same-case claim summaries. |
| `POST /cases/:caseId/timeline` | owner | `{eventType, precision, occurredAt?, uncertainty, claimIds}`. Requires supporting claims; exact/approximate times require a timezone, `DATE_ONLY` takes `YYYY-MM-DD`, and `UNKNOWN` omits `occurredAt`. |

T06 claims remain `UNVERIFIED`. Deterministic INR normalization returns integer minor units only for supported INR-prefixed amount strings. A screenshot and user recollection do not establish bank verification.

## T00 implementation status
Only `GET /api/v1/health/live` is implemented. It returns HTTP 200 with
`data: { status: "ok", scope: "process-only", mode: "local-synthetic" }` and a
fresh request ID. This does not check PostgreSQL or TigerGraph. Readiness and all
case/evidence/auth/graph routes remain unimplemented (404).

## Implemented T03 routes

T03 supersedes the T00 implementation status above. All responses use the documented
success/error envelope and server-generated request IDs. Responses are `no-store`.

| Method/path under `/api/v1` | Access | Behavior |
|---|---|---|
| `POST /auth/demo` | Public, opt-in demo mode | JSON `{demoSubject}`; only synthetic-victim-a, synthetic-victim-b, synthetic-analyst accepted; returns opaque token, expiry and fictional user |
| `GET /auth/me` | Bearer session | Current DB-backed identity |
| `POST /auth/logout` | Bearer session | Invalidates session |
| `GET /cases` | Victim/analyst | Only owned or actively granted synthetic cases |
| `GET /cases/:caseId` | CaseScopeGuard | Owner or analyst with active explicit grant |
| `POST /cases/:caseId/shares` | Owner victim only | `{organizationId, scope, expiresAt?}`; READ/INVESTIGATE, fictional consortium only; explicit action can reactivate the same scope |
| `DELETE /cases/:caseId/shares/:grantId` | Owner victim only | Revokes that grant; other active scopes still apply |

Use `Authorization: Bearer <token>`, never user/role IDs from request bodies or
headers. DTOs reject undeclared fields. Nonexistent, malformed and unauthorized
case IDs all return the same 403 error. Unavailable DB operations return 503,
without SQL, stack traces or parameters. Unknown routes remain 404.

Roles and synthetic membership are checked against the DB on every private
request. Grant validity includes organization, scope, current owner as grantor,
revocation and expiration. Public health remains process-only; readiness, export
and graph endpoints remain unimplemented.

## Implemented T04 routes

- `POST /cases` (victim only): `{title, category, syntheticAcknowledged: true}`.
  Category: investment/friendship/payment/other; title 1–120 trimmed characters.
  Owner derives from the session, not the payload. Returns 201 synthetic DRAFT.
- `POST /cases/:caseId/evidence` (owner only): multipart with exactly one `file`,
  no additional fields. PNG/JPEG only, maximum 5 MiB. Returns 201 with immutable
  source UUID, case ID, SHA-256, byte size, detected/validated MIME and created time.
- `GET /cases/:caseId/evidence`: owner/actively granted analyst; metadata manifest.
- `GET /cases/:caseId/evidence/:evidenceId/view`: protected original download with
  live case checks, including a recheck before release. Returns exact bytes as an
  octet-stream attachment with no-store, nosniff and sandbox headers. UUID filename
  only; no token or private storage path in URLs/responses.

Upload errors: 400 malformed/empty/multiple parts, 413 size limit, 415 unsupported
or invalid image, 429 concurrent upload busy, 503 local storage/database unavailable.
Missing/substituted evidence IDs return generic 403 after case authorization.
There are no evidence replacement/deletion endpoints. Duplicate uploads receive
new source IDs without overwriting earlier originals. PDFs/SVGs and remote URLs
are not accepted. T04 does not alter originals or claim authenticity; OCR is
implemented separately in T05 below and remains unverified.

## Implemented T05 extraction routes

- `POST /cases/:caseId/extractions` (owner or granted analyst): JSON
  `{evidenceId}`. Runs local Tesseract synchronously on verified original bytes via
  stdin. Returns 201 with run ID, engine/version, status, safe error code, protected
  OCR text, word regions, normalized boxes, text spans and
  `verificationStatus: UNVERIFIED`. Repeats for the same evidence/engine/version
  return the same persisted run. Concurrent OCR returns `RUNNING` with no content.
- `GET /cases/:caseId/extractions/:evidenceId`: returns the latest authorized run,
  or `PENDING` if not run. Unreadable text has no amount regions and reports
  `amountStatus: UNKNOWN`. Missing Tesseract records `FAILED / OCR_UNAVAILABLE`.
- `GET /cases/:caseId/extractions/:evidenceId/regions/:regionId/crop`: returns a
  PNG crop derived from the exact SHA-256-verified original and persisted bounded
  box. Current case access is rechecked before crop bytes are returned.

Regions are `TEXT` or deterministic `AMOUNT` candidates that require a recognized
currency token. They are observations in uploaded synthetic files, not claims,
bank records or independently verified values. Defaults are English, 8 seconds,
512 KiB TSV output, 1,000 words, 64 KiB joined text and one OCR subprocess per API
process. Uploaded text and stderr diagnostics are never logged. There is no
PDF/ASR extraction, background queue or correction endpoint.

## Implemented T07 clarification routes

All paths are under `/api/v1`; current case scope is enforced on each request.

- `POST /cases/:caseId/clarifications/refresh`: owner-only, empty JSON; persists
  deterministic questions for payment events and returns history with `isCurrent`.
- `GET /cases/:caseId/clarifications`: owner or currently granted analyst; reads
  questions, protected source snapshots and recorded answers, priority ordered.
- `POST /cases/:caseId/clarifications/:questionId/answer`: owner-only;
  `{status:"ANSWERED",text:"..."}` (1–500 trimmed characters), or `{status:"UNKNOWN"}`
  without text. Returns the recorded question. Answered or superseded questions
  return 409; foreign or malformed question IDs return 403.

Rules compare same-event claims only: missing payment reference, differing parsed
INR amounts, and differing valid explicit ISO timestamps with timezone. Refresh
preserves answered questions and deduplicates identical snapshots. Responses show
claim IDs, values and source kinds for traceability through the T06 claim/source
viewer. Answers store victim-recollection/unverified labels, actor and time;
no claim or verification state changes automatically. Old snapshots remain readable
but cannot accept answers once their source interpretations change.

## Implemented T08 draft exports

All routes require current case ownership or an active explicit analyst READ or
INVESTIGATE grant. They use `/api/v1` and no-store responses.

- `POST /cases/:caseId/exports`: `{draftAcknowledged:true}`; creates a frozen version
  and returns `{id,version,sha256,createdAt}`. Case lock serializes version allocation;
  content and audit commit together. No private storage locator is returned.
- `GET /cases/:caseId/exports`: latest 100 version metadata rows, newest first.
- `GET /cases/:caseId/exports/:exportId/download`: protected HTML attachment with
  nosniff and CSP sandbox headers. Validates snapshot checksum and live case scope.
  Cross-case/malformed/nonexistent IDs return 403; missing/corrupt content returns 503.

The printable DRAFT includes chronology and precision, claim interpretations,
original OCR text/span/box references, revisions, question state/answers/unknowns,
evidence source IDs and ingest SHA-256 manifest. Current rule gaps not yet persisted
by T07 refresh are included as OPEN. Strings are escaped; user URLs remain text.
Output is limited to 2 MiB and 1,000 rows per queried section (413 on excess). Each
version remains frozen across later corrections. Browser Print / Save as PDF is a
manual local action. Original images are not embedded or reauthenticated by export.
Downloaded copies cannot be revoked from a user's device.

## T10 graph query source status

No investigation REST endpoint is implemented by T10. The candidate installed GSQL
signature is `find_case_links(STRING case_id, INT max_hops, SET<STRING> allowed_case_ids)`
for CaseGraphDemoV1. The extra scope argument is reserved for a trusted backend's
current grant-derived case set. Four-hop paths include source/target case IDs,
VPAs, shared account and four EvidenceRef IDs with synthetic/unverified/review labels.
Other hop bounds or invalid scope return no paths. This is not a substitute for
T11 backend authorization, source dereference checks or actual GSQL compilation.
`graph:verify-live` is an administrative deployment check, not an application route.

## T11 analyst routes (live TigerGraph deployment pending)

All routes require a current synthetic analyst session and INVESTIGATE grants for
both cases of every returned or saved lead. READ alone is insufficient. The backend
derives scope from PostgreSQL; undeclared body fields such as allowed_case_ids are
rejected. Responses are no-store and use standard envelopes.

- `POST /investigations/:caseId/graph-leads`: `{maxHops:4}`; executes fixed installed
  `find_case_links` and `get_lead_sources`, validates the returned path and four source
  records (case, relation and exact from/to binding), then commits source snapshots
  and metadata-only audit entries. Returns `{status:"QUERY_EXECUTED",leads:[...]}`.
  Empty results are distinct from unavailable queries (503). Graph disabled by default.
- `GET /investigations/:caseId/graph-leads`: latest 100 saved snapshots still permitted
  under current grants. A revoked/expired target case hides its whole path.
- `GET /graph-leads/:leadId/sources/:sourceId`: validates organization, both case grants
  and exact source membership before returning a saved source snapshot. Source IDs
  are URL-encoded fx: fixture identifiers, not file IDs or arbitrary URLs.
- `PATCH /graph-leads/:leadId/review`: `{status:"REVIEWED"}` or
  `{status:"NOT_RELEVANT"}`; locks/rechecks both cases and records reviewer metadata
  in audit. This changes human lead-review status only, not source verification.

Leads start NEEDS_REVIEW and include origin TIGERGRAPH_QUERY_SNAPSHOT, creation time,
synthetic classification, path and four source references. Snapshot reads are not
presented as new query executions. Missing/invalid credentials, malformed or oversize
responses and unavailable queries fail closed. No browser token or arbitrary GSQL is
accepted. Query scope capped at 20 cases, result at 20 paths/80 sources, body at
128 KiB and both outbound calls share a 12-second deadline. Live demonstration of
these routes still awaits the compatible TigerGraph installation and query compilation.
