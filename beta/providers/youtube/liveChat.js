const DEFAULT_OPTIONS = {
  mode: 'poll', // or 'stream'
  pollIntervalMs: 4000,
  retry: {
    minDelayMs: 2000,
    maxDelayMs: 60000,
    factor: 2
  },
  logger: console,
  tokenProvider: async () => null,
  chatIdResolver: async () => null
};

const STATUS = {
  IDLE: 'idle',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  ERROR: 'error'
};

const EVENTS = {
  STATUS: 'status',
  CHAT: 'chat',
  MEMBERSHIP: 'membership',
  SUPER_CHAT: 'super_chat',
  SUPER_STICKER: 'super_sticker',
  SPONSOR: 'sponsor',
  BAN: 'ban',
  DELETE_MESSAGE: 'delete_message',
  METRIC: 'metric',
  ERROR: 'error',
  DEBUG: 'debug'
};

function cloneOptions(options) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    retry: {
      ...DEFAULT_OPTIONS.retry,
      ...(options.retry || {})
    }
  };
}

function createEmitter() {
  const listeners = new Map();

  function on(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function.');
    }
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(handler);
    return () => off(event, handler);
  }

  function off(event, handler) {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (!set.size) {
      listeners.delete(event);
    }
  }

  function once(event, handler) {
    const wrapped = (...args) => {
      off(event, wrapped);
      handler(...args);
    };
    return on(event, wrapped);
  }

  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    [...set].forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        console.error(`YouTube live chat emitter handler for ${event} failed`, err);
      }
    });
  }

  function clear() {
    listeners.clear();
  }

  return { on, off, once, emit, clear };
}

export function createYouTubeLiveChat(options = {}) {
  const opts = cloneOptions(options);
  const emitter = createEmitter();
  const state = {
    status: STATUS.IDLE,
    chatId: null,
    pageToken: null,
    pollTimer: null,
    retryTimer: null,
    retryCount: 0,
    lastError: null,
    mode: opts.mode === 'stream' ? 'stream' : 'poll'
  };

  function logDebug(message, meta) {
    if (!opts.logger) {
      return;
    }
    try {
      opts.logger.debug
        ? opts.logger.debug('[YouTubeLiveChat]', message, meta)
        : opts.logger.log('[YouTubeLiveChat]', message, meta);
    } catch (err) {
      console.warn('YouTube live chat debug logger failed', err);
    }
  }

  function updateStatus(nextStatus, meta = {}) {
    if (state.status === nextStatus && !meta.force) {
      return;
    }
    state.status = nextStatus;
    emitter.emit(EVENTS.STATUS, { status: nextStatus, meta });
  }

  async function start(startOptions = {}) {
    if (state.status === STATUS.RUNNING || state.status === STATUS.STARTING) {
      return;
    }
    updateStatus(STATUS.STARTING);
    try {
      await ensureChatId(startOptions);
      const error = new Error('YouTube live chat start() not implemented yet.');
      error.code = 'NOT_IMPLEMENTED';
      throw error;
    } catch (err) {
      state.lastError = err;
      updateStatus(STATUS.ERROR, { error: err });
      emitter.emit(EVENTS.ERROR, err);
      stop({ suppressStatus: true });
      updateStatus(STATUS.IDLE);
      throw err;
    }
  }

  function stop(options = {}) {
    if (state.pollTimer) {
      clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }
    if (state.retryTimer) {
      clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }
    state.retryCount = 0;
    state.pageToken = null;
    if (!options.suppressStatus) {
      updateStatus(STATUS.STOPPING);
      updateStatus(STATUS.IDLE);
    }
  }

  async function ensureChatId(startOptions = {}) {
    if (startOptions.chatId) {
      state.chatId = startOptions.chatId;
      return;
    }
    if (typeof opts.chatIdResolver === 'function') {
      state.chatId = await opts.chatIdResolver();
    }
  }

  function scheduleRetry() {
    if (state.retryTimer) {
      return;
    }
    const attempt = state.retryCount + 1;
    const { minDelayMs, maxDelayMs, factor } = opts.retry;
    const delay = Math.min(maxDelayMs, minDelayMs * factor ** (attempt - 1));
    state.retryCount = attempt;
    logDebug('Scheduling live chat retry', { attempt, delay });
    state.retryTimer = setTimeout(() => {
      state.retryTimer = null;
      start().catch((err) => {
        logDebug('Retry failed', err);
        scheduleRetry();
      });
    }, delay);
  }

  function normalizeChatItem(raw) {
    return {
      raw,
      message: '',
      badges: [],
      author: null,
      isMember: false,
      amountMicros: null,
      currency: null,
      timestamp: Date.now()
    };
  }

  function emitChat(chat) {
    emitter.emit(EVENTS.CHAT, chat);
  }

  function getState() {
    return {
      status: state.status,
      chatId: state.chatId,
      mode: state.mode,
      retryCount: state.retryCount,
      lastError: state.lastError
    };
  }

  function setMode(nextMode) {
    const normalized = nextMode === 'stream' ? 'stream' : 'poll';
    if (state.mode === normalized) {
      return;
    }
    state.mode = normalized;
    emitter.emit(EVENTS.DEBUG, { type: 'mode_changed', mode: normalized });
  }

  return {
    start,
    stop,
    on: emitter.on,
    off: emitter.off,
    once: emitter.once,
    scheduleRetry,
    emitChat,
    normalizeChatItem,
    updateStatus,
    setMode,
    getState,
    EVENTS,
    STATUS
  };
}

export const YOUTUBE_LIVE_CHAT_EVENTS = Object.freeze({ ...EVENTS });
export const YOUTUBE_LIVE_CHAT_STATUS = Object.freeze({ ...STATUS });
