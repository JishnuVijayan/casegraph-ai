# Latest reviewed demo UI (2026-10-30, acd8d43 integration)

1. Open `/`, show urgent guidance and synthetic badge, enter invented name/mobile.
2. Describe the fictional incident; choose screenshots in the upload zone. Images upload automatically; owner can remove an unreferenced draft upload before preparation.
3. Click **Continue**. Local preparation runs OCR, creates observed amount claims with source coordinates, file-linked inference hints and a provisional payment grouping. It asks only for unresolved essentials; Unknown remains valid. No LLM or bank verification is implied. Date-only/unknown-zone values remain uncertain. Multiple real payments are not automatically proven to be the same event.
4. Submit the local review package, then explicitly **Share for investigation**. The case stays private until shared. Draft export remains accessible on confirmation.
5. Open `/officer`. The inbox lists shared submitted complaints; open one for screenshot previews, sourced claims, provisional timeline, answers, saved leads and report preview/Print button. Use Advanced tools for detailed review/source crops/corrections and graph queries. Existing graph fixture IDs can be opened through **Open by reference** only with active grants. Newly uploaded cases are not projected to TigerGraph automatically.
6. Demonstrate the existing seeded Kochi/Bengaluru graph pair under both INVESTIGATE grants. Keep SYSTEM_INFERENCE/UNVERIFIED/synthetic labels and source drilldown. Revocation must deny the next source request.

**Observed:** local real-browser rehearsal passed. Latest required-live attempt returned HTTP 503; retry when Savanna connectivity is available. No live success is claimed for this revision. Browser Print/Save as PDF dialog was not automated. Earlier sections below are historical rehearsal guidance and do not supersede this flow.

# Current wizard integration (2026-10-30)

Victim `/` now asks for fictional name/mobile, short description, uploads, review, essentials and local submission. Use invented demo details only; no OTP/KYC or official submission. After submission use **Share for investigation** explicitly, then open the officer workspace. The generated draft is available in **Draft export**. Graph lookup occurs only under analyst grants; it is not performed as a victim on submit. Existing seeded case-pair graph demonstration remains separate from new uploads. **Current verification:** local wizard browser passed; latest required-live query returned 503 and a separate client probe timed out. Recheck Savanna availability and rerun live mode before stage use. The previous split UI had a successful live run.

The rest of this document records the prior split-UI rehearsal and capability limits; the old victim case picker is replaced by this wizard.

# Current split-UI rehearsal (2026-10-29)

Victim filing is at `/`; the fictional analyst/officer inbox is at `/officer`. Both show urgent bank/1930/cybercrime.gov.in guidance before intake. The badge identifies synthetic demo data; the officer role is fictional, not a government login. New drafts are private until the victim clicks **Share for investigation**. **Revoke investigation access** revokes the grant created in the current case view; other active grants still apply. Existing backend APIs remain authoritative.

## Six-step demo capability

| Proposed step | Current implementation | Limit |
| --- | --- | --- |
| Report a cybercrime | Create a synthetic draft; urgent guidance visible first | No official submission or FIR |
| Upload evidence/account | PNG/JPEG screenshots/receipts and typed recollections | No audio recording/transcription or PDF/chat-export ingestion |
| Reconstruct timeline | Local OCR amount candidates with source crop; reviewed claims/corrections and manually linked chronological events | No automatic event/date/time extraction or model-generated chronology |
| Resolve details | Missing-reference and conflicting amount/explicit timestamp questions, correction history and UNKNOWN | Time conflicts require explicit timestamp claims linked to a payment; no inference from arbitrary prose |
| Investigate with TigerGraph | Existing seeded Kochi/Bengaluru four-hop synthetic path with four source refs and active grants | New uploads/cases do not automatically project to TigerGraph |
| Generate report | Versioned HTML complaint draft, chronology, evidence/hash index; browser Print/Save as PDF | No server-generated PDF certification or automatic filing |

## Manual rehearsal
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

1. Start local PostgreSQL; migrate/seed the local app if needed. Configure the private credential and exported Savanna flags as in `tigergraph-savanna-integration.md`; start `npm run dev:demo`. Do not reload the graph.
2. Open `/`, show urgent guidance, continue as Fictional Victim A. Open Synthetic Kochi-01 (case UUID ending 001) for the combined graph demonstration. A newly created case can demonstrate filing but has no graph projection.
3. Upload two clearly labeled synthetic PNG receipts, later date first: INR 2500 on 2026-10-29 and INR 800 on 2026-10-28. Run local OCR; review the actual amount crop and save observed claims.
4. Correct interpreted INR 2500 to INR 2600 with a note; show original observation and revision history. Add a payment-amount recollection INR 2700. Link both amounts to a date-only payment event on 2026-10-29 and INR 800 to 2026-10-28; show chronological ordering.
5. Optional time-conflict demonstration: add two `incident_time` recollections (`2026-10-29T16:12:00+05:30` and `2026-10-29T18:00:00+05:30`) and link both to a payment event; the rule flags the disagreeing explicit timestamps. Check payment details for questions; resolve the amount conflict as UNKNOWN. Generate/review/download the draft. Labels remain unverified and draft-only.
6. Share Kochi-01 for investigation. In a second victim tab continue as Fictional Victim B, open Synthetic Bengaluru-04 (UUID ending 002) and share for investigation. Keep this tab open for revocation.
7. Open `/officer` in another tab, continue as officer, choose Kochi-01 and run **Run similar-case search**. Show the actual five-node path, four edge sources, synthetic/unverified labels and human review. These graph scenarios are separate from uploaded receipts, not independent bank verification.
8. Revoke Bengaluru's grant from its victim tab; retry source access and saved snapshots as the officer. Confirm denial/withholding. Ensure there is no other active grant if testing total revocation.

For stage use, show one crop, one correction/UNKNOWN, one real graph query and one report; keep the complete denial scenario for questions.

`npm run test:security` exercises local safeguards and the updated browser flow with graph unavailable. `TIGERGRAPH_ENDPOINT=<public-origin> TIGERGRAPH_AUTH_MODE=secret npm run test:e2e:live` requires real path/source/review/revocation against the existing graph. The user reported a successful live run before this merge; this integration independently passed the updated live browser scenario (12.2 seconds). See TASKS.md for full evidence and remaining operator checks.

## Earlier blueprint and verification history

The script below is historical planning, not a claim that every proposed extraction feature is implemented. The capability table above describes the current flow.

# HHGOA Live Demo Script — Honest, Reproducible

## Demo goal (approx. 3 minutes)
Show **complete victim-to-investigator evidence continuity** using only fictional cases, local processing and an actual installed TigerGraph query.

### Act 1 — The victim (0:00–0:35)
Explain the human problem. Show **1930 / bank urgency guidance**. Start fictional Kochi victim report. Drag in 4–6 clearly marked synthetic scrambled screenshots/receipt images. Do not show real victim data.

### Act 2 — Evidence reconstruction (0:35–1:20)
OCR extracts payment amount, contact handle and date. Timeline shows exact sources (file + region), with `OBSERVED_IN_UPLOAD`, not “Bank Verified.” Click one amount to highlight the source screenshot.

### Act 3 — Contradiction (1:20–1:55)
Victim's fictional recollection says 18:00; fictional screenshot appears to show 16:12. App asks for clarification; user can choose `I DON'T KNOW`. Upload corrected document or confirm uncertainty and show revision history. Don't claim infallible AI.

### Act 4 — Graph lead (1:55–2:35)
Switch to **authorized synthetic consortium analyst**. Run real TigerGraph installed query (not a stored animation). Kochi UPI-A and Bengaluru UPI-B link to a shared **synthetic** second-layer account; path edge provenance available. Show a similar-looking but unrelated case is **not** labeled same perpetrator.

### Act 5 — Export (2:35–3:00)
Generate the human-reviewable report draft: chronology, claims, unknowns, source references, file-hash manifest and optional worksheet. Point to enterprise buyer hypothesis and measurable proof still needed.

## Backup plan
- Keep a preloaded synthetic fixture for OCR failures, clearly labeled **precomputed test input**.
- If TigerGraph is down, **do not** substitute hard-coded paths as if live. Explain the blocker and show reproducible query files/test evidence.
- No false promises of recovered funds, FIR submission, court certification or shared criminal identity.

## Demo checklist
- [ ] Backend/DB boot and test seed are successful
- [ ] TigerGraph instance and installed query verified before stage
- [ ] No real identifiers or sensitive records on screen
- [ ] One supported bounding-box highlight works
- [ ] One contradiction and optional unknown answer work
- [ ] Graph is labeled **synthetic investigative lead**
- [ ] One export works, correctly marked `DRAFT`
- [ ] Offline/local services have a demonstrated fallback state

## Judge questions to be prepared for
- Why TigerGraph instead of `JOIN`? Demonstrate genuine multi-hop path/edge provenance, not a single lookup.
- Can you access Indian police or bank records? **No**, not without authorized agreements; demo data is fictional.
- Is this better than C-Mitra or Goa 1930 AI? Different hypothesis: provenance + continuity from intake to institutional review; needs comparative pilots.
- Can a hash prove screenshot authenticity? **No**, only integrity since ingest.
- Who pays? Bank fraud-response/BPO team is hypothesis; validate workflow savings before selling.
- Why not include Jev or phone calls? Optional if verified useful and cost feasible; not a precondition for the central value.

## T10 source preparation status

The schema, synthetic seed bundle, four-hop query and live functional verifier are
prepared in `graph/`. They have not run in TigerGraph. Do not tick the live-instance
or installed-query checklist based on offline fixture tests. On the future compatible
EC2 host, finish T09, compile/install/load T10, repeat the seed, run `graph:verify-live`
and record actual results before staging Act 4. Administrative fixture query checks
do not establish the T11 backend's grant enforcement. No benchmarks are included.

## T11 workspace preparation status

Analyst UI/backend code now enforces current INVESTIGATE grants for all cases and
sources. Successful installed queries produce source-bound NEEDS_REVIEW snapshots;
unavailable queries show an error and clear prior results. Offline HTTP tests inject
explicit graph fixtures only into test modules. Before Act 4, complete the actual
host installation, install get_lead_sources alongside find_case_links, verify both
with graph:verify-live and then run the analyst UI against that host/tunnel. Do not
present mocked transport tests or saved snapshots as a new live query demonstration.

## T12 observed browser replay

`npm run test:e2e` now reproduces the local reporting flow from a fresh isolated
seed in Chrome with real local Tesseract: six uploads in disordered date order,
actual source crop, correction/revision, date-only timeline ordering, UNKNOWN,
report preview/download/hash equality, original-byte preservation, grants and denied
reads. It also verifies the graph-disabled unavailable state without a fixture path.
This is automation evidence for the local flow; stage rehearsals and manual print
output still need review. The actual graph demo remains unverified. After host
setup, `test:e2e:live` must pass the real path/source/review/revocation branch before
claiming complete victim-to-investigator E2E acceptance. The authored graph fixture
is not misrepresented as independently verified banking evidence from the uploads.
If TigerGraph is down: show honest unavailable on similar-case search / Retry; still demo filing → submit → officer report + print. Never invent graph paths.
