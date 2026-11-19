const { test, before, after } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const GAMES = ['pegdrop', 'keepitup', 'encore', 'towerduel', 'frontrow', 'chatblocks', 'skydrop', 'streamboss', 'chatcrowd', 'podium', 'trivia', 'streambingo', 'marblerace', 'cliffclimb', 'rollcall', 'aquarium', 'groupphoto'];
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
	assert.deepEqual(await page.evaluate(() => [document.images.length, document.scripts.length]), [0, 4], 'no image or script elements were added');
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

test('Kit: members-only mode, burst spreading and season stars', async () => {
	let page = await open('pegdrop', '?membersonly');
	await say(page, 'River', '!drop');
	assert.equal((await state(page, 'SSNPegDrop')).balls, 0, 'a non-member is left out');
	await say(page, 'Milo', '!drop', { membership: 'Member' });
	await say(page, 'Nova', '!drop', { hasDonation: '$2.00' });
	assert.equal((await state(page, 'SSNPegDrop')).balls, 2, 'members and paid messages take part');
	await page.close();

	page = await open('encore', '');
	const counts = await page.evaluate(async () => {
		let seen = 0;
		SSNArcade.onChat(() => { seen++; });
		await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
		for (let i = 0; i < 400; i++) SSNArcade.say('Guest' + i, 'hi');
		const first = seen;
		await new Promise(r => setTimeout(r, 1500));
		return [first, seen];
	});
	assert(counts[0] <= 150, 'a burst is not handled all in one frame, got ' + counts[0]);
	assert.equal(counts[1], 400, 'and every message is still delivered');
	assert.deepEqual(page.problems, []);
	await page.close();

	page = await open('pegdrop', '?round=8');
	await say(page, 'River', '!drop');
	await page.waitForFunction(() => SSNPegDrop.state().cheering, null, { timeout: 20000 });
	const season = await page.evaluate(() => SSNSeason.list());
	assert.equal(season.length, 1);
	assert.deepEqual([season[0].name, season[0].stars, season[0].wins], ['River', 5, 1]);
	assert.equal(await page.evaluate(() => { SSNSeason.add('__proto__', 'Sneaky', 'javascript:alert(1)', 3, false); return SSNSeason.list().filter(e => e.name === 'Sneaky').map(e => e.img + '|' + e.stars).join(); }), '|3', 'odd keys and unsafe picture links are stored safely');
	await page.close();

	page = await open('pegdrop', '?demo&season=12');
	await page.waitForTimeout(600);
	assert.deepEqual(await page.evaluate(() => { SSNArcade.award(SSNArcade.player('demo:x', 'X'), 5, true); return SSNSeason.list(); }), [], 'demo play never writes season stars');
	await page.close();
});

test('Stream Boss: chat chips away, a tip hits hard, and the final blow crowns the next boss', async () => {
	let page = await open('streamboss', '?hp=500', { width: 1920, height: 1080 });
	assert.deepEqual(await state(page, 'SSNStreamBoss').then(s => [s.boss, s.hp, s.max, s.phase]), [null, 500, 500, 'fight']);
	await page.evaluate(() => { SSNArcade.say('River', 'hit'); SSNArcade.say('River', 'hit again'); });
	assert.equal((await state(page, 'SSNStreamBoss')).shots, 1, 'one hit per chatter per second');
	await page.waitForFunction(() => { const s = SSNStreamBoss.state(); return s.hp < 500 && s.hp >= 440 && s.fighters === 1; });
	const before = (await state(page, 'SSNStreamBoss')).hp;
	await say(page, 'Milo', 'take this', { hasDonation: '$2.00', donoValue: 2 });
	await page.waitForFunction(hp => SSNStreamBoss.state().hp <= hp - 230, before);
	assert.deepEqual((await state(page, 'SSNStreamBoss')).top, ['Milo', 'River']);
	await page.close();

	page = await open('streamboss', '?hp=50', { width: 1080, height: 1920 });
	for (const name of ['River', 'Milo', 'Nova', 'Ava', 'Echo', 'Wren']) await say(page, name, 'hit');
	await page.waitForFunction(() => SSNStreamBoss.state().defeated === 1, null, { timeout: 8000 });
	await page.waitForFunction(() => { const s = SSNStreamBoss.state(); return s.phase === 'fight' && s.hp === 50 && s.boss; }, null, { timeout: 8000 });
	const boss = (await state(page, 'SSNStreamBoss')).boss;
	assert(['River', 'Milo', 'Nova', 'Ava', 'Echo', 'Wren'].includes(boss), 'the chatter who landed the final blow is the boss');
	const other = boss === 'River' ? 'Milo' : 'River';
	await page.waitForTimeout(1100);
	await say(page, other, 'hit');
	await page.waitForFunction(() => SSNStreamBoss.state().hp < 50);
	const hurt = (await state(page, 'SSNStreamBoss')).hp;
	await say(page, boss, 'not today');
	await page.waitForFunction(hp => SSNStreamBoss.state().hp > hp, hurt);
	const stars = await page.evaluate(() => SSNSeason.list());
	assert.deepEqual([stars[0].name, stars[0].stars, stars[0].wins], [boss, 5, 1]);
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Chat Crowd: chatters appear, obey commands, duel, and a full street swaps people out', async () => {
	const page = await open('chatcrowd', '?max=6', { width: 1920, height: 1080 });
	await say(page, 'River', 'hello');
	await say(page, 'River', 'still me');
	assert.equal((await state(page, 'SSNChatCrowd')).crowd, 1);
	await page.waitForFunction(() => SSNChatCrowd.state().acts[0] !== 'enter');
	await say(page, 'River', '!jump');
	assert.deepEqual((await state(page, 'SSNChatCrowd')).acts, ['jump']);
	await say(page, 'Milo', 'hi');
	await page.waitForFunction(() => SSNChatCrowd.state().acts.every(a => a === 'walk' || a === 'idle'), null, { timeout: 8000 });
	await say(page, 'Milo', '!duel river');
	await page.waitForFunction(() => SSNChatCrowd.state().duels === 1, null, { timeout: 15000 });
	assert.equal((await page.evaluate(() => SSNSeason.list())).length, 1, 'the duel winner earns a star');
	await say(page, 'River', '<img src=x onerror=alert(1)> !dance');
	for (const name of ['Nova', 'Ava', 'Echo', 'Wren', 'Zed', 'Pico']) await say(page, name, 'hi');
	assert.equal((await state(page, 'SSNChatCrowd')).crowd, 6, 'never more than the cap');
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Winners\' Podium: ranks the season, follows changes and answers !stars', async () => {
	const page = await open('podium', '?top=5', { width: 1920, height: 1080 });
	assert.deepEqual((await state(page, 'SSNPodium')).rows, []);
	await page.evaluate(() => { [['a', 'Ava', 9], ['b', 'Bento', 14], ['c', 'Echo', 3], ['demo:river', 'River', 7], ['e', 'Fig', 1], ['f', 'Koda', 2]].forEach(e => SSNSeason.add(e[0], e[1], '', e[2], false)); });
	assert.deepEqual((await state(page, 'SSNPodium')).rows.map(r => r.name + ' ' + r.stars), ['Bento 14', 'Ava 9', 'River 7', 'Echo 3', 'Koda 2']);
	await page.evaluate(() => SSNSeason.add('demo:river', 'River', '', 10, true));
	assert.equal((await state(page, 'SSNPodium')).rows[0].name, 'River');
	await say(page, 'River', '!stars');
	assert.deepEqual(await state(page, 'SSNPodium').then(s => [s.showing, s.showingStars, s.showingRank]), ['River', 17, 1]);
	await say(page, 'Stranger', '!stars');
	assert.deepEqual(await state(page, 'SSNPodium').then(s => [s.showing, s.showingStars, s.showingRank]), ['Stranger', 0, 0]);
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Game Rotation: plays the list in turn, hands its options to each game, and lets chat vote', async () => {
	let page = await open('rotation', '?games=pegdrop,bogus,encore,rotation,pegdrop&every=0.25&scale=0.8', { width: 1920, height: 1080 });
	let s = await state(page, 'SSNRotation');
	assert.deepEqual([s.list, s.game, s.voting], [['pegdrop', 'encore'], 'pegdrop', false]);
	assert.equal(await page.locator('iframe').first().getAttribute('src'), 'pegdrop.html?scale=0.8', 'the game gets the page options but not the rotation\'s own');
	assert.equal(await page.locator('canvas').count(), 0, 'no vote panel unless asked');
	await page.waitForFunction(() => SSNRotation.state().game === 'encore', null, { timeout: 25000 });
	await page.waitForFunction(() => document.querySelectorAll('iframe').length === 1 && document.querySelector('iframe').style.opacity === '1', null, { timeout: 8000 });
	assert.equal(await page.locator('iframe').first().getAttribute('src'), 'encore.html?scale=0.8');
	assert.deepEqual(page.problems, []);
	await page.close();

	page = await open('rotation', '?vote&games=pegdrop,encore,towerduel,keepitup&every=0.5', { width: 1080, height: 1920 });
	await page.waitForFunction(() => SSNRotation.state().voting, null, { timeout: 15000 });
	s = await state(page, 'SSNRotation');
	assert.equal(s.options.length, 3);
	assert(!s.options.includes(s.game), 'the game on screen is not offered again');
	await say(page, 'River', '2');
	await say(page, 'Milo', '!vote 2');
	await say(page, 'Nova', '1');
	await say(page, 'Nova', '3');
	await say(page, 'Ava', '2nd place for me');
	assert.deepEqual((await state(page, 'SSNRotation')).votes, [0, 2, 1], 'one vote each, changeable, and only a bare number counts');
	await page.waitForFunction(want => SSNRotation.state().game === want, s.options[1], { timeout: 40000 });
	assert.deepEqual(page.problems, []);
	await page.close();
});

// Card games that have a drawn scene: chat goes in through the page's own bridge, the scene reports what it shows.
async function openScene(name, query, size) {
	const page = await browser.newPage({ viewport: size || { width: 1920, height: 1080 } });
	page.problems = [];
	page.on('pageerror', e => page.problems.push(String(e)));
	await page.addInitScript(fakeSocket);
	// window.skew moves the page's clock forward so a timed round can be finished at once.
	await page.addInitScript(() => { const real = Date.now.bind(Date); window.skew = 0; Date.now = () => real() + window.skew; });
	await page.route(/^https?:/, r => r.abort());
	await page.goto(url(name) + query);
	return page;
}
async function bridgeOf(page) {
	const bridge = page.frames().find(f => f !== page.mainFrame());
	await bridge.waitForLoadState();
	return (name, text, extra) => bridge.evaluate(([n, t, e]) => parent.postMessage({ dataReceived: { overlayNinja: Object.assign({ chatname: n, chatmessage: t, type: 'youtube', textonly: true }, e) } }, '*'), [name, text, extra || {}]);
}

test('Tug of War scene: shows the match the engine runs and keeps the card only for screen readers', async () => {
	let page = await openScene('tugofwar', '?session=fixture');
	const send = await bridgeOf(page);
	assert.deepEqual(await state(page, 'SSNTugScene'), { phase: 'waiting', flag: 0, teams: [0, 0], heaves: 0, prompt: '' });
	for (const name of ['River', 'Milo', 'Nova', 'Ava']) await send(name, '!join', { chatimg: 'javascript:alert(1)' });
	await page.waitForFunction(() => { const s = SSNTugScene.state(); return s.phase === 'active' && s.teams[0] === 2 && s.teams[1] === 2 && s.prompt; });
	const prompt = (await state(page, 'SSNTugScene')).prompt;
	const answer = /=/.test(prompt) ? String(Function('return ' + prompt.replace(/×/g, '*').replace(/=.*$/, ''))()) : prompt.toLowerCase();
	await send('River', 'not the answer');
	await send('River', answer);
	await send('River', answer);
	await page.waitForFunction(() => SSNTugScene.state().heaves === 1);
	assert.equal(Math.abs((await state(page, 'SSNTugScene')).flag), 1, 'one tug per player per prompt');
	const card = await page.evaluate(() => { const r = document.querySelector('.shell').getBoundingClientRect(); return { w: r.width, h: r.height, pulls: +document.getElementById('team-pulls-0').textContent + +document.getElementById('team-pulls-1').textContent, players: document.getElementById('participants').textContent, canvases: document.querySelectorAll('canvas').length, bg: getComputedStyle(document.body).backgroundColor, controls: document.querySelectorAll('button, a, input, select, textarea').length }; });
	assert.deepEqual(card, { w: 1, h: 1, pulls: 1, players: '4', canvases: 1, bg: 'rgba(0, 0, 0, 0)', controls: 0 });
	assert.equal(await page.evaluate(() => window.sockets.length), 0, 'the scene opens no connection of its own');
	assert.equal(page.frames().length, 2, 'only the page\'s one chat bridge');
	assert.deepEqual(page.problems, []);
	await page.close();

	for (const size of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }]) {
		page = await openScene('tugofwar', '?demo&session=never-connect&server', size);
		await page.waitForFunction(() => { const s = SSNTugScene.state(); return s.teams[0] + s.teams[1] >= 12 && s.heaves > 2; }, null, { timeout: 20000 });
		assert.equal(page.frames().length, 1, 'demo stays offline');
		assert.equal(await page.evaluate(() => window.sockets.length), 0);
		assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), 'must not scroll');
		assert.deepEqual(page.problems, []);
		await page.close();
	}
});

test('Rock Paper Showdown and Minority Club scenes: faces gather under each choice and the engine picks the winners', async () => {
	let page = await openScene('minorityclub', '?session=fixture');
	let send = await bridgeOf(page);
	assert.deepEqual(await state(page, 'SSNPartyScene'), { mode: 'minority', phase: 'waiting', groups: [0, 0, 0], status: [0, 0, 0], left: 0 });
	await send('River', '!pick sun');
	await send('Milo', '!pick sun');
	await send('Nova', '!pick moon');
	await send('Ava', 'pick star please');
	await page.waitForFunction(() => SSNPartyScene.state().groups.join() === '2,1,0');
	assert.equal((await state(page, 'SSNPartyScene')).phase, 'active');
	await page.waitForTimeout(1100);
	await send('River', '!pick star');
	await page.waitForFunction(() => SSNPartyScene.state().groups.join() === '1,1,1', null, { timeout: 5000 });
	assert.equal(await page.evaluate(() => document.querySelector('.shell').getBoundingClientRect().width), 1, 'the old card is not shown');
	assert.equal(page.frames().length, 2);
	assert.deepEqual(page.problems, []);
	await page.close();

	for (const name of ['rockpapershowdown', 'minorityclub']) for (const size of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }]) {
		page = await openScene(name, '?demo&session=never-connect&server', size);
		await page.waitForFunction(() => { const g = SSNPartyScene.state().groups; return g[0] + g[1] + g[2] >= 8; }, null, { timeout: 20000 });
		assert.equal(page.frames().length, 1, name + ' demo stays offline');
		assert.equal(await page.evaluate(() => window.sockets.length), 0);
		assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), name + ' must not scroll');
		assert.deepEqual(page.problems, [], name);
		await page.close();
	}

	// A whole showdown round, sped up: three throws, then the result marks one winner, one draw and one loser.
	page = await openScene('rockpapershowdown', '?session=fixture');
	send = await bridgeOf(page);
	await send('River', '!throw rock');
	await send('Milo', '!throw paper');
	await send('Nova', '!throw scissors');
	await page.waitForFunction(() => SSNPartyScene.state().groups.join() === '1,1,1');
	await page.evaluate(() => { window.skew = 31000; });
	await page.waitForFunction(() => SSNPartyScene.state().phase === 'result');
	assert.deepEqual((await state(page, 'SSNPartyScene')).status.slice().sort(), [-1, 0, 1]);
	assert.equal((await page.evaluate(() => SSNSeason.list())).length, 1, 'only the winning throw earns stars');
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Meteor Shield scene: held shields stop meteors, a gap lets one through, and the hull shows it', async () => {
	let page = await openScene('meteorshield', '?session=fixture');
	const send = await bridgeOf(page);
	assert.deepEqual(await state(page, 'SSNShieldScene').then(s => [s.phase, s.wave, s.hull, s.held, s.threats]), ['waiting', 1, 6, [0, 0, 0], [1, 0, 0]]);
	await send('River', '!shield red');
	await page.waitForFunction(() => { const s = SSNShieldScene.state(); return s.phase === 'active' && s.held[0] === 1 && s.meteors === 1; });
	await page.evaluate(() => { window.skew = 12500; });
	await page.waitForFunction(() => { const s = SSNShieldScene.state(); return s.wave === 2 && s.hull === 6 && s.blasts >= 1; }, null, { timeout: 8000 });
	assert.deepEqual((await state(page, 'SSNShieldScene')).threats, [0, 1, 0], 'the next wave comes down another lane');
	await page.evaluate(() => { window.skew = 25000; });
	await page.waitForFunction(() => { const s = SSNShieldScene.state(); return s.wave === 3 && s.hull === 5; }, null, { timeout: 8000 });
	assert.equal(await page.evaluate(() => document.querySelector('.shell').getBoundingClientRect().width), 1, 'the old card is not shown');
	assert.deepEqual(page.problems, []);
	await page.close();

	for (const size of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }]) {
		page = await openScene('meteorshield', '?demo&session=never-connect&server', size);
		await page.waitForFunction(() => { const s = SSNShieldScene.state(); return s.held[0] + s.held[1] + s.held[2] >= 4; }, null, { timeout: 20000 });
		assert.equal(page.frames().length, 1, 'demo stays offline');
		assert.equal(await page.evaluate(() => window.sockets.length), 0);
		assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), 'must not scroll');
		assert.deepEqual(page.problems, []);
		await page.close();
	}
});

test('Beacon Relay and Crew Kitchen scenes: every accepted pass and ingredient is shown with the chatter who did it', async () => {
	let page = await openScene('beaconrelay', '?session=fixture');
	let send = await bridgeOf(page);
	assert.deepEqual(await state(page, 'SSNRelayScene'), { phase: 'waiting', steps: 0, keepers: 0, running: false, lit: null });
	await send('River', '!pass');
	await page.waitForFunction(() => { const s = SSNRelayScene.state(); return s.phase === 'active' && s.steps === 1 && s.keepers === 1; });
	await send('River', '!pass');
	await page.waitForTimeout(400);
	assert.equal((await state(page, 'SSNRelayScene')).steps, 1, 'the same chatter cannot pass twice in a row');
	await send('Milo', '!pass');
	await page.waitForFunction(() => { const s = SSNRelayScene.state(); return s.steps === 2 && s.keepers === 2; });
	assert.equal(await page.evaluate(() => document.querySelector('.shell').getBoundingClientRect().width), 1);
	assert.deepEqual(page.problems, []);
	await page.close();

	page = await openScene('crewkitchen', '?session=fixture');
	send = await bridgeOf(page);
	assert.deepEqual(await state(page, 'SSNKitchenScene').then(s => [s.phase, s.served, s.stock, s.adds]), ['waiting', 0, [0, 0, 0], 0]);
	const words = await page.evaluate(() => Array.from(document.querySelectorAll('.shell code, .shell [id]')).map(e => e.textContent).join(' ').match(/!cook ([a-z]+)/g));
	assert(words && words.length, 'the hidden card still names the ingredients');
	const first = words[0];
	await send('River', 'cook nothing');
	await send('River', first);
	await send('Milo', first);
	await send('Nova', first);
	await page.waitForFunction(() => { const s = SSNKitchenScene.state(); return s.phase === 'active' && s.adds === 2 && s.stock.indexOf(2) >= 0 && s.cooks === 1; });
	assert.equal(await page.evaluate(() => document.querySelector('.shell').getBoundingClientRect().width), 1);
	assert.deepEqual(page.problems, []);
	await page.close();

	for (const name of ['beaconrelay', 'crewkitchen']) for (const size of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }]) {
		page = await openScene(name, '?demo&session=never-connect&server', size);
		await page.waitForFunction(() => (window.SSNRelayScene ? SSNRelayScene.state().steps >= 4 : SSNKitchenScene.state().adds >= 4), null, { timeout: 20000 });
		assert.equal(page.frames().length, 1, name + ' demo stays offline');
		assert.equal(await page.evaluate(() => window.sockets.length), 0);
		assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), name + ' must not scroll');
		assert.deepEqual(page.problems, [], name);
		await page.close();
	}
});

test('Trivia: one answer each, only the right letter scores, and packs can be chosen', async () => {
	const page = await open('trivia', '?time=8&rounds=3&pack=animals,nosuchpack', { width: 1920, height: 1080 });
	await page.waitForFunction(() => SSNTrivia.state().phase === 'ask', null, { timeout: 10000 });
	let s = await state(page, 'SSNTrivia');
	assert.deepEqual([s.number, s.of, s.pack, s.answered, s.correct], [1, 3, 'animals', 0, ''], 'the answer is not exposed while the question is open');
	await say(page, 'River', 'a');
	await say(page, 'River', 'b');
	await say(page, 'Milo', 'B');
	await say(page, 'Nova', '3');
	await say(page, 'Ava', '!d');
	await say(page, 'Echo', 'a and b');
	await say(page, 'Wren', 'hello');
	assert.equal((await state(page, 'SSNTrivia')).answered, 4, 'a bare letter or number is an answer; a sentence is not');
	await page.waitForFunction(() => SSNTrivia.state().phase === 'reveal', null, { timeout: 15000 });
	s = await state(page, 'SSNTrivia');
	assert.match(s.correct, /^[abcd]$/);
	await page.waitForFunction(() => Object.keys(SSNTrivia.state().scores).some(name => SSNTrivia.state().scores[name] > 0), null, { timeout: 8000 });
	s = await state(page, 'SSNTrivia');
	const right = { a: 'River', b: 'Milo', c: 'Nova', d: 'Ava' }[s.correct];
	const scored = Object.keys(s.scores).filter(name => s.scores[name] > 0);
	assert.deepEqual(scored, [right], 'only the chatter whose first answer was right scores');
	assert(s.scores[right] >= 100 && s.scores[right] <= 200, 'points are 100 plus a speed bonus, got ' + s.scores[right]);
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Stream Bingo: callers stamp a square together, a moderator stamps at once, and a line is a bingo', async () => {
	const page = await open('streambingo', '?votes=2', { width: 1920, height: 1080 });
	await page.waitForFunction(() => !SSNStreamBingo.state().dealing, null, { timeout: 10000 });
	assert.deepEqual(await state(page, 'SSNStreamBingo').then(s => [s.card, s.stamped, s.bingos]), [1, [13], 0]);
	await say(page, 'River', '7');
	await say(page, 'River', '7');
	await say(page, 'River', '8');
	await say(page, 'Echo', '26');
	await say(page, 'Echo', 'seven');
	assert.deepEqual((await state(page, 'SSNStreamBingo')).pending, { 7: 1 }, 'one call per chatter per square, and one call every five seconds');
	await say(page, 'Milo', '!bingo 7');
	assert.deepEqual((await state(page, 'SSNStreamBingo')).stamped.slice().sort((a, b) => a - b), [7, 13]);
	for (const n of [11, 12, 14]) await say(page, 'Nova', String(n), { mod: true });
	assert.equal((await state(page, 'SSNStreamBingo')).bingos, 0);
	await say(page, 'Nova', '15', { mod: true });
	const s = await state(page, 'SSNStreamBingo');
	assert.equal(s.bingos, 1, 'the middle row is complete (the centre square is free)');
	assert.deepEqual(s.stamped.slice().sort((a, b) => a - b), [7, 11, 12, 13, 14, 15]);
	await page.waitForFunction(() => { const t = SSNStreamBingo.state(); return t.card === 2 && !t.dealing && t.stamped.length === 1; }, null, { timeout: 25000 });
	assert.equal((await page.evaluate(() => SSNSeason.list())).length >= 1, true, 'the callers on the winning line earn stars');
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Marble Race: one marble per chatter, late joiners queue, and a race always produces a winner', async () => {
	const page = await open('marblerace', '?lobby=10', { width: 1080, height: 1920 });
	assert.deepEqual(await state(page, 'SSNMarbleRace').then(s => [s.phase, s.marbles, s.queued, s.winner]), ['idle', 0, 0, null]);
	await say(page, 'River', 'hello');
	assert.equal((await state(page, 'SSNMarbleRace')).phase, 'idle', 'ordinary chat does not join');
	await say(page, 'River', '!play');
	await say(page, 'River', '!play');
	await say(page, 'Milo', 'PLAY');
	let s = await state(page, 'SSNMarbleRace');
	assert.deepEqual([s.phase, s.marbles], ['lobby', 2]);
	assert(s.secs > 0 && s.secs <= 10);
	await page.waitForFunction(() => SSNMarbleRace.state().phase === 'race', null, { timeout: 20000 });
	await say(page, 'Nova', '!play');
	assert.deepEqual(await state(page, 'SSNMarbleRace').then(t => [t.marbles, t.queued]), [2, 1], 'a join during the race waits for the next one');
	await page.waitForFunction(() => SSNMarbleRace.state().phase === 'results', null, { timeout: 100000 });
	s = await state(page, 'SSNMarbleRace');
	assert(['River', 'Milo'].includes(s.winner), 'a racer won, got ' + s.winner);
	const stars = await page.evaluate(() => SSNSeason.list());
	assert.deepEqual([stars[0].name, stars[0].stars, stars[0].wins], [s.winner, 5, 1]);
	await page.waitForFunction(() => { const t = SSNMarbleRace.state(); return t.phase === 'lobby' && t.marbles === 1 && t.queued === 0; }, null, { timeout: 30000 });
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Cliff Climb: every message is a hop, the walls stay balanced, and the first to the flag wins the round', async () => {
	const page = await open('cliffclimb', '?goal=8', { width: 1920, height: 1080 });
	assert.deepEqual(await state(page, 'SSNCliffClimb').then(s => [s.climbers, s.leader, s.top, s.summited, s.over, s.round]), [[0, 0], null, 0, 0, false, 1]);
	await page.evaluate(() => { SSNArcade.say('River', 'up'); SSNArcade.say('River', 'up again'); });
	let s = await state(page, 'SSNCliffClimb');
	assert.equal(s.climbers[0] + s.climbers[1], 1);
	assert.equal(s.top, 1, 'a chatter cannot spam hops');
	for (const name of ['Milo', 'Nova', 'Ava']) await say(page, name, 'climbing');
	assert.deepEqual((await state(page, 'SSNCliffClimb')).climbers, [2, 2]);
	const deadline = Date.now() + 60000;
	do { await say(page, 'River', 'go'); await page.waitForTimeout(450); s = await state(page, 'SSNCliffClimb'); } while (!s.summited && Date.now() < deadline);
	assert.equal(s.summited >= 1, true, 'someone reached the flag');
	await page.waitForFunction(() => SSNCliffClimb.state().over, null, { timeout: 15000 });
	await page.waitForFunction(() => { const t = SSNCliffClimb.state(); return t.round === 2 && !t.over && t.top === 0; }, null, { timeout: 20000 });
	assert.equal((await page.evaluate(() => SSNSeason.list()))[0].name, 'River');
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Roll Call, Chat Aquarium and Group Photo: one place per chatter, members marked, tips and photos happen', async () => {
	let page = await open('rollcall', '?minutes=0.06', { width: 1920, height: 1080 });
	let s = await state(page, 'SSNRollCall');
	assert.deepEqual([s.faces, s.done, s.members], [0, false, 0]);
	assert(s.cells >= 100 && s.left > 0 && s.left <= 4);
	await say(page, 'River', 'hello');
	await say(page, 'River', 'hello again');
	await say(page, 'Milo', 'hi', { membership: 'Member' });
	assert.deepEqual(await state(page, 'SSNRollCall').then(t => [t.faces, t.members]), [2, 1]);
	await page.waitForFunction(() => { const t = SSNRollCall.state(); return t.done && t.left === 0; }, null, { timeout: 10000 });
	await page.setViewportSize({ width: 1080, height: 1920 });
	await page.waitForFunction(() => SSNRollCall.state().faces === 2);
	assert.deepEqual(page.problems, []);
	await page.close();
	page = await open('rollcall', '');
	assert.equal((await state(page, 'SSNRollCall')).left, -1, 'no countdown unless asked');
	await page.close();

	page = await open('aquarium', '?minutes=2', { width: 1920, height: 1080 });
	assert.deepEqual(await state(page, 'SSNAquarium').then(t => [t.fish, t.feeding, t.members]), [0, false, 0]);
	await say(page, 'River', 'brb');
	await say(page, 'River', 'back');
	await say(page, 'Milo', 'hi', { membership: 'Member' });
	s = await state(page, 'SSNAquarium');
	assert.deepEqual([s.fish, s.members, s.feeding], [2, 1, false]);
	assert(s.left > 100 && s.left <= 120);
	await say(page, 'Nova', 'for the fish', { hasDonation: '$3.00', donoValue: 3 });
	await page.waitForFunction(() => { const t = SSNAquarium.state(); return t.feeding && t.fish === 3; }, null, { timeout: 5000 });
	assert.deepEqual(page.problems, []);
	await page.close();

	page = await open('groupphoto', '?crowd=3&every=600', { width: 1920, height: 1080 });
	assert.deepEqual(await state(page, 'SSNGroupPhoto').then(t => [t.people, t.photos, t.prints, t.counting]), [0, 0, 0, false]);
	await say(page, 'River', 'bye');
	await say(page, 'River', 'bye again');
	await say(page, 'Milo', 'gg');
	assert.deepEqual(await state(page, 'SSNGroupPhoto').then(t => [t.people, t.photos]), [2, 0]);
	await say(page, 'Nova', 'thanks');
	await page.waitForFunction(() => SSNGroupPhoto.state().counting, null, { timeout: 15000 });
	await page.waitForFunction(() => { const t = SSNGroupPhoto.state(); return t.photos === 1 && t.prints === 1; }, null, { timeout: 15000 });
	const stars = await page.evaluate(() => SSNSeason.list());
	assert.deepEqual(stars.map(e => e.stars), [1, 1, 1], 'everyone in the photo gets one star');
	assert.deepEqual(page.problems, []);
	await page.close();
});

test('Sum Squad, Memory Parade and Odd One Out scenes follow their engine', async () => {
	let page = await openScene('sumsquad', '?session=fixture');
	let send = await bridgeOf(page);
	assert.deepEqual(await state(page, 'SSNSumScene'), { phase: 'waiting', stage: 0, total: 0, target: 20, blocks: 0 });
	await send('River', '!add 9');
	await page.waitForFunction(() => { const s = SSNSumScene.state(); return s.phase === 'active' && s.total === 9 && s.blocks === 1; });
	// The game ignores adds that arrive within 0.3 seconds of the last one.
	await page.waitForTimeout(400);
	await send('River', '!add 5');
	await send('Milo', '!add 9');
	await page.waitForFunction(() => SSNSumScene.state().total === 18);
	await page.waitForTimeout(400);
	await send('Nova', '!add 9');
	await page.waitForTimeout(400);
	assert.equal((await state(page, 'SSNSumScene')).total, 18, 'no repeat by the same chatter and no going over the target');
	await send('Nova', '!add 2');
	await page.waitForFunction(() => { const s = SSNSumScene.state(); return s.stage === 1 && s.target === 30 && s.total === 0; });
	assert.equal(await page.evaluate(() => document.querySelector('.shell').getBoundingClientRect().width), 1);
	assert.deepEqual(page.problems, []);
	await page.close();

	page = await openScene('memoryparade', '?session=fixture');
	send = await bridgeOf(page);
	assert.deepEqual(await state(page, 'SSNMemoryScene').then(s => [s.phase, s.stage, s.joined, s.answered]), ['waiting', 0, 0, 0]);
	await send('River', '!mem 123');
	await send('River', '!ready');
	await page.waitForFunction(() => { const s = SSNMemoryScene.state(); return s.phase === 'active' && s.joined === 1 && s.showing; });
	await page.evaluate(() => { window.skew = 5300; });
	await page.waitForFunction(() => !SSNMemoryScene.state().showing, null, { timeout: 5000 });
	await send('River', '!mem 123');
	await page.waitForFunction(() => SSNMemoryScene.state().answered === 1, null, { timeout: 5000 });
	assert.deepEqual(page.problems, []);
	await page.close();

	page = await openScene('oddoneout', '?session=fixture');
	send = await bridgeOf(page);
	assert.deepEqual(await state(page, 'SSNOddScene'), { phase: 'waiting', stage: 0, groups: [0, 0, 0], correct: -1 });
	await send('River', '!odd 1');
	await send('Milo', '!odd 2');
	await send('Nova', 'odd 3');
	await page.waitForFunction(() => SSNOddScene.state().groups.join() === '1,1,0');
	await page.waitForTimeout(1100);
	await send('River', '!odd 3');
	await page.waitForFunction(() => SSNOddScene.state().groups.join() === '0,1,1', null, { timeout: 5000 });
	await page.evaluate(() => { window.skew = 12500; });
	await page.waitForFunction(() => { const s = SSNOddScene.state(); return s.stage === 1 && s.correct >= 0 && s.correct <= 2; }, null, { timeout: 8000 });
	assert.deepEqual(page.problems, []);
	await page.close();

	for (const [name, hook] of [['sumsquad', 'SSNSumScene'], ['memoryparade', 'SSNMemoryScene'], ['oddoneout', 'SSNOddScene']]) for (const size of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }]) {
		page = await openScene(name, '?demo&session=never-connect&server', size);
		await page.waitForFunction(h => window[h].state().phase === 'active', hook, { timeout: 20000 });
		await page.waitForTimeout(1500);
		assert.equal(page.frames().length, 1, name + ' demo stays offline');
		assert.equal(await page.evaluate(() => window.sockets.length), 0);
		assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), name + ' must not scroll');
		assert.deepEqual(page.problems, [], name);
		await page.close();
	}
});
