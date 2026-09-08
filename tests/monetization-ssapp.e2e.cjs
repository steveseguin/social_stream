// Run manually: node tests/monetization-ssapp.e2e.cjs
// Uses isolated SSApp settings, signed synthetic gifts, and a private SSN session.
const { _electron } = require('playwright');
const fs = require('fs'),
	os = require('os'),
	path = require('path'),
	assert = require('assert'),
	crypto = require('crypto');
const root = path.resolve(__dirname, '..').replace(/\\/g, '/'),
	room = 'throneqa' + Date.now(),
	profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-throne-e2e-'));
fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({ streamID: room, password: 'false', state: false, settings: {}, wsServer: false }));
const ssapp = process.env.SSN_TEST_SSAPP_ROOT || path.resolve(root, '../ssapp'),
	tipServer = process.env.SSN_TEST_MONETIZATION_SERVER_ROOT || path.resolve(root, 'monetization-server');
(async () => {
	const Fastify = require(path.join(tipServer, 'node_modules/fastify'));
	const relay = (await import(require('url').pathToFileURL(path.join(tipServer, 'throne-relay.js')).href)).default;
	const pair = crypto.generateKeyPairSync('ed25519'),
		server = Fastify();
	await server.register(relay, { publicKey: pair.publicKey });
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
				return originalFetch(String(url).startsWith('https://api.socialstream.ninja/v1/throne/') ? local(url) : url, options);
			};
			window.EventSource = function (url) {
				return new OriginalEventSource(String(url).startsWith('https://api.socialstream.ninja/v1/throne/') ? local(url) : url);
			};
			window.capturedGifts = [];
			const originalProcess = processIncomingMessage;
			window.processIncomingMessage = function (data) {
				if (data.type === 'throne') capturedGifts.push(data);
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
		await popup.locator('#money-mode').selectOption('throne');
		await popup.locator('#money-throne-panel > summary').click();
		await popup.locator('#money-throne-username').fill('creator');
		await popup.locator('label.switch:has(#money-throne-enabled)').click();
		await popup.locator('#money-save').click();
		await popup.waitForFunction(() => document.getElementById('money-status').textContent === 'Saved.');
		let setup = await call('get');
		assert(setup.throne.webhook);
		assert(!setup.error);
		assert(!JSON.stringify(setup).includes('"key":'));
		assert((await popup.locator('#money-overlay').getAttribute('href')).includes('mode=throne'));
		const windowPromise = app.waitForEvent('window');
		await app.evaluate(({ BrowserWindow }, url) => new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { offscreen: true, backgroundThrottling: false } }).loadURL(url), 'file:///' + root + '/monetization.html?session=' + room + '&mode=throne');
		const overlay = await windowPromise;
		await overlay.waitForLoadState();
		await overlay.locator('#support-card').waitFor({ state: 'visible', timeout: 25000 });
		assert.equal(await overlay.locator('#qr').getAttribute('title'), 'https://throne.com/creator');
		await overlay.screenshot({ path: path.join(os.tmpdir(), 'ssn-throne-card.png'), omitBackground: true });
		const event = { contract_version: '1', event_id: 'qa-purchase', event_type: 'gift_purchased', data: { creator_id: 'qa-creator', creator_username: 'creator', gifter_username: 'Anonymous', item_name: 'A studio light for cozy evenings', price: 2499, currency: 'USD' } };
		async function send(value, invalid = false) {
			const body = Buffer.from(JSON.stringify(value)),
				timestamp = String(Math.floor(Date.now() / 1000)),
				signature = crypto.sign(null, Buffer.concat([Buffer.from(timestamp + '.'), body]), pair.privateKey).toString('hex');
			return server.inject({ method: 'POST', url: new URL(setup.throne.webhook).pathname, headers: { 'content-type': 'application/json', 'x-signature-timestamp': timestamp, 'x-signature-ed25519': invalid ? '0'.repeat(128) : signature }, payload: body });
		}
		assert.equal((await send(event, true)).statusCode, 401);
		assert.equal((await call('get')).throne.gifts, 0);
		assert.equal((await send(event)).statusCode, 200);
		await overlay.waitForFunction(() => document.getElementById('title').textContent === 'Anonymous sent a gift');
		await overlay.screenshot({ path: path.join(os.tmpdir(), 'ssn-throne-gift.png'), omitBackground: true });
		assert.equal((await call('get')).throne.gifts, 1);
		await send(event);
		await main.waitForTimeout(200);
		assert.equal((await call('get')).throne.gifts, 1);
		await send({ ...event, event_id: 'qa-contribution', event_type: 'contribution_purchased', data: { ...event.data, amount: 500 } });
		await bg.waitForFunction(() => capturedGifts.length === 2);
		assert.equal((await call('get')).throne.gifts, 1);
		await send({ ...event, event_id: 'qa-funded', event_type: 'gift_crowdfunded' });
		await bg.waitForFunction(() => capturedGifts.length === 3);
		assert.equal((await call('get')).throne.gifts, 2);
		assert.equal(await bg.evaluate(() => capturedGifts[2].hasDonation), undefined);
		assert.equal(await bg.evaluate(() => capturedChat.length), 0);
		await popup.locator('#money-save').click();
		await popup.waitForFunction(() => document.getElementById('money-throne-rank').textContent.includes('Rank 3'));
		await main.waitForTimeout(250);
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
		fs.writeFileSync(path.join(os.tmpdir(), 'ssn-throne-popup.png'), Buffer.from(png, 'base64'));
		await popup.locator('#money-throne-panel .popup-subsection > summary').click();
		await popup.locator('#money-throne-position').selectOption('tl');
		await popup.locator('#money-save').click();
		await overlay.waitForFunction(() => document.body.classList.contains('tl'));
		await overlay.setViewportSize({ width: 390, height: 600 });
		assert(await overlay.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		await overlay.screenshot({ path: path.join(os.tmpdir(), 'ssn-throne-mobile.png'), omitBackground: true });
		await popup.locator('#money-throne-reset').click();
		await popup.waitForFunction(() => document.getElementById('money-throne-rank').textContent.includes('Rank 1'));
		assert.equal((await call('get')).throne.gifts, 0);
		await popup.locator('label.switch:has(#money-throne-enabled)').click();
		await popup.locator('#money-save').click();
		await overlay.locator('#support-card').waitFor({ state: 'hidden' });
		console.log('PASS: actual SSApp UI, signed webhook to SSE to SSN to overlay, invalid signature rejection, duplicate suppression, gift/contribution ranks, no double-counted income, QR targets, corner, reset, disable, no default chat sends.');
	} finally {
		await app.close();
		await server.close();
	}
})().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
