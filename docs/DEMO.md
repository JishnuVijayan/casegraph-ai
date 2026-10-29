# HHGOA Live Demo Script — Honest, Reproducible (~3–4 minutes)

**Budget:** AWS spend ≤ **$20** (ap-south-1). Keep API/web/Postgres local. See [`AWS_DEMO.md`](AWS_DEMO.md).

## Demo goal
Show **complete victim-to-investigator evidence continuity** using fictional cases, local app processing, optional Textract/Bedrock, and an **actual** TigerGraph query over an SSH tunnel.

### Act 1 — Start filing (0:00–0:30)
Open `/`. Enter a fictional **name + 10-digit mobile** (no Victim A/B picker, no draft list). Continue into the one-complaint wizard. Badge reads **Hackathon demo** (not “synthetic”).

### Act 2 — Details + auto-uploads (0:30–1:10)
Short description + category, then add screenshots. Files **upload automatically** with preview thumbnails and Remove. Victim UI stays plain — no OCR buttons, claim types, or timeline builder. Case titles show the victim’s wording (no “Synthetic …” prefix in the UI).

### Act 3 — Prepare → ask only gaps → submit (1:10–2:10)
Click **Continue**. Server runs OCR, promotes observed amounts, parses OCR/summary for reference/time heuristics when present, scaffolds a payment timeline, and refreshes essentials (`POST /cases/:id/prepare`). If nothing is missing, skip straight to **Ready to submit**. Otherwise answer only open questions (or “I don’t remember”). Click **Submit complaint**. Labels stay `OBSERVED_IN_UPLOAD` / `VICTIM_RECOLLECTION` / UNVERIFIED — not “Bank Verified.”

### Act 4 — Officer report + print PDF (2:10–3:20)
Open `/officer`. Inbox shows **submitted** complaints only (`REVIEW_REQUIRED`). Open the complaint for a single report: screenshots, what we know, answers, similar-case leads already captured at submit (Retry if unavailable), and the versioned HTML draft with **Print / Save as PDF**. Advanced tools stay collapsed. For live TigerGraph fixtures, use **Open by reference** — never invent graph paths.

## Pre-stage checklist
- [ ] `npm run infra:up` + `db:migrate` + `seed:synthetic` (fictional cases)
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
If TigerGraph is down: show honest unavailable on similar-case search / Retry; still demo filing → submit → officer report + print. Never invent graph paths.
