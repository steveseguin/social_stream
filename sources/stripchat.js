(function () {

	var settings = {};
	var isExtensionOn = true;
	var seenMessageKeys = [];
	var seenMessageLookup = {};
	var stripchatObserver = null;
	var stripchatScanInterval = null;
	var currentChatContainer = null;
	var hasInitializedChat = false;
	var highestMessageId = 0;
	var currentRoom = location.pathname;
	var fallbackMessageIds = new WeakMap();
	var nextFallbackMessageId = 0;

	function escapeHtml(unsafe) {
		unsafe = unsafe || "";
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;") || "";
	}

	function hasClass(ele, className) {
		if (!ele || !ele.classList) return false;
		if (ele.classList.contains(className)) return true;
		return (ele.className || "").toString().indexOf(className) !== -1;
	}

	function getNodeElement(node) {
		if (!node) return null;
		if (node.nodeType === 1) return node;
		return node.parentElement || null;
	}

	function isStripchatMessage(ele) {
		if (!ele || ele.nodeType !== 1) return false;
		if (hasClass(ele, "message-base")) return true;
		return !!(ele.dataset && ele.dataset.messageId && hasClass(ele, "message"));
	}

	function getMessageElement(node) {
		var ele = getNodeElement(node);
		if (!ele) return null;
		if (isStripchatMessage(ele)) return ele;
		if (ele.closest) {
			return ele.closest(".message-base, [data-message-id]");
		}
		return null;
	}

	function getMessageKey(ele) {
		if (!ele || ele.nodeType !== 1) return "";
		if (ele.dataset && ele.dataset.messageId) {
			return location.pathname + ":id:" + ele.dataset.messageId;
		}
		if (!fallbackMessageIds.has(ele)) fallbackMessageIds.set(ele, ++nextFallbackMessageId);
		return "row:" + fallbackMessageIds.get(ele);
	}

	function hasSeenMessageKey(key) {
		return !!(key && seenMessageLookup[key]);
	}

	function getNumericMessageId(ele) {
		if (!ele || !ele.dataset || !ele.dataset.messageId) return 0;
		var parsed = parseInt(ele.dataset.messageId, 10);
		return isNaN(parsed) ? 0 : parsed;
	}

	function updateHighestMessageId(ele) {
		var numericId = getNumericMessageId(ele);
		if (numericId > highestMessageId) {
			highestMessageId = numericId;
		}
	}

	function rememberMessageKey(key) {
		if (!key || seenMessageLookup[key]) return;
		seenMessageLookup[key] = true;
		seenMessageKeys.push(key);
		if (seenMessageKeys.length > 1500) {
			var oldestKey = seenMessageKeys.shift();
			if (oldestKey) {
				delete seenMessageLookup[oldestKey];
			}
		}
	}

	function removeElements(root, selector) {
		if (!root || !root.querySelectorAll) return;
		var nodes = root.querySelectorAll(selector);
		for (var i = 0; i < nodes.length; i++) {
			nodes[i].remove();
		}
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

	function resetRoomIfChanged() {
		if (currentRoom === location.pathname) return;
		currentRoom = location.pathname;
		seenMessageKeys = [];
		seenMessageLookup = {};
		highestMessageId = 0;
		hasInitializedChat = false;
		currentChatContainer = null;
	}

	function processMessage(ele) {
		if (!ele || !ele.isConnected) return;
		if (ele.nodeType !== 1) return;
		ele = getMessageElement(ele);
		if (!ele || !isStripchatMessage(ele)) return;
		resetRoomIfChanged();

		var messageKey = getMessageKey(ele);
		if (hasSeenMessageKey(messageKey)) return;
		if (!isExtensionOn) { rememberMessageKey(messageKey); updateHighestMessageId(ele); return; }

		// skip lovense buzz notifications, goal updates, and action messages
		var className = (ele.className || "").toString();
		if (hasClass(ele, "m-bg-default-v2") || className.indexOf("LovenseTipMessage") !== -1) { rememberMessageKey(messageKey); updateHighestMessageId(ele); return; }
		if (hasClass(ele, "m-bg-action") || className.indexOf("ActionMessage") !== -1) { rememberMessageKey(messageKey); updateHighestMessageId(ele); return; }

		var name = "";
		var nameColor = "";
		var msg = "";
		var hasDonation = "";
		var chatimg = "";
		var badges = [];
		var isTip = hasClass(ele, "m-bg-tip-v2") || className.indexOf("TipMessage") !== -1;
		var isGoal = hasClass(ele, "m-bg-goal-v2") || hasClass(ele, "m-bg-goal-v2-reached") || className.indexOf("GoalUpdatedMessage") !== -1;

		if (isGoal) { rememberMessageKey(messageKey); updateHighestMessageId(ele); return; }

		try {
			var usernameEle = ele.querySelector(".user-levels-username-text");
			if (!usernameEle) {
				// fallback for model welcome messages
				usernameEle = ele.querySelector(".user-levels-username-chat-owner");
			}
			if (!usernameEle) return;
			name = usernameEle.textContent.trim();
		} catch (e) {
			return;
		}

		if (!name) return;

		if (isTip) {
			try {
				var amountEle = ele.querySelector("[class*='amountHighlight'], strong");
				if (amountEle) {
					hasDonation = amountEle.textContent.trim();
				}
				if (!hasDonation) {
					var tipMatch = (ele.textContent || "").match(/tipped\s+([0-9.,]+\s*(?:tk|tokens?))/i);
					if (tipMatch) {
						hasDonation = tipMatch[1].trim();
					}
				}
				var commentEle = ele.querySelector("[class*='commentBody']");
				if (commentEle) {
					msg = getAllContentNodes(commentEle).trim();
				}
			} catch (e) {
			}
		} else {
			try {
				var contentWrapper = ele.querySelector("[class*='contentWithControls']");
				if (contentWrapper) {
					var contentInner = contentWrapper.querySelector("div") || contentWrapper;
					var clone = contentInner.cloneNode(true);
					removeElements(clone, ".message-username, .username-icons, .username-status-icons, [class*='MessageControls'], button, svg, [class*='showMoreBtn']");
					msg = getAllContentNodes(clone).trim();
				} else {
					var bodyWrapper = ele.querySelector(".message-body");
					if (bodyWrapper) {
						var bodyClone = bodyWrapper.cloneNode(true);
						removeElements(bodyClone, ".message-username, .username-icons, .username-status-icons, [class*='MessageControls'], button, svg, [class*='showMoreBtn']");
						msg = getAllContentNodes(bodyClone).trim();
					}
				}
			} catch (e) {
			}
		}

		if (!msg && !hasDonation) return;

		rememberMessageKey(messageKey);
		updateHighestMessageId(ele);

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
		data.type = "stripchat";
		if (ele.dataset && ele.dataset.messageId) data.meta = { messageId: ele.dataset.messageId };

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
		var element = document.querySelector(".player-viewers-count");
		if (!element) return;
		var match = element.textContent.trim().match(/^(\d+(?:[,\s]\d{3})*(?:\.\d+)?)([KM])?(?:\s|$)/i);
		if (!match) return;
		var count = Number(match[1].replace(/[,\s]/g, ""));
		if (match[2]) count *= match[2].toUpperCase() === "K" ? 1000 : 1000000;
		if (!isFinite(count) || count < 0 || Math.floor(count) !== count || count === lastViewerCount) return;
		lastViewerCount = count;
		pushMessage({ type: "stripchat", event: "viewer_update", meta: count });
	}
	setInterval(checkViewers, 10000);

	function pushMessage(data) {
		try {
			sendToBackground({ "message": data }, function () { });
		} catch (e) {
		}
	}

	function sendToBackground(payload, callback) {
		function deliverWrapped() {
			try {
				chrome.runtime.sendMessage(chrome.runtime.id, { type: "toBackground", data: payload }, function (response) {
					if (callback) {
						callback(response);
					}
				});
			} catch (e) {
				if (callback) {
					callback();
				}
			}
		}

		try {
			chrome.runtime.sendMessage(chrome.runtime.id, payload, function (response) {
				var runtimeError = null;
				try {
					runtimeError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
				} catch (e) {
				}
				if (!runtimeError && typeof response !== "undefined") {
					if (callback) {
						callback(response);
					}
					return;
				}
				deliverWrapped();
			});
		} catch (e) {
			deliverWrapped();
		}
	}

	sendToBackground({ "getSettings": true }, function (response) {
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
				if ("getSource" == request) { sendResponse("stripchat"); return; }
				if ("focusChat" == request) {
					var inputs = document.querySelectorAll('input[class*="ChatInput__input"], textarea[class*="ChatInput__input"]');
					for (var i = 0; i < inputs.length; i++) {
						var input = inputs[i];
						if (input.disabled || input.readOnly || !input.getClientRects().length) continue;
						input.focus();
						if (document.activeElement === input) {
							sendResponse(true);
							return;
						}
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
		function queueMessageNode(node) {
			var messageNode = getMessageElement(node);
			if (messageNode) {
				if (!isExtensionOn) { processMessage(messageNode); return; }
				setTimeout(function (n) {
					processMessage(n);
				}, 100, messageNode);
				return;
			}

			if (!node || node.nodeType !== 1) return;
			if (!node.querySelectorAll) return;
			var nestedMessages = node.querySelectorAll(".message-base, [data-message-id]");
			for (var j = 0; j < nestedMessages.length; j++) {
				setTimeout(function (n) {
					processMessage(n);
				}, 100, nestedMessages[j]);
			}
		}

		var onMutationsObserved = function (mutations) {
			mutations.forEach(function (mutation) {
				if (mutation.addedNodes && mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							queueMessageNode(mutation.addedNodes[i]);
						} catch (e) { }
					}
				}
				if (mutation.type === "attributes" || mutation.type === "characterData") {
					try {
						queueMessageNode(mutation.target);
					} catch (e) { }
				}
			});
		};

		var config = {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ["class", "data-message-id"]
		};
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		if (stripchatObserver) {
			stripchatObserver.disconnect();
		}
		stripchatObserver = new MutationObserver(onMutationsObserved);
		stripchatObserver.observe(target, config);
	}

	function primeChatContainer(chatContainer) {
		if (!chatContainer || !chatContainer.querySelectorAll) return;
		var existing = chatContainer.querySelectorAll(".message-base, [data-message-id]");
		var startIndex = existing.length > 12 ? existing.length - 12 : 0;
		for (var i = 0; i < startIndex; i++) {
			rememberMessageKey(getMessageKey(existing[i]));
			updateHighestMessageId(existing[i]);
		}
		for (var j = startIndex; j < existing.length; j++) {
			processMessage(existing[j]);
		}
	}

	function scanChatContainer(chatContainer) {
		if (!chatContainer || !chatContainer.isConnected || !chatContainer.querySelectorAll) return;
		resetRoomIfChanged();
		var existing = chatContainer.querySelectorAll(".message-base, [data-message-id]");
		var queued = [];
		for (var i = 0; i < existing.length; i++) {
			var numericId = getNumericMessageId(existing[i]);
			if (numericId && numericId <= highestMessageId) continue;
			queued.push(existing[i]);
		}
		if (!queued.length) return;
		queued.sort(function (a, b) {
			return getNumericMessageId(a) - getNumericMessageId(b);
		});
		for (var j = 0; j < queued.length; j++) {
			processMessage(queued[j]);
		}
	}

	function isUsableChatContainer(container) {
		if (!container || !container.isConnected) return false;
		if (container.closest && container.closest(".model-chat-container.public")) return true;
		if (container.closest && container.closest(".model-chat-public")) return true;
		if (container.querySelector(".message-base, [data-message-id]")) return true;
		if (container.closest && container.closest(".model-chat-content")) return true;
		return false;
	}

	function getChatContainer() {
		var selectors = [
			".model-chat-container.public .messages.messages-v2",
			".model-chat-container.public .messages",
			".model-chat-public .messages.messages-v2",
			".model-chat-public .messages",
			".messages.messages-v2",
			".messages"
		];
		for (var s = 0; s < selectors.length; s++) {
			var containers = document.querySelectorAll(selectors[s]);
			for (var i = 0; i < containers.length; i++) {
				if (isUsableChatContainer(containers[i])) {
					return containers[i];
				}
			}
		}
		return null;
	}

	console.log("Social Stream injected");

	var checkReady = setInterval(function () {
		resetRoomIfChanged();
		var chatContainer = getChatContainer();
		if (chatContainer) {
			if (chatContainer !== currentChatContainer) {
				currentChatContainer = chatContainer;
				currentChatContainer.dataset.ssnMarked = "true";
				console.log("Social Stream - Stripchat chat connected");
				if (!hasInitializedChat) {
					primeChatContainer(chatContainer);
					hasInitializedChat = true;
				} else {
					scanChatContainer(chatContainer);
				}
				onElementInserted(chatContainer);
			} else if (!hasInitializedChat) {
				primeChatContainer(chatContainer);
				hasInitializedChat = true;
			}
		}
	}, 2000);

	stripchatScanInterval = setInterval(function () {
		var chatContainer = getChatContainer();
		if (chatContainer) {
			scanChatContainer(chatContainer);
		}
	}, 1500);

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
