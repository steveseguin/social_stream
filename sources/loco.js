(function () {
	if (!/(^|\.)loco\.(com|gg)$/.test(location.hostname)) return;
	function watchChatResponses() {
		if (window.__ssnLocoHistory || !window.Response) return;
		window.__ssnLocoHistory = true;
		var endpoint = /^https:\/\/api\.loco\.com\/chat\/v2\/streams\/([^/?]+)\/(history|chat|replaychat)\/?(?:\?|$)/;
		var history = new Map();
		var lateStreams = new Map();
		// Older SSApp injects after navigation. If history was already read,
		// use IDs from the site's live batches to distinguish late-rendered rows.
		performance.getEntriesByType("resource").forEach(function (entry) {
			var match = endpoint.exec(entry.name);
			if (match && match[2] === "history") lateStreams.set(match[1], new Set());
		});
		var json = Response.prototype.json;
		Response.prototype.json = function () {
			var result = json.apply(this, arguments);
			var match = endpoint.exec(this.url);
			if (!match || (match[2] !== "history" && !lateStreams.has(match[1]))) return result;
			return result.then(function (data) {
				if (!data || !Array.isArray(data.chats)) return data;
				var ids = match[2] === "history" ? new Set() : lateStreams.get(match[1]);
				data.chats.forEach(function (chat) {
					if (chat && chat.id) ids.add(String(chat.id));
				});
				if (match[2] === "history") {
					history.set(match[1], ids);
					if (history.size > 8) history.delete(history.keys().next().value);
				} else {
					while (ids.size > 5000) ids.delete(ids.values().next().value);
					document.dispatchEvent(new Event("ssn-loco-live-batch"));
				}
				return data;
			});
		};
		document.addEventListener("ssn-loco-history-check", function (event) {
			var row = event.target, list = row.closest && row.closest(".chat-elements-list");
			if (!list) return;
			var stream = list.id.replace(/^chat-(?:container|popup)-/, "");
			var id = row.getAttribute("data-chat-message-id");
			var known = history.get(stream), live = lateStreams.get(stream);
			if ((known && known.has(id)) || (live && !live.has(id))) event.preventDefault();
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
