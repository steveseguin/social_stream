(function () {
	"use strict";

	if (window.__ssnL2Games) return;
	if (location.hostname !== "l2.games" || !/^\/(?:en\/)?popout\/chat\/[^/]+\/?$/.test(location.pathname)) return;
	window.__ssnL2Games = true;

	var settings = {};
	var container = null;
	var observer = null;
	var seen = new WeakSet();
	var channel = location.pathname;
	var containerSelector = "aside .overflow-y-auto.scroll-thin";

	function escapeHtml(value) {
		return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	function processMessage(row) {
		if (seen.has(row)) return;
		var author = row.querySelector('a[href^="/@"]');
		var name = author && author.querySelector("span.truncate");
		// The first span after the author is the colon, the second is the message.
		var separator = author && author.nextElementSibling;
		var message = separator && separator.nextElementSibling;
		if (!name || !separator || separator.textContent.trim() !== ":" || !message) return;
		var chatname = name.textContent.trim();
		var text = message.textContent.trim();
		if (!chatname || !text) return;
		seen.add(row);
		var avatar = author.querySelector("img[src]");
		var chatimg = avatar && /^https?:$/.test(new URL(avatar.src).protocol) ? avatar.src : "";
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { message: {
				chatname: chatname,
				chatmessage: settings.textonlymode ? text : escapeHtml(text),
				chatimg: chatimg,
				chatbadges: "",
				nameColor: "",
				backgroundColor: "",
				textColor: "",
				hasDonation: "",
				membership: "",
				contentimg: "",
				textonly: !!settings.textonlymode,
				type: "l2games"
			}}, function () {});
		} catch (e) {}
	}

	function scanMessages(mutations) {
		if (location.pathname !== channel || !container || !container.isConnected) {
			attachChat();
			return;
		}
		mutations.forEach(function (mutation) {
			if (mutation.target !== container) return;
			Array.from(mutation.addedNodes).forEach(function (row) {
				if (row.nodeType === 1) processMessage(row);
			});
		});
		Array.from(container.children).forEach(processMessage);
	}

	function attachChat() {
		var next = /^\/(?:en\/)?popout\/chat\/[^/]+\/?$/.test(location.pathname)
			? document.querySelector(containerSelector) : null;
		if (next === container && channel === location.pathname) return;
		if (observer) observer.disconnect();
		container = next;
		channel = location.pathname;
		if (!container) return;
		// Existing rows are history. Vue keeps row nodes when updating its keyed list;
		// track nodes, not author/text, so identical new messages remain distinct.
		Array.from(container.children).forEach(function (row) { seen.add(row); });
		observer = new MutationObserver(scanMessages);
		observer.observe(container, { childList: true, subtree: true, characterData: true });
	}

	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		if (chrome.runtime.lastError) return;
		if (response && response.settings) settings = response.settings;
	});
	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request === "getSource") {
			sendResponse("l2games");
			return;
		}
		if (request === "focusChat") {
			var input = container && container.closest("aside").querySelector('form input[type="text"]');
			if (input && !input.disabled) {
				input.focus();
				sendResponse(true);
			} else {
				sendResponse(false);
			}
			return;
		}
		if (request && typeof request === "object" && request.settings) {
			settings = request.settings;
			sendResponse(true);
			return;
		}
		sendResponse(false);
	});

	attachChat();
	setInterval(attachChat, 1000);
})();
