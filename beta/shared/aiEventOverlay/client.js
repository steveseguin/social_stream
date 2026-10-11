(function () {
    'use strict';
    var params = new URLSearchParams(location.search);
    var displayToken = new URLSearchParams(location.hash.slice(1)).get('aieventauth') || '';
    var room = params.get('session') || '';
    var password = params.get('password') || 'false';
    var pending = {};
    var chunks = {};
    var serial = 0;
    var prefix = Date.now().toString(36) + Math.random().toString(36).slice(2);
    var listeners = [];
    var serverKey = params.get('server') ? 'server' : params.has('server2') ? 'server2' : params.has('server3') ? 'server3' : params.has('server') ? 'server' : '';
    var relay = null;
    var heartbeat = null;
    function frame(label, featured) {
        var node = document.createElement('iframe');
        node.hidden = true;
        node.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=' + encodeURIComponent(password) +
            '&label=' + encodeURIComponent(label) + '&room=' + encodeURIComponent(room) + '&novideo&noaudio&cleanoutput' +
            (featured ? '&scene&exclude=' : '&solo&view=') + encodeURIComponent(room);
        document.body.appendChild(node);
        return node;
    }
    var control = room && !serverKey ? frame('aievent-' + (params.get('profile') || 'default'), false) : null;
    if (room && displayToken && serverKey) {
        relay = window.SSNAiEventRelay.connect(SocialStreamLocalServer.getRelayUrl(params, serverKey, 'wss://io.socialstream.ninja/api'),
            window.SSNAiEventRelay.room(room, displayToken), false, function (payload) {
                if (payload.aiEventMessage) listeners.forEach(function (listener) { listener(payload.aiEventMessage); });
                else receive(payload);
            });
        window.addEventListener('beforeunload', function () { clearInterval(heartbeat); relay.close(); });
    }
    function request(action, args, timeout) {
        return new Promise(function (resolve, reject) {
            if (!control && !relay) return reject(new Error('Open this page using the session link in the SSN popup.'));
            var target = prefix + '-' + (++serial);
            var timer = setTimeout(function () {
                delete pending[target];
                reject(new Error('SSN did not respond. Check that SSN is running and connected.'));
            }, timeout || 10000);
            pending[target] = { resolve: resolve, reject: reject, timer: timer };
            var data = Object.assign({}, args || {}, { action: action, target: target, profile: params.get('profile') || 'default', displayToken: displayToken });
            if (relay) {
                if (!relay.send({ aiEventRequest: data })) {
                    clearTimeout(timer); delete pending[target]; reject(new Error('Connecting to the AI overlay relay.'));
                }
            } else control.contentWindow.postMessage({ sendData: { overlayNinja: data }, type: 'rpcs' }, '*');
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
    function receive(payload) {
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
    }
    window.addEventListener('message', function (event) {
        if (!control || event.source !== control.contentWindow) return;
        receive(unchunk(event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja));
    });
    async function load() {
        if (!room) throw new Error('Open this page using the session link in the SSN popup.');
        if (!displayToken) throw new Error('Copy a new overlay URL from AI Event Overlay settings in SSN.');
        // The room connection usually finishes after the iframe load event.
        for (var attempt = 0; attempt < 6; attempt++) {
            try {
                var profiles = await request('getAiEventProfiles', {}, 4000);
                return profiles;
            }
            catch (error) {
                if (attempt === 5) throw error;
                await new Promise(function (resolve) { setTimeout(resolve, 1000); });
            }
        }
    }
    function subscribe(profile, receive) {
        if (profile.mode === 'flow') {
            listeners.push(receive);
            if (relay) {
                var ready = function () { relay.send({ aiEventReady: displayToken }); };
                ready(); heartbeat = setInterval(ready, 10000);
            }
            return;
        }
        var featured = profile.mode === 'featured';
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
    window.SSNAiEventClient = { request: request, load: load, subscribe: subscribe, params: params };
}());
