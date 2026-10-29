# Local $0-API Development Guide and Cost Boundaries

**Goal:** Run an honest, locally hosted HHGOA prototype **without buying API credits, hosted databases, telephony or cloud hosting**. You still need your own computer, electricity, internet to download dependencies/models, and sufficient RAM/storage. An internet-hosted production product is not guaranteed free.

## What can run without paid API keys?
| Component | Free local option | Constraints |
|---|---|---|
| Frontend/backend | React/Vite + NestJS on localhost | Developer machine required |
| Database | PostgreSQL in Docker | Storage + RAM |
| Evidence originals | Private local filesystem | Never serve from Vite public folder; optional MinIO container |
| OCR + bounding boxes | Tesseract hOCR/TSV | Varies on blurred receipts, Malayalam and handwriting |
| Timeline/validation | TypeScript deterministic rules + user review | Cannot understand all stories or guarantee correctness |
| Graph | **TigerGraph Community Edition** Docker/local | Free single-server edition; verify licensing, RAM, platform support |
| AI extraction | Optional Ollama with **local downloaded model** | Model license, CPU/RAM constraints, potential slow inference |
| Audio transcription | Optional whisper.cpp / faster-whisper local | Model files and CPU/GPU required; Malayalam quality must be tested |
| PDF | Local server generator or browser print | No third-party PDF service |
| Code generation | Codex signed in using included ChatGPT allocation | Plan/usage limits apply; not unlimited or zero-cost plan if subscribed |
| Domain/hosting | `localhost` only | Public deployment and custom domains are not inherently free |
| SMS/telephone/IVR | **Not in $0 prototype** | Actual PSTN/SIP phone numbers and carrier minutes generally cost money |
| Jev / Wispr / Dodo | Disabled unless verified sponsored/free eligibility | Do not claim availability or zero cost |

## Recommended build modes
**Mode A (recommended for reliability):** local Tesseract OCR + deterministic rules + manually reviewed timelines + TigerGraph Community with 20 fictional cases. **No paid AI APIs.**

**Mode B (if capable hardware):** Mode A plus a local Ollama model for *candidate structured extraction* (never verified facts). If model unavailable, Mode A still works.

**Mode C (optional experiment):** Local Whisper for voice recording transcription; require explicit editing. Telephone integration postponed.

## Implemented local commands (T00/T01)

No paid API credentials are required. Docker must be running for infrastructure.
Run these commands from the repository root after `npm ci`:

```bash
node --version
docker --version
docker compose version
npm run infra:init
npm run infra:config
npm run infra:up
npm run infra:status
npm run infra:smoke:db
npm run infra:smoke:storage
npm run infra:down
```

The init command safely creates ignored `.env` credentials and private
`.local/evidence`. PostgreSQL publishes only `127.0.0.1:55432`. Shutdown preserves
its volume. The DB smoke check restarts this project's container; storage smoke
builds both apps and starts temporary loopback servers on 3000/15173/15174.
See [infrastructure instructions](../infra/README.md) for the pinned image and
credential/persistence behavior. T02 adds `npm run db:migrate`, `npm run seed:synthetic`, and `npm run db:verify`
after `infra:up`. Database verification uses/removes a temporary local database.
T05 adds local Tesseract OCR with English TSV source regions; install Tesseract as a
local OS package and verify `tesseract --version`. No API key or network OCR call is
used. The API reports an unavailable status when the executable is absent. OCR is
not sandboxed from the host OS, is bounded to validated synthetic-image input, and
offers no language/handwriting guarantee. TigerGraph setup remains later work.

## TigerGraph Community important licensing distinction
Official comparison (2026): Community Edition is listed as **free**, single-server and available in Docker with graph/vector capabilities. Its [March 5, 2026 software license](https://www.tigergraph.com/license-agreement/) contains restrictions on **benchmarking, license scope and support**. Read the license before deciding how to run and showcase it. Do not promise that Community Edition permits your future production SaaS/hosted-service use or publish throughput claims without permission. For the hackathon, use local internal demonstration data; seek sponsor clarification about permitted use and access. Resources:
- https://www.tigergraph.com/docs/tigergraph-server/4.2/intro/comparison-of-editions
- https://www.tigergraph.com/docs/tigergraph-server/4.2/getting-started/
- https://www.tigergraph.com/license-agreement/

## Codex included usage is limited
Codex is included in current ChatGPT plans, but how much you can use depends on your plan and usage limits. Signing in with ChatGPT is different from using a **pay-as-you-go OpenAI API key**. Do not place an OpenAI API key in `.env` unless you explicitly intend separate API billing. Check current official plan terms: https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan

## No silent external service calls
- The model adapter must default to local/disabled.
- Localhost Ollama API does not require an API key; hosted/cloud routes are separate and may be billable: https://github.com/ollama/ollama/blob/main/docs/api/introduction.mdx
- Tesseract is open-source under Apache-2.0: https://tesseract-ocr.github.io/tessdoc/
- whisper.cpp is MIT licensed; model licenses must be verified separately: https://github.com/ggml-org/whisper.cpp
- Never enter credit-card details or enable a chargeable cloud product without a conscious decision.

## T03 local demo

After migration/seeding, use `npm run dev:demo` to opt into fictional login.
Regular `npm run dev` leaves login disabled by default. `npm run test:auth`
requires PostgreSQL and uses/removes an isolated temporary database. No paid
identity service or API key is needed. Never use demo role selection for real data.
