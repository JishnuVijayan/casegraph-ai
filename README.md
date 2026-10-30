# CaseGraph AI

**Report any cyber crime in minutes. AI turns what happened into a clear, evidence-backed case. Officers see the earlier complaints that connect to it.**

**Live demo: <https://casegraph-hhgoa.duckdns.org/>** &nbsp;·&nbsp; Officer view: <https://casegraph-hhgoa.duckdns.org/officer>
The demo runs on a small AWS server that is switched on for demos to save cost. If the link does not load, it is switched off; see [Run it yourself](#run-it-yourself).

> Built for **HHGOA 2026** (Hacker House Goa, 28–31 October 2026) with **TigerGraph**. CaseGraph is **not** an official government, police or banking service.

> **Lost money just now?** Call **1930** and tell your bank first, or report at [cybercrime.gov.in](https://cybercrime.gov.in). CaseGraph does not file an FIR, freeze accounts, recover money, identify anyone, or certify evidence for court.

## The problem
When someone is cheated or attacked online, the proof is scattered: chat screenshots, payment receipts, call records, a story remembered out of order. Reporting means long forms and legal jargon, and an officer has no easy way to see that the same phone number, UPI ID or website appears in other complaints.

## What CaseGraph does

**For the person reporting** (`/`)
1. **Tell us what happened.** Type, speak (Indian languages, auto-detected) or add screenshots, PDFs and documents. Sign-in is name and mobile number.
2. **AI reads everything as it arrives.** Amazon Textract and Bedrock (Nova Pro) build a summary, a dated timeline, key facts, and the phone numbers, UPI IDs, accounts and websites involved. Reference numbers are copied exactly as printed, partly hidden IDs stay partly hidden, and values not in your material are dropped.
3. **Quick questions.** AI asks only for what is missing, one at a time. "I don't know" is always fine.
4. **Check and send.** Review the story, download your own report any time (screenshots embedded and numbered), then submit to get a reference like `CG-2026-000123`.

**For the investigating officer** (`/officer`)
- An inbox of submitted complaints with search, filters and similar-case counts.
- A full case file: summary, timeline, evidence viewer, the complainant's answers.
- **Similar cases from TigerGraph.** On submit, the case and its identifiers go into a graph. A real query returns earlier complaints sharing a phone, UPI ID, bank account, website, email or handle, with a score and the shared details. Compare two cases, see a small network, download a printable dossier.
- Matches are **leads for a human to check, never proof**. If the graph is down, the screen says so and nothing is made up.

It covers all kinds of cyber crime, not only scams: UPI and payment fraud, investment and job scams, loan-app harassment, phishing, sextortion, romance scams, account hacking, shopping fraud, impersonation, harassment, identity theft, malware, fake profiles and more.

## How it works

```
Browser (React)  ──►  API (NestJS)  ──►  PostgreSQL        case file, answers, audit log
                         │         └──►  Evidence folder    original files + SHA-256
                         ├──►  AWS Textract + Bedrock       reading files, timeline, questions
                         ├──►  Sarvam AI (optional)         voice typing (else the browser's own)
                         └──►  TigerGraph on EC2            "have we seen this before?"
```

| Part | Technology |
|---|---|
| Web | React, TypeScript, Vite |
| API | NestJS, TypeScript, Drizzle ORM |
| Data | PostgreSQL; original uploads kept unchanged with SHA-256 |
| AI | Amazon Textract (OCR), Amazon Bedrock Nova Pro, Tesseract as a per-file fallback |
| Case network | TigerGraph (graph `CaseGraphV2`, query `similar_cases`) |
| Voice | Sarvam AI speech-to-text, or browser dictation |

**Safety by design:** uploaded files and transcripts are treated as data, never instructions to the AI. Access is enforced on the server for every case, file, report and similar case. AWS keys stay on the server, and TigerGraph's port is never public.

## Run it yourself
Full steps, including AWS and TigerGraph, are in **[docs/RUNNING.md](docs/RUNNING.md)**. In short:

```bash
npm install
npm run infra:init && npm run infra:up       # Postgres in Docker + evidence folder
npm run db:migrate && npm run seed:synthetic  # includes ~70 fictional complaints for the similar-cases demo
aws configure                                  # region ap-south-1; do not put AWS keys in .env
npm run aws:tg:start                           # then open the SSH tunnel (see docs/RUNNING.md)
npm run dev:demo                               # API :3000 + web :5173
```

Optional `.env`: `BEDROCK_MODEL_ID`, `SARVAM_API_KEY`. Textract, Bedrock and TigerGraph are on by default and checked at startup. For UI-only work: `ALLOW_DEGRADED=true npm run dev:demo`. Stop paid services when idle: `npm run aws:tg:stop` (budget cap $20, region `ap-south-1`).

**Tests:** `npm test` (offline unit tests), `npm run test:intake` and friends, `npm run test:e2e` (whole flow against a running stack).

## Repository
`apps/web` complainant and officer apps · `apps/api` NestJS API · `graph` TigerGraph schema and queries · `infra` Docker, database and AWS scripts · `video` Remotion launch video · `docs` requirements, API contract, security, decisions, runbooks ([requirements](docs/REQUIREMENTS.md), [contract](docs/V2_CONTRACT.md), [security](docs/SECURITY.md), [decisions](docs/DECISIONS.md)).

## Honest limits
- **Sign-in is not production-grade yet:** complainants use name and mobile only (no SMS code) and the officer sign-in is a pre-set account. SMS verification and officer SSO are needed before any public launch.
- **Similar cases follow direct links only,** not chains of other complaints.
- **The seeded history is fictional.**
- **AI can be wrong,** so everything shows where it came from and the complainant can correct it.
- **Legal and privacy review** is needed before real use.

Built at Hacker House Goa 2026 with **TigerGraph**, **AWS** (Textract, Bedrock) and **Sarvam AI**.
