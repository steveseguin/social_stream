(() => {
	const SOURCE_TAG = "meetme-ws-interceptor";
	const WSEventType = { RECEIVE: "receive", SEND: "send", OPEN: "open", CLOSE: "close" };

	function normalizeToString(data) {
		if (typeof data === "string") return data;
		try {
			if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
				return new TextDecoder().decode(data);
			}
			return typeof data === "object" ? JSON.stringify(data) : String(data);
		} catch (e) {
			return String(data);
		}
	}

	function getUrl(url) {
		try {
			return typeof url === "string" ? url : url.href;
		} catch (e) {
			return "";
		}
	}

	function shouldIntercept(url) {
		var u = getUrl(url);
		return /^wss:\/\/video-live\.meetme\.com\//i.test(u) || /^wss:\/\/tmg-stream\.meetme\.com\//i.test(u);
	}

	const OriginalWS = window.WebSocket;
	const postMessage = window.postMessage.bind(window);

	function post(payload) {
		try {
			payload.source = SOURCE_TAG;
			postMessage(payload, window.location.origin);
		} catch (e) {}
	}

	function PatchedWebSocket(url, protocols) {
		const ws = protocols === undefined ? new OriginalWS(url) : new OriginalWS(url, protocols);
		if (!shouldIntercept(url)) return ws;

		const socketUrl = getUrl(url);
		ws.addEventListener("open", function () {
			post({ type: WSEventType.OPEN, url: socketUrl });
		});
		ws.addEventListener("close", function () {
			post({ type: WSEventType.CLOSE, url: socketUrl });
		});
		ws.addEventListener("message", function (event) {
			post({ type: WSEventType.RECEIVE, url: socketUrl, data: normalizeToString(event.data) });
		});

		const originalSend = ws.send;
		ws.send = function (data) {
			post({ type: WSEventType.SEND, url: socketUrl, data: normalizeToString(data) });
			return originalSend.call(this, data);
		};

		return ws;
	}

	PatchedWebSocket.prototype = OriginalWS.prototype;
	for (const prop in OriginalWS) {
		try { PatchedWebSocket[prop] = OriginalWS[prop]; } catch (e) {}
	}
	PatchedWebSocket.CONNECTING = OriginalWS.CONNECTING;
	PatchedWebSocket.OPEN = OriginalWS.OPEN;
	PatchedWebSocket.CLOSING = OriginalWS.CLOSING;
	PatchedWebSocket.CLOSED = OriginalWS.CLOSED;

	window.WebSocket = PatchedWebSocket;
})();
