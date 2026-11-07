(function () {
	if (window.__SSN_JOYSTICK_WS_INTERCEPTOR__) return;
	window.__SSN_JOYSTICK_WS_INTERCEPTOR__ = true;

	var SOURCE = "joystick-ws-interceptor";
	var OriginalWebSocket = window.WebSocket;
	var postMessage = window.postMessage.bind(window);

	function toText(value) {
		if (typeof value === "string") return value;
		try {
			if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
				return new TextDecoder().decode(value);
			}
			return typeof value === "object" ? JSON.stringify(value) : String(value);
		} catch (error) {
			return "";
		}
	}

	function shouldIntercept(url) {
		try {
			var value = typeof url === "string" ? url : url && url.href;
			return /^wss:\/\/api\.joystick\.tv\/cable(?:\?|$)/i.test(value || "");
		} catch (error) {
			return false;
		}
	}

	function PatchedWebSocket(url, protocols) {
		var socket = protocols === undefined
			? new OriginalWebSocket(url)
			: new OriginalWebSocket(url, protocols);

		if (shouldIntercept(url)) {
			socket.addEventListener("message", function (event) {
				var data = toText(event.data);
				if (!data) return;
				try {
					postMessage({ source: SOURCE, type: "receive", data: data }, window.location.origin);
				} catch (error) {}
			});
		}

		return socket;
	}

	PatchedWebSocket.prototype = OriginalWebSocket.prototype;
	try { Object.setPrototypeOf(PatchedWebSocket, OriginalWebSocket); } catch (error) {}
	["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function (key) {
		try { PatchedWebSocket[key] = OriginalWebSocket[key]; } catch (error) {}
	});

	window.WebSocket = PatchedWebSocket;
	console.log("Social Stream: Joystick WebSocket interceptor loaded");
})();
