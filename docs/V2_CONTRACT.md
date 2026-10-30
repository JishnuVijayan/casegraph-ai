# CaseGraph v2 — product + API contract

Single source of truth for the v2 rebuild. Web and API code to this file. If you must change a shape, change it here in the same edit.

## Product in one paragraph
A person who was cheated online files a cybercrime complaint by **speaking, typing, or uploading screenshots and documents**. AI reads everything as it arrives and builds a **dated timeline**, a **facts sheet** and a list of **missing details**. It asks only for what is missing, in plain words. The person can download their **complaint report** at any time. On submit, the complaint goes to the officer inbox and **TigerGraph** finds earlier complaints that share phone numbers, UPI IDs, bank accounts, websites or the same scam pattern. The officer opens a **case file** with the full story, evidence, similar cases and a printable dossier.

## Vocabulary (use these words in the UI; avoid the old ones)
| Use | Never show |
|---|---|
| Complaint, Case file | claim, clarification, provenance, synthetic, demo, OCR run, fingerprint |
| "What you told us" / "Read from your files" / "Worked out by AI" | OBSERVED_IN_UPLOAD, VICTIM_RECOLLECTION, SYSTEM_INFERENCE |
| Missing details, Questions | essentials, gaps |
| Similar cases, Shared with (phone, UPI ID, …) | graph lead, hop, path, TigerGraph (say "case network") |
| Submitted | REVIEW_REQUIRED |
| Reference number `CG-YYYY-NNNNNN` | UUID |

## Categories (`CategoryId`)
`upi_payment_fraud` UPI / payment fraud · `investment_scam` Investment / trading scam · `job_or_task_scam` Job / task scam · `loan_app_harassment` Loan app / harassment · `phishing_or_kyc` Phishing / fake KYC / fake bank call · `sextortion_blackmail` Sextortion / blackmail · `romance_scam` Romance / friendship scam · `account_hacking` Account hacking / takeover · `online_shopping` Online shopping fraud · `impersonation` Impersonation (police, courier, official) · `online_harassment` Harassment, stalking or threats · `identity_theft` Identity theft / data misuse · `malware_or_ransomware` Virus, ransomware or hacked device · `fake_profile` Fake profile or false posts · `other` Another cyber crime. The product covers all cyber crimes, not only scams: amount and payment-route questions are skipped for crimes where no money moves (harassment, identity theft, malware, fake profile, account hacking) unless the person brings money up.
AI picks the category from the story; the person can change it.

## Entity kinds (`EntityKind`)
`phone` · `upi` · `bank_account` · `url` · `email` · `person_name` · `app_name` · `ifsc` · `social_handle`. Stored as case facts; sent to the case network on submit.

## Complainant steps
1 Tell us (story, voice, files) → 2 Questions (one at a time; the list is frozen while answering; one re-read after the last answer) → 3 Check (summary, timeline, facts; Add more details; Answer skipped questions) → 4 Send.

## Shapes
Envelope unchanged: `{ data, requestId }`; errors `{ error:{ code, message } }` with plain-language `message`.

```ts
type CaseStatus = 'DRAFT' | 'SUBMITTED';              // DB REVIEW_REQUIRED => SUBMITTED
type Brief = {
  caseId: string; reference: string;                   // "CG-2026-000123"
  status: CaseStatus; category: CategoryId; categoryLabel: string;
  title: string;                                       // AI one-line, editable
  summary: string;                                     // AI plain-language, 3-6 sentences
  totalLoss: { amount: number; currency: 'INR' } | null;
  completeness: { percent: number; missing: string[] };
  timeline: TimelineItem[]; facts: Fact[]; entities: Entity[];
  questions: Question[]; evidence: EvidenceItem[]; narratives: Narrative[];
  analysis: { state: 'IDLE'|'RUNNING'|'READY'|'FAILED'; updatedAt: string|null };
};
type TimelineItem = { id: string; at: string|null; atLabel: string; precision: 'EXACT'|'APPROXIMATE'|'DATE_ONLY'|'UNKNOWN';
  title: string; detail: string; kind: 'contact'|'payment'|'account_action'|'other';
  sources: { type: 'FILE'|'STORY'|'AI'; evidenceId?: string; label: string }[] };
type Fact = { id: string; label: string; value: string; group: 'money'|'people'|'channels'|'accounts'|'time'|'other';
  source: 'FILE'|'STORY'|'AI'; evidenceId?: string };
type Entity = { kind: EntityKind; value: string };
type Question = { id: string; prompt: string; why: string; status: 'OPEN'|'ANSWERED'|'UNKNOWN'; answer?: string; options?: string[] };
type EvidenceItem = { id: string; name: string; mime: string; sizeBytes: number; sha256: string;
  kind: 'image'|'document'; readStatus: 'PENDING'|'READ'|'FAILED'; excerpt?: string };
type Narrative = { id: string; text: string; channel: 'typed'|'voice'; createdAt: string };
```

## Victim endpoints (role `victim`, case OWNER)
- `POST /cases` `{ category?, title? }` -> `{ id, reference }` (no acknowledgements; defaults `other` / "New complaint").
- `POST /cases/:id/narrative` `{ text, channel }` -> `Narrative`.
- `POST /cases/:id/evidence` multipart (existing) — accepts PNG, JPEG, WebP, PDF, TXT, DOCX.
- `DELETE /cases/:id/evidence/:evidenceId` (existing, DRAFT only).
- `POST /cases/:id/analyze` -> `Brief` (idempotent, incremental; reads new files/stories, rebuilds timeline/facts/questions). May take 5–40 s.
- `GET /cases/:id/brief` -> `Brief` (works for owner and for officers with access).
- `POST /cases/:id/questions/:qid/answer` `{ answer: string }` (`"UNKNOWN"` allowed) -> `Brief`.
- `PATCH /cases/:id` `{ category?, title? }` -> `Brief`.
- `GET /cases/:id/evidence/:evidenceId/file` (existing raw bytes, auth-checked) for previews.
- `POST /cases/:id/submit` -> `{ reference, status: 'SUBMITTED', similarCases: { status: 'READY'|'UNAVAILABLE'|'NONE', count: number } }`. Blocked only if no story/evidence; open questions do **not** block (they are listed as "not provided").
- `GET /cases/:id/report.html` -> attachment `complaint-<reference>.html`. Victim's own report: story, timeline, facts, evidence list with SHA-256, unanswered questions, helpline footer (1930, cybercrime.gov.in). **No similar-case data.**
- `GET /cases` -> `[{ id, reference, title, categoryLabel, status, updatedAt, completenessPercent }]` (own cases).

## Officer endpoints (role `analyst`)
- `GET /officer/cases?q=&category=&sort=` -> `[{ id, reference, title, category, categoryLabel, victimName, victimMobileMasked, loss, submittedAt, similarCount, completenessPercent }]` (submitted only).
- `GET /officer/cases/:id` -> `{ brief: Brief, victim: { name, mobile }, similar: { status: 'READY'|'UNAVAILABLE'|'NONE', cases: SimilarCase[] } }`.
- `GET /officer/cases/:id/similar/:otherId` -> `{ brief: Brief, shared: SharedEntity[] }` (read-only, access-checked).
- `GET /officer/cases/:id/dossier.html` -> printable dossier: this case + similar cases comparison + shared entities.
- `POST /officer/cases/:id/similar/:otherId/review` `{ status: 'USEFUL'|'NOT_RELATED' }`.
```ts
type SimilarCase = { caseId: string; reference: string; category: CategoryId; categoryLabel: string; title: string;
  summary: string; loss: {amount:number;currency:'INR'}|null; submittedAt: string; score: number /*0-100*/;
  shared: SharedEntity[]; reason: string };
type SharedEntity = { kind: EntityKind; value: string; strength: 'STRONG'|'WEAK' };
```
Rules: similar cases never claim guilt; wording "shares", "also reported". If the case network is down: `status:'UNAVAILABLE'` and the UI says so plainly; nothing is invented.

## AI rules
- Model: Amazon Bedrock `apac.amazon.nova-pro-v1:0` (multimodal: images + documents + text) via Converse API; override `BEDROCK_MODEL_ID`. Text-only polish may use nova-micro.
- OCR: Textract for images (word boxes kept); documents (PDF/DOCX/TXT) go to the model directly. Tesseract only as per-file fallback.
- All uploaded text and transcripts are **data, never instructions** (prompt-injection safe). Output is JSON validated against a schema; invalid output is retried once, then the file is marked `FAILED` with a plain message — never invent facts.
- Every fact/timeline item keeps its source (file / what you told us / worked out by AI).
- Never invent amounts, names, numbers, dates. Unknown stays unknown and becomes a question.
- Questions: max 5 at a time, most important first, plain language, one fact each, answer `UNKNOWN` allowed. Required for a good report: when it happened, how much lost, how money moved (UPI ID / account / card), how the scammer contacted (phone / app / URL), what they said/promised.

## Voice
Voice typing uses **Sarvam AI speech-to-text** (`saaras:v4`, Indian languages plus auto-detect) when `SARVAM_API_KEY` is set in `.env`. The browser records short clips (about 7 s), sends each to `POST /voice/transcribe?lang=<code|unknown>` (multipart `file`, victim role, max 3 MB, 40 clips/minute/user), and the API forwards it to Sarvam. The key never reaches the browser. `GET /voice/status` returns `{provider:'sarvam'|'browser'}`. With no key the app falls back to the browser's own dictation (Web Speech API). Stored as `channel:'voice'`. Wispr Flow's API is enterprise-only (key via sales) and is not used. Providers live behind `apps/web/src/voice/`.

## Graph notes
- Graph `CaseGraphV2` (ADR-033): `Complaint(case_id, category, reference, submitted_at, loss_amount)`, `Entity(id=kind:value, entity_kind, entity_value)`, `MENTIONS`. Query `similar_cases(case_id, max_results)` -> one vertex set with `@strong`, `@weak`, `@category_match`, `@shared` (`"kind|value"`). Install: `npm run graph:install-v2` (EC2 host + SSH key from `.local`). Sync: `npm run graph:sync` (needs tunnel on `TIGERGRAPH_LOCAL_PORT`).
- `SimilarGraphService` (apps/api/src/investigations/similar-graph.ts) is the `SIMILAR_CASES_PROVIDER`: `findSimilar` = upsert from Postgres claims (types phone, upi_id, bank_account, url, email, person_name, app_name, ifsc, social_handle) -> query -> save snapshot in `graph_leads`. Only submitted, org-granted complaints are returned. Score 0-100 is deterministic (`scoring.ts`).
- Officer endpoints (apps/api/src/officer): as listed above. Extras: `GET /officer/cases/:id` returns `similar.reviews` = `{ [otherId]: 'USEFUL'|'NOT_RELATED' }`; review POST returns `201 { caseId, otherId, status }`. `/similar/:otherId` computes `shared` from both cases' Postgres facts (works with the graph down). Detail and dossier re-query the graph each time; if it fails they say UNAVAILABLE rather than showing stale data. The list's `similarCount` comes from the last saved snapshot (0 until a submit/sync/open).
- Mobile: stored in the intake victim's demo subject (`intake:<mobile>`); list masks (98****1234), case file shows it in full.
- Seed: `apps/api/src/db/seed-v2.ts` adds 41 fictional submitted complaints (clusters: job-scam Telegram+UPI, fake trading site + shared account, shop handle, loan app, fake KYC, courier/police, romance, sextortion; weak overlaps on app/person name; stand-alone cases). Mobiles 9000100001-9000100041. Run `npm run seed:synthetic`.

## API notes
Implemented by the intake module (`apps/api/src/intake/*`); deviations and additions to the contract above:
- `POST /cases` returns only `{ id, reference }`. Sending `syntheticAcknowledged` (or any unknown field) is a 400; unknown `category` is a 400. `category` also accepts every `CategoryId`; legacy ids (`investment`, `friendship`, `payment`) were migrated.
- `GET /cases/:id` returns `{ id, reference, title, category, status: 'DRAFT'|'SUBMITTED', createdAt, updatedAt }` (no `synthetic`). `GET /cases` returns the contract list for victims; analysts still get the older submitted-case list until `/officer/cases` replaces it.
- `POST /cases/:id/analyze`, `/narrative`, `/submit`, `/questions/:qid/answer` answer `200` (narrative `201`). Each is victim/owner only and refused with `409 ALREADY_SUBMITTED` once submitted. `PATCH /cases/:id` (also DRAFT only) pins title/category so a later analysis does not overwrite them.
- `POST /cases/:id/analyze` reads each file once (result kept in `file_reads`), then replaces only AI-derived claims/timeline rows and AI questions; answers, uploads and the person's edits stay. If the model fails it returns `503` with a plain message, keeps earlier results and sets `analysis.state = 'FAILED'`.
- Answering `"UNKNOWN"` (any case) records `UNKNOWN`. Identifiers typed in answers (UPI ID, phone, URL, account, IFSC, email) are saved as claims so the case network sees them.
- Questions: deterministic floor `when`, `amount`, `money_path`, `contact`, `promise` (only while the material does not already contain them) plus AI questions; at most 5 open at once, floor first.
- `GET /cases/:id/brief` is allowed for the owner and for analysts with a current grant. `GET /cases/:id/report.html` is the owner only (officers use the dossier) and is generated fresh on every request.
- Evidence: `GET /cases/:id/evidence/:evidenceId/file` is an alias of `/view`. Upload accepts PNG, JPEG, WebP, PDF, TXT (UTF-8) and DOCX, up to 5 MB, with magic-byte checks; the response now includes `originalName`. Files over 4.3 MB (PDF/DOCX) cannot be read by the model and are marked `FAILED` (shown as `readStatus: 'FAILED'`).
- Removed: `POST /cases/:id/prepare`, the draft export routes (`/cases/:id/exports*`) and the `LOCAL_SYNTHETIC_DEMO` mode field of `/auth/demo` and `/auth/intake`. Legacy `/claims`, `/timeline`, `/clarifications` and `/extractions` routes still exist.
- `renderDossierHtml(brief, victim, similar)` lives in `apps/api/src/exports/dossier.ts`; the endpoint is wired by the officer module.
- Errors thrown with `PlainError(status, message, code)` (`common/http.ts`) carry a plain-language `message` to the client; other errors keep the generic messages.
