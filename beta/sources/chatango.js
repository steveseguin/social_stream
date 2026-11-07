(function () {
	// Each Chatango frame captures its own chat; never traverse the parent page.
	if (!/(^|\.)chatango\.com$/i.test(location.hostname) || window.__ssnChatango) { return; }
	if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) { return; }
	window.__ssnChatango = true;

	var settings = {};
	var enabled = true;
	var seen = new WeakSet();
	var rowSelector = "#OM .msg";

	function escapeHtml(value) {
		return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	function imageUrl(value) {
		if (!value) { return ""; }
		try {
			var url = new URL(value, location.href);
			return /^(https?:)$/.test(url.protocol) ? url.href : "";
		} catch (e) { return ""; }
	}

	function content(node, sender) {
		if (node === sender) { return ""; }
		if (node.nodeType === 3) { return settings.textonlymode ? node.textContent : escapeHtml(node.textContent); }
		if (node.nodeType !== 1 || /^(SCRIPT|STYLE|BUTTON|SVG|IFRAME)$/.test(node.tagName)) { return ""; }
		if (node.tagName === "BR") { return settings.textonlymode ? "\n" : "<br>"; }
		if (node.tagName === "IMG") {
			var alt = node.getAttribute("alt") || node.getAttribute("title") || "";
			var src = imageUrl(node.getAttribute("src") || "");
			if (settings.textonlymode) { return alt || (src ? "[image]" : ""); }
			return src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt);
		}
		var result = "";
		for (var i = 0; i < node.childNodes.length; i++) {
			result += content(node.childNodes[i], sender);
		}
		if (node.tagName === "P" && node.nextElementSibling) { result += settings.textonlymode ? "\n" : "<br>"; }
		return result;
	}

	function processMessage(row) {
		if (!row.isConnected || seen.has(row)) { return; }
		if (!enabled) { seen.add(row); return; }
		var body = row.querySelector(".msg-fg > div:not(.user-thumb)");
		var firstParagraph = body && body.querySelector("p");
		// Registered names have c_username; anonymous/temporary names use a plain span.
		var sender = firstParagraph && firstParagraph.firstElementChild;
		if (!sender || sender.tagName !== "SPAN") { return; }
		var nameNode = sender.querySelector(".c_username") || sender;
		var name = nameNode.textContent.replace(/:\s*$/, "").trim();
		var message = content(body, sender).trim();
		if (!name || !message) { return; }

		var avatar = "";
		var img = row.querySelector(".user-thumb img");
		if (img) { avatar = imageUrl(img.getAttribute("src") || ""); }
		if (!avatar) {
			try {
				var canvas = row.querySelector(".user-thumb canvas");
				if (canvas && canvas.width > 1 && canvas.height > 1) { avatar = canvas.toDataURL(); }
			} catch (e) {}
		}
		var data = {
			platform: "chatango",
			type: "chatango",
			chatname: name,
			chatmessage: message,
			chatimg: avatar,
			nameColor: getComputedStyle(nameNode).color,
			chatbadges: "",
			backgroundColor: "",
			textColor: "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: !!settings.textonlymode
		};
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {});
			seen.add(row);
		} catch (e) {}
	}

	function collect(node, rows, descendants) {
		var element = node.nodeType === 1 ? node : node.parentElement;
		if (!element) { return; }
		var row = element.closest(rowSelector);
		if (row) { rows.add(row); }
		if (descendants && node.nodeType === 1) {
			node.querySelectorAll(rowSelector).forEach(function (item) { rows.add(item); });
		}
	}

	function start() {
		// Ignore rows already displayed when capture attaches. Track nodes, not text,
		// so two people (or one person twice) can send identical messages.
		document.querySelectorAll(rowSelector).forEach(function (row) { seen.add(row); });
		var observer = new MutationObserver(function (mutations) {
			var rows = new Set();
			mutations.forEach(function (mutation) {
				collect(mutation.target, rows);
				mutation.addedNodes.forEach(function (node) {
					// Chatango appends live rows and prepends older rows when scrolling back.
					if (mutation.target.id === "OM" && node.nodeType === 1 && node.matches(".msg") &&
						mutation.nextSibling && mutation.nextSibling.nodeType === 1 && mutation.nextSibling.matches(".msg")) {
						seen.add(node);
						return;
					}
					collect(node, rows, true);
				});
			});
			rows.forEach(processMessage);
		});
		observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
	}

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request === "getSource") { sendResponse("chatango"); return; }
		if (request === "focusChat") {
			var input = document.querySelector('#input-field[contenteditable="true"]');
			if (input) { input.focus(); }
			sendResponse(!!input);
			return;
		}
		if (request && typeof request === "object") {
			if ("settings" in request) { settings = request.settings || {}; }
			if ("state" in request) { enabled = !!request.state; }
			sendResponse(true);
			return;
		}
		sendResponse(false);
	});
	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		if (chrome.runtime.lastError) { return; }
		if (response) {
			settings = response.settings || {};
			if ("state" in response) { enabled = !!response.state; }
		}
	});
	start();
})();
