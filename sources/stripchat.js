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
		if (!ele.classList.contains("message-base")) return;

		// skip lovense buzz notifications, goal updates, and action messages
		if (ele.classList.contains("m-bg-default-v2")) { ele.skip = true; return; }
		if (ele.classList.contains("m-bg-action")) { ele.skip = true; return; }

		var name = "";
		var nameColor = "";
		var msg = "";
		var hasDonation = "";
		var chatimg = "";
		var badges = [];
		var isTip = ele.classList.contains("m-bg-tip-v2");
		var isGoal = ele.classList.contains("m-bg-goal-v2") || ele.classList.contains("m-bg-goal-v2-reached");

		if (isGoal) { ele.skip = true; return; }

		try {
			var usernameEle = ele.querySelector(".user-levels-username-text");
			if (!usernameEle) {
				// fallback for model welcome messages
				usernameEle = ele.querySelector(".user-levels-username-chat-owner");
			}
			if (!usernameEle) return;
			name = escapeHtml(usernameEle.textContent.trim());
		} catch (e) {
			return;
		}

		if (!name) return;

		if (isTip) {
			try {
				var amountEle = ele.querySelector("strong");
				if (amountEle) {
					hasDonation = escapeHtml(amountEle.textContent.trim());
				}
				var commentEle = ele.querySelector("[class*='commentBody']");
				if (commentEle) {
					msg = getAllContentNodes(commentEle).trim();
				}
			} catch (e) {
			}
		} else {
			// regular message: content is inside the inner div after the .message-username div
			try {
				var contentWrapper = ele.querySelector("[class*='contentWithControls']");
				if (contentWrapper) {
					var innerDiv = contentWrapper.querySelector("div");
					if (innerDiv) {
						var clone = innerDiv.cloneNode(true);
						var usernameDiv = clone.querySelector(".message-username");
						if (usernameDiv) usernameDiv.remove();
						msg = getAllContentNodes(clone).trim();
					}
				}
			} catch (e) {
			}
		}

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
		data.type = "stripchat";

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
				if ("getSource" == request) { sendResponse("stripchat"); return; }
				if ("focusChat" == request) {
					var input = document.querySelector('[class*="ChatInput__input"]');
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
							if (!node.classList.contains("message-base")) continue;

							setTimeout(function (n) {
								processMessage(n);
							}, 100, node);
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
		var chatContainer = document.querySelector(".messages");
		if (chatContainer) {
			if (!chatContainer.dataset.ssnMarked) {
				chatContainer.dataset.ssnMarked = "true";
				console.log("Social Stream - Stripchat chat connected");
				setTimeout(function(chatContainer){
					var existing = chatContainer.querySelectorAll(".message-base");
					for (var i = 0; i < existing.length; i++) {
						existing[i].skip = true;
					}

					onElementInserted(chatContainer);
				},3000, chatContainer);
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
