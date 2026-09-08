// Run manually: node tests/ebay-ssapp.e2e.cjs
// Uses isolated SSApp settings, synthetic eBay responses, and a private SSN session.
const { _electron } = require('playwright');
const fs = require('fs'),
	os = require('os'),
	path = require('path'),
	assert = require('assert'),
	crypto = require('crypto');
const environment = process.env.SSN_TEST_EBAY_ENVIRONMENT || 'sandbox';
const itemOrigin = environment === 'sandbox' ? 'https://www.sandbox.ebay.com' : 'https://www.ebay.com';
const root = path.resolve(__dirname, '..').replace(/\\/g, '/'),
	room = 'ebayqa' + Date.now(),
	profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-ebay-e2e-'));
fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({ streamID: room, password: 'false', state: false, settings: {}, wsServer: false }));
const ssapp = process.env.SSN_TEST_SSAPP_ROOT || path.resolve(root, '../ssapp'),
	tipServer = process.env.SSN_TEST_MONETIZATION_SERVER_ROOT || path.resolve(root, 'monetization-server');
(async () => {
	const Fastify = require(path.join(tipServer, 'node_modules/fastify'));
	const { pathToFileURL } = require('url');
	const relay = (await import(pathToFileURL(path.join(tipServer, 'ebay-showcase.js')).href)).default;
	const { fixture, order } = await import(pathToFileURL(path.join(tipServer, 'tests/ebay-fixture.js')).href);
	const Database = require(path.join(tipServer, 'node_modules/better-sqlite3'));
	const db = new Database(':memory:'),
		remote = fixture(),
		server = Fastify();
	await server.register(require(path.join(tipServer, 'node_modules/@fastify/cors')), { origin: '*' });
	await server.register(relay, { db, environment, fetch: remote.fetch, clientId: 'fixture-id', clientSecret: 'fixture-secret', ruName: 'fixture-redirect' });
	await server.listen({ host: '127.0.0.1', port: 0 });
	const port = server.server.address().port;
	const wrapper = path.join(profile, 'ssn-e2e-bootstrap.cjs');
	fs.writeFileSync(wrapper, `const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>{const h=new URL(d.url).hostname;cb({cancel:!(h==='localhost'||h==='127.0.0.1'||h==='vdo.socialstream.ninja'||h==='wss.socialstream.ninja'||h==='vdo.ninja'||h.endsWith('.vdo.ninja'))});}));require(${JSON.stringify(path.join(ssapp, 'bootstrap.js'))});`);
	const app = await _electron.launch({ executablePath: path.join(ssapp, 'node_modules/electron/dist/electron.exe'), args: [wrapper, '--running-from-source', '--multiinstance', '--ssapp-headless-control', '--filesource', 'file:///' + root + '/', '--no-hwa'], cwd: ssapp, env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_DIAGNOSTICS_SAFE_GPU: '1' } });
	try {
		const main = await app.firstWindow();
		main.setDefaultTimeout(25000);
		await main.waitForFunction(() => document.querySelector('#frame2')?.contentWindow?.handleMonetizationRequest);
		const bg = main.frames().find(f => /background\.html/.test(f.url())),
			popup = main.frames().find(f => /popup\.html/.test(f.url()));
		const request = data => popup.evaluate(data => new Promise(resolve => chrome.runtime.sendMessage(data, resolve)), data);
		const call = (action, extra = {}) => request({ cmd: 'monetization', action, ...extra });
		await bg.evaluate(port => {
			const originalFetch = fetch,
				OriginalEventSource = EventSource;
			function local(url) {
				const u = new URL(url);
				return 'http://127.0.0.1:' + port + u.pathname + u.search;
			}
			window.fetch = function (url, options) {
				return originalFetch(String(url).match(/^https:\/\/api\.socialstream\.ninja\/v1\/ebay(?:-sandbox)?\//) ? local(url) : url, options);
			};
			window.EventSource = function (url) {
				return new OriginalEventSource(String(url).match(/^https:\/\/api\.socialstream\.ninja\/v1\/ebay(?:-sandbox)?\//) ? local(url) : url);
			};
			window.capturedGifts = [];
			const originalProcess = processIncomingMessage;
			window.processIncomingMessage = function (data) {
				if (data.type === 'ebay') capturedGifts.push(data);
				return originalProcess(data);
			};
			window.capturedChat = [];
			window.sendMessageToTabs = data => capturedChat.push(data);
		}, port);
		await request({ cmd: 'setOnOffState', data: { value: true } });
		await bg.evaluate(() => initTransport(streamID, password));
		await main.locator('[data-page=streams]').click();
		await popup.evaluate(() => {
			document.getElementById('monetization-settings').open = true;
			applyPopupBeginnerMode(false);
		});
		await popup.waitForFunction(() => document.getElementById('money-current').textContent.includes('Load your wishlist'));
		await popup.locator('#money-mode').selectOption('ebay');
		await popup.locator('#money-ebay-panel > summary').click();
		await popup.evaluate(() => {
			chrome.tabs.create = options => {
				window.ebayAuthURL = options.url;
			};
		});
		await popup.locator('#money-ebay-environment').selectOption(environment);
		await popup.waitForFunction(() => !document.getElementById('monetization-settings').hasAttribute('aria-busy'));
		await popup.locator('#money-ebay-connect').click();
		await popup.waitForFunction(() => window.ebayAuthURL);
		const auth = new URL(await popup.evaluate(() => window.ebayAuthURL));
		assert.equal(auth.origin, environment === 'sandbox' ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com');
		assert.equal((await server.inject((environment === 'sandbox' ? '/v1/ebay-sandbox' : '/v1/ebay') + '/callback?state=' + auth.searchParams.get('state') + '&code=fixture')).statusCode, 200);
		for (const id of ['123456789012', '234567890123']) {
			await popup.locator('#money-ebay-url').fill(itemOrigin + '/itm/' + id);
			await popup.locator('#money-ebay-add').click();
			await popup.waitForFunction(() => document.getElementById('money-ebay-url').value === '' && !document.getElementById('monetization-settings').hasAttribute('aria-busy'));
		}
		await popup.locator('label.switch:has(#money-ebay-enabled)').click();
		await popup.locator('#money-ebay-display').selectOption('first');
		await popup.locator('#money-save').click();
		await popup.waitForFunction(() => !document.getElementById('monetization-settings').hasAttribute('aria-busy'));
		await popup.waitForFunction(() => document.getElementById('money-status').textContent === 'Saved.' && !document.getElementById('monetization-settings').hasAttribute('aria-busy'));
		assert((await call('get')).config.ebay.enabled);
		await popup.locator('label.switch:has(#money-wishlist-enabled)').click();
		await popup.locator('#money-save').click();
		await popup.waitForFunction(() => !document.getElementById('monetization-settings').hasAttribute('aria-busy'));
		const combined = (await call('get')).config;
		assert(combined.wishlist.enabled && combined.ebay.enabled, 'Platforms can run together');
		await popup.locator('#money-mode').selectOption('throne');
		assert(await popup.locator('#money-ebay-url').isVisible(), 'Overlay selection does not hide platform settings');
		await popup.locator('#money-mode').selectOption('ebay');
		const windowPromise = app.waitForEvent('window');
		await app.evaluate(({ BrowserWindow }, url) => new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { offscreen: true, backgroundThrottling: false } }).loadURL(url), 'file:///' + root + '/monetization.html?session=' + room + '&mode=ebay');
		const overlay = await windowPromise;
		await overlay.waitForFunction(() => document.getElementById('title').textContent === 'Retro handheld game console');
		assert.equal(await overlay.locator('#qr').getAttribute('title'), itemOrigin + '/itm/123456789012');
		assert((await overlay.locator('#detail').textContent()).includes('32.50'));
		if (environment === 'sandbox') assert((await overlay.locator('#badge').textContent()).includes('Sandbox'));
		const timer = await overlay.locator('#footer').textContent();
		await overlay.waitForTimeout(1200);
		assert.notEqual(await overlay.locator('#footer').textContent(), timer);
		await overlay.screenshot({ path: path.join(os.tmpdir(), 'ssn-ebay-auction.png'), omitBackground: true });
		await popup.locator('#money-ebay-display').selectOption('cheapest');
		await popup.locator('#money-save').click();
		await popup.waitForFunction(() => !document.getElementById('monetization-settings').hasAttribute('aria-busy'));
		await overlay.waitForFunction(() => document.getElementById('title').textContent === 'Cozy studio light');
		await popup.locator('#money-ebay-display').selectOption('cycle');
		await popup.locator('#money-ebay-seconds').fill('10');
		await popup.locator('#money-save').click();
		await popup.waitForFunction(() => !document.getElementById('monetization-settings').hasAttribute('aria-busy'));
		await overlay.waitForTimeout(500);
		const cycled = await overlay.locator('#title').textContent();
		await overlay.waitForFunction(title => document.getElementById('title').textContent !== title, cycled, { timeout: 15000 });
		await popup.locator('#money-ebay-display').selectOption('first');
		await popup.locator('#money-save').click();
		await popup.waitForFunction(() => !document.getElementById('monetization-settings').hasAttribute('aria-busy'));
		await overlay.waitForFunction(() => document.getElementById('title').textContent === 'Retro handheld game console');
		await popup.locator('#money-ebay-display').selectOption('cheapest');
		await popup.locator('#money-save').click();
		await popup.waitForFunction(() => !document.getElementById('monetization-settings').hasAttribute('aria-busy'));
		await overlay.waitForFunction(() => document.getElementById('title').textContent === 'Cozy studio light');
		remote.orders = [order()];
		remote.bid = 40;
		console.log('Waiting for the normal 60-second sales poll...');
		await overlay.waitForFunction(() => document.getElementById('title').textContent === 'Purchased: Cozy studio light', null, { timeout: 75000 });
		console.log('Paid sale appeared.');
		await overlay.screenshot({ path: path.join(os.tmpdir(), 'ssn-ebay-purchase.png'), omitBackground: true });
		assert.equal(await bg.evaluate(() => capturedGifts.length), 1);
		assert.equal(await bg.evaluate(() => capturedGifts[0].hasDonation), undefined);
		assert.equal(await bg.evaluate(() => capturedChat.length), 0);
		assert.equal((await call('get')).ebay.items[1].bought, true);
		await overlay.waitForFunction(() => document.getElementById('title').textContent === 'Retro handheld game console');
		assert((await overlay.locator('#detail').textContent()).includes('40.00'));
		await bg.evaluate(() => {
			const now = Date.now;
			Date.now = () => now() + 61000;
		});
		await main.waitForTimeout(1600);
		await call('get');
		assert.equal(await bg.evaluate(() => capturedGifts.length), 1);
		await popup.locator('#money-ebay-panel details > summary').click();
		await popup.locator('#money-ebay-position').selectOption('tl');
		await popup.locator('label.switch:has(#money-ebay-qr)').click();
		await popup.locator('#money-save').click();
		await popup.waitForFunction(() => !document.getElementById('monetization-settings').hasAttribute('aria-busy'));
		await overlay.waitForFunction(() => document.body.classList.contains('tl') && document.getElementById('qr').hidden);
		assert(await overlay.locator('#support-card').isVisible());
		await popup.locator('label.switch:has(#money-ebay-qr)').click();
		await popup.locator('#money-save').click();
		await popup.waitForFunction(() => !document.getElementById('monetization-settings').hasAttribute('aria-busy'));
		await overlay.waitForFunction(() => !document.getElementById('qr').hidden);
		await overlay.setViewportSize({ width: 390, height: 600 });
		assert(await overlay.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		await overlay.screenshot({ path: path.join(os.tmpdir(), 'ssn-ebay-mobile.png'), omitBackground: true });
		await popup.locator('#monetization-settings').evaluate(e => e.scrollIntoView({ block: 'start' }));
		await app.evaluate(({ BrowserWindow }, url) => {
			const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === url);
			w.webContents.setBackgroundThrottling(false);
			w.setSize(1584, 1400);
		}, main.url());
		await main.waitForTimeout(500);
		const png = await app.evaluate(
			async ({ BrowserWindow }, url) =>
				(
					await BrowserWindow.getAllWindows()
						.find(w => w.webContents.getURL() === url)
						.webContents.capturePage()
				)
					.toPNG()
					.toString('base64'),
			main.url()
		);
		fs.writeFileSync(path.join(os.tmpdir(), 'ssn-ebay-popup.png'), Buffer.from(png, 'base64'));
		await popup.locator('#money-ebay-disconnect').click();
		await overlay.locator('#support-card').waitFor({ state: 'hidden' });
		assert.equal((await call('get')).config.ebay.enabled, false);
		assert.equal(db.prepare('SELECT count(*) AS n FROM ebay_connections').get().n, 0);
		console.log('PASS: actual SSApp connection UI and callback, add products, first/cheapest/cycle, auction price/countdown, off-screen paid sale, deduplication, QR, mobile, corner, no-QR card, disconnect and no unsolicited chat.');
	} catch (error) {
		console.log(
			'Diagnostic API paths:',
			remote.calls.map(c => c.url.pathname + c.url.search)
		);
		const main = await app.firstWindow();
		console.log(
			'Diagnostic state:',
			await main.evaluate(async () => {
				const b = document.querySelector('#frame2').contentWindow;
				return { on: b.isExtensionOn, gifts: b.capturedGifts, setup: await b.handleMonetizationRequest({ action: 'get' }) };
			})
		);
		throw error;
	} finally {
		await app.close();
		await server.close();
		db.close();
	}
})().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
