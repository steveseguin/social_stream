(function () {

	var settings = {};

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

	function isStripchatMessage(ele) {
		if (!ele || ele.nodeType !== 1) return false;
		if (hasClass(ele, "message-base")) return true;
		return !!(ele.dataset && ele.dataset.messageId && hasClass(ele, "message"));
	}

	function removeElements(root, selector) {
		if (!root || !root.querySelectorAll) return;
		var nodes = root.querySelectorAll(selector);
		for (var i = 0; i < nodes.length; i++) {
			nodes[i].remove();
		}
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
		if (!isStripchatMessage(ele)) return;

		// skip lovense buzz notifications, goal updates, and action messages
		var className = (ele.className || "").toString();
		if (hasClass(ele, "m-bg-default-v2") || className.indexOf("LovenseTipMessage") !== -1) { ele.skip = true; return; }
		if (hasClass(ele, "m-bg-action") || className.indexOf("ActionMessage") !== -1) { ele.skip = true; return; }

		var name = "";
		var nameColor = "";
		var msg = "";
		var hasDonation = "";
		var chatimg = "";
		var badges = [];
		var isTip = hasClass(ele, "m-bg-tip-v2") || className.indexOf("TipMessage") !== -1;
		var isGoal = hasClass(ele, "m-bg-goal-v2") || hasClass(ele, "m-bg-goal-v2-reached") || className.indexOf("GoalUpdatedMessage") !== -1;

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
				var amountEle = ele.querySelector("[class*='amountHighlight'], strong");
				if (amountEle) {
					hasDonation = escapeHtml(amountEle.textContent.trim());
				}
				if (!hasDonation) {
					var tipMatch = (ele.textContent || "").match(/tipped\s+([0-9.,]+\s*(?:tk|tokens?))/i);
					if (tipMatch) {
						hasDonation = escapeHtml(tipMatch[1].trim());
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
				var contentWrapper = ele.querySelector("[class*='contentWithControls'], .message-body");
				if (contentWrapper) {
					var clone = contentWrapper.cloneNode(true);
					removeElements(clone, ".message-username, [class*='MessageControls'], [class*='Controls'], button, svg");
					msg = getAllContentNodes(clone).trim();
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
		function queueMessageNode(node) {
			if (!node || node.nodeType !== 1 || node.skip) return;

			if (isStripchatMessage(node)) {
				setTimeout(function (n) {
					processMessage(n);
				}, 100, node);
				return;
			}

			if (!node.querySelectorAll) return;
			var nestedMessages = node.querySelectorAll(".message-base, [data-message-id]");
			for (var j = 0; j < nestedMessages.length; j++) {
				if (nestedMessages[j].skip) continue;
				setTimeout(function (n) {
					processMessage(n);
				}, 100, nestedMessages[j]);
			}
		}

		var onMutationsObserved = function (mutations) {
			mutations.forEach(function (mutation) {
				if (mutation.addedNodes.length) {
					for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
						try {
							queueMessageNode(mutation.addedNodes[i]);
						} catch (e) { }
					}
				}
			});
		};

		var config = { childList: true, subtree: true };
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
		var observer = new MutationObserver(onMutationsObserved);
		observer.observe(target, config);
	}

	function getChatContainer() {
		var containers = document.querySelectorAll(".messages");
		for (var i = 0; i < containers.length; i++) {
			if (containers[i].closest(".model-chat-content") || containers[i].querySelector(".message-base, [data-message-id]")) {
				return containers[i];
			}
		}
		return containers[0] || null;
	}

	console.log("Social Stream injected");

	var checkReady = setInterval(function () {
		var chatContainer = getChatContainer();
		if (chatContainer) {
			if (!chatContainer.dataset.ssnMarked) {
				chatContainer.dataset.ssnMarked = "true";
				console.log("Social Stream - Stripchat chat connected");
				setTimeout(function(chatContainer){
					var existing = chatContainer.querySelectorAll(".message-base, [data-message-id]");
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
