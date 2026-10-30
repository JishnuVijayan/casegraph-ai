#!/usr/bin/env bash
# Resume after clone/build/postgres are already done on the app EC2.
set -euo pipefail
exec > >(tee -a /tmp/casegraph-finish.log) 2>&1

APP_ROOT=/opt/casegraph/app
SECRETS=/opt/casegraph/secrets
PUBLIC_HOST="$(tr -d '[:space:]' < "$SECRETS/duckdns.domain")"
export PUBLIC_HOST

sudo docker exec casegraph-postgres pg_isready -U casegraph -d casegraph

cd "$APP_ROOT"
set -a; source "$SECRETS/app.env"; set +a
unset NODE_ENV
install -m 600 "$SECRETS/app.env" "$APP_ROOT/.env"
mkdir -p "$APP_ROOT/.local/evidence"
chmod 700 "$APP_ROOT/.local" "$APP_ROOT/.local/evidence"
if [[ -f "$SECRETS/tigergraph-app.token" ]]; then
  install -m 600 "$SECRETS/tigergraph-app.token" "$APP_ROOT/.local/tigergraph-app.token"
fi

echo "==> db:migrate + seed"
npm run db:migrate
npm run seed:synthetic || true

echo "==> systemd units"
sudo install -m 644 "$APP_ROOT/infra/aws/deploy/casegraph-api.service" /etc/systemd/system/casegraph-api.service
sudo install -m 644 "$APP_ROOT/infra/aws/deploy/casegraph-tg-tunnel.service" /etc/systemd/system/casegraph-tg-tunnel.service

if [[ -f "$SECRETS/tg.pem" && -f "$SECRETS/tunnel.env" ]]; then
  chmod 600 "$SECRETS/tg.pem" "$SECRETS/tunnel.env"
  sudo systemctl enable casegraph-tg-tunnel.service
  sudo systemctl restart casegraph-tg-tunnel.service || true
fi

sudo systemctl daemon-reload
sudo systemctl enable casegraph-api.service
sudo systemctl restart casegraph-api.service

echo "==> Caddy"
ACME_EMAIL="${CADDY_ACME_EMAIL:-demo@${PUBLIC_HOST}}"
if ! id caddy >/dev/null 2>&1; then
  sudo useradd --system --home /var/lib/caddy --shell /usr/sbin/nologin caddy || true
fi
sudo mkdir -p /etc/caddy /var/lib/caddy /var/log/caddy /etc/systemd/system/caddy.service.d
sudo chown -R caddy:caddy /var/lib/caddy /var/log/caddy || true
if [[ ! -f /etc/systemd/system/caddy.service ]]; then
  sudo tee /etc/systemd/system/caddy.service >/dev/null <<'UNIT'
[Unit]
Description=Caddy
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
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
UNIT
fi
sudo cp "$APP_ROOT/infra/aws/deploy/Caddyfile" /etc/caddy/Caddyfile
sudo chmod -R a+rX "$APP_ROOT/apps/web/dist"
# Allow caddy user to traverse to web dist
sudo chmod a+rx /opt /opt/casegraph /opt/casegraph/app /opt/casegraph/app/apps /opt/casegraph/app/apps/web
echo "PUBLIC_HOST=${PUBLIC_HOST}" | sudo tee /etc/caddy/caddy.env >/dev/null
echo "CADDY_ACME_EMAIL=${ACME_EMAIL}" | sudo tee -a /etc/caddy/caddy.env >/dev/null
printf '%s\n' '[Service]' 'EnvironmentFile=/etc/caddy/caddy.env' | sudo tee /etc/systemd/system/caddy.service.d/override.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now caddy
sudo systemctl restart caddy

sleep 2
systemctl is-active casegraph-api
systemctl is-active caddy
curl -fsS -o /dev/null -w "local_api=%{http_code}\n" http://127.0.0.1:3000/api/v1/auth/me || true
echo "Done. https://${PUBLIC_HOST}"
