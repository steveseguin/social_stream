const API_ROOT = 'https://www.googleapis.com/youtube/v3';

function createError(message, extras = {}) {
  const error = new Error(message);
  Object.assign(error, extras);
  return error;
}

function resolveFetchImplementation(fetchImplementation) {
  if (typeof fetchImplementation === 'function') {
    return fetchImplementation;
  }
  if (typeof fetch === 'function') {
    return fetch.bind(typeof globalThis !== 'undefined' ? globalThis : window);
  }
  throw new Error('No fetch implementation available for YouTube context resolver.');
}

function buildHeaders(token) {
  const headers = {
    Accept: 'application/json'
  };
  if (token?.accessToken) {
    headers.Authorization = `Bearer ${token.accessToken}`;
  } else if (token?.access_token) {
    headers.Authorization = `Bearer ${token.access_token}`;
  }
  return headers;
}

async function fetchJson(url, { fetchImpl, token, signal }) {
  const res = await fetchImpl(url, {
    headers: buildHeaders(token),
    signal
  });

  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    body = null;
  }

  if (res.status === 401) {
    throw createError('YouTube authentication expired. Please reconnect.', {
      code: 'TOKEN_EXPIRED',
      status: res.status,
      detail: body
    });
  }

  if (!res.ok) {
    const reason =
      body?.error?.errors && Array.isArray(body.error.errors) && body.error.errors.length
        ? body.error.errors[0].reason
        : body?.error?.status || null;
    throw createError(
      `YouTube API request failed (${res.status}${res.statusText ? ` ${res.statusText}` : ''})`,
      {
        code: reason || 'API_ERROR',
        status: res.status,
        detail: body
      }
    );
  }

  return body;
}

function cacheResult(cache, keys, value) {
  if (!value) {
    return;
  }
  keys.forEach((key) => {
    if (key) {
      cache.set(key.toLowerCase(), value);
    }
  });
}

function normalizeChannel(channel) {
  if (!channel) {
    return null;
  }
  return {
    id: channel.id || null,
    title: channel.snippet?.title || null,
    description: channel.snippet?.description || null,
    thumbnails: channel.snippet?.thumbnails || null,
    statistics: channel.statistics || null,
    raw: channel
  };
}

function normalizeVideo(video) {
  if (!video) {
    return null;
  }
  const liveDetails = video.liveStreamingDetails || {};
  const broadcastContent = video.snippet?.liveBroadcastContent || '';
  let status = 'offline';
  if (broadcastContent === 'live') {
    status = 'live';
  } else if (broadcastContent === 'upcoming') {
    status = 'upcoming';
  } else if (broadcastContent === 'none' || liveDetails.actualEndTime) {
    status = 'ended';
  }

  return {
    id: video.id || null,
    title: video.snippet?.title || null,
    channelId: video.snippet?.channelId || null,
    channelTitle: video.snippet?.channelTitle || null,
    status,
    liveChatId: liveDetails.activeLiveChatId || null,
    scheduledStartTime: liveDetails.scheduledStartTime || null,
    actualStartTime: liveDetails.actualStartTime || null,
    actualEndTime: liveDetails.actualEndTime || null,
    statistics: video.statistics || null,
    thumbnails: video.snippet?.thumbnails || null,
    raw: video
  };
}

export function createYouTubeLiveChatContextResolver(options = {}) {
  const fetchImpl = resolveFetchImplementation(options.fetchImplementation);
  const logger = options.logger || null;
  const channelCache = new Map();
  const videoCache = new Map();

  function logDebug(message, meta) {
    if (!logger) {
      return;
    }
    try {
      if (typeof logger.debug === 'function') {
        logger.debug('[YouTubeContextResolver]', message, meta);
      } else if (typeof logger.log === 'function') {
        logger.log('[YouTubeContextResolver]', message, meta);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('YouTube context resolver logger failed', err);
    }
  }

  function ensureToken(token) {
    const normalized =
      token && typeof token === 'object'
        ? token.accessToken || token.access_token
          ? token
          : null
        : null;
    if (!normalized) {
      throw createError('YouTube OAuth token is required.', { code: 'MISSING_TOKEN' });
    }
    return normalized;
  }

  async function getChannelInfo(identifier, token, signal) {
    const trimmed = (identifier || '').trim();
    if (!trimmed) {
      throw createError('Channel identifier is required.', { code: 'CHANNEL_REQUIRED' });
    }

    const cacheKey = trimmed.toLowerCase();
    if (channelCache.has(cacheKey)) {
      return channelCache.get(cacheKey);
    }

    const tokenRef = ensureToken(token);
    let channelItem = null;

    const attemptById = async (idCandidate) => {
      const url = new URL(`${API_ROOT}/channels`);
      url.searchParams.set('part', 'snippet,statistics');
      url.searchParams.set('id', idCandidate);
      const data = await fetchJson(url.toString(), { fetchImpl, token: tokenRef, signal });
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items[0];
      }
      return null;
    };

    const attemptByUsername = async (username) => {
      const url = new URL(`${API_ROOT}/channels`);
      url.searchParams.set('part', 'snippet,statistics');
      url.searchParams.set('forUsername', username);
      const data = await fetchJson(url.toString(), { fetchImpl, token: tokenRef, signal });
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items[0];
      }
      return null;
    };

    const attemptBySearch = async (query) => {
      const searchUrl = new URL(`${API_ROOT}/search`);
      searchUrl.searchParams.set('part', 'snippet');
      searchUrl.searchParams.set('type', 'channel');
      searchUrl.searchParams.set('maxResults', '1');
      searchUrl.searchParams.set('q', query.startsWith('@') ? query.slice(1) : query);
      const searchData = await fetchJson(searchUrl.toString(), {
        fetchImpl,
        token: tokenRef,
        signal
      });
      if (Array.isArray(searchData.items) && searchData.items.length > 0) {
        const channelId = searchData.items[0]?.id?.channelId;
        if (channelId) {
          return attemptById(channelId);
        }
      }
      return null;
    };

    if (trimmed.startsWith('UC')) {
      channelItem = await attemptById(trimmed);
    }

    if (!channelItem && trimmed.startsWith('@')) {
      channelItem = await attemptBySearch(trimmed);
    }

    if (!channelItem && !trimmed.startsWith('UC') && !trimmed.startsWith('@')) {
      channelItem = await attemptByUsername(trimmed);
    }

    if (!channelItem) {
      channelItem = await attemptBySearch(trimmed);
    }

    if (!channelItem) {
      throw createError(`Channel not found: ${trimmed}`, { code: 'CHANNEL_NOT_FOUND' });
    }

    cacheResult(channelCache, [trimmed, channelItem.id], normalizeChannel(channelItem));
    return channelCache.get(trimmed.toLowerCase());
  }

  async function getLiveStreamInfo(channelId, token, signal) {
    const cacheKey = `live:${channelId}`;
    if (videoCache.has(cacheKey)) {
      return videoCache.get(cacheKey);
    }
    const tokenRef = ensureToken(token);
    const url = new URL(`${API_ROOT}/search`);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('channelId', channelId);
    url.searchParams.set('eventType', 'live');
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '1');

    const searchData = await fetchJson(url.toString(), { fetchImpl, token: tokenRef, signal });
    if (!Array.isArray(searchData.items) || !searchData.items.length) {
      return null;
    }

    const videoId = searchData.items[0]?.id?.videoId;
    if (!videoId) {
      return null;
    }

    const video = await getVideoDetails(videoId, tokenRef, signal);
    cacheResult(videoCache, [cacheKey], video);
    return video;
  }

  async function getVideoDetails(videoId, token, signal) {
    if (!videoId) {
      throw createError('Video identifier is required.', { code: 'VIDEO_REQUIRED' });
    }
    const cacheKey = `video:${videoId}`;
    if (videoCache.has(cacheKey)) {
      return videoCache.get(cacheKey);
    }
    const tokenRef = ensureToken(token);
    const url = new URL(`${API_ROOT}/videos`);
    url.searchParams.set('part', 'snippet,liveStreamingDetails,statistics');
    url.searchParams.set('id', videoId);
    const data = await fetchJson(url.toString(), { fetchImpl, token: tokenRef, signal });
    if (!Array.isArray(data.items) || !data.items.length) {
      throw createError(`Video not found or inaccessible: ${videoId}`, { code: 'VIDEO_NOT_FOUND' });
    }
    const normalized = normalizeVideo(data.items[0]);
    cacheResult(videoCache, [cacheKey], normalized);
    return normalized;
  }

  async function resolveFromVideo({ videoId, token, signal }) {
    const video = await getVideoDetails(videoId, token, signal);
    if (video.status === 'ended') {
      return {
        status: 'ended',
        liveChatId: null,
        video,
        channel: video.channelId
          ? await getChannelInfo(video.channelId, token, signal).catch(() => null)
          : null,
        reason: 'VIDEO_ENDED'
      };
    }
    if (video.status === 'upcoming' && !video.liveChatId) {
      return {
        status: 'upcoming',
        liveChatId: null,
        video,
        channel: video.channelId
          ? await getChannelInfo(video.channelId, token, signal).catch(() => null)
          : null,
        reason: 'CHAT_NOT_READY'
      };
    }
    if (!video.liveChatId) {
      throw createError(`Video ${videoId} does not have an active live chat.`, {
        code: 'VIDEO_HAS_NO_LIVE_CHAT',
        video
      });
    }
    return {
      status: video.status || 'live',
      liveChatId: video.liveChatId,
      video,
      channel: video.channelId
        ? await getChannelInfo(video.channelId, token, signal).catch(() => null)
        : null
    };
  }

  async function resolveFromChannel({ channel, token, signal }) {
    const channelInfo = await getChannelInfo(channel, token, signal);
    const liveStream = await getLiveStreamInfo(channelInfo.id, token, signal);
    if (!liveStream) {
      return {
        status: 'offline',
        liveChatId: null,
        channel: channelInfo,
        video: null,
        reason: 'NO_ACTIVE_STREAM'
      };
    }
    if (!liveStream.liveChatId) {
      if (liveStream.status === 'upcoming') {
        return {
          status: 'upcoming',
          liveChatId: null,
          channel: channelInfo,
          video: liveStream,
          reason: 'CHAT_NOT_READY'
        };
      }
      throw createError(`No live chat available for stream: ${liveStream.title || liveStream.id}`, {
        code: 'CHAT_NOT_AVAILABLE',
        channel: channelInfo,
        video: liveStream
      });
    }
    return {
      status: liveStream.status || 'live',
      liveChatId: liveStream.liveChatId,
      channel: channelInfo,
      video: liveStream
    };
  }

  async function resolve(context = {}, options = {}) {
    const token = ensureToken(context.token || options.token);
    const signal = options.signal || null;
    const directChatId = context.liveChatId || null;
    const videoId = context.videoId || null;
    const channel = context.channel || null;

    if (directChatId) {
      logDebug('Resolved live chat ID directly from input', { liveChatId: directChatId });
      return {
        status: 'live',
        liveChatId: directChatId,
        channel: null,
        video: null,
        reason: 'DIRECT'
      };
    }

    if (videoId) {
      const result = await resolveFromVideo({ videoId, token, signal });
      logDebug('Resolved live chat context from video', {
        status: result.status,
        liveChatId: result.liveChatId,
        videoId
      });
      return result;
    }

    if (channel) {
      const result = await resolveFromChannel({ channel, token, signal });
      logDebug('Resolved live chat context from channel', {
        status: result.status,
        liveChatId: result.liveChatId,
        channel
      });
      return result;
    }

    throw createError('Provide a live chat ID, video ID, or channel to resolve.', {
      code: 'MISSING_TARGET'
    });
  }

  return {
    resolve,
    getChannelInfo,
    getLiveStreamInfo,
    getVideoDetails
  };
}

export async function resolveYouTubeLiveChatContext(context = {}, options = {}) {
  const resolver = createYouTubeLiveChatContextResolver(options);
  return resolver.resolve(context, options);
}
