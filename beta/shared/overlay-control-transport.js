(function (root) {
    'use strict';
    var recent = new Map();
    function accept(data, target) {
        var control = data && data.ssnControl;
        if (!control) return true; // Older hosts retain their existing protocol.
        if (control.target !== target || typeof control.id !== 'string') return false;
        var now = Date.now();
        recent.forEach(function (time, key) { if (now - time > 60000) recent.delete(key); });
        if (recent.has(control.id)) return false;
        recent.set(control.id, now);
        if (recent.size > 4096) recent.delete(recent.keys().next().value);
        return true;
    }
    function acknowledge(socket, data, target) {
        var control = data && data.ssnControl;
        if (!control || control.target !== target || !control.id || socket.readyState !== 1) return;
        socket.send(JSON.stringify({ out: control.reply === 1 ? 1 : 3,
            ssnControlAck: { id: control.id, target: target } }));
    }
    // A separate subscription prevents settings/commands reaching ordinary chat
    // consumers. It uses the selected relay and existing receiver permissions.
    function connect(params, session, target, receive) {
        if (!session) return;
        var parameter = params.get('server') ? 'server' : params.has('server2') ? 'server2' : params.has('server') ? 'server' : params.has('server3') ? 'server3' : null;
        if (!parameter) return;
        var endpoint = SocialStreamLocalServer.getRelayUrl(params, parameter,
            parameter === 'server' ? 'wss://io.socialstream.ninja/api' : 'wss://io.socialstream.ninja/extension');
        var requestChannel = parameter === 'server' ? 1 : 3;
        var client = 'overlay-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        var socket, retry, refresh, stopped = false;
        function open() {
            if (stopped) return;
            try { socket = new WebSocket(endpoint); }
            catch (error) { console.warn('[Overlay control] Invalid relay address', error); return; }
            socket.onopen = function () {
                socket.send(JSON.stringify({ join: session.split(',')[0], out: requestChannel, in: 7 }));
                // Only read current state. Never replay a start/reset on reconnect.
                function request() {
                    if (socket.readyState === 1 && ['poll', 'hype', 'map', 'timer', 'ticker', 'spotify'].indexOf(target) !== -1) {
                        socket.send(JSON.stringify({ ssnControlRequest: { target: target, client: client } }));
                    }
                }
                request();
                refresh = setInterval(request, 5000);
            };
            socket.onmessage = function (event) {
                try {
                    var data = JSON.parse(event.data), control = data && data.ssnControl;
                    if (!control || control.target !== target || (control.client && control.client !== client)) return;
                    receive(data);
                    acknowledge(socket, data, target);
                } catch (error) { console.warn('[Overlay control] Message failed', error); }
            };
            socket.onerror = function () { socket.close(); };
            socket.onclose = function () {
                clearInterval(refresh);
                if (!stopped) retry = setTimeout(open, 2000);
            };
        }
        root.addEventListener('beforeunload', function () {
            stopped = true; clearTimeout(retry); clearInterval(refresh);
            if (socket) socket.close();
        });
        open();
    }
    // State revisions reconcile missed transitions, independently of delivery IDs.
    function createStateTracker() {
        var current = null, retired = [];
        return function (next) {
            if (!next || typeof next.epoch !== 'string' || typeof next.revision !== 'number') return { accept: true, reset: false };
            if (retired.indexOf(next.epoch) !== -1 || (current && current.epoch === next.epoch && next.revision < current.revision)) return { accept: false, reset: false };
            var changed = !current || current.epoch !== next.epoch || current.revision !== next.revision;
            var reset = !!(current && (current.epoch !== next.epoch || current.reset !== next.reset));
            if (current && current.epoch !== next.epoch) { retired.push(current.epoch); if (retired.length > 16) retired.shift(); }
            current = { epoch: next.epoch, revision: next.revision, reset: next.reset };
            return { accept: true, reset: reset, changed: changed };
        };
    }
    root.SSNOverlayControl = { accept: accept, acknowledge: acknowledge, connect: connect, createStateTracker: createStateTracker };
})(window);
