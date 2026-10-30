# AWS working-demo runbook (HHGOA, $20 cap)

**Region:** `ap-south-1`  
**Budget:** hard stop **$20** total. Prefer stopping EC2 whenever idle.  
**Core AWS services:** TigerGraph on EC2, Textract, Bedrock.  
**Optional public HTTPS demo:** second app EC2 + DuckDNS + Caddy (see below).

## Before you spend money

1. Create IAM user `casegraph-demo` (not root) with Textract, Bedrock invoke, and EC2 rights.
2. Enable a cheap Bedrock model in `ap-south-1` (Nova Micro/Lite or Claude Haiku if available).
3. Create key pair `casegraph-tg-aps1` and place the PEM at `.local/casegraph-tg-aps1.pem` (`0600`).
4. Set billing alarms at **$15** and **$20**.
5. Install AWS CLI v2 and run `aws configure` (region `ap-south-1`). **Never commit keys.**

## Feature flags (process env / ignored `.env`)

```bash
AWS_REGION=ap-south-1
# Core services: all default to true. Set false only for offline work or tests.
TEXTRACT_ENABLED=true
BEDROCK_ENABLED=true
BEDROCK_MODEL_ID=apac.amazon.nova-pro-v1:0
TIGERGRAPH_ENABLED=true
TIGERGRAPH_LOCAL_PORT=14240
```

Tokens: `.local/tigergraph-app.token` (mode `0600`). Prefer `aws configure` for AWS keys — do not put them in Claude settings or git.

## Local laptop path (default)

```bash
npm run aws:tg:start
npm run aws:tg:harden-sg   # SSH operator+/app only; never open 14240
ssh -i .local/casegraph-tg-aps1.pem -N -L 14240:127.0.0.1:14240 \
  ec2-user@$(jq -r .publicDns .local/aws-tg-ec2.json)
npm run graph:verify-live
npm run dev:demo
npm run aws:tg:stop      # when idle
```

## Public HTTPS demo (DuckDNS)

Hosts Nest + React + Postgres + Caddy on a **second** EC2. TigerGraph stays on the existing box; the app reaches it only via an SSH tunnel to `127.0.0.1:14240` (port **never** public).

### Security (required)

| Surface | Exposure |
|---|---|
| App :80 / :443 | Public (demo UI only). HTTPS + HSTS via Caddy. |
| App :22 | Operator public IP `/32` only (refreshed on start). |
| App Postgres / Nest | Loopback only on the app instance. |
| TG :14240 | **No inbound rule.** |
| TG :22 | Operator `/32` + app security group only. |
| AWS keys / TG token / DuckDNS token | Server or `.local/` only — **never** in the SPA or `VITE_*`. |

Website users can use the product through your API; they **cannot** extract Bedrock, Textract, or TigerGraph credentials.

### One-time setup

1. Create a free host at [DuckDNS](https://www.duckdns.org) (e.g. `casegraph-hhgoa.duckdns.org`).
2. Store secrets (all `0600`, gitignored under `.local/`):

```bash
echo 'casegraph-hhgoa.duckdns.org' > .local/duckdns.domain
echo 'YOUR_DUCKDNS_TOKEN' > .local/duckdns.token
chmod 600 .local/duckdns.domain .local/duckdns.token
```

App code is cloned from the **public** repo `https://github.com/JishnuVijayan/casegraph-ai.git` branch **`main`** (no GitHub token). Override with `CASEGRAPH_GIT_BRANCH` / `CASEGRAPH_GIT_REPO` if needed.

3. Ensure `.env` has a strong `POSTGRES_PASSWORD` (32–128) — used on the server DB.
4. Export AWS keys in the shell that runs bootstrap (copied only into server `app.env` mode `0600`, never into the SPA):

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=ap-south-1
```

5. Create / harden instances:

```bash
npm run aws:tg:start          # or create once
npm run aws:app:create        # t3.medium; SG 80/443 + SSH /32
npm run aws:tg:harden-sg
npm run aws:demo:bootstrap    # clone from GitHub, Caddy, migrate, seed
```

Bootstrap clones the public repo on branch `main` (no GitHub token).

### Day-to-day (billing control)

```bash
npm run aws:demo:start    # start BOTH EC2s, refresh SSH CIDRs, update DuckDNS, print HTTPS URL
# share the printed https://….duckdns.org link
npm run aws:demo:stop     # stop BOTH EC2s — stop compute billing
npm run aws:demo:status
npm run aws:demo:url
```

After the hackathon: `npm run aws:app:destroy` and `npm run aws:tg:destroy`; rotate AWS keys.

### npm helpers

| Script | Purpose |
|---|---|
| `aws:app:create\|start\|stop\|status\|destroy\|refresh-ssh` | App EC2 |
| `aws:tg:*` + `aws:tg:harden-sg` | TigerGraph EC2 |
| `aws:demo:bootstrap` | First install on app EC2 |
| `aws:demo:start\|stop\|status\|url\|duckdns` | Combined control |

Do **not** open port `14240` publicly. Do **not** commit `.local/`, PEMs, or tokens.

## Cost triage if spend rises

1. `npm run aws:demo:stop` (or at least `aws:tg:stop` / `aws:app:stop`).
2. `BEDROCK_ENABLED=false` / `TEXTRACT_ENABLED=false` only for offline work (degraded).
3. `aws:app:destroy` / `aws:tg:destroy` after the final demo.

## Demo path

See [`DEMO.md`](DEMO.md). Local: `/` victim filing and `/officer` over the tunnel. Public: same paths on the DuckDNS HTTPS URL when `aws:demo:start` is up.
