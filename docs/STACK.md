# Technology Stack — Approved Choices

## Locked base stack
| Layer | Approved choice | Rationale |
|---|---|---|
| Frontend | React, TypeScript, Vite, React Router | Fast, familiar, typed client |
| UI | Tailwind CSS + accessible components (shadcn/ui optional) | Speed without sacrificing controls |
| Backend | NestJS, TypeScript, Node 22+ | Typed modules, guards, DTOs |
| Data | PostgreSQL + Drizzle ORM / drizzle-kit | Canonical case/claim records and migrations |
| Original file storage | Local private filesystem in cheapest dev mode; optional locally run S3-compatible MinIO | No cloud fees; never serve files publicly |
| Graph | **TigerGraph Community Edition** with installed GSQL query | Genuine sponsor technology for multi-hop analysis |
| OCR | **Tesseract** local; hOCR/TSV bounding boxes | Offline, no paid OCR API |
| Rules | TypeScript deterministic validators | Expected IDs, amount and date consistency |
| AI extraction | Optional **Ollama local model** only if hardware allows; typed validated outputs | No model API charges; do not invent facts |
| Speech | Optional `whisper.cpp` or `faster-whisper`, run locally | CPU-based fallback; transcripts require human verification |
| Reporting | Server PDF generator or printable HTML -> PDF | Clear evidence-indexed draft |
| Testing | Vitest/React Testing Library, Jest/NestJS test suite, Playwright if available | Regression and end-to-end checks |
| Dev infrastructure | Docker Compose for Postgres; optional MinIO; Docker TigerGraph separate if supported | Local repeatability |

## Explicit implementation boundaries
- **The free base is OCR + deterministic parsing + user correction.** Do not claim natural-language understanding from OCR alone. A local LLM may improve extraction but must be measured and validated.
- A fully local multimodal image model is **optional**, and its CPU/RAM needs are hardware-dependent. If absent, use Tesseract text regions + deterministic extraction and a human review UX.
- Graph path search must execute in TigerGraph. No fallback to hard-coded 'success' except labeled unit/demo fixtures.
- Jev needs service availability/credentials; treat as an optional paid-or-sponsored experiment, not required for zero-cost build.
- Wispr Flow is not an assumed embedded speech API. Avoid integrating without a confirmed, supported interface.
- Dodo Payments, Cake Wallet and Socket APK analysis are **not required**.
- Use **one NestJS backend** and an optional local Python subprocess/service only if the selected speech/OCR library cannot be used safely from Node. Avoid microservices by default.

## Versions and upgrades
Specify actual tested versions in `package-lock.json`, Docker images and lockfiles once the project is bootstrapped. Do not invent version compatibility: inspect package requirements before installation. Node 22 is the initial target from the existing README. Track deviations in `docs/DECISIONS.md`.

## Official references
- Codex AGENTS.md: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- TigerGraph Community: https://www.tigergraph.com/docs/tigergraph-server/4.2/intro/comparison-of-editions
- TigerGraph Docker: https://www.tigergraph.com/docs/tigergraph-server/4.2/getting-started/
- Tesseract: https://tesseract-ocr.github.io/tessdoc/
- Ollama local API: https://github.com/ollama/ollama/blob/main/docs/api/introduction.mdx
- Whisper.cpp: https://github.com/ggml-org/whisper.cpp
