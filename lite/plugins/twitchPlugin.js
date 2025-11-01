import { BasePlugin } from './basePlugin.js';
import { storage } from '../utils/storage.js';
import { randomSessionId, safeHtml, htmlToText } from '../utils/helpers.js';
import { loadScriptSequential } from '../utils/scriptLoader.js';

const TOKEN_KEY = 'twitch.token';
const CLIENT_ID_KEY = 'twitch.clientId';
const CHANNEL_KEY = 'twitch.channel';
const STATE_KEY = 'twitch.authState';

const DEFAULT_CLIENT_ID = 'sjjsgy1sgzxmy346tdkghbyz4gtx0k';
const TWITCH_SCOPES = [
  'chat:read',
  'chat:edit',
  'bits:read',
  'channel:read:subscriptions',
  'channel:read:redemptions'
];

const TMI_SOURCES = [
  './vendor/tmi.js'
];

let tmiLoaderPromise = null;

export class TwitchPlugin extends BasePlugin {
  constructor(options) {
    super({
      ...options,
      id: 'twitch',
      name: 'Twitch',
      description: 'Authorize with Twitch to pull chat directly via tmi.js and relay new events.'
    });

    this.clientIdInput = null;
    this.channelInput = null;
    this.statusLabel = null;
    this.channelLabel = null;
    this.signOutBtn = null;
    this.authButton = null;

    this.token = storage.get(TOKEN_KEY, null);
    this.identity = null;
    this.client = null;
    this.channelUserId = null;
  }

  renderPrimary(container) {
    const statusLabel = document.createElement('div');
    statusLabel.className = 'source-card__subtext';
    statusLabel.textContent = '';
    statusLabel.hidden = true;

    const channelStatus = document.createElement('div');
    channelStatus.className = 'source-card__subtext';
    channelStatus.textContent = '';
    channelStatus.hidden = true;

    const controls = document.createElement('div');
    controls.className = 'plugin-actions';

    const authButton = document.createElement('button');
    authButton.type = 'button';
    authButton.className = 'btn';
    authButton.textContent = 'Sign in to Twitch';
    authButton.addEventListener('click', () => this.handleConnect());

    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'btn btn--ghost';
    signOut.textContent = 'Sign out';
    signOut.addEventListener('click', () => this.signOut());
    signOut.disabled = !this.token;

    controls.append(authButton, signOut);

    container.append(statusLabel, channelStatus, controls);
    this.clientIdInput = null;
    this.channelInput = null;
    this.statusLabel = statusLabel;
    this.channelLabel = channelStatus;
    this.signOutBtn = signOut;
    this.authButton = authButton;

    this.refreshStatus();
    return container;
  }

  renderSettings(container) {
    const channelRow = document.createElement('div');
    channelRow.className = 'field';

    const channelLabel = document.createElement('span');
    channelLabel.className = 'field__label';
    channelLabel.textContent = 'Channel (optional)';

    const channelInput = document.createElement('input');
    channelInput.type = 'text';
    channelInput.placeholder = 'Defaults to the authenticated channel';
    channelInput.value = storage.get(CHANNEL_KEY, '');
    channelInput.addEventListener('change', () => {
      storage.set(CHANNEL_KEY, channelInput.value.trim());
      this.refreshStatus();
    });

    channelRow.append(channelLabel, channelInput);
    container.append(channelRow);

    this.channelInput = channelInput;

    return container;
  }

  refreshStatus() {
    if (this.statusLabel) {
      if (this.token && !this.isTokenExpired()) {
        const name = this.identity?.display_name || this.identity?.login;
        this.statusLabel.innerHTML = name ? `Authorized as <strong>${safeHtml(name)}</strong>` : 'Authorized.';
        this.statusLabel.hidden = false;
      } else {
        this.statusLabel.textContent = '';
        this.statusLabel.hidden = true;
      }
    }

    if (this.channelLabel) {
      const channel = this.channelInput?.value.trim();
      if (channel) {
        this.channelLabel.textContent = `Configured channel: ${channel}`;
        this.channelLabel.hidden = false;
      } else {
        this.channelLabel.textContent = '';
        this.channelLabel.hidden = true;
      }
    }

    if (this.signOutBtn) {
      const signedIn = Boolean(this.token) && !this.isTokenExpired();
      this.signOutBtn.disabled = !signedIn;
      this.signOutBtn.hidden = !signedIn;
    }

    if (this.authButton) {
      const needsAuth = !this.isTokenValid();
      this.authButton.hidden = !needsAuth;
      this.authButton.disabled = this.state === 'connecting';
    }
  }

  enable() {
    if (!this.messenger.getSessionId()) {
      throw new Error('Start a session before connecting Twitch.');
    }

    if (this.isTokenValid()) {
      this.connectToChat();
      return;
    }

    this.beginAuth();
  }

  disable() {
    if (this.client) {
      try {
        this.client.removeAllListeners?.();
      } catch (err) {
        console.warn('Failed to remove Twitch listeners', err);
      }
      try {
        this.client.disconnect();
      } catch (err) {
        console.warn('Twitch disconnect failed', err);
      }
    }
    this.client = null;
  }

  beginAuth() {
    const storedClientId = (storage.get(CLIENT_ID_KEY, '') || '').trim();
    const clientId = storedClientId || DEFAULT_CLIENT_ID;
    storage.set(CLIENT_ID_KEY, clientId);

    const redirectUri = new URL(window.location.href.split('#')[0]).toString();
    const state = `${this.id}:${randomSessionId()}`;
    storage.set(STATE_KEY, state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: TWITCH_SCOPES.join(' '),
      state,
      force_verify: 'true'
    });

    window.location.assign(`https://id.twitch.tv/oauth2/authorize?${params.toString()}`);
  }

  handleOAuthCallback(params) {
    const access = params.get('access_token');
    const expires = parseInt(params.get('expires_in'), 10) || 3600;
    const state = params.get('state');

    const storedState = storage.get(STATE_KEY, null);
    if (!storedState || storedState !== state) {
      throw new Error('OAuth state mismatch for Twitch.');
    }
    storage.remove(STATE_KEY);

    const tokenData = {
      accessToken: access,
      tokenType: params.get('token_type') || 'Bearer',
      expiresAt: Date.now() + (expires - 60) * 1000
    };

    storage.set(TOKEN_KEY, tokenData);
    this.token = tokenData;
    this.refreshStatus();

    if (this.messenger.getSessionId()) {
      this.setState('connecting');
      this.log('Authorization successful. Connecting to Twitch chat...');
      this.connectToChat();
    } else {
      this.log('Authorization successful. Start a session and press Connect when ready.');
    }
  }

  isTokenExpired() {
    if (!this.token || !this.token.expiresAt) {
      return true;
    }
    return Date.now() >= this.token.expiresAt;
  }

  isTokenValid() {
    return this.token && !this.isTokenExpired();
  }

  signOut() {
    storage.remove(TOKEN_KEY);
    this.token = null;
    this.identity = null;
    this.refreshStatus();
    if (this.state === 'connected') {
      this.disable();
      this.setState('idle');
    }
  }

  shouldAutoConnect() {
    return super.shouldAutoConnect() && this.isTokenValid();
  }

  async connectToChat() {
    if (!this.messenger.getSessionId()) {
      throw new Error('Start a session before connecting Twitch.');
    }
    try {
      this.debugLog('Validating Twitch token before chat connect');
      await this.validateToken();
      const channelName = this.resolveChannel();
      storage.set(CHANNEL_KEY, channelName);

      const tmi = await ensureTmiClient();

      const joinChannel = `#${channelName}`;
      this.debugLog('Creating Twitch client', {
        joinChannel,
        identity: this.identity?.login
      });
      const client = new tmi.Client({
        options: { debug: false, skipUpdatingEmotesets: true },
        identity: {
          username: this.identity.login,
          password: `oauth:${this.token.accessToken}`
        },
        channels: [joinChannel]
      });

      this.bindClientEvents(client, channelName);
      this.channelName = channelName;

      await this.resolveChannelUserId(channelName);
      if (this.emotes) {
        const context = this.buildEmoteContext(channelName);
        await this.emotes.prepareChannel(context).catch(() => {});
      }

      await client.connect();
      this.client = client;
      this.setState('connected');
      this.log('Connected to Twitch chat.', { channel: channelName });
    } catch (err) {
      this.debugLog('Twitch connectToChat failed', { error: err?.message || err });
      this.reportError(err);
    }
  }

  async validateToken() {
    const res = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: {
        Authorization: `OAuth ${this.token.accessToken}`
      }
    });

    if (!res.ok) {
      this.signOut();
      throw new Error('Twitch token invalid or expired. Please reconnect.');
    }

    const data = await res.json();
    this.identity = {
      login: data.login,
      userId: data.user_id,
      display_name: data.login,
      scopes: data.scopes || []
    };
    this.debugLog('Validated Twitch token response', {
      login: data.login,
      userId: data.user_id,
      scopes: data.scopes
    });

    if (this.statusLabel) {
      this.statusLabel.innerHTML = `Authorized as <strong>${safeHtml(this.identity.login)}</strong>`;
    }
    return this.identity;
  }

  resolveChannel() {
    const inputChannel = this.channelInput?.value.trim();
    const resolved = inputChannel ? sanitizeChannel(inputChannel) : sanitizeChannel(this.identity?.login || '');
    if (!resolved) {
      throw new Error('Unable to determine Twitch channel.');
    }
    return resolved;
  }

  bindClientEvents(client, channel) {
    client.on('connected', () => {
      this.log('Twitch socket connected.', { server: client.opts?.connection?.server });
      this.debugLog('Twitch socket connected (debug)', {
        channel,
        server: client.opts?.connection?.server
      });
    });

    client.on('disconnected', (reason) => {
      this.log('Twitch socket disconnected', { reason });
      this.client = null;
      this.setState('idle');
      this.debugLog('Twitch socket disconnected (debug)', { reason });
    });

    client.on('reconnect', () => {
      this.log('Twitch socket reconnecting...');
      this.debugLog('Twitch attempting reconnect');
    });

    const processChatEvent = (chan, tags, message, self, fallbackType = null) => {
      this.handleChatEvent(channel, chan, tags, message, self, fallbackType).catch((err) => {
        this.debugLog('Failed to handle Twitch chat event', { error: err?.message || err });
      });
    };

    client.on('chat', (chan, tags, message, self) => {
      processChatEvent(chan, tags, message, self, 'chat');
    });

    client.on('action', (chan, tags, message, self) => {
      processChatEvent(chan, tags, message, self, 'action');
    });

    client.on('message', (chan, tags, message, self) => {
      const type = tags?.['message-type'];
      if (type === 'chat' || type === 'action') {
        return;
      }
      processChatEvent(chan, tags, message, self, type || 'message');
    });

    client.on('subscription', (chan, username, method, message, userstate) => {
      this.handleSubscriptionEvent({
        channel,
        username,
        methods: method,
        message,
        userstate,
        note: 'New Twitch subscription',
        eventType: 'subscription'
      }).catch((err) => this.debugLog('Failed to handle Twitch subscription', { error: err?.message || err }));
    });

    client.on('resub', (chan, username, months, message, userstate, methods) => {
      this.handleSubscriptionEvent({
        channel,
        username,
        methods,
        message,
        userstate,
        note: 'Twitch resubscription',
        eventType: 'resub'
      }).catch((err) => this.debugLog('Failed to handle Twitch resubscription', { error: err?.message || err }));
    });

    client.on('subgift', (chan, recipient, method, userstate) => {
      this.handleGiftEvent({
        channel,
        recipient,
        userstate,
        anonymous: false,
        note: 'Twitch gifted sub'
      }).catch((err) => this.debugLog('Failed to handle Twitch gifted sub', { error: err?.message || err }));
    });

    client.on('anonsubgift', (chan, recipient, method, userstate) => {
      this.handleGiftEvent({
        channel,
        recipient,
        userstate,
        anonymous: true,
        note: 'Anonymous gifted sub'
      }).catch((err) => this.debugLog('Failed to handle anonymous gifted sub', { error: err?.message || err }));
    });

    client.on('raided', (chan, username, viewers) => {
      this.handleRaidEvent({
        channel,
        username,
        viewers,
        note: 'Incoming raid'
      }).catch((err) => this.debugLog('Failed to handle Twitch raid', { error: err?.message || err }));
    });

    client.on('cheer', (chan, userstate, message) => {
      this.handleCheerEvent({
        channel,
        userstate,
        message,
        note: 'Twitch cheer'
      }).catch((err) => this.debugLog('Failed to handle Twitch cheer', { error: err?.message || err }));
    });

    client.on('hosted', (chan, username, viewers) => {
      this.handleHostEvent({
        channel,
        username,
        viewers,
        note: 'New host'
      }).catch((err) => this.debugLog('Failed to handle Twitch host', { error: err?.message || err }));
    });
  }

  async handleChatEvent(channel, sourceChannel, tags, message, self, fallbackType) {
    const messageType = tags?.['message-type'] || fallbackType || null;
    this.debugLog('Received Twitch chat message', {
      sourceChannel,
      resolvedChannel: channel,
      messageType: messageType || (tags?.bits ? 'bits' : 'message'),
      tags,
      message,
      self
    });
    const payload = this.transformChatMessage(channel, tags, message, self, messageType);
    await this.publishWithDecorations(payload, {
      channel,
      overrides: { userId: tags?.['room-id'] || tags?.roomId },
      rawMessage: typeof message === 'string' ? message : '',
      silent: true
    });
  }

  async handleSubscriptionEvent({ channel, username, methods, message, userstate, note, eventType }) {
    this.debugLog('Received Twitch subscription', {
      channel,
      username,
      methods,
      message,
      userstate,
      eventType
    });
    const payload = this.transformSubscription(channel, username, methods, message, userstate, eventType);
    await this.publishWithDecorations(payload, {
      channel,
      overrides: { userId: userstate?.['room-id'] || userstate?.roomId },
      rawMessage: typeof message === 'string' ? message : '',
      silent: false,
      note
    });
  }

  async handleGiftEvent({ channel, recipient, userstate, anonymous, note }) {
    this.debugLog('Received Twitch gifted sub', {
      channel,
      recipient,
      anonymous,
      userstate
    });
    const payload = this.transformGift(channel, recipient, userstate, anonymous);
    await this.publishWithDecorations(payload, {
      channel,
      overrides: { userId: userstate?.['room-id'] || userstate?.roomId },
      silent: false,
      note
    });
  }

  async handleRaidEvent({ channel, username, viewers, note }) {
    this.debugLog('Received Twitch raid', {
      channel,
      username,
      viewers
    });
    const payload = this.transformRaid(channel, username, viewers);
    await this.publishWithDecorations(payload, {
      channel,
      silent: false,
      note
    });
  }

  async handleCheerEvent({ channel, userstate, message, note }) {
    this.debugLog('Received Twitch cheer', {
      channel,
      userstate,
      message
    });
    const payload = this.transformCheer(channel, userstate, message);
    await this.publishWithDecorations(payload, {
      channel,
      overrides: { userId: userstate?.['room-id'] || userstate?.roomId },
      rawMessage: typeof message === 'string' ? message : '',
      silent: false,
      note
    });
  }

  async handleHostEvent({ channel, username, viewers, note }) {
    this.debugLog('Received Twitch host event', {
      channel,
      username,
      viewers
    });
    const payload = this.transformHost(channel, username, viewers);
    await this.publishWithDecorations(payload, {
      channel,
      silent: false,
      note
    });
  }

  async publishWithDecorations(payload, { channel, overrides = {}, rawMessage = '', silent = true, note = null } = {}) {
    if (!payload) {
      return;
    }

    if (typeof rawMessage === 'string' && rawMessage.length) {
      payload.previewText = rawMessage;
    } else if (typeof payload.previewText !== 'string' || !payload.previewText.length) {
      payload.previewText = htmlToText(payload.chatmessage || '');
    }

    const context = this.buildEmoteContext(channel, overrides);
    if (this.emotes && payload.chatmessage && !payload.textonly) {
      try {
        payload.chatmessage = await this.emotes.render(payload.chatmessage, context);
      } catch (err) {
        this.debugLog('Failed to render Twitch emotes', { error: err?.message || err });
      }
    }

    const options = { silent };
    if (note) {
      options.note = note;
    }
    options.preview = this.formatChatPreview(payload);
    this.publish(payload, options);
  }

  buildEmoteContext(channel, overrides = {}) {
    const context = {
      platform: 'twitch'
    };
    const normalizedChannel = channel ? sanitizeChannel(channel) : (this.channelName ? sanitizeChannel(this.channelName) : '');
    if (normalizedChannel) {
      context.channelName = normalizedChannel;
    }

    const overrideId = overrides?.userId || overrides?.channelId;
    if (overrideId) {
      this.channelUserId = String(overrideId);
    }

    if (!this.channelUserId && this.identity?.userId && normalizedChannel && sanitizeChannel(this.identity.login) === normalizedChannel) {
      this.channelUserId = String(this.identity.userId);
    }

    if (this.channelUserId) {
      context.userId = String(this.channelUserId);
      context.channelId = String(this.channelUserId);
    }

    return context;
  }

  async resolveChannelUserId(channelName) {
    const normalized = sanitizeChannel(channelName || '');
    if (!normalized) {
      return null;
    }
    if (this.channelUserId) {
      return this.channelUserId;
    }
    if (this.identity?.userId && sanitizeChannel(this.identity.login || '') === normalized) {
      this.channelUserId = String(this.identity.userId);
      return this.channelUserId;
    }
    try {
      const fetched = await this.fetchTwitchUserId(normalized);
      if (fetched) {
        this.channelUserId = String(fetched);
        return this.channelUserId;
      }
    } catch (err) {
      this.debugLog('Twitch user ID lookup failed', { error: err?.message || err });
    }
    return null;
  }

  async fetchTwitchUserId(username) {
    if (!username) {
      return null;
    }
    const url = `https://api.socialstream.ninja/twitch/user?username=${encodeURIComponent(username)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Lookup failed (${response.status})`);
    }
    const data = await response.json().catch(() => null);
    const id = data && data.data && data.data[0] && data.data[0].id ? data.data[0].id : null;
    return id ? String(id) : null;
  }

  formatChatPreview(chat) {
    if (!chat) {
      return 'New Twitch message';
    }

    const name = chat.chatname || 'Twitch user';
    const baseText = (chat.previewText ?? chat.chatmessage ?? '').toString();
    const trimmed = htmlToText(baseText)
      .replace(/\s+/g, ' ')
      .trim();

    if (chat.event === 'bits' && chat.bits) {
      const bits = Number.isFinite(chat.bits) ? chat.bits : parseInt(chat.bits, 10);
      const bitLabel = Number.isFinite(bits) ? `${bits} bit${bits === 1 ? '' : 's'}` : 'bits';
      return trimmed ? `${name} cheered ${bitLabel}: ${trimmed}` : `${name} cheered ${bitLabel}`;
    }

    if (chat.event && chat.event !== 'message' && !trimmed) {
      return `${name} ${chat.event}`;
    }

    return trimmed ? `${name}: ${trimmed}` : name;
  }

  transformChatMessage(channel, tags, message, isSelf = false, messageType = null) {
    const displayName = tags['display-name'] || tags.username || 'Twitch User';
    const userId = tags['user-id'];
    const badges = tags.badges || {};
    const normalizedType = messageType || tags['message-type'] || null;
    const event = tags.bits ? 'bits' : normalizedType === 'action' ? 'action' : 'message';
    const sanitizedMessage = safeHtml(message ?? '');

    return {
      id: tags.id || `${channel}-${tags['tmi-sent-ts'] || Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: displayName,
      chatmessage: sanitizedMessage,
      chatimg: avatarUrl(displayName),
      timestamp: Number(tags['tmi-sent-ts'] || Date.now()),
      badges,
      hasDonation: Boolean(tags.bits),
      bits: tags.bits ? parseInt(tags.bits, 10) : 0,
      isModerator: tags.mod === true || tags.mod === '1' || 'moderator' in badges,
      isOwner: 'broadcaster' in badges,
      isSubscriber: 'subscriber' in badges,
      userId,
      event,
      isSelf: Boolean(isSelf),
      raw: { channel, tags }
    };
  }

  transformCheer(channel, userstate, message) {
    const displayName = userstate['display-name'] || userstate.username || 'Anonymous';
    const sanitizedMessage = safeHtml(message ?? '');
    return {
      id: userstate.id || `${channel}-cheer-${Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: displayName,
      chatmessage: sanitizedMessage,
      chatimg: avatarUrl(displayName),
      timestamp: Number(userstate['tmi-sent-ts'] || Date.now()),
      hasDonation: true,
      bits: userstate.bits ? parseInt(userstate.bits, 10) : 0,
      event: 'cheer',
      raw: { channel, userstate }
    };
  }

  transformSubscription(channel, username, method, message, userstate, eventType) {
    const displayName = username || userstate['display-name'] || 'Subscriber';
    const fallback = `${displayName} subscribed!`;
    const sanitizedMessage = safeHtml(message ?? fallback);
    const cumulative = parseInt(userstate['msg-param-cumulative-months'] || userstate['msg-param-months'] || '0', 10) || null;
    return {
      id: userstate.id || `${channel}-${eventType}-${Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: displayName,
      chatmessage: sanitizedMessage,
      chatimg: avatarUrl(displayName),
      timestamp: Number(userstate['tmi-sent-ts'] || Date.now()),
      hasDonation: false,
      event: eventType,
      months: cumulative,
      raw: { channel, userstate }
    };
  }

  transformGift(channel, recipient, userstate, anonymous) {
    const gifter = anonymous ? 'Anonymous' : userstate['display-name'] || userstate.username || 'Viewer';
    const summary = `${gifter} gifted a sub to ${recipient}!`;
    return {
      id: userstate.id || `${channel}-gift-${Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: gifter,
      chatmessage: safeHtml(summary),
      chatimg: avatarUrl(gifter),
      timestamp: Number(userstate['tmi-sent-ts'] || Date.now()),
      event: 'subgift',
      hasDonation: true,
      raw: { channel, userstate }
    };
  }

  transformRaid(channel, username, viewers) {
    const summary = `${username} is raiding with ${viewers} viewers!`;
    return {
      id: `${channel}-raid-${Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: username,
      chatmessage: safeHtml(summary),
      chatimg: avatarUrl(username),
      timestamp: Date.now(),
      event: 'raid',
      hasDonation: false,
      raw: { channel, username, viewers }
    };
  }

  transformHost(channel, username, viewers) {
    const summary = `${username} is hosting with ${viewers} viewers!`;
    return {
      id: `${channel}-host-${Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: username,
      chatmessage: safeHtml(summary),
      chatimg: avatarUrl(username),
      timestamp: Date.now(),
      event: 'host',
      hasDonation: false,
      raw: { channel, username, viewers }
    };
  }
}

async function ensureTmiClient() {
  if (window.tmi?.Client) {
    return window.tmi;
  }

  if (!tmiLoaderPromise) {
    tmiLoaderPromise = (async () => {
      await loadScriptSequential(TMI_SOURCES, { timeout: 20000 });
      return window.tmi;
    })();
  }

  const library = await tmiLoaderPromise;
  if (!library || !library.Client) {
    throw new Error('tmi.js loaded but Twitch client is unavailable.');
  }
  return library;
}

function sanitizeChannel(value) {
  return value.replace(/^#+/, '').trim().toLowerCase();
}

function avatarUrl(username) {
  if (!username) return '';
  return `https://api.socialstream.ninja/twitch/large?username=${encodeURIComponent(username)}`;
}
