const STORAGE_KEY = 'kickApiConfig';
const TOKEN_KEY = 'kickApiTokens';
const CODE_VERIFIER_KEY = 'kickPkceVerifier';
const STATE_KEY = 'kickOAuthState';

const DEFAULT_CONFIG = {
    clientId: '01K7MXFQ9C39VAQ50DCQ2DXSDJ',
    bridgeUrl: 'https://kick.socialstream.ninja:8787/events'
};

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
    eventTypesUnavailable: false,
    autoStart: {
        running: false,
        lastSlug: '',
        pendingForce: false
    },
    bridge: {
        source: null,
        retryTimer: null,
        status: 'disconnected'
    },
    chat: {
        sending: false,
        type: 'user'
    }
};

const els = {};
let cachedEventTypes = null;

function q(id) {
    return document.getElementById(id);
}

function initElements() {
    Object.assign(els, {
        authState: q('auth-state'),
        startAuth: q('start-auth'),
        channelLabel: q('channel-label'),
        eventLog: q('event-log'),
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
    const normalized = slug.toLowerCase();
    const current = (state.channelSlug || '').toLowerCase();
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
    } else {
        state.channelSlug = slug; // Preserve original casing.
    }
    state.channelSlugSource = source;

    if (persist) {
        persistConfig();
    }
    updateInputsFromState();
    maybeAutoStart();
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

function updateInputsFromState() {
    if (els.channelLabel) {
        if (state.channelSlug) {
            const name = state.channelName || state.channelSlug;
            els.channelLabel.textContent = `Channel: ${name}`;
        } else {
            els.channelLabel.textContent = 'Channel: —';
        }
    }
    if (els.chatType) {
        els.chatType.value = state.chat?.type || 'user';
    }
    if (els.chatStatus) {
        els.chatStatus.textContent = '';
    }
}

function updateAuthStatus() {
    if (!els.authState) return;
    const authed = state.tokens?.access_token && !isTokenExpired();
    els.authState.textContent = authed ? 'Signed in' : 'Not signed in';
    els.authState.className = authed ? 'status-chip' : 'status-chip warning';
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
            return 'https://kick.socialstream.ninja:8787';
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

async function loadAuthenticatedProfile() {
    if (!state.tokens?.access_token) return null;
    if (state.profilePromise) {
        return state.profilePromise;
    }
    state.profilePromise = (async () => {
        const applyProfile = profile => {
            if (!profile || typeof profile !== 'object') return null;
            state.authUser = profile;
            const username =
                profile.username ||
                profile.display_name ||
                profile.name ||
                profile.user?.username ||
                '';
            if (username) {
                state.channelName = username;
            }
            const slug =
                profile.slug ||
                profile.channel?.slug ||
                profile.user?.slug ||
                profile.username ||
                '';
            if (slug) {
                setChannelSlug(slug, { source: 'profile' });
            }
            return profile;
        };
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
                    return applyProfile(profile);
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
            return applyProfile(fallback);
        }
        return null;
    })();
    state.profilePromise.finally(() => {
        state.profilePromise = null;
    });
    return state.profilePromise;
}

async function fetchEventTypes(force = false) {
    if (!force) {
        if (state.eventTypesUnavailable) {
            return cachedEventTypes || [];
        }
        if (cachedEventTypes) {
            return cachedEventTypes;
        }
    }
    try {
        const data = await apiFetch('/public/v1/events/types');
        const list = Array.isArray(data?.data) ? data.data : [];
        state.eventTypesUnavailable = false;
        cachedEventTypes = list;
        return list;
    } catch (err) {
        const message = err?.message || '';
        const wasUnavailable = state.eventTypesUnavailable;
        if (/404/.test(message)) {
            state.eventTypesUnavailable = true;
            if (!wasUnavailable) {
                log('Kick has not published the event type list for this app yet. Using the default set instead.', 'warning');
            }
        } else {
            log(`Unable to fetch event types: ${message}`, 'error');
        }
        cachedEventTypes = [];
        return cachedEventTypes;
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
    return (
        entry.event ||
        entry.name ||
        entry.event_name ||
        entry.event_type ||
        entry.type ||
        entry.topic ||
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
        return `Kick temporarily rate-limited ${eventLabel}. We'll automatically retry in a moment.`;
    }
    if (/already exists/i.test(text) || /duplicate/i.test(text)) {
        return `${eventLabel} is already active on Kick.`;
    }
    if (/not authorized/i.test(text)) {
        return `Kick reported that ${eventLabel} isn't enabled for this account. Double-check your Kick developer app scopes.`;
    }
    return `${eventLabel} could not be enabled (Kick replied: ${text})`;
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
    failures.forEach(item => {
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
    const slug = state.channelSlug?.trim();
    if (!slug) throw new Error('Channel slug required.');
    if (!force && state.channelId && state.lastResolvedSlug === slug.toLowerCase()) {
        return state.channelId;
    }
    const params = new URLSearchParams({ slug });
    const data = await apiFetch(`/public/v1/channels?${params.toString()}`);
    const entries = Array.isArray(data?.data) ? data.data : [];
    const channel = entries.find(item => (item.slug || '').toLowerCase() === slug.toLowerCase()) || entries[0];
    if (!channel?.broadcaster_user_id) {
        throw new Error('Unable to resolve channel user id.');
    }
    state.channelId = channel.broadcaster_user_id;
    state.channelName = channel.slug || channel.channel_description || slug;
    state.lastResolvedSlug = slug.toLowerCase();
    updateInputsFromState();
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

    const normalizedSlug = slug.toLowerCase();
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
            updateBridgeState();
            log('Connected to webhook bridge.');
        };

        source.onerror = () => {
            log('Bridge connection error.', 'error');
            state.bridge.status = 'disconnected';
            updateBridgeState();
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
    const chatname = pickDisplayName([
        sender?.display_name,
        sender?.username,
        sender?.name,
        message?.sender?.display_name,
        message?.sender?.username,
        payload.username
    ]);
    const content = extractMessageContent(message) || extractMessageContent(payload) || '';
    const badges = normalizeBadges(
        sender?.identity?.badges ||
        sender?.badges ||
        message?.sender?.identity?.badges ||
        []
    );
    const chatimg = sender?.profile_picture || sender?.avatar || sender?.profilePicture || message?.sender?.profile_picture || '';
    const nameColor = sender?.identity?.username_color || sender?.color || message?.sender?.identity?.username_color || '';
    const messageId = message?.id || payload.message_id || payload.id || null;
    pushMessage({
        type: 'kick',
        chatname,
        chatmessage: escapeHtml(content),
        chatimg: chatimg || '',
        chatbadges: badges,
        nameColor: nameColor || '',
        messageId,
        bridge: bridgeMeta || null,
        raw: evt
    });
    const prefix = bridgeMeta?.verified === false ? '[CHAT ⚠]' : '[CHAT]';
    log(`${prefix} ${chatname}: ${content || '[no text]'}`);
}

function forwardFollower(evt, bridgeMeta) {
    const follower = pickDisplayName([
        evt?.follower?.display_name,
        evt?.follower?.username,
        evt?.user?.display_name,
        evt?.user?.username,
        evt?.username
    ]) || '';
    const chatimg = evt?.follower?.profile_picture || evt?.follower?.avatar || evt?.user?.profile_picture || evt?.user?.avatar || null;
    const chatmessage = follower ? `${follower} started following` : 'New follower';

    pushMessage({
        type: 'kick',
        event: 'new_follower',
        chatname: follower || '',
        chatmessage,
        chatimg: chatimg || ''
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
    const subscriber = pickDisplayName([
        evt?.subscriber?.display_name,
        evt?.subscriber?.username,
        evt?.user?.display_name,
        evt?.user?.username,
        evt?.gifter?.display_name,
        evt?.gifter?.username
    ]);
    const gifter = pickDisplayName([
        evt?.gifter?.display_name,
        evt?.gifter?.username,
        evt?.gifted_by?.display_name,
        evt?.gifted_by?.username
    ]);
    const pickImage = (...candidates) => {
        for (const value of candidates) {
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return '';
    };
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
    const subscriberImage = pickImage(
        evt?.subscriber?.profile_picture,
        evt?.subscriber?.profilePicture,
        evt?.subscriber?.avatar,
        evt?.user?.profile_picture,
        evt?.user?.profilePicture,
        evt?.user?.avatar
    );
    const gifterImage = pickImage(
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
        chatmessage,
        chatimg: chatimg || '',
        meta
    });
    const prefix = bridgeMeta?.verified === false ? '[SUB ⚠]' : '[SUB]';
    log(`${prefix} ${chatmessage}`);
}

function forwardSupportEvent(eventType, evt, bridgeMeta) {
    const supporter = pickDisplayName([
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
        bridge: bridgeMeta || null,
        meta
    });
    const amountLabel = amount != null ? `${amount}${currency ? ' ' + currency : ''}` : '';
    const noteLabel = note ? ` – ${note}` : '';
    const prefix = bridgeMeta?.verified === false ? '[TIP ⚠]' : '[TIP]';
    log(`${prefix} ${supporter}${amountLabel ? ` • ${amountLabel}` : ''}${noteLabel}`);
}

function forwardLiveStatus(evt, bridgeMeta) {
    const isLive = Boolean(evt?.is_live);
    pushMessage({
        type: 'kick',
        event: isLive ? 'stream_online' : 'stream_offline',
        bridge: bridgeMeta || null,
        meta: evt
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
        if (window.chrome?.runtime?.sendMessage) {
            window.chrome.runtime.sendMessage(window.chrome.runtime.id, { message: data }, () => {});
        } else {
            window.parent?.postMessage({ source: 'socialstream', payload: data }, '*');
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

function pickDisplayName(candidates) {
    for (const value of candidates || []) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return 'Kick User';
}

function normalizeBadges(badges) {
    if (!Array.isArray(badges)) return [];
    return badges
        .map(badge => {
            if (!badge) return null;
            if (typeof badge === 'string') {
                return { text: badge, type: 'badge' };
            }
            const text = badge.text || badge.label || badge.title || badge.type || badge.slug || '';
            const type = badge.type || badge.slug || 'badge';
            return text ? { text, type } : null;
        })
        .filter(Boolean);
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
    if (!str) return '';
    return str
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
    initElements();
    loadConfig();
    applyDefaultConfig();
    loadTokens();
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
}

document.addEventListener('DOMContentLoaded', bootstrap);
