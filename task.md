# Current task — T12 reproducible browser E2E workflow

Branch: `feat/t12-e2e-workflow` from develop after T11 merge. T09/T10/T11 live graph acceptance still pending future compatible host.
Relevant docs: AGENTS, README, REQUIREMENTS, STACK, FREE_SETUP, SECURITY, TASKS, TEST_PLAN, API, DATA_MODEL and DEMO.
Expected changes: isolated E2E server/lifecycle harness, Playwright dependency/config/specs, synthetic image generation, test scripts, ignore rules and verification/deployment docs.

- [x] Start a real local API/frontend against a fresh migrated/seeded temporary PostgreSQL DB and private synthetic evidence storage, never the working DB/server.
- [x] Browser-test urgent guidance, disordered synthetic uploads, real local OCR/source crop, correction/revision, uncertain chronological timeline, UNKNOWN and reviewed export/download/hash integrity.
- [x] Test analyst grants, unavailable graph and revoked access without fixture success.
- [x] Provide an explicit real-graph E2E mode for future installed TigerGraph, with no mock network results and no silent skips in that mode.
- [x] Run relevant checks; clean temporary servers/DB/files and record results.
- [ ] Complete real installed-query E2E acceptance on future host (pending T09–T11; leave T12 unchecked until live path runs).

Done: reproducible browser flow from fresh seed through upload/OCR/correction/export and authorized actual graph/source/review with revocation. Offline/unavailable-mode success does not establish the live graph step.

## Actual results — 2026-10-29 IST

- Merged/pushed T11 into develop as `bbdad9f`; T12 implemented on a separate feature branch. Main unchanged.
- Added pinned @playwright/test 1.64.1 (three free dev packages, no other dependency upgrade/browser download), isolated API/Vite/bootstrap harness and a full browser scenario. Tested Node 24.15.0, Chrome 156.0.8078.49, Tesseract 5.5.4. Node 22 remains untested.
- `test:e2e` passed after correcting a controlled fixture layout and a relative test locator. It ran real OCR/crops, six uploads, source-preserving correction/revision, disordered chronological events, UNKNOWN, export preview/download SHA-256, original-byte equality, cross-user denial, grants, unavailable graph and revoked case access. No API interception or fixture graph provider.
- Initial mixed-size image yielded honest UNKNOWN/no amount, so browser source-button assertion failed; uniform-size clear synthetic text was verified with local Tesseract and the fixture corrected. A form locator incorrectly included an outer ancestor and was fixed. Subsequent full browser runs passed. Product OCR behavior was not changed.
- `npm test`: 39 passed (7 infrastructure, 4 graph contracts, 15 API, 13 web). Browser workflow adds one passed E2E scenario. Lint, typecheck including new E2E TypeScript, production build, dependency listing and whitespace checks passed.
- `test:e2e:live` refused missing private graph runtime/token prerequisite with exit 1 before DB/server creation. No silent skip; actual live path/source/review branch remains unexecuted, so T12 stays unchecked alongside T09–T11 live acceptance.
- Owned E2E servers, temporary migrated/seeded DBs, synthetic files and browser contexts cleaned after successful and failed runs. Local infrastructure stopped; final status empty; working DB/volume/config preserved. Test output remains in ignored private artifacts. No cloud resources or benchmarks.
- Next source phase: T13 security/adversarial tests. Real graph end-to-end acceptance awaits deployment.
