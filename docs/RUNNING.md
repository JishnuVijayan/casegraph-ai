# Running CaseGraph (for a new collaborator)

The app (web, API, Postgres) runs on your laptop. AWS is used for three core services: **Textract** (reading screenshots), **Bedrock** (Nova Pro, the AI) and **TigerGraph on EC2** (the case network). Voice typing uses **Sarvam AI** (optional; falls back to the browser's own dictation).

## 1. Install
Node 20+, npm, Docker, Tesseract (`brew install tesseract`, used only as an image-reading fallback), AWS CLI v2, `jq`.

```bash
npm install
npm run infra:init     # writes a git-ignored .env with a random local DB password
npm run infra:up       # Postgres in Docker + private evidence folder (.local/evidence)
npm run db:migrate
npm run seed:synthetic # ~240 fictional complaints so "similar cases" has history
```

## 2. AWS credentials: do NOT put them in `.env`
The API uses the standard AWS credential chain, so just configure the CLI once:

```bash
aws configure          # region: ap-south-1, output: json
aws sts get-caller-identity   # should print your IAM user
```
Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) or `AWS_PROFILE` also work. Never commit keys, `.env`, `.local/` or any `.pem`.

The IAM user (not root) needs: `textract:DetectDocumentText`, `bedrock:InvokeModel`, and the EC2/security-group actions the helper scripts use (create, start, stop, describe). One-time console step: **enable model access for Amazon Nova Pro (and Lite) in Bedrock, region ap-south-1.** Models are used through the `apac.` inference profiles.

`.env` only holds app settings (all optional except the DB values `infra:init` writes):
```
AWS_REGION=ap-south-1
BEDROCK_MODEL_ID=apac.amazon.nova-pro-v1:0
SARVAM_API_KEY=            # voice typing; leave empty to use browser dictation
```
`TEXTRACT_ENABLED`, `BEDROCK_ENABLED`, `TIGERGRAPH_ENABLED` default to **true**. Set one to `false` only for offline work or tests.

## 3. TigerGraph (the case network)
Two ways:

**A. Use the team's existing EC2 instance.** Ask the owner for these files and put them in `.local/` (mode `0600`; they are secrets and are never in Git): `aws-tg-ec2.json`, `casegraph-tg-aps1.pem`, `tigergraph-app.token`, `tigergraph-db.password`. Your public IP must be allowed on port 22 in the instance's security group (the owner changes that rule; it only allows one `/32`).

```bash
npm run aws:tg:start
# wait ~2 minutes, then start the graph container if it is stopped:
ssh -i .local/casegraph-tg-aps1.pem ec2-user@$(jq -r .publicDns .local/aws-tg-ec2.json) 'sg docker -c "docker start casegraph-graph-tigergraph-1"'
# tunnel (leave running; never open port 14240 publicly)
ssh -i .local/casegraph-tg-aps1.pem -N -L 14240:127.0.0.1:14240 ec2-user@$(jq -r .publicDns .local/aws-tg-ec2.json)
curl -s http://127.0.0.1:14240/api/ping      # -> pong
```

**B. Your own instance.** `npm run aws:tg:create` makes the EC2 box and security group (needs an EC2 key pair named `casegraph-tg-aps1` and your IP). Installing TigerGraph on it is manual: follow `infra/TIGERGRAPH.md` and `docs/AWS_DEMO.md`. That path has not been re-run from scratch recently. Then:
```bash
npm run graph:install-v2   # creates graph CaseGraphV2 and the similar_cases query
npm run graph:sync         # pushes the submitted complaints from Postgres into the graph
```
The app token in `.local/tigergraph-app.token` must be a token for graph `CaseGraphV2`.

## 4. Run
```bash
npm run dev:demo      # API :3000 + web :5173
```
- Complainants: http://localhost:5173 (name + mobile, no password)
- Officers: http://localhost:5173/officer

On start the API checks Textract, Bedrock and TigerGraph and **exits if one is down**. For UI-only work: `ALLOW_DEGRADED=true npm run dev:demo` (similar cases then say "unavailable"; nothing is invented).

## 5. Tests
```bash
npm test                      # unit + infra + graph + web
npm run test:intake           # also: test:officer, test:exports, test:evidence, test:auth ...
npm run test:e2e              # full flow against the RUNNING stack (needs AWS + tunnel)
```
Unit and integration tests run offline with fake AWS clients.

## 6. Cost and shutdown (budget cap $20, region ap-south-1)
Textract and Bedrock bill per call; EC2 bills per hour while running.
```bash
npm run aws:tg:stop       # when idle
npm run aws:tg:destroy    # end of the project
```
Set billing alarms at $15 and $20.
