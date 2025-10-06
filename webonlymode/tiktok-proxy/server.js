const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const PORT = Number.parseInt(process.env.PORT || '8089', 10);
const LOG_PREFIX = '[tiktok-proxy]';
const IDLE_TIMEOUT_MS = Number.parseInt(process.env.IDLE_TIMEOUT_MS || '15000', 10);

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

const server = http.createServer(app);

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

function sanitizeConnectOptions(rawOptions = {}) {
  if (!rawOptions || typeof rawOptions !== 'object') {
    return {};
  }

  const options = {};
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
    options.clientParams = rawOptions.clientParams;
  }
  return options;
}

function describeReason(reason, fallback = 'TikTok connection closed.') {
  if (!reason) {
    return fallback;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  if (reason instanceof Error) {
    return reason.message || fallback;
  }
  if (typeof reason === 'object') {
    if (typeof reason.message === 'string' && reason.message.trim().length) {
      return reason.message;
    }
    if (typeof reason.description === 'string' && reason.description.trim().length) {
      return reason.description;
    }
    if (typeof reason.info === 'string' && reason.info.trim().length) {
      return reason.info;
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

function createStream(uniqueId, options) {
  console.info(LOG_PREFIX, 'creating stream', uniqueId);

  const connection = new WebcastPushConnection(uniqueId, {
    enableExtendedGiftInfo: options.enableExtendedGiftInfo !== false,
    clientParams: options.clientParams
  });

  const entry = {
    uniqueId,
    options: { ...options },
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
    entry.options = { ...entry.options, ...nextOptions };
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

    const options = sanitizeConnectOptions(rawOptions);

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

server.listen(PORT, () => {
  console.info(LOG_PREFIX, `listening on port ${PORT}`);
});
