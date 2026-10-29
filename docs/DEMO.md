# HHGOA Live Demo Script — Honest, Reproducible (~3–4 minutes)

**Budget:** AWS spend ≤ **$20** (ap-south-1). Keep API/web/Postgres local. See [`AWS_DEMO.md`](AWS_DEMO.md).

## Demo goal
Show **complete victim-to-investigator evidence continuity** using fictional cases, local app processing, optional Textract/Bedrock, and an **actual** TigerGraph query over an SSH tunnel.

### Act 1 — Victim filing (0:00–0:45)
Open `/`. File a synthetic complaint. Upload clearly marked fictional screenshots. Do not show real victim data. Prefer Textract when `TEXTRACT_ENABLED=true`; otherwise local Tesseract.

### Act 2 — Evidence reconstruction (0:45–1:25)
OCR extracts payment amount with source regions labeled `OBSERVED_IN_UPLOAD`, not “Bank Verified.” Link claims to the timeline. Click one amount to show the crop.

### Act 3 — Essentials only (1:25–2:00)
Refresh clarifications. Deterministic rules ask **only** for missing essentials (reference, amount, time) or conflicts. If `BEDROCK_ENABLED=true`, phrasing may be polished — still rule-gated; never invents bank verification. Answer Unknown when appropriate.

### Act 4 — Officer report + live graph (2:00–3:10)
Open `/officer`. Inbox shows many older synthetic complaints (seeded INVESTIGATE grants). Open Kochi/Bengaluru cluster case. Run **similar-case search** with TigerGraph tunnel up (`graph:verify-live` already passed). Path is a synthetic investigative lead with edge provenance — not a verified perpetrator.

### Act 5 — Export (3:10–3:40)
Generate the human-reviewable draft: chronology, claims, unknowns, hashes. Marked `DRAFT`. No FIR/arrest/recovery claims.

## Pre-stage checklist
- [ ] `npm run infra:up` + `db:migrate` + `seed:synthetic` (50 fictional cases)
- [ ] Billing alarms $15 / $20; EC2 stopped when idle
- [ ] `npm run aws:tg:start` (or create) + SSH tunnel + `npm run graph:verify-live`
- [ ] Optional: `TEXTRACT_ENABLED=true`, `BEDROCK_ENABLED=true`, cheap model enabled in Bedrock console
- [ ] `DEMO_MODE=true npm run dev:demo`
- [ ] No real identifiers on screen

## Cost teardown (end of rehearsal / day)
1. `BEDROCK_ENABLED=false` / `TEXTRACT_ENABLED=false`
2. `npm run aws:tg:stop` (or `aws:tg:destroy` after final demo)
3. Confirm CloudWatch billing; rotate IAM keys after hackathon

## Backup plan
- OCR off → Tesseract or labeled fixture only.
- Bedrock off → deterministic T07 questions only.
- TigerGraph down → **do not** show hard-coded paths as live. Show unavailable and offline query files.

## Judge notes
- TigerGraph shows multi-hop synthetic path provenance, not a single SQL join.
- No Indian police/bank record access without agreements; demo data is fictional.
- Hash proves integrity since ingest, not authenticity of the original capture.
- Jev/voice deferred for this 24h cut (ADR-026).
