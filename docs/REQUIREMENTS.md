# CaseGraph — Product and Engineering Requirements (v2)

Supersedes the v1 prototype requirements (see ADR-032). The API and UI contract lives in [`V2_CONTRACT.md`](V2_CONTRACT.md).

## Objective
Let a person who lost money or safety to an online crime **file a complete cybercrime complaint in minutes**, by speaking, typing or uploading screenshots and documents. AI reads everything as it arrives, builds a dated timeline and a facts sheet, and asks only for what is missing. After submission, a **case network on TigerGraph** finds earlier complaints that share phone numbers, UPI IDs, bank accounts, websites or the same scam pattern, and the investigating officer gets a full case file with those links.

## Personas
- **Complainant:** stressed, often on a phone, may not know legal or banking terms. Wants to tell the story naturally, get help with what to add, and keep a clean report of their own case.
- **Investigating officer:** wants a clear, complete case file, the evidence, and other complaints connected to it, without re-interviewing the complainant for basics.

## Must-have flows
1. **Urgent help.** The landing page shows 1930, "tell your bank now" and cybercrime.gov.in, never blocking filing.
2. **Identify.** Complainant enters name and mobile number; returns later to resume complaints.
3. **Tell the story.** Free text, voice typing (Sarvam AI speech-to-text with auto language detection, falling back to browser dictation), and uploads of screenshots (PNG/JPEG/WebP), PDFs, text files and Word documents. Originals are stored unchanged with SHA-256.
4. **AI reads and builds, in real time.** Textract and the multimodal Bedrock model read files; the model turns story plus files into: title, plain-language summary, category, total loss, dated timeline, facts (money, people, channels, accounts, time) and entities (phone, UPI ID, bank account, URL, email, name, app, IFSC, social handle). Every item shows where it came from: your file, what you told us, or worked out by AI.
5. **AI asks for missing details.** Up to five focused questions at a time in plain words, each with a reason, quick options and "I don't know". Answers update the timeline and facts at once.
6. **Own report.** The complainant can download a print-ready report of **their own case** at any time (story, timeline, facts, evidence list with hashes, unanswered questions, helpline footer).
7. **Submit.** Submission needs a story or at least one file; open questions are recorded as "not provided". The complaint gets a reference number `CG-YYYY-NNNNNN`.
8. **Case network.** On submit, the case and its entities are written to TigerGraph and a real query finds similar earlier complaints with shared entities and a score.
9. **Officer inbox.** Search, filter, sort submitted complaints; see loss, category, similar-case count and completeness.
10. **Officer case file.** Summary, timeline, evidence viewer, the complainant's answers, similar cases with shared details, side-by-side comparison with any other case, and a printable dossier including the similar-case comparison.

## Rules that stay
- Backend enforces access for every case, file, similar case and report. A complainant sees only their own cases; officers see submitted cases in their organization.
- Uploaded files, transcripts and OCR text are untrusted data, never instructions to the AI. AI output is schema-validated; nothing is invented; unknown stays unknown and becomes a question.
- Similar cases are leads, not proof; wording never accuses anyone. If the case network is down, say so; never fabricate links.
- No automated FIR, arrests, recovery or bank verification claims. The report is the complainant's account plus evidence, not a legal certificate.
- No raw case content or secrets in logs. No AWS keys, PEM files or tokens in Git.

## Services (all core, ON by default)
PostgreSQL (case file) · private evidence directory · AWS Textract (OCR) · AWS Bedrock Nova (reading, extraction, questions) · TigerGraph on EC2 (case network). The API checks them at startup (ADR-030). Tesseract remains a per-file fallback for images.

## Out of scope
Telephone/IVR filing, live police/bank integrations, official submissions, automatic freezing, identity determination, authenticity forensics, SMS/OTP verification (planned before public launch).

## Acceptance
- A fresh complaint can go story/voice/files -> AI timeline -> answered questions -> submit -> report download in one sitting on a 360 px phone.
- Officer opens the submitted case and sees at least one similar case when seeded history shares an entity, from a real TigerGraph query.
- Injection text inside an upload cannot create facts outside the schema or change instructions.
- Access tests: another complainant, another organization and the wrong role are all denied.
- Unit, integration and browser tests pass; remaining limits are listed honestly.
