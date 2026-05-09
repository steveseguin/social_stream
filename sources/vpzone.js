(function () {
	var settings = {};
	var isExtensionOn = true;
	var observer = null;
	var observedList = null;
	var lastUrl = window.location.href;
	var recentFingerprints = new Map();
	var lastViewerCount = null;
	var sourceImg = "";
	var sourceName = "VPZone";
	var seenWsMessageIds = new Map();
	var currentChannelSlug = "";
	var avatarCache = new Map();
	var avatarPending = new Set();
	var avatarNegativeTtl = 5 * 60 * 1000;

	function fetchAvatar(username) {
		if (!username) return;
		var key = String(username).toLowerCase();
		if (avatarCache.has(key)) return;
		if (avatarPending.has(key)) return;
		avatarPending.add(key);
		try {
			fetch("/u/" + encodeURIComponent(username), { credentials: "omit", cache: "force-cache" })
				.then(function (res) { return res.ok ? res.text() : ""; })
				.then(function (html) {
					if (!html) return;
					// Avatars live at /storage/v1/object/public/avatars/<uuid>/avatar-<ts>.<ext>
					// The user page exposes them via either an og:image meta tag or a
					// background-image CSS rule. We accept any of those.
					var match =
						html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+avatar-[^"']+)["']/i) ||
						html.match(/<meta[^>]+content=["']([^"']+avatar-[^"']+)["'][^>]+property=["']og:image["']/i) ||
						html.match(/(https?:\/\/[^"'\\)\s]+\/avatars\/[a-f0-9-]+\/avatar-[^"'\\)\s]+\.(?:png|jpe?g|webp|gif))/i);
					if (match && match[1]) {
						avatarCache.set(key, match[1]);
					} else {
						setTimeout(function () { avatarPending.delete(key); }, avatarNegativeTtl);
						return;
					}
				})
				.catch(function () {})
				.finally(function () { avatarPending.delete(key); });
		} catch (e) {
			avatarPending.delete(key);
		}
	}

	function getChannelSlugFromUrl() {
		try {
			// Match /watch/{slug}, /overlay/chat/{token}?channel={slug},
			// /overlay/chat-dock/{token}?channel={slug}, /u/{username}
			var path = window.location.pathname;
			var match =
				path.match(/^\/watch\/([^\/?#]+)/) ||
				path.match(/^\/u\/([^\/?#]+)/);
			if (match) return decodeURIComponent(match[1]);
			// Chat dock / overlay pages pass channel as query param
			var params = new URLSearchParams(window.location.search);
			var channel = params.get("channel");
			if (channel) return decodeURIComponent(channel);
			return "";
		} catch (e) {
			return "";
		}
	}

	function pruneSeenWs(now) {
		if (!seenWsMessageIds.size) return;
		seenWsMessageIds.forEach(function (ts, id) {
			if (now - ts > 60000) seenWsMessageIds.delete(id);
		});
	}

	function escapeHtmlMaybe(text) {
		return escapeHtml((text == null ? "" : String(text)));
	}

	function tierBadge(tier, subMonths) {
		var label = "SUB";
		if (subMonths && subMonths >= 12) {
			label = Math.floor(subMonths / 12) + "y";
		} else if (subMonths && subMonths >= 1) {
			label = subMonths + "m";
		}
		var bg = tier === "tier3" ? "#00E9E2" : tier === "tier2" ? "#FF6DE4" : "#f9376b";
		var width = Math.max(34, Math.round(label.length * 6.5) + 14);
		return {
			html: '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="16" viewBox="0 0 ' + width + ' 16"><rect x="0.5" y="0.5" rx="8" ry="8" width="' + (width - 1) + '" height="15" fill="' + escapeXml(bg) + '" stroke="rgba(255,255,255,0.25)"></rect><text x="' + (width / 2) + '" y="11" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#ffffff">' + escapeXml(label) + "</text></svg>",
			type: "svg"
		};
	}

	function ownerBadge() {
		return {
			html: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="16" viewBox="0 0 20 16"><rect x="0.5" y="0.5" rx="3" ry="3" width="19" height="15" fill="#c071f5"></rect><text x="10" y="11" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#ffffff">OP</text></svg>',
			type: "svg"
		};
	}

	function twitchBadge() {
		return {
			html: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="16" viewBox="0 0 20 16"><rect x="0.5" y="0.5" rx="3" ry="3" width="19" height="15" fill="#9146FF"></rect><text x="10" y="11" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#ffffff">TW</text></svg>',
			type: "svg"
		};
	}

	function buildBadgesFromWs(msg) {
		var badges = [];
		if (msg.is_owner) badges.push(ownerBadge());
		if (msg.is_subscriber) badges.push(tierBadge(msg.tier, msg.sub_months));
		if (msg.metadata && msg.metadata.source === "twitch") badges.push(twitchBadge());
		return badges;
	}

	function emitWsMessage(data) {
		var base = buildBaseData();
		Object.keys(data).forEach(function (k) { base[k] = data[k]; });
		pushMessage(base);
	}

	function handleWsFrame(raw) {
		if (!isExtensionOn) return;
		var msg;
		try { msg = JSON.parse(raw); } catch (e) { return; }
		if (!msg || typeof msg !== "object") return;

		var now = Date.now();
		pruneSeenWs(now);

		if (msg.type === "presence") {
			if (typeof msg.count === "number" && (settings.showviewercount || settings.hypemode)) {
				if (lastViewerCount !== msg.count) {
					lastViewerCount = msg.count;
					pushMessage({ type: "vpzone", event: "viewer_update", meta: msg.count });
				}
			}
			return;
		}

		if (msg.type === "delete_message") return;

		if (msg.id && seenWsMessageIds.has(msg.id)) return;
		if (msg.id) seenWsMessageIds.set(msg.id, now);

		var ts = msg.ts || "";

		if (msg.type === "follow" || msg.type === "subscription" || msg.type === "raid") {
			emitWsMessage({
				chatname: escapeHtmlMaybe(msg.username || ""),
				chatmessage: escapeHtmlMaybe(msg.body || msg.type),
				event: msg.type,
				membership: msg.type === "subscription" ? (msg.metadata && msg.metadata.tier ? "Subscriber (" + msg.metadata.tier + ")" : "Subscriber") : "",
				meta: { timestamp: ts, raw: msg.metadata || {} }
			});
			return;
		}

		if (msg.type === "system") {
			var kind = msg.metadata && msg.metadata.kind;
			emitWsMessage({
				chatname: escapeHtmlMaybe(msg.username || "system"),
				chatmessage: escapeHtmlMaybe(msg.body || ""),
				event: kind || "system",
				meta: { timestamp: ts, kind: kind || "" }
			});
			return;
		}

		var name = msg.username || (msg.metadata && msg.metadata.username) || "";
		var body = msg.body == null ? "" : String(msg.body);
		if (!name || !body) return;

		// Frames don't carry an avatar URL, but the public profile page does.
		// Fire a background fetch on first sight; subsequent messages from the
		// same user will be enriched from the cache.
		var avatar =
			msg.avatar_url ||
			msg.avatarUrl ||
			(msg.metadata && (msg.metadata.avatar_url || msg.metadata.avatarUrl)) ||
			avatarCache.get(String(name).toLowerCase()) ||
			"";
		if (!avatar) {
			fetchAvatar(name);
		}

		emitWsMessage({
			chatname: escapeHtmlMaybe(name),
			chatmessage: escapeHtmlMaybe(body),
			chatimg: avatar,
			nameColor: msg.color || "",
			chatbadges: buildBadgesFromWs(msg),
			meta: {
				timestamp: ts,
				messageId: msg.id || "",
				channel: currentChannelSlug,
				source: msg.metadata && msg.metadata.source ? msg.metadata.source : "vpzone"
			}
		});
	}

	function handleWindowMessage(event) {
		if (!event || event.source !== window) return;
		var d = event.data;
		if (!d || d.source !== "vpzone-ws-interceptor") return;
		if (d.type !== "receive") return;
		handleWsFrame(d.data);
	}

	function pushMessage(data) {
		if (!isExtensionOn) {
			return;
		}
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "message": data }, function () {});
		} catch (e) {}
	}

	function escapeHtml(unsafe) {
		try {
			unsafe = unsafe || "";
			if (settings.textonlymode) {
				return unsafe;
			}
			return unsafe
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;");
		} catch (e) {
			return "";
		}
	}

	function escapeXml(unsafe) {
		return (unsafe || "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	}

	function toAbsoluteUrl(url) {
		try {
			if (!url) {
				return "";
			}
			return new URL(url, window.location.href).href;
		} catch (e) {
			return url || "";
		}
	}

	function normalizeSrcset(srcset) {
		try {
			return (srcset || "")
				.split(",")
				.map(function (part) {
					var trimmed = (part || "").trim();
					if (!trimmed) {
						return "";
					}
					var pieces = trimmed.split(/\s+/);
					if (!pieces.length) {
						return "";
					}
					var absoluteUrl = toAbsoluteUrl(pieces[0]);
					return absoluteUrl + (pieces.length > 1 ? " " + pieces.slice(1).join(" ") : "");
				})
				.filter(Boolean)
				.join(", ");
		} catch (e) {
			return srcset || "";
		}
	}

	function cloneNodeHtml(node) {
		try {
			var clone = node.cloneNode(true);
			if (clone.tagName === "IMG") {
				var src = clone.getAttribute("src") || clone.src || "";
				if (src) {
					clone.setAttribute("src", toAbsoluteUrl(src));
				}
				if (clone.srcset) {
					clone.setAttribute("srcset", normalizeSrcset(clone.getAttribute("srcset") || clone.srcset));
				}
			}
			if (clone.querySelectorAll) {
				clone.querySelectorAll("img[src], source[src]").forEach(function (element) {
					var source = element.getAttribute("src") || element.src || "";
					if (source) {
						element.setAttribute("src", toAbsoluteUrl(source));
					}
					if (element.srcset) {
						element.setAttribute("srcset", normalizeSrcset(element.getAttribute("srcset") || element.srcset));
					}
				});
			}
			return clone.outerHTML || "";
		} catch (e) {
			return "";
		}
	}

	function getAllContentNodes(element) {
		var response = "";

		if (!element) {
			return response;
		}

		if (!element.childNodes || !element.childNodes.length) {
			if (element.nodeType === 3) {
				return escapeHtml(element.textContent || "");
			}
			if (!settings.textonlymode && element.nodeType === 1) {
				return cloneNodeHtml(element);
			}
			return escapeHtml(element.textContent || "");
		}

		element.childNodes.forEach(function (node) {
			if (node.nodeType === 3) {
				if (node.textContent) {
					response += escapeHtml(node.textContent);
				}
				return;
			}

			if (node.nodeType !== 1) {
				return;
			}

			if (settings.textonlymode) {
				response += getAllContentNodes(node);
				return;
			}

			if (node.tagName === "IMG" || node.tagName === "VIDEO" || node.tagName === "SVG") {
				response += cloneNodeHtml(node);
				return;
			}

			if (node.childNodes && node.childNodes.length) {
				response += getAllContentNodes(node);
				return;
			}

			response += cloneNodeHtml(node);
		});

		return response;
	}

	function getDirectChildrenByTag(element, tagName) {
		return Array.from(element && element.children ? element.children : []).filter(function (child) {
			return child && child.tagName === tagName;
		});
	}

	function getComputedColor(node, propertyName, fallback) {
		try {
			var value = window.getComputedStyle(node).getPropertyValue(propertyName);
			return value || fallback || "";
		} catch (e) {
			return fallback || "";
		}
	}

	function parseCountText(text) {
		try {
			var normalized = (text || "").replace(/,/g, "").trim().toUpperCase();
			var match = normalized.match(/(\d+(?:\.\d+)?)\s*([KM]?)/);
			if (!match) {
				return null;
			}
			var value = parseFloat(match[1]);
			if (!isFinite(value)) {
				return null;
			}
			if (match[2] === "K") {
				value *= 1000;
			} else if (match[2] === "M") {
				value *= 1000000;
			}
			return Math.round(value);
		} catch (e) {
			return null;
		}
	}

	function buildBadgeObject(label, badgeNode) {
		var backgroundColor = getComputedColor(badgeNode, "background-color", "#334155");
		var textColor = getComputedColor(badgeNode, "color", "#ffffff");
		var width = Math.max(34, Math.round((label || "").length * 6.5) + 14);
		return {
			html: '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="16" viewBox="0 0 ' + width + ' 16" preserveAspectRatio="xMidYMid meet"><rect x="0.5" y="0.5" rx="8" ry="8" width="' + (width - 1) + '" height="15" fill="' + escapeXml(backgroundColor) + '" stroke="rgba(255,255,255,0.25)"></rect><text x="' + (width / 2) + '" y="11" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="' + escapeXml(textColor) + '">' + escapeXml(label) + "</text></svg>",
			type: "svg"
		};
	}

	function extractBadges(headerNode) {
		var badges = [];
		var seen = new Set();

		if (!headerNode) {
			return badges;
		}

		headerNode.querySelectorAll("[aria-label], [title]").forEach(function (badgeNode) {
			var title = (badgeNode.getAttribute("aria-label") || badgeNode.getAttribute("title") || "").trim();
			var text = (badgeNode.textContent || "").trim();
			var label = text && text.length <= 18 ? text : title;
			var normalizedLabel = label.toLowerCase();
			if (badgeNode.tagName === "IMG" || badgeNode.tagName === "SVG") {
				return;
			}
			if (badgeNode.closest && badgeNode.closest(".break-words")) {
				return;
			}
			if (/\d{1,2}\/\d{1,2}\/\d{4}|^\d{1,2}:\d{2}/.test(title || label)) {
				return;
			}
			if (!label || seen.has(normalizedLabel)) {
				return;
			}
			seen.add(normalizedLabel);
			badges.push(buildBadgeObject(label, badgeNode));
		});

		return badges;
	}

	function isLikelyTimeNode(node) {
		var text = (node && node.textContent || "").trim();
		var title = node && node.getAttribute ? (node.getAttribute("title") || "") : "";
		return /^\d{1,2}:\d{2}(?:\s?[AP]M)?$/i.test(text) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(title);
	}

	function findVpzoneMessageNode(row) {
		var nodes = Array.from(row.querySelectorAll(".break-words, [class*='break-words']"));
		return nodes.find(function (node) {
			return node && !isLikelyTimeNode(node) && ((node.textContent || "").trim() || node.querySelector("img, svg, video"));
		}) || null;
	}

	function findVpzoneTimeNode(row) {
		var spans = Array.from(row.querySelectorAll("span"));
		return spans.reverse().find(isLikelyTimeNode) || null;
	}

	function findVpzoneNameNode(row) {
		return row.querySelector('a[href^="/u/"], a[href*="/u/"], span.font-semibold');
	}

	function buildBaseData() {
		return {
			chatbadges: [],
			backgroundColor: "",
			textColor: "",
			chatimg: "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: settings.textonlymode || false,
			type: "vpzone",
			sourceName: sourceName,
			sourceImg: sourceImg
		};
	}

	function parseMessageRow(row) {
		var contentRoot = row.querySelector("div.min-w-0") || row.querySelector(".items-baseline") || row.lastElementChild;
		var headerNode = contentRoot ? (contentRoot.classList && contentRoot.classList.contains("items-baseline") ? contentRoot : getDirectChildrenByTag(contentRoot, "SPAN")[0] || contentRoot) : null;
		var nameNode = findVpzoneNameNode(row);
		var messageNode = contentRoot ? getDirectChildrenByTag(contentRoot, "P")[0] || contentRoot.querySelector("p") || findVpzoneMessageNode(row) : findVpzoneMessageNode(row);
		var avatarNode = getDirectChildrenByTag(row, "IMG").find(function (image) {
			return image && (image.getAttribute("src") || image.src);
		}) || null;
		var timeNode = findVpzoneTimeNode(row);

		if (!nameNode || !messageNode) {
			return null;
		}

		var chatname = escapeHtml((nameNode.textContent || "").trim());
		var chatmessage = getAllContentNodes(messageNode).trim();

		if (!chatname || !chatmessage) {
			return null;
		}

		var data = buildBaseData();
		data.chatname = chatname;
		data.chatmessage = chatmessage;
		data.chatimg = avatarNode ? toAbsoluteUrl(avatarNode.getAttribute("src") || avatarNode.src || "") : "";
		data.nameColor = getComputedColor(nameNode, "color", "");
		data.chatbadges = extractBadges(headerNode);
		data.meta = {
			timestamp: timeNode ? (timeNode.getAttribute("title") || timeNode.textContent || "").trim() : ""
		};
		return data;
	}

	function parseEventRow(row) {
		var eventCardName = row.querySelector('a[href^="/u/"], a[href*="/u/"]');
		var eventCardText = row.querySelector("p");
		if (eventCardName && eventCardText && /followed/i.test(eventCardText.textContent || "")) {
			var followData = buildBaseData();
			followData.chatname = escapeHtml((eventCardName.textContent || "").trim());
			followData.chatmessage = "followed";
			followData.event = "followed";
			followData.meta = {
				timestamp: findVpzoneTimeNode(row) ? (findVpzoneTimeNode(row).textContent || "").trim() : ""
			};
			return followData.chatname ? followData : null;
		}

		var rowText = (row.textContent || "").replace(/\s+/g, " ").trim();
		var simpleMatch = rowText.match(/^(.+?)\s+(?:just\s+)?(joined|left)$/i);
		if (simpleMatch && simpleMatch[1] && simpleMatch[2]) {
			var simpleType = simpleMatch[2].toLowerCase();
			if (simpleType === "joined" && settings.capturejoinedevent === false) {
				return null;
			}
			var simpleData = buildBaseData();
			simpleData.chatname = escapeHtml(simpleMatch[1].trim());
			simpleData.chatmessage = simpleType;
			simpleData.event = simpleType;
			simpleData.meta = { timestamp: "" };
			return simpleData.chatname ? simpleData : null;
		}

		var spans = getDirectChildrenByTag(row, "SPAN");
		if (!spans.length) {
			return null;
		}

		var primaryText = (spans[0].textContent || "").trim();
		if (!primaryText) {
			return null;
		}

		var match = primaryText.match(/^(.*?)(?:\s+(joined|left|followed))$/i);
		if (!match || !match[1] || !match[2]) {
			return null;
		}

		var eventType = match[2].toLowerCase();
		if (eventType === "joined" && settings.capturejoinedevent === false) {
			return null;
		}

		var data = buildBaseData();
		data.chatname = escapeHtml(match[1].trim());
		data.chatmessage = eventType;
		data.event = eventType;
		data.meta = {
			timestamp: spans.length > 1 ? (spans[spans.length - 1].textContent || "").trim() : ""
		};
		return data.chatname ? data : null;
	}

	function parseRow(row) {
		if (!row || row.nodeType !== 1 || !row.isConnected || row.parentElement !== observedList) {
			return null;
		}
		if ((row.querySelector("p") && row.querySelector("span.font-semibold")) || (findVpzoneNameNode(row) && findVpzoneMessageNode(row))) {
			return parseMessageRow(row);
		}
		return parseEventRow(row);
	}

	function pruneFingerprints(now) {
		if (!recentFingerprints.size) {
			return;
		}
		recentFingerprints.forEach(function (timestamp, fingerprint) {
			if ((now - timestamp) > 5000) {
				recentFingerprints.delete(fingerprint);
			}
		});
	}

	function isDuplicate(data) {
		var now = Date.now();
		pruneFingerprints(now);
		var timestamp = data.meta && data.meta.timestamp ? data.meta.timestamp : "";
		var fingerprint = [
			data.event || "",
			data.chatname || "",
			data.chatmessage || "",
			timestamp,
			data.chatimg || ""
		].join("::");

		if (recentFingerprints.has(fingerprint)) {
			return true;
		}

		recentFingerprints.set(fingerprint, now);
		return false;
	}

	function handleRow(row) {
		if (!row || row.dataset.ssnVpzoneSeen === "true") {
			return;
		}

		var data = parseRow(row);
		if (!data) {
			return;
		}

		row.dataset.ssnVpzoneSeen = "true";
		row.dataset.ssnVpzoneQueued = "false";

		if (isDuplicate(data)) {
			return;
		}

		pushMessage(data);
	}

	function queueRow(row) {
		if (!row || row.nodeType !== 1 || row.parentElement !== observedList) {
			return;
		}
		if (row.dataset.ssnVpzoneSeen === "true" || row.dataset.ssnVpzoneQueued === "true") {
			return;
		}

		row.dataset.ssnVpzoneQueued = "true";
		setTimeout(function () {
			if (!row || !row.isConnected) {
				return;
			}
			if (row.dataset.ssnVpzoneSeen === "true") {
				return;
			}
			row.dataset.ssnVpzoneQueued = "false";
			handleRow(row);
		}, 60);
	}

	function findRowFromNode(node) {
		var current = node && node.nodeType === 1 ? node : node ? node.parentElement : null;
		while (current && current !== observedList && current.parentElement !== observedList) {
			current = current.parentElement;
		}
		if (current && current.parentElement === observedList) {
			return current;
		}
		return null;
	}

	function markExistingRows(target) {
		Array.from(target && target.children ? target.children : []).forEach(function (row) {
			if (row && row.nodeType === 1) {
				row.dataset.ssnVpzoneSeen = "true";
			}
		});
	}

	function disconnectObserver() {
		if (observer) {
			observer.disconnect();
			observer = null;
		}
		observedList = null;
	}

	function emitViewerCount(count) {
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			return;
		}
		if (!isFinite(count) || count < 0) {
			return;
		}
		if (lastViewerCount === count) {
			return;
		}
		lastViewerCount = count;
		pushMessage({
			type: "vpzone",
			event: "viewer_update",
			meta: count
		});
	}

	function isViewerCountLabel(text) {
		return /\b(?:viewers?|watching)\b/i.test(text || "");
	}

	function findViewerCountNode() {
		var selector = "div.absolute.top-3.left-3 span";
		var spans = Array.from(document.querySelectorAll(selector));
		var match = spans.find(function (span) {
			return isViewerCountLabel((span.textContent || "").trim());
		});
		if (match) {
			return match;
		}

		spans = Array.from(document.querySelectorAll("span"));
		return spans.find(function (span) {
			var text = (span.textContent || "").trim();
			var title = span.getAttribute ? (span.getAttribute("title") || "") : "";
			if (!isViewerCountLabel(text) && !isViewerCountLabel(title)) {
				return false;
			}
			if (parseCountText(text + " " + title) === null) {
				return false;
			}
			var parentText = span.parentElement ? span.parentElement.textContent || "" : "";
			return /\bLIVE\b/i.test(parentText) || /\bwatching\b/i.test(text) || /\bwatching\b/i.test(title);
		}) || null;
	}

	function checkViewers() {
		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			return;
		}
		try {
			var viewerNode = findViewerCountNode();
			if (!viewerNode) {
				return;
			}
			var count = parseCountText(viewerNode.textContent || "");
			if (count === null) {
				return;
			}
			emitViewerCount(count);
		} catch (e) {}
	}

	function findChatInput() {
		return document.querySelector('input[placeholder="Send a message"]');
	}

	function findChatList() {
		var input = findChatInput();
		if (!input) {
			return null;
		}

		var current = input;
		while (current && current !== document.body) {
			var previous = current.previousElementSibling;
			if (previous && previous.classList && previous.classList.contains("overflow-y-auto")) {
				return previous;
			}
			current = current.parentElement;
		}

		var panel = input.parentElement;
		while (panel && panel !== document.body) {
			var candidates = Array.from(panel.querySelectorAll("div.overflow-y-auto")).filter(function (element) {
				return element !== observedList && element.querySelector("p, span");
			});
			if (candidates.length) {
				return candidates[0];
			}
			panel = panel.parentElement;
		}

		return null;
	}

	function attachObserver() {
		var target = findChatList();
		if (!target) {
			disconnectObserver();
			return;
		}
		if (target === observedList && observer) {
			return;
		}

		disconnectObserver();
		observedList = target;
		markExistingRows(target);

		observer = new MutationObserver(function (mutations) {
			mutations.forEach(function (mutation) {
				Array.from(mutation.addedNodes || []).forEach(function (node) {
					var row = findRowFromNode(node);
					if (row) {
						queueRow(row);
					}
				});
			});
		});

		observer.observe(target, {
			childList: true,
			subtree: true
		});
	}

	chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings": true }, function (response) {
		if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
			return;
		}
		response = response || {};
		if ("settings" in response) {
			settings = response.settings;
		}
		if ("state" in response) {
			isExtensionOn = response.state;
		}
	});

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		try {
			if ("getSource" === request) {
				sendResponse("vpzone");
				return;
			}
			if ("focusChat" === request) {
				var input = findChatInput();
				if (input) {
					input.focus();
					sendResponse(true);
					return;
				}
			}
			if (typeof request === "object") {
				if ("state" in request) {
					isExtensionOn = request.state;
				}
				if ("settings" in request) {
					settings = request.settings || {};
					sendResponse(true);
					return;
				}
			}
		} catch (e) {}
		sendResponse(false);
	});

	try {
		sourceImg = new URL("/favicon.ico", window.location.origin).href;
	} catch (e) {
		sourceImg = "";
	}

	console.log("Social Stream injected: VPZone");

	currentChannelSlug = getChannelSlugFromUrl();
	window.addEventListener("message", handleWindowMessage);

	setInterval(function () {
		if (window.location.href !== lastUrl) {
			lastUrl = window.location.href;
			recentFingerprints.clear();
			seenWsMessageIds.clear();
			avatarCache.clear();
			avatarPending.clear();
			lastViewerCount = null;
			currentChannelSlug = getChannelSlugFromUrl();
		}
		attachObserver();
	}, 1000);

	attachObserver();
	setTimeout(checkViewers, 1500);
	setInterval(checkViewers, 10000);
})();
