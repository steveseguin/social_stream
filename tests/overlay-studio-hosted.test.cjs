'use strict';

// Run: node tests/overlay-studio-hosted.test.cjs
// An alert rule's Media box can hold an Overlay Studio link. The alert box then plays that overlay full-screen for
// the matching event, with the viewer's name and numbers filled in, and puts it away again afterwards.
const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, makeContext } = require('./tipjar-count-goals.test.cjs');

async function openAlerts(context, baseUrl, query, setup) {
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(String(error && error.stack || error)));
	await page.setViewportSize({ width: 1280, height: 720 });
	// Every message a hosted overlay receives from the alert box, in order.
	await page.addInitScript(() => {
		if (window.parent === window) { window.__sent = []; return; }
		// Any sound the hosted overlay tries to play itself (the alert box plays the alert's sound, the overlay must not).
		window.__played = 0;
		const play = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function () { window.__played++; return play.apply(this, arguments); };
		window.addEventListener('message', event => {
			const message = event.data;
			if (event.source === window.parent && message && (message.ssoPlay || message.ssoStop)) {
				try { window.parent.__sent.push(JSON.parse(JSON.stringify(message))); } catch (error) {}
			}
		});
	});
	if (setup) { await setup(page); }
	await page.goto(baseUrl + '/multi-alerts.html?' + (setup && setup.live ? '' : 'preview&') + query, { waitUntil: setup && setup.early ? 'domcontentloaded' : 'load', timeout: 15000 });
	await page.waitForFunction(() => !!window.__multiAlertsOverlay);
	return { page, errors };
}
const frames = page => page.evaluate(() => Array.from(document.querySelectorAll('#alert-screen-effects iframe')).map(f => ({ src: f.src, shown: f.style.display !== 'none' })));
const send = (page, payload) => page.evaluate(p => window.__multiAlertsOverlay.sendPayload(p), payload);
const sent = page => page.evaluate(() => window.__sent.slice());
const hosted = page => page.frames().find(f => /overlays\/view\.html/.test(f.url()));
// The hosted overlay's frame, once its page has actually started loading (a frame has no address until then).
async function waitHosted(page) {
	for (let tries = 0; tries < 100; tries++) {
		const frame = hosted(page);
		if (frame) { return frame; }
		await page.waitForTimeout(100);
	}
	throw new Error('the hosted overlay never started loading');
}
const raid = (name, viewers) => ({ type: 'twitch', event: 'raid', chatname: name, chatmessage: 'raiding', meta: { viewers: viewers } });
const follow = name => ({ type: 'twitch', event: 'new_follower', chatname: name, chatmessage: 'followed' });
const rootEmpty = frame => frame.evaluate(() => document.getElementById('sso-root').children.length === 0);
const playing = frame => frame.waitForFunction(() => !!document.querySelector('.mo-card.on'), null, { timeout: 6000 });

async function testRaidMoment(context, baseUrl) {
	const media = baseUrl + '/overlays/view.html?t=raid&length=4&sound=sfx-arena-horn&preview=1';
	const { page, errors } = await openAlerts(context, baseUrl, 'queue&showtime=2000&cooldown=0&effect1type=raid&effect1media=' + encodeURIComponent(media));
	await page.waitForFunction(() => document.querySelector('#alert-screen-effects iframe'));
	let list = await frames(page);
	assert.strictEqual(list.length, 1, 'the configured moment is loaded once, up front');
	assert(/[?&]hosted=1/.test(list[0].src) && !/[?&]preview/.test(list[0].src), 'it is loaded as a hosted overlay, not a preview');
	assert.strictEqual(list[0].shown, false, 'and stays parked until an event arrives');
	const frame = hosted(page);
	await frame.waitForFunction(() => !!window.SSO && !!window.SSO.momentState);
	assert(await rootEmpty(frame), 'nothing is drawn while it waits');

	await send(page, raid('Raid <b>Captain</b>', 42));
	await playing(frame);
	assert.strictEqual((await frames(page))[0].shown, true, 'shown while it plays');
	const text = await frame.evaluate(() => document.getElementById('sso-root').textContent);
	assert(text.indexOf('Raid <b>Captain</b>') !== -1, 'the raider name is filled in, as text: ' + text);
	assert.strictEqual(await frame.evaluate(() => document.querySelectorAll('.rd-name *').length), 0, 'no markup from the name');
	await frame.waitForFunction(() => /42/.test((document.querySelector('.rd-count b') || {}).textContent || ''), null, { timeout: 6000 });
	assert.strictEqual(await frame.evaluate(() => new URLSearchParams(location.search).get('sound')), 'sfx-arena-horn', 'the link asks for a sound');
	assert.strictEqual(await frame.evaluate(() => window.__played), 0, 'but a hosted overlay plays none itself');
	// The card stays up for the moment's own length (4 s, plus the time it needs to clear) although the alert time here is 2 s.
	assert(await page.evaluate(() => parseFloat(document.querySelector('.alert-card').style.getPropertyValue('--progress-duration')) >= 5000), 'the card waits for its moment');

	// A follow does not match the raid rule: its card shows, and the moment is not played again for it.
	const before = (await sent(page)).filter(m => m.ssoPlay).length;
	await send(page, follow('Quiet Follower'));
	await page.waitForFunction(() => /Quiet Follower/.test(document.getElementById('alert-stage').textContent), null, { timeout: 15000 });
	assert.strictEqual((await frames(page)).length, 1);
	assert.strictEqual((await sent(page)).filter(m => m.ssoPlay).length, before, 'no play for an alert without a moment');
	assert(!(await sent(page)).some(m => m.ssoStop), 'the raid moment ended by itself before the next card took over');
	assert(await rootEmpty(frame), 'and nothing of it is left behind that card');

	// Put away, and emptied, once the raid moment has ended.
	await page.waitForFunction(() => document.querySelector('#alert-screen-effects iframe').style.display === 'none', null, { timeout: 15000 });
	assert(await rootEmpty(frame), 'the hosted page is empty again');
	assert.deepStrictEqual(errors, []);
	await page.close();
}

async function testStackedBurstAndClear(context, baseUrl) {
	const media = baseUrl + '/overlays/view.html?t=raid&length=3';
	let release;
	const gate = new Promise(resolve => { release = resolve; });
	// (The page's own load event would wait for the held-back frame, so this page is used as soon as its script has run.)
	const hold = page => page.route(/\/overlays\/view\.html/, async route => { await gate; await route.continue(); });
	hold.early = true;
	const { page, errors } = await openAlerts(context, baseUrl, 'stack&limit=5&effect1type=raid&effect1media=' + encodeURIComponent(media), hold);
	// Two raids before the moment's page has loaded: both are played, one after the other, in order.
	await send(page, raid('First Crew', 5));
	await send(page, raid('Second Crew', 9));
	assert.strictEqual((await sent(page)).length, 0, 'nothing can be sent to a page that has not loaded');
	release();
	const frame = await waitHosted(page);
	await frame.waitForFunction(() => /First Crew/.test(document.getElementById('sso-root').textContent), null, { timeout: 8000 });
	let plays = (await sent(page)).filter(m => m.ssoPlay);
	assert.strictEqual(plays.length, 1, 'the second waits for the first to finish');
	assert.strictEqual(plays[0].ssoPlay.name, 'First Crew');
	await frame.waitForFunction(() => /Second Crew/.test(document.getElementById('sso-root').textContent), null, { timeout: 12000 });
	plays = (await sent(page)).filter(m => m.ssoPlay);
	assert.deepStrictEqual(plays.map(m => m.ssoPlay.name), ['First Crew', 'Second Crew']);
	assert.notStrictEqual(plays[0].ssoId, plays[1].ssoId, 'each play has its own id');

	// Clear while the second is playing, with a third waiting: everything stops at once and nothing starts afterwards.
	await send(page, raid('Third Crew', 2));
	await page.evaluate(() => window.__multiAlertsOverlay.clear());
	assert.strictEqual((await frames(page))[0].shown, false, 'put away straight away');
	await frame.waitForFunction(() => document.getElementById('sso-root').children.length === 0, null, { timeout: 4000 });
	// A late report from the stopped play must not bring the frame back.
	await frame.evaluate(id => window.parent.postMessage({ ssoPlaying: 30, ssoId: id }, '*'), plays[1].ssoId);
	await page.waitForTimeout(1500);
	assert.strictEqual((await frames(page))[0].shown, false, 'stays put away');
	assert.strictEqual((await sent(page)).filter(m => m.ssoPlay).length, 2, 'the waiting play was dropped');
	assert((await sent(page)).some(m => m.ssoStop), 'the overlay was told to stop');
	assert.deepStrictEqual(errors, []);
	await page.close();
}

async function testSkipStopsTheMoment(context, baseUrl) {
	const media = baseUrl + '/overlays/view.html?t=raid&length=20';
	const { page, errors } = await openAlerts(context, baseUrl, 'effect1type=raid&effect1media=' + encodeURIComponent(media));
	await page.waitForFunction(() => document.querySelector('#alert-screen-effects iframe'));
	const frame = hosted(page);
	await frame.waitForFunction(() => !!window.SSO && !!window.SSO.momentState);
	await send(page, raid('Long Raid', 3));
	await playing(frame);
	await send(page, { action: 'eventOverlayControl', surface: 'alerts', board: 'default', command: 'skip' });
	await page.waitForFunction(() => !document.querySelector('.alert-card'), null, { timeout: 4000 });
	await frame.waitForFunction(() => document.getElementById('sso-root').children.length === 0, null, { timeout: 4000 });
	assert.strictEqual((await frames(page))[0].shown, false);
	assert.deepStrictEqual(errors, []);
	await page.close();
}

// In a stack, Skip removes the newest card: only that card's moment is cancelled, the one playing carries on.
async function testStackedSkipKeepsOtherMoments(context, baseUrl) {
	const media = baseUrl + '/overlays/view.html?t=raid&length=5';
	const { page, errors } = await openAlerts(context, baseUrl, 'stack&limit=5&effect1type=raid&effect1media=' + encodeURIComponent(media));
	await page.waitForFunction(() => document.querySelector('#alert-screen-effects iframe'));
	const frame = hosted(page);
	await frame.waitForFunction(() => !!window.SSO && !!window.SSO.momentState);
	await send(page, raid('Playing Crew', 5));
	await playing(frame);
	await send(page, raid('Skipped Crew', 9));
	await page.waitForFunction(() => document.querySelectorAll('.alert-card').length === 2);
	await send(page, { action: 'eventOverlayControl', surface: 'alerts', board: 'default', command: 'skip' });
	await page.waitForFunction(() => document.querySelectorAll('.alert-card').length === 1);
	assert(/Playing Crew/.test(await page.evaluate(() => document.getElementById('alert-stage').textContent)), 'the newest card went');
	assert.strictEqual((await frames(page))[0].shown, true, 'the first moment is still on screen');
	assert(/Playing Crew/i.test(await frame.evaluate(() => document.getElementById('sso-root').textContent)));
	assert(!(await sent(page)).some(m => m.ssoStop), 'and was not told to stop');
	// It runs to its end, and the skipped card's moment never plays.
	await page.waitForFunction(() => document.querySelector('#alert-screen-effects iframe').style.display === 'none', null, { timeout: 15000 });
	await page.waitForTimeout(800);
	assert.deepStrictEqual((await sent(page)).filter(m => m.ssoPlay).map(m => m.ssoPlay.name), ['Playing Crew']);
	assert.deepStrictEqual(errors, []);
	await page.close();
}

// A stack that remembers its rows restores them at start, before most of the page's script has run. A row whose
// rule has a moment must come back (without replaying the moment) and the saved history must survive.
async function testRestoredStackKeepsItsHistory(context, baseUrl) {
	const media = 'https://socialstream.ninja/overlays/view.html?t=raid';
	const key = 'ssn-event-board:alerts:restore-test:default';
	const seed = page => page.addInitScript(([storageKey, row]) => {
		if (window.parent === window && !localStorage.getItem(storageKey)) { localStorage.setItem(storageKey, JSON.stringify([Object.assign({ at: Date.now() - 5000 }, row)])); }
	}, [key, { payload: raid('Saved Crew', 12), pinned: false }]);
	seed.live = true;
	const { page, errors } = await openAlerts(context, baseUrl, 'stack&remember&session=restore-test&effect1type=raid&effect1media=' + encodeURIComponent(media), seed);
	await page.waitForSelector('.alert-card', { timeout: 5000 });
	assert(/Saved Crew/.test(await page.evaluate(() => document.getElementById('alert-stage').textContent)), 'the saved row is back');
	const saved = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey) || '[]'), key);
	assert.strictEqual(saved.length, 1, 'the saved history is intact');
	assert.strictEqual(saved[0].payload.chatname, 'Saved Crew');
	assert.strictEqual((await sent(page)).filter(m => m.ssoPlay).length, 0, 'a restored row does not replay its moment');
	assert.deepStrictEqual(errors, []);
	await page.evaluate(storageKey => localStorage.removeItem(storageKey), key);
	await page.close();
}

async function testOnlyStudioLinksAreFramed(context, baseUrl) {
	const cases = [
		'https://example.com/overlays/view.html?t=raid',
		baseUrl + '/dock.html?session=x',
		baseUrl + '/overlays/view.html',
		baseUrl + '/themes/overlays/view.html?t=raid',
		baseUrl + '/overlays/view.html/x?t=raid',
		'https://socialstream.ninja/somewhere/overlays/view.html?t=raid',
		'https://user:pass@socialstream.ninja/overlays/view.html?t=raid',
		'javascript:alert(1)//overlays/view.html?t=raid',
		baseUrl + '/overlays/editor.html?t=raid'
	];
	for (const media of cases) {
		const { page, errors } = await openAlerts(context, baseUrl, 'effect1type=follow&effect1media=' + encodeURIComponent(media));
		await send(page, follow('Someone'));
		await page.waitForSelector('.alert-card');
		assert.strictEqual((await frames(page)).length, 0, 'not framed: ' + media);
		assert.deepStrictEqual(errors, []);
		await page.close();
	}
	// The public viewer page is accepted from anywhere; a rejected link is still usable as ordinary media.
	const open = await openAlerts(context, baseUrl, 'effect1type=follow&effect1media=' + encodeURIComponent('https://socialstream.ninja/overlays/view.html?t=raid#x'));
	const list = await frames(open.page);
	assert.strictEqual(list.length, 1);
	assert.strictEqual(list[0].src, 'https://socialstream.ninja/overlays/view.html?t=raid&hosted=1');
	await open.page.close();
	// With media hidden, a Studio link is not played either.
	const hidden = await openAlerts(context, baseUrl, 'hidemedia&effect1type=follow&effect1media=' + encodeURIComponent(baseUrl + '/overlays/view.html?t=raid'));
	await send(hidden.page, follow('Someone'));
	await hidden.page.waitForSelector('.alert-card');
	assert.strictEqual((await frames(hidden.page)).length, 0, 'hidemedia turns screen moments off');
	await hidden.page.close();
}

async function testHostedPageAlone(context, baseUrl) {
	// &hosted opened directly (not inside another page) behaves like the ordinary overlay.
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(String(error && error.stack || error)));
	await page.goto(baseUrl + '/overlays/view.html?t=raid&hosted=1&raider=Solo', { waitUntil: 'load' });
	await page.waitForFunction(() => !!document.querySelector('.mo-card.on'), null, { timeout: 5000 });
	assert.deepStrictEqual(errors, []);
	await page.close();
}

// A template id lives in people's saved OBS links: no two templates may share one, and a new pack must not take an old id.
async function testTemplateIdsAreUnique(context, baseUrl) {
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(String(error && error.stack || error)));
	page.on('console', message => { if (message.type() === 'error' && /used twice/.test(message.text())) { errors.push(message.text()); } });
	await page.goto(baseUrl + '/overlays/index.html', { waitUntil: 'load' });
	const info = await page.evaluate(() => {
		const ids = SSO.list().map(def => def.id);
		return { count: ids.length, unique: new Set(ids).size, toast: SSO.get('toast').name, clink: SSO.get('clink').name, engines: SSO.ENGINE_LIST.map(e => e[0]) };
	});
	assert.deepStrictEqual(errors, []);
	assert.strictEqual(info.unique, info.count, 'every template id is used once');
	assert.strictEqual(info.toast, 'Achievement pop-up', 'the old toast link still opens the achievement pop-up');
	assert.strictEqual(info.clink, 'A toast: glasses clink');
	assert.strictEqual(new Set(info.engines).size, info.engines.length, 'every background id is used once');
	await page.close();
}

async function main() {
	const { server, baseUrl } = await startServer();
	const browser = await chromium.launch({ headless: true });
	const context = await makeContext(browser);
	await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
	try {
		await testRaidMoment(context, baseUrl);
		await testStackedBurstAndClear(context, baseUrl);
		await testSkipStopsTheMoment(context, baseUrl);
		await testStackedSkipKeepsOtherMoments(context, baseUrl);
		await testRestoredStackKeepsItsHistory(context, baseUrl);
		await testOnlyStudioLinksAreFramed(context, baseUrl);
		await testHostedPageAlone(context, baseUrl);
		await testTemplateIdsAreUnique(context, baseUrl);
	} finally {
		await context.close();
		await browser.close();
		await new Promise(resolve => server.close(resolve));
	}
	console.log('overlay studio hosted-moment tests passed');
}

main().catch(error => {
	console.error(error.stack || error);
	process.exit(1);
});
