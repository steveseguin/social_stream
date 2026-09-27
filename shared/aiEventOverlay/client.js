(function () {
    'use strict';
    var params = new URLSearchParams(location.search);
    var room = params.get('session') || '';
    var password = params.get('password') || 'false';
    var pending = {};
    var chunks = {};
    var serial = 0;
    var prefix = Date.now().toString(36) + Math.random().toString(36).slice(2);
    var listeners = [];
    function frame(label, featured) {
        var node = document.createElement('iframe');
        node.hidden = true;
        node.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=' + encodeURIComponent(password) +
            '&label=' + encodeURIComponent(label) + '&room=' + encodeURIComponent(room) + '&novideo&noaudio&cleanoutput' +
            (featured ? '&scene&exclude=' : '&solo&view=') + encodeURIComponent(room);
        document.body.appendChild(node);
        return node;
    }
    var control = room ? frame('aievent-' + (params.get('profile') || 'default'), false) : null;
    function request(action, args, timeout) {
        return new Promise(function (resolve, reject) {
            if (!control) return reject(new Error('Open this page using the session link in the SSN popup.'));
            var target = prefix + '-' + (++serial);
            var timer = setTimeout(function () {
                delete pending[target];
                reject(new Error('SSN did not respond. Check that SSN is running and connected.'));
            }, timeout || 10000);
            pending[target] = { resolve: resolve, reject: reject, timer: timer };
            control.contentWindow.postMessage({ sendData: { overlayNinja: Object.assign({}, args || {}, { action: action, target: target }) }, type: 'rpcs' }, '*');
        });
    }
    function unchunk(payload) {
        if (!payload || payload.action !== 'ssnBridgeChunk') return payload;
        var entry = chunks[payload.chunkId];
        if (!entry) {
            entry = chunks[payload.chunkId] = { parts: [], count: 0, total: payload.total };
            entry.timer = setTimeout(function () { delete chunks[payload.chunkId]; }, 30000);
        }
        if (typeof entry.parts[payload.index] === 'undefined') entry.count++;
        entry.parts[payload.index] = payload.value;
        if (entry.count !== entry.total) return null;
        clearTimeout(entry.timer);
        delete chunks[payload.chunkId];
        try { return JSON.parse(entry.parts.join('')); } catch (_) { return null; }
    }
    window.addEventListener('message', function (event) {
        if (!control || event.source !== control.contentWindow) return;
        var payload = unchunk(event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja);
        if (!payload) return;
        if (payload.aiEventResponse) {
            var response = payload.aiEventResponse;
            var job = pending[response.target];
            if (!job) return;
            clearTimeout(job.timer);
            delete pending[response.target];
            if (response.error) job.reject(new Error(response.error));
            else job.resolve(response.value);
        } else listeners.forEach(function (listener) { listener(payload); });
    });
    async function load(edit) {
        if (!room) throw new Error('Open this page using the session link in the SSN popup.');
        // The room connection usually finishes after the iframe load event.
        for (var attempt = 0; attempt < 6; attempt++) {
            try { return await request('getAiEventProfiles', { edit: edit }, 4000); }
            catch (error) { if (attempt === 5) throw error; }
        }
    }
    function subscribe(profile, receive) {
        if (profile.mode === 'flow') {
            listeners.push(receive);
            return;
        }
        var featured = profile.mode === 'featured';
        var serverKey = params.has('server2') ? 'server2' : params.has('server3') ? 'server3' : params.has('server') ? 'server' : '';
        if (serverKey) {
            var url = serverKey === 'server' ? params.get('server') || (params.has('localserver') ? SocialStreamLocalServer.getWebSocketUrl() : 'wss://io.socialstream.ninja/api') : SocialStreamLocalServer.getRelayUrl(params, serverKey, 'wss://io.socialstream.ninja/extension');
            var socket;
            var timer;
            var stopped = false;
            function connect() {
                if (stopped) return;
                socket = new WebSocket(url);
                socket.onopen = function () {
                    socket.send(JSON.stringify({ join: room.split(',')[0], out: 3, in: featured ? 2 : serverKey === 'server' ? 1 : 4 }));
                };
                socket.onmessage = function (event) {
                    try {
                        var value = JSON.parse(event.data);
                        receive(value.overlayNinja || value.dataReceived && value.dataReceived.overlayNinja || value);
                        if (value.get) socket.send(JSON.stringify({ callback: { get: value.get, result: true } }));
                    } catch (_) {}
                };
                socket.onclose = function () { if (!stopped) timer = setTimeout(connect, 2000); };
                socket.onerror = function () { socket.close(); };
            }
            connect();
            window.addEventListener('beforeunload', function () { stopped = true; clearTimeout(timer); if (socket) socket.close(); });
        } else {
            var feed = frame(featured ? 'overlay' : (params.get('label') || 'dock'), featured);
            window.addEventListener('message', function (event) {
                if (event.source !== feed.contentWindow) return;
                var payload = event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja;
                if (payload !== undefined) receive(payload);
            });
        }
    }
    function render(container, result) {
        var card = document.createElement('article');
        card.className = 'ai-event-card style-' + (['glass', 'neon', 'storybook', 'minimal'].indexOf(result.style) >= 0 ? result.style : 'glass');
        var heading = document.createElement('h2');
        heading.textContent = result.name || 'Stream moment';
        card.appendChild(heading);
        if (result.donation) {
            var donation = document.createElement('div');
            donation.className = 'ai-event-donation';
            donation.textContent = result.donation;
            card.appendChild(donation);
        }
        if (result.image && /^(https?:|data:image\/)/i.test(result.image)) {
            var img = document.createElement('img');
            img.src = result.image;
            img.alt = 'Generated illustration';
            card.appendChild(img);
        }
        var text = document.createElement('p');
        text.textContent = result.text;
        card.appendChild(text);
        container.appendChild(card);
        var audio = null;
        if (result.audio && /^(https?:|data:audio\/)/i.test(result.audio)) {
            audio = new Audio(result.audio);
            audio.play().catch(function (error) { console.warn('AI overlay audio could not play:', error.message); });
        }
        return new Promise(function (resolve) {
            setTimeout(function () { if (audio) audio.pause(); card.remove(); resolve(); }, (result.duration || 12) * 1000);
        });
    }
    window.SSNAiEventClient = { request: request, load: load, subscribe: subscribe, render: render, params: params };
}());
