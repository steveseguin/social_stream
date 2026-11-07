(function () {
	"use strict";
	// Operator transport, not an audience feed. Keep the generic OBS API dock unchanged.
	window.SSNBreaksConnection = function () {
		var params = new URLSearchParams(location.search), session = params.get("session") || params.get("s") || params.get("id") || "";
		var native = /^(chrome|moz)-extension:$/.test(location.protocol) && typeof chrome !== "undefined" && chrome.runtime;
		// server2/server3 are the host's existing relay; server alone retains explicit API links.
		var route = params.has("server2") ? "server2" : params.has("server3") ? "server3" : params.has("server") ? "server" : "";
		var socket, bridge, peer = "", retry, stopped = false, pending = Object.create(null), chunks = Object.create(null);
		var counter = 0, client = Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
		var workspace = window.SSNCommerceDock(request, function (message) { status(message); });
		document.getElementById("sessionInput").value = session;
		function status(text) {
			document.getElementById("connectionText").textContent = text;
			document.getElementById("connectionStatus").className = "connection connecting";
		}
		function lost() {
			Object.keys(pending).forEach(function (id) {
				clearTimeout(pending[id].timer);
				pending[id].reject(new Error("Connection lost. Refresh to check whether the change was saved."));
				delete pending[id];
			});
			Object.keys(chunks).forEach(function (id) { clearTimeout(chunks[id].timer); });
			chunks = Object.create(null);
			workspace.disconnected();
			status("Waiting for host");
		}
		async function receive(packet) {
			if (!packet || typeof packet !== "object") return;
			// Existing host chunk format, with bounded assembly for large encrypted histories.
			if (packet.action === "ssnBridgeChunk") {
				if (typeof packet.chunkId !== "string" || packet.chunkId.length > 100 || !Number.isInteger(packet.total) || packet.total < 1 || packet.total > 24 ||
					!Number.isInteger(packet.index) || packet.index < 0 || packet.index >= packet.total || typeof packet.value !== "string" || packet.value.length > 12000) return;
				var entry = chunks[packet.chunkId];
				if (!entry) {
					if (Object.keys(chunks).length >= 8) return;
					entry = chunks[packet.chunkId] = { parts: [], total: packet.total, count: 0,
						timer: setTimeout(function () { delete chunks[packet.chunkId]; }, 15000) };
				}
				if (entry.total !== packet.total || entry.parts[packet.index] !== undefined) return;
				entry.parts[packet.index] = packet.value;
				if (++entry.count !== entry.total) return;
				clearTimeout(entry.timer); delete chunks[packet.chunkId];
				try { packet = JSON.parse(entry.parts.join("")); } catch (_) { return; }
			}
			var callback = packet.callback || (packet.type === "commandResult" && { get: packet.get, result: packet.result });
			var job = callback && pending[callback.get];
			if (!job) return;
			try {
				var value = await job.verify(callback.result);
				if (pending[callback.get] !== job) return;
				clearTimeout(job.timer); delete pending[callback.get]; job.resolve(value);
			} catch (_) { /* Unauthenticated replies cannot consume a request or lock the workspace. */ }
		}
		function sendPeer(packet) {
			bridge.contentWindow.postMessage({ sendData: { overlayNinja: packet }, type: "rpcs", UUID: peer }, "https://vdo.socialstream.ninja");
		}
		function request(action, value, verify) {
			return new Promise(function (resolve, reject) {
				if (!session || (!native && (route ? !socket || socket.readyState !== 1 : !peer))) {
					reject(new Error("Waiting for the Social Stream connection.")); return;
				}
				// This adapter only carries the workspace's sealed protocol, never general API commands.
				if (action !== "commerceControl" || !value || value.command !== "breakSecure" || typeof verify !== "function") {
					reject(new Error("Invalid Breaks request.")); return;
				}
				var id = "breaks-" + client + "-" + (++counter);
				pending[id] = { resolve: resolve, reject: reject, verify: verify, timer: setTimeout(function () {
					delete pending[id]; reject(new Error("No verified response. Check that Social Stream is on, or reopen Breaks from its menu."));
				}, 15000) };
				var packet = { protocol: 2, action: action, value: value, get: id, replyFormat: "commandResult" };
				try {
					if (native) {
						chrome.runtime.sendMessage({ cmd: "monetization", action: action, command: "breakSecure", data: value.data, session: session }, function (reply) {
							var error = chrome.runtime.lastError;
							if (error || (reply && reply.error)) {
								var job = pending[id]; if (!job) return;
								clearTimeout(job.timer); delete pending[id];
								job.reject(new Error(reply && reply.error || "Social Stream is unavailable. Reopen Breaks from its menu.")); return;
							}
							receive({ type: "commandResult", get: id, result: reply });
						});
					} else if (route) {
						if (route !== "server") packet.breaksRelay = true;
						socket.send(JSON.stringify(packet));
					} else {
						var text = JSON.stringify(packet);
						if (text.length <= 12000) sendPeer(packet);
						else for (var i = 0, total = Math.ceil(text.length / 12000); i < total; i++)
							sendPeer({ action: "ssnBridgeChunk", chunkId: id, index: i, total: total, value: text.slice(i * 12000, (i + 1) * 12000) });
					}
				} catch (error) { clearTimeout(pending[id].timer); delete pending[id]; reject(error); }
			});
		}
		function connect() {
			if (stopped) return;
			try { socket = new WebSocket(SocialStreamLocalServer.getRelayUrl(params, route,
				route === "server" ? "wss://io.socialstream.ninja/api" : "wss://io.socialstream.ninja/extension")); }
			catch (_) { status("Invalid server address"); return; }
			socket.onopen = function () {
				// 15 is reserved for authenticated Breaks replies; 4 remains the public audience feed.
				socket.send(JSON.stringify({ join: session.split(",")[0], out: route === "server" ? 1 : 3, in: route === "server" ? 2 : 15 }));
				workspace.refresh();
			};
			socket.onmessage = function (event) {
				if (typeof event.data !== "string" || event.data.length > 204800) return;
				try { receive(JSON.parse(event.data)); } catch (_) {}
			};
			socket.onerror = function () { socket.close(); };
			socket.onclose = function () { lost(); if (!stopped) retry = setTimeout(connect, 2000); };
		}
		status("Waiting for host");
		if (!session) return;
		if (native) workspace.refresh();
		else if (route) connect();
		else {
			bridge = document.createElement("iframe"); bridge.hidden = true; bridge.title = "SSN connection";
			bridge.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=" + encodeURIComponent(params.get("password") || "false") +
				"&solo&view=" + encodeURIComponent(session) + "&novideo&noaudio&label=breaks&cleanoutput&room=" + encodeURIComponent(session);
			window.addEventListener("message", function (event) {
				if (event.source !== bridge.contentWindow || event.origin !== "https://vdo.socialstream.ninja") return;
				var data = event.data || {};
				if ((data.action === "push-connection-info" || data.action === "view-connection-info") && data.value && data.value.label === "SocialStream") {
					if (peer && peer !== data.UUID) lost();
					peer = data.UUID; workspace.refresh();
				}
				if (data.action === "connection-ended" && data.UUID === peer) { peer = ""; lost(); }
				if (peer && data.UUID === peer && data.dataReceived) receive(data.dataReceived.overlayNinja);
			});
			document.body.appendChild(bridge);
		}
		window.addEventListener("beforeunload", function () {
			stopped = true; clearTimeout(retry); lost();
			if (socket) socket.close();
		});
	};
})();
