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

### ADR-020 — T09 supported-host prerequisite and honest diagnostics (2026-10-29)
Vendor Docker instructions exclude ARM including Apple Silicon. This task's Docker
reports aarch64; user confirmed no compatible host. Reject unsupported local startup
rather than represent emulation as supported. Prepare a separate pinned Community
Compose template with no published ports, internal network and a named volume; do
not install the software on this host. Add read-only, bounded preflight/health CLI
with distinct host eligibility, service-response and graph-readiness states. Registry
manifest inspection is metadata only; actual installed version remains unknown.
Keep T09 unchecked pending a compatible operator-approved local machine, license
review, credential hardening and actual startup/seed/persistence checks. No paid VM,
remote account, benchmark, fake query, runtime success or sponsor permission is inferred.
Sources and unexecuted host runbook: infra/TIGERGRAPH.md.

### ADR-021 — T10 source preparation with deferred EC2 runtime (2026-10-29)
User plans to deploy only TigerGraph on a future EC2 demo host. Prepare T10 source
on ARM now and defer actual GSQL compile/install/load/query evidence to a compatible
Intel/AMD x86-64 Linux host. No AWS resources, credentials, charges or connections
are created by this task. EC2 is a future hosting-cost exception to local-only setup,
not a paid API dependency; budget, license/demo use and deployment security require
review when provisioning. T09 and T10 remain unchecked pending live evidence.

Use a dedicated CaseGraphDemoV1 with 20 bootstrap case IDs and opaque fx: identifiers.
Authored graph relations are SYNTHETIC_FIXTURE / SYSTEM_INFERENCE / UNVERIFIED /
NEEDS_REVIEW; no upload or externally verified ledger is invented. Four-hop query
follows case/VPA/account/VPA/case, requiring both cases and edge provenance to match
trusted allowed scope. Restrict max_hops to exactly 4 and scope size to 20 for this
MVP; reject other bounds. Hosting/text look-alikes are not financial-path signals.

Generate deterministic private CSV/GSQL bundles, refusing differing existing files.
Schema/load-job creation is one-time on an empty dedicated instance; seeding uses
stable IDs without DROP. Repeatability on TigerGraph remains unverified. A separate
administrative inventory query and bounded token-authenticated live verifier will
check counts, real paths, provenance and negatives on that host. Offline reference
logic exists only in tests, never as an application fallback. T11 owns authoritative
PostgreSQL grant-derived scope, backend endpoints and analyst UI.

### ADR-022 — T11 grant-derived investigation and labeled snapshots (2026-10-29)
Implement analyst app code while the user defers TigerGraph runtime to a future EC2
host. Keep T09/T10/T11 live acceptance pending. Execute fixed installed queries only,
disabled by default, using a separate private application token and loopback/tunnel
port. PostgreSQL supplies current INVESTIGATE scope (maximum 20 cases); never accept
scope from request bodies. Validate every path and retrieve/bind its four source
records by case, relation and exact edge endpoints before saving NEEDS_REVIEW leads.

Use existing graph_leads JSON for immutable path/source snapshots, current lead
review status and audit metadata; no new database or PostgreSQL migration. Recheck
all implicated cases on list/drilldown/review, including revoked targets. Persist
under stable case locks, rechecking grants inside transaction and before release.
Snapshot reads remain available to permitted analysts when graph is offline, clearly
labeled with capture time; new query actions return 503 without graph, never fixtures.

Extend the still-uninstalled graph schema/fixture with source from_id/to_id and a
fixed get_lead_sources query so source references cannot be attached to different
path endpoints. Extend the future live verifier accordingly. Tests inject graph
responses only into isolated test modules; application runtime has no fixture mode.
Offline test success does not establish GSQL correctness or a demonstrated live lead.

### ADR-023 — T12 real browser isolation and required-live mode (2026-10-29)
Use pinned free Playwright with installed Chrome, real NestJS/Vite, PostgreSQL and
Tesseract for a reproducible reporting workflow. A test-only bootstrap replaces
configuration/DB/storage providers, not application controllers, guards, OCR or graph
results. Fixed separate loopback ports refuse existing listeners; every run owns a
unique migrated/seeded temporary database and private synthetic files. Never reset
working data or add an E2E control endpoint to production code.

Keep default graph-unavailable and explicit required-live modes separate. No network
interception or mock graph provider exists in browser E2E. The future live mode
requires private app credentials, actual installed queries, source drilldown/review
and revoked target-path denial; missing prerequisites fail nonzero without skip.
Leave T12 unchecked until that live run succeeds. The local graph-disabled run can
prove only reporting/OCR/export and honest unavailability. No EC2 or paid API work.
Disable trace/video/screenshots; keep any error context in ignored private test
artifacts. Controlled OCR fixture uses clear uniform text after an initial mixed-size
layout produced honest UNKNOWN. This is not OCR accuracy evaluation or a benchmark.

## 2026-10-29 — Savanna data-plane integration

User explicitly selected an existing Savanna graph, superseding the Community-only local deployment preference for this demo connection. No resources or costs were introduced here. Restrict public origins to HTTPS *.i.tgcloud.io, retain loopback, and read either bearer token or GSQL-Secret from the existing private backend credential file. Do not use control-plane API keys or automatic secret exchange. Upstream HTTP credential rejection is 502, separate from end-user session failure and generic unavailable 503. The handoff's successful runtime observations are attributed to the user; exact local source compilation and public app/live scope tests remain pending. Preserve existing graph and bundle. See tigergraph-savanna-integration.md.
