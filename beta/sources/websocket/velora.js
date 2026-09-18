(function () {
'use strict';

if (window.__SSN_VELORA_SOURCE_INITIALIZED__) {
    return;
}
window.__SSN_VELORA_SOURCE_INITIALIZED__ = true;

// Velora WebSocket integration for Social Stream
// Uses the official Velora Events API (Socket.IO) with OAuth 2.0 PKCE user sign-in.
// API docs: https://developer.velora.tv/developer/docs/webhooks/events

const VELORA_API_BASE = 'https://api.velora.tv';
const VELORA_WS_URL = 'wss://api.velora.tv/ws/events';
const VELORA_EVENTS_SSE_URL = `${VELORA_API_BASE}/api/events/stream`;
const VELORA_CHAT_HISTORY_INTERVAL_MS = 3000;
const VELORA_CHAT_HISTORY_LIMIT = 50;
const DEFAULT_VELORA_AUTH_BASE = 'https://sso.socialstream.ninja/auth/velora';
const DEFAULT_VELORA_CLIENT_ID = 'velora_9c9ae006ec8bc256';
const DEFAULT_VELORA_REDIRECT_URI = 'https://sso.socialstream.ninja/auth/velora/callback';
const DEFAULT_LOCAL_RETURN_BASE = 'http://127.0.0.1:8181/';
const VELORA_SCOPES = 'user:read chat:read chat:write';
const VELORA_AUTH_MESSAGE_SUCCESS = 'ssn-velora-auth-success';
const VELORA_AUTH_MESSAGE_ERROR = 'ssn-velora-auth-error';
const VELORA_AUTH_RESULT_KEY = 'velora_auth_result';
const VELORA_AUTH_ERROR_KEY = 'velora_auth_error';

const STORAGE_KEY = 'veloraApiConfig';
const TOKEN_KEY = 'veloraApiTokens';

const CHAT_FEED_LIMIT = 100;
const ALERTS_FEED_LIMIT = 80;
const EVENT_LOG_LIMIT = 100;
const VIEWER_POLL_INTERVAL_MS = 30000;
const SOCKET_CONNECT_TIMEOUT_MS = 8000;
const SOCKET_CONNECTED_EVENT_TIMEOUT_MS = 4000;
const SSE_CONNECT_TIMEOUT_MS = 15000;
const SSE_RECONNECT_DELAY_MS = 3000;
const TOKEN_REFRESH_RETRY_MS = 30000;
const VELORA_EMOTE_MAP = {
    "AirRaid": "https://assets.velora.tv/emotes/raid/raid-airraid/56.webp",
    "BlueGlitzRaid": "https://assets.velora.tv/emotes/raid/raid-blueglitzraid/56.webp",
    "CannonRaid": "https://assets.velora.tv/emotes/raid/raid-cannonraid/56.webp",
    "FireRaid": "https://assets.velora.tv/emotes/raid/raid-fireraid/56.webp",
    "GlitzRaid": "https://assets.velora.tv/emotes/raid/raid-glitzraid/56.webp",
    "PinkRaid": "https://assets.velora.tv/emotes/raid/raid-pinkraid/56.webp",
    "PixtextRaid": "https://assets.velora.tv/emotes/raid/raid-pixtextraid/56.webp",
    "RainbowRaid": "https://assets.velora.tv/emotes/raid/raid-rainbowraid/56.webp",
    "SimpleRaid": "https://assets.velora.tv/emotes/raid/raid-simpleraid/56.webp",
    "SplitRedRaid": "https://assets.velora.tv/emotes/raid/raid-splitredraid/56.webp",
    "VeloraFlameAllSmiles": "https://assets.velora.tv/emotes/flame/flame-allsmiles/56.webp",
    "VeloraFlameAngel": "https://assets.velora.tv/emotes/flame/flame-angel/56.webp",
    "VeloraFlameAngry": "https://assets.velora.tv/emotes/flame/flame-angry/56.webp",
    "VeloraFlameBigF": "https://assets.velora.tv/emotes/flame/flame-bigf/56.webp",
    "VeloraFlameBigGrin": "https://assets.velora.tv/emotes/flame/flame-biggrin/56.webp",
    "VeloraFlameBlowKisses": "https://assets.velora.tv/emotes/flame/flame-blowkisses/56.webp",
    "VeloraFlameCoolLook": "https://assets.velora.tv/emotes/flame/flame-coollook/56.webp",
    "VeloraFlameCrying": "https://assets.velora.tv/emotes/flame/flame-crying/56.webp",
    "VeloraFlameDazed": "https://assets.velora.tv/emotes/flame/flame-dazed/56.webp",
    "VeloraFlameDead": "https://assets.velora.tv/emotes/flame/flame-dead/56.webp",
    "VeloraFlameDropLaugh": "https://assets.velora.tv/emotes/flame/flame-droplaugh/56.webp",
    "VeloraFlameEvil": "https://assets.velora.tv/emotes/flame/flame-evil/56.webp",
    "VeloraFlameInjured": "https://assets.velora.tv/emotes/flame/flame-injured/56.webp",
    "VeloraFlameLaugh": "https://assets.velora.tv/emotes/flame/flame-laugh/56.webp",
    "VeloraFlameLove": "https://assets.velora.tv/emotes/flame/flame-love/56.webp",
    "VeloraFlameLoveEyes": "https://assets.velora.tv/emotes/flame/flame-loveeyes/56.webp",
    "VeloraFlameMelting": "https://assets.velora.tv/emotes/flame/flame-melting/56.webp",
    "VeloraFlameMindBlown": "https://assets.velora.tv/emotes/flame/flame-mindblown/56.webp",
    "VeloraFlameMoney": "https://assets.velora.tv/emotes/flame/flame-money/56.webp",
    "VeloraFlameNerdy": "https://assets.velora.tv/emotes/flame/flame-nerdy/56.webp",
    "VeloraFlameRedEye": "https://assets.velora.tv/emotes/flame/flame-redeye/56.webp",
    "VeloraFlameShock": "https://assets.velora.tv/emotes/flame/flame-shock/56.webp",
    "VeloraFlameSick": "https://assets.velora.tv/emotes/flame/flame-sick/56.webp",
    "VeloraFlameSleeping": "https://assets.velora.tv/emotes/flame/flame-sleeping/56.webp",
    "VeloraFlameThinking": "https://assets.velora.tv/emotes/flame/flame-thinking/56.webp",
    "VeloraFlameThumbsDown": "https://assets.velora.tv/emotes/flame/flame-thumbsdown/56.webp",
    "VeloraFlameThumbsUp": "https://assets.velora.tv/emotes/flame/flame-thumbsup/56.webp",
    "VeloraFlameTongueWink": "https://assets.velora.tv/emotes/flame/flame-tonguewink/56.webp",
    "VeloraFlameWellMeh": "https://assets.velora.tv/emotes/flame/flame-wellmeh/56.webp",
    "VeloraFlameYawning": "https://assets.velora.tv/emotes/flame/flame-yawning/56.webp",
    "VeloraPXLAFK": "https://assets.velora.tv/emotes/pixel/pixel-afk/56.webp",
    "VeloraPXLBait": "https://assets.velora.tv/emotes/pixel/pixel-bait/56.webp",
    "VeloraPXLBan": "https://assets.velora.tv/emotes/pixel/pixel-ban/56.webp",
    "VeloraPXLBg": "https://assets.velora.tv/emotes/pixel/pixel-bg/56.webp",
    "VeloraPXLBro": "https://assets.velora.tv/emotes/pixel/pixel-bro/56.webp",
    "VeloraPXLBuff": "https://assets.velora.tv/emotes/pixel/pixel-buff/56.webp",
    "VeloraPXLBug": "https://assets.velora.tv/emotes/pixel/pixel-bug/56.webp",
    "VeloraPXLDc": "https://assets.velora.tv/emotes/pixel/pixel-dc/56.webp",
    "VeloraPXLFB": "https://assets.velora.tv/emotes/pixel/pixel-fb/56.webp",
    "VeloraPXLFix": "https://assets.velora.tv/emotes/pixel/pixel-fix/56.webp",
    "VeloraPXLFu": "https://assets.velora.tv/emotes/pixel/pixel-fu/56.webp",
    "VeloraPXLGg": "https://assets.velora.tv/emotes/pixel/pixel-gg/56.webp",
    "VeloraPXLGold": "https://assets.velora.tv/emotes/pixel/pixel-gold/56.webp",
    "VeloraPXLHack": "https://assets.velora.tv/emotes/pixel/pixel-hack/56.webp",
    "VeloraPXLHit": "https://assets.velora.tv/emotes/pixel/pixel-hit/56.webp",
    "VeloraPXLLol": "https://assets.velora.tv/emotes/pixel/pixel-lol/56.webp",
    "VeloraPXLLoot": "https://assets.velora.tv/emotes/pixel/pixel-loot/56.webp",
    "VeloraPXLLoveYouText": "https://assets.velora.tv/emotes/pixel/pixel-loveyoutext/56.webp",
    "VeloraPXLMp": "https://assets.velora.tv/emotes/pixel/pixel-mp/56.webp",
    "VeloraPXLNoText": "https://assets.velora.tv/emotes/pixel/pixel-notext/56.webp",
    "VeloraPXLOp": "https://assets.velora.tv/emotes/pixel/pixel-op/56.webp",
    "VeloraPXLQq": "https://assets.velora.tv/emotes/pixel/pixel-qq/56.webp",
    "VeloraPXLRage": "https://assets.velora.tv/emotes/pixel/pixel-rage/56.webp",
    "VeloraPXLSad": "https://assets.velora.tv/emotes/pixel/pixel-sad/56.webp",
    "VeloraPXLSave": "https://assets.velora.tv/emotes/pixel/pixel-save/56.webp",
    "VeloraPXLStfu": "https://assets.velora.tv/emotes/pixel/pixel-stfu/56.webp",
    "VeloraPXLUp": "https://assets.velora.tv/emotes/pixel/pixel-up/56.webp",
    "VeloraPXLWtf": "https://assets.velora.tv/emotes/pixel/pixel-wtf/56.webp",
    "VeloraPXLYes": "https://assets.velora.tv/emotes/pixel/pixel-yes/56.webp"
};

const state = {
    clientId: DEFAULT_VELORA_CLIENT_ID,
    redirectUri: DEFAULT_VELORA_REDIRECT_URI,
    tokens: null,
    authUser: null,
    socket: null,
    socketStatus: 'disconnected',
    isExtensionOn: false,
    settings: {},
    viewerPollTimer: null,
    refreshTimer: null,
    sseReconnectTimer: null,
    sseConnectTimer: null,
    socketFallbackTimer: null,
    authHandoffPollTimer: null,
    authHandoffInFlight: false,
    streamId: null,
    authPopup: null,
    requestedChannel: '',
    sseRequest: null,
    sseReadOffset: 0,
    sseBuffer: '',
    sseAuthRetries: 0,
    sseAuthRefreshInFlight: false,
    socketConnectTimer: null,
    refreshRetryTimer: null,
    refreshPromise: null,
    authGeneration: 0,
    eventsConnected: false,
    eventTransport: '',
    connectedChannel: '',
    hideMetrics: false,
    chatHistoryTimer: null,
    chatHistoryChannel: '',
    chatHistoryInFlight: false,
    chatHistoryLastError: '',
    chatHistoryHadSuccess: false,
    chatHistoryStartedAt: 0,
    chatHistoryResolveCache: {},
    chatHistoryResolvePending: {},
    processedChatMessages: new Set(),
    profileStatus: 'unverified',
    profileError: '',
    connectionError: '',
    authError: '',
    authInProgress: false
};

const els = {};
let backgroundKeepAliveInitialized = false;

function relayToApp(payload, callback) {
    let sent = false;
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage(chrome.runtime.id, payload, callback || function () {});
            sent = true;
        }
    } catch (e) {}
    if (!sent) {
        try {
            window.postMessage(payload, '*');
            if (typeof callback === 'function') {
                setTimeout(function () { callback(null); }, 0);
            }
            sent = true;
        } catch (e) {}
    }
    return sent;
}

function notifyAppStatus(status, message, detail) {
    relayToApp({
        wssStatus: {
            platform: 'velora',
            status: status,
            message: message || '',
            detail: detail || {}
        }
    });
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function enableBackgroundKeepAlive() {
    if (backgroundKeepAliveInitialized) {
        return;
    }
    backgroundKeepAliveInitialized = true;

    try {
        const receiveChannelCallback = function (event) {
            const channel = event.channel;
            if (!channel) {
                return;
            }
            channel.onmessage = function () {};
            channel.onopen = function () {};
            channel.onclose = function () {};
            setInterval(function () {
                try { channel.send('KEEPALIVE'); } catch (e) {}
            }, 1000);
        };
        const errorHandle = function () {};
        const localConnection = new RTCPeerConnection();
        const remoteConnection = new RTCPeerConnection();
        localConnection.onicecandidate = function (event) {
            return !event.candidate || remoteConnection.addIceCandidate(event.candidate).catch(errorHandle);
        };
        remoteConnection.onicecandidate = function (event) {
            return !event.candidate || localConnection.addIceCandidate(event.candidate).catch(errorHandle);
        };
        remoteConnection.ondatachannel = receiveChannelCallback;
        localConnection.sendChannel = localConnection.createDataChannel('sendChannel');
        localConnection.sendChannel.onopen = function () {
            try { localConnection.sendChannel.send('CONNECTED'); } catch (e) {}
        };
        localConnection.createOffer()
            .then(function (offer) { return localConnection.setLocalDescription(offer); })
            .then(function () { return remoteConnection.setRemoteDescription(localConnection.localDescription); })
            .then(function () { return remoteConnection.createAnswer(); })
            .then(function (answer) { return remoteConnection.setLocalDescription(answer); })
            .then(function () { return localConnection.setRemoteDescription(remoteConnection.localDescription); })
            .catch(errorHandle);
    } catch (e) {}

    const preventBackgroundThrottling = function () {
        try {
            window.onblur = null;
            window.blurred = false;
            document.hasFocus = function () { return true; };
            window.onFocus = function () { return true; };
            Object.defineProperties(document, {
                hidden: { value: false, configurable: true },
                mozHidden: { value: false, configurable: true },
                msHidden: { value: false, configurable: true },
                webkitHidden: { value: false, configurable: true },
                visibilityState: {
                    get: function () { return 'visible'; },
                    configurable: true
                }
            });
        } catch (e) {}
    };

    [
        'visibilitychange',
        'webkitvisibilitychange',
        'mozvisibilitychange',
        'msvisibilitychange',
        'blur'
    ].forEach(function (eventName) {
        window.addEventListener(eventName, function (event) {
            try {
                event.stopImmediatePropagation();
                event.preventDefault();
            } catch (e) {}
        }, true);
    });

    setInterval(preventBackgroundThrottling, 200);
}

function q(id) {
    return document.getElementById(id);
}

function getRuntimeParam(key) {
    try {
        const search = new URLSearchParams(window.location.search || '');
        const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
        return search.get(key) || hash.get(key) || '';
    } catch (e) {
        return '';
    }
}

function normalizeChannelName(value) {
    return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function getRequestedChannel() {
    return normalizeChannelName(
        getRuntimeParam('channel') ||
        getRuntimeParam('username') ||
        getRuntimeParam('user')
    );
}

function getAuthedChannelName() {
    const authUser = state.authUser || {};
    return normalizeChannelName(
        authUser.username ||
        authUser.login ||
        authUser.channelUsername ||
        ''
    );
}

function hasUsableToken() {
    if (!state.tokens?.access_token) return false;
    if (!state.tokens.expires_at) return true;
    return Date.now() < state.tokens.expires_at;
}

function hasChannelMismatch() {
    const actualChannel = getAuthedChannelName();
    return Boolean(
        state.profileStatus === 'verified' &&
        state.requestedChannel &&
        actualChannel &&
        state.requestedChannel !== actualChannel
    );
}

function isAccountReady() {
    return Boolean(
        hasUsableToken() &&
        state.profileStatus === 'verified' &&
        getAuthedChannelName() &&
        !hasChannelMismatch()
    );
}

function normalizeRedirectUri(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw;
}

function normalizeAuthBase(value) {
    const raw = String(value || '').trim();
    if (!raw) return DEFAULT_VELORA_AUTH_BASE;
    return raw.replace(/\/+$/, '');
}

// Only honour an authBase/auth_base override that points at the production SSO host, a
// socialstream.ninja domain, or a local dev server. Without this, a crafted link
// (?authBase=https://evil.tld) would redirect the OAuth code + PKCE verifier + refresh-token
// exchange — and the trusted postMessage origin — to an attacker. See getExpectedAuthMessageOrigin.
function isAllowedVeloraAuthBase(value) {
    try {
        const url = new URL(value);
        const host = (url.hostname || '').toLowerCase();
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
        if (isLocal) {
            return url.protocol === 'https:' || url.protocol === 'http:';
        }
        if (url.protocol !== 'https:') {
            return false;
        }
        return host === 'socialstream.ninja' || host.endsWith('.socialstream.ninja');
    } catch (e) {
        return false;
    }
}

function getVeloraAuthBase() {
    const override = getRuntimeParam('authBase') || getRuntimeParam('auth_base');
    if (override) {
        const normalized = normalizeAuthBase(override);
        if (isAllowedVeloraAuthBase(normalized)) {
            return normalized;
        }
        try { console.warn('[Velora] Ignoring untrusted authBase override:', override); } catch (e) {}
    }
    return DEFAULT_VELORA_AUTH_BASE;
}

function getExpectedAuthMessageOrigin() {
    try {
        return new URL(getVeloraAuthBase()).origin;
    } catch (e) {
        return '';
    }
}

function hasRuntimeFlag(key) {
    try {
        const search = new URLSearchParams(window.location.search || '');
        const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
        return search.has(key) || hash.has(key);
    } catch (e) {
        return false;
    }
}

function isVeloraSocketPage(pathname) {
    return /\/velora\.html$/i.test(String(pathname || ''));
}

function buildVeloraReturnUrlFromBase(base) {
    if (!base) return '';
    try {
        const parsed = new URL(String(base).trim(), window.location.href);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        parsed.hash = '';
        if (isVeloraSocketPage(parsed.pathname)) {
            return parsed.toString();
        }
        const lowerPath = String(parsed.pathname || '').toLowerCase();
        const relativePath = /\/(?:beta\/)?sources\/websocket\/?$/i.test(lowerPath)
            ? 'velora.html'
            : 'sources/websocket/velora.html';
        const normalizedBase = new URL(parsed.toString());
        normalizedBase.search = '';
        if (!/\/$/.test(normalizedBase.pathname)) {
            normalizedBase.pathname = `${normalizedBase.pathname}/`;
        }
        return new URL(relativePath, normalizedBase.toString()).toString();
    } catch (e) {
        return '';
    }
}

function mergeCurrentSearchParams(url) {
    if (!url) return '';
    try {
        const target = new URL(url);
        const current = new URL(window.location.href);
        const params = new URLSearchParams(current.search);
        const ignored = {
            return_to: true,
            returnTo: true,
            redirect_uri: true,
            redirectUri: true
        };
        params.forEach(function (value, key) {
            if (!ignored[key] && !target.searchParams.has(key)) {
                target.searchParams.set(key, value);
            }
        });
        target.hash = '';
        return target.toString();
    } catch (e) {
        return url;
    }
}

function getRuntimeOrigin() {
    try {
        if (window.location && window.location.origin && window.location.origin !== 'null') {
            const origin = window.location.origin;
            if (/^https?:\/\//i.test(origin)) {
                return origin;
            }
        }
    } catch (e) {}
    try {
        const returnTo = getAuthReturnTo();
        if (returnTo) {
            const parsed = new URL(returnTo);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.origin;
            }
        }
    } catch (e) {}
    return 'https://socialstream.ninja';
}

function getAuthReturnTo() {
    const explicitReturnTo = getRuntimeParam('return_to') || getRuntimeParam('returnTo');
    const explicitUrl = mergeCurrentSearchParams(buildVeloraReturnUrlFromBase(explicitReturnTo));
    if (explicitUrl) {
        return explicitUrl;
    }

    try {
        const currentUrl = new URL(String(window.location.href || ''));
        if ((currentUrl.protocol === 'http:' || currentUrl.protocol === 'https:') && isVeloraSocketPage(currentUrl.pathname)) {
            currentUrl.hash = '';
            return currentUrl.toString();
        }
    } catch (e) {
    }

    const sourceModeUrl = mergeCurrentSearchParams(buildVeloraReturnUrlFromBase(getRuntimeParam('sourcemode')));
    if (sourceModeUrl) {
        return sourceModeUrl;
    }

    const isBetaRuntime = hasRuntimeFlag('beta') || getRuntimeParam('branch') === 'beta';
    const fallbackBase = hasRuntimeFlag('devmode')
        ? DEFAULT_LOCAL_RETURN_BASE
        : isBetaRuntime
            ? 'https://beta.socialstream.ninja/'
            : 'https://socialstream.ninja/';
    const fallbackUrl = mergeCurrentSearchParams(buildVeloraReturnUrlFromBase(fallbackBase));
    if (fallbackUrl) {
        return fallbackUrl;
    }

    try {
        return String(window.location.href || '').split('#')[0];
    } catch (e) {
        return '';
    }
}

function getAuthStartUrl() {
    const url = new URL(`${getVeloraAuthBase()}/start`);
    url.searchParams.set('return_to', getAuthReturnTo());
    url.searchParams.set('origin', getRuntimeOrigin());
    return url.toString();
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

function isTextOnlyMode() {
    const setting = state.settings && state.settings.textonlymode;
    if (setting && typeof setting === 'object') {
        return setting.setting === true;
    }
    return setting === true;
}

function renderVeloraMessageHtml(message) {
    const raw = String(message || '');
    const emotes = [];
    const html = raw.split(/(\s+)/).map(function (part) {
        if (!part) return '';
        if (/^\s+$/.test(part)) {
            return part.replace(/\r?\n/g, '<br>');
        }
        const emoteUrl = VELORA_EMOTE_MAP[part];
        if (!emoteUrl) {
            return escapeHtml(part);
        }
        emotes.push({
            code: part,
            url: emoteUrl
        });
        return `<img class="velora-inline-emote" src="${escapeHtml(emoteUrl)}" alt="${escapeHtml(part)}" title="${escapeHtml(part)}" loading="lazy" draggable="false">`;
    }).join('');

    return {
        html: html || escapeHtml(raw),
        emotes: emotes
    };
}

function getObjectValue(obj, keys) {
    if (!obj) return '';
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
            return obj[key];
        }
    }
    return '';
}

function normalizeVeloraBadges(badges) {
    const badgeList = [];
    if (!Array.isArray(badges)) {
        return badgeList;
    }
    badges.forEach(function (badge) {
        let badgeUrl = '';
        if (!badge) return;
        if (typeof badge === 'string') {
            if (/^https?:\/\//i.test(badge)) {
                badgeUrl = badge;
            }
        } else if (typeof badge === 'object') {
            badgeUrl = getObjectValue(badge, [
                'url',
                'imageUrl',
                'imageURL',
                'image',
                'icon',
                'src',
                'badgeUrl',
                'staticAssetUrl'
            ]);
        }
        if (badgeUrl) {
            badgeList.push(String(badgeUrl));
        }
    });
    return badgeList;
}

function getVeloraChatText(raw) {
    let text = getObjectValue(raw, ['text', 'message', 'content', 'body']);
    if (text && typeof text === 'object') {
        text = getObjectValue(text, ['text', 'message', 'content', 'body']);
    }
    return text === undefined || text === null ? '' : String(text);
}

function normalizeVeloraChatMessage(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    if (raw.message && typeof raw.message === 'object' && !raw.text && !raw.content && !raw.messageId && !raw.id) {
        raw = raw.message;
    }

    const user = raw.user || raw.sender || raw.author || {};
    const card = raw.card || null;
    const cardName = card ? getObjectValue(card, ['name', 'title']) : '';
    const text = getVeloraChatText(raw) || (cardName ? `[${cardName}]` : '');
    const username = getObjectValue(raw, ['username', 'login']) || getObjectValue(user, ['username', 'login']);
    const displayName = getObjectValue(raw, ['displayName', 'display_name', 'name']) ||
        getObjectValue(user, ['displayName', 'display_name', 'name']) ||
        username;

    if (raw.isSystem && !text && !cardName) {
        return null;
    }

    return {
        messageId: getObjectValue(raw, ['messageId', 'message_id', 'id', '_id', 'uuid']),
        userId: getObjectValue(raw, ['userId', 'user_id']) || getObjectValue(user, ['id', 'userId', 'user_id']),
        username: username,
        displayName: displayName,
        message: text,
        badges: normalizeVeloraBadges(raw.badges || user.badges || []),
        isMod: !!(getObjectValue(raw, ['isMod', 'is_mod', 'moderator']) || getObjectValue(user, ['isMod', 'is_mod', 'moderator'])),
        isVip: !!(getObjectValue(raw, ['isVip', 'is_vip', 'vip']) || getObjectValue(user, ['isVip', 'is_vip', 'vip'])),
        isSubscriber: !!(getObjectValue(raw, ['isSubscriber', 'is_subscriber', 'subscriber']) || getObjectValue(user, ['isSubscriber', 'is_subscriber', 'subscriber'])),
        subscriberMonths: getObjectValue(raw, ['subscriberMonths', 'subscriber_months']) || getObjectValue(user, ['subscriberMonths', 'subscriber_months']),
        color: getObjectValue(raw, ['color', 'accentColor', 'accent_color']) || getObjectValue(user, ['color', 'accentColor', 'accent_color']),
        avatarUrl: getObjectValue(raw, ['avatarUrl', 'avatar_url', 'profileImageUrl']) || getObjectValue(user, ['avatarUrl', 'avatar_url', 'profileImageUrl', 'image']),
        card: card,
        isSystem: !!(raw.isSystem || raw.is_system),
        timestamp: getObjectValue(raw, ['timestamp', 'createdAt', 'created_at', 'sentAt', 'sent_at'])
    };
}

function rememberChatMessage(message) {
    if (!message) {
        return false;
    }
    const key = message.messageId
        ? `chat-id|${message.messageId}`
        : `chat-text|${message.timestamp || ''}|${message.displayName || message.username || ''}|${message.message || ''}`;
    if (!key || state.processedChatMessages.has(key)) {
        return false;
    }
    state.processedChatMessages.add(key);
    while (state.processedChatMessages.size > 300) {
        state.processedChatMessages.delete(state.processedChatMessages.values().next().value);
    }
    return true;
}

function getChatMessageTimestampValue(message) {
    try {
        const stamp = getObjectValue(message, ['timestamp', 'createdAt', 'created_at', 'sentAt', 'sent_at']);
        const value = Date.parse(stamp);
        return Number.isNaN(value) ? 0 : value;
    } catch (e) {}
    return 0;
}

function getHistoryMessagesFromResponse(data) {
    if (Array.isArray(data)) {
        return data;
    }
    if (!data || typeof data !== 'object') {
        return [];
    }
    if (Array.isArray(data.messages)) {
        return data.messages;
    }
    if (Array.isArray(data.data)) {
        return data.data;
    }
    if (data.message && typeof data.message === 'object') {
        return [data.message];
    }
    return [];
}

function looksLikeVeloraId(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function getVeloraChannelIdFromResponse(data) {
    if (!data || typeof data !== 'object') {
        return '';
    }
    return getObjectValue(data, ['id', 'userId', 'user_id', 'channelId', 'channel_id']) ||
        getObjectValue(data.user || data.channel || {}, ['id', 'userId', 'user_id', 'channelId', 'channel_id']) ||
        getObjectValue(data.data || {}, ['id', 'userId', 'user_id', 'channelId', 'channel_id']);
}

function getVeloraChannelIdFromStreamResponse(data) {
    if (!data || typeof data !== 'object') {
        return '';
    }
    return getObjectValue(data, ['userId', 'user_id', 'channelId', 'channel_id']) ||
        getObjectValue(data.user || data.channel || {}, ['id', 'userId', 'user_id', 'channelId', 'channel_id']) ||
        getObjectValue(data.data || {}, ['userId', 'user_id', 'channelId', 'channel_id']) ||
        getVeloraChannelIdFromResponse(data);
}

async function fetchVeloraJson(url) {
    const response = await fetch(url, {
        cache: 'no-store',
        headers: {
            'Accept': 'application/json'
        }
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}

async function resolveChatHistoryChannelId(channel) {
    const normalized = normalizeChannelName(channel);
    if (!normalized) {
        return '';
    }
    if (looksLikeVeloraId(normalized)) {
        return normalized;
    }
    if (state.chatHistoryResolveCache[normalized]) {
        return state.chatHistoryResolveCache[normalized];
    }
    if (state.chatHistoryResolvePending[normalized]) {
        return state.chatHistoryResolvePending[normalized];
    }

    state.chatHistoryResolvePending[normalized] = fetchVeloraJson(`${VELORA_API_BASE}/api/users/${encodeURIComponent(channel)}`)
        .then(function (data) {
            return getVeloraChannelIdFromResponse(data) || '';
        })
        .catch(function () {
            return fetchVeloraJson(`${VELORA_API_BASE}/api/streams/user/${encodeURIComponent(channel)}`)
                .then(function (data) {
                    return getVeloraChannelIdFromStreamResponse(data) || '';
                });
        })
        .then(function (resolved) {
            state.chatHistoryResolveCache[normalized] = normalizeChannelName(resolved) || normalized;
            delete state.chatHistoryResolvePending[normalized];
            return state.chatHistoryResolveCache[normalized];
        })
        .catch(function () {
            delete state.chatHistoryResolvePending[normalized];
            return normalized;
        });

    return state.chatHistoryResolvePending[normalized];
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const conf = JSON.parse(raw);
        if (conf.redirectUri) state.redirectUri = conf.redirectUri;
        state.hideMetrics = !!conf.hideMetrics;
    } catch (e) {}
}

function applyRuntimeOverrides() {
    const redirectUri = normalizeRedirectUri(getRuntimeParam('redirect_uri') || getRuntimeParam('redirectUri'));

    if (redirectUri) {
        state.redirectUri = redirectUri;
    }

    if (!state.clientId) {
        state.clientId = DEFAULT_VELORA_CLIENT_ID;
    }
    if (!state.redirectUri) {
        state.redirectUri = DEFAULT_VELORA_REDIRECT_URI;
    }
}

function persistConfig() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            redirectUri: state.redirectUri,
            hideMetrics: !!state.hideMetrics
        }));
    } catch (e) {}
}

function applyMetricsVisibility() {
    if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle('hide-metrics', !!state.hideMetrics);
    }
}

function loadTokens() {
    try {
        const raw = localStorage.getItem(TOKEN_KEY);
        if (!raw) return;
        const tokens = JSON.parse(raw);
        if (tokens && tokens.access_token) {
            const previousIdentity = state.tokens
                ? `${state.tokens.access_token || ''}|${state.tokens.refresh_token || ''}`
                : '';
            const nextIdentity = `${tokens.access_token || ''}|${tokens.refresh_token || ''}`;
            state.tokens = tokens;
            if (previousIdentity !== nextIdentity) {
                state.authGeneration += 1;
            }
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

function clearAuthState(expiredMessage) {
    state.authGeneration += 1;
    state.tokens = null;
    state.authUser = null;
    state.profileStatus = expiredMessage ? 'auth-error' : 'unverified';
    state.profileError = expiredMessage || '';
    state.authError = '';
    state.authInProgress = false;
    state.streamId = null;
    persistTokens();
    clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
    clearTimeout(state.refreshRetryTimer);
    state.refreshRetryTimer = null;
    state.refreshPromise = null;
}

function clearAuthHandoffWatcher() {
    if (state.authHandoffPollTimer) {
        clearInterval(state.authHandoffPollTimer);
        state.authHandoffPollTimer = null;
    }
    state.authHandoffInFlight = false;
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

function getVeloraOAuthBridge() {
    if (window.ninjafy && typeof window.ninjafy.startVeloraOAuth === 'function') {
        return window.ninjafy;
    }
    if (window.__ssapp && typeof window.__ssapp.startVeloraOAuth === 'function') {
        return window.__ssapp;
    }
    return null;
}

function getRedirectUri() {
    return normalizeRedirectUri(state.redirectUri) || DEFAULT_VELORA_REDIRECT_URI;
}

function base64UrlToJson(value) {
    if (!value) return null;
    try {
        const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '==='.slice((normalized.length + 3) % 4);
        const decoded = atob(padded);
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

function normalizeTokenPayload(payload) {
    if (!payload || !payload.access_token) {
        return null;
    }
    const expiresIn = Number(payload.expires_in);
    return {
        access_token: String(payload.access_token),
        refresh_token: payload.refresh_token ? String(payload.refresh_token) : null,
        token_type: payload.token_type ? String(payload.token_type) : 'Bearer',
        expires_at: Number.isFinite(expiresIn) && expiresIn > 0 ? (Date.now() + expiresIn * 1000) : null
    };
}

function applyTokenPayload(payload) {
    const tokens = normalizeTokenPayload(payload);
    if (!tokens) {
        throw new Error('Velora auth payload did not include an access token.');
    }
    state.tokens = tokens;
    state.authGeneration += 1;
    state.authUser = null;
    state.profileStatus = 'unverified';
    state.profileError = '';
    state.authError = '';
    persistTokens();
    scheduleTokenRefresh();
}

async function handleAuthSuccess(payload) {
    clearAuthHandoffWatcher();
    state.authInProgress = false;
    applyTokenPayload(payload && payload.tokens ? payload.tokens : payload);
    if (!state.tokens?.access_token) {
        loadTokens();
    }
    await loadUserProfile();
    updateAuthUI();
    connectSocket();
}

function handleAuthError(payload) {
    clearAuthHandoffWatcher();
    state.authInProgress = false;
    const detail = payload && payload.message ? payload.message : 'Velora sign-in failed.';
    state.authError = 'Velora sign-in did not complete. Try again.';
    addEventLogEntry(detail, 'error');
    setAuthStatus(state.authError, 'danger');
    updateAuthUI();
}

async function completeStoredAuthHandoff() {
    if (state.authHandoffInFlight) {
        return false;
    }
    state.authHandoffInFlight = true;
    try {
        const previousAccessToken = state.tokens?.access_token || '';
        loadTokens();
        if (!state.tokens?.access_token || isTokenExpired()) {
            return false;
        }
        scheduleTokenRefresh();
        if (previousAccessToken && previousAccessToken === state.tokens.access_token && state.authUser && state.eventsConnected) {
            clearAuthHandoffWatcher();
            return true;
        }
        if (previousAccessToken !== state.tokens.access_token) {
            disconnectSocketTransport();
            disconnectSseTransport();
            stopViewerPoll();
            stopChatHistoryPoll();
            state.authUser = null;
            state.profileStatus = 'unverified';
            state.profileError = '';
        }
        await loadUserProfile();
        state.authInProgress = false;
        updateAuthUI();
        connectSocket();
        if (state.authPopup && !state.authPopup.closed) {
            try {
                state.authPopup.close();
            } catch (e) {}
        }
        state.authPopup = null;
        clearAuthHandoffWatcher();
        return true;
    } catch (err) {
        console.warn('[Velora] Failed to complete stored auth handoff:', err && err.message ? err.message : err);
        return false;
    } finally {
        state.authHandoffInFlight = false;
    }
}

function startAuthHandoffWatcher() {
    clearAuthHandoffWatcher();
    const started = Date.now();
    state.authHandoffPollTimer = setInterval(function () {
        if (state.authPopup && state.authPopup.closed) {
            state.authPopup = null;
            clearAuthHandoffWatcher();
            state.authInProgress = false;
            state.authError = 'Velora sign-in was cancelled. Try again.';
            updateAuthUI();
            return;
        }
        if ((Date.now() - started) > 120000) {
            clearAuthHandoffWatcher();
            state.authInProgress = false;
            state.authError = 'Velora sign-in timed out. Try again.';
            setAuthStatus(state.authError, 'danger');
            updateAuthUI();
            return;
        }
        completeStoredAuthHandoff();
    }, 1000);
}

async function handleAuthPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }
    if (payload.type === VELORA_AUTH_MESSAGE_SUCCESS || payload.tokens || payload.access_token) {
        await handleAuthSuccess(payload);
        return true;
    }
    if (payload.type === VELORA_AUTH_MESSAGE_ERROR) {
        handleAuthError(payload);
        return true;
    }
    return false;
}

function maybeReloadAfterSsappAuthHandoff() {
    if (!hasRuntimeFlag('ssapp')) {
        return;
    }
    setTimeout(function () {
        try {
            if (!localStorage.getItem(TOKEN_KEY)) return;
            const authText = els.authState ? String(els.authState.textContent || '') : '';
            if (!/^Signed in\b/i.test(authText)) {
                window.location.reload();
            }
        } catch (e) {}
    }, 100);
}

async function consumeAuthResultFromHash() {
    let changed = false;
    let handled = false;
    try {
        const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
        const encodedResult = hash.get(VELORA_AUTH_RESULT_KEY);
        const encodedError = hash.get(VELORA_AUTH_ERROR_KEY);
        if (encodedResult) {
            const payload = base64UrlToJson(encodedResult);
            if (await handleAuthPayload(payload)) {
                handled = true;
            }
            hash.delete(VELORA_AUTH_RESULT_KEY);
            changed = true;
        }
        if (encodedError) {
            const payload = base64UrlToJson(encodedError);
            if (await handleAuthPayload(payload)) {
                handled = true;
            }
            hash.delete(VELORA_AUTH_ERROR_KEY);
            changed = true;
        }
        if (changed) {
            const cleanUrl = `${window.location.pathname}${window.location.search}${hash.toString() ? `#${hash.toString()}` : ''}`;
            history.replaceState({}, document.title, cleanUrl);
        }
    } catch (e) {
        console.warn('[Velora] Failed to consume auth callback payload:', e);
    }
    return handled;
}

async function exchangeCodeForToken(code, verifier, redirectUri) {
    const response = await fetch(`${getVeloraAuthBase()}/exchange`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            code_verifier: verifier,
            redirect_uri: normalizeRedirectUri(redirectUri) || getRedirectUri()
        })
    });

    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) {}

    if (!response.ok) {
        throw new Error(data.message || data.error_description || data.error || text || `HTTP ${response.status}`);
    }

    applyTokenPayload(data);
}

async function startExternalAuthFlow() {
    const bridge = getVeloraOAuthBridge();
    if (!bridge || typeof bridge.startVeloraOAuth !== 'function') {
        return false;
    }

    const scopes = VELORA_SCOPES.split(/\s+/).filter(Boolean);
    const result = await bridge.startVeloraOAuth({
        authBase: getVeloraAuthBase(),
        clientId: state.clientId,
        redirectUri: getRedirectUri(),
        scopes: scopes
    });

    if (await handleAuthPayload(result)) {
        maybeReloadAfterSsappAuthHandoff();
        return true;
    }

    const nestedPayload = result && typeof result === 'object'
        ? (result.payload || result.authPayload || null)
        : null;
    if (await handleAuthPayload(nestedPayload)) {
        maybeReloadAfterSsappAuthHandoff();
        return true;
    }

    if (!result || !result.code || !result.codeVerifier) {
        throw new Error('Velora OAuth did not return a code and PKCE verifier.');
    }

    if (result.redirectUri) {
        state.redirectUri = normalizeRedirectUri(result.redirectUri) || getRedirectUri();
        persistConfig();
    }

    await exchangeCodeForToken(result.code, result.codeVerifier, result.redirectUri || getRedirectUri());
    state.authInProgress = false;
    await loadUserProfile();
    updateAuthUI();
    connectSocket();
    return true;
}

function startBrowserAuthFlow() {
    const authUrl = getAuthStartUrl();
    const popup = window.open(authUrl, 'veloraAuth', 'width=560,height=760');
    if (!popup) {
        window.location.href = authUrl;
        return;
    }
    state.authPopup = popup;
    state.authInProgress = true;
    setAuthStatus('Complete Velora sign-in in the popup.', 'warning');
    updateAuthUI();
    startAuthHandoffWatcher();
}

async function startAuthFlow() {
    if (state.profileStatus === 'auth-error') {
        disconnectSocket();
        stopChatHistoryPoll();
        clearAuthState();
        updateViewerCount(null, 'Checking viewers…');
    }
    state.authInProgress = true;
    state.authError = '';
    updateAuthUI();
    setSocketStatus('connecting', 'Finish signing in to Velora.');
    try {
        const handled = await startExternalAuthFlow();
        if (!handled) {
            startBrowserAuthFlow();
        }
    } catch (err) {
        console.error('[Velora] Sign-in failed:', err);
        state.authInProgress = false;
        state.authError = 'Velora sign-in did not complete. Try again.';
        addEventLogEntry(`Velora sign-in failed: ${err && err.message ? err.message : err}`, 'error');
        setAuthStatus(state.authError, 'danger');
        updateAuthUI();
    }
}

async function handleAuthCallback() {
    return consumeAuthResultFromHash();
}

async function refreshAccessToken() {
    if (state.refreshPromise) return state.refreshPromise;

    const generation = state.authGeneration;
    const accessToken = state.tokens?.access_token || '';
    const refreshToken = state.tokens?.refresh_token || '';
    if (!refreshToken) {
        clearAuthState('Your Velora sign-in expired. Sign in again.');
        disconnectSocket();
        updateAuthUI();
        return false;
    }

    const refreshPromise = (async function () {
        try {
            const response = await fetch(`${getVeloraAuthBase()}/refresh`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            const text = await response.text();
            let data = {};
            try { data = text ? JSON.parse(text) : {}; } catch (e) {}
            if (generation !== state.authGeneration || accessToken !== (state.tokens?.access_token || '') ||
                refreshToken !== (state.tokens?.refresh_token || '')) {
                return false;
            }

            if (!response.ok) {
                const refreshError = new Error(data.message || data.error_description || data.error || text || `HTTP ${response.status}`);
                refreshError.status = response.status;
                refreshError.code = data.error || data.code || '';
                throw refreshError;
            }

            const tokens = normalizeTokenPayload(data);
            if (!tokens) {
                throw new Error('Velora refresh response did not include an access token.');
            }
            if (!tokens.refresh_token) {
                tokens.refresh_token = refreshToken;
            }
            state.tokens = tokens;
            state.authGeneration += 1;
            persistTokens();
            scheduleTokenRefresh();
            clearTimeout(state.refreshRetryTimer);
            state.refreshRetryTimer = null;
            state.connectionError = '';

            if (state.socket && state.socket.connected) {
                state.socket.auth = { token: state.tokens.access_token };
            }
            return true;
        } catch (err) {
            if (generation !== state.authGeneration || accessToken !== (state.tokens?.access_token || '') ||
                refreshToken !== (state.tokens?.refresh_token || '')) {
                return false;
            }
            console.error('[Velora] Token refresh failed:', err);
            const errorCode = String(err?.code || '').toLowerCase();
            const rejected = err && (
                err.status === 400 ||
                err.status === 401 ||
                errorCode === 'invalid_grant' ||
                errorCode === 'invalid_token' ||
                errorCode === 'token_revoked' ||
                errorCode === 'revoked_token'
            );
            if (rejected) {
                clearAuthState('Your Velora sign-in expired. Sign in again.');
                disconnectSocket();
                updateAuthUI();
                return false;
            }
            state.connectionError = 'Velora could not refresh your session. Retrying automatically.';
            renderConnectionState('connecting', state.connectionError);
            notifyAppStatus('connecting', state.connectionError);
            updateAuthUI();
            clearTimeout(state.refreshRetryTimer);
            state.refreshRetryTimer = setTimeout(async function () {
                if (await refreshAccessToken()) {
                    await resumeAfterTokenRefresh();
                }
            }, TOKEN_REFRESH_RETRY_MS);
            return false;
        } finally {
            if (state.refreshPromise === refreshPromise) {
                state.refreshPromise = null;
            }
        }
    })();

    state.refreshPromise = refreshPromise;
    return refreshPromise;
}

function scheduleTokenRefresh() {
    clearTimeout(state.refreshTimer);
    if (!state.tokens?.expires_at) return;
    const delay = Math.max(10000, state.tokens.expires_at - Date.now() - 120000);
    state.refreshTimer = setTimeout(async function () {
        if (await refreshAccessToken()) {
            await resumeAfterTokenRefresh();
        }
    }, delay);
}

async function resumeAfterTokenRefresh() {
    if (!state.tokens?.access_token) return false;
    if (state.profileStatus !== 'verified' || !getAuthedChannelName()) {
        const verified = await loadUserProfile({ allowRefresh: false });
        updateAuthUI();
        if (!verified) return false;
    }
    if (!isAccountReady()) {
        updateAuthUI();
        return false;
    }
    if (state.sseRequest || state.eventTransport === 'sse') {
        connectSse('Refreshing Velora SSE connection with updated token.');
    } else if (!state.eventsConnected) {
        connectSocket();
    }
    updateAuthUI();
    return true;
}

// ─── User profile ─────────────────────────────────────────────────────────────

async function loadUserProfile(options = {}) {
    if (!state.tokens?.access_token) return false;
    const generation = state.authGeneration;
    const accessToken = state.tokens.access_token;
    state.profileStatus = 'verifying';
    state.profileError = '';
    state.authUser = null;
    updateAuthUI();
    try {
        const response = await fetch(`${VELORA_API_BASE}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (generation !== state.authGeneration || accessToken !== state.tokens?.access_token) return false;
        if (!response.ok) {
            if ((response.status === 401 || response.status === 403) && options.allowRefresh !== false && state.tokens?.refresh_token) {
                if (await refreshAccessToken()) {
                    return loadUserProfile({ allowRefresh: false });
                }
                if (generation !== state.authGeneration || accessToken !== state.tokens?.access_token) return false;
            }
            state.profileStatus = response.status === 401 || response.status === 403 ? 'auth-error' : 'error';
            state.profileError = state.profileStatus === 'auth-error'
                ? 'Your Velora sign-in expired. Sign in again.'
                : `Velora could not verify your account (HTTP ${response.status}).`;
            return false;
        }
        const data = await response.json();
        if (generation !== state.authGeneration || accessToken !== state.tokens?.access_token) return false;
        state.authUser = data.user || data;
        if (!getAuthedChannelName()) {
            state.authUser = null;
            state.profileStatus = 'error';
            state.profileError = 'Velora did not return an account username.';
            return false;
        }
        state.profileStatus = 'verified';
        state.profileError = '';
        return true;
    } catch (e) {
        if (generation !== state.authGeneration || accessToken !== state.tokens?.access_token) return false;
        state.profileStatus = 'error';
        state.profileError = 'Check your internet connection, then try again.';
        return false;
    }
}

// ─── Viewer count polling ─────────────────────────────────────────────────────

function getChatHistoryChannelId() {
    if (!isAccountReady()) return '';
    return getAuthedChannelName();
}

async function pollChatHistory() {
    if (!isAccountReady()) {
        stopChatHistoryPoll();
        return;
    }
    const requestedChannel = getChatHistoryChannelId();
    if (!requestedChannel || state.chatHistoryInFlight) {
        return;
    }

    state.chatHistoryInFlight = true;
    try {
        const channelId = await resolveChatHistoryChannelId(requestedChannel);
        if (!channelId) {
            return;
        }

        const channelKey = `${requestedChannel}|${channelId}`;
        if (state.chatHistoryChannel !== channelKey) {
            state.chatHistoryChannel = channelKey;
            state.processedChatMessages.clear();
            state.chatHistoryLastError = '';
            state.chatHistoryHadSuccess = false;
            state.chatHistoryStartedAt = Date.now();
        }

        const data = await fetchVeloraJson(`${VELORA_API_BASE}/api/chat/channels/${encodeURIComponent(channelId)}/history?limit=${VELORA_CHAT_HISTORY_LIMIT}`);
        if (!isAccountReady() || requestedChannel !== getChatHistoryChannelId()) {
            return;
        }
        const messages = getHistoryMessagesFromResponse(data).slice();
        if (messages.length > 1 && getChatMessageTimestampValue(messages[0]) > getChatMessageTimestampValue(messages[messages.length - 1])) {
            messages.reverse();
        }
        messages.forEach(function (message) {
            const timestampValue = getChatMessageTimestampValue(message);
            if (!state.chatHistoryHadSuccess && (!timestampValue || timestampValue < state.chatHistoryStartedAt)) {
                rememberChatMessage(normalizeVeloraChatMessage(message));
                return;
            }
            handleChatMessage(message);
        });

        if (!state.chatHistoryHadSuccess) {
            state.chatHistoryHadSuccess = true;
            state.chatHistoryLastError = '';
            addEventLogEntry(`Chat history polling active for @${requestedChannel}.`, 'info');
        }
    } catch (err) {
        const message = err && err.message ? err.message : String(err || 'Unknown error');
        if (message !== state.chatHistoryLastError) {
            state.chatHistoryLastError = message;
            addEventLogEntry(`Chat history polling unavailable: ${message}`, 'warn');
        }
    } finally {
        state.chatHistoryInFlight = false;
    }
}

function startChatHistoryPoll() {
    if (!isAccountReady() || !getChatHistoryChannelId()) {
        return;
    }
    if (!state.chatHistoryTimer) {
        pollChatHistory();
        state.chatHistoryTimer = setInterval(pollChatHistory, VELORA_CHAT_HISTORY_INTERVAL_MS);
        return;
    }
    pollChatHistory();
}

function stopChatHistoryPoll() {
    if (state.chatHistoryTimer) {
        clearInterval(state.chatHistoryTimer);
        state.chatHistoryTimer = null;
    }
    state.chatHistoryChannel = '';
    state.chatHistoryInFlight = false;
    state.chatHistoryLastError = '';
    state.chatHistoryHadSuccess = false;
    state.chatHistoryStartedAt = 0;
}

async function pollViewerCount() {
    if (!isAccountReady()) return;
    const generation = state.authGeneration;
    const accessToken = state.tokens.access_token;
    const username = getAuthedChannelName();
    const isCurrentRequest = function () {
        return isAccountReady() &&
            generation === state.authGeneration &&
            accessToken === state.tokens?.access_token &&
            username === getAuthedChannelName();
    };
    try {
        if (!username) return;
        const response = await fetch(`${VELORA_API_BASE}/api/streams/user/${encodeURIComponent(username)}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!isCurrentRequest()) return;
        if (response.status === 404) {
            state.streamId = null;
            updateViewerCount(null, 'Stream offline');
            return;
        }
        if (!response.ok) {
            updateViewerCount(null, 'Viewers unavailable');
            return;
        }
        const data = await response.json();
        if (!isCurrentRequest()) return;
        const stream = Array.isArray(data.streams)
            ? data.streams[0]
            : (data.stream || data.data || data || null);
        if (stream) {
            state.streamId = stream.id || stream.streamId || null;
            updateViewerCount(
                stream.viewerCount ??
                stream.viewer_count ??
                stream.viewers ??
                stream.viewer_count_live ??
                null
            );
        } else {
            state.streamId = null;
            updateViewerCount(null, 'Stream offline');
        }
    } catch (e) {
        if (isCurrentRequest()) {
            updateViewerCount(null, 'Viewers unavailable');
        }
    }
}

function startViewerPoll() {
    stopViewerPoll();
    updateViewerCount(null, 'Checking viewersâ€¦');
    pollViewerCount();
    state.viewerPollTimer = setInterval(pollViewerCount, VIEWER_POLL_INTERVAL_MS);
}

function stopViewerPoll() {
    clearInterval(state.viewerPollTimer);
    state.viewerPollTimer = null;
}

function clearSocketFallbackTimer() {
    clearTimeout(state.socketFallbackTimer);
    state.socketFallbackTimer = null;
}

function clearSocketConnectTimer() {
    clearTimeout(state.socketConnectTimer);
    state.socketConnectTimer = null;
}

function clearSseReconnectTimer() {
    clearTimeout(state.sseReconnectTimer);
    state.sseReconnectTimer = null;
}

function clearSseConnectTimer() {
    clearTimeout(state.sseConnectTimer);
    state.sseConnectTimer = null;
}

function resetEventConnectionState() {
    state.eventsConnected = false;
    state.eventTransport = '';
    state.connectedChannel = '';
}

function disconnectSocketTransport() {
    clearSocketFallbackTimer();
    clearSocketConnectTimer();
    if (state.socket) {
        const socket = state.socket;
        state.socket = null;
        try {
            socket.disconnect();
        } catch (e) {}
    }
}

function disconnectSseTransport() {
    clearSseReconnectTimer();
    clearSseConnectTimer();
    const xhr = state.sseRequest;
    state.sseRequest = null;
    state.sseReadOffset = 0;
    state.sseBuffer = '';
    if (xhr) {
        try {
            xhr.abort();
        } catch (e) {}
    }
}

function applyConnectedChannelInfo(data, transportLabel) {
    const channelName = normalizeChannelName(
        (data && (data.channelUsername || data.username)) ||
        getAuthedChannelName()
    );
    if (!isAccountReady() || !channelName || channelName !== getAuthedChannelName()) {
        disconnectSocketTransport();
        disconnectSseTransport();
        stopViewerPoll();
        stopChatHistoryPoll();
        resetEventConnectionState();
        updateAuthUI();
        return;
    }
    const labelName = channelName || '-';
    const transportKey = String(transportLabel || '').toLowerCase();
    const isFirstConnection = !state.eventsConnected;
    const channelChanged = channelName && channelName !== state.connectedChannel;
    const transportChanged = transportKey !== state.eventTransport;

    state.eventsConnected = true;
    state.eventTransport = transportKey;
    if (channelName) {
        state.connectedChannel = channelName;
    }

    clearSocketFallbackTimer();
    clearSocketConnectTimer();
    clearSseReconnectTimer();
    clearSseConnectTimer();
    setSocketStatus('connected', `Velora ${transportLabel} connected.`, {
        channel: labelName,
        transport: transportLabel
    });

    if (transportKey === 'sse') {
        disconnectSocketTransport();
    } else if (transportKey === 'websocket') {
        disconnectSseTransport();
    }

    if (isFirstConnection || transportChanged) {
        addEventLogEntry(`Connected to Velora Events API via ${transportLabel}.`, 'info');
    }
    if (isFirstConnection || transportChanged || channelChanged) {
        addEventLogEntry(`Authenticated as channel: ${labelName}`, 'info');
    }

    startViewerPoll();
    startChatHistoryPoll();
    updateAuthUI();
}

function scheduleSseReconnect(reason) {
    if (!isAccountReady() || state.sseRequest) {
        return;
    }
    clearSseReconnectTimer();
    state.sseReconnectTimer = setTimeout(function () {
        connectSse(reason);
    }, SSE_RECONNECT_DELAY_MS);
}

function handleSsePayload(eventName, payload) {
    if (!isAccountReady() || !payload || typeof payload !== 'object') {
        return;
    }
    if (eventName === 'connected' || payload.event === 'connected') {
        applyConnectedChannelInfo(payload.data || payload, 'SSE');
        return;
    }
    handleEvent(payload);
}

function processSseChunk(chunk) {
    if (!chunk) return;
    state.sseBuffer += chunk;
    const blocks = state.sseBuffer.split(/\r?\n\r?\n/);
    state.sseBuffer = blocks.pop() || '';

    blocks.forEach(function (block) {
        if (!block) return;
        let eventName = '';
        const dataLines = [];
        block.split(/\r?\n/).forEach(function (line) {
            if (!line || line.charAt(0) === ':') return;
            if (line.indexOf('event:') === 0) {
                eventName = line.slice(6).trim();
                return;
            }
            if (line.indexOf('data:') === 0) {
                dataLines.push(line.slice(5).replace(/^\s*/, ''));
            }
        });
        if (!dataLines.length) return;
        try {
            handleSsePayload(eventName, JSON.parse(dataLines.join('\n')));
        } catch (e) {
            addEventLogEntry('Failed to parse Velora SSE payload.', 'warn');
        }
    });
}

function handleSseAuthFailure(status) {
    // A 401/403 means the access token was rejected. Tear this request down and attempt a SINGLE token
    // refresh, rather than letting onload/scheduleSseReconnect hot-loop every few seconds on the same
    // dead token (which happens when the token expires while the machine is asleep). refreshAccessToken()
    // clears auth on failure, so the scheduleSseReconnect guard then stops retrying on its own.
    const xhr = state.sseRequest;
    state.sseRequest = null;
    state.sseReadOffset = 0;
    state.sseBuffer = '';
    clearSseReconnectTimer();
    try { if (xhr) xhr.abort(); } catch (e) {}

    if (state.sseAuthRefreshInFlight) return;
    if (state.sseAuthRetries >= 1) {
        state.profileStatus = 'auth-error';
        state.profileError = 'Your Velora sign-in expired. Sign in again.';
        setSocketStatus('error', 'Velora sign-in required.');
        addEventLogEntry(`Velora SSE auth still failing (HTTP ${status}) after refresh. Please sign in again.`, 'error');
        updateAuthUI();
        return;
    }
    state.sseAuthRetries += 1;
    state.sseAuthRefreshInFlight = true;
    setSocketStatus('connecting', 'Velora session expired. Refreshing token…');
    addEventLogEntry(`Velora SSE auth failed (HTTP ${status}). Refreshing token…`, 'warn');
    Promise.resolve(refreshAccessToken()).then(async function (refreshed) {
        state.sseAuthRefreshInFlight = false;
        if (refreshed) {
            await resumeAfterTokenRefresh();
        }
    }).catch(function () {
        state.sseAuthRefreshInFlight = false;
    });
}

function connectSse(reason) {
    if (!isAccountReady()) {
        updateAuthUI();
        return;
    }

    disconnectSseTransport();
    disconnectSocketTransport();
    resetEventConnectionState();
    setSocketStatus('connecting', 'Connecting to Velora SSE...');

    if (reason) {
        addEventLogEntry(reason, 'warn');
    }

    const xhr = new XMLHttpRequest();
    state.sseRequest = xhr;
    state.sseReadOffset = 0;
    state.sseBuffer = '';

    xhr.open('GET', VELORA_EVENTS_SSE_URL, true);
    xhr.setRequestHeader('Authorization', `Bearer ${state.tokens.access_token}`);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    state.sseConnectTimer = setTimeout(function () {
        if (xhr !== state.sseRequest || state.eventsConnected) return;
        state.sseRequest = null;
        try { xhr.abort(); } catch (e) {}
        resetEventConnectionState();
        setSocketStatus('error', 'Velora is taking too long to connect. Retrying automatically.');
        addEventLogEntry('Velora SSE connection timed out.', 'warn');
        scheduleSseReconnect('Retrying Velora SSE connection.');
    }, SSE_CONNECT_TIMEOUT_MS);

    xhr.onreadystatechange = function () {
        if (xhr !== state.sseRequest) return;
        if (xhr.readyState === 2 && (xhr.status === 401 || xhr.status === 403)) {
            clearSseConnectTimer();
            handleSseAuthFailure(xhr.status);
        } else if (xhr.readyState === 2 && xhr.status && xhr.status !== 200) {
            clearSseConnectTimer();
            setSocketStatus('error', `Velora SSE error: HTTP ${xhr.status}`);
            addEventLogEntry(`SSE connection failed: HTTP ${xhr.status}`, 'error');
        } else if (xhr.readyState === 2 && xhr.status === 200 && !state.eventsConnected) {
            state.sseAuthRetries = 0;
            applyConnectedChannelInfo(null, 'SSE');
        }
    };

    xhr.onprogress = function () {
        if (xhr !== state.sseRequest) return;
        const text = xhr.responseText || '';
        const chunk = text.slice(state.sseReadOffset);
        state.sseReadOffset = text.length;
        processSseChunk(chunk);
    };

    xhr.onerror = function () {
        if (xhr !== state.sseRequest) return;
        clearSseConnectTimer();
        state.sseRequest = null;
        state.sseReadOffset = 0;
        state.sseBuffer = '';
        resetEventConnectionState();
        stopViewerPoll();
        setSocketStatus('connecting', 'Connection interrupted. Reconnecting automatically.');
        addEventLogEntry('Velora SSE connection error.', 'error');
        scheduleSseReconnect('Retrying Velora SSE connection.');
    };

    xhr.onload = function () {
        if (xhr !== state.sseRequest) return;
        clearSseConnectTimer();
        state.sseRequest = null;
        state.sseReadOffset = 0;
        state.sseBuffer = '';
        resetEventConnectionState();
        stopViewerPoll();
        if (isAccountReady()) {
            setSocketStatus('connecting', 'Connection interrupted. Reconnecting automatically.');
            addEventLogEntry('Velora SSE stream closed. Reconnecting…', 'warn');
            scheduleSseReconnect();
        }
    };

    xhr.send();
}

function startSocketFallbackTimer() {
    clearSocketConnectTimer();
    clearSocketFallbackTimer();
    state.socketFallbackTimer = setTimeout(function () {
        if (state.eventsConnected) {
            return;
        }
        connectSse('WebSocket connected without Velora channel confirmation. Falling back to SSE.');
    }, SOCKET_CONNECTED_EVENT_TIMEOUT_MS);
}

// ─── Socket.IO connection ─────────────────────────────────────────────────────

function startSocketConnectTimeout() {
    clearSocketConnectTimer();
    state.socketConnectTimer = setTimeout(function () {
        if (state.eventsConnected || state.sseRequest) {
            return;
        }
        connectSse('Velora WebSocket connection timed out. Falling back to SSE.');
    }, SOCKET_CONNECT_TIMEOUT_MS);
}

function connectSocket() {
    if (!isAccountReady()) {
        updateAuthUI();
        return;
    }
    if (typeof io !== 'function') {
        startChatHistoryPoll();
        connectSse('socket.io client not loaded. Using SSE instead.');
        return;
    }

    disconnectSocketTransport();
    disconnectSseTransport();
    stopViewerPoll();
    resetEventConnectionState();
    startChatHistoryPoll();

    const socket = io(VELORA_WS_URL, {
        auth: { token: state.tokens.access_token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
        reconnectionAttempts: Infinity
    });

    state.socket = socket;
    setSocketStatus('connecting', 'Connecting to Velora Events API...');
    startSocketConnectTimeout();

    socket.on('connect', () => {
        if (socket !== state.socket || !isAccountReady()) return;
        setSocketStatus('connecting', 'Velora WebSocket connected; waiting for channel confirmation...');
        addEventLogEntry('Velora WebSocket transport connected. Waiting for channel confirmation…', 'info');
        startSocketFallbackTimer();
    });

    socket.on('connected', (data) => {
        if (socket !== state.socket || !isAccountReady()) return;
        applyConnectedChannelInfo(data, 'WebSocket');
    });

    socket.on('event', (payload) => {
        if (socket !== state.socket || !isAccountReady()) return;
        if (!state.eventsConnected) {
            applyConnectedChannelInfo(null, 'WebSocket');
        }
        handleEvent(payload);
    });

    socket.on('disconnect', (reason) => {
        if (socket !== state.socket) return;
        clearSocketFallbackTimer();
        if (!state.sseRequest) {
            setSocketStatus('connecting', 'Connection interrupted. Reconnecting automatically.');
            addEventLogEntry(`Disconnected: ${reason}`, 'warn');
            stopViewerPoll();
            resetEventConnectionState();
        }
    });

    socket.on('connect_error', (err) => {
        if (socket !== state.socket || !isAccountReady()) return;
        addEventLogEntry(`Connection error: ${err.message}`, 'error');
        connectSse('WebSocket connection failed. Falling back to SSE.');
    });

    socket.on('error', (err) => {
        if (socket !== state.socket) return;
        const message = err && err.message ? err.message : String(err || 'Unknown socket error');
        addEventLogEntry(`Socket error: ${message}`, 'error');
    });
}

function disconnectSocket() {
    disconnectSocketTransport();
    disconnectSseTransport();
    stopViewerPoll();
    resetEventConnectionState();
    setSocketStatus('disconnected', 'Velora Events disconnected.');
}

// ─── Event routing ────────────────────────────────────────────────────────────

function handleEvent(payload) {
    if (!isAccountReady() || !payload || !payload.event) return;
    const { event, data } = payload;

    addEventLogEntry(event, 'info', data);

    switch (event) {
        case 'chat.message':
            handleChatMessage(data);
            break;
        case 'channel.follow':
        case 'user.follow':
            handleFollow(data);
            break;
        case 'channel.subscribe':
            handleSubscribe(data);
            break;
        case 'channel.subscription.gift':
        case 'channel.gift':
            handleGiftSub(data);
            break;
        case 'channel.volts':
            handleVolts(data);
            break;
        case 'channel.raid':
            handleRaid(data);
            break;
        case 'channel.channel_points_redemption':
        case 'channel.points.redeem':
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

    const normalized = normalizeVeloraChatMessage(data);
    if (!normalized) return;

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
        avatarUrl,
        card,
        isSystem
    } = normalized;

    const name = displayName || username || '';
    const text = message || '';
    const textOnlyMode = isTextOnlyMode();
    const renderedMessage = renderVeloraMessageHtml(text);

    // Skip pure system messages with no text
    if (isSystem && !text && !card) return;
    if (!name || (!text && !card)) return;
    if (!rememberChatMessage(normalized)) return;

    addChatFeedMessage(name, renderedMessage.html, badges, isMod, isVip, isSubscriber, color);

    let contentImg = '';
    let msgText = textOnlyMode ? text : renderedMessage.html;

    if (card) {
        if (card.imageUrl || card.thumbnailUrl) {
            contentImg = card.imageUrl || card.thumbnailUrl;
        }
        if (card.name && !msgText) {
            msgText = textOnlyMode ? `[${card.name}]` : escapeHtml(`[${card.name}]`);
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
        chatimg: avatarUrl || '',
        hasDonation: '',
        membership: isSubscriber ? (subscriberMonths ? `${subscriberMonths} month subscriber` : 'Subscriber') : '',
        contentimg: contentImg,
        textonly: textOnlyMode,
        type: 'velora',
        meta: {
            velora: {
                rawMessage: text,
                emotes: renderedMessage.emotes,
                messageId: messageId || '',
                userId: userId || ''
            }
        }
    });
}

// ─── Alert events ─────────────────────────────────────────────────────────────

function userDisplayName(user) {
    if (!user) return '';
    return user.displayName || user.display_name || user.name || user.username || user.login || '';
}

function handleFollow(data) {
    if (!data) return;
    const textOnlyMode = isTextOnlyMode();
    const name = userDisplayName(data.follower) || userDisplayName(data.user) || data.displayName || data.username || 'Someone';
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
        textonly: textOnlyMode,
        type: 'velora',
        event: 'follow'
    });
}

function handleSubscribe(data) {
    if (!data) return;
    const textOnlyMode = isTextOnlyMode();
    const name = userDisplayName(data.subscriber) || userDisplayName(data.user) || data.displayName || data.username || 'Someone';
    const monthsValue = data.months || data.subscriberMonths || data.subscriber_months || '';
    const months = monthsValue ? ` (${monthsValue} months)` : '';
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
        textonly: textOnlyMode,
        type: 'velora',
        event: 'subscribe'
    });
}

function handleGiftSub(data) {
    if (!data) return;
    const textOnlyMode = isTextOnlyMode();
    const gifterName = userDisplayName(data.gifter) || userDisplayName(data.user) || data.gifterDisplayName || data.gifterUsername || data.displayName || data.username || 'Anonymous';
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
        textonly: textOnlyMode,
        type: 'velora',
        event: 'subscription_gift'
    });
}

function handleVolts(data) {
    if (!data) return;
    const textOnlyMode = isTextOnlyMode();
    const name = userDisplayName(data.sender) || userDisplayName(data.from) || userDisplayName(data.user) || data.displayName || data.username || 'Someone';
    const amount = data.amount || data.volts || data.amountVolts || data.quantity || data.value || '';
    const amountLabel = amount ? `${amount} Volts` : 'Volts';
    addAlert(`${escapeHtml(name)} sent ${amountLabel}!`, 'volts');

    pushMessage({
        chatname: escapeHtml(name),
        chatbadges: [],
        backgroundColor: '',
        textColor: '',
        nameColor: '',
        chatmessage: data.message ? (textOnlyMode ? String(data.message) : escapeHtml(data.message)) : '',
        chatimg: '',
        hasDonation: amountLabel,
        membership: '',
        contentimg: '',
        textonly: textOnlyMode,
        type: 'velora',
        event: 'volts'
    });
}

function handleRaid(data) {
    if (!data) return;
    const textOnlyMode = isTextOnlyMode();
    const name = userDisplayName(data.from) || userDisplayName(data.raider) || data.fromDisplayName || data.fromUsername || data.displayName || data.username || 'Someone';
    const viewers = data.viewerCount ?? data.viewers ?? data.viewer_count ?? '';
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
        textonly: textOnlyMode,
        type: 'velora',
        event: 'raid'
    });
}

function handleChannelPoints(data) {
    if (!data) return;
    const textOnlyMode = isTextOnlyMode();
    const name = userDisplayName(data.redeemer) || userDisplayName(data.user) || data.displayName || data.username || 'Someone';
    const reward = data.rewardTitle || data.rewardName || data.itemName || data.reward?.title || data.reward?.name || data.item?.title || data.item?.name || 'channel point reward';
    const message = data.userInput || data.user_input || data.message || data.input || data.text || '';
    addAlert(`${escapeHtml(name)} redeemed: ${escapeHtml(reward)}`, 'points');

    pushMessage({
        chatname: escapeHtml(name),
        chatbadges: [],
        backgroundColor: '',
        textColor: '',
        nameColor: '',
        chatmessage: message ? (textOnlyMode ? String(message) : escapeHtml(message)) : (textOnlyMode ? String(reward) : escapeHtml(reward)),
        chatimg: '',
        hasDonation: '',
        membership: '',
        contentimg: '',
        textonly: textOnlyMode,
        type: 'velora',
        event: 'channel_points',
        meta: {
            rewardTitle: reward,
            rewardCost: data.rewardCost || data.reward_cost || data.cost || data.points || data.reward?.cost || data.item?.cost || '',
            redemptionId: data.redemptionId || data.redemption_id || data.id || ''
        }
    });
}

// ─── Chat sending ─────────────────────────────────────────────────────────────

async function sendChatMessage() {
    if (!els.chatMessage) return;
    const text = els.chatMessage.value.trim();
    if (!text) return;
    if (!isAccountReady()) {
        setChatStatus('Sign in with the matching source account first.', true);
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
        els.sendChat.disabled = !isAccountReady();
    }
}

async function sendChatBridgeMessage(text) {
    text = String(text || '').trim();
    if (!text) {
        return false;
    }
    if (!isAccountReady()) {
        throw new Error('Velora account does not match this source.');
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
    relayToApp({ message: data }, function (e) {});
}

function notifyBridgeStatus() {
    const connected = Boolean(
        typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id
    );
    if (els.bridgeState) {
        els.bridgeState.hidden = !connected;
        els.bridgeState.textContent = connected ? 'Extension connected' : '';
        els.bridgeState.className = connected ? 'status-chip ok' : '';
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

// The SEND_MESSAGE bridge is only used by the SSApp/Electron preload-mock, which posts a
// { __ssappSendToTab: { type: 'SEND_MESSAGE', message } } payload to this same window and origin
// (the normal extension path uses chrome.runtime, handled separately). Require a trusted same-window,
// same-origin source so a cross-origin window — notably the OAuth popup we open, via window.opener —
// can't post chat as the signed-in user. Mirrors isTrustedTabBridgeEvent in the other websocket sources.
function isTrustedTabBridgeEvent(event) {
    if (!event || event.source !== window) {
        return false;
    }
    if (event.origin && typeof window !== 'undefined' && window.location && event.origin !== window.location.origin) {
        return false;
    }
    return true;
}

function wirePostMessageBridge() {
    window.addEventListener('message', function (event) {
        const expectedOrigin = getExpectedAuthMessageOrigin();
        if (expectedOrigin && event.origin === expectedOrigin) {
            Promise.resolve(handleAuthPayload(event.data)).then(function (handled) {
                if (!handled) return;
                if (state.authPopup && !state.authPopup.closed) {
                    try {
                        state.authPopup.close();
                    } catch (e) {}
                }
                state.authPopup = null;
            }).catch(function () {});
            return;
        }
        if (!isTrustedTabBridgeEvent(event)) {
            return;
        }
        let request = event && event.data;
        if (!request || typeof request !== 'object' || !request.__ssappSendToTab) {
            return;
        }
        request = request.__ssappSendToTab;
        if (request.type === 'SEND_MESSAGE' && typeof request.message === 'string') {
            sendChatBridgeMessage(request.message).catch(function () {});
        }
    });
}

function wireAuthStorageBridge() {
    window.addEventListener('storage', function (event) {
        if (!event || event.key !== TOKEN_KEY) {
            return;
        }
        if (!event.newValue) {
            disconnectSocket();
            stopChatHistoryPoll();
            clearAuthState();
            updateViewerCount(null);
            updateAuthUI();
            return;
        }
        completeStoredAuthHandoff();
    });
}

// ─── UI updates ───────────────────────────────────────────────────────────────

function updateAuthUI() {
    const authed = hasUsableToken();
    const actualChannel = getAuthedChannelName();
    const channelMismatch = hasChannelMismatch();
    const accountReady = isAccountReady();
    const profileFailed = state.profileStatus === 'error' || state.profileStatus === 'auth-error';

    if (!accountReady) {
        disconnectSocketTransport();
        disconnectSseTransport();
        stopViewerPoll();
        stopChatHistoryPoll();
        resetEventConnectionState();
    }

    if (els.authState) {
        if (state.authInProgress) {
            els.authState.textContent = 'Finish signing in to Velora.';
        } else if (state.profileStatus === 'verifying') {
            els.authState.textContent = 'Verifying Velora account.';
        } else if (actualChannel) {
            els.authState.textContent = `Signed in as @${actualChannel}`;
        } else {
            els.authState.textContent = 'Not signed in';
        }
    }
    if (els.startAuth) {
        els.startAuth.hidden = authed && state.profileStatus !== 'auth-error';
        els.startAuth.disabled = state.authInProgress;
        els.startAuth.textContent = state.authInProgress ? 'Waiting for Velora…' :
            (state.profileStatus === 'auth-error' ? 'Sign in again' : 'Sign in with Velora');
    }
    if (els.signOut) {
        els.signOut.hidden = !state.tokens?.access_token;
    }
    if (els.setupNotice) {
        els.setupNotice.hidden = authed && state.profileStatus !== 'auth-error';
    }
    if (els.channelLabel) {
        const channel = state.requestedChannel || actualChannel || '';
        els.channelLabel.querySelector('strong span').textContent = channel || '-';
    }
    if (els.signedInAccount) {
        els.signedInAccount.textContent = actualChannel ? `@${actualChannel}` :
            (authed ? 'Verifying…' : 'Not signed in');
    }
    if (els.setupHeading) {
        els.setupHeading.textContent = state.authInProgress ? 'Finish signing in to Velora' :
            (state.profileStatus === 'auth-error' ? 'Sign in to Velora again' : 'Sign in to Velora');
    }
    if (els.setupCopy) {
        els.setupCopy.textContent = state.authInProgress
            ? 'Complete sign-in in the separate Velora sign-in window. It should close automatically. Keep this Social Stream setup window open until it says Connected.'
            : (state.profileStatus === 'auth-error'
                ? (state.profileError || 'Your Velora sign-in expired. Sign in again.')
                : state.requestedChannel
                ? `This source is set up for @${state.requestedChannel}. Sign in to that Velora account.`
                : 'Sign in with the Velora account whose chat and alerts you want to capture.');
    }
    if (els.mismatchNotice) {
        els.mismatchNotice.hidden = !channelMismatch;
    }
    if (els.mismatchCopy && channelMismatch) {
        els.mismatchCopy.textContent = `This source is set up for @${state.requestedChannel}, but you’re signed in as @${actualChannel}. Nothing is being captured until they match. If @${state.requestedChannel} is correct, sign out here, then sign in with that account. If Velora automatically returns to @${actualChannel}, sign out in the separate Velora sign-in window first. If @${actualChannel} is correct, close this source and add it again as @${actualChannel} in Social Stream.`;
    }
    if (els.switchAccount && channelMismatch) {
        els.switchAccount.textContent = 'Sign out of this Velora account';
    }
    if (els.profileErrorNotice) {
        els.profileErrorNotice.hidden = channelMismatch || (!state.authError && state.profileStatus !== 'error' && !(accountReady && state.socketStatus === 'error'));
    }
    if (els.profileErrorCopy) {
        els.profileErrorCopy.textContent = state.authError || state.profileError || state.connectionError || 'Check your connection, then try again.';
    }
    if (els.connectedActions) {
        els.connectedActions.hidden = !state.tokens?.access_token || state.authInProgress || channelMismatch;
    }
    if (els.dashboard) {
        els.dashboard.hidden = !accountReady;
    }
    if (els.chatMessage) {
        els.chatMessage.disabled = !accountReady;
    }
    if (els.sendChat) {
        els.sendChat.disabled = !accountReady;
    }
    if (els.chatMessageLabel) {
        els.chatMessageLabel.textContent = actualChannel ? `Send a message as @${actualChannel}` : 'Send a message';
    }

    if (channelMismatch) {
        renderConnectionState('mismatch', 'Account doesn’t match this source');
        notifyAppStatus('error', 'Velora account does not match this source.', {
            code: 'velora_account_mismatch',
            requestedChannel: state.requestedChannel,
            authenticatedChannel: actualChannel
        });
    } else if (state.authInProgress) {
        renderConnectionState('connecting', 'Finish signing in to Velora');
    } else if (state.profileStatus === 'verifying') {
        renderConnectionState('connecting', 'Verifying Velora account…');
    } else if (authed && state.profileStatus === 'unverified') {
        renderConnectionState('connecting', 'Verifying Velora account…');
    } else if (profileFailed) {
        renderConnectionState('error', state.profileError || 'We couldn’t verify your Velora account');
        notifyAppStatus('error', state.profileError || 'Velora account verification failed.');
    } else if (state.authError) {
        renderConnectionState('error', state.authError);
        notifyAppStatus('error', state.authError);
    } else if (state.connectionError && state.socketStatus !== 'error') {
        renderConnectionState('connecting', state.connectionError);
    } else if (!accountReady) {
        renderConnectionState('disconnected', 'Sign in to connect');
    }
}

function renderConnectionState(status, text) {
    if (!els.socketState) return;
    els.socketState.textContent = text;
    els.socketState.className = `connection-state ${status}`;
}

function setAuthStatus(msg, level) {
    if (els.authState) {
        els.authState.textContent = msg;
        els.authState.className = 'sr-only';
    }
}

function setSocketStatus(status, appMessage, detail) {
    state.socketStatus = status;
    state.connectionError = status === 'error' ? (appMessage || 'Velora connection error.') : '';
    const labels = {
        connected: getAuthedChannelName() ? `Connected — syncing @${getAuthedChannelName()}` : 'Connected',
        connecting: 'Connecting to Velora…',
        disconnected: hasUsableToken() ? 'Connection interrupted' : 'Sign in to connect',
        error: 'Velora needs attention'
    };
    renderConnectionState(status, labels[status] || status);
    notifyAppStatus(status, appMessage || labels[status] || status, detail || {});
    updateAuthUI();
}

function updateViewerCount(count, unavailableLabel) {
    if (!els.viewerCount) return;
    if (count === null || count === undefined) {
        els.viewerCount.textContent = unavailableLabel || 'Viewers unavailable';
        els.viewerCount.className = 'status-chip neutral';
    } else {
        els.viewerCount.textContent = `Viewers: ${Number(count).toLocaleString()}`;
        els.viewerCount.className = 'status-chip ok';
        try {
            relayToApp({
                message: { type: 'velora', event: 'viewer_update', meta: count }
            }, function (e) {});
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

function addChatFeedMessage(name, messageHtml, badges, isMod, isVip, isSubscriber, color) {
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
    textSpan.className = 'chat-msg-text';
    textSpan.innerHTML = messageHtml || '';
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
        setupNotice: q('setup-notice'),
        setupHeading: q('setup-heading'),
        setupCopy: q('setup-copy'),
        redirectUriHint: q('redirect-uri-hint'),
        startAuth: q('start-auth'),
        signOut: q('sign-out'),
        switchAccount: q('switch-account'),
        retryConnection: q('retry-connection'),
        authState: q('auth-state'),
        channelLabel: q('channel-label'),
        signedInAccount: q('signed-in-account'),
        viewerCount: q('viewer-count'),
        hideMetrics: q('hide-metrics'),
        socketState: q('socket-state'),
        bridgeState: q('bridge-state'),
        chatFeed: q('chat-feed'),
        chatMessage: q('chat-message'),
        chatMessageLabel: q('chat-message-label'),
        sendChat: q('send-chat'),
        chatStatus: q('chat-status'),
        eventLog: q('event-log'),
        alertsFeed: q('alerts-feed'),
        mismatchNotice: q('mismatch-notice'),
        mismatchCopy: q('mismatch-copy'),
        profileErrorNotice: q('profile-error-notice'),
        profileErrorCopy: q('profile-error-copy'),
        connectedActions: q('connected-actions'),
        dashboard: q('dashboard')
    });
}

function signOutVelora() {
    disconnectSocket();
    stopChatHistoryPoll();
    clearAuthHandoffWatcher();
    clearAuthState();
    updateViewerCount(null);
    updateAuthUI();
}

async function retryVeloraConnection() {
    if (state.profileStatus === 'auth-error') {
        clearAuthState();
        updateAuthUI();
        startAuthFlow();
        return;
    }
    if (!state.tokens?.access_token || isTokenExpired()) {
        startAuthFlow();
        return;
    }
    state.connectionError = '';
    const verified = await loadUserProfile();
    updateAuthUI();
    if (verified && isAccountReady()) {
        connectSocket();
    }
}

function bindEvents() {
    if (els.startAuth) {
        els.startAuth.addEventListener('click', startAuthFlow);
    }

    if (els.signOut) {
        els.signOut.addEventListener('click', signOutVelora);
    }

    if (els.switchAccount) {
        els.switchAccount.addEventListener('click', signOutVelora);
    }

    if (els.retryConnection) {
        els.retryConnection.addEventListener('click', retryVeloraConnection);
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

    if (els.hideMetrics) {
        els.hideMetrics.addEventListener('change', () => {
            state.hideMetrics = !!els.hideMetrics.checked;
            applyMetricsVisibility();
            persistConfig();
        });
    }
}

try {
    window.__SSAPP_START_VELORA_AUTH__ = startExternalAuthFlow;
} catch (e) {}

async function init() {
    enableBackgroundKeepAlive();
    initElements();

    state.requestedChannel = getRequestedChannel();
    loadConfig();
    applyRuntimeOverrides();
    loadTokens();
    if (els.hideMetrics) {
        els.hideMetrics.checked = !!state.hideMetrics;
    }
    applyMetricsVisibility();

    if (els.redirectUriHint) {
        els.redirectUriHint.textContent = getRedirectUri();
    }

    bindEvents();
    wireExtensionBridge();
    wirePostMessageBridge();
    wireAuthStorageBridge();
    notifyBridgeStatus();
    updateAuthUI();

    // Handle OAuth redirect callback
    const wasCallback = await handleAuthCallback();

    // If already authenticated (stored tokens, not a fresh callback), connect
    if (!wasCallback && state.tokens?.access_token && !isTokenExpired()) {
        scheduleTokenRefresh();
        const verified = await loadUserProfile();
        updateAuthUI();
        if (verified && isAccountReady()) {
            connectSocket();
        }
    } else if (!wasCallback && state.tokens?.access_token && isTokenExpired()) {
        if (await refreshAccessToken()) {
            await resumeAfterTokenRefresh();
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}

})();
