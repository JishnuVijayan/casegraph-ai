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
