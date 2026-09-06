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
		return { ebay: { enabled: e.enabled === true, qr: e.qr !== false, announce: e.announce === true, interval: e.interval === true, minutes: Math.max(5, Math.min(120, Number(e.minutes) || 15)), position: e.position === 'tl' ? 'tl' : 'br', display: ['cycle', 'cheapest', 'first'].indexOf(e.display) !== -1 ? e.display : 'cycle', seconds: Math.max(10, Math.min(300, Number(e.seconds) || 20)) }, throne: { enabled: t.enabled === true, username: /^[a-z0-9_.-]{1,50}$/i.test(str(t.username, 50)) ? str(t.username, 50).toLowerCase() : '', qr: t.qr !== false, announce: t.announce === true, interval: t.interval === true, minutes: Math.max(5, Math.min(120, Number(t.minutes) || 15)), position: t.position === 'tl' ? 'tl' : 'br' }, wishlist: { enabled: w.enabled === true, url: amazonURL(w.url, true), qr: w.qr !== false, announce: w.announce === true, interval: w.interval === true, minutes: Math.max(5, Math.min(120, Number(w.minutes) || 15)), position: w.position === 'tl' ? 'tl' : 'br' }, ninja: { enabled: n.enabled === true, username: /^[a-z0-9_-]{1,50}$/i.test(str(n.username, 50)) ? str(n.username, 50).toLowerCase() : '', qr: n.qr === true, announce: n.announce === true, interval: n.interval === true, minutes: Math.max(5, Math.min(120, Number(n.minutes) || 15)), position: n.position === 'tl' ? 'tl' : 'br' } };
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
		var kind = { gift_purchased: 'giftpurchase', contribution_purchased: 'giftcontribution', gift_crowdfunded: 'giftfunded' }[event.event_type],
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
		var row = { platform: 'throne', type: 'throne', event: kind, id: 'throne:' + event.event_id, chatname: name, chatmessage: str(d.message, 500), textonly: true, chatimg: '', contentimg: imageURL(d.item_thumbnail_url), subtitle: itemName, meta: { throne: { itemName: itemName, creator: str(d.creator_username, 50).toLowerCase(), completed: kind !== 'giftcontribution', currency: d.currency, amount: amount } } };
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
			if (u.protocol !== 'https:' || u.username || u.password || u.port || !/^(?:www\.)?ebay\.(?:com|ca|co\.uk|com\.au|de|fr|it|es|ie|at|ch|be|nl|pl)$/.test(u.hostname)) return '';
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
	var api = { ebayId: ebayId, ebayCurrent: ebayCurrent, throne: throne, config: config, amazonURL: amazonURL, imageURL: imageURL, price: price, item: item, ladder: ladder, purchaseURL: purchaseURL, parseList: parseList, money: money, tip: tip };
	root.SSNMonetization = api;
	if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
