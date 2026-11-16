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
	if (!/^(www\.)?streamate\.com$/.test(location.hostname) || window.__ssnStreamateSocket) return;
	window.__ssnStreamateSocket = true;
	var NativeSocket = window.WebSocket;
	var post = window.postMessage.bind(window), ready = false, pending = [], socketNumber = 0;
	var pageId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	function publish(channel, payload) {
		var packet = { source: "ssn-streamate-capture", channel: channel, payload: payload };
		if (ready) post(packet, location.origin);
		else { pending.push(packet); if (pending.length > 1000) pending.shift(); }
	}
	window.addEventListener("message", function (event) {
		if (event.source !== window || event.origin !== location.origin || !event.data || event.data.source !== "ssn-streamate-ready") return;
		ready = true;
		pending.splice(0).forEach(function (packet) { post(packet, location.origin); });
	});
	window.WebSocket = new Proxy(NativeSocket, {
		construct: function (Target, args) {
			var socket = Reflect.construct(Target, args);
			var url; try { url = new URL(args[0]); } catch (_) { return socket; }
			if (url.protocol !== "wss:" || url.hostname !== "user-room.naiadsystems.com" || url.pathname !== "/v1/room/socket") return socket;
			var room = location.pathname.match(/^\/cam\/([a-z0-9_-]+)\/?$/i);
			if (!room) return socket;
			var channel = room[1].toLowerCase(), streamId = "", publicChat = false, serial = 0;
			var connection = pageId + "_" + (++socketNumber), buffer = new Uint8Array(0), chain = Promise.resolve();
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
						if (payload) publish(channel, payload);
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
			socket.addEventListener("message", function (event) {
				chain = chain.then(async function () {
					var data = event.data;
					if (typeof data === "string") read(new TextEncoder().encode(data));
					else if (data instanceof Blob) read(new Uint8Array(await data.arrayBuffer()));
					else if (data instanceof ArrayBuffer) read(new Uint8Array(data));
				}).catch(function () { buffer = new Uint8Array(0); });
			});
			socket.addEventListener("close", function () { publicChat = false; });
			return socket;
		}
	});
})();
