(function () {
	function text(value, limit) { return typeof value === "string" && value.length <= limit ? value : ""; }
	function parseMessage(message, roomId, channel, sequence) {
		if (!message || message.isWhisper || message.jasminSpamResult || message.translated || !text(message.userNick, 100)) return null;
		if (message.performerID && message.performerID !== roomId) return null;
		if (!["member", "performer", "tip", "action"].includes(message.type)) return null;
		var nativeId = typeof message.id === "number" && Number.isSafeInteger(message.id) ? String(message.id) : text(message.id, 100);
		var payload = { id: "livejasmin_" + roomId + "_" + (nativeId || sequence), type: "livejasmin",
			chatname: message.userNick, chatmessage: "", textonly: true, chatimg: "", chatbadges: [], hasDonation: "", membership: "",
			meta: { channel: channel, roomId: roomId }, mod: message.isModerator === true };
		if (nativeId) payload.meta.messageId = nativeId;
		if (message.type === "tip" || message.type === "action") {
			if (message.isSuccess === false || (message.source && message.source !== "free")) return null;
			var detail = message.type === "tip" ? message.surpInfoOBJ : message.featureData;
			if (!detail) return null;
			var amount = message.type === "tip" ? detail.amount : detail.price;
			if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
			payload.hasDonation = amount + " Credits"; payload.meta.credits = amount; payload.meta.kind = message.type;
			var interaction = detail.toyInteraction;
			payload.subtitle = text(interaction && interaction.name, 500) || text(detail.name, 500) || text(detail.tipname, 500);
			payload.chatmessage = text(detail.customText, 20000) || payload.subtitle;
			if (interaction) {
				payload.meta.kind = "toy";
				if (Number.isFinite(interaction.length)) payload.meta.durationSeconds = interaction.length;
			}
		} else {
			payload.chatmessage = text(message.msg, 20000);
			if (!nativeId || !payload.chatmessage) return null;
		}
		return payload;
	}
	if (typeof window === "undefined") {
		if (typeof module !== "undefined") module.exports = { parseMessage: parseMessage };
		return;
	}
	if (!/^(www\.)?livejasmin\.com$/.test(location.hostname)) return;
	function currentChannel() {
		var match = location.pathname.match(/^\/[a-z]{2}\/chat\/([a-z0-9_-]+)\/?$/i);
		return match ? match[1].toLowerCase() : "";
	}
	function isRoomSocket(value) {
		try {
			var url = new URL(value);
			return url.protocol === "wss:" && /^ls-entry-[a-z0-9-]+\.dditsadn\.com$/.test(url.hostname) && url.pathname === "/socket.io/";
		} catch (_) { return false; }
	}
	var pageId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	var socketNumber = 0;
	function roomReader(channel, publish) {
		var roomId = "", publicChat = false, serial = 0;
		var connection = pageId + "_" + (++socketNumber);
		return function (data) {
			if (typeof data !== "string" || data.length > 2 * 1024 * 1024 || data.slice(0, 3) !== "42[") return;
			try {
				var packet = JSON.parse(data.slice(2)), method = packet[0], context = packet[1], value = packet[2];
				if (!context || !/^[a-zA-Z0-9_-]{1,100}$/.test(context.roomId || "") || (roomId && roomId !== context.roomId)) return;
				roomId = context.roomId;
				if (method === "updateChatType") publicChat = !!value && value.chatType === "free";
				if (["privateStarted", "part", "closeConnection", "guestTimeoutChatClosed", "guestTimeoutStreamStopped"].includes(method)) publicChat = false;
				if (method === "notification" && value && value.type === "MESSAGE_DELETED") {
					var deleted = value.payload && value.payload.ids;
					if (Array.isArray(deleted) && deleted.length <= 1000) deleted.forEach(function (id) {
						if (Number.isSafeInteger(id)) id = String(id);
						if (text(id, 100)) publish({ channel: channel, deletedId: "livejasmin_" + roomId + "_" + id });
					});
				}
				if (method === "addLine" && publicChat) {
					var payload = parseMessage(value, roomId, channel, connection + "_" + (++serial));
					if (payload) publish({ channel: channel, payload: payload });
				}
			} catch (_) {}
		};
	}
	if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
		// The Chrome page reader starts before the site opens its chat socket.
		if (window.__ssnLivejasminSocket) return;
		window.__ssnLivejasminSocket = true;
		var early = [], ready = false;
		function post(packet) {
			packet.source = "ssn-livejasmin-capture";
			window.postMessage(packet, location.origin);
		}
		window.addEventListener("message", function (event) {
			if (event.source !== window || event.origin !== location.origin || !event.data || event.data.source !== "ssn-livejasmin-ready") return;
			ready = true;
			early.splice(0).forEach(post);
		});
		window.WebSocket = new Proxy(window.WebSocket, {
			construct: function (Target, args) {
				var socket = Reflect.construct(Target, args), channel = currentChannel();
				if (channel && isRoomSocket(args[0])) {
					var read = roomReader(channel, function (packet) {
						if (ready) post(packet);
						else { early.push(packet); if (early.length > 1000) early.shift(); }
					});
					socket.addEventListener("message", function (event) { read(event.data); });
				}
				return socket;
			}
		});
		return;
	}
	if (window.__ssnLivejasminSource) return;
	window.__ssnLivejasminSource = true;
	var enabled = false, seen = new Set(), ids = [];
	function forward(packet) {
		if (!enabled || !packet || packet.channel !== currentChannel()) return;
		var data = packet.payload;
		if (typeof packet.deletedId === "string" && packet.deletedId.indexOf("livejasmin_") === 0 && packet.deletedId.length <= 250) {
			if (seen.has(packet.deletedId)) {
				try { chrome.runtime.sendMessage(chrome.runtime.id, { delete: { type: "livejasmin", id: packet.deletedId } }, function () {}); } catch (_) {}
			} else {
				seen.add(packet.deletedId); ids.push(packet.deletedId);
				if (ids.length > 10000) seen.delete(ids.shift());
			}
			return;
		}
		if (!data || data.type !== "livejasmin") return;
		if (typeof data.id !== "string" || data.id.length > 250 || typeof data.chatname !== "string" || typeof data.chatmessage !== "string" || data.chatmessage.length > 20000) return;
		if (seen.has(data.id)) return;
		seen.add(data.id); ids.push(data.id);
		if (ids.length > 10000) seen.delete(ids.shift());
		data.textonly = true;
		try { chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {}); } catch (_) {}
	}
	var nativeSocket = window.ninjafy && typeof window.ninjafy.onWebSocketMessage === "function";
	if (!nativeSocket) window.addEventListener("message", function (event) {
		if (event.source === window && event.origin === location.origin && event.data && event.data.source === "ssn-livejasmin-capture") forward(event.data);
	});
	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		if (chrome.runtime.lastError) return;
		enabled = !!response && response.state !== false;
		if (nativeSocket) {
			// SSApp buffers matching events from before the source is injected.
			var rooms = new Map();
			window.ninjafy.onWebSocketMessage(function (event) {
				if (!event || !event.requestId || !isRoomSocket(event.url)) return;
				if (event.type === "open") rooms.set(event.requestId, roomReader(currentChannel(), forward));
				else if (event.type === "close") rooms.delete(event.requestId);
				else if (event.type === "message" && rooms.has(event.requestId)) rooms.get(event.requestId)(event.data);
			});
		} else window.postMessage({ source: "ssn-livejasmin-ready" }, location.origin);
	});
	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request === "getSource") { sendResponse("livejasmin"); return; }
		if (request === "focusChat") {
			var input = document.querySelector('[data-testid="chatMemberInput"], input.mc_chat__input');
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
