const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createStaticServer, closeServer } = require('./background-overlay-compat-matrix.test.cjs');
const { configureContext, deliver } = require('./helpers/chat-security-harness.cjs');
const { routePositiveControl } = require('./helpers/name-security-controls.cjs');
const games = ['chatgarden', 'colorsymphony', 'pixelbattle', 'phraseguess', 'chaosmode', 'memorylane', 'rhythmpulse'];
const attack = 'NAME_PROBE<img src="data:image/png;base64,broken" onerror="window.__hits++">';
const names = ['A & B', 'A &amp; B', "O&#039;Brien", '&lt;Viewer&gt;', '<b>Viewer</b>', '\u{1f469}\u{1f3fd}\u200d\u{1f4bb} \u{1f1fa}\u{1f1f8}', '<tr><td>Viewer</td></tr>', '<template>Hidden</template>Viewer'];
(async () => {
    const server = await createStaticServer(); let browser, id = 600100;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext(); await configureContext(context, server.baseUrl);
        async function open(game, control) {
            const file = 'games/' + game + '.html', page = await context.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => { window.__hits = 0; });
            if (control) await routePositiveControl(page, file);
            await page.goto(server.baseUrl + '/' + file + '?session=GAME_NAMES', { waitUntil: 'domcontentloaded' });
            await page.evaluate(game => {
                if (game === 'phraseguess') { gameState.isActive = true; gameState.normalizedPhrase = 'zzzzzz'; }
                const original = processData;
                processData = function (data) {
                    const name = data.chatname; const result = original(data);
                    if (data.chatname !== name) throw Error('Changed input name');
                    window.__inputName = data.chatname; return result;
                };
            }, game);
            return { page, game, errors };
        }
        async function send(target, name, textonly = true) {
            const { page, game } = target;
            await page.evaluate(() => { window.__hits = 0; });
            const body = game === 'chatgarden' ? 'rose' : game === 'colorsymphony' ? 'red' : game === 'pixelbattle' ? 'paint red 1 1' : game === 'rhythmpulse' ? 'beat kick drum \u{1f3b5}' : 'I remember this amazing day!';
            const payload = { id: ++id, chatname: name, chatmessage: body, type: 'youtube', textonly };
            if (textonly === null) delete payload.textonly;
            await deliver(page, payload);
            await page.waitForFunction(name => window.__inputName === name, name); await page.waitForTimeout(60);
            const result = await page.evaluate(game => {
                const set = gameState.gardeners || gameState.composers || gameState.contributors || gameState.musicians;
                let keys = set ? Array.from(set) : [];
                if (game === 'pixelbattle') keys = Array.from(gameState.artists.entries());
                if (game === 'chaosmode') keys = Array.from(document.querySelectorAll('#feed-content strong')).map(el => el.textContent);
                if (game === 'phraseguess') keys = Array.from(document.querySelectorAll('#messageLog .message')).map(el => el.textContent.replace(/^.*? - /, ''));
                return { keys, hits: window.__hits, name: window.__inputName };
            }, game);
            assert.deepEqual(target.errors, [], game + ': page errors');
            assert.ok(result.keys.length, game + ': player state was exercised');
            return result;
        }
        for (const game of games) {
            const old = await open(game, true), fixed = await open(game, false);
            assert.ok((await send(old, attack)).hits, game + ': positive control');
            assert.equal((await send(fixed, attack)).hits, 0, game + ': fixed parser');
            for (const name of names) {
                const before = await send(old, name), after = await send(fixed, name);
                assert.deepEqual(after, before, game + ': player keys for ' + name);
            }
            // Repeated identical names must still reach the same player identity.
            assert.deepEqual(await send(fixed, names[0]), await send(old, names[0]), game + ': repeated player');
            await old.page.close(); await fixed.page.close();
            for (const mode of [false, null]) {
                const page = await open(game, false);
                assert.equal((await send(page, attack, mode)).hits, 0, game + ': HTML-mode name');
                await page.page.close();
            }
            console.log('PASS inert name parsing and player identity: ' + game);
        }
    } finally { if (browser) await browser.close(); await closeServer(server.server); }
})().catch(error => { console.error(error); process.exitCode = 1; });
