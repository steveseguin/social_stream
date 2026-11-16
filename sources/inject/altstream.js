(function () {
	if (!/^(www\.)?altstream\.online$/.test(location.hostname) || window.__ssnAltstreamMessageReader) return;
	window.__ssnAltstreamMessageReader = true;
	// Share only the matching row's identity, avatar, timestamp and tip data with the content script.
	document.addEventListener("ssn-read-altstream-message", function (event) {
		try {
			var row = event.target;
			if (!row || !row.matches('[id^="chat-message-"], div.group.rounded-lg.border-emerald-500')) return;
			var key = Object.keys(row).find(function (key) { return key.indexOf("__reactFiber$") === 0; });
			var fiber = key && row[key];
			for (var depth = 0; fiber && depth < 6; depth++, fiber = fiber.return) {
				var message = fiber.memoizedProps && fiber.memoizedProps.message;
				if (!message || message.id === null || message.id === undefined || String(message.id) === "") continue;
				var tipText = typeof message.text === "string" && message.text.indexOf("[KOFI_TIP]:") === 0 ? message.text : "";
				if ("chat-message-" + message.id === row.id || (!row.id && tipText && row.matches("div.group.rounded-lg.border-emerald-500"))) {
					row.setAttribute("data-ssn-altstream-message", JSON.stringify({
						id: String(message.id),
						sentAt: typeof message.sentAt === "number" && Number.isFinite(message.sentAt) ? message.sentAt : null,
						authorUsername: typeof message.authorUsername === "string" ? message.authorUsername : "",
						authorImage: typeof message.authorImage === "string" ? message.authorImage : "",
						text: tipText
					}));
					return;
				}
			}
		} catch (e) {}
	});
})();
