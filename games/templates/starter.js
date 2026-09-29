/* Shared connection and counting helpers for the three learning templates. */
(function () {
    'use strict';
    var params = new URLSearchParams(location.search);
    var totals = new Map();

    function platform(data) { return String(data.type || data.platform || '').toLowerCase(); }

    function giftCount(data) {
        var meta = data.meta || {};
        var count = Number(meta.tiktokGiftCount || meta.count);
        return Number.isFinite(count) && count > 0 ? count : 0;
    }

    // Read an explicit unit, never digits from a viewer's chatmessage.
    function labelCount(data, unit) {
        var match = String(data.hasDonation || '').match(new RegExp('^([0-9]+(?:,[0-9]{3})*)\\s+' + unit + 's?$', 'i'));
        return match ? Number(match[1].replace(/,/g, '')) : 0;
    }

    function coins(data) {
        if (platform(data) !== 'tiktok' || data.event !== 'gift' || !data.hasDonation) return 0;
        var perGift = Number((data.meta || {}).coinsPerGift);
        if (Number.isFinite(perGift) && perGift > 0 && giftCount(data)) return perGift * giftCount(data);
        return labelCount(data, 'coin'); // Diamonds and unknown gifts are not coin counts.
    }

    // This sample deliberately selects these support types. A membership badge,
    // gifted subscription, purchase, like, or ordinary chat is a different rule.
    function isSupport(data) {
        if (!data.hasDonation) return false;
        var type = platform(data), event = data.event || '';
        if (type === 'tiktok') return event === 'gift';
        if (type === 'twitch') return !event || event === 'cheer';
        if (type === 'facebook') return !event;
        if (type === 'youtube' || type === 'youtubeshorts') {
            return ['', 'superchat', 'supersticker', 'jeweldonation', 'donation'].indexOf(event) !== -1;
        }
        return false;
    }

    // Streak values are cumulative. Return only the increase over the maximum
    // already received. Normal message IDs also suppress repeated deliveries.
    // Memory is local to this page, bounded to 2,000 keys, and reset on reload.
    function increment(data, amount, metric) {
        if (!Number.isFinite(amount) || amount <= 0) return 0;
        var type = platform(data), meta = data.meta || {}, identity;
        if (type === 'tiktok' && data.event === 'gift') {
            if (meta.groupId && String(meta.groupId) !== '0' && meta.giftId && meta.tiktokGiftSenderId) {
                identity = ['group', meta.tiktokGiftSenderId, meta.giftId, meta.groupId];
            } else if (meta.tiktokGiftStreakId) {
                identity = ['streak', meta.tiktokGiftStreakId];
            } else if (meta.tiktokGiftMessageId) {
                identity = ['gift-message', meta.tiktokGiftMessageId];
            }
        }
        if (!identity && (data.msgId || data.id)) identity = ['message', data.msgId || data.id];
        if (!identity) return amount; // No reliable identity: do not guess from text or names.
        var key = JSON.stringify([type, data.event || '', metric, identity]);
        var previous = totals.get(key) || 0;
        totals.set(key, Math.max(previous, amount));
        if (totals.size > 2000) totals.delete(totals.keys().next().value);
        return Math.max(0, amount - previous);
    }

    function text(id, value) { document.getElementById(id).textContent = value; }
    function log(value) { text('latest', value); }

    function start(onMessage, reset, samples) {
        var session = params.get('session');
        var demo = params.has('demo') || !session;
        if (params.has('clean')) document.body.classList.add('clean');
        document.getElementById('reset').onclick = function () { totals.clear(); reset(); log('Ready for a new run.'); };
        document.getElementById('demo-controls').hidden = !demo;
        var sequence = 0;
        function receive(payload) {
            if (Array.isArray(payload)) { payload.forEach(receive); return; }
            if (!payload || typeof payload !== 'object') return;
            if (payload.overlayNinja) { receive(payload.overlayNinja); return; }
            if (payload.content) { receive(payload.content); return; }
            if (payload.target && payload.target !== 'null' && payload.target !== 'dock') return;
            if (!demo) text('connection', 'Receiving events');
            text('payload', JSON.stringify(payload, null, 2));
            onMessage(payload);
        }
        Object.keys(samples).forEach(function (id) {
            document.getElementById(id).onclick = function () { receive(samples[id](++sequence)); };
        });
        reset();
        if (demo) { text('connection', 'Demo · sample events only'); return; }
        var relay = SocialStreamLocalServer.getChatRelayConfig(params);
        if (relay.enabled) {
            var socket, retry;
            function connect() {
                text('connection', 'Connecting…');
                try { socket = new WebSocket(relay.url); }
                catch (_) { text('connection', 'Invalid relay URL'); return; }
                socket.onopen = function () {
                    socket.send(JSON.stringify({ join: session.split(',')[0], out: relay.out, in: relay.in }));
                    text('connection', 'Relay connected · waiting for events');
                };
                socket.onmessage = function (event) {
                    var payload;
                    try { payload = JSON.parse(event.data); } catch (_) { return; }
                    receive(payload);
                };
                socket.onerror = function () { socket.close(); };
                socket.onclose = function () {
                    text('connection', 'Disconnected · retrying in 5 seconds');
                    clearTimeout(retry); retry = setTimeout(connect, 5000);
                };
            }
            connect();
            return;
        }
        var bridge = document.createElement('iframe');
        bridge.title = 'Social Stream Ninja event connection';
        bridge.hidden = true;
        bridge.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=' +
            encodeURIComponent(params.get('password') || 'false') + '&solo&view=' + encodeURIComponent(session) +
            '&novideo&noaudio&label=dock&cleanoutput&room=' + encodeURIComponent(session) +
            (params.has('lanonly') ? '&lanonly' : '');
        window.addEventListener('message', function (event) {
            if (event.source !== bridge.contentWindow) return;
            var received = event.data && event.data.dataReceived;
            if (received && received.overlayNinja) receive(received.overlayNinja);
        });
        text('connection', 'Waiting for events through the iframe bridge');
        document.body.appendChild(bridge);
    }

    window.RewardStarter = { platform: platform, giftCount: giftCount, labelCount: labelCount,
        coins: coins, isSupport: isSupport, increment: increment, text: text, log: log, start: start };
})();
