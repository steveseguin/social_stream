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
		if (!ele.classList.contains("js-chat_msg")) return;

		if (!isExtensionOn) { ele.skip = true; return; }

		var name = "";
		var nameColor = "";
		var msg = "";
		var hasDonation = "";
		var chatimg = "";
		var badges = [];
		var isTip = ele.classList.contains("msg_tip_success");

		if (isTip) {
			try {
				var tipNameEle = ele.querySelector(".mts_name");
				if (tipNameEle) {
					name = tipNameEle.dataset.displayName || tipNameEle.textContent.trim();
				}

				var systemArea = ele.querySelector(".system_area");
				if (systemArea) {
					var tipText = systemArea.textContent || "";
					var tipMatch = tipText.match(/(?:tipped|подарил(?:а)?)\s+(\d+)\s+(?:Tokens?|Токен(?:а|ов)?)/i);
					if (tipMatch) {
						hasDonation = tipMatch[1] + " tokens";
					}
				}

				var tipMenuItem = ele.querySelector(".msg_tma_info");
				if (tipMenuItem) {
					msg = getAllContentNodes(tipMenuItem).trim();
				}

				// some tips have a nested chat message with a comment
				var nestedMsg = ele.querySelector(".message_area .msg, .system_area .msg_wrp .msg");
				if (nestedMsg && !msg) {
					msg = getAllContentNodes(nestedMsg).trim();
				}
			} catch (e) {
			}
		} else {
			// regular chat message
			try {
				var authorEle = ele.querySelector(".author_name");
				if (!authorEle) return;
				name = authorEle.textContent.trim();
			} catch (e) {
				return;
			}

			try {
				var avatarEle = ele.querySelector(".icon_avatar img.profile");
				if (avatarEle && avatarEle.src) {
					chatimg = avatarEle.src + "";
				}
			} catch (e) {
			}

			try {
				// keep extraction scoped to chat message content to avoid leaking unrelated page DOM
				var msgEle = ele.querySelector(".message_area .msg, .msg");
				if (msgEle) {
					msg = getAllContentNodes(msgEle).trim();
				}
			} catch (e) {
			}
		}

		if (msg && msg.length > 4000) {
			msg = msg.slice(0, 4000).trim();
		}

		if (!name) return;
		if (!msg && !hasDonation) return;

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
		data.type = "bongacams";
		if (window.__ssnCamModeration && !window.__ssnCamModeration.track(ele, data)) return;

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
		var element = document.querySelector(".js-chat-tab-button[data-tab=\"users\"] .js-chat_users_count");
		if (!element) return;
		var match = element.textContent.trim().match(/^(\d+(?:[,\s]\d{3})*(?:\.\d+)?)([KM])?(?:\s|$)/i);
		if (!match) return;
		var count = Number(match[1].replace(/[,\s]/g, ""));
		if (match[2]) count *= match[2].toUpperCase() === "K" ? 1000 : 1000000;
		if (!isFinite(count) || count < 0 || Math.floor(count) !== count || count === lastViewerCount) return;
		lastViewerCount = count;
		pushMessage({ type: "bongacams", event: "viewer_update", meta: count });
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
				if ("getSource" == request) { sendResponse("bongacams"); return; }
				if ("focusChat" == request) {
					var inputs = document.querySelectorAll('input.js-chat_msg_input, textarea.js-chat_msg_input, .js-chat_msg_input[contenteditable="true"], .js-chat_msg_input[contenteditable="plaintext-only"]');
					for (var i = 0; i < inputs.length; i++) {
						var input = inputs[i];
						if (input.disabled || input.readOnly || !input.getClientRects().length) continue;
						input.focus();
						if (document.activeElement === input) {
							sendResponse(true);
							return;
						}
					}
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
		function queueMessage(row) {
			if (!row || !target.contains(row)) return;
			// A tip's nested comment belongs to the same captured message.
			row = row.closest(".js-chat_msg.msg_tip_success") || row;
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
				var changed = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
				queueMessage(changed && changed.closest(".js-chat_msg"));
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							var node = mutation.addedNodes[i];
							if (node.nodeType !== 1) continue;
							if (node.skip) continue;

							if (node.classList && node.classList.contains("js-chat_msg")) {
								queueMessage(node);
								continue;
							}

							// Bongacams sometimes appends wrappers that contain one or more js-chat_msg nodes
							var nestedMessages = node.querySelectorAll ? node.querySelectorAll(".js-chat_msg") : [];
							for (var j = 0; j < nestedMessages.length; j++) {
								queueMessage(nestedMessages[j]);
							}
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
		var chatContainer = document.querySelector(".chat_history");
		if (chatContainer) {
			if (!chatContainer.dataset.ssnMarked) {
				chatContainer.dataset.ssnMarked = "true";
				console.log("Social Stream - Bongacams chat connected");

				setTimeout(function(chatContainer){
				var existing = chatContainer.querySelectorAll(".js-chat_msg");
				for (var i = 0; i < existing.length; i++) {
					existing[i].skip = true;
				}

				onElementInserted(chatContainer);
				},2000,chatContainer);
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
