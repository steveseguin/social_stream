(function () {
	'use strict';
	var params = new URLSearchParams(location.search),
		mode = params.get('mode') === 'commerce' ? 'commerce' : params.get('mode') === 'ebay' ? 'ebay' : params.get('mode') === 'ninja' ? 'ninja' : params.get('mode') === 'throne' ? 'throne' : 'wishlist',
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
	var view = ['both', 'showcase', 'card', 'alerts'].indexOf(params.get('view')) !== -1 ? params.get('view') : 'both';
	var cardEvery = Math.max(0, Math.min(3600, Number(params.get('cardevery')) || 0));
	var cardFor = Math.max(15, Math.min(300, Number(params.get('cardfor')) || 30));
	var sources = (params.get('onlytype') || '').toLowerCase().split(',').map(function (part) { return part.trim(); }).filter(Boolean);
	document.body.classList.toggle('compact', params.get('style') === 'compact');
	document.body.classList.toggle('card-view', view === 'card');
	card.style.setProperty('--monetization-scale', Math.max(0.5, Math.min(2, Number(params.get('scale')) || 1)));
	function tr(key, fallback, values) { return window.SSNPageI18n ? SSNPageI18n.t(key, fallback, values) : fallback.replace(/\{([^}]+)\}/g, function (match, name) { return values && Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match; }); }
    function ot(key, fallback, values) { return tr('money-overlay-' + key, fallback, values); }
	window.addEventListener('ssn-page-language-changed', function () {
        if (demo) status.textContent = ot('preview', 'Preview - sample items and tips');
        else if (!params.get('session')) status.textContent = ot('open-setup', 'Open this overlay from SSN > Monetization');
        display();
    });
	function by(id) {
		return document.getElementById(id);
	}
	function safeURL(value) {
        if (typeof value !== 'string' || value.length > 2048) return '';
		try {
			var u = new URL(value);
			return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
		} catch (_) {
			return '';
		}
	}
    function text(id, value) {
        value = value == null ? '' : String(value);
        if (by(id).textContent !== value) by(id).textContent = value;
    }
    function fitCard() {
        if (card.hidden || !card.offsetWidth || !card.offsetHeight) return;
        var requested = Number(getComputedStyle(card).getPropertyValue('--monetization-scale')) || 1;
        var scale = Math.min(requested, Math.max(1, innerWidth - 44) / card.offsetWidth, Math.max(1, innerHeight - 44) / card.offsetHeight);
        var value = String(Math.max(0.05, scale));
        if (card.style.getPropertyValue('--monetization-fit-scale') !== value) card.style.setProperty('--monetization-fit-scale', value);
    }
    window.addEventListener('resize', fitCard);
    if (typeof ResizeObserver === 'function') new ResizeObserver(fitCard).observe(card);
    function snapshot(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        var c = raw[mode];
        if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
        var clean = { enabled: c.enabled === true, qr: c.qr === true, position: c.position === 'tl' ? 'tl' : 'br' };
        function label(value, max) { return typeof value === 'string' ? value.slice(0, max) : ''; }
        function number(value, max) { var n = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN; return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; }
        function item(value) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
            var url = safeURL(value.url), name = label(value.name, 180), amount = typeof value.amount === 'number' || typeof value.amount === 'string' ? Number(value.amount) : NaN;
            if (!url || !name || value.amount == null || value.amount === '' || !Number.isFinite(amount) || amount < 0 || amount >= 10000000) return null;
            return { id: label(value.id, 100), url: url, name: name, image: safeURL(value.image), amount: number(value.amount, 10000000), currency: typeof value.currency === 'string' && /^[A-Z]{3}$/.test(value.currency) ? value.currency : 'USD', auction: value.auction === true, startingBid: value.startingBid === true, endsAt: number(value.endsAt, 8640000000000000), updatedAt: number(value.updatedAt, 8640000000000000), bought: value.bought === true, available: value.available !== false };
        }
        if (mode === 'commerce') {
            clean = SSNMonetization.commerce(c);
            clean.viewerURL = safeURL(c.viewerURL);
            clean.live = c.live && ['show', 'hide'].indexOf(c.live.mode) !== -1 ? { mode: c.live.mode, url: safeURL(c.live.url), until: number(c.live.until, 8640000000000000) } : null;
        } else if (mode === 'ebay') {
            clean.items = (Array.isArray(c.items) ? c.items : []).slice(0, 20).map(item).filter(Boolean);
            clean.display = ['first', 'cheapest', 'cycle'].indexOf(c.display) !== -1 ? c.display : 'first';
            clean.seconds = Math.max(10, number(c.seconds, 300));
            clean.environment = c.environment === 'sandbox' ? 'sandbox' : 'production';
        } else {
            clean.url = safeURL(c.url); clean.username = label(c.username, 60);
            clean.rank = Math.max(1, number(c.rank, 1000000)); clean.total = number(c.total, 1000000); clean.gifts = number(c.gifts, 1000000);
            if (mode === 'wishlist') clean.item = item(c.item);
        }
        var result = {}; result[mode] = clean; return result;
    }
    function messageText(data) {
        var value = typeof data.chatmessage === 'string' ? data.chatmessage.slice(0, 8000) : '';
        if (data.textonly === false && value) {
            var template = document.createElement('template'); template.innerHTML = value;
            template.content.querySelectorAll('script, style').forEach(function (node) { node.remove(); });
            template.content.querySelectorAll('img').forEach(function (node) { node.replaceWith(document.createTextNode(node.getAttribute('alt') || '')); });
            value = template.content.textContent;
        }
        return value.slice(0, 500);
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
		if (!active && (view === 'alerts' || (!demo && !(mode === 'commerce' && c.live && c.live.mode === 'show' && (!c.live.until || c.live.until > Date.now())) && cardEvery > 0 && (Date.now() / 1000) % Math.max(cardEvery, cardFor) >= cardFor))) { card.hidden = true; return; }
		if (mode !== 'commerce' && mode !== 'wishlist' && mode !== 'ebay' && view !== 'card' && !c.qr && !active) {
			card.hidden = true;
			return;
		}
		card.hidden = false;
		var product = mode === 'commerce' ? SSNMonetization.commerceCurrent(c, Date.now()) : null;
		var ebayItem = mode === 'ebay' ? SSNMonetization.ebayCurrent(c.items, c, Date.now()) : null;
		var url = mode === 'commerce' ? c.viewerURL || product && product.url : mode === 'ebay' ? ebayItem && ebayItem.url : mode === 'wishlist' ? (c.item && c.item.url) || c.url : c.url,
			image = '';
		if (active) {
			text('badge', mode === 'commerce' ? tr('commerce-activity', 'Recent activity') : mode === 'ebay' ? (c.environment === 'sandbox' ? ot("sandbox-purchase", "eBay Sandbox test purchase") : ot("purchased-ebay", "Purchased on eBay")) : mode === 'wishlist' ? ot("rank-unlocked", "Rank unlocked") : mode === 'throne' ? ot("gift-rank", "Gift rank {rank}", { rank: c.rank || 1 }) : ot("thanks-support", "Thank you for the support"));
			text('title', active.title);
			text('detail', active.detail);
			image = active.image || '';
			if (mode === 'ebay' || mode === 'commerce') url = ''; // Never attach an unrelated rotating product to a sale alert.
			text('footer', mode === 'commerce' ? tr('commerce-thanks', 'Thanks for being part of the stream.') : mode === 'ebay' ? ot("thanks-stream", "Thanks for supporting the stream.") : mode === 'wishlist' ? ot("next-wishlist", "The next wishlist item unlocks shortly.") : ot("next-stream", "Your support makes the next stream possible."));
		} else if (mode === 'commerce') {
            if (!product) { card.hidden = true; return; }
            text('badge', tr('commerce-' + product.purpose, { shop: 'Shop', gift: 'Gift', support: 'Support', membership: 'Join' }[product.purpose]));
            text('title', product.name);
            text('detail', product.amount == null || view === 'card' ? '' : SSNMonetization.money(product.amount, product.currency));
            text('footer', tr('commerce-scan', 'Scan the QR code or use the public link in chat.'));
            image = view === 'card' ? '' : product.image;
        } else if (mode === 'wishlist') {
			text('badge', ot('wishlist-rank', 'Wishlist - Rank {rank}', { rank: c.rank }));
			text('title', c.item ? c.item.name : c.total ? ot("wishlist-complete", "Wishlist complete!") : ot("rank-awaits", "Your next rank awaits"));
			text('detail', c.item ? SSNMonetization.money(c.item.amount, c.item.currency) : ot("items-unlocked", "{count} items unlocked", { count: c.total }));
			text('footer', c.item ? ot("wishlist-buy", "Buy through the wishlist. Host-confirmed gifts unlock the next rank.") : ot("thanks-grow", "Thanks for helping the stream grow."));
			image = c.item && safeURL(c.item.image);
		} else if (mode === 'ebay') {
			text('badge', (c.environment === 'sandbox' ? ot("sandbox", "eBay Sandbox (test)") : 'eBay') + ' \u00b7 ' + (ebayItem && ebayItem.auction ? ot("auction", "Auction") : ot("showcase", "Product showcase")));
			text('title', ebayItem ? ebayItem.name : ot("no-products", "No remaining products"));
			text('detail', ebayItem ? (ebayItem.auction ? (ebayItem.startingBid ? ot("starting-bid", "Starting bid") : ot("current-bid", "Current bid")) + ' ' : '') + SSNMonetization.money(ebayItem.amount, ebayItem.currency) : ot("thanks-stream", "Thanks for supporting the stream."));
			var seconds = ebayItem ? Math.max(0, Math.ceil((ebayItem.endsAt - Date.now()) / 1000)) : 0;
			var countdown = ot("countdown", "{hours}h {minutes}m {seconds}s left", { hours: Math.floor(seconds / 3600), minutes: Math.floor((seconds % 3600) / 60), seconds: seconds % 60 });
			text('footer', ebayItem ? (ebayItem.auction && ebayItem.endsAt ? countdown : ot("ebay-scan", "Scan to view this product on eBay.")) + (Date.now() - ebayItem.updatedAt > 120000 ? ' ' + ot("price-delayed", "Price update delayed.") : '') : ot("ended-auctions", "Ended auctions are not counted as purchases."));
			image = ebayItem && safeURL(ebayItem.image);
		} else if (mode === 'throne') {
			text('badge', ot("throne-rank", "Throne \u00b7 Gift rank {rank}", { rank: c.rank || 1 }));
			text('title', ot("gifts-for", "Gifts for {name}", { name: c.username || ot("the-stream", "the stream") }));
			text('detail', ot("gifts-unlocked", "{count} gifts unlocked together", { count: c.gifts || 0 }));
			text('footer', ot("choose-gift", "Choose a gift. Help the stream grow."));
		} else {
			text('badge', ot("back-stream", "Back the next stream"));
			text('title', ot("support-name", "Support {name}", { name: c.username || ot("the-stream", "the stream") }));
			text('detail', ot("optional-tips", "Optional tips. Always appreciated."));
			text('footer', ot('ninja-fees', 'NinjaBacker - 0% platform commission. Processing fees apply.'));
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
		if (by('support-link').getAttribute('href') !== (url || '#')) by('support-link').href = url || '#';
		text('support-link', url ? url.replace(/^https:\/\/(www\.)?/, '') : '');
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
        fitCard();
	}
	function enqueue(id, title, detail, image) {
		if (view === 'showcase' || view === 'card') return;
        if ((typeof id !== 'string' && typeof id !== 'number') || !String(id) || String(id).length > 1024) return;
        id = String(id);
		if (seen.has(id)) return;
		seen.add(id);
		if (seen.size > 200) seen.delete(seen.values().next().value);
		if (pending.length < 20) pending.push({ title: title, detail: detail, image: safeURL(image) });
	}
	function receive(payload) {
		(Array.isArray(payload) ? payload.slice(0, 100) : [payload]).forEach(function (data) {
			if (data && data.content) data = data.content;
			if (!data || typeof data !== 'object' || Array.isArray(data) || data.private === true || ((data.isTest === true || data.testMode === true) && data.event !== 'monetization_test')) return;
            if (mode === 'commerce' && data.event !== 'monetization_update' && state && state.commerce && state.commerce.enabled && (!sources.length || sources.indexOf(data.type) !== -1)) {
                var kind = typeof data.event === 'string' ? data.event : '';
                var hasDonation = typeof data.hasDonation === 'string' && !!data.hasDonation.trim();
                if (data.id && (hasDonation || ['purchase', 'gift', 'giftcontribution', 'giftfunded', 'new_subscriber', 'resub', 'subscription_gift', 'giftpurchase'].indexOf(kind) !== -1)) {
                    var actions = { purchase: 'Purchase', gift: 'Gift', giftcontribution: 'Gift contribution', giftfunded: 'Gift fully funded', new_subscriber: 'New member', resub: 'Renewed membership', subscription_gift: 'Gifted membership', giftpurchase: 'Gifted membership' };
                    var action = Object.prototype.hasOwnProperty.call(actions, kind) ? actions[kind] : 'Support received';
                    enqueue(String(data.type) + ':' + String(data.id), tr('commerce-alert-' + (kind || 'support'), action) + ': ' + String(data.chatname || ot("anonymous", "Anonymous")).slice(0, 60), [typeof data.subtitle === 'string' ? data.subtitle : '', typeof data.hasDonation === 'string' ? data.hasDonation : '', messageText(data)].filter(Boolean).join(' - ').slice(0, 500), data.contentimg);
                }
            }
			if (data.event === 'monetization_update' && data.meta && data.meta.monetization) {
				var nextState = snapshot(data.meta.monetization);
                if (!nextState) return;
                state = nextState;
				lastStateAt = Date.now();
				status.hidden = true;
				var purchase = data.meta.wishlistPurchase;
				if (mode === 'wishlist' && purchase && Date.now() - Number(purchase.at) < 15000) enqueue(purchase.id, ot("purchased", "Purchased: {item}", { item: String(purchase.name).slice(0, 180) }), purchase.supporter ? ot("thanks-name", "Thank you, {name}!", { name: String(purchase.supporter).slice(0, 60) }) : ot("thanks-wishlist", "Thank you to our wishlist supporter!"));
				display();
			}
			if (mode === 'ebay' && data.type === 'ebay' && data.event === 'purchase' && data.meta && data.meta.ebayPurchase && state && state.ebay && state.ebay.enabled) enqueue(data.id, ot("purchased", "Purchased: {item}", { item: String(data.meta.ebayPurchase.itemName || '').slice(0, 180) }), ot("purchased-count", "{count} purchased. Thank you!", { count: String(data.meta.ebayPurchase.quantity || 1) }), data.contentimg);
			if (mode === 'throne' && data.type === 'throne' && ['gift', 'giftpurchase', 'giftcontribution', 'giftfunded'].indexOf(data.event) !== -1 && state && state.throne && state.throne.enabled) {
				var action = data.event === 'giftfunded' ? ot("community-gift", "Community funded a gift") : data.event === 'giftcontribution' ? ot("chipped-in", "{name} chipped in", { name: String(data.chatname || ot("anonymous", "Anonymous")).slice(0, 60) }) : ot("sent-gift", "{name} sent a gift", { name: String(data.chatname || ot("anonymous", "Anonymous")).slice(0, 60) });
				enqueue(data.id, action, String(data.subtitle || ot("wishlist-gift", "A wishlist gift")).slice(0, 180) + (data.hasDonation ? ' \u00b7 ' + String(data.hasDonation).slice(0, 40) : ''), data.contentimg);
			}
			if (mode === 'ninja' && data.event === 'monetization_test' && data.meta && data.meta.ninjabackerTest && state && state.ninja.enabled) enqueue(data.meta.ninjabackerTest.id, ot("test-tip", "Test tip received"), ot("test-works", "Your NinjaBacker alert connection works."));
			if (mode === 'ninja' && data.type === 'ninjabacker' && data.hasDonation && state && state.ninja && state.ninja.enabled) enqueue(data.id, ot("tipped", "{name} tipped {amount}", { name: String(data.chatname || ot("anonymous", "Anonymous")).slice(0, 60), amount: String(data.hasDonation).slice(0, 60) }), messageText(data) || ot("thanks-tip", "Thank you for supporting the stream!"));
		});
	}
	setInterval(function () {
		var now = Date.now();
		if ((!lastStateAt || now - lastStateAt <= 35000 || demo)) display();
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
			status.hidden = true; // Connection diagnostics belong in SSN, not on the audience overlay.
		}
	}, 250);
	if (demo) {
		document.body.classList.add('demo');
		status.textContent = ot('preview', 'Preview - sample items and tips');
		state = { commerce: { enabled: true, qr: true, position: params.get('position') || 'br', display: 'cycle', seconds: 30, items: [{ name: 'Creator merchandise', url: 'https://socialstream.ninja', image: '', amount: 25, currency: 'USD', purpose: 'shop' }] }, ebay: { enabled: true, qr: true, position: params.get('position') || 'br', display: 'cycle', seconds: 20, items: [{ id: '123456789012', name: 'Retro handheld game console', amount: 32.5, currency: 'USD', url: 'https://www.ebay.com/itm/123456789012', auction: true, endsAt: Date.now() + 3723000, updatedAt: Date.now() }] }, throne: { enabled: true, qr: true, position: params.get('position') || 'br', username: ot("the-stream", "the stream"), url: 'https://throne.com', rank: 4, gifts: 3 }, wishlist: { enabled: true, qr: true, position: params.get('position') || 'br', rank: 3, total: 6, url: 'https://www.amazon.com/hz/wishlist/intro', item: { name: 'A little light for the next big idea', amount: 24.99, currency: 'USD', url: 'https://www.amazon.com/hz/wishlist/intro' } }, ninja: { enabled: true, qr: true, position: params.get('position') || 'br', username: ot("the-stream", "the stream"), url: 'https://ninjabacker.com' } };
		display();
        if (mode === 'commerce' && view !== 'card' && view !== 'showcase') setTimeout(function () {
            var provider = params.get('provider') || 'fourthwall';
            var donation = provider === 'kofi', gift = provider === 'bmac';
            enqueue('demo-commerce', tr(donation ? 'commerce-alert-support' : gift ? 'commerce-alert-giftcontribution' : 'commerce-alert-purchase', donation ? 'Support' : gift ? 'Gift contribution' : 'Purchase') + ': Juniper', donation ? 'Ko-fi - $5.00 - Thank you for the stream!' : gift ? 'Buy Me a Coffee - Studio light - $10.00' : provider === 'shopify' ? 'Shopify - Creator T-shirt' : 'Fourthwall - Creator T-shirt');
        }, 600);
		if (mode === 'throne')
			setTimeout(function () {
				enqueue('demo-gift', ot("sent-gift", "{name} sent a gift", { name: "Juniper" }), ot("preview-gift", "A studio light for the next big idea"));
			}, 1200);
		if (mode === 'ninja')
			setTimeout(function () {
				enqueue('demo', ot("tipped", "{name} tipped {amount}", { name: "Juniper", amount: "$5.00" }), ot("preview-tip", "For more wonderful streams. Thank you!"));
			}, 1200);
		return;
	}
	var session = params.get('session');
    status.hidden = !!session;
	if (!session) {
		status.textContent = ot('open-setup', 'Open this overlay from SSN > Monetization');
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
			status.textContent = ot("invalid-relay", "Invalid relay address");
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
