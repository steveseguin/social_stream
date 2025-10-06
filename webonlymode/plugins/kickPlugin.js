import { BasePlugin } from './basePlugin.js';
import { storage } from '../utils/storage.js';
import { safeHtml } from '../utils/helpers.js';

const CHANNEL_KEY = 'kick.channel';
const API_BASE_KEY = 'kick.apiBase';
const POLL_MS_KEY = 'kick.pollIntervalMs';

const DEFAULT_API_BASE = 'https://kick.com/api/v2';
const DEFAULT_POLL_INTERVAL = 4000;
const HISTORY_LIMIT = 400;

function normalizeChannel(value) {
  return (value || '').trim().replace(/^@+/, '').toLowerCase();
}

function normalizeImage(url) {
  if (!url) {
    return '';
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  if (url.startsWith('/')) {
    return `https://kick.com${url}`;
  }
  return `https://kick.com/${url}`;
}

function mapBadges(badges) {
  if (!Array.isArray(badges) || !badges.length) {
    return [];
  }
  return badges
    .map((badge) => {
      if (!badge) return null;
      if (typeof badge === 'string') {
        return badge;
      }
      const image = badge.image || badge.icon || badge.source;
      if (image && typeof image === 'object') {
        const src = image.url || image.light || image.dark;
        if (src) {
          return normalizeImage(src);
        }
      }
      if (badge.image_url) {
        return normalizeImage(badge.image_url);
      }
      if (badge.asset) {
        return normalizeImage(badge.asset);
      }
      if (badge.svg) {
        return { type: 'svg', html: badge.svg };
      }
      if (badge.label || badge.name) {
        return badge.label || badge.name;
      }
      return null;
    })
    .filter(Boolean);
}

function extractSegments(message) {
  if (!message) {
    return '';
  }
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message)) {
    return message
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part?.text) {
          return part.text;
        }
        if (part?.content) {
          return part.content;
        }
        if (part?.url) {
          return part.url;
        }
        if (part?.value) {
          return part.value;
        }
        return '';
      })
      .join('');
  }
  if (Array.isArray(message.message)) {
    return extractSegments(message.message);
  }
  if (Array.isArray(message.fragments)) {
    return extractSegments(message.fragments);
  }
  if (Array.isArray(message.parts)) {
    return extractSegments(message.parts);
  }
  if (message.text) {
    return message.text;
  }
  if (message.content) {
    return message.content;
  }
  if (message.body) {
    return message.body;
  }
  if (message.message) {
    return extractSegments(message.message);
  }
  return '';
}

function eventNameForType(type) {
  if (!type) return 'message';
  const lower = type.toLowerCase();
  if (lower === 'chat' || lower === 'message' || lower === 'chatroom_message') {
    return 'message';
  }
  if (lower.includes('gift')) {
    return 'gift';
  }
  if (lower.includes('tip') || lower.includes('donation')) {
    return 'donation';
  }
  if (lower.includes('sub')) {
    return 'subscription';
  }
  if (lower.includes('ban') || lower.includes('moderation')) {
    return 'moderation';
  }
  return lower;
}

export class KickPlugin extends BasePlugin {
  constructor(options) {
    super({
      ...options,
      id: 'kick',
      name: 'Kick',
      description: 'Fetch Kick chat messages using the public API and relay them to your overlays.'
    });

    this.channelInput = null;
    this.apiBaseInput = null;
    this.pollInput = null;
    this.statusLabel = null;
    this.detailsLabel = null;

    this.apiBase = DEFAULT_API_BASE;
    this.channelSlug = null;
    this.chatroomId = null;
    this.pollTimer = null;
    this.cursor = null;
    this.seenIds = new Set();
    this.lastFetchFailed = false;
  }

  renderPrimary(container) {
    const status = document.createElement('div');
    status.className = 'source-card__subtext';
    status.hidden = true;

    const detail = document.createElement('div');
    detail.className = 'source-card__subtext';
    detail.hidden = true;

    container.append(status, detail);
    this.statusLabel = status;
    this.detailsLabel = detail;
    this.refreshStatus();

    return container;
  }

  renderSettings(container) {
    const channelRow = document.createElement('label');
    channelRow.className = 'field';
    const channelLabel = document.createElement('span');
    channelLabel.className = 'field__label';
    channelLabel.textContent = 'Kick channel name';
    const channelInput = document.createElement('input');
    channelInput.type = 'text';
    channelInput.placeholder = 'eg. popularstreamer';
    channelInput.autocomplete = 'off';
    channelInput.value = storage.get(CHANNEL_KEY, '');
    channelInput.addEventListener('change', () => {
      storage.set(CHANNEL_KEY, normalizeChannel(channelInput.value));
      this.refreshStatus();
    });
    channelRow.append(channelLabel, channelInput);

    const apiRow = document.createElement('label');
    apiRow.className = 'field';
    const apiLabel = document.createElement('span');
    apiLabel.className = 'field__label';
    apiLabel.textContent = 'API base URL (optional)';
    const apiInput = document.createElement('input');
    apiInput.type = 'url';
    apiInput.placeholder = DEFAULT_API_BASE;
    apiInput.autocomplete = 'off';
    apiInput.value = storage.get(API_BASE_KEY, DEFAULT_API_BASE);
    apiInput.addEventListener('change', () => {
      const next = apiInput.value.trim() || DEFAULT_API_BASE;
      storage.set(API_BASE_KEY, next);
      this.apiBase = this.normalizeApiBase(next);
      this.refreshStatus();
    });
    apiRow.append(apiLabel, apiInput);

    const pollRow = document.createElement('label');
    pollRow.className = 'field';
    const pollLabel = document.createElement('span');
    pollLabel.className = 'field__label';
    pollLabel.textContent = 'Polling interval (ms)';
    const pollInput = document.createElement('input');
    pollInput.type = 'number';
    pollInput.min = '1000';
    pollInput.step = '500';
    pollInput.value = storage.get(POLL_MS_KEY, DEFAULT_POLL_INTERVAL);
    pollInput.addEventListener('change', () => {
      const value = Math.max(1000, Number(pollInput.value) || DEFAULT_POLL_INTERVAL);
      storage.set(POLL_MS_KEY, value);
      pollInput.value = value;
    });
    pollRow.append(pollLabel, pollInput);

    container.append(channelRow, apiRow, pollRow);
    this.channelInput = channelInput;
    this.apiBaseInput = apiInput;
    this.pollInput = pollInput;

    this.apiBase = this.normalizeApiBase(apiInput.value || DEFAULT_API_BASE);

    return container;
  }

  normalizeApiBase(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return DEFAULT_API_BASE;
    }
    return trimmed.replace(/\/?$/, '');
  }

  refreshStatus() {
    if (!this.statusLabel) {
      return;
    }
    const channel = normalizeChannel(this.channelInput ? this.channelInput.value : storage.get(CHANNEL_KEY, ''));
    if (channel) {
      this.statusLabel.hidden = false;
      this.statusLabel.innerHTML = `Channel: <strong>${safeHtml(channel)}</strong>`;
    } else {
      this.statusLabel.hidden = true;
      this.statusLabel.textContent = '';
    }

    if (this.detailsLabel) {
      if (this.chatroomId) {
        this.detailsLabel.hidden = false;
        this.detailsLabel.textContent = `Chatroom ID: ${this.chatroomId}`;
      } else {
        const apiBase = this.apiBaseInput ? this.apiBaseInput.value.trim() : storage.get(API_BASE_KEY, DEFAULT_API_BASE);
        if (apiBase && apiBase !== DEFAULT_API_BASE) {
          this.detailsLabel.hidden = false;
          this.detailsLabel.textContent = `API base: ${apiBase}`;
        } else {
          this.detailsLabel.hidden = true;
          this.detailsLabel.textContent = '';
        }
      }
    }
  }

  async enable() {
    const sessionId = this.messenger.getSessionId();
    if (!sessionId) {
      this.reportError(new Error('Start a session before connecting Kick.'));
      return;
    }

    const channel = normalizeChannel(this.channelInput ? this.channelInput.value : storage.get(CHANNEL_KEY, ''));
    if (!channel) {
      this.reportError(new Error('Enter the Kick channel name.'));
      return;
    }

    this.channelSlug = channel;
    storage.set(CHANNEL_KEY, channel);
    this.apiBase = this.normalizeApiBase(this.apiBaseInput ? this.apiBaseInput.value : storage.get(API_BASE_KEY, DEFAULT_API_BASE));
    storage.set(API_BASE_KEY, this.apiBase);

    this.refreshStatus();

    try {
      const chatroomId = await this.resolveChatroomId(channel);
      if (!chatroomId) {
        throw new Error('Unable to determine Kick chatroom ID.');
      }

      this.chatroomId = chatroomId;
      this.cursor = null;
      this.seenIds = new Set();
      this.refreshStatus();

      await this.pullMessages({ warmup: true });

      const interval = Math.max(1000, Number(this.pollInput ? this.pollInput.value : storage.get(POLL_MS_KEY, DEFAULT_POLL_INTERVAL)) || DEFAULT_POLL_INTERVAL);
      storage.set(POLL_MS_KEY, interval);

      this.pollTimer = window.setInterval(() => {
        this.pullMessages().catch((err) => {
          this.log(`Kick polling failed: ${err?.message || err}`);
        });
      }, interval);

      this.setState('connected');
      this.log(`Connected to Kick channel ${channel}`);
    } catch (err) {
      this.resetConnectionState();
      const error = err instanceof Error ? err : new Error(err?.message || String(err));
      this.reportError(error);
    }
  }

  async resolveChatroomId(channel) {
    const url = `${this.apiBase}/channels/${encodeURIComponent(channel)}`;
    const data = await this.fetchJson(url);
    if (!data) {
      throw new Error('Kick channel lookup returned empty response.');
    }
    if (data.chatroom) {
      if (typeof data.chatroom === 'object' && data.chatroom !== null) {
        return data.chatroom.id || data.chatroom.chatroom_id || data.chatroom.chatroomId;
      }
      if (typeof data.chatroom === 'number' || typeof data.chatroom === 'string') {
        return data.chatroom;
      }
    }
    if (data.chat_room || data.chatRoom) {
      const value = data.chat_room || data.chatRoom;
      if (typeof value === 'object' && value !== null) {
        return value.id || value.chatroom_id;
      }
      return value;
    }
    if (data.channel && data.channel.chatroom) {
      return data.channel.chatroom.id;
    }
    if (data.chatroom_id) {
      return data.chatroom_id;
    }
    return null;
  }

  async pullMessages({ warmup = false } = {}) {
    if (!this.chatroomId) {
      return;
    }

    const params = new URLSearchParams();
    params.set('limit', warmup ? '50' : '25');
    if (this.cursor) {
      params.set('cursor', this.cursor);
    }

    const url = `${this.apiBase}/chatrooms/${encodeURIComponent(this.chatroomId)}/messages?${params.toString()}`;

    let data;
    try {
      data = await this.fetchJson(url);
      this.lastFetchFailed = false;
    } catch (err) {
      if (!this.lastFetchFailed) {
        this.lastFetchFailed = true;
        throw err;
      }
      return;
    }

    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.messages)
        ? data.messages
        : Array.isArray(data)
          ? data
          : [];

    if (!Array.isArray(list) || !list.length) {
      if (typeof data?.pagination?.cursor === 'string') {
        this.cursor = data.pagination.cursor;
      }
      return;
    }

    const ordered = list.slice().sort((a, b) => {
      const aTime = new Date(a?.created_at || a?.timestamp || 0).getTime();
      const bTime = new Date(b?.created_at || b?.timestamp || 0).getTime();
      return aTime - bTime;
    });

    if (warmup) {
      ordered.forEach((item) => {
        if (item?.id) {
          this.seenIds.add(item.id);
        }
      });
    } else {
      ordered.forEach((item) => this.emitMessage(item));
    }

    const nextCursor = data?.pagination?.cursor || ordered[ordered.length - 1]?.id;
    if (nextCursor) {
      this.cursor = nextCursor;
    }

    // prune history set
    if (this.seenIds.size > HISTORY_LIMIT) {
      const extras = this.seenIds.size - HISTORY_LIMIT;
      const iterator = this.seenIds.values();
      for (let i = 0; i < extras; i += 1) {
        const next = iterator.next();
        if (next.done) break;
        this.seenIds.delete(next.value);
      }
    }
  }

  emitMessage(payload) {
    if (!payload) {
      return;
    }
    const id = payload.id || payload.uuid || payload.message_id;
    if (id && this.seenIds.has(id)) {
      return;
    }
    if (id) {
      this.seenIds.add(id);
    }

    const sender = payload.sender || payload.user || {};
    const displayName = sender.username || sender.slug || sender.display_name || sender.name || 'Kick viewer';
    const avatar = normalizeImage(sender.profile_picture || sender.profile_pic || sender.profile_pic_url || sender.avatar);
    const nameColor = sender.identity?.color || sender.color;
    const badges = mapBadges(sender.identity?.badges || sender.badges);

    const event = eventNameForType(payload.type || payload.event || payload.message_type);

    let text = extractSegments(payload.message || payload.content || payload.body || payload.data);
    if (!text && payload.message_text) {
      text = payload.message_text;
    }
    text = text ? safeHtml(text) : '';

    if (!text && event === 'message') {
      return;
    }

    const timestamp = Date.parse(payload.created_at || payload.timestamp || payload.inserted_at || '') || Date.now();

    const message = {
      id: id ? `kick-${id}` : `kick-${timestamp}`,
      type: 'kick',
      chatname: displayName,
      chatmessage: text,
      chatimg: avatar || '',
      timestamp,
      event,
      chatbadges: badges,
      nameColor,
      raw: payload
    };

    if (event === 'gift') {
      const gift = payload.gift || payload.meta?.gift;
      if (gift) {
        const summary = [gift.name || gift.title || 'Gift'];
        if (gift.quantity || gift.count) {
          summary.push(`×${gift.quantity || gift.count}`);
        }
        message.chatmessage = safeHtml(summary.join(' '));
        message.hasDonation = gift.name || gift.title || 'Gift';
        if (gift.value || gift.amount) {
          message.donationAmount = gift.value || gift.amount;
        }
      } else if (payload.meta?.message) {
        message.chatmessage = safeHtml(payload.meta.message);
      }
    } else if (event === 'donation') {
      const amount = payload.amount || payload.value || payload.meta?.amount;
      if (amount) {
        message.hasDonation = `${amount}`;
        message.donationAmount = amount;
      }
      if (!message.chatmessage && payload.meta?.message) {
        message.chatmessage = safeHtml(payload.meta.message);
      }
    } else if (event === 'subscription') {
      const tier = payload.meta?.tier || payload.subscription_tier;
      message.chatmessage = tier ? `Subscribed (${tier})` : 'Subscribed';
      message.hasDonation = message.chatmessage;
    }

    this.publish(message);
  }

  async fetchJson(url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      credentials: 'omit',
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    const text = await response.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch (err) {
      throw new Error('Failed to parse Kick API response.');
    }
  }

  resetConnectionState() {
    if (this.pollTimer) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.chatroomId = null;
    this.cursor = null;
    this.seenIds.clear();
    this.refreshStatus();
  }

  disable() {
    this.resetConnectionState();
    this.setState('idle');
  }
}
