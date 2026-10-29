# Codex Implementation Tasks — Source of Progress Truth

**How to use:** Ask Codex to implement **one task** at a time, run tests, then mark it `[x]` and attach verification evidence. No single-prompt “build the whole app”. Track failures honestly. Update `docs/DECISIONS.md` when deviating from architecture.

Current detailed plan: [`task.md`](../task.md) — T03 complete; T04 case creation/uploads is next.

## Phase 0 — Bootstrap (P0)
- [x] **T00 Repo initialization.** Monorepo `apps/web`, `apps/api`, `infra`, `data/synthetic`, `docs`; copy existing README/docs; `.gitignore`, `.env.example`; lock dependencies. **Done:** both projects start locally and no secrets committed.
- [x] **T01 Infrastructure.** PostgreSQL via Compose; local private evidence directory or MinIO, smoke checks. **Done:** run startup and clean shutdown; unauthorized file isn't web-accessible.
- [x] **T02 Database.** Drizzle schema, migrations, seed-demo accounts and 20 synthetic case placeholders. **Done:** migrate twice safely / verify schema and seed idempotence.

## Phase 1 — Victim reporting (P0)
- [x] **T03 Auth and authorization.** Seeded demo login, `CaseScopeGuard`, role boundaries. **Done:** cross-user access tests return denial.
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


### T02 verification details (2026-10-29 IST)
- Reviewed T01 commit `a830b1a`: no blocking findings. Re-ran lint/typecheck, all 7 then-existing tests, database connectivity/persistence, both builds and 21 HTTP storage probes successfully; stopped services afterward.
- Created `develop` from `main` (`a515812`), merged T01 with merge commit `29c5a31` (`chore: merge local infrastructure into develop`), and pushed develop plus the T01 branch. Main was unchanged. T02 was implemented separately on `feat/t02-database` from develop.
- Added the 15-table Drizzle schema, 8 enums, UUID/FK/unique/check constraints and required indexes, reviewed `0000_bootstrap.sql` with snapshot/journal metadata, local database CLI/wrapper and deterministic synthetic fixtures. Added root `db:generate`, `db:migrate`, `seed:synthetic`, `db:verify` commands. No public case/evidence/auth endpoint was added.
- Locked Drizzle ORM **0.45.4**, Drizzle Kit **0.31.11**, pg and @types/pg **8.23.1**. `npm ls` succeeded. Existing package versions were not upgraded; lockfile changes include new dependency/peer locations and metadata. Installation warned about Kit's deprecated transitive esbuild-kit packages; vulnerability audit was not run.
- `npm run db:generate`: generated SQL was inspected; subsequent generation reported no schema changes. First emitted build found TypeScript's reserved CommonJS `exports` identifier. Renamed the TypeScript symbol to `reportExports`, preserving SQL table `exports`; build and generation then passed.
- `npm run db:verify`: passed against a fresh uniquely named local temporary database. Migration repeated without journal changes; verified 15 tables and required indexes. Seeding produced **1 fictional organization, 3 fictional users, 20 empty synthetic cases, 3 share grants**. Complete row snapshots matched on rerun; a manually changed case and revoked grant survived another seed. Test database was removed afterward.
- Integration checks observed 9 expected database rejections: orphan case owner, duplicate demo subject, invalid role, invalid hash, zero file size, cross-case evidence source, cross-case timeline link, duplicate grant scope and nonpositive export version. New claims defaulted to UNVERIFIED; valid same-case source and event links succeeded. These are database-integrity checks, not HTTP authorization tests.
- Working local `casegraph` database: `npm run db:migrate` twice and `npm run seed:synthetic` twice succeeded on PostgreSQL 17.11. Seeds are transactional and insert-only; no originals, graph relationships, OCR output or real records were introduced. Active/revoked/expired grant examples are fictional fixtures, not a working login/authorization system.
- Final `npm run lint`, `npm run typecheck`, `npm test`: passed. Test counts: 4 infrastructure, 4 Jest (2 health + 2 fixture), 1 frontend = **9 tests**. `npm run infra:smoke:storage` rebuilt both projects successfully and passed all 21 HTTP content probes plus asset scan. Whitespace checks passed.
- `npm run infra:down` succeeded; final status showed no project containers. Smoke servers stopped, sentinel and temporary verification DB removed; working seeded volume and ignored local credentials were preserved. No credentials added to Git or printed by database commands.
- Limits: Node 24.15.0 was tested, Node 22 was not. No dependency audit, browser E2E, auth/IDOR, original-file immutability enforcement, JSON coordinate validation, OCR or TigerGraph integration tests yet. CLI migrations/seeds do not create protected application routes or a readiness endpoint. Forced interruption may leave a uniquely named temporary test database requiring deliberate manual cleanup.
- Next unblocked task: **T03 — seeded demo login, CaseScopeGuard and role boundaries**. T03 and later tasks remain unchecked.


### T03 verification details (2026-10-29 IST)
- Reviewed and reverified T02 (lint/typecheck, 9 tests, db:verify, builds and 21 private-file probes); no blockers. Merged into develop as `9e64df1` and pushed. T03 implemented on `feat/t03-demo-authorization`.
- Added disabled-by-default/production-refused fictional login for three seeded identities; random 256-bit opaque tokens, hashed in-memory records, 30-minute expiry, rotation, logout, bounded sign-in attempts and cross-site/origin rejection. No real identity verification, password system, cookies, localStorage tokens or paid auth service.
- Added default global session and declared-role guards, SQL-backed CaseScopeGuard, scoped case lists/reads, owner-only explicit consortium grant/revoke actions, transactional audit and stable sanitized response envelopes. Actor role/membership/synthetic status and current grants rechecked on each request; READ does not grant INVESTIGATE scope. Multiple active grant scopes compose.
- Added minimal React role-selection/case-reading/sharing UI after urgent guidance. Old details clear before a new read, logout or expired session; denied/unavailable requests do not invent case data.
- Installed/locked class-validator 0.15.1, class-transformer 0.5.1, @types/express 5.0.6. No schema migration required. Initial TypeScript parseEnv optional-string mismatch fixed; lint/typecheck/build then passed.
- `npm test`: 15 tests passed (4 infrastructure, 7 Jest health/fixture/session, 4 Vitest/RTL UI). `npm run test:auth`: 9 PostgreSQL-backed HTTP tests passed in a unique temporary database; removed afterward. Tests cover cross-user denial, malformed/nonexistent case equivalence, forged/missing sessions, identity-field injection, undeclared handler denial, cross-origin login, absent/revoked/expired grants, scope/owner boundaries, immediate revocation effects, changed organization/role/synthetic flag, logout, expiry and redacted audit. One query-error fault injection verified sanitized 503; no actual database-outage test is claimed.
- Final lint/typecheck and both builds passed. `infra:smoke:storage` passed all 21 content probes/build scan; `db:verify` again passed migration/seed/constraint regressions after connection integration.
- `npm run dev:demo` started both servers on loopback. Browser UI verified fictional Victim A sign-in, owned case read, and denial of Victim B's case with old details cleared. Screenshot capture was unavailable; no saved screenshot or full browser E2E suite is claimed.
- Development servers stopped; `infra:down` succeeded and final status empty. Temporary verification DBs and sentinel removed, working seeded volume preserved; restart-invalidated demo sessions. Node 24 tested; Node 22 and dependency vulnerability audit still unverified.
- Limits: local role simulation only, ephemeral single-process sessions, no real-user identity assurance or production session design. Case creation, file serving/immutability, uploads, OCR, graph and exports remain future tasks. T04 must apply scope checks to every new file route.
- Next unblocked task: **T04 case creation and controlled uploads**, with exact-byte/hash and authorized-retrieval tests. T04 and later remain unchecked.
