# Claude Code — CaseGraph AI

Follow the project agent contract in `@AGENTS.md`.

**Current branch context:** `feat/aws-24h-demo` — local app + core AWS services: TigerGraph on EC2, Textract, Bedrock (ON by default). Optional public HTTPS demo via a second app EC2 + DuckDNS. When docs conflict: safety first; `README.md` / `docs/REQUIREMENTS.md` define the product; record inconsistencies in `docs/DECISIONS.md`.

## How the system works (simple)

| Piece | What it does |
|---|---|
| **Web** | Victim `/` + officer `/officer` UI — no cloud credentials |
| **API (Nest)** | Auth, uploads, OCR, AI intake, exports, similar-cases |
| **Postgres** | Case file (source of truth) |
| **Evidence dir** | Original uploads + SHA-256 |
| **Textract / Bedrock** | OCR + AI (server-side only; keys never in the browser) |
| **TigerGraph EC2** | Similar-case graph via SSH tunnel — never invent paths if down |
| **App EC2 (optional)** | Public HTTPS demo (Caddy + DuckDNS); stop when idle |

## Everyday local commands

```bash
npm run infra:up && npm run db:migrate && npm run seed:synthetic
npm run aws:tg:start && # SSH tunnel 14240, then:
npm run dev:demo
npm run aws:tg:stop
```

## Public HTTPS demo — one-command billing control

Secrets (gitignored, `0600`): `.local/duckdns.domain`, `.local/duckdns.token`, `.local/casegraph-tg-aps1.pem`, `.local/tigergraph-app.token`.

```bash
# one-time
npm run aws:app:create
npm run aws:tg:harden-sg
npm run aws:demo:bootstrap   # clones public github.com/JishnuVijayan/casegraph-ai (main)

# every rehearsal
npm run aws:demo:start       # starts app + TG EC2, DuckDNS, prints https://…duckdns.org
npm run aws:demo:stop        # stops BOTH instances
```

Only app **80/443** are public. Postgres, Nest, and TigerGraph **14240** stay private. Full runbook: `docs/AWS_DEMO.md`.

## AWS TigerGraph — laptop tunnel

```bash
npm run aws:tg:start
ssh -i .local/casegraph-tg-aps1.pem -N -L 14240:127.0.0.1:14240 \
  ec2-user@$(jq -r .publicDns .local/aws-tg-ec2.json)
npm run graph:verify-live
npm run dev:demo
npm run aws:tg:stop
```

Never open `14240` publicly. Budget **$20** / `ap-south-1`. Rotate any PAT or AWS key that was pasted into chat.
