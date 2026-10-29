# Fix Savanna workspace hostname validation

References: AGENTS, existing Savanna integration runbook, SECURITY, API and TASKS.
Files: backend graph config, regression tests, integration docs and task logs.
Definition of done: valid multi-label Savanna public origins accepted, unsafe origins still rejected, targeted tests/lint/typecheck/build pass.

- [x] Identify overly narrow single-label hostname validator.
- [x] Accept valid DNS labels beneath .i.tgcloud.io; preserve remaining origin restrictions.
- [x] Run checks and record actual results.

User-reported authenticated inventory returned 218 vertices. No credential used or remote query executed during this fix.

Results: 7 targeted investigation tests passed; lint, full typecheck, build and whitespace passed. Compiled GraphConfig accepted the supplied public hostname without a network request. No live connection or credential test performed.
