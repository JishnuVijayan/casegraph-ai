# Current task — T06 timeline and source-linked claims

Updated: 2026-10-29 IST. Branch: `feat/t06-timeline-claims` from updated `develop` (`07fa125` includes T05).

References: `AGENTS.md`, `README.md`, `docs/REQUIREMENTS.md`, `docs/STACK.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/TASKS.md`, and `docs/TEST_PLAN.md`.

Expected changes: T06-only Drizzle migration for claim-to-OCR-region reference and timeline precision constraints; protected claim/revision/timeline endpoints and deterministic amount normalization; victim review UI plus analyst read-only timeline; isolated synthetic PostgreSQL HTTP tests, component tests, and documentation. Preserve original files and T05 extraction output. No T07 clarification rules or T08 exports.

- [x] Promote a stored OCR amount region into an `OBSERVED_IN_UPLOAD`, `UNVERIFIED` claim; derive its text/source coordinates from persisted OCR, never request-supplied values.
- [x] Let a victim add a `VICTIM_RECOLLECTION` claim without implying external confirmation; normalize simple INR amounts deterministically.
- [x] List source-backed claims with original region and revision history; correct only the interpreted current value by appending before/after history without changing source or verification status.
- [x] Create/list timeline events linked to one or more claims from the same case; accept exact zoned timestamp, date-only, or explicit unknown time and preserve uncertainty.
- [x] Enforce owner-only writes, owner/granted-analyst reads, cross-case denial and immediate revocation for all claim/timeline routes.
- [x] Test source-region derivation, correction history, normalization, date precision/unknown, event-claim linkage, bad IDs, role/IDOR/revocation, and UI provenance labels using synthetic data.
- [x] Run migrations, all existing regression suites, T06 integration and component tests, lint/typecheck/build/storage checks; update `docs/TASKS.md` with actual results.

Definition of done: a synthetic OCR amount can be saved as a source-linked observation, a victim correction leaves the source and an append-only revision trace, and a chronological event links to its supporting same-case claim(s). Analyst access remains read-only and scoped. T07 clarification questions and T08 exports remain separate.

## Actual results (2026-10-29 IST)

- `npm run db:generate`: passed; no schema changes remain after migration `0003_tiresome_sentinels.sql`.
- `npm run db:migrate`, `npm run seed:synthetic`, `npm run db:verify`: passed; fresh/repeat migration, 16 tables/indexes, synthetic seed preservation, cross-case constraints and timeline precision checks verified; temporary verification DB removed.
- `npm run test:claims`: 4 HTTP/PostgreSQL integration tests passed. `npm run test:auth`: 9 passed. `npm run test:evidence`: 8 passed. `npm run test:ocr`: 4 passed.
- `npm test`: 24 tests passed (4 infrastructure, 11 API, 9 web). Frontend component tests: 9 passed across 4 files.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed. `npm run infra:smoke:storage`: passed 21 HTTP probes and frontend asset scan; temporary servers and synthetic sentinel were cleaned up.
- Database verification first failed on an outdated synthetic timeline fixture. The fixture was corrected to an allowed event type and the full verifier passed on rerun. No tests or failures are represented as passed without a successful rerun.
- Limits: no browser visual E2E, OCR language guarantees, bank verification, T07 question generation, T08 export or graph integration. Only synthetic records were used.
- Next unblocked task: **T07 Questions**.
