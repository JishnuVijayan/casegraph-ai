# Savanna application integration

Branch: feat/savanna-https-integration
References: AGENTS, README, REQUIREMENTS, STACK, FREE_SETUP, SECURITY, API, ARCHITECTURE, DATA_MODEL, TEST_PLAN, TASKS, DEMO, DECISIONS and user handoff.

Gap: application scope/source/snapshot/UI workflow exists; transport only supported loopback and GSQL edge syntax differed from user-reported Savanna success.

- [x] Inspect existing workflow and preserve graph/data and authorization.
- [x] Synchronize V2 edge syntax without changing query contracts.
- [x] Add bounded HTTPS workspace transport and controlled credential failure.
- [x] Add observed-result regression fixtures and negative transport/config tests.
- [x] Run checks and document actual outcomes, configuration and remaining live acceptance.

Definition of done: checks pass, no graph mutation or fallback, public integration explicitly pending without local endpoint/credential.

## Actual results

47 regular checks, 6 investigation HTTP checks and 1 real-browser unavailable-mode workflow passed. Lint/typecheck/build/whitespace passed. Private endpoint/credential absent; live Savanna connection and revised local GSQL compilation NOT tested. Existing graph/bundle unchanged. Test resources cleaned; PostgreSQL stopped and working volume preserved. See docs/TASKS.md and docs/tigergraph-savanna-integration.md for evidence and demo commands.
