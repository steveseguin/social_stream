(function () {
	const HOST = "https://vpzone.tv";
	const API_BASE = HOST + "/api";
	const SOURCE_NAME = "VPZone";
	const SOURCE_IMG = HOST + "/favicon.ico";
	const CONFIG_KEY = "vpzoneWsConfig";
	const DEFAULT_CONFIG = {
		channel: "",
		pollMs: 3000,
		replayHistory: true
	};
	const EVENT_LIMIT = 100;
	const STREAM_POLL_MS = 10000;
	const MAX_SEEN_IDS = 1500;
	const READY_STATE = {
		CONNECTING: 0,
		OPEN: 1,
		CLOSING: 2,
		CLOSED: 3
	};

	try {
		if (window.__SSN_VPZONE_WS_LOADED__) {
			return;
		}
		window.__SSN_VPZONE_WS_LOADED__ = true;
	} catch (e) {}

	const els = {};
	const state = {
		cfg: Object.assign({}, DEFAULT_CONFIG),
		settings: {},
		isExtensionOn: true,
		active: false,
		currentChannel: "",
		pollTimer: null,
		streamTimer: null,
		loadingEvents: false,
		loadingStream: false,
		emotes: new Map(),
		seenIds: new Set(),
		seenOrder: [],
		lastViewerCount: null,
		lastLiveState: null,
		lastSocketState: "",
		lastSocketMessage: ""
	};
	const websocketProxy = {
		readyState: READY_STATE.CLOSED,
		close: function () {
			disconnect(true);
		},
		send: function () {
			log("VPZone API source is read-only. Sending chat is not supported.", "warn");
			return false;
		}
	};

	try {
		window.websocket = websocketProxy;
	} catch (e) {}

	function extAvailable() {
		return typeof chrome !== "undefined" && chrome && chrome.runtime && typeof chrome.runtime.sendMessage === "function";
	}

	function relay(payload) {
		if (!payload || typeof payload !== "object") {
			return;
		}
		try {
			if (extAvailable() && chrome.runtime.id) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, function () {});
				return;
			}
		} catch (e) {}

		try {
			if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, null, typeof window.__SSAPP_TAB_ID__ !== "undefined" ? window.__SSAPP_TAB_ID__ : null);
				return;
			}
		} catch (e) {}

		try {
			var forwarded = Object.assign({}, payload);
			if (typeof window.__SSAPP_TAB_ID__ !== "undefined") {
				forwarded.__tabID__ = window.__SSAPP_TAB_ID__;
			}
			window.postMessage(forwarded, "*");
		} catch (e) {}
	}

	function pushMessage(data) {
		if (!state.isExtensionOn || !data || typeof data !== "object") {
			return;
		}
		relay({ message: data });
	}

	function pushStatus(status, message, meta) {
		var payload = {
			platform: "vpzone",
			status: String(status || ""),
			message: message || ""
		};
		if (meta && typeof meta === "object") {
			Object.keys(meta).forEach(function (key) {
				if (typeof meta[key] !== "undefined") {
					payload[key] = meta[key];
				}
			});
		}
		relay({ wssStatus: payload });
	}

	function escapeHtml(value) {
		return String(value == null ? "" : value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function escapeXml(value) {
		return String(value == null ? "" : value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	}

	function safeStrip(html) {
		if (!html) {
			return "";
		}
		try {
			var div = document.createElement("div");
			div.innerHTML = String(html);
			return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
		} catch (e) {
			return String(html).replace(/\s+/g, " ").trim();
		}
	}

	function safeTime(value) {
		try {
			if (!value) {
				return new Date().toLocaleTimeString();
			}
			return new Date(value).toLocaleTimeString();
		} catch (e) {
			return String(value || "");
		}
	}

	function absoluteUrl(url) {
		try {
			return url ? new URL(url, HOST).href : "";
		} catch (e) {
			return url || "";
		}
	}

	function clampPollMs(value) {
		var parsed = parseInt(value, 10);
		if (!isFinite(parsed)) {
			return DEFAULT_CONFIG.pollMs;
		}
		return Math.max(1000, Math.min(parsed, 15000));
	}

	function normalizeChannel(value) {
		var raw = String(value || "").trim();
		if (!raw) {
			return "";
		}
		try {
			var parsedUrl = new URL(raw);
			var match = parsedUrl.pathname.match(/\/stream\/([^/?#]+)/i);
			if (match && match[1]) {
				raw = decodeURIComponent(match[1]);
			}
		} catch (e) {}
		raw = raw.replace(/^@+/, "").replace(/^stream\//i, "").trim();
		return raw;
	}

	function prettyLabel(value) {
		return String(value || "")
			.replace(/[_-]+/g, " ")
			.replace(/\b\w/g, function (letter) {
				return letter.toUpperCase();
			});
	}

	function addLine(parent, className, html) {
		if (!parent) {
			return;
		}
		var entry = document.createElement("div");
		entry.className = className;
		entry.innerHTML = html;
		parent.appendChild(entry);
		while (parent.children.length > 250) {
			parent.removeChild(parent.firstChild);
		}
		parent.scrollTop = parent.scrollHeight;
	}

	function log(message, level) {
		var color = "#8ab8ff";
		level = level || "info";
		if (level === "success") {
			color = "#7ef0c4";
		} else if (level === "warn") {
			color = "#ffd98b";
		} else if (level === "error") {
			color = "#ff9eaa";
		}
		addLine(
			els.log,
			"log-entry",
			'<div class="log-meta" style="color:' + color + ';">' + escapeHtml(new Date().toLocaleTimeString()) + " [" + escapeHtml(level.toUpperCase()) + ']</div><div>' + escapeHtml(message || "") + "</div>"
		);
	}

	function setChip(element, text, tone) {
		if (!element) {
			return;
		}
		element.className = "chip";
		if (tone) {
			element.classList.add(tone);
		}
		element.textContent = text;
	}

	function setSocketState(status, message, meta) {
		if (state.lastSocketState === status && state.lastSocketMessage === message) {
			return;
		}
		state.lastSocketState = status;
		state.lastSocketMessage = message || "";
		if (status === "connected") {
			setChip(els.socketChip, "Poller: connected", "good");
		} else if (status === "connecting") {
			setChip(els.socketChip, "Poller: connecting", "warn");
		} else if (status === "error") {
			setChip(els.socketChip, "Poller: error", "bad");
		} else {
			setChip(els.socketChip, "Poller: disconnected", "bad");
		}
		if (els.statusText && message) {
			els.statusText.textContent = message;
		}
		pushStatus(status, message, meta || {});
	}

	function syncButtons() {
		if (els.connect) {
			els.connect.disabled = !!state.active;
		}
		if (els.disconnect) {
			els.disconnect.disabled = !state.active;
		}
		if (els.refresh) {
			els.refresh.disabled = !state.active;
		}
	}

	function loadConfig() {
		try {
			var saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
			if (saved && typeof saved === "object") {
				Object.assign(state.cfg, saved);
			}
		} catch (e) {}
		var query = new URLSearchParams(window.location.search);
		var hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
		var channel = query.get("channel") || query.get("username") || hash.get("channel") || hash.get("username");
		var pollMs = query.get("poll") || query.get("interval") || hash.get("poll") || hash.get("interval");
		var replayHistory = query.get("replay") || hash.get("replay");
		if (channel) {
			state.cfg.channel = normalizeChannel(channel);
		}
		if (pollMs != null) {
			state.cfg.pollMs = clampPollMs(pollMs);
		}
		if (replayHistory != null) {
			state.cfg.replayHistory = replayHistory !== "0" && replayHistory !== "false";
		}
	}

	function saveConfig() {
		try {
			localStorage.setItem(CONFIG_KEY, JSON.stringify(state.cfg));
		} catch (e) {}
	}

	function syncConfigFromUi() {
		state.cfg.channel = normalizeChannel(els.channel ? els.channel.value : state.cfg.channel);
		state.cfg.pollMs = clampPollMs(els.poll ? els.poll.value : state.cfg.pollMs);
		state.cfg.replayHistory = !!(els.replay && els.replay.checked);
		saveConfig();
	}

	function applyConfigToUi() {
		if (els.channel) {
			els.channel.value = state.cfg.channel || "";
		}
		if (els.poll) {
			els.poll.value = String(state.cfg.pollMs || DEFAULT_CONFIG.pollMs);
		}
		if (els.replay) {
			els.replay.checked = state.cfg.replayHistory !== false;
		}
		updateChannelLink();
	}

	function updateChannelLink() {
		if (!els.channelLink) {
			return;
		}
		var channel = normalizeChannel(state.currentChannel || state.cfg.channel);
		if (!channel) {
			els.channelLink.href = HOST;
			els.channelLink.textContent = "vpzone.tv";
			return;
		}
		var href = HOST + "/stream/" + encodeURIComponent(channel);
		els.channelLink.href = href;
		els.channelLink.textContent = href;
	}

	function basePayload() {
		return {
			chatbadges: [],
			backgroundColor: "",
			textColor: "",
			chatimg: "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: !!(state.settings && state.settings.textonlymode),
			type: "vpzone",
			sourceName: SOURCE_NAME,
			sourceImg: SOURCE_IMG
		};
	}

	function buildBadgeSvg(label, background, foreground) {
		var width = Math.max(34, Math.round(String(label || "").length * 6.5) + 14);
		return {
			type: "svg",
			html:
				'<svg xmlns="http://www.w3.org/2000/svg" width="' +
				width +
				'" height="16" viewBox="0 0 ' +
				width +
				' 16" preserveAspectRatio="xMidYMid meet"><rect x="0.5" y="0.5" rx="8" ry="8" width="' +
				(width - 1) +
				'" height="15" fill="' +
				escapeXml(background) +
				'" stroke="rgba(255,255,255,0.24)"></rect><text x="' +
				width / 2 +
				'" y="11" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="' +
				escapeXml(foreground) +
				'">' +
				escapeXml(label) +
				"</text></svg>"
		};
	}

	function buildRankBadges(rank) {
		var normalized = String(rank || "").toLowerCase();
		if (!normalized || normalized === "none") {
			return [];
		}
		if (normalized === "verified") {
			return [buildBadgeSvg("Verified", "#0ea5e9", "#ffffff")];
		}
		if (normalized === "affiliate") {
			return [buildBadgeSvg("Affiliate", "#8b5cf6", "#ffffff")];
		}
		if (normalized === "admin") {
			return [buildBadgeSvg("Admin", "#ef4444", "#ffffff")];
		}
		return [buildBadgeSvg(prettyLabel(normalized), "#334155", "#ffffff")];
	}

	function lookupEmote(code) {
		if (!code) {
			return null;
		}
		return state.emotes.get(code) || state.emotes.get(String(code).toUpperCase()) || null;
	}

	function renderMessageHtml(message) {
		var text = String(message == null ? "" : message);
		if (!text) {
			return "";
		}
		if (state.settings && state.settings.textonlymode) {
			return text;
		}
		return text.split(/(\s+)/).map(function (part) {
			var match;
			var emote;
			if (!part) {
				return "";
			}
			if (/^\s+$/.test(part)) {
				return part.replace(/ /g, "&nbsp;").replace(/\n/g, "<br>");
			}
			match = part.match(/^([^A-Za-z0-9_]*)([A-Za-z0-9_]+)([^A-Za-z0-9_]*)$/);
			if (match) {
				emote = lookupEmote(match[2]);
				if (emote && emote.url) {
					return escapeHtml(match[1]) + '<img class="vpzone-emote" src="' + escapeHtml(absoluteUrl(emote.url)) + '" alt="' + escapeHtml(match[2]) + '" title="' + escapeHtml((emote.name || match[2]) + " - " + match[2]) + '" />' + escapeHtml(match[3]);
				}
			}
			return escapeHtml(part).replace(/\n/g, "<br>");
		}).join("");
	}

	function rememberEventId(id) {
		var key = String(id);
		if (state.seenIds.has(key)) {
			return false;
		}
		state.seenIds.add(key);
		state.seenOrder.push(key);
		while (state.seenOrder.length > MAX_SEEN_IDS) {
			state.seenIds.delete(state.seenOrder.shift());
		}
		return true;
	}

	function buildMessagePayload(eventItem) {
		var rank = eventItem && eventItem.metadata ? eventItem.metadata.actorRank : "";
		var data = basePayload();
		data.chatname = escapeHtml(eventItem.actorDisplayName || eventItem.actorUsername || "VPZone User");
		data.chatmessage = renderMessageHtml(eventItem.message || "");
		data.chatimg = absoluteUrl(eventItem.actorAvatarUrl || "");
		data.chatbadges = buildRankBadges(rank);
		data.nameColor = "#c084fc";
		data.membership = rank && rank !== "none" ? prettyLabel(rank) : "";
		data.userid = eventItem.actorUserId != null ? String(eventItem.actorUserId) : (eventItem.actorUsername || "");
		data.timestamp = eventItem.createdAt || "";
		data.meta = {
			id: eventItem.id != null ? eventItem.id : null,
			streamUsername: eventItem.streamUsername || state.currentChannel || state.cfg.channel,
			createdAt: eventItem.createdAt || "",
			actorUsername: eventItem.actorUsername || "",
			actorRank: rank || "",
			actorOnboardingReady: !!(eventItem.metadata && eventItem.metadata.actorOnboardingReady),
			rawEventType: eventItem.eventType || "chat_message"
		};
		return data.chatname && data.chatmessage ? data : null;
	}

	function buildSystemPayload(eventItem) {
		var rawEvent = String(eventItem.eventType || "").toLowerCase();
		var mappedEvent = rawEvent === "viewer_join" ? "joined" : rawEvent === "viewer_quit" ? "left" : rawEvent === "follow" ? "followed" : rawEvent;
		var rank = eventItem && eventItem.metadata ? eventItem.metadata.actorRank : "";
		if (state.settings.captureevents === false || state.settings.hideevents) {
			return null;
		}
		if (mappedEvent === "joined" && state.settings.capturejoinedevent === false) {
			return null;
		}
		var data = basePayload();
		data.event = mappedEvent;
		data.chatname = escapeHtml(eventItem.actorDisplayName || eventItem.actorUsername || SOURCE_NAME);
		data.chatmessage = mappedEvent;
		data.chatimg = absoluteUrl(eventItem.actorAvatarUrl || "");
		data.chatbadges = buildRankBadges(rank);
		data.nameColor = "#c084fc";
		data.membership = rank && rank !== "none" ? prettyLabel(rank) : "";
		data.userid = eventItem.actorUserId != null ? String(eventItem.actorUserId) : (eventItem.actorUsername || "");
		data.timestamp = eventItem.createdAt || "";
		data.meta = {
			id: eventItem.id != null ? eventItem.id : null,
			streamUsername: eventItem.streamUsername || state.currentChannel || state.cfg.channel,
			createdAt: eventItem.createdAt || "",
			actorUsername: eventItem.actorUsername || "",
			actorRank: rank || "",
			actorOnboardingReady: !!(eventItem.metadata && eventItem.metadata.actorOnboardingReady),
			rawEventType: rawEvent
		};
		return data.chatname ? data : null;
	}

	function normalizeEvent(eventItem) {
		if (!eventItem || typeof eventItem !== "object") {
			return null;
		}
		if (String(eventItem.eventType || "").toLowerCase() === "chat_message") {
			return buildMessagePayload(eventItem);
		}
		return buildSystemPayload(eventItem);
	}

	function appendFeedEntry(payload) {
		var avatar = payload.chatimg ? '<img class="avatar" src="' + escapeHtml(payload.chatimg) + '" alt="" />' : '<span class="avatar placeholder"></span>';
		var badges = Array.isArray(payload.chatbadges) ? payload.chatbadges.map(function (badge) {
			return badge && badge.html ? '<span class="badge-strip">' + badge.html + "</span>" : "";
		}).join("") : "";
		var bodyHtml = payload.textonly ? escapeHtml(String(payload.chatmessage || "")).replace(/\n/g, "<br>") : String(payload.chatmessage || "");
		var label = payload.event ? '<span class="event-pill">' + escapeHtml(payload.chatmessage || payload.event) + "</span>" : '<span class="feed-message">' + bodyHtml + "</span>";
		addLine(
			els.feed,
			"feed-entry",
			'<div class="feed-top">' +
				avatar +
				'<div style="min-width:0;flex:1 1 auto;">' +
					'<div class="feed-meta">' + escapeHtml(safeTime(payload.timestamp || (payload.meta && payload.meta.createdAt) || "")) + "</div>" +
					'<div><span class="feed-name">' + escapeHtml(safeStrip(payload.chatname || "")) + "</span>" + badges + "</div>" +
					'<div class="feed-message">' + label + "</div>" +
				"</div>" +
			"</div>"
		);
	}

	async function fetchJson(url) {
		if (extAvailable() && chrome.runtime && chrome.runtime.id) {
			return new Promise(function (resolve, reject) {
				try {
					chrome.runtime.sendMessage(chrome.runtime.id, { cmd: "vpzoneFetchJson", url: url }, function (response) {
						if (chrome.runtime.lastError) {
							reject(new Error(chrome.runtime.lastError.message || "VPZone background fetch failed"));
							return;
						}
						if (!response || !response.ok) {
							reject(new Error((response && response.error) || "VPZone background fetch failed"));
							return;
						}
						resolve(response.data);
					});
				} catch (error) {
					reject(error);
				}
			});
		}
		var response;
		var text;
		var data;
		try {
			response = await fetch(url, {
				method: "GET",
				cache: "no-store",
				credentials: "omit",
				headers: {
					Accept: "application/json"
				}
			});
		} catch (error) {
			throw new Error((error && error.message) || "Network request failed");
		}
		text = await response.text();
		try {
			data = text ? JSON.parse(text) : {};
		} catch (error) {
			data = null;
		}
		if (!response.ok) {
			throw new Error((data && (data.error || data.message)) || ("HTTP " + response.status));
		}
		if (data == null) {
			throw new Error("Invalid JSON response");
		}
		return data;
	}

	async function loadEmotes(channel) {
		var channelPath = channel ? "/emotes/channel/" + encodeURIComponent(channel) : null;
		var results = await Promise.allSettled([
			fetchJson(API_BASE + "/emotes/global"),
			channelPath ? fetchJson(API_BASE + channelPath) : Promise.resolve({ emotes: [] })
		]);
		var nextMap = new Map();
		var count = 0;
		results.forEach(function (result) {
			var items;
			if (result.status !== "fulfilled") {
				return;
			}
			items = result.value && Array.isArray(result.value.emotes) ? result.value.emotes : [];
			items.forEach(function (item) {
				var code = item && item.code ? String(item.code).trim() : "";
				var url = item && item.url ? absoluteUrl(item.url) : "";
				if (!code || !url) {
					return;
				}
				count += 1;
				nextMap.set(code, { code: code, name: item.name || code, url: url, scope: item.scope || "" });
				nextMap.set(code.toUpperCase(), { code: code, name: item.name || code, url: url, scope: item.scope || "" });
			});
		});
		state.emotes = nextMap;
		log("Loaded " + count + " VPZone emote definitions.", "success");
	}

	function maybeEmitViewerUpdate(count) {
		if (!isFinite(count)) {
			return;
		}
		if (state.lastViewerCount === count) {
			return;
		}
		state.lastViewerCount = count;
		if (!(state.settings.showviewercount || state.settings.hypemode)) {
			return;
		}
		pushMessage({ type: "vpzone", event: "viewer_update", meta: count, sourceName: SOURCE_NAME, sourceImg: SOURCE_IMG });
	}

	function updateStreamSummary(stream, initialLoad) {
		var canonicalChannel;
		var isLive;
		var viewers;
		var title;
		var category;
		if (!stream || typeof stream !== "object") {
			setChip(els.streamChip, "Stream: unavailable", "bad");
			return;
		}
		canonicalChannel = normalizeChannel(stream.username || stream.user || state.currentChannel || state.cfg.channel);
		if (canonicalChannel) {
			state.currentChannel = canonicalChannel;
			if (els.channel) {
				els.channel.value = canonicalChannel;
			}
		}
		updateChannelLink();
		isLive = !!stream.isLive;
		viewers = typeof stream.viewers === "number" ? stream.viewers : null;
		title = stream.title || "-";
		category = stream.game || "-";
		setChip(els.streamChip, "Stream: " + (isLive ? "live" : "offline"), isLive ? "good" : "warn");
		setChip(els.viewerChip, "Viewers: " + (viewers != null ? viewers : "-"), viewers != null ? "good" : "");
		setChip(els.titleChip, "Title: " + title, "");
		setChip(els.categoryChip, "Category: " + category, "");
		document.title = SOURCE_NAME + " - " + (canonicalChannel || "API Source");
		if (viewers != null) {
			maybeEmitViewerUpdate(viewers);
		}
		if (state.lastLiveState !== null && state.lastLiveState !== isLive) {
			pushMessage({
				type: "vpzone",
				event: isLive ? "stream_online" : "stream_offline",
				meta: {
					title: title,
					category: category,
					viewers: viewers
				},
				sourceName: SOURCE_NAME,
				sourceImg: SOURCE_IMG
			});
			log("Stream state changed: " + (isLive ? "live" : "offline") + ".", "info");
		}
		state.lastLiveState = isLive;
		if (initialLoad) {
			log("Loaded stream details for @" + (canonicalChannel || state.cfg.channel) + ".", "success");
		}
	}

	async function pollStream(initialLoad) {
		var channel = normalizeChannel(state.currentChannel || state.cfg.channel);
		var data;
		if (!state.active || !channel || state.loadingStream) {
			return false;
		}
		state.loadingStream = true;
		try {
			data = await fetchJson(API_BASE + "/streams/" + encodeURIComponent(channel));
			updateStreamSummary(data && data.stream ? data.stream : data, !!initialLoad);
			return true;
		} finally {
			state.loadingStream = false;
		}
	}

	function sortEvents(items) {
		return items.slice().sort(function (a, b) {
			var aId = Number(a && a.id);
			var bId = Number(b && b.id);
			if (isFinite(aId) && isFinite(bId) && aId !== bId) {
				return aId - bId;
			}
			return String((a && a.createdAt) || "").localeCompare(String((b && b.createdAt) || ""));
		});
	}

	async function pollEvents(initialLoad) {
		var channel = normalizeChannel(state.currentChannel || state.cfg.channel);
		var data;
		var events;
		var forwarded = 0;
		var seeded = 0;
		if (!state.active || !channel || state.loadingEvents) {
			return false;
		}
		state.loadingEvents = true;
		try {
			data = await fetchJson(API_BASE + "/streams/" + encodeURIComponent(channel) + "/events?limit=" + EVENT_LIMIT);
			events = data && Array.isArray(data.events) ? sortEvents(data.events) : [];
			if (initialLoad && !state.cfg.replayHistory) {
				events.forEach(function (eventItem) {
					if (eventItem && eventItem.id != null && rememberEventId(eventItem.id)) {
						seeded += 1;
					}
				});
				log("Seeded " + seeded + " VPZone events without replay.", "info");
				return true;
			}
			events.forEach(function (eventItem) {
				var eventKey = eventItem && eventItem.id != null ? eventItem.id : [eventItem && eventItem.createdAt, eventItem && eventItem.actorUsername, eventItem && eventItem.eventType, eventItem && eventItem.message].join("::");
				var payload;
				if (!rememberEventId(eventKey)) {
					return;
				}
				payload = normalizeEvent(eventItem);
				if (!payload) {
					return;
				}
				pushMessage(payload);
				appendFeedEntry(payload);
				forwarded += 1;
			});
			if (initialLoad) {
				log("Loaded " + events.length + " VPZone events; forwarded " + forwarded + ".", "success");
			} else if (forwarded) {
				log("Forwarded " + forwarded + " new VPZone event" + (forwarded === 1 ? "" : "s") + ".", "info");
			}
			return true;
		} finally {
			state.loadingEvents = false;
		}
	}

	function clearTimers() {
		if (state.pollTimer) {
			clearInterval(state.pollTimer);
			state.pollTimer = null;
		}
		if (state.streamTimer) {
			clearInterval(state.streamTimer);
			state.streamTimer = null;
		}
	}

	function startTimers() {
		clearTimers();
		state.pollTimer = setInterval(function () {
			pollEvents(false).catch(function (error) {
				log("VPZone events poll failed: " + ((error && error.message) || error), "error");
			});
		}, state.cfg.pollMs);
		state.streamTimer = setInterval(function () {
			pollStream(false).catch(function (error) {
				log("VPZone stream poll failed: " + ((error && error.message) || error), "error");
			});
		}, STREAM_POLL_MS);
	}

	async function refreshNow() {
		if (!state.currentChannel && !state.cfg.channel) {
			throw new Error("Channel is required before refreshing.");
		}
		await loadEmotes(normalizeChannel(state.currentChannel || state.cfg.channel));
		await pollStream(false);
		await pollEvents(false);
	}

	async function connect() {
		var channel;
		var emoteError = null;
		var streamResult = false;
		var eventsResult = false;
		syncConfigFromUi();
		channel = normalizeChannel(state.cfg.channel);
		if (!channel) {
			throw new Error("Channel is required.");
		}
		state.active = true;
		state.currentChannel = channel;
		state.seenIds.clear();
		state.seenOrder = [];
		state.lastViewerCount = null;
		state.lastLiveState = null;
		websocketProxy.readyState = READY_STATE.CONNECTING;
		updateChannelLink();
		syncButtons();
		setSocketState("connecting", "Connecting to @" + channel + "...");
		log("Connecting to @" + channel + ".", "info");
		try {
			await loadEmotes(channel);
		} catch (error) {
			emoteError = error;
			log("VPZone emote load failed: " + ((error && error.message) || error), "warn");
		}
		try {
			streamResult = await pollStream(true);
		} catch (error) {
			log("Initial stream fetch failed: " + ((error && error.message) || error), "error");
		}
		try {
			eventsResult = await pollEvents(true);
		} catch (error) {
			log("Initial events fetch failed: " + ((error && error.message) || error), "error");
		}
		startTimers();
		websocketProxy.readyState = READY_STATE.OPEN;
		if (streamResult || eventsResult) {
			setSocketState("connected", "Connected to @" + channel + ". Polling events every " + state.cfg.pollMs + "ms.", { channel: channel });
		} else {
			setSocketState("error", "Initial VPZone fetch failed for @" + channel + ". Retrying on the poll interval.", { channel: channel });
			if (!emoteError) {
				log("Emotes loaded, but the stream and events endpoints both failed. Retrying automatically.", "warn");
			}
		}
	}

	function disconnect(manual) {
		clearTimers();
		state.active = false;
		websocketProxy.readyState = READY_STATE.CLOSED;
		setSocketState("disconnected", manual ? "Disconnected from VPZone." : "VPZone polling stopped.");
		syncButtons();
	}

	function bridge() {
		if (extAvailable()) {
			try {
				chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
					try {
						if (request === "getSource") {
							sendResponse("vpzone");
							return;
						}
						if (request === "focusChat") {
							sendResponse(false);
							return;
						}
						if (request && typeof request === "object") {
							if ("settings" in request) {
								state.settings = request.settings || {};
								sendResponse(true);
								return;
							}
							if ("state" in request) {
								state.isExtensionOn = !!request.state;
								sendResponse(true);
								return;
							}
							if (request.type === "SEND_MESSAGE") {
								log("VPZone API source is read-only. Chat send is not supported.", "warn");
								sendResponse(false);
								return;
							}
						}
					} catch (error) {
						log("Extension bridge error: " + ((error && error.message) || error), "error");
					}
					sendResponse(false);
				});
			} catch (error) {
				log("Failed wiring extension bridge: " + ((error && error.message) || error), "warn");
			}
			try {
				chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
					if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
						return;
					}
					response = response || {};
					if ("settings" in response) {
						state.settings = response.settings || {};
					}
					if ("state" in response) {
						state.isExtensionOn = !!response.state;
					}
				});
			} catch (error) {}
		}
		window.addEventListener("message", function (event) {
			var request = event && event.data;
			if (!request || typeof request !== "object") {
				return;
			}
			if (request.__ssappSendToTab) {
				request = request.__ssappSendToTab;
			}
			if (request.type === "SEND_MESSAGE") {
				log("VPZone API source is read-only. Chat send is not supported.", "warn");
			}
		});
	}

	function bindUi() {
		if (els.save) {
			els.save.addEventListener("click", function () {
				syncConfigFromUi();
				applyConfigToUi();
				log("Configuration saved.", "success");
			});
		}
		if (els.connect) {
			els.connect.addEventListener("click", function () {
				connect().catch(function (error) {
					setSocketState("error", "Connect failed: " + ((error && error.message) || error));
					log("Connect failed: " + ((error && error.message) || error), "error");
					syncButtons();
				});
			});
		}
		if (els.disconnect) {
			els.disconnect.addEventListener("click", function () {
				disconnect(true);
			});
		}
		if (els.refresh) {
			els.refresh.addEventListener("click", function () {
				refreshNow().then(function () {
					log("Manual refresh completed.", "success");
				}).catch(function (error) {
					log("Manual refresh failed: " + ((error && error.message) || error), "error");
				});
			});
		}
		if (els.channel) {
			els.channel.addEventListener("change", function () {
				state.cfg.channel = normalizeChannel(els.channel.value);
				updateChannelLink();
				syncButtons();
			});
			els.channel.addEventListener("keydown", function (event) {
				if (event.key === "Enter") {
					event.preventDefault();
					if (!state.active && els.connect) {
						els.connect.click();
					}
				}
			});
		}
		if (els.poll) {
			els.poll.addEventListener("change", function () {
				els.poll.value = String(clampPollMs(els.poll.value));
			});
		}
	}

	function cacheElements() {
		els.channel = document.getElementById("channel-input");
		els.poll = document.getElementById("poll-interval");
		els.replay = document.getElementById("replay-history");
		els.save = document.getElementById("save-config");
		els.connect = document.getElementById("connect-btn");
		els.disconnect = document.getElementById("disconnect-btn");
		els.refresh = document.getElementById("refresh-btn");
		els.socketChip = document.getElementById("socket-chip");
		els.streamChip = document.getElementById("stream-chip");
		els.viewerChip = document.getElementById("viewer-chip");
		els.titleChip = document.getElementById("title-chip");
		els.categoryChip = document.getElementById("category-chip");
		els.statusText = document.getElementById("status-text");
		els.channelLink = document.getElementById("channel-link");
		els.feed = document.getElementById("feed");
		els.log = document.getElementById("log");
	}

	function boot() {
		cacheElements();
		loadConfig();
		applyConfigToUi();
		setChip(els.socketChip, "Poller: disconnected", "bad");
		setChip(els.streamChip, "Stream: unknown", "");
		setChip(els.viewerChip, "Viewers: -", "");
		setChip(els.titleChip, "Title: -", "");
		setChip(els.categoryChip, "Category: -", "");
		bindUi();
		bridge();
		syncButtons();
		log("VPZone API source ready.", "success");
		if (state.cfg.channel) {
			connect().catch(function (error) {
				setSocketState("error", "Auto-connect failed: " + ((error && error.message) || error));
				log("Auto-connect failed: " + ((error && error.message) || error), "error");
				syncButtons();
			});
		}
		window.addEventListener("beforeunload", function () {
			disconnect(false);
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot, { once: true });
	} else {
		boot();
	}
})();
