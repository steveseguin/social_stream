'use strict';

// Run: node tests/overlay-studio-obs.test.cjs
// Overlay Studio pieces that are driven by OBS alone (window.obsstudio events), with no SSN session:
// the pets, the BRB timer, the show rundown and the stream recap card.
const assert = require('assert');
const { chromium } = require('playwright');
const { startServer, makeContext } = require('./tipjar-count-goals.test.cjs');

// Stands in for the object OBS gives a browser source.
function fakeObs(state) {
	window.obsstudio = {
		pluginVersion: 'test',
		getStatus: cb => cb({ streaming: !!state.streaming, recording: false, recordingPaused: false, replaybuffer: false, virtualcam: false }),
		getCurrentScene: cb => cb({ name: state.scene, width: 1920, height: 1080 })
	};
}
async function open(context, url, state) {
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', error => errors.push(String(error && error.stack || error)));
	await page.addInitScript(fakeObs, state || { scene: 'Just Chatting', streaming: false });
	await page.setViewportSize({ width: 1280, height: 260 });
	await page.goto(url, { waitUntil: 'load', timeout: 15000 });
	return { page, errors };
}
const fire = (page, name, detail) => page.evaluate(([n, d]) => { window.dispatchEvent(new CustomEvent(n, { detail: d || {} })); }, [name, detail]);
const bubbles = page => page.evaluate(() => Array.from(document.querySelectorAll('.pet-bubble.on')).map(el => el.textContent));
const napping = page => page.locator('.pet-pos.nap').count();
const drawn = page => page.evaluate(() => Array.from(document.querySelectorAll('.pet-pos canvas')).map(cv => {
	const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
	let n = 0;
	for (let i = 3; i < data.length; i += 4) { if (data[i] > 0) { n++; } }
	return n;
}));

async function testPets(context, baseUrl) {
	const { page, errors } = await open(context, baseUrl + '/overlays/view.html?t=pets&every=0&flies=0&animal2=dog&coat2=husky');
	await page.waitForSelector('.pet-pos canvas');
	assert.strictEqual(await page.locator('.pet-pos').count(), 2, 'two pets');
	assert.strictEqual(await napping(page), 2, 'pets start asleep');
	await page.waitForTimeout(400);
	(await drawn(page)).forEach(pixels => assert(pixels > 800, 'each pet is drawn on its canvas'));

	// A scene with no special meaning startles them awake.
	await fire(page, 'obsSceneChanged', { name: 'Webcam' });
	await page.waitForFunction(() => document.querySelectorAll('.pet-pos.nap').length === 0, null, { timeout: 4000 });
	assert((await bubbles(page)).some(text => text === '!' || text === '?'), 'startled bubble');

	// Going live: celebration with the configured text, confetti and a party hat.
	await fire(page, 'obsStreamingStarted');
	await page.waitForFunction(() => Array.from(document.querySelectorAll('.pet-bubble.on')).some(el => /live/i.test(el.textContent)), null, { timeout: 4000 });
	assert(await page.locator('.pet-fx.conf').count() > 0, 'confetti on going live');

	// Scene names are understood: BRB means zoomies, an ending scene means goodbye and bed.
	await fire(page, 'obsSceneChanged', { name: 'Be Right Back' });
	await page.waitForFunction(() => Array.from(document.querySelectorAll('.pet-bubble.on')).some(el => el.textContent === 'brb!'), null, { timeout: 4000 });
	await fire(page, 'obsSceneChanged', { name: 'Ending' });
	await page.waitForFunction(() => Array.from(document.querySelectorAll('.pet-bubble.on')).some(el => /bye/.test(el.textContent)), null, { timeout: 4000 });
	await page.waitForFunction(() => document.querySelectorAll('.pet-pos.nap').length === 2, null, { timeout: 25000 });

	// Replay saved wakes them for a trick, then they go back to bed.
	await fire(page, 'obsReplaybufferSaved');
	await page.waitForFunction(() => Array.from(document.querySelectorAll('.pet-bubble.on')).some(el => /clip/.test(el.textContent)), null, { timeout: 4000 });
	assert.deepStrictEqual(errors, []);
	await page.close();

	// Your own rule beats the built-in meanings: hide during gameplay, come back afterwards.
	const hide = await open(context, baseUrl + '/overlays/view.html?t=pets&every=0&flies=0&sleepy=0&scenerules=' + encodeURIComponent('Gameplay|hide'));
	await hide.page.waitForSelector('.pet-pos canvas');
	const offstage = () => hide.page.evaluate(() => {
		const box = document.querySelector('.pet-pos canvas').getBoundingClientRect();
		return box.left > window.innerWidth - 40 || box.right < 40;
	});
	await fire(hide.page, 'obsSceneChanged', { name: 'Gameplay' });
	await hide.page.waitForFunction(() => { const box = document.querySelector('.pet-pos canvas').getBoundingClientRect(); return box.left + box.width / 2 > window.innerWidth + 40 || box.left + box.width / 2 < -40; }, null, { timeout: 20000 });
	await fire(hide.page, 'obsSceneChanged', { name: 'Just Chatting' });
	await hide.page.waitForFunction(() => { const box = document.querySelector('.pet-pos canvas').getBoundingClientRect(); const x = box.left + box.width / 2; return x > 40 && x < window.innerWidth - 40; }, null, { timeout: 20000 });
	assert.strictEqual(typeof await offstage(), 'boolean');
	assert.deepStrictEqual(hide.errors, []);
	await hide.page.close();

	// Every animal, plus a link saved before the redesign, loads and draws without errors.
	const links = ['cat', 'dog', 'bunny', 'fox', 'raccoon', 'redpanda', 'capybara'].map(animal => 't=pets&preview&animal=' + animal + '&hat=party&bed=box');
	links.push('t=pets&animal=dog&coat=husky&every=2&sleepy=0&line=plain&linecolor=7cc4e8&toy=bone&font=Rajdhani');
	links.push('t=pets&animal=nosuchanimal&coat=nosuchcoat&animal2=cat&coat2=golden');
	for (const query of links) {
		const one = await open(context, baseUrl + '/overlays/view.html?' + query);
		await one.page.waitForSelector('.pet-pos canvas');
		await one.page.waitForTimeout(1600);
		(await drawn(one.page)).forEach(pixels => assert(pixels > 500, 'pet drawn for ' + query));
		assert.deepStrictEqual(one.errors, [], query);
		await one.page.close();
	}
}

async function testSceneTimer(context, baseUrl) {
	const { page, errors } = await open(context, baseUrl + '/overlays/view.html?t=scenetimer', { scene: 'Gameplay', streaming: true });
	await page.waitForSelector('.sct');
	assert(await page.evaluate(() => document.querySelector('.sct').classList.contains('off')), 'hidden outside the BRB scene');
	await fire(page, 'obsSceneChanged', { name: 'BRB' });
	await page.waitForFunction(() => !document.querySelector('.sct').classList.contains('off'));
	assert.strictEqual(await page.textContent('.sct-label'), 'Away for');
	assert.match(await page.textContent('.sct-time'), /^00:0[0-2]$/);
	await page.waitForFunction(() => document.querySelector('.sct-time').textContent === '00:02', null, { timeout: 5000 });
	await fire(page, 'obsSceneChanged', { name: 'Gameplay' });
	await page.waitForFunction(() => document.querySelector('.sct').classList.contains('off'));
	await fire(page, 'obsSceneChanged', { name: 'Be Right Back' });
	await page.waitForFunction(() => !document.querySelector('.sct').classList.contains('off'));
	assert.match(await page.textContent('.sct-time'), /^00:0[01]$/, 'starts over on each visit');
	assert.deepStrictEqual(errors, []);
	await page.close();

	const down = await open(context, baseUrl + '/overlays/view.html?t=scenetimer&mode=down&minutes=0.1&when=', { scene: 'Anything', streaming: true });
	await down.page.waitForSelector('.sct');
	assert.strictEqual(await down.page.textContent('.sct-label'), 'Back in');
	assert.match(await down.page.textContent('.sct-time'), /^00:0[4-6]$/);
	await down.page.waitForFunction(() => document.querySelector('.sct').classList.contains('done'), null, { timeout: 10000 });
	assert.strictEqual(await down.page.textContent('.sct-time'), 'Back any second…');
	assert.deepStrictEqual(down.errors, []);
	await down.page.close();
}

async function testRundown(context, baseUrl) {
	const { page, errors } = await open(context, baseUrl + '/overlays/view.html?t=rundown', { scene: 'Just Chatting', streaming: true });
	await page.waitForSelector('.rd-item');
	const state = () => page.evaluate(() => Array.from(document.querySelectorAll('.rd-item')).map(el => el.classList.contains('cur') ? 'cur' : el.classList.contains('done') ? 'done' : '-').join(' '));
	await page.waitForFunction(() => document.querySelectorAll('.rd-item.cur').length === 1);
	assert.strictEqual(await state(), '- cur - - -');
	await fire(page, 'obsSceneChanged', { name: 'Gameplay - Ranked' });
	assert.strictEqual(await state(), '- done cur - -');
	assert.match(await page.textContent('.rd-item.cur .rd-time'), /^00:0\d$/);
	await fire(page, 'obsSceneChanged', { name: 'Some unlisted scene' });
	assert.strictEqual(await state(), '- done done - -');
	await fire(page, 'obsSceneChanged', { name: 'ENDING' });
	assert.strictEqual(await state(), '- done done - cur');
	// survives the source being reloaded
	await page.reload({ waitUntil: 'load' });
	await page.waitForSelector('.rd-item');
	await fire(page, 'obsSceneChanged', { name: 'Ending' });
	assert.strictEqual(await state(), '- done done - cur');
	await fire(page, 'obsStreamingStarted');
	assert.strictEqual(await state(), '- - - - cur', 'a new stream clears the ticks');
	assert.strictEqual(await page.evaluate(() => { const item = document.querySelector('.rd-item'); item.querySelector('.rd-name').textContent = '<b>x</b>'; return item.querySelectorAll('b').length; }), 0);
	assert.deepStrictEqual(errors, []);
	await page.close();

	const xss = await open(context, baseUrl + '/overlays/view.html?t=rundown&title=' + encodeURIComponent('<img src=x onerror=window.pwned=1>') + '&items=' + encodeURIComponent('<img src=x onerror=window.pwned=1>|chat'), { scene: 'Chat', streaming: true });
	await xss.page.waitForSelector('.rd-item');
	assert.strictEqual(await xss.page.locator('.rd img').count(), 0);
	assert.strictEqual(await xss.page.evaluate(() => window.pwned), undefined);
	assert.deepStrictEqual(xss.errors, []);
	await xss.page.close();
}

async function testRecap(context, baseUrl) {
	const { page, errors } = await open(context, baseUrl + '/overlays/view.html?t=recap&key=test' + Date.now(), { scene: 'Gameplay', streaming: true });
	await page.waitForSelector('.rc');
	assert(await page.evaluate(() => document.querySelector('.rc').classList.contains('off')), 'hidden until the ending scene');
	await fire(page, 'obsSceneChanged', { name: 'Just Chatting' });
	await fire(page, 'obsReplaybufferSaved');
	await fire(page, 'obsSceneChanged', { name: 'Gameplay' });
	await page.waitForTimeout(1200);
	await fire(page, 'obsSceneChanged', { name: 'Ending' });
	await page.waitForFunction(() => !document.querySelector('.rc').classList.contains('off'));
	await page.waitForTimeout(1900);
	const stats = await page.evaluate(() => Array.from(document.querySelectorAll('.rc-stat')).map(el => el.querySelector('.rc-lab').textContent + '=' + el.querySelector('.rc-val').textContent));
	assert.match(stats[0], /^live=\d+s$/);
	assert.strictEqual(stats[1], 'scene changes=3');
	assert.strictEqual(stats[2], 'replay saved=1');
	assert.strictEqual(stats[3], 'most time in=Gameplay');
	assert.strictEqual(await page.textContent('.rc-title'), 'Thanks for watching!');
	// stays up after the stream stops, even on another scene
	await fire(page, 'obsStreamingStopped');
	await fire(page, 'obsSceneChanged', { name: 'Offline card' });
	assert(!(await page.evaluate(() => document.querySelector('.rc').classList.contains('off'))), 'still shown once the stream has stopped');
	assert.deepStrictEqual(errors, []);
	await page.close();
}

async function main() {
	const { server, baseUrl } = await startServer();
	const browser = await chromium.launch({ headless: true });
	const context = await makeContext(browser);
	// The overlays must not need anything from the network to work.
	await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
	try {
		await testPets(context, baseUrl);
		await testSceneTimer(context, baseUrl);
		await testRundown(context, baseUrl);
		await testRecap(context, baseUrl);
	} finally {
		await context.close();
		await browser.close();
		await new Promise(resolve => server.close(resolve));
	}
	console.log('overlay studio OBS tests passed');
}

main().catch(error => {
	console.error(error.stack || error);
	process.exit(1);
});
