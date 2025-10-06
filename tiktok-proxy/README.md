# TikTok Proxy for Social Stream Ninja (Web-only mode)

This lightweight Node.js service hosts a [TikTok Chat Reader](https://github.com/zerodytrash/TikTok-Chat-Reader)-compatible Socket.IO bridge so the `lite` TikTok plugin can relay chat and gift events without a browser extension.

## Prerequisites

- Node.js **18** or newer (matches the requirements of `tiktok-live-connector`).
- Network access from the server to TikTok LIVE endpoints (ports 80 / 443).

## Installation

```bash
cd tiktok-proxy
npm install
```

The dependencies are small (`express`, `socket.io`, `tiktok-live-connector`, and security middleware).

## Running locally

```bash
npm start
```

By default the proxy listens on port **8089**. Override the port with the `PORT` environment variable:

```bash
PORT=3001 npm start
```

When the service is running you should see `GET /health` return `{"status":"ok"}` and the Socket.IO endpoint available at `/socket.io/`.

## Pointing the web client

In the Web-only mode UI, open the TikTok plugin panel and set **Proxy server URL** to your service URL, for example:

- `http://localhost:8089`
- `https://your-domain.example.com`

Once saved, clicking **Connect** will instruct the proxy to connect to the configured TikTok username and the chat events will appear in the session.

## Deploying remotely

When exposing the proxy on the public internet:

1. Provide TLS certificates by setting `TLS_CERT_PATH` and `TLS_KEY_PATH` (the server will automatically serve HTTPS and hot-reload the certificates when they change). You can still terminate TLS in front of the proxy if you prefer.
2. Optionally customise the CORS and Socket.IO origin restrictions inside `server.js` if you want to lock the proxy down to specific domains.
3. Keep the process alive with a supervisor (PM2, Docker, systemd, etc.).

### Automated systemd deployment with Certbot

`install.sh` mirrors the Kick websocket proxy setup so you can provision the service with one command on a fresh host. It will:

- Install production dependencies in the directory containing `server.js`.
- Optionally obtain/renew a certificate with Certbot when `CERTBOT_DOMAIN` and `CERTBOT_EMAIL` are provided.
- Write default environment overrides to `/etc/tiktok-proxy.env` (including TLS paths and idle timeout).
- Generate a hardened `tiktok-proxy.service` unit and enable it via systemd.

Example usage (run as root on the target machine):

```bash
export CERTBOT_DOMAIN=tiktok.socialstream.ninja
export CERTBOT_EMAIL=you@example.com
export SCRIPT_PATH=/opt/tiktok-proxy/server.js
bash install.sh
```

Adjust `PORT`, `HOST`, or any other environment variable before running the script to override defaults. After installation, edit `/etc/tiktok-proxy.env` if you need further tweaks and reload the unit (`systemctl restart tiktok-proxy`).

## Troubleshooting

- The proxy relays TikTok connection status via the `tiktokConnected` / `tiktokDisconnected` Socket.IO events. Watch the Node logs for additional context if a connection fails.
- TikTok frequently rate limits guests. If you hit rate limits, wait several minutes or deploy the proxy closer to your audience.
- The plugin normalises usernames (removing preceding `@`). Enter the raw channel slug when prompted.

## Development tips

- Run `npm install --save-dev nodemon` and change the `start` script to `nodemon server.js` if you want automatic restarts while modifying the server.
- You can extend the event list in `server.js` if you need more TikTok event types (`share`, `emote`, etc.) — they simply proxy through to Socket.IO.
