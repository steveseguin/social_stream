const YT_LIVE_CHAT_EXTENSION_PATH = 'providers/youtube/liveChat.js';
const YT_LIVE_CHAT_RELATIVE_PATH = '../../providers/youtube/liveChat.js';

let liveChatModulePromise = null;

async function importWithFallback(extensionPath, relativePath) {
  if (
    typeof chrome !== 'undefined' &&
    chrome?.runtime &&
    typeof chrome.runtime.getURL === 'function'
  ) {
    try {
      const specifier = chrome.runtime.getURL(extensionPath);
      return await import(specifier);
    } catch (error) {
      console.warn(`Failed to import ${extensionPath} via chrome.runtime.getURL`, error);
    }
  }
  return import(relativePath);
}

async function loadLiveChatModule() {
  if (!liveChatModulePromise) {
    liveChatModulePromise = importWithFallback(
      YT_LIVE_CHAT_EXTENSION_PATH,
      YT_LIVE_CHAT_RELATIVE_PATH
    ).catch((error) => {
      liveChatModulePromise = null;
      throw error;
    });
  }
  return liveChatModulePromise;
}

export async function createYouTubeStreamingAdapter(options = {}) {
  const {
    logger = null,
    onChat = null,
    onStatus = null,
    onError = null,
    onDebug = null,
    tokenProvider = async () => null,
    fetchImplementation = null,
    streaming = {}
  } = options;

  const liveChatModule = await loadLiveChatModule();
  const {
    createYouTubeLiveChat,
    YOUTUBE_LIVE_CHAT_EVENTS,
    YOUTUBE_LIVE_CHAT_STATUS
  } = liveChatModule;

  const client = createYouTubeLiveChat({
    mode: 'stream',
    logger,
    tokenProvider,
    fetchImplementation,
    streaming
  });

  client.on(YOUTUBE_LIVE_CHAT_EVENTS.CHAT, (chat) => {
    if (typeof onChat === 'function') {
      onChat(chat);
    }
  });

  client.on(YOUTUBE_LIVE_CHAT_EVENTS.STATUS, (status) => {
    if (typeof onStatus === 'function') {
      onStatus(status);
    }
  });

  client.on(YOUTUBE_LIVE_CHAT_EVENTS.ERROR, (error) => {
    if (typeof onError === 'function') {
      onError(error);
    }
  });

  client.on(YOUTUBE_LIVE_CHAT_EVENTS.DEBUG, (payload) => {
    if (typeof onDebug === 'function') {
      onDebug(payload);
    }
  });

  return {
    async start(startOptions = {}) {
      const chatId = startOptions.chatId || startOptions.liveChatId || null;
      await client.start({
        chatId,
        forceRefreshToken: !!startOptions.forceRefreshToken
      });
      return client.getState();
    },
    stop() {
      client.stop();
    },
    getState() {
      return client.getState();
    },
    isActive() {
      const state = client.getState();
      return (
        state.status === YOUTUBE_LIVE_CHAT_STATUS.STARTING ||
        state.status === YOUTUBE_LIVE_CHAT_STATUS.RUNNING
      );
    },
    EVENTS: YOUTUBE_LIVE_CHAT_EVENTS,
    STATUS: YOUTUBE_LIVE_CHAT_STATUS
  };
}
