#!/usr/bin/env bash
# Runs on the app EC2 as ec2-user (or via sudo where noted). Expects secrets already in /opt/casegraph/secrets/.
set -euo pipefail

APP_ROOT=/opt/casegraph/app
SECRETS=/opt/casegraph/secrets
BRANCH="${CASEGRAPH_GIT_BRANCH:-feat/aws-24h-demo}"
REPO_URL="${CASEGRAPH_GIT_REPO:-https://github.com/JishnuVijayan/casegraph-ai.git}"

if [[ ! -f "$SECRETS/github.token" ]]; then
  echo "Missing $SECRETS/github.token" >&2
  exit 1
fi
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
# shellcheck disable=SC1091
set -a; source "$SECRETS/app.env"; set +a

echo "==> Installing packages"
sudo dnf install -y docker git nodejs20 npm jq curl tar
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user || true

if ! command -v node >/dev/null || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
  sudo dnf install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  echo "==> Installing Caddy"
  sudo dnf install -y 'dnf-command(copr)'
  sudo dnf copr enable -y @caddy/caddy
  sudo dnf install -y caddy
fi

echo "==> Cloning application (token not echoed)"
sudo mkdir -p /opt/casegraph
sudo chown ec2-user:ec2-user /opt/casegraph
TOKEN="$(tr -d '[:space:]' < "$SECRETS/github.token")"
rm -rf "$APP_ROOT"
AUTH_EXTRA="AUTHORIZATION: bearer ${TOKEN}"
git -c http.extraHeader="$AUTH_EXTRA" clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_ROOT"
unset TOKEN AUTH_EXTRA
cd "$APP_ROOT"

echo "==> npm ci + build"
npm ci
npm run build -w @casegraph/api
npm run build -w @casegraph/web

echo "==> Evidence + Postgres"
mkdir -p "$APP_ROOT/.local/evidence"
chmod 700 "$APP_ROOT/.local" "$APP_ROOT/.local/evidence"
install -m 600 "$SECRETS/app.env" "$APP_ROOT/.env"
# TigerGraph app token for Nest
if [[ -f "$SECRETS/tigergraph-app.token" ]]; then
  install -m 600 "$SECRETS/tigergraph-app.token" "$APP_ROOT/.local/tigergraph-app.token"
fi

cp "$APP_ROOT/infra/aws/deploy/docker-compose.app.yaml" /opt/casegraph/docker-compose.app.yaml
# shellcheck disable=SC1091
set -a; source "$SECRETS/app.env"; set +a
sudo docker compose -f /opt/casegraph/docker-compose.app.yaml --env-file "$SECRETS/app.env" up -d
sleep 5
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

echo "==> Caddy"
ACME_EMAIL="${CADDY_ACME_EMAIL:-demo@${PUBLIC_HOST}}"
sudo mkdir -p /etc/caddy
sudo cp "$APP_ROOT/infra/aws/deploy/Caddyfile" /etc/caddy/Caddyfile
echo "PUBLIC_HOST=${PUBLIC_HOST}" | sudo tee /etc/caddy/caddy.env >/dev/null
echo "CADDY_ACME_EMAIL=${ACME_EMAIL}" | sudo tee -a /etc/caddy/caddy.env >/dev/null
if [[ ! -f /etc/systemd/system/caddy.service.d/override.conf ]]; then
  sudo mkdir -p /etc/systemd/system/caddy.service.d
  printf '%s\n' '[Service]' 'EnvironmentFile=/etc/caddy/caddy.env' | sudo tee /etc/systemd/system/caddy.service.d/override.conf >/dev/null
fi
sudo systemctl daemon-reload
sudo systemctl enable --now caddy
sudo systemctl restart caddy

echo "==> Done. Public host: https://${PUBLIC_HOST}"
