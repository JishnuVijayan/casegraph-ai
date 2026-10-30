#!/usr/bin/env bash
# Runs on the app EC2 as ec2-user (or via sudo where noted). Expects secrets already in /opt/casegraph/secrets/.
set -euo pipefail
exec > >(tee -a /tmp/casegraph-install.log) 2>&1

APP_ROOT=/opt/casegraph/app
SECRETS=/opt/casegraph/secrets
BRANCH="${CASEGRAPH_GIT_BRANCH:-main}"
REPO_URL="${CASEGRAPH_GIT_REPO:-https://github.com/JishnuVijayan/casegraph-ai.git}"
CADDY_VERSION="${CADDY_VERSION:-2.9.1}"

if [[ ! -f "$SECRETS/app.env" ]]; then
  echo "Missing $SECRETS/app.env" >&2
  exit 1
fi
if [[ ! -f "$SECRETS/duckdns.domain" ]]; then
  echo "Missing $SECRETS/duckdns.domain" >&2
  exit 1
fi

PUBLIC_HOST="$(tr -d '[:space:]' < "$SECRETS/duckdns.domain")"
export PUBLIC_HOST
# Load secrets for Postgres/etc, but never keep NODE_ENV=production in this shell —
# it makes `npm ci` omit typescript and breaks `tsc`.
# shellcheck disable=SC1091
set -a; source "$SECRETS/app.env"; set +a
unset NODE_ENV

echo "==> Installing packages"
# Amazon Linux 2023 ships curl-minimal; do NOT install the full `curl` package (conflicts).
sudo dnf install -y docker git jq tar gzip
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user || true

if ! command -v node >/dev/null || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
  echo "==> Installing Node.js 22 (NodeSource)"
  curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
  sudo dnf install -y nodejs
fi
command -v npm >/dev/null || { echo "npm missing after Node install" >&2; exit 1; }
node -v
npm -v

if ! command -v caddy >/dev/null; then
  echo "==> Installing Caddy ${CADDY_VERSION} binary (no COPR — AL2023 incompatible)"
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64) CADDY_ARCH=amd64 ;;
    aarch64) CADDY_ARCH=arm64 ;;
    *) echo "Unsupported arch $ARCH" >&2; exit 1 ;;
  esac
  TMP="$(mktemp -d)"
  curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_${CADDY_ARCH}.tar.gz" \
    | tar -xz -C "$TMP" caddy
  sudo install -m 755 "$TMP/caddy" /usr/bin/caddy
  rm -rf "$TMP"
  if ! id caddy >/dev/null 2>&1; then
    sudo useradd --system --home /var/lib/caddy --shell /usr/sbin/nologin caddy || true
  fi
  sudo mkdir -p /etc/caddy /var/lib/caddy /var/log/caddy
  sudo chown -R caddy:caddy /var/lib/caddy /var/log/caddy || true
  if [[ ! -f /etc/systemd/system/caddy.service ]]; then
    sudo tee /etc/systemd/system/caddy.service >/dev/null <<'UNIT'
[Unit]
Description=Caddy
Documentation=https://caddyserver.com/docs/
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
EnvironmentFile=-/etc/caddy/caddy.env
ExecStart=/usr/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
LimitNOFILE=1048576
LimitNPROC=512
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
UNIT
  fi
fi
caddy version

echo "==> Cloning public repo ${REPO_URL} (branch ${BRANCH})"
sudo mkdir -p /opt/casegraph
sudo chown ec2-user:ec2-user /opt/casegraph
rm -rf "$APP_ROOT"
GIT_TERMINAL_PROMPT=0 git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_ROOT"
cd "$APP_ROOT"

echo "==> npm ci + build"
npm ci
npm run build -w @casegraph/api
npm run build -w @casegraph/web

echo "==> Evidence + Postgres"
mkdir -p "$APP_ROOT/.local/evidence"
chmod 700 "$APP_ROOT/.local" "$APP_ROOT/.local/evidence"
install -m 600 "$SECRETS/app.env" "$APP_ROOT/.env"
if [[ -f "$SECRETS/tigergraph-app.token" ]]; then
  install -m 600 "$SECRETS/tigergraph-app.token" "$APP_ROOT/.local/tigergraph-app.token"
fi

# AL2023 docker often has no Compose plugin — run Postgres directly (loopback only).
echo "==> Starting Postgres container (127.0.0.1:55432)"
set -a; source "$SECRETS/app.env"; set +a
unset NODE_ENV
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "POSTGRES_PASSWORD missing in app.env" >&2
  exit 1
fi
sudo docker rm -f casegraph-postgres >/dev/null 2>&1 || true
sudo docker volume create casegraph-pgdata >/dev/null
sudo docker run -d --name casegraph-postgres --restart unless-stopped \
  -e POSTGRES_USER=casegraph \
  -e POSTGRES_DB=casegraph \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 \
  -p 127.0.0.1:55432:5432 \
  -v casegraph-pgdata:/var/lib/postgresql/data \
  postgres:17-alpine
# First boot pulls+initdb can take >40s; wait for the role, then the DB.
ready=0
for i in $(seq 1 120); do
  if sudo docker exec casegraph-postgres pg_isready -U casegraph >/dev/null 2>&1 \
    && sudo docker exec casegraph-postgres pg_isready -U casegraph -d casegraph >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" != 1 ]]; then
  echo "Postgres did not become ready in time" >&2
  sudo docker logs casegraph-postgres >&2 || true
  exit 1
fi
sudo docker exec casegraph-postgres pg_isready -U casegraph -d casegraph

cd "$APP_ROOT"
npm run db:migrate
npm run seed:synthetic || true

echo "==> systemd units"
sudo install -m 644 "$APP_ROOT/infra/aws/deploy/casegraph-api.service" /etc/systemd/system/casegraph-api.service
sudo install -m 644 "$APP_ROOT/infra/aws/deploy/casegraph-tg-tunnel.service" /etc/systemd/system/casegraph-tg-tunnel.service

if [[ -f "$SECRETS/tg.pem" && -f "$SECRETS/tunnel.env" ]]; then
  sudo systemctl enable casegraph-tg-tunnel.service
  sudo systemctl restart casegraph-tg-tunnel.service
fi

sudo systemctl daemon-reload
sudo systemctl enable casegraph-api.service
sudo systemctl restart casegraph-api.service

echo "==> Caddy config"
ACME_EMAIL="${CADDY_ACME_EMAIL:-demo@${PUBLIC_HOST}}"
sudo mkdir -p /etc/caddy
sudo cp "$APP_ROOT/infra/aws/deploy/Caddyfile" /etc/caddy/Caddyfile
# Caddy runs as user caddy — needs read on web dist
sudo chmod -R a+rX "$APP_ROOT/apps/web/dist"
echo "PUBLIC_HOST=${PUBLIC_HOST}" | sudo tee /etc/caddy/caddy.env >/dev/null
echo "CADDY_ACME_EMAIL=${ACME_EMAIL}" | sudo tee -a /etc/caddy/caddy.env >/dev/null
sudo mkdir -p /etc/systemd/system/caddy.service.d
printf '%s\n' '[Service]' 'EnvironmentFile=/etc/caddy/caddy.env' | sudo tee /etc/systemd/system/caddy.service.d/override.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now caddy
sudo systemctl restart caddy

echo "==> Done. Public host: https://${PUBLIC_HOST}"
