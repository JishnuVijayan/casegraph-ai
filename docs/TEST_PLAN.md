# Testing and Evaluation Plan

Use **synthetic fixtures only**. Never represent controlled examples as proof of improved real police investigations or recovered money.

## Automated unit tests
- Normalization: Indian rupee amounts, timezone-aware timestamps, phone/UPI/reference formats; distinguish missing from invalid.
- Hash: SHA-256 matches original bytes; duplicate ingestion preserves source immutability.
- Extraction: source region maps to exact OCR text, not a synthesized description.
- Clarification: conflicting values trigger a question; unknown responses remain unknown.
- Export: supported claim attached to source, unsupported claim marked uncertain.
- Path formatting: every returned graph edge has an evidence reference and synthetic/authorized label.

## Integration tests
- Upload and view authorized artifact; reject oversized and unsupported uploads.
- User A cannot fetch B's case or files; analyst grant permits only intended case; revoked grant blocks next request.
- Graph query uses actual installed GSQL query, returns expected controlled path, and no unrelated private nodes.
- If TigerGraph isn't running, API returns 503/error status; UI doesn't claim live graph success.
- Local OCR isn't available -> explicit pending/manual review state.

## Evaluation dataset
- Minimum 20 seed cases for functionality + separate labeled evaluation examples.
- At least five correct source-linked extracted claims and five difficult examples (blur, crop, ambiguity, conflicts).
- Multi-hop true connection and benign common-host/shared-text examples.
- Malicious document text containing instruction attempts.

## Measurements (do not pre-fill with success numbers)
| Metric | Definition | Result |
|---|---|---|
| Source attribution correctness | Correct source artifact/span / evaluated extracted claims | Not measured |
| Extracted value precision | Correct extracted values / all extracted values | Not measured |
| Contradiction recall | Identified true contradictions / all true contradictions | Not measured |
| Wrong accusation count | Cases inaccurately labeled same culprit | Not measured |
| Unsupported export claims | Statements without appropriate provenance or uncertainty label | Not measured |
| Review time | Human evaluation under comparable conditions | Not measured |
| Accessibility checks | Navigable by keyboard, readable labels, large click targets | Not measured |

## Manual demo acceptance
1. Upload six fictional files out of order; inspect correct source/highlight.
2. Tell a conflicting payment time; see clarification instead of silently choosing.
3. Resolve or leave unanswered and export with traceable status.
4. Analyst performs actual TigerGraph path query; verifies edge evidence and benign look-alike.
5. Test revoked authorization and unavailable integration.

**Licensing note:** TigerGraph Community Edition is free but its 2026 license restricts benchmarking. Do not run or publish TigerGraph speed/throughput benchmarks under that license without appropriate permission; focus on functional correctness and authorized demonstrations. See `docs/FREE_SETUP.md`.

## T12 browser automation commands

- `npm run test:e2e`: isolated real Chrome/PostgreSQL/Tesseract reporting flow with
  TigerGraph disabled; asserts 503/unavailable, never substitutes a path.
- `npm run test:e2e:live`: same flow plus required actual TigerGraph path/source/
  review and revocation checks through the configured private loopback/tunnel. No
  silent skip or mocked response in this mode; future deployment is still pending.

See [E2E runbook](../e2e/README.md) for prerequisites, fixed isolated ports, temporary
DB/file ownership, cleanup, credential privacy and observed coverage. Browser test
success in default mode must not be recorded as installed-query E2E acceptance.

## T13 security regression command

With local PostgreSQL, Chrome and Tesseract available, run `npm run test:security`.
It includes existing HTTP denial/tamper/invalid-upload/unavailable-service coverage,
new adversarial parser/export tests, and actual browser hostile-text/OCR checks.
Default browser graph mode remains disabled; live graph tests still require deployment.
This command expects PostgreSQL already running; stop it afterward with infra:down.
