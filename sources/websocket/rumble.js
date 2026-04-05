(function () {
    const SOURCE_NAME = 'Rumble';
    const SOURCE_IMG = 'https://rumble.com/favicon.ico';
    const CONFIG_KEY = 'rumbleApiConfig';
    const DEFAULT_CONFIG = {
        apiUrl: '',
        channel: '',
        streamId: '',
        pollMs: 3000,
        replayHistory: false
    };
    const READY_STATE = {
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
    };
    const MAX_SEEN_IDS = 2000;
    const DIRECT_FETCH_ACCEPT = 'application/json,text/plain;q=0.9,*/*;q=0.8';

    const els = {};
    const state = {
        cfg: Object.assign({}, DEFAULT_CONFIG),
        settings: {},
        isExtensionOn: true,
        active: false,
        loading: false,
        pollTimer: null,
        seenIds: new Set(),
        seenOrder: [],
        lastStreamId: '',
        lastStreamLive: null,
        lastViewerCount: null,
        lastFollowerCount: null,
        lastSubscriberCount: null,
        lastSocketState: '',
        lastSocketMessage: '',
        lastSelectedLabel: '',
        warnedStreamFallbackFor: '',
        warnedMissingLivestreams: false,
        consecutiveErrors: 0
    };
    const websocketProxy = {
        readyState: READY_STATE.CLOSED,
        close: function () {
            disconnect(true);
        },
        send: function () {
            log('Rumble API source is read-only. Sending chat is not supported.', 'warn');
            return false;
        }
    };

    try {
        if (window.__SSN_RUMBLE_WS_LOADED__) {
            return;
        }
        window.__SSN_RUMBLE_WS_LOADED__ = true;
    } catch (error) {}

    try {
        window.websocket = websocketProxy;
    } catch (error) {}

    function extAvailable() {
        return typeof chrome !== 'undefined' && chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function';
    }

    function relay(payload) {
        if (!payload || typeof payload !== 'object') {
            return;
        }
        try {
            if (extAvailable() && chrome.runtime.id) {
                chrome.runtime.sendMessage(chrome.runtime.id, payload, function () {});
                return;
            }
        } catch (error) {}

        try {
            if (window.ninjafy && typeof window.ninjafy.sendMessage === 'function') {
                window.ninjafy.sendMessage(null, payload, null, typeof window.__SSAPP_TAB_ID__ !== 'undefined' ? window.__SSAPP_TAB_ID__ : null);
                return;
            }
        } catch (error) {}

        try {
            const forwarded = Object.assign({}, payload);
            if (typeof window.__SSAPP_TAB_ID__ !== 'undefined') {
                forwarded.__tabID__ = window.__SSAPP_TAB_ID__;
            }
            window.postMessage(forwarded, '*');
        } catch (error) {}
    }

    function pushMessage(data) {
        if (!state.isExtensionOn || !data || typeof data !== 'object') {
            return;
        }
        relay({ message: data });
    }

    function pushStatus(status, message, meta) {
        const payload = {
            platform: 'rumble',
            status: String(status || ''),
            message: message || ''
        };
        if (meta && typeof meta === 'object') {
            Object.keys(meta).forEach(function (key) {
                if (typeof meta[key] !== 'undefined') {
                    payload[key] = meta[key];
                }
            });
        }
        relay({ wssStatus: payload });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeXml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function safeStrip(value) {
        if (!value) {
            return '';
        }
        try {
            const div = document.createElement('div');
            div.innerHTML = String(value);
            return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
        } catch (error) {
            return String(value).replace(/\s+/g, ' ').trim();
        }
    }

    function safeTime(value) {
        try {
            if (!value) {
                return new Date().toLocaleTimeString();
            }
            return new Date(value).toLocaleTimeString();
        } catch (error) {
            return String(value || '');
        }
    }

    function normalizeText(value) {
        return String(value == null ? '' : value).trim();
    }

    function normalizeChannelLabel(value) {
        return normalizeText(value);
    }

    function normalizeStreamId(value) {
        return normalizeText(value);
    }

    function buildPopupChatUrl(stream) {
        const streamId = normalizeStreamId(stream && stream.id);
        if (!streamId) {
            return '';
        }
        return 'https://rumble.com/chat/popup/' + encodeURIComponent(streamId);
    }

    function clampPollMs(value) {
        const parsed = parseInt(value, 10);
        if (!isFinite(parsed)) {
            return DEFAULT_CONFIG.pollMs;
        }
        return Math.max(1500, Math.min(parsed, 15000));
    }

    function normalizeApiUrl(value) {
        let raw = normalizeText(value);
        let parsed;
        if (!raw) {
            return '';
        }
        if (!/^[a-z]+:\/\//i.test(raw) && raw.indexOf('rumble.com') >= 0) {
            raw = 'https://' + raw.replace(/^\/+/, '');
        }
        try {
            parsed = new URL(raw);
        } catch (error) {
            return raw;
        }
        parsed.hash = '';
        return parsed.toString();
    }

    function numberOrNull(value) {
        const parsed = Number(value);
        return isFinite(parsed) ? parsed : null;
    }

    function coerceInteger(value) {
        const parsed = parseInt(value, 10);
        return isFinite(parsed) ? parsed : null;
    }

    function formatInteger(value) {
        const parsed = numberOrNull(value);
        if (parsed == null) {
            return '-';
        }
        try {
            return new Intl.NumberFormat().format(parsed);
        } catch (error) {
            return String(parsed);
        }
    }

    function formatDollarAmount(amountDollars, amountCents) {
        const dollars = numberOrNull(amountDollars);
        const cents = numberOrNull(amountCents);
        let numeric = null;
        if (dollars != null) {
            numeric = dollars;
        } else if (cents != null) {
            numeric = cents / 100;
        }
        if (numeric == null) {
            return '';
        }
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
                maximumFractionDigits: 2
            }).format(numeric);
        } catch (error) {
            return '$' + numeric.toFixed(2);
        }
    }

    function prettyLabel(value) {
        return String(value || '')
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, function (letter) {
                return letter.toUpperCase();
            });
    }

    function buildBadgeSvg(label, background, foreground) {
        const text = String(label || '').trim() || 'Badge';
        const width = Math.max(34, Math.round(text.length * 6.5) + 14);
        return {
            type: 'svg',
            html:
                '<svg xmlns="http://www.w3.org/2000/svg" width="' +
                width +
                '" height="16" viewBox="0 0 ' +
                width +
                ' 16" preserveAspectRatio="xMidYMid meet"><rect x="0.5" y="0.5" rx="8" ry="8" width="' +
                (width - 1) +
                '" height="15" fill="' +
                escapeXml(background) +
                '" stroke="rgba(255,255,255,0.24)"></rect><text x="' +
                width / 2 +
                '" y="11" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="' +
                escapeXml(foreground) +
                '">' +
                escapeXml(text) +
                '</text></svg>'
        };
    }

    function rumbleBadgeStyle(value) {
        const normalized = String(value || '').toLowerCase();
        if (normalized === 'admin') {
            return { label: 'Admin', background: '#ef4444', foreground: '#ffffff' };
        }
        if (normalized === 'premium') {
            return { label: 'Premium', background: '#f59e0b', foreground: '#1f2937' };
        }
        if (normalized.indexOf('whale') >= 0) {
            return { label: 'Whale', background: '#2563eb', foreground: '#ffffff' };
        }
        if (normalized.indexOf('mod') >= 0) {
            return { label: 'Mod', background: '#8b5cf6', foreground: '#ffffff' };
        }
        if (normalized.indexOf('verified') >= 0) {
            return { label: 'Verified', background: '#0ea5e9', foreground: '#ffffff' };
        }
        return { label: prettyLabel(normalized || 'badge'), background: '#334155', foreground: '#ffffff' };
    }

    function formatBadgesForDisplay(badges) {
        const result = [];
        (Array.isArray(badges) ? badges : []).forEach(function (badge) {
            const normalized = normalizeText(badge).toLowerCase();
            const style = rumbleBadgeStyle(normalized);
            if (!normalized) {
                return;
            }
            result.push(buildBadgeSvg(style.label, style.background, style.foreground));
        });
        return result;
    }

    function addLine(parent, className, html) {
        let entry;
        if (!parent) {
            return;
        }
        entry = document.createElement('div');
        entry.className = className;
        entry.innerHTML = html;
        parent.appendChild(entry);
        while (parent.children.length > 250) {
            parent.removeChild(parent.firstChild);
        }
        parent.scrollTop = parent.scrollHeight;
    }

    function clearEmptyState(target) {
        if (target && target.parentNode) {
            target.parentNode.removeChild(target);
        }
    }

    function log(message, level) {
        let color = '#8ecde5';
        level = level || 'info';
        if (level === 'success') {
            color = '#7ff0ba';
        } else if (level === 'warn') {
            color = '#ffd37d';
        } else if (level === 'error') {
            color = '#ff9b99';
        }
        clearEmptyState(els.logEmpty);
        addLine(
            els.log,
            'log-entry',
            '<div class="log-meta" style="color:' +
                color +
                ';">' +
                escapeHtml(new Date().toLocaleTimeString()) +
                ' [' +
                escapeHtml(level.toUpperCase()) +
                ']</div><div>' +
                escapeHtml(message || '') +
                '</div>'
        );
    }

    function setChip(element, text, tone) {
        if (!element) {
            return;
        }
        element.className = 'chip';
        if (tone) {
            element.classList.add(tone);
        }
        element.textContent = text;
    }

    function setSocketState(status, message, meta) {
        if (state.lastSocketState === status && state.lastSocketMessage === message) {
            return;
        }
        state.lastSocketState = status;
        state.lastSocketMessage = message || '';
        if (status === 'connected') {
            setChip(els.socketChip, 'Poller: connected', 'good');
        } else if (status === 'connecting') {
            setChip(els.socketChip, 'Poller: connecting', 'warn');
        } else if (status === 'error') {
            setChip(els.socketChip, 'Poller: error', 'bad');
        } else {
            setChip(els.socketChip, 'Poller: disconnected', 'bad');
        }
        pushStatus(status, message, meta || {});
    }

    function rememberEventId(id) {
        const key = String(id == null ? '' : id);
        if (!key) {
            return false;
        }
        if (state.seenIds.has(key)) {
            return false;
        }
        state.seenIds.add(key);
        state.seenOrder.push(key);
        while (state.seenOrder.length > MAX_SEEN_IDS) {
            state.seenIds.delete(state.seenOrder.shift());
        }
        return true;
    }

    function buildBasePayload() {
        return {
            chatbadges: [],
            backgroundColor: '',
            textColor: '',
            chatimg: '',
            hasDonation: '',
            membership: '',
            contentimg: '',
            textonly: !!(state.settings && state.settings.textonlymode),
            type: 'rumble',
            sourceName: SOURCE_NAME,
            sourceImg: SOURCE_IMG
        };
    }

    function buildSafeStreamMeta(stream) {
        const primary = stream && stream.categories && stream.categories.primary ? stream.categories.primary : null;
        const secondary = stream && stream.categories && stream.categories.secondary ? stream.categories.secondary : null;
        return {
            id: stream && stream.id ? String(stream.id) : '',
            title: stream && stream.title ? String(stream.title) : '',
            createdOn: stream && stream.created_on ? String(stream.created_on) : '',
            isLive: !!(stream && stream.is_live),
            likes: coerceInteger(stream && stream.likes),
            dislikes: coerceInteger(stream && stream.dislikes),
            watchingNow: coerceInteger(stream && stream.watching_now),
            categories: {
                primary: primary && primary.title ? String(primary.title) : '',
                secondary: secondary && secondary.title ? String(secondary.title) : ''
            }
        };
    }

    function combineLatestAndRecent(latest, recent, keyBuilder) {
        const output = [];
        const seen = new Set();
        const pushIfNew = function (entry) {
            const key = keyBuilder(entry);
            if (!entry || !key || seen.has(key)) {
                return;
            }
            seen.add(key);
            output.push(entry);
        };
        (Array.isArray(recent) ? recent : []).forEach(pushIfNew);
        pushIfNew(latest);
        return output;
    }

    function sortByDate(items, fieldName) {
        return items.slice().sort(function (a, b) {
            const aValue = new Date(a && a[fieldName] ? a[fieldName] : 0).getTime();
            const bValue = new Date(b && b[fieldName] ? b[fieldName] : 0).getTime();
            return aValue - bValue;
        });
    }

    function buildChatKey(streamId, item) {
        return [
            'chat',
            streamId || '',
            normalizeText(item && item.created_on),
            normalizeText(item && (item.username || item.user)),
            normalizeText(item && item.text)
        ].join('::');
    }

    function buildRantKey(streamId, item) {
        return [
            'rant',
            streamId || '',
            normalizeText(item && item.created_on),
            normalizeText(item && (item.username || item.user)),
            normalizeText(item && item.text),
            String(item && item.amount_cents != null ? item.amount_cents : item && item.amount_dollars != null ? item.amount_dollars : '')
        ].join('::');
    }

    function buildFollowerKey(item) {
        return [
            'follower',
            normalizeText(item && item.followed_on),
            normalizeText(item && (item.username || item.user))
        ].join('::');
    }

    function buildSubscriberKey(item) {
        return [
            'subscriber',
            normalizeText(item && item.subscribed_on),
            normalizeText(item && (item.username || item.user)),
            String(item && item.amount_cents != null ? item.amount_cents : item && item.amount_dollars != null ? item.amount_dollars : '')
        ].join('::');
    }

    function buildGiftKey(item) {
        return [
            'gift',
            normalizeText(item && item.purchased_by),
            String(item && item.video_id != null ? item.video_id : ''),
            String(item && item.total_gifts != null ? item.total_gifts : ''),
            String(item && item.remaining_gifts != null ? item.remaining_gifts : '')
        ].join('::');
    }

    function buildChatPayload(item, stream, snapshot) {
        const payload = buildBasePayload();
        const username = normalizeText(item && (item.username || item.user)) || 'Rumble User';
        const message = normalizeText(item && item.text);
        if (!message) {
            return null;
        }
        payload.chatname = username;
        payload.chatbadges = formatBadgesForDisplay(item && item.badges);
        payload.chatmessage = message;
        payload.meta = {
            source: 'live_stream_api',
            apiType: snapshot && snapshot.type ? String(snapshot.type) : '',
            streamId: stream && stream.id ? String(stream.id) : '',
            streamTitle: stream && stream.title ? String(stream.title) : '',
            createdAt: item && item.created_on ? String(item.created_on) : '',
            badges: Array.isArray(item && item.badges) ? item.badges.slice() : []
        };
        payload.timestamp = payload.meta.createdAt;
        return payload;
    }

    function buildRantPayload(item, stream, snapshot) {
        const payload = buildChatPayload(item, stream, snapshot) || buildBasePayload();
        const username = normalizeText(item && (item.username || item.user)) || 'Rumble User';
        const amountLabel = formatDollarAmount(item && item.amount_dollars, item && item.amount_cents);
        payload.chatname = username;
        payload.chatbadges = formatBadgesForDisplay(item && item.badges);
        payload.chatmessage = payload.chatmessage || 'Sent a rant';
        payload.event = 'donation';
        payload.hasDonation = amountLabel;
        payload.meta = Object.assign({}, payload.meta || {}, {
            source: 'live_stream_api',
            apiType: snapshot && snapshot.type ? String(snapshot.type) : '',
            streamId: stream && stream.id ? String(stream.id) : '',
            streamTitle: stream && stream.title ? String(stream.title) : '',
            createdAt: item && item.created_on ? String(item.created_on) : '',
            expiresOn: item && item.expires_on ? String(item.expires_on) : '',
            amount_cents: coerceInteger(item && item.amount_cents),
            amount_dollars: numberOrNull(item && item.amount_dollars),
            currency: 'USD',
            rant: true,
            badges: Array.isArray(item && item.badges) ? item.badges.slice() : []
        });
        payload.timestamp = payload.meta.createdAt;
        return payload;
    }

    function buildFollowerPayload(item, snapshot) {
        const payload = buildBasePayload();
        const username = normalizeText(item && (item.username || item.user)) || 'Rumble User';
        payload.chatname = username;
        payload.chatmessage = 'Started following';
        payload.event = 'new_follower';
        payload.meta = {
            source: 'live_stream_api',
            apiType: snapshot && snapshot.type ? String(snapshot.type) : '',
            followedOn: item && item.followed_on ? String(item.followed_on) : ''
        };
        payload.timestamp = payload.meta.followedOn;
        return payload;
    }

    function buildSubscriberPayload(item, snapshot) {
        const payload = buildBasePayload();
        const username = normalizeText(item && (item.username || item.user)) || 'Rumble User';
        const amountLabel = formatDollarAmount(item && item.amount_dollars, item && item.amount_cents);
        payload.chatname = username;
        payload.chatmessage = 'Subscribed';
        payload.event = 'new_subscriber';
        payload.membership = 'SUBSCRIBER';
        payload.subtitle = amountLabel || '';
        payload.meta = {
            source: 'live_stream_api',
            apiType: snapshot && snapshot.type ? String(snapshot.type) : '',
            subscribedOn: item && item.subscribed_on ? String(item.subscribed_on) : '',
            amount_cents: coerceInteger(item && item.amount_cents),
            amount_dollars: numberOrNull(item && item.amount_dollars),
            currency: amountLabel ? 'USD' : ''
        };
        payload.timestamp = payload.meta.subscribedOn;
        return payload;
    }

    function buildGiftPayload(item, snapshot) {
        const payload = buildBasePayload();
        const count = Math.max(1, coerceInteger(item && item.total_gifts) || 1);
        const purchaser = normalizeText(item && item.purchased_by) || 'Rumble User';
        payload.chatname = purchaser;
        payload.chatmessage = 'Gifted ' + count + ' Rumble subscription' + (count === 1 ? '' : 's');
        payload.event = 'subscription_gift';
        payload.membership = 'SUBSCRIBER';
        payload.hasDonation = count + ' Gifted';
        payload.meta = {
            source: 'live_stream_api',
            apiType: snapshot && snapshot.type ? String(snapshot.type) : '',
            totalGifted: count,
            remainingGifts: coerceInteger(item && item.remaining_gifts),
            giftType: normalizeText(item && item.gift_type),
            videoId: coerceInteger(item && item.video_id)
        };
        return payload;
    }

    function appendFeedEntry(payload, options) {
        let avatar;
        let badges;
        let messageHtml;
        let labelHtml;
        let metaSuffix = '';
        let pillClass = 'event-pill';
        options = options || {};
        clearEmptyState(els.feedEmpty);
        avatar = payload.chatimg ? '<img class="avatar" src="' + escapeHtml(payload.chatimg) + '" alt="" />' : '<span class="avatar"></span>';
        badges = Array.isArray(payload.chatbadges) ? payload.chatbadges.map(function (badge) {
            if (badge && badge.html) {
                return badge.html;
            }
            if (badge && badge.type === 'text' && badge.text) {
                return '<span>' + escapeHtml(badge.text) + '</span>';
            }
            return '';
        }).filter(Boolean).join('') : '';
        if (payload.hasDonation) {
            metaSuffix += ' <span class="event-pill warn">' + escapeHtml(payload.hasDonation) + '</span>';
        }
        if (options.seeded) {
            metaSuffix += ' <span class="event-pill warn">Seeded</span>';
        }
        if (payload.event === 'donation') {
            pillClass += ' warn';
        } else if (payload.event && payload.event !== 'new_subscriber' && payload.event !== 'subscription_gift') {
            pillClass += ' bad';
        }
        messageHtml = escapeHtml(String(payload.chatmessage || '')).replace(/\n/g, '<br>');
        labelHtml = payload.event
            ? '<span class="' + pillClass + '">' + escapeHtml(payload.chatmessage || payload.event) + '</span>'
            : '<span class="feed-message">' + messageHtml + '</span>';
        addLine(
            els.feed,
            'feed-entry',
            '<div class="feed-top">' +
                avatar +
                '<div style="min-width:0;flex:1 1 auto;">' +
                    '<div class="feed-meta">' + escapeHtml(safeTime(payload.timestamp || '')) + metaSuffix + '</div>' +
                    '<div><span class="feed-name">' + escapeHtml(safeStrip(payload.chatname || '')) + '</span><span class="badge-strip">' + badges + '</span></div>' +
                    '<div class="feed-message">' + labelHtml + '</div>' +
                '</div>' +
            '</div>'
        );
    }

    async function fetchJson(url) {
        if (extAvailable() && chrome.runtime && chrome.runtime.id) {
            return new Promise(function (resolve, reject) {
                try {
                    chrome.runtime.sendMessage(chrome.runtime.id, { cmd: 'rumbleFetchJson', url: url }, function (response) {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message || 'Rumble background fetch failed'));
                            return;
                        }
                        if (!response || !response.ok) {
                            reject(new Error((response && response.error) || 'Rumble background fetch failed'));
                            return;
                        }
                        resolve(response.data);
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }

        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit',
            headers: {
                Accept: DIRECT_FETCH_ACCEPT
            }
        });
        if (response.status === 429) {
            var retryAfter = parseInt(response.headers.get('Retry-After'), 10);
            var err = new Error('Rate limited by Rumble (HTTP 429). Backing off.');
            err.rateLimited = true;
            err.retryAfterSec = isFinite(retryAfter) ? retryAfter : null;
            throw err;
        }
        const text = await response.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (error) {
            if (text && /^\s*</.test(text)) {
                throw new Error('Rumble returned an HTML page instead of JSON data. Make sure you copied the generated API URL, not the settings page URL.');
            }
            throw new Error('Rumble did not return valid JSON.');
        }
        if (!response.ok) {
            throw new Error((data && (data.error || data.message)) || ('HTTP ' + response.status));
        }
        return data;
    }

    function validateSnapshot(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('The API response was empty.');
        }
        if (!('followers' in data) && !('subscribers' in data) && !('livestreams' in data) && !('gifted_subs' in data)) {
            throw new Error('That response does not look like a Rumble Live Stream API payload.');
        }
    }

    function selectLivestream(data) {
        const streams = Array.isArray(data && data.livestreams) ? data.livestreams : [];
        const desiredId = normalizeStreamId(state.cfg.streamId);
        let selected = null;

        if (!streams.length) {
            if (desiredId) {
                throw new Error('Configured stream ID "' + desiredId + '" was not found in the API response.');
            }
            return { stream: null, livestreams: [] };
        }

        if (desiredId) {
            selected = streams.find(function (item) {
                return String(item && item.id ? item.id : '').toLowerCase() === desiredId.toLowerCase();
            }) || null;
            if (!selected) {
                state.warnedStreamFallbackFor = '';
                throw new Error('Configured stream ID "' + desiredId + '" was not found in the API response.');
            } else {
                state.warnedStreamFallbackFor = '';
            }
            return { stream: selected, livestreams: streams };
        }

        selected = streams.find(function (item) {
            return !!(item && item.is_live);
        }) || streams[0] || null;
        return { stream: selected, livestreams: streams };
    }

    function updateHeaderChips(snapshot, stream) {
        let sourceLabel = normalizeChannelLabel(state.cfg.channel);
        const sourceType = normalizeText(snapshot && snapshot.type);
        const followers = snapshot && snapshot.followers ? coerceInteger(snapshot.followers.num_followers) : null;
        const subscribers = snapshot && snapshot.subscribers ? coerceInteger(snapshot.subscribers.num_subscribers) : null;
        const viewers = stream ? coerceInteger(stream.watching_now) : null;
        const streamLabel = stream && stream.title ? String(stream.title) : (stream ? 'Selected stream' : 'No active stream');

        if (!sourceLabel) {
            if (sourceType === 'user') {
                sourceLabel = snapshot && snapshot.user_id ? 'User ' + snapshot.user_id : 'Rumble user';
            } else if (sourceType === 'channel') {
                sourceLabel = snapshot && snapshot.channel_id ? 'Channel ' + snapshot.channel_id : 'Rumble channel';
            } else {
                sourceLabel = 'Rumble API';
            }
        }

        state.lastSelectedLabel = sourceLabel;
        document.title = 'Social Stream - Rumble API Source' + (sourceLabel ? ' (' + sourceLabel + ')' : '');

        setChip(els.sourceChip, 'Source: ' + sourceLabel + (sourceType ? ' [' + sourceType + ']' : ''), sourceType ? 'good' : '');
        setChip(els.streamChip, 'Stream: ' + streamLabel, stream && stream.is_live ? 'good' : (stream ? 'warn' : 'bad'));
        setChip(els.viewerChip, 'Viewers: ' + formatInteger(viewers), viewers != null ? 'good' : '');
        setChip(els.followerChip, 'Followers: ' + formatInteger(followers), followers != null ? 'good' : '');
        setChip(els.subscriberChip, 'Subscribers: ' + formatInteger(subscribers), subscribers != null ? 'good' : '');
        updatePopupControls(stream);
    }

    function updatePopupControls(stream) {
        const popupUrl = buildPopupChatUrl(stream);
        if (els.popupUrl) {
            els.popupUrl.value = popupUrl;
        }
        if (els.openPopup) {
            els.openPopup.disabled = !popupUrl;
        }
        if (els.copyPopup) {
            els.copyPopup.disabled = !popupUrl;
        }
    }

    function maybeEmitCounterEvent(eventName, count, trackerName) {
        if (!isFinite(count)) {
            return;
        }
        if (state[trackerName] === count) {
            return;
        }
        state[trackerName] = count;
        pushMessage({
            type: 'rumble',
            event: eventName,
            meta: count,
            sourceName: SOURCE_NAME,
            sourceImg: SOURCE_IMG
        });
    }

    function maybeEmitStreamState(stream) {
        const nextId = stream && stream.id ? String(stream.id) : '';
        const isLive = !!(stream && stream.is_live);
        const meta = buildSafeStreamMeta(stream || {});

        if (state.lastStreamLive === null) {
            state.lastStreamId = nextId;
            state.lastStreamLive = isLive;
            return;
        }

        if (isLive && (!state.lastStreamLive || state.lastStreamId !== nextId)) {
            pushMessage({
                type: 'rumble',
                event: 'stream_online',
                meta: meta,
                sourceName: SOURCE_NAME,
                sourceImg: SOURCE_IMG
            });
        } else if (!isLive && state.lastStreamLive) {
            pushMessage({
                type: 'rumble',
                event: 'stream_offline',
                meta: {
                    id: state.lastStreamId || '',
                    title: meta.title || ''
                },
                sourceName: SOURCE_NAME,
                sourceImg: SOURCE_IMG
            });
            maybeEmitCounterEvent('viewer_update', 0, 'lastViewerCount');
        }

        state.lastStreamId = nextId;
        state.lastStreamLive = isLive;
    }

    function processCollection(items, options) {
        let forwarded = 0;
        let seeded = 0;
        items.forEach(function (entry) {
            let payload;
            if (!entry || !rememberEventId(entry.key)) {
                return;
            }
            payload = entry.build();
            if (!payload) {
                return;
            }
            if (options.seedOnly) {
                appendFeedEntry(payload, { seeded: true });
                seeded += 1;
                return;
            }
            pushMessage(payload);
            appendFeedEntry(payload);
            forwarded += 1;
        });
        return { forwarded: forwarded, seeded: seeded };
    }

    function processSnapshot(snapshot, initialLoad) {
        const streamSelection = selectLivestream(snapshot);
        const stream = streamSelection.stream;
        const sourceFollowers = snapshot && snapshot.followers ? coerceInteger(snapshot.followers.num_followers) : null;
        const sourceSubscribers = snapshot && snapshot.subscribers ? coerceInteger(snapshot.subscribers.num_subscribers) : null;
        const viewers = stream ? coerceInteger(stream.watching_now) : null;
        const recentMessages = stream && stream.chat ? combineLatestAndRecent(stream.chat.latest_message, stream.chat.recent_messages, function (item) {
            return buildChatKey(stream && stream.id ? stream.id : '', item);
        }) : [];
        const recentRants = stream && stream.chat ? combineLatestAndRecent(stream.chat.latest_rant, stream.chat.recent_rants, function (item) {
            return buildRantKey(stream && stream.id ? stream.id : '', item);
        }) : [];
        const recentFollowers = snapshot && snapshot.followers ? combineLatestAndRecent(snapshot.followers.latest_follower, snapshot.followers.recent_followers, buildFollowerKey) : [];
        const recentSubscribers = snapshot && snapshot.subscribers ? combineLatestAndRecent(snapshot.subscribers.latest_subscriber, snapshot.subscribers.recent_subscribers, buildSubscriberKey) : [];
        const recentGiftedSubs = snapshot && snapshot.gifted_subs ? combineLatestAndRecent(snapshot.gifted_subs.latest_gifted_sub, snapshot.gifted_subs.recent_gifted_subs, buildGiftKey) : [];
        const entries = [];
        let results;

        updateHeaderChips(snapshot, stream);
        maybeEmitStreamState(stream);
        if (sourceFollowers != null) {
            maybeEmitCounterEvent('follower_update', sourceFollowers, 'lastFollowerCount');
        }
        if (sourceSubscribers != null) {
            maybeEmitCounterEvent('subscriber_update', sourceSubscribers, 'lastSubscriberCount');
        }
        if (viewers != null) {
            maybeEmitCounterEvent('viewer_update', viewers, 'lastViewerCount');
        } else if (state.lastViewerCount !== null && state.lastViewerCount !== 0) {
            maybeEmitCounterEvent('viewer_update', 0, 'lastViewerCount');
        }

        if (initialLoad && Array.isArray(snapshot && snapshot.livestreams) && snapshot.livestreams.length === 0) {
            log('No active livestream found. The API only shows chat data while you are live.', 'warn');
        }
        if (!Array.isArray(snapshot && snapshot.livestreams) && !state.warnedMissingLivestreams) {
            state.warnedMissingLivestreams = true;
            log('No active livestream found. The API only shows chat data while you are live.', 'warn');
        }

        sortByDate(recentFollowers, 'followed_on').forEach(function (item) {
            entries.push({
                key: buildFollowerKey(item),
                build: function () {
                    return buildFollowerPayload(item, snapshot);
                }
            });
        });
        sortByDate(recentSubscribers, 'subscribed_on').forEach(function (item) {
            entries.push({
                key: buildSubscriberKey(item),
                build: function () {
                    return buildSubscriberPayload(item, snapshot);
                }
            });
        });
        recentGiftedSubs.forEach(function (item) {
            entries.push({
                key: buildGiftKey(item),
                build: function () {
                    return buildGiftPayload(item, snapshot);
                }
            });
        });
        sortByDate(recentMessages, 'created_on').forEach(function (item) {
            entries.push({
                key: buildChatKey(stream && stream.id ? stream.id : '', item),
                build: function () {
                    return buildChatPayload(item, stream, snapshot);
                }
            });
        });
        sortByDate(recentRants, 'created_on').forEach(function (item) {
            entries.push({
                key: buildRantKey(stream && stream.id ? stream.id : '', item),
                build: function () {
                    return buildRantPayload(item, stream, snapshot);
                }
            });
        });

        results = processCollection(entries, {
            seedOnly: !!(initialLoad && !state.cfg.replayHistory)
        });

        if (initialLoad) {
            if (results.seeded) {
                log('Seeded ' + results.seeded + ' recent Rumble item' + (results.seeded === 1 ? '' : 's') + ' without relaying them.', 'info');
            } else {
                log('Initial Rumble snapshot loaded.', 'success');
            }
        } else if (results.forwarded) {
            log('Forwarded ' + results.forwarded + ' new Rumble item' + (results.forwarded === 1 ? '' : 's') + '.', 'info');
        }
    }

    async function pollOnce(initialLoad) {
        let data;
        if (!state.active || state.loading) {
            return false;
        }
        state.loading = true;
        try {
            data = await fetchJson(state.cfg.apiUrl);
            validateSnapshot(data);
            processSnapshot(data, !!initialLoad);
            return true;
        } finally {
            state.loading = false;
        }
    }

    function clearTimers() {
        if (state.pollTimer) {
            clearInterval(state.pollTimer);
            clearTimeout(state.pollTimer);
            state.pollTimer = null;
        }
    }

    function startTimers() {
        clearTimers();
        state.pollTimer = setInterval(function () {
            pollOnce(false).then(function () {
                if (state.consecutiveErrors > 0) {
                    state.consecutiveErrors = 0;
                    log('Poll recovered. Resuming normal interval.', 'success');
                }
            }).catch(function (error) {
                state.consecutiveErrors += 1;
                var message = (error && error.message) || String(error || 'Unknown error');
                if (error && error.rateLimited) {
                    var backoff = error.retryAfterSec
                        ? error.retryAfterSec * 1000
                        : Math.min(state.cfg.pollMs * Math.pow(2, state.consecutiveErrors), 60000);
                    setSocketState('error', 'Rate limited. Waiting ' + Math.round(backoff / 1000) + 's before retrying.');
                    log('HTTP 429 rate limit. Backing off ' + Math.round(backoff / 1000) + 's.', 'warn');
                    clearTimers();
                    state.pollTimer = setTimeout(function () {
                        startTimers();
                        pollOnce(false).catch(function () {});
                    }, backoff);
                    return;
                }
                setSocketState('error', 'Poll failed: ' + message);
                log('Rumble poll failed: ' + message, 'error');
            });
        }, state.cfg.pollMs);
    }

    function syncButtons() {
        if (els.connect) {
            els.connect.disabled = !!state.active;
        }
        if (els.disconnect) {
            els.disconnect.disabled = !state.active;
        }
        if (els.refresh) {
            els.refresh.disabled = !state.active;
        }
    }

    function loadConfig() {
        let saved;
        const query = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
        try {
            saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
            if (saved && typeof saved === 'object') {
                Object.assign(state.cfg, saved);
            }
        } catch (error) {}

        if (query.get('apiUrl') || query.get('api') || query.get('url') || hash.get('apiUrl') || hash.get('api')) {
            state.cfg.apiUrl = normalizeApiUrl(query.get('apiUrl') || query.get('api') || query.get('url') || hash.get('apiUrl') || hash.get('api') || hash.get('url'));
        }
        if (query.get('channel') || hash.get('channel')) {
            state.cfg.channel = normalizeChannelLabel(query.get('channel') || hash.get('channel'));
        }
        if (query.get('streamId') || query.get('stream') || hash.get('streamId') || hash.get('stream')) {
            state.cfg.streamId = normalizeStreamId(query.get('streamId') || query.get('stream') || hash.get('streamId') || hash.get('stream'));
        }
        if (query.get('poll') || query.get('interval') || hash.get('poll') || hash.get('interval')) {
            state.cfg.pollMs = clampPollMs(query.get('poll') || query.get('interval') || hash.get('poll') || hash.get('interval'));
        }
        if (query.get('replay') != null || hash.get('replay') != null) {
            const replayValue = query.get('replay') != null ? query.get('replay') : hash.get('replay');
            state.cfg.replayHistory = replayValue !== '0' && replayValue !== 'false';
        }
    }

    function saveConfig() {
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(state.cfg));
        } catch (error) {}
    }

    function syncConfigFromUi() {
        state.cfg.apiUrl = normalizeApiUrl(els.apiUrl ? els.apiUrl.value : state.cfg.apiUrl);
        state.cfg.channel = normalizeChannelLabel(els.channelLabel ? els.channelLabel.value : state.cfg.channel);
        state.cfg.streamId = normalizeStreamId(els.streamId ? els.streamId.value : state.cfg.streamId);
        state.cfg.pollMs = clampPollMs(els.pollMs ? els.pollMs.value : state.cfg.pollMs);
        state.cfg.replayHistory = !!(els.replayHistory && els.replayHistory.checked);
        saveConfig();
    }

    function applyConfigToUi() {
        if (els.apiUrl) {
            els.apiUrl.value = state.cfg.apiUrl || '';
        }
        if (els.channelLabel) {
            els.channelLabel.value = state.cfg.channel || '';
        }
        if (els.streamId) {
            els.streamId.value = state.cfg.streamId || '';
        }
        if (els.pollMs) {
            els.pollMs.value = String(state.cfg.pollMs || DEFAULT_CONFIG.pollMs);
        }
        if (els.replayHistory) {
            els.replayHistory.checked = !!state.cfg.replayHistory;
        }
    }

    async function connect() {
        syncConfigFromUi();
        if (!state.cfg.apiUrl) {
            throw new Error('A Rumble Live Stream API URL is required. Open the API Dashboard to generate one.');
        }
        if (/\/account\/livestream-api/i.test(state.cfg.apiUrl)) {
            throw new Error('It looks like you pasted the settings page URL. Copy the generated API URL from that page instead.');
        }
        state.active = true;
        state.seenIds.clear();
        state.seenOrder = [];
        state.lastStreamId = '';
        state.lastStreamLive = null;
        state.lastViewerCount = null;
        state.lastFollowerCount = null;
        state.lastSubscriberCount = null;
        state.warnedStreamFallbackFor = '';
        websocketProxy.readyState = READY_STATE.CONNECTING;
        syncButtons();
        setSocketState('connecting', 'Connecting to the Rumble Live Stream API...');
        log('Connecting to the Rumble Live Stream API.', 'info');
        try {
            await pollOnce(true);
            startTimers();
            websocketProxy.readyState = READY_STATE.OPEN;
            setSocketState('connected', 'Connected to the Rumble API. Polling every ' + state.cfg.pollMs + 'ms.', {
                streamId: state.cfg.streamId || ''
            });
        } catch (error) {
            state.active = false;
            websocketProxy.readyState = READY_STATE.CLOSED;
            syncButtons();
            throw error;
        }
    }

    function disconnect(manual) {
        clearTimers();
        state.active = false;
        websocketProxy.readyState = READY_STATE.CLOSED;
        setSocketState('disconnected', manual ? 'Disconnected from the Rumble API.' : 'Rumble polling stopped.');
        syncButtons();
    }

    async function refreshNow() {
        if (!state.active) {
            throw new Error('Connect before refreshing.');
        }
        await pollOnce(false);
    }

    function bridge() {
        if (extAvailable()) {
            try {
                chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
                    try {
                        if (request === 'getSource') {
                            // Rumble websocket mode is read-only, so keep it out of relay targets.
                            sendResponse(false);
                            return;
                        }
                        if (request === 'focusChat') {
                            sendResponse(false);
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
                            if (request.type === 'SEND_MESSAGE') {
                                log('Rumble API mode is read-only. Chat send is not supported by the documented API.', 'warn');
                                sendResponse(false);
                                return;
                            }
                        }
                    } catch (error) {
                        log('Extension bridge error: ' + ((error && error.message) || error), 'error');
                    }
                    sendResponse(false);
                });
            } catch (error) {
                log('Failed wiring extension bridge: ' + ((error && error.message) || error), 'warn');
            }

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
            } catch (error) {}
        }

        window.addEventListener('message', function (event) {
            let request = event && event.data;
            if (!request || typeof request !== 'object') {
                return;
            }
            if (request.__ssappSendToTab) {
                request = request.__ssappSendToTab;
            }
            if (request.type === 'SEND_MESSAGE') {
                log('Rumble API mode is read-only. Chat send is not supported by the documented API.', 'warn');
            }
        });
    }

    function bindUi() {
        if (els.saveConfig) {
            els.saveConfig.addEventListener('click', function () {
                syncConfigFromUi();
                applyConfigToUi();
                log('Configuration saved.', 'success');
            });
        }
        if (els.connect) {
            els.connect.addEventListener('click', function () {
                connect().catch(function (error) {
                    const message = (error && error.message) || String(error || 'Unknown error');
                    setSocketState('error', 'Connect failed: ' + message);
                    log('Connect failed: ' + message, 'error');
                    syncButtons();
                });
            });
        }
        if (els.disconnect) {
            els.disconnect.addEventListener('click', function () {
                disconnect(true);
            });
        }
        if (els.refresh) {
            els.refresh.addEventListener('click', function () {
                refreshNow().catch(function (error) {
                    const message = (error && error.message) || String(error || 'Unknown error');
                    setSocketState('error', 'Refresh failed: ' + message);
                    log('Refresh failed: ' + message, 'error');
                });
            });
        }
        if (els.openDocs) {
            els.openDocs.addEventListener('click', function () {
                window.open('https://rumble.support/en/help/how-to-use-rumble-s-live-stream-api', '_blank', 'noopener');
            });
        }
        if (els.openDashboard) {
            els.openDashboard.addEventListener('click', function () {
                window.open('https://rumble.com/account/livestream-api', '_blank', 'noopener');
            });
        }
        if (els.openPopup) {
            els.openPopup.addEventListener('click', function () {
                const popupUrl = els.popupUrl ? normalizeText(els.popupUrl.value) : '';
                if (!popupUrl) {
                    log('No popup URL has been resolved yet. Connect first so the API can select a stream.', 'warn');
                    return;
                }
                window.open(popupUrl, '_blank', 'noopener');
            });
        }
        if (els.copyPopup) {
            els.copyPopup.addEventListener('click', function () {
                const popupUrl = els.popupUrl ? normalizeText(els.popupUrl.value) : '';
                if (!popupUrl) {
                    log('No popup URL has been resolved yet. Connect first so the API can select a stream.', 'warn');
                    return;
                }
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    navigator.clipboard.writeText(popupUrl).then(function () {
                        log('Copied the resolved Rumble popup chat URL.', 'success');
                    }).catch(function () {
                        if (els.popupUrl && typeof els.popupUrl.select === 'function') {
                            els.popupUrl.focus();
                            els.popupUrl.select();
                        }
                        log('Clipboard access failed. The popup URL has been selected for manual copy.', 'warn');
                    });
                    return;
                }
                if (els.popupUrl && typeof els.popupUrl.select === 'function') {
                    els.popupUrl.focus();
                    els.popupUrl.select();
                }
                log('Clipboard access is unavailable here. The popup URL has been selected for manual copy.', 'warn');
            });
        }
    }

    function initEls() {
        els.apiUrl = document.getElementById('api-url');
        els.channelLabel = document.getElementById('channel-label');
        els.streamId = document.getElementById('stream-id');
        els.pollMs = document.getElementById('poll-ms');
        els.replayHistory = document.getElementById('replay-history');
        els.saveConfig = document.getElementById('save-config');
        els.connect = document.getElementById('connect');
        els.disconnect = document.getElementById('disconnect');
        els.refresh = document.getElementById('refresh');
        els.openDocs = document.getElementById('open-docs');
        els.openDashboard = document.getElementById('open-dashboard');
        els.popupUrl = document.getElementById('popup-url');
        els.openPopup = document.getElementById('open-popup');
        els.copyPopup = document.getElementById('copy-popup');
        els.socketChip = document.getElementById('socket-chip');
        els.sourceChip = document.getElementById('source-chip');
        els.streamChip = document.getElementById('stream-chip');
        els.viewerChip = document.getElementById('viewer-chip');
        els.followerChip = document.getElementById('follower-chip');
        els.subscriberChip = document.getElementById('subscriber-chip');
        els.advancedSection = document.getElementById('advanced-section');
        els.feed = document.getElementById('feed');
        els.feedEmpty = document.getElementById('feed-empty');
        els.log = document.getElementById('log');
        els.logEmpty = document.getElementById('log-empty');
    }

    function bootstrap() {
        initEls();
        bridge();
        loadConfig();
        applyConfigToUi();
        bindUi();
        syncButtons();
        updatePopupControls(null);
        setSocketState('disconnected', 'Rumble API source is idle.');
        if (els.advancedSection) {
            try {
                if (localStorage.getItem('rumbleAdvancedOpen') === '1') {
                    els.advancedSection.open = true;
                }
            } catch (e) {}
            els.advancedSection.addEventListener('toggle', function () {
                try { localStorage.setItem('rumbleAdvancedOpen', els.advancedSection.open ? '1' : '0'); } catch (e) {}
            });
        }
        if (state.cfg.apiUrl) {
            connect().catch(function (error) {
                const message = (error && error.message) || String(error || 'Unknown error');
                setSocketState('error', 'Auto-connect failed: ' + message);
                log('Auto-connect failed: ' + message, 'error');
                syncButtons();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else {
        bootstrap();
    }
})();
