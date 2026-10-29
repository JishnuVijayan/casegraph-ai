# Current task — T05 local OCR and provenance

Updated: 2026-10-29 IST. Branch: `feat/t05-local-ocr` from `develop` after T04 was merged into `develop` and `main`.

References: `README.md`, `docs/REQUIREMENTS.md`, `docs/STACK.md`, `docs/FREE_SETUP.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/TASKS.md`, and `docs/TEST_PLAN.md`.

Expected changes: a Drizzle migration for OCR output regions, bounded local Tesseract adapter and protected extraction endpoints, an image-region review panel, synthetic OCR fixtures/tests, and documentation. Preserve T04 originals and access rules.

- [x] Record engine version, status and safe error code for each extraction run; reruns of the same file/version are idempotent.
- [x] Run Tesseract locally on a verified, authorized original with bounded time, output and process concurrency.
- [x] Save OCR text spans and image coordinates as observed-in-upload candidates only; do not claim bank verification.
- [x] Let an authorized user click a sample amount and inspect the corresponding crop from the exact original.
- [x] Show `UNKNOWN` when text is unreadable and a clear unavailable state when Tesseract is absent.
- [x] Test synthetic sample recognition/provenance, unreadable evidence, denied/revoked access and unavailable OCR.
- [x] Run lint, typecheck, unit/integration/database/storage checks and record actual results in `docs/TASKS.md`.

Definition of done: the synthetic amount opens its true source region, unreadable evidence yields no invented value, all stored regions are bounded to the uploaded image, and authorized access is enforced at every endpoint. T06 timeline and editable claims remain separate.

## Actual results — 2026-10-29 IST

- Local Tesseract 5.5.4 recognized synthetic “INR 2500”; persisted word spans and normalized boxes point to the source image. Candidate amount stays `OBSERVED_IN_UPLOAD` / `UNVERIFIED`; no OCR-derived claim or external verification was created.
- Added protected run/read/crop endpoints and UI source crop preview. Region crops are produced from the hash-verified original after current authorization checks. Run results persist engine/version/status/safe error; same file/version reruns are idempotent.
- Added two Drizzle migrations for extraction regions/output, version uniqueness and DB-level text-span/bounding-box constraints. `db:verify` checked 16 tables and rejected out-of-image boxes and invalid confidence.
- `npm test`: 19 passed; `npm run test:auth`: 9 passed; `npm run test:evidence`: 8 passed; `npm run test:ocr`: 4 passed. Total: 40 tests. `npm run db:verify` passed with three migrations, 16 tables, seed preservation, and bounded OCR span/box constraints. `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run db:generate` (no pending changes) passed. `npm run infra:smoke:storage` passed all 21 HTTP probes and asset scan; its synthetic sentinel and servers were removed. `git diff --check` passed.
- Tesseract missing case returned `FAILED / OCR_UNAVAILABLE`, and later retry with Tesseract installed succeeded. Blank synthetic image produced no regions and `UNKNOWN`. Unauthorized and revoked analyst reads/crops returned 403.
- Test suites use temporary synthetic DBs and files, which were removed. No user evidence was processed or committed.

Limitations: local native OCR has no OS sandbox; input/output/time/process bounds apply. English only; no Malayalam/handwriting, PDF, timeline/claim editing, correction history or background queue. No browser visual E2E; component and HTTP integration coverage is present. No authenticity or bank-verification claim. Node 22 and dependency audit unverified.

Next unblocked task: **T06 timeline and editable claims**.
