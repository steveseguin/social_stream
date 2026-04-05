(function () {

	var settings = {};

	function escapeHtml(unsafe) {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;") || "";
	}

	function getAllContentNodes(element) {
		var resp = "";
		if (!element) return "";
		if (!element.childNodes || !element.childNodes.length) {
			if (element.textContent) {
				return escapeHtml(element.textContent) || "";
			}
			return "";
		}
		element.childNodes.forEach(node => {
			if (node.childNodes.length) {
				resp += getAllContentNodes(node);
			} else if ((node.nodeType === 3) && node.textContent && (node.textContent.trim().length > 0)) {
				resp += escapeHtml(node.textContent) + " ";
			} else if (node.nodeType === 1) {
				if (!settings.textonlymode) {
					if ((node.nodeName == "IMG") && node.src) {
						node.src = node.src + "";
					}
					resp += node.outerHTML;
				}
			}
		});
		return resp;
	}

	function processMessage(ele) {
		if (!ele || !ele.isConnected) return;
		if (ele.skip) return;
		if (ele.nodeType !== 1) return;
		if (!ele.classList.contains("js-chat_msg")) return;

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
					name = escapeHtml(tipNameEle.dataset.displayName || tipNameEle.textContent.trim());
				}

				var systemArea = ele.querySelector(".system_area");
				if (systemArea) {
					var tipText = systemArea.textContent || "";
					var tipMatch = tipText.match(/tipped\s+(\d+)\s+Tokens?/i);
					if (tipMatch) {
						hasDonation = tipMatch[1] + " tokens";
					}
				}

				var tipMenuItem = ele.querySelector(".msg_tma_info");
				if (tipMenuItem) {
					msg = escapeHtml(tipMenuItem.textContent.trim());
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
				name = escapeHtml(authorEle.textContent.trim());
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
		data.textonly = settings.textonlymode || false;
		data.type = "bongacams";

		pushMessage(data);
	}

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
	});

	chrome.runtime.onMessage.addListener(
		function (request, sender, sendResponse) {
			try {
				if ("getSource" == request) { sendResponse("bongacams"); return; }
				if ("focusChat" == request) {
					var input = document.querySelector("input.js-chat_msg_input");
					if (input) {
						input.focus();
						sendResponse(true);
						return;
					}
				}
				if (typeof request === "object") {
					if ("settings" in request) {
						settings = request.settings;
						sendResponse(true);
						return;
					}
				}
			} catch (e) { }
			sendResponse(false);
		}
	);

	function onElementInserted(target) {
		var onMutationsObserved = function (mutations) {
			mutations.forEach(function (mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							var node = mutation.addedNodes[i];
							if (node.nodeType !== 1) continue;
							if (node.skip) continue;

							if (node.classList && node.classList.contains("js-chat_msg")) {
								setTimeout(function (n) {
									processMessage(n);
								}, 200, node);
								continue;
							}

							// Bongacams sometimes appends wrappers that contain one or more js-chat_msg nodes
							var nestedMessages = node.querySelectorAll ? node.querySelectorAll(".js-chat_msg") : [];
							for (var j = 0; j < nestedMessages.length; j++) {
								var nested = nestedMessages[j];
								if (nested.skip) continue;
								setTimeout(function (n) {
									processMessage(n);
								}, 200, nested);
							}
						} catch (e) { }
					}
				}
			});
		};

		var config = { childList: true, subtree: false };
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
