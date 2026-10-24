(function () {
	// The desktop app supplies the same chrome.runtime bridge as the extension.
	function isChatPage() {
		return location.hostname === "razo.tv" && /^\/(dashboard\/chat-popout\/?|overlay\/chat\/[^/]+\/?)$/.test(location.pathname);
	}
	if (!isChatPage()) return;
	if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
	if (window.ssnRazoInjected) return;
	window.ssnRazoInjected = true;

	var settings = {};
	var enabled = true;
	var ready = false;
	var rows = 'article[id^="chat-msg-"][data-chat-line]';
	// Keep native IDs for this page's lifetime, including rows pruned and replayed by Razo.
	var messages = new Map();

	function escapeHtml(value) {
		return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	function imageUrl(node) {
		var url = node.currentSrc || node.src || "";
		return /^https?:\/\//i.test(url) ? url : "";
	}

	function content(node) {
		if (node.nodeType === 3) return settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
		if (node.nodeType !== 1) return "";
		if (node.matches('[data-chat-badge], [role="tooltip"], [data-chat-reply-chip], [data-chat-reply-quote], button, script, style')) return "";
		if (node.tagName === "IMG") {
			var alt = node.getAttribute("alt") || "";
			var src = imageUrl(node);
			return settings.textonlymode ? alt : (src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt));
		}
		if (node.tagName === "BR") return settings.textonlymode ? "\n" : "<br>";
		var result = "";
		for (var i = 0; i < node.childNodes.length; i++) result += content(node.childNodes[i]);
		return result;
	}

	function removeMessage(entry) {
		if (!entry.deleted || entry.removed || entry.id === undefined) return;
		entry.removed = true;
		chrome.runtime.sendMessage(chrome.runtime.id, { delete: { type: "razo", id: entry.id } }, function () {
			void chrome.runtime.lastError;
		});
	}

	function processRow(row) {
		if (!ready || !isChatPage() || !row.isConnected) return;
		var key = location.pathname + ":" + row.id;
		var entry = messages.get(key);
		var text = row.querySelector('[data-chat-text]');
		if (!text) return; // Paid cards, activity and private staff/bot notices are not chat rows.
		var name = text.querySelector('a[href^="/u/"]');
		if (!name || !name.textContent.trim()) return;
		var separator = null;
		var deleted = false;
		for (var node = name.nextSibling; node; node = node.nextSibling) {
			if (node.nodeType !== 1) continue;
			if (node.tagName === "SPAN" && node.classList.contains("italic") && node.textContent.trim() === "Message removed") deleted = true;
			if (!separator && node.tagName === "SPAN" && node.textContent === ": ") separator = node;
		}
		if (deleted) {
			entry = entry || {};
			entry.deleted = true;
			messages.set(key, entry);
			removeMessage(entry);
			return;
		}
		if (entry || !separator) return;
		var body = "";
		for (var part = separator.nextSibling; part; part = part.nextSibling) body += content(part);
		if (!body.trim()) return; // Retry incomplete rows on subsequent mutations.
		entry = {};
		messages.set(key, entry);
		if (!enabled) return;
		var badges = [];
		text.querySelectorAll('[data-chat-badge] img').forEach(function (img) {
			var url = imageUrl(img);
			if (url) badges.push(url);
		});
		chrome.runtime.sendMessage(chrome.runtime.id, { message: {
			chatname: name.textContent.trim(),
			username: row.getAttribute("data-chat-line"),
			chatmessage: body.trim(),
			chatbadges: badges,
			nameColor: name.style.color || "",
			backgroundColor: "",
			textColor: "",
			chatimg: "",
			contentimg: "",
			hasDonation: "",
			membership: "",
			textonly: !!settings.textonlymode,
			platform: "razo",
			type: "razo"
		} }, function (response) {
			if (chrome.runtime.lastError) return;
			if (response && response.id !== undefined) {
				entry.id = response.id;
				removeMessage(entry);
			}
		});
	}

	function scan(node) {
		if (node.nodeType !== 1) node = node.parentElement;
		if (!node) return;
		var row = node.closest(rows);
		if (row) processRow(row);
		node.querySelectorAll(rows).forEach(processRow);
	}

	var observer = new MutationObserver(function (mutations) {
		mutations.forEach(function (mutation) {
			var target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
			var row = target && target.closest(rows);
			if (row) processRow(row);
			mutation.addedNodes.forEach(scan);
		});
	});
	observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["id", "data-chat-line", "data-chat-text", "class"] });

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request === "getSource") { sendResponse("razo"); return; }
		if (request === "focusChat") {
			var input = isChatPage() && document.querySelector('[data-chat-input-box] textarea:not([disabled]):not([readonly])');
			if (input) input.focus();
			sendResponse(!!input && document.activeElement === input);
			return;
		}
		if (request && typeof request === "object") {
			if ("settings" in request) settings = request.settings || {};
			if ("state" in request) enabled = !!request.state;
			sendResponse(true);
			return;
		}
		sendResponse(false);
	});
	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		if (chrome.runtime.lastError) return;
		if (response) {
			settings = response.settings || {};
			if ("state" in response) enabled = !!response.state;
		}
		ready = true;
		scan(document.documentElement);
	});
})();
