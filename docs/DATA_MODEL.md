# Data Contracts — PostgreSQL and TigerGraph

## PostgreSQL is the canonical source of truth
All primary keys use UUID or stable opaque strings, with explicit created/updated timestamps. Version corrections; never overwrite original evidence.

| Table | Required columns / constraints |
|---|---|
| `users` | `id`, `role`, `organization_id?`, `demo_subject`; role enum victim/analyst/admin |
| `organizations` | `id`, `name`, `kind` |
| `cases` | `id`, `owner_id`, `organization_id?`, `status`, `category`, `created_at`, `updated_at` |
| `case_access_grants` | `case_id`, `organization_id`, `scope`, `granted_by`, `revoked_at?`, `expires_at?` |
| `evidence_files` | `id`, `case_id`, `object_key`, `sha256`, `mime_type`, `size_bytes`, `created_at`, `uploader_id` |
| `extraction_runs` | `id`, `evidence_file_id`, `engine`, `version`, `status`, `created_at`, `error_code?`, `output_text?` |
| `extraction_regions` | `id`, `run_id`, `kind`, `text`, `text_span`, `bbox_json`, `confidence` |
| `claims` | `id`, `case_id`, `type`, `raw_value`, `normalized_value_json?`, `source_kind`, `verification_status`, `created_at` |
| `claim_sources` | `claim_id`, `evidence_file_id`, `page?`, `text_span?`, `bbox_json?`, `audio_offset_ms?` |
| `claim_revisions` | `id`, `claim_id`, `before_json`, `after_json`, `changed_by`, `changed_at`, `reason?` |
| `timeline_events` | `id`, `case_id`, `event_type`, `occurred_at?`, `precision`, `uncertainty`, `created_at` |
| `event_claims` | `event_id`, `claim_id`, composite unique |
| `clarifications` | `id`, `case_id`, `kind`, `prompt`, `answer_json?`, `status`, `priority`, `created_at` |
| `graph_leads` | `id`, `case_id`, `organization_id`, `path_json`, `review_status`, `created_at` |
| `exports` | `id`, `case_id`, `version`, `object_key`, `created_by`, `created_at` |
| `audit_events` | `id`, `actor_id`, `action`, `resource_type`, `resource_id`, `request_id`, `created_at` |

## Claim model
```ts
type SourceKind =
  | 'OBSERVED_IN_UPLOAD'
  | 'VICTIM_RECOLLECTION'
  | 'SYSTEM_INFERENCE'
  | 'AUTHORIZED_EXTERNAL_RECORD';

type VerificationStatus =
  | 'UNVERIFIED'
  | 'USER_CONFIRMED'
  | 'EXTERNALLY_VERIFIED'
  | 'DISPUTED'
  | 'NEEDS_REVIEW';
```
Only set `AUTHORIZED_EXTERNAL_RECORD` / `EXTERNALLY_VERIFIED` after actual external verification **with its source**. Demo synthetic records should be visibly labeled and never shown as genuine bank confirmations.

## TigerGraph schema — P0
- Vertices: `CaseReport`, `UPI_VPA`, `BankAccount`, `PhoneNumber`, `SocialHandle`, `PhishingDomain`, `EvidenceRef`.
- Edges: `CASE_REPORTED_VPA`, `CASE_REPORTED_PHONE`, `CASE_REPORTED_HANDLE`, `CASE_REPORTED_DOMAIN`, `VPA_SETTLED_TO_ACCOUNT`, `RELATION_SUPPORTED_BY_EVIDENCE`.
- Edges carry source references, synthetic/authorized-data status, review status and timestamp where available.
- Use graph-side opaque IDs; never put private full statements or bank credentials into graph nodes.
- GSQL query: `find_case_links(case_id, max_hops)`, parameterized and bounded; confirm actual syntax against server version.

## Synthetic seeds
At least 20 fictional cases, containing:
- Kochi and Bengaluru cases with **different front identifiers** but common synthetic layer-2 account.
- One Goa case unrelated to that account.
- Two unrelated cases with generic text similarity or shared hosting; should **not** imply a common perpetrator.
- Conflicting dates, cropped transaction reference, blurred OCR digits.
- Valid and unauthorized share-grant examples.

## Required indexes and invariants
Index `cases.owner_id`, `evidence_files.case_id`, `claims.case_id`, `claim_sources.claim_id`, `case_access_grants(case_id, organization_id)`, and `audit_events.created_at`; add foreign keys and uniqueness on keys. Apply authorization to every evidence file and every graph-source dereference. Generate Drizzle migrations; don't assume migration exists until Codex creates and tests it.

## Implemented PostgreSQL schema — T02

The canonical typed schema is `apps/api/src/db/schema.ts`. The generated initial
migration is `apps/api/drizzle/0000_bootstrap.sql`, with Drizzle snapshot/journal
metadata alongside it. All 15 tables above now exist after `npm run db:migrate`.
Use `npm run db:generate` for future changes and review generated SQL before applying.

Naming follows this document: `owner_id`, `extraction_runs`, `size_bytes`, and
`normalized_value_json`. Core organization/user/case rows include `synthetic`;
users have display labels and cases have synthetic titles. `claim_sources` and
`event_claims` additionally include `case_id` with composite foreign keys so a
claim cannot reference another case's artifact/event. Recollection claims can
exist without an uploaded-artifact source row.

Role, case state, source kind, verification, processing, review, sharing scope and
clarification state are PostgreSQL enums. Hash format, positive evidence size,
page/audio offsets, export version, incident date order, and expected unique keys
have database constraints. Timestamp columns are timezone-aware. New claims default
to `UNVERIFIED`. At T02, these constraints did not implement file immutability,
JSON-region validation, per-case authorization or independent verification.
T04 implements application-level original preservation and access; T05 adds bounded
OCR-region JSON checks and protected extraction access as described below.

`data/synthetic/bootstrap.json` defines 1 fictional organization, 3 demo identities,
20 empty cases and active/revoked/expired sharing examples. Seeding uses fixed UUIDs
and insert-only conflicts inside a transaction, preserving existing edits and
revocations. It does not manufacture evidence or TigerGraph relationships.
`npm run db:verify` proves migration/seed repeatability and database constraints in
an isolated temporary database, which it removes on completion.

## T04 metadata use

Existing evidence_files fields now record source UUID, case, private UUID object key,
streamed SHA-256, validated MIME, byte size, uploader, ingestion success and created
time. Source filenames are not persisted. Public manifests omit private keys and
uploader identity. Upload/read audit events contain identifiers/actions only.
No new schema or automatic verification status is introduced.

## T05 extraction metadata

`extraction_runs` stores engine (`tesseract`), detected executable version,
processing status, bounded safe error code and protected OCR output text. A unique
evidence/engine/version key makes retries idempotent. `extraction_regions` stores
one OCR word or a deterministic currency-prefixed amount candidate, its joined
text span, confidence and normalized `{x,y,width,height}` source box in [0,1].
Database checks reject malformed spans and boxes outside the original image.
Region rows reference a run, which references the evidence file. API authorization
also verifies that evidence belongs to the requested case before returning text or
an original-derived crop. OCR values remain unverified observations; T06 claim
creation/corrections are separate.

## T06 claim and timeline constraints

`claim_sources.extraction_region_id` optionally links a claim source to the exact
persisted OCR region. The reference is unique, so promoting the same amount region
again returns the existing claim. The API derives text, span, box, evidence and
case linkage from the successful OCR run; clients cannot supply replacement source
content. Recollections need no upload source row. Every created claim defaults to
`UNVERIFIED`.

`claim_revisions` stores before/after interpreted values, actor, time and optional
reason. Corrections do not rewrite source references or verification state.
Timeline event checks restrict event type and precision, require nonempty
uncertainty, require timestamps for exact/approximate/date-only precision, require
UTC midnight for date-only and require a null timestamp for unknown precision.
`event_claims` composite keys enforce that each linked support claim belongs to the
same case. These database constraints complement, but do not replace, per-request
case authorization.
