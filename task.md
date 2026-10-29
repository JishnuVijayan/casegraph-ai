# AWS 24h working-demo (ADR-026)

Docs: AWS_DEMO, DEMO, DECISIONS ADR-026, STACK/FREE_SETUP soft override, DATA_MODEL/graph fixture.
Files: `.env.example`, synthetic bootstrap (50), graph fixture/clusters, `infra/aws/ec2-tigergraph.mjs`, Textract/Bedrock adapters, clarifications essentials rules.
Tests: fixtures/auth unit+integration, graph contracts, clarifications/textract unit, lint/typecheck; live EC2/Textract/Bedrock require user AWS configure.
Done when: docs/flags ready, seed+graph expanded, EC2 scripts present, OCR/LLM feature-flagged with fallbacks, DEMO rehearsal script + teardown checklist.

## Checklist
- [x] ADR-026 + AWS_DEMO + .env.example
- [x] Expand synthetic cases (~50) + enrichment + graph clusters/bundle expectations
- [x] EC2 create/stop/start/destroy + tunnel hint scripts (provision needs AWS CLI/creds)
- [x] Textract adapter + Tesseract fallback
- [x] Bedrock essentials polish gated by rules
- [x] DEMO.md smoke/cost teardown
