# Current task — T11 analyst investigation workspace

Branch: `feat/t11-analyst-workspace` from develop after merging T10 source preparation. T09/T10 live verification still pending future EC2 host.
References: AGENTS, README, REQUIREMENTS, STACK, FREE_SETUP, ARCHITECTURE, DATA_MODEL, API, SECURITY, TASKS, TEST_PLAN and DEMO.
Expected changes: backend graph client, investigation/lead/source/review guards and service, fixed source GSQL query, analyst React panel, synthetic unit/HTTP/component tests, scripts and docs.

- [x] Execute only fixed installed queries, disabled by default, private server token, loopback/tunnel transport, bounded responses and visible unavailable state.
- [x] Derive current INVESTIGATE scope in backend, validate every path/source, and recheck grants on creation/list/source/review, including revocation while a query runs.
- [x] Persist labeled query snapshots as NEEDS_REVIEW and provide source drilldown plus reviewer decisions.
- [x] Build analyst-only accessible path visual and honest live-query vs saved-snapshot labels; do not invent source uploads.
- [x] Run meaningful mocked-transport authorization tests plus real unavailable-path checks; log actual results.
- [ ] Demonstrate actual installed live query on compatible host (pending T09/T10 deployment; T11 stays unchecked until live evidence).

Done: authorized analyst can execute the installed scoped query and review its paths/sources; victims/READ-only grants and revoked cross-case paths are denied. Offline test fixtures cannot satisfy live acceptance.

## Actual results — 2026-10-29 IST

- Merged/pushed T10 source preparation into develop as `88a55b6`; T11 implemented separately on its feature branch. Main unchanged.
- Added default-disabled fixed graph client; current backend-derived INVESTIGATE scope; strict path/source case/relation/endpoint binding; source-bound saved lead snapshots; source/review endpoints; analyst path visual, drilldown and honest unavailable/history labels.
- Extended still-uninstalled EvidenceRef/schema/CSV and fixed get_lead_sources candidate query. Updated future live verifier; no live graph or cloud resource changed. Regenerated bundle twice identically; old ignored bundle preserved as `.local/graph-t10-bundle-before-t11`.
- `npm test`: 39 passed (7 infrastructure, 4 graph offline, 15 API, 13 web). `test:investigations`: 5 passed with real isolated PostgreSQL and explicitly mocked graph transport. `test:auth`: 9 passed. Total: 53 regular/integration tests; no mock is shipped as a runtime fallback.
- Lint, typecheck, production build and whitespace checks passed. `db:generate`: no pending schema changes; no PostgreSQL migration needed. Storage smoke: 21 HTTP probes plus asset sentinel scan passed; temporary servers/sentinel removed.
- `graph:verify-live`: expected unavailable/nonzero with liveVerified false because runtime/token absent. No GSQL compiler, real query/source fetch, cloud deployment, live demonstration or benchmark was run. T09/T10/T11 remain unchecked pending actual host verification.
- Local infrastructure shut down, final status empty; working volume/config preserved and temporary synthetic test DB/token files removed. No browser visual/E2E run. Next source phase is T12 E2E, with its live graph portion dependent on deployment.
