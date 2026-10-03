'use strict';

// Isolated SSApp profile and local relay. Default cases use fixtures only.
// SSAPP_TIKFINITY_FEED_URL opts into read-only capture from a connected account's
// Activity Feed, including reload, Stop and restart. Never sends chat or gifts.
const assert = require('assert');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { _electron } = require('playwright');
const root = path.resolve(__dirname, '..');
const ssapp = process.env.SSAPP_REPO || path.resolve(root, '../ssapp');
const WebSocket = require(path.join(ssapp, 'node_modules/ws'));
const feedHost = '44d4d505-b6f1-46fe-94e3-8b61a456f875.tikfinity-browser-source.com';

async function freePort() {
	const server = net.createServer();
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	const port = server.address().port;
	await new Promise(resolve => server.close(resolve));
	return port;
}

async function waitFor(check, label) {
	const until = Date.now() + 30000;
	while (Date.now() < until) {
		const value = await check();
		if (value) return value;
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	throw new Error('Timed out: ' + label);
}

async function run() {
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssapp-tikfinity-domains-'));
	const room = 'tikfinity_domains_' + Date.now();
	const controlPort = await freePort();
	const relayPort = await freePort();
	fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({
		streamID: room, password: 'false', state: true,
		settings: { server2: { setting: true }, capturejoinedevent: { setting: true } }, wsServer: true
	}));
	const app = await _electron.launch({
		executablePath: require(path.join(ssapp, 'node_modules/electron')),
		args: [ssapp, '--running-from-source', '--multiinstance', '--ssapp-headless-control',
			'--ssapp-control-api', '--ssapp-control-port=' + controlPort,
			'--ssapp-local-server-port=' + relayPort, '--no-hwa',
			'--filesource', pathToFileURL(root + path.sep).href],
		cwd: ssapp,
		env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_DIAGNOSTICS_SAFE_GPU: '1' }
	});
	let socket;
	async function command(action, value) {
		const result = await fetch('http://127.0.0.1:' + controlPort + '/api/v1/command', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, value })
		}).then(r => r.json());
		assert.ok(result.ok, JSON.stringify(result));
		return result.payload;
	}
	try {
		const main = await app.firstWindow();
		await main.waitForFunction(() => window.stateManager && stateManager.initialized && configReady);
		const received = [];
		socket = new WebSocket('ws://127.0.0.1:' + relayPort);
		await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
		socket.send(JSON.stringify({ join: room, out: 3, in: 4 }));
		socket.on('message', raw => received.push(JSON.parse(raw.toString())));
		if (process.env.SSAPP_TIKFINITY_FEED_URL) {
			const url = new URL(process.env.SSAPP_TIKFINITY_FEED_URL);
			assert.ok(['tikfinity.zerody.one', 'widgets.tikfinity.com'].includes(url.hostname));
			const added = await command('addSource', { target: 'other', url: url.href, isVisible: false, isMuted: true });
			assert.strictEqual(added.source.target, 'tikfinity');
			await command('startSource', { sourceId: added.source.id });
			const frame = await waitFor(() => app.windows().flatMap(p => p.frames()).find(f =>
				f.url().includes(feedHost) || f.url().includes('/widget/vite/src/activity-feed/')), 'live Activity Feed iframe');
			await frame.waitForFunction(() => window.__socialStreamTikfinityInjected === true);
			await waitFor(() => received.some(m => m.type === 'tiktok' && !m.event && m.chatmessage), 'live Activity Feed chat');
			const counts = () => received.filter(m => m.type === 'tiktok').reduce((all, m) => {
				const kind = m.hasDonation ? 'gift' : m.event || 'chat';
				all[kind] = (all[kind] || 0) + 1;
				return all;
			}, {});
			await main.waitForTimeout(60000);
			const beforeReload = received.length;
			await frame.page().reload();
			await waitFor(() => received.slice(beforeReload).some(m => m.type === 'tiktok' && !m.event && m.chatmessage), 'fresh feed chat after reload');
			await command('stopSource', { sourceId: added.source.id });
			await main.waitForTimeout(1000);
			const stopped = received.length;
			await main.waitForTimeout(5000);
			assert.strictEqual(received.length, stopped, 'Activity Feed continued after Stop');
			await command('startSource', { sourceId: added.source.id });
			await waitFor(() => received.slice(stopped).some(m => m.type === 'tiktok' && !m.event && m.chatmessage), 'fresh feed chat after restart');
			await command('stopSource', { sourceId: added.source.id });
			const report = { complete: true, feedOrigin: new URL(frame.url()).origin, counts: counts(), reload: true, stop: true, restart: true };
			fs.writeFileSync(path.join(profile, 'live-report.json'), JSON.stringify(report, null, 2));
			console.log(JSON.stringify(report));
			console.log('Evidence: ' + profile);
			return;
		}
		for (const current of [false, true]) {
			const url = current ? 'https://widgets.tikfinity.com/ssn-local-fixture'
				: 'https://tikfinity.zerody.one/widget/activity-feed?cid=ssn-local-fixture&did=1';
			const frameUrl = current ? 'https://' + feedHost + '/1.0.0/index.html'
				: 'https://tikfinity.zerody.one/widget/vite/src/activity-feed/?dockId=1';
			// Only the account-connected shell is replaced. Load the real public widget.
			await main.context().route(url, route => route.fulfill({ contentType: 'text/html',
				body: '<html><body><iframe src="' + frameUrl + '"></iframe></body></html>' }));
			const added = await command('addSource', { target: 'other', url, isVisible: false, isMuted: true });
			assert.strictEqual(added.source.target, 'tikfinity');
			await command('startSource', { sourceId: added.source.id });
			const frame = await waitFor(() => app.windows().flatMap(p => p.frames())
				.find(f => f.url() === frameUrl), 'Activity Feed iframe');
			await frame.waitForFunction(() => window.__socialStreamTikfinityInjected === true);
			const parent = frame.parentFrame();
			assert.strictEqual(await parent.evaluate(() => !!window.__socialStreamTikfinityInjected), false);
			const viewer = { tiktokUsername: 'ssn_fixture', tiktokNickname: current ? 'New feed' : 'Old feed',
				tiktokUserId: '123', tiktokThumbnailUrl: '' };
			const post = message => frame.evaluate(data => window.postMessage(data, '*'), message);
			await post(current ? { type: 'stream_event', payload: { type: 'chat', payload: {
				viewer, content: 'Domain test <hello> & [wow]', emotes: []
			} } } : { type: 'chat', payload: { nickname: viewer.tiktokNickname, uniqueId: 'ssn_fixture',
				comment: 'Domain test <hello> & [wow]', msgId: 'legacy-chat' } });
			const chat = await waitFor(() => received.find(m => m.chatname === viewer.tiktokNickname), 'chat at relay');
			assert.strictEqual(chat.type, 'tiktok');
			assert.ok(chat.chatmessage.includes('&lt;hello&gt; &amp;'));
			assert.ok(chat.chatmessage.includes('tikfinity-emote'));
			if (current) {
				for (const type of ['gift', 'follow', 'share', 'subscribe', 'member', 'envelope']) {
					await post({ type: 'stream_event', payload: { type, payload: { viewer,
						giftId: '1', giftName: 'Rose', imageUrl: '', repeatCount: 3,
						diamondCount: 2, groupId: '42', peopleCount: 4 } } });
				}
				await waitFor(() => received.filter(m => m.chatname === 'New feed').length === 7, 'new feed events');
				assert.deepStrictEqual(received.filter(m => m.chatname === 'New feed' && m.event)
					.map(m => m.event).sort(), ['envelope', 'followed', 'gift', 'joined', 'shared', 'subscribe']);
				const gift = received.find(m => m.chatname === 'New feed' && m.event === 'gift');
				assert.strictEqual(gift.meta.repeatCount, 3);
				assert.match(gift.hasDonation, /6/);
				await post({ type: 'stream_event', payload: null });
				await post({ type: 'stream_event', payload: { type: 'unknown', payload: { viewer } } });
				await post({ type: 'initialize', payload: { userId: '123' } });
				await new Promise(resolve => setTimeout(resolve, 500));
				assert.strictEqual(received.filter(m => m.chatname === 'New feed').length, 7);
			}
			await command('stopSource', { sourceId: added.source.id });
			console.log('PASS ' + (current ? 'current feed chat, gifts and events' : 'legacy feed chat'));
		}
	} finally {
		if (socket) socket.close();
		await app.close();
	}
}

run().catch(error => { console.error(error); process.exitCode = 1; });
