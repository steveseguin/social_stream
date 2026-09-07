(function (root) {
	'use strict';
	var markets = { 'amazon.com': 'USD', 'amazon.ca': 'CAD', 'amazon.co.uk': 'GBP', 'amazon.de': 'EUR', 'amazon.fr': 'EUR', 'amazon.it': 'EUR', 'amazon.es': 'EUR', 'amazon.co.jp': 'JPY', 'amazon.com.au': 'AUD', 'amazon.in': 'INR', 'amazon.com.mx': 'MXN', 'amazon.com.br': 'BRL', 'amazon.nl': 'EUR', 'amazon.se': 'SEK', 'amazon.pl': 'PLN', 'amazon.sg': 'SGD' };
	function str(v, n) {
		return typeof v === 'string' ? v.trim().slice(0, n) : '';
	}
	function amazonURL(value, listOnly) {
		try {
			var u = new URL(str(value, 2048)),
				host = u.hostname.toLowerCase().replace(/^www\./, '');
			if (u.protocol !== 'https:' || u.username || u.password || u.port || !markets[host]) return '';
			if (listOnly) {
				var match = u.pathname.match(/^\/(?:hz\/wishlist\/ls|gp\/registry\/wishlist)\/([a-z0-9]{5,32})(?:\/|$)/i);
				if (!match) return '';
				return 'https://www.' + host + '/hz/wishlist/ls/' + match[1];
			}
			return u.href;
		} catch (_) {
			return '';
		}
	}
	function commerce(raw) {
		raw = raw || {};
		return { enabled: raw.enabled === true, qr: raw.qr !== false, position: raw.position === 'tl' ? 'tl' : 'br', display: raw.display === 'first' ? 'first' : 'cycle', seconds: Math.max(15, Math.min(300, Number(raw.seconds) || 30)), items: (Array.isArray(raw.items) ? raw.items : []).slice(0, 20).map(function (item) {
			var name = str(item && item.name, 180), url = imageURL(item && item.url);
			if (!name || !url) return null;
			var amount = item.amount === '' || item.amount == null ? null : Number(item.amount);
			return { name: name, url: url, image: imageURL(item.image), amount: Number.isFinite(amount) && amount >= 0 && amount < 10000000 ? amount : null, currency: /^[A-Z]{3}$/.test(item.currency) ? item.currency : 'USD', purpose: ['shop', 'gift', 'support', 'membership'].indexOf(item.purpose) !== -1 ? item.purpose : 'shop' };
		}).filter(Boolean) };
	}
	function commerceCurrent(c, now) {
		var items = c && c.items || [];
		return items.length ? items[c.display === 'first' ? 0 : Math.floor(now / (c.seconds * 1000)) % items.length] : null;
	}
	// Public display data only. Receiver authentication remains in the existing relay.
	function providerEvent(provider, payload, deliveryId) {
		if (!payload || payload.testMode === true || payload.live_mode === false || payload.isTest === true) return null;
		var d = provider === 'kofi' ? payload : payload.data;
		if (!d || typeof d !== 'object') return null;
		var row = { platform: provider, type: provider, id: provider + ':' + String(deliveryId || d.id || Date.now()), chatname: 'Anonymous', chatmessage: '', textonly: true, chatimg: '', subtitle: '', meta: {} };
		var amount, currency, paid = false, kind = '', items = [];
		if (provider === 'kofi') {
			if (d.is_public !== true || ['Donation', 'Subscription', 'Shop Order', 'Commission'].indexOf(d.type) === -1) return null;
			row.chatname = str(d.from_name, 60) || 'Anonymous'; row.chatmessage = str(d.message, 500);
			amount = d.amount; currency = d.currency;
			kind = d.type === 'Shop Order' || d.type === 'Commission' ? 'purchase' : d.type === 'Subscription' || d.is_subscription_payment === true ? (d.is_first_subscription_payment ? 'new_subscriber' : 'resub') : '';
			paid = kind !== 'purchase';
			row.subtitle = str(d.tier_name, 180);
			if (kind === 'new_subscriber' || kind === 'resub') row.membership = row.subtitle || 'Membership';
			items = Array.isArray(d.shop_items) ? d.shop_items.map(function (x) { return str(x.item_name, 180); }) : [];
		} else if (provider === 'bmac') {
			var types = { 'donation.created': '', 'extra_purchase.created': 'purchase', 'commission_order.created': 'purchase', 'wishlist_payment.created': 'giftcontribution', 'membership.started': 'new_subscriber' };
			if (!Object.prototype.hasOwnProperty.call(types, payload.type) || d.refunded === true || d.refunded === 'true' || (d.status && ['succeeded', 'active'].indexOf(d.status) === -1)) return null;
			kind = types[payload.type]; row.chatname = d.supporter_name_type === 'anonymous' ? 'Anonymous' : str(d.supporter_name, 60) || 'Anonymous';
			row.chatmessage = d.note_hidden === true || d.note_hidden === 'true' ? '' : str(d.support_note, 500);
			amount = d.amount; currency = d.currency; paid = kind !== 'purchase' && kind !== 'new_subscriber';
			if (kind === 'new_subscriber') { row.membership = str(d.membership_level_name, 180) || 'Membership'; row.subtitle = row.membership; }
			if (d.wishlist) { row.subtitle = str(d.wishlist.title, 180); row.meta.commerce = { recipient: 'creator', completed: d.wishlist.completed === true }; }
			if (d.commission) row.subtitle = str(d.commission.name, 180);
			items = Array.isArray(d.extras) ? d.extras.map(function (x) { return str(x.title, 180); }) : [];
		} else if (provider === 'fourthwall') {
			var kinds = { ORDER_PLACED: 'purchase', GIFT_PURCHASE: 'gift', DONATION: '', SUBSCRIPTION_PURCHASED: 'new_subscriber' };
			if (!Object.prototype.hasOwnProperty.call(kinds, payload.type)) return null;
			kind = kinds[payload.type]; row.chatname = str(d.username || d.nickname, 60) || 'Anonymous'; row.chatmessage = str(d.message, 500);
			var price = d.amounts && d.amounts.total || d.subscription && d.subscription.variant && d.subscription.variant.amount || {};
			amount = price.value; currency = price.currency;
			// Preserve existing Fourthwall order-value donation triggers during migration.
			paid = true;
			if (kind === 'purchase') {
                paid = !(Array.isArray(d.amounts && d.amounts.giftCards) && d.amounts.giftCards.length);
                row.meta.commerce = paid ? { legacyDonationValue: true } : {};
            }
			if (kind === 'gift') { row.subtitle = str(d.offer && d.offer.name, 180); row.meta.commerce = { recipient: 'other' }; }
			if (kind === 'new_subscriber') row.membership = 'Membership';
			items = Array.isArray(d.offers) ? d.offers.map(function (x) { return str(x.name, 180); }) : [];
		} else return null;
		if (items.length) row.subtitle = items.filter(Boolean).join(', ').slice(0, 180);
		if (kind) row.event = kind;
		var value = typeof amount === 'number' || (typeof amount === 'string' && /^\d+(?:\.\d+)?$/.test(amount.trim())) ? Number(amount) : NaN, code = typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : '';
		if (amount != null && amount !== '' && Number.isFinite(value) && value > 0 && value < 10000000 && /^[A-Z]{3}$/.test(code)) {
			row.meta.commerce = row.meta.commerce || {}; row.meta.commerce.currency = code;
			if (paid) { row.hasDonation = money(value, code); row.donoValue = value; }
		} else if (paid) return null;
		if (!row.chatmessage && !row.hasDonation) row.chatmessage = row.subtitle || (kind === 'purchase' ? 'Product purchased' : 'Membership started');
		return row;
	}
	function presentation(raw) {
		raw = raw || {};
		return { view: ['both', 'showcase', 'card', 'alerts'].indexOf(raw.view) !== -1 ? raw.view : 'both', style: raw.style === 'compact' ? 'compact' : 'default', scale: Math.max(0.5, Math.min(2, Number(raw.scale) || 1)), cardevery: Math.max(0, Math.min(3600, Number(raw.cardevery) || 0)), cardfor: Math.max(15, Math.min(300, Number(raw.cardfor) || 30)), onlytype: str(raw.onlytype, 200).toLowerCase().split(',').map(function (part) { return part.trim(); }).filter(function (part) { return /^[a-z0-9_-]+$/.test(part); }).join(',') };
	}
	function config(raw) {
		if (raw && raw.json)
			try {
				raw = JSON.parse(raw.json);
			} catch (_) {
				raw = {};
			}
		raw = raw && typeof raw === 'object' ? raw : {};
		var e = raw.ebay || {};
		var w = raw.wishlist || {},
			n = raw.ninja || {},
			t = raw.throne || {};
		return { presentation: presentation(raw.presentation), commerce: commerce(raw.commerce), ebay: { enabled: e.enabled === true, qr: e.qr !== false, announce: e.announce === true, interval: e.interval === true, minutes: Math.max(5, Math.min(120, Number(e.minutes) || 15)), position: e.position === 'tl' ? 'tl' : 'br', display: ['cycle', 'cheapest', 'first'].indexOf(e.display) !== -1 ? e.display : 'cycle', seconds: Math.max(10, Math.min(300, Number(e.seconds) || 20)) }, throne: { enabled: t.enabled === true, username: /^[a-z0-9_.-]{1,50}$/i.test(str(t.username, 50)) ? str(t.username, 50).toLowerCase() : '', qr: t.qr !== false, announce: t.announce === true, interval: t.interval === true, minutes: Math.max(5, Math.min(120, Number(t.minutes) || 15)), position: t.position === 'tl' ? 'tl' : 'br' }, wishlist: { enabled: w.enabled === true, url: amazonURL(w.url, true), qr: w.qr !== false, announce: w.announce === true, interval: w.interval === true, minutes: Math.max(5, Math.min(120, Number(w.minutes) || 15)), position: w.position === 'tl' ? 'tl' : 'br' }, ninja: { enabled: n.enabled === true, reliable: n.reliable === true, username: /^[a-z0-9_-]{1,50}$/i.test(str(n.username, 50)) ? str(n.username, 50).toLowerCase() : '', qr: n.qr === true, announce: n.announce === true, interval: n.interval === true, minutes: Math.max(5, Math.min(120, Number(n.minutes) || 15)), position: n.position === 'tl' ? 'tl' : 'br' } };
	}
	function price(text, currency) {
		var s = str(text, 100).replace(/[^\d.,]/g, '');
		if (!s) return null;
		var last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
		if (currency !== 'JPY' && last >= 0 && s.length - last === 3) s = s.slice(0, last).replace(/[.,]/g, '') + '.' + s.slice(last + 1);
		else s = s.replace(/[.,]/g, '');
		var value = Number(s);
		return Number.isFinite(value) && value > 0 && value < 10000000 ? value : null;
	}
	function imageURL(value) {
		try {
			var u = new URL(value);
			return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
		} catch (_) {
			return '';
		}
	}
	function item(raw) {
		var amount = Number(raw && raw.amount),
			name = str(raw && raw.name, 180),
			url = amazonURL(raw && raw.url, false);
		if (!name || !Number.isFinite(amount) || amount <= 0 || amount >= 10000000) return null;
		return { id: str(raw.id, 100) || url || name, name: name, amount: amount, currency: /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : 'USD', url: url, image: imageURL(raw.image), bought: raw.bought === true, supporter: str(raw.supporter, 60) };
	}
	function ladder(state, listURL) {
		state = state || {};
		var items = (Array.isArray(state.items) ? state.items : []).slice(0, 100).map(item).filter(Boolean);
		if (state.url !== listURL) items = [];
		items.sort(function (a, b) {
			return a.amount - b.amount || a.name.localeCompare(b.name);
		});
		return {
			url: listURL,
			items: items,
			current:
				items.find(function (i) {
					return !i.bought;
				}) || null,
			rank:
				items.filter(function (i) {
					return i.bought;
				}).length + 1,
			total: items.length
		};
	}
	function purchaseURL(i, listURL) {
		if (!i || !i.url) return listURL;
		try {
			var u = new URL(i.url),
				list = new URL(listURL);
			if (amazonURL(i.url, true) === listURL || (u.hostname.replace(/^www\./, '') === list.hostname.replace(/^www\./, '') && u.searchParams.get('colid') === list.pathname.split('/').pop())) return u.href;
		} catch (_) {}
		return listURL;
	}
	function parseList(html, url, document) {
		var safe = amazonURL(url, true);
		if (!safe) throw new Error('Use a public Amazon wishlist sharing URL.');
		if (typeof html !== 'string' || html.length > 4000000) throw new Error('Wishlist response is too large.');
		var template = document.createElement('template');
		template.innerHTML = html;
		var doc = template.content;
		if (doc.querySelector('form[action*="validateCaptcha"],input#captchacharacters')) throw new Error('Amazon requires a browser check. Add items manually below.');
		var currency = markets[new URL(safe).hostname.replace(/^www\./, '')],
			items = [],
			ids = new Set();
		var rows = doc.querySelectorAll('[data-itemid],li.g-item-sortable');
		Array.from(rows)
			.slice(0, 100)
			.forEach(function (row) {
				var title = row.querySelector('a[id^="itemName"],a.a-link-normal[href*="/dp/"]'),
					money = row.querySelector('.a-price .a-offscreen,[id^="itemPrice"]'),
					img = row.querySelector('img');
				if (!title || !money) return;
				var amount = price(money.textContent, currency),
					link = '';
				try {
					link = new URL(title.getAttribute('href'), safe).href;
				} catch (_) {}
				var entry = item({ id: row.getAttribute('data-itemid') || row.id || link, name: title.getAttribute('title') || title.textContent, amount: amount, currency: currency, url: link, image: img && (img.getAttribute('src') || '') });
				if (entry && !ids.has(entry.id)) {
					ids.add(entry.id);
					items.push(entry);
				}
			});
		if (!items.length) throw new Error('No priced wishlist items could be read. Check that the list is public, or add items manually below.');
		return { url: safe, items: items };
	}
	function money(value, currency) {
		try {
			return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency }).format(value);
		} catch (_) {
			return Number(value).toFixed(2) + ' ' + currency;
		}
	}
	function tip(data) {
		if (!data || data.type !== 'tip' || data.isTest || typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0 || data.amount > 10000000 || !/^[A-Za-z]{3}$/.test(data.currency || '')) return null;
		var name = data.anonymous ? 'Anonymous' : str(data.fromLabel, 60) || 'Anonymous',
			currency = data.currency.toUpperCase(),
			message = str(data.message, 500),
			identity = data.tipId || data.id || [data.timestamp, data.amount, currency, name, message].join('|');
		if (!data.tipId && !data.id && !Number.isFinite(data.timestamp)) return null;
		return { platform: 'ninjabacker', type: 'ninjabacker', id: 'ninjabacker:' + str(String(identity), 800), chatname: name, chatmessage: message, textonly: true, hasDonation: money(data.amount, currency), donoValue: data.amount, chatimg: '', meta: { ninjabacker: { currency: currency, amount: data.amount } } };
	}
	function throne(event) {
		if (!event || event.contract_version !== '1' || !/^[\w-]{1,128}$/.test(event.event_id || '')) return null;
		var kind = { gift_purchased: 'gift', contribution_purchased: 'giftcontribution', gift_crowdfunded: 'giftfunded' }[event.event_type],
			d = event.data;
		if (!kind || !d || !str(d.item_name, 180) || !/^[A-Z]{3}$/.test(d.currency || '')) return null;
		var minor = kind === 'giftcontribution' ? d.amount : d.price;
		if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 1000000000) return null;
		var digits;
		try {
			digits = new Intl.NumberFormat('en', { style: 'currency', currency: d.currency }).resolvedOptions().maximumFractionDigits;
		} catch (_) {
			return null;
		}
		var amount = minor / Math.pow(10, digits),
			itemName = str(d.item_name, 180),
			name = kind === 'giftfunded' ? 'Community' : str(d.gifter_username, 60) || 'Anonymous';
		var row = { platform: 'throne', type: 'throne', event: kind, id: 'throne:' + event.event_id, chatname: name, chatmessage: str(d.message, 500), textonly: true, chatimg: '', contentimg: imageURL(d.item_thumbnail_url), subtitle: itemName, meta: { commerce: { recipient: 'creator', currency: d.currency }, throne: { itemName: itemName, creator: str(d.creator_username, 50).toLowerCase(), completed: kind !== 'giftcontribution', currency: d.currency, amount: amount } } };
		if (kind === 'giftfunded') row.meta.commerce.goalAmount = amount;
		// Contributions have already entered the donation flow when a crowdfund completes.
		if (kind !== 'giftfunded') {
			row.hasDonation = money(amount, d.currency);
			row.donoValue = amount;
		}
		return row;
	}

	function ebayId(value) {
		try {
			var u = new URL(str(value, 2048));
			if (u.protocol !== 'https:' || u.username || u.password || u.port || !/^(?:(?:www\.)?ebay\.(?:com|ca|co\.uk|com\.au|de|fr|it|es|ie|at|ch|be|nl|pl)|(?:www\.)?sandbox\.ebay\.com)$/.test(u.hostname)) return '';
			var match = u.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d{9,15})(?:\/|$)/);
			return match ? match[1] : '';
		} catch (_) {
			return '';
		}
	}
	function ebayCurrent(items, options, now) {
		var remaining = (items || []).filter(function (i) {
			return !i.bought && i.available !== false && (!i.endsAt || i.endsAt > now);
		});
		if (!remaining.length) return null;
		if (options.display === 'cheapest')
			remaining.sort(function (a, b) {
				return a.amount - b.amount;
			});
		return remaining[options.display === 'cycle' ? Math.floor(now / (options.seconds * 1000)) % remaining.length : 0];
	}

    function fourthwallProduct(data, link) {
        var url;
        try { url = new URL(link); } catch (_) { return null; }
        var match = url.pathname.match(/^\/products\/([a-zA-Z0-9_-]+)\/?$/);
        if (url.protocol !== 'https:' || url.username || url.password || url.port || !match || !data || data.slug !== match[1] || !data.state || data.state.type !== 'AVAILABLE' || !data.access || data.access.type !== 'PUBLIC') return null;
        var variants = Array.isArray(data.variants) ? data.variants : [];
        // Leave variable and bundle prices blank instead of implying a fixed checkout price.
        var prices = variants.map(function (variant) { return variant.unitPrice; });
        var price = prices.length && prices[0];
        if (!price || !prices.every(function (p) { return p && p.value === price.value && p.currency === price.currency; }) || data.type === 'BUNDLE') price = null;
        var image = Array.isArray(data.images) && data.images.length ? data.images[0].url : '';
        url.search = ''; url.hash = '';
        return commerce({ items: [{ name: data.name, url: url.href, image: image, amount: price && typeof price.value === 'number' && /^[A-Z]{3}$/.test(price.currency) ? price.value : null, currency: price ? price.currency : 'USD', purpose: 'shop' }] }).items[0] || null;
    }
	var api = { fourthwallProduct: fourthwallProduct, commerce: commerce, commerceCurrent: commerceCurrent, providerEvent: providerEvent, ebayId: ebayId, ebayCurrent: ebayCurrent, throne: throne, config: config, amazonURL: amazonURL, imageURL: imageURL, price: price, item: item, ladder: ladder, purchaseURL: purchaseURL, parseList: parseList, money: money, tip: tip };
	root.SSNMonetization = api;
	if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
