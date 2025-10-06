const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const PORT = Number.parseInt(process.env.PORT || '8089', 10);
const HOST = process.env.HOST || '0.0.0.0';
const LOG_PREFIX = '[tiktok-proxy]';
const IDLE_TIMEOUT_MS = Number.parseInt(process.env.IDLE_TIMEOUT_MS || '15000', 10);
const TLS_CERT_PATH = "/etc/letsencrypt/live/tiktok.socialstream.ninja/fullchain.pem";
const TLS_KEY_PATH = "/etc/letsencrypt/live/tiktok.socialstream.ninja/privkey.pem";
const TLS_CA_PATH = process.env.TLS_CA_PATH;
const TLS_RELOAD_INTERVAL_MS = Number.parseInt(process.env.TLS_RELOAD_INTERVAL_MS || '43200000', 10);

const DEFAULT_USER_AGENT = process.env.TIKTOK_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEFAULT_DEVICE_ID = process.env.TIKTOK_DEVICE_ID || (() => {
  if (typeof crypto.randomInt === 'function') {
    const base = BigInt(10) ** BigInt(13);
    const offset = BigInt(crypto.randomInt(0, 9_000_000_000_000));
    return String(base + offset);
  }
  return String(Date.now());
})();

function createClientParams(uniqueId, overrides = {}) {
  const base = {
    aid: Number.parseInt(process.env.TIKTOK_AID || '1988', 10),
    app_name: 'tiktok_web',
    app_language: 'en-US',
    language: 'en',
    region: process.env.TIKTOK_REGION || 'US',
    priority_region: process.env.TIKTOK_PRIORITY_REGION || 'US',
    referer: 'https://www.tiktok.com/',
    user_agent: DEFAULT_USER_AGENT,
    cookie_enabled: true,
    browser_online: true,
    cursor: '',
    screen_width: 1920,
    screen_height: 1080,
    browser_language: 'en-US',
    browser_platform: 'Win32',
    browser_name: 'Mozilla',
    browser_version: '5.0 (Windows NT 10.0; Win64; x64)',
    device_platform: 'web',
    webcast_language: 'en',
    tz_name: process.env.TIKTOK_TZ || 'America/New_York',
    device_id: DEFAULT_DEVICE_ID,
    is_fullscreen: false,
    is_page_visible: true,
    focus_state: true,
    history_len: 3,
    browser_window_width: 1920,
    browser_window_height: 1080,
    os: 'windows'
  };

  if (uniqueId) {
    base.user_unique_id = uniqueId;
  }

  return { ...base, ...(overrides || {}) };
}

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '32kb' }));
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Social Stream TikTok proxy',
    message: 'Ready to accept Socket.IO connections via /socket.io/'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const tlsOptions = loadTlsOptions();
const useTls = Boolean(tlsOptions);

const server = useTls ? https.createServer({ ...tlsOptions }, app) : http.createServer(app);

if (useTls && Number.isFinite(TLS_RELOAD_INTERVAL_MS) && TLS_RELOAD_INTERVAL_MS > 0 && typeof server.setSecureContext === 'function') {
  scheduleTlsReload(server, TLS_RELOAD_INTERVAL_MS);
}

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const streams = new Map();

function normalizeUniqueId(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value)
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function coerceBoolean(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }
  return fallback;
}

function sanitizeConnectOptions(rawOptions = {}, uniqueId) {
  const options = {
    enableExtendedGiftInfo: true,
    processInitialData: false,
    fetchRoomInfo: true,
    clientParams: createClientParams(uniqueId)
  };

  if (!rawOptions || typeof rawOptions !== 'object') {
    return options;
  }

  if ('enableExtendedGiftInfo' in rawOptions) {
    options.enableExtendedGiftInfo = coerceBoolean(rawOptions.enableExtendedGiftInfo, true);
  }
  if ('processInitialData' in rawOptions) {
    options.processInitialData = coerceBoolean(rawOptions.processInitialData, false);
  }
  if ('fetchRoomInfo' in rawOptions) {
    options.fetchRoomInfo = coerceBoolean(rawOptions.fetchRoomInfo, true);
  }
  if (rawOptions.requestSettings && typeof rawOptions.requestSettings === 'object') {
    options.requestSettings = rawOptions.requestSettings;
  }
  if (rawOptions.clientParams && typeof rawOptions.clientParams === 'object') {
    options.clientParams = createClientParams(uniqueId, rawOptions.clientParams);
  }

  return options;
}

function formatExtras(source) {
  if (!source || typeof source !== 'object') {
    return null;
  }
  const extras = {};
  ['code', 'status', 'description', 'info', 'context', 'payload', 'data', 'detail', 'body']
    .forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
        extras[key] = source[key];
      }
    });
  if (Object.keys(extras).length === 0) {
    return null;
  }
  try {
    return JSON.stringify(extras);
  } catch (err) {
    return String(extras);
  }
}

function describeReason(reason, fallback = 'TikTok connection closed.') {
  if (!reason) {
    return fallback;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  if (reason instanceof Error) {
    const message = reason.message || fallback;
    const extras = formatExtras(reason);
    return extras ? `${message} (${extras})` : message;
  }
  if (typeof reason === 'object') {
    const message = typeof reason.message === 'string' && reason.message.trim().length ? reason.message.trim() : null;
    const extras = formatExtras(reason);
    if (message && extras) {
      return `${message} (${extras})`;
    }
    if (message) {
      return message;
    }
    if (extras) {
      return extras;
    }
    try {
      return JSON.stringify(reason);
    } catch (err) {
      return fallback;
    }
  }
  return String(reason);
}

function buildConnectedPayload(uniqueId, state) {
  const payload = { uniqueId };
  if (state && typeof state === 'object') {
    if ('roomId' in state) {
      payload.roomId = state.roomId;
    }
    if ('liveRoomId' in state) {
      payload.liveRoomId = state.liveRoomId;
    }
    if ('roomInfo' in state) {
      payload.roomInfo = state.roomInfo;
    }
    if ('sessionId' in state) {
      payload.sessionId = state.sessionId;
    }
    if ('region' in state) {
      payload.region = state.region;
    }
  }
  return payload;
}

function buildConnectArgs(options = {}) {
  const connectArgs = {};
  if (typeof options.processInitialData === 'boolean') {
    connectArgs.processInitialData = options.processInitialData;
  }
  if (typeof options.fetchRoomInfo === 'boolean') {
    connectArgs.fetchRoomInfo = options.fetchRoomInfo;
  }
  if (typeof options.enableExtendedGiftInfo === 'boolean') {
    connectArgs.enableExtendedGiftInfo = options.enableExtendedGiftInfo;
  }
  if (options.requestSettings) {
    connectArgs.requestSettings = options.requestSettings;
  }
  if (options.clientParams) {
    connectArgs.clientParams = options.clientParams;
  }
  return connectArgs;
}

async function destroyStream(entry, reason) {
  if (!entry || entry.destroyed) {
    return;
  }

  entry.destroyed = true;
  streams.delete(entry.uniqueId);

  if (entry.cleanupTimer) {
    clearTimeout(entry.cleanupTimer);
    entry.cleanupTimer = null;
  }

  entry.listeners.forEach(({ event, handler }) => {
    try {
      if (typeof entry.connection.off === 'function') {
        entry.connection.off(event, handler);
      } else if (typeof entry.connection.removeListener === 'function') {
        entry.connection.removeListener(event, handler);
      }
    } catch (err) {
      // ignore detach errors
    }
  });
  entry.listeners = [];

  try {
    await entry.connection.disconnect();
  } catch (err) {
    console.warn(LOG_PREFIX, 'disconnect failed', entry.uniqueId, err?.message || err);
  }

  if (reason) {
    entry.clients.forEach((socket) => {
      try {
        socket.emit('tiktokDisconnected', reason);
      } catch (err) {
        // ignore
      }
    });
  }

  entry.clients.clear();
  console.info(LOG_PREFIX, 'stream destroyed', entry.uniqueId);
}

function createStream(uniqueId, options = {}) {
  console.info(LOG_PREFIX, 'creating stream', uniqueId);

  const connectionOptions = {
    enableExtendedGiftInfo: options.enableExtendedGiftInfo !== false,
    clientParams: createClientParams(uniqueId, options.clientParams)
  };

  const connection = new WebcastPushConnection(uniqueId, connectionOptions);

  const entry = {
    uniqueId,
    options: { ...options, clientParams: connectionOptions.clientParams },
    connection,
    clients: new Set(),
    listeners: [],
    cleanupTimer: null,
    destroyed: false,
    lastConnectedPayload: null,
    lastDisconnectReason: null,
    connected: false
  };

  const broadcast = (event, payload) => {
    entry.clients.forEach((socket) => {
      try {
        socket.emit(event, payload);
      } catch (err) {
        // ignore client emit issues
      }
    });
  };

  const scheduleCleanup = () => {
    if (entry.destroyed || entry.clients.size > 0 || entry.cleanupTimer) {
      return;
    }
    entry.cleanupTimer = setTimeout(() => {
      entry.cleanupTimer = null;
      destroyStream(entry);
    }, IDLE_TIMEOUT_MS);
  };

  entry.addClient = (socket) => {
    if (entry.destroyed) {
      socket.emit('tiktokDisconnected', 'TikTok proxy stream is no longer available.');
      return;
    }
    if (entry.cleanupTimer) {
      clearTimeout(entry.cleanupTimer);
      entry.cleanupTimer = null;
    }
    entry.clients.add(socket);
    if (entry.lastConnectedPayload) {
      socket.emit('tiktokConnected', entry.lastConnectedPayload);
    } else if (entry.lastDisconnectReason) {
      socket.emit('tiktokDisconnected', entry.lastDisconnectReason);
    }
  };

  entry.removeClient = (socket) => {
    entry.clients.delete(socket);
    if (entry.clients.size === 0) {
      scheduleCleanup();
    }
  };

  entry.touchOptions = (nextOptions = {}) => {
    if (!nextOptions || typeof nextOptions !== 'object') {
      return;
    }
    const merged = { ...entry.options, ...nextOptions };
    if (nextOptions.clientParams && typeof nextOptions.clientParams === 'object') {
      merged.clientParams = createClientParams(uniqueId, nextOptions.clientParams);
    }
    entry.options = merged;
  };

  const addListener = (event, handler) => {
    connection.on(event, handler);
    entry.listeners.push({ event, handler });
  };

  addListener('connected', (state) => {
    entry.connected = true;
    entry.lastDisconnectReason = null;
    entry.lastConnectedPayload = buildConnectedPayload(uniqueId, state);
    broadcast('tiktokConnected', entry.lastConnectedPayload);
  });

  addListener('disconnected', (event) => {
    const reason = describeReason(event, 'TikTok disconnected.');
    entry.connected = false;
    entry.lastDisconnectReason = reason;
    broadcast('tiktokDisconnected', reason);
    scheduleCleanup();
  });

  addListener('streamEnd', () => {
    broadcast('streamEnd');
  });

  addListener('error', (err) => {
    console.error(LOG_PREFIX, 'stream error', uniqueId, err);
    const reason = describeReason(err, 'TikTok connection error.');
    entry.connected = false;
    entry.lastDisconnectReason = reason;
    broadcast('tiktokDisconnected', reason);
    scheduleCleanup();
  });

  ['chat', 'gift', 'social', 'like', 'member', 'question', 'roomUser', 'stats', 'liveIntro', 'envelope', 'subscribe'].forEach((event) => {
    addListener(event, (payload) => {
      broadcast(event, payload);
    });
  });

  (async () => {
    try {
      const state = await connection.connect(buildConnectArgs(entry.options));
      if (!entry.destroyed && !entry.connected) {
        entry.connected = true;
        entry.lastDisconnectReason = null;
        entry.lastConnectedPayload = buildConnectedPayload(uniqueId, state);
        broadcast('tiktokConnected', entry.lastConnectedPayload);
      }
    } catch (err) {
      if (entry.destroyed) {
        return;
      }
      console.error(LOG_PREFIX, 'connect failed', uniqueId, err);
      const reason = describeReason(err, 'Unable to connect to TikTok LIVE.');
      entry.connected = false;
      entry.lastDisconnectReason = reason;
      broadcast('tiktokDisconnected', reason);
      scheduleCleanup();
    }
  })();

  return entry;
}

function ensureStream(uniqueId, options) {
  let entry = streams.get(uniqueId);
  if (!entry || entry.destroyed) {
    entry = createStream(uniqueId, options);
    streams.set(uniqueId, entry);
    return entry;
  }

  entry.touchOptions(options);
  return entry;
}

io.on('connection', (socket) => {
  console.info(LOG_PREFIX, 'client connected', socket.id);
  let currentUniqueId = null;

  const unsubscribe = () => {
    if (!currentUniqueId) {
      return;
    }
    const entry = streams.get(currentUniqueId);
    if (entry) {
      entry.removeClient(socket);
    }
    currentUniqueId = null;
  };

  socket.on('setUniqueId', (rawUniqueId, rawOptions = {}) => {
    const uniqueId = normalizeUniqueId(rawUniqueId);

    if (!uniqueId) {
      socket.emit('tiktokDisconnected', 'TikTok username is required.');
      return;
    }

    const options = sanitizeConnectOptions(rawOptions, uniqueId);

    if (currentUniqueId !== uniqueId) {
      unsubscribe();
      currentUniqueId = uniqueId;
    }

    const entry = ensureStream(uniqueId, options);
    entry.addClient(socket);
    console.info(LOG_PREFIX, 'client', socket.id, 'subscribed to', uniqueId, 'active clients:', entry.clients.size);
  });

  socket.on('disconnect', () => {
    console.info(LOG_PREFIX, 'client disconnected', socket.id);
    unsubscribe();
  });
});

server.listen(PORT, HOST, () => {
  const scheme = useTls ? 'https' : 'http';
  console.info(LOG_PREFIX, `listening on ${scheme}://${HOST}:${PORT}`);
  if (useTls) {
    console.info(LOG_PREFIX, 'TLS enabled; certificates will reload automatically');
  } else if (TLS_CERT_PATH || TLS_KEY_PATH) {
    console.warn(LOG_PREFIX, 'TLS disabled because TLS_CERT_PATH or TLS_KEY_PATH is missing/invalid');
  } else {
    console.info(LOG_PREFIX, 'TLS disabled; provide TLS_CERT_PATH and TLS_KEY_PATH to enable HTTPS');
  }
});

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
    const code = err && typeof err === 'object' ? err.code : undefined;
    const message = err?.message || err;
    if (code === 'ENOENT' || code === 'EACCES') {
      console.warn(LOG_PREFIX, 'TLS disabled – unable to read certificate files:', message);
    } else {
      console.error(LOG_PREFIX, 'failed to read TLS files:', message);
    }
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
      console.info(LOG_PREFIX, 'reloaded TLS certificates at', new Date().toISOString());
    } catch (err) {
      console.error(LOG_PREFIX, 'failed to reload TLS context:', err?.message || err);
    }
  };

  const initial = loadTlsOptions();
  if (initial) {
    lastFingerprint = createFingerprint(initial);
  }

  setInterval(reload, intervalMs).unref();

  [TLS_CERT_PATH, TLS_KEY_PATH, TLS_CA_PATH]
    .filter(Boolean)
    .forEach((filePath) => {
      try {
        fs.watch(filePath, { persistent: false }, () => reload());
      } catch (err) {
        // Watching symlinks can fail; interval reload covers this case
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
