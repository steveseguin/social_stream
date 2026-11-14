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
	if (!/^(www\.)?livejasmin\.com$/.test(location.hostname) || window.__ssnLivejasminSocket) return;
	window.__ssnLivejasminSocket = true;
	var NativeSocket = window.WebSocket, post = window.postMessage.bind(window);
	var ready = false, pending = [], socketNumber = 0;
	var pageId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	function publish(channel, payload, deletedId) {
		var packet = { source: "ssn-livejasmin-capture", channel: channel, payload: payload, deletedId: deletedId };
		if (ready) post(packet, location.origin);
		else { pending.push(packet); if (pending.length > 1000) pending.shift(); }
	}
	window.addEventListener("message", function (event) {
		if (event.source !== window || event.origin !== location.origin || !event.data || event.data.source !== "ssn-livejasmin-ready") return;
		ready = true; pending.splice(0).forEach(function (packet) { post(packet, location.origin); });
	});
	window.WebSocket = new Proxy(NativeSocket, {
		construct: function (Target, args) {
			var socket = Reflect.construct(Target, args), url;
			try { url = new URL(args[0]); } catch (_) { return socket; }
			if (url.protocol !== "wss:" || !/^ls-entry-[a-z0-9-]+\.dditsadn\.com$/.test(url.hostname) || url.pathname !== "/socket.io/") return socket;
			var match = location.pathname.match(/^\/[a-z]{2}\/chat\/([a-z0-9_-]+)\/?$/i);
			if (!match) return socket;
			var channel = match[1].toLowerCase(), roomId = "", publicChat = false, serial = 0;
			var connection = pageId + "_" + (++socketNumber);
			socket.addEventListener("message", function (event) {
				if (typeof event.data !== "string" || event.data.length > 2 * 1024 * 1024 || event.data.slice(0, 3) !== "42[") return;
				try {
					var packet = JSON.parse(event.data.slice(2)), method = packet[0], context = packet[1], value = packet[2];
					if (!context || !/^[a-zA-Z0-9_-]{1,100}$/.test(context.roomId || "")) return;
					if (roomId && roomId !== context.roomId) return;
					roomId = context.roomId;
					if (method === "updateChatType") publicChat = !!value && value.chatType === "free";
					if (["privateStarted", "part", "closeConnection", "guestTimeoutChatClosed", "guestTimeoutStreamStopped"].includes(method)) publicChat = false;
					if (method === "notification" && value && value.type === "MESSAGE_DELETED") {
						var deleted = value.payload && value.payload.ids;
						if (Array.isArray(deleted) && deleted.length <= 1000) deleted.forEach(function (id) {
							if (Number.isSafeInteger(id)) id = String(id);
							if (text(id, 100)) publish(channel, null, "livejasmin_" + roomId + "_" + id);
						});
					}
					// chatHistory and startSurprise are intentionally not forwarded. addLine is the chat's single delivery path.
					if (method === "addLine" && publicChat) {
						var payload = parseMessage(value, roomId, channel, connection + "_" + (++serial));
						if (payload) publish(channel, payload);
					}
				} catch (_) {}
			});
			socket.addEventListener("close", function () { publicChat = false; });
			return socket;
		}
	});
})();
