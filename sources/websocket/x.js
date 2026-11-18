(function () {
	"use strict";
	// The packaged page has a runtime; on hosted pages SSN injects this script.
	if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id ||
		typeof chrome.runtime.sendMessage !== "function" || window.__ssnXLive) return;
	window.__ssnXLive = true;

	function init() {
		var get = function (id) { return document.getElementById(id); };
		var params = new URLSearchParams(location.search);
		var channel = (params.get("channel") || "").replace(/^@/, "").toLowerCase();
		var relay;
		try { relay = new URL(params.get("relay") || "ws://127.0.0.1:38178/x/live"); } catch (_) {}
		if (!relay || (relay.protocol !== "wss:" && relay.href !== "ws://127.0.0.1:38178/x/live")) {
			get("status").textContent = "Invalid X relay address."; return;
		}
		var storageKey = "ssn.x.live:" + relay.href + ":" + channel;
		var ticket = "";
		try { ticket = localStorage.getItem(storageKey) || ""; } catch (_) {}
		try { get("sync-delete").checked = localStorage.getItem(storageKey + ":sync-delete") === "1"; } catch (_) {}
		get("sync-delete").onchange = function () {
			try { localStorage.setItem(storageKey + ":sync-delete", this.checked ? "1" : "0"); } catch (_) {}
		};
		var sourceName = channel, sourceImg = "";
		var socket, retry, delay = 1000, closing = false, account = "", broadcast = "", streaming = false;
		var enabled = false, settings = {}, seen = new Map(), pending = new Map(), nextId = 0;
		var rows = new Map();
		var reportedViewers = false;
		function setting(name) {
			var value = settings[name];
			return value === true || !!(value && value.setting === true);
		}
		function wantsViewers() { return enabled && (setting("showviewercount") || setting("hypemode")); }
		function clearViewers() {
			if (reportedViewers) forward({ message: { type: "x", event: "viewer_update", meta: 0 } });
			reportedViewers = false;
		}
		function forward(payload, cb) {
			chrome.runtime.sendMessage(chrome.runtime.id, payload, cb || function () {});
		}
		function status(message, code) {
			get("status").textContent = message;
			forward({ wssStatus: { platform: "x", status: code, message: message } });
		}
		function update() {
			get("compose").hidden = !(account && broadcast && streaming);
			get("forget").hidden = !ticket;
			get("moderation").hidden = !account;
			if (account) status(!streaming ? "Connecting to X activity..." :
				broadcast ? "Live on @" + account : "Waiting for @" + account + " to go live.",
				streaming ? "connected" : "ready");
		}
		function write(data) {
			if (!socket || socket.readyState !== WebSocket.OPEN) return false;
			socket.send(JSON.stringify(data));
			return true;
		}
		function chat(text) {
			if (!account || !streaming || !broadcast || typeof text !== "string" || !text.trim() || Array.from(text).length > 140) {
				status("Send 1 to 140 characters during a live X broadcast.", "warn");
				return Promise.resolve(false);
			}
			return command({ op: "send", text: text, broadcast: broadcast });
		}
		function command(data) {
			var id = ++nextId;
			data.id = id;
			if (!write(data)) return Promise.resolve(false);
			return new Promise(function (resolve) {
				var timer = setTimeout(function () {
					pending.delete(id); status("X did not confirm the request.", "warn"); resolve(false);
				}, 20000);
				pending.set(id, function (ok) { clearTimeout(timer); pending.delete(id); resolve(ok); });
			});
		}
		function applySettings(value) {
			if (!value) return;
			var watched = wantsViewers();
			if ("settings" in value) settings = value.settings || {};
			if ("state" in value) enabled = !!value.state;
			if (watched !== wantsViewers()) {
				if (!wantsViewers()) clearViewers();
				write({ op: "watchViewers", enabled: wantsViewers() });
			}
		}
		chrome.runtime.onMessage.addListener(function (req, sender, respond) {
			if (req === "getSource") { respond(setting("detweet") ? "twitter" : "x"); return; }
			if (req && req.type === "SEND_MESSAGE") { chat(req.message).then(respond); return true; }
			if (req && req.type === "SOURCE_CONTROL" && req.platform === "x" && req.control === "deleteMessage") {
				var id = req.payload && req.payload.messageId;
				var known = seen.get(id);
				if (!enabled || !account || !broadcast || !get("sync-delete").checked || !known || known.removed || known.deleting ||
					known.type !== req.payload.type || id.indexOf(broadcast + ":") !== 0) { respond(false); return; }
				known.deleting = true;
				command({ op: "delete", broadcast: broadcast, messageId: id.slice(broadcast.length + 1) }).then(function (ok) {
					if (!ok) known.deleting = false;
					respond(ok);
				});
				return true;
			}
			if (req && typeof req === "object") applySettings(req);
			respond(false);
		});
		forward({ getSettings: true }, applySettings);
		function escapeText(text) { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
		function receive(event, p, createdAt) {
			if (!p || typeof p.broadcast_id !== "string" || typeof p.message_id !== "string") return;
			var id = p.broadcast_id + ":" + p.message_id;
			var prior = seen.get(id);
			if (prior && (event !== "broadcast.chat.remove" || prior.removed)) return;
			var removed = event === "broadcast.chat.remove";
			var type = prior ? prior.type : setting("detweet") ? "twitter" : "x";
			var meta = { messageId: id, streamUsername: channel };
			if (!removed && (event !== "broadcast.chat" || !p.author || !p.author.data || typeof p.message !== "string")) return;
			seen.set(id, { type: type, removed: removed });
			if (seen.size > 20000) seen.delete(seen.keys().next().value);
			if (removed) {
				if (rows.has(id)) { rows.get(id).element.remove(); rows.delete(id); }
				if (enabled) forward({ "delete": { type: type, meta: meta } });
				return;
			}
			var user = p.author.data;
			var author = user.name || user.username || "";
			var replyId = typeof p.reply_to === "string" && !setting("excludeReplyingTo") ? p.broadcast_id + ":" + p.reply_to : "";
			var parent = rows.get(replyId);
			var row = document.createElement("div");
			row.textContent = author + ": " + p.message;
			get("messages").appendChild(row);
			var capture = enabled && (!setting("memberchatonly") || p.is_subscriber === true);
			rows.set(id, { element: row, author: author, text: p.message, captured: capture });
			if (rows.size > 100) { var oldest = rows.keys().next().value; rows.get(oldest).element.remove(); rows.delete(oldest); }
			if (capture) {
				var textonly = setting("textonlymode");
				var data = { type: type, chatname: author, username: user.username, userid: user.id,
					sourceName: sourceName, sourceImg: sourceImg, videoid: p.broadcast_id,
					chatimg: user.profile_image_url || "", chatmessage: textonly ? p.message : escapeText(p.message), textonly: textonly, meta: meta };
				var timestamp = Date.parse(createdAt);
				if (Number.isFinite(timestamp)) data.timestamp = timestamp;
				if (p.is_moderator === true) data.mod = true;
				if (p.is_subscriber === true) { data.member = true; data.membership = "Subscriber"; }
				if (replyId) {
					meta.reply = { messageId: replyId };
					if (parent && parent.captured) {
						meta.reply.author = parent.author;
						meta.reply.text = parent.text;
						data.initial = parent.author + ": " + parent.text;
						data.reply = data.chatmessage;
						data.chatmessage = textonly ? data.initial + ": " + data.reply : "<i><small>" + escapeText(data.initial) + ":&nbsp;</small></i> " + data.reply;
					}
				}
				forward({ message: data });
			}
		}
		function connect() {
			socket = new WebSocket(relay.href);
			socket.onopen = function () {
				if (wantsViewers()) write({ op: "watchViewers", enabled: true });
				get("login").hidden = !!ticket;
				if (ticket) write({ op: "resume", ticket: ticket, channel: channel });
				else status("Link @" + channel + " to receive live chat.", "signin_required");
			};
			socket.onmessage = function (e) {
				var m = JSON.parse(e.data);
				if (m.ticket) { ticket = m.ticket; try { localStorage.setItem(storageKey, ticket); } catch (_) {} }
				if (m.sourceName) { sourceName = m.sourceName; sourceImg = m.sourceImg || ""; }
				if (m.authorize) {
					var url = new URL(m.authorize);
					if (url.origin !== "https://x.com" || url.pathname !== "/i/oauth2/authorize") return;
					get("authorize").href = url.href;
					get("authorize").hidden = get("pair").hidden = false;
					status("Continue to X, then enter the sign-in code here.", "ready");
				}
				if (m.account) {
					account = m.account;
					delay = 1000;
					get("authorize").hidden = get("pair").hidden = get("login").hidden = true;
					get("code").value = "";
				}
				if ("broadcast" in m && m.broadcast !== broadcast) { clearViewers(); broadcast = m.broadcast; }
				if (wantsViewers() && broadcast && m.viewerBroadcast === broadcast && Number.isSafeInteger(m.viewerCount) && m.viewerCount >= 0) {
					forward({ message: { type: "x", event: "viewer_update", meta: m.viewerCount } });
					reportedViewers = m.viewerCount > 0;
				}
				if ("stream" in m) streaming = m.stream;
				if (m.account || "broadcast" in m || "stream" in m) update();
				if (m.warning) {
					if (m.signIn) get("login").hidden = false;
					if (m.retryMs > delay) delay = m.retryMs;
					status(m.warning, m.signIn ? "signin_required" : "warn");
				}
				if (m.event) receive(m.event, m.payload, m.createdAt);
				var done = pending.get(m.sent || m.failed);
				if (done) done(!!m.sent);
			};
			socket.onclose = function () {
				clearViewers();
				account = broadcast = ""; streaming = false; update();
				get("login").hidden = get("authorize").hidden = get("pair").hidden = true;
				pending.forEach(function (done) { done(false); });
				if (closing) return;
				status("X relay disconnected. Reconnecting...", "warn");
				retry = setTimeout(connect, delay); delay = Math.min(delay * 2, 30000);
			};
		}
		get("login").onclick = function () { write({ op: "login", channel: channel }); };
		get("pair").onsubmit = function (e) { e.preventDefault(); write({ op: "pair", code: get("code").value.trim() }); };
		get("compose").onsubmit = function (e) {
			e.preventDefault(); var input = get("message"), text = input.value;
			chat(text).then(function (ok) { if (ok && input.value === text) input.value = ""; });
		};
		get("forget").onclick = function () {
			ticket = ""; try { localStorage.removeItem(storageKey); } catch (_) {}
			location.reload();
		};
		window.addEventListener("pagehide", function () { closing = true; clearViewers(); clearTimeout(retry); if (socket) socket.close(); });
		if (!/^[a-z0-9_]{1,15}$/.test(channel)) { status("Add the source using your X account handle.", "error"); return; }
		connect();
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
})();
