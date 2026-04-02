// Velora WebSocket integration for Social Stream
// Uses the official Velora Events API (Socket.IO) with OAuth 2.0 PKCE user sign-in.
// API docs: https://developer.velora.tv/developer/docs/events-api

const VELORA_AUTH_URL = 'https://velora.tv/oauth/authorize';
const VELORA_TOKEN_URL = 'https://api.velora.tv/api/developer/oauth/token';
const VELORA_API_BASE = 'https://api.velora.tv';
const VELORA_WS_URL = 'wss://api.velora.tv/ws/events';
const VELORA_SCOPES = 'user:read chat:read chat:write';

const STORAGE_KEY = 'veloraApiConfig';
const TOKEN_KEY = 'veloraApiTokens';
const CODE_VERIFIER_KEY = 'veloraPkceVerifier';
const OAUTH_STATE_KEY = 'veloraOAuthState';

const CHAT_FEED_LIMIT = 100;
const ALERTS_FEED_LIMIT = 80;
const EVENT_LOG_LIMIT = 100;
const VIEWER_POLL_INTERVAL_MS = 30000;

const state = {
    clientId: '',
    redirectUri: '',
    tokens: null,
    authUser: null,
    socket: null,
    socketStatus: 'disconnected',
    isExtensionOn: false,
    settings: {},
    viewerPollTimer: null,
    refreshTimer: null,
    streamId: null
};

const els = {};

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function q(id) {
    return document.getElementById(id);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const conf = JSON.parse(raw);
        if (conf.clientId) state.clientId = conf.clientId;
        if (conf.redirectUri) state.redirectUri = conf.redirectUri;
    } catch (e) {}
}

function persistConfig() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            clientId: state.clientId,
            redirectUri: state.redirectUri
        }));
    } catch (e) {}
}

function loadTokens() {
    try {
        const raw = localStorage.getItem(TOKEN_KEY);
        if (!raw) return;
        const tokens = JSON.parse(raw);
        if (tokens && tokens.access_token) {
            state.tokens = tokens;
        }
    } catch (e) {}
}

function persistTokens() {
    if (!state.tokens) {
        localStorage.removeItem(TOKEN_KEY);
        return;
    }
    try {
        localStorage.setItem(TOKEN_KEY, JSON.stringify(state.tokens));
    } catch (e) {}
}

function clearAuthState() {
    state.tokens = null;
    state.authUser = null;
    state.streamId = null;
    persistTokens();
    clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
}

function isTokenExpired() {
    if (!state.tokens) return true;
    const expiresAt = state.tokens.expires_at;
    if (!expiresAt) return false;
    return Date.now() > (expiresAt - 60000);
}

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => chars[b % chars.length]).join('');
}

async function createCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// ─── OAuth flow ───────────────────────────────────────────────────────────────

async function startAuthFlow() {
    if (!state.clientId) {
        setAuthStatus('Enter your Client ID first.', 'warning');
        if (els.clientIdInput) els.clientIdInput.focus();
        return;
    }

    const verifier = generateRandomString(64);
    const challenge = await createCodeChallenge(verifier);
    const stateParam = generateRandomString(32);

    sessionStorage.setItem(CODE_VERIFIER_KEY, verifier);
    sessionStorage.setItem(OAUTH_STATE_KEY, stateParam);

    const redirectUri = window.location.origin + window.location.pathname;
    state.redirectUri = redirectUri;
    persistConfig();

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: state.clientId,
        redirect_uri: redirectUri,
        scope: VELORA_SCOPES,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: stateParam
    });

    window.location.href = `${VELORA_AUTH_URL}?${params.toString()}`;
}

async function handleAuthCallback() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    if (!code) return false;

    // Strip OAuth params from URL immediately to avoid reuse on reload
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, document.title, url.toString());

    const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    if (!returnedState || returnedState !== expectedState) {
        setAuthStatus('OAuth state mismatch. Please try again.', 'danger');
        return false;
    }

    const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
    if (!verifier) {
        setAuthStatus('Missing PKCE verifier. Please try again.', 'danger');
        return false;
    }

    sessionStorage.removeItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(CODE_VERIFIER_KEY);

    try {
        await exchangeCodeForToken(code, verifier);
        await loadUserProfile();
        updateAuthUI();
        connectSocket();
    } catch (err) {
        console.error('[Velora] Token exchange failed:', err);
        setAuthStatus(`Sign-in failed: ${err.message}`, 'danger');
    }
    return true;
}

async function exchangeCodeForToken(code, verifier) {
    const redirectUri = state.redirectUri || (window.location.origin + window.location.pathname);

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: state.clientId,
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri
    });

    const response = await fetch(VELORA_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: body.toString()
    });

    let data = {};
    try { data = await response.json(); } catch (e) {}

    if (!response.ok) {
        throw new Error(data.error_description || data.error || `HTTP ${response.status}`);
    }
    if (!data.access_token) {
        throw new Error('No access token returned by Velora.');
    }

    state.tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || null,
        token_type: data.token_type || 'Bearer',
        expires_at: data.expires_in ? (Date.now() + data.expires_in * 1000) : null
    };
    persistTokens();
    scheduleTokenRefresh();
}

async function refreshAccessToken() {
    if (!state.tokens?.refresh_token || !state.clientId) {
        clearAuthState();
        updateAuthUI();
        disconnectSocket();
        return;
    }

    try {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: state.clientId,
            refresh_token: state.tokens.refresh_token
        });

        const response = await fetch(VELORA_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: body.toString()
        });

        let data = {};
        try { data = await response.json(); } catch (e) {}

        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

        state.tokens = {
            ...state.tokens,
            access_token: data.access_token,
            refresh_token: data.refresh_token || state.tokens.refresh_token,
            expires_at: data.expires_in ? (Date.now() + data.expires_in * 1000) : null
        };
        persistTokens();
        scheduleTokenRefresh();

        // Re-auth the socket with the new token if connected
        if (state.socket && state.socket.connected) {
            state.socket.auth = { token: state.tokens.access_token };
        }
    } catch (err) {
        console.error('[Velora] Token refresh failed:', err);
        clearAuthState();
        updateAuthUI();
        disconnectSocket();
    }
}

function scheduleTokenRefresh() {
    clearTimeout(state.refreshTimer);
    if (!state.tokens?.expires_at) return;
    const delay = Math.max(10000, state.tokens.expires_at - Date.now() - 120000);
    state.refreshTimer = setTimeout(refreshAccessToken, delay);
}

// ─── User profile ─────────────────────────────────────────────────────────────

async function loadUserProfile() {
    if (!state.tokens?.access_token) return;
    try {
        const response = await fetch(`${VELORA_API_BASE}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${state.tokens.access_token}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        state.authUser = data.user || data;
    } catch (e) {}
}

// ─── Viewer count polling ─────────────────────────────────────────────────────

async function pollViewerCount() {
    if (!state.tokens?.access_token || !state.authUser) return;
    try {
        const username = state.authUser.username || state.authUser.login;
        if (!username) return;
        const response = await fetch(`${VELORA_API_BASE}/api/streams?username=${encodeURIComponent(username)}`, {
            headers: { 'Authorization': `Bearer ${state.tokens.access_token}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        const stream = Array.isArray(data.streams) ? data.streams[0] : (data.stream || null);
        if (stream) {
            state.streamId = stream.id;
            updateViewerCount(stream.viewerCount ?? stream.viewer_count ?? null);
        }
    } catch (e) {}
}

function startViewerPoll() {
    stopViewerPoll();
    pollViewerCount();
    state.viewerPollTimer = setInterval(pollViewerCount, VIEWER_POLL_INTERVAL_MS);
}

function stopViewerPoll() {
    clearInterval(state.viewerPollTimer);
    state.viewerPollTimer = null;
}

// ─── Socket.IO connection ─────────────────────────────────────────────────────

function connectSocket() {
    if (!state.tokens?.access_token) return;
    if (typeof io !== 'function') {
        addEventLogEntry('socket.io client not loaded.', 'error');
        return;
    }

    disconnectSocket();

    const socket = io(VELORA_WS_URL, {
        auth: { token: state.tokens.access_token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
        reconnectionAttempts: Infinity
    });

    state.socket = socket;
    setSocketStatus('connecting');

    socket.on('connect', () => {
        setSocketStatus('connected');
        addEventLogEntry('Connected to Velora Events API.', 'info');
        startViewerPoll();
    });

    socket.on('connected', (data) => {
        const channelName = data.channelUsername || data.username || '';
        addEventLogEntry(`Authenticated as channel: ${channelName}`, 'info');
        if (els.channelLabel) {
            els.channelLabel.querySelector('span').textContent = channelName || '-';
        }
    });

    socket.on('event', (payload) => {
        handleEvent(payload);
    });

    socket.on('disconnect', (reason) => {
        setSocketStatus('disconnected');
        addEventLogEntry(`Disconnected: ${reason}`, 'warn');
        stopViewerPoll();
    });

    socket.on('connect_error', (err) => {
        setSocketStatus('error');
        addEventLogEntry(`Connection error: ${err.message}`, 'error');
    });
}

function disconnectSocket() {
    if (state.socket) {
        state.socket.disconnect();
        state.socket = null;
    }
    stopViewerPoll();
    setSocketStatus('disconnected');
}

// ─── Event routing ────────────────────────────────────────────────────────────

function handleEvent(payload) {
    if (!payload || !payload.event) return;
    const { event, data } = payload;

    addEventLogEntry(event, 'info', data);

    switch (event) {
        case 'chat.message':
            handleChatMessage(data);
            break;
        case 'channel.follow':
            handleFollow(data);
            break;
        case 'channel.subscribe':
            handleSubscribe(data);
            break;
        case 'channel.subscription.gift':
            handleGiftSub(data);
            break;
        case 'channel.volts':
            handleVolts(data);
            break;
        case 'channel.raid':
            handleRaid(data);
            break;
        case 'channel.channel_points_redemption':
            handleChannelPoints(data);
            break;
        case 'channel.ban':
        case 'channel.unban':
        case 'channel.moderator.add':
        case 'channel.moderator.remove':
        case 'channel.poll.begin':
        case 'channel.poll.end':
        case 'channel.prediction.begin':
        case 'channel.prediction.lock':
        case 'channel.prediction.end':
        case 'channel.hype_train.begin':
        case 'channel.hype_train.progress':
        case 'channel.hype_train.end':
        case 'stream.online':
        case 'stream.offline':
        case 'stream.update':
            // Logged above; no additional UI action needed for these
            break;
        default:
            break;
    }
}

// ─── Chat messages ────────────────────────────────────────────────────────────

function handleChatMessage(data) {
    if (!data) return;

    const {
        messageId,
        userId,
        username,
        displayName,
        message,
        badges,
        isMod,
        isVip,
        isSubscriber,
        subscriberMonths,
        color,
        card,
        isSystem
    } = data;

    const name = displayName || username || '';
    const text = message || '';

    // Skip pure system messages with no text
    if (isSystem && !text && !card) return;

    addChatFeedMessage(name, text, badges, isMod, isVip, isSubscriber, color);

    let contentImg = '';
    let msgText = escapeHtml(text);

    if (card) {
        if (card.imageUrl || card.thumbnailUrl) {
            contentImg = card.imageUrl || card.thumbnailUrl;
        }
        if (card.name && !msgText) {
            msgText = escapeHtml(`[${card.name}]`);
        }
    }

    const badgeList = Array.isArray(badges) ? badges : [];

    pushMessage({
        chatname: escapeHtml(name),
        chatbadges: badgeList,
        backgroundColor: '',
        textColor: '',
        nameColor: color || '',
        chatmessage: msgText,
        chatimg: '',
        hasDonation: '',
        membership: isSubscriber ? (subscriberMonths ? `${subscriberMonths} month subscriber` : 'Subscriber') : '',
        contentimg: contentImg,
        textonly: false,
        type: 'velora'
    });
}

// ─── Alert events ─────────────────────────────────────────────────────────────

function handleFollow(data) {
    if (!data) return;
    const name = data.displayName || data.username || 'Someone';
    addAlert(`${escapeHtml(name)} followed!`, 'follow');

    pushMessage({
        chatname: escapeHtml(name),
        chatbadges: [],
        backgroundColor: '',
        textColor: '',
        nameColor: '',
        chatmessage: 'New follower!',
        chatimg: '',
        hasDonation: '',
        membership: '',
        contentimg: '',
        textonly: false,
        type: 'velora',
        event: 'follow'
    });
}

function handleSubscribe(data) {
    if (!data) return;
    const name = data.displayName || data.username || 'Someone';
    const months = data.subscriberMonths ? ` (${data.subscriberMonths} months)` : '';
    addAlert(`${escapeHtml(name)} subscribed${months}!`, 'sub');

    pushMessage({
        chatname: escapeHtml(name),
        chatbadges: [],
        backgroundColor: '',
        textColor: '',
        nameColor: '',
        chatmessage: `New subscriber${months}!`,
        chatimg: '',
        hasDonation: '',
        membership: `Subscriber${months}`,
        contentimg: '',
        textonly: false,
        type: 'velora',
        event: 'subscribe'
    });
}

function handleGiftSub(data) {
    if (!data) return;
    const gifterName = data.gifterDisplayName || data.gifterUsername || data.displayName || data.username || 'Anonymous';
    const count = data.quantity || data.count || 1;
    const label = `sub${count !== 1 ? 's' : ''}`;
    addAlert(`${escapeHtml(gifterName)} gifted ${count} ${label}!`, 'gift');

    pushMessage({
        chatname: escapeHtml(gifterName),
        chatbadges: [],
        backgroundColor: '',
        textColor: '',
        nameColor: '',
        chatmessage: `Gifted ${count} ${label}!`,
        chatimg: '',
        hasDonation: '',
        membership: '',
        contentimg: '',
        textonly: false,
        type: 'velora',
        event: 'subscription_gift'
    });
}

function handleVolts(data) {
    if (!data) return;
    const name = data.displayName || data.username || 'Someone';
    const amount = data.amount || data.volts || '';
    const amountLabel = amount ? `${amount} Volts` : 'Volts';
    addAlert(`${escapeHtml(name)} sent ${amountLabel}!`, 'volts');

    pushMessage({
        chatname: escapeHtml(name),
        chatbadges: [],
        backgroundColor: '',
        textColor: '',
        nameColor: '',
        chatmessage: data.message ? escapeHtml(data.message) : '',
        chatimg: '',
        hasDonation: amountLabel,
        membership: '',
        contentimg: '',
        textonly: false,
        type: 'velora',
        event: 'volts'
    });
}

function handleRaid(data) {
    if (!data) return;
    const name = data.fromDisplayName || data.fromUsername || data.displayName || data.username || 'Someone';
    const viewers = data.viewerCount ?? data.viewers ?? '';
    const viewerStr = viewers !== '' ? ` with ${viewers} viewers` : '';
    addAlert(`${escapeHtml(name)} raided${viewerStr}!`, 'raid');

    pushMessage({
        chatname: escapeHtml(name),
        chatbadges: [],
        backgroundColor: '',
        textColor: '',
        nameColor: '',
        chatmessage: `Incoming raid${viewerStr}!`,
        chatimg: '',
        hasDonation: '',
        membership: '',
        contentimg: '',
        textonly: false,
        type: 'velora',
        event: 'raid'
    });
}

function handleChannelPoints(data) {
    if (!data) return;
    const name = data.displayName || data.username || 'Someone';
    const reward = data.rewardTitle || 'channel point reward';
    addAlert(`${escapeHtml(name)} redeemed: ${escapeHtml(reward)}`, 'points');
}

// ─── Chat sending ─────────────────────────────────────────────────────────────

async function sendChatMessage() {
    if (!els.chatMessage) return;
    const text = els.chatMessage.value.trim();
    if (!text) return;
    if (!state.tokens?.access_token) {
        setChatStatus('Not signed in.', true);
        return;
    }

    els.sendChat.disabled = true;

    try {
        // Velora chat send: POST /api/integrations/oauth/chat/channels/:channelId/messages
        // channelId == the authenticated user's id
        const channelId = state.authUser?.id;
        if (!channelId) {
            setChatStatus('No channel ID — profile not loaded.', true);
            els.sendChat.disabled = false;
            return;
        }
        const response = await fetch(`${VELORA_API_BASE}/api/integrations/oauth/chat/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.tokens.access_token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ message: text })
        });

        if (!response.ok) {
            let errMsg = `HTTP ${response.status}`;
            try {
                const err = await response.json();
                errMsg = err.message || err.error || errMsg;
            } catch (_) {}
            throw new Error(errMsg);
        }

        els.chatMessage.value = '';
        setChatStatus('Sent.', false);
        setTimeout(() => setChatStatus('', false), 3000);
    } catch (err) {
        setChatStatus(`Error: ${err.message}`, true);
    } finally {
        els.sendChat.disabled = false;
    }
}

async function sendChatBridgeMessage(text) {
    text = String(text || '').trim();
    if (!text) {
        return false;
    }
    if (!state.tokens?.access_token) {
        throw new Error('Not signed in.');
    }

    const channelId = state.authUser?.id;
    if (!channelId) {
        throw new Error('No channel ID - profile not loaded.');
    }

    const response = await fetch(`${VELORA_API_BASE}/api/integrations/oauth/chat/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.tokens.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ message: text })
    });

    if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
            const err = await response.json();
            errMsg = err.message || err.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
    }

    setChatStatus('Sent.', false);
    setTimeout(() => setChatStatus('', false), 3000);
    return true;
}

// ─── Extension bridge ─────────────────────────────────────────────────────────

function pushMessage(data) {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function (e) {});
        }
    } catch (e) {}
}

function notifyBridgeStatus() {
    const connected = Boolean(
        typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id
    );
    if (els.bridgeState) {
        els.bridgeState.textContent = connected ? 'Extension connected' : 'Extension disconnected';
        els.bridgeState.className = `status-chip ${connected ? 'ok' : 'warning'}`;
    }
}

function wireExtensionBridge() {
    if (!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id)) {
        return;
    }

    try {
        chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            try {
                if (request === 'getSource') {
                    sendResponse('velora');
                    return;
                }
                if (request === 'focusChat') {
                    if (els.chatMessage) {
                        els.chatMessage.focus();
                        sendResponse(true);
                    } else {
                        sendResponse(false);
                    }
                    return;
                }
                if (request && typeof request === 'object') {
                    if ('settings' in request) {
                        state.settings = request.settings || {};
                        sendResponse(true);
                        return;
                    }
                    if ('state' in request) {
                        state.isExtensionOn = !!request.state;
                        sendResponse(true);
                        return;
                    }
                    if (request.type === 'SEND_MESSAGE' && typeof request.message === 'string') {
                        sendChatBridgeMessage(request.message).then(function () {
                            sendResponse(true);
                        }).catch(function () {
                            sendResponse(false);
                        });
                        return true;
                    }
                }
            } catch (e) {}
            sendResponse(false);
        });
    } catch (e) {}

    try {
        chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                return;
            }
            response = response || {};
            if ('settings' in response) {
                state.settings = response.settings || {};
            }
            if ('state' in response) {
                state.isExtensionOn = !!response.state;
            }
        });
    } catch (e) {}
}

function wirePostMessageBridge() {
    window.addEventListener('message', function (event) {
        let request = event && event.data;
        if (!request || typeof request !== 'object') {
            return;
        }
        if (request.__ssappSendToTab) {
            request = request.__ssappSendToTab;
        }
        if (request.type === 'SEND_MESSAGE' && typeof request.message === 'string') {
            sendChatBridgeMessage(request.message).catch(function () {});
        }
    });
}

// ─── UI updates ───────────────────────────────────────────────────────────────

function updateAuthUI() {
    const authed = Boolean(state.tokens?.access_token) && !isTokenExpired();
    const username = state.authUser?.displayName || state.authUser?.username || '';

    if (els.authState) {
        els.authState.textContent = authed
            ? (username ? `Signed in as ${username}` : 'Signed in')
            : 'Not signed in';
        els.authState.className = `status-chip ${authed ? 'ok' : 'warning'}`;
    }
    if (els.startAuth) {
        els.startAuth.style.display = authed ? 'none' : '';
    }
    if (els.signOut) {
        els.signOut.style.display = authed ? '' : 'none';
    }
    if (els.setupNotice) {
        els.setupNotice.style.display = (authed || state.clientId) ? 'none' : '';
    }
}

function setAuthStatus(msg, level) {
    if (els.authState) {
        els.authState.textContent = msg;
        els.authState.className = `status-chip ${level}`;
    }
}

function setSocketStatus(status) {
    state.socketStatus = status;
    if (!els.socketState) return;
    const labels = {
        connected: 'Events connected',
        connecting: 'Events connecting…',
        disconnected: 'Events disconnected',
        error: 'Events error'
    };
    const chips = {
        connected: 'ok',
        connecting: 'warning',
        disconnected: 'warning',
        error: 'danger'
    };
    els.socketState.textContent = labels[status] || status;
    els.socketState.className = `status-chip ${chips[status] || 'warning'}`;
}

function updateViewerCount(count) {
    if (!els.viewerCount) return;
    if (count === null || count === undefined) {
        els.viewerCount.textContent = 'Viewers: -';
        els.viewerCount.className = 'status-chip warning';
    } else {
        els.viewerCount.textContent = `Viewers: ${Number(count).toLocaleString()}`;
        els.viewerCount.className = 'status-chip ok';
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage(chrome.runtime.id, {
                    message: { type: 'velora', event: 'viewer_update', meta: count }
                }, function (e) {});
            }
        } catch (e) {}
    }
}

function setChatStatus(msg, isError) {
    if (els.chatStatus) {
        els.chatStatus.textContent = msg;
        els.chatStatus.style.color = isError ? 'var(--velora-danger-fg)' : '';
    }
}

// ─── Feed UI ──────────────────────────────────────────────────────────────────

function addChatFeedMessage(name, text, badges, isMod, isVip, isSubscriber, color) {
    if (!els.chatFeed) return;

    const empty = q('chat-feed-empty');
    if (empty) empty.remove();

    const entry = document.createElement('div');
    entry.className = 'chat-msg';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'chat-msg-name' +
        (isMod ? ' is-mod' : '') +
        (isSubscriber ? ' is-sub' : '');
    if (color) nameSpan.style.color = color;
    nameSpan.textContent = name + ':';
    entry.appendChild(nameSpan);

    const space = document.createTextNode(' ');
    entry.appendChild(space);

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    entry.appendChild(textSpan);

    els.chatFeed.appendChild(entry);

    // Trim to limit
    while (els.chatFeed.children.length > CHAT_FEED_LIMIT) {
        els.chatFeed.removeChild(els.chatFeed.firstChild);
    }

    // Auto-scroll if near bottom
    const threshold = 60;
    const nearBottom = els.chatFeed.scrollHeight - els.chatFeed.scrollTop - els.chatFeed.clientHeight < threshold;
    if (nearBottom) {
        els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
    }
}

function addAlert(text, type) {
    if (!els.alertsFeed) return;

    const empty = q('alerts-feed-empty');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = `alert-item type-${type}`;
    item.textContent = text;

    els.alertsFeed.insertBefore(item, els.alertsFeed.firstChild);

    while (els.alertsFeed.children.length > ALERTS_FEED_LIMIT) {
        els.alertsFeed.removeChild(els.alertsFeed.lastChild);
    }
}

function addEventLogEntry(label, level, data) {
    if (!els.eventLog) return;

    const entry = document.createElement('div');
    entry.className = `log-entry level-${level || 'info'}`;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = new Date().toLocaleTimeString();
    entry.appendChild(timeSpan);

    const eventSpan = document.createElement('span');
    eventSpan.className = 'log-event';
    eventSpan.textContent = label;
    entry.appendChild(eventSpan);

    if (data) {
        try {
            const detail = document.createTextNode(JSON.stringify(data).slice(0, 200));
            entry.appendChild(detail);
        } catch (_) {}
    }

    els.eventLog.insertBefore(entry, els.eventLog.firstChild);

    while (els.eventLog.children.length > EVENT_LOG_LIMIT) {
        els.eventLog.removeChild(els.eventLog.lastChild);
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function initElements() {
    Object.assign(els, {
        clientIdInput: q('client-id-input'),
        saveClientId: q('save-client-id'),
        setupNotice: q('setup-notice'),
        redirectUriHint: q('redirect-uri-hint'),
        startAuth: q('start-auth'),
        signOut: q('sign-out'),
        authState: q('auth-state'),
        channelLabel: q('channel-label'),
        viewerCount: q('viewer-count'),
        socketState: q('socket-state'),
        bridgeState: q('bridge-state'),
        chatFeed: q('chat-feed'),
        chatMessage: q('chat-message'),
        sendChat: q('send-chat'),
        chatStatus: q('chat-status'),
        eventLog: q('event-log'),
        alertsFeed: q('alerts-feed')
    });
}

function bindEvents() {
    if (els.saveClientId) {
        els.saveClientId.addEventListener('click', () => {
            const val = (els.clientIdInput?.value || '').trim();
            if (!val) return;
            state.clientId = val;
            persistConfig();
            if (els.setupNotice) els.setupNotice.style.display = 'none';
        });
    }

    if (els.clientIdInput) {
        els.clientIdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') els.saveClientId?.click();
        });
    }

    if (els.startAuth) {
        els.startAuth.addEventListener('click', startAuthFlow);
    }

    if (els.signOut) {
        els.signOut.addEventListener('click', () => {
            disconnectSocket();
            clearAuthState();
            updateAuthUI();
            setSocketStatus('disconnected');
            updateViewerCount(null);
            if (els.channelLabel) els.channelLabel.querySelector('span').textContent = '-';
        });
    }

    if (els.sendChat) {
        els.sendChat.addEventListener('click', sendChatMessage);
    }

    if (els.chatMessage) {
        els.chatMessage.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
}

async function init() {
    initElements();

    // Show the redirect URI hint so the user can copy it into their Velora app settings
    if (els.redirectUriHint) {
        els.redirectUriHint.textContent = window.location.origin + window.location.pathname;
    }

    loadConfig();
    loadTokens();

    // Pre-fill client ID input if we have one saved
    if (els.clientIdInput && state.clientId) {
        els.clientIdInput.value = state.clientId;
    }

    bindEvents();
    wireExtensionBridge();
    wirePostMessageBridge();
    notifyBridgeStatus();
    updateAuthUI();

    // Handle OAuth redirect callback
    const wasCallback = await handleAuthCallback();

    // If already authenticated (stored tokens, not a fresh callback), connect
    if (!wasCallback && state.tokens?.access_token && !isTokenExpired()) {
        scheduleTokenRefresh();
        await loadUserProfile();
        updateAuthUI();
        connectSocket();
    } else if (!wasCallback && state.tokens?.access_token && isTokenExpired()) {
        await refreshAccessToken();
        if (state.tokens?.access_token) {
            await loadUserProfile();
            updateAuthUI();
            connectSocket();
        }
    }
}

document.addEventListener('DOMContentLoaded', init);
