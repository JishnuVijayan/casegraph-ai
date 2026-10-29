# Current task — T04 cases and immutable evidence originals

Updated: 2026-10-29 IST. Status: T04 complete and verified on feat/t04-case-uploads.

References: README, REQUIREMENTS, STACK, API, DATA_MODEL, SECURITY and TEST_PLAN.
Expected changes: cases/evidence services and controllers, private storage,
React intake/retrieval UI, isolated PostgreSQL/filesystem integration tests and docs.

- [x] Create victim-owned synthetic drafts; reject owner/role injection.
- [x] Accept one bounded PNG/JPEG through streaming multipart after authorization.
- [x] Validate declared MIME, signature and bounded image decode; reject PDF/SVG/invalid content.
- [x] Preserve exact bytes, streamed SHA-256, UUID source ID and metadata; never overwrite originals.
- [x] Serve/list only after live case authorization; audit creation/upload/read.
- [x] UI creation/upload/source manifest/protected original download after urgent guidance.
- [x] Test bytes/hash, duplicate preservation, IDOR, revoked grants, limits and failure cleanup.
- [x] Run existing checks and regressions; record actual results; stop services.

Limits: synthetic only; no OCR, safe PDF parser, malware scan, graph or exports.
Done: authorized retrieval returns exact original bytes; invalid/unauthorized uploads
leave no committed metadata or original file. Next is T05 OCR/provenance.


## Actual results — 2026-10-29 IST

- Lint/typecheck passed; both builds passed within infra:smoke:storage.
- npm test: 18 tests passed (4 infrastructure, 7 API/session/fixtures, 7 frontend).
- test:evidence: 8 isolated PostgreSQL/filesystem HTTP tests passed.
- test:auth: 9 PostgreSQL HTTP regression tests passed.
- All 21 non-disclosure probes, frontend asset scan and db:verify passed.
- Oversize test initially exposed an EBADF stream teardown that masked 413 as 503;
  preserved the limit exception and handled already-closed descriptors; rerun passed.
- Frontend file-input test needed explicit form submission because JSDOM's injected
  files do not update native input validity. The corrected component test passed.
- No migration needed; T02 evidence/audit tables reused. No OCR/PDF/graph implementation.
- Services stopped and temporary DB/files removed. Working volume/originals preserved.
- Limits: local synthetic-only demo, no malware scan, no browser E2E run, Node 22 and
  dependency audit unverified. Crashes/uncertain commits may leave private orphan
  files requiring deliberate reconciliation. Administrators can still alter files/DB.

Next unblocked task: T05 local Tesseract OCR with extraction version/errors and
source text spans/bounding boxes. Do not start it as part of T04.
