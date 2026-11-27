(function () {
	function watchChatResponses() {
		if (!/(^|\.)loco\.(com|gg)$/.test(location.hostname)) return;
		if (window.__ssnLocoHistory || !window.Response) return;
		window.__ssnLocoHistory = true;
		var endpoint = /^https:\/\/api\.loco\.com\/chat\/v2\/streams\/([^/?]+)\/(history|chat|replaychat)\/?(?:\?|$)/;
		var streams = new Map();
		var injectedAt = performance.now();
		function streamState(id) {
			if (!streams.has(id)) {
				streams.set(id, { history: null, live: new Set(), late: false });
				if (streams.size > 8) streams.delete(streams.keys().next().value);
			}
			return streams.get(id);
		}
		function missedHistory(id, state) {
			if (!window.ninjafy || state.history || state.late) return state.late;
			// A history request can start before desktop injection and finish just
			// before its rows render. Check the completed request at that point.
			state.late = performance.getEntriesByType("resource").some(function (entry) {
				if (entry.startTime > injectedAt) return false;
				var match = endpoint.exec(entry.name);
				return match && match[1] === id && match[2] === "history";
			});
			return state.late;
		}
		var json = Response.prototype.json;
		Response.prototype.json = function () {
			var result = json.apply(this, arguments);
			var match = endpoint.exec(this.url);
			if (!match || (match[2] !== "history" && !window.ninjafy)) return result;
			var state = streamState(match[1]);
			return result.then(function (data) {
				if (!data || !Array.isArray(data.chats)) return data;
				if (match[2] === "history") {
					state.history = new Set();
					data.chats.forEach(function (chat) { if (chat && chat.id) state.history.add(String(chat.id)); });
				} else if (data.chats.length && (!state.history || state.late)) {
					data.chats.forEach(function (chat) { if (chat && chat.id) state.live.add(String(chat.id)); });
					while (state.live.size > 5000) state.live.delete(state.live.values().next().value);
					if (missedHistory(match[1], state)) document.dispatchEvent(new Event("ssn-loco-live-batch"));
				}
				return data;
			});
		};
		document.addEventListener("ssn-loco-history-check", function (event) {
			var row = event.target, list = row.closest && row.closest(".chat-elements-list");
			if (!list) return;
			var stream = list.id.replace(/^chat-(?:container|popup)-/, "");
			var id = row.getAttribute("data-chat-message-id"), state = streamState(stream);
			if ((state.history && state.history.has(id)) || (!state.live.has(id) && missedHistory(stream, state))) event.preventDefault();
		});
	}
	if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
		watchChatResponses();
		return;
	}
	if (window.ninjafy) watchChatResponses();
	if (window.__ssnLocoCapture) return;
	window.__ssnLocoCapture = true;

	var settings = {};
	var list;
	var observer;
	var streamKey;
	var seen = new Map();
	var legacyRows = new WeakSet();
	var rowSelector = "[data-chat-message-id], [data-chat-variant], [data-test-id^='chat-msg-']";

	function escapeHtml(text) {
		if (settings.textonlymode) return text;
		return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	function messageContent(node) {
		if (node.nodeType === 3) return escapeHtml(node.textContent);
		if (node.nodeName === "IMG") {
			if (settings.textonlymode) return node.alt || "";
			if (node.src) return '<img src="' + escapeHtml(node.src) + '" alt="' + escapeHtml(node.alt || "") + '">';
		}
		return Array.from(node.childNodes, messageContent).join("");
	}

	function send(request) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, request, function () {});
		} catch (e) {}
	}

	function remember(id, state) {
		seen.set(id, state);
		if (seen.size > 5000) seen.delete(seen.keys().next().value);
	}

	function capture(row, initial) {
		var id = row.getAttribute("data-chat-message-id");
		if (!id) return;
		var messageId = (list.id.replace(/^chat-(?:container|popup)-/, "") || location.pathname) + ":" + id;
		var variant = row.getAttribute("data-chat-variant");
		if (variant === "deleted") {
			if (seen.get(id) === "sent") {
				send({ delete: { type: "loco", meta: { messageId: messageId } } });
			}
			remember(id, "deleted");
			return;
		}
		if (seen.has(id)) return;
		if (initial) {
			remember(id, "history");
			return;
		}
		if (!row.dispatchEvent(new Event("ssn-loco-history-check", { bubbles: true, cancelable: true }))) return;
		var name = row.querySelector(".loco-chat-message-user-name");
		if (!name || !name.textContent.trim()) return;
		var body = row.querySelector(".loco-chat-message-text");
		var message = body && body.contains(name) && name.parentElement.nextElementSibling;
		var sticker = null;
		if (variant === "sticker-gold" || variant === "sticker-diamond") {
			sticker = row.querySelector("button:not([data-test-id]) img");
		}
		var text = message ? messageContent(message).trim() : "";
		if (!text && !(sticker && sticker.src)) return;
		var avatar = row.querySelector('[data-test-id="loco-chat-user-avatar"] img');
		remember(id, "sent");
		sendChat(name.textContent.trim(), text, avatar, sticker, messageId);
	}

	function sendChat(name, text, avatar, sticker, id) {
		var data = {
			chatname: name, chatmessage: text, chatimg: avatar && !avatar.src.startsWith("data:") ? avatar.src : "",
			contentimg: sticker ? sticker.src : "", chatbadges: [], nameColor: "", hasDonation: "", membership: "",
			textonly: !!settings.textonlymode, type: "loco"
		};
		if (id) data.meta = { messageId: id };
		send({ message: data });
	}

	// Older dashboard rows have an avatar beside the author and message.
	async function captureLegacy(row) {
		if (legacyRows.has(row)) return;
		var avatar = row.querySelector("[alt='avatar']");
		var fields = avatar && avatar.parentNode.nextElementSibling;
		var name = row.querySelector("div:nth-of-type(2) > div:nth-of-type(1) > span:nth-of-type(1)") ||
			row.querySelector("div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1)") ||
			(fields && fields.firstChild && fields.firstChild.firstChild);
		if (!name || !name.textContent.trim()) return;
		var body = row.querySelector("span[class]:not([role])") || (fields && fields.childNodes[1]);
		var text = body && messageContent(body).trim();
		var sticker = row.querySelector("button > img[src][alt='stickers']");
		if ((!text && !sticker) || (text && text.startsWith("[Message "))) return;
		legacyRows.add(row);
		var chatname = name.textContent.trim();
		var originalStream = streamKey;
		avatar = avatar || row.querySelector("div:nth-of-type(1) > span > img[src]");
		for (var delay of [100, 200, 700]) {
			if (!avatar || !avatar.src.startsWith("data:")) break;
			await new Promise(function (resolve) { setTimeout(resolve, delay); });
			avatar = row.querySelector("[alt='avatar'], div:nth-of-type(1) > span > img[src]");
		}
		if (originalStream === streamKey) sendChat(chatname, text || "", avatar, sticker);
	}

	function scan(node, initial) {
		if (node.nodeType !== 1) node = node.parentElement;
		if (!node || !list.contains(node)) return;
		var row = node.closest(rowSelector);
		if (row) {
			capture(row, initial);
			return;
		}
		var rows = node.querySelectorAll(rowSelector);
		if (rows.length) {
			rows.forEach(function (item) { capture(item, initial); });
		} else if (node !== list) {
			while (node.parentElement !== list) node = node.parentElement;
			if (initial) legacyRows.add(node);
			else captureLegacy(node);
		}
	}

	function attach() {
		var target = /^\/(stream|streamers|chat|dashboard)\//.test(location.pathname) ?
			document.querySelector(".chat-elements-list") : null;
		var key = target && location.pathname + "/" + target.id;
		if (target === list && (!target || key === streamKey)) return;
		if (observer) observer.disconnect();
		list = target;
		if (!list) return;
		var initial = key !== streamKey;
		if (initial) seen.clear();
		streamKey = key;
		Array.from(list.children).forEach(function (node) { scan(node, initial); });
		observer = new MutationObserver(function (mutations) {
			if (location.pathname + "/" + list.id !== streamKey) {
				attach();
				return;
			}
			mutations.forEach(function (change) {
				if (change.type === "childList") {
					change.addedNodes.forEach(function (node) { scan(node, false); });
				} else {
					scan(change.target, false);
				}
			});
		});
		observer.observe(list, { childList: true, subtree: true, characterData: true, attributes: true,
			attributeFilter: ["id", "data-chat-message-id", "data-chat-variant", "src"] });
	}

	chrome.runtime.onMessage.addListener(function (request, sender, respond) {
		if (request === "getSource") return respond("loco");
		if (request === "focusChat") {
			var input = document.querySelector('input[placeholder][maxlength="200"]');
			if (input) input.focus();
			return respond(!!input);
		}
		if (request && request.settings) {
			settings = request.settings;
			return respond(true);
		}
		respond(false);
	});
	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		if (!chrome.runtime.lastError && response && response.settings) settings = response.settings;
	});

	document.addEventListener("ssn-loco-live-batch", function () {
		if (list) list.querySelectorAll("[data-chat-message-id]").forEach(function (row) { capture(row, false); });
	});
	attach();
	setInterval(attach, 500);

	// Keep the source active when the chat tab is hidden.
	try {
		var receiveChannelCallback = function(event){
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function(e){};;
			remoteConnection.datachannel.onopen = function(e){};;
			remoteConnection.datachannel.onclose = function(e){};;
			setInterval(function(){
				if (document.hidden){ // only poke ourselves if tab is hidden, to reduce cpu a tiny bit.
					remoteConnection.datachannel.send("KEEPALIVE")
				}
			}, 800);
		}
		var errorHandle = function(e){}
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = (e) => !e.candidate ||	remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = (e) => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function(e){localConnection.sendChannel.send("CONNECTED");};
		localConnection.sendChannel.onclose =  function(e){};
		localConnection.sendChannel.onmessage = function(e){};
		localConnection.createOffer()
			.then((offer) => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then((answer) => remoteConnection.setLocalDescription(answer))
			.then(() =>	{
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICk ENABLED");
			})
			.catch(errorHandle);
	} catch(e){
		console.log(e);
	}

})();
