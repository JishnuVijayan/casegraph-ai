# Current task — T07 deterministic questions

Branch: `feat/t07-questions` from develop (T06 merge `d0c80e4`; main merge `233d3aa`).

References: AGENTS.md, README.md, REQUIREMENTS, STACK, FREE_SETUP, API, DATA_MODEL, SECURITY, TEST_PLAN and TASKS.

Expected files: clarification rules/controller/service, schema and migration, AppModule, question review UI, synthetic rule/HTTP/component tests, test wrapper and docs.

- [x] Detect missing payment reference and amount/time disagreements within an explicitly linked payment event.
- [x] Persist source snapshots and stable question identity; preserve historical answers and mark superseded questions.
- [x] Owner generates/questions answers with ANSWERED or UNKNOWN; granted analysts read only; backend scopes every operation.
- [x] Show one focused open question at a time with source context and UNKNOWN option.
- [x] Run relevant checks and record actual results.

Done: a conflicting synthetic payment asks a focused source-linked question, an UNKNOWN answer persists without changing claims, and unauthorized access is denied. T08 export remains next.

## Actual results — 2026-10-29 IST

- Added deterministic rules, protected refresh/read/answer endpoints, source snapshots and stable fingerprints; superseded/answered questions retain history and reject overwrites.
- Added migration `0004_clear_ezekiel_stane.sql`; `db:migrate` and `db:verify` passed. Fresh/repeated five-migration verification, 16 tables/indexes and seed preservation passed; temporary DB removed.
- `npm test`: 27 passed (4 infrastructure, 13 API, 10 web). `test:clarifications`: 3 passed; `test:claims`: 4 passed; `test:auth`: 9 passed. T07 tests cover source snapshots, stable IDs, conflicting amounts/times, separate payments, equivalent timestamps, invalid/ambiguous dates, UNKNOWN, immutable answers, stale snapshots, cross-case denial, analyst write denial and revoked-grant reads.
- `lint`, `typecheck`, `build`, `db:generate` (no pending schema changes), and `git diff --check` passed. Local containers stopped; final status empty. Synthetic temporary files and DBs removed, working volume preserved.
- Limits: questions require manually linked payment events; no semantic event matching, uncertain time inference, Jev, paid API or automatic claim correction. No browser E2E or new storage/OCR smoke run for T07.
- Next unblocked task: T08 reviewable draft export.
