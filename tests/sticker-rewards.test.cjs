const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const catalog = require('../shared/stickers/catalog.js');
const Rewards = require('../shared/stickers/rewards.js');
const root = path.join(__dirname, '..');
const message = (id = '1', extra = {}) => Object.assign({ id, chatname: 'Fixture', type: 'youtube', tid: 123, chatmessage: '!sticker rocket' }, extra);
function fixture(overrides = {}) {
    const config = { enabled: true, packs: ['arcade', 'cozy', 'chaos'] };
    const calls = { debit: 0, refund: 0, prepare: 0, sent: [] };
    let balance = 500;
    const points = {
        async spendPoints(name, type, cost) { calls.debit++; calls.account = [name, type]; if (balance < cost) return { success: false }; balance -= cost; return { success: true, remaining: balance }; },
        async refundPoints(name, type, cost) { calls.refund++; balance += cost; return { success: true }; }
    };
    const options = Object.assign({ settings: () => config, pointsEnabled: () => true, hasReceiver: () => true,
        assetUrl: image => 'file:///fixture/' + image, prepare: async () => { calls.prepare++; }, points: async () => points,
        send: async payload => { calls.sent.push(payload); return true; } }, overrides);
    return { config, calls, points, service: new Rewards(options), balance: () => balance };
}
test('Rewards are off by default; disabled points, bots and event traffic never spend', async () => {
    assert.equal(catalog.config().enabled, false);
    assert.deepEqual(catalog.rewards({}), []);
    for (const extra of [{ bot: true }, { private: true }, { reflection: true }, { event: 'superchat' }, { chatmessage: '!spend 100 coffee' }]) {
        const f = fixture(); assert.equal(await f.service.process(message('1', extra)), null); assert.equal(f.calls.debit, 0);
    }
    const off = fixture({ pointsEnabled: () => false }); assert.equal(await off.service.process(message()), null);
    const disabled = fixture(); disabled.config.enabled = false; assert.equal(await disabled.service.process(message()), null);
});
test('Only host-selected packs and direct HTTPS custom media are redeemable', async () => {
    for (const url of ['javascript:alert(1)', 'http://example.com/a.gif', 'https://giphy.com/gifs/example', 'https://user:pass@example.com/a.png', 'https://example.com/a.svg']) assert.equal(catalog.mediaUrl(url), '');
    assert.equal(catalog.mediaUrl('https://media.giphy.com/media/fixture/giphy.gif'), 'https://media.giphy.com/media/fixture/giphy.gif');
    const f = fixture(); f.config.packs = [];
    assert.equal((await f.service.process(message())).success, false); assert.equal(f.calls.debit, 0);
    f.config.custom = [{ id: 'custom-hype', name: 'Hype', url: 'https://example.com/hype.gif', cost: 40 }];
    assert.equal((await f.service.process(message('2', { chatmessage: '!sticker custom-hype' }))).success, true);
    assert.equal(f.balance(), 460); assert.equal(f.calls.sent[0].contentimg, 'https://example.com/hype.gif');
});
test('Costs and time limits cannot become negative, zero, infinite or unbounded', () => {
    const config = catalog.config({ duration: 9999, gap: -1, userCooldown: 0, stickerCooldown: Infinity, packs: ['arcade'], prices: { arcade: -100 } });
    assert.equal(config.duration, 15); assert.equal(config.gap, 1); assert.equal(config.userCooldown, 5); assert.equal(config.stickerCooldown, 20);
    assert.equal(catalog.rewards(config)[0].cost, 1);
});
test('Offline overlay and failed image preflight leave the balance untouched', async () => {
    for (const options of [{ hasReceiver: () => false }, { prepare: async () => { throw new Error('404'); } }]) {
        const f = fixture(options); assert.equal((await f.service.process(message())).success, false); assert.equal(f.balance(), 500); assert.equal(f.calls.debit, 0);
    }
});
test('One successful display spends once and preserves the canonical event contract', async () => {
    const f = fixture(); assert.equal((await f.service.process(message())).success, true);
    assert.equal(f.balance(), 400); assert.deepEqual(f.calls.account, ['Fixture', 'youtube']);
    const payload = f.calls.sent[0]; assert.equal(payload.event, 'sticker'); assert.equal(payload.type, 'youtube'); assert.equal(payload.platform, 'youtube');
    assert.equal(payload.chatmessage, ''); assert.equal(payload.textonly, true); assert.equal(payload.meta.sticker.cost, 100);
    assert.equal(payload.contentimg, 'media/stickers/rocket.webp'); assert.equal(payload.hasDonation, undefined);
    assert.equal(await f.service.process(message()), null); assert.equal(f.calls.debit, 1);
});
test('Insufficient balance never sends a reward', async () => {
    const f = fixture(); f.config.prices = { arcade: 1000 };
    assert.equal((await f.service.process(message())).success, false); assert.equal(f.balance(), 500); assert.equal(f.calls.sent.length, 0);
});
test('Concurrent messages cannot double-spend during asynchronous image loading', async () => {
    let finish;
    const f = fixture({ prepare: () => new Promise(resolve => { finish = resolve; }) });
    const first = f.service.process(message());
    assert.equal((await f.service.process(message('2', { chatname: 'Another' }))).success, false);
    finish(); assert.equal((await first).success, true); assert.equal(f.calls.debit, 1);
});
test('Turning off the feature or changing prices while loading prevents a debit', async () => {
    for (const change of [f => { f.config.enabled = false; }, f => { f.config.prices = { arcade: 200 }; }]) {
        let finish; const f = fixture({ prepare: () => new Promise(resolve => { finish = resolve; }) });
        const first = f.service.process(message()); change(f); finish();
        assert.equal((await first).success, false); assert.equal(f.calls.debit, 0);
    }
});
test('Global, per-viewer and per-sticker cooldowns all reject without charging', async () => {
    const f = fixture(); await f.service.process(message());
    assert.equal((await f.service.process(message('2', { chatname: 'Another', chatmessage: '!sticker coffee' }))).success, false);
    f.service.nextAt = 0;
    assert.equal((await f.service.process(message('3', { chatmessage: '!sticker coffee' }))).success, false);
    assert.equal((await f.service.process(message('4', { chatname: 'Another' }))).success, false);
    assert.equal((await f.service.process(message('5', { chatname: 'Another', chatmessage: '!sticker coffee' }))).success, true);
    assert.equal(f.calls.debit, 2);
});
test('Failed or unconfirmed delivery refunds exactly once', async () => {
    for (const send of [async () => false, async () => { throw new Error('Disconnected'); }]) {
        const f = fixture({ send }); const result = await f.service.process(message());
        assert.equal(result.success, false); assert.match(result.message, /returned/); assert.equal(f.balance(), 500); assert.equal(f.calls.refund, 1); assert.equal(f.service.busy, false);
    }
});
test('Leaderboard notification failure cannot misreport a successful redemption', async () => {
    const f = fixture({ changed: () => { throw new Error('Fixture'); } });
    assert.equal((await f.service.process(message())).success, true); assert.equal(f.calls.refund, 0);
});
test('Refund write failure is reported honestly and never retried as a second refund', async () => {
    const f = fixture({ send: async () => false }); let count = 0;
    f.points.refundPoints = async () => { count++; throw new Error('Expected fixture write failure'); };
    const result = await f.service.process(message()); assert.match(result.message, /Ask the host/); assert.equal(count, 1);
});
test('Menu requests are throttled and never spend points', async () => {
    const f = fixture(); const menu = await f.service.process(message('1', { chatmessage: '!stickers' }));
    assert.match(menu.message, /rocket \(100\)/);
    assert.equal(await f.service.process(message('2', { chatmessage: '!stickers' })), null); assert.equal(f.calls.debit, 0);
});
test('Large custom menus fit source-chat limits and expose the next page', async () => {
    const f = fixture();
    f.config.custom = Array.from({ length: 12 }, (_, i) => ({ id: 'custom-' + 'long-name-'.repeat(2) + i, name: 'Custom', cost: 1000000, url: 'https://example.com/a.gif' }));
    const first = await f.service.process(message('1', { chatmessage: '!stickers' }));
    assert.ok(first.message.length < 450); assert.match(first.message, /!stickers 2/);
    const second = await f.service.process(message('2', { chatmessage: '!stickers 2' }));
    assert.ok(second.message.length < 450); assert.match(second.message, /custom-/); assert.equal(f.calls.debit, 0);
});
test('Public page links and assets resolve locally and all 126 ideas are present', () => {
    for (const file of ['docs/inspiration.html', 'docs/sticker-gallery.html', 'stickers.html']) {
        const html = fs.readFileSync(path.join(root, file), 'utf8');
        for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
            if (/^(https?:|data:)/.test(match[1])) continue;
            const target = path.resolve(root, path.dirname(file), match[1].split(/[?#]/)[0]);
            assert.ok(fs.existsSync(target), file + ': ' + match[1]);
        }
    }
    assert.equal((fs.readFileSync(path.join(root, 'docs/inspiration.html'), 'utf8').match(/class="idea"/g) || []).length, 126);
});
test('Pack assets are covered by extension resources and browser code parses as ES2020', () => {
    const all = catalog.rewards({ packs: catalog.packs.map(pack => pack.id) });
    assert.equal(all.length, 18);
    assert.equal(new Set(all.map(reward => reward.id)).size, 18);
    assert.equal(catalog.rewards({ packs: ['arcade', 'cozy', 'chaos'] }).length, 9, 'Existing selections do not enable new packs');
    for (const pack of catalog.packs) {
        const asset = path.join(root, 'media/stickers', pack.image);
        assert.ok(fs.existsSync(asset), pack.image);
        assert.equal(pack.rewards.filter(reward => reward.motion === 'still').length, 1);
        if (pack.image.endsWith('.svg')) assert.doesNotMatch(fs.readFileSync(asset, 'utf8'), /<script|<foreignObject|\bhref\s*=|\bonload\s*=/i);
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    assert.ok(JSON.stringify(manifest.web_accessible_resources).includes('shared/stickers/*'));
    assert.ok(JSON.stringify(manifest.web_accessible_resources).includes('media/stickers/*'));
    const acorn = require('acorn');
    for (const file of fs.readdirSync(path.join(root, 'shared/stickers')).filter(f => f.endsWith('.js'))) acorn.parse(fs.readFileSync(path.join(root, 'shared/stickers', file), 'utf8'), { ecmaVersion: 2020 });
});
test('Only the matching receipt from a sticker peer confirms delivery; timeout fails closed', async () => {
    let options, timeout, packet;
    const context = vm.createContext({ console, URL, Map, Promise, Date, location: { href: 'file:///fixture/background.html' },
        settings: { stickerRewards: { enabled: true } }, isExtensionOn: true,
        connectedPeers: { player: 'stickers', dock: 'dock' }, getBooleanSettingValue: () => true,
        SSNStickers: catalog, SSNStickerRewards: function (given) { options = given; this.process = async () => null; },
        setTimeout(callback) { timeout = callback; return 1; }, clearTimeout() {},
        sendTargetP2P: async payload => { packet = payload; return true; }
    });
    context.window = context;
    vm.runInContext(fs.readFileSync(path.join(root, 'shared/stickers/background.js'), 'utf8'), context);
    await context.processStickerReward(message());
    let finished = false;
    const result = options.send({ meta: { sticker: { redemptionId: 'receipt-1' } } }).then(sent => { finished = true; return sent; });
    await Promise.resolve();
    assert.equal(packet.meta.sticker.redemptionId, 'receipt-1');
    context.receiveStickerReceipt({ meta: { sticker: { redemptionId: 'receipt-1', success: true } } }, 'dock');
    context.receiveStickerReceipt({ meta: { sticker: { redemptionId: 'wrong', success: true } } }, 'player');
    await Promise.resolve(); assert.equal(finished, false);
    context.receiveStickerReceipt({ meta: { sticker: { redemptionId: 'receipt-1', success: true } } }, 'player');
    assert.equal(await result, true);
    const missing = options.send({ meta: { sticker: { redemptionId: 'receipt-2' } } });
    timeout(); assert.equal(await missing, false);
});

test('A rendered sticker acknowledges its sender through the viewing connection', async () => {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.addInitScript(() => {
            window.receipts = [];
            window.addEventListener('message', event => {
                if (event.data && event.data.fixtureReceipt) window.receipts.push(event.data.fixtureReceipt);
            });
        });
        const payload = { event: 'sticker', chatname: 'Viewer', meta: { sticker: {
            id: 'rocket', name: 'Rocket', redemptionId: 'rendered-receipt',
            expiresAt: Date.now() + 30000, duration: 2
        } } };
        await page.route('https://vdo.socialstream.ninja/**', route => route.fulfill({
            contentType: 'text/html',
            // A viewing connection replies over rpcs; pcs addresses viewers
            // of the overlay itself, where the original sender is not present.
            body: `<script>
                addEventListener('message', function (event) {
                    var command = event.data;
                    if (command.type === 'rpcs' && command.UUID === 'publisher') {
                        parent.postMessage({ fixtureReceipt: command.sendData.overlayNinja }, '*');
                    }
                });
                parent.postMessage({ UUID: 'publisher', dataReceived: { overlayNinja: ${JSON.stringify(payload)} } }, '*');
            </script>`
        }));
        await page.goto(require('node:url').pathToFileURL(path.join(root, 'stickers.html')).href + '?session=fixture');
        await page.locator('.ssn-sticker.is-visible').waitFor({ timeout: 10000 });
        await page.waitForFunction(() => window.receipts.length === 1, null, { timeout: 3000 });
        assert.deepEqual(await page.evaluate(() => window.receipts[0]), {
            action: 'stickerReceipt', meta: { sticker: { redemptionId: 'rendered-receipt', success: true } }
        });
    } finally {
        await browser.close();
    }
});
