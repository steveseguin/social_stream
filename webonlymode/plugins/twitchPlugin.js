import { BasePlugin } from './basePlugin.js';
import { storage } from '../utils/storage.js';
import { randomSessionId, safeHtml } from '../utils/helpers.js';
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
  './vendor/tmi.min.js'
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

    client.on('message', (chan, tags, message, self) => {
      this.debugLog('Received Twitch chat message', {
        channel: chan,
        tags,
        message,
        self
      });
      if (self) return;
      const payload = this.transformChatMessage(channel, tags, message);
      this.publish(payload, { silent: true });
    });

    client.on('subscription', (chan, username, method, message, userstate) => {
      this.debugLog('Received Twitch subscription', {
        channel: chan,
        username,
        method,
        message,
        userstate
      });
      const payload = this.transformSubscription(channel, username, method, message, userstate, 'subscription');
      this.publish(payload, { silent: false, note: 'New Twitch subscription' });
    });

    client.on('resub', (chan, username, months, message, userstate, methods) => {
      this.debugLog('Received Twitch resubscription', {
        channel: chan,
        username,
        months,
        message,
        userstate,
        methods
      });
      const payload = this.transformSubscription(channel, username, methods, message, userstate, 'resub');
      this.publish(payload, { silent: false, note: 'Twitch resubscription' });
    });

    client.on('subgift', (chan, recipient, method, userstate) => {
      this.debugLog('Received Twitch gifted sub', {
        channel: chan,
        recipient,
        method,
        userstate
      });
      const payload = this.transformGift(channel, recipient, userstate, false);
      this.publish(payload, { silent: false, note: 'Twitch gifted sub' });
    });

    client.on('anonsubgift', (chan, recipient, method, userstate) => {
      this.debugLog('Received Twitch anonymous gifted sub', {
        channel: chan,
        recipient,
        method,
        userstate
      });
      const payload = this.transformGift(channel, recipient, userstate, true);
      this.publish(payload, { silent: false, note: 'Anonymous gifted sub' });
    });

    client.on('raided', (chan, username, viewers) => {
      this.debugLog('Received Twitch raid', {
        channel: chan,
        username,
        viewers
      });
      const payload = this.transformRaid(channel, username, viewers);
      this.publish(payload, { silent: false, note: 'Incoming raid' });
    });

    client.on('cheer', (chan, userstate, message) => {
      this.debugLog('Received Twitch cheer', {
        channel: chan,
        userstate,
        message
      });
      const payload = this.transformCheer(channel, userstate, message);
      this.publish(payload, { silent: false, note: 'Twitch cheer' });
    });

    client.on('hosted', (chan, username, viewers) => {
      this.debugLog('Received Twitch host event', {
        channel: chan,
        username,
        viewers
      });
      const payload = this.transformHost(channel, username, viewers);
      this.publish(payload, { silent: false, note: 'New host' });
    });
  }

  transformChatMessage(channel, tags, message) {
    const displayName = tags['display-name'] || tags.username || 'Twitch User';
    const userId = tags['user-id'];
    const badges = tags.badges || {};

    return {
      id: tags.id || `${channel}-${tags['tmi-sent-ts'] || Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: displayName,
      chatmessage: message,
      chatimg: avatarUrl(displayName),
      timestamp: Number(tags['tmi-sent-ts'] || Date.now()),
      badges,
      hasDonation: Boolean(tags.bits),
      bits: tags.bits ? parseInt(tags.bits, 10) : 0,
      isModerator: tags.mod === true || tags.mod === '1' || 'moderator' in badges,
      isOwner: 'broadcaster' in badges,
      isSubscriber: 'subscriber' in badges,
      userId,
      event: tags.bits ? 'bits' : 'message',
      raw: { channel, tags }
    };
  }

  transformCheer(channel, userstate, message) {
    const displayName = userstate['display-name'] || userstate.username || 'Anonymous';
    return {
      id: userstate.id || `${channel}-cheer-${Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: displayName,
      chatmessage: message,
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
    const cumulative = parseInt(userstate['msg-param-cumulative-months'] || userstate['msg-param-months'] || '0', 10) || null;
    return {
      id: userstate.id || `${channel}-${eventType}-${Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: displayName,
      chatmessage: message || `${displayName} subscribed!`,
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
    return {
      id: userstate.id || `${channel}-gift-${Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: gifter,
      chatmessage: `${gifter} gifted a sub to ${recipient}!`,
      chatimg: avatarUrl(gifter),
      timestamp: Number(userstate['tmi-sent-ts'] || Date.now()),
      event: 'subgift',
      hasDonation: true,
      raw: { channel, userstate }
    };
  }

  transformRaid(channel, username, viewers) {
    return {
      id: `${channel}-raid-${Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: username,
      chatmessage: `${username} is raiding with ${viewers} viewers!`,
      chatimg: avatarUrl(username),
      timestamp: Date.now(),
      event: 'raid',
      hasDonation: false,
      raw: { channel, username, viewers }
    };
  }

  transformHost(channel, username, viewers) {
    return {
      id: `${channel}-host-${Date.now()}`,
      platform: 'twitch',
      type: 'twitch',
      chatname: username,
      chatmessage: `${username} is hosting with ${viewers} viewers!`,
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
