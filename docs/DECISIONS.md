# Architecture Decision Log

Use this to stop AI-driven scope drift. Append new decisions with date, alternatives, reason, consequences and reviewer. Do not silently override the README.

| ID | Decision | Reason | Revisit when |
|---|---|---|---|
| ADR-001 | React/Vite + NestJS + PostgreSQL/Drizzle monorepo | Fits team stack, minimal moving parts | Post-hackathon scale |
| ADR-002 | TigerGraph Community for actual synthetic multi-hop query | Sponsor-native, graph-specific feature | Production/hosted licensing review |
| ADR-003 | Keep all test cases fictional and consent controls explicit | Privacy, safety, no institutional data access | Authorized pilot agreement |
| ADR-004 | Hash originals and preserve typed source links | Auditability, protects against fabricated AI facts | Never remove |
| ADR-005 | Rule-based clarifications first; Jev optional | Free, reliable baseline; no paid dependency | Evidence Jev improves outcomes |
| ADR-006 | Local Tesseract OCR + optional Ollama/Whisper | No paid third-party APIs | Hardware/testing and buyer needs |
| ADR-007 | Phone-call/IVR flow is post-MVP | Carrier/telephony normally costs money, Goa already has 1930 AI | Authorized partner and budget |
| ADR-008 | No claim of automatic FIR, police integration, or court validity | Legal and factual accuracy | Actual approval and legal review |
| ADR-009 | Evidence reconstruction primary, graph analysis secondary workspace | End-to-end demo possible without confidential bank data | Real institutional pilot |
| ADR-010 | Avoid publishing TigerGraph Community performance benchmarks | 2026 license restrictions | Sponsor grants permission/other terms |

## New decision template
```text
### ADR-XXX — <decision> (<YYYY-MM-DD>)
Context:
Alternatives considered:
Decision:
Consequences and tests:
Approved by:
```

### ADR-011 — T00 local workspace bootstrap (2026-10-28)
Context: Initial checkout contained the documentation pack under docs only.
Alternatives considered: generated independent projects with separate locks; npm workspaces.
Decision: Copy the supplied AGENTS.md/README.md to the root, preserve the originals,
and use private npm workspaces with one package-lock. Implement only a static React
landing page and NestJS process liveness. Use loopback binds and a Vite API proxy.
No environment configuration is required until services are introduced; .env.example
therefore contains no credentials. Optional integrations remain unconfigured.
Consequences and tests: Node 22.12+ is required by Vite; available runtime is Node
24.15.0/npm 11.12.1, so Node 22 itself is not tested in T00. No architecture change
or additional service is introduced. Actual checks are recorded in TASKS.md.
Reviewer: Codex implementation under the user's T00 request.

### ADR-012 — T01 local PostgreSQL and private filesystem (2026-10-29)
Context: T01 requires repeatable local database startup and evidence isolation.
Alternatives considered: local MinIO; private local filesystem. PostgreSQL stays in Compose.
Decision: Use the smaller filesystem option with owner-only `.local/evidence`, no
public mount, and Vite filesystem serving restricted to the frontend. Generate
local credentials in ignored `.env` without overwriting existing files. Pin the
observed PostgreSQL image digest and keep the volume on shutdown. Publish on
127.0.0.1:55432 because the tested machine already uses 5432. Bound database
resources to 1 CPU/512 MiB for this small synthetic demo.
Consequences and tests: PostgreSQL 17.11 ran natively on linux/arm64. Functional
persistence and non-disclosure tests are recorded in TASKS.md. No MinIO dependency,
cloud service, database schema, application DB access, or auth route is added.
Per-case access control remains T03/T04; filesystem permissions do not replace it.
Reviewer: implementation under the user's T01 request.
