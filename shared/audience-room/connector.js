/* Packaged, room-scoped connector. No code or action configuration comes from the audience. */
(function (global) {
	"use strict";
	function id() {
		var bytes = new Uint8Array(16);
		global.crypto.getRandomValues(bytes);
		return Array.from(bytes, function (b) {
			return b.toString(16).padStart(2, "0");
		}).join("");
	}
	function Connector(options) {
		this.options = options;
		this.api = options.api || "https://api.ninjachatter.com";
		var url = new URL(this.api);
		if (url.origin !== this.api || (url.origin !== "https://api.ninjachatter.com" && !["127.0.0.1", "localhost"].includes(url.hostname))) throw Error("Unsupported service origin");
		this.instance = id();
		this.config = { sources: [], cheer: false, receipts: [] };
		this.state = "disconnected";
		this.generation = 0;
		this.seen = new Set();
		this.running = new Set();
		this.ws = null;
		this.timer = null;
		this.session = null;
		this.paused = false;
		this.inflight = 0;
	}
	Connector.prototype.status = function () {
		return { state: this.state, room: this.config.room || null, paired: !!this.config.credential, code: this.pairing ? this.pairing.code : null, sources: this.config.sources || [], cheer: !!this.config.cheer };
	};
	Connector.prototype.notify = function (state) {
		this.state = state;
		if (this.options.onState) this.options.onState(this.status());
	};
	Connector.prototype.request = async function (path, body, key) {
		var abort = new AbortController(),
			timer = setTimeout(function () {
				abort.abort();
			}, 8000);
		try {
			var res = await (this.options.fetch || global.fetch)(this.api + path, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, key ? { Authorization: "Bearer " + key } : {}), body: JSON.stringify(body || {}), redirect: "error", signal: abort.signal, cache: "no-store" });
			if (!res.ok) {
				var e = Error("Audience connection request failed");
				e.status = res.status;
				throw e;
			}
			return await res.json();
		} finally {
			clearTimeout(timer);
		}
	};
	Connector.prototype.op = function (name, body) {
		return this.request("/community/rooms/" + this.config.room + "/" + name, body, this.session);
	};
	Connector.prototype.init = async function () {
		var stored = await this.options.storage.load();
		if (stored && typeof stored === "object") this.config = Object.assign(this.config, stored);
		this.config.sources = Array.isArray(this.config.sources)
			? this.config.sources
					.filter(function (s) {
						return typeof s === "string" && /^[a-z0-9_]{1,30}$/.test(s);
					})
					.slice(0, 10)
			: [];
		this.config.cheer = this.config.cheer === true;
		this.config.receipts = Array.isArray(this.config.receipts) ? this.config.receipts.slice(-256) : [];
		this.paused = this.config.paused === true;
		if (this.paused) this.notify("paused");
		else if (this.config.credential) this.connect();
	};
	Connector.prototype.beginPair = async function () {
		if (this.config.credential) throw Error("Disconnect the current room first");
		this.pairing = await this.request("/community/pair", { label: "Social Stream Ninja" });
		this.pairing.deadline = Date.now() + 290000;
		this.notify("awaiting_approval");
		this.pollPair();
		return this.status();
	};
	Connector.prototype.pollPair = async function () {
		var self = this,
			pair = this.pairing;
		if (!pair) return;
		if (Date.now() > pair.deadline) {
			this.pairing = null;
			this.notify("pairing_expired");
			return;
		}
		try {
			var result = await this.request("/community/pair/" + pair.code, { polling_secret: pair.polling_secret });
			if (this.pairing !== pair) return;
			if (result.credential) {
				this.config.room = result.room;
				this.config.credential = result.credential;
				this.pairing = null;
				await this.options.storage.save(this.config);
				this.paused = false;
				this.connect();
				return;
			}
		} catch (e) {
			if (e.status === 404) {
				this.pairing = null;
				this.notify("pairing_expired");
				return;
			}
		}
		if (this.pairing === pair)
			this.timer = setTimeout(function () {
				self.pollPair();
			}, 3000);
	};
	Connector.prototype.stop = function () {
		this.generation++;
		clearTimeout(this.timer);
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.close();
			this.ws = null;
		}
		this.session = null;
	};
	Connector.prototype.pause = async function () {
		this.paused = true;
		this.config.paused = true;
		this.pairing = null;
		this.stop();
		this.notify("paused");
		await this.options.storage.save(this.config);
	};
	Connector.prototype.resume = async function () {
		this.config.paused = false;
		await this.options.storage.save(this.config);
		this.paused = false;
		this.connect();
	};
	Connector.prototype.disconnect = async function () {
		await this.pause();
		this.pairing = null;
		this.config = { sources: [], cheer: false, receipts: [] };
		await this.options.storage.save(this.config);
		this.notify("disconnected");
	};
	Connector.prototype.configure = async function (input) {
		if (
			!Array.isArray(input.sources) ||
			input.sources.length > 10 ||
			!input.sources.every(function (s) {
				return typeof s === "string" && /^[a-z0-9_]{1,30}$/.test(s);
			}) ||
			typeof input.cheer !== "boolean"
		)
			throw Error("Invalid audience settings");
		const next = Object.assign({}, this.config, { sources: input.sources, cheer: input.cheer });
		await this.options.storage.save(next);
		this.config.sources = input.sources;
		this.config.cheer = input.cheer;
		if (this.config.credential && !this.paused) this.connect();
	};
	Connector.prototype.connect = async function () {
		this.stop();
		if (!this.config.credential || this.paused) return;
		var self = this,
			gen = this.generation;
		this.notify("connecting");
		try {
			var auth = await this.request("/community/rooms/" + this.config.room + "/session", { instance: this.instance, cheer: !!this.config.cheer }, this.config.credential);
			if (gen !== this.generation) return;
			this.session = auth.token;
			var Socket = this.options.WebSocket || global.WebSocket;
			var socket = new Socket(this.api.replace(/^http/, "ws") + "/community/rooms/" + this.config.room + "/socket");
			this.ws = socket;
			socket.onopen = function () {
				if (gen === self.generation) socket.send(auth.token);
			};
			socket.onmessage = function (event) {
				if (gen !== self.generation) return;
				try {
					var data = JSON.parse(event.data);
					if (data.type === "community_ready") {
                        socket.send("ack"); // Prove the application is responsive; an open socket alone is insufficient.
						self.notify("connected");
						(Array.isArray(data.requests) ? data.requests : []).forEach(function (r) {
							self.execute(r, gen).catch(function () {
								self.notify("effect_error");
							});
						});
					} else if (data.type === "audience_chat" && typeof data.id === "string" && !self.seen.has(data.id)) {
						self.seen.add(data.id);
						if (self.seen.size > 500) self.seen.delete(self.seen.values().next().value);
						if (self.options.onChat) self.options.onChat({ id: data.id, name: String(data.name || "Viewer"), text: String(data.text || ""), provider: String(data.provider || "guest") });
					}
				} catch (_) {
					self.notify("protocol_error");
				}
			};
			socket.onerror = function () {
				socket.close();
			};
			socket.onclose = function () {
				if (gen !== self.generation) return;
				self.notify("reconnecting");
				self.timer = setTimeout(
					function () {
						self.connect();
					},
					2000 + Math.random() * 1000
				);
			};
		} catch (e) {
			if (gen !== this.generation) return;
			this.notify(e.status === 401 || e.status === 403 ? "authorization_required" : "unavailable");
			if (e.status !== 401 && e.status !== 403)
				this.timer = setTimeout(
					function () {
						self.connect();
					},
					5000 + Math.random() * 2000
				);
		}
	};
	Connector.prototype.execute = async function (request, gen) {
		if (!this.config.cheer || gen !== this.generation || !request || !/^[a-f0-9]{32}$/.test(request.id) || this.running.has(request.id) || this.config.receipts.includes(request.id)) return;
		this.running.add(request.id);
		try {
			await this.op("claim", { id: request.id });
			this.config.receipts.push(request.id);
			this.config.receipts = this.config.receipts.slice(-256);
			await this.options.storage.save(this.config); // Must succeed before any effect is attempted.
			if (gen !== this.generation || !this.config.cheer || this.paused || Date.now() / 1000 >= request.expires) return;
			var result = await this.options.onCheer();
			if (gen === this.generation) await this.op("result", { id: request.id, status: result === true ? "sent_to_overlay" : "failed" });
		} finally {
			this.running.delete(request.id);
		}
	};
	Connector.prototype.publish = async function (message) {
		if (this.state !== "connected" || this.inflight >= 4 || !message || message.private || message.suppressRelay || message.event || message.bot || message.type === "socialstreamchat" || !this.config.sources.includes(message.type) || !message.chatmessage) return;
		var text = message.textonly ? String(message.chatmessage) : this.options.cleanText(message.chatmessage);
		if (!text.trim() || new TextEncoder().encode(text).length > 2048) return;
		this.inflight++;
		try {
			await this.op("chat", { id: id(), text: text, name: String(message.chatname || "Viewer").slice(0, 80), source: message.type });
		} catch (_) {
			this.notify("publication_unknown");
		} finally {
			this.inflight--;
		}
	};
	global.NCAudienceConnector = Connector;
})(typeof window !== "undefined" ? window : globalThis);
