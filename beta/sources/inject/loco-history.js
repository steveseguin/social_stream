(function () {
	if (!/(^|\.)loco\.(com|gg)$/.test(location.hostname) || window.__ssnLocoHistory || !window.Response) return;
	window.__ssnLocoHistory = true;

	var history = new Map();
	// Loco renders its history and live replies with identical markup. Record only
	// the IDs from the history response before Loco renders it.
	var json = Response.prototype.json;
	Response.prototype.json = function () {
		var result = json.apply(this, arguments);
		var match = /^https:\/\/api\.loco\.com\/chat\/v2\/streams\/([^/?]+)\/history\/?(?:\?|$)/.exec(this.url);
		if (!match) return result;
		return result.then(function (data) {
			if (data && Array.isArray(data.chats)) {
				var ids = new Set();
				data.chats.forEach(function (chat) { if (chat && chat.id) ids.add(String(chat.id)); });
				history.set(match[1], ids);
				if (history.size > 8) history.delete(history.keys().next().value);
			}
			return data;
		});
	};

	document.addEventListener("ssn-loco-history-check", function (event) {
		var row = event.target;
		if (!row.closest) return;
		var list = row.closest(".chat-elements-list");
		var ids = list && history.get(list.id.replace(/^chat-(?:container|popup)-/, ""));
		if (ids && ids.has(row.getAttribute("data-chat-message-id"))) event.preventDefault();
	});
})();
