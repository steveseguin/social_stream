(function () {
	var moderationHost = /(^|\.)cam4\.com$/.test(location.hostname);
	function room() { return location.pathname.toLowerCase().replace(/\/$/, ""); }
	function startModerationReader() {
		if (!moderationHost || window.__ssnCamModerationReader) return;
		window.__ssnCamModerationReader = true;
		var attached, waiting = [];
		var cam4Require;
		function publish(data) {
			data.type = "cam4";
			if (!data.room) data.room = room();
			if (waiting) {
				waiting.push(data);
				if (waiting.length > 5000) waiting.shift();
			} else document.dispatchEvent(new CustomEvent("ssn-cam-moderation", { detail: JSON.stringify(data) }));
		}
		document.addEventListener("ssn-cam4-moderation-ready", function () {
			var early = waiting;
			waiting = null;
			if (early) early.forEach(publish);
		});
		function walk(row, visit) {
			if (!row) return;
			var key = Object.keys(row).find(function (key) { return key.indexOf("__reactFiber") === 0; });
			var fiber = key && row[key];
			for (var depth = 0; fiber && depth < 180; depth++, fiber = fiber.return) {
				if (visit(fiber.memoizedProps || {})) return;
			}
		}
		document.addEventListener("ssn-read-cam4-id", function (event) {
			walk(event.target, function (props) {
				var message = props.value && props.value.message;
				if (!message || message.type !== 1 || !message.timestamp) return false;
				event.target.setAttribute("data-ssn-cam4-id", String(message.timestamp));
				return true;
			});
		});
		function connectCam4() {
			if (attached || !document.querySelector("[class*='ChatMessageTypes__msgPosition']")) return;
			var chunks = window.webpackChunk;
			var moduleId = "./javascripts/stores/ChatStore.js";
			// A rendered chat row means this store is already initialized. Never load another bundle.
			if (!Array.isArray(chunks) || !chunks.some(function (chunk) { return chunk && chunk[1] && chunk[1][moduleId]; })) return;
			if (!cam4Require) chunks.push([["ssn-cam4-moderation-reader"], {}, function (require) { cam4Require = require; }]);
			if (!cam4Require) return;
			var store = cam4Require(moduleId).default;
			if (!store || typeof store._handleMainChatLight !== "function") return;
			var original = store._handleMainChatLight;
			store._handleMainChatLight = function (event) {
				try {
					var value = event && event.snapshot && event.snapshot.val();
					if (value && Object.prototype.hasOwnProperty.call(value, "delete") && value.tm && event.roomName) {
						publish({ room: "/" + String(event.roomName).toLowerCase(), ids: [String(value.tm)] });
					}
				} catch (_) { }
				return original.apply(this, arguments);
			};
			attached = store;
		}
		function attach() {
			try { connectCam4(); } catch (_) {}
		}
		attach();
		setInterval(attach, 2000);
	}
	if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
		startModerationReader();
		return;
	}
	if (window.__ssnCam4ChatSource) return;
	window.__ssnCam4ChatSource = true;

	var deleted = new Set(), rowIds = new WeakMap();
	var serial = 0, instance = Date.now().toString(36) + Math.random().toString(36).slice(2);
	function trim(collection) {
		if (collection.size > 5000) collection.delete(collection.keys().next().value);
	}
	function removeMessage(id) {
		if (deleted.has(id)) return;
		deleted.add(id);
		trim(deleted);
		try { chrome.runtime.sendMessage(chrome.runtime.id, { delete: { type: "cam4", meta: { messageId: id } } }, function () {}); } catch (_) {}
	}
	function trackModeration(row, data) {
		if (!moderationHost) return true;
		var element = row.querySelector("[class*='ChatMessageTypes__msgPosition']") || row;
		element.dispatchEvent(new CustomEvent("ssn-read-cam4-id", { bubbles: true }));
		var native = element.getAttribute("data-ssn-cam4-id");
		var id = native ? room() + ":" + native : rowIds.get(row);
		if (!id) {
			id = room() + ":ssn:" + instance + ":" + (++serial);
			rowIds.set(row, id);
		}
		if (deleted.has(id)) return false;
		data.meta = data.meta || {};
		data.meta.messageId = id;
		return true;
	}
	if (moderationHost) document.addEventListener("ssn-cam-moderation", function (event) {
		try {
			var data = JSON.parse(event.detail);
			if (!data || data.type !== "cam4" || data.room !== room()) return;
			if (Array.isArray(data.ids)) data.ids.slice(0, 5000).forEach(function (id) {
				if (/^\d+$/.test(String(id))) removeMessage(data.room + ":" + id);
			});
		} catch (_) {}
	});
	if (window.ninjafy) startModerationReader();
	if (moderationHost) document.dispatchEvent(new Event("ssn-cam4-moderation-ready"));


	var settings = {};
	var isExtensionOn = true;

	function escapeHtml(unsafe) {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;") || "";
	}

	function getAllContentNodes(element) {
		if (!element) return "";
		if (element.nodeType === 3) {
			return settings.textonlymode ? element.textContent : escapeHtml(element.textContent);
		}
		if (element.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|BUTTON)$/.test(element.tagName)) return "";
		if (element.tagName === "IMG") {
			var alt = element.getAttribute("alt") || element.getAttribute("data-token") || "";
			if (settings.textonlymode) return alt;
			var src = element.src || "";
			return /^(https?:|data:image\/|blob:)/i.test(src) ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		if (element.tagName === "BR") return settings.textonlymode ? "\n" : "<br>";
		var text = "";
		for (var i = 0; i < element.childNodes.length; i++) {
			text += getAllContentNodes(element.childNodes[i]);
		}
		return text;
	}

	function processMessage(ele) {
		if (!ele || !ele.isConnected) return;
		if (ele.skip) return;
		if (ele.nodeType !== 1) return;

		if (!isExtensionOn) { ele.skip = true; return; }

		var name = "";
		var nameColor = "";
		var msg = "";
		var hasDonation = "";
		var chatimg = "";
		var badges = [];

		// check if this is a tip notification
		var tipNotif = ele.querySelector("[class*='ChatNotificationsTypes__goldNotifWrapperDesktop'], [class*='ChatNotificationsTypes__silverNotifWrapperDesktop'], [class*='ChatNotificationsTypes__notifWrapper'], [class*='newTippingMessage__container']");
		if (tipNotif || (ele.className && ele.className.match && ele.className.match(/ChatNotificationsTypes/))) {
			try {
				var notifText = ele.querySelector("[class*='ChatNotificationsTypes__basicNotifText'], [class*='newTippingMessage__text']");
				if (notifText) {
					var strongs = notifText.querySelectorAll("strong");
					if (strongs.length > 0) {
						name = strongs[0].textContent.trim();
					}
					var amountEles = notifText.querySelectorAll("[class*='amountOfTokensBold'], [class*='amountOfTokensAnim']");
					if (amountEles.length > 0) {
						hasDonation = amountEles[0].textContent.trim() + " tokens";
					} else if (strongs.length > 1) {
						var amountMatch = strongs[1].textContent.trim().match(/^(\d+)(?:\s+Tokens?)?$/i);
						if (amountMatch) hasDonation = amountMatch[1] + " tokens";
					}
				}
			} catch (e) {
			}

			if (name && hasDonation) {
				ele.skip = true;
				var data = {};
				data.chatname = name;
				data.chatbadges = badges;
				data.nameColor = nameColor;
				data.chatmessage = "";
				data.chatimg = chatimg;
				data.hasDonation = hasDonation;
				data.membership = "";
				// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
				data.textonly = settings.textonlymode || false;
				data.type = "cam4";
				if (!trackModeration(ele, data)) return;
				pushMessage(data);
			}
			return;
		}

		// regular chat message
		var msgWrapper = ele.querySelector("[class*='ChatMessageTypes__msgPosition']");
		var target = msgWrapper || ele;
		if (!target.className || !target.className.match || !target.className.match(/ChatMessageTypes/)) {
			if (!msgWrapper) return;
		}

		try {
			var senderEle = target.querySelector("[class*='ChatMessageTypes__msgSender']");
			if (!senderEle) return;
			name = senderEle.textContent.trim();
			name = name.replace(/:$/, "").trim();
		} catch (e) {
			return;
		}

		if (!name) return;

		try {
			var contentEle = target.querySelector("[class*='ChatMessageTypes__msgDesktopContent'], [class*='ChatMessageTypes__msgContentDesktop'], [class*='ChatMessageTypes__msgContent']");
			if (contentEle) {
				msg = getAllContentNodes(contentEle).trim();
			}
		} catch (e) {
		}

		try {
			var avatarEle = target.querySelector("[class*='ChatMessageTypes__avatar'] img, [class*='index__image']");
			if (avatarEle && avatarEle.src) {
				chatimg = avatarEle.src + "";
			}
		} catch (e) {
		}

		if (!msg) return;

		ele.skip = true;

		var data = {};
		data.chatname = name;
		data.chatbadges = badges;
		data.nameColor = nameColor;
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = hasDonation;
		data.membership = "";
		// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
		data.textonly = settings.textonlymode || false;
		data.type = "cam4";
		if (!trackModeration(ele, data)) return;

		pushMessage(data);
	}

	var lastViewerCount = null;
	var viewerRoom = location.pathname;
	function checkViewers() {
		if (viewerRoom !== location.pathname) {
			viewerRoom = location.pathname;
			lastViewerCount = null;
		}
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			lastViewerCount = null;
			return;
		}
		var element = document.querySelector("[id=\"chat-tabs-USER_LIST_TAB\"] [class*=\"ChatTabs__tabLabel\"], [class*=\"ChatTabs__usersTabWrapper\"] [class*=\"ChatTabs__tabLabel\"]");
		if (!element) return;
		var match = element.textContent.trim().match(/^(\d+(?:[,\s]\d{3})*(?:\.\d+)?)([KM])?(?:\s|$)/i);
		if (!match) return;
		var count = Number(match[1].replace(/[,\s]/g, ""));
		if (match[2]) count *= match[2].toUpperCase() === "K" ? 1000 : 1000000;
		if (!isFinite(count) || count < 0 || Math.floor(count) !== count || count === lastViewerCount) return;
		lastViewerCount = count;
		pushMessage({ type: "cam4", event: "viewer_update", meta: count });
	}
	setInterval(checkViewers, 10000);

	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function (e) { });
		} catch (e) {
		}
	}

	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function (response) {
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) { return; }
		response = response || {};
		if ("settings" in response) {
			settings = response.settings;
		}
		if ("state" in response) { isExtensionOn = response.state; }
		checkViewers();
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try {
				if ("getSource" == request) { sendResponse("cam4"); return; }
				if ("focusChat" == request) {
					var inputs = document.querySelectorAll('input[id*="ChatInputMobileV2_mainChatInput"], input[id*="chatInput"]');
					for (var i = 0; i < inputs.length; i++) {
						var input = inputs[i];
						if (input.disabled || input.readOnly || !input.getClientRects().length) continue;
						input.focus();
						if (document.activeElement === input) { sendResponse(true); return; }
					}
					sendResponse(false);
					return;
				}
				if (request && typeof request === "object") {
					if ("state" in request) { isExtensionOn = request.state; }
					if ("settings" in request) { settings = request.settings || {}; }
					lastViewerCount = null;
					checkViewers();
					sendResponse(true);
					return;
				}
			} catch (e) { }
			sendResponse(false);
		}
	);

	function onElementInserted(target) {
		function queueMessage(node) {
			if (!node) return;
			var row = node.nodeType === 1 ? node : node.parentElement;
			if (!row || row === target || !target.contains(row)) return;
			while (row.parentElement !== target) {
				row = row.parentElement;
			}
			if (row.skip || row.ssnPending) return;
			if (!isExtensionOn) { row.skip = true; return; }
			row.ssnPending = true;
			setTimeout(function () {
				row.ssnPending = false;
				processMessage(row);
			}, 200);
		}

		var onMutationsObserved = function (mutations) {
			mutations.forEach(function (mutation) {
				queueMessage(mutation.target);
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							queueMessage(mutation.addedNodes[i]);
						} catch (e) { }
					}
				}
			});
		};

		var config = { childList: true, subtree: true, characterData: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

	console.log("Social Stream injected");

	var checkReady = setInterval(function () {
		var chatContainer = document.querySelector("[class*='ChatMobileMessages__msgHolder']");
		if (chatContainer) {
			if (!chatContainer.dataset.ssnMarked) {
				chatContainer.dataset.ssnMarked = "true";
				console.log("Social Stream - CAM4 chat connected");

				var existing = chatContainer.children;
				for (var i = 0; i < existing.length; i++) {
					existing[i].skip = true;
				}

				onElementInserted(chatContainer);
			}
		}
	}, 2000);

	///////// loopback webrtc trick to prevent background throttling
	try {
		var receiveChannelCallback = function (event) {
			remoteConnection.datachannel = event.channel;
			remoteConnection.datachannel.onmessage = function (e) { };
			remoteConnection.datachannel.onopen = function (e) { };
			remoteConnection.datachannel.onclose = function (e) { };
			setInterval(function () {
				if (document.hidden) {
					remoteConnection.datachannel.send("KEEPALIVE");
				}
			}, 800);
		};
		var errorHandle = function (e) { };
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		localConnection.onicecandidate = (e) => !e.candidate || remoteConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.onicecandidate = (e) => !e.candidate || localConnection.addIceCandidate(e.candidate).catch(errorHandle);
		remoteConnection.ondatachannel = receiveChannelCallback;
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.sendChannel.onopen = function (e) { localConnection.sendChannel.send("CONNECTED"); };
		localConnection.sendChannel.onclose = function (e) { };
		localConnection.sendChannel.onmessage = function (e) { };
		localConnection.createOffer()
			.then((offer) => localConnection.setLocalDescription(offer))
			.then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
			.then(() => remoteConnection.createAnswer())
			.then((answer) => remoteConnection.setLocalDescription(answer))
			.then(() => {
				localConnection.setRemoteDescription(remoteConnection.localDescription);
				console.log("KEEP ALIVE TRICK ENABLED");
			})
			.catch(errorHandle);
	} catch (e) {
		console.log(e);
	}

})();
