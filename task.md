# Integrate develop acd8d43 UX and automatic preparation

References: AGENTS, SECURITY, DATA_MODEL, API, TASKS and current demo runbook.
Expected files: incoming prepare/upload/report UI, backend preparation and retention safeguards, tests and merge docs.
Definition of done: resolve merge, preserve HTTPS/authorization/provenance/original history, verify local and available live checks, record outcomes and push.

- [x] Compare 38 changed files and identify provenance, time and destructive-cascade issues.
- [x] Integrate new UI with explicit sharing, synthetic badge and 20-case scope.
- [x] Verify source-bound preparation, conservative timestamps and referenced evidence retention.
- [x] Run checks, document actual results, commit and push.

Actual results: 56 regular, 43 HTTP integration and 1 real-browser scenario passed (100 distinct checks; parser tests repeated in test:prepare counted once). Lint/typecheck/build/whitespace passed. Required-live query returned 503; no live pass claimed. Original/claim/revision retention and source-kind corrections verified. Working data/graph untouched; isolated test resources cleaned and existing PostgreSQL left running. See docs/TASKS.md for failures, fixes and remaining limits.
