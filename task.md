# Merge latest develop intake wizard

Compare develop c655a57 with current branch. References: AGENTS, SECURITY, API, TASKS, DEMO and existing Savanna contracts.
Files: incoming victim wizard/panels, local intake/submit services, regression tests, merge conflicts and docs.
Definition of done: wizard merged, explicit grants and 20-case scope preserved, no paid services, tests/typecheck/lint/build and both browser modes verified.

- [x] Compare one incoming commit (18 files), identify non-UI backend additions.
- [x] Resolve conflicts; preserve urgent guidance, private drafts and local fonts.
- [x] Keep graph lookup analyst-only; preserve source/grant validation and 20-case cap.
- [x] Verify submit failure/security behavior and updated browser flows.
- [x] Record outcomes, commit and push current branch.

## Actual outcomes (2026-10-30 IST)

49 regular and 41 HTTP integration checks passed; updated real-browser wizard passed on rerun (91 total across completed suites). Lint/typecheck/build/whitespace passed. Composite security run first exposed a removed fixture import, then an ambiguous final button selector; fixed and affected suites rerun. Live Savanna E2E reached query and returned 503; isolated client probe timed out. No live success claimed for this revision. Prior successful live run remains historical.

Preserved explicit sharing and analyst-only graph access with 20-case limit. Submit/export failure retry is tested; concurrent submit/report workflow is not fully atomic and can leave another immutable draft. Local-only fictional name/mobile intake is not identity verification. No AWS/billing, graph/data reload or secrets committed. Working PostgreSQL left running.
