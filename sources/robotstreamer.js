(function () {
	if (location.protocol !== "https:" || !/^(www\.)?robotstreamer\.com$/.test(location.hostname) ||
		location.pathname !== "/chat.html" || !/^\d+$/.test(new URLSearchParams(location.search).get("c") || "") ||
		window.__SSN_ROBOTSTREAMER_ACTIVE__) return;
	window.__SSN_ROBOTSTREAMER_ACTIVE__ = true;
	var settings = {}, enabled = true, container = null, observer = null, ready = false;
	var pageURL = location.href;
	var processed = new WeakSet();

	function hasRuntime() {
		return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
	}
	function send(payload, callback) {
		try {
			if (hasRuntime()) chrome.runtime.sendMessage(chrome.runtime.id, payload, callback || function () {});
			else if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, null, window.__SSAPP_TAB_ID__);
			}
		} catch (e) {}
	}
	function escapeHtml(value) {
		return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}
	function resourceUrl(value) {
		try {
			if (!value) return "";
			var url = new URL(value, location.href);
			return /^https?:$/.test(url.protocol) ? url.href : "";
		} catch (e) { return ""; }
	}
	function content(node) {
		if (node.nodeType === 3) return settings.textonlymode ? node.textContent : escapeHtml(node.textContent);
		if (node.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|SVG|BUTTON)$/.test(node.nodeName)) return "";
		if (node.nodeName === "BR") return settings.textonlymode ? "\n" : "<br>";
		if (node.nodeName === "IMG") {
			var src = resourceUrl(node.getAttribute("src"));
			var alt = node.getAttribute("alt") || node.getAttribute("title") || "";
			if (!alt && src) alt = src.split("/").pop().replace(/\.[^.]+$/, "");
			if (settings.textonlymode) return alt;
			return src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		var result = "";
		for (var i = 0; i < node.childNodes.length; i++) result += content(node.childNodes[i]);
		return result;
	}
	function scan(skip) {
		if (!container || location.href !== pageURL) return;
		container.querySelectorAll(".message-content > span").forEach(function (body) {
			if (processed.has(body) || body.hasAttribute("data-ssn-robotstreamer-seen")) return;
			var row = body.closest(".message");
			var author = row && row.querySelector(".message-info-name");
			if (!author) return;
			var name = author.textContent.trim();
			var message = content(body).trim();
			if (!name || !message) return; // A partially populated row can finish later.
			processed.add(body);
			body.setAttribute("data-ssn-robotstreamer-seen", "1");
			// The server sends its welcome after rendering history. Keep history out even
			// when it arrives after this content script has attached to an empty chat.
			if (name === "[RS BOT]" && /^Welcome\. Use \/help for help\./.test(body.textContent.trim())) ready = true;
			if (skip || !ready || !enabled || /^\[/.test(name)) return;
			var avatar = row.querySelector(".message-info-avatar img");
			var badges = [];
			row.querySelectorAll(".message-icons img").forEach(function (img) {
				var src = resourceUrl(img.getAttribute("src"));
				if (src) badges.push(src);
			});
			send({ message: {
				platform: "robotstreamer", type: "robotstreamer", chatname: name, chatmessage: message,
				userid: row.getAttribute("userid") || "", chatimg: avatar ? resourceUrl(avatar.getAttribute("src")) : "",
				chatbadges: badges, nameColor: window.getComputedStyle(author).color || "",
				backgroundColor: "", textColor: "", contentimg: "", hasDonation: "", membership: "",
				textonly: !!settings.textonlymode
			} });
		});
	}
	function attach() {
		if (location.href !== pageURL) return;
		var next = document.getElementById("messages-container");
		if (next === container) return;
		if (observer) observer.disconnect();
		var first = !container;
		container = next;
		if (!container) return;
		if (first) {
			scan(true);
		} else scan(false);
		observer = new MutationObserver(function () { scan(false); });
		observer.observe(container, { childList: true, subtree: true, characterData: true });
	}
	if (hasRuntime()) {
		chrome.runtime.onMessage.addListener(function (request, sender, respond) {
			if (request === "getSource") { respond("robotstreamer"); return; }
			if (request === "focusChat") {
				var input = document.querySelector(".chat-input-chatbox-input");
				if (input && !input.disabled && !input.readOnly) { input.focus(); respond(true); return; }
			}
			if (request && typeof request === "object") {
				if ("settings" in request) settings = request.settings || {};
				if ("state" in request) { scan(true); enabled = !!request.state; }
				respond(true); return;
			}
			respond(false);
		});
		send({ getSettings: true }, function (response) {
			if (!response) return;
			settings = response.settings || {};
			if ("state" in response) enabled = !!response.state;
		});
	}
	attach();
	setInterval(attach, 1000);
})();
