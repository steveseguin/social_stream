(function () {
	if (location.protocol !== "https:" ||
		["vaughn.live", "www.vaughn.live"].indexOf(location.hostname) === -1 || window.__SSN_VAUGHN_ACTIVE__) return;
	window.__SSN_VAUGHN_ACTIVE__ = true;

	var settings = {};
	var enabled = true;
	var container = null;
	var observer = null;
	var loadingObserver = null;
	var loading = null;
	var waitingForHistory = false;
	var seen = new Set();
	var processed = new WeakSet();
	var messageSelector = '.vs_chatv9_msg_body[id^="chatv9msg-"], .vs_chatv9_msg_body_multi[id^="chatv9msg-"]';

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
		if (node.nodeType === 3) return settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
		if (node.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|SVG|BUTTON)$/.test(node.nodeName)) return "";
		if (node.classList.contains("vs_chatv9_urlpreview")) return "";
		if (node.nodeName === "BR") return settings.textonlymode ? "\n" : "<br>";
		if (node.nodeName === "IMG") {
			var trigger = node.closest("[title]");
			var alt = node.getAttribute("alt") || (trigger && trigger.getAttribute("title")) || "";
			if (settings.textonlymode) return alt;
			// Vaughn emotes use clear.png with the actual image supplied by CSS.
			var background = window.getComputedStyle(node).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);
			var src = resourceUrl(background ? background[1] : node.getAttribute("src"));
			return src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		var content = "";
		for (var i = 0; i < node.childNodes.length; i++) content += messageContent(node.childNodes[i]);
		if (node.nodeName === "A" && !settings.textonlymode) {
			var href = resourceUrl(node.getAttribute("href"));
			if (href) return '<a href="' + escapeHtml(href) + '">' + content + '</a>';
		}
		return content;
	}

	function badgesFromRow(row) {
		var badges = [];
		row.querySelectorAll(".vs_chatv9_msg_badges img, .vs_chatv9_msg_badges svg").forEach(function (badge) {
			if (badge.nodeName.toLowerCase() === "img") {
				var src = resourceUrl(badge.getAttribute("src"));
				if (src) badges.push(src);
			} else {
				var clone = badge.cloneNode(true);
				clone.setAttribute("width", "16");
				clone.setAttribute("height", "16");
				clone.setAttribute("fill", window.getComputedStyle(badge).fill);
				var shapes = badge.querySelectorAll("path, polygon, circle, rect");
				clone.querySelectorAll("path, polygon, circle, rect").forEach(function (shape, index) {
					shape.setAttribute("fill", window.getComputedStyle(shapes[index]).fill);
				});
				badges.push({ type: "svg", html: clone.outerHTML });
			}
		});
		return badges;
	}

	function remember(body) {
		processed.add(body);
		seen.add(body.id);
		if (seen.size > 1000) seen.delete(seen.values().next().value);
	}

	function scanMessages(skip) {
		if (!container) return;
		// HISTORYEND hides this overlay after the server has rendered its backlog.
		if (waitingForHistory) {
			skip = true;
			if (!loading || window.getComputedStyle(loading).display === "none") waitingForHistory = false;
		}
		container.querySelectorAll(messageSelector).forEach(function (body) {
			// MSGID changes a sender's temporary ID on acknowledgement. Remember the
			// new ID too, without recapturing the same element or a later clone of it.
			if (skip || !enabled || processed.has(body) || seen.has(body.id)) {
				remember(body);
				return;
			}
			var row = body.closest(".vs_chatv9_msg");
			if (!row) return;
			var nameElement = row.querySelector(".vs_chatv9_msg_username > span, .vs_chatv9_msg_username");
			var name = nameElement ? nameElement.textContent.trim() : "";
			// Compact mode puts a plain username immediately before the message span.
			if (!name && body.previousSibling && body.previousSibling.nodeType === 3) {
				name = body.previousSibling.textContent.replace(/:\s*$/, "").trim();
			}
			var message = messageContent(body).trim();
			if (!name || !message) return;
			var avatar = row.querySelector("img.vs_chatv9_msg_profile_photo");
			remember(body);
			sendToApp({ message: {
				chatname: name,
				chatmessage: message,
				chatimg: avatar ? resourceUrl(avatar.getAttribute("src")) : "",
				chatbadges: badgesFromRow(row),
				nameColor: nameElement ? window.getComputedStyle(nameElement.querySelector("span") || nameElement).color : "",
				backgroundColor: "", textColor: "", contentimg: "", hasDonation: "", membership: "",
				textonly: !!settings.textonlymode,
				platform: "vaughn", type: "vaughn"
			} });
		});
	}

	function scanPage() {
		var next = document.getElementById("vs_chatv9_chatbox");
		if (next === container) return;
		if (observer) observer.disconnect();
		if (loadingObserver) loadingObserver.disconnect();
		container = next;
		if (!container) return;
		loading = document.querySelector(".vs_chatv9_overlay");
		waitingForHistory = !!loading && window.getComputedStyle(loading).display !== "none";
		scanMessages(true);
		observer = new MutationObserver(function () { scanMessages(false); });
		observer.observe(container, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["id"] });
		if (waitingForHistory) {
			loadingObserver = new MutationObserver(function () {
				scanMessages(false);
				if (!waitingForHistory) loadingObserver.disconnect();
			});
			loadingObserver.observe(loading, { attributes: true, attributeFilter: ["style", "class"] });
		}
	}

	if (hasRuntime()) {
		chrome.runtime.onMessage.addListener(function (request, sender, respond) {
			if (request === "getSource") { respond("vaughn"); return; }
			if (request === "focusChat") {
				var input = document.getElementById("vs_chatv9_input_box");
				if (input && !input.disabled && !input.readOnly) { input.focus(); respond(true); return; }
			}
			if (request && typeof request === "object") {
				if ("settings" in request) settings = request.settings || {};
				if ("state" in request) { scanMessages(true); enabled = !!request.state; }
				respond(true);
				return;
			}
			respond(false);
		});
		sendToApp({ getSettings: true }, function (response) {
			if (chrome.runtime.lastError || !response) return;
			settings = response.settings || {};
			if ("state" in response) enabled = !!response.state;
		});
	}
	scanPage();
	setInterval(scanPage, 1000);
})();
