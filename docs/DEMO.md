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
- [ ] AWS credentials configured; cheap Bedrock model enabled in the console (Textract, Bedrock, TigerGraph are core and on by default)
- [ ] `DEMO_MODE=true npm run dev:demo`
- [ ] No real identifiers on screen

## Cost teardown (end of rehearsal / day)
1. Stop the app and the SSH tunnel (Textract/Bedrock bill per call, so nothing runs while the app is down)
2. `npm run aws:tg:stop` (or `aws:tg:destroy` after final demo)
3. Confirm CloudWatch billing; rotate IAM keys after hackathon

## Backup plan
If TigerGraph is down (`ALLOW_DEGRADED=true` to start anyway): show honest unavailable on similar-case search / Retry; still demo filing → submit → officer report + print. Never invent graph paths.

## Demo history in the case network (fictional, `npm run seed:synthetic` then `npm run graph:sync`)
72 seeded complaints cover all 15 crime types, referenced `CG-2026-900001` to `CG-2026-900072`. Good ones to open in the officer app (search by reference):
| Open | What it shows |
|---|---|
| `CG-2026-900041` (job scam) | One bank account (`…123456`) also used in 3 investment cases and a romance case: **same account, different crime types** |
| `CG-2026-900045` (sextortion) | Same phone as another sextortion case **and** a loan-app harassment case: one operator, two crimes |
| `CG-2026-900046` → `900047` → `900048` → `900049` | A **chain**: refund SMS → refund portal → fake tax officer → "refund" UPI mistake. First and last share nothing directly (the case network shows direct links only today) |
| `CG-2026-900001` to `900004` | Task-scam gang: shared Telegram phone and one UPI ID |
| `CG-2026-900050` to `900053` | Online harassment: one Instagram handle and a phone across victims |
| `CG-2026-900054` to `900057` | Identity theft: a SIM-swap phone, a loan-verification email and a bank account |
| `CG-2026-900058` to `900061` | Malware / ransomware: a fake "invoice viewer" site and the same unlock-your-files email |
| `CG-2026-900062` to `900065` | Fake profiles: the shop page handle from the shopping scam, a copied NGO page |
| `CG-2026-900024` to `900026`, `900066`, `900067` | Account hacking: one fake "security check" page |
Weak overlaps (same chat app or a common name) are included on purpose and show as "weak", never as proof.
