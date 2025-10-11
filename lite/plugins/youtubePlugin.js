
import { BasePlugin } from './basePlugin.js';
import { storage } from '../utils/storage.js';
import { randomSessionId, safeHtml, htmlToText } from '../utils/helpers.js';

const TOKEN_KEY = 'youtube.token';
const CLIENT_ID_KEY = 'youtube.clientId';
const CHAT_ID_KEY = 'youtube.chatId';
const CHANNEL_KEY = 'youtube.channel';
const STATE_KEY = 'youtube.authState';

const DEFAULT_CLIENT_ID = '689627108309-isbjas8fmbc7sucmbm7gkqjapk7btbsi.apps.googleusercontent.com';
const SUBSCRIBER_CACHE_KEY = 'youtube.subscriberCache';
const SUBSCRIBER_CACHE_LIMIT = 200;
const SUBSCRIBER_POLL_INTERVAL = 120000;
const CAPTURE_EVENTS_KEY = 'settings.captureevents';

const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.channel-memberships.creator'
];


export class YoutubePlugin extends BasePlugin {
  constructor(options) {
    const { useStreaming = false, onStreamingPreferenceChange = null } = options || {};


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
    this.activeBroadcast = null;
    this.streamingToggleInput = null;
    this.useStreaming = Boolean(useStreaming);
    this.onStreamingPreferenceChange = typeof onStreamingPreferenceChange === 'function' ? onStreamingPreferenceChange : null;

    const cachedSubscribers = storage.get(SUBSCRIBER_CACHE_KEY, null);
    const cachedKeys = Array.isArray(cachedSubscribers?.keys) ? cachedSubscribers.keys.slice(0, SUBSCRIBER_CACHE_LIMIT) : [];
    this.seenSubscriberKeys = new Set(cachedKeys);
    this.lastSubscriberTimestamp = Number(cachedSubscribers?.timestamp) || 0;
    this.subscriberPollTimer = null;
    this.subscriberFeatureUnavailable = false;
    this.subscriberErrorNotified = false;
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
    streamLabel.textContent = '';
    streamLabel.hidden = true;

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
    chatLabel.textContent = 'Live Chat ID or Video ID (optional)';

    const chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.placeholder = 'e.g., dQw4w9WgXcQ (video ID) or Cg0KC... (chat ID)';
    chatInput.value = this.liveChatId || '';
    chatInput.addEventListener('change', () => {
      const newValue = chatInput.value.trim();
      const oldValue = this.liveChatId;
      this.liveChatId = newValue;
      storage.set(CHAT_ID_KEY, this.liveChatId);
      this.refreshStatus();

      // If connected and the Video/Chat ID changed, reconnect
      if (this.state === 'connected' && newValue !== oldValue) {
        this.log('Video/Chat ID changed. Reconnecting...');
        this.setState('connecting');
        this.disable();
        this.refreshStatus();
        setTimeout(() => {
          this.setupLiveChat();
        }, 500);
      }
    });

    chatRow.append(chatLabel, chatInput);
    container.append(chatRow);

    this.chatIdInput = chatInput;

    const streamingGroup = document.createElement('div');
    streamingGroup.className = 'field field--checkbox-group';

    const streamingToggle = document.createElement('label');
    streamingToggle.className = 'checkbox';

    const streamingInput = document.createElement('input');
    streamingInput.type = 'checkbox';
    streamingInput.addEventListener('change', () => {
      this.setStreamingPreference(streamingInput.checked, { notify: true });
    });

    const streamingLabel = document.createElement('span');
    streamingLabel.textContent = 'Use YouTube streaming API (beta)';

    streamingToggle.append(streamingInput, streamingLabel);
    streamingGroup.append(streamingToggle);
    container.append(streamingGroup);

    this.streamingToggleInput = streamingInput;
    this.applyStreamingPreferenceToControl();

    return container;
  }

  setStreamingPreference(useStreaming, options = {}) {
    const { notify = false } = options || {};
    const nextValue = Boolean(useStreaming);

    if (nextValue === this.useStreaming) {
      this.applyStreamingPreferenceToControl();
      return;
    }

    this.useStreaming = nextValue;
    this.applyStreamingPreferenceToControl();

    if (notify && typeof this.onStreamingPreferenceChange === 'function') {
      this.onStreamingPreferenceChange(nextValue);
    }
  }

  applyStreamingPreferenceToControl() {
    if (this.streamingToggleInput) {
      this.streamingToggleInput.checked = this.useStreaming;
    }
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
      let labelText = '';

      if (this.activeBroadcast) {
        if (this.activeBroadcast.title) {
          labelText = `Active broadcast: ${this.activeBroadcast.title}`;
        } else if (this.activeBroadcast.videoId) {
          labelText = `Video ID: ${this.activeBroadcast.videoId}`;
        }
      }

      if (!labelText && this.state === 'connected' && this.liveChatId) {
        labelText = 'Connected to YouTube live chat';
      }

      if (labelText) {
        this.streamLabel.textContent = labelText;
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

  setActiveBroadcast(info) {
    if (!info) {
      this.activeBroadcast = null;
      return;
    }

    const title = info.title ? htmlToText(info.title).trim() : '';
    const videoId = info.videoId || '';
    const liveChatId = info.liveChatId || '';
    const type = info.type || 'custom';

    if (!title && !videoId) {
      this.activeBroadcast = null;
      return;
    }

    this.activeBroadcast = {
      title,
      videoId,
      liveChatId,
      type
    };
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
    this.stopListening();
    this.nextPageToken = null;
    this.setActiveBroadcast(null);
    this.stopSubscriberWatcher();
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
    this.refreshSubscriberCapability(tokenData, { force: true });
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
    this.setActiveBroadcast(null);
    if (this.state === 'connected') {
      this.disable();
    }
    this.stopSubscriberWatcher();
    this.seenSubscriberKeys.clear();
    this.lastSubscriberTimestamp = 0;
    this.subscriberFeatureUnavailable = false;
    this.subscriberErrorNotified = false;
    storage.remove(SUBSCRIBER_CACHE_KEY);
    this.setState('idle');
    this.refreshStatus();
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
      this.setState('connected');
      this.refreshStatus();
      this.log('Connected to YouTube live chat.', { liveChatId: this.liveChatId });
      await this.prepareEmotesForChannel();
      this.stopListening();
      this.startListening();
      this.startSubscriberWatcher();
    } catch (err) {
      this.reportError(err);
    }
  }

  async getLiveChatIdFromVideoId(videoId) {
    if (!this.isTokenValid()) {
      throw new Error('YouTube token expired. Please reconnect.');
    }

    const headers = {
      Authorization: `Bearer ${this.token.accessToken}`,
      Accept: 'application/json'
    };

    // Fetch video details to get the live chat ID
    const videoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoId}`, { headers });
    if (!videoRes.ok) {
      const errBody = await videoRes.json().catch(() => ({}));
      throw this.createApiError(errBody, videoRes.status, 'videos');
    }

    const videoData = await videoRes.json();
    if (videoData.items && videoData.items.length > 0) {
      const videoItem = videoData.items[0] || {};
      const liveChatId = videoItem?.liveStreamingDetails?.activeLiveChatId;
      if (liveChatId) {
        this.log(`Resolved video ID ${videoId} to live chat ID: ${liveChatId}`);
        this.setActiveBroadcast({
          title: videoItem?.snippet?.title,
          videoId,
          liveChatId,
          type: 'video'
        });
        return liveChatId;
      }
      const noLiveChatErr = new Error(`Video ${videoId} does not have an active live chat. Make sure the video is currently live.`);
      noLiveChatErr.code = 'VIDEO_HAS_NO_LIVE_CHAT';
      throw noLiveChatErr;
    }

    const notFoundErr = new Error(`Video ${videoId} not found or inaccessible.`);
    notFoundErr.code = 'VIDEO_NOT_FOUND';
    throw notFoundErr;
  }

  async resolveLiveChatId() {
    // Check DOM input first (if settings panel is open)
    let manualId = '';
    if (this.chatIdInput && this.chatIdInput.value.trim()) {
      manualId = this.chatIdInput.value.trim();
    }
    // Check stored value (from previous sessions or if settings not rendered)
    else if (this.liveChatId && this.liveChatId.trim()) {
      manualId = this.liveChatId.trim();
    }

    // If manual ID provided, check if it's a video ID or chat ID
    if (manualId) {
      // Video IDs are typically 11 characters, Live Chat IDs are longer
      if (manualId.length === 11) {
        // Looks like a video ID - try to fetch the live chat ID from it
        try {
          return await this.getLiveChatIdFromVideoId(manualId);
        } catch (err) {
          const fallbackReasons = new Set(['notFound', 'videoNotFound', 'invalidParameter', 'badRequest', 'idNotFound']);
          if (err?.code === 'VIDEO_NOT_FOUND' || fallbackReasons.has(err?.reason) || err?.status === 404) {
            this.debugLog('Manual ID fallback to live chat ID', { manualId, error: err?.message });
            this.setActiveBroadcast(null);
            return manualId;
          }
          throw err;
        }
      }
      // Assume it's already a live chat ID
      this.setActiveBroadcast(null);
      return manualId;
    }

    if (!this.isTokenValid()) {
      throw new Error('YouTube token expired. Please reconnect.');
    }

    const headers = {
      Authorization: `Bearer ${this.token.accessToken}`,
      Accept: 'application/json'
    };

    // Step 1: Fetch active live broadcasts for the authenticated channel.
    // Note: Cannot use both 'mine' and 'broadcastStatus' together - use separate calls
    const broadcastRes = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,contentDetails,status&mine=true', { headers });
    if (!broadcastRes.ok) {
      const errBody = await broadcastRes.json().catch(() => ({}));
      throw this.createApiError(errBody, broadcastRes.status, 'liveBroadcasts');
    }
    const broadcastData = await broadcastRes.json();
    if (broadcastData.items && broadcastData.items.length) {
      // Filter for active broadcasts
      const activeItems = broadcastData.items.filter(item =>
        item.status?.lifeCycleStatus === 'live' ||
        item.status?.lifeCycleStatus === 'liveStarting'
      );
      if (activeItems.length) {
        const live = activeItems.find(item => item.snippet?.liveChatId) || activeItems[0];
        this.channelInfo = {
          id: live?.snippet?.channelId,
          title: live?.snippet?.channelTitle,
          thumbnail: live?.snippet?.thumbnails?.default?.url
        };
        storage.set(CHANNEL_KEY, this.channelInfo);
        this.setActiveBroadcast({
          title: live?.snippet?.title,
          videoId: live?.id,
          liveChatId: live?.snippet?.liveChatId,
          type: 'broadcast'
        });
        return live?.snippet?.liveChatId || null;
      }
    }

    // No active broadcasts found. Check if we got upcoming broadcasts
    if (broadcastData.items && broadcastData.items.length) {
      const upcomingItems = broadcastData.items.filter(item =>
        item.status?.lifeCycleStatus === 'ready' ||
        item.status?.lifeCycleStatus === 'testing'
      );
      if (upcomingItems.length) {
        this.channelInfo = {
          id: upcomingItems[0]?.snippet?.channelId,
          title: upcomingItems[0]?.snippet?.channelTitle
        };
        storage.set(CHANNEL_KEY, this.channelInfo);
      }
    }

    // For backwards compatibility, also try the old approach
    const upcomingRes = await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status&mine=true', { headers });
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

    this.setActiveBroadcast(null);
    return null;
  }

  startListening() {
    this.pollChat();
  }

  stopListening() {
    if (this.pollTimer) {
      window.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
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

    let publishNote = null;
    const membershipInfo = this.deriveMembershipMetadata(snippet, sanitizedMessage);

    if (membershipInfo) {
      if (membershipInfo.membership) {
        message.membership = membershipInfo.membership;
      }
      if (membershipInfo.subtitle) {
        message.subtitle = membershipInfo.subtitle;
      }
      if (membershipInfo.event) {
        message.event = membershipInfo.event;
      }
      if (membershipInfo.previewText) {
        message.previewText = membershipInfo.previewText;
      }
      if (membershipInfo.chatmessage) {
        message.chatmessage = membershipInfo.chatmessage;
      }
      if (membershipInfo.membershipLevel) {
        message.membershipLevel = membershipInfo.membershipLevel;
      }
      if (membershipInfo.membershipMonths) {
        message.membershipMonths = membershipInfo.membershipMonths;
      }
      if (membershipInfo.membershipGiftCount) {
        message.membershipGiftCount = membershipInfo.membershipGiftCount;
      }
      if (membershipInfo.membershipGifter) {
        message.membershipGifter = membershipInfo.membershipGifter;
      }
      publishNote = membershipInfo.note || null;
    }

    const badges = this.buildChatBadges(author, { includeMemberBadge: membershipInfo?.includeMemberBadge });
    if (badges.length) {
      message.chatbadges = badges;
    }

    if (snippet.superChatDetails) {
      message.color = snippet.superChatDetails.tier || snippet.superChatDetails.tier || null;
    }

    await this.publishWithEmotes(message, { silent: true, note: publishNote });
  }

  buildChatBadges(author, options = {}) {
    const includeMemberBadge = Boolean(options?.includeMemberBadge);
    const badges = [];

    if (author?.isChatOwner) {
      badges.push({ type: 'text', text: '👑' });
    }
    if (author?.isChatModerator) {
      badges.push({ type: 'text', text: '🛡️' });
    }
    if ((author && author.isChatSponsor) || includeMemberBadge) {
      badges.push({ type: 'text', text: '⭐' });
    }

    return badges;
  }

  deriveMembershipMetadata(snippet, sanitizedMessage) {
    if (!snippet) {
      return null;
    }

    const type = typeof snippet.type === 'string' ? snippet.type.trim().toLowerCase() : '';
    const toPlainText = (value) => htmlToText(value || '').trim();
    const fallbackPreview = () => {
      const fromSnippet = toPlainText(snippet.displayMessage || '');
      if (fromSnippet) {
        return fromSnippet;
      }
      if (sanitizedMessage) {
        const fromSanitized = toPlainText(sanitizedMessage);
        if (fromSanitized) {
          return fromSanitized;
        }
      }
      return '';
    };

    let result = null;

    if (type === 'newsponsorevent') {
      const details = snippet.newSponsorDetails || {};
      const level = toPlainText(details.memberLevelName);
      const isUpgrade = Boolean(details.isUpgrade);
      const membershipLabel = isUpgrade ? 'Membership Upgrade' : 'New Member';
      const subtitle = level || (isUpgrade ? 'Upgraded channel membership' : 'Joined channel membership');

      result = {
        membership: membershipLabel,
        subtitle,
        event: isUpgrade ? 'membership_upgrade' : 'membership',
        note: level ? `${membershipLabel}: ${level}` : membershipLabel,
        includeMemberBadge: true
      };

      if (level) {
        result.membershipLevel = level;
      }
    } else if (type === 'membermilestonechatevent') {
      const details = snippet.memberMilestoneChatDetails || {};
      const level = toPlainText(details.memberLevelName);
      const monthsRaw = Number(details.memberMonth);
      const hasMonths = Number.isFinite(monthsRaw) && monthsRaw > 0;
      const monthLabel = hasMonths ? `${monthsRaw} month${monthsRaw === 1 ? '' : 's'}` : '';
      const subtitleParts = [];
      if (monthLabel) {
        subtitleParts.push(monthLabel);
      }
      if (level) {
        subtitleParts.push(level);
      }

      result = {
        membership: 'Membership Milestone',
        subtitle: subtitleParts.join(' · ') || null,
        event: 'membership_milestone',
        note: subtitleParts.join(' · ') || 'Membership Milestone',
        includeMemberBadge: true
      };

      if (hasMonths) {
        result.membershipMonths = monthsRaw;
      }
      if (level) {
        result.membershipLevel = level;
      }
    } else if (type === 'membershipgiftingevent' || snippet.membershipGiftingDetails) {
      const details = snippet.membershipGiftingDetails || {};
      const level = toPlainText(details.giftMembershipsLevelName);
      const countRaw = Number(details.giftMembershipsCount);
      const count = Number.isFinite(countRaw) && countRaw > 0 ? countRaw : 1;
      const membershipLabel = count === 1 ? 'Gifted a Membership' : `Gifted ${count} Memberships`;

      result = {
        membership: membershipLabel,
        subtitle: level || null,
        event: 'membership_gift',
        note: level ? `${membershipLabel} (${level})` : membershipLabel,
        includeMemberBadge: true,
        membershipGiftCount: count
      };

      if (level) {
        result.membershipLevel = level;
      }
    } else if (type === 'giftmembershipreceivedevent' || snippet.giftMembershipReceivedDetails) {
      const details = snippet.giftMembershipReceivedDetails || {};
      const level = toPlainText(details.memberLevelName);
      const gifter = toPlainText(details.gifterDisplayName);
      const subtitleParts = [];
      if (level) {
        subtitleParts.push(level);
      }
      if (gifter) {
        subtitleParts.push(`From ${gifter}`);
      }

      result = {
        membership: 'Gift Membership',
        subtitle: subtitleParts.join(' · ') || null,
        event: 'membership_gift_received',
        note: subtitleParts.join(' · ') || 'Gift Membership',
        includeMemberBadge: true
      };

      if (level) {
        result.membershipLevel = level;
      }
      if (gifter) {
        result.membershipGifter = gifter;
      }
    }

    if (!result && snippet.membershipDetails) {
      const details = snippet.membershipDetails;
      const level = toPlainText(details.memberLevelName);

      result = {
        membership: 'Membership',
        subtitle: level || null,
        event: 'membership',
        note: level ? `Membership: ${level}` : 'Membership',
        includeMemberBadge: true
      };

      if (level) {
        result.membershipLevel = level;
      }
    }

    if (!result) {
      return null;
    }

    if (!result.previewText) {
      const preview = fallbackPreview();
      result.previewText = preview || result.membership || '';
    }

    return result;
  }

  hasMembershipScope(token = this.token) {
    const scopeValue = token?.scope;
    if (!scopeValue) {
      return false;
    }
    if (Array.isArray(scopeValue)) {
      return scopeValue.includes('https://www.googleapis.com/auth/youtube.channel-memberships.creator');
    }
    if (typeof scopeValue === 'string') {
      return scopeValue.split(/\s+/).includes('https://www.googleapis.com/auth/youtube.channel-memberships.creator');
    }
    return false;
  }

  refreshSubscriberCapability(token = this.token, options = {}) {
    const { force = false } = options;
    if (force || this.hasMembershipScope(token)) {
      this.subscriberFeatureUnavailable = false;
      this.subscriberErrorNotified = false;
    }
  }

  shouldCaptureStreamEvents() {
    const stored = storage.get(CAPTURE_EVENTS_KEY, null);
    if (stored === null || stored === undefined) {
      return true;
    }
    return Boolean(stored);
  }

  startSubscriberWatcher() {
    if (this.subscriberFeatureUnavailable) {
      this.refreshSubscriberCapability();
      if (this.subscriberFeatureUnavailable) {
        return;
      }
    }

    if (!this.shouldCaptureStreamEvents()) {
      return;
    }
    if (this.state !== 'connected') {
      return;
    }
    this.scheduleSubscriberPoll(0);
  }

  scheduleSubscriberPoll(delay = SUBSCRIBER_POLL_INTERVAL) {
    if (this.subscriberFeatureUnavailable || !this.shouldCaptureStreamEvents()) {
      return;
    }
    if (this.subscriberPollTimer) {
      window.clearTimeout(this.subscriberPollTimer);
    }
    this.subscriberPollTimer = window.setTimeout(async () => {
      this.subscriberPollTimer = null;
      try {
        await this.pollRecentSubscribers();
      } catch (err) {
        this.debugLog('YouTube subscriber poll failed', { error: err?.message || err });
      }
      if (this.state === 'connected' && !this.subscriberFeatureUnavailable && this.shouldCaptureStreamEvents()) {
        this.scheduleSubscriberPoll(SUBSCRIBER_POLL_INTERVAL);
      }
    }, Math.max(0, delay));
  }

  stopSubscriberWatcher() {
    if (this.subscriberPollTimer) {
      window.clearTimeout(this.subscriberPollTimer);
      this.subscriberPollTimer = null;
    }
  }

  async pollRecentSubscribers() {
    if (this.state !== 'connected') {
      return;
    }
    if (!this.isTokenValid()) {
      return;
    }
    if (!this.shouldCaptureStreamEvents()) {
      return;

    }

    const headers = {
      Authorization: `Bearer ${this.token.accessToken}`,
      Accept: 'application/json'
    };

    const params = new URLSearchParams({
      part: 'snippet,subscriberSnippet',
      myRecentSubscribers: 'true',
      maxResults: '50'
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?${params.toString()}`, {
      headers
    });

    if (res.status === 401) {
      throw new Error('YouTube authentication expired while checking subscribers.');
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const apiErr = this.createApiError(errBody, res.status, 'subscriptions');
      if (apiErr.status === 403 || apiErr.reason === 'subscriptionForbidden' || apiErr.reason === 'insufficientPermissions') {
        if (!this.subscriberErrorNotified) {
          this.subscriberErrorNotified = true;
          this.log('Unable to access YouTube subscriber list; subscriber events disabled for this session.', { reason: apiErr.reason || apiErr.status }, { kind: 'warn' });
        }
        this.subscriberFeatureUnavailable = true;
        this.stopSubscriberWatcher();
        return;
      }
      throw apiErr;
    }

    const data = await res.json();
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return;
    }

    const previousKeys = Array.from(this.seenSubscriberKeys);
    const batchKeys = [];
    const newEntries = [];
    let maxTimestamp = this.lastSubscriberTimestamp || 0;

    data.items.forEach((item) => {
      const snippet = item?.snippet || {};
      const subscriberSnippet = item?.subscriberSnippet || {};
      const publishedRaw = snippet?.publishedAt || subscriberSnippet?.publishedAt || '';
      const parsed = publishedRaw ? Date.parse(publishedRaw) : NaN;
      const publishedAt = Number.isFinite(parsed) ? parsed : Date.now();
      if (Number.isFinite(parsed) && parsed > maxTimestamp) {
        maxTimestamp = parsed;
      }
      const subscriberId = subscriberSnippet?.channelId || item?.id || '';
      const key = `${subscriberId}:${publishedAt}`;
      batchKeys.push(key);
      if (!this.seenSubscriberKeys.has(key)) {
        newEntries.push({ item, snippet, subscriberSnippet, publishedAt, key });
      }
    });

    let cacheChanged = false;
    if (batchKeys.length) {
      const merged = [];
      const pushUnique = (value) => {
        if (!merged.includes(value)) {
          merged.push(value);
        }
      };
      batchKeys.forEach(pushUnique);
      previousKeys.forEach(pushUnique);
      const limited = merged.slice(0, SUBSCRIBER_CACHE_LIMIT);
      if (limited.length !== previousKeys.length || limited.some((value, index) => value !== previousKeys[index])) {
        cacheChanged = true;
        this.seenSubscriberKeys = new Set(limited);
      }
    }

    const timestampChanged = maxTimestamp > (this.lastSubscriberTimestamp || 0);
    if ((cacheChanged || timestampChanged) && maxTimestamp) {
      this.lastSubscriberTimestamp = maxTimestamp;
      this.persistSubscriberCache();
    }

    if (!newEntries.length) {
      return;
    }

    for (let index = newEntries.length - 1; index >= 0; index -= 1) {
      const message = this.buildSubscriberEventMessage(newEntries[index]);
      if (message) {
        this.publish(message, { note: 'New YouTube subscriber relayed' });
      }
    }
  }

  persistSubscriberCache() {
    const keys = Array.from(this.seenSubscriberKeys).slice(0, SUBSCRIBER_CACHE_LIMIT);
    storage.set(SUBSCRIBER_CACHE_KEY, {
      keys,
      timestamp: this.lastSubscriberTimestamp || Date.now()
    });
  }

  buildSubscriberEventMessage(entry) {
    if (!entry) {
      return null;
    }
    const { item, snippet, subscriberSnippet, publishedAt, key } = entry;
    const displayName = (subscriberSnippet?.title || snippet?.title || '').trim() || 'YouTube user';
    const avatar =
      subscriberSnippet?.thumbnails?.high?.url ||
      subscriberSnippet?.thumbnails?.default?.url ||
      subscriberSnippet?.thumbnails?.medium?.url ||
      '';
    const timestamp = Number.isFinite(publishedAt) ? publishedAt : Date.now();
    const messageId = item?.id ? `youtube-subscriber-${item.id}` : `youtube-subscriber-${key}`;
    const payload = {
      id: messageId,
      platform: 'youtube',
      type: 'youtube',
      chatname: displayName,
      chatmessage: 'followed',
      event: 'followed',
      chatimg: avatar,
      timestamp,
      previewText: `${displayName} followed`,
      raw: { subscriber: item }
    };
    if (subscriberSnippet?.channelId) {
      payload.userid = subscriberSnippet.channelId;
    }
    return payload;

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
    if (!snippet) {
      return null;
    }

    const rawType = typeof snippet.type === 'string' ? snippet.type.trim() : '';
    const normalized = rawType.toLowerCase();

    if (!normalized || normalized === 'textmessageevent') {
      return null;
    }

    if (normalized === 'superchatevent' || normalized === 'superstickerevent' || normalized === 'fanfundingevent') {
      return null;
    }

    if (normalized === 'newsponsorevent') {
      return 'membership';
    }

    if (normalized === 'membermilestonechatevent') {
      return 'membership_milestone';
    }

    if (normalized === 'membershipgiftingevent' || snippet.membershipGiftingDetails) {
      return 'membership_gift';
    }

    if (normalized === 'giftmembershipreceivedevent' || snippet.giftMembershipReceivedDetails) {
      return 'membership_gift_received';
    }

    return normalized;
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



