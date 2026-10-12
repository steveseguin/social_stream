'use strict';

// Real SSApp source window -> IPC/background -> local relay -> dock.
// Synthetic chat events only; no accounts or live channels are used.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { createRequire } = require('module');
const sourceRoot = path.resolve(__dirname, '..');
const appRoot = path.resolve(process.env.SSAPP_REPO || path.join(sourceRoot, '../ssapp'));
const appRequire = createRequire(path.join(appRoot, 'package.json'));
const { chromium } = appRequire('playwright-core');
const { linuxLaunchArgs } = appRequire('./tests/electron/helpers/electron-launch');
const base = pathToFileURL(sourceRoot + path.sep).href;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="#53fc18" d="M1 1h18v18H1z"/><path fill="#111" d="M5 5h3v4l4-4h4l-5 5 5 5h-4l-4-4v4H5z"/></svg>';

async function freePort() {
	const server = net.createServer();
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	const port = server.address().port;
	await new Promise(resolve => server.close(resolve));
	return port;
}
async function until(check, name, timeout = 45000) {
	const end = Date.now() + timeout;
	let last;
	while (Date.now() < end) {
		try { const value = await check(); if (value) return value; } catch (error) { last = error; }
		await delay(250);
	}
	throw new Error(`Timed out: ${name} ${last || ''}`);
}

(async () => {
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssapp-kick-badge-e2e-'));
	const room = 'badge_fixture_' + Date.now();
	const debugPort = await freePort();
	const relayPort = await freePort();
	const assets = http.createServer((req, res) => res.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end(svg));
	await new Promise(resolve => assets.listen(0, '127.0.0.1', resolve));
	const imageUrl = `http://127.0.0.1:${assets.address().port}/badge.svg`;
	const instrumentedSource = path.join(profile, 'kick-badge-source.js');
	fs.writeFileSync(instrumentedSource, fs.readFileSync(path.join(sourceRoot, 'sources/websocket/kick.js'), 'utf8') + `
window.__badgeFixture = {
  ready: () => extensionInitialized,
  coreReady: () => kickCoreReady,
  status: (status) => {
    state.socket.status = status;
    state.socket.pusherStatus = status;
    state.bridge.status = 'disconnected';
    state.tokens = null;
    updateSocketState({ error: status === 'error' ? 'Fixture connection lost' : '' });
    updateAuthStatus();
    updateBridgeState();
  },
  forward: forwardChatMessage,
  push: pushMessage,
  fallback: () => { mapBadges = undefined; formatBadgesForDisplay = undefined; applyKickCoreFallbacks(); }
};`);
	fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({
		streamID: room, password: 'false', state: true,
		settings: { server2: { setting: true } }, wsServer: true,
	}));
	const child = spawn(appRequire('electron'), ['.', '--running-from-source', '--multiinstance',
		`--filesource=${base}`, `--remote-debugging-port=${debugPort}`,
		`--ssapp-local-server-port=${relayPort}`, '--disable-logs', ...linuxLaunchArgs()], {
		cwd: appRoot, env: { ...process.env, SSAPP_USER_DATA_DIR: profile }, windowsHide: true, stdio: 'ignore',
	});
	let browser;
	try {
		browser = await until(() => chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`), 'Electron');
		const pages = () => browser.contexts().flatMap(context => context.pages());
		const main = await until(() => pages().find(page => page.url().includes('/index.html')), 'main');
		await until(() => main.evaluate(() => typeof configReady !== 'undefined' && configReady), 'configuration');
		await main.evaluate(() => { window.__kickStatuses = []; ipcRenderer.on('wssStatus', (_event, value) => window.__kickStatuses.push(value)); });
		const createWindow = args => main.evaluate(value => {
			if (value.wss) {
				let conf = { ...config.global, ...config.kick };
				if (conf.wss) conf = { ...conf, ...conf.wss };
				value.config = conf;
				value.configs = config;
			}
			return ipcRenderer.sendSync('createWindow', value);
		}, args);
		await createWindow({ url: `${base}dock.html?session=${room}&password=false&server2&localserver&localserverport=${relayPort}&ln=en-us&color&alignbottom`, visible: true });
		const dock = await until(() => pages().find(page => page.url().includes('/dock.html')), 'dock');
		const cdp = await dock.context().newCDPSession(dock);
		const inspectDock = async (fn, arg) => {
			const result = await cdp.send('Runtime.evaluate', { expression: `(${fn})(${JSON.stringify(arg)})`, awaitPromise: true, returnByValue: true });
			if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
			return result.result.value;
		};
		await cdp.send('Emulation.setDeviceMetricsOverride', { width: 800, height: 650, deviceScaleFactor: 1, mobile: false });
		await until(() => inspectDock(() => typeof socketserverExtension !== 'undefined' && socketserverExtension?.readyState === 1), 'dock relay');
		await createWindow({ url: `${base}sources/websocket/kick.html?ssapp=1`, visible: true, wss: true, platform: 'kick', source: instrumentedSource, filesource: base });
		const kick = await until(() => pages().find(page => page.url().includes('/websocket/kick.html')), 'Kick window');
		kick.on('pageerror', error => console.log('Kick page:', error.message));
		await until(() => kick.evaluate(() => window.__badgeFixture?.ready()), 'Kick initialization');
		await kick.evaluate(() => window.__badgeFixture.coreReady());
		await until(async () => {
			const frame = main.frames().find(frame => frame.url().includes('/background.html'));
			return frame && await frame.evaluate(() => typeof socketserverDock !== 'undefined' && socketserverDock?.readyState === 1);
		}, 'background relay');
		for (const status of ['connected', 'error', 'connecting', 'connected']) {
			await kick.evaluate(status => window.__badgeFixture.status(status), status);
			await until(() => main.evaluate(status => window.__kickStatuses.at(-1)?.status === status, status), 'app transport status ' + status);
		}
		await kick.evaluate(() => window.__badgeFixture.status('disconnected'));
		for (const phase of ['normal', 'reload', 'fallback']) {
			if (phase === 'reload') {
				await kick.reload();
				await until(() => kick.evaluate(() => window.__badgeFixture?.ready()), 'reloaded Kick');
				await kick.evaluate(() => window.__badgeFixture.coreReady());
			}
			if (phase === 'fallback') {
				await kick.evaluate(() => { window.__badgeFixture.fallback(); });
			}
			await kick.evaluate(async ({ phase, imageUrl, svg }) => {
				const cases = [
					['Image', [{ image: imageUrl, svg, text: 'VIP' }, { type: 'svg', html: svg, text: 'Subscriber' }, { text: 'Subscriber 12 months' }]],
					['Roles', ['Subscriber', 'VIP', 'Moderator', 'Founder', 'Verified channel', 'Sub Gifter'].map(text => ({ text }))],
					['Order', [{ type: 'subscriber', text: 'Subscriber', sort_order: 2 }, { type: 'vip', active: false }], [{ name: 'level', image_url: imageUrl, sort_order: 1, selected: true }]],
					['Labels', [{ text: 'VIP' }, { text: 'Subscriber' }, { name: 'Older badge label' }]],
				];
				for (const [label, badges, badges_v2] of cases) {
					await window.__badgeFixture.forward({ id: `${phase}-${label}`, content: 'Badge alignment example', sender: {
						username: `${phase} ${label}`, profile_picture: imageUrl, identity: { badges, badges_v2 },
					} });
				}
				await window.__badgeFixture.forward({ id: `${phase}-Cleared`, content: 'Cleared badge selection', sender: {
					username: `${phase} Order`, identity: { badges: [], badges_v2: [] },
				} });
				window.__badgeFixture.push({ type: 'kick', chatname: `${phase} Legacy`, chatmessage: 'Older text badge payload', chatbadges: [{ type: 'badge', text: 'VIP' }, { type: 'badge', text: 'Subscriber 12 months' }], textonly: false });
			}, { phase, imageUrl, svg });
			await until(() => inspectDock(phase => [...document.querySelectorAll('.highlight-chat')].filter(row => row.textContent.includes(phase)).length >= 6, phase), 'dock messages');
		}
		const measurements = [];
		for (const width of [360, 800, 1280]) {
			await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 650, deviceScaleFactor: 1, mobile: false });
			await inspectDock(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
			const metrics = await inspectDock(() => [...document.querySelectorAll('.highlight-chat')].map(row => ({
				text: row.textContent,
				badges: [...row.querySelectorAll('.hl-badge')].map(b => {
					const r = b.getBoundingClientRect();
					return { tag: b.tagName, text: b.textContent, svg: !!b.querySelector('svg'), loaded: b.tagName !== 'IMG' || b.naturalWidth > 0,
						center: r.y + r.height / 2, height: r.height, width: r.width, scrollWidth: b.scrollWidth, whiteSpace: getComputedStyle(b).whiteSpace };
				}),
			})));
			assert.strictEqual(metrics.length, 18);
			for (const row of metrics) {
				if (row.text.includes('Cleared badge selection')) {
					assert.strictEqual(row.badges.length, 0, 'cleared selection must not reuse cached badges');
					continue;
				}
				assert.ok(row.badges.every(b => b.loaded), 'image assets load');
				assert.ok(Math.max(...row.badges.map(b => b.center)) - Math.min(...row.badges.map(b => b.center)) <= 3, 'badges align: ' + JSON.stringify(row));
				for (const b of row.badges.filter(b => b.text)) assert.strictEqual(b.whiteSpace, 'nowrap');
				if (row.text.includes(' Image')) {
					assert.strictEqual(row.badges[0].tag, 'IMG');
					assert.strictEqual(row.badges[1].svg, true);
					assert.strictEqual(row.badges[2].text, 'Subscriber 12 months');
				}
				if (row.text.includes(' Roles')) {
					assert.strictEqual(row.badges.length, 6);
					assert.ok(row.badges.every(b => b.svg && b.height === 20));
				}
				if (row.text.includes(' Order')) {
					assert.strictEqual(row.badges.length, 2);
					assert.strictEqual(row.badges[0].tag, 'IMG');
					assert.strictEqual(row.badges[1].svg, true);
					assert.strictEqual(row.badges[0].height, row.badges[1].height);
				}
				if (row.text.includes(' Legacy')) assert.strictEqual(row.badges.length, 2);
			}
			measurements.push({ width, rows: metrics });
			await dock.screenshot({ path: path.join(profile, `badges-${width}.png`) });
		}
		await cdp.send('Emulation.setDeviceMetricsOverride', { width: 800, height: 650, deviceScaleFactor: 1, mobile: false });
		await dock.screenshot({ path: path.join(profile, 'badges-after.png') });
		await inspectDock(() => {
			const style = document.createElement('style'); style.id = 'old-badge-style';
			style.textContent = '.hl-badge.textbadge,.hl-firstline .hl-name .hl-badge.textbadge{display:inline-block;vertical-align:baseline;line-height:inherit;white-space:normal;overflow-wrap:inherit;max-width:100px;flex-shrink:1}';
			document.head.appendChild(style);
		});
		await dock.screenshot({ path: path.join(profile, 'badges-before.png') });
		await inspectDock(() => document.getElementById('old-badge-style').remove());
		fs.writeFileSync(path.join(profile, 'report.json'), JSON.stringify(measurements, null, 2));
		console.log(`PASS: 18 messages through SSApp, transport status, reload and fallback at 360/800/1280px; evidence: ${profile}`);
	} finally {
		if (browser) await browser.close().catch(() => {});
		child.kill(); assets.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
