(function () {
	'use strict';
	var params = new URLSearchParams(location.search),
		mode = params.get('mode') === 'ebay' ? 'ebay' : params.get('mode') === 'ninja' ? 'ninja' : params.get('mode') === 'throne' ? 'throne' : 'wishlist',
		demo = params.has('demo'),
		card = document.getElementById('support-card'),
		status = document.getElementById('overlay-status'),
		state = null,
		pending = [],
		seen = new Set(),
		active = null,
		until = 0,
		qrURL = '',
		lastStateAt = 0;
	if (mode !== 'wishlist') {
		document.body.classList.add(mode);
		state = {};
		state[mode] = { enabled: true, qr: false, position: 'br', username: '', url: '', rank: 1, gifts: 0 };
	}
	function by(id) {
		return document.getElementById(id);
	}
	function safeURL(value) {
		try {
			var u = new URL(value);
			return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
		} catch (_) {
			return '';
		}
	}
	function display() {
		var c = state && state[mode];
		if (!c || !c.enabled) {
			card.hidden = true;
			active = null;
			pending = [];
			return;
		}
		document.body.classList.toggle('tl', c.position === 'tl');
		if (mode !== 'wishlist' && mode !== 'ebay' && !c.qr && !active) {
			card.hidden = true;
			return;
		}
		card.hidden = false;
		var ebayItem = mode === 'ebay' ? SSNMonetization.ebayCurrent(c.items, c, Date.now()) : null;
		var url = mode === 'ebay' ? ebayItem && ebayItem.url : mode === 'wishlist' ? (c.item && c.item.url) || c.url : c.url,
			image = '';
		if (active) {
			by('badge').textContent = mode === 'ebay' ? 'Purchased on eBay' : mode === 'wishlist' ? 'Rank unlocked' : mode === 'throne' ? 'Gift rank ' + (c.rank || 1) : 'Thank you for the support';
			by('title').textContent = active.title;
			by('detail').textContent = active.detail;
			image = active.image || '';
			if (mode === 'ebay') url = '';
			by('footer').textContent = mode === 'ebay' ? 'Thanks for supporting the stream.' : mode === 'wishlist' ? 'The next wishlist item unlocks shortly.' : 'Your support makes the next stream possible.';
		} else if (mode === 'wishlist') {
			by('badge').textContent = 'Wishlist · Rank ' + c.rank;
			by('title').textContent = c.item ? c.item.name : c.total ? 'Wishlist complete!' : 'Your next rank awaits';
			by('detail').textContent = c.item ? SSNMonetization.money(c.item.amount, c.item.currency) : c.total + ' items unlocked';
			by('footer').textContent = c.item ? 'Buy through the wishlist. Host-confirmed gifts unlock the next rank.' : 'Thanks for helping the stream grow.';
			image = c.item && safeURL(c.item.image);
		} else if (mode === 'ebay') {
			by('badge').textContent = 'eBay ' + (ebayItem && ebayItem.auction ? '\u00b7 Auction' : '\u00b7 Product showcase');
			by('title').textContent = ebayItem ? ebayItem.name : 'No remaining products';
			by('detail').textContent = ebayItem ? (ebayItem.auction ? (ebayItem.startingBid ? 'Starting bid ' : 'Current bid ') : '') + SSNMonetization.money(ebayItem.amount, ebayItem.currency) : 'Thanks for supporting the stream.';
			var seconds = ebayItem ? Math.max(0, Math.ceil((ebayItem.endsAt - Date.now()) / 1000)) : 0;
			var countdown = Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm ' + (seconds % 60) + 's left';
			by('footer').textContent = ebayItem ? (ebayItem.auction && ebayItem.endsAt ? countdown : 'Scan to view this product on eBay.') + (Date.now() - ebayItem.updatedAt > 120000 ? ' Price update delayed.' : '') : 'Ended auctions are not counted as purchases.';
			image = ebayItem && safeURL(ebayItem.image);
		} else if (mode === 'throne') {
			by('badge').textContent = 'Throne \u00b7 Gift rank ' + (c.rank || 1);
			by('title').textContent = 'Gifts for ' + (c.username || 'the stream');
			by('detail').textContent = (c.gifts || 0) + ' gifts unlocked together';
			by('footer').textContent = 'Choose a gift. Help the stream grow.';
		} else {
			by('badge').textContent = 'Back the next stream';
			by('title').textContent = 'Support ' + (c.username || 'the stream');
			by('detail').textContent = 'Optional tips. Always appreciated.';
			by('footer').textContent = 'NinjaBacker · 0% platform commission. Processing fees apply.';
		}
		var img = by('item-image');
		img.hidden = !image || img.dataset.failedSrc === image;
		if (image && img.getAttribute('src') !== image) {
			img.referrerPolicy = 'no-referrer';
			img.src = image;
			img.onerror = function () {
				img.dataset.failedSrc = image;
				img.hidden = true;
			};
		}
		url = safeURL(url);
		by('support-link').href = url || '#';
		by('support-link').textContent = url ? url.replace(/^https:\/\/(www\.)?/, '') : '';
		by('qr').hidden = !c.qr || !url;
		if (c.qr && url && qrURL !== url) {
			by('qr').textContent = '';
			try {
				new QRCode(by('qr'), { text: url, width: 512, height: 512, correctLevel: QRCode.CorrectLevel.M });
				qrURL = url;
			} catch (_) {
				by('qr').hidden = true;
			}
		}
	}
	function enqueue(id, title, detail, image) {
		if (seen.has(id)) return;
		seen.add(id);
		if (seen.size > 200) seen.delete(seen.values().next().value);
		if (pending.length < 20) pending.push({ title: title, detail: detail, image: safeURL(image) });
	}
	function receive(payload) {
		(Array.isArray(payload) ? payload.slice(0, 100) : [payload]).forEach(function (data) {
			if (data && data.content) data = data.content;
			if (!data || typeof data !== 'object') return;
			if (data.event === 'monetization_update' && data.meta && data.meta.monetization) {
				state = data.meta.monetization;
				lastStateAt = Date.now();
				status.hidden = true;
				var purchase = data.meta.wishlistPurchase;
				if (mode === 'wishlist' && purchase && Date.now() - Number(purchase.at) < 15000) enqueue(purchase.id, 'Purchased: ' + String(purchase.name).slice(0, 180), purchase.supporter ? 'Thank you, ' + String(purchase.supporter).slice(0, 60) + '!' : 'Thank you to our wishlist supporter!');
				display();
			}
			if (mode === 'ebay' && data.type === 'ebay' && data.event === 'purchase' && data.meta && data.meta.ebayPurchase && state && state.ebay && state.ebay.enabled) enqueue(String(data.id), 'Purchased: ' + String(data.meta.ebayPurchase.itemName || '').slice(0, 180), String(data.meta.ebayPurchase.quantity || 1) + ' purchased. Thank you!', data.contentimg);
			if (mode === 'throne' && data.type === 'throne' && ['giftpurchase', 'giftcontribution', 'giftfunded'].indexOf(data.event) !== -1 && state && state.throne && state.throne.enabled) {
				var action = data.event === 'giftfunded' ? 'Community funded a gift' : String(data.chatname || 'Anonymous').slice(0, 60) + (data.event === 'giftcontribution' ? ' chipped in' : ' sent a gift');
				enqueue(String(data.id), action, String(data.subtitle || 'A wishlist gift').slice(0, 180) + (data.hasDonation ? ' \u00b7 ' + String(data.hasDonation).slice(0, 40) : ''), data.contentimg);
			}
			if (mode === 'ninja' && data.event === 'monetization_test' && data.meta && data.meta.ninjabackerTest && state && state.ninja.enabled) enqueue(data.meta.ninjabackerTest.id, 'Test tip received', 'Your NinjaBacker alert connection works.');
			if (mode === 'ninja' && data.type === 'ninjabacker' && data.hasDonation && state && state.ninja && state.ninja.enabled) enqueue(String(data.id), String(data.chatname || 'Anonymous').slice(0, 60) + ' tipped ' + String(data.hasDonation).slice(0, 60), String(data.chatmessage || 'Thank you for supporting the stream!').slice(0, 500));
		});
	}
	setInterval(function () {
		var now = Date.now();
		if (mode === 'ebay' && (!lastStateAt || now - lastStateAt <= 35000 || demo)) display();
		if (active && now >= until) {
			active = null;
			display();
		}
		if (!active && pending.length) {
			active = pending.shift();
			until = now + 8000;
			display();
		}
		if (!demo && lastStateAt && now - lastStateAt > 35000) {
			card.hidden = true;
			status.hidden = false;
			status.textContent = 'Waiting for SSN';
		}
	}, 250);
	if (demo) {
		document.body.classList.add('demo');
		status.textContent = 'Preview · sample items and tips';
		state = { ebay: { enabled: true, qr: true, position: params.get('position') || 'br', display: 'cycle', seconds: 20, items: [{ id: '123456789012', name: 'Retro handheld game console', amount: 32.5, currency: 'USD', url: 'https://www.ebay.com/itm/123456789012', auction: true, endsAt: Date.now() + 3723000, updatedAt: Date.now() }] }, throne: { enabled: true, qr: true, position: params.get('position') || 'br', username: 'the stream', url: 'https://throne.com', rank: 4, gifts: 3 }, wishlist: { enabled: true, qr: true, position: params.get('position') || 'br', rank: 3, total: 6, url: 'https://www.amazon.com/hz/wishlist/intro', item: { name: 'A little light for the next big idea', amount: 24.99, currency: 'USD', url: 'https://www.amazon.com/hz/wishlist/intro' } }, ninja: { enabled: true, qr: true, position: params.get('position') || 'br', username: 'the stream', url: 'https://ninjabacker.com' } };
		display();
		if (mode === 'throne')
			setTimeout(function () {
				enqueue('demo-gift', 'Juniper sent a gift', 'A studio light for the next big idea');
			}, 1200);
		if (mode === 'ninja')
			setTimeout(function () {
				enqueue('demo', 'Juniper tipped $5.00', 'For more wonderful streams. Thank you!');
			}, 1200);
		return;
	}
	var session = params.get('session');
	if (!session) {
		status.textContent = 'Open this overlay from SSN → Monetization';
		return;
	}
	if (params.has('server')) {
		var endpoint = params.get('server') || 'wss://io.socialstream.ninja',
			socket,
			closing = false,
			retry;
		try {
			var parsed = new URL(endpoint);
			if (!/^wss?:$/.test(parsed.protocol)) throw new Error();
		} catch (_) {
			status.textContent = 'Invalid relay address';
			return;
		}
		function connect() {
			if (closing) return;
			socket = new WebSocket(endpoint);
			socket.onopen = function () {
				socket.send(JSON.stringify({ join: session.split(',')[0], out: 2, in: 1 }));
			};
			socket.onmessage = function (e) {
				if (typeof e.data === 'string' && e.data.length < 256000)
					try {
						receive(JSON.parse(e.data));
					} catch (_) {}
			};
			socket.onclose = function () {
				if (!closing) retry = setTimeout(connect, 5000);
			};
			socket.onerror = function () {
				socket.close();
			};
		}
		window.addEventListener('beforeunload', function () {
			closing = true;
			clearTimeout(retry);
			if (socket) socket.close();
		});
		connect();
		return;
	}
	var bridge = document.createElement('iframe');
	bridge.title = 'SSN overlay connection';
	bridge.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-100px;top:-100px';
	bridge.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=' + encodeURIComponent(params.get('password') || 'false') + '&solo&view=' + encodeURIComponent(session) + '&novideo&noaudio&label=dock&cleanoutput&room=' + encodeURIComponent(session);
	window.addEventListener('message', function (event) {
		if (event.source !== bridge.contentWindow) return;
		var data = event.data && event.data.dataReceived;
		if (data && data.overlayNinja) receive(data.overlayNinja);
	});
	document.body.appendChild(bridge);
})();
