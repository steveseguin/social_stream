(function() {
	if (window.__ssnReadTikTokGift) return;
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
