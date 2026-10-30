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

### ADR-024 — Hackathon demo UI drops pre-intake safety friction (2026-10-29)
Context: The local HHGOA prototype is not launching to real victims; acknowledgment
checkboxes and the amber 1930 banner added friction without serving a production user.
Alternatives considered: keep 1930 banner + checkboxes; keep one-line footer guidance only.
Decision: Restyle the web app as a bold complaint-filing demo. Remove the 1930 amber
banner, synthetic/draft acknowledgment checkboxes, and long disclaimer paragraphs.
Show a persistent `Hackathon demo · synthetic data` badge. The client still auto-sends
`syntheticAcknowledged: true` and `draftAcknowledged: true` so NestJS DTO validation is
unchanged. Timeline claim-selection checkboxes remain. Export HTML guidance in
`apps/api/src/exports/render.ts` is unchanged for this pass.
Consequences and tests: Softens AGENTS.md “show 1930 before intake” for the hackathon
UI only. Revisit before any real-user or institutional pilot. Update App/Demo/Evidence
unit tests and Playwright selectors accordingly.
Approved by: User request for demo UI cleanup on develop.

### ADR-025 — Split victim filing and officer report UIs with auto-grant (2026-10-29)
Context: Product intent is a victim complaint-filing surface and a separate officer
inbox/report that can later include TigerGraph similar-case findings. Manual share UI
and Case-ID tooling cluttered the victim flow.
Alternatives considered: keep shared DemoWorkspace with role toggles; require explicit
victim share before officer visibility.
Decision: Routes `/` (victim filing) and `/officer` (officer inbox + case report).
Victim keeps evidence→OCR→claims→timeline→questions→export without share/Case-ID/analyst
controls. On case create, backend auto-grants the demo consortium `INVESTIGATE` and
audits `CASE_AUTO_SHARED`. Officer report reuses read-only panels plus draft export and
similar-case search (honest unavailable without TigerGraph). Explicit share/revoke APIs
remain for tests and future use.
Consequences and tests: Newly created cases appear in the officer inbox immediately.
Seeded grants unchanged. Auth integration asserts auto-grant; Playwright uses `/officer`
and API grant/revoke where UI share controls were removed. Revisit auto-grant before any
real multi-tenant pilot.
Approved by: User choices B (keep filing flow) and A (auto-grant) for the split-UI plan.

### ADR-026 — User-authorized AWS demo within $20 / ap-south-1 (2026-10-29)
Context: HHGOA demo needs live TigerGraph, stronger OCR, and LLM-assisted essentials
questions within ~24 hours. Local-only zero-paid-API rules blocked EC2 Textract/Bedrock.
Alternatives considered: stay fully local; host entire stack on AWS; include voice/Jev.
Decision: Keep API/web/Postgres local. Authorize short-lived EC2 (x86 TigerGraph),
Textract OCR (Tesseract fallback), and Bedrock structured assist gated by deterministic
essentials rules. Region `ap-south-1`, hard budget **$20**, stop EC2 when idle. Skip Jev,
voice, and public app hosting for this cut. Feature flags default OFF. Expand synthetic
bootstrap to **50** fictional cases with clusters A/B/C and officer INVESTIGATE grants for
older cases (auth fixtures for revoked/expired/never-shared retained on cases 02–05).
TigerGraph investigation scope remains capped at 20 case IDs per query (ADR-022).
Consequences and tests: Document runbook in docs/AWS_DEMO.md; never commit AWS keys;
honest unavailable states remain. Revisit cost and data residency before any pilot.
Approved by: User (24h core AWS scope, $20 cap, ap-south-1).

### ADR-027 — Victim name+mobile intake and submit package (2026-10-29)
Context: Fixture “Fictional Victim A/B” and multi-draft case lists confused the demo
complaint journey. Product intent is one linear filing flow ending in a reviewable case file.
Alternatives considered: keep demoSubject picker; true OTP auth; submit = export only.
Decision: `POST /auth/intake` accepts display name + 10-digit Indian mobile under DEMO_MODE,
upserts synthetic `intake:{mobile}` victims, and issues the existing bearer session (not KYC/OTP).
Victim UI is a wizard without case lists. `POST /cases/:id/submit` requires evidence, answered
or UNKNOWN essentials, sets `REVIEW_REQUIRED`, creates the draft export, and captures TigerGraph
similar-case leads when available (honest UNAVAILABLE otherwise). Officer `/officer` unchanged
aside from receiving auto-granted submitted cases.
Consequences and tests: Seeded demo subjects remain for officer and regression fixtures. Update
web/e2e selectors; auth tests cover intake upsert. Revisit before any real-user pilot.
Approved by: User request for simple complaint filing on the AWS demo branch.

### ADR-028 — Victim auto-prepare; hide investigator tools (2026-10-30)
Context: Victims were shown claim types, OCR buttons, timeline builders, and
“save recollection” controls that belong in an officer workspace. Normal
customers cannot be expected to assemble claims manually.
Alternatives considered: keep review step with softer labels; confirm OCR
amounts before promoting; generative “AI invents whole case file.”
Decision: Victim wizard is intake → details/uploads → questions → submit.
`POST /cases/:id/prepare` (OWNER) runs OCR as needed, promotes AMOUNT regions to
`payment_amount` claims (`OBSERVED_IN_UPLOAD`), adds a statement recollection from
the complaint title when missing, ensures one `payment` timeline event with links,
and refreshes clarifications. Victim Evidence/Questions UIs stay plain-language.
Officer `/officer` retains full Review/Evidence tooling. Reconstruction remains
deterministic OCR + rules (Bedrock may polish question wording only); never bank
verification or invented graph paths.
Consequences and tests: prepare + web/e2e cover the simplified path; officer e2e
still opens claims/timeline. Revisit before any real-user pilot.
Approved by: User request to rework complaint filing for normal customers.

### ADR-029 — Victim/officer complaint UX (2026-10-30)
Context: UI still said “synthetic,” victims had a manual Upload button, prepare
re-asked known OCR details, and the officer inbox flooded with seeded DRAFTs
instead of a reviewable complaint package.
Alternatives considered: paid PDF services; keep Synthetic title prefix; show all
grants in inbox; invent graph paths when TigerGraph is down.
Decision: Strip “synthetic” from user-visible copy/titles while keeping
`synthetic: true` and seed fixtures. Victim multi-select auto-uploads with
preview + `DELETE` evidence (OWNER, DRAFT only). Prepare also parses OCR/summary
heuristics for amount/reference/time recollections and skips the questions step
when `openQuestions === 0`. Analyst `GET /cases` returns `REVIEW_REQUIRED` only.
Officer opens a single report (screenshots, facts, answers, saved leads, HTML
draft + browser Print/Save as PDF); advanced tools stay collapsed. Open-by-
reference remains for live fixture cases outside the submitted inbox.
Consequences and tests: web/API/e2e + DEMO updated; no Puppeteer/paid PDF.
Approved by: User plan “Victim officer UX fix.”

### ADR-030 — Textract, Bedrock and TigerGraph are core services (2026-10-30)
Context: ADR-026 and the docs treated Textract, Bedrock and TigerGraph as optional,
default-off demo extras. The product depends on them: Textract for OCR quality, the
LLM for plain-language questions and fact extraction, TigerGraph for similar-case leads.
Alternatives considered: keep opt-in flags; remove the fallbacks entirely.
Decision: `TEXTRACT_ENABLED`, `BEDROCK_ENABLED` and `TIGERGRAPH_ENABLED` default to
true (unset means on; `false` is the explicit opt-out for tests and offline work).
`apps/api` runs a startup preflight (AWS credentials, TigerGraph tunnel) and exits
if a core service is down unless `ALLOW_DEGRADED=true`. Per-request fallbacks stay:
Tesseract if Textract fails, deterministic wording if Bedrock fails, and an honest
"unavailable" for graph leads. Graph paths are never invented. Jest and e2e set the
flags to `false` explicitly. ADR-026's $20 / `ap-south-1` cap and stop-EC2-when-idle
rule still apply and matter more with three paid services in the main path.
Consequences and tests: unit suites pass offline; running the API without AWS
credentials or the tunnel now fails fast.
Approved by: User instruction that these services are core.

### ADR-033 — v2 case network: new graph `CaseGraphV2` (2026-10-30)
Context: v2 needs "which earlier complaints share a phone, UPI ID, account, site or handle with this one". The v1 graph (`CaseGraphDemoV1`) is a fixed 200-case fixture with typed vertex/edge families and a path query; its live schema is installed on EC2 and extending it needs schema-change jobs on a server we cannot inspect offline.
Alternatives considered: extend v1 with generic Entity/MENTIONS; add the v2 types to v1 via a schema change job.
Decision: a separate graph `CaseGraphV2` (vertex `Complaint` since `Case` is reserved in GSQL, vertex `Entity` with id `kind:normalized_value`, undirected edge `MENTIONS`) and query `similar_cases(case_id, max_results)` ranking other complaints by shared entities. STRONG kinds: phone, upi, bank_account, url, email, social_handle, ifsc. WEAK kinds: app_name, person_name; a shared category only adds a small bonus and a category-only match is never returned. Values are normalized in the API before upsert (phone last 10 digits, UPI/email lowercase, URL host lowercase without `www.`, account digits only, IFSC upper case, very common public sites ignored). Postgres stays the source of truth; the API upserts a complaint on submit (RESTPP) and graph:sync re-pushes every submitted case. Results are saved in `graph_leads.path_json` as `{version:2, kind:'SIMILAR_SNAPSHOT'|'SIMILAR_REVIEW'}` rows (no migration; v1 lead listing ignores them). If the graph is down the status is UNAVAILABLE; nothing is invented. The v1 graph and its queries are untouched.
Consequences and tests: the app token must be valid for `CaseGraphV2` (TigerGraph secrets are per graph); `npm run graph:install-v2` installs schema and query on EC2. Offline: normalization, scoring, upsert body, UNAVAILABLE path, officer access and the GSQL text are tested. Live compile and query results are recorded in `docs/V2_CONTRACT.md` Graph notes.
Approved by: Graph/officer task brief.

### ADR-032 — v2 production rebuild: AI-led complaint intake (2026-10-30)
Context: the v1 prototype was shaped around a staged demo: synthetic-only wording, a manual
claims/clarifications workflow with jargon, Tesseract-first OCR, and an officer view built on
a fixed fixture graph. The product goal is a real complaint system: people tell their story by
voice, text, screenshots and documents; AI builds the timeline and asks for missing details;
the complainant downloads their own report; on submit TigerGraph finds similar earlier cases
for the officer.
Alternatives considered: keep the staged wizard and polish copy; microservice split for AI;
Wispr Flow for voice (enterprise-only API key via sales, so not usable now).
Decision: Add an AI intake pipeline (Textract + Bedrock Nova multimodal, schema-validated,
prompt-injection safe), a Brief API (timeline, facts, entities, questions, completeness),
plain-language vocabulary and categories (`docs/V2_CONTRACT.md`), owner-only report download,
officer inbox/case file/dossier, and a new victim and officer UI. Voice uses browser speech
recognition behind `apps/web/src/voice/`. Old v1 task items T09–T11 are replaced by V03/V07.
Consequences and tests: see `docs/TASKS.md` Phase 4. Identity is still name + mobile and the
officer sign-in is a pre-provisioned account; SMS/OTP and officer SSO are required before a
public launch (V10).
Approved by: User request to make the system production-ready.

### ADR-034 — Voice typing through Sarvam AI (2026-10-30)
Context: ADR-032 used browser dictation because Wispr Flow's API is enterprise-only. Browser dictation is weak for Indian languages and mixed-language speech, and unsupported in some browsers.
Alternatives considered: Wispr Flow (no self-serve key); Amazon Transcribe (needs S3 or a streaming proxy, weaker Indic coverage); keep browser dictation only.
Decision: Add `POST /voice/transcribe` and `GET /voice/status`. The API holds `SARVAM_API_KEY` and forwards short audio clips to Sarvam `saaras:v4`; the browser records about 7-second clips and shows text as each clip returns. No key, no support or any failure falls back to browser dictation with a plain message. The key is read from the environment or the git-ignored `.env` (loaded at startup; real environment variables win).
Consequences and tests: text appears a few seconds after speaking, not word by word. Audio is sent to Sarvam and is not stored by us. Unit tests cover request shape, error handling and provider choice; a real Sarvam call and microphone capture were not exercised because no key was available when this was built.
Approved by: User request to use Sarvam instead of Wispr.

### ADR-035 — Public HTTPS demo on a second EC2 + DuckDNS (2026-10-30)
Context: ADR-026 kept Nest/React/Postgres on the laptop and only put TigerGraph on EC2. The team now needs a shareable HTTPS link with free DNS and one-command stop/start for billing under the $20 cap.
Alternatives considered: ngrok/Cloudflare Tunnel from a laptop; PaaS (Railway/Render); put the app on the existing TigerGraph t3.xlarge; paid custom domain + Elastic IP.
Decision: Add a second short-lived `t3.medium` app EC2 in `ap-south-1` (Caddy HTTPS, static web, Nest on 127.0.0.1:3000, Postgres Docker on loopback). Free DuckDNS hostname with IP refresh on start (no Elastic IP). TigerGraph stays on its EC2; the app uses an SSH tunnel to localhost:14240 — **no public 14240 rule**. Security groups: app 80/443 world, SSH operator `/32` only (refreshed on start); TG SSH operator `/32` + app SG. App source is cloned from `https://github.com/JishnuVijayan/casegraph-ai.git` using a gitignored `.local/github.token`. `PUBLIC_ORIGIN` exact-match allowlists demo auth; `DEMO_MODE` may run with `NODE_ENV=production` only when that origin is set. One-command `npm run aws:demo:start|stop` controls both instances. AWS/Textract/Bedrock/TG credentials never ship to the browser.
Consequences and tests: origin unit tests; operators must create DuckDNS + tokens before bootstrap; two EC2s burn budget faster — stop when idle. Synthetic demo only.
Approved by: User request for public HTTPS + free domain + secured one-command stop/start.
