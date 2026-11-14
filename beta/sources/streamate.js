(function () {
	if (window.__ssnStreamateSource) return;
	window.__ssnStreamateSource = true;
	var enabled = false, seen = new Set(), ids = [];
	window.addEventListener("message", function (event) {
		if (event.source !== window || event.origin !== location.origin || !enabled) return;
		var packet = event.data;
		if (!packet || packet.source !== "ssn-streamate-capture") return;
		var room = location.pathname.match(/^\/cam\/([a-z0-9_-]+)\/?$/i), data = packet.payload;
		if (!room || packet.channel !== room[1].toLowerCase() || !data || data.type !== "streamate") return;
		if (typeof data.id !== "string" || data.id.length > 250 || typeof data.chatname !== "string" || typeof data.chatmessage !== "string" || data.chatmessage.length > 20000) return;
		if (seen.has(data.id)) return;
		seen.add(data.id); ids.push(data.id);
		if (ids.length > 10000) seen.delete(ids.shift());
		data.textonly = true;
		try { chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {}); } catch (_) {}
	});
	chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
		if (chrome.runtime.lastError) return;
		enabled = !!response && response.state !== false;
		window.postMessage({ source: "ssn-streamate-ready" }, location.origin);
	});
	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request === "getSource") { sendResponse("streamate"); return; }
		if (request === "focusChat") {
			var input = document.querySelector('[data-ta-locator="ChatForm__Input"]');
			if (input) input.focus();
			sendResponse(!!input); return;
		}
		if (request && typeof request === "object") {
			if ("state" in request) enabled = request.state !== false;
			sendResponse(true); return;
		}
		sendResponse(false);
	});
})();
