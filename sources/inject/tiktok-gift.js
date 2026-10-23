(function() {
	if (window.__ssnReadTikTokGift) return;
	// Main-world access to rendered chat metadata and TikTok's decoded moderation events.
	var chatAuthors = new Map();
	var client = null;
	var roomId = "";
	function rememberChat(payload, envelope) {
		var common = payload && payload.common || {};
		var id = String(common.msg_id || envelope && envelope.msg_id || "");
		if (!id || String(common.room_id || "") !== roomId) return;
		chatAuthors.set(id, String(payload.user && (payload.user.id_str || payload.user.id) || ""));
		if (chatAuthors.size > 5000) chatAuthors.delete(chatAuthors.keys().next().value);
	}
	function receiveDelete(payload) {
		if (!payload || String(payload.common && payload.common.room_id || "") !== roomId) return;
		var ids = new Set((Array.isArray(payload.delete_msg_ids) ? payload.delete_msg_ids : []).map(String));
		var users = new Set((Array.isArray(payload.delete_user_ids) ? payload.delete_user_ids : []).map(String));
		chatAuthors.forEach(function(userId, id) { if (users.has(userId)) ids.add(id); });
		ids.forEach(function(id) { chatAuthors.delete(id); });
		if (ids.size) document.dispatchEvent(new CustomEvent('ssn-tiktok-delete', { detail: JSON.stringify(Array.from(ids)) }));
	}
	function connectModeration(element) {
		var key = element && Object.keys(element).filter(function(k) { return k.indexOf('__reactFiber') === 0; })[0];
		var fiber = key && element[key];
		for (var depth = 0; fiber && depth < 64; depth++, fiber = fiber.return) {
			var value = fiber.memoizedProps && fiber.memoizedProps.value;
			var next = value && value.imInstance;
			if (!next || typeof next.on !== 'function' || typeof next.off !== 'function') continue;
			var nextRoom = String(next._messageEvents && next._messageEvents.roomId || "");
			if (!nextRoom) return;
			if (client === next && roomId === nextRoom) return;
			if (client) { client.off('ChatMessage', rememberChat); client.off('ImDeleteMessage', receiveDelete); }
			if (roomId !== nextRoom) chatAuthors.clear();
			client = next;
			roomId = nextRoom;
			client.on('ChatMessage', rememberChat);
			client.on('ImDeleteMessage', receiveDelete);
			return;
		}
	}
	function readChatMessage(element) {
		var key = element && Object.keys(element).filter(function(k) { return k.indexOf('__reactFiber') === 0; })[0];
		var fiber = key && element[key];
		for (var depth = 0; fiber && depth < 8; depth++, fiber = fiber.return) {
			var message = fiber.memoizedProps && fiber.memoizedProps.message;
			if (!message || message.messageType !== 'ChatMessage' || !message.msgId) continue;
			return message;
		}
		return null;
	}
	function readChatId(element) {
		var message = readChatMessage(element);
		if (!message) return "";
		if (message.payload) rememberChat(message.payload, { msg_id: message.msgId });
		return String(message.msgId);
	}
	function readTeamLevel(element) {
		var message = readChatMessage(element);
		var user = message && message.payload && message.payload.user;
		var badges = user && user.badge_list;
		if (!Array.isArray(badges)) return null;
		for (var i = 0; i < badges.length; i++) {
			var badge = badges[i];
			if (!badge || Number(badge.scene_type) !== 10) continue;
			// Scene 8 is the gifter rank; scene 10 contains the exact Fan Club level.
			var level = badge.privilege_log_extra && badge.privilege_log_extra.level;
			if (typeof level === 'string' && /^\d+$/.test(level.trim())) level = Number(level.trim());
			if (typeof level === 'number' && Number.isSafeInteger(level) && level >= 0) return level;
		}
		return null;
	}
	window.__ssnReadTikTokChatId = readChatId;
	window.__ssnReadTikTokTeamLevel = readTeamLevel;
	document.addEventListener('ssn-tiktok-connect', function(event) { try { connectModeration(event.target); } catch (e) {} });
	document.addEventListener('ssn-read-tiktok-chat-id', function(event) {
		try { event.target.setAttribute('data-ssn-tiktok-chat-id', readChatId(event.target)); } catch (e) {}
	});
	document.addEventListener('ssn-read-tiktok-team-level', function(event) {
		try {
			var level = readTeamLevel(event.target);
			if (level !== null) event.target.setAttribute('data-ssn-tiktok-team-level', String(level));
		} catch (e) {}
	});
	window.addEventListener('beforeunload', function() {
		if (client) { client.off('ChatMessage', rememberChat); client.off('ImDeleteMessage', receiveDelete); }
	});
	// Read only the gift attached to this rendered row; never traverse application state.
	function readGift(element) {
		var row = element && element.closest && element.closest('[data-index]');
		var nodes = row ? [row, row.firstElementChild] : [element];
		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i];
			if (!node) continue;
			var key = Object.keys(node).filter(function(k) { return k.indexOf('__reactFiber') === 0; })[0];
			var fiber = key && node[key];
			for (var depth = 0; fiber && depth < 8; depth++, fiber = fiber.return) {
				var props = fiber.memoizedProps;
				var message = props && props.message;
				if (!message || message.messageType !== 'GiftMessage' || !message.payload) continue;
				var p = message.payload;
				var common = p.common || {};
				return {
					tiktokGiftMessageId: String(message.msgId || common.msg_id || ''),
					groupId: String(p.group_id || ''),
					giftId: String(p.gift_id || ''),
					giftName: String(p.gift && p.gift.name || ''),
					coinsPerGift: Number(p.gift && (p.gift.coins || p.gift.coin_count)) || undefined,
					diamondsPerGift: Number(p.gift && (p.gift.diamond_count || p.gift.diamondCount)) || undefined,
					tiktokGiftSenderId: String(p.user && (p.user.id || p.user.id_str) || ''),
					tiktokGiftCount: Number(p.repeat_count) || 1,
					streakable: !!(p.gift && p.gift.type === 1),
					repeatEnd: p.repeat_end === 1 || p.repeat_end === true
				};
			}
		}
		return null;
	}
	window.__ssnReadTikTokGift = readGift;
	// Synchronous DOM bridge for Chrome's isolated content-script world.
	document.addEventListener('ssn-read-tiktok-gift', function(event) {
		try {
			var value = readGift(event.target);
			if (value) event.target.setAttribute('data-ssn-tiktok-gift', JSON.stringify(value));
		} catch (e) {}
	});
})();
