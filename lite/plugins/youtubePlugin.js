import { BasePlugin } from './basePlugin.js';
import { storage } from '../utils/storage.js';
import { randomSessionId, safeHtml, htmlToText } from '../utils/helpers.js';

const TOKEN_KEY = 'youtube.token';
const CLIENT_ID_KEY = 'youtube.clientId';
const CHAT_ID_KEY = 'youtube.chatId';
const CHANNEL_KEY = 'youtube.channel';
const STATE_KEY = 'youtube.authState';

const DEFAULT_CLIENT_ID = '689627108309-isbjas8fmbc7sucmbm7gkqjapk7btbsi.apps.googleusercontent.com';
const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.channel-memberships.creator'
];

export class YoutubePlugin extends BasePlugin {
  constructor(options) {
    super({
      ...options,
      id: 'youtube',
      name: 'YouTube',
      description: 'Connect directly to YouTube live chat using OAuth and forward messages to overlays.'
    });

    this.clientIdInput = null;
    this.chatIdInput = null;
    this.statusLabel = null;
    this.streamLabel = null;
    this.signOutBtn = null;
    this.authButton = null;

    this.token = storage.get(TOKEN_KEY, null);
    this.channelInfo = storage.get(CHANNEL_KEY, null);
    this.pollTimer = null;
    this.nextPageToken = null;
    this.pollInterval = 5000;
    this.liveChatId = storage.get(CHAT_ID_KEY, '');
  }

  renderPrimary(container) {
    const statusWrap = document.createElement('div');
    statusWrap.className = 'plugin-status';

    const statusLabel = document.createElement('div');
    statusLabel.className = 'source-card__subtext';
    statusLabel.textContent = '';
    statusLabel.hidden = true;

    const streamLabel = document.createElement('div');
    streamLabel.className = 'source-card__subtext';
    streamLabel.hidden = !this.liveChatId;
    if (this.liveChatId) {
      streamLabel.textContent = `Live chat ID: ${this.liveChatId}`;
    }

    const controls = document.createElement('div');
    controls.className = 'plugin-actions';

    const authButton = document.createElement('button');
    authButton.type = 'button';
    authButton.className = 'btn';
    authButton.textContent = 'Sign in to YouTube';
    authButton.addEventListener('click', () => this.handleConnect());

    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'btn btn--ghost';
    signOut.textContent = 'Sign out';
    signOut.addEventListener('click', () => this.signOut());
    signOut.disabled = !this.token;

    controls.append(authButton, signOut);
    statusWrap.append(statusLabel, streamLabel, controls);

    container.append(statusWrap);
    this.clientIdInput = null;
    this.chatIdInput = null;
    this.statusLabel = statusLabel;
    this.streamLabel = streamLabel;
    this.signOutBtn = signOut;
    this.authButton = authButton;

    this.refreshStatus();
    return statusWrap;
  }

  renderSettings(container) {
    const chatRow = document.createElement('div');
    chatRow.className = 'field';

    const chatLabel = document.createElement('span');
    chatLabel.className = 'field__label';
    chatLabel.textContent = 'Live Chat ID (optional)';

    const chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.placeholder = 'Overrides automatic broadcast detection';
    chatInput.value = this.liveChatId || '';
    chatInput.addEventListener('change', () => {
      this.liveChatId = chatInput.value.trim();
      storage.set(CHAT_ID_KEY, this.liveChatId);
      this.refreshStatus();
    });

    chatRow.append(chatLabel, chatInput);
    container.append(chatRow);

    this.chatIdInput = chatInput;

    return container;
  }

  refreshStatus() {
    if (this.statusLabel) {
      if (this.token && !this.isTokenExpired()) {
        const channelName = this.channelInfo?.title || 'Your channel';
        this.statusLabel.innerHTML = `Authorized as <strong>${safeHtml(channelName)}</strong>`;
        this.statusLabel.hidden = false;
      } else {
        this.statusLabel.textContent = '';
        this.statusLabel.hidden = true;
      }
    }

    if (this.streamLabel) {
      if (this.liveChatId) {
        this.streamLabel.textContent = `Live chat ID: ${this.liveChatId}`;
        this.streamLabel.hidden = false;
      } else {
        this.streamLabel.textContent = '';
        this.streamLabel.hidden = true;
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
      throw new Error('Start a session before connecting YouTube.');
    }

    if (this.isTokenValid()) {
      this.setupLiveChat();
      return;
    }

    this.beginAuth();
  }

  disable() {
    if (this.pollTimer) {
      window.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.nextPageToken = null;
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
      access_type: 'online',
      include_granted_scopes: 'true',
      scope: YT_SCOPES.join(' '),
      state,
      prompt: 'consent'
    });

    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }

  handleOAuthCallback(params) {
    const access = params.get('access_token');
    const expires = parseInt(params.get('expires_in'), 10) || 3600;
    const scope = params.get('scope') || '';
    const state = params.get('state');

    const storedState = storage.get(STATE_KEY, null);
    if (!storedState || storedState !== state) {
      throw new Error('OAuth state mismatch for YouTube.');
    }

    storage.remove(STATE_KEY);

    const tokenData = {
      accessToken: access,
      scope,
      tokenType: params.get('token_type') || 'Bearer',
      expiresAt: Date.now() + (expires - 60) * 1000
    };

    storage.set(TOKEN_KEY, tokenData);
    this.token = tokenData;
    this.refreshStatus();

    if (this.messenger.getSessionId()) {
      this.setState('connecting');
      this.log('Authorization successful. Connecting to live chat...');
      this.setupLiveChat();
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
    storage.remove(CHANNEL_KEY);
    this.token = null;
    this.channelInfo = null;
    this.refreshStatus();
    if (this.state === 'connected') {
      this.disable();
      this.setState('idle');
    }
  }

  async setupLiveChat() {
    if (!this.messenger.getSessionId()) {
      throw new Error('Start a session before connecting YouTube.');
    }
    try {
      const chatId = await this.resolveLiveChatId();
      if (!chatId) {
        throw new Error('No active live chat found. Start a broadcast or provide a Live Chat ID.');
      }
      this.liveChatId = chatId;
      storage.set(CHAT_ID_KEY, this.liveChatId);
      this.refreshStatus();
      this.setState('connected');
      this.log('Connected to YouTube live chat.', { liveChatId: this.liveChatId });
      await this.prepareEmotesForChannel();
      this.pollChat();
    } catch (err) {
      this.reportError(err);
    }
  }

  async resolveLiveChatId() {
    if (this.chatIdInput && this.chatIdInput.value.trim()) {
      return this.chatIdInput.value.trim();
    }

    if (!this.isTokenValid()) {
      throw new Error('YouTube token expired. Please reconnect.');
    }

    const headers = {
      Authorization: `Bearer ${this.token.accessToken}`,
      Accept: 'application/json'
    };

    // Step 1: Fetch active live broadcasts for the authenticated channel.
    const broadcastRes = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,contentDetails,status&broadcastStatus=active&broadcastType=all&mine=true', { headers });
    if (!broadcastRes.ok) {
      const errBody = await broadcastRes.json().catch(() => ({}));
      throw this.createApiError(errBody, broadcastRes.status, 'liveBroadcasts');
    }
    const broadcastData = await broadcastRes.json();
    if (broadcastData.items && broadcastData.items.length) {
      const live = broadcastData.items.find(item => item.snippet?.liveChatId) || broadcastData.items[0];
      this.channelInfo = {
        id: live?.snippet?.channelId,
        title: live?.snippet?.channelTitle,
        thumbnail: live?.snippet?.thumbnails?.default?.url
      };
      storage.set(CHANNEL_KEY, this.channelInfo);
      return live?.snippet?.liveChatId || null;
    }

    // No active broadcasts found. Attempt to fetch upcoming (to give better info)
    const upcomingRes = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status&broadcastStatus=upcoming&mine=true', { headers });
    if (upcomingRes.ok) {
      const upcomingData = await upcomingRes.json();
      if (upcomingData.items && upcomingData.items.length) {
        this.channelInfo = {
          id: upcomingData.items[0]?.snippet?.channelId,
          title: upcomingData.items[0]?.snippet?.channelTitle
        };
        storage.set(CHANNEL_KEY, this.channelInfo);
      }
    }

    return null;
  }

  async pollChat() {
    if (this.state !== 'connected') {
      return;
    }
    if (!this.isTokenValid()) {
      this.setState('idle');
      this.log('YouTube token expired during polling.');
      return;
    }
    if (!this.liveChatId) {
      this.setState('idle');
      this.log('Live chat ID missing; stopping YouTube polling.');
      return;
    }

    try {
      const params = new URLSearchParams({
        part: 'snippet,authorDetails',
        liveChatId: this.liveChatId,
        maxResults: '200'
      });
      if (this.nextPageToken) {
        params.set('pageToken', this.nextPageToken);
      }

      const res = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${this.token.accessToken}`,
          Accept: 'application/json'
        }
      });

      if (res.status === 401) {
        throw new Error('YouTube authentication expired. Please reconnect.');
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw this.createApiError(err, res.status, 'liveChat.messages');
      }

      const data = await res.json();
      if (this.state !== 'connected') {
        return;
      }
      this.nextPageToken = data.nextPageToken || null;
      this.pollInterval = data.pollingIntervalMillis ? Math.max(data.pollingIntervalMillis, 1200) : this.pollInterval;

      if (Array.isArray(data.items) && data.items.length) {
        await Promise.all(
          data.items.map((item) =>
            this.transformAndPublish(item).catch((err) => {
              this.debugLog('Failed to process YouTube chat item', {
                error: err?.message || err,
                itemId: item?.id
              });
              return null;
            })
          )
        );
      }
    } catch (err) {
      this.reportError(err);
      return;
    }

    if (this.state !== 'connected') {
      return;
    }
    this.pollTimer = window.setTimeout(() => this.pollChat(), this.pollInterval);
  }

  createApiError(body, status, endpoint) {
    const errorInfo = body?.error || {};
    const firstError = Array.isArray(errorInfo.errors) ? errorInfo.errors[0] : null;
    const reason = firstError?.reason || errorInfo.status || '';
    const rawMessage = typeof errorInfo.message === 'string' ? errorInfo.message : '';
    const scrubbedMessage = rawMessage.replace(/<[^>]*>/g, '').trim();
    const fallback = endpoint ? `YouTube ${endpoint} error (${status})` : `YouTube API error (${status})`;

    let message = scrubbedMessage || fallback;
    const messageLower = scrubbedMessage.toLowerCase();
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || messageLower.includes('quota')) {
      message = 'YouTube API quota exhausted. Please wait for the daily quota reset or add your own YouTube API credentials in Settings.';
    }

    const error = new Error(message);
    error.detail = body;
    error.status = status;
    error.reason = reason;
    error.endpoint = endpoint;
    return error;
  }

  async transformAndPublish(item) {
    if (!item) {
      return;
    }
    const snippet = item.snippet || {};
    const author = item.authorDetails || {};
    const rawMessage = snippet.displayMessage || '';
    const sanitizedMessage = safeHtml(rawMessage);

    const message = {
      id: item.id,
      platform: 'youtube',
      type: 'youtube',
      chatname: author.displayName || 'YouTube User',
      chatmessage: sanitizedMessage,
      chatimg: author.profileImageUrl || '',
      timestamp: Date.parse(snippet.publishedAt || new Date().toISOString()),
      hasDonation: Boolean(snippet.superChatDetails || snippet.superStickerDetails),
      donationAmount: snippet.superChatDetails?.amountDisplayString,
      donationCurrency: snippet.superChatDetails?.currency,
      isModerator: !!author.isChatModerator,
      isOwner: !!author.isChatOwner,
      isMember: !!author.isChatSponsor,
      event: this.resolveEvent(snippet),
      raw: item,
      previewText: rawMessage
    };

    if (snippet.superChatDetails) {
      message.color = snippet.superChatDetails.tier || snippet.superChatDetails.tier || null;
    }

    await this.publishWithEmotes(message, { silent: true });
  }

  async publishWithEmotes(message, options = {}) {
    if (!message) {
      return;
    }
    const { silent = true, note = null } = options;

    if (typeof message.previewText !== 'string' || !message.previewText.length) {
      message.previewText = htmlToText(message.chatmessage || '');
    }

    if (this.emotes && message.chatmessage && !message.textonly) {
      try {
        message.chatmessage = await this.emotes.render(message.chatmessage, this.buildEmoteContext());
      } catch (err) {
        this.debugLog('Failed to render YouTube emotes', { error: err?.message || err });
      }
    }

    const publishOptions = { silent, preview: this.formatChatPreview(message) };
    if (note) {
      publishOptions.note = note;
    }
    this.publish(message, publishOptions);
  }

  buildEmoteContext() {
    const context = { platform: 'youtube' };
    if (this.channelInfo?.title) {
      context.channelName = this.channelInfo.title.toLowerCase();
    }
    if (this.channelInfo?.id) {
      context.channelId = this.channelInfo.id;
      context.userId = this.channelInfo.id;
    }
    return context;
  }

  async prepareEmotesForChannel() {
    if (!this.emotes) {
      return;
    }
    const context = this.buildEmoteContext();
    if (!context.channelId && !context.channelName) {
      return;
    }
    await this.emotes.prepareChannel(context).catch(() => {});
  }

  resolveEvent(snippet) {
    if (!snippet) return null;
    if (snippet.type === 'superChatEvent') return 'superchat';
    if (snippet.type === 'superStickerEvent') return 'supersticker';
    if (snippet.type === 'newSponsorEvent') return 'membership';
    if (snippet.membershipGiftingDetails) return 'gift';
    if (snippet.type === 'fanFundingEvent') return 'donation';
    return snippet.type || null;
  }

  formatChatPreview(chat) {
    if (!chat) {
      return 'New YouTube message';
    }

    const name = chat.chatname || 'YouTube user';
    const baseText = (chat.previewText ?? chat.chatmessage ?? '').toString();
    const trimmed = htmlToText(baseText)
      .replace(/\s+/g, ' ')
      .trim();

    if (chat.event === 'superchat') {
      return trimmed ? `${name} sent a Super Chat: ${trimmed}` : `${name} sent a Super Chat`;
    }

    if (chat.event === 'supersticker') {
      return `${name} sent a Super Sticker`; // stickers rarely include text
    }

    if (chat.event && chat.event !== 'chat' && !trimmed) {
      return `${name} ${chat.event}`;
    }

    return trimmed ? `${name}: ${trimmed}` : name;
  }

  shouldAutoConnect() {
    return super.shouldAutoConnect() && this.isTokenValid();
  }
}
