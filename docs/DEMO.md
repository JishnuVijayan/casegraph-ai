# HHGOA Live Demo Script — Honest, Reproducible (~3–4 minutes)

**Budget:** AWS spend ≤ **$20** (ap-south-1). Keep API/web/Postgres local. See [`AWS_DEMO.md`](AWS_DEMO.md).

## Demo goal
Show **complete victim-to-investigator evidence continuity** using fictional cases, local app processing, optional Textract/Bedrock, and an **actual** TigerGraph query over an SSH tunnel.

### Act 1 — Start filing (0:00–0:30)
Open `/`. Enter a fictional **name + 10-digit mobile** (no Victim A/B picker, no draft list). Continue into the one-complaint wizard.

### Act 2 — Details + evidence (0:30–1:20)
Short description + category, then upload clearly marked fictional screenshots. Prefer Textract when `TEXTRACT_ENABLED=true`; otherwise local Tesseract. Save observed amounts; link a payment timeline. Labels stay `OBSERVED_IN_UPLOAD` / UNVERIFIED — not “Bank Verified.”

### Act 3 — Essentials + submit (1:20–2:10)
Answer only missing essentials (or Unknown). If `BEDROCK_ENABLED=true`, phrasing may be polished — still rule-gated. Click **Submit complaint**. Backend builds the case file: draft export + optional similar-case leads (honest unavailable if TigerGraph is down). Show confirmation — not FIR/arrest/recovery claims.

### Act 4 — Officer report + live graph (2:10–3:20)
Open `/officer`. Inbox includes the submitted complaint (auto-grant) plus older synthetic cases. Open it for timeline/draft. On a seeded cluster case, run **similar-case search** with TigerGraph tunnel up (`graph:verify-live` already passed). Synthetic investigative lead only — not a verified perpetrator.

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
If TigerGraph is down: show honest unavailable on similar-case search; still demo filing → submit → officer draft. Never invent graph paths.
