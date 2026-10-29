# T13 security/adversarial verification

Branch: feat/t13-security-tests. References: AGENTS, README, REQUIREMENTS, SECURITY, TEST_PLAN, TASKS and existing API boundaries.
Expected files: adversarial parser/export tests, real-browser hostile-text assertions, security-suite script and observed verification docs.

- [x] Test ambiguous/incorrect OCR and instruction-like text without inference or tool actions.
- [x] Browser-test hostile recollection/export markup as inert text with no external requests.
- [x] Run authorization, upload, OCR, export and investigation adversarial regressions plus browser flow.
- [x] Record observed evidence and live TigerGraph limits honestly.

Done for local scope: repeatable denial, inert content, preserved unknowns and truthful unavailable graph. Live graph adversarial acceptance remains pending deployment.

## Actual results — 2026-10-29 IST

T12 merged/pushed to develop as `38820b8`. Added three adversarial parser/export tests, hostile uploaded-image OCR and browser/export inert-markup assertions, plus `test:security` orchestration. `test:security` passed 42 regular tests, 38 HTTP integration tests and one browser scenario (81 total). Final expanded hostile-upload browser scenario passed on rerun. Lint/typecheck/build/whitespace checks passed. Temporary DB/files/servers cleaned; PostgreSQL stopped, status empty, working volume preserved.

No production behavior was changed. Live TigerGraph scope/query adversarial checks remain pending EC2; graph transport response tests are explicitly mocked and disabled-client unavailability is real. No vulnerability audit, penetration test certification or real-user safety guarantee is claimed. T14–T16 are optional; deployment/live acceptance for T09–T12 remains outstanding.
