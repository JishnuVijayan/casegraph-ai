# CaseGraph AI

**Current implementation: T00 scaffold, T01 local infrastructure, T02 database bootstrap.** React/Vite and NestJS run locally.
See [app setup](#implemented-local-scaffold-t00) and [local infrastructure](#implemented-local-infrastructure-t01) for commands.
The following product blueprint includes future, unimplemented features.

**Evidence-grounded cybercrime reporting, case reconstruction, and authorized graph investigation — built India-first.**

> **Status:** HHGOA 2026 hackathon MVP / product hypothesis, **not** an official government, police, or banking service.
> **Event:** Hacker House Goa, 28–31 October 2026.
> **Primary sponsor technology:** **TigerGraph**. **Jev** is an optional, benchmarked decision-routing component (not a substitute for validation or legal judgment).

## At a glance

A cybercrime victim may have WhatsApp screenshots, payment receipts, suspicious links, call details, and a story they remember out of order. CaseGraph AI helps the victim **organize that material into a reviewable chronology**, shows which source supports each statement, asks for important missing details, and exports an evidence-indexed report. With appropriate permission, a bank fraud analyst or investigator can use **TigerGraph** to explore evidence-backed links among multiple cases.

**The one-line pitch:** *Turn fragmented cybercrime evidence into a traceable, reviewable case — and help authorized analysts discover connections that ordinary case-by-case intake misses.*

### Critical user-safety notice

**If money has just been stolen or an unauthorized transaction is happening, contact the bank immediately and call India's cybercrime helpline `1930`, or use [cybercrime.gov.in](https://cybercrime.gov.in/). Do not wait to finish a CaseGraph report.** CaseGraph must show this instruction **before** a lengthy intake flow.

CaseGraph **does not** independently register an FIR, freeze accounts, guarantee recovery, identify a criminal, or certify evidence as admissible in court. Graph links are **investigative leads**, not accusations or proof of guilt. The MVP works with **entirely synthetic cases and invented payment identifiers**.

---

## 1. Why this problem matters

India recorded **24,02,579 financial cyber-fraud complaints** involving approximately **₹22,495 crore in amounts reported by complainants during calendar year 2025** (Ministry of Home Affairs). These are *reported amounts*, not independently established final losses. Existing official systems already handle reporting and fraud intervention; CaseGraph aims to improve the quality and continuity of information reaching the relevant teams.

Sources:
- [Ministry of Home Affairs — financial cyber-fraud figures by year](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2226441&lang=2&reg=48)
- [MHA — National Cybercrime Response Mechanism, July 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2287674&lang=1&reg=1)
- [National Cyber Crime Reporting Portal: official FAQ](https://cybercrime.gov.in/Webform/FAQ.aspx)

### The precise problem we solve

1. **For victims:** Evidence is disordered, dates and amounts may be misremembered, and important documents may be missing.
2. **For fraud-response staff:** A lengthy, repetitive information-gathering process can produce inconsistent notes that are hard to verify.
3. **For authorized investigators:** Related cases can contain indirect links across identifiers, accounts, domains, and reported patterns; those connections are difficult to inspect case by case.

### What we are *not* claiming

- That nobody has built AI-assisted cybercrime intake. **Hyderabad Police C-Mitra** already assists victims with complaint drafting and missing-information collection.
- That graph-based cybercrime investigation is new. Government platforms, including **Samanvaya**, already support law-enforcement information sharing and case linkage.
- That processing synthetic cases proves improved police investigation outcomes.
- That the existence of fraud losses proves any specific bank is willing to buy CaseGraph.

**Differentiation hypothesis:** *source-level evidence provenance + uncertainty-aware reconstruction + a continuous case record that can be reviewed and connected to an authorized graph investigation.* This is a hypothesis to validate against existing systems, not an established moat.

---

## 2. Users, buyers, and user journeys

| Persona | Need | Product experience | Pays? |
|---|---|---|---|
| Cybercrime victim | Explain an incident without reconstructing everything manually | Evidence upload, voice/text recollection, clarification, editable report, export | **No** for core assistance |
| Elderly or feature-phone user | Access help without an app or typing | **Later:** official bank/partner phone line with supported-language voice intake and human transfer | No |
| Bank fraud-response analyst | Receive coherent reports with traceable details | Review queue, linked sources, missing-field follow-up, optional authorized transaction reconciliation | Institution pays, **if validated** |
| Authorized cybercrime investigator | Explore related case evidence | Permission-scoped TigerGraph search, supporting paths, exportable leads | Institution/license arrangement |
| Fraud support/BPO manager | Reduce case handling effort without lowering quality | Analytics on review time, follow-ups, error rates | Possible first commercial buyer |

### Victim journey (MVP)

1. **Safety first:** See official `1930`/bank guidance for urgent financial fraud.
2. **Start a private draft:** Log in to the demo with a seeded test account. A production identity flow requires separate design and abuse testing.
3. **Add evidence in any order:** Upload screenshots, images, a payment receipt, text, and/or a recording. Chat exports and PDFs can be added once securely parsed.
4. **Review extracted facts:** Inspect amounts, dates, identifiers and messages with exact links to original documents and locations within them.
5. **Resolve uncertainty:** Answer focused follow-up questions. “I don't know” must remain a valid answer.
6. **Confirm a draft:** Correct mistakes while retaining the original extraction and correction history.
7. **Export:** Download a structured complaint **draft** plus evidence index and SHA-256 manifest for review and official reporting.

### Investigator/analyst journey (MVP)

1. Authenticate as a **seeded demo analyst** in a fictional organization.
2. Review a case explicitly shared with that organization.
3. Inspect original artifacts and the evidence underlying each extracted fact, subject to permission.
4. Request graph leads over a **separate synthetic, access-scoped dataset**.
5. Open a multi-hop path; inspect each edge's evidence/source, trust level and limitations.
6. Mark the lead `NEEDS_REVIEW`, `NOT_RELEVANT`, or `REVIEWED` (never “criminal confirmed”).

### Feature-phone / regional-language journey (Phase 2)

A caller using a keypad phone calls an **existing verified bank/authorized partner number**, selects a language using IVR/DTMF, explains the incident verbally, receives urgent official guidance, and can transfer to a human. After consent and appropriate authentication, the call may create a structured draft linked to subsequent bank-verified transactions. **No smartphone, internet, or installed app is required for the caller**—but the telephony and AI provider do require infrastructure and a network connection. **This is not part of the core 4-day MVP unless a telephony sponsor/provider is available.** Goa Police has already announced multilingual AI support for its 1930 channel, so voice reporting alone is not our novelty.

---

## 3. Product scope and priorities

### P0 — the four-day end-to-end MVP

- [ ] Safety-first `1930`/bank/official reporting notice, always accessible.
- [ ] Demo login and role/organization scoping.
- [ ] Case draft creation and controlled evidence upload.
- [ ] SHA-256 original-file hashing and basic audit history.
- [ ] OCR/multimodal extraction of amounts, timestamps, transaction references, handles, phone numbers and statements.
- [ ] Every extracted fact links to its **source artifact and region/text span**.
- [ ] Structured chronological timeline with provenance/uncertainty labels.
- [ ] Deterministic field checks and conflict detection; targeted questions.
- [ ] Victim correction/confirmation without overwriting source facts.
- [ ] Downloadable complaint draft, evidence index, uncertainty notes and hash manifest.
- [ ] **Real TigerGraph GSQL query** identifying multi-hop relationships in labeled synthetic cases.
- [ ] Analyst view that opens both graph edges and underlying evidence references.
- [ ] Test results demonstrating factual/source accuracy, errors and graph false positives.

### P1 — only if P0 is complete

- [ ] Optional **Jev** routing against a rule-based baseline.
- [ ] Malayalam text/audio transcription on representative, permitted test audio (with visible correction).
- [ ] Visually inspect bounding boxes for OCR-extracted facts.
- [ ] PDF bank-statement and WhatsApp-export parsing with safety limits.
- [ ] Graph/semantic similarity as *low-trust leads* in addition to exact authorized links.
- [ ] Section 63 **preparation worksheet** reviewed against the statutory format (not a certificate issued by the app).

### P2 — post-hackathon

- [ ] Partner-operated IVR / phone intake and human transfer.
- [ ] Bank-authorized transaction enrichment and investigator-to-victim clarification workflow.
- [ ] Multi-tenant institutional deployment, consent management, granular retention/deletion policies.
- [ ] Enterprise identity, SSO, audit exports, operational security reviews and legal assessments.
- [ ] Measured pilots with real fraud analysts and approved/anonymized cases.

### Out of scope

Automatic FIR filing, NCRP API integration without authorization, auto account freezing, automatic suspect identification, nationwide police-record lookup, open/public suspect databases, fund recovery guarantees, arbitrary APK forensics, Cake Wallet “view-key” redaction, automatic courtroom-admissible evidence certification, and autonomous Jev decisions affecting legal rights.

---

## 4. Technology stack

| Layer | Choice | Rationale |
|---|---|---|
| Web app | **React + TypeScript + Vite** | Fast frontend development; established team stack |
| UI | Tailwind CSS, shadcn/ui or accessible equivalent | Accessible forms, timelines and evidence viewer |
| Routing / server state | React Router + TanStack Query | Predictable navigation and API caching |
| API | **NestJS + TypeScript (Node.js 22+)** | Modular modules, validation and API security |
| Primary database | **PostgreSQL** | Cases, users, source references, audit records, statuses |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Typed SQL and versioned migrations |
| File storage | **S3-compatible object storage** (MinIO locally) | Keep original binary artifacts separately from DB |
| Integrity | Node.js `crypto` / SHA-256 | Hash *original uploaded bytes* at ingest |
| Extraction | Pluggable OCR + multimodal model adapter | Provider-independent extraction with source coordinates |
| Speech | Pluggable ASR adapter (optional MVP) | Transcript with timestamps and user confirmation |
| Graph | **TigerGraph** + installed GSQL queries over authorized demo data | Explainable multi-hop case links |
| Structured decisions | **Jev**, optional official `@typesafe-ai/sdk` | Benchmark non-final routing vs deterministic rules |
| PDF | Server-side PDF generation library | Reviewable draft, index, metadata and manifest |
| Jobs | In-process dev queue initially; **BullMQ + Redis** if needed | Avoid blocking uploads on OCR/ASR calls |
| Dev ops | Docker Compose, Git, CI, tests | Reproducible local services and demos |
| Monitoring | Structured logs, request IDs, error tracking | Debuggability without leaking raw victim content |

**Deliberate choice:** PostgreSQL is the source of truth for the case and evidence workflow. TigerGraph stores **purpose-selected relationships and authorized graph projections**, not an uncontrolled copy of private victim documents. Graph synchronization must not expand the reader's permissions.

### Sponsor fit

- **TigerGraph — core:** real multi-hop investigation with evidence-linked paths; demonstrate installed queries, not merely a visual network chart.
- **Jev — optional:** classify which non-final clarification action to present **after** deterministic checks. A valid typed answer is not proof of factual correctness; compare with a rules baseline. Jev is an emerging technology here, not a named sponsor in the user's HHGOA partner list.
- **Wispr Flow — optional:** clinician-style dictation analogue for staff notes or compatible intake; don't assume a public embedded speech-to-text API or offline capability.
- **Socket — engineering:** secure npm dependencies/CI; not an arbitrary scam APK scanner.
- **Dodo Payments — defer:** B2B subscription/usage billing only after confirming product eligibility and a buyer; not central to the demo.
- **Cake Wallet — no core fit.**
- **AI Grants India / Edge City:** mentorship, feedback and potential pilot introductions; not core backend dependencies.

**Avoid adding a technology solely to claim a sponsorship prize.**

---

## 5. Architecture

```mermaid
flowchart TB
  V[Victim web client] --> A[NestJS API]
  I[Authorized analyst web client] --> A
  A --> AUTH[Auth + org / case authorization]
  A --> DB[(PostgreSQL)]
  A --> OBJ[(Private object storage)]
  A --> JOB[Extraction job]
  JOB --> OCR[OCR / multimodal / ASR adapters]
  OCR --> FACTS[Evidence claims + provenance + uncertainty]
  FACTS --> DB
  A --> RULES[Deterministic rules / case state]
  RULES --> Q[Clarification queue]
  RULES -. optional benchmark .-> JEV[Jev route suggestion]
  A --> PDF[Draft complaint + evidence index + hash manifest]
  DB --> PROJ[Authorized graph projection]
  PROJ --> TG[(TigerGraph)]
  A --> GQ[Permission-scoped GSQL query]
  GQ --> TG
  TG --> GQ
  GQ --> I
```

### Trust boundaries

1. **Untrusted:** All uploaded artifacts, transcribed speech, OCR results, and graph matches.
2. **App-controlled:** Parsing, normalized fields, generated questions, and source-linking.
3. **Human-confirmed:** Victim-corrected chronology and explicitly approved complaint draft.
4. **Externally verified:** Facts actually confirmed by an authorized bank system, platform, or other legitimate external record; **not available by default in the MVP**.
5. **Investigator decision:** Any escalation, allegation, legal interpretation, or case conclusion requires authorized human judgment.

Never promote `OBSERVED_IN_UPLOAD` to `VERIFIED_EXTERNALLY` merely because an OCR value looks credible or a victim clicks “Confirm.”

### Recommended backend modules

```text
AuthModule
OrganizationsModule
CasesModule
EvidenceModule        // receive, hash, store, audit, retrieve authorized original
ExtractionModule      // OCR / ASR / multimodal adapters
ClaimsModule          // normalized facts, provenance, versions, corrections
TimelineModule        // chronology + uncertainty
ClarificationModule   // deterministic rules, optionally Jev recommendation
GraphModule           // scoped TigerGraph adapter + source-backed path responses
ExportsModule         // editable/reviewable draft + evidence index + PDF
AuditModule           // actor, action, resource, timestamp, request ID
HealthModule          // liveness / readiness
```

### Graph projection and permissions

**Never send raw documents or unrestricted victim details into a shared graph by default.** Graph vertices should use controlled identifiers/pseudonyms, case references, and links to evidence IDs that can only be dereferenced after per-case authorization checks. An analyst must not discover the existence or sensitive details of another organization's private case merely through a graph query.

For the MVP, use exactly **one fictional consortium tenant** and explicit case-sharing grants. Production cross-tenant investigations require independent data-sharing agreements, legal review, authorization and audit controls.

---

## 6. Suggested project layout

```text
casegraph-ai/
├── README.md
├── .gitignore
├── .env.example
├── apps/
│   ├── web/                     # React / Vite frontend
│   │   └── src/
│   │       ├── app/
│   │       ├── pages/
│   │       │   ├── StartReport.tsx
│   │       │   ├── CaseWorkspace.tsx
│   │       │   ├── TimelineReview.tsx
│   │       │   └── AnalystWorkspace.tsx
│   │       ├── components/
│   │       │   ├── EvidenceUploader.tsx
│   │       │   ├── EvidenceViewer.tsx
│   │       │   ├── FactSourcePanel.tsx
│   │       │   ├── ClarificationCard.tsx
│   │       │   └── GraphPathViewer.tsx
│   │       └── lib/api.ts
│   └── api/                     # NestJS server
│       ├── src/
│       │   ├── modules/
│       │   ├── db/
│       │   ├── integrations/
│       │   │   ├── tigergraph/
│       │   │   ├── ocr/
│       │   │   ├── transcription/
│       │   │   └── jev/
│       │   └── main.ts
│       ├── drizzle/
│       └── test/
├── infra/
│   ├── compose.yaml             # Postgres / MinIO; add Redis if required
│   └── tigergraph/
│       ├── schema.gsql
│       ├── queries/
│       └── README.md            # actual instance configuration, secrets omitted
├── data/
│   └── synthetic/               # only fictional screenshots, transcripts, ledgers
├── docs/
│   ├── PRODUCT.md
│   ├── THREAT_MODEL.md
│   ├── API.md
│   ├── DATA_DICTIONARY.md
│   └── EVALUATION.md
└── .github/workflows/ or .gitlab-ci.yml
```

Start with one repository and one NestJS backend. Microservices, Kafka and Kubernetes are unnecessary for this hackathon.

---

## 7. Data model (PostgreSQL)

These are the **recommended tables**, not a claim that migrations already exist.

| Table | Minimum fields | Purpose |
|---|---|---|
| `organizations` | `id`, `name`, `kind`, `created_at` | Tenant boundary |
| `users` | `id`, `organization_id?`, `role`, `display_name`, `auth_subject`, `created_at` | Identity + actor |
| `cases` | `id`, `owner_user_id`, `organization_id?`, `status`, `category`, `incident_start_at?`, `incident_end_at?`, `created_at`, `updated_at` | Case draft |
| `case_access_grants` | `case_id`, `organization_id`, `scope`, `granted_by`, `expires_at`, `revoked_at?` | Controlled sharing |
| `evidence_files` | `id`, `case_id`, `object_key`, `sha256`, `mime_type`, `byte_size`, `upload_time`, `ingest_status`, `uploader_id` | Immutable originals + manifest |
| `evidence_extractions` | `id`, `file_id`, `extractor`, `model_version`, `processing_status`, `created_at` | Processing provenance |
| `claims` | `id`, `case_id`, `claim_type`, `raw_value`, `normalized_value?`, `source_kind`, `verification_status`, `observed_at?`, `created_at` | Candidate facts |
| `claim_sources` | `claim_id`, `evidence_file_id?`, `text_span?`, `bounding_box_json?`, `audio_start_ms?`, `audio_end_ms?` | Trace facts to exact sources |
| `claim_revisions` | `id`, `claim_id`, `old_value`, `new_value`, `changed_by`, `reason`, `changed_at` | Corrections with history |
| `timeline_events` | `id`, `case_id`, `event_type`, `occurred_at?`, `time_precision`, `status`, `notes` | Human-reviewable chronology |
| `event_claims` | `event_id`, `claim_id` | Evidence support for events |
| `clarifications` | `id`, `case_id`, `question_type`, `question`, `state`, `response?`, `created_at` | Missing/contradictory detail loop |
| `graph_leads` | `id`, `case_id`, `tenant_id`, `path_json`, `explanation`, `state`, `reviewed_by?` | Investigative hypotheses |
| `exports` | `id`, `case_id`, `object_key`, `created_by`, `created_at`, `version` | PDF / data export audit |
| `audit_events` | `id`, `actor_id`, `organization_id?`, `action`, `resource_type`, `resource_id`, `created_at`, `request_id` | Accountability |

**Suggested status enums**

```ts
type ClaimSourceKind =
  | 'OBSERVED_IN_UPLOAD'     // text/pixels found in unverified submitted artifact
  | 'VICTIM_RECOLLECTION'    // reported by victim; may be uncertain
  | 'SYSTEM_INFERENCE'      // derived hypothesis, never represented as fact
  | 'AUTHORIZED_EXTERNAL_RECORD'; // only when actually backed by integration

type VerificationStatus =
  | 'UNVERIFIED'
  | 'USER_CONFIRMED'        // user accepts chronology; not external verification
  | 'EXTERNALLY_VERIFIED'
  | 'DISPUTED'
  | 'NEEDS_REVIEW';

type CaseStatus = 'DRAFT' | 'REVIEW_REQUIRED' | 'READY_FOR_EXPORT' | 'EXPORTED';
```

**Important:** Use UUIDs, foreign keys, indexes on `case_id`/`organization_id`, guarded unique constraints, and per-resource authorization. Only record fields you have a valid reason to collect. Avoid storing full financial account numbers in broadly queryable graph vertices.

### Evidence integrity example

```ts
import { createHash } from 'node:crypto';

export function sha256OfBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
```

For larger artifacts, hash a **bounded streamed upload**, not an unrestricted file buffered in server RAM. A hash only establishes post-ingest byte integrity; it does **not** authenticate the screenshot's origin, sender, timestamp or underlying transaction.

An `evidence_file` should be immutable at application level. Any changed user-supplied version is a **new artifact** with a new hash and explicit linkage; do not overwrite originals in place.

---

## 8. TigerGraph investigation design

### What TigerGraph actually does

Query a network of cases and **authorized** financial or technical indicators, returning explainable paths supported by source references.

**Graph node types (MVP):**

- `CaseReport`
- `UPI_VPA`
- `BankAccount` (**only synthetic or truly authorized records**)
- `PhoneNumber` / `SocialHandle`
- `PhishingDomain`
- `EvidenceRef` (points back to a permission-protected record in PostgreSQL)

**Edges (MVP):**

- `CASE_REPORTED_VPA`
- `CASE_REPORTED_PHONE`
- `CASE_REPORTED_HANDLE`
- `CASE_REPORTED_DOMAIN`
- `VPA_SETTLED_TO_ACCOUNT` (**requires synthetic/authorized ledger evidence**)
- `RELATION_SUPPORTED_BY_EVIDENCE`

Every relationship needs attributes such as `source_ref`, `source_type`, `observed_at?`, `scope`, and `confidence_or_review_status`. Avoid edges that silently treat reported suspicions as verified bank transactions.

### Hackathon graph question

> Do **Case Kochi-01** and **Case Bengaluru-04** have a supported indirect financial connection despite reporting different front-end contact identifiers?

Synthetic example:

```text
Case Kochi-01 ─reported→ UPI-A ─authorized test settlement→ Account-X
                                                        ↑
Case Bengaluru-04 ─reported→ UPI-B ─authorized test settlement┘
```

The analyst sees the **path, edge provenance and caveats**. The correct output is *possible linked infrastructure — investigate*, not *same criminal proven*.

### GSQL implementation milestones

1. Obtain a working **TigerGraph 4.2-compatible instance** via TigerGraph's currently supported cloud/self-managed onboarding. **Do not assume the server runs inside the PostgreSQL/MinIO Compose file.**
2. Create vertices, edges, loading jobs and a `CaseGraphDemo` graph.
3. Seed **20 fictional cases**, including true connected paths, benign shared identifiers and unrelated cases.
4. Create and install a parameterized GSQL query such as `find_case_links(case_id, max_hops)`; verify actual syntax for the chosen TigerGraph version. Use a strict hop bound and resource limits.
5. Return typed paths with contributing edge IDs and PostgreSQL source references. Enforce tenant/case access in your NestJS GraphModule **before and after** the query.
6. Render the response, and allow drilling into each permitted source.
7. Measure query latency on the actual environment; distinguish graph-query time from ingestion/AI processing time.

**Do not fake GSQL execution.** Graph UI can be custom, but the discovered path shown in the demo must come from an actual installed graph query. Vector similarity is optional and must remain a **weak lead**, not proof of a shared perpetrator.

Official technical reference: [TigerGraph GSQL installed-query endpoints](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints). Graph RESTPP queries commonly use `/query/{graph_name}/{query_name}`; base URLs, authentication and ports depend on the chosen deployment.

---

## 9. Evidence extraction and clarification pipeline

### Processing sequence

1. Receive and validate upload (size/type/content scanning; reject unsupported types; isolate parsers).
2. Hash and preserve the exact bytes; save object and metadata securely.
3. Run OCR / multimodal extraction using **data-minimized inputs**.
4. Produce strictly validated candidate objects with `source_file_id`, text span or image bounding box, and model version.
5. Normalize date, timezone, amount and identifier fields without changing the original wording.
6. Run deterministic checks; mark extraction ambiguity and conflicting statements.
7. Ask only high-priority clarification questions, including the option “Unknown / I can't remember.”
8. Show corrected source-linked timeline for user review.
9. Export a **draft** plus explicit remaining uncertainties and original-artifact manifest.

### Example extracted claim — illustrative contract

```json
{
  "claimId": "claim_demo_01",
  "field": "payment_amount",
  "rawValue": "₹40,000",
  "normalizedValue": { "currency": "INR", "amountMinor": 4000000 },
  "sourceKind": "OBSERVED_IN_UPLOAD",
  "verificationStatus": "UNVERIFIED",
  "source": {
    "evidenceId": "evidence_demo_receipt_01",
    "page": 1,
    "boundingBox": { "x": 0.43, "y": 0.55, "width": 0.34, "height": 0.08 },
    "coordinateSystem": "relative_0_to_1"
  },
  "needsHumanConfirmation": true
}
```

`amountMinor` uses paise and avoids floating-point money calculations. The screenshot's presence alone is not bank confirmation.

### Deterministic check examples

- Missing transaction references for a *reported* transfer (do **not** block urgent 1930 guidance).
- Amount mismatch between voice recollection and an uploaded image (both remain unverified until reviewed).
- Date/time mismatch after explicit timezone normalization; don't invent missing timezones.
- Inconsistent contact-platform sequence if the timeline sources actually support a contradiction.
- File content, schema and identifiers validated separately from model output.

### Jev — optional routing, not a hallucination firewall

Use deterministic logic first. If a Jev key is available and your team has time, compare it with rule-based routing on the **same labeled scenarios**.

```ts
type NextStep =
  | 'ASK_MISSING_INFO'
  | 'ASK_CLARIFICATION'
  | 'REQUEST_HUMAN_REVIEW'
  | 'PROCEED_TO_DRAFT';
```

Jev takes a **redacted/minimal structured case summary**, not the victim's complete chat history, and recommends a non-final next step. The application still validates the response and applies safety policy. It must fall back safely if Jev is unavailable, uncertain, or disagrees with hard rules.

The **official TypeSafe AI TypeScript SDK** is documented as `@typesafe-ai/sdk` with `TYPESAFE_API_KEY`; check the current provider reference before coding. Never claim a specific 33 ms/50 ms production SLA without end-to-end measurements.

---

## 10. API design (proposed, not yet implemented)

API prefix: `/api/v1`. All protected endpoints must authenticate **and** authorize the case/organization.

| Method | Endpoint | Purpose | Principal |
|---|---|---|---|
| `GET` | `/health/live` | Process is alive | Internal |
| `GET` | `/health/ready` | DB / required dependency readiness | Internal |
| `POST` | `/cases` | Create case draft | Victim |
| `GET` | `/cases/:id` | View authorized case | Owner / granted analyst |
| `POST` | `/cases/:id/evidence` | Upload one bounded evidence file | Owner / authorized worker |
| `GET` | `/cases/:id/evidence` | Evidence metadata listing | Authorized |
| `GET` | `/cases/:id/evidence/:evidenceId/view` | Short-lived controlled artifact access | Authorized |
| `POST` | `/cases/:id/extractions` | Queue extraction for uploaded items | Authorized |
| `GET` | `/cases/:id/claims` | Extracted facts with provenance | Authorized |
| `PATCH` | `/cases/:id/claims/:claimId` | Correct/confirm claim, preserving revision | Owner / authorized reviewer |
| `GET` | `/cases/:id/timeline` | Timeline and unresolved conflicts | Authorized |
| `GET` | `/cases/:id/clarifications` | Pending questions | Owner / reviewer |
| `POST` | `/cases/:id/clarifications/:questionId/answer` | Record response or unknown | Owner |
| `POST` | `/cases/:id/exports` | Generate versioned draft report | Authorized |
| `POST` | `/cases/:id/shares` | Grant time-bound institutional view (MVP demo) | Owner/authorized controller |
| `POST` | `/investigations/:caseId/graph-leads` | Execute scoped graph query | Authorized analyst |
| `PATCH` | `/graph-leads/:id/review` | Record analyst assessment | Authorized analyst |

Use consistent response format:

```json
{
  "data": { "id": "case_demo_01", "status": "DRAFT" },
  "requestId": "req_demo_123"
}
```

For errors return structured problem descriptions and the same request ID. **Do not return file contents, internal prompts, raw stack traces, bank credentials or private graph nodes in errors.**

---

## 11. Local development — bootstrap from this README

This README describes a **project to scaffold**. The example commands and snippets are starting instructions, **not proof that the source files/services already exist**.

### Prerequisites

- Node.js **22+** and npm (the Jev SDK documents Node 20+, but Node 22+ is a reasonable common project baseline).
- Docker + Docker Compose.
- A TigerGraph account or supported development instance (prefer mentor-provided access).
- API credentials for the OCR/multimodal provider **only if used**, stored server-side.
- Optional TypeSafe AI (Jev) key for the benchmark.
- No actual victim data for development; use fictional artifacts.

### Bootstrap React + NestJS

```bash
mkdir casegraph-ai && cd casegraph-ai
mkdir -p apps infra/tigergraph/queries data/synthetic docs

npm create vite@latest apps/web -- --template react-ts
npx @nestjs/cli new apps/api --package-manager npm --skip-git

cd apps/web && npm install && cd ../..
cd apps/api && npm install && cd ../..
```

Then add the app packages you need after choosing implementations (e.g. TanStack Query, Drizzle, validation, PDF, storage). Install TypeSafe's SDK only when optional Jev evaluation is enabled:

```bash
cd apps/api
npm install @typesafe-ai/sdk
```

### Minimal example Compose services

Create `infra/compose.yaml` with this **local-development-only** template:

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: casegraph
      POSTGRES_PASSWORD: local_dev_only_change_me
      POSTGRES_DB: casegraph
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U casegraph -d casegraph"]
      interval: 5s
      retries: 10

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: localdev
      MINIO_ROOT_PASSWORD: localdev_change_this_password
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
    volumes:
      - miniodata:/data

volumes:
  pgdata:
  miniodata:
```

**Production warning:** Pin image digests/versions, use real secrets management and private networking. The example is for local development and should not be deployed to the internet. Create a **private** MinIO bucket (e.g. `casegraph-evidence`) through the local console or provisioning script; never enable anonymous listing or downloads.

Run the services:

```bash
docker compose -f infra/compose.yaml up -d
docker compose -f infra/compose.yaml ps
```

### Environment variables

Create `.env` files **without committing credentials**. Suggested variables:

```dotenv
# apps/api/.env (illustrative local values only)
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://casegraph:local_dev_only_change_me@localhost:5432/casegraph

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=casegraph-evidence
S3_ACCESS_KEY_ID=localdev
S3_SECRET_ACCESS_KEY=localdev_change_this_password
S3_FORCE_PATH_STYLE=true

# Supplied only after provisioned from TigerGraph
TIGERGRAPH_URL=
TIGERGRAPH_GRAPH=CaseGraphDemo
TIGERGRAPH_TOKEN=
TIGERGRAPH_QUERY_NAME=find_case_links

# Optional AI providers - choose real adapters before use
OCR_PROVIDER=
MULTIMODAL_API_KEY=
ASR_PROVIDER=
ASR_API_KEY=

# Optional Jev (server-side only)
JEV_ENABLED=false
TYPESAFE_API_KEY=

# Development auth: do NOT use demo tokens or secret defaults in production
DEMO_MODE=true
```

```dotenv
# apps/web/.env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

**Never expose secrets with `VITE_` variables.** Use a NestJS configuration module with startup validation; fail closed when required storage/auth variables are missing. Choose credential names based on the actual integrations you install.

### Run development servers

```bash
# terminal 1
cd apps/api
npm run start:dev

# terminal 2
cd apps/web
npm run dev
```

Database migrations and graph seeding become runnable **after** their scripts/files are implemented. Suggested commands for the team to expose in `apps/api/package.json` are `db:generate`, `db:migrate`, `seed:synthetic`, `test`, `test:e2e` and `lint`. Do not run `drizzle-kit migrate` before writing and reviewing the schema and migration configuration.

### TigerGraph onboarding

- Confirm your cluster/version and whether hybrid graph/vector features are included before designing around them.
- Start with a **small GSQL schema and one installed traversal query**.
- Keep TigerGraph credentials **only in NestJS**, never the browser.
- Validate endpoint/auth configuration using the [TigerGraph query API documentation](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints).
- If your graph instance is unavailable, the product should display **“Investigation temporarily unavailable”** rather than fake real graph results.

---

## 12. Safety, privacy, and security requirements

**This is high-sensitivity software even during a demo.** Threat model it as if people may upload account details, financial records, personal chats and false allegations about third parties.

### Non-negotiable controls

- **Urgent routing:** Never require an upload or payment before showing 1930 and bank reporting guidance.
- **Data minimization:** Collect only what the case needs; redact unrelated private information where possible.
- **Authorization:** Enforce per-user, per-organization and per-case access on the **server**, including graph read paths and export endpoints.
- **Storage security:** Private object buckets, TLS where applicable, protected secrets and signed short-lived file URLs; never publicly host evidence.
- **Auditability:** Record who accessed, exported, changed or shared a case, with request IDs; avoid sensitive payloads in logs.
- **Ingest safety:** File size limits, MIME/content inspection, supported-parser allowlists, malware scanning if appropriate, and resource limits; do not execute uploaded code or follow arbitrary uploaded links.
- **Prompt-injection defense:** Uploaded chats/documents are **data**, not instructions. A model must have no permission to send information to external parties or invoke privileged graph actions based on content within an upload.
- **Evidence preservation:** Hash at ingest, retain the original where lawful, version every correction, record extractor/model version.
- **Source provenance:** Distinguish screenshot text from bank-verified facts; never suppress uncertainty in an export.
- **Disclosure control:** Consent alone does not override institutional legal requirements. Implement explicit sharing authorization and data-processing agreements before any real cross-entity case matching.
- **Sensitive content:** Do not request OTPs, UPI PINs, passwords or card PINs. Do not collect sexual/intimate imagery or material depicting child sexual abuse in the hackathon product; redirect to official reporting and specialist handling.
- **Retention/deletion:** Define retention and deletion workflows with legal review; a user's deletion request may be subject to lawful preservation obligations. Avoid pretending a hash manifest means every AI-provider copy has been erased.
- **Privacy law:** Obtain Indian legal review, including DPDP requirements and potential law-enforcement/regulated-data constraints, before any real pilot.
- **Incident response:** Have a documented process for accidental exposure, compromised keys, fraudulent use and takedown.

### Section 63 BSA: correct legal positioning

The [Bharatiya Sakshya Adhiniyam, 2023 — official text](https://www.indiacode.nic.in/bitstream/123456789/20063/1/a2023-47.pdf) contains Section 63 and a Schedule for an electronic-record certificate. CaseGraph may assist with record organization, hashing and **preparing data for human review**, but **cannot certify courtroom admissibility simply by generating a hash or PDF**. The party/expert certificate requirements and any case-specific court practice require proper legal advice. Label any template **“Section 63 preparation worksheet — not a completed certificate.”**

---

## 13. Demo dataset and evaluation

### Synthetic dataset design

Create 20 cases plus an evaluation set that isn't shown to the team implementing the matching logic. Do **not** use leaked bank datasets or impersonate real complainants.

- **Case A / Kochi:** Fictional investment scam, UPI-A, receipt shows a specific amount and time.
- **Case B / Bengaluru:** Fictional friendship scam, UPI-B, distinct visible identifiers.
- **Synthetic institutional ledger:** UPI-A and UPI-B both settle into fictional Account-X.
- **Case C / Goa:** Different scam with no link to Account-X.
- **Benign look-alike:** Two unrelated cases share a common domain/hosting provider or generic wording; **should not** be considered the same perpetrator.
- **Conflicts:** A voice recollection disagrees with an uploaded receipt; missing UTR; altered/cropped screenshot; multiple possible dates.
- **OCR pitfalls:** Similar-looking digits, blurred images, partial screenshots, mismatched currency amounts.

### Minimum evaluation metrics

| Metric | Measurement | Why it matters |
|---|---|---|
| Extraction precision / recall | Compare field values against manually labeled source text | Detect wrong amounts/dates/IDs and missed facts |
| Provenance correctness | % of extracted claims linking to the **right artifact and region/span** | Prevent invented attribution |
| Contradiction recall / false alarms | Labeled conflicting/non-conflicting examples | Avoid misleading questions |
| Unsupported claims per export | Human review of report statements | Keep hallucinations visible and low |
| Graph lead precision / recall | Compare returned paths to known **synthetic** ground truth | Avoid false link conclusions |
| Analyst review time | Controlled comparison on the same cases and staff | Validate actual efficiency |
| User correction burden | # required corrections / follow-up requests | User experience and accessibility |
| Latency | End-to-end ingest→extract and graph query separately | Honest performance reporting |

No fabricated claims such as “cuts 90 minutes to three” or “catches 95% of criminal rings.” If only synthetic performance has been tested, say so explicitly.

### Suggested adversarial tests

1. Wrong amount in voice transcription; receipt has another amount → show conflict, don't overwrite either.
2. Screenshot with fake instructions (“ignore all rules”) → treat as data only.
3. Two cases share a UPI/phone → lead identified, **not guilt inferred**.
4. Shared public IP/hosting service → system does not claim common criminal identity.
5. Analyst from tenant B requests tenant A file → denied.
6. Export after corrected claim → original upload and revision remain traceable.
7. OCR provider error or TigerGraph unavailable → graceful review state, no invented success.
8. Missing UTR → 1930 guidance still available and complaint draft still possible.

---

## 14. Four-day HHGOA implementation plan

| Day | Focus | Demoable checkpoint |
|---|---|---|
| **Day 1 — Oct 28** | Repo, auth/demo roles, PostgreSQL schema, private uploads, SHA-256, synthetic evidence fixtures, urgent reporting notice | Upload file, inspect hash + metadata, open private case |
| **Day 2 — Oct 29** | OCR/AI adapter, source regions, timeline, discrepancies, victim review and questions | Click an extracted payment amount and see its original source; resolve a conflict |
| **Day 3 — Oct 30** | TigerGraph schema/seed/query, analyst access, graph-path viewer, PDF evidence package | Two fictional cases linked by a real GSQL query and traceable edges |
| **Day 4 — Oct 31** | Tests, Jev optional benchmark, performance review, demo rehearsal, institution feedback, failure fallback | Complete 3-minute workflow with no fabricated integration claims |

### Team division (3–4 people)

- **Backend/evidence:** NestJS, PostgreSQL, uploads, hashes, claims, export.
- **AI pipeline:** OCR/ASR adapters, structured extraction, conflict tests, optional Jev.
- **Graph:** TigerGraph schema, seed, installed GSQL query, link evaluation.
- **Frontend/demo:** Accessible intake, timeline, provenance viewer, investigation UI.

With fewer teammates, merge frontend/backend roles and **skip** telephony, hybrid vectors and Jev until the core demo works.

### Three-minute judges' demo

1. **0:00–0:30 — Human problem:** Show a confused victim with disordered fictional screenshots; point out 1930 guidance.
2. **0:30–1:15 — Reconstruct:** Upload 4–6 fictional evidence files; build a source-linked draft timeline.
3. **1:15–1:45 — Correct:** Surface a timestamp/amount contradiction and ask a targeted question; preserve uncertainty.
4. **1:45–2:30 — Investigate:** Show TigerGraph's installed query finding a documented *synthetic* multi-hop connection while rejecting a benign look-alike.
5. **2:30–3:00 — Prove:** Click on the fact/graph edge to inspect its evidence; export a clearly labeled complaint **draft** and hash manifest.

**Live-demo fallback:** Keep synthetic fixtures and precomputed OCR candidate **inputs** ready if the OCR service is temporarily unavailable; visibly label any fallback. Never show cached graph paths as if a live graph query produced them.

---

## 15. Business model and customer validation

### Proposed B2B2C model

- **Victims:** Free basic intake and evidence organization, with immediate links to official reporting.
- **Initial proposed buyers:** Fraud-response BPOs, banks' fraud operations, payment-service providers.
- **Potential later buyers:** Authorized investigation units and insurers, subject to product and data-use constraints.
- **Pricing hypothesis:** Institution subscription or per processed **case**, plus optional voice-processing volume. Prices not established; avoid charging based on “criminals detected.”

### What buyers actually purchase

A measurable **reduction in manual case-preparation and follow-up effort**, while keeping factual and source accuracy at least as good as their current process. Graph-assisted investigation may be an additional premium capability, but a partner must provide authorized data.

### Buyer discovery questions

1. How many relevant fraud reports does the team process per month?
2. Where does intake time go: call transcription, transaction lookup, checking documents, or repeat calls?
3. Which fields are most often missing or wrong?
4. What software already handles these steps? What cannot it do?
5. Can the team share anonymized/synthetic samples and supervise a small blinded comparison?
6. What evidence would justify a pilot or procurement? Who owns the budget and security approval?

**Do not claim product-market fit without customer evidence.** National fraud totals are evidence of the social problem, **not** the addressable revenue or willingness to pay.

### Existing products to understand

- [National Cyber Crime Reporting Portal](https://cybercrime.gov.in/) — official complaint filing.
- [Hyderabad Police C-Mitra](https://www.hyderabadpolice.gov.in/C-Mitra.html) — complaint drafting, follow-up collection and FIR-support workflow after NCRP reporting.
- I4C systems, including CFCFRMS and Samanvaya — official fraud response and coordination. **CaseGraph must complement, not impersonate, these systems.**

### Go / no-go decision after HHGOA

Proceed toward a pilot only if at least one credible fraud-response institution identifies a nontrivial pain point, the prototype delivers **reviewable and accurate source references**, access/control requirements are workable, and a comparison indicates realistic operational value. Otherwise narrow the target instead of adding more AI features.

---

## 16. Definition of done

The MVP is done when **all** of the following are demonstrated:

- [ ] A fictional victim can reach official urgent reporting instructions immediately.
- [ ] They can upload disordered evidence and retain the same original-file hashes.
- [ ] At least one extracted fact is linked to its correct source/region and confirmed visually.
- [ ] The app handles a deliberate contradiction without silently choosing a winner.
- [ ] The victim can correct a claim while keeping a traceable history.
- [ ] A reviewable draft and evidence index export successfully; no automatic legal-admissibility claim.
- [ ] An authorized analyst runs a **real TigerGraph query** and sees a correct multi-hop path with sources.
- [ ] Unrelated synthetic cases are not falsely described as a shared criminal organization.
- [ ] Unauthorized access across cases/organizations is denied in tests.
- [ ] User-facing UI clearly labels simulated data, limitations, and the official reporting boundary.
- [ ] At least one repeatable evaluation test runs and its results are reported honestly.

---

## 17. References / implementation resources

**India, reporting and law**

- [MHA/PIB: 2021–2025 financial cyber-fraud complaint figures](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2226441&lang=2&reg=48)
- [MHA/PIB: National Cybercrime Response Mechanism](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2287674&lang=1&reg=1)
- [NCRP official portal](https://cybercrime.gov.in/)
- [NCRP: evidence and complaint FAQ](https://cybercrime.gov.in/Webform/FAQ.aspx)
- [India Code: Bharatiya Sakshya Adhiniyam, 2023 (Section 63 and Schedule)](https://www.indiacode.nic.in/bitstream/123456789/20063/1/a2023-47.pdf)
- [Hyderabad Police C-Mitra](https://www.hyderabadpolice.gov.in/C-Mitra.html)

**Engineering**

- [TigerGraph GSQL query reference](https://docs.tigergraph.com/gsql-ref/4.2/querying/)
- [TigerGraph installed query API](https://www.tigergraph.com/docs/tigergraph-server/4.2/api/gsql-endpoints)
- [TypeSafe AI Jev TypeScript guide](https://www.typesafeai.org/guides/jev-typescript)
- [NestJS file upload guidance](https://docs.nestjs.com/techniques/file-upload)
- [Drizzle ORM docs](https://orm.drizzle.team/)
- [Vite guide](https://vite.dev/guide/)

---

## Team principle

> **Build two things exceptionally well: a victim-facing evidence reconstruction workflow and a permission-scoped TigerGraph investigation workflow.**
>
> Do not turn a serious fraud-response product into a collection of sponsor logos. The demo should prove **which source supports each claim** and **which records support each graph connection**, without pretending either establishes guilt or guarantees fund recovery.

**License:** TBD before public release. **Project owner / contributors:** add team details. **Data policy:** synthetic-only until a lawful, security-reviewed pilot is approved.

## Implemented local scaffold (T00)

The blueprint above describes the planned MVP. Only the React/Vite landing page
and NestJS process liveness are implemented at this stage. No paid API keys,
Docker, database, OCR, graph server, or environment file are needed for T00.
The historical provider/Compose examples above are not active configuration;
`docs/STACK.md` and `docs/FREE_SETUP.md` govern the local-only implementation.

Use Node 22.12+ (`nvm use` selects Node 22), then from the repository root:

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The API binds only to 127.0.0.1:3000;
`GET /api/v1/health/live` reports process liveness, not dependency readiness.
Vite proxies `/api` to that local API. Stop both with Ctrl+C.
Individual servers: `npm run dev -w @casegraph/web` and
`npm run dev -w @casegraph/api`.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Migration/seed commands are documented in the T02 database bootstrap section. Infrastructure commands are in the T01 section.
Evidence, authentication, and graph routes are not exposed by this scaffold.

## Implemented local infrastructure (T01)

PostgreSQL and private local evidence storage are now configured independently
of the application scaffold. From the repository root with Docker running:

```bash
npm run infra:init
npm run infra:config
npm run infra:up
npm run infra:status
npm run infra:smoke:db
npm run infra:smoke:storage
npm run infra:down
```

The database binds to `127.0.0.1:55432`; credentials are generated in ignored
`.env`. Private evidence belongs in ignored `.local/evidence`, never the frontend.
The smoke checks use synthetic data; the database check restarts this project's
container, and the storage check builds and temporarily starts its own servers.
Shutdown preserves the database volume. See [infra/README.md](infra/README.md) for
prerequisites, the pinned image, commands, credential handling and limitations.
Schema migrations and synthetic seeding are documented below (T02); authenticated application access remains T03.

## Implemented database bootstrap (T02)

After `npm run infra:up`, run:

```bash
npm run db:migrate
npm run seed:synthetic
npm run db:verify
npm run infra:down
```

Drizzle now defines the 15 canonical tables with a reviewed SQL migration. Seeds
create one fictional consortium, two victim identities, one analyst, 20 synthetic
case placeholders and three sharing examples. Repeating seeds preserves edits.
`db:verify` uses a separate temporary local database and removes it afterward.
`npm run db:generate` generates future migrations offline. See
[infrastructure instructions](infra/README.md) and [data model](docs/DATA_MODEL.md).
Authentication, protected case endpoints and actual evidence processing are still
unimplemented. No fixture is a real victim record or live investigation result.
