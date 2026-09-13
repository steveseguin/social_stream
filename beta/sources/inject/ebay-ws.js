(function () {
	// Extension MAIN-world observer. SSApp uses its buffered WebSocket monitor.
	if (window.__ssnEbaySocketObserver || (window.ninjafy && window.ninjafy.onWebSocketMessage)) return;
	window.__ssnEbaySocketObserver = true;
	var NativeWebSocket = window.WebSocket;
	var pending = [];
	var ready = false;
	function deliver(data) {
		if (!ready) {
			pending.push(data);
			if (pending.length > 250) pending.shift();
			return;
		}
		window.postMessage({ source: "ebay-ws-observer", data: data }, location.origin);
	}
	window.addEventListener("message", function (event) {
		if (event.source !== window || event.origin !== location.origin || !event.data || event.data.source !== "ebay-ws-ready") return;
		ready = true;
		pending.splice(0).forEach(deliver);
	});
	window.postMessage({ source: "ebay-ws-available" }, location.origin);
	window.WebSocket = new Proxy(NativeWebSocket, {
		construct: function (target, args) {
			var socket = Reflect.construct(target, args);
			try {
				if (new URL(socket.url).hostname !== "fanout.ebay.com") return socket;
				socket.addEventListener("message", function (event) {
					if (typeof event.data === "string") deliver(event.data);
				});
			} catch (e) {}
			return socket;
		}
	});
})();
