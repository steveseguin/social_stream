(function () {
	// RPLAY's box popout only; do not capture its main site or other widgets.
	function creatorId() {
		if (location.hostname !== "rplay.live") { return ""; }
		var match = location.pathname.match(/^\/live\/chat\/box\/([a-f0-9]{24})\/?$/i);
		return match ? match[1] : "";
	}
	if (!creatorId() || window.__ssnRplayLoaded) { return; }
	window.__ssnRplayLoaded = true;
	var settings = {};
	var isExtensionOn = true;
	var seen = new WeakSet();
	var container = null;
	var observer = null;
	var channel = creatorId();
	var lastViewerCount = null;
	var viewerRequest = null;

	function hasChromeRuntime() {
		return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
	}
	function sendToApp(payload, callback) {
		try {
			if (hasChromeRuntime()) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, callback || function () {});
			} else if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, null, window.__SSAPP_TAB_ID__ || null);
			} else {
				if (typeof window.__SSAPP_TAB_ID__ !== "undefined") { payload.__tabID__ = window.__SSAPP_TAB_ID__; }
				window.postMessage(payload, "*");
			}
		} catch (e) {}
	}
	function escapeHtml(value) {
		return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
			.replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}
	function imageUrl(node) {
		var url = node && node.src || "";
		return /^(https?:|data:image\/|blob:)/i.test(url) ? url : "";
	}
	function content(node) {
		if (node.nodeType === 3) {
			return settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
		}
		if (node.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|BUTTON)$/.test(node.tagName)) { return ""; }
		if (node.tagName === "IMG") {
			var alt = node.getAttribute("alt") || "";
			var src = imageUrl(node);
			return settings.textonlymode ? alt : (src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt));
		}
		if (node.tagName === "BR") { return settings.textonlymode ? "\n" : "<br>"; }
		var text = "";
		for (var i = 0; i < node.childNodes.length; i++) { text += content(node.childNodes[i]); }
		return text;
	}
	function processMessage(row) {
		if (seen.has(row) || !row.isConnected) { return; }
		var name = row.querySelector(".message__nickname");
		var body = row.querySelector(".message__content");
		if (!name || !body) { return; }
		// RPLAY can relay Twitch messages in this widget. Leave those to Twitch capture.
		if (row.querySelector(".message__user-icon svg")) { seen.add(row); return; }
		var donation = row.querySelector(".message__nickname-coin");
		var text = content(body).trim();
		if (!name.textContent.trim() || (!text && !donation)) { return; }
		seen.add(row);
		if (!isExtensionOn || !creatorId()) { return; }
		var badges = [];
		row.querySelectorAll("img.message__tier-photo").forEach(function (badge) {
			var url = imageUrl(badge);
			if (url) { badges.push(url); }
		});
		var data = {
			chatname: name.textContent.trim(), chatmessage: text,
			chatimg: imageUrl(row.querySelector("img.message__user-photo")),
			chatbadges: badges, nameColor: name.style.color || "",
			backgroundColor: "", textColor: "", contentimg: "",
			hasDonation: donation ? donation.textContent.trim() : "", membership: "",
			textonly: !!settings.textonlymode, type: "rplay"
		};
		if (donation) {
			var amount = donation.textContent.replace(/,/g, "").match(/^\s*(\d+(?:\.\d+)?)/);
			if (amount) { data.donoValue = Number(amount[1]); }
		}
		sendToApp({ message: data });
	}
	function scanMessages() {
		if (container) { container.querySelectorAll(".message").forEach(processMessage); }
	}
	function scanPage() {
		var current = creatorId();
		if (current !== channel) {
			channel = current;
			lastViewerCount = null;
			seen = new WeakSet();
			if (viewerRequest) { viewerRequest.abort(); viewerRequest = null; }
			if (observer) { observer.disconnect(); }
			container = null;
		}
		if (!current) { return; }
		// This is the popout's messageView; its children are keyed Vue message rows.
		var next = document.querySelector("#app .hideScroll.overflow-y-auto");
		if (!next || next === container) { return; }
		if (observer) { observer.disconnect(); }
		container = next;
		container.querySelectorAll(".message").forEach(function (row) { seen.add(row); });
		observer = new MutationObserver(scanMessages);
		observer.observe(container, { childList: true, subtree: true, characterData: true });
	}
	function checkViewers() {
		var current = creatorId();
		if (!current || viewerRequest || !isExtensionOn || !(settings.showviewercount || settings.hypemode)) { return; }
		var xhr = new XMLHttpRequest();
		viewerRequest = xhr;
		xhr.open("GET", "https://api.rplay.live/live/stream?creatorOid=" + encodeURIComponent(current));
		xhr.timeout = 10000;
		xhr.onload = function () {
			if (xhr.status !== 200 || current !== creatorId() || !isExtensionOn || !(settings.showviewercount || settings.hypemode)) { return; }
			try {
				var count = JSON.parse(xhr.responseText).viewerCount;
				if (typeof count !== "number" || !isFinite(count) || count < 0 || Math.floor(count) !== count || count === lastViewerCount) { return; }
				lastViewerCount = count;
				sendToApp({ message: { type: "rplay", event: "viewer_update", meta: count } });
			} catch (e) {}
		};
		xhr.onloadend = function () { if (viewerRequest === xhr) { viewerRequest = null; } };
		xhr.send();
	}
	if (hasChromeRuntime()) {
		sendToApp({ getSettings: true }, function (response) {
			if (chrome.runtime.lastError || !response) { return; }
			if ("settings" in response) { settings = response.settings || {}; }
			if ("state" in response) { isExtensionOn = response.state; }
			checkViewers();
		});
		if (chrome.runtime.onMessage && chrome.runtime.onMessage.addListener) {
			chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
				if (request === "getSource") { sendResponse("rplay"); return; }
				// The box widget is display-only and has no chat input.
				if (request === "focusChat") { sendResponse(false); return; }
				if (request && typeof request === "object") {
					if ("settings" in request) { settings = request.settings || {}; lastViewerCount = null; }
					if ("state" in request) { isExtensionOn = request.state; lastViewerCount = null; }
					checkViewers();
					sendResponse(true);
					return;
				}
				sendResponse(false);
			});
		}
	}
	scanPage();
	setInterval(scanPage, 1000);
	setInterval(checkViewers, 30000);
})();
