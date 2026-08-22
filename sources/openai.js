(function () {
	var isExtensionOn = true;
	var settings = {};
	var observer = null;
	var startupMode = true;
	var startupTimer = null;
	var lastUrl = window.location.href;
	var sentNodes = new WeakSet();
	var sentMessageKeys = {};
	var pendingMessages = new WeakMap();
	var MESSAGE_SELECTOR = '[data-message-author-role="user"], [data-message-author-role="assistant"]';

	function escapeHtml(value) {
		return String(value || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function getAllContentNodes(element) {
		var response = "";
		var i;
		var node;
		if (!element) {
			return "";
		}
		if (settings.textonlymode) {
			return String(element.textContent || "").trim();
		}
		if (!element.childNodes || !element.childNodes.length) {
			return element.textContent ? escapeHtml(element.textContent) : "";
		}
		for (i = 0; i < element.childNodes.length; i++) {
			node = element.childNodes[i];
			if (node.nodeType === 3 && node.textContent && node.textContent.trim()) {
				response += escapeHtml(node.textContent);
			} else if (node.nodeType === 1) {
				if (node.nodeName === "BUTTON" || node.getAttribute("aria-hidden") === "true") {
					continue;
				}
				if (node.childNodes && node.childNodes.length) {
					response += getAllContentNodes(node);
				} else if (node.nodeName === "IMG" && node.getAttribute("alt")) {
					response += escapeHtml(node.getAttribute("alt"));
				}
			}
		}
		return response;
	}

	function getMessageRole(element) {
		var role = element && element.getAttribute ? element.getAttribute("data-message-author-role") : "";
		role = String(role || "").toLowerCase();
		return role === "assistant" || role === "user" ? role : "";
	}

	function getTurnElement(element) {
		if (!element || !element.closest) {
			return element;
		}
		return element.closest('[data-testid^="conversation-turn-"]') || element.closest("article") || element;
	}

	function getContentElement(element, role) {
		var content = null;
		if (!element || !element.querySelector) {
			return element;
		}
		if (role === "assistant") {
			content = element.querySelector(".markdown") || element.querySelector('[class*="markdown"]');
		} else {
			content = element.querySelector('[data-testid="user-message"]') || element.querySelector(".whitespace-pre-wrap") || element.querySelector('[class*="whitespace-pre-wrap"]');
		}
		return content || element;
	}

	function getMessageKey(element) {
		var keyed = element;
		var turn;
		var value;
		if (!element || !element.getAttribute) {
			return "";
		}
		if (element.closest) {
			keyed = element.closest("[data-message-id]") || element;
		}
		value = keyed.getAttribute("data-message-id");
		if (value) {
			return "message:" + value;
		}
		turn = getTurnElement(element);
		value = turn && turn.getAttribute ? turn.getAttribute("data-testid") : "";
		if (value && value.indexOf("conversation-turn-") === 0) {
			return "turn:" + value;
		}
		return "";
	}

	function isAlreadySent(element) {
		var key;
		if (!element) {
			return true;
		}
		if (sentNodes.has(element)) {
			return true;
		}
		key = getMessageKey(element);
		return !!(key && sentMessageKeys[key]);
	}

	function markSent(element) {
		var key;
		if (!element) {
			return;
		}
		sentNodes.add(element);
		key = getMessageKey(element);
		if (key) {
			sentMessageKeys[key] = true;
		}
	}

	function getMessageElements(scope) {
		var elements = [];
		var matches;
		var i;
		if (!scope || (scope.nodeType !== 1 && scope.nodeType !== 9)) {
			return elements;
		}
		if (scope.nodeType === 1 && scope.matches && scope.matches(MESSAGE_SELECTOR)) {
			elements.push(scope);
		}
		if (!scope.querySelectorAll) {
			return elements;
		}
		matches = scope.querySelectorAll(MESSAGE_SELECTOR);
		for (i = 0; i < matches.length; i++) {
			if (elements.indexOf(matches[i]) === -1) {
				elements.push(matches[i]);
			}
		}
		return elements;
	}

	function seedExistingMessages(scope) {
		var elements = getMessageElements(scope || document);
		var i;
		for (i = 0; i < elements.length; i++) {
			markSent(elements[i]);
		}
	}

	function pushMessage(data) {
		if (!isExtensionOn) {
			return;
		}
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {});
		} catch (e) {}
	}

	function processMessage(element) {
		var role;
		var contentElement;
		var message;
		var turn;
		var image;
		var data;
		if (!element || isAlreadySent(element)) {
			return;
		}
		role = getMessageRole(element);
		if (!role) {
			return;
		}
		contentElement = getContentElement(element, role);
		message = getAllContentNodes(contentElement).trim();
		if (!message) {
			return;
		}
		turn = getTurnElement(element);
		image = turn && turn.querySelector ? turn.querySelector("img[src]") : null;
		markSent(element);
		data = {
			chatname: role === "assistant" ? "ChatGPT" : "User",
			chatbadges: "",
			backgroundColor: "",
			textColor: "",
			nameColor: "",
			chatmessage: message,
			chatimg: image && image.src ? image.src : role === "assistant" ? "./sources/images/openai.png" : "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: !!settings.textonlymode,
			type: "openai"
		};
		pushMessage(data);
	}

	function isStreaming(element) {
		var turn = getTurnElement(element);
		var streamingValue;
		if (!element) {
			return false;
		}
		streamingValue = element.getAttribute && element.getAttribute("data-is-streaming");
		if (streamingValue === "true") {
			return true;
		}
		if (turn && turn.querySelector && turn.querySelector('.result-streaming, [data-is-streaming="true"]')) {
			return true;
		}
		return getMessageRole(element) === "assistant" && !!document.querySelector('button[data-testid="stop-button"], button[aria-label*="Stop generating"], button[aria-label="Stop"]');
	}

	function queueMessage(element) {
		var state;
		var role;
		var contentElement;
		if (!element || isAlreadySent(element)) {
			return;
		}
		if (startupMode) {
			markSent(element);
			return;
		}
		role = getMessageRole(element);
		if (!role) {
			return;
		}
		contentElement = getContentElement(element, role);
		state = pendingMessages.get(element) || {};
		if (state.timer) {
			clearTimeout(state.timer);
		}
		state.lastText = String((contentElement && contentElement.textContent) || "").trim();
		state.timer = setTimeout(function () {
			var currentText;
			if (!element.isConnected || isAlreadySent(element)) {
				return;
			}
			contentElement = getContentElement(element, role);
			currentText = String((contentElement && contentElement.textContent) || "").trim();
			if (!currentText) {
				return;
			}
			if (currentText !== state.lastText || isStreaming(element)) {
				queueMessage(element);
				return;
			}
			pendingMessages.delete(element);
			processMessage(element);
		}, role === "assistant" ? 800 : 120);
		pendingMessages.set(element, state);
	}

	function scanForMessages(scope) {
		var elements = getMessageElements(scope || document);
		var i;
		for (i = 0; i < elements.length; i++) {
			queueMessage(elements[i]);
		}
	}

	function beginStartupWindow(duration) {
		startupMode = true;
		if (startupTimer) {
			clearTimeout(startupTimer);
		}
		seedExistingMessages(document);
		startupTimer = setTimeout(function () {
			seedExistingMessages(document);
			startupMode = false;
			document.documentElement.setAttribute("data-ssn-openai-ready", "true");
		}, duration || 1400);
	}

	function startObserver() {
		if (observer || !document.body) {
			return;
		}
		observer = new MutationObserver(function (mutations) {
			var i;
			var j;
			var mutation;
			if (startupMode) {
				seedExistingMessages(document);
				return;
			}
			for (i = 0; i < mutations.length; i++) {
				mutation = mutations[i];
				if (mutation.type === "characterData" && mutation.target && mutation.target.parentElement) {
					scanForMessages(mutation.target.parentElement.closest(MESSAGE_SELECTOR) || mutation.target.parentElement);
				}
				for (j = 0; j < mutation.addedNodes.length; j++) {
					scanForMessages(mutation.addedNodes[j]);
				}
			}
		});
		observer.observe(document.body, { childList: true, subtree: true, characterData: true });
		beginStartupWindow(1400);
	}

	function getPromptInput() {
		return document.querySelector("#prompt-textarea") ||
			document.querySelector('textarea[data-testid="prompt-textarea"]') ||
			document.querySelector("form textarea") ||
			document.querySelector('[contenteditable="true"][data-lexical-editor="true"]') ||
			document.querySelector('form [contenteditable="true"]');
	}

	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		if (chrome.runtime.lastError || !response) {
			return;
		}
		if ("settings" in response) {
			settings = response.settings || {};
		}
		if ("state" in response) {
			isExtensionOn = !!response.state;
		}
	});

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		var input;
		try {
			if (request === "getSource") {
				sendResponse("openai");
				return;
			}
			if (request === "focusChat") {
				input = getPromptInput();
				if (input && input.focus) {
					input.focus();
					sendResponse(true);
					return;
				}
				sendResponse(false);
				return;
			}
			if (request && typeof request === "object") {
				if ("settings" in request) {
					settings = request.settings || {};
				}
				if ("state" in request) {
					if (!isExtensionOn && request.state) {
						beginStartupWindow(500);
					}
					isExtensionOn = !!request.state;
				}
				sendResponse(true);
				return;
			}
		} catch (e) {}
		sendResponse(false);
	});

	setInterval(function () {
		if (!observer) {
			startObserver();
		}
		if (window.location.href !== lastUrl) {
			lastUrl = window.location.href;
			beginStartupWindow(1200);
		}
	}, 300);

	startObserver();
	console.log("Social Stream injected into ChatGPT");
})();
