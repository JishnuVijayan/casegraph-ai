# Claude Code — CaseGraph AI

Follow the project agent contract in `@AGENTS.md`.

**Current branch context:** `feat/aws-24h-demo` — local app + core AWS services: TigerGraph on EC2, Textract, Bedrock (all ON by default; `false` opts out). When docs conflict: safety and factual accuracy first; `README.md` and `docs/REQUIREMENTS.md` define the product; record inconsistencies in `docs/DECISIONS.md`.

## How the system works (simple)

Two users: **victim** (`/`) files a complaint; **officer** (`/officer`) reviews submitted ones.

| Piece | What it does |
|---|---|
| **Web** (`apps/web`, React/Vite) | UI only — no DB/graph credentials |
| **API** (`apps/api`, NestJS) | Auth/scope, uploads, OCR, claims, questions, prepare/submit, exports, investigations |
| **PostgreSQL** (Compose via `infra:up`) | Source of truth — cases, evidence metadata, claims, answers, grants, export drafts, audit |
| **Private evidence dir** (`.local/evidence`) | Original uploaded bytes + SHA-256 |
| **AWS Textract** (core) | Primary OCR for screenshots |
| **AWS Bedrock LLM** (core) | Plain-language question wording; rules stay deterministic |
| **TigerGraph** (core) | Similar-case / investigation graph over SSH tunnel — never invent paths if down |
| **AWS EC2** (core) | Hosts TigerGraph only — app stays on your laptop |
| **Tesseract** (local fallback) | Used per request only if Textract fails |

**Flow (v2):** name+mobile → tell the story (text / live voice) + add screenshots, PDFs, documents → AI (Textract + Bedrock Nova Pro) builds summary, dated timeline, facts, entities and asks up to 5 missing-detail questions → complainant can download their own report any time → **Submit** (`SUBMITTED`, reference `CG-YYYY-NNNNNN`) → case + entities upserted to TigerGraph `CaseGraphV2`, `similar_cases` finds earlier complaints sharing phone/UPI/account/URL → officer inbox, case file, compare view, dossier. Contract: `docs/V2_CONTRACT.md`.

Postgres = case file. TigerGraph = “seen similar patterns?” Textract, Bedrock and TigerGraph are core: the API preflights them at startup and exits if one is down (`ALLOW_DEGRADED=true` overrides).

## Everyday local commands

```bash
npm run infra:up && npm run db:migrate && npm run seed:synthetic
npm run dev:demo          # or: DEMO_MODE=true npm run dev
npm run aws:tg:status     # EC2 state (this branch has aws:tg:* scripts)
```

Full demo script: `docs/DEMO.md`. AWS details: `docs/AWS_DEMO.md`.

## AWS TigerGraph — turn on / off

AWS hosts the core services: short-lived TigerGraph on EC2, plus Textract and Bedrock. Region `ap-south-1`. Hard budget **$20** — stop EC2 whenever idle. Never commit AWS keys, PEM files, or tokens. Prefer `aws configure` for credentials (not Claude settings / committed files).

Instance state: `.local/aws-tg-ec2.json`. SSH key: `.local/casegraph-tg-aps1.pem` (`0600`). Tokens: `.local/tigergraph-app.token` (`0600`).

### Helpers (present on this branch)

```bash
npm run aws:tg:create      # first time only
npm run aws:tg:status
npm run aws:tg:start
npm run aws:tg:stop
npm run aws:tg:tunnel-hint
npm run graph:install-v2  # once per fresh TigerGraph: schema + similar_cases query
npm run graph:sync         # push every submitted Postgres case into the graph
npm run test:e2e           # full flow against the running stack
npm run aws:tg:destroy     # end of demo — reclaim budget
```

### Turn ON (live graph)

If SSH times out, your public IP changed: the EC2 security group only allows one `/32` on port 22. Update that rule yourself (or ask the user to), then retry. If the TigerGraph container is stopped: start `casegraph-graph-tigergraph-1` on the host and wait for `gadmin status` to show everything Online. The app token in `.local/tigergraph-app.token` must be a token for graph `CaseGraphV2`.

1. AWS CLI configured for `ap-south-1` (IAM user, not root). Billing alarms $15 / $20.
2. `npm run aws:tg:start` (or `create` once).
3. Tunnel — do **not** open `14240` publicly:

```bash
ssh -i .local/casegraph-tg-aps1.pem -N -L 14240:127.0.0.1:14240 \
  ec2-user@$(jq -r .publicDns .local/aws-tg-ec2.json)
```

4. Verify + run:

```bash
npm run graph:verify-live
TIGERGRAPH_LOCAL_PORT=14240 npm run dev:demo
```

Textract, Bedrock and TigerGraph are on by default; the API checks them at startup. Model and port:

```bash
BEDROCK_MODEL_ID=apac.amazon.nova-micro-v1:0 TIGERGRAPH_LOCAL_PORT=14240 npm run dev:demo
```

### Turn OFF (idle / end of day)

1. Stop the app (Textract/Bedrock bill per call, so nothing is spent while it is down). Offline-only runs need `TEXTRACT_ENABLED=false BEDROCK_ENABLED=false TIGERGRAPH_ENABLED=false`.
2. Stop the SSH tunnel (Ctrl-C).
3. `npm run aws:tg:stop` — stop EC2 billing burn.
4. After final demo only: `npm run aws:tg:destroy`. Confirm CloudWatch; rotate IAM keys after hackathon.

If a core service fails mid-run: Tesseract fallback for OCR, deterministic question wording, honest unavailable for similar-case leads — never invent graph paths.
