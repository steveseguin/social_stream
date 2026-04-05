const KICK_CORE_EXTENSION_PATH = 'providers/kick/core.js';
const KICK_CORE_RELATIVE_PATH = '../../providers/kick/core.js';

let normalizeChannel;
let normalizeImage;
let formatBadgesForDisplay;
let getProfileCacheEntry;
let storeProfileCacheEntry;
let mergeBadges;
let mergeProfileDetails;
let mapBadges;
let eventNameForType;

// Fallback implementations when providers/kick/core.js fails to load.
// These mirror the core.js exports to ensure kick.js works standalone.
function applyKickCoreFallbacks() {
    if (typeof normalizeChannel !== 'function') {
        normalizeChannel = (value) => {
            if (!value) return '';
            return String(value).trim().replace(/^@+/, '').toLowerCase();
        };
    }
    if (typeof normalizeImage !== 'function') {
        normalizeImage = (value) => (value ? String(value) : '');
    }
    if (typeof formatBadgesForDisplay !== 'function') {
        formatBadgesForDisplay = (badges) => Array.isArray(badges) ? badges : [];
    }
    if (typeof getProfileCacheEntry !== 'function') {
        getProfileCacheEntry = () => null;
    }
    if (typeof storeProfileCacheEntry !== 'function') {
        storeProfileCacheEntry = () => {};
    }
    if (typeof mergeBadges !== 'function') {
        mergeBadges = (primary, secondary) => {
            const a = Array.isArray(primary) ? primary : [];
            const b = Array.isArray(secondary) ? secondary : [];
            return a.concat(b);
        };
    }
    if (typeof mergeProfileDetails !== 'function') {
        mergeProfileDetails = (base, extra) => ({
            ...(base && typeof base === 'object' ? base : {}),
            ...(extra && typeof extra === 'object' ? extra : {})
        });
    }
    if (typeof mapBadges !== 'function') {
        mapBadges = (badges) => Array.isArray(badges) ? badges : [];
    }
    if (typeof eventNameForType !== 'function') {
        eventNameForType = (type) => {
            if (!type) return 'message';
            const lower = String(type).toLowerCase();
            if (lower === 'chat' || lower === 'message' || lower === 'chatroom_message') {
                return 'message';
            }
            if (lower.includes('gift')) {
                return 'subscription_gift';
            }
            if (lower.includes('tip') || lower.includes('donation')) {
                return 'donation';
            }
            if (lower.includes('sub')) {
                return 'new_subscriber';
            }
            if (lower.includes('ban') || lower.includes('moderation')) {
                return 'moderation';
            }
            return lower;
        };
    }
}

async function importWithFallback(extensionPath, relativePath) {
    if (
        typeof chrome !== 'undefined' &&
        chrome?.runtime &&
        typeof chrome.runtime.getURL === 'function'
    ) {
        try {
            const specifier = chrome.runtime.getURL(extensionPath);
            // Only try import if the URL has a valid scheme (http, https, file, chrome-extension)
            if (specifier && /^(https?|file|chrome-extension):/.test(specifier)) {
                return await import(specifier);
            }
        } catch (error) {
            console.warn(`Failed to import ${extensionPath} via chrome.runtime.getURL`, error);
        }
    }
    return import(relativePath);
}

const kickCoreReady = (async () => {
    const kickModule = await importWithFallback(KICK_CORE_EXTENSION_PATH, KICK_CORE_RELATIVE_PATH);
    ({
        normalizeChannel,
        normalizeImage,
        formatBadgesForDisplay,
        getProfileCacheEntry,
        storeProfileCacheEntry,
        mergeBadges,
        mergeProfileDetails,
        mapBadges,
        eventNameForType
    } = kickModule);
})();

kickCoreReady.catch((error) => {
    console.error('Failed to load Kick shared core module', error);
    applyKickCoreFallbacks();
});

try {
    console.log('[KickWs] kick.js loaded.');
} catch (_) {}

const STORAGE_KEY = 'kickApiConfig';
const TOKEN_KEY = 'kickApiTokens';
const CODE_VERIFIER_KEY = 'kickPkceVerifier';
const STATE_KEY = 'kickOAuthState';
const KICK_SCOUT_TOKEN_STORAGE_KEY = 'kickScoutBridgeToken';
const KICK_ADVANCED_CONTROLS_STORAGE_KEY = 'kickAdvancedControls';

const DEFAULT_CONFIG = {
    clientId: '01KDYJ7WYZB2NMHZBE4ZZX61XR',
    bridgeUrl: 'https://kick-bridge.socialstream.ninja/events'
};

const PUSHER_KEY = '32cbd69e4b950bf97679';
const PUSHER_WS_BASE = 'wss://ws-us2.pusher.com';
const PUSHER_RECONNECT_DELAY_MS = 5000;
const PUSHER_PING_INTERVAL_MS = 45000;

const SUBSCRIPTION_RETRY_DELAY_MS = 10000;
const CHAT_FEED_LIMIT = 100;
const ALERT_FEED_LIMIT = 100;
const EVENT_LOG_LIMIT = 100;
const CHAT_SCROLL_THRESHOLD_PX = 48;
const AVATAR_LOOKUP_TIMEOUT_MS = 650;
const SOCKET_CHAT_ACTIVITY_WINDOW_MS = 45000;
const PROFILE_CACHE_STORAGE_KEY = 'kickProfileCache';
const PROFILE_CACHE_STORAGE_VERSION = 2;
const PROFILE_CACHE_SAVE_DEBOUNCE_MS = 1500;
const PROFILE_CACHE_MAX_ENTRIES = 1200;
const PROFILE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const KICK_WINDOW_BOUNDS_STORAGE_KEY = 'kickWindowBounds';
const KICK_WINDOW_BOUNDS_SAVE_DEBOUNCE_MS = 250;

const state = {
    clientId: '',
    redirectUri: '',
    channelSlug: '',
    channelSlugSource: '',
    channelId: null,
    channelName: '',
    lastResolvedSlug: '',
    bridgeUrl: '',
    customEvents: '',
    tokens: null,
    refreshTimer: null,
    refreshPromise: null,
    authUser: null,
    profilePromise: null,
    profileCache: new Map(),
    profileFetches: new Map(),
    eventTypesUnavailable: false,
    autoStart: {
        running: false,
        lastSlug: '',
        pendingForce: false
    },
    subscriptionRetry: {
        timer: null,
        delayMs: SUBSCRIPTION_RETRY_DELAY_MS
    },
    bridge: {
        source: null,
        retryTimer: null,
        status: 'disconnected',
        lastErrorLoggedAt: 0,
        chatDisabled: false,
        chatroomCacheWriteDisabled: false
    },
    socket: {
        status: 'disconnected',
        connectionId: null,
        chatroomId: null,
        channelId: null,
        userId: null,
        lastChatEventAt: 0,
        siteApiBase: '',
        siteApiProxyBase: '',
        allowProxy: true,
        lastError: '',
        connecting: false,
        pusherWs: null,
        pusherStatus: 'disconnected',
        pusherPingTimer: null,
        pusherReconnectTimer: null
    },
    chat: {
        sending: false,
        type: 'user'
    },
    advancedControls: {
        syncDeleteMessages: false,
        syncBlockUsers: false
    }
};

const els = {};
const EVENT_TYPES_CACHE_KEY = 'kickEventTypesCache';
const EVENT_TYPES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const EVENT_TYPES_UNAVAILABLE_COOLDOWN_MS = 60 * 60 * 1000;

let cachedEventTypes = null;
let cachedEventTypesFetchedAt = 0;
let eventTypesUnavailableUntil = 0;
let preferredKickChannelLookupPath = '';
let profileCachePersistTimer = null;
let kickWindowBoundsSaveTimer = null;

// Queue for events that arrive before channelId is resolved
const pendingBridgeEvents = [];
const MAX_PENDING_EVENTS = 50;

function getTabId() {
    return typeof window !== 'undefined' && typeof window.__SSAPP_TAB_ID__ !== 'undefined'
        ? window.__SSAPP_TAB_ID__
        : null;
}

const extension = {
    get available() {
        return typeof chrome !== 'undefined' && !!(chrome && chrome.runtime && chrome.runtime.id);
    },
    enabled: true,
    settings: {},
    get tabId() {
        return getTabId();
    }
};

const WSS_PLATFORM = 'kick';
const KICK_VIEWER_HEARTBEAT_INTERVAL_MS = 30000;
const KICK_VIEWER_DISCONNECT_EMIT_DEBOUNCE_MS = 1500;
const KICK_CHAT_ECHO_TIMEOUT_MS = 10000;
const KICK_CHAT_ECHO_STALE_MS = 60000;
let extensionInitialized = false;
let lastBridgeNotifyStatus = null;
let lastAuthNotifyStatus = null;
let lastSocketNotifyStatus = null;
let socketBridgeInitialized = false;
let kickWsEventLogCount = 0;
let kickWsLastEventLogAt = 0;
const ignoredEventTypesLogged = new Set();
const kickViewerHeartbeat = {
    intervalId: null,
    pollInFlight: false,
    lastKnownCount: 0,
    hasKnownCount: false,
    hadConnectedTransport: false,
    isLive: null,
    lastSentAt: 0,
    lastPollErrorAt: 0,
    attemptSeq: 0,
    lastAttemptAt: 0,
    lastSuccessAt: 0
};
let pendingKickChatEchoSeq = 0;
const pendingKickChatEchoes = [];

const LITE_MESSAGE_PREFIX = 'kick-lite-';
let liteBridgeCoreReady = false;
let liteMessageQueue = [];

kickCoreReady
    .then(() => {
        liteBridgeCoreReady = true;
        if (liteMessageQueue.length) {
            const queue = liteMessageQueue;
            liteMessageQueue = [];
            queue.forEach((evt) => processLiteMessage(evt));
        }
    })
    .catch((error) => {
        liteBridgeCoreReady = true;
        liteMessageQueue = [];
        console.error('Kick core module failed to load for lite bridge', error);
    });

function isLiteEmbedded() {
    if (typeof window === 'undefined') {
        return false;
    }
    return window.parent && window.parent !== window;
}

function readStoredKickWindowBounds() {
    if (typeof window === 'undefined' || isLiteEmbedded()) {
        return null;
    }
    try {
        const raw = localStorage.getItem(KICK_WINDOW_BOUNDS_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        const width = Number(parsed?.width);
        const height = Number(parsed?.height);
        if (!Number.isFinite(width) || !Number.isFinite(height)) {
            return null;
        }
        return { width, height };
    } catch (error) {
        console.warn('Failed to load Kick window bounds', error);
        return null;
    }
}

function getKickStandaloneWindowBounds() {
    if (typeof window === 'undefined' || isLiteEmbedded()) {
        return null;
    }
    const width = Number(window.outerWidth);
    const height = Number(window.outerHeight);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
    }
    return {
        width: Math.round(width),
        height: Math.round(height)
    };
}

function persistKickWindowBounds() {
    const bounds = getKickStandaloneWindowBounds();
    if (!bounds) {
        return;
    }
    try {
        localStorage.setItem(KICK_WINDOW_BOUNDS_STORAGE_KEY, JSON.stringify(bounds));
    } catch (error) {
        console.warn('Failed to save Kick window bounds', error);
    }
}

function scheduleKickWindowBoundsSave() {
    if (typeof window === 'undefined' || isLiteEmbedded()) {
        return;
    }
    if (kickWindowBoundsSaveTimer) {
        clearTimeout(kickWindowBoundsSaveTimer);
    }
    kickWindowBoundsSaveTimer = setTimeout(() => {
        kickWindowBoundsSaveTimer = null;
        persistKickWindowBounds();
    }, KICK_WINDOW_BOUNDS_SAVE_DEBOUNCE_MS);
}

function restoreKickWindowBounds() {
    if (typeof window === 'undefined' || isLiteEmbedded()) {
        return;
    }
    const bounds = readStoredKickWindowBounds();
    if (!bounds) {
        return;
    }
    const screenWidth = Number(window.screen?.availWidth || window.screen?.width || 0) || 0;
    const screenHeight = Number(window.screen?.availHeight || window.screen?.height || 0) || 0;
    const widthLimit = screenWidth > 0 ? screenWidth : bounds.width;
    const heightLimit = screenHeight > 0 ? screenHeight : bounds.height;
    const nextWidth = Math.max(520, Math.min(widthLimit, Math.round(bounds.width)));
    const nextHeight = Math.max(520, Math.min(heightLimit, Math.round(bounds.height)));
    try {
        window.resizeTo(nextWidth, nextHeight);
    } catch (error) {
        console.warn('Unable to restore Kick window size', error);
    }
}

function sendLiteMessage(type, payload = {}, targetWindow = null, targetOrigin = null) {
    if (typeof window === 'undefined') {
        return;
    }
    const recipient = targetWindow || (isLiteEmbedded() ? window.parent : null);
    if (!recipient) {
        return;
    }
    try {
        const message = { ...payload, type };
        const origin = targetOrigin || (typeof window.location !== 'undefined' ? window.location.origin : '*');
        recipient.postMessage(message, origin);
    } catch (err) {
        console.warn('Failed to send Kick Lite message', err);
    }
}

function getLiteStatusSnapshot() {
    return {
        channel: state.channelSlug || '',
        channelId: state.channelId,
        bridgeStatus: state.bridge?.status || 'disconnected',
        authenticated: Boolean(state.tokens?.access_token) && !isTokenExpired(),
        hasTokens: Boolean(state.tokens?.access_token),
        expiresAt: state.tokens?.expires_at || null,
        lastSlug: state.autoStart?.lastSlug || ''
    };
}

function normalizeKickChatType(value) {
    if (typeof value !== 'string') {
        return 'user';
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'bot' || normalized === 'userbot') {
        return 'bot';
    }
    return 'user';
}

function notifyLiteStatus(reason) {
    if (!isLiteEmbedded()) return;
    sendLiteMessage('kick-lite-status', { status: getLiteStatusSnapshot(), reason });
}

function applyLiteConfig(message) {
    if (!message || typeof message !== 'object') {
        return;
    }
    let changed = false;
    if (typeof message.clientId === 'string' && message.clientId.trim()) {
        const next = message.clientId.trim();
        if (next !== state.clientId) {
            state.clientId = next;
            changed = true;
        }
    }
    if (typeof message.redirectUri === 'string' && message.redirectUri.trim()) {
        const next = message.redirectUri.trim();
        if (next !== state.redirectUri) {
            state.redirectUri = next;
            changed = true;
        }
    }
    if (typeof message.bridgeUrl === 'string' && message.bridgeUrl.trim()) {
        const next = message.bridgeUrl.trim();
        if (next !== state.bridgeUrl) {
            state.bridgeUrl = next;
            changed = true;
        }
    }
    if (typeof message.chatType === 'string' && message.chatType.trim()) {
        const next = normalizeKickChatType(message.chatType);
        if (next !== state.chat.type) {
            state.chat.type = next;
            changed = true;
        }
    }
    if (changed) {
        persistConfig();
        updateInputsFromState();
        notifyLiteStatus('config');
    }
}

function processLiteMessage(event) {
    if (
        !event ||
        !event.data ||
        typeof event.data !== 'object' ||
        typeof event.data.type !== 'string' ||
        !event.data.type.startsWith(LITE_MESSAGE_PREFIX)
    ) {
        return;
    }
    if (event.origin && typeof window !== 'undefined' && window.location && event.origin !== window.location.origin) {
        return;
    }
    const { type } = event.data;
    switch (type) {
        case 'kick-lite-handshake': {
            sendLiteMessage('kick-lite-ready', { status: getLiteStatusSnapshot() }, event.source, event.origin || '*');
            break;
        }
        case 'kick-lite-set-config': {
            applyLiteConfig(event.data);
            break;
        }
        case 'kick-lite-set-channel': {
            const slug = event.data.slug || event.data.channel;
            if (slug) {
                setChannelSlug(slug, { source: 'lite', force: event.data.force === true });
                notifyLiteStatus('channel');
            }
            break;
        }
        case 'kick-lite-connect': {
            maybeAutoStart(true);
            notifyLiteStatus('connect');
            break;
        }
        case 'kick-lite-disconnect': {
            disconnectBridge();
            notifyLiteStatus('disconnect');
            break;
        }
        case 'kick-lite-get-status': {
            sendLiteMessage('kick-lite-status', { status: getLiteStatusSnapshot() }, event.source, event.origin || '*');
            break;
        }
        default:
            break;
    }
}

function handleLiteMessage(event) {
    if (
        !event ||
        !event.data ||
        typeof event.data !== 'object' ||
        typeof event.data.type !== 'string' ||
        !event.data.type.startsWith(LITE_MESSAGE_PREFIX)
    ) {
        return;
    }
    const messageType = event.data.type;
    const requiresCore =
        messageType !== 'kick-lite-handshake' && messageType !== 'kick-lite-get-status';
    if (!liteBridgeCoreReady && requiresCore) {
        liteMessageQueue.push(event);
        return;
    }
    processLiteMessage(event);
}

if (typeof window !== 'undefined') {
    window.addEventListener('message', handleLiteMessage, false);
}

let settings = {};
let EMOTELIST = false;
let BTTV = false;
let SEVENTV = false;
let FFZ = false;
let lastEmoteRequestKey = null;

function isSettingEnabled(key) {
    const value = settings ? settings[key] : undefined;
    if (typeof value === 'boolean') {
        return value;
    }
    if (value && typeof value === 'object') {
        if (typeof value.setting === 'boolean') {
            return value.setting;
        }
        if (typeof value.enabled === 'boolean') {
            return value.enabled;
        }
        if (typeof value.value === 'boolean') {
            return value.value;
        }
    }
    return Boolean(value);
}

function isTextOnlyMode() {
    const setting = extension.settings && extension.settings.textonlymode;
    if (setting && typeof setting === 'object') {
        return setting.setting === true;
    }
    return setting === true;
}

function resetThirdPartyEmoteCache() {
    BTTV = false;
    SEVENTV = false;
    FFZ = false;
    EMOTELIST = false;
    lastEmoteRequestKey = null;
}

function escapeAttribute(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function delay(ms, value = undefined) {
    return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

function resolveProfileIdentifiers(...sources) {
    let userId = null;
    let username = null;
    for (const source of sources) {
        if (!source || typeof source !== 'object') {
            continue;
        }
        if (!userId) {
            const idCandidates = [
                source.user?.id,
                source.user?.user_id,
                source.profile?.id,
                source.account?.id,
                source.identity?.id,
                source.id,
                source.user_id,
                source.userId,
                source.sub,
                source.channel?.id
            ];
            for (const candidate of idCandidates) {
                if (candidate == null) {
                    continue;
                }
                const str = String(candidate).trim();
                if (str) {
                    userId = str;
                    break;
                }
            }
        }
        if (!username) {
            const usernameCandidates = [
                source.username,
                source.user_login,
                source.userLogin,
                source.slug,
                source.display_name,
                source.displayName,
                source.name,
                source.channelSlug,
                source.login,
                source.user?.slug,
                source.user?.username,
                source.user?.display_name,
                source.channel?.slug,
                source.channel?.username,
                source.profile?.username,
                source.profile?.slug,
                source.account?.username
            ];
            for (const candidate of usernameCandidates) {
                if (typeof candidate === 'string') {
                    const normalized = normalizeChannel(candidate);
                    if (normalized) {
                        username = normalized;
                        break;
                    }
                }
            }
        }
        if (userId && username) {
            break;
        }
    }
    if (!userId && !username) {
        return null;
    }
    return { userId, username };
}

function getCachedProfile(ids, options = {}) {
    if (!ids) {
        return undefined;
    }
    if (ids.username) {
        const byUsername = getProfileCacheEntry(state.profileCache, { username: ids.username }, options);
        if (byUsername !== undefined) {
            return byUsername;
        }
    }
    return getProfileCacheEntry(state.profileCache, ids, options);
}

function serializeKickProfileCacheEntries() {
    const now = Date.now();
    const entries = [];
    state.profileCache.forEach((entry, key) => {
        if (!key || typeof key !== 'string') {
            return;
        }
        if (!entry || typeof entry !== 'object') {
            return;
        }
        const timestamp = Number(entry.timestamp);
        if (!Number.isFinite(timestamp)) {
            return;
        }
        if (now - timestamp > PROFILE_CACHE_MAX_AGE_MS) {
            return;
        }
        const hasProfile = entry.hasProfile === true && entry.profile && typeof entry.profile === 'object';
        entries.push([
            key,
            {
                timestamp,
                hasProfile,
                profile: hasProfile ? entry.profile : null
            }
        ]);
    });
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    if (entries.length > PROFILE_CACHE_MAX_ENTRIES) {
        return entries.slice(entries.length - PROFILE_CACHE_MAX_ENTRIES);
    }
    return entries;
}

function persistKickProfileCache() {
    try {
        const payload = {
            version: PROFILE_CACHE_STORAGE_VERSION,
            savedAt: Date.now(),
            entries: serializeKickProfileCacheEntries()
        };
        localStorage.setItem(PROFILE_CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[KickWs] Failed to persist profile cache.', error);
    }
}

function scheduleKickProfileCachePersist() {
    if (profileCachePersistTimer) {
        clearTimeout(profileCachePersistTimer);
    }
    profileCachePersistTimer = setTimeout(() => {
        profileCachePersistTimer = null;
        persistKickProfileCache();
    }, PROFILE_CACHE_SAVE_DEBOUNCE_MS);
}

function loadKickProfileCache() {
    try {
        const raw = localStorage.getItem(PROFILE_CACHE_STORAGE_KEY);
        if (!raw) {
            return;
        }
        const parsed = JSON.parse(raw);
        if (
            parsed &&
            typeof parsed === 'object' &&
            Object.prototype.hasOwnProperty.call(parsed, 'version') &&
            parsed.version !== PROFILE_CACHE_STORAGE_VERSION
        ) {
            localStorage.removeItem(PROFILE_CACHE_STORAGE_KEY);
            return;
        }
        const entries = Array.isArray(parsed?.entries)
            ? parsed.entries
            : (Array.isArray(parsed) ? parsed : []);
        if (!entries.length) {
            return;
        }
        const now = Date.now();
        let loaded = 0;
        entries.forEach((entry) => {
            if (!Array.isArray(entry) || entry.length < 2) {
                return;
            }
            const key = entry[0];
            const value = entry[1];
            if (typeof key !== 'string' || !value || typeof value !== 'object') {
                return;
            }
            const timestamp = Number(value.timestamp);
            if (!Number.isFinite(timestamp)) {
                return;
            }
            if (now - timestamp > PROFILE_CACHE_MAX_AGE_MS) {
                return;
            }
            const hasProfile = value.hasProfile === true && value.profile && typeof value.profile === 'object';
            state.profileCache.set(key, {
                profile: hasProfile ? value.profile : null,
                hasProfile,
                timestamp
            });
            loaded += 1;
        });
        while (state.profileCache.size > PROFILE_CACHE_MAX_ENTRIES) {
            const oldestKey = state.profileCache.keys().next().value;
            if (oldestKey === undefined) {
                break;
            }
            state.profileCache.delete(oldestKey);
        }
        if (loaded > 0) {
            logKickWs(`Loaded ${loaded} cached Kick profiles from storage.`);
        }
    } catch (error) {
        console.warn('[KickWs] Failed to load profile cache.', error);
    }
}

function rememberProfile(profile, ...sources) {
    if (!profile || typeof profile !== 'object') {
        return;
    }
    const ids = resolveProfileIdentifiers(profile, ...sources);
    if (!ids) {
        return;
    }
    storeProfileCacheEntry(state.profileCache, ids, profile);
    scheduleKickProfileCachePersist();
}

function rememberProfileMiss(...sources) {
    const ids = resolveProfileIdentifiers(...sources);
    if (!ids) {
        return;
    }
    storeProfileCacheEntry(state.profileCache, ids, null);
    scheduleKickProfileCachePersist();
}

function normalizeKickSiteBase(value) {
    if (!value || typeof value !== 'string') return '';
    return value.replace(/\/api\/v2\/?$/i, '').replace(/\/+$/, '');
}

function getKickSiteBase(preferProxy = false) {
    const allowProxy = state.socket?.allowProxy !== false;
    const rawProxy = normalizeKickSiteBase(state.socket?.siteApiProxyBase);
    const rawDirect = normalizeKickSiteBase(state.socket?.siteApiBase);
    if (preferProxy && allowProxy) {
        return rawProxy || 'https://r.jina.ai/http://kick.com';
    }
    return rawDirect || 'https://kick.com';
}

function parseKickProfilePayload(text) {
    if (typeof text !== 'string' || !text.trim()) {
        return null;
    }
    try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.data && typeof parsed.data.content === 'string') {
            const embedded = parsed.data.content.trim();
            if (embedded) {
                return JSON.parse(embedded);
            }
        }
        return parsed;
    } catch (_) {}
    const marker = 'Markdown Content:';
    const idx = text.indexOf(marker);
    if (idx >= 0) {
        const payload = text.slice(idx + marker.length).trim();
        if (payload) {
            try {
                return JSON.parse(payload);
            } catch (_) {}
        }
    }
    return null;
}

function extractKickAvatar(payload) {
    if (!payload || typeof payload !== 'object') {
        return '';
    }
    const candidates = [
        payload.profilepic,
        payload.profile_pic,
        payload.profile_picture,
        payload.profilePicture,
        payload.user?.profilepic,
        payload.user?.profile_pic,
        payload.user?.profile_picture,
        payload.user?.profilePicture
    ];
    return pickFirstString(candidates, '');
}

async function fetchKickProfile(username) {
    const channelSlug = state.channelSlug ? String(state.channelSlug).trim() : '';
    const viewer = username ? String(username).trim() : '';
    if (!channelSlug || !viewer) {
        return null;
    }

    const requestProfile = async (base) => {
        const url = `${base}/channels/${encodeURIComponent(channelSlug)}/${encodeURIComponent(viewer)}`;
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        const text = await response.text();
        if (!response.ok) {
            const error = new Error(`Kick profile lookup ${response.status}: ${text}`);
            error.status = response.status;
            error.body = text;
            throw error;
        }
        return parseKickProfilePayload(text);
    };

    const directBase = getKickSiteBase(false);
    try {
        return await requestProfile(directBase);
    } catch (err) {
        if (state.socket?.allowProxy !== false) {
            const proxyBase = getKickSiteBase(true);
            if (proxyBase && proxyBase !== directBase) {
                return await requestProfile(proxyBase);
            }
        }
        throw err;
    }
}

function updateChatAvatarElement(line, avatarUrl) {
    if (!line || !avatarUrl) {
        return;
    }
    const avatar = line.querySelector('.chat-avatar');
    if (!avatar || avatar.querySelector('img')) {
        return;
    }
    avatar.textContent = '';
    const img = document.createElement('img');
    img.src = avatarUrl;
    const name = line.querySelector('.chat-name')?.textContent || '';
    img.alt = name ? `${name} avatar` : '';
    avatar.appendChild(img);
}

function updateChatFeedAvatar({ messageIds, userId, username }, avatarUrl) {
    if (!els.chatFeed || !avatarUrl) {
        return;
    }
    const normalizedUser = username ? normalizeChannel(username) : '';
    const lines = els.chatFeed.querySelectorAll('.chat-line');
    lines.forEach((line) => {
        if (!line) return;
        const matchesMessage =
            messageIds && messageIds.size && line.dataset.messageId && messageIds.has(line.dataset.messageId);
        const matchesUser =
            !matchesMessage &&
            ((userId && line.dataset.userId === String(userId)) ||
                (normalizedUser && line.dataset.username === normalizedUser));
        if (matchesMessage || matchesUser) {
            updateChatAvatarElement(line, avatarUrl);
        }
    });
}

function queueAvatarLookup(ids, username, messageId) {
    const normalizedUsername = username ? normalizeChannel(username) : '';
    const userKey = normalizedUsername ? `name:${normalizedUsername}` : (ids?.userId ? `id:${ids.userId}` : '');
    if (!userKey || !username) {
        return null;
    }
    const existing = state.profileFetches.get(userKey);
    if (existing) {
        if (messageId) {
            existing.pendingMessageIds.add(String(messageId));
        }
        return existing.promise;
    }

    const pendingMessageIds = new Set();
    if (messageId) {
        pendingMessageIds.add(String(messageId));
    }

    const promise = (async () => {
        const profile = await fetchKickProfile(username);
        const avatarFromChannelProfile = extractKickAvatar(profile);
        if (avatarFromChannelProfile) {
            return normalizeImage(avatarFromChannelProfile);
        }
        return '';
    })()
        .then((resolvedAvatar) => {
            if (resolvedAvatar) {
                rememberProfile({ avatar: resolvedAvatar }, ids, { username });
                updateChatFeedAvatar(
                    { messageIds: pendingMessageIds, userId: ids?.userId, username },
                    resolvedAvatar
                );
                return resolvedAvatar;
            }
            rememberProfileMiss(ids, { username });
            return '';
        })
        .catch(() => {
            rememberProfileMiss(ids, { username });
            return '';
        })
        .finally(() => {
            state.profileFetches.delete(userKey);
        });

    state.profileFetches.set(userKey, {
        promise,
        pendingMessageIds
    });
    return promise;
}

function extractProfileFromSource(source) {
    if (!source || typeof source !== 'object') {
        return null;
    }
    const profile = { badges: [] };
    let touched = false;

    const displayName = pickFirstString(
        [
            source.display_name,
            source.displayName,
            source.username,
            source.name,
            source.title,
            source.nickname,
            source.user?.display_name,
            source.user?.username,
            source.profile?.display_name,
            source.profile?.username
        ],
        ''
    );
    if (displayName) {
        profile.displayName = displayName;
        touched = true;
    }

    const subtitle = pickFirstString(
        [
            source.subtitle,
            source.status,
            source.role,
            source.rank,
            source.membership?.tier,
            source.membership?.title,
            source.profile?.title
        ],
        ''
    );
    if (subtitle) {
        profile.subtitle = subtitle;
        touched = true;
    }

    const avatarCandidates = [
        source.profile_picture,
        source.profilePicture,
        source.profile_pic,
        source.profile_picture_url,
        source.profilePictureUrl,
        source.avatar,
        source.image,
        source.image_url,
        source.picture,
        source.photo,
        source.icon,
        source.logo,
        source.profile?.picture,
        source.profile?.avatar,
        source.user?.profile_picture,
        source.user?.avatar
    ];
    for (const candidate of avatarCandidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            profile.avatar = normalizeImage(candidate.trim());
            touched = true;
            break;
        }
    }

    const colorCandidates = [
        source.identity?.color,
        source.identity?.username_color,
        source.identity?.name_color,
        source.identity?.hex_color,
        source.name_color,
        source.username_color,
        source.color,
        source.display_color,
        source.user?.name_color
    ];
    for (const candidate of colorCandidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            profile.nameColor = candidate.trim();
            touched = true;
            break;
        }
    }

    const membershipCandidate = pickFirstString(
        [
            typeof source.membership === 'string' ? source.membership : null,
            source.membership_name,
            source.membership?.name,
            source.membership?.display_name,
            source.membership?.title,
            source.membership?.tier,
            source.subscription?.name,
            source.subscription?.title,
            source.subscription?.tier,
            source.subscription_name,
            source.plan,
            source.tier
        ],
        ''
    );
    if (membershipCandidate) {
        profile.membership = membershipCandidate;
        touched = true;
    }

    const badgeCollections = [
        source.identity?.badges,
        source.badges,
        source.badge_collection,
        source.badgeCollection,
        source.profile?.badges,
        source.membership?.badges,
        source.subscription?.badges
    ];
    for (const collection of badgeCollections) {
        const normalized = mapBadges(collection);
        if (normalized.length) {
            profile.badges = mergeBadges(profile.badges, normalized);
            touched = true;
        }
    }

    const badgeInfo = source.identity?.badge_info || source.identity?.badgeInfo || {};
    if (badgeInfo.moderator || badgeInfo.mod || badgeInfo.staff || source.identity?.moderator) {
        profile.isMod = true;
        touched = true;
    }
    if (badgeInfo.vip || badgeInfo.vip_since || source.identity?.vip) {
        profile.isVip = true;
        touched = true;
    }

    if (source.is_moderator || source.moderator || source.isMod) {
        profile.isMod = true;
        touched = true;
    }
    if (source.is_vip || source.vip || source.isVip) {
        profile.isVip = true;
        touched = true;
    }

    if (Array.isArray(source.roles)) {
        if (source.roles.some(role => typeof role === 'string' && role.toLowerCase().includes('mod'))) {
            profile.isMod = true;
            touched = true;
        }
        if (source.roles.some(role => typeof role === 'string' && role.toLowerCase().includes('vip'))) {
            profile.isVip = true;
            touched = true;
        }
    }

    const levelCandidate = source.level ?? source.rank ?? source.identity?.level ?? source.membership?.level;
    if (typeof levelCandidate === 'number' && Number.isFinite(levelCandidate)) {
        profile.level = levelCandidate;
        touched = true;
    } else if (typeof levelCandidate === 'string' && levelCandidate.trim()) {
        profile.level = levelCandidate.trim();
        touched = true;
    }

    if (!touched) {
        return null;
    }
    if (!Array.isArray(profile.badges)) {
        profile.badges = [];
    }
    return profile;
}

function buildProfileSnapshot(...sources) {
    let snapshot = { badges: [] };
    let hasData = false;
    for (const source of sources) {
        const candidate = extractProfileFromSource(source);
        if (!candidate) continue;
        snapshot = mergeProfileDetails(snapshot, candidate);
        hasData = true;
    }
    if (!hasData) {
        return null;
    }
    if (!Array.isArray(snapshot.badges)) {
        snapshot.badges = [];
    }
    return snapshot;
}

function collectBadgesFromSources(...sources) {
    let badges = [];
    for (const source of sources) {
        if (!source || typeof source !== 'object') {
            continue;
        }
        const collections = [
            source.identity?.badges,
            source.badges,
            source.badge_collection,
            source.badgeCollection,
            source.profile?.badges,
            source.membership?.badges,
            source.subscription?.badges
        ];
        for (const collection of collections) {
            const normalized = mapBadges(collection);
            if (normalized.length) {
                badges = mergeBadges(badges, normalized);
            }
        }
    }
    return badges;
}

function collectNameColorFromSources(...sources) {
    for (const source of sources) {
        if (!source || typeof source !== 'object') {
            continue;
        }
        const color = pickFirstString(
            [
                source.identity?.username_color,
                source.identity?.color,
                source.identity?.name_color,
                source.name_color,
                source.username_color,
                source.color,
                source.profile?.name_color
            ],
            ''
        );
        if (color) {
            return color;
        }
    }
    return '';
}

function gatherProfileState(...sources) {
    const ids = resolveProfileIdentifiers(...sources);
    const cachedEntry = ids ? getCachedProfile(ids) : undefined;
    let profile = { badges: [] };
    if (cachedEntry && cachedEntry.hasProfile && cachedEntry.profile) {
        profile = mergeProfileDetails(profile, cachedEntry.profile);
    }
    const snapshot = buildProfileSnapshot(...sources);
    if (snapshot) {
        profile = mergeProfileDetails(profile, snapshot);
        rememberProfile(snapshot, ...sources);
    } else if (!snapshot && ids && cachedEntry === undefined) {
        rememberProfileMiss(ids);
    }
    if (!Array.isArray(profile.badges)) {
        profile.badges = [];
    }
    return { ids, profile, cachedEntry, snapshot };
}

function deepMerge(target, source) {
    const output = target || {};
    if (!source || typeof source !== 'object') {
        return output;
    }
    Object.keys(source).forEach(key => {
        const value = source[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            output[key] = deepMerge(output[key] || {}, value);
        } else {
            output[key] = value;
        }
    });
    return output;
}

function mergeEmotes() {
    let merged = {};
    let hasEmotes = false;

    const mergeCandidate = candidate => {
        if (candidate && typeof candidate === 'object') {
            merged = deepMerge(merged, candidate);
            hasEmotes = true;
        }
    };

    if (BTTV && isSettingEnabled('bttv')) {
        try {
            mergeCandidate(BTTV.channelEmotes);
            mergeCandidate(BTTV.sharedEmotes);
            mergeCandidate(BTTV.globalEmotes);
        } catch (err) {
            console.warn('Failed to merge BTTV emotes', err);
        }
    }
    if (SEVENTV && isSettingEnabled('seventv')) {
        try {
            mergeCandidate(SEVENTV.channelEmotes);
            mergeCandidate(SEVENTV.globalEmotes);
        } catch (err) {
            console.warn('Failed to merge 7TV emotes', err);
        }
    }
    if (FFZ && isSettingEnabled('ffz')) {
        try {
            mergeCandidate(FFZ.channelEmotes);
            mergeCandidate(FFZ.globalEmotes);
        } catch (err) {
            console.warn('Failed to merge FFZ emotes', err);
        }
    }

    EMOTELIST = hasEmotes ? merged : false;
}

function replaceEmotesWithImages(text) {
    if (typeof text !== 'string' || !text) {
        return text;
    }
    if (isTextOnlyMode()) {
        return text;
    }
    if (!EMOTELIST) {
        return text;
    }
    return text.replace(/(?<=^|\s)(\S+?)(?=$|\s)/g, (match, emoteMatch) => {
        const emote = EMOTELIST[emoteMatch];
        if (!emote) {
            return match;
        }
        const escapedMatch = escapeHtml(emoteMatch);
        if (typeof emote === 'string') {
            const safeUrl = escapeAttribute(emote);
            return `<img src="${safeUrl}" alt="${escapedMatch}" title="${escapedMatch}" class="regular-emote"/>`;
        }
        if (!emote || typeof emote !== 'object') {
            return match;
        }
        const url = typeof emote.url === 'string' ? emote.url : emote.src;
        if (!url) {
            return match;
        }
        const safeUrl = escapeAttribute(url);
        const zeroWidth = Boolean(emote.zw || emote.zeroWidth || emote.zero_width);
        const className = zeroWidth ? 'zero-width-emote-centered' : 'regular-emote';
        return `<img src="${safeUrl}" alt="${escapedMatch}" title="${escapedMatch}" class="${className}"/>`;
    });
}

function replaceKickInlineEmotes(text) {
    if (typeof text !== 'string' || !text) {
        return text;
    }
    if (isTextOnlyMode()) {
        return text;
    }
    return text.replace(/\[emote:(\d+):([^\]]+)\]/g, (match, id, name) => {
        const safeId = id.replace(/[^0-9]/g, '');
        if (!safeId) return escapeHtml(match);
        const safeName = escapeHtml(name);
        const url = `https://files.kick.com/emotes/${safeId}/fullsize`;
        return `<img src="${escapeAttribute(url)}" alt="${safeName}" title="${safeName}" class="regular-emote"/>`;
    });
}

function pickFirstString(candidates, fallback = '') {
    for (const value of candidates || []) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return fallback;
}

function pickKickEmoteUrl(fragment) {
    if (!fragment || typeof fragment !== 'object') {
        return '';
    }
    const seen = new Set();
    function pick(value) {
        if (!value) return '';
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed || '';
        }
        if (seen.has(value)) {
            return '';
        }
        seen.add(value);
        if (Array.isArray(value)) {
            for (const item of value) {
                const candidate = pick(item);
                if (candidate) {
                    return candidate;
                }
            }
            return '';
        }
        if (typeof value === 'object') {
            const keys = [
                'url',
                'src',
                'gif',
                'webp',
                'png',
                'default',
                'image',
                'light',
                'dark',
                '1x',
                '2x',
                '4x'
            ];
            for (const key of keys) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    const candidate = pick(value[key]);
                    if (candidate) {
                        return candidate;
                    }
                }
            }
        }
        return '';
    }

    const candidates = [
        fragment.url,
        fragment.href,
        fragment.src,
        fragment.cdn,
        fragment.gif,
        fragment.image,
        fragment.image_url,
        fragment.imageUrl,
        fragment.asset?.url,
        fragment.asset_url,
        fragment.images,
        fragment.emote?.image,
        fragment.emote?.image_url,
        fragment.emote?.imageUrl,
        fragment.emote?.images,
        fragment.data?.image,
        fragment.data?.url
    ];

    for (const value of candidates) {
        const candidate = pick(value);
        if (candidate) {
            return candidate;
        }
    }
    return '';
}

function renderKickEmoteFragment(fragment) {
    const rawName = pickFirstString(
        [
            fragment?.text,
            fragment?.name,
            fragment?.code,
            fragment?.displayText,
            fragment?.alt,
            fragment?.value,
            fragment?.emote?.name,
            fragment?.emote?.code
        ],
        ''
    );
    const cleanName = rawName.replace(/^:+|:+$/g, '');
    const alt = escapeHtml(cleanName || rawName || '');
    const zeroWidth = Boolean(
        fragment?.zero_width ||
        fragment?.zeroWidth ||
        fragment?.zw ||
        fragment?.metadata?.zero_width ||
        fragment?.emote?.zero_width
    );
    const url = pickKickEmoteUrl(fragment);
    if (url && !isTextOnlyMode()) {
        const safeUrl = escapeAttribute(url);
        const className = zeroWidth ? 'zero-width-emote-centered' : 'regular-emote';
        return `<img src="${safeUrl}" alt="${alt}" title="${alt}" class="${className}"/>`;
    }
    if (cleanName) {
        return replaceEmotesWithImages(escapeHtml(`:${cleanName}:`));
    }
    if (rawName) {
        return replaceEmotesWithImages(escapeHtml(rawName));
    }
    return '';
}

function renderKickFragmentHtml(fragment) {
    if (fragment == null) {
        return '';
    }
    if (typeof fragment === 'string') {
        return replaceEmotesWithImages(replaceKickInlineEmotes(escapeHtml(fragment)));
    }
    if (typeof fragment.html === 'string' && !isTextOnlyMode()) {
        return fragment.html;
    }
    const type = typeof fragment.type === 'string' ? fragment.type.toLowerCase() : '';
    if (type === 'emote' || type === 'emoji') {
        return renderKickEmoteFragment(fragment);
    }
    if (type === 'link' || type === 'url') {
        const url = pickFirstString([fragment.url, fragment.href, fragment.value, fragment.target], '');
        const label = pickFirstString(
            [
                fragment.text,
                fragment.content,
                fragment.label,
                fragment.displayText,
                fragment.title,
                fragment.name,
                fragment.url
            ],
            url
        );
        const escapedLabel = replaceEmotesWithImages(escapeHtml(label || ''));
        if (!url) {
            return escapedLabel;
        }
        if (isTextOnlyMode()) {
            const safeUrlText = escapeHtml(url);
            return `${escapedLabel} (${safeUrlText})`;
        }
        const safeUrl = escapeAttribute(url);
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapedLabel}</a>`;
    }
    if (type === 'mention') {
        const username = pickFirstString(
            [fragment.text, fragment.content, fragment.name, fragment.username, fragment.value],
            ''
        );
        const label = username.startsWith('@') ? username : `@${username}`;
        return replaceEmotesWithImages(escapeHtml(label));
    }
    if (fragment.emoji && typeof fragment.emoji.text === 'string') {
        return escapeHtml(fragment.emoji.text);
    }
    const fallback = pickFirstString(
        [
            fragment.text,
            fragment.content,
            fragment.value,
            fragment.name,
            fragment.alt,
            fragment.displayText,
            fragment.label
        ],
        ''
    );
    return replaceEmotesWithImages(replaceKickInlineEmotes(escapeHtml(fallback)));
}

function collectMessageFragments(message) {
    const fragments = [];
    if (!message) {
        return fragments;
    }
    if (Array.isArray(message.fragments)) {
        fragments.push(...message.fragments);
    }
    if (Array.isArray(message.content)) {
        fragments.push(...message.content);
    }
    if (Array.isArray(message.parts)) {
        fragments.push(...message.parts);
    }
    if (!fragments.length && Array.isArray(message.messages)) {
        fragments.push(...message.messages);
    }
    return fragments;
}

function renderKickMessageHtml(message, fallbackText) {
    const fragments = collectMessageFragments(message);
    if (fragments.length) {
        const rendered = fragments.map(renderKickFragmentHtml).join('');
        if (rendered.trim()) {
            return rendered;
        }
    }
    const safeFallback = escapeHtml(typeof fallbackText === 'string' ? fallbackText : '');
    return replaceEmotesWithImages(replaceKickInlineEmotes(safeFallback));
}

function consumeThirdPartyPayload(request) {
    if (!request || typeof request !== 'object') {
        return false;
    }
    if (request.type && request.type !== 'kick') {
        return false;
    }
    const currentSlug = normalizeChannel(state.channelSlug);
    const payloadSlugRaw = (
        typeof request.channel === 'string'
            ? request.channel
            : typeof request.slug === 'string'
                ? request.slug
                : null
    );
    const payloadSlug = normalizeChannel(payloadSlugRaw);
    if (currentSlug && payloadSlug && payloadSlug !== currentSlug) {
        return false;
    }
    let changed = false;
    if (Object.prototype.hasOwnProperty.call(request, 'BTTV')) {
        BTTV = request.BTTV || false;
        changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(request, 'SEVENTV')) {
        SEVENTV = request.SEVENTV || false;
        changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(request, 'FFZ')) {
        FFZ = request.FFZ || false;
        changed = true;
    }
    if (changed) {
        mergeEmotes();
    }
    return changed;
}

function requestThirdPartyEmotes(options = {}) {
    if (
        !extension.available ||
        typeof chrome === 'undefined' ||
        !chrome.runtime ||
        !chrome.runtime.id
    ) {
        return;
    }
    const { force = false } = options || {};
    const slug = normalizeChannel(state.channelSlug);
    const userId = state.channelId != null ? String(state.channelId) : null;

    if (!slug && !userId) {
        return;
    }

    const key = `${slug}|${userId || ''}`;
    const wantsBttv = isSettingEnabled('bttv');
    const wantsSeventv = isSettingEnabled('seventv');
    const wantsFfz = isSettingEnabled('ffz');

    if (!wantsBttv && !wantsSeventv && !wantsFfz) {
        mergeEmotes();
        return;
    }

    const hasCachedData =
        (wantsBttv && BTTV) ||
        (wantsSeventv && SEVENTV) ||
        (wantsFfz && FFZ);

    if (!force && key === lastEmoteRequestKey && hasCachedData) {
        return;
    }

    const payloadBase = { type: 'kick' };
    if (slug) payloadBase.channel = slug;
    if (userId) payloadBase.userid = userId;

    const requests = [];
    if (wantsBttv) {
        requests.push({ ...payloadBase, getBTTV: true });
    } else {
        BTTV = false;
    }
    if (wantsSeventv) {
        requests.push({ ...payloadBase, getSEVENTV: true });
    } else {
        SEVENTV = false;
    }
    if (wantsFfz) {
        requests.push({ ...payloadBase, getFFZ: true });
    } else {
        FFZ = false;
    }

    if (!requests.length) {
        mergeEmotes();
        return;
    }

    lastEmoteRequestKey = key;
    mergeEmotes();

    requests.forEach(message => {
        try {
            chrome.runtime.sendMessage(chrome.runtime.id, message, () => {
                if (chrome.runtime.lastError) {
                    console.warn('Kick emote request failed:', chrome.runtime.lastError.message);
                }
            });
        } catch (err) {
            console.warn('Kick emote request failed:', err);
        }
    });
}

function applyExtensionSettings(newSettings) {
    settings = newSettings && typeof newSettings === 'object' ? { ...newSettings } : {};
    extension.settings = settings;
    resetThirdPartyEmoteCache();
    mergeEmotes();
    requestThirdPartyEmotes({ force: true });
    syncKickViewerHeartbeat(false);
}

function sendRuntimeMessageFireAndForget(payload) {
    if (
        typeof chrome === 'undefined' ||
        !chrome.runtime ||
        !chrome.runtime.id ||
        typeof chrome.runtime.sendMessage !== 'function'
    ) {
        return false;
    }
    try {
        chrome.runtime.sendMessage(chrome.runtime.id, payload, () => {
            try {
                if (chrome.runtime && chrome.runtime.lastError) {
                    // Swallow async runtime port-close noise for fire-and-forget relays.
                }
            } catch (_) {}
        });
        return true;
    } catch (_) {
        return false;
    }
}

function notifyApp(payload) {
    // Prefer direct Electron bridge when available.
    if (isElectronEnvironment() && window.ninjafy && window.ninjafy.sendMessage) {
        try {
            window.ninjafy.sendMessage(null, payload, null, window.__SSAPP_TAB_ID__);
            return;
        } catch (_) {}
    }
    // Try extension relay next.
    if (sendRuntimeMessageFireAndForget(payload)) {
        return;
    }
    // Fallback to ninjafy.sendMessage for Electron
    if (window.ninjafy && window.ninjafy.sendMessage) {
        try {
            window.ninjafy.sendMessage(null, payload, null, window.__SSAPP_TAB_ID__);
            return;
        } catch (e) {
            console.error('Error notifying app:', e);
        }
    }
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        try {
            window.parent.postMessage(payload, '*');
        } catch (e) {
            console.error('Error notifying host:', e);
        }
    }
}

function initExtensionBridge() {
    if (extensionInitialized) return;
    extensionInitialized = true;

    if (!extension.available) {
        return;
    }

    try {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            try {
                if (request === 'getSource') {
                    sendResponse('kick');
                    return false;
                }
                if (request === 'focusChat') {
                    const target = els.chatMessage;
                    if (target) {
                        target.focus();
                        sendResponse(true);
                    } else {
                        sendResponse(false);
                    }
                    return false;
                }
                if (request && request.__ssappSendToTab) {
                    request = request.__ssappSendToTab;
                }
                if (request && typeof request === 'object') {
                    if (Object.prototype.hasOwnProperty.call(request, 'state')) {
                        extension.enabled = Boolean(request.state);
                    }
                    if (request.type === 'SOURCE_CONTROL') {
                        handleSourceControlRequest(request)
                            .then(result => sendResponse(Boolean(result)))
                            .catch(err => {
                                console.error('Kick SOURCE_CONTROL failed', err);
                                sendResponse(false);
                            });
                        return true;
                    }
                    if (request.settings) {
                        applyExtensionSettings(request.settings || {});
                        sendResponse(true);
                        return false;
                    }
                    if (consumeThirdPartyPayload(request)) {
                        sendResponse(true);
                        return false;
                    }
                    if (request.type === 'SEND_MESSAGE' && typeof request.message === 'string') {
                        sendChatFromExtension(request.message)
                            .then(result => sendResponse(Boolean(result)))
                            .catch(err => {
                                console.error('Kick extension SEND_MESSAGE failed', err);
                                sendResponse(false);
                            });
                        return true;
                    }
                }
            } catch (err) {
                console.error('Kick extension message handler failed', err);
            }
            sendResponse(false);
            return false;
        });
    } catch (err) {
        console.error('Failed to register Kick extension bridge listener', err);
    }

    try {
        chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, response => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) return;
            if (!response || typeof response !== 'object') return;
            if (Object.prototype.hasOwnProperty.call(response, 'state')) {
                extension.enabled = Boolean(response.state);
            }
            if (Object.prototype.hasOwnProperty.call(response, 'settings')) {
                applyExtensionSettings(response.settings || {});
            }
        });
    } catch (err) {
        console.error('Failed to fetch Kick extension settings', err);
    }
}

function q(id) {
    return document.getElementById(id);
}

function initElements() {
    Object.assign(els, {
        authState: q('auth-state'),
        startAuth: q('start-auth'),
        signOut: q('sign-out'),
        channelLabel: q('channel-label'),
        viewerCount: q('viewer-count'),
        eventLog: q('event-log'),
        chatFeed: q('chat-feed'),
        chatFeedEmpty: q('chat-feed-empty'),
        alertsFeed: q('alerts-feed'),
        alertsFeedEmpty: q('alerts-feed-empty'),
        socketState: q('socket-state'),
        bridgeState: q('bridge-state'),
        subscriptionSummary: q('subscription-summary'),
        chatMessage: q('chat-message'),
        chatType: q('chat-send-type'),
        sendChat: q('send-chat'),
        chatStatus: q('chat-status'),
        syncDeleteMessages: q('sync-delete-messages'),
        syncBlockUsers: q('sync-block-users'),
        streamTitle: q('stream-title'),
        streamCategory: q('stream-category'),
        refreshStreamInfo: q('refresh-stream-info'),
        updateStreamInfo: q('update-stream-info')
    });
}

function loadAdvancedControls() {
    try {
        const parsed = JSON.parse(localStorage.getItem(KICK_ADVANCED_CONTROLS_STORAGE_KEY) || '{}');
        state.advancedControls.syncDeleteMessages = !!parsed.syncDeleteMessages;
        state.advancedControls.syncBlockUsers = !!parsed.syncBlockUsers;
    } catch (_) {
        state.advancedControls.syncDeleteMessages = false;
        state.advancedControls.syncBlockUsers = false;
    }
    if (els.syncDeleteMessages) {
        els.syncDeleteMessages.checked = state.advancedControls.syncDeleteMessages;
    }
    if (els.syncBlockUsers) {
        els.syncBlockUsers.checked = state.advancedControls.syncBlockUsers;
    }
}

function persistAdvancedControls() {
    const payload = {
        syncDeleteMessages: !!state.advancedControls.syncDeleteMessages,
        syncBlockUsers: !!state.advancedControls.syncBlockUsers
    };
    localStorage.setItem(KICK_ADVANCED_CONTROLS_STORAGE_KEY, JSON.stringify(payload));
}

function normalizeSourceControlPlatform(type) {
    const normalized = typeof type === 'string' ? type.trim().toLowerCase() : '';
    if (normalized === 'youtubeshorts') {
        return 'youtube';
    }
    return normalized;
}

function resolveKickDeleteMessageId(payload = {}) {
    const explicitMessageId = pickFirstString(
        [
            payload.messageId,
            payload.message_id,
            payload.nativeMessageId,
            payload.native_message_id
        ],
        ''
    );
    if (explicitMessageId) {
        return explicitMessageId;
    }
    if (payload.tid !== undefined && payload.tid !== null && payload.tid !== '') {
        return '';
    }
    return pickFirstString([payload.id], '');
}

function isTrustedTabBridgeEvent(event) {
    if (!event || event.source !== window) {
        return false;
    }
    if (event.origin && typeof window !== 'undefined' && window.location && event.origin !== window.location.origin) {
        return false;
    }
    return true;
}

function setChannelSlug(value, options = {}) {
    const { persist = true, source = 'manual', force = false } = options;
    const slug = (value || '').trim();
    if (!slug) return;
    const normalized = normalizeChannel(slug);
    const current = normalizeChannel(state.channelSlug);
    const cameFromQuery = state.channelSlugSource === 'query';
    const sameValue = normalized === current;

    if (!force && sameValue && cameFromQuery && source !== 'query') {
        // Respect explicit query parameter overrides.
        if (persist) persistConfig();
        updateInputsFromState();
        maybeAutoStart();
        return;
    }
    if (!force && cameFromQuery && source !== 'query' && !sameValue) {
        // Keep the query-selected slug in place.
        if (persist) persistConfig();
        updateInputsFromState();
        maybeAutoStart();
        return;
    }

    const changed = !sameValue || force;
    if (changed) {
        state.channelSlug = slug;
        state.channelId = null;
        state.socket.chatroomId = null;
        state.socket.channelId = null;
        state.lastResolvedSlug = '';
        state.autoStart.lastSlug = '';
        resetKickViewerHeartbeatState();
        resetThirdPartyEmoteCache();
        resetChatFeed();
        resetAlertsFeed();
    } else {
        state.channelSlug = slug; // Preserve original casing.
    }
    state.channelSlugSource = source;

    if (changed) {
        requestThirdPartyEmotes({ force: true });
    } else {
        requestThirdPartyEmotes();
    }

    if (persist) {
        persistConfig();
    }
    updateInputsFromState();
    maybeAutoStart();
    if (changed) {
        disconnectLocalSocket();
    }
    initLocalSocketBridge();
    connectLocalSocket();
    notifyLiteStatus('channel');
}

function loadConfig() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        const cfg = sanitizeStoredConfig(parsed);
        if (!cfg || typeof cfg !== 'object') {
            return;
        }
        if (cfg.channelSlug) {
            setChannelSlug(cfg.channelSlug, { persist: false, source: 'storage', force: true });
        } else {
            state.channelSlug = '';
            state.channelSlugSource = '';
        }
        state.customEvents = cfg.customEvents || '';
        if (cfg.siteApiBase) {
            state.socket.siteApiBase = cfg.siteApiBase;
        }
        if (cfg.siteApiProxyBase) {
            state.socket.siteApiProxyBase = cfg.siteApiProxyBase;
        }
        if (typeof cfg.allowProxy === 'boolean') {
            state.socket.allowProxy = cfg.allowProxy;
        }
        if (cfg.chatType) {
            state.chat.type = normalizeKickChatType(cfg.chatType);
        }
        if (cfg.chatroomId) {
            state.socket.chatroomId = String(cfg.chatroomId).trim();
        }
    } catch (err) {
        console.error('Failed to load Kick config', err);
    }
}

function sanitizeStoredConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') {
        return cfg;
    }
    const sanitized = { ...cfg };
    let changed = false;
    ['clientId', 'clientSecret', 'bridgeUrl', 'redirectUri'].forEach(key => {
        if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
            delete sanitized[key];
            changed = true;
        }
    });
    if (changed) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        } catch (_) {}
    }
    return sanitized;
}

function loadTokens() {
    try {
        const stored = localStorage.getItem(TOKEN_KEY);
        if (!stored) {
            logKickWs('No stored Kick OAuth tokens found.');
            return;
        }
        const tokens = JSON.parse(stored);
        if (!tokens || !tokens.access_token) {
            logKickWs('Stored Kick OAuth tokens missing access token.', 'warning');
            return;
        }
        state.tokens = tokens;
        syncKickScoutToken();
        logKickWs('Loaded Kick OAuth tokens from storage.');
    } catch (err) {
        console.error('Failed to load Kick tokens', err);
    }
}

function applyUrlParams() {
    try {
        const params = new URLSearchParams(window.location.search);
        const slug =
            params.get('username') ||
            params.get('channel') ||
            params.get('slug') ||
            params.get('channel_slug');
        if (slug) {
            setChannelSlug(slug, { source: 'query', force: true });
        }
        const chatroomId =
            params.get('chatroom_id') ||
            params.get('chatroomid') ||
            params.get('chatroom');
        if (chatroomId) {
            state.socket.chatroomId = String(chatroomId).trim();
        }
        const channelId =
            params.get('channel_id') ||
            params.get('channelid');
        if (channelId) {
            state.socket.channelId = String(channelId).trim();
        }
        const userId =
            params.get('user_id') ||
            params.get('userid');
        if (userId) {
            state.socket.userId = String(userId).trim();
        }
        const siteApiBase =
            params.get('kick_api_base') ||
            params.get('kickapibase') ||
            params.get('kick_site_api');
        if (siteApiBase) {
            state.socket.siteApiBase = String(siteApiBase).trim();
        }
        const siteApiProxyBase =
            params.get('kick_api_proxy') ||
            params.get('kick_proxy_base') ||
            params.get('kick_proxy');
        if (siteApiProxyBase) {
            state.socket.siteApiProxyBase = String(siteApiProxyBase).trim();
        }
        const allowProxy =
            params.get('kick_allow_proxy') ||
            params.get('allow_proxy');
        if (allowProxy !== null) {
            state.socket.allowProxy = !/^(0|false|no|off)$/i.test(String(allowProxy).trim());
        }
    } catch (err) {
        console.error('Failed to parse Kick URL parameters', err);
    }
}

function applyDefaultConfig() {
    try {
        const host = String(window.location.hostname || '').toLowerCase();
        const isOfficialHost =
            host === 'socialstream.ninja' ||
            host === 'beta.socialstream.ninja' ||
            host.endsWith('.socialstream.ninja');
        if (isOfficialHost) {
            state.clientId = DEFAULT_CONFIG.clientId;
        } else if (!state.clientId) {
            state.clientId = DEFAULT_CONFIG.clientId;
        }
    } catch (_) {
        if (!state.clientId) {
            state.clientId = DEFAULT_CONFIG.clientId;
        }
    }
    if (!state.redirectUri) {
        state.redirectUri = window.location.origin + window.location.pathname;
    }
    if (!state.bridgeUrl) {
        state.bridgeUrl = DEFAULT_CONFIG.bridgeUrl;
    }
}

function appendBridgeParam(url, key, value) {
    try {
        const parsed = new URL(url, window.location.href);
        parsed.searchParams.set(key, value);
        return parsed.toString();
    } catch (err) {
        return url;
    }
}

function persistConfig() {
    const cfg = {
        channelSlug: state.channelSlug,
        customEvents: state.customEvents,
        chatType: state.chat?.type || 'user',
        chatroomId: state.socket.chatroomId || '',
        siteApiBase: state.socket.siteApiBase || '',
        siteApiProxyBase: state.socket.siteApiProxyBase || '',
        allowProxy: state.socket.allowProxy !== false
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

function persistTokens() {
    if (!state.tokens) {
        localStorage.removeItem(TOKEN_KEY);
        syncKickScoutToken();
        logKickWs('Cleared Kick OAuth tokens from storage.');
        return;
    }
    localStorage.setItem(TOKEN_KEY, JSON.stringify(state.tokens));
    syncKickScoutToken();
    logKickWs('Saved Kick OAuth tokens to storage.');
}

function syncKickScoutToken() {
    try {
        if (
            typeof chrome === 'undefined' ||
            !chrome.storage ||
            !chrome.storage.local ||
            typeof chrome.storage.local.set !== 'function'
        ) {
            return;
        }
        const accessToken = typeof state.tokens?.access_token === 'string'
            ? state.tokens.access_token
            : '';
        const expiresAt = Number.isFinite(Number(state.tokens?.expires_at))
            ? Number(state.tokens.expires_at)
            : 0;
        const payload = {
            accessToken,
            expiresAt,
            updatedAt: Date.now()
        };
        chrome.storage.local.set({
            [KICK_SCOUT_TOKEN_STORAGE_KEY]: payload
        }, () => {
            try {
                chrome.runtime?.lastError;
            } catch (_) {}
        });
    } catch (_) {}
}

function signOut() {
    disconnectBridge();
    void disconnectLocalSocket();
    clearPendingKickChatEchoes();
    resetAlertsFeed();
    resetKickViewerHeartbeatState();
    state.bridge.chatroomCacheWriteDisabled = false;
    // Clear tokens
    state.tokens = null;
    state.authUser = null;
    if (state.refreshTimer) {
        clearTimeout(state.refreshTimer);
        state.refreshTimer = null;
    }
    persistTokens();
    // Update UI
    updateAuthStatus();
    if (els.subscriptionSummary) {
        els.subscriptionSummary.textContent = 'Subscriptions pending';
        els.subscriptionSummary.className = 'status-chip warning';
    }
    log('Signed out of Kick.');
}

function persistEventTypesCache() {
    try {
        const payload = {
            types: Array.isArray(cachedEventTypes) ? cachedEventTypes : [],
            timestamp: cachedEventTypesFetchedAt || Date.now(),
            unavailableUntil: state.eventTypesUnavailable ? eventTypesUnavailableUntil : 0
        };
        localStorage.setItem(EVENT_TYPES_CACHE_KEY, JSON.stringify(payload));
    } catch (err) {
        console.warn('Failed to persist Kick event type cache', err);
    }
}

function setCachedEventTypes(list) {
    cachedEventTypes = Array.isArray(list) ? list : [];
    cachedEventTypesFetchedAt = Date.now();
    eventTypesUnavailableUntil = 0;
    state.eventTypesUnavailable = false;
    persistEventTypesCache();
}

function markEventTypesUnavailable() {
    const now = Date.now();
    if (!Array.isArray(cachedEventTypes)) {
        cachedEventTypes = [];
    }
    cachedEventTypesFetchedAt = now;
    state.eventTypesUnavailable = true;
    eventTypesUnavailableUntil = now + EVENT_TYPES_UNAVAILABLE_COOLDOWN_MS;
    persistEventTypesCache();
}

function loadEventTypesCache() {
    state.eventTypesUnavailable = false;
    eventTypesUnavailableUntil = 0;
    try {
        const stored = localStorage.getItem(EVENT_TYPES_CACHE_KEY);
        if (!stored) return;
        const payload = JSON.parse(stored);
        if (payload && typeof payload === 'object') {
            if (Array.isArray(payload.types)) {
                cachedEventTypes = payload.types;
            }
            if (typeof payload.timestamp === 'number') {
                cachedEventTypesFetchedAt = payload.timestamp;
            }
            if (
                typeof payload.unavailableUntil === 'number' &&
                payload.unavailableUntil > Date.now()
            ) {
                state.eventTypesUnavailable = true;
                eventTypesUnavailableUntil = payload.unavailableUntil;
            }
        }
    } catch (err) {
        console.warn('Failed to load Kick event type cache', err);
    }
}

function updateInputsFromState() {
    if (els.channelLabel) {
        if (state.channelSlug) {
            const name = state.channelName || state.channelSlug;
            const slug = state.channelSlug;
            if (isTextOnlyMode()) {
                const label = slug && slug.toLowerCase() !== name.toLowerCase()
                    ? `Channel: ${name} (@${slug})`
                    : `Channel: ${name}`;
                els.channelLabel.textContent = label;
            } else {
                const safeName = escapeHtml(name);
                const safeSlug = escapeHtml(slug);
                const showSlug = safeSlug && safeSlug.toLowerCase() !== safeName.toLowerCase();
                els.channelLabel.innerHTML = `Channel: <span class="status-emphasis">${safeName}</span>${showSlug ? ` <span class="status-subtle">(@${safeSlug})</span>` : ''}`;
            }
        } else {
            if (isTextOnlyMode()) {
                els.channelLabel.textContent = 'Channel: —';
            } else {
                els.channelLabel.innerHTML = 'Channel: <span class="status-subtle">—</span>';
            }
        }
    }
    if (els.chatType) {
        const normalizedType = normalizeKickChatType(state.chat?.type);
        state.chat.type = normalizedType;
        els.chatType.value = normalizedType;
    }
    if (els.chatStatus) {
        els.chatStatus.textContent = '';
    }
}

function resolveAuthIdentity() {
    const fallbackProfile = extractProfileFromTokens();
    const candidates = [state.authUser, state.tokens?.profile, fallbackProfile];
    for (const profile of candidates) {
        if (!profile || typeof profile !== 'object') continue;
        const displayName = pickFirstString(
            [
                profile.display_name,
                profile.displayName,
                profile.name,
                profile.username,
                profile.user?.display_name,
                profile.user?.username
            ],
            ''
        );
        const username = pickFirstString(
            [
                profile.username,
                profile.slug,
                profile.user?.username,
                profile.user?.slug,
                state.channelSlug
            ],
            ''
        );
        if (displayName || username) {
            return {
                displayName: displayName || username || '',
                username: username || ''
            };
        }
    }
    return null;
}

function updateAuthStatus() {
    if (!els.authState) return;
    const authed = state.tokens?.access_token && !isTokenExpired();
    const identity = authed ? resolveAuthIdentity() : null;
    if (authed && identity) {
        const safeDisplay = escapeHtml(identity.displayName || identity.username || '');
        const username = identity.username && identity.username.toLowerCase() !== (identity.displayName || '').toLowerCase()
            ? identity.username
            : '';
        const safeUsername = username ? escapeHtml(username) : '';
        if (isTextOnlyMode()) {
            const label = username
                ? `Signed in as ${identity.displayName || identity.username} (@${username})`
                : `Signed in as ${identity.displayName || identity.username}`;
            els.authState.textContent = label;
        } else {
            els.authState.innerHTML = `Signed in as <span class="status-emphasis">${safeDisplay}</span>${safeUsername ? ` <span class="status-subtle">(@${safeUsername})</span>` : ''}`;
        }
    } else {
        els.authState.textContent = authed ? 'Signed in' : 'Not signed in';
    }
    els.authState.className = authed ? 'status-chip' : 'status-chip warning';
    // Hide auth-dependent status chips when not signed in
    if (els.subscriptionSummary) {
        els.subscriptionSummary.style.display = authed ? '' : 'none';
    }
    if (els.bridgeState) {
        els.bridgeState.style.display = authed ? '' : 'none';
    }
    // Show/hide sign in and sign out buttons based on auth state
    if (els.startAuth) {
        els.startAuth.style.display = authed ? 'none' : '';
    }
    if (els.signOut) {
        els.signOut.style.display = authed ? '' : 'none';
    }
    const authMethodSelector = document.getElementById('auth-method-selector');
    if (authMethodSelector) {
        const showSelector = !authed && isElectronEnvironment();
        authMethodSelector.classList.toggle('hidden', !showSelector);
    }
    const status = authed ? 'authorized' : 'signin_required';
    if (status !== lastAuthNotifyStatus) {
        lastAuthNotifyStatus = status;
        notifyApp({
            wssStatus: {
                platform: WSS_PLATFORM,
                status,
                message: authed ? 'Kick account linked' : 'Sign in with Kick to continue'
            }
        });
    }
    notifyLiteStatus('auth');
}

function bindEvents() {
    // Auth method selector setup
    const authMethodSelector = document.getElementById('auth-method-selector');
    const isElectron = isElectronEnvironment();
    if (authMethodSelector && isElectron) {
        // Load saved preference
        const savedMethod = localStorage.getItem('kickAuthMethod') || 'external';
        const radios = authMethodSelector.querySelectorAll('input[name="kick-auth-method"]');
        radios.forEach(radio => {
            radio.checked = radio.value === savedMethod;
            radio.addEventListener('change', function() {
                localStorage.setItem('kickAuthMethod', this.value);
            });
        });
    }

    if (els.startAuth) {
        logKickWs('Binding sign-in click handler.');
        els.startAuth.addEventListener('click', () => {
            logKickWs('Sign-in click event captured.');
            startAuthFlow();
        });
    } else {
        logKickWs('Sign-in button not found in DOM.', 'warning');
    }
    if (els.signOut) {
        els.signOut.addEventListener('click', signOut);
    }
    if (els.syncDeleteMessages) {
        els.syncDeleteMessages.addEventListener('change', () => {
            state.advancedControls.syncDeleteMessages = !!els.syncDeleteMessages.checked;
            persistAdvancedControls();
        });
    }
    if (els.syncBlockUsers) {
        els.syncBlockUsers.addEventListener('change', () => {
            state.advancedControls.syncBlockUsers = !!els.syncBlockUsers.checked;
            persistAdvancedControls();
        });
    }
    if (els.refreshStreamInfo) {
        els.refreshStreamInfo.addEventListener('click', () => {
            refreshKickStreamInfo().catch((err) => {
                console.error('Failed to refresh Kick stream info', err);
                log(`Unable to refresh stream info: ${err.message}`, 'warning');
            });
        });
    }
    if (els.updateStreamInfo) {
        els.updateStreamInfo.addEventListener('click', () => {
            updateKickStreamInfoFromInputs().catch((err) => {
                console.error('Failed to update Kick stream info', err);
                log(`Unable to update stream info: ${err.message}`, 'error');
            });
        });
    }
    if (els.chatType) {
        els.chatType.addEventListener('change', () => {
            state.chat.type = normalizeKickChatType(els.chatType.value);
            els.chatType.value = state.chat.type;
            persistConfig();
        });
    }
    if (els.sendChat) {
        els.sendChat.addEventListener('click', sendChatMessage);
    }
    if (els.chatMessage) {
        const handleChatKeydown = (event) => {
            if (event.key !== 'Enter') return;
            if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }
            event.preventDefault();
            sendChatMessage();
        };
        els.chatMessage.addEventListener('keydown', handleChatKeydown);
    }
}

function getBridgeBaseUrl() {
    const candidate = (state.bridgeUrl && state.bridgeUrl.trim()) || DEFAULT_CONFIG.bridgeUrl;
    try {
        const parsed = new URL(candidate, window.location.href);
        return `${parsed.protocol}//${parsed.host}`;
    } catch (err) {
        try {
            return `${window.location.protocol}//${window.location.host}`;
        } catch (_) {
            return 'https://kick-bridge.socialstream.ninja';
        }
    }
}

function isElectronEnvironment() {
    // Check for ssapp URL parameter (set by ssapp when creating WSS windows)
    // This is backwards compatible - older ssapp versions won't set the param,
    // but will still work via the ninjafy check for full preload scenarios
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const isSsappViaParam = urlParams.has('ssapp') || hashParams.has('ssapp');
    const hasNinjafyOAuth = window.ninjafy && typeof window.ninjafy.startKickOAuth === 'function';
    const hasSsappOAuth = window.__ssapp && typeof window.__ssapp.startKickOAuth === 'function';

    return isSsappViaParam || hasNinjafyOAuth || hasSsappOAuth;
}

function supportsLocalSocket() {
    return !!(window.ninjafy && typeof window.ninjafy.startKickWebSocket === 'function');
}

function parseViewerCountCandidate(candidate) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return Math.max(0, Math.floor(candidate));
    }
    if (typeof candidate === 'string') {
        const digits = candidate.replace(/[^0-9]/g, '');
        if (!digits) {
            return null;
        }
        const parsed = parseInt(digits, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}

function extractKickViewerCount(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const viewerCountCandidates = [
        payload?.number_viewers,
        payload?.viewer_count,
        payload?.viewers,
        payload?.viewerCount,
        payload?.concurrent_viewers,
        payload?.concurrent,
        payload?.data?.number_viewers,
        payload?.data?.viewer_count,
        payload?.data?.viewers,
        payload?.meta?.viewer_count,
        payload?.meta?.viewers,
        payload?.summary?.viewer_count,
        payload?.summary?.viewers,
        payload?.channel?.viewer_count,
        payload?.channel?.viewers_count,
        payload?.channel?.viewers,
        payload?.livestream?.number_viewers,
        payload?.livestream?.viewer_count,
        payload?.livestream?.viewers,
        payload?.stream?.number_viewers,
        payload?.stream?.viewer_count,
        payload?.stream?.viewers,
        payload?.data?.livestream?.number_viewers,
        payload?.data?.livestream?.viewer_count,
        payload?.data?.livestream?.viewers
    ];
    for (const candidate of viewerCountCandidates) {
        const normalized = parseViewerCountCandidate(candidate);
        if (normalized != null) {
            return normalized;
        }
    }
    return null;
}

function extractKickLiveFlag(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const liveCandidates = [
        payload?.is_live,
        payload?.isLive,
        payload?.online,
        payload?.status,
        payload?.stream_status,
        payload?.data?.is_live,
        payload?.data?.isLive,
        payload?.data?.online,
        payload?.data?.status,
        payload?.data?.stream_status,
        payload?.livestream?.is_live,
        payload?.livestream?.isLive,
        payload?.livestream?.online,
        payload?.livestream?.status,
        payload?.stream?.is_live,
        payload?.stream?.isLive,
        payload?.stream?.online,
        payload?.stream?.status,
        payload?.data?.livestream?.is_live,
        payload?.data?.livestream?.isLive,
        payload?.data?.livestream?.online,
        payload?.data?.livestream?.status
    ];
    for (const candidate of liveCandidates) {
        if (typeof candidate === 'boolean') {
            return candidate;
        }
        if (typeof candidate === 'number') {
            if (candidate === 1) return true;
            if (candidate === 0) return false;
        }
        if (typeof candidate === 'string') {
            const value = candidate.trim().toLowerCase();
            if (!value) {
                continue;
            }
            if (['live', 'online', 'started', 'active', 'on'].includes(value)) {
                return true;
            }
            if (['offline', 'ended', 'stopped', 'inactive', 'off'].includes(value)) {
                return false;
            }
        }
    }
    return null;
}

function isKickViewerTransportConnected() {
    return state.bridge?.status === 'connected' || state.socket?.status === 'connected';
}

function shouldTrackKickViewerCount() {
    return (
        isSettingEnabled('showviewercount') ||
        isSettingEnabled('hypemode')
    );
}

function shouldRunKickViewerHeartbeat() {
    if (!state.channelSlug) {
        return false;
    }
    if (!shouldTrackKickViewerCount()) {
        return false;
    }
    if (!isKickViewerTransportConnected()) {
        return false;
    }
    // Keep polling even when we believe the channel is offline so viewer state
    // can recover for channels where live-status events are not available.
    return true;
}

function logKickViewerDebug(message, level = 'info') {
    logKickWs(`[Viewer] ${message}`, level);
}

function updateKickViewerCountDisplay(count) {
    if (!els.viewerCount) {
        return;
    }
    if (!Number.isFinite(count)) {
        els.viewerCount.textContent = 'Viewers: —';
        els.viewerCount.className = 'status-chip warning';
        return;
    }
    const normalizedCount = Math.max(0, Math.floor(count));
    els.viewerCount.textContent = `Viewers: ${normalizedCount}`;
    els.viewerCount.className = normalizedCount > 0 ? 'status-chip' : 'status-chip warning';
}

function emitKickViewerUpdate(count) {
    const normalizedCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    kickViewerHeartbeat.lastKnownCount = normalizedCount;
    kickViewerHeartbeat.hasKnownCount = true;
    kickViewerHeartbeat.lastSentAt = Date.now();
    updateKickViewerCountDisplay(normalizedCount);
    if (shouldTrackKickViewerCount()) {
        pushMessage({
            type: 'kick',
            event: 'viewer_update',
            meta: normalizedCount
        });
    }
    return normalizedCount;
}

async function fetchKickViewerSnapshot() {
    const slugInput = state.channelSlug?.trim();
    if (!slugInput) {
        logKickViewerDebug('Snapshot skipped: missing channel slug.', 'warning');
        return null;
    }
    const hasAuth = !!state.tokens?.access_token;
    let fallbackSnapshot = null;

    // --- Authenticated paths (official API via apiFetch) ---
    if (hasAuth) {
        const slugLower = normalizeChannel(slugInput);
        if (slugLower) {
            try {
                const channel = await fetchKickChannelBySlug(slugLower, { debugContext: 'viewer channel lookup' });
                if (channel && typeof channel === 'object') {
                    const viewerCount = extractKickViewerCount(channel);
                    const isLive = extractKickLiveFlag(channel);
                    if (viewerCount != null || typeof isLive === 'boolean') {
                        logKickViewerDebug(
                            `Snapshot via channel @${slugLower}: viewers=${viewerCount != null ? viewerCount : 'null'}, live=${typeof isLive === 'boolean' ? isLive : 'null'}.`
                        );
                        return { viewerCount, isLive };
                    }
                    logKickViewerDebug(`Channel snapshot for @${slugLower} had no viewer/live fields.`, 'warning');
                }
            } catch (err) {
                const status = getKickApiErrorStatus(err);
                if (!(status === 400 || status === 401 || status === 403 || status === 404 || status === 405 || status === 501)) {
                    throw err;
                }
                logKickViewerDebug(
                    `Channel snapshot failed for @${slugLower}: status=${status || 'unknown'} error=${err?.message || err}.`,
                    'warning'
                );
            }
        }
        const broadcasterUserId = normalizeKickNumericId(state.channelId);
        if (broadcasterUserId != null) {
            try {
                const livestream = await fetchKickLivestreamByBroadcasterId(broadcasterUserId);
                if (livestream && typeof livestream === 'object') {
                    const viewerCount = extractKickViewerCount(livestream);
                    const isLive = extractKickLiveFlag(livestream);
                    logKickViewerDebug(
                        `Snapshot via livestream id=${broadcasterUserId}: viewers=${viewerCount != null ? viewerCount : 'null'}, live=${typeof isLive === 'boolean' ? isLive : 'null'}.`
                    );
                    return { viewerCount, isLive };
                }
                fallbackSnapshot = { viewerCount: 0, isLive: null };
                logKickViewerDebug(`Livestream snapshot empty for broadcaster id=${broadcasterUserId}; using fallback snapshot.`, 'warning');
            } catch (err) {
                const status = getKickApiErrorStatus(err);
                if (status === 400 || status === 401 || status === 403 || status === 404 || status === 405 || status === 501) {
                    logKickViewerDebug(
                        `Livestream snapshot failed for id=${broadcasterUserId}: status=${status || 'unknown'} error=${err?.message || err}.`,
                        'warning'
                    );
                } else {
                    throw err;
                }
            }
        }
    }

    // --- Unauthenticated fallback: bridge lookup with viewer data ---
    if (!fallbackSnapshot) {
        const slugLower = normalizeChannel(slugInput);
        if (slugLower) {
            try {
                const base = getBridgeBaseUrl();
                const resp = await fetch(
                    `${base}/kick/lookup?slug=${encodeURIComponent(slugLower)}&include_viewer=1`
                );
                if (resp.ok) {
                    const data = await resp.json();
                    const viewerCount = typeof data?.viewer_count === 'number' ? data.viewer_count : null;
                    const isLive = typeof data?.is_live === 'boolean' ? data.is_live : null;
                    if (viewerCount != null || isLive != null) {
                        logKickViewerDebug(
                            `Snapshot via bridge @${slugLower}: viewers=${viewerCount != null ? viewerCount : 'null'}, live=${isLive != null ? isLive : 'null'}.`
                        );
                        return { viewerCount, isLive };
                    }
                }
            } catch (err) {
                logKickViewerDebug(`Bridge viewer lookup failed: ${err?.message || err}`, 'warning');
            }
        }
    }

    if (!fallbackSnapshot) {
        logKickViewerDebug(`No viewer snapshot available for @${slugInput}.`, 'warning');
    }
    return fallbackSnapshot;
}

async function sendKickViewerHeartbeat(reason = 'interval') {
    const slug = (state.channelSlug || '').trim() || '(none)';
    const transportConnected = isKickViewerTransportConnected();
    if (!shouldRunKickViewerHeartbeat()) {
        logKickViewerDebug(
            `Heartbeat skipped (${reason}): slug=${slug}, transportConnected=${transportConnected}, socket=${state.socket?.status || 'unknown'}, bridge=${state.bridge?.status || 'unknown'}.`
        );
        return;
    }
    if (kickViewerHeartbeat.pollInFlight) {
        logKickViewerDebug(`Heartbeat skipped (${reason}): poll already in flight.`, 'warning');
        return;
    }
    kickViewerHeartbeat.attemptSeq += 1;
    kickViewerHeartbeat.lastAttemptAt = Date.now();
    const attemptId = kickViewerHeartbeat.attemptSeq;
    logKickViewerDebug(
        `Heartbeat attempt #${attemptId} start (${reason}): slug=${slug}, channelId=${state.channelId || 'null'}, hasKnown=${kickViewerHeartbeat.hasKnownCount}, lastKnown=${kickViewerHeartbeat.lastKnownCount}.`
    );
    kickViewerHeartbeat.pollInFlight = true;
    try {
        let nextViewerCount = null;
        const snapshot = await fetchKickViewerSnapshot();
        if (snapshot) {
            if (typeof snapshot.isLive === 'boolean') {
                kickViewerHeartbeat.isLive = snapshot.isLive;
            }
            if (snapshot.viewerCount != null) {
                nextViewerCount = snapshot.viewerCount;
            } else if (kickViewerHeartbeat.isLive === false) {
                nextViewerCount = 0;
            }
            logKickViewerDebug(
                `Heartbeat attempt #${attemptId} snapshot: viewers=${snapshot.viewerCount != null ? snapshot.viewerCount : 'null'}, live=${typeof snapshot.isLive === 'boolean' ? snapshot.isLive : 'null'}.`
            );
        } else {
            logKickViewerDebug(`Heartbeat attempt #${attemptId} snapshot: none returned.`, 'warning');
        }
        if (nextViewerCount == null) {
            if (kickViewerHeartbeat.hasKnownCount) {
                nextViewerCount = kickViewerHeartbeat.lastKnownCount;
                logKickViewerDebug(`Heartbeat attempt #${attemptId} using cached viewers=${nextViewerCount}.`);
            } else {
                logKickViewerDebug(`Heartbeat attempt #${attemptId} has no viewer count yet; waiting for first successful snapshot.`, 'warning');
                return;
            }
        }
        emitKickViewerUpdate(nextViewerCount);
        kickViewerHeartbeat.lastSuccessAt = Date.now();
        logKickViewerDebug(`Heartbeat attempt #${attemptId} emitted viewers=${nextViewerCount}.`);
    } catch (err) {
        const now = Date.now();
        if (!kickViewerHeartbeat.lastPollErrorAt || now - kickViewerHeartbeat.lastPollErrorAt > 120000) {
            kickViewerHeartbeat.lastPollErrorAt = now;
            logKickWs(`Viewer heartbeat fallback (${reason}): ${err?.message || err}`, 'warning');
        }
        logKickViewerDebug(`Heartbeat attempt #${attemptId} failed: ${err?.message || err}`, 'warning');
        if (kickViewerHeartbeat.hasKnownCount) {
            emitKickViewerUpdate(kickViewerHeartbeat.lastKnownCount);
            logKickViewerDebug(`Heartbeat attempt #${attemptId} emitted cached viewers=${kickViewerHeartbeat.lastKnownCount}.`, 'warning');
        } else {
            logKickViewerDebug(`Heartbeat attempt #${attemptId} has no cached viewers after failure.`, 'warning');
        }
    } finally {
        kickViewerHeartbeat.pollInFlight = false;
        if (!shouldRunKickViewerHeartbeat()) {
            syncKickViewerHeartbeat(false);
        }
    }
}

function syncKickViewerHeartbeat(emitZeroOnStop = false) {
    const transportConnected = isKickViewerTransportConnected();
    if (transportConnected) {
        kickViewerHeartbeat.hadConnectedTransport = true;
    }
    const shouldRun = shouldRunKickViewerHeartbeat();
    if (shouldRun) {
        if (!kickViewerHeartbeat.intervalId) {
            logKickViewerDebug(`Starting viewer heartbeat interval (${KICK_VIEWER_HEARTBEAT_INTERVAL_MS}ms).`);
            kickViewerHeartbeat.intervalId = setInterval(() => {
                void sendKickViewerHeartbeat('interval');
            }, KICK_VIEWER_HEARTBEAT_INTERVAL_MS);
        }
        if (
            !kickViewerHeartbeat.lastSentAt ||
            (Date.now() - kickViewerHeartbeat.lastSentAt) >= KICK_VIEWER_HEARTBEAT_INTERVAL_MS
        ) {
            logKickViewerDebug('Requesting immediate viewer heartbeat run.');
            void sendKickViewerHeartbeat('start');
        }
        return;
    }

    if (kickViewerHeartbeat.intervalId) {
        clearInterval(kickViewerHeartbeat.intervalId);
        kickViewerHeartbeat.intervalId = null;
        logKickViewerDebug('Stopped viewer heartbeat interval.');
    }

    if (emitZeroOnStop && !transportConnected) {
        const hadSession = kickViewerHeartbeat.hadConnectedTransport || kickViewerHeartbeat.hasKnownCount;
        const now = Date.now();
        const shouldEmitDisconnectZero =
            hadSession &&
            (
                !kickViewerHeartbeat.lastSentAt ||
                (now - kickViewerHeartbeat.lastSentAt) > KICK_VIEWER_DISCONNECT_EMIT_DEBOUNCE_MS ||
                kickViewerHeartbeat.lastKnownCount !== 0
            );
        if (shouldEmitDisconnectZero) {
            emitKickViewerUpdate(0);
            logKickViewerDebug('Emitted viewers=0 due to transport disconnect.');
        }
        kickViewerHeartbeat.hadConnectedTransport = false;
        // Disconnect means unknown state; allow heartbeat to resume on reconnect.
        kickViewerHeartbeat.isLive = null;
    }
}

function resetKickViewerHeartbeatState() {
    if (kickViewerHeartbeat.intervalId) {
        clearInterval(kickViewerHeartbeat.intervalId);
        kickViewerHeartbeat.intervalId = null;
    }
    kickViewerHeartbeat.pollInFlight = false;
    kickViewerHeartbeat.lastKnownCount = 0;
    kickViewerHeartbeat.hasKnownCount = false;
    kickViewerHeartbeat.hadConnectedTransport = false;
    kickViewerHeartbeat.isLive = null;
    kickViewerHeartbeat.lastSentAt = 0;
    kickViewerHeartbeat.lastPollErrorAt = 0;
    kickViewerHeartbeat.attemptSeq = 0;
    kickViewerHeartbeat.lastAttemptAt = 0;
    kickViewerHeartbeat.lastSuccessAt = 0;
    updateKickViewerCountDisplay(null);
}

function updateSocketState(payload = {}) {
    syncKickViewerHeartbeat(true);
    if (!els.socketState) return;
    els.socketState.style.display = '';
    const status = state.socket?.status || 'disconnected';
    const pusherUp = state.socket.pusherStatus === 'connected';
    const localUp = supportsLocalSocket() && status === 'connected' && !pusherUp;
    const bridgeChat = state.bridge.status === 'connected' && !state.bridge.chatDisabled;
    let transport = '';
    if (pusherUp) transport = 'Pusher';
    else if (localUp) transport = 'Electron';
    else if (bridgeChat) transport = 'Bridge';
    let label = 'Chat socket disconnected';
    let className = 'status-chip danger';
    if (status === 'connected') {
        label = transport ? `Chat: ${transport}` : 'Chat socket connected';
        className = 'status-chip';
    } else if (status === 'connecting') {
        label = 'Chat socket connecting';
        className = 'status-chip warning';
    } else if (status === 'error') {
        label = 'Chat socket error';
        className = 'status-chip danger';
    } else if (status === 'disconnected') {
        if (bridgeChat) {
            label = 'Chat: Bridge';
            className = 'status-chip';
        } else {
            label = 'Chat socket disconnected';
            className = 'status-chip danger';
        }
    }
    els.socketState.textContent = label;
    els.socketState.className = className;

    if (status !== lastSocketNotifyStatus) {
        lastSocketNotifyStatus = status;
        if (status === 'error') {
            log(`Chat socket error: ${payload.error || state.socket?.lastError || 'Unknown error'}`, 'error');
        } else {
            log(`Chat socket ${status}.`);
        }
    }
}

function handleLocalSocketStatus(payload) {
    if (!payload || typeof payload !== 'object') return;
    const previousStatus = state.socket.status;
    const previousError = state.socket.lastError;
    if (state.socket.connectionId && payload.connectionId && payload.connectionId !== state.socket.connectionId) {
        return;
    }
    if (payload.connectionId && !state.socket.connectionId) {
        state.socket.connectionId = payload.connectionId;
    }
    state.socket.status = payload.status || state.socket.status || 'disconnected';
    const rawError = payload.error ?? payload.reason ?? '';
    const errorText = (rawError && typeof rawError === 'object')
        ? (rawError.message || JSON.stringify(rawError))
        : rawError;
    const isWaitingIdentifiersError = typeof errorText === 'string' && errorText.trim() === 'waiting_identifiers';
    if (state.socket.status === 'connected' || state.socket.status === 'connecting' || isWaitingIdentifiersError) {
        state.socket.lastError = '';
    } else if (errorText) {
        state.socket.lastError = errorText;
    }
    if (payload.chatroomId != null) state.socket.chatroomId = payload.chatroomId;
    if (payload.channelId != null) state.socket.channelId = payload.channelId;
    if (payload.userId != null) state.socket.userId = payload.userId;
    const detail = state.socket.lastError || '';
    if (state.socket.status !== previousStatus || (detail && detail !== previousError)) {
        const suffix = detail ? `: ${detail}` : '';
        const level = state.socket.status === 'error' ? 'error' : (detail ? 'warning' : 'info');
        logKickWs(`Status ${state.socket.status}${suffix}`, level);
    }
    updateSocketState(payload);
    if (state.socket.status === 'connected' && previousStatus !== 'connected') {
        logKickViewerDebug('Socket connected, requesting immediate viewer snapshot.');
        void sendKickViewerHeartbeat('socket_connected');
    }
}

function handleLocalSocketEvent(packet) {
    if (!packet || typeof packet !== 'object') return;
    if (state.socket.connectionId && packet.connectionId && packet.connectionId !== state.socket.connectionId) {
        return;
    }
    const now = Date.now();
    const type = packet.type || packet.body?.event || 'event';
    if (type === 'chat.message.sent') {
        state.socket.lastChatEventAt = now;
    }
    if (type !== 'chat.message.sent' && (kickWsEventLogCount < 5 || now - kickWsLastEventLogAt > 15000)) {
        kickWsEventLogCount += 1;
        kickWsLastEventLogAt = now;
        logKickWs(`Event received: ${type}.`);
    }
    handleBridgeEvent(packet);
}

function initLocalSocketBridge() {
    if (socketBridgeInitialized) return;
    socketBridgeInitialized = true;
    if (!supportsLocalSocket()) {
        logKickWs('Local socket bridge unavailable (ninjafy missing).', 'warning');
        return;
    }
    logKickWs('Local socket bridge initialized.');

    try {
        if (typeof window.ninjafy.onKickWsStatus === 'function') {
            window.ninjafy.onKickWsStatus(handleLocalSocketStatus);
        }
        if (typeof window.ninjafy.onKickWsEvent === 'function') {
            window.ninjafy.onKickWsEvent(handleLocalSocketEvent);
        }
    } catch (err) {
        console.error('Failed to initialize Kick socket bridge', err);
    }
}

async function connectLocalSocket(force = false) {
    if (!supportsLocalSocket()) return;
    // Our Pusher handles chat — don't start ninjafy's duplicate WebSocket
    if (state.socket.pusherWs || state.socket.pusherStatus === 'connecting') return;
    if (!state.channelSlug) return;
    if (!force && state.socket.status === 'connected') return;
    if (state.socket.connecting) return;

    const chatroomId = state.socket.chatroomId != null ? String(state.socket.chatroomId).trim() : '';
    const socketChannelId = state.socket.channelId != null ? String(state.socket.channelId).trim() : '';
    const socketUserId = state.socket.userId != null ? String(state.socket.userId).trim() : '';
    const broadcasterUserId = state.channelId != null ? String(state.channelId).trim() : '';
    const fallbackUserId = socketUserId || broadcasterUserId;
    const hasResolverHint = Boolean(chatroomId || socketChannelId || fallbackUserId);
    if (!hasResolverHint) {
        if (state.socket.lastError !== 'waiting_identifiers') {
            logKickWs('Waiting for channel identifiers before opening chat socket.');
        }
        state.socket.status = 'disconnected';
        state.socket.lastError = 'waiting_identifiers';
        updateSocketState({ status: 'disconnected' });
        return;
    }
    if (state.socket.lastError === 'waiting_identifiers') {
        state.socket.lastError = '';
    }

    if (!state.tokens?.access_token && !state.socket.chatroomId) {
        logKickWs('Chat socket requires Kick sign-in to resolve chatroom ID.', 'warning');
        state.socket.status = 'disconnected';
        updateSocketState({ status: 'disconnected' });
        return;
    }

    state.socket.connecting = true;
    state.socket.status = 'connecting';
    kickViewerHeartbeat.isLive = null;
    updateSocketState({ status: 'connecting' });
    if (!state.tokens?.access_token) {
        logKickWs('No Kick access token found for socket lookup.', 'warning');
    }
    logKickWs(`Connecting chat socket for ${state.channelSlug}.`);
    try {
        const payload = {
            slug: state.channelSlug,
            chatroomId: chatroomId || null,
            channelId: socketChannelId || null,
            userId: fallbackUserId || null,
            accessToken: state.tokens?.access_token || null,
            clientId: state.clientId || null,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            tabId: typeof window !== 'undefined' ? window.__SSAPP_TAB_ID__ : null,
            force: force === true,
            siteApiBase: state.socket.siteApiBase || null,
            siteApiProxyBase: state.socket.siteApiProxyBase || null,
            allowProxy: state.socket.allowProxy !== false
        };
        const result = await window.ninjafy.startKickWebSocket(payload);
        if (result && result.ok) {
            if (result.connectionId) state.socket.connectionId = result.connectionId;
            if (result.chatroomId) state.socket.chatroomId = result.chatroomId;
            if (result.channelId) state.socket.channelId = result.channelId;
            if (result.userId) state.socket.userId = result.userId;
            if (result.slug && !state.channelSlug) state.channelSlug = result.slug;
            logKickWs(`Chat socket connected (id: ${result.connectionId || 'unknown'}).`);
        } else {
            handleLocalSocketStatus({
                status: 'error',
                error: result?.error || 'Kick socket connection failed.'
            });
        }
    } catch (err) {
        handleLocalSocketStatus({ status: 'error', error: err?.message || String(err) });
    } finally {
        state.socket.connecting = false;
    }
}

async function disconnectLocalSocket() {
    if (!supportsLocalSocket()) return;
    const connectionId = state.socket.connectionId;
    state.socket.connectionId = null;
    state.socket.status = 'disconnected';
    state.socket.lastError = '';
    state.socket.lastChatEventAt = 0;
    kickWsEventLogCount = 0;
    kickWsLastEventLogAt = 0;
    logKickWs('Chat socket disconnected.');
    updateSocketState({ status: 'disconnected' });
    try {
        await window.ninjafy.stopKickWebSocket({ connectionId });
    } catch (_) {}
}

// ── Pusher WebSocket (browser-direct chat) ──────────────────────────

function sendPusherFrame(event, data) {
    if (!state.socket.pusherWs || state.socket.pusherWs.readyState !== WebSocket.OPEN) return;
    state.socket.pusherWs.send(JSON.stringify({ event, data }));
}

function disconnectPusherSocket() {
    if (state.socket.pusherPingTimer) {
        clearInterval(state.socket.pusherPingTimer);
        state.socket.pusherPingTimer = null;
    }
    if (state.socket.pusherReconnectTimer) {
        clearTimeout(state.socket.pusherReconnectTimer);
        state.socket.pusherReconnectTimer = null;
    }
    if (state.socket.pusherWs) {
        try { state.socket.pusherWs.close(); } catch (_) {}
        state.socket.pusherWs = null;
    }
    state.socket.pusherStatus = 'disconnected';
}

function schedulePusherReconnect() {
    if (state.socket.pusherReconnectTimer) return;
    state.socket.pusherReconnectTimer = setTimeout(() => {
        state.socket.pusherReconnectTimer = null;
        connectPusherSocket();
    }, PUSHER_RECONNECT_DELAY_MS);
}

function mapPusherEventToPacket(eventName, data) {
    if (eventName === 'App\\Events\\ChatMessageEvent') {
        return { type: 'chat.message.sent', body: data, source: 'socket' };
    }
    if (eventName === 'App\\Events\\ChatMessageDeletedEvent' || eventName === 'App\\Events\\MessageDeletedEvent') {
        return { type: 'chat.message.deleted', body: data, source: 'socket' };
    }
    if (eventName === 'App\\Events\\GiftedSubscriptionsEvent' || eventName === 'App\\Events\\GiftPurchaseEvent') {
        return { type: 'channel.subscription.gifts', body: data, source: 'socket' };
    }
    if (eventName === 'App\\Events\\SubscriptionEvent' || eventName === 'App\\Events\\ChannelSubscriptionEvent') {
        return { type: 'channel.subscription.new', body: data, source: 'socket' };
    }
    if (eventName === 'App\\Events\\UserBannedEvent') {
        return { type: 'chat.user.banned', body: data, source: 'socket' };
    }
    if (eventName === 'App\\Events\\StreamHostEvent') {
        return { type: 'livestream.status.updated', body: data, source: 'socket' };
    }
    return { type: eventName, body: data, source: 'socket' };
}

function handlePusherMessage(event) {
    if (!event?.data) return;
    let payload;
    try {
        payload = JSON.parse(event.data);
    } catch (_) {
        return;
    }
    const eventName = payload?.event;
    if (!eventName) return;

    if (eventName === 'pusher:connection_established') {
        let connectionData = {};
        try { connectionData = JSON.parse(payload.data || '{}'); } catch (_) {}
        state.socket.pusherStatus = 'connected';
        state.socket.status = 'connected';
        updateSocketState({ status: 'connected' });
        log('Pusher chat socket connected.');
        const channels = [];
        if (state.socket.chatroomId) {
            channels.push(`chatrooms.${state.socket.chatroomId}.v2`);
        }
        if (state.socket.channelId) {
            channels.push(`channel.${state.socket.channelId}`);
        }
        for (const channel of channels) {
            sendPusherFrame('pusher:subscribe', { auth: '', channel });
        }
        if (state.socket.pusherPingTimer) clearInterval(state.socket.pusherPingTimer);
        const timeout = connectionData.activity_timeout || 60;
        state.socket.pusherPingTimer = setInterval(() => {
            sendPusherFrame('pusher:ping', {});
        }, Math.min(timeout * 1000 * 0.75, PUSHER_PING_INTERVAL_MS));
        // Pusher is now handling chat — reconnect bridge with noChat if needed
        syncBridgeChatMode();
        return;
    }

    if (eventName === 'pusher_internal:subscription_succeeded') {
        const channelName = payload.channel || '';
        log(`Pusher subscribed to: ${channelName}`);
        return;
    }

    if (eventName === 'pusher:ping') {
        sendPusherFrame('pusher:pong', {});
        return;
    }

    if (eventName === 'pusher:pong') return;

    if (eventName === 'pusher:error') {
        log(`Pusher error: ${payload?.data?.message || 'Unknown'}`, 'warning');
        return;
    }

    let data = payload.data;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (_) {}
    }

    const packet = mapPusherEventToPacket(eventName, data);
    if (packet) {
        handleLocalSocketEvent(packet);
    }
}

function connectPusherSocket() {
    if (state.socket.pusherStatus === 'connected' || state.socket.pusherStatus === 'connecting') return;
    const chatroomId = state.socket.chatroomId;
    if (!chatroomId) {
        log('Pusher: no chatroomId available, cannot connect chat.', 'warning');
        return;
    }
    disconnectPusherSocket();
    const url = `${PUSHER_WS_BASE}/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;
    state.socket.pusherStatus = 'connecting';
    state.socket.status = 'connecting';
    updateSocketState({ status: 'connecting' });
    log(`Connecting Pusher chat socket for chatroom ${chatroomId}...`);
    try {
        state.socket.pusherWs = new WebSocket(url);
    } catch (err) {
        log(`Pusher WebSocket failed: ${err?.message || err}`, 'error');
        state.socket.pusherStatus = 'disconnected';
        state.socket.status = 'disconnected';
        updateSocketState({ status: 'error', error: err?.message });
        schedulePusherReconnect();
        return;
    }
    state.socket.pusherWs.addEventListener('message', handlePusherMessage);
    state.socket.pusherWs.addEventListener('close', (event) => {
        log(`Pusher socket closed (code: ${event?.code || 'unknown'}).`);
        state.socket.pusherStatus = 'disconnected';
        state.socket.status = 'disconnected';
        updateSocketState({ status: 'disconnected' });
        schedulePusherReconnect();
        // Pusher down — reconnect bridge with chat enabled as fallback
        syncBridgeChatMode();
    });
    state.socket.pusherWs.addEventListener('error', () => {
        log('Pusher socket error.', 'warning');
    });
}

// ── Channel lookup for Pusher chat ──────────────────────────────────

async function resolveChannelForPusher() {
    if (state.socket.chatroomId) return;
    const slug = state.channelSlug?.trim();
    if (!slug) return;

    // 1. If signed in, resolve channel metadata via official API (broadcaster_user_id, slug, etc)
    const canUseAuthenticatedLookup = Boolean(state.tokens?.access_token) && !isTokenExpired();
    if (canUseAuthenticatedLookup) {
        try {
            await resolveChannelId();
        } catch (err) {
            log(`Channel resolve for Pusher failed: ${err?.message || err}`, 'warning');
        }
        if (state.socket.chatroomId) return;
    }

    // 2. Try bridge cache (fast, no auth needed)
    try {
        const base = getBridgeBaseUrl();
        const lookupResp = await fetch(`${base}/kick/lookup?slug=${encodeURIComponent(slug)}`);
        if (lookupResp.ok) {
            const data = await lookupResp.json();
            if (data.chatroom_id) {
                state.socket.chatroomId = String(data.chatroom_id);
                if (data.broadcaster_user_id && !state.channelId) {
                    state.channelId = Number(data.broadcaster_user_id);
                    state.channelName = data.slug || slug;
                    state.lastResolvedSlug = normalizeChannel(slug);
                }
                log(`Resolved chatroom ${data.chatroom_id} for ${slug} (bridge cache, source: ${data.chatroom_source || 'unknown'}).`);
                return;
            }
            if (data.broadcaster_user_id && !state.channelId) {
                state.channelId = Number(data.broadcaster_user_id);
                state.channelName = data.slug || slug;
                state.lastResolvedSlug = normalizeChannel(slug);
            }
        }
    } catch (err) {
        log(`Bridge lookup failed: ${err?.message || err}`, 'warning');
    }

    // 3. Try legacy kick.com/api/v2 directly (works same-origin on kick.com, may fail elsewhere)
    try {
        const legacyResp = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`);
        if (legacyResp.ok) {
            const data = await legacyResp.json();
            const chatroomId = data?.chatroom?.id ?? data?.chatroom_id;
            if (chatroomId) {
                state.socket.chatroomId = String(chatroomId);
                const broadcasterId = data?.user_id ?? data?.broadcaster_user_id;
                if (broadcasterId && !state.channelId) {
                    state.channelId = Number(broadcasterId);
                    state.channelName = data?.slug || slug;
                    state.lastResolvedSlug = normalizeChannel(slug);
                }
                log(`Resolved chatroom ${chatroomId} for ${slug} (legacy API direct).`);
                // Save to bridge cache if signed in
                postChatroomToCache(slug, chatroomId, broadcasterId);
                return;
            }
        }
    } catch (_) {
        // Cloudflare block or CORS — expected, not an error
    }

    log('Could not resolve chatroomId. Sign in or pass ?chatroom_id= URL param.', 'warning');
}

function postChatroomToCache(slug, chatroomId, broadcasterUserId) {
    if (!slug || !chatroomId || !broadcasterUserId) return;
    if (state.bridge.chatroomCacheWriteDisabled) return;
    const token = state.tokens?.access_token;
    if (!token) return;
    try {
        const base = getBridgeBaseUrl();
        const body = {
            slug: slug,
            chatroom_id: Number(chatroomId),
            broadcaster_user_id: Number(broadcasterUserId)
        };
        fetch(`${base}/kick/chatroom-cache`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        }).then(resp => {
            if (resp.ok) {
                state.bridge.chatroomCacheWriteDisabled = false;
                log(`Cached chatroom ${chatroomId} for ${slug} on bridge.`);
            } else if (resp.status === 409) {
                log(`Bridge cache for ${slug} already locked or mismatched.`);
            } else if (resp.status === 401 || resp.status === 403) {
                state.bridge.chatroomCacheWriteDisabled = true;
                log(`Bridge cache write disabled for this session (HTTP ${resp.status}).`, 'warning');
            } else {
                log(`Bridge cache POST returned ${resp.status}.`, 'warning');
            }
        }).catch(() => {});
    } catch (_) {}
}

async function startAuthFlow() {
    logKickWs('Sign-in clicked.');

    // DIAGNOSTIC LOGGING - remove after debugging
    const isElectron = isElectronEnvironment();
    const authMethod = localStorage.getItem('kickAuthMethod') || 'external';

    // Use external browser auth if in Electron and user prefers it
    if (isElectron) {
        if (authMethod === 'external') {
            return startExternalAuthFlow();
        }
        // Fall through to local redirect auth
    }

    if (!state.clientId) {
        log('Missing Kick client ID. Please refresh this page and try again.', 'error');
        return;
    }
    const verifier = generateRandomString(64);
    const challenge = await createCodeChallenge(verifier);
    const stateParam = generateRandomString(32);
    sessionStorage.setItem(CODE_VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, stateParam);

    const redirectUri = state.redirectUri || window.location.origin + window.location.pathname;
    if (!state.redirectUri) {
        state.redirectUri = redirectUri;
        persistConfig();
    }
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: state.clientId,
        redirect_uri: redirectUri,
        scope: 'user:read channel:read channel:write chat:write events:subscribe moderation:ban moderation:chat_message:manage',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: stateParam
    });

    const authorizeUrl = `https://id.kick.com/oauth/authorize?${params.toString()}`;
    window.location.href = authorizeUrl;
}

async function startExternalAuthFlow() {
    if (!state.clientId) {
        log('Missing Kick client ID. Please refresh this page and try again.', 'error');
        return;
    }

    // Try ninjafy first (full preload), then __ssapp (mock preload)
    const startOAuthFn = (window.ninjafy && typeof window.ninjafy.startKickOAuth === 'function')
        ? window.ninjafy.startKickOAuth
        : (window.__ssapp && typeof window.__ssapp.startKickOAuth === 'function')
            ? window.__ssapp.startKickOAuth
            : null;

    if (!startOAuthFn) {
        log('OAuth not available. Please ensure you are running in the desktop app.', 'error');
        return;
    }

    try {
        logKickWs('Starting external Kick OAuth flow.');
        const result = await startOAuthFn({
            clientId: state.clientId,
            scopes: ['user:read', 'channel:read', 'channel:write', 'chat:write', 'events:subscribe', 'moderation:ban', 'moderation:chat_message:manage']
        });

        if (!result || !result.success || !result.code) {
            log('Kick OAuth did not return an authorization code.', 'error');
            logKickWs('Kick OAuth did not return a code.', 'warning');
            return;
        }

        // The handler returns the code and codeVerifier - exchange for tokens
        const code = result.code;
        const verifier = result.codeVerifier;
        const redirectUri = result.redirectUri;

        // Store the redirect URI for token exchange
        if (redirectUri) {
            state.redirectUri = redirectUri;
            persistConfig();
        }

        try {
            await exchangeCodeForToken(code, verifier);
            updateAuthStatus();
            await loadAuthenticatedProfile();
            await listSubscriptions();
            await maybeAutoStart(true);
            connectPusherSocket();
            connectLocalSocket(true);
        } catch (err) {
            console.error(err);
            log(`Token exchange failed: ${err.message}`, 'error');
        }
    } catch (error) {
        console.error('External Kick OAuth failed:', error);
        log(`Kick sign-in failed: ${error.message}`, 'error');
    }
}

// Expose external auth for Electron trigger
try {
    window.__SSAPP_START_KICK_AUTH__ = startExternalAuthFlow;
} catch (_) {}

async function handleAuthCallback() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    if (!code) return false;

    // Strip callback params immediately to avoid repeated exchanges on reload.
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, document.title, url.toString());

    const expectedState = sessionStorage.getItem(STATE_KEY);
    if (!returnedState || returnedState !== expectedState) {
        log('State mismatch during OAuth callback.', 'error');
        // Validation failed, so bootstrap should continue with normal stored-token initialization.
        return false;
    }
    const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
    if (!verifier) {
        log('Missing PKCE verifier for OAuth exchange.', 'error');
        return false;
    }

    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(CODE_VERIFIER_KEY);

    try {
        await exchangeCodeForToken(code, verifier);
        updateAuthStatus();
        await loadAuthenticatedProfile();
        await listSubscriptions();
        await maybeAutoStart(true);
        connectPusherSocket();
        connectLocalSocket(true);
    } catch (err) {
        console.error(err);
        clearKickAuthState();
        log(`Token exchange failed: ${err.message}`, 'error');
    }
    return true;
}

async function exchangeCodeForToken(code, verifier) {
    const redirectUri = state.redirectUri || (window.location.origin + window.location.pathname);
    const base = getBridgeBaseUrl().replace(/\/$/, '');
    const payload = {
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri
    };

    let response = await fetch(`${base}/kick/callback`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (response.status === 404 || response.status === 405 || response.status === 501) {
        const params = new URLSearchParams();
        params.set('code', code);
        params.set('code_verifier', verifier);
        params.set('redirect_uri', redirectUri);
        response = await fetch(`${base}/kick/callback?${params.toString()}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
    }
    const text = await response.text();
    let data = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (err) {
            if (!response.ok) {
                throw new Error(text);
            }
            throw new Error('Invalid JSON response from Kick bridge.');
        }
    }

    if (!response.ok) {
        const message = data?.error_description || data?.error || text || `HTTP ${response.status}`;
        throw new Error(message);
    }
    if (!data.access_token) {
        throw new Error('Kick bridge did not return an access token.');
    }

    const now = Date.now();
    state.tokens = {
        ...(state.tokens || {}),
        ...data,
        expires_at: now + (data.expires_in || 0) * 1000
    };
    state.bridge.chatroomCacheWriteDisabled = false;
    persistTokens();
    scheduleTokenRefresh();
    log('Kick OAuth tokens obtained.');
    logKickWs('Kick OAuth tokens obtained.');
}

function scheduleTokenRefresh() {
    if (!state.tokens?.refresh_token || !state.tokens?.expires_at) return;
    if (state.refreshTimer) {
        clearTimeout(state.refreshTimer);
    }
    const now = Date.now();
    const ttl = state.tokens.expires_at - now - 60 * 1000; // refresh 60s before expiry
    if (ttl <= 0) {
        refreshAccessToken().catch(err => console.error('Refresh failed', err));
        return;
    }
    state.refreshTimer = setTimeout(() => {
        refreshAccessToken().catch(err => console.error('Refresh failed', err));
    }, ttl);
}

function isKickInvalidGrantError(data, text) {
    const parts = [
        data?.error,
        data?.error_description,
        text
    ]
        .filter(Boolean)
        .map(value => String(value).toLowerCase());
    return parts.some(part => part.includes('invalid_grant'));
}

function clearKickAuthState(reason = '') {
    state.tokens = null;
    state.authUser = null;
    state.bridge.chatroomCacheWriteDisabled = false;
    clearPendingKickChatEchoes();
    if (state.refreshTimer) {
        clearTimeout(state.refreshTimer);
        state.refreshTimer = null;
    }
    persistTokens();
    updateAuthStatus();
    if (els.subscriptionSummary) {
        els.subscriptionSummary.textContent = 'Sign in required';
        els.subscriptionSummary.className = 'status-chip warning';
    }
    if (reason) {
        log(reason, 'warning');
    }
}

async function refreshAccessToken() {
    if (!state.tokens?.refresh_token) {
        throw new Error('Not authenticated.');
    }
    if (state.refreshPromise) {
        return state.refreshPromise;
    }
    state.refreshPromise = (async () => {
        const base = getBridgeBaseUrl().replace(/\/$/, '');
        const response = await fetch(`${base}/kick/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: state.tokens.refresh_token
            })
        });
        const text = await response.text();
        let data = {};
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (err) {
                console.error('Refresh parse error:', err);
            }
        }

        if (!response.ok || !data.access_token) {
            const message = data?.error_description || data?.error || text || `HTTP ${response.status}`;
            if (response.status === 401 && isKickInvalidGrantError(data, text)) {
                clearKickAuthState('Kick session expired or was revoked. Please sign in again.');
                throw new Error(`Kick refresh rejected: ${message}`);
            }
            throw new Error(`Kick refresh failed (${response.status}): ${message}`);
        }

        const now = Date.now();
        state.tokens = {
            ...(state.tokens || {}),
            ...data,
            expires_at: now + (data.expires_in || 0) * 1000
        };
        persistTokens();
        scheduleTokenRefresh();
        updateAuthStatus();
        log('Access token refreshed.');
    })();
    try {
        return await state.refreshPromise;
    } finally {
        state.refreshPromise = null;
    }
}

function isTokenExpired() {
    if (!state.tokens?.expires_at) return true;
    return Date.now() >= state.tokens.expires_at;
}

async function ensureToken() {
    if (!state.tokens?.access_token) throw new Error('Not authenticated.');
    if (isTokenExpired()) {
        await refreshAccessToken();
    }
    if (!state.tokens?.access_token) throw new Error('Not authenticated.');
    return state.tokens.access_token;
}

async function apiFetch(path, options = {}, retry = true) {
    const token = await ensureToken();
    const fetchOptions = { ...options };
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        ...(options.headers || {})
    };
    if (state.clientId) {
        if (!headers['Client-ID']) {
            headers['Client-ID'] = state.clientId;
        }
        if (!headers['Client-Id']) {
            headers['Client-Id'] = state.clientId;
        }
    }
    if (fetchOptions.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    fetchOptions.headers = headers;
    const res = await fetch(`https://api.kick.com${path}`, fetchOptions);
    if (res.status === 401 && retry) {
        if (!state.tokens?.refresh_token) {
            clearKickAuthState('Kick session is no longer valid. Please sign in again.');
            throw new Error('Not authenticated.');
        }
        await refreshAccessToken();
        if (!state.tokens?.access_token) {
            throw new Error('Not authenticated.');
        }
        return apiFetch(path, options, false);
    }
    if (res.status === 401) {
        clearKickAuthState('Kick session is no longer valid. Please sign in again.');
        throw new Error('Not authenticated.');
    }
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Kick API ${res.status}: ${body}`);
    }
    if (res.status === 204) {
        return null;
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return res.json();
    }
    return res.text();
}

function updateKickStreamEditorFields(channel) {
    if (!channel || typeof channel !== 'object') {
        return;
    }
    const values = extractKickStreamEditorValues(channel);
    if (els.streamTitle && values.title) {
        els.streamTitle.value = values.title;
    }
    if (els.streamCategory && values.category) {
        els.streamCategory.value = values.category;
    }
}

function extractKickStreamEditorValues() {
    const titleCandidates = [];
    const categoryCandidates = [];
    for (const source of arguments) {
        if (!source || typeof source !== 'object') {
            continue;
        }
        titleCandidates.push(
            source.stream_title,
            source.streamTitle,
            source.title,
            source.stream?.title,
            source.stream?.stream_title
        );
        categoryCandidates.push(
            source.category?.name,
            source.category_name,
            source.category?.slug,
            source.category,
            source.streamCategory
        );
    }
    return {
        title: pickFirstString(titleCandidates, ''),
        category: pickFirstString(categoryCandidates, '')
    };
}

function getAuthenticatedKickChannelIdentity() {
    const slug = normalizeChannel(
        pickFirstString(
            [
                state.authUser?.slug,
                state.authUser?.channel?.slug,
                state.authUser?.user?.slug,
                state.authUser?.username,
                state.tokens?.profile?.slug,
                state.tokens?.profile?.channel?.slug,
                state.tokens?.profile?.user?.slug,
                state.tokens?.profile?.username,
                state.tokens?.username,
                state.tokens?.user_login,
                state.tokens?.userLogin,
                state.tokens?.user_name,
                state.tokens?.userName
            ],
            ''
        )
    );
    const userId = normalizeKickNumericId(
        state.authUser?.id ??
        state.authUser?.user_id ??
        state.authUser?.user?.id ??
        state.authUser?.user?.user_id ??
        state.tokens?.profile?.id ??
        state.tokens?.profile?.user_id ??
        state.tokens?.profile?.user?.id ??
        state.tokens?.profile?.user?.user_id ??
        state.tokens?.user_id ??
        state.tokens?.userId
    );
    return { slug, userId };
}

async function fetchCurrentKickChannelInfo() {
    const selectedSlug = normalizeChannel(state.channelSlug);
    const authIdentity = getAuthenticatedKickChannelIdentity();
    if (selectedSlug && authIdentity.slug && selectedSlug === authIdentity.slug) {
        const data = await apiFetch('/public/v1/channels');
        const channels = unwrapKickChannelPayload(data);
        if (channels[0]) {
            return channels[0];
        }
    }
    if (state.channelSlug) {
        return fetchKickChannelBySlug(normalizeChannel(state.channelSlug));
    }
    if (state.channelId != null) {
        const path = `/public/v1/channels?broadcaster_user_id=${encodeURIComponent(String(state.channelId))}`;
        const data = await apiFetch(path);
        const channels = unwrapKickChannelPayload(data);
        return channels[0] || null;
    }
    const data = await apiFetch('/public/v1/channels');
    const channels = unwrapKickChannelPayload(data);
    return channels[0] || null;
}

async function refreshKickStreamInfo() {
    const channel = await fetchCurrentKickChannelInfo();
    if (!channel) {
        throw new Error('Unable to load current Kick channel information.');
    }
    updateKickStreamEditorFields(channel);
    log('Loaded current Kick stream title/category.', 'info');
    return channel;
}

async function resolveKickCategoryId(value) {
    const query = typeof value === 'string' ? value.trim() : '';
    if (!query) {
        return null;
    }
    if (/^\d+$/.test(query)) {
        return Number(query);
    }
    const data = await apiFetch(`/public/v2/categories?name=${encodeURIComponent(query)}&limit=25`);
    const items = Array.isArray(data?.data) ? data.data : [];
    const exactMatch = items.find(item => (item?.name || '').toLowerCase() === query.toLowerCase());
    const match = exactMatch || items[0];
    return match?.id ?? null;
}

async function updateKickStreamInfoFromInputs() {
    const title = els.streamTitle ? els.streamTitle.value.trim() : '';
    const category = els.streamCategory ? els.streamCategory.value.trim() : '';
    const payload = {};
    if (title) {
        payload.stream_title = title;
    }
    if (category) {
        const categoryId = await resolveKickCategoryId(category);
        if (!categoryId) {
            throw new Error(`Unable to resolve Kick category: ${category}`);
        }
        payload.category_id = Number(categoryId);
    }
    if (!Object.keys(payload).length) {
        throw new Error('Nothing to update.');
    }
    await apiFetch('/public/v1/channels', {
        method: 'PATCH',
        body: JSON.stringify(payload)
    });
    log('Kick stream title/category updated.', 'info');
    // Reflect submitted values immediately — the Kick API caches stale data
    // after a PATCH so an immediate re-fetch would overwrite the inputs with
    // old values.  After a short delay the cache should have cleared.
    if (els.streamTitle && title) els.streamTitle.value = title;
    if (els.streamCategory && category) els.streamCategory.value = category;
    setTimeout(() => {
        refreshKickStreamInfo().catch(() => {});
    }, 3000);
    return true;
}

function resolveKickUserIdForSourceControl(payload = {}) {
    const directUserId = normalizeKickNumericId(payload.userid || payload.userId || payload.user_id);
    if (directUserId) {
        return directUserId;
    }
    const username = normalizeChannel(payload.chatname || payload.username || '');
    if (!username) {
        return null;
    }
    const cached = getCachedProfile({ username });
    const cachedUserId = normalizeKickNumericId(
        cached?.profile?.user_id ||
        cached?.profile?.id ||
        cached?.profile?.user?.user_id
    );
    return cachedUserId || null;
}

async function deleteKickChatMessage(messageId) {
    if (!messageId) {
        return false;
    }
    await apiFetch(`/public/v1/chat/${encodeURIComponent(String(messageId))}`, {
        method: 'DELETE'
    });
    return true;
}

async function banKickUser(payload = {}) {
    const userId = resolveKickUserIdForSourceControl(payload);
    if (!userId) {
        throw new Error(`Unable to resolve Kick user for ${payload.chatname || payload.username || 'unknown user'}.`);
    }
    if (state.channelId == null) {
        await resolveChannelId();
    }
    await apiFetch('/public/v1/moderation/bans', {
        method: 'POST',
        body: JSON.stringify({
            broadcaster_user_id: Number(state.channelId),
            user_id: Number(userId),
            reason: 'Blocked from Social Stream Ninja'
        })
    });
    return true;
}

async function handleSourceControlRequest(request) {
    const payload = request?.payload || {};
    if (normalizeSourceControlPlatform(request?.platform || payload?.type) !== 'kick') {
        return false;
    }
    if (request.control === 'deleteMessage') {
        if (!state.advancedControls.syncDeleteMessages) {
            return false;
        }
        const messageId = resolveKickDeleteMessageId(payload);
        if (!messageId) {
            log('Skipped dock delete: missing native Kick message ID.', 'warning');
            return false;
        }
        await deleteKickChatMessage(messageId);
        log('Synced dock delete to Kick.', 'info');
        return true;
    }
    if (request.control === 'blockUser') {
        if (!state.advancedControls.syncBlockUsers) {
            return false;
        }
        await banKickUser(payload);
        log(`Synced dock block to Kick for ${payload.chatname || payload.username || payload.userid}.`, 'info');
        return true;
    }
    return false;
}

function getKickApiErrorStatus(error) {
    const message = error?.message || '';
    const match = /Kick API\s+(\d+):/i.exec(message);
    if (!match) return null;
    const code = Number(match[1]);
    return Number.isFinite(code) ? code : null;
}

function unwrapKickChannelPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return [];
    }
    const result = [];
    const pushIfObject = (value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result.push(value);
        }
    };
    if (Array.isArray(payload.data)) {
        payload.data.forEach(pushIfObject);
    } else {
        pushIfObject(payload.data);
    }
    pushIfObject(payload.channel);
    if (!result.length) {
        pushIfObject(payload);
    }
    return result;
}

function unwrapKickLivestreamPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return [];
    }
    const result = [];
    const pushIfObject = (value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result.push(value);
        }
    };
    if (Array.isArray(payload.data)) {
        payload.data.forEach(pushIfObject);
    } else {
        pushIfObject(payload.data);
    }
    pushIfObject(payload.livestream);
    pushIfObject(payload.stream);
    if (!result.length) {
        pushIfObject(payload);
    }
    return result;
}

function extractKickChannelSlug(payload) {
    if (!payload || typeof payload !== 'object') {
        return '';
    }
    const candidates = [
        payload?.slug,
        payload?.username,
        payload?.user?.slug,
        payload?.user?.username,
        payload?.channel?.slug,
        payload?.channel?.username
    ];
    for (const candidate of candidates) {
        const normalized = normalizeChannel(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return '';
}

function normalizeKickNumericId(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.floor(value));
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d+$/.test(trimmed)) {
            const parsed = parseInt(trimmed, 10);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }
    return null;
}

function pickKickChannelBySlug(channels, slugLower, options = {}) {
    const list = Array.isArray(channels) ? channels : [];
    if (!list.length) return null;
    const matched = list.find(item => extractKickChannelSlug(item) === slugLower);
    if (matched) {
        return matched;
    }
    if (options.allowSingletonWithoutSlug && list.length === 1 && !extractKickChannelSlug(list[0])) {
        return list[0];
    }
    return null;
}

async function fetchKickLivestreamByBroadcasterId(broadcasterUserIdInput) {
    const broadcasterUserId = normalizeKickNumericId(broadcasterUserIdInput);
    if (broadcasterUserId == null) {
        logKickViewerDebug('Livestream lookup skipped: broadcaster user id is missing/invalid.', 'warning');
        return null;
    }
    const queryId = encodeURIComponent(String(broadcasterUserId));
    const paths = [
        `/public/v1/livestreams?broadcaster_user_id[]=${queryId}`,
        `/livestreams?broadcaster_user_id[]=${queryId}`
    ];
    let lastError = null;
    for (const path of paths) {
        try {
            logKickViewerDebug(`Livestream lookup request: ${path}`);
            const data = await apiFetch(path);
            const livestreams = unwrapKickLivestreamPayload(data);
            if (!livestreams.length) {
                logKickViewerDebug(`Livestream lookup returned no rows via ${path}.`);
                return null;
            }
            logKickViewerDebug(`Livestream lookup succeeded via ${path} with ${livestreams.length} row(s).`);
            const matchedLivestream = livestreams.find(item => {
                const itemId = normalizeKickNumericId(
                    item?.broadcaster_user_id ??
                    item?.user_id ??
                    item?.channel?.broadcaster_user_id
                );
                return itemId === broadcasterUserId;
            });
            if (matchedLivestream) {
                return matchedLivestream;
            }
            const returnedIds = livestreams
                .map(item => normalizeKickNumericId(
                    item?.broadcaster_user_id ??
                    item?.user_id ??
                    item?.channel?.broadcaster_user_id
                ))
                .filter(itemId => itemId != null)
                .slice(0, 5);
            logKickViewerDebug(
                `Livestream lookup via ${path} returned ${livestreams.length} row(s), but none matched broadcaster id=${broadcasterUserId}. Sample ids=${returnedIds.length ? returnedIds.join(',') : 'none'}.`,
                'warning'
            );
            continue;
        } catch (err) {
            lastError = err;
            const status = getKickApiErrorStatus(err);
            if (status === 400 || status === 404 || status === 405 || status === 501) {
                logKickViewerDebug(`Livestream lookup path failed (${path}): status=${status}.`, 'warning');
                continue;
            }
            logKickViewerDebug(`Livestream lookup path failed (${path}): ${err?.message || err}`, 'warning');
            throw err;
        }
    }
    if (lastError) {
        throw lastError;
    }
    return null;
}

async function fetchKickChannelBySlug(slugInput, options = {}) {
    const debugContext = typeof options?.debugContext === 'string' ? options.debugContext.trim() : '';
    const slugLower = normalizeChannel(slugInput);
    if (!slugLower) {
        return null;
    }
    const encodedSlug = encodeURIComponent(slugLower);
    const fallbackPaths = [
        `/public/v1/channels?slug=${encodedSlug}`,
        `/channels/${encodedSlug}`,
        `/public/v1/channels/${encodedSlug}`
    ];
    const paths = [];
    if (preferredKickChannelLookupPath) {
        paths.push(preferredKickChannelLookupPath.replace('{slug}', encodedSlug));
    }
    for (const path of fallbackPaths) {
        if (!paths.includes(path)) {
            paths.push(path);
        }
    }
    let lastError = null;
    for (const path of paths) {
        try {
            if (debugContext) {
                logKickViewerDebug(`${debugContext}: request ${path}`);
            }
            const data = await apiFetch(path);
            const channel = pickKickChannelBySlug(unwrapKickChannelPayload(data), slugLower, {
                allowSingletonWithoutSlug: !path.includes('?slug=')
            });
            if (channel && typeof channel === 'object') {
                if (path.includes('?slug=')) {
                    preferredKickChannelLookupPath = '/public/v1/channels?slug={slug}';
                } else if (path.includes('/public/v1/channels/')) {
                    preferredKickChannelLookupPath = '/public/v1/channels/{slug}';
                } else if (path.includes('/channels/')) {
                    preferredKickChannelLookupPath = '/channels/{slug}';
                }
                if (debugContext) {
                    logKickViewerDebug(`${debugContext}: success via ${path}`);
                }
                return channel;
            }
            if (debugContext) {
                logKickViewerDebug(`${debugContext}: payload via ${path} did not match @${slugLower}.`, 'warning');
            }
        } catch (err) {
            lastError = err;
            const status = getKickApiErrorStatus(err);
            if (status === 400 || status === 404 || status === 405 || status === 501) {
                if (debugContext) {
                    logKickViewerDebug(`${debugContext}: path failed ${path} status=${status}`, 'warning');
                }
                if (
                    preferredKickChannelLookupPath &&
                    path === preferredKickChannelLookupPath.replace('{slug}', encodedSlug)
                ) {
                    preferredKickChannelLookupPath = '';
                }
                continue;
            }
            if (debugContext) {
                logKickViewerDebug(`${debugContext}: path failed ${path} error=${err?.message || err}`, 'warning');
            }
            throw err;
        }
    }
    if (lastError) {
        throw lastError;
    }
    if (debugContext) {
        logKickViewerDebug(`${debugContext}: no channel payload found for @${slugLower}.`, 'warning');
    }
    return null;
}

function extractProfileFromTokens() {
    const tokens = state.tokens || {};
    if (!tokens) return null;
    const candidates = [tokens.profile, tokens.user, tokens.account];
    for (const candidate of candidates) {
        if (candidate && typeof candidate === 'object') {
            return candidate;
        }
    }
    const slug =
        tokens.username ||
        tokens.user_login ||
        tokens.userLogin ||
        tokens.user_name ||
        tokens.userName ||
        '';
    if (!slug) {
        return null;
    }
    return {
        id: tokens.user_id || tokens.userId || null,
        username: slug,
        display_name: tokens.display_name || tokens.user_display_name || slug,
        slug
    };
}

function unwrapKickProfile(payload) {
    if (!payload || typeof payload === 'string') {
        return null;
    }
    if (Array.isArray(payload)) {
        return payload.find(item => item && typeof item === 'object') || null;
    }
    if (typeof payload !== 'object') {
        return null;
    }
    const dataField = payload.data;
    if (Array.isArray(dataField)) {
        return dataField.find(item => item && typeof item === 'object') || null;
    }
    if (dataField && typeof dataField === 'object') {
        return dataField;
    }
    for (const key of ['profile', 'user', 'account']) {
        const candidate = payload[key];
        if (!candidate) continue;
        if (Array.isArray(candidate)) {
            const found = candidate.find(item => item && typeof item === 'object');
            if (found) return found;
        } else if (typeof candidate === 'object') {
            return candidate;
        }
    }
    if (payload && Object.keys(payload).length > 0) {
        return payload;
    }
    return null;
}

function applyAuthenticatedProfile(profile, idsHint = null) {
    if (!profile || typeof profile !== 'object') {
        return null;
    }
    state.authUser = profile;
    if (idsHint) {
        rememberProfile(profile, idsHint, state.tokens, state.tokens?.profile, { username: state.channelSlug });
    } else {
        rememberProfile(profile, state.tokens, state.tokens?.profile, { username: state.channelSlug });
    }
    const username = pickFirstString(
        [
            profile.display_name,
            profile.displayName,
            profile.username,
            profile.name,
            profile.user?.display_name,
            profile.user?.username
        ],
        ''
    );
    if (username) {
        state.channelName = username;
    }
    const slug = pickFirstString(
        [
            profile.slug,
            profile.channel?.slug,
            profile.user?.slug,
            profile.username,
            idsHint?.username
        ],
        ''
    );
    if (slug && !state.channelSlug) {
		setChannelSlug(slug, { source: 'profile' });
	}
    return profile;
}

async function loadAuthenticatedProfile() {
    if (!state.tokens?.access_token) return null;
    const cacheIds = resolveProfileIdentifiers(
        state.authUser,
        state.tokens?.profile,
        state.tokens,
        { username: state.channelSlug }
    );
    const cached = cacheIds ? getCachedProfile(cacheIds) : undefined;
    if (cached !== undefined) {
        if (cached.hasProfile && cached.profile) {
            return applyAuthenticatedProfile(cached.profile, cacheIds);
        }
        return null;
    }
    if (state.profilePromise) {
        return state.profilePromise;
    }
    state.profilePromise = (async () => {
        const endpoints = [
            {
                path: '/public/v1/users',
                notFoundMessage:
                    'Kick user details endpoint is still rolling out for this app. Continuing with sign-in information.'
            }
        ];
        for (const endpoint of endpoints) {
            try {
                const data = await apiFetch(endpoint.path);
                const profile = unwrapKickProfile(data);
                if (profile && typeof profile === 'object') {
                    return applyAuthenticatedProfile(profile, cacheIds);
                }
            } catch (err) {
                const message = err?.message || '';
                if (/404/.test(message)) {
                    if (endpoint.notFoundMessage) {
                        log(endpoint.notFoundMessage, 'warning');
                    }
                } else {
                    console.error(`Failed to load Kick profile via ${endpoint.path}`, err);
                    log(
                        `Unable to load Kick profile (${endpoint.path}): ${message || 'unknown error'}`,
                        'warning'
                    );
                }
            }
        }
        const fallback = extractProfileFromTokens();
        if (fallback) {
            return applyAuthenticatedProfile(fallback, cacheIds);
        }
        if (cacheIds) {
            rememberProfileMiss(cacheIds);
        }
        return null;
    })();
    state.profilePromise.finally(() => {
        state.profilePromise = null;
    });
    return state.profilePromise;
}

async function fetchEventTypes(force = false) {
    const now = Date.now();
    if (!force) {
        if (state.eventTypesUnavailable && eventTypesUnavailableUntil && now < eventTypesUnavailableUntil) {
            return Array.isArray(cachedEventTypes) ? cachedEventTypes : [];
        }
        if (
            Array.isArray(cachedEventTypes) &&
            cachedEventTypesFetchedAt &&
            now - cachedEventTypesFetchedAt < EVENT_TYPES_CACHE_TTL_MS
        ) {
            return cachedEventTypes;
        }
    }
    try {
        const data = await apiFetch('/public/v1/events/types');
        const list = Array.isArray(data?.data) ? data.data : [];
        setCachedEventTypes(list);
        return list;
    } catch (err) {
        const message = err?.message || '';
        const wasUnavailable = state.eventTypesUnavailable;
        if (/404/.test(message)) {
            markEventTypesUnavailable();
            if (!wasUnavailable) {
                log('Kick has not published the event type list for this app yet. Using the default set instead.', 'warning');
            }
        } else {
            log(`Unable to fetch event types: ${message}`, 'error');
        }
        return Array.isArray(cachedEventTypes) ? cachedEventTypes : [];
    }
}

function parseCustomEvents(value) {
    if (!value) return [];
    return value.split(/[,\s]+/).map(item => item.trim()).filter(Boolean);
}

function deriveEventSubscriptions(types) {
    const defaults = [
        'chat.message.sent',
        'channel.followed',
        'channel.subscription.new',
        'channel.subscription.renewal',
        'channel.subscription.gifts',
        'livestream.status.updated'
    ];
    const subscriptions = [];
    const seen = new Set();
    const sourceTypes = Array.isArray(types) ? types : [];
    const available = new Map(sourceTypes.map(item => [item.name, item]));
    const donationCandidates = sourceTypes
        .filter(item => /(support|donat|tip|kick)/i.test(item.name))
        .map(item => item.name);
    const customNames = parseCustomEvents(state.customEvents);
    for (const name of [...defaults, ...customNames, ...donationCandidates]) {
        if (!name || seen.has(name)) continue;
        const definition = available.get(name);
        subscriptions.push({ name, version: definition?.version || 1 });
        seen.add(name);
    }
    return subscriptions;
}

function getSubscriptionEventName(entry) {
    if (!entry || typeof entry !== 'object') return '';
    const tryValue = value => {
        if (!value) return '';
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'object') {
            return (
                value.name ||
                value.event ||
                value.type ||
                value.event_type ||
                value.topic ||
                ''
            );
        }
        return '';
    };
    // Try direct fields first
    let result = (
        tryValue(entry.event) ||
        tryValue(entry.name) ||
        tryValue(entry.event_name) ||
        tryValue(entry.event_type) ||
        tryValue(entry.type) ||
        tryValue(entry.topic) ||
        tryValue(entry.data) ||
        tryValue(entry.payload) ||
        tryValue(entry.definition) ||
        tryValue(entry.subscription) ||
        ''
    );
    // Try nested events array (Kick may return events as array)
    if (!result && Array.isArray(entry.events) && entry.events.length > 0) {
        result = tryValue(entry.events[0]);
    }
    return result;
}

function formatEventLabel(name) {
    if (!name) return 'event';
    return name
        .split('.')
        .map(part => part ? part.charAt(0).toUpperCase() + part.slice(1) : part)
        .join(' ');
}

function formatKickSubscriptionError(name, rawError) {
    const text = typeof rawError === 'string' ? rawError : rawError?.message || '';
    const eventLabel = formatEventLabel(name);
    if (!text) {
        return `Kick did not confirm ${eventLabel}.`;
    }
    if (/rate limit token/i.test(text) || /retry quota exceeded/i.test(text)) {
        return `Kick temporarily rate-limited ${eventLabel}. Retrying in about ${Math.round(SUBSCRIPTION_RETRY_DELAY_MS / 1000)} seconds.`;
    }
    if (/already exists/i.test(text) || /duplicate/i.test(text)) {
        return `${eventLabel} is already active on Kick.`;
    }
    if (/not authorized/i.test(text)) {
        return `Kick reported that ${eventLabel} isn't enabled for this account. Double-check your Kick developer app scopes.`;
    }
    return `${eventLabel} could not be enabled (Kick replied: ${text})`;
}

function clearSubscriptionRetryTimer() {
    const bucket = state.subscriptionRetry;
    if (bucket?.timer) {
        clearTimeout(bucket.timer);
        bucket.timer = null;
    }
}

function scheduleSubscriptionRetry(delayMs = SUBSCRIPTION_RETRY_DELAY_MS) {
    const bucket = state.subscriptionRetry;
    if (!bucket) {
        return;
    }
    if (bucket.timer) {
        return;
    }
    const delay = Math.max(delayMs, 1000);
    bucket.delayMs = delay;
    bucket.timer = setTimeout(() => {
        bucket.timer = null;
        try {
            maybeAutoStart(true);
        } catch (err) {
            console.error('Kick subscription retry failed to start', err);
        }
    }, delay);
    console.info('[Kick] Scheduling subscription retry in', delay, 'ms');
}

function reportSubscriptionResults(response, requested) {
    const items = Array.isArray(response?.data) ? response.data : [];
    if (!items.length) {
        log('Subscription request submitted.', 'info');
        return;
    }
    const failures = items.filter(item => item?.error);
    const successes = items.filter(item => !item?.error);
    if (successes.length) {
        log(`Subscribed to ${successes.length} event(s).`);
    }
    let scheduledRetry = false;
    failures.forEach(item => {
        const rawError = item?.error;
        const errorText =
            typeof rawError === 'string'
                ? rawError
                : rawError?.message || rawError?.detail || '';
        const isRateLimited = /rate limit token/i.test(errorText) || /retry quota exceeded/i.test(errorText);
        if (isRateLimited && !scheduledRetry) {
            scheduleSubscriptionRetry();
            scheduledRetry = true;
        }
        const message = formatKickSubscriptionError(item?.name, item?.error);
        log(message, 'warning');
        console.warn('Kick subscription error', item);
    });
    const requestedNames = new Set((requested || []).map(evt => evt.name));
    const missing = [...requestedNames].filter(name => !items.some(item => item.name === name));
    if (missing.length) {
        log(`No response returned for: ${missing.join(', ')}`, 'warning');
    }
}

async function resolveChannelId(force = false) {
    const slugInput = state.channelSlug?.trim();
    if (!slugInput) throw new Error('Channel slug required.');
    const slugLower = normalizeChannel(slugInput);
    if (!force && state.channelId && state.lastResolvedSlug === slugLower) {
        log(`Using cached channel ID: ${state.channelId} for slug: ${slugLower}`);
        return state.channelId;
    }
    const previousId = state.channelId;
    const previousSlug = state.lastResolvedSlug;
    log(`Resolving channel ID for slug: ${slugLower}`);
    const channel = await fetchKickChannelBySlug(slugLower);
    if (!channel?.broadcaster_user_id) {
        log(`Channel API response did not include broadcaster_user_id for slug: ${slugLower}`, 'warning');
        throw new Error('Unable to resolve channel user id.');
    }
    const resolvedChatroomId =
        channel?.chatroom_id ??
        channel?.chatroom?.id ??
        channel?.chatroomId ??
        null;
    const resolvedSocketChannelId =
        channel?.channel_id ??
        channel?.chatroom?.channel_id ??
        channel?.channelId ??
        channel?.id ??
        null;
    state.channelId = channel.broadcaster_user_id;
    state.channelName = channel.slug || channel.channel_description || slugInput;
    state.lastResolvedSlug = slugLower;
    if (!state.socket.userId && state.channelId != null) {
        state.socket.userId = String(state.channelId);
    }
    if (resolvedChatroomId != null) {
        state.socket.chatroomId = String(resolvedChatroomId);
        postChatroomToCache(slugLower, resolvedChatroomId, channel.broadcaster_user_id);
    }
    if (resolvedSocketChannelId != null) {
        state.socket.channelId = String(resolvedSocketChannelId);
    }
    const initialViewerCount = extractKickViewerCount(channel);
    if (initialViewerCount != null) {
        logKickViewerDebug(`Channel resolve included viewer_count=${initialViewerCount}.`);
        emitKickViewerUpdate(initialViewerCount);
        const liveFlag = extractKickLiveFlag(channel);
        if (typeof liveFlag === 'boolean') {
            kickViewerHeartbeat.isLive = liveFlag;
        }
    } else {
        logKickViewerDebug('Channel resolve did not include viewer_count; waiting for heartbeat snapshot.', 'warning');
    }
    persistConfig();
    log(`Resolved channel: ${state.channelName} (ID: ${state.channelId})`);
    updateInputsFromState();
    refreshKickStreamInfo().catch((err) => {
        logKickWs(`Unable to refresh Kick stream info after channel resolve: ${err?.message || err}`, 'warning');
    });
    if (force || state.channelId !== previousId || previousSlug !== slugLower) {
        requestThirdPartyEmotes({ force: true });
    }
    // Replay any events that were queued before channel resolution
    replayPendingBridgeEvents();
    // Connect Pusher chat socket now that chatroomId may be available
    connectPusherSocket();
    // Reconnect local socket if ninjafy is available
    if (
        supportsLocalSocket() &&
        (state.socket.chatroomId || state.socket.channelId || state.socket.userId || state.channelId) &&
        state.socket.status !== 'connected'
    ) {
        connectLocalSocket(true);
    }
    void sendKickViewerHeartbeat('channel_resolved');
    return state.channelId;
}

async function subscribeToEvents(options = {}) {
    if (!state.tokens?.access_token) {
        log('Sign in required before subscribing to Kick events.', 'warning');
        return;
    }
    const { events: presetEvents = null, skipListRefresh = false } = options || {};
    try {
        await resolveChannelId();
    } catch (err) {
        log(err.message, 'error');
        return;
    }
    try {
        let events = Array.isArray(presetEvents) ? presetEvents : null;
        if (!events) {
            const eventTypes = await fetchEventTypes();
            events = deriveEventSubscriptions(eventTypes);
        }
        if (!events.length) {
            log('No event types available for subscription. Try signing in again.', 'error');
            return;
        }
        log(`Requesting subscriptions: ${events.map(evt => evt.name).join(', ')}`);
        const payload = {
            method: 'webhook',
            broadcaster_user_id: state.channelId,
            events
        };
        const response = await apiFetch('/public/v1/events/subscriptions', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        reportSubscriptionResults(response, events);
        if (!skipListRefresh) {
            await listSubscriptions();
        }
        return response;
    } catch (err) {
        console.error(err);
        log(`Subscription failed: ${err.message}`, 'error');
    }
}

async function listSubscriptions() {
    if (!state.tokens?.access_token) {
        if (els.subscriptionSummary) {
            els.subscriptionSummary.textContent = 'Sign in required';
            els.subscriptionSummary.className = 'status-chip warning';
        }
        return [];
    }
    try {
        const data = await apiFetch('/public/v1/events/subscriptions');
        const items = Array.isArray(data?.data) ? data.data : [];
        renderSubscriptions(items);
        return items;
    } catch (err) {
        console.error(err);
        log(`Failed to list subscriptions: ${err.message}`, 'error');
        if (els.subscriptionSummary) {
            els.subscriptionSummary.textContent = 'Subscriptions unavailable';
            els.subscriptionSummary.className = 'status-chip danger';
            els.subscriptionSummary.title = `Failed to list subscriptions: ${err.message}`;
        }
        return [];
    }
}

function renderSubscriptions(items) {
    if (!els.subscriptionSummary) return;
    const list = Array.isArray(items) ? items : [];
    const channelIdKey = state.channelId != null ? String(state.channelId) : null;
    const relevant = channelIdKey
        ? list.filter(item => String(item?.broadcaster_user_id || '') === channelIdKey)
        : list;
    const eventNames = relevant.map(getSubscriptionEventName).filter(Boolean);
    const summary = els.subscriptionSummary;

    if (!list.length) {
        summary.textContent = 'Subscriptions syncing';
        summary.className = 'status-chip warning';
        summary.title = 'No subscriptions detected yet. They will be created automatically after sign-in.';
        return;
    }

    if (!eventNames.length) {
        // Even if we can't parse event names, show count of relevant subscriptions
        if (relevant.length > 0) {
            summary.textContent = `Subscriptions active (${relevant.length})`;
            summary.className = 'status-chip';
            summary.title = `${relevant.length} subscription(s) registered for this channel.`;
            return;
        }
        if (channelIdKey && list.length) {
            const attachedBroadcasterIds = Array.from(
                new Set(
                    list
                        .map(item => String(item?.broadcaster_user_id || '').trim())
                        .filter(Boolean)
                )
            );
            const targetSlug = (state.channelSlug || '').trim();
            summary.textContent = targetSlug
                ? `No access to @${targetSlug} subscription feed`
                : 'No access to this channel subscription feed';
            summary.className = 'status-chip warning';
            summary.title = attachedBroadcasterIds.length
                ? `Webhook subscriptions are currently attached to broadcaster ID(s): ${attachedBroadcasterIds.join(', ')}. Chat can still work here.`
                : 'No channel-scoped subscriptions found for this target yet.';
            return;
        }
        summary.textContent = 'Subscriptions syncing';
        summary.className = 'status-chip warning';
        summary.title = 'Kick has not confirmed channel-scoped subscriptions yet. This usually resolves shortly.';
        return;
    }

    summary.textContent = `Subscriptions active (${eventNames.length})`;
    summary.className = 'status-chip';
    summary.title = `Active events: ${eventNames.join(', ')}`;
}

async function maybeAutoStart(force = false) {
    if (!state.tokens?.access_token) return;
    const slug = state.channelSlug?.trim();
    if (!slug) return;

    clearSubscriptionRetryTimer();

    const normalizedSlug = normalizeChannel(slug);
    if (state.autoStart.running) {
        if (force) {
            state.autoStart.pendingForce = true;
        }
        return;
    }
    if (
        !force &&
        state.autoStart.lastSlug === normalizedSlug &&
        (state.bridge.status === 'connected' || state.bridge.status === 'connecting')
    ) {
        return;
    }

    state.autoStart.running = true;
    state.autoStart.pendingForce = false;
    try {
        let channelId;
        try {
            channelId = await resolveChannelId();
        } catch (err) {
            log(err.message, 'error');
            return;
        }

        if (state.bridge.status === 'disconnected' || !state.bridge.source) {
            connectBridge();
        }

        const eventTypes = await fetchEventTypes();
        const desiredEvents = deriveEventSubscriptions(eventTypes);
        const desiredNames = desiredEvents
            .map(evt => evt?.name || evt?.event || evt?.type || '')
            .filter(Boolean);

        const existing = await listSubscriptions();
        const channelIdKey = channelId != null ? String(channelId) : null;
        const forChannel = channelIdKey
            ? existing.filter(item => String(item?.broadcaster_user_id || '') === channelIdKey)
            : existing;
        const existingNames = new Set(forChannel.map(getSubscriptionEventName).filter(Boolean));
        const missing = force
            ? desiredNames
            : desiredNames.filter(name => !existingNames.has(name));

        if (missing.length) {
            log(`Auto-subscribing to: ${missing.join(', ')}`);
            await subscribeToEvents({ events: desiredEvents, skipListRefresh: true });
            await listSubscriptions();
        }

        state.autoStart.lastSlug = normalizedSlug;
    } catch (err) {
        console.error('Auto-start failed', err);
    } finally {
        state.autoStart.running = false;
        if (state.autoStart.pendingForce) {
            state.autoStart.pendingForce = false;
            maybeAutoStart(true);
        }
    }
}

function syncBridgeChatMode() {
    if (!state.tokens?.access_token) return;
    const pusherActive = state.socket.pusherStatus === 'connected';
    const bridgeChatDisabled = state.bridge.chatDisabled;
    // If Pusher just connected and bridge has chat enabled, reconnect with noChat
    // If Pusher just disconnected and bridge has chat disabled, reconnect with chat
    if (pusherActive && !bridgeChatDisabled && state.bridge.status === 'connected') {
        log('Pusher connected — reconnecting bridge with noChat.');
        connectBridge();
    } else if (!pusherActive && bridgeChatDisabled && state.bridge.status === 'connected') {
        log('Pusher disconnected — reconnecting bridge with chat fallback.');
        connectBridge();
    }
}

function connectBridge() {
    if (!state.tokens?.access_token) {
        log('Bridge requires sign-in.', 'info');
        return;
    }
    state.bridgeUrl = state.bridgeUrl || DEFAULT_CONFIG.bridgeUrl;
    if (!state.bridgeUrl) {
        log('Unable to determine Kick bridge URL.', 'error');
        return;
    }
    disconnectBridge();
    const pusherActive = state.socket.pusherStatus === 'connected';
    try {
        let bridgeUrl = state.bridgeUrl;
        if (state.channelId) {
            bridgeUrl = appendBridgeParam(bridgeUrl, 'channel', String(state.channelId));
        }
        if (pusherActive) {
            bridgeUrl = appendBridgeParam(bridgeUrl, 'noChat', '1');
            log('Bridge connected with noChat (Pusher handles chat).');
        }
        state.bridge.chatDisabled = pusherActive;
        const source = new EventSource(bridgeUrl, { withCredentials: false });
        state.bridge.source = source;
        state.bridge.status = 'connecting';
        kickViewerHeartbeat.isLive = null;
        updateBridgeState();

        source.onopen = () => {
            state.bridge.status = 'connected';
            state.bridge.lastErrorLoggedAt = Date.now();
            updateBridgeState();
            log('Connected to webhook bridge.');
        };

        source.onerror = () => {
            const now = Date.now();
            const lastLogged = state.bridge.lastErrorLoggedAt || 0;
            const shouldLog = !lastLogged || now - lastLogged > 10000;
            if (shouldLog) {
                const wasConnected = state.bridge.status === 'connected';
                const severity = wasConnected ? 'warning' : 'error';
                const message = wasConnected
                    ? 'Bridge connection interrupted. Retrying shortly...'
                    : 'Unable to reach the bridge. Retrying shortly...';
                log(message, severity);
                state.bridge.lastErrorLoggedAt = now;
            }
            state.bridge.status = 'disconnected';
            updateBridgeState();
            try {
                source.close();
            } catch (_) {
                // Ignore close errors; we'll replace the source during retry.
            }
            if (state.bridge.source === source) {
                state.bridge.source = null;
            }
            scheduleBridgeRetry();
        };

        source.onmessage = evt => {
            if (!evt.data) return;
            try {
                const packet = JSON.parse(evt.data);
                handleBridgeEvent(packet);
            } catch (err) {
                console.error('Bridge message parse error', err, evt.data);
            }
        };
    } catch (err) {
        console.error('Bridge connection failed', err);
        log('Unable to connect to bridge: ' + err.message, 'error');
        scheduleBridgeRetry();
    }
}

function disconnectBridge() {
    if (state.bridge.retryTimer) {
        clearTimeout(state.bridge.retryTimer);
        state.bridge.retryTimer = null;
    }
    if (state.bridge.source) {
        state.bridge.source.close();
        state.bridge.source = null;
    }
    state.bridge.status = 'disconnected';
    state.bridge.lastErrorLoggedAt = 0;
    updateBridgeState();
}

function scheduleBridgeRetry() {
    if (state.bridge.retryTimer) return;
    state.bridge.retryTimer = setTimeout(() => {
        state.bridge.retryTimer = null;
        if (state.bridgeUrl) {
            connectBridge();
        }
    }, 5000);
}

function createBridgeMeta(packet) {
    if (!packet) return null;
    return {
        verified: packet.verified !== false,
        type: packet.type || null,
        messageId: packet.messageId || null,
        timestamp: packet.timestamp || null,
        version: packet.version || null
    };
}

const CHANNEL_CONTEXT_KEYWORDS = [
    'channel',
    'broadcaster',
    'streamer',
    'stream',
    'owner',
    'chatroom',
    'room',
    'livestream'
];

const CHANNEL_ID_KEYS = new Set([
    'broadcaster_user_id',
    'broadcasterid',
    'broadcaster_id',
    'channel_id',
    'channelid',
    'chatroom_id',
    'chatroomid',
    'streamer_id',
    'streamerid',
    'stream_id',
    'streamid',
    'livestream_id',
    'livestreamid',
    'room_id',
    'roomid'
]);

const CHANNEL_SLUG_KEYS = new Set([
    'channel_slug',
    'channelslug',
    'slug',
    'slug_name',
    'slugname',
    'broadcaster_slug',
    'broadcasterslug'
]);

function hasChannelContext(key, path) {
    const target = `${key || ''} ${path || ''}`.toLowerCase();
    return CHANNEL_CONTEXT_KEYWORDS.some(keyword => target.includes(keyword));
}

function shouldCollectAsId(key, path) {
    if (!key) return false;
    const lower = key.toLowerCase();
    if (CHANNEL_ID_KEYS.has(lower)) {
        return true;
    }
    if (/_?id$/.test(lower) && hasChannelContext(lower, path)) {
        return true;
    }
    if ((lower === 'user_id' || lower === 'userid') && hasChannelContext(lower, path)) {
        return true;
    }
    return false;
}

function shouldCollectAsSlug(key, path) {
    if (!key) return false;
    const lower = key.toLowerCase();
    if (CHANNEL_SLUG_KEYS.has(lower)) {
        return true;
    }
    if ((lower === 'username' || lower === 'handle') && hasChannelContext(lower, path)) {
        return true;
    }
    return false;
}

function extractSlugFromUrl(value) {
    if (typeof value !== 'string') return null;
    const match = value.match(/kick\.com\/(@?)([a-z0-9_\-.]+)/i);
    if (!match) return null;
    return match[2] ? match[2].replace(/^@+/, '') : null;
}

function collectChannelHints(value, result, path = '', depth = 0, seen = new Set()) {
    if (!value || typeof value !== 'object' || depth > 4 || seen.has(value)) {
        return;
    }
    seen.add(value);
    const entries = Object.entries(value);
    for (const [key, current] of entries) {
        const nextPath = path ? `${path}.${key}` : key;
        if (current == null) {
            continue;
        }
        if (typeof current === 'string' || typeof current === 'number') {
            const str = String(current).trim();
            if (!str) {
                continue;
            }
            if (shouldCollectAsId(key, path)) {
                result.ids.add(str);
            }
            if (shouldCollectAsSlug(key, path)) {
                result.slugs.add(str.replace(/^@+/, '').toLowerCase());
            }
            if (typeof current === 'string') {
                const urlSlug = extractSlugFromUrl(current);
                if (urlSlug) {
                    result.slugs.add(urlSlug.toLowerCase());
                }
            }
        } else if (typeof current === 'object') {
            collectChannelHints(current, result, nextPath, depth + 1, seen);
        }
    }
}

function normalizeIdForComparison(value, expectNumeric) {
    if (value == null) return '';
    const str = String(value).trim();
    if (!str) return '';
    if (!expectNumeric) {
        return str;
    }
    const digits = str.replace(/[^0-9]/g, '');
    return digits || str;
}

function normalizeSlug(value) {
    return normalizeChannel(value);
}

function bridgeEventMatchesCurrentChannel(packet) {
    if (!packet || typeof packet !== 'object') {
        return true;
    }
    // Pusher socket events are already scoped to the correct chatroom channel
    if (packet.source === 'socket') {
        return true;
    }
    const expectedId = state.channelId != null ? String(state.channelId).trim() : '';
    const expectedSlug = normalizeChannel(state.channelSlug);
    if (!expectedId && !expectedSlug) {
        return true;
    }
    const result = {
        ids: new Set(),
        slugs: new Set()
    };
    collectChannelHints(packet.body, result);
    collectChannelHints(packet, result);

    const expectNumeric = expectedId ? /^\d+$/.test(expectedId) : false;
    if (expectedId) {
        const normalizedExpectedId = normalizeIdForComparison(expectedId, expectNumeric);
        for (const candidate of result.ids) {
            if (normalizeIdForComparison(candidate, expectNumeric) === normalizedExpectedId) {
                return true;
            }
        }
    }
    if (expectedSlug) {
        const normalizedExpectedSlug = normalizeSlug(expectedSlug);
        for (const candidate of result.slugs) {
            if (normalizeSlug(candidate) === normalizedExpectedSlug) {
                return true;
            }
        }
    }
    if (!result.ids.size && !result.slugs.size) {
        return true;
    }
    return false;
}

function updateBridgeState() {
    syncKickViewerHeartbeat(true);
    if (!els.bridgeState) return;
    if (state.bridge.status === 'connected') {
        els.bridgeState.textContent = 'Bridge connected';
        els.bridgeState.className = 'status-chip';
    } else if (state.bridge.status === 'connecting') {
        els.bridgeState.textContent = 'Bridge connecting';
        els.bridgeState.className = 'status-chip warning';
    } else {
        els.bridgeState.textContent = 'Bridge disconnected';
        els.bridgeState.className = 'status-chip danger';
    }
    const status = state.bridge.status || 'disconnected';
    if (status !== lastBridgeNotifyStatus) {
        lastBridgeNotifyStatus = status;
        let message;
        if (status === 'connected') {
            message = 'Connected to Kick bridge';
        } else if (status === 'connecting') {
            message = 'Connecting to Kick bridge';
        } else {
            message = 'Disconnected from Kick bridge';
        }
        notifyApp({
            wssStatus: {
                platform: WSS_PLATFORM,
                status,
                message
            }
        });
    }
    notifyLiteStatus('bridge');
}

function processBridgeEvent(packet, isReplay = false) {
    if (!packet) return;
    const body = packet.body || {};
    const type = packet.type || body?.event || 'unknown';
    const bridgeMeta = createBridgeMeta(packet);
    const sourceLabel = packet.source === 'socket' ? 'Socket' : 'Bridge';
    if (!isReplay && type !== 'chat.message.sent') {
        log(`${sourceLabel} event received: ${type} (channelId: ${state.channelId}, slug: ${state.channelSlug})`);
    }
    const challenge = packet.challenge || body?.challenge;
    if (challenge) {
        const level = bridgeMeta?.verified === false ? 'warning' : 'info';
        log(`Kick webhook verification challenge received. Bridge responded with: ${challenge}`, level);
        return;
    }
    if (!type || type === 'unknown') {
        log('Bridge event missing type field.', 'warning');
        return;
    }
    if (bridgeMeta?.verified === false && !isReplay) {
        log(`Received unverified webhook event: ${type}`, 'warning');
    }
    if (!bridgeEventMatchesCurrentChannel(packet)) {
        if (!ignoredEventTypesLogged.has(type)) {
            ignoredEventTypesLogged.add(type);
            log(`Ignoring ${type} for a different Kick channel (expected: ${state.channelId}/${state.channelSlug}).`, 'info');
        }
        return;
    }
    if (type === 'chat.message.sent') {
        void forwardChatMessage(body, bridgeMeta);
        return;
    }
    if (
        type === 'chat.message.deleted' ||
        type === 'chat.message.removed' ||
        /chat\..*(deleted|removed|delete)/i.test(type)
    ) {
        forwardDeletedMessage(body, bridgeMeta);
        return;
    }
    if (type === 'channel.followed') {
        forwardFollower(body, bridgeMeta);
        return;
    }
    if (type.startsWith('channel.subscription.')) {
        forwardSubscription(type, body, bridgeMeta);
        return;
    }
    if (/support|donat|tip|kick/i.test(type)) {
        forwardSupportEvent(type, body, bridgeMeta);
        return;
    }
    if (type === 'livestream.status.updated') {
        forwardLiveStatus(body, bridgeMeta);
        return;
    }
    log(`Unhandled event: ${type}`);
}

function handleBridgeEvent(packet) {
    if (!packet) return;
    // Socket-sourced events are already scoped to the correct chatroom — skip queue
    if (state.channelId == null && state.channelSlug && packet.source !== 'socket') {
        const type = packet.type || packet.body?.event || 'unknown';
        if (pendingBridgeEvents.length < MAX_PENDING_EVENTS) {
            pendingBridgeEvents.push(packet);
            if (type !== 'chat.message.sent') {
                log(`Queued ${type} event (waiting for channel resolution)`);
            }
        }
        return;
    }
    const packetType = packet.type || packet.body?.event || '';
    if (packetType === 'chat.message.sent' && shouldIgnoreBridgeChatEvent(packet)) {
        return;
    }
    processBridgeEvent(packet, false);
}

function replayPendingBridgeEvents() {
    if (!pendingBridgeEvents.length) return;
    const count = pendingBridgeEvents.length;
    log(`Replaying ${count} queued event(s) after channel resolution`);
    while (pendingBridgeEvents.length > 0) {
        const packet = pendingBridgeEvents.shift();
        processBridgeEvent(packet, true);
    }
}

function shouldIgnoreBridgeChatEvent(packet) {
    const type = packet?.type || packet?.body?.event || '';
    if (type !== 'chat.message.sent') return false;
    // Don't ignore events that came from the socket itself
    if (packet?.source === 'socket') return false;
    if (!supportsLocalSocket() && state.socket.pusherStatus !== 'connected') return false;
    if (state.socket?.status !== 'connected') return false;
    const lastSocketChatAt = Number(state.socket?.lastChatEventAt || 0);
    if (!lastSocketChatAt) return false;
    if (Date.now() - lastSocketChatAt > SOCKET_CHAT_ACTIVITY_WINDOW_MS) return false;
    return true;
}

async function forwardChatMessage(evt, bridgeMeta) {
    try {
        const payload = evt || {};
        const message = payload.message || payload.data?.message || payload.payload?.message || payload;
        const sender = payload.sender || payload.user || message?.sender || payload.profile || {};
        if (!message) {
            log('Chat event missing message payload.', 'warning');
            return;
        }
        const rawMessageId = message?.id || payload.message_id || payload.id || null;
        const nativeMessageId = rawMessageId == null ? '' : String(rawMessageId).trim();
        const bridgeMessageId = bridgeMeta?.messageId || null;
        const resolvedId = rawMessageId ?? bridgeMessageId;
        const profileSources = [
            sender,
            message?.sender,
            payload.profile,
            payload.user,
            evt?.sender
        ];
        const { profile: actorProfile, ids } = gatherProfileState(...profileSources);
        const chatname =
            actorProfile.displayName ||
            pickDisplayName([
                sender?.display_name,
                sender?.username,
                sender?.name,
                message?.sender?.display_name,
                message?.sender?.username,
                payload.username
            ]);
        const content = extractMessageContent(message) || extractMessageContent(payload) || '';
        const badgeCandidates = collectBadgesFromSources(...profileSources);
        const rawBadges = (actorProfile.badges && actorProfile.badges.length) ? actorProfile.badges : badgeCandidates;
        const badges = formatBadgesForDisplay(rawBadges);
        let chatimg =
            actorProfile.avatar ||
            pickImage(
                sender?.profile_picture,
                sender?.profilePicture,
                sender?.avatar,
                message?.sender?.profile_picture,
                message?.sender?.profilePicture,
                message?.sender?.avatar
            );
        const lookupUsername = pickFirstString(
            [
                sender?.username,
                sender?.slug,
                message?.sender?.username,
                message?.sender?.slug,
                payload?.username,
                payload?.user?.username,
                payload?.profile?.username,
                ids?.username
            ],
            ''
        );
        if (!chatimg && lookupUsername) {
            // Avatar lookup with timeout: don't block message delivery waiting for avatar.
            // If timeout wins, message is sent without avatar; queueAvatarLookup continues
            // in background and will call updateChatFeedAvatar to backfill when ready.
            const avatarPromise = queueAvatarLookup(ids, lookupUsername, resolvedId);
            if (avatarPromise) {
                try {
                    const resolvedAvatar = await Promise.race([
                        avatarPromise,
                        delay(AVATAR_LOOKUP_TIMEOUT_MS)
                    ]);
                    if (typeof resolvedAvatar === 'string' && resolvedAvatar.trim()) {
                        chatimg = resolvedAvatar;
                    }
                } catch (_) {}
            }
        }
        const fallbackColor = collectNameColorFromSources(...profileSources);
        const nameColor = actorProfile.nameColor || fallbackColor || '';
        const rawEventType =
            message?.type ||
            payload.event ||
            payload.type ||
            message?.event ||
            message?.message_type ||
            payload.message_type ||
            payload.event_type ||
            'chat';
        resolvePendingKickChatEcho(resolvedId, content, rawEventType, ids);
        const chatmessageHtml = renderKickMessageHtml(message, content);
        const membership = actorProfile.membership || pickFirstString(
            [
                sender?.membership,
                sender?.membership_name,
                sender?.membership?.name,
                sender?.membership?.display_name,
                sender?.subscription?.name,
                payload?.membership,
                payload?.membership_name,
                message?.membership,
                message?.membership_name
            ],
            ''
        );
        const isModerator =
            actorProfile.isMod === true ||
            sender?.is_moderator === true ||
            sender?.moderator === true ||
            (Array.isArray(sender?.roles) && sender.roles.some(
                role => typeof role === 'string' && role.toLowerCase().includes('mod')
            ));
        const channelBranding = resolveChannelBranding();
        const donationLabel = extractChatDonationLabel(message, payload);
        const normalizedEvent = mapKickChatEventToSocialStream(rawEventType, content, donationLabel);
        const replyDetails = extractReplyDetails(message, payload);
        const textOnlyMode = Boolean(isTextOnlyMode());
        const allowReplies = !settings.excludeReplyingTo && (chatmessageHtml || content);
        const messagePayload = {
            type: 'kick',
            chatname,
            chatmessage: chatmessageHtml,
            chatimg: chatimg || '',
            chatbadges: badges,
            nameColor: nameColor || '',
            membership: membership || '',
            hasDonation: donationLabel,
            textonly: textOnlyMode
        };
        if (resolvedId != null) {
            const normalizedId = typeof resolvedId === 'string' ? resolvedId : String(resolvedId);
            messagePayload.id = normalizedId;
        }
        if (nativeMessageId) {
            messagePayload.meta = { messageId: nativeMessageId };
        }
        if (ids?.userId) {
            messagePayload.userId = ids.userId;
        }
        if (lookupUsername) {
            messagePayload.username = lookupUsername;
        }
        if (isModerator) {
            messagePayload.mod = true;
        }
        if (actorProfile.isVip) {
            messagePayload.vip = true;
        }
        if (channelBranding.sourceName) {
            messagePayload.sourceName = channelBranding.sourceName;
        }
        if (channelBranding.sourceImg) {
            messagePayload.sourceImg = channelBranding.sourceImg;
        }
        if (allowReplies && replyDetails) {
            messagePayload.initial = replyDetails.label;
            messagePayload.reply = chatmessageHtml;
            if (textOnlyMode) {
                const prefix = replyDetails.label ? `${replyDetails.label}: ` : '';
                const baseText = content || '';
                const combined = `${prefix}${baseText}`.trim();
                messagePayload.chatmessage = combined || baseText || replyDetails.label || '';
            } else if (replyDetails.label) {
                const safeReply = escapeHtml(replyDetails.label);
                messagePayload.chatmessage = `<i><small>${safeReply}:&nbsp;</small></i> ${chatmessageHtml}`;
            }
        }
        // Only include event for actual non-chat/system cases.
        if (normalizedEvent) {
            messagePayload.event = normalizedEvent;
        }
        pushMessage(messagePayload);
        appendChatFeedMessage(messagePayload, content);
    } catch (err) {
        console.error('Failed to handle Kick chat message', err);
    }
}

function resolveChannelBranding() {
    const { profile } = gatherProfileState(
        state.authUser,
        state.tokens?.profile,
        state.tokens,
        {
            username: state.channelSlug || '',
            display_name: state.channelName || '',
            slug: state.channelSlug || ''
        }
    );
    const sourceName = pickFirstString(
        [
            state.channelName,
            state.channelSlug,
            profile?.displayName,
            profile?.username
        ],
        ''
    );
    const sourceImg = profile?.avatar || '';
    return {
        sourceName,
        sourceImg
    };
}

function looksLikeKickRewardMessage(messageText = '', rawType = '') {
    const normalizedText = typeof messageText === 'string'
        ? messageText
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        : '';
    const normalizedType = typeof rawType === 'string'
        ? rawType
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        : '';

    if (/\b(redeem|reward|channel[_ .-]?points?|loyalty[_ .-]?points?)\b/i.test(normalizedType)) {
        return true;
    }

    if (!normalizedText) {
        return false;
    }

    const rewardPatterns = [
        /^(?:has redeemed|redeemed)\b/,
        /^(?:ha canjeado|canjeo)\b/,
        /^(?:rescatou|resgatou)\b/,
        /^(?:ha riscattato)\b/,
        /^(?:a echange|a rachete)\b/,
        /^hat .+ eingelost\b/,
        /^heeft .+ ingewisseld\b/
    ];

    return rewardPatterns.some(pattern => pattern.test(normalizedText));
}

function mapKickChatEventToSocialStream(rawType, plainMessage = '', donationLabel = '') {
    const typeLower = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';
    const textLower = typeof plainMessage === 'string' ? plainMessage.trim().toLowerCase() : '';

    // Match the legacy DOM source semantics first.
    if (looksLikeKickRewardMessage(textLower, typeLower)) {
        return 'reward';
    }
    if (/gift/.test(typeLower)) {
        return 'subscription_gift';
    }

    // Chat payloads should not leak Kick-native type names as `data.event`.
    if (
        !typeLower ||
        typeLower === 'chat' ||
        typeLower === 'message' ||
        typeLower === 'chatroom_message' ||
        typeLower === 'chat.message.sent' ||
        typeLower === 'user' ||
        typeLower === 'bot'
    ) {
        return '';
    }

    // Keep donation parsing compatible with legacy payload expectations.
    if (donationLabel && /donat|tip|support|kick/.test(typeLower)) {
        return 'donation';
    }

    // Legacy DOM source emits `true` for generic non-chat system notices.
    // Preserve that behavior for migration parity.
    return true;
}

function extractChatDonationLabel(...sources) {
    const visited = new Set();
    const amountFields = ['amount', 'value', 'total', 'quantity', 'kicks', 'price', 'amount_total', 'price_amount'];
    const currencyFields = ['currency', 'unit', 'unit_name', 'currency_code', 'symbol', 'currencySymbol'];
    const nestedKeys = [
        'donation',
        'tip',
        'support',
        'purchase',
        'payment',
        'monetization',
        'economy',
        'order',
        'transaction',
        'data',
        'payload',
        'details',
        'meta',
        'extra'
    ];

    const formatAmount = value => {
        if (value == null) return '';
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value.toString() : '';
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed || '';
        }
        if (typeof value === 'object') {
            if ('amount' in value) return formatAmount(value.amount);
            if ('value' in value) return formatAmount(value.value);
        }
        return '';
    };

    const formatCurrency = value => {
        if (!value) return '';
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed ? trimmed.toUpperCase() : '';
        }
        if (typeof value === 'object') {
            if ('currency' in value) return formatCurrency(value.currency);
            if ('code' in value) return formatCurrency(value.code);
            if ('unit' in value) return formatCurrency(value.unit);
            if ('symbol' in value) {
                const symbol = typeof value.symbol === 'string' ? value.symbol.trim() : '';
                if (symbol) return symbol;
            }
        }
        return '';
    };

    const readEntry = entry => {
        if (!entry || typeof entry !== 'object') {
            return '';
        }
        const amountCandidate = amountFields
            .map(field => entry[field])
            .map(formatAmount)
            .find(Boolean);
        if (!amountCandidate) {
            return '';
        }
        const currencyCandidate = currencyFields
            .map(field => entry[field])
            .map(formatCurrency)
            .find(Boolean);
        return currencyCandidate ? `${amountCandidate} ${currencyCandidate}` : amountCandidate;
    };

    const walk = value => {
        if (!value) return '';
        if (typeof value === 'string' || typeof value === 'number') {
            return '';
        }
        if (visited.has(value)) {
            return '';
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                const result = walk(item);
                if (result) {
                    return result;
                }
            }
            return '';
        }
        if (typeof value !== 'object') {
            return '';
        }
        visited.add(value);
        const direct = readEntry(value);
        if (direct) {
            return direct;
        }
        for (const key of nestedKeys) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) {
                continue;
            }
            const result = walk(value[key]);
            if (result) {
                return result;
            }
        }
        return '';
    };

    for (const source of sources) {
        const result = walk(source);
        if (result) {
            return result;
        }
    }
    return '';
}

function extractReplyDetails(message, payload) {
    const candidates = [
        message?.reply_to,
        message?.replyTo,
        message?.replied_to,
        message?.parent,
        message?.thread?.parent,
        message?.quoted_message,
        message?.quote,
        message?.reference,
        message?.referenced_message,
        message?.original_message,
        message?.initial_message,
        payload?.reply_to,
        payload?.reply,
        payload?.parent,
        payload?.reference,
        payload?.referenced_message,
        payload?.original_message,
        payload?.initial_message
    ];
    const visited = new Set();
    const nestedKeys = [
        'message',
        'payload',
        'data',
        'reply',
        'reply_to',
        'replyTo',
        'replied_to',
        'parent',
        'quoted_message',
        'quote',
        'reference',
        'referenced_message',
        'original_message',
        'initial_message'
    ];

    const resolve = value => {
        if (!value) return null;
        if (typeof value === 'string' || typeof value === 'number') {
            const text = String(value).trim();
            if (!text) {
                return null;
            }
            return {
                text,
                author: '',
                label: text
            };
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                const result = resolve(item);
                if (result) {
                    return result;
                }
            }
            return null;
        }
        if (typeof value !== 'object') {
            return null;
        }
        if (visited.has(value)) {
            return null;
        }
        visited.add(value);
        const text = extractMessageContent(value);
        if (text) {
            const author = pickFirstString(
                [
                    value?.sender?.display_name,
                    value?.sender?.username,
                    value?.user?.display_name,
                    value?.user?.username,
                    value?.author?.display_name,
                    value?.author?.username,
                    value?.identity?.display_name,
                    value?.identity?.username,
                    value?.username,
                    value?.name
                ],
                ''
            );
            const label = author ? `${author}: ${text}` : text;
            return {
                text,
                author,
                label
            };
        }
        for (const key of nestedKeys) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) {
                continue;
            }
            const result = resolve(value[key]);
            if (result) {
                return result;
            }
        }
        return null;
    };

    for (const candidate of candidates) {
        const result = resolve(candidate);
        if (result) {
            return result;
        }
    }
    return null;
}

function forwardDeletedMessage(evt, bridgeMeta) {
    const messageId = pickFirstString(
        [
            evt?.message_id,
            evt?.messageId,
            evt?.id,
            evt?.message?.id,
            evt?.data?.message_id,
            evt?.data?.messageId,
            evt?.data?.id
        ],
        ''
    );
    if (!messageId) {
        log('Delete event received without message ID.', 'warning');
        return;
    }

    const actorSources = [
        evt?.sender,
        evt?.user,
        evt?.profile,
        evt?.message?.sender,
        evt
    ];
    const { profile: actorProfile } = gatherProfileState(...actorSources);
    const chatname =
        actorProfile.displayName ||
        pickDisplayName([
            evt?.sender?.display_name,
            evt?.sender?.username,
            evt?.user?.display_name,
            evt?.user?.username,
            evt?.profile?.display_name,
            evt?.profile?.username,
            evt?.message?.sender?.display_name,
            evt?.message?.sender?.username
        ]) ||
        '';

    const payload = {
        type: 'kick',
        id: String(messageId)
    };
    if (chatname) {
        payload.chatname = chatname;
    }
    pushDeleteMessage(payload);

    const prefix = bridgeMeta?.verified === false ? '[DELETE !]' : '[DELETE]';
    log(`${prefix} message removed${chatname ? ` by ${chatname}` : ''}`);
}

function forwardFollower(evt, bridgeMeta) {
    const followerSources = [
        evt?.follower,
        evt?.user,
        evt?.profile,
        evt?.account,
        evt
    ];
    const { profile: followerProfile } = gatherProfileState(...followerSources);
    const follower =
        followerProfile.displayName ||
        pickDisplayName([
            evt?.follower?.display_name,
            evt?.follower?.username,
            evt?.user?.display_name,
            evt?.user?.username,
            evt?.username
        ]) ||
        '';
    const chatimg =
        followerProfile.avatar ||
        pickImage(
            evt?.follower?.profile_picture,
            evt?.follower?.profilePicture,
            evt?.follower?.avatar,
            evt?.user?.profile_picture,
            evt?.user?.profilePicture,
            evt?.user?.avatar
        ) ||
        null;
    const chatmessage = follower ? `${follower} started following` : 'New follower';

    pushMessage({
        type: 'kick',
        event: 'new_follower',
        chatname: follower || '',
        chatmessage: escapeHtml(chatmessage),
        chatimg: chatimg || ''
    });
    appendAlertsFeedEntry({
        kind: 'follower',
        actor: follower || 'New follower',
        message: 'started following',
        avatar: chatimg || ''
    });

    const followerCountCandidates = [
        evt?.total_followers,
        evt?.follower_count,
        evt?.followers_count,
        evt?.total_followers_count,
        evt?.count,
        evt?.meta?.total,
        evt?.meta?.count,
        evt?.summary?.followers,
        evt?.summary?.follower_count,
        evt?.channel?.followers_count,
        evt?.channel?.follower_count,
        evt?.broadcaster?.followers_count
    ];
    let followerTotal = null;
    for (const candidate of followerCountCandidates) {
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            followerTotal = candidate;
            break;
        }
        if (typeof candidate === 'string') {
            const digits = candidate.replace(/[^0-9]/g, '');
            if (!digits) {
                continue;
            }
            const parsed = parseInt(digits, 10);
            if (Number.isFinite(parsed)) {
                followerTotal = parsed;
                break;
            }
        }
    }

    if (followerTotal != null) {
        pushMessage({
            type: 'kick',
            event: 'follower_update',
            meta: followerTotal
        });
    }

    const prefix = bridgeMeta?.verified === false ? '[FOLLOW ⚠]' : '[FOLLOW]';
    log(`${prefix} ${follower || 'New follower'}`);
}


function forwardSubscription(eventType, evt, bridgeMeta) {
    const subscriberSources = [
        evt?.subscriber,
        evt?.user,
        evt?.recipient,
        evt?.target,
        evt
    ];
    const gifterSources = [
        evt?.gifter,
        evt?.gifted_by,
        evt?.sender,
        evt
    ];
    const { profile: subscriberProfile } = gatherProfileState(...subscriberSources);
    const { profile: gifterProfile } = gatherProfileState(...gifterSources);
    const subscriber = subscriberProfile.displayName || pickDisplayName([
        evt?.subscriber?.display_name,
        evt?.subscriber?.username,
        evt?.user?.display_name,
        evt?.user?.username,
        evt?.gifter?.display_name,
        evt?.gifter?.username
    ]);
    const gifter = gifterProfile.displayName || pickDisplayName([
        evt?.gifter?.display_name,
        evt?.gifter?.username,
        evt?.gifted_by?.display_name,
        evt?.gifted_by?.username
    ]);
    const takeNumber = value => {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = parseInt(value, 10);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
        return null;
    };
    const subscriberImage =
        subscriberProfile.avatar ||
        pickImage(
            evt?.subscriber?.profile_picture,
            evt?.subscriber?.profilePicture,
            evt?.subscriber?.avatar,
            evt?.user?.profile_picture,
            evt?.user?.profilePicture,
            evt?.user?.avatar
        );
    const gifterImage =
        gifterProfile.avatar ||
        pickImage(
            evt?.gifter?.profile_picture,
            evt?.gifter?.profilePicture,
            evt?.gifter?.avatar,
            evt?.gifted_by?.profile_picture,
            evt?.gifted_by?.profilePicture,
            evt?.gifted_by?.avatar
        );
    const totalGifted = takeNumber(evt?.gifted_quantity ?? evt?.quantity ?? evt?.total_gifted ?? evt?.totalGifted);
    const duration = takeNumber(evt?.duration ?? evt?.months ?? evt?.streak ?? evt?.tenure);
    const rawPlan = evt?.tier ?? evt?.plan ?? evt?.membership ?? null;
    const plan = rawPlan == null ? null : String(rawPlan).trim() || null;
    const meta = {
        eventType,
        subscriber: subscriber || null,
        gifter: gifter && gifter !== subscriber ? gifter : null,
        totalGifted: totalGifted ?? null,
        duration: duration ?? null,
        plan
    };
    const isGift = /gift/i.test(eventType || '');
    const isRenewal = /renew/i.test(eventType || '');
    let eventName;
    let chatname;
    let chatmessage;
    if (isGift) {
        eventName = 'subscription_gift';
        chatname = gifter || subscriber || 'Kick viewer';
        const giftedCount = totalGifted && totalGifted > 0 ? totalGifted : 1;
        const receiverLabel = subscriber && subscriber !== chatname ? ` to ${subscriber}` : '';
        chatmessage = `${chatname} gifted ${giftedCount} sub${giftedCount === 1 ? '' : 's'}${receiverLabel}!`;
    } else if (isRenewal) {
        eventName = 'resub';
        chatname = subscriber || gifter || 'Kick viewer';
        const months = duration && duration > 0 ? duration : null;
        const durationLabel = months ? ` for ${months} month${months === 1 ? '' : 's'}` : '';
        chatmessage = `${chatname} renewed their sub${durationLabel}!`;
    } else {
        eventName = 'new_subscriber';
        chatname = subscriber || gifter || 'Kick viewer';
        const planLabel = plan ? ` at ${plan}` : '';
        chatmessage = `${chatname} subscribed${planLabel}!`;
    }
    const chatimg = eventName === 'subscription_gift'
        ? (gifterImage || subscriberImage)
        : (subscriberImage || gifterImage);
    pushMessage({
        type: 'kick',
        event: eventName,
        chatname,
        chatmessage: escapeHtml(chatmessage),
        chatimg: chatimg || '',
        meta
    });
    const prefix = bridgeMeta?.verified === false ? '[SUB ⚠]' : '[SUB]';
    log(`${prefix} ${chatmessage}`);
}

function forwardSupportEvent(eventType, evt, bridgeMeta) {
    const supporterSources = [
        evt?.supporter,
        evt?.sender,
        evt?.user,
        evt?.gifter,
        evt?.account,
        evt
    ];
    const { profile: supporterProfile } = gatherProfileState(...supporterSources);
    const supporter = supporterProfile.displayName || pickDisplayName([
        evt?.supporter?.display_name,
        evt?.supporter?.username,
        evt?.sender?.display_name,
        evt?.sender?.username,
        evt?.user?.display_name,
        evt?.user?.username,
        evt?.gifter?.display_name,
        evt?.gifter?.username,
        evt?.username
    ]);
    let amount = evt?.amount ?? evt?.value ?? evt?.kicks ?? evt?.total ?? null;
    let currency = evt?.currency || evt?.unit || evt?.unit_name || null;
    if (evt?.support) {
        amount = amount ?? evt.support.amount ?? evt.support.total;
        currency = currency || evt.support.currency || evt.support.unit;
    }
    if (evt?.tip) {
        amount = amount ?? evt.tip.amount;
        currency = currency || evt.tip.currency;
    }
    if (typeof evt?.kicks_total === 'number' && amount == null) {
        amount = evt.kicks_total;
        currency = currency || 'KICK';
    }
    const note = extractMessageContent(evt?.message || evt?.comment || evt?.note || evt?.support?.message || evt?.tip?.message || evt) || '';
    const amountLabel = amount != null ? `${amount}${currency ? ' ' + currency : ''}` : '';
    const messageSegments = [];
    if (amountLabel) {
        messageSegments.push(amountLabel);
    }
    if (note) {
        messageSegments.push(note);
    }
    const chatmessage = messageSegments.length ? messageSegments.join(' • ') : 'New support received!';
    const chatname = supporter || 'Kick supporter';
    const chatimg =
        supporterProfile.avatar ||
        pickImage(
            evt?.supporter?.profile_picture,
            evt?.supporter?.avatar,
            evt?.sender?.profile_picture,
            evt?.sender?.avatar,
            evt?.user?.profile_picture,
            evt?.user?.avatar,
            evt?.gifter?.profile_picture,
            evt?.gifter?.avatar
        );
    const meta = {
        eventType,
        supporter,
        amount,
        currency,
        message: note
    };
    pushMessage({
        type: 'kick',
        event: 'donation',
        chatname,
        chatmessage: escapeHtml(chatmessage),
        chatimg: chatimg || '',
        meta
    });
    appendAlertsFeedEntry({
        kind: 'donation',
        actor: chatname,
        message: chatmessage,
        avatar: chatimg || ''
    });
    const noteLabel = note ? ` – ${note}` : '';
    const prefix = bridgeMeta?.verified === false ? '[TIP ⚠]' : '[TIP]';
    log(`${prefix} ${supporter}${amountLabel ? ` • ${amountLabel}` : ''}${noteLabel}`);
}

function forwardLiveStatus(evt, bridgeMeta) {
    const explicitLiveState = extractKickLiveFlag(evt);
    const isLive = explicitLiveState === true || evt?.is_live === true;
    const hasExplicitOffline = explicitLiveState === false || evt?.is_live === false;
    const chatname = 'Kick';
    const chatmessage = isLive ? 'Stream is now LIVE' : 'Stream is now OFFLINE';
    pushMessage({
        type: 'kick',
        event: isLive ? 'stream_online' : 'stream_offline',
        chatname,
        chatmessage: escapeHtml(chatmessage),
        meta: evt
    });

    if (typeof explicitLiveState === 'boolean') {
        kickViewerHeartbeat.isLive = explicitLiveState;
    } else if (evt?.is_live === true) {
        kickViewerHeartbeat.isLive = true;
    } else if (evt?.is_live === false) {
        kickViewerHeartbeat.isLive = false;
    }

    let viewerTotal = extractKickViewerCount(evt);
    if (hasExplicitOffline) {
        viewerTotal = 0;
    }
    if (viewerTotal != null) {
        emitKickViewerUpdate(viewerTotal);
    }
    syncKickViewerHeartbeat(false);

    const prefix = bridgeMeta?.verified === false ? '[LIVE ⚠]' : '[LIVE]';
    if (viewerTotal != null) {
        log(`${prefix} ${isLive ? 'Online' : 'Offline'} • ${viewerTotal} viewers`);
    } else {
        log(`${prefix} ${isLive ? 'Online' : 'Offline'}`);
    }
}

function updateChatSendingState(flag) {
    state.chat.sending = flag;
    if (els.sendChat) {
        els.sendChat.disabled = flag;
    }
}

function setChatStatus(message, level = 'info') {
    if (!els.chatStatus) return;
    els.chatStatus.textContent = message || '';
    const colorMap = {
        info: '#8a8a8a',
        success: '#4ef287',
        error: '#f24e7c',
        warning: '#f2bc4e'
    };
    els.chatStatus.style.color = colorMap[level] || colorMap.info;
}

function normalizeKickChatEchoContent(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.replace(/\s+/g, ' ').trim();
}

function normalizeKickChatEchoType(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return '';
    }
    if (normalized === 'user' || normalized === 'bot' || normalized === 'userbot') {
        return normalizeKickChatType(normalized);
    }
    return '';
}

function extractKickChatResponseMessageId(payload) {
    if (!payload || typeof payload !== 'object') {
        return '';
    }
    const candidates = [
        payload.id,
        payload.message_id,
        payload.messageId,
        payload.data?.id,
        payload.data?.message_id,
        payload.data?.messageId,
        payload.message?.id,
        payload.message?.message_id,
        payload.message?.messageId
    ];
    for (const candidate of candidates) {
        if (candidate == null) {
            continue;
        }
        const normalized = String(candidate).trim();
        if (normalized) {
            return normalized;
        }
    }
    return '';
}

function clearPendingKickChatEcho(entry) {
    if (!entry) {
        return;
    }
    if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
        entry.timeoutId = null;
    }
    const index = pendingKickChatEchoes.indexOf(entry);
    if (index !== -1) {
        pendingKickChatEchoes.splice(index, 1);
    }
}

function clearPendingKickChatEchoes() {
    pendingKickChatEchoes.slice().forEach(clearPendingKickChatEcho);
}

function prunePendingKickChatEchoes(now = Date.now()) {
    pendingKickChatEchoes.slice().forEach(entry => {
        if (!entry || (now - entry.createdAt) > KICK_CHAT_ECHO_STALE_MS) {
            clearPendingKickChatEcho(entry);
        }
    });
}

function queuePendingKickChatEcho(content, messageType, response) {
    prunePendingKickChatEchoes();
    const entry = {
        seq: ++pendingKickChatEchoSeq,
        createdAt: Date.now(),
        normalizedContent: normalizeKickChatEchoContent(content),
        messageType: normalizeKickChatEchoType(messageType),
        responseMessageId: extractKickChatResponseMessageId(response),
        timeoutId: null
    };
    pendingKickChatEchoes.push(entry);
    entry.timeoutId = setTimeout(() => {
        if (!pendingKickChatEchoes.includes(entry)) {
            return;
        }
        if (entry.seq === pendingKickChatEchoSeq) {
            setChatStatus('Message submitted. Live chat confirmation is taking longer than expected.', 'warning');
        }
    }, KICK_CHAT_ECHO_TIMEOUT_MS);
    return entry;
}

function resolvePendingKickChatEcho(messageId, content, messageType = '', senderIds = null) {
    prunePendingKickChatEchoes();
    const normalizedId = messageId == null ? '' : String(messageId).trim();
    const normalizedContent = normalizeKickChatEchoContent(content);
    const normalizedType = normalizeKickChatEchoType(messageType);
    const normalizedSenderUserId = senderIds?.userId ? String(senderIds.userId).trim() : '';
    const normalizedSenderUsername = senderIds?.username ? normalizeChannel(senderIds.username) : '';
    let entry = null;

    if (normalizedId) {
        entry = pendingKickChatEchoes.find(candidate => candidate.responseMessageId === normalizedId) || null;
    }
    if (!entry && normalizedContent) {
        const currentIds = resolveProfileIdentifiers(
            state.authUser,
            state.tokens?.profile,
            state.tokens,
            { id: state.channelId, username: state.channelSlug }
        );
        const currentUserId = currentIds?.userId ? String(currentIds.userId).trim() : '';
        const currentUsername = currentIds?.username ? normalizeChannel(currentIds.username) : '';
        const shouldRequireSenderMatch = Boolean(
            (currentUserId || currentUsername) &&
            (normalizedSenderUserId || normalizedSenderUsername)
        );
        entry = pendingKickChatEchoes.find(candidate => {
            if (candidate.normalizedContent !== normalizedContent) {
                return false;
            }
            if (normalizedType && candidate.messageType && candidate.messageType !== normalizedType) {
                return false;
            }
            if (shouldRequireSenderMatch) {
                const userIdMatches = currentUserId && normalizedSenderUserId && currentUserId === normalizedSenderUserId;
                const usernameMatches = currentUsername && normalizedSenderUsername && currentUsername === normalizedSenderUsername;
                if (!userIdMatches && !usernameMatches) {
                    return false;
                }
            }
            return true;
        }) || null;
    }
    if (!entry) {
        return false;
    }

    const wasLatest = entry.seq === pendingKickChatEchoSeq;
    clearPendingKickChatEcho(entry);
    if (wasLatest) {
        setChatStatus('Message sent.', 'success');
    }
    return true;
}

async function sendChatFromExtension(message) {
    if (!els.chatMessage || typeof message !== 'string') {
        return false;
    }
    const trimmed = message.trim();
    if (!trimmed) {
        return false;
    }
    const original = els.chatMessage.value || '';
    const hadOriginal = original.length > 0;
    els.chatMessage.value = trimmed;
    try {
        await sendChatMessage();
        return true;
    } catch (err) {
        if (hadOriginal) {
            els.chatMessage.value = original;
        } else {
            els.chatMessage.value = '';
        }
        throw err;
    } finally {
        if (hadOriginal) {
            els.chatMessage.value = original;
        }
    }
}

async function sendChatMessage() {
    if (!els.chatMessage) return;
    const content = els.chatMessage.value.trim();
    if (!content) {
        setChatStatus('Enter a message first.', 'warning');
        return;
    }
    if (state.chat.sending) {
        return;
    }
    const messageType = normalizeKickChatType(els.chatType ? els.chatType.value : state.chat.type || 'user');
    state.chat.type = messageType;
    persistConfig();
    try {
        updateChatSendingState(true);
        setChatStatus('Sending message…');
        const response = await sendChatPayload(content, messageType, false);
        queuePendingKickChatEcho(content, messageType, response);
        els.chatMessage.value = '';
        setChatStatus('Message submitted. Waiting for live chat confirmation...', 'info');
        log('[CHAT] Outbound message submitted; waiting for live chat confirmation.');
        return response;
    } catch (err) {
        console.error('Chat send failed', err);
        const status = getKickApiErrorStatus(err);
        if (status === 400) {
            setChatStatus('Kick rejected the message — check account permissions.', 'error');
        } else if (status === 401 || status === 403) {
            setChatStatus('Authentication expired. Please sign in again.', 'error');
        } else if (/failed to fetch/i.test(err?.message || '')) {
            setChatStatus('Kick API unreachable. Try again in a moment.', 'error');
        } else {
            setChatStatus(`Failed to send: ${err.message}`, 'error');
        }
        log(`Failed to send chat message: ${err.message}`, 'error');
        throw err;
    } finally {
        updateChatSendingState(false);
    }
}

async function sendChatPayload(content, messageType, isRetry) {
    const payload = { content };
    if (messageType === 'user') {
        const channelId = isRetry
            ? await resolveChannelId(true)
            : await resolveChannelId();
        payload.broadcaster_user_id = Number(channelId);
        payload.type = 'user';
    } else {
        payload.type = 'bot';
    }
    try {
        return await apiFetch('/public/v1/chat', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    } catch (err) {
        if (!isRetry && getKickApiErrorStatus(err) === 400) {
            log('Chat send got 400 — retrying with fresh channel resolution.', 'warning');
            return sendChatPayload(content, messageType, true);
        }
        throw err;
    }
}

function pushMessage(data) {
    // Prefer direct Electron bridge when available.
    if (isElectronEnvironment() && window.ninjafy && window.ninjafy.sendMessage) {
        try {
            window.ninjafy.sendMessage(null, { message: data }, null, window.__SSAPP_TAB_ID__);
            return;
        } catch (_) {}
    }
    if (sendRuntimeMessageFireAndForget({ message: data })) {
        return;
    }
    if (window.ninjafy && window.ninjafy.sendMessage) {
        try {
            window.ninjafy.sendMessage(null, { message: data }, null, window.__SSAPP_TAB_ID__);
            return;
        } catch (e) {
            console.error('Error sending message:', e);
        }
    }
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        try {
            window.parent.postMessage({ message: data }, '*');
        } catch (e) {
            console.error('Error sending message to host:', e);
        }
    }
}

function pushDeleteMessage(data) {
    // Prefer direct Electron bridge when available.
    if (isElectronEnvironment() && window.ninjafy && window.ninjafy.sendMessage) {
        try {
            window.ninjafy.sendMessage(null, { delete: data }, null, window.__SSAPP_TAB_ID__);
            return;
        } catch (_) {}
    }
    if (sendRuntimeMessageFireAndForget({ delete: data })) {
        return;
    }
    if (window.ninjafy && window.ninjafy.sendMessage) {
        try {
            window.ninjafy.sendMessage(null, { delete: data }, null, window.__SSAPP_TAB_ID__);
            return;
        } catch (e) {
            console.error('Error sending delete message:', e);
        }
    }
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        try {
            window.parent.postMessage({ delete: data }, '*');
        } catch (e) {
            console.error('Error sending delete message to host:', e);
        }
    }
}

function log(msg, level = 'info') {
    if (!els.eventLog) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    const time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString();
    line.appendChild(time);
    const span = document.createElement('span');
    span.textContent = ` ${msg}`;
    if (level === 'error') {
        span.style.color = '#f24e7c';
    } else if (level === 'warning') {
        span.style.color = '#f2bc4e';
    }
    line.appendChild(span);
    els.eventLog.appendChild(line);
    const entries = els.eventLog.querySelectorAll('.log-line');
    if (entries.length > EVENT_LOG_LIMIT) {
        const removeCount = entries.length - EVENT_LOG_LIMIT;
        for (let i = 0; i < removeCount; i += 1) {
            entries[i].remove();
        }
    }
    els.eventLog.scrollTop = els.eventLog.scrollHeight;
}

function logKickWs(message, level = 'info') {
    const text = `[KickWs] ${message}`;
    log(text, level);
    try {
        if (level === 'error') {
            console.error(text);
        } else if (level === 'warning') {
            console.warn(text);
        } else {
            console.log(text);
        }
    } catch (_) {}
}

function shouldStickChatFeed() {
    if (!els.chatFeed) return false;
    const { scrollTop, scrollHeight, clientHeight } = els.chatFeed;
    return scrollHeight - (scrollTop + clientHeight) <= CHAT_SCROLL_THRESHOLD_PX;
}

function ensureChatFeedEmptyVisible(visible) {
    if (!els.chatFeedEmpty) return;
    els.chatFeedEmpty.style.display = visible ? '' : 'none';
    if (visible && els.chatFeed && !els.chatFeed.contains(els.chatFeedEmpty)) {
        els.chatFeed.appendChild(els.chatFeedEmpty);
    }
}

function resetChatFeed() {
    if (!els.chatFeed) return;
    const entries = els.chatFeed.querySelectorAll('.chat-line');
    entries.forEach(entry => entry.remove());
    ensureChatFeedEmptyVisible(true);
}

function shouldStickAlertsFeed() {
    if (!els.alertsFeed) return false;
    const { scrollTop, scrollHeight, clientHeight } = els.alertsFeed;
    return scrollHeight - (scrollTop + clientHeight) <= CHAT_SCROLL_THRESHOLD_PX;
}

function ensureAlertsFeedEmptyVisible(visible) {
    if (!els.alertsFeedEmpty) return;
    els.alertsFeedEmpty.style.display = visible ? '' : 'none';
    if (visible && els.alertsFeed && !els.alertsFeed.contains(els.alertsFeedEmpty)) {
        els.alertsFeed.appendChild(els.alertsFeedEmpty);
    }
}

function resetAlertsFeed() {
    if (!els.alertsFeed) return;
    const entries = els.alertsFeed.querySelectorAll('.alerts-line');
    entries.forEach(entry => entry.remove());
    ensureAlertsFeedEmptyVisible(true);
}

function appendAlertsFeedEntry({ kind = 'event', actor = '', message = '', avatar = '' } = {}) {
    if (!els.alertsFeed) return;
    const stick = shouldStickAlertsFeed();
    ensureAlertsFeedEmptyVisible(false);

    const line = document.createElement('div');
    line.className = `alerts-line ${kind}`;

    const left = document.createElement('div');
    left.className = 'alerts-left';

    const avatarNode = document.createElement('div');
    avatarNode.className = 'alerts-avatar';
    const avatarUrl = typeof avatar === 'string' ? avatar.trim() : '';
    if (avatarUrl) {
        const img = document.createElement('img');
        img.src = avatarUrl;
        img.alt = actor ? `${actor} avatar` : '';
        img.loading = 'lazy';
        avatarNode.appendChild(img);
    } else {
        avatarNode.textContent = extractInitialFromName(actor || kind);
    }
    left.appendChild(avatarNode);

    const textWrap = document.createElement('div');
    textWrap.className = 'alerts-text';

    const top = document.createElement('div');
    top.className = 'alerts-top';

    const tag = document.createElement('span');
    tag.className = 'alerts-kind';
    tag.textContent = kind === 'donation' ? 'DONATION' : (kind === 'follower' ? 'FOLLOW' : 'EVENT');
    top.appendChild(tag);

    const time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString();
    top.appendChild(time);

    textWrap.appendChild(top);

    const body = document.createElement('div');
    body.className = 'alerts-message';
    const actorText = (actor || '').trim();
    if (actorText && message) {
        body.textContent = `${actorText} - ${message}`;
    } else {
        body.textContent = message || actorText || 'New event';
    }
    textWrap.appendChild(body);

    left.appendChild(textWrap);
    line.appendChild(left);
    els.alertsFeed.appendChild(line);

    const entries = els.alertsFeed.querySelectorAll('.alerts-line');
    if (entries.length > ALERT_FEED_LIMIT) {
        const removeCount = entries.length - ALERT_FEED_LIMIT;
        for (let i = 0; i < removeCount; i += 1) {
            entries[i].remove();
        }
    }

    if (stick) {
        els.alertsFeed.scrollTop = els.alertsFeed.scrollHeight;
    }
}

function sanitizeCssColor(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
        return trimmed;
    }
    if (/^rgb(a)?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*(0|0?\.\d+|1(\.0*)?))?\s*\)$/i.test(trimmed)) {
        return trimmed;
    }
    if (/^hsl(a)?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%(\s*,\s*(0|0?\.\d+|1(\.0*)?))?\s*\)$/i.test(trimmed)) {
        return trimmed;
    }
    return '';
}

function extractInitialFromName(name) {
    if (typeof name !== 'string') return '?';
    const trimmed = name.trim();
    if (!trimmed) return '?';
    return trimmed.charAt(0).toUpperCase();
}

function createChatBadgeElement(badge) {
    if (!badge) return null;
    if (typeof badge === 'string') {
        const span = document.createElement('span');
        span.className = 'chat-badge';
        span.textContent = badge;
        return span;
    }
    const type = typeof badge.type === 'string' ? badge.type.toLowerCase() : '';
    const label = badge.text || badge.label || badge.title || badge.alt || '';

    if ((type === 'img' || type === 'image' || (!type && badge.src)) && badge.src) {
        const span = document.createElement('span');
        span.className = 'chat-badge';
        const img = document.createElement('img');
        img.src = badge.src;
        if (label) {
            img.alt = label;
            img.title = label;
        } else {
            img.alt = '';
        }
        img.loading = 'lazy';
        span.appendChild(img);
        return span;
    }

    if ((type === 'svg' || type === 'html') && badge.html) {
        const span = document.createElement('span');
        span.className = 'chat-badge';
        span.innerHTML = badge.html;
        if (label) {
            span.title = label;
        }
        return span;
    }

    if (badge.html) {
        const span = document.createElement('span');
        span.className = 'chat-badge';
        span.innerHTML = badge.html;
        if (label) {
            span.title = label;
        }
        return span;
    }

    if (label) {
        const span = document.createElement('span');
        span.className = 'chat-badge';
        span.textContent = label;
        return span;
    }

    if (badge.src) {
        const span = document.createElement('span');
        span.className = 'chat-badge';
        const img = document.createElement('img');
        img.src = badge.src;
        img.alt = '';
        img.loading = 'lazy';
        span.appendChild(img);
        return span;
    }

    return null;
}

function appendChatBadges(container, badges) {
    if (!container) return;
    if (!Array.isArray(badges) || !badges.length) {
        return;
    }
    badges.forEach((badge) => {
        const node = createChatBadgeElement(badge);
        if (node) {
            container.appendChild(node);
        }
    });
}

function appendChatFeedMessage(message, plainText = '') {
    if (!els.chatFeed || !message) return;
    const stick = shouldStickChatFeed();
    ensureChatFeedEmptyVisible(false);

    const line = document.createElement('div');
    line.className = 'chat-line';
    if (message.id != null) {
        line.dataset.messageId = String(message.id);
    }
    if (message.userId != null) {
        line.dataset.userId = String(message.userId);
    }
    if (message.username) {
        line.dataset.username = normalizeChannel(message.username);
    }

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    const avatarUrl = typeof message.chatimg === 'string' ? message.chatimg.trim() : '';
    if (avatarUrl) {
        const img = document.createElement('img');
        img.src = avatarUrl;
        img.alt = message.chatname ? `${message.chatname} avatar` : '';
        img.loading = 'lazy';
        avatar.appendChild(img);
    } else {
        avatar.textContent = extractInitialFromName(message.chatname);
    }
    line.appendChild(avatar);

    const details = document.createElement('div');
    details.className = 'chat-details';
    const meta = document.createElement('div');
    meta.className = 'chat-meta';

    const name = document.createElement('span');
    name.className = 'chat-name';
    name.textContent = message.chatname || 'Kick viewer';
    const safeColor = sanitizeCssColor(message.nameColor);
    if (safeColor) {
        name.style.color = safeColor;
    }
    meta.appendChild(name);

    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'chat-badges';
    appendChatBadges(badgesContainer, message.chatbadges);
    if (badgesContainer.children.length) {
        meta.appendChild(badgesContainer);
    }
    details.appendChild(meta);

    const body = document.createElement('div');
    body.className = 'chat-message';
    const plainTextMessage =
        (typeof plainText === 'string' && plainText.trim())
            ? plainText.trim()
            : (typeof message.chatmessage === 'string'
                ? message.chatmessage.replace(/<[^>]+>/g, '')
                : '');
    // The local chat feed always renders rich content (emotes as images)
    // regardless of the extension's text-only mode setting.
    const chatHtml = message.chatmessage || '';
    const richHtml = chatHtml
        ? chatHtml.replace(/\[emote:(\d+):([^\]]+)\]/g, (m, id, n) => {
            const safeId = id.replace(/[^0-9]/g, '');
            if (!safeId) return m;
            return `<img src="https://files.kick.com/emotes/${safeId}/fullsize" alt="${n}" title="${n}" class="regular-emote"/>`;
        })
        : '';
    if (richHtml) {
        body.innerHTML = richHtml;
    } else {
        body.textContent = plainTextMessage || '';
    }
    details.appendChild(body);

    line.appendChild(details);
    els.chatFeed.appendChild(line);

    const entries = els.chatFeed.querySelectorAll('.chat-line');
    if (entries.length > CHAT_FEED_LIMIT) {
        const removeCount = entries.length - CHAT_FEED_LIMIT;
        for (let i = 0; i < removeCount; i += 1) {
            entries[i].remove();
        }
    }

    if (stick) {
        els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
    }
}

function pickDisplayName(candidates) {
    for (const value of candidates || []) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return 'Kick User';
}

function pickImage(...candidates) {
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return normalizeImage(value.trim());
        }
    }
    return '';
}

function extractMessageContent(message) {
    if (!message) return '';
    if (typeof message === 'string') return message;
    if (typeof message.content === 'string') return message.content;
    const fragments = [];
    if (Array.isArray(message.fragments)) {
        fragments.push(...message.fragments);
    }
    if (Array.isArray(message.content)) {
        fragments.push(...message.content);
    }
    if (Array.isArray(message.parts)) {
        fragments.push(...message.parts);
    }
    if (!fragments.length && Array.isArray(message.messages)) {
        fragments.push(...message.messages);
    }
    const text = fragments.map(extractFragmentText).join('');
    if (text.trim()) {
        return text;
    }
    if (typeof message.text === 'string') return message.text;
    if (typeof message.body === 'string') return message.body;
    if (typeof message.raw === 'string') return message.raw;
    if (typeof message.raw_content === 'string') return message.raw_content;
    if (typeof message.comment === 'string') return message.comment;
    return '';
}

function extractFragmentText(fragment) {
    if (!fragment) return '';
    if (typeof fragment === 'string') return fragment;
    if (typeof fragment.text === 'string') return fragment.text;
    if (typeof fragment.content === 'string') return fragment.content;
    if (typeof fragment.name === 'string' && fragment.type === 'emote') {
        return `:${fragment.name}:`;
    }
    if (typeof fragment.alt === 'string') return fragment.alt;
    if (fragment.emoji) {
        return fragment.emoji.text || fragment.emoji.name || '';
    }
    if (fragment.url) {
        return fragment.url;
    }
    return '';
}

function escapeHtml(str) {
    if (str == null) return '';
    const value = typeof str === 'string' ? str : String(str);
    if (isTextOnlyMode()) {
        return value;
    }
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const randomValues = window.crypto.getRandomValues(new Uint8Array(length));
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset[randomValues[i] % charset.length];
    }
    return result;
}

async function createCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(digest));
    const base64 = btoa(String.fromCharCode.apply(null, hashArray));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function bootstrap() {
    logKickWs('Bootstrap start.');
    restoreKickWindowBounds();
    try {
        await kickCoreReady;
    } catch (error) {
        console.warn('[Kick] Kick core failed to load. Continuing with fallbacks.', error);
    }
    applyKickCoreFallbacks();
    try {
        initElements();
        loadAdvancedControls();
        loadKickProfileCache();
        initExtensionBridge();
        updateBridgeState();
        loadConfig();
        applyDefaultConfig();
        loadTokens();
        loadEventTypesCache();
        applyUrlParams();
        updateInputsFromState();
        updateAuthStatus();
        bindEvents();
        initLocalSocketBridge();
        updateSocketState();
        const handledAuthCallback = await handleAuthCallback();
        // Connect Pusher chat immediately (no auth needed)
        if (state.channelSlug && !state.socket.chatroomId) {
            await resolveChannelForPusher();
        }
        connectPusherSocket();
        // Auth-dependent: subscriptions, bridge events, sending messages
        if (state.tokens?.access_token && !handledAuthCallback) {
            scheduleTokenRefresh();
            await loadAuthenticatedProfile();
            await maybeAutoStart();
            await listSubscriptions();
        }
        connectLocalSocket();
        notifyLiteStatus('ready');
        if (isLiteEmbedded()) {
            sendLiteMessage('kick-lite-ready', { status: getLiteStatusSnapshot() });
        } else {
            window.addEventListener('resize', scheduleKickWindowBoundsSave);
        }
        window.addEventListener('beforeunload', () => {
            if (kickWindowBoundsSaveTimer) {
                clearTimeout(kickWindowBoundsSaveTimer);
                kickWindowBoundsSaveTimer = null;
            }
            persistKickWindowBounds();
            if (profileCachePersistTimer) {
                clearTimeout(profileCachePersistTimer);
                profileCachePersistTimer = null;
                persistKickProfileCache();
            }
            disconnectPusherSocket();
            disconnectLocalSocket();
        });
    } catch (error) {
        console.error('[Kick] Kick websocket bootstrap failed.', error);
        logKickWs(`Bootstrap failed: ${error?.message || error}`, 'error');
    }
}

if (!window.__kickWsBootstrapped) {
    window.__kickWsBootstrapped = true;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
}

// Handle messages from preload-mock.js which uses window.postMessage instead of chrome.runtime
// This is needed when chrome.runtime is deleted for Kasada bypass
window.addEventListener('message', function(event) {
    if (!isTrustedTabBridgeEvent(event)) return;
    if (!event.data || typeof event.data !== 'object') return;
    if (!event.data.__ssappSendToTab) return;

    var request = event.data.__ssappSendToTab;
    if (request.type === 'SOURCE_CONTROL') {
        handleSourceControlRequest(request).catch(function(err) {
            console.error('Kick SOURCE_CONTROL via postMessage failed', err);
        });
        return;
    }
    if (request.type === 'SEND_MESSAGE' && typeof request.message === 'string') {
        sendChatFromExtension(request.message).catch(function(err) {
            console.error('Kick SEND_MESSAGE via postMessage failed', err);
        });
    }
});
