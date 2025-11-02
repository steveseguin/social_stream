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

async function importWithFallback(extensionPath, relativePath) {
    if (
        typeof chrome !== 'undefined' &&
        chrome?.runtime &&
        typeof chrome.runtime.getURL === 'function'
    ) {
        try {
            const specifier = chrome.runtime.getURL(extensionPath);
            return await import(specifier);
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
        mapBadges
    } = kickModule);
})();

kickCoreReady.catch((error) => {
    console.error('Failed to load Kick shared core module', error);
});

const STORAGE_KEY = 'kickApiConfig';
const TOKEN_KEY = 'kickApiTokens';
const CODE_VERIFIER_KEY = 'kickPkceVerifier';
const STATE_KEY = 'kickOAuthState';

const DEFAULT_CONFIG = {
    clientId: '01K7MXFQ9C39VAQ50DCQ2DXSDJ',
    bridgeUrl: 'https://kick-bridge.socialstream.ninja/events'
};

const SUBSCRIPTION_RETRY_DELAY_MS = 10000;
const CHAT_FEED_LIMIT = 200;
const CHAT_SCROLL_THRESHOLD_PX = 48;

const state = {
    clientId: '',
    clientSecret: '',
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
        lastErrorLoggedAt: 0
    },
    chat: {
        sending: false,
        type: 'user'
    }
};

const els = {};
const EVENT_TYPES_CACHE_KEY = 'kickEventTypesCache';
const EVENT_TYPES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const EVENT_TYPES_UNAVAILABLE_COOLDOWN_MS = 60 * 60 * 1000;

let cachedEventTypes = null;
let cachedEventTypesFetchedAt = 0;
let eventTypesUnavailableUntil = 0;

const TAB_ID = typeof window !== 'undefined' && typeof window.__SSAPP_TAB_ID__ !== 'undefined'
    ? window.__SSAPP_TAB_ID__
    : null;

const extension = {
    available: typeof chrome !== 'undefined' && !!(chrome && chrome.runtime && chrome.runtime.id),
    enabled: true,
    settings: {},
    tabId: TAB_ID
};

const WSS_PLATFORM = 'kick';
let extensionInitialized = false;
let lastBridgeNotifyStatus = null;
let lastAuthNotifyStatus = null;
const ignoredEventTypesLogged = new Set();

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
        const next = message.chatType.trim();
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

function resolveProfileIdentifiers(...sources) {
    let userId = null;
    let username = null;
    for (const source of sources) {
        if (!source || typeof source !== 'object') {
            continue;
        }
        if (!userId) {
            const idCandidates = [
                source.id,
                source.user_id,
                source.userId,
                source.broadcaster_user_id,
                source.broadcasterUserId,
                source.identity?.id,
                source.user?.id,
                source.user?.user_id,
                source.profile?.id,
                source.account?.id,
                source.sub,
                source.channel?.id,
                source.channel?.user_id
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
    return getProfileCacheEntry(state.profileCache, ids, options);
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
}

function rememberProfileMiss(...sources) {
    const ids = resolveProfileIdentifiers(...sources);
    if (!ids) {
        return;
    }
    storeProfileCacheEntry(state.profileCache, ids, null);
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
        return replaceEmotesWithImages(escapeHtml(fragment));
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
    return replaceEmotesWithImages(escapeHtml(fallback));
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
    return replaceEmotesWithImages(safeFallback);
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
}

function notifyApp(payload) {
    try {
        if (extension.available) {
            chrome.runtime.sendMessage(chrome.runtime.id, payload, function () {});
            return;
        }
        if (window.ninjafy && window.ninjafy.sendMessage) {
            window.ninjafy.sendMessage(null, payload, null, extension.tabId);
            return;
        }
        if (typeof window !== 'undefined' && window.parent) {
            let data = payload;
            if (payload && typeof payload === 'object') {
                data = { ...payload };
                if (extension.tabId != null) {
                    data.__tabID__ = extension.tabId;
                }
            }
            window.parent.postMessage(data, '*');
        }
    } catch (err) {
        console.error('Failed to notify app', err);
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
                if (request && typeof request === 'object') {
                    if (Object.prototype.hasOwnProperty.call(request, 'state')) {
                        extension.enabled = Boolean(request.state);
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
                console.error('Kick extension message handling failed', err);
            }
            sendResponse(false);
            return false;
        });
    } catch (err) {
        console.error('Failed to register Kick extension bridge listener', err);
    }

    try {
        chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, response => {
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
        channelLabel: q('channel-label'),
        eventLog: q('event-log'),
        chatFeed: q('chat-feed'),
        chatFeedEmpty: q('chat-feed-empty'),
        bridgeState: q('bridge-state'),
        subscriptionSummary: q('subscription-summary'),
        chatMessage: q('chat-message'),
        chatType: q('chat-send-type'),
        sendChat: q('send-chat'),
        chatStatus: q('chat-status')
    });
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
        state.lastResolvedSlug = '';
        state.autoStart.lastSlug = '';
        resetThirdPartyEmoteCache();
        resetChatFeed();
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
    notifyLiteStatus('channel');
}

function loadConfig() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const cfg = JSON.parse(stored);
        state.clientId = cfg.clientId || '';
        state.clientSecret = cfg.clientSecret || '';
        state.redirectUri = cfg.redirectUri || '';
        if (cfg.channelSlug) {
            setChannelSlug(cfg.channelSlug, { persist: false, source: 'storage', force: true });
        } else {
            state.channelSlug = '';
            state.channelSlugSource = '';
        }
        state.bridgeUrl = cfg.bridgeUrl || '';
        state.customEvents = cfg.customEvents || '';
        if (cfg.chatType) {
            state.chat.type = cfg.chatType;
        }
    } catch (err) {
        console.error('Failed to load Kick config', err);
    }
}

function loadTokens() {
    try {
        const stored = localStorage.getItem(TOKEN_KEY);
        if (!stored) return;
        const tokens = JSON.parse(stored);
        if (!tokens || !tokens.access_token) return;
        state.tokens = tokens;
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
    } catch (err) {
        console.error('Failed to parse Kick URL parameters', err);
    }
}

function applyDefaultConfig() {
    if (!state.clientId) {
        state.clientId = DEFAULT_CONFIG.clientId;
    }
    if (!state.redirectUri) {
        state.redirectUri = window.location.origin + window.location.pathname;
    }
    if (!state.bridgeUrl) {
        state.bridgeUrl = DEFAULT_CONFIG.bridgeUrl;
    }
}

function persistConfig() {
    const cfg = {
        clientId: state.clientId,
        clientSecret: state.clientSecret,
        redirectUri: state.redirectUri,
        channelSlug: state.channelSlug,
        bridgeUrl: state.bridgeUrl,
        customEvents: state.customEvents,
        chatType: state.chat?.type || 'user'
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

function persistTokens() {
    if (!state.tokens) {
        localStorage.removeItem(TOKEN_KEY);
        return;
    }
    localStorage.setItem(TOKEN_KEY, JSON.stringify(state.tokens));
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
        els.chatType.value = state.chat?.type || 'user';
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
    if (els.startAuth) {
        els.startAuth.addEventListener('click', startAuthFlow);
    }
    if (els.chatType) {
        els.chatType.addEventListener('change', () => {
            state.chat.type = els.chatType.value;
            persistConfig();
        });
    }
    if (els.sendChat) {
        els.sendChat.addEventListener('click', sendChatMessage);
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

async function startAuthFlow() {
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
        scope: 'user:read channel:read chat:write events:subscribe',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: stateParam
    });

    const authorizeUrl = `https://id.kick.com/oauth/authorize?${params.toString()}`;
    window.location.href = authorizeUrl;
}

async function handleAuthCallback() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    if (!code) return;

    const expectedState = sessionStorage.getItem(STATE_KEY);
    if (!returnedState || returnedState !== expectedState) {
        log('State mismatch during OAuth callback.', 'error');
        return;
    }
    const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
    if (!verifier) {
        log('Missing PKCE verifier for OAuth exchange.', 'error');
        return;
    }

    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, document.title, url.toString());

    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(CODE_VERIFIER_KEY);

    try {
        await exchangeCodeForToken(code, verifier);
        updateAuthStatus();
        await loadAuthenticatedProfile();
        await listSubscriptions();
        await maybeAutoStart(true);
    } catch (err) {
        console.error(err);
        log(`Token exchange failed: ${err.message}`, 'error');
    }
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
    persistTokens();
    scheduleTokenRefresh();
    log('Kick OAuth tokens obtained.');
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

async function refreshAccessToken() {
    if (!state.tokens?.refresh_token) return;
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
        log('Failed to refresh access token. You may need to sign in again.', 'error');
        console.error('Refresh error body:', text);
        return;
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
        await refreshAccessToken();
        return apiFetch(path, options, false);
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
    if (slug) {
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
                    'Kick user details endpoint is still rolling out for this app. Trying the legacy profile endpoint.'
            },
            {
                path: '/public/v1/me',
                notFoundMessage:
                    'Kick profile details are still rolling out on the API. Continuing with sign-in information.'
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
    return (
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
        return state.channelId;
    }
    const previousId = state.channelId;
    const previousSlug = state.lastResolvedSlug;
    const params = new URLSearchParams({ slug: slugLower });
    const data = await apiFetch(`/public/v1/channels?${params.toString()}`);
    const entries = Array.isArray(data?.data) ? data.data : [];
    const channel = entries.find(item => normalizeChannel(item.slug) === slugLower) || entries[0];
    if (!channel?.broadcaster_user_id) {
        throw new Error('Unable to resolve channel user id.');
    }
    state.channelId = channel.broadcaster_user_id;
    state.channelName = channel.slug || channel.channel_description || slugInput;
    state.lastResolvedSlug = slugLower;
    updateInputsFromState();
    if (force || state.channelId !== previousId || previousSlug !== slugLower) {
        requestThirdPartyEmotes({ force: true });
    }
    return state.channelId;
}

async function subscribeToEvents(options = {}) {
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
        summary.textContent = 'Subscriptions pending';
        summary.className = 'status-chip warning';
        summary.title = 'No subscriptions detected yet. They will be created automatically after sign-in.';
        return;
    }

    if (!eventNames.length) {
        summary.textContent = 'Waiting for Kick';
        summary.className = 'status-chip warning';
        summary.title = 'Kick returned webhooks, but none are tied to this channel yet. This usually resolves once Kick finishes provisioning. Remove old Kick webhooks if the message persists.';
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
        if (state.bridge.status === 'disconnected' || !state.bridge.source) {
            connectBridge();
        }

        let channelId;
        try {
            channelId = await resolveChannelId();
        } catch (err) {
            log(err.message, 'error');
            return;
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

function connectBridge() {
    state.bridgeUrl = state.bridgeUrl || DEFAULT_CONFIG.bridgeUrl;
    if (!state.bridgeUrl) {
        log('Unable to determine Kick bridge URL.', 'error');
        return;
    }
    disconnectBridge();
    try {
        const source = new EventSource(state.bridgeUrl, { withCredentials: false });
        state.bridge.source = source;
        state.bridge.status = 'connecting';
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

function handleBridgeEvent(packet) {
    if (!packet) return;
    const body = packet.body || {};
    const type = packet.type || body?.event || 'unknown';
    const bridgeMeta = createBridgeMeta(packet);
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
    if (bridgeMeta?.verified === false) {
        log(`Received unverified webhook event: ${type}`, 'warning');
    }
    if (!bridgeEventMatchesCurrentChannel(packet)) {
        if (!ignoredEventTypesLogged.has(type)) {
            ignoredEventTypesLogged.add(type);
            log(`Ignoring ${type} for a different Kick channel.`, 'info');
        }
        return;
    }
    if (type === 'chat.message.sent') {
        forwardChatMessage(body, bridgeMeta);
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
    if (/support|donat|tip/i.test(type)) {
        forwardSupportEvent(type, body, bridgeMeta);
        return;
    }
    if (type === 'livestream.status.updated') {
        forwardLiveStatus(body, bridgeMeta);
        return;
    }
    log(`Unhandled event: ${type}`);
}

function forwardChatMessage(evt, bridgeMeta) {
    const payload = evt || {};
    const message = payload.message || payload.data?.message || payload.payload?.message || payload;
    const sender = payload.sender || payload.user || message?.sender || payload.profile || {};
    if (!message) {
        log('Chat event missing message payload.', 'warning');
        return;
    }
    const profileSources = [
        sender,
        message?.sender,
        payload.profile,
        payload.user,
        evt?.sender
    ];
    const { profile: actorProfile } = gatherProfileState(...profileSources);
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
    const chatimg =
        actorProfile.avatar ||
        pickImage(
            sender?.profile_picture,
            sender?.profilePicture,
            sender?.avatar,
            message?.sender?.profile_picture,
            message?.sender?.profilePicture,
            message?.sender?.avatar
        );
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
    const normalizedEvent = eventNameForType(rawEventType);
    const messageId = message?.id || payload.message_id || payload.id || null;
    const bridgeMessageId = bridgeMeta?.messageId || null;
    const resolvedId = messageId ?? bridgeMessageId;
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
    const replyDetails = extractReplyDetails(message, payload);
    const textOnlyMode = Boolean(isTextOnlyMode());
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
        messagePayload.id = typeof resolvedId === 'string' ? resolvedId : String(resolvedId);
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
    if (replyDetails) {
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
    // Chat messages should not be flagged as events; only propagate data.event for actual system-level items.
    if (normalizedEvent && normalizedEvent !== 'message') {
        messagePayload.event = normalizedEvent;
    }
    const meta = {};
    if (content) {
        meta.plainText = content;
    }
    if (bridgeMeta) {
        meta.bridge = bridgeMeta;
    }
    if (messageId != null) {
        meta.messageId = messageId;
    }
    if (evt) {
        meta.raw = evt;
    }
    if (replyDetails && replyDetails.meta) {
        meta.reply = replyDetails.meta;
    }
    if (Object.keys(meta).length > 0) {
        messagePayload.meta = meta;
    }
    pushMessage(messagePayload);
    appendChatFeedMessage(messagePayload);
    const prefix = bridgeMeta?.verified === false ? '[CHAT ⚠]' : '[CHAT]';
    log(`${prefix} ${chatname}: ${content || '[no text]'}`);
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
                label: text,
                meta: {
                    text,
                    author: null
                }
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
                label,
                meta: {
                    text,
                    author: author || null,
                    raw: value
                }
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
        chatimg: chatimg || '',
        bridge: bridgeMeta || null,
        raw: evt
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
        bridge: bridgeMeta || null,
        meta,
        raw: evt
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
        message: note,
        raw: evt
    };
    pushMessage({
        type: 'kick',
        event: 'donation',
        chatname,
        chatmessage: escapeHtml(chatmessage),
        chatimg: chatimg || '',
        bridge: bridgeMeta || null,
        meta
    });
    const noteLabel = note ? ` – ${note}` : '';
    const prefix = bridgeMeta?.verified === false ? '[TIP ⚠]' : '[TIP]';
    log(`${prefix} ${supporter}${amountLabel ? ` • ${amountLabel}` : ''}${noteLabel}`);
}

function forwardLiveStatus(evt, bridgeMeta) {
    const isLive = Boolean(evt?.is_live);
    const chatname = 'Kick';
    const chatmessage = isLive ? 'Stream is now LIVE' : 'Stream is now OFFLINE';
    pushMessage({
        type: 'kick',
        event: isLive ? 'stream_online' : 'stream_offline',
        chatname,
        chatmessage: escapeHtml(chatmessage),
        bridge: bridgeMeta || null,
        meta: evt,
        raw: evt
    });
    const prefix = bridgeMeta?.verified === false ? '[LIVE ⚠]' : '[LIVE]';
    log(`${prefix} ${isLive ? 'Online' : 'Offline'}`);
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
    const messageType = els.chatType ? els.chatType.value : state.chat.type || 'user';
    state.chat.type = messageType;
    persistConfig();
    try {
        updateChatSendingState(true);
        setChatStatus('Sending message…');
        const payload = { content };
        if (messageType === 'user') {
            const channelId = await resolveChannelId();
            payload.broadcaster_user_id = channelId;
            payload.type = 'user';
        } else {
            payload.type = 'userbot';
        }
        const response = await apiFetch('/public/v1/chat', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        els.chatMessage.value = '';
        setChatStatus('Message sent.', 'success');
        log('[CHAT] Outbound message submitted.');
        return response;
    } catch (err) {
        console.error('Chat send failed', err);
        setChatStatus(`Failed to send: ${err.message}`, 'error');
        log(`Failed to send chat message: ${err.message}`, 'error');
        throw err;
    } finally {
        updateChatSendingState(false);
    }
}

function pushMessage(data) {
    try {
        if (extension.available) {
            chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {});
            return;
        }
        if (window.ninjafy && window.ninjafy.sendMessage) {
            window.ninjafy.sendMessage(null, { message: data }, null, extension.tabId);
            return;
        }
        if (typeof window !== 'undefined' && window.parent) {
            const envelope = { source: 'socialstream', payload: data };
            if (extension.tabId != null) {
                envelope.__tabID__ = extension.tabId;
            }
            window.parent.postMessage(envelope, '*');
        }
    } catch (err) {
        console.error('Failed to push message', err);
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
    els.eventLog.scrollTop = els.eventLog.scrollHeight;
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

function appendChatFeedMessage(message) {
    if (!els.chatFeed || !message) return;
    const stick = shouldStickChatFeed();
    ensureChatFeedEmptyVisible(false);

    const line = document.createElement('div');
    line.className = 'chat-line';

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
    if (isTextOnlyMode()) {
        if (message.meta?.plainText) {
            body.textContent = message.meta.plainText;
        } else if (message.chatmessage) {
            body.textContent = message.chatmessage;
        } else {
            body.textContent = '';
        }
    } else if (message.chatmessage) {
        body.innerHTML = message.chatmessage;
    } else if (message.meta?.plainText) {
        body.textContent = message.meta.plainText;
    } else {
        body.textContent = '';
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
    await kickCoreReady;
    initElements();
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
    if (state.tokens?.access_token) {
        scheduleTokenRefresh();
        await loadAuthenticatedProfile();
        await maybeAutoStart();
        await listSubscriptions();
    }
    await handleAuthCallback();
    notifyLiteStatus('ready');
    if (isLiteEmbedded()) {
        sendLiteMessage('kick-lite-ready', { status: getLiteStatusSnapshot() });
    }
}

document.addEventListener('DOMContentLoaded', bootstrap);
