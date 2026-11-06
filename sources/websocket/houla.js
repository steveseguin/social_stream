/*
 * Hou.la source for Social Stream Ninja.
 *
 * Hou.la exposes a receive-only event channel (Socket.IO) that a creator opens with
 * an event key generated in their Hou.la studio. This script subscribes to that
 * channel and forwards live chat comments — plus gifts and new followers — as
 * ordinary Social Stream messages.
 *
 * ONE file covers the three contexts SSN can run us in:
 *
 *   1. extension content script (isolated world) -> chrome.runtime.sendMessage
 *   2. standalone app source window (page world)  -> window.ninjafy.sendMessage
 *   3. plain browser tab / OBS browser source     -> wss://io.socialstream.ninja
 *
 * In (1) the manifest injects this file. houla.html only loads its own copy
 * when no injected copy announced itself (see INIT_ATTR): running twice would
 * send every comment twice.
 *
 * The key is self-scoped: it only ever receives the events of the workspace it
 * belongs to, and cannot post in chat or spend coins. It is still a SECRET: it
 * is only ever sent to Hou.la's own API (see API_ALLOWED), never logged.
 * Without the `commands:ack` scope (only granted to the key Hou.la Connect
 * declares its paid commands with) it cannot acknowledge paid commands either.
 *
 * Requires a Socket.IO v4 client on the same world (`io`). Upstream that is
 * ./shared/vendor/socket.io.min.js, loaded by the manifest entry or, without
 * the extension, by houla.html itself — exactly like the Velora source does.
 */
(function () {
    'use strict';

    /*
     * Single-initialization guard. The extension runs us in an isolated world
     * and houla.html may load a page-world copy as a fallback: the two do not
     * share `window`, but they do share the DOM. Whichever copy starts first
     * claims <html data-houla-source> and announces it ("houla-source-ready"),
     * which is also the handshake houla.html waits for; any later copy bails.
     */
    var INIT_ATTR = 'data-houla-source';
    var INIT_EVENT = 'houla-source-ready';
    if (window.__SSN_HOULA_SOURCE_INITIALIZED__) return;
    try {
        if (document.documentElement.hasAttribute(INIT_ATTR)) return;
    } catch (e) {
        /* no DOM yet — nothing to guard against */
    }
    window.__SSN_HOULA_SOURCE_INITIALIZED__ = true;

    // ───────────────────────────── constants ─────────────────────────────────

    var HOULA_API = 'https://api.hou.la';
    var HOULA_NAMESPACE = '/events';
    var HOULA_SOCKET_PATH = '/ws';
    var SSN_WSS = 'wss://io.socialstream.ninja';
    var SSN_DOCK = 'https://socialstream.ninja/dock.html';
    /** Channel 1 is where the extension and a `&server` dock listen. */
    var SSN_OUT_CHANNEL = 1;
    var SSN_IN_CHANNEL = 3;

    var SOURCE_TYPE = 'houla';
    var SOURCE_IMG = 'https://hou.la/assets/brand/houla-app-icon-128.png';
    var STUDIO_URL = 'https://hou.la/studio/event-keys';
    var STORAGE_KEY = 'houlaSourceConfig';
    /** How many event ids we remember to drop replays after a reconnect. */
    var SEEN_MAX = 500;
    /**
     * Estimated USD value of ONE Hou.la coin, for `donoValue`. The smallest pack
     * is 70 coins for 0.99 EUR (≈ 0.0141 EUR, ≈ 0.016 USD a coin); bigger packs
     * are cheaper per coin. Without an explicit value SSN prices "coins" at
     * 0.01 USD (the TikTok rate), which would under-count our gifts.
     */
    var USD_PER_COIN = 0.015;

    // ───────────────────────────── i18n ──────────────────────────────────────

    var STRINGS = {
        en: {
            waiting: 'Not connected.',
            connecting: 'Connecting to Hou.la…',
            connected: 'Connected — listening to your live.',
            disconnected: 'Disconnected ({0}) — reconnecting…',
            stopped: 'Stopped.',
            needKey: 'Paste your event key (hle_…) first.',
            errKeyFormat: 'An event key starts with hle_. Create one in your Studio, under Live Connector.',
            errStreamKey:
                'That is your STREAM key (sk_…), the one you paste into OBS to broadcast. Never paste it anywhere else, and rotate it now. The event key starts with hle_.',
            needSession: 'Enter your Social Stream session ID first.',
            noSocketIo: 'Socket.IO client missing — reload the page.',
            noCommentScope:
                'This key does not carry the "comment" event. Recreate it in the studio and tick Comments.',
            errInvalidKey: 'Key refused. Check it, or create a new one in the studio.',
            errRateLimited: 'Too many connection attempts. Wait a minute and retry.',
            errTooMany: 'This key already has too many open connections. Close the other tabs or windows using it, then try again.',
            errOther: 'Hou.la error: {0}',
            ssnOpen: 'Social Stream link open.',
            ssnClosed: 'Social Stream link lost — reconnecting…',
            counters: '{0} comments · {1} gifts · {2} follows',
            testMessage: 'Test message from Hou.la 👋',
            testSent: 'Test message sent — it should appear in your dock.',
            followed: 'Started following',
            apiRefused:
                'This link points the page at an unknown server. It was ignored: the page stays on Hou.la and will not connect on its own.',
            apiLocal: 'Local test API: click Connect to start.',
            confirmKey:
                'This link carries another event key ({0}). Check it is yours, then click Connect.',
            forgotten:
                'Key forgotten on this computer. If you put it in a source link (desktop app), remove it from that link too.',
            linkCopied: 'Source link copied. It contains your key: keep it private.',
            copy: 'Copy',
            copied: 'Copied',
        },
        fr: {
            waiting: 'Pas connecté.',
            connecting: 'Connexion à Hou.la…',
            connected: 'Connecté — à l’écoute de ton live.',
            disconnected: 'Déconnecté ({0}) — reconnexion…',
            stopped: 'Arrêté.',
            needKey: 'Colle d’abord ta clé d’événements (hle_…).',
            errKeyFormat:
                'Une clé d’événements commence par hle_. Crée-la dans ton Studio, rubrique Connecteur live.',
            errStreamKey:
                'Ça, c’est ta clé de STREAM (sk_…), celle que tu colles dans OBS pour diffuser. Ne la colle nulle part ailleurs et change-la. La clé d’événements commence par hle_.',
            needSession: 'Renseigne d’abord ton identifiant de session Social Stream.',
            noSocketIo: 'Client Socket.IO absent — recharge la page.',
            noCommentScope:
                'Cette clé ne porte pas l’événement « commentaire ». Recrée-la dans le studio en cochant Commentaires.',
            errInvalidKey: 'Clé refusée. Vérifie-la, ou crée-en une nouvelle dans le studio.',
            errRateLimited: 'Trop de tentatives de connexion. Attends une minute et réessaie.',
            errTooMany: 'Cette clé a déjà trop de connexions ouvertes. Ferme les autres onglets ou fenêtres qui l’utilisent, puis réessaie.',
            errOther: 'Erreur Hou.la : {0}',
            ssnOpen: 'Liaison Social Stream ouverte.',
            ssnClosed: 'Liaison Social Stream perdue — reconnexion…',
            counters: '{0} commentaires · {1} cadeaux · {2} abonnés',
            testMessage: 'Message de test depuis Hou.la 👋',
            testSent: 'Message de test envoyé — il doit apparaître dans ton dock.',
            followed: 'S’est abonné',
            apiRefused:
                'Ce lien envoie la page vers un serveur inconnu. Il a été ignoré : la page reste sur Hou.la et ne se connectera pas toute seule.',
            apiLocal: 'API de test locale : clique sur Connecter pour démarrer.',
            confirmKey:
                'Ce lien contient une autre clé d’événements ({0}). Vérifie que c’est bien la tienne, puis clique sur Connecter.',
            forgotten:
                'Clé oubliée sur cet ordinateur. Si tu l’as mise dans un lien de source (app de bureau), retire-la aussi de ce lien.',
            linkCopied: 'Lien de source copié. Il contient ta clé : garde-le pour toi.',
            copy: 'Copier',
            copied: 'Copié',
        },
    };

    var LANG =
        String((typeof navigator !== 'undefined' && navigator.language) || 'en')
            .toLowerCase()
            .indexOf('fr') === 0
            ? 'fr'
            : 'en';

    function t(key) {
        var out = (STRINGS[LANG] && STRINGS[LANG][key]) || STRINGS.en[key] || key;
        for (var i = 1; i < arguments.length; i++) {
            out = out.replace('{' + (i - 1) + '}', String(arguments[i]));
        }
        return out;
    }

    // ───────────────────────────── transport ─────────────────────────────────

    /**
     * Where do we hand the finished message to?
     *
     * `extension` also covers the standalone app's injection shim, which mocks
     * chrome.runtime and redirects sendMessage to ninjafy — so it must be tested
     * first.
     */
    function detectTransport() {
        try {
            if (
                typeof chrome !== 'undefined' &&
                chrome.runtime &&
                chrome.runtime.id &&
                typeof chrome.runtime.sendMessage === 'function'
            ) {
                return 'extension';
            }
        } catch (e) {
            /* accessing chrome.runtime can throw in a plain page — ignore */
        }
        if (
            typeof window !== 'undefined' &&
            window.ninjafy &&
            typeof window.ninjafy.sendMessage === 'function'
        ) {
            return 'ninjafy';
        }
        return 'wss';
    }

    var transport = detectTransport();

    try {
        document.documentElement.setAttribute(INIT_ATTR, transport);
        document.dispatchEvent(new CustomEvent(INIT_EVENT, { detail: transport }));
    } catch (e) {
        /* the attribute alone is enough for the handshake */
    }

    /**
     * `?api=` override, for testing against a development API.
     *
     * SECURITY. The stored key is sent to API_BASE, with no click when
     * auto-connect is on. An arbitrary `?api=` would therefore hand the key to
     * whoever crafted the link, and on socialstream.ninja no CSP stops it. So:
     *   - only Hou.la's own APIs (HTTPS) and a local API (localhost / 127.0.0.1)
     *     are accepted;
     *   - anything else is REFUSED: the page stays on production, never
     *     connects on its own, and says so;
     *   - a local API never auto-connects either: the creator clicks Connect.
     */
    var API_ALLOWED = ['api.hou.la', 'devapi.hou.la'];

    function resolveApiBase() {
        var out = { base: HOULA_API, refused: false, local: false };
        var raw = null;
        try {
            raw = new URLSearchParams(location.search).get('api');
        } catch (e) {
            return out;
        }
        if (!raw) return out;
        var m = /^(https?):\/\/([^\/?#:@]+)(:\d{1,5})?\/*$/i.exec(String(raw).trim());
        if (m) {
            var scheme = m[1].toLowerCase();
            var host = m[2].toLowerCase();
            if (scheme === 'https' && !m[3] && API_ALLOWED.indexOf(host) !== -1) {
                out.base = 'https://' + host;
                return out;
            }
            if (host === 'localhost' || host === '127.0.0.1') {
                out.base = scheme + '://' + host + (m[3] || '');
                out.local = true;
                return out;
            }
        }
        out.refused = true;
        return out;
    }

    var API = resolveApiBase();
    var API_BASE = API.base;

    /**
     * Only decorate with our logo when SSN has no icon of its own for this type.
     * Once `sources/images/houla.png` ships with the extension, the default type
     * icon is the right one and sourceImg would just duplicate it.
     */
    var useSourceImg = transport !== 'extension';

    /**
     * Hand one message to SSN. Returns true once it has actually left.
     *
     * On the standalone WebSocket a message that arrives while the link is
     * (re)connecting is QUEUED rather than dropped, unless `noQueue` is set
     * (viewer counts: a stale count is worse than none). `dedupKey` is the
     * business id isDuplicate() recorded: it stays "seen" while the message
     * waits, and is forgotten again if the message is ever dropped, so a replay
     * after a reconnect can still deliver it.
     */
    function sendToSsn(data, dedupKey, noQueue) {
        try {
            if (transport === 'extension') {
                chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {});
                return true;
            }
            if (transport === 'ninjafy') {
                // Signature mirrors chrome.runtime.sendMessage — first arg unused.
                window.ninjafy.sendMessage(null, { message: data });
                return true;
            }
            if (ssnJoined && ssnSocket && ssnSocket.readyState === 1) {
                ssnSocket.send(JSON.stringify(data));
                return true;
            }
        } catch (e) {
            log('send failed: ' + (e && e.message));
        }
        if (transport === 'wss' && !noQueue && running) {
            enqueueSsn(data, dedupKey);
        } else {
            forgetSeen(dedupKey);
        }
        return false;
    }

    function enqueueSsn(data, dedupKey) {
        ssnQueue.push({ data: data, key: dedupKey || null });
        while (ssnQueue.length > SSN_QUEUE_MAX) {
            var dropped = ssnQueue.shift();
            forgetSeen(dropped.key);
            log('outgoing queue full — dropped the oldest message');
        }
    }

    /** Called once the join went out: deliver what waited, oldest first. */
    function flushSsnQueue() {
        while (ssnQueue.length && ssnJoined && ssnSocket && ssnSocket.readyState === 1) {
            try {
                ssnSocket.send(JSON.stringify(ssnQueue[0].data));
            } catch (e) {
                log('send failed: ' + (e && e.message));
                return; // keep it: the next join retries
            }
            ssnQueue.shift();
        }
    }

    /** Stop or session change: what waited was meant for the old session. */
    function clearSsnQueue() {
        for (var i = 0; i < ssnQueue.length; i++) forgetSeen(ssnQueue[i].key);
        ssnQueue = [];
    }

    // ───────────────────────────── state ─────────────────────────────────────

    var houlaSocket = null;
    var ssnSocket = null;
    var ssnRetry = 0;
    /** Pending reconnect of the SSN link, cleared whenever the link is replaced. */
    var ssnReconnectTimer = null;
    /**
     * Bumped every time the SSN link is opened or closed on purpose. Callbacks
     * of a socket from an older generation are ignored, so a replaced socket can
     * never reopen the link towards the session it was serving.
     */
    var ssnGeneration = 0;
    /** Session the current SSN link joined (or is joining). */
    var ssnSession = '';
    /** True once the join for the current socket has been sent. */
    var ssnJoined = false;
    /** Messages waiting for the SSN link; see sendToSsn(). */
    var ssnQueue = [];
    /** Explicit cap on that queue: beyond it, the oldest message is dropped. */
    var SSN_QUEUE_MAX = 200;
    var running = false;
    /**
     * Last rejection reason sent by the gateway. The server emits `error` and
     * THEN disconnects, so without this the generic "disconnected" message would
     * land last and hide the only actionable text the creator gets.
     */
    var rejection = null;
    var seen = Object.create(null);
    var seenOrder = [];
    var counters = { comment: 0, gift: 0, follow: 0 };

    function log(message) {
        try {
            // Belt and braces: whatever reaches the console, an event key never does.
            var safe = String(message).replace(/hle_[A-Za-z0-9_\-]+/g, 'hle_***');
            console.log('[houla] ' + safe);
        } catch (e) {
            /* noop */
        }
    }

    /**
     * Business-level dedup. A reconnect can replay an event, and an overlay that
     * shows the same comment twice looks broken. Keyed on our own ids (comment
     * id / gift transaction id), NOT on the `id` we hand to SSN — theirs is
     * expected to be a number, so we keep generating one their way.
     */
    function isDuplicate(key) {
        if (!key) return false;
        if (seen[key]) return true;
        seen[key] = true;
        seenOrder.push(key);
        if (seenOrder.length > SEEN_MAX) delete seen[seenOrder.shift()];
        return false;
    }

    /** Undo isDuplicate() for a message that was never delivered. */
    function forgetSeen(key) {
        if (!key || !seen[key]) return;
        delete seen[key];
        var index = seenOrder.indexOf(key);
        if (index !== -1) seenOrder.splice(index, 1);
    }

    /** The business id fromComment()/fromGift() dedup on, if any. */
    function dedupKeyOf(type, payload) {
        if (type === 'comment') return (payload.comment && payload.comment.id) || null;
        if (type === 'gift') return payload.transactionId || null;
        return null;
    }

    // ───────────────────────────── mapping ───────────────────────────────────

    /**
     * Normal text fields are PLAIN TEXT for SSN, yet several overlays render
     * them as HTML, and a Hou.la display name may contain `<`. Escape at
     * capture, like velora.js does for chatname. `chatmessage` stays raw:
     * `textonly: true` already tells SSN to render it as text.
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /** Images: http(s) only, never `javascript:` or `data:` from a payload. */
    function safeUrl(url) {
        url = String(url || '').trim();
        return /^https?:\/\//i.test(url) ? url : '';
    }

    /** Whole, positive, finite counts only (coins, quantities). */
    function coinCount(value) {
        var n = Number(value);
        if (!isFinite(n) || n <= 0) return 0;
        n = Math.floor(n);
        return n > 1e9 ? 0 : n;
    }

    function baseMessage() {
        var data = {
            chatname: '',
            chatmessage: '',
            chatimg: '',
            chatbadges: '',
            backgroundColor: '',
            textColor: '',
            contentimg: '',
            hasDonation: '',
            membership: '',
            /*
             * Hou.la comments are RAW user text, never markup. Leaving this true
             * makes SSN render them as plain text — flip it to false and any
             * viewer could inject markup straight into the broadcaster's
             * overlay. It is a security setting here, not a styling one.
             */
            textonly: true,
            type: SOURCE_TYPE,
            id: Date.now() + Math.floor(Math.random() * 1000000),
        };
        if (useSourceImg) data.sourceImg = SOURCE_IMG;
        return data;
    }

    /** `N coins` label + numeric USD estimate, the SSN donation pair. */
    function setCoins(data, coins) {
        coins = coinCount(coins);
        if (coins <= 0) return;
        data.hasDonation = coins + ' coins';
        data.donoValue = Math.round(coins * USD_PER_COIN * 100) / 100;
    }

    /** SSN's `mod` flag, set only when true — like Kick/Joystick do. */
    function setRoles(data, who) {
        if (who && who.isModerator === true) data.mod = true;
    }

    function fromComment(payload) {
        var comment = payload.comment || {};
        var author = payload.author || {};
        if (isDuplicate(comment.id)) return null;
        var data = baseMessage();
        data.chatname = escapeHtml(author.name || 'anonymous');
        data.chatmessage = typeof comment.content === 'string' ? comment.content : '';
        data.chatimg = safeUrl(author.avatarUrl);
        data.userid = escapeHtml(author.workspaceId || '');
        setRoles(data, author);
        // Messages written by a Hou.la bot (an interactive pack replying in
        // chat). Flagged, not dropped: SSN's own bot filters then apply.
        if (comment.isBot === true) data.bot = true;
        // A PAID comment ("priority" message or paid !command) carries coins:
        // it is a chat row with a donation value, so `event` stays empty.
        setCoins(data, comment.coins);
        if (!data.chatmessage) return null;
        return data;
    }

    function fromGift(payload) {
        var gift = payload.gift || {};
        var sender = payload.sender || {};
        if (isDuplicate(payload.transactionId)) return null;
        var data = baseMessage();
        data.chatname = escapeHtml(sender.name || 'anonymous');
        data.chatimg = safeUrl(sender.avatarUrl);
        data.userid = escapeHtml(sender.workspaceId || '');
        setRoles(data, sender);
        var quantity = coinCount(gift.quantity) || 1;
        data.chatmessage = quantity > 1 ? String(gift.name || '') + ' ×' + quantity : String(gift.name || '');
        // A virtual gift is a distinct paid item type: SSN names it `gift`
        // (Kick, TikFinity, MeetMe do the same) and hasDonation carries the value.
        data.event = 'gift';
        setCoins(data, gift.totalCoins);
        data.contentimg = safeUrl(gift.thumbnailUrl);
        data.meta = {
            giftId: gift.id || null,
            giftSlug: gift.slug || null,
            giftName: gift.name || null,
            quantity: quantity,
            coins: coinCount(gift.totalCoins),
            transactionId: payload.transactionId || null,
        };
        return data;
    }

    function fromFollow(payload) {
        var follower = payload.follower || {};
        var data = baseMessage();
        data.chatname = escapeHtml(follower.name || 'anonymous');
        data.chatimg = safeUrl(follower.avatarUrl);
        data.userid = escapeHtml(follower.workspaceId || '');
        data.chatmessage = t('followed');
        // SSN's canonical follow event (multi-alerts, Event Flow, dock filters).
        data.event = 'new_follower';
        return data;
    }

    /**
     * Viewer count. The gateway stamps the current count on every envelope
     * (`envelope.viewers`, best-effort); we forward it as SSN's `viewer_update`
     * only when it changes, and only when viewer counts are turned on:
     *   - extension / desktop app: SSN's own `showviewercount` / `hypemode`
     *     settings, requested at start and pushed on change (see the bridge);
     *   - standalone page: the "Viewer count" box, or `?viewers=1`.
     * `lastViewers` is the last count SSN actually RECEIVED, so a count that
     * could not be sent (setting off, link down) is retried on the next one.
     */
    var lastViewers = null;
    var latestViewers = null;
    var ssnSettings = {};

    function viewerCountEnabled() {
        if (transport === 'wss') return !!options.viewers;
        return !!(ssnSettings.showviewercount || ssnSettings.hypemode);
    }

    function maybeViewerUpdate(viewers) {
        if (typeof viewers !== 'number' || !isFinite(viewers) || viewers < 0) return;
        viewers = Math.floor(viewers);
        latestViewers = viewers;
        if (viewers === lastViewers) return;
        if (!viewerCountEnabled()) return;
        // Desktop counts need a source ID so startup and later updates share one entry.
        if (transport === 'ninjafy' && typeof window.__SSAPP_TAB_ID__ === 'undefined') return;
        if (sendToSsn({ type: SOURCE_TYPE, event: 'viewer_update', meta: viewers }, null, true)) {
            lastViewers = viewers;
        }
    }

    /** Settings from SSN (extension or desktop app), at start or on change. */
    function applySsnSettings(response) {
        if (!response || typeof response !== 'object' || !('settings' in response)) return;
        var wasEnabled = viewerCountEnabled();
        ssnSettings = response.settings || {};
        if (!viewerCountEnabled()) {
            lastViewers = null;
        } else if (!wasEnabled && latestViewers !== null) {
            maybeViewerUpdate(latestViewers);
        }
    }

    // ───────────────────────────── Hou.la socket ─────────────────────────────

    function houlaError(reason) {
        if (reason === 'INVALID_KEY') return t('errInvalidKey');
        if (reason === 'RATE_LIMITED') return t('errRateLimited');
        if (reason === 'TOO_MANY_CONNECTIONS') return t('errTooMany');
        return t('errOther', reason);
    }

    function openHoulaSocket(config) {
        if (typeof io === 'undefined') {
            setStatus('error', t('noSocketIo'));
            return;
        }
        var base = String(config.url || HOULA_API).replace(/\/+$/, '');
        houlaSocket = io(base + HOULA_NAMESPACE, {
            path: HOULA_SOCKET_PATH,
            transports: ['websocket'],
            auth: { token: config.key },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
        });

        houlaSocket.on('ready', function (info) {
            rejection = null;
            var events = (info && info.events) || [];
            if (events.indexOf('comment') === -1) {
                setStatus('warn', t('noCommentScope'));
            } else {
                setStatus('ok', t('connected'));
            }
            log('ready — events: ' + events.join(', '));
        });

        // The gateway sends a short string reason and closes on a rejected key.
        // Retrying is worse than useless here: every reconnect burns the per-key
        // connect budget (10/min), so a wrong key silently degrades into a
        // rate-limit lockout. Stop, and say why.
        houlaSocket.on('error', function (reason) {
            rejection = String(reason);
            log('rejected by the gateway: ' + rejection);
            halt(houlaError(rejection));
        });

        houlaSocket.on('connect_error', function (err) {
            log('connect_error: ' + ((err && err.message) || err));
            setStatus('error', t('errOther', (err && err.message) || 'connect_error'));
        });

        houlaSocket.on('disconnect', function (reason) {
            log('disconnected: ' + reason);
            // Never overwrite a rejection reason with the generic message.
            if (rejection) return;
            if (running) setStatus('warn', t('disconnected', String(reason)));
        });

        houlaSocket.on('event', function (envelope) {
            if (!envelope || typeof envelope.type !== 'string') return;
            handleEvent(envelope.type, envelope.data || {});
            maybeViewerUpdate(envelope.viewers);
        });
    }

    function handleEvent(type, payload) {
        var data = null;
        if (type === 'comment' && options.comments) data = fromComment(payload);
        else if (type === 'gift' && options.gifts) data = fromGift(payload);
        else if (type === 'follow' && options.follows) data = fromFollow(payload);
        if (!data) return;
        counters[type] = (counters[type] || 0) + 1;
        sendToSsn(data, dedupKeyOf(type, payload));
        pushPreview(data);
        renderCounters();
    }

    // ───────────────────────────── SSN socket (fallback) ─────────────────────
    // Only used when nothing hosts us: a plain tab or an OBS browser source. The
    // extension and the standalone app have their own, better path.

    function openSsnSocket(session) {
        if (!session) return;
        // Opening a new link always retires the previous one first, together
        // with its pending reconnect — and, for another session, its queue.
        closeSsnSocket(session !== ssnSession);
        ssnSession = session;
        var generation = ssnGeneration;
        var socket;
        try {
            socket = new WebSocket(SSN_WSS);
        } catch (e) {
            log('ssn socket failed: ' + (e && e.message));
            scheduleSsnReconnect(session, generation);
            return;
        }
        ssnSocket = socket;
        var current = function () {
            return generation === ssnGeneration && socket === ssnSocket;
        };
        socket.onopen = function () {
            if (!current()) return;
            ssnRetry = 0;
            socket.send(JSON.stringify({ join: session, out: SSN_OUT_CHANNEL, in: SSN_IN_CHANNEL }));
            ssnJoined = true;
            log(t('ssnOpen'));
            flushSsnQueue();
        };
        socket.onclose = function () {
            if (!current()) return;
            ssnSocket = null;
            ssnJoined = false;
            scheduleSsnReconnect(session, generation);
        };
    }

    function scheduleSsnReconnect(session, generation) {
        if (!running || generation !== ssnGeneration) return;
        clearTimeout(ssnReconnectTimer);
        ssnRetry = Math.min(ssnRetry + 1, 10);
        ssnReconnectTimer = setTimeout(function () {
            ssnReconnectTimer = null;
            if (running && generation === ssnGeneration) openSsnSocket(session);
        }, 200 * ssnRetry);
    }

    /**
     * Retire the SSN link: cancel its pending reconnect, invalidate its
     * callbacks and close it. `dropQueue` discards what waited for it (stop,
     * or a different session); a plain reconnect keeps the queue.
     */
    function closeSsnSocket(dropQueue) {
        ssnGeneration++;
        clearTimeout(ssnReconnectTimer);
        ssnReconnectTimer = null;
        ssnJoined = false;
        var socket = ssnSocket;
        ssnSocket = null;
        if (socket) {
            socket.onopen = socket.onclose = socket.onmessage = socket.onerror = null;
            try {
                socket.close();
            } catch (e) {
                /* already closed */
            }
        }
        if (dropQueue) clearSsnQueue();
    }

    // ───────────────────────────── config ────────────────────────────────────

    var options = { comments: true, gifts: true, follows: true, auto: true, viewers: false };

    /** `?viewers=1` (or `?viewers`) turns the standalone viewer count on. */
    function viewersFromUrl() {
        try {
            var raw = new URLSearchParams(location.search).get('viewers');
            if (raw === null) return null;
            return raw !== '0' && raw.toLowerCase() !== 'false';
        } catch (e) {
            return null;
        }
    }

    /*
     * PERSISTENCE — the creator pastes the key ONCE.
     *
     * Three places, read in this order (first one carrying a key wins):
     *   1. the URL fragment `#key=hle_…` (optionally `&autoconnect=0`). A
     *      fragment is never sent to any server, and the SSN desktop app keeps the
     *      source URL it was given — the only store that survives an app profile
     *      that forgets page storage. Stripped from the address bar once read.
     *   2. chrome.storage.local — the extension's own storage, when we run as its
     *      content script. Survives clearing the site's data.
     *   3. window.localStorage of the page.
     * A successful Connect writes 2 and 3. "Forget my key" clears both.
     *
     * The key is a secret: it is NEVER passed to log() nor shown in a status.
     */

    function hasExtensionStorage() {
        try {
            return (
                transport === 'extension' &&
                !!(chrome.storage && chrome.storage.local && chrome.storage.local.get)
            );
        } catch (e) {
            return false;
        }
    }

    function readLocal() {
        try {
            return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') || {};
        } catch (e) {
            return {};
        }
    }

    /** `#key=…&autoconnect=0` → partial config, then remove it from the address bar. */
    function readFragment() {
        var out = {};
        try {
            var hash = String(location.hash || '').replace(/^#/, '');
            if (!hash) return out;
            var params = new URLSearchParams(hash);
            var key = params.get('key');
            if (!key) return out;
            out.key = key.trim();
            var auto = params.get('autoconnect');
            if (auto !== null) out.options = { auto: auto !== '0' && auto !== 'false' };
            if (window.history && history.replaceState) {
                params.delete('key');
                params.delete('autoconnect');
                var rest = params.toString();
                history.replaceState(
                    null,
                    '',
                    location.pathname + location.search + (rest ? '#' + rest : '')
                );
            }
        } catch (e) {
            /* malformed fragment — ignore it */
        }
        return out;
    }

    /** Calls back with the merged config (sync without the extension, async with it). */
    function loadConfig(done) {
        var fragment = readFragment();
        var local = readLocal();
        var finish = function (stored) {
            var saved = stored && stored.key ? stored : local;
            if (!saved.options && local.options) saved.options = local.options;
            var config = saved;
            if (fragment.key && fragment.key !== saved.key) {
                // A link can carry SOMEONE ELSE's key: connecting it would push
                // another live into this creator's dock, with their session. So a
                // fragment key that is not the stored one is only PROPOSED: field
                // filled, no auto-connect, no stored session, nothing saved until
                // the creator clicks Connect.
                config = {
                    key: fragment.key,
                    options: saved.options || {},
                    pendingConfirmation: true,
                };
            } else if (fragment.options) {
                config.options = fragment.options;
            }
            if (!config.pendingConfirmation && !config.session && local.session) {
                config.session = local.session;
            }
            done(config || {});
        };
        if (!hasExtensionStorage()) return finish(null);
        try {
            chrome.storage.local.get(STORAGE_KEY, function (items) {
                finish((items && items[STORAGE_KEY]) || null);
            });
        } catch (e) {
            finish(null);
        }
    }

    function saveConfig(config) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (e) {
            /* private mode — the page store is simply skipped */
        }
        if (hasExtensionStorage()) {
            try {
                var item = {};
                item[STORAGE_KEY] = config;
                chrome.storage.local.set(item);
            } catch (e) {
                log('extension storage unavailable');
            }
        }
    }

    function clearConfig() {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            /* nothing stored */
        }
        if (hasExtensionStorage()) {
            try {
                chrome.storage.local.remove(STORAGE_KEY);
            } catch (e) {
                /* nothing stored */
            }
        }
    }

    /** This page's address with the key in the fragment, for the SSN desktop app. */
    function sourceLink(key) {
        var search = '';
        try {
            var params = new URLSearchParams(location.search);
            // Never copy a refused (foreign) `?api=` into a link that carries the key.
            if (API.refused) params.delete('api');
            search = params.toString();
        } catch (e) {
            search = '';
        }
        return (
            location.origin +
            location.pathname +
            (search ? '?' + search : '') +
            '#key=' +
            encodeURIComponent(key)
        );
    }

    /** `hle_abcd…`: enough to recognise a key, never enough to use it. */
    function maskKey(key) {
        return String(key || '').slice(0, 8) + '…';
    }

    // ───────────────────────────── UI ────────────────────────────────────────
    // The DOM is shared between worlds, so this drives houla.html identically
    // whether we run as a content script or as a page script.

    /**
     * Hand the creator a finished dock address rather than two parameters to
     * remember. Forgetting `&server` makes the dock ignore us entirely and
     * forgetting `&branded` hides the Hou.la icon — two silent failures that
     * look identical to "it does not work".
     */
    function updateDockUrl() {
        var field = $('dockUrl');
        if (!field) return;
        var session = ($('session') && $('session').value.trim()) || '';
        field.value = session ? SSN_DOCK + '?session=' + encodeURIComponent(session) + '&server&branded' : '';
    }

    function copyToClipboard(text, button, fallbackField) {
        if (!text) return;
        var done = function () {
            if (!button) return;
            var label = button.textContent;
            button.textContent = t('copied');
            setTimeout(function () {
                button.textContent = label;
            }, 1600);
        };
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, function () {});
                return;
            }
        } catch (e) {
            /* fall through to the legacy path */
        }
        var field = fallbackField;
        if (field) {
            field.removeAttribute('readonly');
            field.select();
            try { document.execCommand('copy'); done(); } catch (e) { /* nothing else to try */ }
            field.setAttribute('readonly', 'readonly');
        }
    }
    function $(id) {
        return document.getElementById(id);
    }

    function setStatus(kind, message) {
        var el = $('status');
        if (!el) return;
        el.textContent = message;
        el.className = 'status ' + kind;
    }

    function renderCounters() {
        var el = $('counters');
        if (!el) return;
        el.textContent = t('counters', counters.comment, counters.gift, counters.follow);
    }

    function pushPreview(data) {
        var feed = $('feed');
        if (!feed) return;
        var row = document.createElement('div');
        row.className = 'row';
        var who = document.createElement('b');
        who.textContent = data.chatname;
        var what = document.createElement('span');
        what.textContent =
            ' ' + (data.chatmessage || (data.event ? '(' + data.event + ')' : '')) +
            (data.hasDonation ? ' — ' + data.hasDonation : '');
        row.appendChild(who);
        row.appendChild(what);
        feed.insertBefore(row, feed.firstChild);
        while (feed.childNodes.length > 12) feed.removeChild(feed.lastChild);
    }

    function readOptions() {
        options.comments = !$('optComments') || $('optComments').checked;
        options.gifts = !!($('optGifts') && $('optGifts').checked);
        options.follows = !!($('optFollows') && $('optFollows').checked);
        options.auto = !$('optAuto') || $('optAuto').checked;
        options.viewers = !!($('optViewers') && $('optViewers').checked);
    }

    function forget() {
        stop();
        clearConfig();
        if ($('key')) $('key').value = '';
        setStatus('', t('forgotten'));
    }

    function copySourceLink() {
        var key = ($('key') && $('key').value.trim()) || '';
        if (key.indexOf('hle_') !== 0) return setStatus('error', t('needKey'));
        copyToClipboard(sourceLink(key), $('copySourceLink'));
        setStatus('ok', t('linkCopied'));
    }

    function start() {
        var key = ($('key') && $('key').value.trim()) || '';
        var session = ($('session') && $('session').value.trim()) || '';
        if (!key) return setStatus('error', t('needKey'));
        // Refuse anything that is not an event key. Pasting the workspace STREAM
        // key (sk_…) here is an easy mistake and a costly one: that credential
        // lets anyone broadcast on the channel, so it must never leave OBS.
        if (key.indexOf('hle_') !== 0) {
            return setStatus(
                'error',
                key.indexOf('sk_') === 0 ? t('errStreamKey') : t('errKeyFormat')
            );
        }
        if (transport === 'wss' && !session) return setStatus('error', t('needSession'));

        readOptions();
        saveConfig({ key: key, session: session, options: options });

        running = true;
        lastViewers = null;
        setStatus('warn', t('connecting'));
        if (transport === 'wss') openSsnSocket(session);
        openHoulaSocket({ key: key, url: API_BASE });
        toggleButtons(true);
    }

    /**
     * Push one synthetic comment through the REAL mapping and the REAL transport.
     * Validates the Social Stream half on its own — no key, no live, no API — so a
     * failure can only come from the SSN side.
     */
    function sendTest(retried) {
        if (transport === 'wss' && (!ssnSocket || ssnSocket.readyState !== 1)) {
            if (retried) return setStatus('error', t('ssnClosed'));
            var session = ($('session') && $('session').value.trim()) || '';
            if (!session) return setStatus('error', t('needSession'));
            running = true;
            if (!ssnSocket || session !== ssnSession) openSsnSocket(session);
            return setTimeout(function () {
                sendTest(true);
            }, 800);
        }
        var data = fromComment({
            live: { roomId: 'test', workspaceId: 'test' },
            comment: { id: 'test-' + Date.now(), content: t('testMessage') },
            author: { workspaceId: 'test', name: 'Hou.la', avatarUrl: SOURCE_IMG },
        });
        if (!data) return;
        sendToSsn(data, null, true);
        pushPreview(data);
        setStatus('ok', t('testSent'));
    }

    function stop() {
        rejection = null;
        teardown();
        setStatus('', t('stopped'));
    }

    /** Stop everything and leave an explicit, final error on screen. */
    function halt(message) {
        teardown();
        setStatus('error', message);
    }

    function teardown() {
        running = false;
        if (houlaSocket) {
            houlaSocket.close();
            houlaSocket = null;
        }
        closeSsnSocket(true);
        ssnSession = '';
        lastViewers = null;
        toggleButtons(false);
    }

    function toggleButtons(active) {
        if ($('connect')) $('connect').disabled = active;
        if ($('disconnect')) $('disconnect').disabled = !active;
    }

    /** Fill the form from the stored config, then reconnect on our own if allowed. */
    function applyConfig(config) {
        if ($('key') && config.key) $('key').value = config.key;
        if ($('session') && config.session) $('session').value = config.session;
        if (config.options) {
            if ($('optComments')) $('optComments').checked = config.options.comments !== false;
            if ($('optGifts')) $('optGifts').checked = config.options.gifts !== false;
            if ($('optFollows')) $('optFollows').checked = config.options.follows !== false;
            if ($('optAuto')) $('optAuto').checked = config.options.auto !== false;
            if ($('optViewers')) $('optViewers').checked = config.options.viewers === true;
        }
        var urlViewers = viewersFromUrl();
        if (urlViewers !== null && $('optViewers')) $('optViewers').checked = urlViewers;
        readOptions();
        updateDockUrl();
        if (API.refused) return setStatus('error', t('apiRefused'));
        if (config.pendingConfirmation) return setStatus('warn', t('confirmKey', maskKey(config.key)));
        if (API.local) return setStatus('', t('apiLocal'));
        var auto = !config.options || config.options.auto !== false;
        if (config.key && auto && !running) {
            log('stored key found — connecting automatically');
            start();
        }
    }

    function boot() {
        // The session ID — and therefore the dock address built from it — are
        // only meaningful when we talk to SSN's server directly. Through the
        // app or the extension, they route the messages themselves.
        if (transport !== 'wss') {
            if ($('sessionRow')) $('sessionRow').style.display = 'none';
            if ($('dockRow')) $('dockRow').style.display = 'none';
            if ($('viewersRow')) $('viewersRow').style.display = 'none';
        }
        if ($('optViewers'))
            $('optViewers').addEventListener('change', function () {
                readOptions();
                if (!options.viewers) lastViewers = null;
                else if (latestViewers !== null) maybeViewerUpdate(latestViewers);
            });
        if ($('session')) $('session').addEventListener('input', updateDockUrl);
        if ($('copyDock')) {
            $('copyDock').textContent = t('copy');
            $('copyDock').addEventListener('click', function () {
                copyToClipboard($('dockUrl') && $('dockUrl').value, $('copyDock'), $('dockUrl'));
            });
        }
        updateDockUrl();
        if ($('transport')) $('transport').textContent = transport;
        if ($('apiBase')) $('apiBase').textContent = API_BASE;
        if ($('studioLink')) $('studioLink').href = STUDIO_URL;
        if ($('connect')) $('connect').addEventListener('click', start);
        if ($('disconnect')) $('disconnect').addEventListener('click', stop);
        if ($('test'))
            $('test').addEventListener('click', function () {
                sendTest(false);
            });
        if ($('forget')) $('forget').addEventListener('click', forget);
        if ($('copySourceLink')) $('copySourceLink').addEventListener('click', copySourceLink);
        toggleButtons(false);
        renderCounters();
        setStatus('', t('waiting'));
        log('source ready — transport: ' + transport);
        loadConfig(applyConfig);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // ───────────────────── settings bridge (extension / desktop app) ────────
    // Same contract as the other source scripts: identify ourselves for
    // send-back routing, ask for the settings once and accept settings pushes.
    // The desktop app's own bridge (window.ninjafy) is used like velora.js does.

    function wireSettingsBridge() {
        var appBridge = transport === 'ninjafy' ? window.ninjafy : null;
        var useAppBridge = !!(
            appBridge &&
            typeof appBridge.sendMessage === 'function' &&
            typeof appBridge.exposeDoSomethingInWebApp === 'function'
        );
        if (transport !== 'extension' && !useAppBridge) return;

        var onMessage = function (request, sender, sendResponse) {
            var respond = typeof sendResponse === 'function' ? sendResponse : function () {};
            try {
                if (request === 'getSource') {
                    respond(SOURCE_TYPE);
                    return;
                }
                if (request === 'focusChat') {
                    // Read-only source: there is no chat input to focus.
                    respond(false);
                    return;
                }
                if (typeof request === 'object' && request && 'settings' in request) {
                    applySsnSettings(request);
                    respond(true);
                    return;
                }
            } catch (e) {
                log('bridge error: ' + (e && e.message));
            }
            respond(false);
        };
        try {
            if (useAppBridge) appBridge.exposeDoSomethingInWebApp(onMessage);
            else chrome.runtime.onMessage.addListener(onMessage);
        } catch (e) {
            log('listener unavailable: ' + (e && e.message));
        }

        // Initial settings (viewer-count toggle), same call as every source.
        var onSettings = function (response) {
            try {
                if (!useAppBridge && chrome.runtime.lastError) return;
            } catch (e) {
                /* no lastError to read */
            }
            applySsnSettings(response);
        };
        try {
            if (useAppBridge) {
                appBridge.sendMessage(null, { getSettings: true }, onSettings, window.__SSAPP_TAB_ID__);
            } else {
                chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, onSettings);
            }
        } catch (e) {
            log('getSettings failed: ' + (e && e.message));
        }
    }

    wireSettingsBridge();
})();
