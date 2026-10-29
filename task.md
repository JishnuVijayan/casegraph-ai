# Next task plan — T01 local infrastructure

Updated: 2026-10-29 IST. Status: T01 implemented and verified. T02 is next; not started.

`docs/TASKS.md` remains the overall completion and verification log. This file
holds the actionable plan for the current task. Work one task at a time.

## Starting state and observed prerequisites

- T00 is complete and pushed as `a515812` on `main`; working tree was clean at planning start.
- React/Vite and NestJS scaffold checks passed during T00. They were not rerun for this documentation-only plan.
- **T01 Infrastructure** is now complete within Phase 0 bootstrap. T02 is next.
- Observed prerequisites: Docker CLI 29.4.1 and Compose v5.1.3 are installed.
- `docker info` failed because `/Users/jishnu/.docker/run/docker.sock` does not exist. At implementation time the daemon was running; sandbox access required permission. See completion evidence below.

## Scope and choices

Use PostgreSQL through Docker Compose and a private local filesystem directory
for evidence. This follows `docs/STACK.md`, `docs/FREE_SETUP.md`, and
`docs/ARCHITECTURE.md`; MinIO is optional and unnecessary for this task.

Bind PostgreSQL to loopback only, use a named volume for persistence, define a
healthcheck, and pin the actual image version/digest verified during implementation.
Keep credentials in ignored local configuration with placeholders in the example.
Keep original-file storage outside `apps/web`, its public directory, and build output;
use ignored `.local/evidence` with owner-only permissions. It must have no static
HTTP mount. Do not add upload or download endpoints before authorization exists.

Database schemas, Drizzle migrations, seeds, authentication, uploads, OCR,
TigerGraph, and optional AI remain later tasks. No paid APIs or hosted services.

## Implementation checklist

- [x] Create branch `feat/t01-local-infrastructure` from main at a515812, preserving the existing planning edits; checked remote state before starting.
- [x] Verify the Docker daemon is running and inspect host platform/image compatibility.
- [x] Add `infra/compose.yaml` with local PostgreSQL, a persistent volume, a healthcheck, and bounded resource settings appropriate to the local machine.
- [x] Add reproducible infrastructure up/down/status/smoke commands and private-directory initialization. Validate configuration without printing credentials.
- [x] Update `.env.example` with required local placeholders and clear setup instructions; fail clearly on missing values. Preserve `.env` and private-storage ignores.
- [x] Initialize private evidence storage safely: no overwrites of existing evidence, no public static mount, and no destructive volume cleanup.
- [x] Add meaningful synthetic smoke checks for database connectivity, restart persistence, private-directory permissions, and HTTP non-disclosure.
- [x] Document exact observed commands, actual image version/digest, local setup and non-destructive shutdown in `infra/README.md`, `README.md`, and `docs/FREE_SETUP.md`.
- [x] Record the storage choice in `docs/DECISIONS.md` and actual results in `docs/TASKS.md`. Mark T01 complete only after all acceptance checks pass.

## Expected files

| File | Planned change |
|---|---|
| `infra/compose.yaml` | Local PostgreSQL service and persistence configuration |
| `infra/` helper scripts | Safe initialization and repeatable synthetic smoke checks |
| `package.json` | Infrastructure lifecycle/check scripts, with no new service dependencies unless needed |
| `.env.example`, `.gitignore` | Local configuration placeholders and private/generated-file exclusions |
| `infra/README.md`, `README.md`, `docs/FREE_SETUP.md` | Tested setup and shutdown instructions |
| `docs/DECISIONS.md`, `docs/TASKS.md`, `task.md` | Decision, evidence, and checklist updates |

These changes are implemented. Existing `.gitignore` rules already covered private storage and credentials, so no ignore-file edit was needed.
No application API or UI change is expected for T01.

## Acceptance checks and definition of done

- [x] Compose configuration validates; missing required configuration produces a clear failure.
- [x] Start PostgreSQL, wait for healthy state, and execute a simple connectivity query.
- [x] Confirm the database port is published only on `127.0.0.1`.
- [x] Create an explicitly synthetic temporary database marker; stop and restart without removing volumes; verify persistence and remove only the marker created by the check.
- [x] Confirm `.local/evidence` is ignored and owner-only. Place a synthetic sentinel there and verify its bytes cannot be retrieved through Vite, Vite's filesystem-serving routes, the API, or frontend production output. A SPA fallback HTTP 200 alone is not evidence of a leak: inspect response content. Remove only the sentinel created by the check.
- [x] Run the existing `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` after changes. Record failures and any sandbox-related reruns truthfully.
- [x] Stop the task's services cleanly without deleting volumes or existing files; report any services intentionally left running.
- [x] Update task evidence with observed results and limitations. If Docker remains unavailable, leave T01 unchecked and document the blocker.

Done means repeatable startup, healthy PostgreSQL connectivity and persistence,
private evidence storage that cannot be retrieved over the web, clean shutdown,
and passing applicable checks. This does not establish per-case authorization;
those controls and their denial tests belong to T03/T04.

## Git delivery

Use `feat/` for feature branches and `fix/` for fixes. Do not include `codex` in
branch names or commit messages. Use conventional commit types such as `feat:`,
`fix:`, `chore:`, or `docs:` as appropriate.

Suggested T01 implementation commit: `feat: add local PostgreSQL and private evidence storage`.
Stage only reviewed source/configuration/documentation and any required lockfile
changes. Exclude credentials, private evidence, dependencies, generated output,
and local machine files. Do not merge into `main` as part of implementation.

## After T01

Plan T02 separately: Drizzle schema/migrations, fictional demo accounts and one
fictional organization, and 20 synthetic case placeholders. Verify repeatable
migration and idempotent seeding before marking T02 complete.


## Completion evidence — 2026-10-29 IST

T01 is complete. Detailed actual results are in `docs/TASKS.md`.

- PostgreSQL 17.11 ran natively on linux/arm64 with the pinned digest in Compose.
- Initial 5432 conflict was resolved using 127.0.0.1:55432 without stopping the existing service.
- Configuration, authenticated connectivity, healthy startup, loopback publishing, restart persistence and unique-table cleanup passed.
- All 21 HTTP non-disclosure probes, frontend artifact scanning, and smoke-server cleanup passed.
- Lint, typecheck, both builds and all 7 tests passed. Node 24 was tested; Node 22 and dependency vulnerability audit remain unverified.
- Final `infra:down` succeeded; no project containers or smoke servers left running. Database volume and ignored local configuration/storage are preserved.
- No migrations, application DB connections, authentication, uploads, OCR or TigerGraph implementation was added. T02 remains unchecked.
