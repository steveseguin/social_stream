(function () {
    'use strict';
    var service;
    var replies = new Map();
    var pending = new Map();
    var receivers = new Map();
    function relayReceivers() {
        receivers.forEach(function (entry, key) {
            if (entry.session !== streamID || entry.until < Date.now() || entry.socket.readyState !== 1) receivers.delete(key);
        });
        return Array.from(receivers.values());
    }
    // Presence and image-load receipts only. This route cannot spend points or run commands.
    window.handleStickerRelayRequest = function (request, socket) {
        if (!request || (request.action !== 'stickerPresence' && request.action !== 'stickerReceipt')) return false;
        if (!isExtensionOn || settings.disablehost) return true;
        var client = request.stickerClient;
        if (typeof client !== 'string' || !client || client.length > 100) return true;
        relayReceivers();
        if (request.action === 'stickerPresence') {
            if (receivers.size < 100 || receivers.has(client)) receivers.set(client, { client: client, socket: socket, session: streamID, until: Date.now() + 15000 });
        } else {
            var receipt = request.meta && request.meta.sticker;
            var done = receipt && pending.get(receipt.redemptionId);
            if (done && done.clients && done.clients.get(client) === socket && done.session === streamID) {
                done.clients.delete(client);
                if (receipt.success === true || !done.clients.size) done(receipt.success === true);
            }
        }
        return true;
    };
    function peers() {
        var result = typeof connectedPeers === 'object' && connectedPeers || {};
        if (typeof ninjaBridge !== 'undefined' && ninjaBridge && ninjaBridge.isReady()) result = Object.assign({}, result, ninjaBridge.getPeers());
        return result;
    }
    function hasReceiver() {
        var connected = peers();
        return Object.keys(connected).some(function (key) { return connected[key] === 'stickers'; }) || relayReceivers().length > 0;
    }
    window.receiveStickerReceipt = function (request, uuid) {
        var receipt = request && request.meta && request.meta.sticker;
        if (!receipt || peers()[uuid] !== 'stickers') return;
        var done = pending.get(receipt.redemptionId);
        if (done && done.peers && done.peers.has(uuid)) {
            done.peers.delete(uuid);
            if (receipt.success === true || !done.peers.size) done(receipt.success === true);
        }
    };
    function deliver(payload) {
        return new Promise(function (resolve) {
            var id = payload.meta.sticker.redemptionId;
            var timer = setTimeout(function () { done(false); }, 8000);
            function done(success) {
                if (!pending.has(id)) return;
                pending.delete(id); clearTimeout(timer); resolve(success);
            }
            pending.set(id, done);
            payload.meta.sticker.expiresAt = Date.now() + 7000;
            var displays = relayReceivers();
            // Deliver to each display as P2P does. A busy or stale display must not
            // reject another display's successful image-load receipt.
            if (displays.length) {
                done.clients = new Map(displays.map(function (entry) { return [entry.client, entry.socket]; }));
                done.session = streamID;
                displays.forEach(function (entry) {
                    try { entry.socket.send(JSON.stringify(Object.assign({}, payload, { out: 17, stickerClient: entry.client }))); }
                    catch (_) { done.clients.delete(entry.client); }
                });
                if (!done.clients.size) done(false);
                return;
            }
            var connected = peers();
            // A hidden/busy OBS source must not reject another source's display.
            done.peers = new Set(Object.keys(connected).filter(function (key) { return connected[key] === 'stickers'; }));
            Promise.resolve().then(function () { return sendTargetP2P(payload, 'stickers'); }).then(function (sent) { if (!sent) done(false); }, function () { done(false); });
        });
    }
    function prepare(url) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            var timer = setTimeout(function () { done(new Error('Image timeout')); }, 5000);
            function done(error) {
                clearTimeout(timer); img.onload = img.onerror = null;
                error ? reject(error) : resolve();
            }
            img.onload = function () { done(); };
            img.onerror = function () { done(new Error('Image unavailable')); };
            img.referrerPolicy = 'no-referrer';
            img.src = url;
        });
    }
    window.processStickerReward = async function (message) {
        if (!isExtensionOn || !SSNStickers.config(settings.stickerRewards).enabled || !getBooleanSettingValue('enablePointsSystem', false)) return;
        if (!service) service = new SSNStickerRewards({
            settings: function () { return settings.stickerRewards; },
            pointsEnabled: function () { return isExtensionOn && getBooleanSettingValue('enablePointsSystem', false); },
            points: async function () { await window.pointsSystemReady(); return window.pointsSystem; },
            hasReceiver: hasReceiver,
            assetUrl: function (image) {
                return new URL('media/stickers/' + image, location.href).href;
            },
            prepare: prepare,
            send: deliver,
            changed: function () { if (window.requestPointsLeaderboardBroadcast) window.requestPointsLeaderboardBroadcast('sticker', { immediate: true }); }
        });
        var result = await service.process(message);
        if (result && result.message) {
            sendDataP2P({ type: 'bot', platform: 'socialstream', chatname: 'Sticker rewards',
                chatmessage: message.chatname + ': ' + result.message, /* textonly=true declares a literal chatmessage string, not HTML; preserve its characters and keep display formatting out of the payload. */ textonly: true, bot: true, private: true });
            var now = Date.now(), key = message.type + ':' + message.chatname;
            replies.forEach(function (until, id) { if (until <= now) replies.delete(id); });
            if (SSNStickers.config(settings.stickerRewards).reply && message.tid && !replies.has(key)) {
                replies.set(key, now + 10000);
                sendMessageToTabs({ response: '@' + message.chatname + ', ' + result.message, tid: message.tid, bot: true }, false);
            }
        }
    };
})();
