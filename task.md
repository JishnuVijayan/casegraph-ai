# Current task — T10 synthetic graph schema and bounded query

Branch: `feat/t10-graph-schema-query` from develop after T09 preparation merged as `20fbcca`. T09 runtime remains incomplete. User plans a future demo EC2 deployment; no AWS resources or billing action authorized now.

References: AGENTS, README, REQUIREMENTS, STACK, FREE_SETUP, SECURITY, DATA_MODEL, API, TEST_PLAN, DEMO, DECISIONS and official TigerGraph 4.2 GSQL schema/loading/query docs.
Expected files: graph schema/query, deterministic fixture/bundle generator, offline contract tests, bounded token-authenticated live verification CLI, package scripts and deployment/task docs.

- [x] Define seven vertex types and source-bearing edges in an isolated graph; preserve source/verification distinctions.
- [x] Build 20 fictional cases with the expected Kochi/Bengaluru shared-layer account, unrelated Goa case and benign generic-text/shared-host look-alikes.
- [x] Write bounded four-hop installed GSQL query filtering both case endpoints and edge provenance by trusted case scope.
- [x] Prepare deterministic CSV/loading bundle and repeatable seed commands without destructive resets.
- [x] Add offline fixture/authorization contract tests and live-server functional verifier; run available checks.
- [ ] Compile/install/load/run on compatible TigerGraph and record actual results (pending future host). Keep T10 unchecked until verified live.

Done: actual installed query returns the scoped synthetic path with source refs and excludes benign/private cases. Offline results cannot satisfy that live requirement. T11 backend/analyst integration stays separate.

## Observed results — 2026-10-29 IST

- T09 preparation merged and pushed to develop as `20fbcca`; T10 is a separate source branch. Main unchanged this task.
- `graph:bundle` passed twice with identical output. Bundle refuses differing files; the first task-generated revision was retained as ignored `.local/graph-t10-bundle-initial` before regeneration. No existing files were overwritten.
- `graph:test`: 4 offline contract tests passed; `npm test`: 35 passed total (7 infrastructure, 4 graph offline contracts, 13 API, 11 web). Lint/typecheck and whitespace check passed. One unused test import caught by lint was removed; rerun passed.
- `graph:verify-live` returned expected UNAVAILABLE_OR_VERIFICATION_FAILED / liveVerified false, exit 1 (runtime/token absent). No graph result, compilation, seed execution or live path is claimed.
- Candidate bundle counts: 20 cases, 20 VPAs, 19 accounts, 20 phones, 20 handles, 19 domains, 100 fixture sources; 20 of each primary report/settlement edge plus 100 source-support edges. These are generated fixture counts, not observed database counts.
- T09/T10 live acceptance pending future compatible EC2 deployment. No AWS resources, paid API, instance purchase, remote connection, security-group changes or benchmarks. No backend graph integration (T11).
