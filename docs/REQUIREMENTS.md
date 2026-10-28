# CaseGraph AI — Product and Engineering Requirements

## Objective
Enable a fictional cybercrime victim to turn scattered screenshots, receipts, text and optional audio into a **reviewable, source-linked complaint draft**; enable a fictional authorized analyst to examine **TigerGraph multi-hop leads** against a permitted synthetic dataset.

## Personas
- **Victim (free):** wants to explain an incident without typing a perfect chronology, verify extracted fields, answer targeted questions, export draft.
- **Bank/fraud-support analyst:** wants a traceable, minimal, permissioned case and fewer manual clarification loops. Revenue hypothesis only.
- **Authorized investigator:** wants sourced leads across authorized cases; no automated accusations.
- **Elderly keypad-phone caller:** post-MVP; no production telephone integration in the free four-day build.

## Must-have end-to-end flows (P0)
1. Landing page prominently shows `1930`, bank contact and `https://cybercrime.gov.in/` for urgent cases; user can start a demo draft afterward.
2. Seed demo victim and analyst users, one fictional consortium organization, strict ownership and explicit case-sharing grants.
3. Victim creates a case and uploads bounded PNG/JPEG screenshots or sample PDFs only when a safe parser exists; store immutable original bytes, hash and upload metadata.
4. OCR extracts candidate text with source file ID and text span or bounding box; preserve unknown/missing details and indicate OCR confidence separately from verification.
5. User types or corrects a recollection; system builds a timeline and distinguishes source-backed observations from statements and inferences.
6. Detect straightforward field gaps (payment reference missing), amount conflicts, and explicit timestamp disagreements; ask one focused question and accept `UNKNOWN`.
7. Victim reviews and revises without replacing the original upload or rewriting history.
8. Export a **draft** and evidence manifest (PDF or HTML-to-PDF) referencing source IDs/hashes, limitations and uncertainties.
9. Analyst sees only authorized cases. A **real installed TigerGraph query** returns source-referenced paths from synthetic data, with benign false-link examples included.
10. Tests verify evidence provenance, access denial, contradiction detection, correct graph path and refusal to infer guilt.

## Nice-to-have (P1)
- Local recorded-audio transcription, with user correction and language accuracy tests.
- Optional local Ollama model for proposing narrative structure, bounded by schemas and deterministic checks.
- Optional Jev classification tested against rules on the same labeled fixture set; only non-final workflow routing.
- Graph text similarity as a weaker, explicitly labeled investigative signal.
- Section 63 BSA **preparation worksheet**, never an auto-issued legally valid certificate.

## Out of scope (P2 or never)
- Public telephony/IVR, live police or bank connections, official submissions, auto freezing, production customer onboarding, real cross-tenant sharing, criminal identity determination, guaranteed recovery, production-grade automatic document authenticity verification.

## Acceptance criteria
- All local demo routes work without paid API keys.
- No test demonstrates AI creating a fact that has no recorded source, unless clearly marked `SYSTEM_INFERENCE`.
- The source viewer can open the exact evidence file and highlight an extracted region/span, when supported.
- Deleting/correcting a claim never silently alters original binary evidence.
- Analyst cannot access another user's private file without a grant; graph and export access are also enforced server-side.
- TigerGraph results come from an actual query against the seeded synthetic graph.
- Graph path labels indicate `investigative lead`, not proof of the same suspect.
- A disconnected TigerGraph or local AI service produces a truthful unavailable/retry state.
- Tests and remaining limits are reported transparently, not represented by invented percentage improvements.

## Nonfunctional MVP constraints
Use local development only, no hard-coded secrets, bounded upload sizes, resource limits for OCR, stable typed API errors, deterministic synthetic tests, accessible UI, no user identifiers in logs. For any real-user pilot obtain legal, safety, privacy, data sharing and institutional review first.
