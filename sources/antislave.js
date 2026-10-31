(function () {
	function isChatPage() {
		return /^(www\.)?antislave\.com$/.test(location.hostname) && /^\/popout\/[^/]+\/chat\/?$/.test(location.pathname);
	}
	if (!isChatPage() || typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
	if (window.ssnAntislaveInjected) return;
	window.ssnAntislaveInjected = true;

	var settings = {};
	var enabled = true;
	var ready = false;
	var seen = new WeakSet();
	var rows = ".chat-scroll .msg";
	var stackingWarning = false;

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
		if (node.matches(".msg-ts, .msg-voice, .mstack, .kick-src, .msg-acts, .cht-gif-tag, .msg-held, .msg-banned, button, script, style, svg, [role='dialog']")) return "";
		if (node.tagName === "IMG") {
			var alt = node.getAttribute("alt") || "";
			var src = imageUrl(node);
			return settings.textonlymode ? alt : (src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '">' : escapeHtml(alt));
		}
		if (node.tagName === "BR") return settings.textonlymode ? "\n" : "<br>";
		if (settings.textonlymode && node.matches("a.cht-gif")) return node.href || "";
		var result = "";
		for (var i = 0; i < node.childNodes.length; i++) result += content(node.childNodes[i]);
		return result;
	}

	function processRow(row) {
		if (!ready || !isChatPage() || !row.isConnected) return;
		// Stacked rows omit the individual authors/IDs. Do not manufacture messages from their count.
		if (!stackingWarning && row.querySelector(".mstack")) {
			stackingWarning = true;
			console.warn('[Social Stream] Turn off AntiSlave chat settings > "Stack repeated messages" to capture each post.');
		}
		if (seen.has(row) || row.matches(".sys, .held, .sub-ev, .tip-ev") || row.querySelector(".msg-banned, .msg-held")) return;
		var name = row.querySelector(":scope > .u");
		var separator = row.querySelector(":scope > .u-sep");
		if (!name || !separator || !name.textContent.trim()) return;
		var body = "";
		for (var node = separator.nextSibling; node; node = node.nextSibling) body += content(node);
		if (!body.trim()) return;
		seen.add(row);
		if (!enabled) return;
		var badges = [];
		for (var badge = row.firstElementChild; badge && badge !== name; badge = badge.nextElementSibling) {
			var images = badge.tagName === "IMG" ? [badge] : badge.querySelectorAll("img");
			for (var i = 0; i < images.length; i++) {
				var url = imageUrl(images[i]);
				if (url) badges.push(url);
			}
		}
		chrome.runtime.sendMessage(chrome.runtime.id, { message: {
			chatname: name.textContent.trim(),
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
			type: "antislave"
		} }, function () { void chrome.runtime.lastError; });
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
	observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "src"] });

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request === "getSource") { sendResponse("antislave"); return; }
		if (request === "focusChat") {
			var input = isChatPage() && document.querySelector('.w-chat .cf-input[contenteditable="true"], .w-chat textarea:not([disabled]):not([readonly])');
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
