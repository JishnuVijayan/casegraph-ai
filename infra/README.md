# Local infrastructure — T01

Run from the repository root with Node 22.12+ and Docker/Compose running.
This task provisions PostgreSQL and private local evidence storage only.
No paid API keys, cloud accounts, MinIO, OCR or TigerGraph are needed.

```bash
npm ci
npm run infra:init
npm run infra:config
npm run infra:up
npm run infra:status
npm run infra:smoke:db
npm run infra:smoke:storage
npm run infra:down
```

`infra:init` creates an ignored owner-only `.env` with a random local password
and owner-only `.local/evidence`. Repeating it preserves existing configuration
and evidence. It refuses symlinked or permissive private paths rather than
silently changing existing files. If an existing `.env` needs correction, edit
it locally and use `chmod 600 .env`; required settings are in `.env.example`.
Never paste the generated password into logs, documentation, or commits.

`infra:config` validates configuration without printing expanded secrets.
`infra:up` also validates and waits for a healthy database (90-second bound).
`infra:down` removes the project's container/network, preserving its named volume;
it never passes `--volumes`. No automatic reset/delete command is provided.
Commands target the fixed Compose project `casegraph-local`; do not run the
persistence smoke check against another checkout using this same project.

## Database

- Host: `127.0.0.1:55432`; database/user: `casegraph`.
- Password: generated in ignored root `.env`. Only local configuration is used;
  inherited shell settings do not override validated password/port values.
- Change `POSTGRES_PORT` in `.env` if occupied; run `infra:up` again. Port 5432 was
  already occupied on the tested machine, so 55432 avoids disturbing that service.
- Volume: `casegraph-local_pgdata`, mounted at `/var/lib/postgresql/data`.
- Resource bounds: 1 CPU, 512 MiB memory, 128 MiB shared memory, 256 processes;
  Docker was observed with approximately 8 GiB available. Adjust deliberately if
  later synthetic workloads require more; these are demo settings.
- Verified server: PostgreSQL **17.11**, native `linux/arm64` on the tested host.
- Pinned multi-platform image:
  `postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b`.

`infra:smoke:db` requires an already healthy database. It checks port publishers,
runs a password-authenticated TCP `SELECT 1` inside the container, writes a unique
synthetic table, removes/recreates the container without deleting its volume,
checks persistence, and drops only that table. It leaves PostgreSQL running;
finish with `infra:down`. It is disruptive to this project's database connections,
so run it before demo use. If interrupted, its unique `t01_smoke_*` table may need
manual cleanup; never drop application tables or the volume to clean a smoke test.

PostgreSQL initializes credentials on a new volume only. Editing `.env` does not
rotate an existing database password; restore the matching local value or perform
an explicit database password change. The CLI schema/migrations and synthetic seeds are documented in the T02 section
below. Application DB access and dependency readiness remain later work. Process
liveness is not database readiness.

## Private storage and checks

`.local` and `.local/evidence` use mode `0700`; `.env` and synthetic sentinels use
`0600`. There is no static evidence mount or file-serving API. This is local
filesystem isolation, not implemented per-case authorization (T03/T04).

Vite restricts filesystem serving to `apps/web` and explicitly denies `.local`
in addition to its sensitive-file defaults. `infra:smoke:storage`:

1. Checks that storage is ignored and owner-only; creates one synthetic sentinel.
2. Builds both projects while the sentinel exists and scans all frontend assets.
3. Starts its own API (3000), Vite (15173), and production preview (15174); refuses
   occupied ports instead of terminating existing processes.
4. Probes 21 URLs, including Vite `/@fs` requests and raw/import variants. Checks
   response content, since SPA fallback can return HTTP 200 without serving a file.
5. Stops only its own servers and removes only its own sentinel, including on
   ordinary failures. A forced process kill may leave a synthetic sentinel.

Use `npm run infra:test` for the four configuration/storage safety tests;
`npm test` includes these plus the existing app tests. Run lint, typecheck, and
build as usual. The storage smoke command also performs `npm run build` itself.

## Observed T01 verification

On 2026-10-29: configuration validation, healthy startup on 55432,
password-authenticated query, loopback-only publishing, persistence across
container removal/recreation, all 21 HTTP non-disclosure probes, build-output
scan, and smoke-server cleanup passed. Full check results and remaining limits
are in `docs/TASKS.md`.

References: [official PostgreSQL image](https://hub.docker.com/_/postgres),
[Vite filesystem serving controls](https://vite.dev/config/server-options#server-fs-strict).

## Database schema and synthetic seeds — T02

With `infra:up` complete, run from the root:

```bash
npm run db:generate
npm run db:migrate
npm run seed:synthetic
npm run db:verify
npm run infra:down
```

`db:generate` is offline and reads no credentials; after the committed migration,
it reports no schema changes. `db:migrate` uses Drizzle's migration journal and
is safe to repeat. `seed:synthetic` inserts the fictional fixtures transactionally
without updating existing records. No login or case API is exposed by these commands.

The root commands compile the backend CLI and use the validated, ignored `.env`
from T01. They connect only to local `127.0.0.1`, database/user `casegraph`, using
`POSTGRES_PORT` and `POSTGRES_PASSWORD`. No cloud connection URL or API key is used.
The NestJS health route still reports process liveness only; application DB/auth
integration remains later work.

`db:verify` creates its own uniquely named `casegraph_t02_test_*` database on the
local container. It migrates twice, seeds repeatedly, compares complete row
snapshots, preserves manual edits/revocations, checks the current schema/tables/indexes and
constraint rejections, then drops only that temporary database. The local demo
role needs database-creation permission for this check (the image bootstrap role
has it); this is not a production privilege design. On forced interruption, a
uniquely named temporary test database may remain for manual cleanup. Never drop
`casegraph` or its volume to clean test leftovers.

Stable installed versions are locked: Drizzle ORM 0.45.4, Kit 0.31.11, pg 8.23.1.
See [Drizzle's migration guide](https://orm.drizzle.team/docs/migrations).

## T03 authorization checks

`npm run test:auth` requires running local PostgreSQL. It creates a unique
`casegraph_t03_test_*` database, migrates/seeds it, exercises real NestJS HTTP
session/role/case guards and sharing, then removes only its test database.
A single query-error fault injection verifies sanitized HTTP 503 behavior; this
is not a claim of a real outage test. Forced interruption can leave the uniquely
named test database for deliberate manual cleanup.

`npm run dev:demo` explicitly enables fictional login using the root private
.env PostgreSQL configuration. No API secret is exposed to Vite. Disabled mode
can run public process liveness without PostgreSQL. Idle pool errors are handled
without logging connection details; subsequent database operations fail closed.

## T04 original storage verification

`npm run test:evidence` uses a unique temporary database and private directory,
synthetic PNG/JPEG generated locally, and real HTTP requests. It checks streamed
hash/byte equality, duplicate IDs, MIME/content/size rejection, role/IDOR controls,
revocation, original tamper/symlink/missing-file failures and confirmed transaction
rollback cleanup. A test-only DB trigger injects an insert failure after publication.
It never modifies working demo evidence; normal completion removes its own DB/files.

Working originals live in `.local/evidence/<source-UUID>.original` with mode 0400.
A forced crash may leave `.part` or unreferenced `.original` files. Do not auto-delete
these: inspect metadata and reconcile deliberately, especially after uncertain DB
commit acknowledgements. Client filenames are not retained or used for paths.
No additional migration was needed for T04: its evidence/audit tables hold upload metadata.

## T05 local OCR checks

Install local Tesseract (English trained data) and check `tesseract --version`;
the API default executable is `tesseract` on `PATH`, with `TESSERACT_BINARY` as an
optional local override. It uses no paid API. With PostgreSQL running,
`npm run test:ocr` executes real HTTP requests against a temporary synthetic DB and
private evidence directory. The suite checks source spans/crops, blank unreadable
input, unavailable-engine recovery, idempotency and immediate grant revocation,
then removes its test DB/files. OCR processes verified image bytes on stdin;
there are no persisted working copies or committed sample images. Tesseract is a
native subprocess without an OS sandbox; see `docs/SECURITY.md` for its limits.
