(function () {
	var settings = {};
	var messageHistory = [];
	var maxMessageHistory = 200;
	var started = false;

	function hasChromeRuntime() {
		return typeof chrome !== "undefined" && chrome && chrome.runtime && chrome.runtime.id;
	}

	function sendToApp(payload, callback) {
		try {
			if (hasChromeRuntime()) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, callback || function () {});
				return true;
			}
		} catch (e) {}

		try {
			if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, null, typeof window.__SSAPP_TAB_ID__ !== "undefined" ? window.__SSAPP_TAB_ID__ : null);
				return true;
			}
		} catch (e) {}

		try {
			var forwarded = {};
			for (var key in payload) {
				if (Object.prototype.hasOwnProperty.call(payload, key)) {
					forwarded[key] = payload[key];
				}
			}
			if (typeof window.__SSAPP_TAB_ID__ !== "undefined") {
				forwarded.__tabID__ = window.__SSAPP_TAB_ID__;
			}
			window.postMessage(forwarded, "*");
			return true;
		} catch (e) {}

		return false;
	}

	function escapeHtml(unsafe) {
		try {
			if (settings.textonlymode) {
				return unsafe || "";
			}
			return (unsafe || "")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;");
		} catch (e) {
			return "";
		}
	}

	function getAllContentNodes(element) {
		var resp = "";

		if (!element) {
			return resp;
		}

		if (!element.childNodes || !element.childNodes.length) {
			if (element.textContent) {
				return escapeHtml(element.textContent) || "";
			}
			return "";
		}

		element.childNodes.forEach(function (node) {
			if (node.childNodes && node.childNodes.length) {
				resp += getAllContentNodes(node);
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)) {
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1) {
				if (!settings.textonlymode) {
					if ((node.nodeName === "IMG") && node.src) {
						node.src = node.src + "";
					}
					resp += node.outerHTML || "";
				}
			}
		});

		return resp;
	}

	function getName(element) {
		try {
			var nick = element.querySelector(".user .nick");
			if (!nick) {
				return "";
			}
			return escapeHtml((nick.textContent || "").trim());
		} catch (e) {
			return "";
		}
	}

	function getNameColor(element) {
		try {
			var nick = element.querySelector(".user .nick");
			if (!nick) {
				return "";
			}
			return (getComputedStyle(nick).color || "").trim();
		} catch (e) {
			return "";
		}
	}

	function getBadges(element) {
		var badges = [];
		try {
			element.querySelectorAll(".user .nick .icon[tooltip]").forEach(function (badge) {
				try {
					var text = (badge.getAttribute("tooltip") || "").replace(/\s+/g, " ").trim();
					if (!text) {
						return;
					}
					badges.push({
						type: "text",
						text: escapeHtml(text)
					});
				} catch (e) {}
			});
		} catch (e) {}
		return badges;
	}

	function getAvatar(element) {
		try {
			var avatar = element.querySelector("img.avatar[src], .user img[src], .avatar img[src]");
			if (avatar && avatar.src) {
				return avatar.src;
			}
		} catch (e) {}
		return "";
	}

	function buildMessageKey(element, name, msg, chatimg) {
		var tooltip = "";
		try {
			tooltip = element.getAttribute("tooltip") || "";
		} catch (e) {}
		return [tooltip, name, msg, chatimg].join("::");
	}

	function hasSeenMessage(key) {
		return messageHistory.indexOf(key) !== -1;
	}

	function rememberMessage(key) {
		messageHistory.push(key);
		if (messageHistory.length > maxMessageHistory) {
			messageHistory = messageHistory.slice(messageHistory.length - maxMessageHistory);
		}
	}

	function pushMessage(data) {
		sendToApp({ "message": data });
	}

	function processMessage(element) {
		if (!element || !element.isConnected) {
			return;
		}

		var msg = "";
		try {
			msg = getAllContentNodes(element.querySelector(".message[parse-message], .message")).trim();
		} catch (e) {}

		var name = getName(element);
		var chatimg = getAvatar(element);

		if (!name || !msg) {
			return;
		}

		var key = buildMessageKey(element, name, msg, chatimg);
		if (hasSeenMessage(key)) {
			return;
		}
		rememberMessage(key);

		var data = {};
		data.chatname = name;
		data.chatbadges = getBadges(element);
		data.backgroundColor = "";
		data.textColor = "";
		data.nameColor = getNameColor(element);
		data.chatmessage = msg;
		data.chatimg = chatimg;
		data.hasDonation = "";
		data.membership = "";
		data.contentimg = "";
		data.textonly = settings.textonlymode || false;
		data.type = "goodgame";

		pushMessage(data);
	}

	function markExistingMessages(container) {
		try {
			container.querySelectorAll(".message-block").forEach(function (element) {
				element.skip = true;
				var name = getName(element);
				var msg = "";
				try {
					msg = getAllContentNodes(element.querySelector(".message[parse-message], .message")).trim();
				} catch (e) {}
				if (name && msg) {
					rememberMessage(buildMessageKey(element, name, msg, getAvatar(element)));
				}
			});
		} catch (e) {}
	}

	function onElementInserted(target) {
		if (!target) {
			return;
		}

		var onMutationsObserved = function (mutations) {
			mutations.forEach(function (mutation) {
				if (!mutation.addedNodes.length) {
					return;
				}
				for (var i = 0; i < mutation.addedNodes.length; i++) {
					try {
						var node = mutation.addedNodes[i];
						if (!node || !node.classList) {
							continue;
						}

						if (node.classList.contains("message-block")) {
							if (node.skip) {
								continue;
							}
							node.skip = true;
							processMessage(node);
							continue;
						}

						var nestedMessages = node.querySelectorAll ? node.querySelectorAll(".message-block") : [];
						nestedMessages.forEach(function (nested) {
							if (nested.skip) {
								return;
							}
							nested.skip = true;
							processMessage(nested);
						});
					} catch (e) {}
				}
			});
		};

		var observer = new (window.MutationObserver || window.WebKitMutationObserver)(onMutationsObserved);
		observer.observe(target, { childList: true, subtree: true });
	}

	function start() {
		if (started) {
			return;
		}

		var container = document.querySelector(".chat-section");
		if (!container) {
			return;
		}

		started = true;
		markExistingMessages(container);
		onElementInserted(container);
	}

	if (hasChromeRuntime()) {
		chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function (response) {
			if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
				return;
			}
			response = response || {};
			if ("settings" in response) {
				settings = response.settings;
			}
		});

		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			try {
				if ("getSource" === request) {
					sendResponse("goodgame");
					return;
				}
				if ("focusChat" === request) {
					var input = document.querySelector("textarea, [contenteditable='true'], input[type='text']");
					if (input && input.focus) {
						input.focus();
						sendResponse(true);
						return;
					}
				}
				if (typeof request === "object" && request) {
					if ("settings" in request) {
						settings = request.settings;
						sendResponse(true);
						return;
					}
				}
			} catch (e) {}
			sendResponse(false);
		});
	}

	console.log("social stream injected");

	setInterval(start, 2000);
})();
