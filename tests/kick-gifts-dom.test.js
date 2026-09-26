const assert = require('assert');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { chromium } = require('playwright');

// Exercise the actual scraper and text helpers against isolated DOM fixtures.
// No accounts, live channels, or network requests are used.
const source = fs.readFileSync(path.join(__dirname, '../sources/kick.js'), 'utf8');
const declarations = acorn.parse(source, { ecmaVersion: 'latest' }).body[0].expression.callee.body.body;
const names = ['processMessageNew', 'getKickUsernameButton', 'getKickInlineMessageNode',
    'isKickMessageTextNode', 'isKickIgnoredContentNode', 'getAllContentNodes', 'escapeHtml',
    'getKickRenderedContentNode', 'getKickMessageText'];
const functions = names.map(name => {
    const node = declarations.find(item => item.type === 'FunctionDeclaration' && item.id.name === name);
    assert.ok(node, name);
    return source.slice(node.start, node.end);
}).join('\n');
const constants = declarations.filter(node => node.type === 'VariableDeclaration' &&
    node.declarations.some(item => /^KICK_MOD_ACTIONS|^KICK_MESSAGE_CONTENT_SELECTOR$/.test(item.id.name))).map(node => source.slice(node.start, node.end)).join('\n');

(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--renderer-process-limit=1', '--js-flags=--single-threaded'] });
    try {
        const page = await browser.newPage();
        await page.route('**/*', route => route.abort());
        await page.setContent('<!doctype html><body></body>');
        await page.addScriptTag({ content: `
            var settings = { excludeReplyingTo: true };
            var EMOTELIST = null, kickUsername = '', channelImg = '';
            var processedMessages = new Set(), captured = [], retries = 0;
            var chrome = { runtime: { id: 'fixture', sendMessage: function (id, packet) { captured.push(packet.message); } } };
            function getKickMessageKey(ele) { return ele.id; }
            function deleteThis() { return false; }
            function kickDebugLog() {}
            function getKickDebugRowInfo() { return {}; }
            function rememberKickProcessedMessage(id) { processedMessages.add(id); }
            function collectKickBadges() { return { chatbadges: [], member: false, mod: false }; }
            function normalizeKickChatname(name) { return name; }
            function looksLikeKickRewardMessage() { return false; }
            function scheduleKickEmptyMessageRetry() { retries++; return true; }
            ${constants}
            ${functions}
        ` });
        let count = 0;
        async function check({ text = 'Great stream!', amount = '1,000', sticker = true, icon = true, fallback = '', expected = '', event = '', textonly = false }) {
            const result = await page.evaluate(async fixture => {
                captured = []; retries = 0; processedMessages.clear();
                settings.textonlymode = fixture.textonly;
                document.body.innerHTML = '<div id="gift-fixture"><button title="FixtureViewer">FixtureViewer</button></div>';
                const row = document.body.firstElementChild;
                if (fixture.text) {
                    const message = document.createElement('span');
                    message.className = 'chat-entry-content font-normal'; message.textContent = fixture.text; row.appendChild(message);
                }
                if (fixture.fallback) {
                    const message = document.createElement('div');
                    message.className = 'flex-shrink-0 break-normal'; message.textContent = fixture.fallback; row.appendChild(message);
                }
                if (fixture.sticker) {
                    const img = document.createElement('img'); img.alt = 'sticker'; img.src = 'https://example.invalid/gift.webp'; row.appendChild(img);
                }
                if (fixture.icon) {
                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    const icon = document.createElementNS(svg.namespaceURI, 'path');
                    icon.setAttribute('d', 'M7.67318 0.0611465L3.07733 1.75287C2.86614'); svg.appendChild(icon); row.appendChild(svg);
                    const amount = document.createElement('span'); amount.textContent = fixture.amount; row.appendChild(amount);
                }
                await processMessageNew(row);
                const first = captured.slice();
                await processMessageNew(row);
                return { first, total: captured.length, retries };
            }, { text, amount, sticker, icon, fallback, textonly });
            assert.strictEqual(result.first.length, 1, 'fixture must emit a row');
            const message = result.first[0];
            assert.strictEqual(message.type, 'kick');
            assert.strictEqual(message.chatname, 'FixtureViewer');
            assert.strictEqual(message.chatmessage, text || fallback.replace('FixtureViewer', '').trim());
            assert.strictEqual(message.hasDonation, expected);
            assert.strictEqual(message.event, event);
            assert.strictEqual(message.textonly, textonly);
            assert.strictEqual(message.contentimg || '', event === 'gift' || (!text && fallback && sticker) ? 'https://example.invalid/gift.webp' : '');
            assert.strictEqual(result.total, 1, 'reprocessing must not duplicate the row');
            assert.strictEqual(result.retries, 0, 'valid gift must not wait for chat text');
            count++;
        }
        // Reduced from a real gift row captured in SSApp on 2026-09-21.
        async function checkCurrentGift({ textonly, amount = '100', text = '', sticker = true, icon = true }) {
            const result = await page.evaluate(async fixture => {
                captured = []; retries = 0; processedMessages.clear();
                settings.textonlymode = fixture.textonly;
                document.body.innerHTML = '<div id="current-gift" data-index="193"><div class="flex flex-1 gap-4"><div class="flex min-w-0 flex-1 flex-col"><div class="shrink-0 break-normal"><span class="relative inline-block"><div class="inline-flex"><button class="inline font-bold" data-prevent-expand="true">FixtureViewer</button></div></span> sent <div class="inline-flex items-center gap-1 font-semibold"><svg data-ds-icon="KicksColor"><path d="m9.63 1.07-5.17 1.9"></path></svg><span><span title="100">100</span></span></div></div></div><img alt="sticker" src="https://example.invalid/gift.webp"></div></div>';
                const row = document.body.firstElementChild;
                const svg = row.querySelector('svg');
                svg.nextElementSibling.textContent = fixture.amount;
                if (!fixture.icon) svg.remove();
                if (!fixture.sticker) row.querySelector('img').remove();
                if (fixture.text) {
                    const body = document.createElement('span');
                    body.className = 'max-w-full whitespace-pre-line';
                    body.textContent = fixture.text;
                    row.querySelector('.break-normal').parentElement.appendChild(body);
                }
                await processMessageNew(row);
                await processMessageNew(row);
                return { captured, retries };
            }, { textonly, amount, text, sticker, icon });
            if (!sticker) {
                assert.strictEqual(result.captured.length, 0, 'currency icon alone is not a gift');
            } else {
                assert.strictEqual(result.captured.length, 1, 'current gift must be emitted exactly once');
                const message = result.captured[0];
                assert.strictEqual(message.chatname, 'FixtureViewer');
                assert.strictEqual(message.chatmessage, text ? (textonly ? text : text.replace(/</g, '&lt;')) : 'sent ' + amount);
                assert.strictEqual(message.hasDonation, icon ? parseInt(amount.replace(/[,\s]/g, ''), 10) + ' KICKs' : '');
                assert.strictEqual(message.event, icon ? 'gift' : '');
                assert.strictEqual(message.contentimg, 'https://example.invalid/gift.webp');
                assert.strictEqual(message.textonly, textonly);
                assert.strictEqual(result.retries, 0);
            }
            count++;
        }
        for (const textonly of [false, true]) {
            await checkCurrentGift({ textonly });
            await checkCurrentGift({ textonly, amount: '1,000' });
            await checkCurrentGift({ textonly, text: 'Great stream! <3' });
            await checkCurrentGift({ textonly, icon: false });
            await checkCurrentGift({ textonly, sticker: false });
            await check({ textonly, expected: '1000 KICKs', event: 'gift' });
            await check({ textonly, amount: '1', expected: '1 KICK', event: 'gift' });
            await check({ textonly, amount: '10,000', expected: '10000 KICKs', event: 'gift' });
            await check({ textonly, amount: '1\u00a0000', expected: '1000 KICKs', event: 'gift' });
            await check({ textonly, amount: '100 KICKs', expected: '100 KICKs', event: 'gift' });
            await check({ textonly, amount: '1,000 KICKs', expected: '1000 KICKs', event: 'gift' });
            await check({ textonly, text: '', fallback: 'FixtureViewer sent a gift', amount: '100 KICKs', expected: '100 KICKs', event: 'gift' });
            await check({ textonly, text: '', expected: '1000 KICKs', event: 'gift' });
            await check({ textonly, text: '', fallback: 'FixtureViewer sent a gift', expected: '1000 KICKs', event: 'gift' });
            await check({ textonly, text: '', icon: false, fallback: 'FixtureViewer sent a sticker' });
            await check({ textonly, sticker: false, icon: false });
            await check({ textonly, icon: false });
            await check({ textonly, sticker: false });
            await check({ textonly, amount: 'unknown', event: 'gift' });
            await check({ textonly, amount: '', event: 'gift' });
            await check({ textonly, amount: '0', event: 'gift' });
        }
        console.log('kick-gifts-dom: ' + count + ' fixtures passed');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
