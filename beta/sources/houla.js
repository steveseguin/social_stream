(function () {
	'use strict';

	if (location.hostname !== 'hou.la' || window.__SSN_HOULA_DOM__) return;
	window.__SSN_HOULA_DOM__ = true;
	var settings = {};
	var enabled = false;
	var settingsReady = false;
	var seen = new WeakSet();
	var lists = new WeakSet();
	var pending = new Set();
	var timer = null;
	var page = location.href;
	var rowSelector = '.lchat__msgs > .lchat__msg, .live-comments .comment-item';

	function textOnlyMode() {
		var value = settings.textonlymode;
		return value === true || !!(value && typeof value === 'object' && value.setting === true);
	}
	function escapeHtml(value) {
		return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
	}
	function getAllContentNodes(element) {
		var output = '';
		element.childNodes.forEach(function (node) {
			if (node.nodeType === 3) output += textOnlyMode() ? node.textContent : escapeHtml(node.textContent);
			else if (node.nodeType === 1) {
				if (node.tagName === 'BR') output += textOnlyMode() ? '\n' : '<br>';
				else if (node.tagName === 'IMG') {
					var alt = node.getAttribute('alt') || '';
					var url = safeImage(node);
					output += textOnlyMode() || !url ? (textOnlyMode() ? alt : escapeHtml(alt)) :
						'<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '">';
				} else if (!/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED)$/.test(node.tagName)) output += getAllContentNodes(node);
			}
		});
		return output;
	}

	function supportedPage() {
		return /^\/a\/live\/?$/.test(location.pathname) ||
			/^\/live\/[a-f0-9-]+\/?$/i.test(location.pathname) ||
			/^\/studio\/live\/comments\/?$/.test(location.pathname);
	}

	function safeImage(element) {
		if (!element) return '';
		try {
			var url = new URL(element.currentSrc || element.src, location.href);
			return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
		} catch (_) { return ''; }
	}

	function capture(row) {
		if (!row.isConnected || seen.has(row)) return;
		if (row.matches('.is-system, .is-welcome, .comment-item--deleted') ||
			row.querySelector('.lchat__supprime, .comment-badge--deleted')) {
			seen.add(row);
			return;
		}
		if (row.classList.contains('is-pending')) return;
		var name = row.querySelector('.lchat__name, .comment-name');
		var body = row.querySelector('.lchat__body, .comment-text');
		if (!name || !body) return;
		var text = body.cloneNode(true);
		text.querySelectorAll('.lchat__name, .lchat__paid, .lchat__bot, .lchat__cmdtag, .lchat__coins, .comment-cmdtag, .comment-coins').forEach(function (el) { el.remove(); });
		var message = getAllContentNodes(text).trim();
		if (!message) return;
		seen.add(row);
		if (!enabled) return;
		var data = {
			chatname: name.textContent.trim(),
			chatmessage: message,
			chatimg: safeImage(row.querySelector('.lchat__av img, .comment-avatar__img')),
			chatbadges: '',
			backgroundColor: '',
			textColor: '',
			contentimg: '',
			hasDonation: '',
			membership: '',
			textonly: textOnlyMode(),
			type: 'houla'
		};
		if (row.querySelector('.lchat__bot, .comment-badge--bot')) data.bot = true;
		if (row.querySelector('.comment-badge--mod')) data.mod = true;
		try {
			chrome.runtime.sendMessage(chrome.runtime.id, { message: data }, function () {});
		} catch (_) {}
	}

	function markExisting() {
		document.querySelectorAll(rowSelector).forEach(function (row) { seen.add(row); });
	}

	function findLists() {
		document.querySelectorAll('.lchat__msgs, .live-comments').forEach(function (list) {
			if (lists.has(list)) return;
			lists.add(list);
			list.querySelectorAll(rowSelector).forEach(function (row) { seen.add(row); });
		});
	}

	function flush() {
		timer = null;
		if (!settingsReady) return;
		if (page !== location.href) {
			page = location.href;
			markExisting();
			pending.clear();
			return;
		}
		if (supportedPage()) pending.forEach(capture);
		pending.clear();
	}

	function queue(node) {
		var element = node.nodeType === 1 ? node : node.parentElement;
		if (!element) return;
		var row = element.closest(rowSelector);
		if (row) pending.add(row);
		element.querySelectorAll(rowSelector).forEach(function (item) { pending.add(item); });
		if (pending.size && timer === null) timer = setTimeout(flush, 50);
	}

	function applySettings(response) {
		if (!response || typeof response !== 'object') return;
		if ('settings' in response) { settings = response.settings || {}; settingsReady = true; }
		if ('state' in response) enabled = response.state === true;
		if (settingsReady && pending.size && timer === null) timer = setTimeout(flush, 50);
	}

	try {
		chrome.runtime.onMessage.addListener(function (request, sender, respond) {
			if (request === 'getSource') { respond('houla'); return; }
			if (request === 'focusChat') {
				var input = document.querySelector('.lchat__compose input');
				if (input) input.focus();
				respond(!!input);
				return;
			}
			if (request && typeof request === 'object' && ('settings' in request || 'state' in request)) {
				applySettings(request);
				respond(true);
				return;
			}
			respond(false);
		});
		chrome.runtime.sendMessage(chrome.runtime.id, { getSettings: true }, function (response) {
			applySettings(response);
		});
	} catch (_) {}

	// Existing rows are history. Track row identity so identical new messages stay distinct.
	markExisting();
	findLists();
	var observer = new MutationObserver(function (mutations) {
		if (!supportedPage()) return;
		findLists();
		mutations.forEach(function (mutation) {
			queue(mutation.target);
			mutation.addedNodes.forEach(queue);
		});
	});
	observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'src'] });
	window.addEventListener('pagehide', function () {
		observer.disconnect();
		clearTimeout(timer);
		pending.clear();
	});
})();
