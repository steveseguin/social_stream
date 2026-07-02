(() => {
	const SOURCE_TAG = "vpzone-ws-interceptor";
	const WSEventType = { RECEIVE: "receive", SEND: "send" };

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

	const OriginalWS = window.WebSocket;
	const _postMessage = window.postMessage.bind(window);
	const post = (payload) => _postMessage({ ...payload, source: SOURCE_TAG }, window.location.origin);
	let exited = false;

	function safely(cb, onExit) {
		if (exited) return;
		try {
			return cb();
		} catch (e) {
			if (e instanceof Error && e.message === "Extension context invalidated.") {
				exited = true;
				if (onExit) onExit();
				return;
			}
			throw e;
		}
	}

	function shouldIntercept(url) {
		if (!url) return false;
		const u = typeof url === "string" ? url : url.href;
		return /^wss:\/\/chat(\.[a-z0-9-]+)*\.vpzone\.tv\//i.test(u);
	}

	function Patched(url, protocols) {
		const ws = protocols === undefined ? new OriginalWS(url) : new OriginalWS(url, protocols);

		if (!shouldIntercept(url)) return ws;

		const channel = (() => {
			try {
				const u = new URL(typeof url === "string" ? url : url.href);
				return u.searchParams.get("channel") || "";
			} catch (e) {
				return "";
			}
		})();

		const originalSend = ws.send;
		ws.send = function (data) {
			originalSend.call(this, data);
			safely(() => post({ type: WSEventType.SEND, channel, data: normalizeToString(data) }));
		};

		ws.addEventListener("message", (event) => {
			safely(() => post({ type: WSEventType.RECEIVE, channel, data: normalizeToString(event.data) }));
		});

		return ws;
	}

	Patched.prototype = OriginalWS.prototype;
	for (const prop in OriginalWS) {
		try { Patched[prop] = OriginalWS[prop]; } catch (e) {}
	}
	Patched.CONNECTING = OriginalWS.CONNECTING;
	Patched.OPEN = OriginalWS.OPEN;
	Patched.CLOSING = OriginalWS.CLOSING;
	Patched.CLOSED = OriginalWS.CLOSED;

	window.WebSocket = Patched;
	console.log("Social Stream: VPZone WebSocket interceptor loaded");
})();
