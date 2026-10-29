# Integrate develop UI and review demo readiness

References: AGENTS, README, REQUIREMENTS, SECURITY, API, DEMO, TASKS, TEST_PLAN and Savanna integration runbook.
Compared origin/develop f7693dd against current Savanna fix branch. Expected files: split UI and associated tests from develop, safety notice, explicit sharing, docs/task logs.
Definition of done: develop merged, Savanna fixes retained, urgent guidance and deliberate sharing preserved, checks and browser rehearsal pass; six-step capability gaps documented.

- [x] Fetch and compare develop (one UI commit, 24 files).
- [x] Resolve decision-log conflict; preserve both histories and record superseding integration decision.
- [x] Preserve split victim/officer styling; restore urgent guidance and explicit grant/revoke.
- [x] Run regular/security/browser checks and document actual results.
- [x] Commit and push merge to current branch.

## Actual outcomes

Merged develop f7693dd with Savanna fixes retained; one decision-log conflict resolved. Restored urgent guidance and explicit share/revoke; removed remote font load dependency. Final test:security passed 90 checks and independent required-live Savanna browser passed (12.2 s). Lint/typecheck/build/whitespace passed. Browser failures and fixes are documented in docs/TASKS.md; no mocks presented as live proof. Existing PostgreSQL left running and graph/working data preserved.

Demo map: source-linked amount OCR and reviewed chronological events, typed recollections, missing-reference/time/amount clarification, actual seeded graph and draft report work. Spoken input, automatic event/date extraction and new-upload graph projection remain future phases.
