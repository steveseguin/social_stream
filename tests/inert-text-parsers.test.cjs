// Execute the actual extraction helpers; isolate I/O and never contact live services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const candidates = process.argv.includes('--validate-candidates');
const inert = /document\.createElement\((['"])template\1\)\.content\.appendChild\(document\.createElement\((['"])div\2\)\)/g;
const live = /document\.createElement\((['"])div\1\)/g;
function makeInert(code) { return code.replace(live, match => "document.createElement('template').content.appendChild(" + match + ')'); }
function functionCode(file, name, method = false) {
    const source = read(file), match = new RegExp('^([\\t ]*)' + (method ? '' : 'function ') + name + '\\(', 'm').exec(source);
    assert.ok(match, file + ': ' + name);
    const start = match.index, tail = source.slice(start + match[0].length);
    const end = new RegExp('^' + match[1] + '\\}', 'm').exec(tail);
    assert.ok(end, file + ': end of ' + name);
    return (method ? 'function ' : '') + source.slice(start, start + match[0].length + end.index + end[0].length).trim();
}
function block(file, start, end) {
    const source = read(file), from = source.indexOf(start), to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, file + ': parser block');
    return source.slice(from, to + end.length);
}
const cases = [];
function add(file, name, prefix = '', invoke = name + '(input)', method = false) {
    cases.push({ file, name, code: functionCode(file, name, method), prefix, invoke });
}
for (const game of ['chatwars', 'emojitower', 'treasurehunt', 'petrace', 'wordchain', 'wordstorm']) add('games/' + game + '.html', 'stripHtml');
for (const [game, variable, end, prefix, result] of [
    ['chaosmode', 'tmp', "messageText = tmp.textContent || tmp.innerText || '';", 'const data={chatmessage:input}; let messageText;', 'messageText'],
    ['rhythmpulse', 'tmp', "message = tmp.textContent || tmp.innerText || '';", 'const data={chatmessage:input}; let message;', 'message'],
    ['memorylane', 'tempDiv', "message = tempDiv.textContent || tempDiv.innerText || '';", 'let message=input;', 'message']
]) {
    const file = 'games/' + game + '.html';
    cases.push({ file, name: 'body extraction', code: block(file, 'const ' + variable + ' = ', end), prefix, invoke: result });
}
add('actions/EventFlowSystem.js', 'stripHtml', '', 'stripHtml(input)', true);
add('poll.html', 'getPlainVoteText');
add('lite/app.js', 'toPlainText');
add('chatbot.html', 'speakChatbotResponse', 'let spoken=""; window.TTS={speech:true,speak:text=>spoken=text};', '(speakChatbotResponse(input), spoken)');
for (const file of ['sources/instagram.js', 'sources/instagramlive.js']) add(file, 'getLiveCommentFingerprintText', functionCode(file, 'normalizeLiveText'));
add('sources/streamplace.js', 'stripHtmlContent');
add('sources/websocket/rumble.js', 'safeStrip');
add('sources/websocket/vpzone.js', 'stripHtml');
add('sources/websocket/whatnot.js', 'plainText', 'const data={textonly:false};');
add('streamelements-importer.js', 'stripHTML');
add('streamelements-importer.js', 'extractMessageParts');
const tiktok = 'sources/tiktok.js';
add(tiktok, 'pushMessage', 'let captured=null; window.chrome={runtime:{id:"test",lastError:null,sendMessage:(id,payload,cb)=>{captured=payload;cb();}}};', '(pushMessage({chatname:"A &amp; B",chatmessage:input,textonly:true,type:"tiktok"}),captured)');
add(tiktok, 'getTikTokGiftUpdateIdentity', functionCode(tiktok, 'normalizeTikTokText') + '\n' + functionCode(tiktok, 'normalizeTikTokNameKey'), 'getTikTokGiftUpdateIdentity({chatname:"A &amp; B",chatmessage:input,type:"tiktok",hasDonation:"2 coins"},null)');
add(tiktok, 'applyTikTokGiftDonationValue', 'const settings={}; const data={chatname:"A &amp; B",type:"tiktok",event:"gift",chatmessage:input,hasDonation:"2 coins",meta:{coinsPerGift:1}};', '(applyTikTokGiftDonationValue(data,null),data)');
add(tiktok, 'validateTikTokDonationMessage');
add(tiktok, 'parseDonationMessage', functionCode(tiktok, 'validateTikTokDonationMessage'));

const probe = '<img src="data:image/png;base64,broken" onerror="window.__parserHits++">';
const texts = ['Hello', 'A &amp; B &#128512; &lt;b&gt;', 'A < B > C', 'A "Ace"', ' \t A\u00a0 B\n C ', '\u{1f469}\u{1f3fd}\u200d\u{1f4bb} \u{1f1fa}\u{1f1f8}', '<b>bold</b><br>next', '<tr><td>table</td></tr>', '<table><tr><td>table</td></tr></table>', '<template>hidden</template>visible', '<span class="thinking">Hidden reasoning</span>Response', 'hello <img src="https://cdn.invalid/emote.png" alt="wave"> world', 'Sent <img src="https://p.tiktokcdn.com/aabbccddaabbccddaabbccddaabbccdd.webp" alt="Rose"> x2'];
// Template contents have an about:blank base URL. Preserve the old image URL
// comparison used to recover a gift's price from its source-row alt text.
const urlResolution = 'var giftImageUrl = giftImage ? giftImage.src : "";\n\t\t\ttry { giftImageUrl = new URL(giftImageUrl, document.baseURI).href; } catch (e) {}\n\t\t\t';
async function checkTikTokGiftLookups(page) {
    const source = functionCode(tiktok, 'applyTikTokGiftDonationValue');
    const oldCode = source.replace(inert, 'document.createElement($2div$2)')
        .replace(urlResolution, '').replace('img.src === giftImageUrl', 'img.src === giftImage.src');
    const fixedCode = candidates ? makeInert(oldCode)
        .replace('var sourceImage = ', urlResolution + 'var sourceImage = ')
        .replace('img.src === giftImage.src', 'img.src === giftImageUrl') : source;
    const helpers = functionCode(tiktok, 'getIdFromUrl') + '\n' + functionCode(tiktok, 'normalizeTikTokText') + '\n' + functionCode(tiktok, 'normalizeTikTokNameKey');
    const identity = functionCode(tiktok, 'getTikTokGiftUpdateIdentity');
    const oldIdentity = identity.replace(inert, 'document.createElement($2div$2)');
    const fixedIdentity = candidates ? makeInert(oldIdentity) : identity;
    const giftMapping = {'name:perfume': {coins:20}, '5658': {coins:20}, aabbccddaabbccddaabbccddaabbccdd: {coins:20}};
    let count = 0;
    for (const src of ['/gift.png', 'gift.png', '//cdn.invalid/gift.png', 'https://cdn.invalid/gift.png', 'https://cdn.invalid/aabbccddaabbccddaabbccddaabbccdd.webp']) {
        for (const meta of [{}, {giftId:'5658'}, {coinsPerGift:20}, {diamondsPerGift:2}, {tiktokGiftCount:3}, {tiktokGiftMessageId:'native-id'}, {groupId:'123',giftId:'5658',tiktokGiftSenderId:'sender-id'}]) {
            const input = {chatname:'A &amp; B',type:'tiktok',event:'gift',chatmessage:'Sent <img src="'+src+'"> x2',hasDonation:'2 gifts',meta};
            async function run(code, identityCode) {
                return page.evaluate(({code, identityCode, helpers, giftMapping, input, src}) => {
                    const ele = document.createElement('div'); ele.dataset.index = '42';
                    const img = document.createElement('img'); img.setAttribute('src', src); img.setAttribute('alt', 'Perfume'); ele.appendChild(img);
                    return new Function('data', 'ele', 'giftMapping', 'const settings={};\n'+helpers+'\n'+code+'\n'+identityCode+'\napplyTikTokGiftDonationValue(data,ele); return {data,identity:getTikTokGiftUpdateIdentity(data,ele)};')(input,ele,giftMapping);
                }, {code,identityCode,helpers,giftMapping,input,src});
            }
            const before = await run(oldCode, oldIdentity), after = await run(fixedCode, fixedIdentity);
            assert.deepEqual(after, before, 'TikTok source image, gift value and streak key: '+src+' '+JSON.stringify(meta));
            assert.equal(after.data.donoValue, meta.diamondsPerGift ? 0.02 : meta.tiktokGiftCount ? 0.6 : 0.4);
            count++;
        }
    }
    console.log('PASS '+count+' TikTok gift-price and identity comparisons, including relative URLs');
}
(async () => {
    const browser = await chromium.launch({ headless: true });
    let comparisons = 0;
    try {
        const page = await browser.newPage();
        const fixtureUrl = 'https://www.tiktok.com/@offline/live';
        await page.route('**/*', route => route.request().url() === fixtureUrl ? route.fulfill({contentType:'text/html',body:'<!doctype html>'}) : route.abort());
        await page.goto(fixtureUrl);
        for (const entry of cases) {
            const hasInert = entry.code.includes("createElement('template')") || entry.code.includes('createElement("template")');
            assert.ok(candidates || hasInert, entry.file + ': fix must be applied');
            const oldCode = entry.code.replace(inert, 'document.createElement($2div$2)');
            const fixedCode = hasInert ? entry.code : makeInert(entry.code);
            const oldPrefix = entry.prefix.replace(inert, 'document.createElement($2div$2)');
            const fixedPrefix = makeInert(oldPrefix);
            async function run(fixed, input) {
                const output = await page.evaluate(({ code, prefix, invoke, input }) => {
                    window.__parserHits = 0;
                    return new Function('input', prefix + '\n' + code + '\nreturn ' + invoke + ';')(input);
                }, { code: fixed ? fixedCode : oldCode, prefix: fixed ? fixedPrefix : oldPrefix, invoke: entry.invoke, input });
                await page.waitForTimeout(30);
                return { output, hits: await page.evaluate(() => window.__parserHits) };
            }
            const attack = entry.file === tiktok ? 'Sent ' + probe + ' x2' : 'Before ' + probe + ' after';
            const before = await run(false, attack), after = await run(true, attack);
            assert.ok(before.hits > 0, entry.file + ' / ' + entry.name + ': positive control');
            assert.equal(after.hits, 0, entry.file + ' / ' + entry.name + ': inert parser');
            assert.deepEqual(after.output, before.output, entry.name + ': extraction result');
            for (const text of texts) {
                assert.deepEqual(await run(true, text), await run(false, text), entry.file + ' / ' + entry.name + ': ' + text);
                comparisons++;
            }
            console.log('PASS ' + entry.file + ': ' + entry.name);
        }
        await checkTikTokGiftLookups(page);
        // The separate Joystick websocket client removes tags before decoding.
        // Check it without changing a parser whose execution risk was not reproduced.
        const code = read('sources/websocket/joystick.js').match(/^const strip=.*$/m)[0];
        const corpus = JSON.parse(read('tests/fixtures/xss-corpus.json'));
        for (const { input } of [...corpus, { input: probe }]) {
            await page.evaluate(({ code, input }) => { window.__parserHits=0; window.alert=window.confirm=window.prompt=()=>window.__parserHits++; new Function('input', code + '\nreturn strip(input);')(input); }, { code, input });
            await page.waitForTimeout(20);
            assert.equal(await page.evaluate(() => window.__parserHits), 0, 'Joystick websocket tag-stripping control');
        }
        console.log('PASS ' + cases.length + ' parser probes; ' + comparisons + ' compatibility comparisons; Joystick websocket control');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
