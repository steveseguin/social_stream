const { test, before, after } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const GAMES = ['pegdrop', 'keepitup', 'encore', 'towerduel', 'frontrow', 'chatblocks', 'skydrop'];
const url = name => pathToFileURL(path.join(__dirname, '../games', name + '.html')).href;
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

// A stand-in relay socket: records what the page sends and lets the test push chat in. Nothing leaves the machine.
const fakeSocket = () => {
	window.sockets = [];
	window.WebSocket = class {
		constructor(address) { this.address = address; this.sent = []; this.readyState = 1; window.sockets.push(this); setTimeout(() => this.onopen && this.onopen({}), 0); }
		send(data) { this.sent.push(data); }
		close() {}
	};
};
async function open(name, query, size) {
	const page = await browser.newPage({ viewport: size || { width: 1080, height: 1920 } });
	page.problems = [];
	page.on('pageerror', e => page.problems.push(String(e)));
	page.on('dialog', d => { page.problems.push('dialog: ' + d.message()); d.dismiss(); });
	await page.addInitScript(fakeSocket);
	await page.route(/^https?:/, r => r.abort());
	await page.goto(url(name) + (query || ''));
	return page;
}
const say = (page, name, text, extra) => page.evaluate(([n, t, e]) => SSNArcade.say(n, t, e), [name, text, extra || {}]);
const state = (page, hook) => page.evaluate(h => window[h].state(), hook);

test('Every arcade game shows only itself: no controls, no readable text, and a demo that stays offline', async () => {
	for (const name of GAMES) {
		for (const size of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }, { width: 720, height: 1280 }]) {
			const page = await open(name, '?demo&session=never-connect&server', size);
			await page.waitForTimeout(1200);
			assert.equal(page.frames().length, 1, name + ' demo must not open the chat bridge');
			assert.equal(await page.evaluate(() => window.sockets.length), 0, name + ' demo must not open a socket');
			assert.equal(await page.locator('button, a, input, select, textarea, #connection, #controls').count(), 0, name);
			assert.equal((await page.evaluate(() => document.body.innerText)).trim(), '', name);
			assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgba(0, 0, 0, 0)', name);
			assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), name + ' must not scroll');
			assert.deepEqual(page.problems, [], name);
			await page.close();
		}
	}
});

test('Chat arrives through the relay socket or the hidden bridge, and only from them', async () => {
	let page = await open('pegdrop', '?session=fixture,second&server');
	await page.waitForFunction(() => window.sockets.length === 1 && window.sockets[0].sent.length === 1);
	assert.deepEqual(JSON.parse(await page.evaluate(() => window.sockets[0].sent[0])), { join: 'fixture', out: 2, in: 1 });
	assert.equal(page.frames().length, 1);
	await page.evaluate(() => window.sockets[0].onmessage({ data: JSON.stringify({ chatname: 'River', chatmessage: '!drop', type: 'youtube' }) }));
	assert.equal((await state(page, 'SSNPegDrop')).balls, 1);
	await page.evaluate(() => window.sockets[0].onmessage({ data: JSON.stringify({ content: { chatname: 'Milo', chatmessage: '<b>!drop</b>', type: 'twitch' } }) }));
	assert.equal((await state(page, 'SSNPegDrop')).balls, 2, 'wrapped messages and HTML chat are read as text');
	await page.close();

	page = await open('pegdrop', '?session=fixture');
	assert.equal(await page.evaluate(() => window.sockets.length), 0);
	const bridge = page.frames().find(f => f !== page.mainFrame());
	await bridge.waitForLoadState();
	await page.evaluate(() => postMessage({ dataReceived: { overlayNinja: { chatname: 'Stranger', chatmessage: '!drop', type: 'youtube' } } }, '*'));
	await page.waitForTimeout(100);
	assert.equal((await state(page, 'SSNPegDrop')).balls, 0, 'messages posted by anything but the bridge are ignored');
	await bridge.evaluate(() => parent.postMessage({ dataReceived: { overlayNinja: { chatname: 'River', chatmessage: '!drop', type: 'youtube' } } }, '*'));
	await page.waitForFunction(() => SSNPegDrop.state().balls === 1);
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Chat names, messages and avatars are treated as untrusted text', async () => {
	const page = await open('encore', '');
	await say(page, '<img src=x onerror=alert(1)>Mallory', '<script>alert(2)</script> gg', { textonly: false, chatimg: 'javascript:alert(3)' });
	await say(page, 'River', 'gg', { chatimg: 'data:text/html,<script>alert(4)</script>' });
	await page.waitForFunction(() => SSNEncore.state().faces >= 1);
	assert.deepEqual(await page.evaluate(() => [document.images.length, document.scripts.length]), [0, 3], 'no image or script elements were added');
	assert.equal(await page.locator('body *:not(canvas):not(script)').count(), 0);
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Peg Drop: one ball per chatter, pegs decide the slot, and a round ends with a reset', async () => {
	const page = await open('pegdrop', '?round=9');
	await say(page, 'River', 'hello everyone');
	assert.equal((await state(page, 'SSNPegDrop')).balls, 0, 'ordinary chat does not drop');
	await say(page, 'River', '!drop');
	await say(page, 'River', '!drop');
	assert.equal((await state(page, 'SSNPegDrop')).balls, 1, 'one ball in play per chatter');
	await say(page, 'Milo', '!DROP now');
	assert.equal((await state(page, 'SSNPegDrop')).balls, 2);
	await page.waitForFunction(() => { const t = SSNPegDrop.state().totals; return t.River > 0 && t.Milo > 0; }, null, { timeout: 15000 });
	const totals = (await state(page, 'SSNPegDrop')).totals;
	for (const name of ['River', 'Milo']) assert([5, 10, 15, 30, 90, 100].includes(totals[name]), name + ' scored a slot value, got ' + totals[name]);
	await page.waitForFunction(() => SSNPegDrop.state().cheering, null, { timeout: 12000 });
	await say(page, 'River', '!drop');
	assert.equal((await state(page, 'SSNPegDrop')).balls, 0, 'no drops while the winner is shown');
	await page.waitForFunction(() => { const s = SSNPegDrop.state(); return !s.cheering && !Object.keys(s.totals).length; }, null, { timeout: 12000 });
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Keep It Up: any message bumps the balloon, a rally counts hits, and it pops on the floor', async () => {
	const page = await open('keepitup', '', { width: 1920, height: 1080 });
	assert.deepEqual(await state(page, 'SSNKeepItUp'), { air: false, rally: 0, best: 0, jumpers: 0 });
	await page.evaluate(() => { SSNArcade.say('River', 'hi'); SSNArcade.say('River', 'hi again'); });
	assert.equal((await state(page, 'SSNKeepItUp')).jumpers, 1, 'a chatter cannot spam bumps');
	await page.waitForFunction(() => { const s = SSNKeepItUp.state(); return s.air && s.rally === 1; });
	await say(page, 'Milo', 'me too');
	await page.waitForFunction(() => SSNKeepItUp.state().rally === 2);
	await page.waitForFunction(() => { const s = SSNKeepItUp.state(); return !s.air && s.rally === 0 && s.best === 2; }, null, { timeout: 45000 });
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Tower Duel: chatters are split evenly, crates fall, and the first tower to the flag wins the round', async () => {
	let page = await open('towerduel', '?goal=5', { width: 1920, height: 1080 });
	const names = ['River', 'Milo', 'Nova', 'Ava', 'Echo', 'Wren', 'Zed', 'Pico'];
	await say(page, names[0], 'hi');
	assert.equal((await state(page, 'SSNTowerDuel')).falling, 1);
	for (const name of names.slice(1, 6)) await say(page, name, 'hi');
	assert.deepEqual((await state(page, 'SSNTowerDuel')).teams, [3, 3]);
	const deadline = Date.now() + 90000;
	let s, turn = 0;
	do { await say(page, names[turn++ % names.length], 'go'); await page.waitForTimeout(120); s = await state(page, 'SSNTowerDuel'); } while (!s.over && Date.now() < deadline);
	assert(s.over, 'a tower reached the flag');
	assert.equal(s.wins[0] + s.wins[1], 1);
	assert.deepEqual(s.teams, [4, 4], 'late joiners keep the teams level');
	await page.waitForFunction(() => { const t = SSNTowerDuel.state(); return !t.over && t.blocks[0] + t.blocks[1] === 0; }, null, { timeout: 12000 });
	assert.deepEqual(page.problems, []);
	await page.close();

	page = await open('towerduel', '?command=!build', { width: 1920, height: 1080 });
	await say(page, 'River', 'hello');
	assert.deepEqual((await state(page, 'SSNTowerDuel')).teams, [0, 0], 'with a command set, ordinary chat is left alone');
	await say(page, 'River', '!build');
	assert.equal((await state(page, 'SSNTowerDuel')).falling, 1);
	await page.close();
});

test('Front Row: first message takes a seat, the house caps at its seats, and the countdown finishes', async () => {
	const page = await open('frontrow', '?minutes=0.06', { width: 1920, height: 1080 });
	for (const name of ['River', 'Milo', 'Nova', 'River']) await say(page, name, 'hi');
	let s = await state(page, 'SSNFrontRow');
	assert.equal(s.seated, 3);
	assert.equal(s.done, false);
	await page.evaluate(n => { for (let i = 0; i < n + 5; i++) SSNArcade.say('Guest' + i, 'hi'); }, s.seats);
	s = await state(page, 'SSNFrontRow');
	assert.equal(s.seated, s.seats, 'a full house swaps seats instead of overflowing');
	await page.waitForFunction(() => SSNFrontRow.state().done, null, { timeout: 8000 });
	await page.setViewportSize({ width: 1080, height: 1920 });
	await page.waitForFunction(() => { const t = SSNFrontRow.state(); return t.seated <= t.seats; });
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Encore: each chatter launches a rocket and a crowd sets off the finale', async () => {
	const page = await open('encore', '?crowd=3', { width: 1920, height: 1080 });
	await page.evaluate(() => { SSNArcade.say('River', 'gg'); SSNArcade.say('River', 'gg'); });
	assert.equal((await state(page, 'SSNEncore')).rockets, 1, 'one rocket per chatter at a time');
	await say(page, 'Milo', 'thanks!');
	assert.equal((await state(page, 'SSNEncore')).finale, false);
	await say(page, 'Nova', 'bye');
	assert.equal((await state(page, 'SSNEncore')).finale, true);
	await page.waitForFunction(() => SSNEncore.state().faces >= 3, null, { timeout: 5000 });
	assert.deepEqual(page.problems, []);
	await page.close();
});
