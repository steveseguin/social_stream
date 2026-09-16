(function () {
	var isExtensionOn = true;
	var settings = {};
	var recentKeys = [];
	var observedChatContainer = null;
	var chatObserver = null;
	var processedNodes = typeof WeakSet !== "undefined" ? new WeakSet() : null;
	var lastViewerCount = null;

	function hasRuntime() {
		return typeof chrome !== "undefined" && chrome && chrome.runtime && chrome.runtime.id;
	}

	function sendRuntimeMessage(payload, callback) {
		try {
			if (hasRuntime()) {
				chrome.runtime.sendMessage(chrome.runtime.id, payload, callback || function () {});
				return true;
			}
		} catch (e) {
			console.error(e);
		}

		try {
			if (window.ninjafy && typeof window.ninjafy.sendMessage === "function") {
				window.ninjafy.sendMessage(null, payload, null, typeof window.__SSAPP_TAB_ID__ !== "undefined" ? window.__SSAPP_TAB_ID__ : null);
				return true;
			}
		} catch (e) {
			console.error(e);
		}

		try {
			var forwarded = {};
			var key = "";
			for (key in payload) {
				if (Object.prototype.hasOwnProperty.call(payload, key)) {
					forwarded[key] = payload[key];
				}
			}
			if (typeof window.__SSAPP_TAB_ID__ !== "undefined") {
				forwarded.__tabID__ = window.__SSAPP_TAB_ID__;
			}
			window.postMessage(forwarded, "*");
			return true;
		} catch (e) {
			console.error(e);
		}

		return false;
	}

	function toDataURL(url, callback) {
		var xhr = new XMLHttpRequest();
		xhr.onload = function () {
			var blob = xhr.response;

			if (blob.size > (55 * 1024)) {
				callback(url);
				return;
			}

			var reader = new FileReader();
			reader.onloadend = function () {
				callback(reader.result);
			};
			reader.readAsDataURL(xhr.response);
		};
		xhr.open("GET", url);
		xhr.responseType = "blob";
		xhr.send();
	}

	function escapeHtml(unsafe) {
		try {
			if (settings.textonlymode) {
				return unsafe;
			}
			return unsafe
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;") || "";
		} catch (e) {
			return "";
		}
	}

	function cleanText(value) {
		return (value || "").replace(/\s+/g, " ").trim();
	}

	function parseCompactCount(value) {
		var raw = "";
		var multiplier = 1;
		var parsed = 0;

		if (value === null || typeof value === "undefined") {
			return null;
		}

		raw = String(value).replace(/,/g, "").trim().toUpperCase();
		if (!raw) {
			return null;
		}

		if (raw.charAt(raw.length - 1) === "K") {
			multiplier = 1000;
			raw = raw.slice(0, -1);
		} else if (raw.charAt(raw.length - 1) === "M") {
			multiplier = 1000000;
			raw = raw.slice(0, -1);
		} else if (raw.charAt(raw.length - 1) === "B") {
			multiplier = 1000000000;
			raw = raw.slice(0, -1);
		}

		raw = raw.replace(/[^\d.]/g, "");
		if (!raw) {
			return null;
		}

		parsed = parseFloat(raw);
		if (!isFinite(parsed)) {
			return null;
		}

		return Math.round(parsed * multiplier);
	}

	function getAllContentNodes(element) {
		var resp = "";
		var i = 0;
		var node = null;

		if (!element) {
			return resp;
		}

		if (!element.childNodes || !element.childNodes.length) {
			if (element.nodeType === 1 && element.nodeName === "IMG" && settings.textonlymode) {
				return escapeHtml(element.alt || "") || "";
			}
			if (element.textContent) {
				return escapeHtml(element.textContent) || "";
			}
			return "";
		}

		for (i = 0; i < element.childNodes.length; i += 1) {
			node = element.childNodes[i];
			if (!node) {
				continue;
			}
			if (node.childNodes && node.childNodes.length) {
				resp += getAllContentNodes(node);
			} else if (node.nodeType === 3 && node.textContent && node.textContent.trim().length > 0) {
				resp += escapeHtml(node.textContent);
			} else if (node.nodeType === 1) {
				if (!settings.textonlymode) {
					if (node.nodeName === "IMG" && node.src) {
						node.src = node.src + "";
					}
					resp += node.outerHTML;
				} else if (node.nodeName === "IMG" && node.alt) {
					resp += escapeHtml(node.alt);
				}
			}
		}

		return resp;
	}

	function uniquePush(list, value) {
		if (!value) {
			return;
		}
		if (list.indexOf(value) === -1) {
			list.push(value);
		}
	}

	function extractBackgroundImageUrl(styleValue) {
		var match = null;
		if (!styleValue) {
			return "";
		}
		match = styleValue.match(/url\((['"]?)(.*?)\1\)/i);
		return match && match[2] ? match[2] : "";
	}

	function getHeaderNode(ele) {
		if (!ele || !ele.querySelector) {
			return null;
		}
		return ele.querySelector('[type="message"], [type="Default"]');
	}

	function getContentRoot(ele) {
		var children = null;
		var i = 0;
		var child = null;

		if (!ele || !ele.children || !ele.children.length) {
			return ele || null;
		}

		children = ele.children;
		for (i = 0; i < children.length; i += 1) {
			child = children[i];
			if (child && child.querySelector && child.querySelector('[type="message"], [type="Default"]')) {
				return child;
			}
		}

		return ele;
	}

	function isLikelyMessageBody(node, header) {
		var text = "";

		if (!node || node.nodeType !== 1) {
			return false;
		}

		if (header && (node === header || (node.contains && node.contains(header)))) {
			return false;
		}

		if (node.getAttribute && (node.getAttribute("type") === "message" || node.getAttribute("type") === "Default")) {
			return false;
		}

		if (node.querySelector && node.querySelector('[data-testid="playtag"]')) {
			return false;
		}

		if (node.querySelector && node.querySelector('button[aria-label^="Reply"]')) {
			return false;
		}

		text = cleanText(node.textContent);
		if (text) {
			return true;
		}

		return !!(node.querySelector && node.querySelector('img[src][draggable="false"], img[alt][src]'));
	}

	function isLikelyIconImage(img) {
		var alt = "";

		if (!img) {
			return true;
		}

		alt = cleanText((img.alt || "").toLowerCase());
		if (!alt) {
			return false;
		}

		return alt.indexOf("icon") !== -1 || alt === "channel badge";
	}

	function getAuthorName(ele) {
		var author = null;
		var header = null;

		if (!ele || !ele.querySelector) {
			return "";
		}

		author = ele.querySelector('[data-testid="playtag"]');
		if (author) {
			return cleanText(author.textContent);
		}

		header = getHeaderNode(ele);
		if (header) {
			author = header.querySelector("p");
			if (author) {
				return cleanText(author.textContent);
			}
		}

		return "";
	}

	function getMessageNode(ele) {
		var header = null;
		var contentRoot = null;
		var children = null;
		var i = 0;
		var node = null;

		if (!ele) {
			return null;
		}

		header = getHeaderNode(ele);
		if (header && header.parentElement && header.parentElement.children) {
			children = header.parentElement.children;
			for (i = 0; i < children.length; i += 1) {
				node = children[i];
				if (isLikelyMessageBody(node, header)) {
					return node;
				}
			}
		}

		contentRoot = getContentRoot(ele);
		if (contentRoot && contentRoot.querySelectorAll) {
			children = contentRoot.querySelectorAll("div");
			for (i = 0; i < children.length; i += 1) {
				node = children[i];
				if (isLikelyMessageBody(node, header)) {
					return node;
				}
			}
		}

		return null;
	}

	function getMessageHtml(ele) {
		var node = getMessageNode(ele);
		return node ? cleanText(getAllContentNodes(node)) : "";
	}

	function getPlainMessage(ele) {
		var node = getMessageNode(ele);
		return node ? cleanText(node.textContent) : "";
	}

	function getAvatarUrl(ele) {
		var avatar = null;
		var images = null;
		var firstChild = null;
		var i = 0;

		if (!ele || !ele.querySelector) {
			return "";
		}

		avatar = ele.querySelector('img[alt="User avatar"][src]');
		if (avatar && avatar.src) {
			return avatar.src;
		}

		firstChild = ele.firstElementChild;
		if (firstChild && firstChild.querySelector) {
			avatar = firstChild.querySelector("img[src]");
			if (avatar && avatar.src && !isLikelyIconImage(avatar)) {
				return avatar.src;
			}
		}

		images = ele.querySelectorAll("img[src]");
		for (i = 0; i < images.length; i += 1) {
			if (isLikelyIconImage(images[i])) {
				continue;
			}
			if (images[i].closest && images[i].closest('[type="message"], [type="Default"]')) {
				continue;
			}
			if (images[i].closest && images[i].closest('button[aria-label^="Reply"]')) {
				continue;
			}
			if (images[i].src) {
				return images[i].src;
			}
		}

		return "";
	}

	function collectBadges(ele) {
		var badges = [];
		var header = getHeaderNode(ele);
		var images = null;
		var bgNodes = null;
		var i = 0;
		var bgUrl = "";

		if (!header) {
			return badges;
		}

		images = header.querySelectorAll("img[src]");
		for (i = 0; i < images.length; i += 1) {
			uniquePush(badges, images[i].src || "");
		}

		bgNodes = header.querySelectorAll('[style*="background-image"]');
		for (i = 0; i < bgNodes.length; i += 1) {
			bgUrl = extractBackgroundImageUrl(bgNodes[i].getAttribute("style") || "");
			uniquePush(badges, bgUrl);
		}

		return badges;
	}

	function getReplyContext(ele) {
		var parentId = "";
		var parentNode = null;
		var context = null;

		if (!ele || !ele.getAttribute) {
			return null;
		}

		parentId = ele.getAttribute("parent") || "";
		if (!parentId) {
			return null;
		}

		parentNode = document.getElementById(parentId);
		if (!parentNode) {
			return null;
		}

		context = {
			id: parentId,
			author: getAuthorName(parentNode),
			text: getPlainMessage(parentNode)
		};

		if (!context.author && !context.text) {
			return null;
		}

		return context;
	}

	function getMessageSignature(ele, data) {
		var parts = [];
		parts.push("shareplay");
		parts.push(ele && ele.getAttribute ? (ele.getAttribute("id") || "") : "");
		parts.push(ele && ele.getAttribute ? (ele.getAttribute("createdat") || "") : "");
		parts.push(ele && ele.getAttribute ? (ele.getAttribute("updatedat") || "") : "");
		parts.push(data.event || "");
		parts.push(data.chatname || "");
		parts.push(data.chatmessage || "");
		return parts.join("::");
	}

	function cleanupRecentKeys() {
		var cutoff = Date.now() - 30000;
		while (recentKeys.length && recentKeys[0].time < cutoff) {
			recentKeys.shift();
		}
	}

	function hasRecentKey(key) {
		var i = 0;
		cleanupRecentKeys();
		for (i = 0; i < recentKeys.length; i += 1) {
			if (recentKeys[i].key === key) {
				return true;
			}
		}
		return false;
	}

	function rememberKey(key) {
		cleanupRecentKeys();
		recentKeys.push({
			key: key,
			time: Date.now()
		});
	}

	function markProcessed(node) {
		if (!node) {
			return;
		}
		if (processedNodes) {
			processedNodes.add(node);
		} else {
			node.__ssnShareplayProcessed = true;
		}
	}

	function isProcessed(node) {
		if (!node) {
			return true;
		}
		if (processedNodes) {
			return processedNodes.has(node);
		}
		return !!node.__ssnShareplayProcessed;
	}

	function buildChatMessageData(ele) {
		var name = getAuthorName(ele);
		var htmlMessage = getMessageHtml(ele);
		var plainMessage = getPlainMessage(ele);
		var chatimg = getAvatarUrl(ele);
		var badges = collectBadges(ele);
		var replyContext = getReplyContext(ele);
		var replyPrefix = "";
		var data = null;

		if (!name && !htmlMessage && !plainMessage) {
			return null;
		}

		data = {
			chatname: name,
			chatbadges: badges.length ? badges : "",
			backgroundColor: "",
			textColor: "",
			chatmessage: htmlMessage || plainMessage || "",
			chatimg: chatimg,
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: settings.textonlymode || false,
			type: "shareplay"
		};

		if (replyContext && data.chatmessage) {
			replyPrefix = replyContext.author ? ("@" + replyContext.author) : replyContext.text;
			data.initial = replyContext.text || replyPrefix;
			data.reply = plainMessage || cleanText(data.chatmessage);
			data.meta = {
				reply: replyContext
			};
			if (replyPrefix) {
				if (settings.textonlymode) {
					data.chatmessage = replyPrefix + ": " + data.chatmessage;
				} else {
					data.chatmessage = "<i><small>" + escapeHtml(replyPrefix) + ":&nbsp;</small></i> " + data.chatmessage;
				}
			}
		}

		return data;
	}

	function isShoutoutCard(ele) {
		var text = "";
		if (!ele || !ele.querySelector || ele.hasAttribute("createdat")) {
			return false;
		}
		if (ele.closest && ele.closest("[createdat]")) {
			return false;
		}
		if (!ele.querySelector('img[alt="User avatar"][src]')) {
			return false;
		}
		text = cleanText(ele.textContent).toLowerCase();
		if (!text || text.length > 280 || text.indexOf("shoutout") === -1) {
			return false;
		}
		return !!(ele.querySelector("button") || ele.querySelector('[style*="background-image"]'));
	}

	function isBlitzCard(ele) {
		var text = "";
		if (!ele || !ele.querySelector || ele.hasAttribute("createdat")) {
			return false;
		}
		if (ele.closest && ele.closest("[createdat]")) {
			return false;
		}
		if (!ele.querySelector('img[alt="User avatar"][src]')) {
			return false;
		}
		text = cleanText(ele.textContent).toLowerCase();
		if (!text || text.length > 280 || text.indexOf("blitz") === -1) {
			return false;
		}
		return !!(ele.querySelector("button") || ele.querySelector('img[alt="User avatar"][src]') || ele.querySelector('[style*="background-image"]'));
	}

	function findShoutoutCards(root) {
		var cards = [];
		var triggers = null;
		var i = 0;
		var current = null;

		if (!root || root.nodeType !== 1) {
			return cards;
		}

		if (isShoutoutCard(root)) {
			cards.push(root);
		}

		triggers = root.querySelectorAll("button, [style*=\"background-image\"]");
		for (i = 0; i < triggers.length; i += 1) {
			current = triggers[i];
			while (current && current !== root.parentElement) {
				if (isShoutoutCard(current)) {
					if (cards.indexOf(current) === -1) {
						cards.push(current);
					}
					break;
				}
				current = current.parentElement;
			}
		}

		return cards;
	}

	function findBlitzCards(root) {
		var cards = [];
		var nodes = null;
		var i = 0;

		if (!root || root.nodeType !== 1) {
			return cards;
		}

		if (cleanText(root.textContent).toLowerCase().indexOf("blitz") === -1) {
			return cards;
		}

		if (isBlitzCard(root)) {
			cards.push(root);
		}

		nodes = root.querySelectorAll ? root.querySelectorAll("div") : [];
		for (i = 0; i < nodes.length; i += 1) {
			if (isBlitzCard(nodes[i]) && cards.indexOf(nodes[i]) === -1) {
				cards.push(nodes[i]);
			}
		}

		return cards;
	}

	function findClosestShoutoutCard(node) {
		var current = node;
		while (current && current !== document.body) {
			if (isShoutoutCard(current)) {
				return current;
			}
			current = current.parentElement;
		}
		return null;
	}

	function findClosestBlitzCard(node) {
		var current = node;
		while (current && current !== document.body) {
			if (isBlitzCard(current)) {
				return current;
			}
			current = current.parentElement;
		}
		return null;
	}

	function buildShoutoutData(ele) {
		var fullText = cleanText(ele.textContent);
		var title = "Shoutout";
		var button = ele.querySelector("button");
		var actionText = button ? cleanText(button.textContent) : "";
		var target = "";
		var avatar = getAvatarUrl(ele);
		var contentimg = "";
		var bgNode = ele.querySelector('[style*="background-image"]');
		var data = null;
		var match = null;

		if (!fullText) {
			return null;
		}

		fullText = fullText.replace(/^Shoutout\s*/i, "");
		if (actionText && fullText.lastIndexOf(actionText) === fullText.length - actionText.length) {
			fullText = cleanText(fullText.slice(0, -actionText.length));
		}

		match = fullText.match(/@([A-Za-z0-9_]+)/);
		if (match && match[1]) {
			target = match[1];
		}

		if (bgNode) {
			contentimg = extractBackgroundImageUrl(bgNode.getAttribute("style") || "");
		}

		data = {
			chatname: target || title,
			chatbadges: "",
			backgroundColor: "",
			textColor: "",
			chatmessage: fullText,
			chatimg: avatar,
			hasDonation: "",
			membership: "",
			contentimg: contentimg,
			textonly: settings.textonlymode || false,
			type: "shareplay",
			event: "shoutout",
			meta: {
				cardType: "shoutout",
				action: actionText || "Follow"
			}
		};

		return data;
	}

	function buildBlitzData(ele) {
		var fullText = cleanText(ele.textContent);
		var avatar = getAvatarUrl(ele);
		var contentimg = "";
		var bgNode = ele.querySelector('[style*="background-image"]');
		var data = null;
		var mentionMatch = null;
		var viewersMatch = null;
		var fromLogin = "";
		var viewers = null;
		var raidMessage = "";

		if (!fullText) {
			return null;
		}

		mentionMatch = fullText.match(/@([A-Za-z0-9_]+)/);
		if (mentionMatch && mentionMatch[1]) {
			fromLogin = mentionMatch[1];
		} else {
			mentionMatch = fullText.match(/^([A-Za-z0-9_]+)\s+(?:is\s+)?blitz/i);
			if (mentionMatch && mentionMatch[1]) {
				fromLogin = mentionMatch[1];
			}
		}

		viewersMatch = fullText.match(/(\d[\d,.]*\s*[KMB]?)\s*(?:viewer|raider|party|people)/i) || fullText.match(/\bwith\s+(\d[\d,.]*\s*[KMB]?)\b/i);
		if (viewersMatch && viewersMatch[1]) {
			viewers = parseCompactCount(viewersMatch[1]);
		}

		if (bgNode) {
			contentimg = extractBackgroundImageUrl(bgNode.getAttribute("style") || "");
		}

		raidMessage = fullText;
		if (fromLogin && viewers !== null) {
			raidMessage = "Blitzing with " + viewers + " viewers!";
		} else if (fromLogin) {
			raidMessage = "Blitzing in!";
		}

		data = {
			chatname: fromLogin || "Blitz",
			chatbadges: "",
			backgroundColor: "",
			textColor: "",
			chatmessage: raidMessage,
			chatimg: avatar,
			hasDonation: "",
			membership: "",
			contentimg: contentimg,
			textonly: settings.textonlymode || false,
			type: "shareplay",
			event: "raid",
			meta: {
				cardType: "blitz",
				rawText: fullText
			}
		};

		if (fromLogin) {
			data.meta.fromLogin = fromLogin;
		}
		if (viewers !== null) {
			data.meta.viewers = viewers;
		}

		return data;
	}

	function pushMessage(data) {
		sendRuntimeMessage({ "message": data }, function () {});
	}

	function sendViewerCount(count) {
		sendRuntimeMessage({
			"message": {
				type: "shareplay",
				event: "viewer_update",
				meta: count
			}
		}, function () {});
	}

	function getViewerCountFromDom() {
		var icons = null;
		var i = 0;
		var button = null;
		var text = "";
		var parsed = null;
		var best = null;

		icons = document.querySelectorAll('img[alt="visibility icon"], img[src*="visibility"]');
		for (i = 0; i < icons.length; i += 1) {
			button = icons[i].closest ? icons[i].closest("button") : null;
			if (!button || button.closest("[streamer-info]")) {
				continue;
			}
			text = cleanText(button.textContent);
			parsed = parseCompactCount(text);
			if (parsed === null) {
				continue;
			}
			if (best === null || parsed > best) {
				best = parsed;
			}
		}

		return best;
	}

	function checkViewerCount(forceUpdate) {
		var count = null;

		if (!isExtensionOn || !(settings.showviewercount || settings.hypemode)) {
			return;
		}

		count = getViewerCountFromDom();
		if (count === null) {
			count = 0;
		}

		if (forceUpdate || lastViewerCount !== count) {
			lastViewerCount = count;
			sendViewerCount(count);
		}
	}

	function processChatNode(ele) {
		var data = null;
		var key = "";

		if (!ele || ele.nodeType !== 1 || isProcessed(ele)) {
			return;
		}

		data = buildChatMessageData(ele);
		if (!data) {
			return;
		}

		markProcessed(ele);
		key = getMessageSignature(ele, data);
		if (hasRecentKey(key)) {
			return;
		}

		rememberKey(key);
		pushMessage(data);
	}

	function processShoutoutNode(ele) {
		var data = null;
		var key = "";

		if (!ele || ele.nodeType !== 1 || isProcessed(ele)) {
			return;
		}

		data = buildShoutoutData(ele);
		if (!data) {
			return;
		}

		markProcessed(ele);
		key = getMessageSignature(ele, data);
		if (hasRecentKey(key)) {
			return;
		}

		rememberKey(key);
		pushMessage(data);
	}

	function processBlitzNode(ele) {
		var data = null;
		var key = "";

		if (!ele || ele.nodeType !== 1 || isProcessed(ele)) {
			return;
		}

		data = buildBlitzData(ele);
		if (!data) {
			return;
		}

		markProcessed(ele);
		key = getMessageSignature(ele, data);
		if (hasRecentKey(key)) {
			return;
		}

		rememberKey(key);
		pushMessage(data);
	}

	function markExistingContent(target) {
		var existing = [];
		var shoutouts = [];
		var blitzes = [];
		var i = 0;

		if (!target || !target.querySelectorAll) {
			return;
		}

		existing = target.querySelectorAll("[createdat]");
		for (i = 0; i < existing.length; i += 1) {
			markProcessed(existing[i]);
		}

		shoutouts = findShoutoutCards(target);
		for (i = 0; i < shoutouts.length; i += 1) {
			markProcessed(shoutouts[i]);
		}

		blitzes = findBlitzCards(target);
		for (i = 0; i < blitzes.length; i += 1) {
			markProcessed(blitzes[i]);
		}
	}

	function handleAddedNode(node) {
		var chatNodes = [];
		var shoutouts = [];
		var blitzes = [];
		var i = 0;
		var parentMessage = null;
		var parentShoutout = null;
		var parentBlitz = null;

		if (!node || node.nodeType !== 1) {
			return;
		}

		parentMessage = node.closest ? node.closest("[createdat]") : null;
		if (parentMessage) {
			processChatNode(parentMessage);
		}

		parentShoutout = findClosestShoutoutCard(node);
		if (parentShoutout) {
			processShoutoutNode(parentShoutout);
		}

		parentBlitz = findClosestBlitzCard(node);
		if (parentBlitz) {
			processBlitzNode(parentBlitz);
		}

		if (node.hasAttribute && node.hasAttribute("createdat")) {
			processChatNode(node);
		}

		chatNodes = node.querySelectorAll ? node.querySelectorAll("[createdat]") : [];
		for (i = 0; i < chatNodes.length; i += 1) {
			processChatNode(chatNodes[i]);
		}

		shoutouts = findShoutoutCards(node);
		for (i = 0; i < shoutouts.length; i += 1) {
			processShoutoutNode(shoutouts[i]);
		}

		blitzes = findBlitzCards(node);
		for (i = 0; i < blitzes.length; i += 1) {
			processBlitzNode(blitzes[i]);
		}
	}

	function observeChat(target) {
		if (!target) {
			return;
		}

		if (chatObserver) {
			try {
				chatObserver.disconnect();
			} catch (e) {}
			chatObserver = null;
		}

		markExistingContent(target);

		chatObserver = new (window.MutationObserver || window.WebKitMutationObserver)(function (mutations) {
			var i = 0;
			var j = 0;
			var mutation = null;
			var addedNodes = null;
			for (i = 0; i < mutations.length; i += 1) {
				mutation = mutations[i];
				addedNodes = mutation && mutation.addedNodes ? mutation.addedNodes : [];
				for (j = 0; j < addedNodes.length; j += 1) {
					handleAddedNode(addedNodes[j]);
				}
			}
		});

		chatObserver.observe(target, { childList: true, subtree: true });
	}

	function focusChatInput() {
		var input = document.querySelector('[streamer-info] textarea[placeholder="Send a message..."]') ||
			document.querySelector('[streamer-info] textarea[maxlength]') ||
			document.querySelector('textarea[placeholder="Send a message..."]') ||
			document.querySelector("textarea[maxlength]");

		if (!input) {
			return false;
		}

		try {
			input.focus();
			return true;
		} catch (e) {}

		return false;
	}

	if (hasRuntime()) {
		sendRuntimeMessage({ "getSettings": true }, function (response) {
			if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
				return;
			}
			response = response || {};
			if ("settings" in response) {
				settings = response.settings;
			}
		});

		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			try {
				if ("getSource" === request) {
					sendResponse("shareplay");
					return;
				}
				if ("focusChat" === request) {
					sendResponse(focusChatInput());
					return;
				}
				if (typeof request === "object" && request && "settings" in request) {
					settings = request.settings;
					sendResponse(true);
					return;
				}
			} catch (e) {}
			sendResponse(false);
		});
	}

	console.log("social stream injected");

	setInterval(function () {
		var chatContainer = document.querySelector("[streamer-info]");
		if (!chatContainer || chatContainer === observedChatContainer) {
			return;
		}

		observedChatContainer = chatContainer;
		setTimeout(function () {
			if (observedChatContainer === chatContainer) {
				observeChat(chatContainer);
				checkViewerCount(true);
			}
		}, 1500);
	}, 1000);

	setInterval(function () {
		checkViewerCount(false);
	}, 10000);
})();
