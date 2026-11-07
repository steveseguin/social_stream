(function (root) {
    'use strict';
    var pending = Object.create(null), socket = null, frame = null, connecting = null, stopped = false;
    var hostPeer = null;
    var serial = 0, prefix = 'edge-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    function receive(packet) {
        var part = packet && packet.edgeTtsResponse;
        var job = part && pending[part.target];
        if (!job) return;
        if (part.error) return finish(part.target, new Error(part.error));
        if (!Number.isInteger(part.total) || part.total < 1 || part.total > 600 ||
            !Number.isInteger(part.index) || part.index < 0 || part.index >= part.total ||
            typeof part.audio !== 'string' || part.audio.length > 12000 || (job.total && job.total !== part.total)) {
            return finish(part.target, new Error('Invalid Edge Natural audio response.'));
        }
        job.total = part.total;
        if (typeof job.parts[part.index] === 'undefined') { job.parts[part.index] = part.audio; job.count++; }
        if (job.count === job.total) finish(part.target, null, { audio: job.parts.join(''), mimeType: 'audio/mpeg' });
    }
    function finish(id, error, value) {
        var job = pending[id];
        if (!job) return;
        clearTimeout(job.timer); delete pending[id];
        if (error) job.reject(error); else job.resolve(value);
    }
    function connect() {
        if (stopped) return Promise.reject(new Error('The TTS overlay has closed.'));
        if (socket && socket.readyState === 1) return Promise.resolve();
        if (frame && connecting === null) return Promise.resolve();
        if (connecting) return connecting;
        connecting = new Promise(function (resolve, reject) {
            var params = new URLSearchParams(location.search), room = (params.get('session') || '').split(',')[0];
            if (!room) return reject(new Error('Open this overlay using its session link from SSApp.'));
            var key = params.get('server') ? 'server' : params.has('server2') ? 'server2' : params.has('server3') ? 'server3' : params.has('server') ? 'server' : '';
            var timer = setTimeout(function () {
                if (socket) socket.close();
                if (frame) { frame.remove(); frame = null; hostPeer = null; }
                reject(new Error('SSApp is not connected. Keep the desktop app open for Edge Natural.'));
            }, 15000);
            if (key) {
                var fallback = key === 'server' ? 'wss://io.socialstream.ninja/api' : 'wss://io.socialstream.ninja/extension';
                var endpoint = root.SocialStreamLocalServer ? root.SocialStreamLocalServer.getRelayUrl(params, key, fallback) : params.get(key) || fallback;
                var connection;
                try { connection = new WebSocket(endpoint); }
                catch (error) { clearTimeout(timer); reject(error); return; }
                socket = connection;
                connection.onopen = function () { clearTimeout(timer); connection.send(JSON.stringify({ join: room, out: key === 'server' ? 1 : 3, in: 7 })); resolve(); };
                connection.onmessage = function (event) { try { receive(JSON.parse(event.data)); } catch (_) {} };
                connection.onerror = function () { connection.close(); };
                connection.onclose = function () {
                    clearTimeout(timer);
                    if (socket !== connection) return;
                    connecting = null; socket = null;
                    reject(new Error('The Edge Natural connection closed.'));
                    Object.keys(pending).forEach(function (id) { finish(id, new Error('SSApp disconnected before speech completed.')); });
                };
            } else {
                frame = document.createElement('iframe'); frame.hidden = true;
                frame.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=' + encodeURIComponent(params.get('password') || 'false') +
                    '&label=edge-tts&room=' + encodeURIComponent(room) + '&novideo&noaudio&cleanoutput&solo&view=' + encodeURIComponent(room);
                frame.onload = function () { clearTimeout(timer); resolve(); };
                document.body.appendChild(frame);
            }
        }).then(function () { connecting = null; }, function (error) { connecting = null; throw error; });
        return connecting;
    }
    root.addEventListener('message', function (event) {
        if (!frame || event.source !== frame.contentWindow || event.origin !== 'https://vdo.socialstream.ninja') return;
        receive(event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja);
    });
    async function synthesize(text, settings) {
        var bridge = root.ninjafy || root.electronApi;
        if (bridge && typeof bridge.edgeTts === 'function') return bridge.edgeTts(text, settings);
        await connect();
        return new Promise(function (resolve, reject) {
            var id = prefix + '-' + (++serial);
            var request = { action: 'edgeTts', target: id, value: Object.assign({}, settings, { text: text }) };
            pending[id] = { resolve: resolve, reject: reject, parts: [], count: 0, timer: setTimeout(function () {
                finish(id, new Error('Edge Natural timed out. Keep SSApp open and check its internet connection.'));
            }, 90000) };
            if (socket && socket.readyState === 1) socket.send(JSON.stringify(request));
            else if (frame) {
                pending[id].request = request;
                if (hostPeer) {
                    frame.contentWindow.postMessage({ sendData: { overlayNinja: request }, type: 'rpcs', UUID: hostPeer }, 'https://vdo.socialstream.ninja');
                    pending[id].request = null;
                }
            } else finish(id, new Error('SSApp is not connected for Edge Natural.'));
        });
    }
    // The standard bridge reports peer connections through push-connection-info.
    root.addEventListener('message', function (event) {
        if (!frame || event.source !== frame.contentWindow || event.origin !== 'https://vdo.socialstream.ninja') return;
        var data = event.data;
        if (!data || !data.UUID) return;
        if ((data.action === 'push-connection' || data.action === 'view-connection') && !data.value && data.UUID === hostPeer) { hostPeer = null; return; }
        if (data.action !== 'push-connection-info' && data.action !== 'view-connection-info') return;
        if (!data.value || data.value.label !== 'SocialStream') return;
        hostPeer = data.UUID;
        Object.keys(pending).forEach(function (id) {
            var job = pending[id]; if (!job.request) return;
            frame.contentWindow.postMessage({ sendData: { overlayNinja: job.request }, type: 'rpcs', UUID: data.UUID }, 'https://vdo.socialstream.ninja');
            job.request = null;
        });
    });
    root.addEventListener('beforeunload', function () {
        stopped = true;
        Object.keys(pending).forEach(function (id) { finish(id, new Error('TTS overlay closed.')); });
        if (socket) socket.close();
        if (frame) frame.remove();
    });
    root.SSNEdgeTts = { synthesize: synthesize };
})(window);
