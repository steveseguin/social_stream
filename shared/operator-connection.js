(function () {
    "use strict";
    // Public operator controls share the existing host command protocol. Breaks has
    // its own authenticated transport; never send private Breaks records here.
    window.SSNOperatorConnection = function (params, session, receive, state) {
        var socket, bridge, peer, retry, stopped = false;
        var upstream = params.has("server3"), api = !upstream && params.has("server");
        function connect() {
            if (stopped) return;
            try { socket = new WebSocket(SocialStreamLocalServer.getRelayUrl(params, upstream ? (params.has("server2") ? "server2" : "server3") : "server",
                upstream ? "wss://io.socialstream.ninja/extension" : "wss://io.socialstream.ninja/api")); }
            catch (_) { state(false); return; }
            socket.onopen = function () {
                socket.send(JSON.stringify({ join: session, out: upstream ? 3 : 1, in: upstream ? 16 : 2 }));
                state(true);
            };
            socket.onmessage = function (event) {
                try { receive(JSON.parse(event.data)); } catch (_) {}
            };
            socket.onerror = function () { socket.close(); };
            socket.onclose = function () { state(false); if (!stopped) retry = setTimeout(connect, 2000); };
        }
        function message(event) {
            if (!bridge || event.source !== bridge.contentWindow || event.origin !== "https://vdo.socialstream.ninja") return;
            var data = event.data || {};
            if ((data.action === "push-connection-info" || data.action === "view-connection-info") && data.value && data.value.label === "SocialStream") {
                var changed = peer !== data.UUID;
                peer = data.UUID;
                if (changed) state(true);
            } else if (data.UUID === peer && (data.action === "push-connection" || data.action === "view-connection") && data.value === false) {
                peer = null; state(false);
            }
            if (peer && data.UUID === peer && data.dataReceived && data.dataReceived.overlayNinja) receive(data.dataReceived.overlayNinja);
        }
        if (upstream || api) connect();
        else {
            bridge = document.createElement("iframe");
            bridge.hidden = true;
            bridge.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=" + encodeURIComponent(params.get("password") || "false") +
                "&solo&view=" + encodeURIComponent(session) + "&novideo&noaudio&label=controls&cleanoutput&room=" + encodeURIComponent(session);
            window.addEventListener("message", message);
            document.body.appendChild(bridge);
        }
        return {
            ready: function () { return upstream || api ? socket && socket.readyState === 1 : !!peer; },
            send: function (packet) {
                packet = Object.assign({}, packet, { operatorRelay: true });
                if (upstream || api) {
                    if (!socket || socket.readyState !== 1) throw new Error("Not connected");
                    socket.send(JSON.stringify(packet));
                } else {
                    if (!peer) throw new Error("Not connected");
                    bridge.contentWindow.postMessage({ sendData: { overlayNinja: packet }, type: "rpcs", UUID: peer }, "https://vdo.socialstream.ninja");
                }
            },
            close: function () {
                stopped = true; clearTimeout(retry);
                if (socket) { socket.onclose = null; socket.close(); }
                if (bridge) bridge.remove();
                window.removeEventListener("message", message);
            }
        };
    };
})();
