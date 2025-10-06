#!/usr/bin/env bash

set -euo pipefail

SERVICE_NAME="kick-ws-proxy"
SCRIPT_PATH="${SCRIPT_PATH:-/root/kick-ws-proxy.js}"
WORKING_DIR="$(dirname "$SCRIPT_PATH")"
ENV_FILE="/etc/kick-ws-proxy.env"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

DEFAULT_PORT="${PORT:-3900}"
DEFAULT_HOST="${HOST:-0.0.0.0}"
DEFAULT_ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://socialstream.ninja,https://beta.socialstream.ninja}"
DEFAULT_WS_HOST="${KICK_WS_HOST:-ws-us2.pusher.com}"
DEFAULT_ORIGIN="${KICK_ORIGIN:-https://kick.com}"
DEFAULT_DOMAIN="${CERTBOT_DOMAIN:-kick.socialstream.ninja}"
DEFAULT_TLS_CERT_PATH="${TLS_CERT_PATH:-/etc/letsencrypt/live/${DEFAULT_DOMAIN}/fullchain.pem}"
DEFAULT_TLS_KEY_PATH="${TLS_KEY_PATH:-/etc/letsencrypt/live/${DEFAULT_DOMAIN}/privkey.pem}"
DEFAULT_TLS_CA_PATH="${TLS_CA_PATH:-}"
DEFAULT_TLS_RELOAD_MS="${TLS_RELOAD_INTERVAL_MS:-43200000}"

if [[ $EUID -ne 0 ]]; then
  echo "[install] please run as root" >&2
  exit 1
fi

if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "[install] unable to find script at $SCRIPT_PATH" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[install] Node.js is required but not found in PATH" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[install] npm is required but not found in PATH" >&2
  exit 1
fi

echo "[install] ensuring Node dependencies (http-proxy) are installed"
npm install --prefix "$WORKING_DIR" --production http-proxy >/dev/null

if [[ -n "${CERTBOT_DOMAIN:-}" ]]; then
  if [[ -z "${CERTBOT_EMAIL:-}" ]]; then
    echo "[install] set CERTBOT_EMAIL when providing CERTBOT_DOMAIN" >&2
    exit 1
  fi

  if ! command -v certbot >/dev/null 2>&1; then
    echo "[install] installing certbot"
    apt-get update >/dev/null
    apt-get install -y certbot >/dev/null
  fi

  echo "[install] obtaining/renewing certificate for ${CERTBOT_DOMAIN}"
  certbot certonly \
    --standalone \
    --non-interactive \
    --preferred-challenges http \
    --agree-tos \
    --email "${CERTBOT_EMAIL}" \
    -d "${CERTBOT_DOMAIN}"
fi

echo "[install] writing environment file to $ENV_FILE"
cat >"$ENV_FILE" <<EOF
# kick-ws-proxy configuration
PORT=${DEFAULT_PORT}
HOST=${DEFAULT_HOST}
KICK_WS_HOST=${DEFAULT_WS_HOST}
KICK_ORIGIN=${DEFAULT_ORIGIN}
ALLOWED_ORIGINS=${DEFAULT_ALLOWED_ORIGINS}
TLS_CERT_PATH=${DEFAULT_TLS_CERT_PATH}
TLS_KEY_PATH=${DEFAULT_TLS_KEY_PATH}
# TLS_CA_PATH=${DEFAULT_TLS_CA_PATH}
TLS_RELOAD_INTERVAL_MS=${DEFAULT_TLS_RELOAD_MS}
# Add extra configuration overrides above as needed
EOF

NODE_BIN="$(command -v node)"

echo "[install] writing systemd unit to $UNIT_FILE"
cat >"$UNIT_FILE" <<EOF
[Unit]
Description=Kick websocket proxy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${WORKING_DIR}
ExecStart=${NODE_BIN} ${SCRIPT_PATH}
Restart=on-failure
RestartSec=5
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

echo "[install] reloading systemd"
systemctl daemon-reload

echo "[install] enabling service ${SERVICE_NAME}"
systemctl enable --now "$SERVICE_NAME"

echo "[install] service status:" 
systemctl status "$SERVICE_NAME" --no-pager

echo "[install] completed"

