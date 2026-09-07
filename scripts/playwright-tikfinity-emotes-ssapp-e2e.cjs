'use strict';

// Real SSApp source window, TikFinity iframe, background pipeline, and chat dock.
// Controlled input is posted locally into the widget; nothing is sent to live chat.
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

async function freePort() {
	const server = net.createServer();
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	const port = server.address().port;
	await new Promise(resolve => server.close(resolve));
	return port;
}

async function waitFor(check, label, timeout = 30000) {
	const until = Date.now() + timeout;
	while (Date.now() < until) {
		const result = await check();
		if (result) return result;
		await new Promise(resolve => setTimeout(resolve, 150));
	}
	throw new Error('Timed out: ' + label);
}

async function run() {
	const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssapp-tikfinity-emotes-'));
	const room = 'tikfinity_emotes_' + Date.now();
	const controlPort = await freePort();
	const relayPort = await freePort();
	fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({
		streamID: room, password: 'false', state: true,
		settings: { server2: { setting: true } }, wsServer: true,
	}));
	const app = await _electron.launch({
		executablePath: require(path.join(ssapp, 'node_modules/electron')),
		args: [ssapp, '--running-from-source', '--multiinstance', '--ssapp-headless-control',
			'--ssapp-control-api', '--ssapp-control-port=' + controlPort,
			'--ssapp-local-server-port=' + relayPort, '--no-hwa',
			'--filesource', pathToFileURL(root + path.sep).href],
		cwd: ssapp,
		env: { ...process.env, SSAPP_USER_DATA_DIR: profile, SSAPP_DIAGNOSTICS_SAFE_GPU: '1' },
	});
	let socket;
	const command = async (action, value = {}) => {
		const response = await fetch('http://127.0.0.1:' + controlPort + '/api/v1/command', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, value }),
		});
		const result = await response.json();
		assert.ok(result.ok, JSON.stringify(result));
		return result.payload;
	};
	try {
		const main = await app.firstWindow();
		await main.waitForFunction(() => window.stateManager && stateManager.initialized && configReady);
		const capability = await fetch('http://127.0.0.1:' + controlPort + '/api/v1/capabilities').then(r => r.json());
		assert.ok(capability.ok);
		const received = [];
		socket = new WebSocket('ws://127.0.0.1:' + relayPort);
		await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
		socket.send(JSON.stringify({ join: room, out: 3, in: 4 }));
		socket.on('message', raw => {
			const message = JSON.parse(raw.toString());
			if (message.type === 'tiktok') received.push(message);
		});
		const added = await command('addSource', {
			target: 'other', url: 'https://tikfinity.zerody.one/widget/activity-feed?did=1',
			isVisible: false, isMuted: true,
		});
		await command('startSource', { sourceId: added.source.id });
		const getFrame = () => app.windows().flatMap(page => page.frames())
			.find(frame => frame.url().includes('/widget/vite/src/activity-feed/'));
		let frame = await waitFor(getFrame, 'TikFinity iframe');
		await frame.waitForFunction(() => window.__socialStreamTikfinityInjected === true);
		const dockId = await app.evaluate(async ({ BrowserWindow }, url) => {
			const win = new BrowserWindow({ show: false, width: 900, height: 650,
				webPreferences: { backgroundThrottling: false } });
			await win.loadURL(url);
			return win.id;
		}, pathToFileURL(path.join(root, 'dock.html')).href + '?session=' + room +
			'&password=false&server2&localserver=&localserverport=' + relayPort);
		await new Promise(resolve => setTimeout(resolve, 2500));
		let sequence = 0;
		async function send(comment, emotes = []) {
			const nickname = 'Emote diagnostic ' + (++sequence);
			await frame.evaluate(payload => window.postMessage({ type: 'chat', payload }, '*'), {
				nickname, uniqueId: 'emote_diagnostic_' + sequence, userBadges: [],
				comment, emotes, createTime: String(Date.now()),
			});
			return waitFor(() => received.find(message => message.chatname === nickname), 'outgoing ' + nickname);
		}
		const examples = await send('[laughcry][wow][congrat][congrat]');
		assert.strictEqual((examples.chatmessage.match(/<img /g) || []).length, 4);
		assert.strictEqual(examples.textonly, false);
		const names = ['wow', 'laugh', 'thanks', 'laughcry', 'thumb', 'hi', 'heart', 'congrat',
			'rockyserious', 'rockyloveit', 'rockyproud', 'rockycool', 'rosiedislike', 'rosieawkward',
			'rosiekisskiss', 'rosiecute', 'jolliekissingface', 'jolliewow', 'jolliespeechless',
			'jolliesatisfied', 'sagethink', 'sagefulfilled', 'sageclever', 'sagemoney',
			'smile', 'happy', 'angry', 'cry', 'embarrassed', 'surprised', 'wronged', 'shout',
			'flushed', 'yummy', 'complacent', 'drool', 'scream', 'weep', 'speechless', 'funnyface',
			'laughwithtears', 'wicked', 'facewithrollingeyes', 'sulk', 'thinking', 'lovely',
			'greedy', 'joyful', 'hehe', 'slap', 'tears', 'stun', 'cute', 'blink', 'disdain',
			'astonish', 'rage', 'cool', 'excited', 'proud', 'smileface', 'evil', 'angel',
			'pride', 'nap', 'loveface', 'awkward', 'shock'];
		const all = await send(names.map(name => '[' + name + ']').join(' '));
		assert.strictEqual((all.chatmessage.match(/<img /g) || []).length, names.length);
		const imageUrl = examples.chatmessage.match(/src="([^"]+)"/)[1];
		const mixed = await send('A [laughcry] B [wow] C', [{
			placeInComment: 14, emoteImageUrl: imageUrl, emoteId: '[congrat]',
		}]);
		assert.strictEqual((mixed.chatmessage.match(/<img /g) || []).length, 3);
		assert.ok(mixed.chatmessage.includes('alt="[congrat]"'), 'Do not rewrite supplied image attributes');
		assert.ok(mixed.chatmessage.indexOf(' B') < mixed.chatmessage.indexOf('alt="[congrat]"'));
		const unknown = await send('<script>alert(1)</script> [notanemoji] [constructor] & " [wow]');
		assert.ok(unknown.chatmessage.includes('&lt;script&gt;'));
		assert.ok(unknown.chatmessage.includes('[notanemoji] [constructor]'));
		assert.strictEqual((unknown.chatmessage.match(/<img /g) || []).length, 1);
		const decoded = await waitFor(() => app.evaluate(async ({ BrowserWindow }, id) => {
			return BrowserWindow.fromId(id).webContents.executeJavaScript(`(() => {
				const images = [...document.querySelectorAll('img.tikfinity-emote')];
				return images.length >= 76 && images.every(img => img.complete && img.naturalWidth > 0)
					? images.map(img => ({ alt: img.alt, width: img.naturalWidth })) : null;
			})()`);
		}, dockId), 'all emoji images decoded in the actual SSN dock').catch(async error => {
			console.error(await app.evaluate(({ BrowserWindow }, id) =>
				BrowserWindow.fromId(id).webContents.executeJavaScript(`JSON.stringify({
					text:document.body.innerText.slice(-1500),
					images:[...document.images].map(i=>({alt:i.alt,classes:i.className,width:i.naturalWidth}))
				})`), dockId));
			throw error;
		});
		const popup = main.frames().find(item => item.url().includes('popup.html'));
		async function textOnly(value) {
			await popup.locator('#textonlymode').evaluate((input, value) => {
				input.checked = value;
				input.dispatchEvent(new Event('change', { bubbles: true }));
			}, value);
			await new Promise(resolve => setTimeout(resolve, 750));
			await command('reloadSourcePage', { sourceId: added.source.id, confirm: true });
			await waitFor(() => frame.isDetached(), 'previous iframe detached');
			frame = await waitFor(getFrame, 'iframe after settings reload');
			await frame.waitForFunction(() => window.__socialStreamTikfinityInjected === true);
			await new Promise(resolve => setTimeout(resolve, 750));
		}
		await textOnly(true);
		const plainText = names.map(name => '[' + name + ']').join(' ');
		const plain = await send(plainText, [{ emoteImageUrl: imageUrl }]);
		assert.strictEqual(plain.chatmessage, plainText);
		assert.ok(plain.textonly);
		await textOnly(false);
		await command('reloadSourcePage', { sourceId: added.source.id, confirm: true });
		await waitFor(() => frame.isDetached(), 'iframe detached on reload');
		frame = await waitFor(getFrame, 'reloaded iframe');
		await frame.waitForFunction(() => window.__socialStreamTikfinityInjected === true);
		const reloaded = await send('[laughcry][congrat][smile][loveface]');
		assert.strictEqual((reloaded.chatmessage.match(/<img /g) || []).length, 4);
		console.log(JSON.stringify({ passed: true, ssappVersion: capability.ssappVersion,
			builtInEmoji: names.length, decodedDockImages: decoded.length,
			textOnly: true, mixedEmotes: true, unknownCodesAndEscaping: true, reload: true }));
	} finally {
		if (socket) socket.close();
		await app.close();
	}
}

run().catch(error => { console.error(error); process.exitCode = 1; });
