#!/usr/bin/env node

/**
 * Transparent websocket proxy for Kick's Pusher endpoint.
 *
 * Usage:
 *   1. cd tools && npm install http-proxy ws
 *   2. node kick-ws-proxy.js            # or set PORT=3900 node kick-ws-proxy.js
 *   3. Point your client at ws://localhost:3900/app/... (same path/query as Kick)
 *
 * The proxy simply forwards the connection to wss://ws-us2.pusher.com while fixing
 * the Origin header so Kick/Pusher accepts the request. Frames are relayed verbatim.
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const httpProxy = require('http-proxy');

const LISTEN_PORT = Number(process.env.PORT || 3900);
const LISTEN_HOST = process.env.HOST || '0.0.0.0';
const TARGET_HOST = process.env.KICK_WS_HOST || 'ws-us2.pusher.com';
const TARGET_ORIGIN = process.env.KICK_ORIGIN || 'https://kick.com';
const TLS_CERT_PATH = process.env.TLS_CERT_PATH;
const TLS_KEY_PATH = process.env.TLS_KEY_PATH;
const TLS_CA_PATH = process.env.TLS_CA_PATH;
const TLS_RELOAD_INTERVAL_MS = Number(process.env.TLS_RELOAD_INTERVAL_MS || 12 * 60 * 60 * 1000); // 12 hours
const ALLOWED_ORIGINS = parseList(process.env.ALLOWED_ORIGINS) || [
  'https://socialstream.ninja',
  'https://beta.socialstream.ninja',
  'https://kick.socialstream.ninja',
  'http://socialstream.ninja',
  'http://beta.socialstream.ninja'
];

const proxy = httpProxy.createProxyServer({
  target: `https://${TARGET_HOST}`,
  ws: true,
  secure: true,
  changeOrigin: true,
  agent: new https.Agent({ keepAlive: true }),
  headers: { origin: TARGET_ORIGIN }
});

const tlsOptions = loadTlsOptions();
const useTls = Boolean(tlsOptions);

const server = (useTls ? https.createServer({ ...tlsOptions }, handleRequest) : http.createServer(handleRequest));

if (useTls && TLS_RELOAD_INTERVAL_MS > 0 && Number.isFinite(TLS_RELOAD_INTERVAL_MS)) {
  scheduleTlsReload(server, TLS_RELOAD_INTERVAL_MS);
}

function handleRequest(req, res) {
  if (!isRequestAllowed(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden\n');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Kick websocket proxy running\n');
}

server.on('upgrade', (req, socket, head) => {
  if (!req.url || !req.url.startsWith('/app/')) {
    socket.destroy();
    return;
  }

  if (!isRequestAllowed(req)) {
    rejectSocket(socket, '403 Forbidden');
    return;
  }

  req.headers.origin = TARGET_ORIGIN;

  proxy.ws(req, socket, head, (err) => {
    console.error('[kick-ws-proxy] upgrade failed:', err?.message || err);
    try { socket.destroy(); } catch (_) {}
  });
});

proxy.on('error', (err) => {
  console.error('[kick-ws-proxy] proxy error:', err?.message || err);
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  const scheme = useTls ? 'wss' : 'ws';
  console.log(`[kick-ws-proxy] listening on ${scheme}://${LISTEN_HOST}:${LISTEN_PORT}`);
  console.log(`[kick-ws-proxy] forwarding to wss://${TARGET_HOST}`);
  if (ALLOWED_ORIGINS.length) {
    console.log('[kick-ws-proxy] allowed origins:', ALLOWED_ORIGINS.join(', '));
  } else {
    console.log('[kick-ws-proxy] allowed origins: <none specified – blocking all>');
  }
  if (useTls) {
    console.log('[kick-ws-proxy] TLS enabled; certificates will reload automatically');
  } else {
    console.log('[kick-ws-proxy] TLS disabled (provide TLS_CERT_PATH and TLS_KEY_PATH to enable)');
  }
});

function parseList(value) {
  if (!value) return null;
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.toLowerCase());
}

function normalizeOrigin(origin) {
  if (!origin) return '';
  if (origin === 'null') return 'null';
  try {
    const url = new URL(origin);
    const protocol = url.protocol.toLowerCase();
    const host = url.host.toLowerCase();
    return `${protocol}//${host}`;
  } catch (_) {
    return origin.toLowerCase();
  }
}

function isRequestAllowed(req) {
  if (!ALLOWED_ORIGINS.length) {
    return false;
  }

  // Allow wildcard
  if (ALLOWED_ORIGINS.includes('*')) {
    return true;
  }

  const originHeader = normalizeOrigin(req.headers.origin || req.headers.referer);
  if (originHeader && ALLOWED_ORIGINS.includes(originHeader)) {
    return true;
  }

  console.warn('[kick-ws-proxy] blocked request from origin:', req.headers.origin || '<none>');
  return false;
}

function rejectSocket(socket, statusLine = '403 Forbidden') {
  try {
    socket.write(`HTTP/1.1 ${statusLine}\r\nConnection: close\r\n\r\n`);
  } catch (_) {}
  try {
    socket.destroy();
  } catch (_) {}
}

function loadTlsOptions() {
  if (!TLS_CERT_PATH || !TLS_KEY_PATH) {
    return null;
  }
  try {
    const key = fs.readFileSync(TLS_KEY_PATH);
    const cert = fs.readFileSync(TLS_CERT_PATH);
    const ca = TLS_CA_PATH ? fs.readFileSync(TLS_CA_PATH) : undefined;
    const options = { key, cert };
    if (ca) {
      options.ca = ca;
    }
    return options;
  } catch (err) {
    console.error('[kick-ws-proxy] failed to read TLS files:', err?.message || err);
    return null;
  }
}

function scheduleTlsReload(serverInstance, intervalMs) {
  let lastFingerprint = null;

  const reload = () => {
    const updated = loadTlsOptions();
    if (!updated) {
      return;
    }
    const fingerprint = createFingerprint(updated);
    if (fingerprint === lastFingerprint) {
      return;
    }
    try {
      serverInstance.setSecureContext(toSecureContextOptions(updated));
      lastFingerprint = fingerprint;
      console.log('[kick-ws-proxy] reloaded TLS certificates at', new Date().toISOString());
    } catch (err) {
      console.error('[kick-ws-proxy] failed to reload TLS context:', err?.message || err);
    }
  };

  // Capture initial fingerprint
  const initial = loadTlsOptions();
  if (initial) {
    lastFingerprint = createFingerprint(initial);
  }

  setInterval(reload, intervalMs).unref();

  // Watch for filesystem changes to accelerate reloads
  [TLS_CERT_PATH, TLS_KEY_PATH, TLS_CA_PATH]
    .filter(Boolean)
    .forEach((filePath) => {
      try {
        fs.watch(filePath, { persistent: false }, () => reload());
      } catch (err) {
        // Watching a symlink can fail; ignore but keep interval-based reloads
      }
    });
}

function createFingerprint(options) {
  const hash = crypto.createHash('sha256');
  if (options.key) {
    hash.update(Buffer.isBuffer(options.key) ? options.key : Buffer.from(String(options.key)));
  }
  if (options.cert) {
    hash.update(Buffer.isBuffer(options.cert) ? options.cert : Buffer.from(String(options.cert)));
  }
  if (options.ca) {
    const caEntries = Array.isArray(options.ca) ? options.ca : [options.ca];
    caEntries.forEach((entry) => {
      hash.update(Buffer.isBuffer(entry) ? entry : Buffer.from(String(entry)));
    });
  }
  return hash.digest('hex');
}

function toSecureContextOptions(options) {
  const { key, cert, ca } = options;
  return ca ? { key, cert, ca } : { key, cert };
}
