const STREAM_ENDPOINT = 'https://youtube.googleapis.com/youtube/v3/liveChat/messages:stream';
const DEFAULT_STREAMING = {
  endpoint: STREAM_ENDPOINT,
  maxResults: 500,
  reconnectDelayMs: 1000
};

const DEFAULT_OPTIONS = {
  mode: 'poll', // or 'stream'
  pollIntervalMs: 4000,
  retry: {
    minDelayMs: 2000,
    maxDelayMs: 60000,
    factor: 2
  },
  logger: null,
  tokenProvider: async () => null,
  chatIdResolver: async () => null,
  fetchImplementation: null,
  abortControllerFactory: null,
  streaming: DEFAULT_STREAMING
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
  const retry = {
    ...DEFAULT_OPTIONS.retry,
    ...(options.retry || {})
  };

  const streaming = {
    ...DEFAULT_STREAMING,
    ...(options.streaming || {})
  };

  return {
    ...DEFAULT_OPTIONS,
    ...options,
    retry,
    streaming
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
    mode: opts.mode === 'stream' ? 'stream' : 'poll',
    chatId: null,
    token: null,
    pageToken: null,
    pollTimer: null,
    retryTimer: null,
    retryCount: 0,
    lastError: null,
    streamAbortController: null,
    streamReader: null,
    manualStop: false,
    lastStartOptions: {},
    fetchImpl: null
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
    state.manualStop = false;
    state.lastStartOptions = { ...startOptions };
    updateStatus(STATUS.STARTING, { mode: state.mode });
    try {
      await ensureChatId(startOptions);
      await ensureToken(startOptions);
      if (state.mode === 'stream') {
        await startStream();
        return;
      }
      const error = new Error('YouTube live chat poll mode not implemented yet.');
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
    state.manualStop = true;
    cleanupStream();
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

  function cleanupStream() {
    if (state.streamAbortController) {
      try {
        state.streamAbortController.abort();
      } catch (err) {
        logDebug('Failed to abort stream controller', err);
      }
    }
    state.streamAbortController = null;
    if (state.streamReader) {
      try {
        state.streamReader.releaseLock();
      } catch (error) {
        logDebug('Failed to release stream reader lock', error);
      }
    }
    state.streamReader = null;
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

  async function ensureToken(startOptions = {}) {
    const startToken = normalizeToken(startOptions.token);
    if (startToken) {
      state.token = startToken;
      return;
    }

    if (state.token && state.token.accessToken && !startOptions.forceRefreshToken) {
      return;
    }

    if (typeof opts.tokenProvider === 'function') {
      state.token = normalizeToken(await opts.tokenProvider());
    }

    if (!state.token || !state.token.accessToken) {
      const error = new Error('YouTube live chat requires an access token.');
      error.code = 'MISSING_ACCESS_TOKEN';
      throw error;
    }
  }

  function resolveFetchImplementation() {
    if (state.fetchImpl) {
      return state.fetchImpl;
    }
    const impl =
      typeof opts.fetchImplementation === 'function'
        ? opts.fetchImplementation
        : typeof fetch === 'function'
        ? fetch.bind(typeof globalThis !== 'undefined' ? globalThis : window)
        : null;
    if (!impl) {
      throw new Error('No fetch implementation available for YouTube live chat streaming.');
    }
    state.fetchImpl = impl;
    return state.fetchImpl;
  }

  function createAbortController() {
    if (typeof opts.abortControllerFactory === 'function') {
      const controller = opts.abortControllerFactory();
      if (controller) {
        return controller;
      }
    }
    if (typeof AbortController !== 'undefined') {
      return new AbortController();
    }
    throw new Error('AbortController is required for YouTube live chat streaming.');
  }

  async function startStream() {
    const fetchImpl = resolveFetchImplementation();
    const controller = createAbortController();
    state.streamAbortController = controller;
    state.retryCount = 0;
    updateStatus(STATUS.RUNNING, { mode: 'stream' });
    try {
      await consumeStream(fetchImpl, controller.signal);
      if (!controller.signal.aborted && !state.manualStop) {
        logDebug('Stream ended unexpectedly; scheduling retry');
        scheduleRetry();
      }
    } catch (error) {
      if (controller.signal.aborted || state.manualStop) {
        return;
      }
      handleStreamError(error);
    } finally {
      cleanupStream();
    }
  }

  async function consumeStream(fetchImpl, signal) {
    const params = new URLSearchParams({
      part: 'snippet,authorDetails',
      liveChatId: state.chatId,
      maxResults: String(opts.streaming.maxResults || DEFAULT_STREAMING.maxResults)
    });
    if (state.pageToken) {
      params.set('pageToken', state.pageToken);
    }

    const res = await fetchImpl(`${opts.streaming.endpoint}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${state.token.accessToken}`,
        Accept: 'application/json'
      },
      signal
    });

    if (res.status === 401) {
      const authError = new Error('YouTube authentication expired. Please reconnect.');
      authError.code = 'TOKEN_EXPIRED';
      throw authError;
    }

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        errBody = null;
      }
      const error = new Error(
        `YouTube live chat stream failed (${res.status} ${res.statusText || ''})`.trim()
      );
      error.status = res.status;
      error.detail = errBody;
      throw error;
    }

    if (!res.body || typeof res.body.getReader !== 'function') {
      throw new Error('Environment does not support streaming responses for YouTube live chat.');
    }

    state.streamReader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (state.status === STATUS.RUNNING && !signal.aborted) {
      const { value, done } = await state.streamReader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      buffer = await processStreamBuffer(buffer);
    }

    buffer += decoder.decode();
    await processStreamBuffer(buffer, { flush: true });
  }

  async function processStreamBuffer(buffer, options = {}) {
    const { flush = false } = options;
    let remainder = buffer;
    let newlineIndex = remainder.indexOf('\n');

    while (newlineIndex !== -1) {
      const chunk = remainder.slice(0, newlineIndex).trim();
      remainder = remainder.slice(newlineIndex + 1);
      if (chunk) {
        await handleStreamChunk(chunk);
      }
      newlineIndex = remainder.indexOf('\n');
    }

    if (flush) {
      const finalChunk = remainder.trim();
      if (finalChunk) {
        await handleStreamChunk(finalChunk);
      }
      return '';
    }

    return remainder;
  }

  async function handleStreamChunk(rawChunk) {
    if (state.status !== STATUS.RUNNING) {
      return;
    }

    let payload = null;
    try {
      payload = JSON.parse(rawChunk);
    } catch (error) {
      logDebug('Failed to parse YouTube streaming chunk', { error, rawChunk });
      return;
    }

    state.pageToken = payload.nextPageToken || null;
    emitter.emit(EVENTS.DEBUG, { type: 'stream_chunk', payload });

    if (Array.isArray(payload.items) && payload.items.length) {
      await Promise.all(
        payload.items.map(async (item) => {
          try {
            const normalized = normalizeChatItem(item);
            emitChat(normalized);
          } catch (err) {
            logDebug('Failed to process YouTube streaming item', { error: err, itemId: item?.id });
          }
        })
      );
    }
  }

  function handleStreamError(error) {
    state.lastError = error;
    emitter.emit(EVENTS.ERROR, error);
    updateStatus(STATUS.ERROR, { error });
    if (!state.manualStop) {
      scheduleRetry();
    }
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
       pageToken: state.pageToken,
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

  function scheduleRetry(options = {}) {
    if (state.manualStop) {
      return;
    }
    if (state.retryTimer) {
      return;
    }
    const immediateDelay = options.immediate ? opts.streaming.reconnectDelayMs : null;
    const attempt = options.reset ? 1 : state.retryCount + 1;
    const { minDelayMs, maxDelayMs, factor } = opts.retry;
    const exponentialDelay = Math.min(maxDelayMs, minDelayMs * factor ** (attempt - 1));
    const delay = immediateDelay ?? exponentialDelay;
    state.retryCount = attempt;
    logDebug('Scheduling live chat retry', { attempt, delay });
    state.retryTimer = setTimeout(() => {
      state.retryTimer = null;
      updateStatus(STATUS.STARTING, { mode: state.mode, attempt, retry: true });
      start(state.lastStartOptions || {}).catch((err) => {
        logDebug('Retry failed', err);
        handleStreamError(err);
      });
    }, delay);
  }

  function normalizeToken(token) {
    if (!token) {
      return null;
    }
    if (typeof token === 'string') {
      return { accessToken: token };
    }
    if (typeof token === 'object') {
      const normalized = { ...token };
      if (!normalized.accessToken && typeof normalized.access_token === 'string') {
        normalized.accessToken = normalized.access_token;
      }
      if (typeof normalized.accessToken === 'string' && normalized.accessToken.length) {
        return normalized;
      }
    }
    return null;
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
