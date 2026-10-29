# Architecture and Responsibility Boundaries

## One-repository deployment
```text
React SPA (no access to DB or graph credentials)
    | HTTPS or localhost API
NestJS API
    |-- Auth + CaseScopeGuard + OrganizationScopeGuard
    |-- Case / Evidence / Claims / Timeline / Clarifications
    |-- ExtractionService -> Tesseract; optional local model adapter
    |-- ExportService -> reviewable PDF + hash manifest
    |-- GraphService -> authorized TigerGraph query
    |-- AuditService -> redacted operation log
    |-- PostgreSQL (source of truth)
    |-- Local private evidence directory (or private MinIO)
TigerGraph Community (synthetic, scoped graph projection)
```

## Event flow
1. `POST /api/v1/cases` creates victim-owned draft.
2. `POST /api/v1/cases/:id/evidence` streams bounded file, computes SHA-256 **before transformations**, stores original, inserts evidence metadata and audit event.
3. `POST /api/v1/cases/:caseId/extractions` runs bounded local Tesseract on SHA-256-verified original bytes via stdin and stores OCR runs plus exact source regions. T05 does not create claims; T06 handles claim/timeline review separately.
4. API computes missing-field/conflict rules; optional model/decision adapter can propose a question. Data is never declared true by model output alone.
5. Victim confirms/corrects without changing original source data. Timeline events link to source claims.

T06 implements this review path for stored OCR amount regions, victim recollections,
non-destructive claim corrections and manually created, uncertainty-labeled timeline
events. Claim and event data stay case-scoped; this does not provide external
verification or generate investigative conclusions.
6. Exports include verified status distinctions, chronology, remaining unknowns and hash manifest.
7. Victim explicitly grants an organization access. Analyst permissions are checked before **and after** graph queries.
8. Graph projection uses minimal pseudonymized case/indicator nodes; no unrestricted raw screenshots, personal chat text or secrets in graph.

## Backend module contracts
- **AuthModule:** seed-demo identities only; future real auth separate. Never trust user IDs from request bodies.
- **CasesModule:** owns case state and ownership.
- **EvidenceModule:** validates files, stores immutable source, authorizes downloads, hashes.
- **Claims/Timeline:** facts, source attribution, uncertainty and revisions.
- **ClarificationModule:** deterministic checks, optional classification for question order.
- **GraphModule:** whitelist installed queries and bound params; no arbitrary GSQL from client.
- **ExportsModule:** creates a labeled draft, audit entry and limited access retrieval.
- **AuditModule:** actor/action/time/resource, excludes sensitive payloads.

## Failure behavior
| Failure | Expected response |
|---|---|
| OCR cannot read receipt | Mark unreadable; request better copy; preserve original |
| Speech ASR unavailable | Accept typed recollection or uploaded audio for later review |
| Local LLM unavailable | Continue deterministic rules + manual review |
| TigerGraph unavailable | Display `Investigation unavailable`; do not show cached path as live |
| Permission denied | 403 and no sensitive existence/identity leakage |
| Conflict unresolved | Export with explicit uncertainty, never secretly decide |
| Uploaded malicious prompt | Treat as document text only; never authorize model tool action |

## Design tradeoffs
Do not optimize for unsupported “zero latency.” Correctness, provenance, consent and reproducible demo outcomes take precedence. Use small controlled synthetic data. Graph similarity alone must never claim a common criminal organization.
