# TikTok Proxy for Social Stream Ninja (Web-only mode)

This lightweight Node.js service hosts a [TikTok Chat Reader](https://github.com/zerodytrash/TikTok-Chat-Reader)-compatible Socket.IO bridge so the `webonlymode` TikTok plugin can relay chat and gift events without a browser extension.

## Prerequisites

- Node.js **18** or newer (matches the requirements of `tiktok-live-connector`).
- Network access from the server to TikTok LIVE endpoints (ports 80 / 443).

## Installation

```bash
cd webonlymode/tiktok-proxy
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

1. Run it behind HTTPS (use a reverse proxy such as Caddy, Nginx, or a PaaS load balancer).
2. Optionally customise the CORS and Socket.IO origin restrictions inside `server.js` if you want to lock the proxy down to specific domains.
3. Keep the process alive with a supervisor (PM2, Docker, systemd, etc.).

## Troubleshooting

- The proxy relays TikTok connection status via the `tiktokConnected` / `tiktokDisconnected` Socket.IO events. Watch the Node logs for additional context if a connection fails.
- TikTok frequently rate limits guests. If you hit rate limits, wait several minutes or deploy the proxy closer to your audience.
- The plugin normalises usernames (removing preceding `@`). Enter the raw channel slug when prompted.

## Development tips

- Run `npm install --save-dev nodemon` and change the `start` script to `nodemon server.js` if you want automatic restarts while modifying the server.
- You can extend the event list in `server.js` if you need more TikTok event types (`share`, `emote`, etc.) — they simply proxy through to Socket.IO.
