(function (root) {
    'use strict';
    // AI overlays use channels 13/14 in a private room for each saved display link.
    function connect(url, room, host, receive) {
        var socket, retry, stopped = false;
        var chunks = {};
        var serial = 0;
        var prefix = Date.now().toString(36) + Math.random().toString(36).slice(2);
        function open() {
            if (stopped) return;
            socket = new WebSocket(url);
            socket.onopen = function () {
                socket.send(JSON.stringify({ join: room, in: host ? 13 : 14, out: host ? 14 : 13 }));
            };
            socket.onmessage = function (event) {
                try {
                    var data = JSON.parse(event.data);
                    if (data.aiEventChunk) {
                        var part = data.aiEventChunk;
                        var entry = chunks[part.id];
                        if (!entry) {
                            entry = chunks[part.id] = { parts: [], count: 0, total: part.total };
                            entry.timer = setTimeout(function () { delete chunks[part.id]; }, 30000);
                        }
                        if (typeof entry.parts[part.index] === 'undefined') entry.count++;
                        entry.parts[part.index] = part.value;
                        if (entry.count !== entry.total) return;
                        clearTimeout(entry.timer); delete chunks[part.id];
                        data = JSON.parse(entry.parts.join(''));
                    }
                    receive(data);
                } catch (_) { console.warn('AI overlay relay received an unreadable message.'); }
            };
            socket.onerror = function () { socket.close(); };
            socket.onclose = function () { if (!stopped) retry = setTimeout(open, 2000); };
        }
        function close() {
            stopped = true; clearTimeout(retry);
            Object.keys(chunks).forEach(function (id) { clearTimeout(chunks[id].timer); });
            chunks = {};
            if (socket) socket.close();
        }
        open();
        return {
            close: close,
            send: function (data) {
                if (stopped || !socket || socket.readyState !== 1) return false;
                var text = JSON.stringify(data);
                if (text.length <= 12000) socket.send(text);
                else {
                    var id = prefix + '-' + (++serial), total = Math.ceil(text.length / 12000);
                    for (var index = 0; index < total; index++) socket.send(JSON.stringify({ aiEventChunk: { id: id, index: index, total: total, value: text.slice(index * 12000, (index + 1) * 12000) } }));
                }
                return true;
            }
        };
    }
    function room(session, token) { return session.split(',')[0] + ':aievent:' + token; }
    root.SSNAiEventRelay = { connect: connect, room: room };
}(window));
