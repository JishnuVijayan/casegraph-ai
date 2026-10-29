# Architecture Decision Log

Use this to stop AI-driven scope drift. Append new decisions with date, alternatives, reason, consequences and reviewer. Do not silently override the README.

| ID | Decision | Reason | Revisit when |
|---|---|---|---|
| ADR-001 | React/Vite + NestJS + PostgreSQL/Drizzle monorepo | Fits team stack, minimal moving parts | Post-hackathon scale |
| ADR-002 | TigerGraph Community for actual synthetic multi-hop query | Sponsor-native, graph-specific feature | Production/hosted licensing review |
| ADR-003 | Keep all test cases fictional and consent controls explicit | Privacy, safety, no institutional data access | Authorized pilot agreement |
| ADR-004 | Hash originals and preserve typed source links | Auditability, protects against fabricated AI facts | Never remove |
| ADR-005 | Rule-based clarifications first; Jev optional | Free, reliable baseline; no paid dependency | Evidence Jev improves outcomes |
| ADR-006 | Local Tesseract OCR + optional Ollama/Whisper | No paid third-party APIs | Hardware/testing and buyer needs |
| ADR-007 | Phone-call/IVR flow is post-MVP | Carrier/telephony normally costs money, Goa already has 1930 AI | Authorized partner and budget |
| ADR-008 | No claim of automatic FIR, police integration, or court validity | Legal and factual accuracy | Actual approval and legal review |
| ADR-009 | Evidence reconstruction primary, graph analysis secondary workspace | End-to-end demo possible without confidential bank data | Real institutional pilot |
| ADR-010 | Avoid publishing TigerGraph Community performance benchmarks | 2026 license restrictions | Sponsor grants permission/other terms |

## New decision template
```text
### ADR-XXX — <decision> (<YYYY-MM-DD>)
Context:
Alternatives considered:
Decision:
Consequences and tests:
Approved by:
```

### ADR-011 — T00 local workspace bootstrap (2026-10-28)
Context: Initial checkout contained the documentation pack under docs only.
Alternatives considered: generated independent projects with separate locks; npm workspaces.
Decision: Copy the supplied AGENTS.md/README.md to the root, preserve the originals,
and use private npm workspaces with one package-lock. Implement only a static React
landing page and NestJS process liveness. Use loopback binds and a Vite API proxy.
No environment configuration is required until services are introduced; .env.example
therefore contains no credentials. Optional integrations remain unconfigured.
Consequences and tests: Node 22.12+ is required by Vite; available runtime is Node
24.15.0/npm 11.12.1, so Node 22 itself is not tested in T00. No architecture change
or additional service is introduced. Actual checks are recorded in TASKS.md.
Reviewer: Codex implementation under the user's T00 request.

### ADR-012 — T01 local PostgreSQL and private filesystem (2026-10-29)
Context: T01 requires repeatable local database startup and evidence isolation.
Alternatives considered: local MinIO; private local filesystem. PostgreSQL stays in Compose.
Decision: Use the smaller filesystem option with owner-only `.local/evidence`, no
public mount, and Vite filesystem serving restricted to the frontend. Generate
local credentials in ignored `.env` without overwriting existing files. Pin the
observed PostgreSQL image digest and keep the volume on shutdown. Publish on
127.0.0.1:55432 because the tested machine already uses 5432. Bound database
resources to 1 CPU/512 MiB for this small synthetic demo.
Consequences and tests: PostgreSQL 17.11 ran natively on linux/arm64. Functional
persistence and non-disclosure tests are recorded in TASKS.md. No MinIO dependency,
cloud service, database schema, application DB access, or auth route is added.
Per-case access control remains T03/T04; filesystem permissions do not replace it.
Reviewer: implementation under the user's T01 request.

### ADR-013 — T02 local Drizzle schema and insert-only synthetic seed (2026-10-29)
Context: Canonical PostgreSQL tables and repeatable fixtures are required before auth.
Alternatives considered: define only the three seed tables; bootstrap the documented
15-table contract. Use destructive reset/upsert seeds versus insert-only seeds.
Decision: Define all documented tables now, without implementing later endpoints.
Use stable Drizzle ORM 0.45.4/Kit 0.31.11 and node-postgres 8.23.1; avoid prerelease
packages. Generate SQL/snapshots offline and apply through the Drizzle migrator.
Root wrappers load validated local credentials and force localhost, not a cloud URL.
Use deterministic fixture IDs and transactional insert-only seeding so repeated
commands preserve existing edits and revoked grants. Composite FKs keep uploaded
claim sources and timeline links within their case. Database naming follows
DATA_MODEL.md where the README blueprint used alternate names.
Consequences and tests: A separate temporary local database verifies repeatability,
indexes and real constraint failures without resetting working data. Schema is not
authorization or immutable-file enforcement; T03/T04 remain required. Only 20 empty
fictional case placeholders are seeded, with no fake OCR/graph/verified-bank output.
Reviewer: implementation under the user's next-phase request.

### ADR-014 — T03 opt-in fictional sessions and live case scopes (2026-10-29)
Use opaque random, hashed, short-lived in-memory sessions instead of introducing
JWT secrets or external identity services for the local synthetic demo. Default
demo mode OFF and reject production mode; seeded role selection is explicitly
not real identity verification. Validate DTOs with class-validator/transformer.
Global session/role guards deny private handlers lacking declared roles. Query
current identities and case grants on every request; scope mutations lock/recheck
ownership and write audit events transactionally. Add only case reading and
explicit sharing, leaving creation/uploads to T04. Tests use isolated PostgreSQL
and real HTTP guards; no production identity/security claims are made.

### ADR-015 — T04 streamed immutable originals (2026-10-29)
Use Busboy streaming into exclusive private staging and SHA-256 before any image
processing. Validate PNG/JPEG with signature/MIME and bounded local Sharp decode;
discard decoded pixels and preserve uploaded bytes unchanged. Reject PDFs until a
safe parser is selected. Publish UUID originals via exclusive hard links on the
same filesystem, with mode 0400, then commit metadata/audit transactionally.
On confirmed rollback remove only this upload's files; retain private orphans if
commit status is unknown rather than risk deleting a committed original.
Download only after live authorization and byte/hash verification, as an attachment.
Reuse the canonical evidence schema without a migration. No client-controlled
storage path, source overwrite, OCR, malware-scan or authenticity promise is added.

### ADR-016 — T05 local Tesseract and exact-source regions (2026-10-29)
Run the installed Tesseract binary with `shell:false`, passing only the verified
PNG/JPEG bytes on stdin; store bounded TSV-derived word text, exclusive text spans,
normalized source boxes, engine version and safe status/error in PostgreSQL. Use a
unique evidence/engine/version key for repeatability. Derive requested crops from
the SHA-256-verified original, never from OCR-transformed bytes. Deterministic
currency-prefix detection labels only review candidates; it does not create claims
or verify bank records. This avoids paid endpoints and temporary OCR files, but
Tesseract remains a native unsandboxed subprocess and the initial implementation
supports English only. Keep correction/timeline semantics in T06.

### ADR-017 — T06 source-linked claims and uncertain timeline (2026-10-29)
Promote amount candidates only by persisted OCR-region ID; derive observed text and
coordinates from the stored successful run. Enforce one claim source per region to
make promotion idempotent. Keep corrections as before/after snapshots of interpreted
values without changing provenance or `UNVERIFIED` status. Require every timeline
event to link to same-case supporting claims and retain explicit uncertainty plus
exact, approximate, date-only or unknown time precision. Normalize only deterministic
INR strings to paise using integer arithmetic. Keep writes owner-only and reads
scoped to current case grants. This supports local review without external
verification, paid APIs or presenting inference as fact.

### ADR-018 — T07 deterministic payment questions (2026-10-29)
Compare only claims explicitly linked to the same payment timeline event. Different
payments are not evidence of a contradiction. Generate missing-reference questions,
differing normalized INR amounts, and differing valid explicit zoned ISO timestamps.
Skip ambiguous, date-only and unzoned timestamps. Preserve the supporting claim IDs,
values and source kinds in a protected snapshot; a versioned SHA-256 fingerprint
makes refresh repeatable. Changes to any supporting interpretation create a new
snapshot; prior questions/answers remain visible as superseded. Owners explicitly
refresh questions; GET remains read-only. Answers are immutable through the API,
recorded as unverified victim recollections, and never silently rewrite claims.
Users can separately correct claims through T06. No Jev/model integration or paid
service is needed. Only manually linked payment events are evaluated initially;
missing events, semantic matching and ambiguous amount extraction remain limits.

### ADR-019 — T08 frozen printable HTML exports (2026-10-29)
Use the approved printable HTML path with browser Print / Save as PDF to avoid a
new PDF engine/dependency. Persist escaped HTML and its SHA-256 privately in the
existing PostgreSQL `exports` record. `object_key` is a logical `db-export:<uuid>`
locator, not a filesystem path or public URL. This avoids another private directory
and keeps version metadata/content atomic. Nullable snapshot columns preserve older
records; missing or corrupt content returns unavailable, never a fabricated draft.
Serialize versions with the existing case row lock; authorization uses the same
transaction connection to avoid pool starvation with concurrent exports. All normal
case/claim/question writes already lock this case row. Download rechecks live scope.
Render sourced data with explicit unknowns and frozen correction/question history;
include unrefreshed current rule gaps as OPEN in the snapshot. No generated narrative,
external bank verification or official submission is implied. HTML is capped at 2 MiB
and each queried section at 1,000 rows; exceeding limits rejects the whole export.
Browser preview is sandboxed and downloaded HTML has CSP blocking active content and
network access. Manual print layout and browser Save as PDF remain unverified by E2E.
Reviewer: implementation under the user's T08 request.
