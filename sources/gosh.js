(function () {
	if (location.protocol !== "https:" || !/^(www\.)?gosh\.com$/.test(location.hostname) || window.__SSN_GOSH_ACTIVE__) return;
	window.__SSN_GOSH_ACTIVE__ = true;

	var settings = {};
	var enabled = true;
	var container = null;
	var observer = null;
	var scanTimer = null;
	var channel = location.pathname;
	var highestIndex = -1;
	var previousRows = [];
	var followingTail = true;
	var initialized = false;
	var historyUntil = 0;

	function hasRuntime() {
		return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
	}

	function sendToApp(payload, callback) {
		try {
			if (hasRuntime()) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, callback || function () {});
			} else if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, callback || null, window.__SSAPP_TAB_ID__);
			}
		} catch (e) {}
	}

	function escapeHtml(value) {
		return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
			.replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	function imageUrl(value) {
		try {
			if (!value) return "";
			var url = new URL(value, location.href);
			return /^https?:$/.test(url.protocol) ? url.href : "";
		} catch (e) { return ""; }
	}

	// Capture contract: textonly=true means a literal chatmessage string, not HTML.
	// Do not add formatting tags or HTML-encode it; viewer-typed <i> / &amp; stays literal.
	// HTML mode may include markup for the normal relay checks. The flag applies only to chatmessage.
	// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
	function content(node, textonly) {
		if (node.nodeType === 3) /* textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode. */ return textonly ? node.textContent : escapeHtml(node.textContent);
		if (node.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|SVG|BUTTON)$/.test(node.nodeName)) return "";
		if (node.nodeName === "BR") return " ";
		if (node.nodeName === "IMG") {
			var src = imageUrl(node.getAttribute("src"));
			var alt = node.getAttribute("alt") || "";
			// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
			if (textonly) return alt || (src ? "[image]" : "");
			return src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		var result = "";
		for (var i = 0; i < node.childNodes.length; i++) /* textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode. */ result += content(node.childNodes[i], textonly);
		if (node.nodeName === "LI") return result.trim() + "; ";
		if (/^(DIV|P|UL|OL)$/.test(node.nodeName)) return result + " ";
		return result;
	}

	function readRows() {
		var rows = [];
		var nodes = container.querySelectorAll(".chat-message-container");
		for (var i = 0; i < nodes.length; i++) {
			var row = nodes[i];
			var indexed = row.closest("[data-index]");
			if (!indexed || !container.contains(indexed)) continue;
			var rawIndex = indexed.getAttribute("data-index");
			if (!/^\d+$/.test(rawIndex || "")) continue;
			var author = row.querySelector(".chat-message-author");
			var body = row.querySelector(".chat-message-body");
			if (!body) continue;
			var nameNode = author && (author.querySelector('[aria-haspopup="dialog"]') || author);
			var name = nameNode ? nameNode.textContent.replace(/:\s*$/, "").trim() : "";
			var html = content(body, false).replace(/\s+/g, " ").trim();
			if (!html) continue; // Wait for a row that is still being populated.
			rows.push({ index: Number(rawIndex), name: name, nameNode: nameNode, body: body,
				html: html, key: name + "\n" + html });
		}
		return rows.sort(function (a, b) { return a.index - b.index; });
	}

	function emit(row) {
		// Follows and other system notices have no chat author; do not invent a sender.
		if (!row.name) return;
		// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
		var textonly = !!settings.textonlymode;
		// textonlymode selects literal chatmessage text versus constructed HTML. Keep plain characters unchanged; add reply/emote markup only in HTML mode.
		var message = textonly ? content(row.body, true).replace(/\s+/g, " ").trim() : row.html;
		if (!message) return;
		sendToApp({ message: {
			chatname: row.name, chatmessage: message,
			nameColor: window.getComputedStyle(row.nameNode).color || "",
			chatimg: "", chatbadges: "", backgroundColor: "", textColor: "",
			contentimg: "", hasDonation: "", membership: "",
			// Wire contract: textonly=true means a literal chatmessage string with no app-added HTML; false means HTML for the normal relay sanitization path.
			textonly: textonly, platform: "gosh", type: "gosh"
		} });
	}

	function scanMessages(skip) {
		if (!container || location.pathname !== channel) return;
		var rows = readRows();
		if (!rows.length) return;
		var lastIndex = rows[rows.length - 1].index;
		// The virtual list mounts its initial history in more than one render.
		if (!initialized) historyUntil = Date.now() + 1000;
		if (!initialized || Date.now() < historyUntil || skip || !enabled) {
			initialized = true;
			highestIndex = Math.max(highestIndex, lastIndex);
			previousRows = rows;
			return;
		}
		if (!followingTail) return;
		if (lastIndex > highestIndex) {
			rows.forEach(function (row) { if (row.index > highestIndex) emit(row); });
		} else if (lastIndex === highestIndex && previousRows.length) {
			// A bounded chat buffer can shift indexes while keeping the same final index.
			// Match the previous tail before taking only the newly appended rows.
			for (var count = Math.min(previousRows.length, rows.length); count >= 2; count--) {
				var offset = previousRows.length - count;
				var matches = rows[count - 1].index < previousRows[previousRows.length - 1].index;
				for (var i = 0; matches && i < count; i++) matches = previousRows[offset + i].key === rows[i].key;
				if (matches) {
					rows.slice(count).forEach(emit);
					break;
				}
			}
		}
		highestIndex = Math.max(highestIndex, lastIndex);
		previousRows = rows;
	}

	function scheduleScan() {
		if (scanTimer !== null) return;
		// React can update a recycled row's index and contents in separate mutations.
		scanTimer = setTimeout(function () { scanTimer = null; scanMessages(false); }, 80);
	}

	function onScroll() {
		if (container) followingTail = container.scrollHeight - container.scrollTop - container.clientHeight <= 80;
	}

	function scanPage() {
		if (location.pathname !== channel) {
			channel = location.pathname;
			highestIndex = -1;
			previousRows = [];
			initialized = false;
			if (container) container.removeEventListener("scroll", onScroll);
			container = null;
		}
		var next = document.querySelector(".pc-chat-panel-main");
		if (next !== container) {
			if (observer) observer.disconnect();
			if (container) container.removeEventListener("scroll", onScroll);
			container = next;
			if (container) {
				onScroll();
				container.addEventListener("scroll", onScroll, { passive: true });
				scanMessages(true);
				observer = new MutationObserver(scheduleScan);
				observer.observe(container, { childList: true, subtree: true, characterData: true,
					attributes: true, attributeFilter: ["data-index", "src", "alt"] });
			}
		}
	}

	if (hasRuntime()) {
		chrome.runtime.onMessage.addListener(function (request, sender, respond) {
			if (request === "getSource") { respond("gosh"); return; }
			if (request === "focusChat") {
				var input = document.querySelector('.rich-message-editor[contenteditable="true"]');
				if (input && input.getAttribute("aria-disabled") !== "true") { input.focus(); respond(true); return; }
			}
			if (request && typeof request === "object") {
				if ("settings" in request) settings = request.settings || {};
				if ("state" in request) { scanMessages(true); enabled = !!request.state; }
				respond(true);
				return;
			}
			respond(false);
		});
	}
	sendToApp({ getSettings: true }, function (response) {
		if (!response) return;
		settings = response.settings || {};
		if ("state" in response) enabled = !!response.state;
	});
	scanPage();
	setInterval(scanPage, 1000);
})();
