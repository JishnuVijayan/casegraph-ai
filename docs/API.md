# REST API Contract (Proposed, Not Implemented)

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
| GET | `/cases/:id/claims` | authorized | claims plus source refs and status |
| PATCH | `/cases/:id/claims/:claimId` | owner/reviewer | revision added; no source overwrite |
| GET | `/cases/:id/timeline` | authorized | ordered events/conflicts |
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
revocation and expiration. Public health remains process-only; readiness, case
creation, evidence, OCR, export and graph endpoints remain unimplemented.

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
are not accepted. No OCR, automatic verification or authenticity claim is made.
