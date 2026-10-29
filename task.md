# Current task — T03 demo authentication and authorization

Updated: 2026-10-29 IST. Status: T03 complete and verified. T04 is next, not started.

T02 was reverified: lint/typecheck, 9 tests, fresh/repeated migration and seeds,
constraint checks, builds and 21 storage probes passed. It was merged into
`develop`; implementation proceeds on `feat/t03-demo-authorization`.

## Scope and files

Follow README, REQUIREMENTS, ARCHITECTURE, DATA_MODEL, API, SECURITY and TEST_PLAN.
Add NestJS auth/session/role/case guards, DTO validation, stable error envelopes,
local DB integration, redacted audit, minimal demo login/case-reading UI, and
real-PostgreSQL HTTP authorization tests. Update configuration/setup/task docs.
No case creation, uploads, OCR, export generation or TigerGraph execution (T04+).

## Acceptance checklist

- [x] Review/reverify T02 and merge into develop; create feature branch.
- [x] Demo login defaults OFF and is refused in production; only seeded synthetic identities allowed.
- [x] Random expiring server sessions; logout invalidates; no tokens stored in browser persistence or logs.
- [x] Private routes require sessions and declared roles by default.
- [x] CaseScopeGuard enforces ownership or active explicit grant against DB on every read.
- [x] Owners alone grant/revoke the fictional organization's access; audit access/sharing without content.
- [x] UI keeps urgent guidance before login; shows synthetic identity and denied/unavailable states.
- [x] HTTP tests prove cross-user denial, absent/revoked/expired/wrong-org grants, role denial, invalid/expired sessions and truthful unavailable behavior.
- [x] Run lint/typecheck/tests/build and privacy/migration regressions; record actual results in docs/TASKS.md.
- [x] Stop task services and preserve working data; commit/push only reviewed project files.

Done means demonstrable seeded demo login and backend access denial; this is
local synthetic role simulation, not production identity verification.
Next: T04 controlled case creation/uploads and original-byte preservation.


## Actual verification

- T02 merged into develop as 9e64df1 after its full checks passed again.
- T03: 15 regular tests (4 infrastructure, 7 API/fixture/session, 4 UI) passed;
  9 additional real-PostgreSQL HTTP authorization tests passed.
- Lint, typecheck, both builds, all 21 private-file probes and db:verify passed.
- Browser: seeded Victim A login, owned case read, and denial for Victim B's case
  observed. Earlier details disappeared before the denied read. Screenshot capture
  was unavailable; no screenshot artifact is claimed.
- Initial parseEnv TypeScript optional-value mismatch was corrected before passing checks.
- Temporary DB/sentinel removed; development processes and database stopped;
  persistent seeded volume retained. Demo sessions invalidated by server shutdown.
- This is fictional local role simulation, not production authentication. No real data,
  paid service, upload handler, evidence original, export or TigerGraph result added.

## Next phase — T04 (planned only)

Add victim-owned case creation, bounded PNG/JPEG uploads with content sniffing,
streamed SHA-256, immutable private original storage and metadata/audit events.
Apply CaseScopeGuard before every evidence access and return originals only through
protected routes. Test exact byte/hash preservation, unsupported/oversized files,
cross-user denial, granted analyst retrieval and denial after grant revocation.
Do not enable PDF ingestion without a safe parser, or start OCR (T05) in T04.
