(function () {
    'use strict';
    var params = new URLSearchParams(location.search);
    var standalone = document.body.hasAttribute('data-sticker-overlay');
    if (!standalone && !params.has('stickers')) return;
    var scriptUrl = document.currentScript.src, rootUrl = new URL('../../', scriptUrl);
    var style = document.createElement('link');
    style.rel = 'stylesheet'; style.href = new URL('player.css', scriptUrl).href; document.head.appendChild(style);
    var stage = document.createElement('div'); stage.className = 'ssn-sticker-stage';
    if (params.get('motion') === 'off') stage.dataset.motion = 'off';
    document.body.appendChild(stage);
    var bridge, busy = false, queue = [], seen = new Set();
    var catalog = SSNStickers;
    function receipt(item, uuid, success) {
        if (!bridge || !uuid) return;
        bridge.contentWindow.postMessage({ sendData: { overlayNinja: { action: 'stickerReceipt',
            meta: { sticker: { redemptionId: item.redemptionId, success: success } } } }, type: 'rpcs', UUID: uuid }, '*');
    }
    function show(payload, uuid) {
        if (!payload || payload.event !== 'sticker' || !payload.meta || !payload.meta.sticker) return;
        var item = payload.meta.sticker;
        if (typeof item.redemptionId !== 'string' || seen.has(item.redemptionId)) return;
        if (!Number.isFinite(item.expiresAt) || item.expiresAt < Date.now() || busy || queue.length) { receipt(item, uuid, false); return; }
        var reward = catalog.rewards({ packs: catalog.packs.map(function (pack) { return pack.id; }) }).find(function (r) { return r.id === item.id; });
        var url = reward ? new URL('media/stickers/' + reward.image, rootUrl).href : catalog.mediaUrl(payload.contentimg);
        if (!url) { receipt(item, uuid, false); return; }
        seen.add(item.redemptionId);
        if (seen.size > 100) seen.delete(seen.values().next().value);
        queue.push({ url: url, item: item, uuid: uuid, name: String(payload.chatname || '').slice(0, 100) });
        next();
    }
    function next() {
        if (busy || !queue.length) return;
        var data = queue.shift();
        if (data.item.expiresAt < Date.now()) { next(); return; }
        busy = true;
        var card = document.createElement('div'), img = document.createElement('img'), caption = document.createElement('p');
        card.className = 'ssn-sticker'; card.dataset.motion = catalog.motions.indexOf(data.item.motion) >= 0 ? data.item.motion : 'still';
        card.style.width = catalog.number(params.get('size'), 520, 100, 1000) + 'px'; card.style.maxWidth = '85vw';
        img.alt = String(data.item.name || 'Sticker').slice(0, 100); img.referrerPolicy = 'no-referrer';
        caption.textContent = data.name ? data.name + ' · ' + img.alt : img.alt;
        card.appendChild(img); if (!params.has('hidecaption')) card.appendChild(caption); stage.appendChild(card);
        var finished = false, confirmed = false, timer = setTimeout(clear, 5000);
        function clear() {
            if (finished) return; finished = true; clearTimeout(timer); img.onload = img.onerror = null;
            if (!confirmed) receipt(data.item, data.uuid, false);
            card.remove(); busy = false; next();
        }
        img.onload = function () {
            if (data.item.expiresAt < Date.now()) { clear(); return; }
            clearTimeout(timer); card.classList.add('is-visible');
            confirmed = true; receipt(data.item, data.uuid, true);
            timer = setTimeout(clear, catalog.number(data.item.duration, 6, 2, 15) * 1000);
        };
        img.onerror = clear; img.src = data.url;
    }
    var demo = params.get('demo');
    if (demo && standalone) {
        var reward = catalog.rewards({ packs: catalog.packs.map(function (pack) { return pack.id; }) }).find(function (r) { return r.id === demo; });
        if (reward) show({ event: 'sticker', chatname: 'Preview', meta: { sticker: Object.assign({}, reward, { redemptionId: 'preview', expiresAt: Date.now() + 30000 }) } });
        return; // Public previews never connect to a session or spend points.
    }
    var session = params.get('session') || params.get('s') || params.get('id');
    if (!session) {
        if (standalone) {
            var help = document.createElement('p'); help.textContent = 'Add the session link from SSN → Points System → Sticker rewards.';
            help.style.cssText = 'font:18px system-ui;color:white;background:#111827;padding:24px'; document.body.appendChild(help);
        }
        return;
    }
    bridge = document.createElement('iframe');
    bridge.style.cssText = 'width:0;height:0;border:0;position:fixed;left:-100px;top:-100px';
    bridge.title = 'Social Stream sticker connection';
    bridge.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=' + encodeURIComponent(params.get('password') || 'false') +
        '&push&label=stickers&view=' + encodeURIComponent(session) + '&vd=0&ad=0&novideo&noaudio&autostart&cleanoutput&room=' + encodeURIComponent(session);
    window.addEventListener('message', function (event) {
        if (event.source !== bridge.contentWindow) return;
        var payload = event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja;
        if (Array.isArray(payload)) payload.forEach(function (item) { show(item, event.data.UUID); }); else show(payload, event.data.UUID);
    });
    document.body.appendChild(bridge);
})();
