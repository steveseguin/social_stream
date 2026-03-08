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
			var label = (badgeNode.getAttribute("aria-label") || badgeNode.getAttribute("title") || "").trim();
			var normalizedLabel = label.toLowerCase();
			if (!label || seen.has(normalizedLabel)) {
				return;
			}
			seen.add(normalizedLabel);
			badges.push(buildBadgeObject(label, badgeNode));
		});

		return badges;
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
		var contentRoot = row.querySelector("div.min-w-0") || row.lastElementChild;
		var headerNode = contentRoot ? getDirectChildrenByTag(contentRoot, "SPAN")[0] || null : null;
		var nameNode = contentRoot ? contentRoot.querySelector("span.font-semibold") : null;
		var messageNode = contentRoot ? getDirectChildrenByTag(contentRoot, "P")[0] || contentRoot.querySelector("p") : null;
		var avatarNode = getDirectChildrenByTag(row, "IMG").find(function (image) {
			return image && (image.getAttribute("src") || image.src);
		}) || null;

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
			timestamp: getDirectChildrenByTag(headerNode || document.createElement("span"), "SPAN").slice(-1)[0]?.textContent?.trim() || ""
		};
		return data;
	}

	function parseEventRow(row) {
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
		if (settings.captureevents === false) {
			return null;
		}
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
		if (row.querySelector("p") && row.querySelector("span.font-semibold")) {
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

	function findViewerCountNode() {
		var selector = "div.absolute.top-3.left-3 span";
		var spans = Array.from(document.querySelectorAll(selector));
		var match = spans.find(function (span) {
			return /\bviewers?\b/i.test((span.textContent || "").trim());
		});
		if (match) {
			return match;
		}

		spans = Array.from(document.querySelectorAll("span"));
		return spans.find(function (span) {
			var text = (span.textContent || "").trim();
			if (!/\bviewers?\b/i.test(text)) {
				return false;
			}
			var parentText = span.parentElement ? span.parentElement.textContent || "" : "";
			return /\bLIVE\b/i.test(parentText);
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

	setInterval(function () {
		if (window.location.href !== lastUrl) {
			lastUrl = window.location.href;
			recentFingerprints.clear();
			lastViewerCount = null;
		}
		attachObserver();
	}, 1000);

	attachObserver();
	setTimeout(checkViewers, 1500);
	setInterval(checkViewers, 10000);
})();
