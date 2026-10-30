# AWS working-demo runbook (HHGOA, $20 cap)

**Region:** `ap-south-1`  
**Budget:** hard stop **$20** total. Prefer stopping EC2 whenever idle.  
**App hosting:** keep NestJS/React/Postgres **local**. AWS is for TigerGraph EC2 + Textract + Bedrock only.

## Before you spend money

1. Create IAM user `casegraph-demo` (not root) with Textract, Bedrock invoke, and EC2 rights.
2. Enable a cheap Bedrock model in `ap-south-1` (Nova Micro/Lite or Claude Haiku if available).
3. Create key pair `casegraph-tg-aps1` and note your public IP for the SSH security group.
4. Set billing alarms at **$15** and **$20**.
5. Install AWS CLI v2 and run `aws configure` (region `ap-south-1`). **Never commit keys.**

## Feature flags (process env / ignored `.env`)

```bash
AWS_REGION=ap-south-1
# Core services: all default to true. Set false only for offline work or tests.
TEXTRACT_ENABLED=true
BEDROCK_ENABLED=true
BEDROCK_MODEL_ID=amazon.nova-micro-v1:0
# TigerGraph via SSH tunnel only (default on):
TIGERGRAPH_ENABLED=true
TIGERGRAPH_LOCAL_PORT=14240
```

Tokens: `.local/tigergraph-app.token` and `.local/tigergraph.token` (mode `0600`).

## EC2 TigerGraph (short-lived)

```bash
# After AWS CLI works:
npm run aws:tg:create    # t3.xlarge + SG SSH-only; prints instance id / DNS
npm run aws:tg:status
# SSH in, install Docker, follow infra/TIGERGRAPH.md + graph/README.md
ssh -N -L 14240:127.0.0.1:14240 ec2-user@<PUBLIC_DNS>
npm run graph:verify-live
npm run dev:demo   # preflight checks Textract, Bedrock and the tunnel; aborts if one is down

npm run aws:tg:stop      # when not rehearsing
npm run aws:tg:start
npm run aws:tg:destroy   # end of demo — reclaim budget
```

Do **not** open port `14240` publicly.

## Cost triage if spend rises

Textract, Bedrock and TigerGraph are core; turn them off only to save budget, and expect degraded behavior:

1. `BEDROCK_ENABLED=false` (deterministic clarification wording remains).
2. `TEXTRACT_ENABLED=false` (Tesseract fallback, lower OCR quality).
3. `npm run aws:tg:stop` / `destroy`.

## Demo path

See [`DEMO.md`](DEMO.md) Act 1–5 with `/` victim filing and `/officer` similar-case search over the live tunnel.
