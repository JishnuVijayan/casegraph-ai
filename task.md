# Current task — T02 database and synthetic seeds

Updated: 2026-10-29 IST. Status: T02 complete and verified; T03 is next.

T01 was reviewed and reverified: lint, typecheck, 7 tests, DB persistence, builds,
and 21 private-file probes passed. `develop` was created from `main` and T01 was
merged using a merge commit. Implementation continues on `feat/t02-database`.
`docs/TASKS.md` is the overall progress/evidence record.

## Scope

Follow README, REQUIREMENTS, STACK, DATA_MODEL, ARCHITECTURE, SECURITY and TEST_PLAN.
Define the canonical PostgreSQL tables in Drizzle, generate/review SQL migrations,
and seed only fictional accounts, one fictional consortium, 20 case placeholders,
and explicit synthetic share-grant examples. Preserve existing demo edits on reseed.
Do not implement authentication, uploads, OCR, exports or live TigerGraph queries.

## Checklist

- [x] Review T01, create develop from main, merge T01, create feature branch.
- [x] Install/lock stable Drizzle ORM/Kit and node-postgres dependencies.
- [x] Add typed schema, foreign keys, required indexes, enums and provenance constraints.
- [x] Generate and review initial SQL migration and its metadata.
- [x] Add local-only db:generate, db:migrate, seed:synthetic and db:verify commands.
- [x] Add deterministic synthetic fixture manifest and transactional insert-only seed.
- [x] Verify fresh migration, second migration no-op, two seed runs, and preserved edits.
- [x] Verify FK/unique/check constraints against a dedicated temporary database.
- [x] Run lint/typecheck/tests/build plus relevant regression smoke checks.
- [x] Update setup/data-model docs, decisions and actual TASKS results; stop services cleanly.
Git delivery: commit reviewed files with a conventional feature commit and push the feature branch; keep T02 separate from develop for review.

## Expected files and acceptance

`apps/api/src/db`, `apps/api/drizzle`, `apps/api/drizzle.config.ts`, package files,
`infra/database.mjs`, `data/synthetic`, setup/data-model/decision/task docs.

Done: PostgreSQL accepts the generated migration repeatedly without schema drift;
seeding creates 1 organization, 3 fictional users and 20 case placeholders without
duplicating or resetting existing rows. Integration checks prove constraints and
idempotence. No credentials in source or logs; no new public data endpoints.
Temporary database cleanup must affect only the test database created by this run.

Next: T03 seeded demo login and server-side authorization, planned separately.


## Observed results

- Develop merge: `29c5a31` includes verified T01; main remains at `a515812`.
- Drizzle generation/review complete; repeat generation reported no schema changes.
- Initial CommonJS `exports` symbol build conflict fixed using `reportExports` without changing SQL table names.
- Fresh/repeated migration passed in a separate temporary database; all 15 tables and required indexes verified.
- Repeated seeds matched full row snapshots; edited case and revoked grant were preserved.
- Nine integrity violations rejected; valid same-case provenance accepted; claim default UNVERIFIED.
- Working local migration twice and seed twice succeeded: one organization, three users, twenty case placeholders, three grants.
- All 9 tests, lint, typecheck, both builds, and all 21 private-file regression probes passed.
- Task services stopped; temporary test DB/sentinel removed; working data volume preserved.
- Remaining limits and command details are in docs/TASKS.md. No T03 work started.
