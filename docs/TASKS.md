# Codex Implementation Tasks — Source of Progress Truth

**How to use:** Ask Codex to implement **one task** at a time, run tests, then mark it `[x]` and attach verification evidence. No single-prompt “build the whole app”. Track failures honestly. Update `docs/DECISIONS.md` when deviating from architecture.

Current detailed plan: [`task.md`](../task.md) — T01 local infrastructure. T01 implementation and verification are complete; T02 is next.

## Phase 0 — Bootstrap (P0)
- [x] **T00 Repo initialization.** Monorepo `apps/web`, `apps/api`, `infra`, `data/synthetic`, `docs`; copy existing README/docs; `.gitignore`, `.env.example`; lock dependencies. **Done:** both projects start locally and no secrets committed.
- [x] **T01 Infrastructure.** PostgreSQL via Compose; local private evidence directory or MinIO, smoke checks. **Done:** run startup and clean shutdown; unauthorized file isn't web-accessible.
- [ ] **T02 Database.** Drizzle schema, migrations, seed-demo accounts and 20 synthetic case placeholders. **Done:** migrate twice safely / verify schema and seed idempotence.

## Phase 1 — Victim reporting (P0)
- [ ] **T03 Auth and authorization.** Seeded demo login, `CaseScopeGuard`, role boundaries. **Done:** cross-user access tests return denial.
- [ ] **T04 Case and uploads.** Form, bounded upload, SHA-256 stream, immutable original, metadata, audit event. **Done:** byte-equal hash and authorized retrieval.
- [ ] **T05 OCR and provenance.** Tesseract local extraction with text spans/hOCR boxes; record extraction version/errors. **Done:** click sample extracted amount -> correct source crop; unreadable case says unknown.
- [ ] **T06 Timeline and claims.** Normalized entities and uncertainty status; victim can correct, preserving revision. **Done:** source fact and edited interpretation both traceable.
- [ ] **T07 Questions.** Missing reference/amount/time conflict rules; `UNKNOWN` answer; optional later Jev. **Done:** conflicting sample asks correct focused question.
- [ ] **T08 Export.** Reviewable incident draft + chronological index + SHA-256 manifest. **Done:** PDF or print output with no “official complaint filed” claim.

## Phase 2 — TigerGraph (P0)
- [ ] **T09 TigerGraph Community setup.** Independent supported container/host, connection health, version documented. **Done:** installed graph and seed script repeatable. **Check license before tests or publishing any performance benchmarks.**
- [ ] **T10 GSQL schema and path query.** Vertices/edges for 20 synthetic cases, shared second-layer account, benign look-alikes, returned provenance. **Done:** installed live query exposes correct path and doesn't imply criminal identity.
- [ ] **T11 Analyst screen.** Scoped case grants, graph-path visual, edge-source drilldown, status `NEEDS_REVIEW`. **Done:** denied when grant absent; live query demonstrated when present.

## Phase 3 — Quality + optional (P0 first)
- [ ] **T12 E2E test.** Disordered evidence -> OCR -> correction -> case report -> graph path. **Done:** reproducible from fresh local seed.
- [ ] **T13 Security/adversarial tests.** IDOR, bad upload, prompt-injection text, unavailable graph, incorrect OCR. **Done:** tested and logged results.
- [ ] **T14 Optional local voice.** Whisper.cpp or faster-whisper on permitted test samples, reviewable transcript. **Done:** explicit language-specific limitations; may skip entirely.
- [ ] **T15 Optional local LLM.** Ollama on compatible machine; compare against OCR+rules with labeled fixtures. **Done:** no fabricated facts; if inferior, leave disabled.
- [ ] **T16 Optional Jev benchmark.** Only with sponsor credits/approved access; compare non-final routing with deterministic rules. **Done:** measured results, no unverifiable latency promises.

## Delivery checklist
- [ ] `npm test`, lint, typecheck, migrations and startup commands verified where scripts are implemented.
- [ ] A full free local demo runs on fresh clone with synthetic fixture data and no paid API key.
- [ ] All fake/simulated/authorized data distinctions visible.
- [ ] Demo replay instructions in `docs/DEMO.md` updated from observed execution.
- [ ] A list of remaining limitations is included in final demo/pitch.

## Build log
| Date | Task | Code changed | Tests actually run | Result / blocker |
|---|---|---|---|---|
| 2026-10-28 | Documentation pack authored | Documentation only | None | Application not scaffolded yet |
| 2026-10-29 | T00 repo initialization | Root AGENTS/README copied from supplied docs; private npm workspaces; React/Vite/Router/Tailwind landing page; NestJS liveness; lockfile; ignore/env/runtime/config files; infra and synthetic-data placeholders | `npm install --no-fund --no-audit`; `npm ls --depth=0`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run build`; `npm run dev`; localhost HTTP smoke requests; `git check-ignore`; whitespace check | Complete. Both servers started on loopback, frontend HTTP 200, API liveness HTTP 200 directly and through Vite proxy. 2 Jest API tests and 1 Vitest/RTL frontend test passed. No paid services or real data. |

### T00 verification details (2026-10-29 IST)
- Runtime actually tested: Node 24.15.0, npm 11.12.1. Node 22 is selected by `.nvmrc`; minimum 22.12.0 follows Vite's engine range. Node 22 itself was not available/tested.
- Locked versions include React 19.3.1, React Router 7.18.5, Vite 8.3.5, Tailwind 4.3.3, NestJS 11.2.8, TypeScript 5.9.3, Vitest 4.1.12 and Jest 29.7.0. `package-lock.json` records the full resolved tree; `npm ls --depth=0` succeeded.
- Initial sandbox npm DNS requests failed; network-permitted installation succeeded. Installation took about 11 minutes. Initial API tests could not bind a localhost socket (`EPERM`); the permitted rerun passed. Initial lint flagged CommonJS config globals; corrected the config glob and reran successfully.
- Build: both TypeScript projects compiled and Vite produced frontend assets. Typecheck and ESLint passed. Frontend test checks official urgent links/bank guidance and honest scaffold status. API tests check liveness and 404s for unimplemented case/readiness endpoints.
- Startup: both servers were stopped with Ctrl+C after successful checks; watchers exited. Root `npm run dev` launched both watchers with zero TypeScript errors. HTTP checks returned the frontend HTML, direct `/api/v1/health/live`, and the same endpoint via Vite's proxy. Liveness explicitly means process-only, not database/graph readiness.
- `.env`, nested app `.env`, `.local/evidence`, and build output are ignored; `.env.example` contains comments only. No secrets or case records were introduced; no commit was made.
- Limits: dependency installation emitted deprecation warnings for ESLint 9 and Jest's transitive `inflight`/`glob`. Dependency vulnerability audit was not run (install used `--no-audit`). No browser E2E/visual review, Node 22 verification, migration, seed, database, OCR, or TigerGraph checks were performed; these are not implemented in T00.
- Next unblocked task: **T01**, PostgreSQL Compose and private evidence-storage setup with startup/shutdown and access smoke checks. T02 and all later tasks remain unchecked.


### T01 verification details (2026-10-29 IST)
- Implemented `infra/compose.yaml`, safe private-directory/config initialization, lifecycle commands, PostgreSQL persistence smoke, storage HTTP/build smoke, and four configuration/storage safety tests. Updated local setup docs, current `task.md`, and ADR-012. No new dependencies or lockfile changes.
- Branch: `feat/t01-local-infrastructure`, based on `main` at `a515812`; existing planning/instruction edits were preserved. Git naming rules now use `feat/` or `fix/` and conventional commits.
- Prerequisites observed: Node 24.15.0; Docker CLI/server 29.4.1; Compose v5.1.3; Docker linux/arm64 with about 8 GiB available. Node 22 remains untested.
- `npm run infra:init` and `npm run infra:config`: passed. Init generated ignored `.env` with random credentials and private `.local/evidence`; existing files are preserved. A separate Compose configuration check with an empty password failed as expected without printing expanded configuration.
- Initial sandbox Docker access was denied; permitted Docker commands worked. Initial `infra:up` failed because 5432 was occupied. Changed this project's default to 55432, preserved the other service, and reran successfully.
- `npm run infra:up`, `npm run infra:smoke:db`, `npm run infra:status`: passed. Healthy PostgreSQL **17.11**, published only on `127.0.0.1:55432`; password-authenticated TCP `SELECT 1` passed. A unique synthetic table persisted after `down`/`up` container recreation and was dropped by the check.
- Pinned official image: `postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b`. No TigerGraph container or benchmark was run.
- `npm run infra:smoke:storage`: passed. Built both applications while the synthetic sentinel existed; frontend asset scan found no sentinel. All 21 HTTP probes across API, Vite and production preview withheld sentinel bytes; Vite `/@fs` probes returned 403, API probes 404. SPA fallback content was checked rather than interpreting HTTP 200 as a file disclosure. Temporary servers stopped and sentinel removed.
- Final `npm run lint`, `npm run typecheck`, and `npm test`: passed. Tests: 4 Node infrastructure safety tests, 2 Jest API tests, 1 Vitest/RTL frontend test. `npm run build` passed within storage smoke. Ignore checks and whitespace checks passed. No credentials were printed or added to source.
- `npm run infra:down` completed cleanly; final `infra:status` listed no project containers. The named database volume and private local configuration were preserved. No task services left running.
- Limitations: app DB integration, migrations, seeding and dependency readiness remain T02 or later; per-case authorization/upload retrieval remain T03/T04. Filesystem isolation does not establish those controls. Dependency audit, Node 22 verification, browser E2E, OCR and TigerGraph checks were not run. Forced interruption of smoke scripts can leave a uniquely named synthetic marker for manual cleanup.
- Next unblocked task: **T02**, Drizzle schema/migrations and idempotent synthetic seeding. T02 and later tasks remain unchecked.
