(function () {
	'use strict';

	if (window.__SSN_HOULA_SOURCE_INITIALIZED__) return;
	if (document.documentElement.hasAttribute('data-houla-source')) return;
	var extension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id &&
		typeof chrome.runtime.sendMessage === 'function';
	if (!extension) {
		var status = document.getElementById('status');
		if (status) status.textContent = 'Open this source in SSApp or enable the Social Stream Ninja extension.';
		return;
	}
	window.__SSN_HOULA_SOURCE_INITIALIZED__ = true;
	document.documentElement.setAttribute('data-houla-source', 'true');

	var API_BASE = 'https://api.hou.la';
	var STORAGE_KEY = 'houlaSourceConfig';
	var USD_PER_COIN = 0.015; // Estimated USD value per Hou.la coin.
	var settings = {};
	var enabled = false;
	var settingsReady = false;
	var configReady = false;
	var savedConfig = {};
	var pendingKey = false;
	var autoConnectHandled = false;
	var socket = null;
	var seen = new Set();
	var latestViewers = null;
	var lastViewers = null;
	var viewerTimer = null;
	var connected = false;
	var settingsTimer = null;
	var settingsAttempts = 0;

	function $(id) { return document.getElementById(id); }
	function flag(name) {
		var value = settings[name];
		return value === true || !!(value && typeof value === 'object' && value.setting === true);
	}
	function escapeHtml(value) {
		return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
			.replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
	}
	function messageText(text) {
		text = String(text == null ? '' : text);
		return flag('textonlymode') ? text : escapeHtml(text).replace(/\r?\n/g, '<br>');
	}
	function safeUrl(value) {
		try {
			var url = new URL(String(value || ''));
			return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password ? url.href : '';
		} catch (_) { return ''; }
	}
	function count(value) {
		var number = Number(value);
		return isFinite(number) && number > 0 && number <= 1e9 ? Math.floor(number) : 0;
	}

	// Use the standard source bridge, including SSApp's injected chrome.runtime shim.
	function send(request, callback) {
		chrome.runtime.sendMessage(chrome.runtime.id, request, callback || function () {});
	}
	function pushMessage(data) {
		if (!settingsReady || !enabled) return false;
		try {
			send({ message: data });
			return true;
		} catch (_) { return false; }
	}
	function setStatus(text, kind) {
		if ($('status')) {
			$('status').textContent = text;
			$('status').className = 'status ' + (kind || '');
		}
	}
	function sourceStatus(status, message) {
		setStatus(message, status === 'error' ? 'error' : status === 'connected' ? 'ok' : '');
		try { send({ wssStatus: { platform: 'houla', status: status, message: message } }); } catch (_) {}
	}
	function buttons() {
		if ($('connect')) $('connect').disabled = !!socket || !settingsReady || !configReady;
		if ($('disconnect')) $('disconnect').disabled = !socket;
	}
	function remember(type, payload) {
		var id = type === 'comment' ? payload.comment && payload.comment.id :
			type === 'gift' ? payload.transactionId : null;
		if (typeof id !== 'string' && typeof id !== 'number') return true;
		if (!String(id)) return true;
		var live = payload.live || {};
		var key = JSON.stringify([live.workspaceId || '', live.roomId || '', type, String(id)]);
		if (seen.has(key)) return false;
		seen.add(key);
		if (seen.size > 5000) seen.delete(seen.values().next().value);
		return true;
	}
	function baseMessage(who) {
		who = who || {};
		var data = {
			chatname: String(who.name || 'Anonymous'),
			chatmessage: '',
			chatimg: safeUrl(who.avatarUrl),
			userid: String(who.workspaceId || ''),
			chatbadges: '',
			backgroundColor: '',
			textColor: '',
			contentimg: '',
			hasDonation: '',
			membership: '',
			textonly: flag('textonlymode'),
			type: 'houla'
		};
		if (who.isModerator === true) data.mod = true;
		return data;
	}
	function setCoins(data, value) {
		var coins = count(value);
		if (!coins) return;
		data.hasDonation = coins + ' coins';
		data.donoValue = coins * USD_PER_COIN;
	}
	function captureEvent(envelope) {
		if (!envelope || !envelope.data || typeof envelope.data !== 'object') return;
		var payload = envelope.data;
		var type = envelope.type;
		var data;
		if (type === 'comment') {
			var comment = payload.comment || {};
			if (typeof comment.content !== 'string' || !comment.content) return;
			if (!remember(type, payload) || !enabled) return;
			data = baseMessage(payload.author);
			data.chatmessage = messageText(comment.content);
			if (comment.isBot === true) data.bot = true;
			setCoins(data, comment.coins);
		} else if (type === 'gift') {
			var gift = payload.gift;
			if (!gift || typeof gift !== 'object') return;
			if (!remember(type, payload) || !enabled) return;
			data = baseMessage(payload.sender);
			var quantity = count(gift.quantity) || 1;
			data.chatmessage = messageText(String(gift.name || 'Gift') + (quantity > 1 ? ' x' + quantity : ''));
			data.event = 'gift';
			setCoins(data, gift.totalCoins);
			data.contentimg = safeUrl(gift.thumbnailUrl);
			data.meta = { giftId: gift.id || '', giftSlug: gift.slug || '', quantity: quantity, coins: count(gift.totalCoins) };
		} else if (type === 'follow') {
			if (!enabled) return;
			data = baseMessage(payload.follower);
			data.chatmessage = messageText('Started following');
			data.event = 'new_follower';
		} else return;
		pushMessage(data);
	}
	function viewerCountEnabled() {
		return settingsReady && enabled && (flag('showviewercount') || flag('hypemode'));
	}
	function syncViewerHeartbeat() {
		if (!connected || !viewerCountEnabled() || latestViewers === null) {
			clearInterval(viewerTimer);
			viewerTimer = null;
			return;
		}
		if (viewerTimer === null) viewerTimer = setInterval(function () {
			viewerUpdate(latestViewers, true);
		}, 30000);
	}
	function viewerUpdate(value, force) {
		if (typeof value !== 'number' || !isFinite(value) || value < 0) return;
		latestViewers = Math.floor(value);
		syncViewerHeartbeat();
		if (!connected || !viewerCountEnabled() || (!force && latestViewers === lastViewers)) return;
		if (pushMessage({ type: 'houla', event: 'viewer_update', meta: latestViewers })) lastViewers = latestViewers;
	}
	function applySettings(response) {
		if (!response || typeof response !== 'object') return;
		if ('settings' in response) {
			settings = response.settings || {};
			settingsReady = true;
			clearTimeout(settingsTimer);
		}
		if ('state' in response) enabled = response.state === true;
		if (!viewerCountEnabled()) lastViewers = null;
		else if (latestViewers !== null) viewerUpdate(latestViewers);
		syncViewerHeartbeat();
		buttons();
		maybeAutoConnect();
	}
	function requestSettings() {
		if (settingsReady) return;
		settingsAttempts++;
		function retry() {
			if (settingsReady) return;
			if (settingsAttempts < 5) settingsTimer = setTimeout(requestSettings, 1000);
			else setStatus('Social Stream settings are unavailable. Reload this source.', 'error');
		}
		try {
			send({ getSettings: true }, function (response) {
				if (extension && chrome.runtime.lastError) { retry(); return; }
				applySettings(response);
				if (!settingsReady) retry();
			});
		} catch (_) { retry(); }
	}
	function wireSettings() {
		var listener = function (request, sender, respond) {
			respond = typeof respond === 'function' ? respond : function () {};
			if (request === 'getSource') { respond('houla'); return; }
			if (request === 'focusChat') { respond(false); return; }
			if (request && typeof request === 'object' && ('settings' in request || 'state' in request)) {
				applySettings(request);
				respond(true);
				return;
			}
			respond(false);
		};
		chrome.runtime.onMessage.addListener(listener);
		requestSettings();
	}

	function loadConfig() {
		var config = {};
		try { config = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (_) {}
		savedConfig = { key: typeof config.key === 'string' ? config.key : '', auto: config.auto !== false && !(config.options && config.options.auto === false) };
		var fragment = new URLSearchParams(location.hash.slice(1));
		var key = fragment.get('key');
		if (fragment.get('autoconnect') === '0') pendingKey = true;
		if (key) {
			key = key.trim();
			pendingKey = pendingKey || key !== savedConfig.key;
			fragment.delete('key');
			fragment.delete('autoconnect');
			try { history.replaceState(null, '', location.pathname + location.search + (fragment.toString() ? '#' + fragment : '')); } catch (_) {}
		}
		$('key').value = key || savedConfig.key;
		$('optAuto').checked = savedConfig.auto;
		configReady = true;
		if (pendingKey) setStatus('This link contains a different event key. Check it, then click Connect.');
		else setStatus('Not connected.');
		buttons();
		maybeAutoConnect();
	}
	function saveConfig() {
		try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig)); } catch (_) {}
	}
	function maybeAutoConnect() {
		if (!settingsReady || !configReady || autoConnectHandled || pendingKey || !savedConfig.key || !savedConfig.auto || socket) return;
		// Run once per page load, so settings changes cannot undo Disconnect.
		autoConnectHandled = true;
		connect();
	}
	function disconnect() {
		var previous = socket;
		socket = null;
		connected = false;
		if (previous) {
			previous.removeAllListeners();
			previous.disconnect();
		}
		latestViewers = null;
		lastViewers = null;
		syncViewerHeartbeat();
		buttons();
	}
	function connect() {
		if (!settingsReady || !configReady || socket) return;
		var key = $('key').value.trim();
		if (!/^hle_[A-Za-z0-9_-]+$/.test(key)) {
			setStatus('Enter a Hou.la event key starting with hle_. Do not use your stream key.', 'error');
			return;
		}
		if (typeof io !== 'function') { setStatus('Connection library unavailable. Reload this source.', 'error'); return; }
		savedConfig = { key: key, auto: $('optAuto').checked };
		saveConfig();
		pendingKey = false;
		autoConnectHandled = true;
		sourceStatus('connecting', 'Connecting...');
		var current;
		try {
			current = io(API_BASE + '/events', {
				path: '/ws', transports: ['websocket'], auth: { token: key },
				reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000
			});
		} catch (_) {
			sourceStatus('error', 'Unable to connect to Hou.la. Try connecting again.');
			return;
		}
		socket = current;
		buttons();
		current.on('ready', function (info) {
			if (socket !== current) return;
			connected = true;
			if (latestViewers !== null) viewerUpdate(latestViewers, true);
			var events = info && Array.isArray(info.events) ? info.events : [];
			sourceStatus('connected', events.indexOf('comment') === -1 ? 'Connected. Enable Comments on this event key to capture chat.' : 'Connected.');
		});
		current.on('event', function (envelope) {
			if (socket !== current) return;
			captureEvent(envelope);
			if (envelope) viewerUpdate(envelope.viewers);
		});
		current.on('disconnect', function (reason) {
			if (socket !== current) return;
			connected = false;
			lastViewers = null;
			syncViewerHeartbeat();
			if (reason === 'io server disconnect') {
				disconnect();
				sourceStatus('disconnected', 'Disconnected by Hou.la. Click Connect to retry.');
			} else sourceStatus('connecting', 'Disconnected. Reconnecting...');
		});
		current.on('connect_error', function () {
			if (socket === current) sourceStatus('error', 'Unable to connect to Hou.la. Check your connection and event key.');
		});
		current.on('error', function (reason) {
			if (socket !== current) return;
			disconnect();
			var message = reason === 'INVALID_KEY' ? 'Event key refused. Create a new key in Hou.la Studio.' :
				reason === 'RATE_LIMITED' ? 'Too many attempts. Wait a minute before reconnecting.' :
				reason === 'TOO_MANY_CONNECTIONS' ? 'This key has too many connections. Close another source using it.' : 'Hou.la disconnected this source. Check your event key.';
			sourceStatus('error', message);
		});
	}
	function boot() {
		$('connect').addEventListener('click', connect);
		$('disconnect').addEventListener('click', function () {
			autoConnectHandled = true;
			disconnect();
			sourceStatus('disconnected', 'Disconnected.');
		});
		$('forget').addEventListener('click', function () {
			autoConnectHandled = true;
			disconnect();
			savedConfig = {};
			$('key').value = '';
			try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
			sourceStatus('disconnected', 'Saved key removed.');
		});
		$('optAuto').addEventListener('change', function () {
			if (!savedConfig.key) return;
			savedConfig.auto = $('optAuto').checked;
			saveConfig();
		});
		buttons();
		wireSettings();
		loadConfig();
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();
	window.addEventListener('pagehide', function () { clearTimeout(settingsTimer); disconnect(); });
})();
