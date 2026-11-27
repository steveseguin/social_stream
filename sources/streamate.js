(function () {
	function text(value, limit) {
		return typeof value === "string" && value.length <= limit ? value : "";
	}

	function parseMessage(message, streamId, channel, sequence) {
		if (!message || !streamId) return null;
		var tip = message.kind === "system" && message.systemMessageKind === "goldSent";
		if (message.kind !== "chat" && !tip) return null;
		var sender = tip ? message.participant : message.sender;
		if (!sender || sender.isMuted || (!sender.isAnonymous && !text(sender.nickname, 100))) return null;
		var nativeId = text(message.hash, 100) || (Number.isSafeInteger(message.id) && message.id > 0 ? String(message.id) : "");
		var payload = {
			id: "streamate_" + streamId + "_" + (nativeId || sequence), type: "streamate",
			chatname: sender.isAnonymous ? "Anonymous" : sender.nickname, userid: sender.isAnonymous ? "" : text(sender.id, 100), chatmessage: "", textonly: true,
			chatimg: "", chatbadges: [], hasDonation: "", membership: "",
			meta: { channel: channel, streamId: String(streamId) }
		};
		if (nativeId) payload.meta.messageId = nativeId;
		if (tip) {
			if (typeof message.amount !== "number" || !Number.isFinite(message.amount) || message.amount <= 0) return null;
			payload.hasDonation = message.amount + " Gold";
			payload.meta.gold = message.amount;
			payload.chatmessage = text(message.goldItemKeyword, 500);
			if (payload.chatmessage) payload.meta.item = payload.chatmessage;
		} else {
			payload.chatmessage = text(message.content, 20000);
			if (!payload.chatmessage || !nativeId) return null;
		}
		return payload;
	}

	// The same message parser can be used by a server connection.
	if (typeof window === "undefined") {
		if (typeof module !== "undefined") module.exports = { parseMessage: parseMessage };
		return;
	}
	if (!/^(www\.)?streamate\.com$/.test(location.hostname)) return;
	function currentChannel() {
		var room = location.pathname.match(/^\/cam\/([a-z0-9_-]+)\/?$/i);
		return room ? room[1].toLowerCase() : "";
	}
	if (!currentChannel()) return;
	var pageId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	var socketNumber = 0;
	function isRoomSocket(value) {
		try {
			var url = new URL(value);
			return url.protocol === "wss:" && url.hostname === "user-room.naiadsystems.com" && url.pathname === "/v1/room/socket";
		} catch (_) { return false; }
	}
	function readConnection(channel, publish) {
		var streamId = "", publicChat = false, serial = 0;
		var connection = pageId + "_" + (++socketNumber), buffer = new Uint8Array(0);
		function receive(message) {
			if (message.method === "room/onConnectionInfoChanged") {
				var initial = message.params && message.params.initialStatus;
				publicChat = !!initial && initial.status === "freeChat";
				streamId = initial && initial.streamInfo && Number.isSafeInteger(initial.streamInfo.streamId) ? String(initial.streamInfo.streamId) : "";
			} else if (message.method === "room/onStatusChanged") {
				publicChat = !!message.params && message.params.status === "freeChat";
				var info = message.params && message.params.streamInfo;
				if (info) streamId = Number.isSafeInteger(info.streamId) ? String(info.streamId) : "";
			} else if (message.method === "room/onDisconnecting") {
				publicChat = false;
			} else if (message.method === "room/onMessagesReceived" && publicChat && streamId) {
				var messages = message.params && message.params.messages;
				if (!Array.isArray(messages) || messages.length > 10000) return;
				messages.forEach(function (message) {
					var payload = parseMessage(message, streamId, channel, connection + "_" + (++serial));
					if (payload) publish(payload);
				});
			}
		}
		function read(bytes) {
			if (buffer.length + bytes.length > 2 * 1024 * 1024) { buffer = new Uint8Array(0); return; }
			var joined = new Uint8Array(buffer.length + bytes.length); joined.set(buffer); joined.set(bytes, buffer.length); buffer = joined;
			while (buffer.length) {
				var boundary = -1;
				for (var i = 0; i < Math.min(buffer.length - 3, 8192); i++) {
					if (buffer[i] === 13 && buffer[i + 1] === 10 && buffer[i + 2] === 13 && buffer[i + 3] === 10) { boundary = i; break; }
				}
				if (boundary < 0) { if (buffer.length > 8192) buffer = new Uint8Array(0); return; }
				var header = new TextDecoder().decode(buffer.slice(0, boundary));
				var length = header.match(/(?:^|\r\n)Content-Length:\s*(\d+)\s*(?:\r\n|$)/i);
				if (!length || Number(length[1]) > 2 * 1024 * 1024) { buffer = new Uint8Array(0); return; }
				var end = boundary + 4 + Number(length[1]);
				if (buffer.length < end) return;
				var body = new TextDecoder().decode(buffer.slice(boundary + 4, end)); buffer = buffer.slice(end);
				try { receive(JSON.parse(body)); } catch (_) {}
			}
		}
		return function (data) {
			if (typeof data === "string") read(new TextEncoder().encode(data));
			else if (data instanceof ArrayBuffer) read(new Uint8Array(data));
			else if (ArrayBuffer.isView(data)) read(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
		};
	}

	// Chrome starts the page reader before the site's first socket. The isolated
	// copy signals when its message listener and settings are ready.
	if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
		if (window.__ssnStreamateSocket) return;
		window.__ssnStreamateSocket = true;
		var ready = false, early = [];
		window.addEventListener("message", function (event) {
			if (event.source !== window || event.origin !== location.origin || !event.data || event.data.source !== "ssn-streamate-ready") return;
			ready = true;
			early.splice(0).forEach(function (packet) { window.postMessage(packet, location.origin); });
		});
		window.WebSocket = new Proxy(window.WebSocket, {
			construct: function (Target, args) {
				var socket = Reflect.construct(Target, args);
				var channel = currentChannel();
				if (!channel || !isRoomSocket(args[0])) return socket;
				var read = readConnection(channel, function (payload) {
					var packet = { source: "ssn-streamate-capture", channel: channel, payload: payload };
					if (ready) window.postMessage(packet, location.origin);
					else {
						early.push(packet);
						if (early.length > 1000) early.shift();
					}
				});
				var chain = Promise.resolve();
				socket.addEventListener("message", function (event) {
					chain = chain.then(async function () {
						read(event.data instanceof Blob ? await event.data.arrayBuffer() : event.data);
					}).catch(function () {});
				});
				return socket;
			}
		});
		return;
	}

	if (window.__ssnStreamateSource) return;
	window.__ssnStreamateSource = true;
	var enabled = false, pending = [], seen = new Set(), ids = [];
	function forward(data) {
		if (!data.meta || !data.meta.channel || data.meta.channel !== currentChannel()) return;
		if (pending) {
			pending.push(data);
			if (pending.length > 1000) pending.shift();
			return;
		}
		if (!enabled || seen.has(data.id)) return;
		seen.add(data.id); ids.push(data.id);
		if (ids.length > 10000) seen.delete(ids.shift());
		data.textonly = true;
		try { chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {}); } catch (_) {}
	}

	var nativeSocket = window.ninjafy && typeof window.ninjafy.onWebSocketMessage === "function";
	if (nativeSocket) {
		// The SSApp preload buffers matching socket events before the source window is ready.
		var connections = new Map();
		window.ninjafy.onWebSocketMessage(function (event) {
			if (!event || !event.requestId || !isRoomSocket(event.url)) return;
			if (event.type === "open") {
				connections.set(event.requestId, readConnection(currentChannel(), forward));
			} else if (event.type === "close") {
				connections.delete(event.requestId);
			} else if (event.type === "message" && connections.has(event.requestId)) {
				connections.get(event.requestId)(event.data);
			}
		});
	} else {
		window.addEventListener("message", function (event) {
			if (event.source !== window || event.origin !== location.origin) return;
			var packet = event.data;
			if (!packet || packet.source !== "ssn-streamate-capture" || packet.channel !== currentChannel()) return;
			var data = packet.payload;
			if (!data || data.type !== "streamate" || typeof data.id !== "string" || data.id.length > 250 ||
				typeof data.chatname !== "string" || typeof data.chatmessage !== "string" || data.chatmessage.length > 20000) return;
			forward(data);
		});
	}
	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		enabled = !chrome.runtime.lastError && !!response && response.state !== false;
		var buffered = pending;
		pending = null;
		buffered.forEach(forward);
		if (!nativeSocket) window.postMessage({ source: "ssn-streamate-ready" }, location.origin);
	});
	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request === "getSource") { sendResponse("streamate"); return; }
		if (request === "focusChat") {
			var input = document.querySelector('[data-ta-locator="ChatForm__Input"]');
			if (input) input.focus();
			sendResponse(!!input); return;
		}
		if (request && typeof request === "object") {
			if ("state" in request) enabled = request.state !== false;
			sendResponse(true); return;
		}
		sendResponse(false);
	});
})();
