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

		var name = "";
		var nameColor = "";
		var msg = "";
		var hasDonation = "";
		var chatimg = "";
		var badges = [];

		// check if this is a tip notification
		var tipNotif = ele.querySelector("[class*='ChatNotificationsTypes__goldNotifWrapperDesktop'], [class*='ChatNotificationsTypes__silverNotifWrapperDesktop'], [class*='ChatNotificationsTypes__notifWrapper']");
		if (tipNotif || (ele.className && ele.className.match && ele.className.match(/ChatNotificationsTypes/))) {
			try {
				var notifText = ele.querySelector("[class*='ChatNotificationsTypes__basicNotifText']");
				if (notifText) {
					var strongs = notifText.querySelectorAll("strong");
					if (strongs.length > 0) {
						name = escapeHtml(strongs[0].textContent.trim());
					}
					var amountEles = notifText.querySelectorAll("[class*='amountOfTokensBold']");
					if (amountEles.length > 0) {
						hasDonation = escapeHtml(amountEles[0].textContent.trim()) + " tokens";
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
			name = escapeHtml(senderEle.textContent.trim());
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
		data.textonly = settings.textonlymode || false;
		data.type = "cam4";

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
				if ("getSource" == request) { sendResponse("cam4"); return; }
				if ("focusChat" == request) {
					var input = document.querySelector('input[id*="ChatInputMobileV2_mainChatInput"], input[id*="chatInput"]');
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

							setTimeout(function (n) {
								processMessage(n);
							}, 200, node);
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
