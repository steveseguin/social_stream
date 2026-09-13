(function () {
	if (window.__SSN_JOYSTICK_CAPTURE_LOADED__) return;
	window.__SSN_JOYSTICK_CAPTURE_LOADED__ = true;

	var settings = {};
	var isExtensionOn = true;
	var observer = null;
	var observedList = null;
	var wsCaptureActive = false;
	var lastViewerCount = null;
	var lastFollowerCount = null;
	var lastSubscriberCount = null;
	var currentUrl = window.location.href;
	var channelSlug = getChannelSlug();
	var recentFingerprints = {};
	var seenMessageIds = {};
	var messageCache = {};
	var renderedNameColors = {};

	function getChannelSlug() {
		try {
			var match = window.location.pathname.match(/^\/u\/([^\/?#]+)\/chat/i);
			return match && match[1] ? decodeURIComponent(match[1]).replace(/^@+/, "") : "";
		} catch (error) {
			return "";
		}
	}

	function escapeHtml(value) {
		value = value == null ? "" : String(value);
		if (settings.textonlymode) return value;
		return value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function escapeXml(value) {
		return (value == null ? "" : String(value))
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	}

	function stripHtml(value) {
		value = value == null ? "" : String(value);
		try {
			var div = document.createElement("div");
			div.innerHTML = value.replace(/<br\s*\/?>/gi, "\n");
			return (div.textContent || "").replace(/\u00a0/g, " ").trim();
		} catch (error) {
			return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
		}
	}

	function renderText(value) {
		var text = value == null ? "" : String(value);
		if (settings.textonlymode) return stripHtml(text);
		return escapeHtml(stripHtml(text)).replace(/\n/g, "<br>");
	}

	function absoluteUrl(value) {
		try {
			return value ? new URL(value, window.location.href).href : "";
		} catch (error) {
			return value || "";
		}
	}

	function getAllContentNodes(element) {
		if (!element) return "";
		var response = "";
		Array.prototype.forEach.call(element.childNodes || [], function (node) {
			if (node.nodeType === 3) {
				response += escapeHtml(node.textContent || "");
				return;
			}
			if (node.nodeType !== 1) return;
			if (node.tagName === "BR") {
				response += settings.textonlymode ? "\n" : "<br>";
				return;
			}
			if (node.tagName === "IMG") {
				var alt = node.getAttribute("alt") || "";
				if (settings.textonlymode) {
					response += alt;
				} else {
					response += '<img src="' + escapeHtml(absoluteUrl(node.getAttribute("src") || node.src || "")) + '" alt="' + escapeHtml(alt) + '">';
				}
				return;
			}
			response += getAllContentNodes(node);
		});
		return response.trim();
	}

	function parseJson(value) {
		if (!value) return null;
		if (typeof value === "object") return value;
		try { return JSON.parse(String(value)); } catch (error) { return null; }
	}

	function nameColorKey(value) {
		return stripHtml(value || "").replace(/:\s*$/, "").trim().toLowerCase();
	}

	function rememberNameColor(name, color) {
		var key = nameColorKey(name);
		color = String(color || "").trim();
		if (key && color) renderedNameColors[key] = color;
	}

	function knownNameColor() {
		for (var i = 0; i < arguments.length; i += 1) {
			var key = nameColorKey(arguments[i]);
			if (key && renderedNameColors[key]) return renderedNameColors[key];
		}
		return "";
	}

	function sourceBase() {
		var data = {
			chatbadges: [],
			backgroundColor: "",
			textColor: "",
			chatimg: "",
			hasDonation: "",
			membership: "",
			contentimg: "",
			textonly: !!settings.textonlymode,
			type: "joystick"
		};
		if (channelSlug) data.sourceName = channelSlug;
		return data;
	}

	function roleBadge(label, color) {
		var width = Math.max(32, Math.round(label.length * 6.5) + 14);
		return {
			type: "svg",
			html: '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="16" viewBox="0 0 ' + width + ' 16"><rect x="0.5" y="0.5" rx="8" width="' + (width - 1) + '" height="15" fill="' + escapeXml(color) + '"></rect><text x="' + (width / 2) + '" y="11" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#fff">' + escapeXml(label) + "</text></svg>"
		};
	}

	function rolesFromAuthor(author, rawType) {
		author = author && typeof author === "object" ? author : {};
		var badges = author.badges && typeof author.badges === "object" ? author.badges : {};
		var flair = String(author.displayNameWithFlair || "");
		var botType = rawType === "event_bot_message" || rawType === "bot_message";
		return {
			bot: botType || !!badges.bot,
			newAccount: !!badges.new || /newAccountBadge/i.test(flair),
			streamer: !!badges.streamer || !!author.isStreamer || !!author.isContentCreator,
			staff: !!badges.staff || !!author.isStaff || /staffBadge/i.test(flair),
			moderator: !!badges.mod || !!badges.moderator || !!author.isModerator,
			subscriber: !!badges.subscriber || !!author.isSubscriber,
			host: !!badges.host,
			verified: !!author.verified || !!author.isVerified
		};
	}

	function badgesFromRoles(roles) {
		var badges = [];
		if (roles.streamer || roles.host) badges.push(roleBadge("HOST", "#c34ecf"));
		if (roles.moderator) badges.push(roleBadge("MOD", "#2d9d5c"));
		if (roles.staff) badges.push(roleBadge("STAFF", "#6d5dfc"));
		if (roles.subscriber) badges.push(roleBadge("SUB", "#e04c91"));
		if (roles.verified && !roles.streamer) badges.push(roleBadge("VERIFIED", "#3b82f6"));
		if (roles.bot) badges.push(roleBadge("BOT", "#7c67ff"));
		if (roles.newAccount) badges.push(roleBadge("NEW", "#64748b"));
		return badges;
	}

	function pruneCaches() {
		var now = Date.now();
		Object.keys(recentFingerprints).forEach(function (key) {
			if (now - recentFingerprints[key] > 8000) delete recentFingerprints[key];
		});
		Object.keys(seenMessageIds).forEach(function (key) {
			if (now - seenMessageIds[key] > 120000) {
				delete seenMessageIds[key];
				delete messageCache[key];
			}
		});
	}

	function dataFingerprint(data) {
		if (!data) return "";
		if (data.event && typeof data.meta === "number") {
			return ["counter", data.event, data.meta].join("::").toLowerCase();
		}
		if (data.event === "new_follower") {
			return "event::new_follower::" + String(data.username || data.chatname || "").toLowerCase();
		}
		if (data.event === "donation") {
			return ["event", "donation", data.username || data.chatname || "", data.donoValue || data.hasDonation || ""].join("::").toLowerCase();
		}
		if (data.event) {
			return ["event", data.event, data.chatname || "", stripHtml(data.chatmessage || "")].join("::").toLowerCase();
		}
		return ["message", data.chatname || "", stripHtml(data.chatmessage || ""), data.private ? "private" : "public"].join("::").toLowerCase();
	}

	function pushMessage(data, force) {
		if (!isExtensionOn || !data) return;
		pruneCaches();
		var nativeId = data.id || (data.meta && data.meta.messageId) || "";
		if (!force && nativeId && seenMessageIds[nativeId]) return;
		var fingerprint = dataFingerprint(data);
		if (!force && fingerprint && recentFingerprints[fingerprint] && (!nativeId || data.event === "new_follower" || data.event === "donation")) return;
		if (nativeId) seenMessageIds[nativeId] = Date.now();
		if (fingerprint) recentFingerprints[fingerprint] = Date.now();
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {});
		} catch (error) {}
	}

	function pushDelete(payload) {
		if (!isExtensionOn || !payload) return;
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { "delete": payload }, function () {});
		} catch (error) {}
	}

	function applyBotSemantics(data, plainText, originalName) {
		var follow = String(plainText || "").match(/^(.+?)\s+is\s+now\s+following!?$/i);
		if (follow && follow[1]) {
			var follower = follow[1].trim();
			data.event = "new_follower";
			data.chatname = escapeHtml(follower);
			data.chatmessage = renderText(follower + " is now following!");
			data.username = follower.toLowerCase();
			return;
		}
		var tip = String(plainText || "").match(/^(.+?)\s+tipped\s+([\d,.]+)\s+(tokens?)/i);
		if (tip && tip[1] && tip[2]) {
			var supporter = tip[1].trim();
			var amount = Number(tip[2].replace(/,/g, ""));
			var currency = String(tip[3] || "tokens").toLowerCase();
			data.event = "donation";
			data.chatname = escapeHtml(supporter);
			data.chatmessage = renderText(String(plainText || "").trim());
			data.username = supporter.toLowerCase();
			data.hasDonation = String(amount) + " " + currency;
			data.donoValue = amount;
			data.meta = {
				eventType: "Tipped",
				supporter: supporter,
				amount: amount,
				currency: currency,
				message: String(plainText || "").trim(),
				giftName: null,
				giftType: null,
				tier: null
			};
			return;
		}
		if (String(originalName || "").toLowerCase() === "notice") data.event = true;
	}

	function normalizeChatMessage(message, identifier, whisper) {
		if (!message || typeof message !== "object") return null;
		var rawType = String(message.type || "").toLowerCase();
		var author = message.author && typeof message.author === "object" ? message.author : {};
		var roles = rolesFromAuthor(author, rawType);
		var flairName = stripHtml(author.displayNameWithFlair || "").replace(/\{\{\{[^}]+\}\}\}/g, "").trim();
		var username = String(author.username || author.slug || message.username || "").trim();
		var displayName = String(author.nickname || author.displayName || flairName || username || "Joystick User").trim();
		var text = message.text == null ? "" : String(message.text);
		if (!displayName || !text) return null;

		var messageId = message.messageId || message.message_id || message.id || "";
		var visibility = String(message.visibility || (whisper ? "private" : "public")).toLowerCase();
		var data = sourceBase();
		data.chatname = escapeHtml(displayName);
		data.chatmessage = renderText(text);
		data.chatimg = author.signedPhotoThumbUrl || author.signedPhotoUrl || author.photoUrl || author.photo_url || "";
		data.chatbadges = badgesFromRoles(roles);
		data.nameColor = author.usernameColor || author.color || knownNameColor(username, displayName);
		data.membership = roles.subscriber ? "Subscriber" : "";
		if (messageId) data.meta = { messageId: String(messageId) };
		if (username) {
			data.username = username;
			data.userid = String(author.id || author.userId || author.user_id || author.slug || username);
		}
		if (messageId) data.id = String(messageId);
		if (message.createdAt || message.sent_at) data.timestamp = message.createdAt || message.sent_at;
		if (visibility === "private" || whisper) data.private = true;
		if (roles.moderator) data.mod = true;
		if (roles.bot) data.bot = true;
		if (roles.bot || /^notice$/i.test(displayName) || /^joystick\.tv bot$/i.test(displayName)) {
			applyBotSemantics(data, stripHtml(text), displayName);
		}
		return data;
	}

	function donationDetails(message, metadata) {
		var amount = null;
		var currency = "tokens";
		metadata = metadata && typeof metadata === "object" ? metadata : {};
		if (metadata.how_much != null && isFinite(Number(metadata.how_much))) amount = Number(metadata.how_much);
		else if (metadata.amount != null && isFinite(Number(metadata.amount))) amount = Number(metadata.amount);
		if (metadata.currency) currency = String(metadata.currency);
		else {
			var currencyMatch = String(message.text || "").match(/[\d,.]+\s*(tokens?|credits?|usd|cad|eur|gbp)/i);
			if (currencyMatch && currencyMatch[1]) currency = String(currencyMatch[1]).toLowerCase();
		}
		if (amount == null) {
			var match = String(message.text || "").match(/([\d,.]+)\s*(tokens?|credits?|usd|cad|eur|gbp)/i);
			if (match && match[1]) {
				amount = Number(match[1].replace(/,/g, ""));
				currency = String(match[2] || currency).toLowerCase();
			}
		}
		return { amount: amount, currency: currency };
	}

	function eventNameForType(rawType) {
		var type = String(rawType || "").toLowerCase();
		if (type === "started" || type === "streamresuming") return "stream_online";
		if (type === "ended" || type === "streamending") return "stream_offline";
		if (type === "followed") return "new_follower";
		if (type === "newsubscription" || type === "new_subscription") return "new_subscriber";
		if (type === "giftedsubscription" || type === "gifted_subscription") return "subscription_gift";
		if (type === "tipped" || type === "tip" || type === "tipmenu") return "donation";
		if (type === "enter_stream") return "user_enter";
		if (type === "leave_stream") return "user_leave";
		return "";
	}

	function counterValue(message, metadata, keys) {
		for (var i = 0; i < keys.length; i += 1) {
			if (metadata[keys[i]] != null && isFinite(Number(metadata[keys[i]]))) return Number(metadata[keys[i]]);
		}
		var countMatch = String(message.text || "").match(/[\d,]+/);
		return countMatch ? Number(countMatch[0].replace(/,/g, "")) : NaN;
	}

	function pushCounter(eventName, count) {
		var data = { type: "joystick", event: eventName, meta: Math.round(count) };
		if (channelSlug) data.sourceName = channelSlug;
		pushMessage(data);
	}

	function normalizePlatformEvent(message, identifier) {
		var rawType = String(message.type || message.event || "");
		var lowerType = rawType.toLowerCase();
		var metadata = parseJson(message.metadata) || {};
		if (typeof metadata !== "object" || Array.isArray(metadata)) metadata = {};

		if (lowerType === "viewercountupdated") {
			var count = counterValue(message, metadata, ["number_of_viewers", "viewer_count"]);
			if (isFinite(count) && count >= 0 && count !== lastViewerCount && (settings.showviewercount || settings.hypemode)) {
				lastViewerCount = count;
				pushCounter("viewer_update", count);
			}
			return null;
		}
		if (lowerType === "followercountupdated") {
			var followerCount = counterValue(message, metadata, ["number_of_followers", "follower_count"]);
			if (isFinite(followerCount) && followerCount >= 0 && followerCount !== lastFollowerCount && !settings.hideevents) {
				lastFollowerCount = followerCount;
				pushCounter("follower_update", followerCount);
			}
			return null;
		}
		if (lowerType === "subscribercountupdated" || lowerType === "subscriptioncountupdated") {
			var subscriberCount = counterValue(message, metadata, ["number_of_subscribers", "number_of_subscriptions", "subscriber_count"]);
			if (isFinite(subscriberCount) && subscriberCount >= 0 && subscriberCount !== lastSubscriberCount && !settings.hideevents) {
				lastSubscriberCount = subscriberCount;
				pushCounter("subscriber_update", subscriberCount);
			}
			return null;
		}

		if (lowerType === "chatmessagereceived" || lowerType === "deviceconnected" || lowerType === "devicedisconnected" || lowerType === "devicesettingsupdated") return null;

		var eventName = eventNameForType(rawType);
		if (!eventName) return null;
		if (settings.hideevents && eventName !== "donation") return null;
		var author = message.author && typeof message.author === "object" ? message.author : {};
		var actor = stripHtml(metadata.who || metadata.username || metadata.user || metadata.subscriber || metadata.gifter || message.username || (message.user && message.user.username) || author.username || "");
		if (!actor && eventName === "new_follower") {
			var followMatch = String(message.text || "").match(/^(.+?)\s+(?:is now following|followed)/i);
			if (followMatch && followMatch[1]) actor = followMatch[1].trim();
		}
		var plainText = stripHtml(message.text || "") || rawType || "Joystick event";
		var details = donationDetails(message, metadata);
		var data = sourceBase();
		data.event = eventName;
		data.chatname = escapeHtml(actor || channelSlug || "Joystick");
		if (eventName === "new_follower" && actor) plainText = actor + " is now following!";
		else if (eventName === "new_subscriber" && actor && !message.text) plainText = actor + " subscribed!";
		else if (eventName === "subscription_gift" && actor && !message.text) plainText = actor + " gifted a subscription!";
		else if (eventName === "stream_online") plainText = "Stream is now LIVE";
		else if (eventName === "stream_offline") plainText = "Stream is now OFFLINE";
		data.chatmessage = renderText(plainText);
		data.chatimg = author.signedPhotoThumbUrl || author.signedPhotoUrl || "";
		if (actor) data.username = actor;
		var platformUserId = metadata.user_id || metadata.userId || message.userId || message.user_id || "";
		if (platformUserId) data.userid = String(platformUserId);
		if (message.messageId || message.id) data.id = String(message.messageId || message.id);
		if (message.createdAt || message.sent_at) data.timestamp = message.createdAt || message.sent_at;
		if (eventName === "donation" && details.amount != null) {
			data.hasDonation = String(details.amount) + " " + details.currency;
			data.donoValue = details.amount;
		}
		if (eventName === "donation") {
			data.meta = {
				eventType: rawType,
				supporter: actor || null,
				amount: details.amount,
				currency: details.amount != null ? details.currency : null,
				message: plainText || null,
				giftName: metadata.tip_menu_item || metadata.prize || null,
				giftType: metadata.gift_type || null,
				tier: metadata.tier || null
			};
		} else if (eventName === "new_subscriber" || eventName === "subscription_gift") {
			var totalGifted = Number(metadata.gifted_quantity != null ? metadata.gifted_quantity : (metadata.quantity != null ? metadata.quantity : metadata.total_gifted));
			var duration = Number(metadata.duration != null ? metadata.duration : (metadata.months != null ? metadata.months : metadata.streak));
			data.membership = "Subscriber";
			data.meta = {
				eventType: rawType,
				subscriber: stripHtml(metadata.subscriber || metadata.recipient || (eventName === "new_subscriber" ? actor : "")) || null,
				gifter: stripHtml(metadata.gifter || metadata.gifted_by || (eventName === "subscription_gift" ? actor : "")) || null,
				totalGifted: isFinite(totalGifted) ? totalGifted : null,
				duration: isFinite(duration) ? duration : null,
				plan: metadata.tier || metadata.plan || metadata.membership || null
			};
		} else if (eventName === "new_follower") {
			var followerMeta = {};
			if (platformUserId) followerMeta.userId = String(platformUserId);
			if (message.createdAt || message.sent_at) followerMeta.followedAt = message.createdAt || message.sent_at;
			if (Object.keys(followerMeta).length) data.meta = followerMeta;
		} else if (eventName === "stream_online" && (message.createdAt || message.sent_at)) {
			data.meta = { startedAt: message.createdAt || message.sent_at };
		}
		return data;
	}

	function identifierFromPacket(packet) {
		try { return JSON.parse(packet.identifier || "{}"); } catch (error) { return {}; }
	}

	function isChatMessage(message, channel) {
		if (channel !== "chatchannel" && channel !== "whisperchatchannel") return false;
		var eventName = String(message.event || "").toLowerCase();
		var type = String(message.type || "").toLowerCase();
		return eventName === "chatmessage" || eventName === "botmessage" ||
			["new_message", "event_bot_message", "bot_message", "pvp_message"].indexOf(type) !== -1;
	}

	function handleEdit(message, identifier) {
		var messageId = String(message.messageId || message.message_id || "");
		if (!messageId || !messageCache[messageId]) return;
		var updated = Object.assign({}, messageCache[messageId], {
			text: message.text != null ? message.text : messageCache[messageId].text,
			emotesUsed: message.emotesUsed || messageCache[messageId].emotesUsed,
			mentionedUsername: message.mentionedUsername || messageCache[messageId].mentionedUsername,
			edited: true,
			editedAt: message.editedAt || "",
			editCount: message.editCount || 1
		});
		messageCache[messageId] = updated;
		pushDelete({ type: "joystick", id: messageId });
		var data = normalizeChatMessage(updated, identifier, false);
		if (data) pushMessage(data, true);
	}

	function handleSocketMessage(message, identifier) {
		if (!message || typeof message !== "object") return;
		var type = String(message.type || "").toLowerCase();
		var channel = String(identifier.channel || "").toLowerCase();

		if (type === "delete_message") {
			var deletedId = String(message.messageId || message.message_id || "");
			if (deletedId) {
				delete messageCache[deletedId];
				pushDelete({ type: "joystick", id: deletedId });
			}
			return;
		}
		if (type === "edit_message") {
			handleEdit(message, identifier);
			return;
		}
		if (type === "user_muted" || type === "user_blocked") {
			if (message.username) pushDelete({ type: "joystick", chatname: String(message.username) });
			return;
		}

		if (isChatMessage(message, channel) || channel === "whisperchatchannel") {
			var data = normalizeChatMessage(message, identifier, channel === "whisperchatchannel");
			if (!data) return;
			var messageId = data.id || (data.meta && data.meta.messageId) || "";
			if (messageId) messageCache[messageId] = Object.assign({}, message);
			if (!data.nameColor) {
				setTimeout(function () {
					data.nameColor = knownNameColor(data.username, data.chatname) || findRenderedNameColor(data.username, data.chatname);
					pushMessage(data);
				}, 100);
			} else {
				pushMessage(data);
			}
			return;
		}

		var eventData = normalizePlatformEvent(message, identifier);
		if (eventData) pushMessage(eventData);
	}

	function handleWsFrame(raw) {
		var packet;
		try { packet = JSON.parse(raw); } catch (error) { return; }
		if (!packet || typeof packet !== "object" || !packet.message) return;
		wsCaptureActive = true;
		handleSocketMessage(packet.message, identifierFromPacket(packet));
	}

	function handleWindowMessage(event) {
		if (!event || event.source !== window || !event.data) return;
		if (event.data.source !== "joystick-ws-interceptor" || event.data.type !== "receive") return;
		handleWsFrame(event.data.data);
	}

	function findNameNode(row) {
		var oldName = row.querySelector(".username");
		if (oldName) return oldName;
		var names = row.querySelectorAll("span.font-semibold, span[class*='font-semibold']");
		for (var i = 0; i < names.length; i += 1) {
			if (/\:\s*$/.test(names[i].textContent || "")) return names[i];
		}
		return null;
	}

	function findRenderedNameColor() {
		var wanted = {};
		for (var i = 0; i < arguments.length; i += 1) {
			var key = nameColorKey(arguments[i]);
			if (key) wanted[key] = true;
		}
		var rows = document.querySelectorAll(".chat-message");
		for (var j = rows.length - 1; j >= 0; j -= 1) {
			var nameNode = findNameNode(rows[j]);
			if (!nameNode || !wanted[nameColorKey(nameNode.textContent || "")]) continue;
			var color = nameNode.style && nameNode.style.color ? nameNode.style.color : "";
			if (color) {
				rememberNameColor(nameNode.textContent || "", color);
				return color;
			}
		}
		return "";
	}

	function domRoles(row) {
		var roles = { bot: false, newAccount: false, streamer: false, staff: false, moderator: false, subscriber: false, host: false, verified: false };
		Array.prototype.forEach.call(row.querySelectorAll("[title], [aria-label]"), function (node) {
			var label = String(node.getAttribute("title") || node.getAttribute("aria-label") || "").toLowerCase();
			if (/chat bot|\bbot\b/.test(label)) roles.bot = true;
			if (/streamer|content creator|host/.test(label)) roles.streamer = true;
			if (/moderator|\bmod\b/.test(label)) roles.moderator = true;
			if (/staff/.test(label)) roles.staff = true;
			if (/subscriber|\bsub\b/.test(label)) roles.subscriber = true;
			if (/verified/.test(label)) roles.verified = true;
			if (/new account/.test(label)) roles.newAccount = true;
		});
		return roles;
	}

	function processDomRow(row) {
		if (!row || row.nodeType !== 1) return;
		var nameNode = findNameNode(row);
		if (nameNode && nameNode.style && nameNode.style.color) rememberNameColor(nameNode.textContent || "", nameNode.style.color);
		if (wsCaptureActive || !isExtensionOn) return;
		var messageNode = row.querySelector("span.content") || row.querySelector(".content > span:nth-of-type(2):not([class])");
		if (!nameNode || !messageNode) return;
		var chatname = String(nameNode.textContent || "").replace(/:\s*$/, "").trim();
		var chatmessage = getAllContentNodes(messageNode);
		if (!chatname || !chatmessage) return;

		var roles = domRoles(row);
		var data = sourceBase();
		data.chatname = escapeHtml(chatname);
		data.chatmessage = chatmessage;
		data.chatbadges = badgesFromRoles(roles);
		data.nameColor = nameNode.style && nameNode.style.color ? nameNode.style.color : "";
		data.membership = roles.subscriber ? "Subscriber" : "";
		if (row.querySelector(".i-custom\\:lock-01") || /this message is private/i.test(row.textContent || "")) data.private = true;
		if (roles.moderator) data.mod = true;
		if (roles.bot || /^notice$/i.test(chatname) || /^joystick\.tv bot$/i.test(chatname)) {
			data.bot = true;
			applyBotSemantics(data, stripHtml(messageNode.innerHTML || messageNode.textContent || ""), chatname);
		}
		pushMessage(data);
	}

	function markExistingRows(list) {
		Array.prototype.forEach.call(list.querySelectorAll(".chat-message"), function (row) {
			row.dataset.ssnJoystickSeen = "true";
			var nameNode = findNameNode(row);
			if (nameNode && nameNode.style && nameNode.style.color) rememberNameColor(nameNode.textContent || "", nameNode.style.color);
		});
	}

	function rowsFromNode(node) {
		var rows = [];
		if (!node || node.nodeType !== 1) return rows;
		if (node.classList && node.classList.contains("chat-message")) rows.push(node);
		Array.prototype.forEach.call(node.querySelectorAll ? node.querySelectorAll(".chat-message") : [], function (row) {
			rows.push(row);
		});
		return rows;
	}

	function findChatInput() {
		return document.querySelector('input[placeholder="Write in chat"], input[flow-id="chat-message-text-input"], textarea[placeholder*="chat" i]');
	}

	function findChatList() {
		var oldList = document.querySelector("#chat-messages");
		if (oldList) return oldList;
		var row = document.querySelector(".chat-message");
		if (row && row.parentElement) return row.parentElement;
		var input = findChatInput();
		if (input) {
			var panel = input.parentElement;
			while (panel && panel !== document.body) {
				var candidate = panel.querySelector("div.overflow-y-auto, div[class*='overflow-y-auto']");
				if (candidate && candidate !== panel) return candidate;
				panel = panel.parentElement;
			}
		}
		return null;
	}

	function attachObserver() {
		var target = findChatList();
		if (!target || target === observedList) return;
		if (observer) observer.disconnect();
		observedList = target;
		markExistingRows(target);
		observer = new MutationObserver(function (mutations) {
			mutations.forEach(function (mutation) {
				Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
					rowsFromNode(node).forEach(function (row) {
						if (row.dataset.ssnJoystickSeen === "true") return;
						row.dataset.ssnJoystickSeen = "true";
						setTimeout(function () { processDomRow(row); }, 50);
					});
				});
			});
		});
		observer.observe(target, { childList: true, subtree: true });
		console.log("Social Stream ready: Joystick");
	}

	window.addEventListener("message", handleWindowMessage);

	try {
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			try {
				if (request === "getSource") {
					sendResponse("joystick");
					return;
				}
				if (request === "focusChat") {
					var input = findChatInput();
					if (input) input.focus();
					sendResponse(!!input);
					return;
				}
				if (request && typeof request === "object") {
					if ("settings" in request) settings = request.settings || {};
					if ("state" in request) isExtensionOn = !!request.state;
					sendResponse(true);
					return;
				}
			} catch (error) {}
			sendResponse(false);
		});
	} catch (error) {}

	try {
		chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
			if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) return;
			response = response || {};
			if (response.settings) settings = response.settings;
			if ("state" in response) isExtensionOn = !!response.state;
		});
	} catch (error) {}

	console.log("Social Stream injected: Joystick 2.0");
	attachObserver();
	setInterval(function () {
		if (window.location.href !== currentUrl) {
			currentUrl = window.location.href;
			channelSlug = getChannelSlug();
			wsCaptureActive = false;
			lastViewerCount = null;
			lastFollowerCount = null;
			lastSubscriberCount = null;
			recentFingerprints = {};
			seenMessageIds = {};
			messageCache = {};
			renderedNameColors = {};
			if (observer) observer.disconnect();
			observer = null;
			observedList = null;
		}
		attachObserver();
	}, 1000);

	try {
		var localConnection = new RTCPeerConnection();
		var remoteConnection = new RTCPeerConnection();
		remoteConnection.ondatachannel = function (event) {
			remoteConnection.datachannel = event.channel;
			setInterval(function () {
				if (document.hidden && remoteConnection.datachannel && remoteConnection.datachannel.readyState === "open") {
					remoteConnection.datachannel.send("KEEPALIVE");
				}
			}, 800);
		};
		localConnection.onicecandidate = function (event) {
			if (!event.candidate) return;
			remoteConnection.addIceCandidate(event.candidate).catch(function () {});
		};
		remoteConnection.onicecandidate = function (event) {
			if (!event.candidate) return;
			localConnection.addIceCandidate(event.candidate).catch(function () {});
		};
		localConnection.sendChannel = localConnection.createDataChannel("sendChannel");
		localConnection.createOffer()
			.then(function (offer) { return localConnection.setLocalDescription(offer); })
			.then(function () { return remoteConnection.setRemoteDescription(localConnection.localDescription); })
			.then(function () { return remoteConnection.createAnswer(); })
			.then(function (answer) { return remoteConnection.setLocalDescription(answer); })
			.then(function () { return localConnection.setRemoteDescription(remoteConnection.localDescription); })
			.catch(function () {});
	} catch (error) {}
})();
