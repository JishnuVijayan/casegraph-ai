# T12 isolated browser workflow

Default mode is **real Chrome + real local NestJS/Vite + real PostgreSQL + real
Tesseract**, with TigerGraph explicitly disabled. No Playwright request interception,
API fulfillment or graph fixture provider is used. It proves the local reporting
workflow and honest graph-unavailable behavior. It does not prove a live graph path.
T12 remains incomplete until live mode succeeds on the future secured host/tunnel.

## Prerequisites

- Node 22.12+ and `npm ci`; tested with Node 24.15.0.
- Local Docker PostgreSQL started via `npm run infra:init && npm run infra:up`.
  The configured casegraph user must create/drop isolated databases (as in db:verify).
- Google Chrome installed on the test machine (channel chrome); tested Chrome
  156.0.8078.49 with pinned @playwright/test 1.64.1. No browser binary was downloaded
  by the dependency installation.
- Tesseract English installed; tested 5.5.4. OCR absence/error is a failure in this
  workflow, not a skipped or substituted result. The controlled images use clear
  uniform-size English text; this is not an OCR accuracy benchmark.
- Free loopback ports 13000 and 15173. Existing servers are refused, never reused.

```bash
npm run infra:up
npm run test:e2e
npm run infra:down
```

Each run creates a uniquely generated `casegraph_t12_<uuid>` database, migrates and
seeds it twice, and generates six synthetic PNGs in a private temporary directory.
It starts the unchanged application controller/guard stack using test-only provider
overrides for that database, private storage, fictional login and graph mode. API
listens on 127.0.0.1:13000; Vite on 127.0.0.1:15173. The normal dev server/working
database/private originals are not used or reset. Test bootstraps refuse a database
name outside the generated test prefix and do not add production HTTP control routes.

The browser signs in and operates the actual UI through:

1. Official urgent guidance before uploads; role login and scoped seeded case read.
2. Six generated files uploaded out of chronological order; two real OCR runs,
   source crops loaded as actual images and observed claims saved.
3. Correction to an interpreted amount with original observation and before/after
   revision visible; a conflicting recollection linked to the same payment.
4. Date-only timeline entered late-event-first, displayed chronologically;
   clarification answered UNKNOWN with history retained.
5. Sandboxed draft preview, HTML download SHA-256 comparison, source references,
   original observation/edited values/unknowns and original-byte download equality.
6. Real owner/analyst UI grants; foreign-user evidence/export requests denied.
7. Default mode: query returns unavailable, with no displayed graph success or path;
   revoked access denies case read and clears prior case UI. Finally sign-out clears
   the upload view.

There are no live-data/financial-accuracy/real-police outcome claims. The graph demo
fixture is authored separately and is not falsely attributed to the uploaded images.

## Required live graph mode (future, not yet passed)

Finish T09/T10/T11's actual host installation/query/authentication checks first.
Use the current bundle including EvidenceRef from_id/to_id and get_lead_sources.
Set up the existing loopback/SSH tunnel and a separate private mode-0600
`.local/tigergraph-app.token` with the required query privileges. No token goes in
Git, command arguments, a browser variable or test logs.

```bash
TIGERGRAPH_LOCAL_PORT=14240 npm run test:e2e:live
```

This is a required-live mode, not an optional skipped test. It refuses a missing
app token before database/server creation and will fail if actual graph queries
cannot return the expected source-bound synthetic path. It runs the entire browser
workflow, requires a real NEEDS_REVIEW path, opens actual saved source metadata,
records human review and revokes the target grant. The next source read must fail,
remove both path/source UI and withhold the saved snapshot. Backend scope comes
from the freshly seeded PostgreSQL database plus real UI grants.

The wrapper sets graph mode explicitly so an ambient TIGERGRAPH_ENABLED variable
cannot enable it in default mode. The live mode does not start or provision a
TigerGraph instance, create cloud resources, accept a license, change security
groups, install graph queries or purchase hosting. Check budget/license/demo use and
private networking separately when deploying. The manual browser Print / Save as
PDF dialog is not exercised; the rendered printable HTML and download are tested.

## Cleanup and output

The wrapper stops only its own child processes and removes its generated database
and temporary synthetic originals/fixtures, including after normal test failures.
It preserves the working database, named volume and local configuration. SIGINT/
SIGTERM request cleanup; an abrupt process/host kill can leave an owned test DB or
files for deliberate cleanup (never reset the working casegraph database).

Playwright traces/video/screenshots are disabled to avoid persisting bearer sessions
or case data. Test output/error context is confined to ignored `.local/e2e-artifacts`;
only synthetic data is admitted by this harness. Cleanup errors return nonzero and
identify only the generated database name. A later run replaces Playwright-owned
artifacts; retain any desired failure evidence first. Timing output describes the browser test only; no TigerGraph benchmark is run.

`npm run typecheck` now also checks the Playwright TypeScript. `npm test` retains
its lightweight unit/component suites; browser requirements are explicit in the
separate `test:e2e` commands. PostgreSQL HTTP suites are also separate as before.
