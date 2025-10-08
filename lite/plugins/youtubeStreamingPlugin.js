import { YoutubePlugin } from './youtubePlugin.js';

const STREAM_ENDPOINT = 'https://youtube.googleapis.com/youtube/v3/liveChat/messages:stream';

export class YoutubeStreamingPlugin extends YoutubePlugin {
  constructor(options) {
    super({
      ...options,
      description: 'Connect directly to YouTube live chat using the Streaming API for lower latency updates.'
    });

    this.streamAbortController = null;
    this.streamReader = null;
    this.streamLoopPromise = null;
    this.streamReconnectTimer = null;
  }

  stopListening() {
    super.stopListening();
    this.clearStreamResources();
  }

  startListening() {
    this.clearStreamResources();

    if (this.state !== 'connected') {
      return;
    }

    if (!this.isTokenValid()) {
      this.log('YouTube token expired; streaming cannot start.');
      return;
    }

    if (!this.liveChatId) {
      this.log('Live chat ID missing; streaming cannot start.');
      return;
    }

    this.streamAbortController = new AbortController();
    const { signal } = this.streamAbortController;

    this.streamLoopPromise = this.consumeStream(signal).catch((err) => {
      if (signal.aborted || this.state !== 'connected') {
        return;
      }
      this.reportError(err);
    });
  }

  clearStreamResources() {
    if (this.streamReconnectTimer) {
      window.clearTimeout(this.streamReconnectTimer);
      this.streamReconnectTimer = null;
    }
    if (this.streamAbortController) {
      this.streamAbortController.abort();
      this.streamAbortController = null;
    }
    if (this.streamReader) {
      try {
        this.streamReader.releaseLock();
      } catch (_) {
        // ignore release errors
      }
      this.streamReader = null;
    }
    this.streamLoopPromise = null;
  }

  async consumeStream(signal) {
    const params = new URLSearchParams({
      part: 'snippet,authorDetails',
      liveChatId: this.liveChatId,
      maxResults: '500'
    });
    if (this.nextPageToken) {
      params.set('pageToken', this.nextPageToken);
    }

    const res = await fetch(`${STREAM_ENDPOINT}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${this.token.accessToken}`,
        Accept: 'application/json'
      },
      signal
    });

    if (res.status === 401) {
      throw new Error('YouTube authentication expired. Please reconnect.');
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw this.createApiError(errBody, res.status, 'liveChat.messages:stream');
    }

    if (!res.body || typeof res.body.getReader !== 'function') {
      throw new Error('Browser does not support streaming responses for the YouTube API.');
    }

    this.streamReader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (this.state === 'connected') {
        const { value, done } = await this.streamReader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        buffer = await this.processStreamBuffer(buffer);
      }
      buffer += decoder.decode();
      await this.processStreamBuffer(buffer, { flush: true });
    } finally {
      if (this.streamReader) {
        try {
          this.streamReader.releaseLock();
        } catch (_) {
          // ignore release errors
        }
      }
      this.streamReader = null;

      if (this.state === 'connected' && !signal.aborted) {
        this.streamReconnectTimer = window.setTimeout(() => {
          this.streamReconnectTimer = null;
          this.startListening();
        }, 1000);
      }
    }
  }

  async processStreamBuffer(buffer, options = {}) {
    const { flush = false } = options;
    let remainder = buffer;
    let newlineIndex;

    while ((newlineIndex = remainder.indexOf('\n')) !== -1) {
      const chunk = remainder.slice(0, newlineIndex).trim();
      remainder = remainder.slice(newlineIndex + 1);
      if (!chunk) {
        continue;
      }
      await this.handleStreamChunk(chunk);
    }

    if (flush) {
      const finalChunk = remainder.trim();
      if (finalChunk) {
        await this.handleStreamChunk(finalChunk);
      }
      return '';
    }

    return remainder;
  }

  async handleStreamChunk(rawChunk) {
    if (this.state !== 'connected') {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(rawChunk);
    } catch (err) {
      this.debugLog('Failed to parse YouTube streaming chunk', { error: err?.message || err, rawChunk });
      return;
    }

    this.nextPageToken = payload.nextPageToken || null;

    if (Array.isArray(payload.items) && payload.items.length) {
      await Promise.all(
        payload.items.map((item) =>
          this.transformAndPublish(item).catch((err) => {
            this.debugLog('Failed to process YouTube streaming item', { error: err?.message || err, itemId: item?.id });
            return null;
          })
        )
      );
    }
  }
}
