(function () {
	if (window.__SSN_SOOPLIVE_ACTIVE__) return;
	function isSSAppContext() {
		return !!(
			window.ninjafy ||
			window.electronApi ||
			window.__ssapp ||
			typeof window.__SSAPP_TAB_ID__ !== "undefined"
		);
	}

	function normalizeSoopLiveUrl() {
		if (!isSSAppContext()) {
			return false;
		}

		try {
			var url = new URL(window.location.href);
			if (url.hostname === "www.sooplive.com" && url.pathname.indexOf("/chat/") === 0) {
				var username = url.pathname.replace(/^\/chat\/+/, "").split("/")[0];
				if (username) {
					window.location.replace("https://play.sooplive.com/" + username + "/");
					return true;
				}
			}

			if (/^play\.sooplive\.(com|co\.kr)$/.test(url.hostname) && url.pathname.length > 1 && url.searchParams.get("vtype") === "chat" && !window.opener) {
				// The current popup borrows its connection from window.opener.liveView.
				// A standalone SSApp source needs the full player to establish chat.
				url.searchParams.delete("vtype");
				window.location.replace(url.toString());
				return true;
			}
		} catch (e) {}

		return false;
	}

	if (normalizeSoopLiveUrl()) {
		return;
	}

	window.__SSN_SOOPLIVE_ACTIVE__ = true;
	var settings = {};
	var enabled = true;
	var seen = new Set();
	var processedRows = new WeakSet();
	var channel = location.pathname;
	var lastViewerCount = null;
	function hasRuntime() {
		return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
	}

	function sendToApp(payload, callback) {
		try {
			if (hasRuntime()) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, callback || function () {});
			} else if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, null, window.__SSAPP_TAB_ID__);
			}
		} catch (e) {}
	}

	function escapeHtml(value) {
		return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
			.replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	function resourceUrl(value) {
		try {
			if (!value) return "";
			var url = new URL(value, location.href);
			return /^https?:$/.test(url.protocol) ? url.href : "";
		} catch (e) { return ""; }
	}

	function messageContent(node) {
		if (node.nodeType === 3) {
			return settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
		}
		if (node.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|SVG|BUTTON)$/.test(node.nodeName)) return "";
		if (node.nodeName === "BR") return settings.textonlymode ? "\n" : "<br>";
		if (node.nodeName === "IMG") {
			var alt = node.getAttribute("alt") || "";
			var src = resourceUrl(node.getAttribute("src"));
			if (settings.textonlymode) return alt;
			return src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		var result = "";
		for (var i = 0; i < node.childNodes.length; i++) result += messageContent(node.childNodes[i]);
		return result;
	}


	function remember(row, key) {
		processedRows.add(row);
		if (key) {
			seen.add(key);
			if (seen.size > 1000) seen.delete(seen.values().next().value);
		}
	}

	function processRow(row, skip) {
		if (processedRows.has(row)) return;
		// Private whispers and system notices are not public chat rows.
		if (row.closest('.whispering') || row.querySelector('.whispering')) return;
		var nameElement = row.querySelector('.username [user_nick], .channel-text');
		var body = row.querySelector('.message-text, span[type^="body"][color="label/labelSecondary"]');
		if (!nameElement || !body) return;
		var name = (nameElement.getAttribute('user_nick') || nameElement.textContent).trim();
		var key = body.id || '';
		if (skip || !enabled || (key && seen.has(key))) { remember(row, key); return; }
		// Translation markup repeats the original text and includes controls.
		var copy = body.cloneNode(true);
		var extras = copy.querySelectorAll('.message-translation, .text-translated, button');
		for (var i = 0; i < extras.length; i++) extras[i].remove();
		var message = messageContent(copy).trim();
		if (!name || !message) return;
		var colorElement = nameElement.querySelector('.author') || nameElement;
		var color = colorElement.getAttribute('data-color');
		color = color && /^[0-9a-f]{6}$/i.test(color) ? '#' + color : getComputedStyle(colorElement).color;
		remember(row, key);
		sendToApp({ message: {
			chatname: name, chatmessage: message, nameColor: color || '',
			chatimg: '', chatbadges: '', backgroundColor: '', textColor: '',
			contentimg: '', hasDonation: '', membership: '',
			userid: nameElement.getAttribute('user_id') || '',
			textonly: !!settings.textonlymode, platform: 'sooplive', type: 'sooplive'
		} });
	}

	function scanMessages(skip) {
		if (location.pathname !== channel) {
			channel = location.pathname;
			seen.clear();
			processedRows = new WeakSet();
			lastViewerCount = null;
			skip = true;
		}
		var rows = document.querySelectorAll('#chat_area .chatting-list-item, #chatbox .chatting-list-item');
		for (var i = 0; i < rows.length; i++) processRow(rows[i], skip);
		// Retain the former global site's layout for installations still serving it.
		var names = document.querySelectorAll('.channel-text');
		for (var j = 0; j < names.length; j++) {
			var row = names[j].parentElement;
			while (row && row !== document.body) {
				if (row.querySelector('span[type^="body"][color="label/labelSecondary"]')) {
					if (row.querySelectorAll('.channel-text').length === 1) processRow(row, skip);
					break;
				}
				row = row.parentElement;
			}
		}
	}

	function updateViewers() {
		if (!enabled || !(settings.showviewercount || settings.hypemode)) { lastViewerCount = null; return; }
		var element = document.querySelector('#nAllViewer');
		if (!element) return;
		var value = element.textContent.trim().replace(/,/g, '');
		if (!/^\d+$/.test(value)) return;
		var count = Number(value);
		if (!Number.isSafeInteger(count) || count === lastViewerCount) return;
		lastViewerCount = count;
		sendToApp({ message: { type: 'sooplive', platform: 'sooplive', event: 'viewer_update', meta: count } });
	}

	if (hasRuntime()) {
		chrome.runtime.onMessage.addListener(function (request, sender, respond) {
			if (request === 'getSource') { respond('sooplive'); return; }
			if (request === 'focusChat') {
				var input = document.querySelector('#write_area[contenteditable="true"], #m_write_area[contenteditable="true"], [contenteditable="true"], textarea');
				if (input && !input.disabled) { input.focus(); respond(true); return; }
			}
			if (request && typeof request === 'object') {
				if ('settings' in request) settings = request.settings || {};
				if ('state' in request) { scanMessages(true); enabled = !!request.state; }
				updateViewers();
				respond(true); return;
			}
			respond(false);
		});
		sendToApp({ getSettings: true }, function (response) {
			if (chrome.runtime.lastError || !response) return;
			settings = response.settings || {};
			if ('state' in response) enabled = !!response.state;
			updateViewers();
		});
	}
	function start() {
		scanMessages(true);
		var observer = new MutationObserver(function () { scanMessages(false); });
		observer.observe(document.body, { childList: true, subtree: true, characterData: true });
		setInterval(function () { scanMessages(false); updateViewers(); }, 2000);
	}
	if (document.body) start();
	else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
