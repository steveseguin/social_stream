/*
 * Hou.la source for Social Stream Ninja.
 *
 * Hou.la exposes a read-only event channel (Socket.IO) that a creator opens with
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
 * In (1) the manifest injects this file, so houla.html deliberately does NOT
 * load it itself — running twice would send every comment twice.
 *
 * The key is read-only and self-scoped: it only ever receives the events of the
 * workspace it belongs to. It cannot post, spend or change anything, which is
 * why pasting it into a source page is safe.
 *
 * Requires a Socket.IO v4 client on the same world (`io`). Upstream that is
 * ./shared/vendor/socket.io.min.js loaded by the manifest entry, exactly like
 * the Velora source does; self-hosted it is the sibling socket.io.min.js.
 */
(function () {
    'use strict';

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
            forgotten: 'Key forgotten on this computer.',
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
            forgotten: 'Clé oubliée sur cet ordinateur.',
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

    /**
     * Dev override: `?api=http://127.0.0.1:53001` points the page at a local
     * Hou.la API instead of production. http(s) only — and on the page we host,
     * the CSP confines connect-src to hou.la hosts anyway, so this is a developer
     * switch rather than a way to send someone's key elsewhere.
     */
    function resolveApiBase() {
        try {
            var raw = new URLSearchParams(location.search).get('api');
            if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
        } catch (e) {
            /* no URLSearchParams / opaque location — fall through to prod */
        }
        return HOULA_API;
    }

    var API_BASE = resolveApiBase();

    /**
     * Only decorate with our logo when SSN has no icon of its own for this type.
     * Once `sources/images/houla.png` ships with the extension, the default type
     * icon is the right one and sourceImg would just duplicate it.
     */
    var useSourceImg = transport !== 'extension';

    function sendToSsn(data) {
        try {
            if (transport === 'extension') {
                chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {});
            } else if (transport === 'ninjafy') {
                // Signature mirrors chrome.runtime.sendMessage — first arg unused.
                window.ninjafy.sendMessage(null, { message: data });
            } else if (ssnSocket && ssnSocket.readyState === 1) {
                ssnSocket.send(JSON.stringify(data));
            }
        } catch (e) {
            log('send failed: ' + (e && e.message));
        }
    }

    // ───────────────────────────── state ─────────────────────────────────────

    var houlaSocket = null;
    var ssnSocket = null;
    var ssnRetry = 0;
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

    // ───────────────────────────── mapping ───────────────────────────────────

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
        coins = Number(coins) || 0;
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
        data.chatname = author.name || 'anonymous';
        data.chatmessage = comment.content || '';
        data.chatimg = author.avatarUrl || '';
        data.userid = author.workspaceId || '';
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
        data.chatname = sender.name || 'anonymous';
        data.chatimg = sender.avatarUrl || '';
        data.userid = sender.workspaceId || '';
        setRoles(data, sender);
        data.chatmessage =
            gift.quantity > 1 ? (gift.name || '') + ' ×' + gift.quantity : gift.name || '';
        // A virtual gift is a distinct paid item type: SSN names it `gift`
        // (Kick, TikFinity, MeetMe do the same) and hasDonation carries the value.
        data.event = 'gift';
        setCoins(data, gift.totalCoins);
        data.contentimg = gift.thumbnailUrl || '';
        data.meta = {
            giftId: gift.id || null,
            giftSlug: gift.slug || null,
            giftName: gift.name || null,
            quantity: gift.quantity || 1,
            coins: gift.totalCoins || 0,
            transactionId: payload.transactionId || null,
        };
        return data;
    }

    function fromFollow(payload) {
        var follower = payload.follower || {};
        var data = baseMessage();
        data.chatname = follower.name || 'anonymous';
        data.chatimg = follower.avatarUrl || '';
        data.userid = follower.workspaceId || '';
        data.chatmessage = t('followed');
        // SSN's canonical follow event (multi-alerts, Event Flow, dock filters).
        data.event = 'new_follower';
        return data;
    }

    /**
     * Viewer count. The gateway stamps the current count on every envelope
     * (`envelope.viewers`, best-effort); we forward it as SSN's `viewer_update`
     * only when it changes, and only when the creator turned viewer counts on in
     * SSN (`showviewercount` / `hypemode`), like every other source does.
     */
    var lastViewers = null;
    var ssnSettings = {};

    function maybeViewerUpdate(viewers) {
        if (typeof viewers !== 'number' || !isFinite(viewers) || viewers < 0) return;
        viewers = Math.floor(viewers);
        if (viewers === lastViewers) return;
        lastViewers = viewers;
        if (!(ssnSettings.showviewercount || ssnSettings.hypemode)) return;
        sendToSsn({ type: SOURCE_TYPE, event: 'viewer_update', meta: viewers });
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
        sendToSsn(data);
        pushPreview(data);
        renderCounters();
    }

    // ───────────────────────────── SSN socket (fallback) ─────────────────────
    // Only used when nothing hosts us: a plain tab or an OBS browser source. The
    // extension and the standalone app have their own, better path.

    function openSsnSocket(session) {
        if (!session) return;
        try {
            ssnSocket = new WebSocket(SSN_WSS);
        } catch (e) {
            log('ssn socket failed: ' + (e && e.message));
            return;
        }
        ssnSocket.onopen = function () {
            ssnRetry = 0;
            ssnSocket.send(
                JSON.stringify({ join: session, out: SSN_OUT_CHANNEL, in: SSN_IN_CHANNEL })
            );
            log(t('ssnOpen'));
        };
        ssnSocket.onclose = function () {
            ssnSocket = null;
            if (!running) return;
            ssnRetry = Math.min(ssnRetry + 1, 10);
            setTimeout(function () {
                if (running) openSsnSocket(session);
            }, 200 * ssnRetry);
        };
    }

    // ───────────────────────────── config ────────────────────────────────────

    var options = { comments: true, gifts: true, follows: true, auto: true };

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
            var config = fragment.key ? fragment : stored && stored.key ? stored : local;
            // Options (ticked events, auto-connect) follow the store that had them.
            if (!config.options) config.options = local.options || (stored && stored.options);
            if (fragment.options && config !== fragment) config.options = fragment.options;
            if (!config.session && local.session) config.session = local.session;
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
        return (
            location.origin +
            location.pathname +
            location.search +
            '#key=' +
            encodeURIComponent(key)
        );
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
            if (!ssnSocket) openSsnSocket(session);
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
        sendToSsn(data);
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
        if (ssnSocket) {
            ssnSocket.close();
            ssnSocket = null;
        }
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
        }
        updateDockUrl();
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
        }
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

    // ───────────────────── extension bridge (content script only) ────────────
    // Same contract as the other source scripts: identify ourselves for
    // send-back routing and accept settings pushes.

    if (transport === 'extension') {
        try {
            chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
                try {
                    if (request === 'getSource') {
                        sendResponse(SOURCE_TYPE);
                        return;
                    }
                    if (request === 'focusChat') {
                        // Read-only source: there is no chat input to focus.
                        sendResponse(false);
                        return;
                    }
                    if (typeof request === 'object' && request && 'settings' in request) {
                        ssnSettings = request.settings || {};
                        sendResponse(true);
                        return;
                    }
                } catch (e) {
                    log('bridge error: ' + (e && e.message));
                }
                sendResponse(false);
            });
        } catch (e) {
            log('listener unavailable: ' + (e && e.message));
        }
        // Initial settings (viewer-count toggle), same call as every DOM source.
        try {
            chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
                if (response && response.settings) ssnSettings = response.settings;
            });
        } catch (e) {
            log('getSettings failed: ' + (e && e.message));
        }
    }
})();
