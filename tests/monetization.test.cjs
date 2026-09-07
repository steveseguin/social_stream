const { test } = require('node:test'),
	assert = require('node:assert/strict'),
	fs = require('node:fs'),
	vm = require('node:vm'),
	path = require('node:path'),
	{ pathToFileURL } = require('node:url');
const M = require('../shared/monetization/core.js'),
	root = path.join(__dirname, '..'),
	url = 'https://www.amazon.com/hz/wishlist/ls/ABC123456';
function service(initialDisk = {}) {
	let now = 1000000;
	const sent = [],
		chat = [],
		tips = [],
		sources = [],
		timers = [],
		disk = {};
	const c = {
		SSNMonetization: M,
		crypto: require('node:crypto').webcrypto,
		Uint8Array,
		TextEncoder,
		settings: {},
		loadedFirst: true,
		isExtensionOn: true,
		Date: { now: () => now },
		URL,
		AbortController,
		Promise,
		JSON,
		Math,
		Set,
		Map,
		console,
		setTimeout,
		clearTimeout,
		setInterval: fn => timers.push(fn),
		sendDataP2P: d => sent.push(d),
		sendMessageToTabs: d => chat.push(d),
		processIncomingMessage: d => tips.push(d),
		fetch: async endpoint => ({ ok: endpoint.includes('ninjabacker.com'), json: async () => ({ username: 'creator' }) }),
		EventSource: function (endpoint) {
			this.endpoint = endpoint;
			this.close = () => (this.closed = true);
			sources.push(this);
		},
		chrome: {
			runtime: {},
			storage: {
				local: {
					get: (keys, cb) => cb(JSON.parse(JSON.stringify(initialDisk))),
					set: (data, cb) => {
						Object.assign(disk, JSON.parse(JSON.stringify(data)));
						if (cb) cb();
					}
				}
			}
		}
	};
	c.window = c;
	vm.createContext(c);
	vm.runInContext(fs.readFileSync(path.join(root, 'shared/monetization/ebay-service.js'), 'utf8'), c);
	vm.runInContext(fs.readFileSync(path.join(root, 'shared/monetization/ninja-service.js'), 'utf8'), c);
	vm.runInContext(fs.readFileSync(path.join(root, 'shared/monetization/background.js'), 'utf8'), c);
	return {
		c,
		sent,
		chat,
		tips,
		sources,
		disk,
		request: (action, extra = {}) => c.handleMonetizationRequest(Object.assign({ action }, extra)),
		advance: ms => {
			now += ms;
			timers.forEach(fn => fn());
		}
	};
}
test('Wishlist URLs, prices and purchase links retain the correct list context', () => {
	assert.equal(M.amazonURL(url + '?ref_=wl_share', true), url);
	for (const bad of ['https://amazon.com.evil.test/hz/wishlist/ls/ABC123', 'http://amazon.com/hz/wishlist/ls/ABC123', 'https://user:pass@amazon.com/hz/wishlist/ls/ABC123', 'https://localhost/hz/wishlist/ls/ABC123']) assert.equal(M.amazonURL(bad, true), '');
	assert.equal(M.price('$1,234.56', 'USD'), 1234.56);
	assert.equal(M.price('1.234,56 EUR', 'EUR'), 1234.56);
	assert.equal(M.price('1,234', 'JPY'), 1234);
	assert.equal(M.price('Unavailable', 'USD'), null);
	assert.equal(M.purchaseURL({ url: 'https://www.amazon.com/dp/B000000001' }, url), url);
	assert.match(M.purchaseURL({ url: 'https://www.amazon.com/dp/B000000001?colid=ABC123456' }, url), /colid=/);
});
test('NinjaBacker normalization respects anonymity, money units, and test-tip isolation', () => {
	const tip = M.tip({ type: 'tip', amount: 5.25, currency: 'USD', timestamp: 123, fromLabel: 'Hidden Name', anonymous: true, message: 'Thank you' });
	assert.equal(tip.chatname, 'Anonymous');
	assert.equal(tip.donoValue, 5.25);
	assert.equal(tip.event, undefined);
	assert.equal(tip.textonly, true);
	assert.equal(tip.meta.ninjabacker.currency, 'USD');
	assert(!tip.id.includes('Hidden Name'));
	assert.equal(M.tip({ type: 'tip', amount: 5, currency: 'USD', timestamp: 1, isTest: true }), null);
	assert.equal(M.tip({ type: 'tip', amount: -5, currency: 'USD', timestamp: 1 }), null);
});
test('Wishlist rank-ups are host-confirmed, ordered by price, persistent, and undoable', async () => {
	const s = service();
	await s.request('save', { config: { wishlist: { enabled: true, url }, ninja: {} } });
	await s.request('add', { item: { name: 'Expensive', amount: 50, currency: 'USD' } });
	let result = await s.request('add', { item: { name: 'Affordable', amount: 5, currency: 'USD' } });
	assert.equal(result.list.current.name, 'Affordable');
	assert.equal(result.list.rank, 1);
	assert.equal((await s.request('import')).error.includes('Amazon'), true);
	assert.equal((await s.request('get')).list.items.length, 2);
	const first = result.list.current.id;
	result = await s.request('complete', { id: first, supporter: 'Juniper' });
	assert.equal(result.list.rank, 2);
	assert.equal(result.list.current.name, 'Expensive');
	assert.equal(s.chat.length, 0);
	assert.equal(s.tips.length, 0);
	assert(s.sent.some(m => m.meta.wishlistPurchase && m.meta.wishlistPurchase.supporter === 'Juniper'));
	assert((await s.request('complete', { id: first })).error);
	result = await s.request('undo');
	assert.equal(result.list.rank, 1);
	assert.equal(result.list.current.name, 'Affordable');
	assert.equal(s.disk.monetizationPrivate.list.items.filter(i => i.bought).length, 0);
});
test('Ninja feed keeps the Tip ID private, deduplicates deliveries, and closes when disabled', async () => {
	const s = service();
	const result = await s.request('save', { config: { ninja: { enabled: true, username: 'creator' } }, token: 'private-test-token' });
	assert(result.tokenSaved);
	assert(!JSON.stringify(result).includes('private-test-token'));
	assert(!JSON.stringify(s.sent).includes('private-test-token'));
	assert(!JSON.stringify(s.c.settings).includes('private-test-token'));
	assert(s.sources[0].endpoint.endsWith('/private-test-token'));
	const data = { type: 'tip', amount: 8, currency: 'USD', timestamp: 123, fromLabel: 'Viewer', message: 'Hello' };
	s.sources[0].onmessage({ data: JSON.stringify(data) });
	s.sources[0].onmessage({ data: JSON.stringify(data) });
	assert.equal(s.tips.length, 1);
	s.sources[0].onmessage({ data: JSON.stringify({ ...data, isTest: true }) });
	assert.equal(s.tips.length, 1);
	assert(s.sent.some(p => p.event === 'monetization_test'));
	await s.request('save', { config: { ninja: { enabled: false, username: 'creator' } } });
	assert(s.sources[0].closed);
	assert((await s.c.handleMonetizationRequest({ action: 'save' }, { tab: { id: 1 } })).error);
});
test('Chat announcements require opt-in and stop while SSN is off', async () => {
	const s = service();
	await s.request('save', { config: { ninja: { enabled: true, username: 'creator', interval: true, minutes: 1 } } });
	assert.equal(s.chat.length, 0);
	s.advance(1000);
	s.advance(299000);
	assert.equal(s.chat.length, 0);
	s.advance(2000);
	assert.equal(s.chat.length, 1);
	assert.match(s.chat[0].response, /ninjabacker.com\/creator/);
	s.c.isExtensionOn = false;
	s.advance(600000);
	assert.equal(s.chat.length, 1);
	s.c.isExtensionOn = true;
	s.advance(1000);
	assert.equal(s.chat.length, 1);
});
test('Wishlist HTML import reads item rows without executing scripts or inferring purchases', async () => {
	const browser = await require('playwright').chromium.launch({ headless: true });
	try {
		const page = await browser.newPage();
		await page.goto(pathToFileURL(path.join(root, 'monetization.html')).href + '?demo');
		const parsed = await page.evaluate(({ url }) => SSNMonetization.parseList('<script>window.executed=true</script><li data-itemid="A"><a id="itemName_A" href="/dp/B000000001?colid=ABC123456">A &amp; B</a><span class="a-price"><span class="a-offscreen">$12.34</span></span></li>', url, document), { url });
		assert.equal(parsed.items[0].name, 'A & B');
		assert.equal(parsed.items[0].amount, 12.34);
		assert.equal(parsed.items[0].bought, false);
		assert.equal(await page.evaluate(() => window.executed), undefined);
	} finally {
		await browser.close();
	}
});

test('NinjaBacker rejects a mismatched account before saving a secret', async () => {
	const s = service();
	const result = await s.request('save', { config: { ninja: { enabled: true, username: 'someoneelse' } }, token: 'private-test-token' });
	assert.match(result.error, /different/);
	assert.equal((await s.request('get')).tokenSaved, false);
	assert.equal(s.sources.length, 0);
	assert(!(await s.c.handleMonetizationRequest({ action: 'get' }, { tab: { id: null } })).error);
});
test('Core remains available on window in Electron with CommonJS enabled', () => {
	const context = { module: { exports: {} }, URL };
	context.window = context;
	vm.createContext(context);
	vm.runInContext(fs.readFileSync(path.join(root, 'shared/monetization/core.js'), 'utf8'), context);
	assert.equal(typeof context.SSNMonetization.tip, 'function');
	assert.equal(context.module.exports, context.SSNMonetization);
});

test('Popup retries incomplete startup replies and keeps its mode switch after general settings wiring', async () => {
	const browser = await require('playwright').chromium.launch({ headless: true });
	try {
		const page = await browser.newPage();
		const html = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
		const start = html.indexOf('<details id="monetization-settings">'),
			end = html.indexOf('</details></div>', html.indexOf('id="money-status"', start)) + 10;
		await page.setContent(html.slice(start, end));
		await page.evaluate(() => {
			window.calls = 0;
			window.chrome = {
				runtime: {
					sendMessage: (request, callback) => {
						calls++;
						callback(calls === 1 ? {} : { config: { wishlist: { minutes: 15, position: 'br' }, ninja: { minutes: 15, position: 'br' } }, list: { items: [], current: null, total: 0 }, status: 'Disabled' });
					}
				}
			};
		});
		await page.addScriptTag({ path: path.join(root, 'shared/monetization/core.js') });
		await page.addScriptTag({ path: path.join(root, 'shared/monetization/popup.js') });
		await page.waitForFunction(() => document.getElementById('money-current').textContent.includes('Load your wishlist'));
		assert(await page.evaluate(() => calls >= 2));
		await page.evaluate(() => {
			document.getElementById('monetization-settings').open = true;
			document.getElementById('money-mode').onchange = function () {};
		});
		await page.locator('#money-mode').selectOption('ninja');
		assert.equal(await page.locator('#money-ninja-panel').evaluate(e => e.hidden), false);
		await page.locator('#money-save').click();
		await page.waitForFunction(() => document.getElementById('money-status').textContent === 'Saved.');
	} finally {
		await browser.close();
	}
});

const throneGift = { contract_version: '1', event_id: 'first-gift', event_type: 'gift_purchased', data: { creator_id: 'creator-id', creator_username: 'creator', gifter_username: 'Anonymous', item_name: 'Studio light', price: 1099, currency: 'USD' } };
test('Throne counts completed gifts once, preserves anonymity, and keeps reader credentials private', async () => {
	const s = service();
	s.c.fetch = async () => ({ ok: true, json: async () => ({ protocol: 'ssn-throne-1' }) });
	let result = await s.request('save', { config: { throne: { enabled: true, username: 'creator' } } });
	assert(!result.error, result.error);
	const key = s.disk.monetizationPrivate.throne.key;
	assert.equal(key.length, 64);
	assert(!JSON.stringify(result).includes(key));
	assert(!JSON.stringify(s.sent).includes(key));
	assert(!JSON.stringify(s.c.settings).includes(key));
	assert(result.throne.webhook.endsWith(s.disk.monetizationPrivate.throne.hook));
	assert.notEqual(s.disk.monetizationPrivate.throne.hook, key);
	const source = s.sources[0];
	source.onmessage({ data: JSON.stringify(throneGift) });
	source.onmessage({ data: JSON.stringify(throneGift) });
	result = await s.request('get');
	assert.equal(result.throne.gifts, 1);
	assert.equal(s.tips.length, 1);
	assert.equal(s.tips[0].donoValue, 10.99);
	assert.equal(s.tips[0].chatname, 'Anonymous');
	assert.equal(s.chat.length, 0);
	source.onmessage({ data: JSON.stringify({ ...throneGift, event_id: 'contribution', event_type: 'contribution_purchased', data: { ...throneGift.data, amount: 500 } }) });
	result = await s.request('get');
	assert.equal(result.throne.gifts, 1);
	assert.equal(s.tips[1].donoValue, 5);
	source.onmessage({ data: JSON.stringify({ ...throneGift, event_id: 'funded', event_type: 'gift_crowdfunded' }) });
	result = await s.request('get');
	assert.equal(result.throne.gifts, 2);
	assert.equal(s.tips[2].hasDonation, undefined);
	source.onmessage({ data: JSON.stringify({ ...throneGift, event_id: 'other', data: { ...throneGift.data, creator_username: 'different' } }) });
	await s.request('get');
	assert.equal(s.tips.length, 3);
	await s.request('throneReset');
	source.onmessage({ data: JSON.stringify(throneGift) });
	assert.equal((await s.request('get')).throne.gifts, 0);
	await s.request('save', { config: { throne: { enabled: false, username: 'creator' } } });
	assert(source.closed);
});
test('An unavailable Throne relay cannot silently enable the source', async () => {
	const s = service();
	const result = await s.request('save', { config: { throne: { enabled: true, username: 'creator' } } });
	assert.match(result.error, /not available/);
	assert.equal((await s.request('get')).config.throne.enabled, false);
	assert.equal(s.sources.length, 0);
});

test('eBay selects remaining products, validates item links and never calls an ended auction purchased', () => {
	const items = [
		{ id: 'a', amount: 50 },
		{ id: 'b', amount: 10 },
		{ id: 'c', amount: 1, bought: true },
		{ id: 'd', amount: 2, endsAt: 100 }
	];
	assert.equal(M.ebayCurrent(items, { display: 'first', seconds: 20 }, 1000).id, 'a');
	assert.equal(M.ebayCurrent(items, { display: 'cheapest', seconds: 20 }, 1000).id, 'b');
	assert.equal(M.ebayCurrent(items, { display: 'cycle', seconds: 20 }, 20000).id, 'b');
	assert.equal(M.ebayCurrent(items, { display: 'cycle', seconds: 20 }, 40000).id, 'a');
	assert.equal(items[3].bought, undefined);
	assert.equal(M.ebayId('https://www.ebay.ca/itm/A-title/123456789012?foo=1'), '123456789012');
	assert.equal(M.ebayId('https://www.sandbox.ebay.com/itm/123456789012'), '123456789012');
	assert.equal(M.ebayId('https://sandbox.ebay.com.evil.test/itm/123456789012'), '');
	items[1].bought = true;
	assert.equal(M.ebayCurrent(items, { display: 'cheapest', seconds: 20 }, 1000).id, 'a');
	for (const url of ['https://ebay.com.evil.test/itm/123456789012', 'http://ebay.com/itm/123456789012', 'https://u:p@ebay.com/itm/123456789012', 'javascript:alert(1)']) assert.equal(M.ebayId(url), '');
});
test('eBay watches off-screen items, ignores history, persists deduplication and respects disable/chat opt-in', async () => {
	const s = service(),
		one = '123456789012',
		two = '234567890123';
	let sales = [],
		requests = 0;
	s.c.fetch = async endpoint => {
		requests++;
		let value;
		if (endpoint.endsWith('/status')) value = { protocol: 'ssn-ebay-1', connected: true };
		else if (endpoint.includes('/item/')) {
			const id = endpoint.split('/').pop();
			value = { id, name: id === one ? 'First product' : 'Off-screen product', amount: id === one ? 10 : 20, currency: 'USD', url: 'https://www.ebay.com/itm/' + id, available: true };
		} else if (endpoint.includes('/sales?')) value = { sales, through: s.c.Date.now() };
		else throw Error('unexpected endpoint');
		return { ok: true, json: async () => value };
	};
	assert(!(await s.request('ebayAdd', { url: 'https://www.ebay.com/itm/' + one })).error);
	assert(!(await s.request('ebayAdd', { url: 'https://www.ebay.com/itm/' + two })).error);
	await s.request('save', { config: { ebay: { enabled: true, display: 'first' } } });
	sales = [
		{ id: 'a'.repeat(64), itemId: two, quantity: 2, paidAt: s.c.Date.now() + 1 },
		{ id: 'b'.repeat(64), itemId: one, paidAt: 100 }
	];
	s.advance(1000);
	await s.request('get');
	assert.equal(s.tips.length, 1);
	assert.equal(s.tips[0].subtitle, 'Off-screen product');
	assert.equal(s.tips[0].event, 'purchase');
	assert.equal(s.tips[0].hasDonation, undefined);
	assert.equal(s.chat.length, 0);
	const setup = await s.request('get');
	assert.equal(setup.ebay.items[1].bought, true);
	assert.equal(setup.ebay.items[0].bought, false);
	assert(!JSON.stringify(setup).includes(s.disk.monetizationPrivate.ebay.key));
	assert(!JSON.stringify(s.sent).includes(s.disk.monetizationPrivate.ebay.key));
	s.advance(61000);
	await s.request('get');
	assert.equal(s.tips.length, 1);
	await s.request('save', { config: { ebay: { enabled: true, announce: true } } });
	sales.push({ id: 'c'.repeat(64), itemId: two, paidAt: s.c.Date.now() });
	s.advance(61000);
	await s.request('get');
	assert.equal(s.tips.length, 2);
	assert.equal(s.chat.length, 1);
	s.c.isExtensionOn = false;
	const before = requests;
	s.advance(61000);
	await s.request('get');
	assert.equal(requests, before);
	await s.request('save', { config: { ebay: { enabled: false } } });
	s.c.isExtensionOn = true;
	s.advance(61000);
	await s.request('get');
	assert.equal(requests, before);
});

test('Sandbox accepts only matching auth/listing links and cannot mix a production queue', async () => {
	const s = service();
	assert(!(await s.request('ebayEnvironment', { environment: 'sandbox' })).error);
	let environment = 'sandbox', authOrigin = 'https://auth.sandbox.ebay.com';
	s.c.fetch = async endpoint => ({ ok: true, json: async () => {
		if (endpoint.endsWith('/connect')) return { environment, url: authOrigin + '/oauth2/authorize?state=fixture' };
		if (endpoint.endsWith('/status')) return { protocol: 'ssn-ebay-1', environment, connected: true };
		if (endpoint.includes('/item/')) return { id: '123456789012', name: 'Test product', amount: 10, currency: 'USD', url: 'https://www.sandbox.ebay.com/itm/123456789012' };
		throw Error('Unexpected endpoint');
	} });
	assert(!(await s.request('ebayConnect')).error);
	assert.match((await s.request('ebayAdd', { url: 'https://www.ebay.com/itm/123456789012' })).error, /matching/);
	assert(!(await s.request('ebayAdd', { url: 'https://www.sandbox.ebay.com/itm/123456789012' })).error);
	authOrigin = 'https://auth.sandbox.ebay.com.evil.test';
	assert.match((await s.request('ebayConnect')).error, /Invalid/);
	environment = 'production';
	assert.match((await s.request('ebayStatus')).error, /selected environment/);
	assert.equal(s.disk.monetizationPrivate.ebay.items.length, 1);
});

test('Switching eBay environments preserves separate products and credentials and disables the showcase', async () => {
	const s = service(), routes = [];
	s.c.fetch = async endpoint => {
		routes.push(endpoint);
		const environment = endpoint.includes('/ebay-sandbox/') ? 'sandbox' : 'production';
		return { ok: true, json: async () => endpoint.endsWith('/status')
			? { protocol: 'ssn-ebay-1', environment, connected: true }
			: { id: '123456789012', name: environment, amount: 5, currency: 'USD', url: 'https://www.' + (environment === 'sandbox' ? 'sandbox.' : '') + 'ebay.com/itm/123456789012' } };
	};
	assert(!(await s.request('ebayAdd', { url: 'https://www.ebay.com/itm/123456789012' })).error);
	const productionKey = s.disk.monetizationPrivate.ebay.key;
	await s.request('save', { config: { ebay: { enabled: true } } });
	let reply = await s.request('ebayEnvironment', { environment: 'sandbox' });
	assert.equal(reply.config.ebay.enabled, false);
	assert.equal(reply.ebay.items.length, 0);
	assert(!(await s.request('ebayAdd', { url: 'https://www.sandbox.ebay.com/itm/123456789012' })).error);
	const sandboxKey = s.disk.monetizationPrivate.ebay.key;
	assert.notEqual(sandboxKey, productionKey);
	await s.request('ebayEnvironment', { environment: 'production' });
	assert.equal(s.disk.monetizationPrivate.ebay.key, productionKey);
	assert.equal((await s.request('get')).ebay.items[0].name, 'production');
	await s.request('ebayEnvironment', { environment: 'sandbox' });
	assert.equal(s.disk.monetizationPrivate.ebay.key, sandboxKey);
	assert.equal((await s.request('get')).ebay.items[0].name, 'sandbox');
	const restarted = service(s.disk);
	assert.equal((await restarted.request('get')).ebay.environment, 'sandbox');
	assert.equal((await restarted.request('get')).ebay.items[0].name, 'sandbox');
	await restarted.request('ebayEnvironment', { environment: 'production' });
	assert.equal(restarted.disk.monetizationPrivate.ebay.key, productionKey);
	assert.equal((await restarted.request('get')).ebay.items[0].name, 'production');
	assert(routes.some(url => url.includes('/ebay-sandbox/')));
	assert(!JSON.stringify(s.sent).includes(productionKey));
	assert(!JSON.stringify(s.sent).includes(sandboxKey));
	assert.match((await s.request('ebayEnvironment', { environment: 'invalid' })).error, /Invalid/);
});

test('An unavailable eBay service cannot enable the source or overwrite other support settings', async () => {
	const s = service();
	await s.request('save', { config: { wishlist: { enabled: true, url } } });
	s.c.fetch = async () => ({ ok: false, status: 404 });
	const reply = await s.request('save', { config: { ebay: { enabled: true } } });
	assert.match(reply.error, /not available/);
	const saved = await s.request('get');
	assert.equal(saved.config.ebay.enabled, false);
	assert.equal(saved.config.wishlist.enabled, true);
	assert.equal(saved.config.wishlist.url, url);
});
