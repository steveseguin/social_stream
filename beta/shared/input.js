window.onerror = function (errorMsg, url, lineNumber) {
    console.error(errorMsg, lineNumber);
    return false;
};

function getById(id) {
    return document.getElementById(id);
}

function sendMessage(event) {
    event.preventDefault();
    const input = getById("chatInput");
    if (input.value) {
        if (respondP2P(input.value)) input.value = "";
    }
}

getById("chatInputButton").addEventListener("click", sendMessage);
getById("chatInput").addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
        sendMessage(event);
    }
});

const urlParams = new URLSearchParams(window.location.search);
const roomID = urlParams.get("session") || "test";
const password = urlParams.get("password") || "false";

// Check for transparent parameter
if (urlParams.has("transparent")) {
    document.body.style.backgroundColor = "transparent";
    document.getElementById("chatInput_parent").style.backgroundColor = "transparent";
    document.getElementById("chatInput_parent").style.boxShadow = "none";
}
let iframes = [];


function RecvDataWindow(room) {
    const connectedPeers = {};
    const iframe = document.createElement("iframe");
    iframe.src = `https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=${encodeURIComponent(password)}&push&notmobile&label=chatinput&vd=0&ad=0&novideo&noaudio&autostart&cleanoutput&room=${encodeURIComponent(room)}`;
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.position = "fixed";
    iframe.style.left = "-100px";
    iframe.style.top = "-100px";
    iframe.id = `frame_${encodeURIComponent(room)}`;
    iframe.allow = "midi;microphone;";
    iframes.push({ iframe: iframe, peers: connectedPeers });
    document.body.appendChild(iframe);

    window.addEventListener("message", function (e) {
        if (e.source !== iframe.contentWindow || e.origin !== "https://vdo.socialstream.ninja" || !e.data || typeof e.data !== "object") return;
        if ("action" in e.data && e.data.UUID && "value" in e.data && !e.data.value && e.data.action === "push-connection") {
            delete connectedPeers[e.data.UUID];

				} else if ("action" in e.data && e.data.UUID && e.data.value && e.data.action === "push-connection-info") {
            connectedPeers[e.data.UUID] = e.data.value.label;

					if (connectedPeers[e.data.UUID] === "SocialStream"){
						document.getElementById("loading").classList.add("hidden");
					}
				} else if ("action" in e.data && e.data.UUID && e.data.value && e.data.action === "view-connection-info") {
            connectedPeers[e.data.UUID] = e.data.value.label;

					if (connectedPeers[e.data.UUID] === "SocialStream"){
						document.getElementById("loading").classList.add("hidden");
					}
        } else if ("action" in e.data && e.data.UUID && "value" in e.data && !e.data.value && e.data.action === "view-connection") {
            delete connectedPeers[e.data.UUID];

        } else if ("action" in e.data && e.data.UUID && "label" in e.data) {
            connectedPeers[e.data.UUID] = e.data.label;

					if (connectedPeers[e.data.UUID] === "SocialStream"){
						document.getElementById("loading").classList.add("hidden");
					}
        }
        document.getElementById('loading').classList.toggle('hidden', iframes.every(item => Object.values(item.peers).includes('SocialStream')));
    });
}

const upstream = urlParams.has('server3');
const socketserverURL = upstream ? SocialStreamLocalServer.getRelayUrl(urlParams, urlParams.has('server2') ? 'server2' : 'server3', 'wss://io.socialstream.ninja/extension') : urlParams.get('server');
// A raw custom server URL retains its legacy unjoined protocol.
if (!upstream) roomID.split(',').forEach(room => { RecvDataWindow(room.trim()); });
function send2Extension(data) {
    if (!iframes.length || iframes.some(item => !Object.values(item.peers).includes('SocialStream'))) return false;
    iframes.forEach(item => {
        Object.keys(item.peers).forEach(UUID => {
            if (item.peers[UUID] === 'SocialStream') item.iframe.contentWindow.postMessage({ sendData: { overlayNinja: data }, type: 'rpcs', UUID }, 'https://vdo.socialstream.ninja');
        });
    });
    return true;
}

const sockets = [];
let stopped = false;
function connectWebSocket(room, index) {
    if (!socketserverURL || stopped) return;
    let socket;
    try { socket = new WebSocket(socketserverURL); } catch (_) { return; }
    sockets[index] = socket;
    socket.onopen = function () {
        if (upstream) socket.send(JSON.stringify({ join: room, out: 3, in: 16 }));
        document.getElementById('loading').classList.toggle('hidden', sockets.every(s => s.readyState === 1));
    };
    socket.onclose = function () {
        if (stopped) return;
        document.getElementById('loading').classList.remove('hidden');
        setTimeout(function () { connectWebSocket(room, index); }, 2000);
    };
    socket.onerror = function () { socket.close(); };
}
if (socketserverURL) (upstream ? roomID.split(',') : ['']).forEach((room, index) => connectWebSocket(room.trim(), index));
window.addEventListener('beforeunload', function () { stopped = true; sockets.forEach(socket => socket.close()); });
function respondP2P(data) {
    var msg = { response: data.trim() };
    if (!msg.response) return false;
    if (socketserverURL) {
        if (!sockets.length || sockets.some(socket => socket.readyState !== 1)) return upstream ? false : send2Extension(msg);
        sockets.forEach(socket => socket.send(JSON.stringify(msg)));
        return true;
    }
    return send2Extension(msg);
}
