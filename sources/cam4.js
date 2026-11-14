(function () {

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
