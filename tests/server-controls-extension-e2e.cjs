'use strict';
// Actual unpacked extension, captured YouTube fixture, and hosted relay.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-extension-controls-'));
const room = 'extension_controls_' + Date.now();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = (page, fn, arg) => page.waitForFunction(fn, arg, { polling: 100, timeout: 30000 });
const report = { output, room, completed: false, cases: [] };
async function run() {
    const context = await chromium.launchPersistentContext(output, { channel: 'chromium', headless: false,
        args: ['--load-extension=' + root, '--disable-extensions-except=' + root], viewport: { width: 1100, height: 850 } });
    try {
        await context.route('https://socialstream.ninja/**', async route => {
            const url = new URL(route.request().url());
            const relative = decodeURIComponent(url.pathname).replace(/^\/(?:beta\/)?/, '');
            const file = path.resolve(root, relative);
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.abort();
            const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
            return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
        });
        await context.route('https://vdo.socialstream.ninja/**', route => route.abort());
        await context.route('https://www.youtube.com/live_chat*', route => route.fulfill({ contentType: 'text/html',
            body: fs.readFileSync(path.resolve(root, '../ssapp/tests/electron/fixtures/hidden-capture.html')) }));
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        const id = new URL(worker.url()).hostname;
        let background;
        for (let n = 0; n < 150; n++) {
            background = context.pages().find(page => page.url().includes('/background.html'));
            if (background) break;
            await delay(100);
        }
        assert(background);
        await wait(background, () => window.ssappBackgroundLoadState?.status === 'ready');
        await worker.evaluate(async room => {
            await chrome.runtime.sendMessage({ cmd: 'setOnOffState', data: { value: true } });
            await chrome.runtime.sendMessage({ cmd: 'sidUpdated', streamID: room, password: 'false' });
            for (const setting of ['socketserver', 'server2', 'server3']) await chrome.runtime.sendMessage({ cmd: 'saveSetting', setting, type: setting === 'socketserver' ? 'setting' : 'both', value: true });
        }, room);
        await wait(background, () => typeof socketserver !== 'undefined' && socketserver?.readyState === 1 && socketserverDock?.readyState === 1);
        const popup = await context.newPage();
        await popup.goto('chrome-extension://' + id + '/popup.html');
        await wait(popup, () => document.getElementById('pollQuestion')?.onchange);
        const source = await context.newPage();
        await source.goto('https://www.youtube.com/live_chat?platform=youtube&manual=1');
        await delay(6000);
        const capture = async (text, name) => {
            await source.evaluate(({ text, name }) => {
                __hiddenCaptureFixture.appendRows([Date.now()]);
                const row = document.querySelector('.ssn-chat-row:last-child');
                row.querySelector('#author-name').textContent = name;
                row.querySelector('#message').textContent = text;
            }, { text, name });
        };
        await popup.evaluate(() => {
            for (const [id, value] of [['pollType', 'yesno'], ['pollQuestion', 'Extension relay question']]) {
                const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const enabled = document.querySelector('[data-setting="pollEnabled"]'); if (!enabled.checked) enabled.click();
        });
        await wait(background, () => settings.pollQuestion?.textsetting === 'Extension relay question');
        const poll = await context.newPage();
        await poll.goto('https://socialstream.ninja/poll.html?session=' + room + '&server2&pollTally');
        await poll.getByText('Extension relay question', { exact: true }).waitFor();
        await capture('yes', 'Extension Voter');
        await poll.getByText('1 votes', { exact: true }).waitFor();
        await popup.evaluate(() => document.querySelector('[data-action="closepoll"]').click());
        await poll.getByText('Extension relay question (Closed)', { exact: true }).waitFor();
        await capture('no', 'After Close');
        await delay(1000);
        assert.equal(await poll.getByText('1 votes', { exact: true }).count(), 1);
        report.cases.push('Actual extension capture, hosted Poll settings/votes/End');
        await popup.evaluate(() => { const input = document.getElementById('creditsTriggerModeSelect'); input.value = 'background'; input.dispatchEvent(new Event('change', { bubbles: true })); });
        await wait(background, () => isBackgroundCreditsModeEnabled());
        await delay(1000);
        await capture('Collected in extension background', 'Extension Credits');
        await wait(background, () => Array.from(backgroundCreditsUsers.values()).some(user => user.name === 'Extension Credits'));
        const credits = await context.newPage();
        await credits.goto(await popup.evaluate(() => document.getElementById('credits').raw));
        report.creditsUrl = credits.url();
        await delay(1500);
        await popup.evaluate(() => document.getElementById('creditsStartBtn').click());
        await credits.locator('#credits-content').getByText('Extension Credits', { exact: true }).waitFor();
        report.cases.push('Extension Credits collection and Start through hosted relay');
        await popup.evaluate(() => { const input = document.querySelector('[data-setting="hypemode"]'); if (!input.checked) input.click(); });
        const hype = await context.newPage();
        await hype.goto(await popup.evaluate(() => document.getElementById('hypemeter').raw));
        await capture('Hype from extension', 'Extension Hype');
        await hype.locator('#hype .sourceStatHolder').first().waitFor({ timeout: 25000 });
        report.cases.push('Extension Hype snapshot through hosted relay');
        const managerWindow = context.waitForEvent('page');
        await popup.evaluate(() => document.getElementById('giveaway-manage').click());
        const manager = await managerWindow;
        await wait(manager, () => document.getElementById('status')?.textContent.includes('default:'));
        await manager.locator('[data-action="startgiveaway"]').click();
        await capture('!enter', 'Extension Giveaway');
        await delay(1000);
        await manager.locator('#entries-refresh').click();
        await manager.getByText('Remove and refund', { exact: true }).waitFor();
        assert.match(await manager.locator('#entries').textContent(), /Extension Giveaway/);
        report.cases.push('Native extension Giveaway Manager remains functional');
        // These pages must receive host controls with the VDO bridge unavailable.
        const timer = await context.newPage();
        await timer.goto('https://socialstream.ninja/timer.html?session=' + room + '&server2');
        await background.evaluate(() => applyTimerAction('settimer', {label:'Relay timer',seconds:90,running:false}));
        await timer.locator('#label').getByText('Relay timer', {exact:true}).waitFor();
        const ticker = await context.newPage();
        await ticker.goto('https://socialstream.ninja/ticker.html?session=' + room + '&server2');
        await background.evaluate(() => sendTickerP2P(['Relay ticker fixture']));
        await ticker.getByText('Relay ticker fixture', {exact:true}).first().waitFor();
        await ticker.reload();
        await ticker.getByText('Relay ticker fixture', {exact:true}).first().waitFor();
        report.cases.push('Timer host state, Ticker delivery and reload recovery without P2P');
        const waitlist = await context.newPage();
        await waitlist.goto('https://socialstream.ninja/waitlist.html?session=' + room + '&server2');
        await delay(2000);
        await background.evaluate(() => sendWaitlistConfig([{chatname:'Relay Waitlist',chatmessage:'!join',type:'youtube'}]));
        await waitlist.getByText('Relay Waitlist', {exact:true}).first().waitFor();
        const map = await context.newPage();
        await map.goto('https://socialstream.ninja/map.html?session=' + room + '&server2');
        await worker.evaluate(async () => chrome.runtime.sendMessage({cmd:'saveSetting',setting:'mapTitle',type:'textsetting',value:'Relay Map'}));
        await map.locator('#title').getByText('Relay Map',{exact:true}).waitFor();
        report.cases.push('Waitlist delivery and Map settings without P2P');
        const cloud = await context.newPage();
        await cloud.goto('https://socialstream.ninja/wordcloud.html?session=' + room + '&server2');
        await delay(1500);
        assert.equal(await background.evaluate(() => sendTargetP2P({chatmessage:'relayfixture'},'wordcloud')),true);
        await cloud.locator('g.word').first().waitFor();
        const gif = await context.newPage();
        await gif.goto('https://socialstream.ninja/gif.html?session=' + room + '&server2');
        await delay(1500);
        const media='https://socialstream.ninja/media/logo.png';
        assert.equal(await background.evaluate(media => sendTargetP2P({contentimg:media},'gif'),media),true);
        await wait(gif, () => {const image=document.getElementById('mediaContent');return image && image.src.startsWith('blob:') && image.complete && image.naturalWidth>0;});
        report.cases.push('Word Cloud rendering and GIF media delivery without P2P');
        for (const [file,target,data] of [
            ['spotify-overlay.html','spotify',{spotify:{track:{name:'Relay song',artist:'Fixture'},isPlaying:false}}],
            ['tipjar.html','tipjar',{cmd:'resettipjar'}],
            ['multi-alerts.html','alerts',{action:'clearAlerts'}],
            ['bot.html','bot',{action:'clearBotOverlay'}],
            ['reactions.html','reactions',{event:'reaction',chatmessage:'❤',id:'fixture-reaction'}],
            ['confetti.html','waitlist',{drawmode:false,waitlist:[]}]
        ]) {
            const page=await context.newPage();
            await page.goto('https://socialstream.ninja/'+file+'?session='+room+'&server2');
            await page.evaluate(() => {
                window.__controlReceipts=[];
                const original=SSNOverlayControl.accept;
                SSNOverlayControl.accept=function(data,target){const accepted=original(data,target);if(data && data.ssnControl)window.__controlReceipts.push({id:data.ssnControl.id,accepted});return accepted;};
            });
            await delay(1500);
            const packet=await background.evaluate(({data,target})=>prepareOverlayControl(data,target),{data,target});
            await background.evaluate(({packet,target})=>sendTargetP2P(packet,target),{packet,target});
            await wait(page,id=>window.__controlReceipts.some(item=>item.id===id && item.accepted),packet.ssnControl.id);
            await background.evaluate(({packet,target})=>sendTargetP2P(packet,target),{packet,target});
            await wait(page,id=>window.__controlReceipts.some(item=>item.id===id && !item.accepted),packet.ssnControl.id);
            assert.equal(await page.evaluate(id=>window.__controlReceipts.filter(item=>item.id===id && item.accepted).length,packet.ssnControl.id),1);
            await page.close();
        }
        report.cases.push('Hosted control receipt and duplicate rejection: Spotify, Tip Jar, Alerts, Bot, Reactions, Confetti');
        const controller = await context.newPage();
        await controller.goto('https://socialstream.ninja/sampleapi.html?session=' + room);
        const reply = await controller.evaluate(room => new Promise((resolve, reject) => {
            const socket = new WebSocket('wss://io.socialstream.ninja/api');
            const timeout = setTimeout(() => {socket.close();reject(new Error('Negotiated reply timed out'));},15000);
            socket.onopen = () => {
                socket.send(JSON.stringify({join:room,out:1,in:2}));
                socket.send(JSON.stringify({action:'gettimerstate',get:'fixture-timer',replyFormat:'commandResult'}));
            };
            socket.onmessage = event => {const data=JSON.parse(event.data);if(data.type==='commandResult' && data.get==='fixture-timer'){clearTimeout(timeout);socket.close();resolve(data);}};
        }),room);
        assert.equal(reply.type,'commandResult');
        report.cases.push('Actual extension negotiated controller reply through hosted API');
        console.log('PASS ' + report.cases.join('; '));
        report.completed = true;
    } finally {
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        await context.close();
        console.log(output);
    }
}
run().catch(error => {
    report.error = error.stack;
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.error(error); process.exitCode = 1;
});
