(function () {
	var isExtensionOn = true;
	var settings = {};
	var observedContainer = null;
	var observer = null;

	function escapeHtml(value) {
		return String(value || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function escapeAttribute(value) {
		return escapeHtml(value).replace(/`/g, "&#096;");
	}

	function getContent(node, textOnly) {
		if (!node) return "";
		if (node.nodeType === 3) return textOnly ? String(node.textContent || "") : escapeHtml(node.textContent || "");
		if (node.nodeType !== 1) return "";

		var tagName = String(node.tagName || "").toLowerCase();
		if (tagName === "img") {
			var alt = String(node.getAttribute("alt") || "");
			if (textOnly) return alt;
			if (!node.src) return escapeHtml(alt);
			return '<img src="' + escapeAttribute(node.src) + '" alt="' + escapeAttribute(alt) + '" class="zero-width-emote">';
		}
		if (tagName === "br") return textOnly ? "\n" : "<br>";

		var content = "";
		for (var index = 0; index < node.childNodes.length; index += 1) {
			content += getContent(node.childNodes[index], textOnly);
		}
		if (textOnly) return content;

		var allowedTags = {
			strong: "strong",
			b: "strong",
			em: "em",
			i: "em",
			u: "u",
			s: "strike",
			strike: "strike",
			code: "code",
			pre: "pre",
		};
		var outputTag = allowedTags[tagName];
		return outputTag ? "<" + outputTag + ">" + content + "</" + outputTag + ">" : content;
	}

	function queryClassPrefix(root, name) {
		if (!root || !root.querySelector) return null;
		return root.querySelector('[class^="Chat_' + name + '__"], [class*=" Chat_' + name + '__"]');
	}

	function processMessage(row) {
		if (!row || row.dataset.ssnStreamKitSeen === "true") return;
		row.dataset.ssnStreamKitSeen = "true";
		if (!isExtensionOn) return;
		if (!settings.discord && !(window.ninjafy || window.electronApi)) return;

		var username = queryClassPrefix(row, "username");
		var message = queryClassPrefix(row, "messageText");
		var chatname = username ? String(username.textContent || "").trim() : "";
		var chatmessage = getContent(message, !!settings.textonlymode).trim();
		if (!chatname && !chatmessage) return;

		pushMessage({
			chatname: chatname,
			chatbadges: "",
			backgroundColor: "",
			textColor: "",
			chatmessage: chatmessage,
			chatimg: "",
			nameColor: username && username.style ? username.style.color || "" : "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: !!settings.textonlymode,
			type: "discord",
		});
	}

	function pushMessage(data) {
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {});
		} catch (error) {
			try {
				if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
					window.ninjafy.sendMessage(null, { message: data });
				}
			} catch (_) {}
		}
	}

	function findMessageRows(root) {
		if (!root || !root.querySelectorAll) return [];
		var rows = [];
		if (root.matches && root.matches('[class^="Chat_message__"], [class*=" Chat_message__"]')) rows.push(root);
		var descendants = root.querySelectorAll('[class^="Chat_message__"], [class*=" Chat_message__"]');
		for (var index = 0; index < descendants.length; index += 1) rows.push(descendants[index]);
		return rows;
	}

	function markExistingMessages(container) {
		var rows = findMessageRows(container);
		for (var index = 0; index < rows.length; index += 1) {
			rows[index].dataset.ssnStreamKitSeen = "true";
		}
	}

	function attachObserver(container) {
		if (!container || container === observedContainer) return;
		if (observer) {
			try { observer.disconnect(); } catch (_) {}
		}
		observedContainer = container;
		markExistingMessages(container);
		observer = new MutationObserver(function (mutations) {
			for (var mutationIndex = 0; mutationIndex < mutations.length; mutationIndex += 1) {
				var mutation = mutations[mutationIndex];
				for (var nodeIndex = 0; nodeIndex < mutation.addedNodes.length; nodeIndex += 1) {
					var rows = findMessageRows(mutation.addedNodes[nodeIndex]);
					for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) processMessage(rows[rowIndex]);
				}
			}
		});
		observer.observe(container, { childList: true, subtree: true });
	}

	function findMessagesContainer() {
		return document.querySelector('[class^="Chat_messages__"], [class*=" Chat_messages__"]');
	}

	try {
		chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
			if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) return;
			response = response || {};
			if ("state" in response) isExtensionOn = response.state !== false;
			if (response.settings) settings = response.settings;
		});
	} catch (_) {}

	try {
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			if (request === "getSource") {
				sendResponse("discord");
				return;
			}
			if (request === "focusChat") {
				sendResponse(false);
				return;
			}
			if (request && typeof request === "object") {
				if ("state" in request) isExtensionOn = request.state !== false;
				if (request.settings) settings = request.settings;
			}
			sendResponse(true);
		});
	} catch (_) {}

	setInterval(function () {
		var container = findMessagesContainer();
		if (container) attachObserver(container);
	}, 500);
})();
