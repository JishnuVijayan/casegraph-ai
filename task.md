# Current task — T08 reviewable draft export

Branch: `feat/t08-draft-export` from develop after T07 merge `feaa544`.
References: AGENTS.md, README.md, REQUIREMENTS, STACK, FREE_SETUP, ARCHITECTURE, DATA_MODEL, API, SECURITY, TASKS, TEST_PLAN and DEMO.

Expected files: export renderer/controller/service, schema/migration, AppModule, React export panel, synthetic rule/HTTP/component tests, wrapper/scripts and docs.

- [x] Generate a frozen versioned printable HTML draft containing chronology, claims, sources, revisions, question answers/unknowns and ingest-hash manifest.
- [x] Enforce case scope for generation/list/download, recheck live grants, and retain audit metadata without content.
- [x] Escape all private strings, prohibit active content/network access, bound output, and persist snapshots privately in PostgreSQL.
- [x] Provide preview and HTML download with browser Print / Save as PDF instructions.
- [x] Verify synthetic export provenance, version preservation after corrections, unknowns, malicious text, authorization and revocation; run checks and record actual results.

Done: a corrected synthetic claim exports with original observation and revision still traceable, UNKNOWN remains visible, manifest hashes match ingest metadata, and revoked access fails. T09 graph setup stays separate.

## Actual results — 2026-10-29 IST

- Added export snapshot migration, authorized versioned generation/list/download, escaped printable renderer and sandboxed UI preview/download. Corrections and unknowns remain traceable.
- `test:exports`: 5 passed; `npm test`: 28 passed; `test:auth`: 9 passed; `test:claims`: 4 passed; `test:clarifications`: 3 passed. Total: 49 tests.
- `lint`, `typecheck`, `build`, `db:migrate`, `db:verify`, `db:generate` (no pending schema changes) and whitespace checks passed. DB verifier tested six migrations and 16 tables/indexes with repeated seed preservation.
- Initial concurrency test exposed nested-connection pool starvation; same-transaction scope recheck fixed it, concurrent version and auth tests passed on rerun.
- Storage smoke passed 21 HTTP probes and asset scan. Test DB/files and smoke sentinel/servers removed. Containers stopped; final status empty; working volume preserved.
- Limits: browser Print / Save as PDF manual path; no browser/print E2E, original embedding or reauthentication, offline-copy revocation or automatic retention. T09 TigerGraph setup is next.
