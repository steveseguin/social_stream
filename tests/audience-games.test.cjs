const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {Game, clue} = require('../games/audience-engine.js');
const root = path.join(__dirname, '..');
const msg = (text, name = 'Viewer', extra = {}) => Object.assign({chatname:name, type:'youtube', chatmessage:text, textonly:true}, extra);
function fixture(mode) { let time = 10000; return {game:new Game(mode, {now:()=>time, random:()=>0}), advance(n) {time += n;}}; }
test('Code clues account for repeated digits without double counting', () => {
    assert.deepEqual(clue('1123','1211'),{exact:1,misplaced:2});
    assert.deepEqual(clue('1234','4321'),{exact:0,misplaced:4});
    assert.deepEqual(clue('1111','1111'),{exact:4,misplaced:0});
});
test('Signal ignores unrelated traffic, spam, duplicate guesses and duplicate message delivery', () => {
    const {game,advance} = fixture('signal');
    for (const extra of [{bot:true},{private:true},{reflection:true},{event:'donation'}]) assert.equal(game.input(msg('!code 1234','A',extra)),false);
    for (const text of ['hello','!code 0000','!code 123456','!code 1234 extra','!start','!code <b>1234</b>']) assert.equal(game.input(msg(text)),false);
    assert.equal(game.phase,'waiting');
    assert.equal(game.input(msg('!code 1234','A',{id:'one'})),true);
    assert.equal(game.input(msg('!code 2345','A')),false);
    advance(5000);
    assert.equal(game.input(msg('!code 2345','B',{id:'one'})),false);
    assert.equal(game.input(msg('!code 1234','B')),false);
    assert.equal(game.input(msg('!code 2345','B',{id:'two'})),true);
    assert.equal(game.history.length,2);
});
test('Signal ends on solve or elapsed deadline and cannot accept late guesses', () => {
    const f = fixture('signal');
    assert.equal(f.game.input(msg('!code 1111')),true); assert.equal(f.game.phase,'result');
    f.game.next(); assert.equal(f.game.phase,'waiting'); assert.equal(f.game.round,2);
    f.game.input(msg('!code 1234')); f.advance(90000);
    assert.equal(f.game.input(msg('!code 1111')),false); assert.match(f.game.result,/code was 1111/);
});
test('Quest keeps one changeable vote per platform account, rejects unavailable routes and resolves ties', () => {
    const f = fixture('quest');
    assert.equal(f.game.input(msg('!vote 1')),true); f.advance(1000);
    assert.equal(f.game.input(msg('!vote 2')),true); assert.equal(f.game.votes.size,1);
    assert.equal(f.game.input(msg('!vote 1','Viewer',{type:'twitch'})),true);
    f.advance(30000); f.game.tick(); assert.equal(f.game.phase,'result'); assert.match(f.game.result,/Tie/);
    f.game.next(); f.game.supplies=0;
    assert.equal(f.game.input(msg('!vote 1')),false); assert.equal(f.game.phase,'waiting');
    assert.equal(f.game.input(msg('!vote 2')),true);
});
test('Quest advances all five chapters and resets its ephemeral expedition', () => {
    const f=fixture('quest');
    for(let i=0;i<5;i++) { assert.equal(f.game.stage,i); f.game.input(msg('!vote 2')); f.advance(30000); f.game.tick(); f.game.next(); }
    assert.equal(f.game.stage,0); assert.equal(f.game.supplies,4); assert.equal(f.game.discoveries,0); assert.equal(f.game.users.size,0);
});
test('Round state stays bounded under many unique chatters', () => {
    const f=fixture('quest');
    for(let i=0;i<1100;i++) f.game.input(msg('!vote 1','Player'+i));
    assert.equal(f.game.users.size,1000); assert.equal(f.game.votes.size,1000);
});
test('Browser scripts retain Chrome 80 syntax and popup links exist', () => {
    const acorn=require('acorn');
    for(const file of ['games/audience-engine.js','games/audience-page.js']) acorn.parse(fs.readFileSync(path.join(root,file),'utf8'),{ecmaVersion:2020});
    const popup=fs.readFileSync(path.join(root,'popup.html'),'utf8');
    for(const page of ['signallock','crowdquest']) {assert.ok(popup.includes('games/'+page+'.html')); assert.ok(fs.existsSync(path.join(root,'games',page+'.html')));}
});
test('Real pages render safely, isolate demos, receive only their bridge, and support host pause', async () => {
    const {chromium}=require('playwright'), browser=await chromium.launch({headless:true});
    try {
        const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
        await page.route('https://vdo.socialstream.ninja/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated chat bridge</title>'}));
        for(const name of ['signallock','crowdquest']) {
            await page.goto(pathToFileURL(path.join(root,'games',name+'.html')).href+'?demo&session=never-connect');
            assert.equal(page.frames().length,1);
            await page.goto(pathToFileURL(path.join(root,'games',name+'.html')).href+'?session=fixture');
            await page.waitForFunction(()=>document.querySelector('iframe'));
            const payload=msg(name==='signallock'?'!code 1234':'!vote 1','<img src=x onerror=alert(1)>');
            await page.evaluate(payload=>window.postMessage({dataReceived:{overlayNinja:payload}},'*'),payload);
            assert.equal(await page.locator('#participants').innerText(),'0');
            const bridge=page.frames().find(f=>f!==page.mainFrame()); await bridge.waitForLoadState();
            await bridge.evaluate(payload=>parent.postMessage({dataReceived:{overlayNinja:[payload]}},'*'),payload);
            await page.waitForFunction(()=>document.getElementById('participants').textContent==='1');
            assert.equal(await page.locator('#history img').count(),0);
            await page.locator('#pause').click();
            await bridge.evaluate(payload=>parent.postMessage({dataReceived:{overlayNinja:payload}},'*'),msg(name==='signallock'?'!code 2345':'!vote 2','Other'));
            assert.equal(await page.locator('#participants').innerText(),'1');
            assert.equal(await page.locator('#clock-value').innerText(),'Paused');
            for(const width of [390,1280]) {await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
        }
        assert.deepEqual(errors,[]);
    } finally {await browser.close();}
});

test('WebSocket mode joins the existing relay protocol and drives a complete quest chapter', async () => {
    const {chromium}=require('playwright');
    // Reuse the WebSocket server already bundled with the browser test dependency.
    const {wsServer:WebSocketServer}=require(path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js'));
    const server=new WebSocketServer({port:0}); await new Promise(resolve=>server.on('listening',resolve));
    const browser=await chromium.launch({headless:true});
    try {
        const page=await browser.newPage();
        await page.addInitScript(()=>{const realNow=Date.now;window.timeOffset=0;Date.now=()=>realNow()+window.timeOffset;});
        let client; const joined=new Promise(resolve=>server.once('connection',socket=>{client=socket;socket.once('message',data=>resolve(JSON.parse(data)));}));
        await page.goto(pathToFileURL(path.join(root,'games/crowdquest.html')).href+'?session=private-fixture&server='+encodeURIComponent('ws://127.0.0.1:'+server.address().port));
        assert.deepEqual(await joined,{join:'private-fixture',out:2,in:1}); assert.equal(page.frames().length,1);
        client.send(JSON.stringify({content:msg('!vote <b>2</b>','A',{textonly:false})}));
        await page.waitForFunction(()=>document.getElementById('participants').textContent==='1');
        await page.locator('#pause').click();
        await page.evaluate(()=>window.timeOffset+=60000);
        await page.locator('#pause').click();
        assert.notEqual(await page.locator('#clock-value').innerText(),'Complete');
        await page.evaluate(()=>window.timeOffset+=31000);
        await page.waitForFunction(()=>!document.getElementById('result').hidden);
        assert.match(await page.locator('#result').innerText(),/Crystal field/);
        assert.equal(await page.locator('#supplies').innerText(),'3');
        assert.equal(await page.locator('#discoveries').innerText(),'2');
        await page.locator('#next').click();
        assert.equal(await page.locator('#round').textContent(),'Chapter 2 of 5');
        assert.equal(await page.locator('#participants').innerText(),'0');
        await page.locator('#restart').click();
        assert.equal(await page.locator('#round').textContent(),'Chapter 1 of 5');
        assert.equal(await page.locator('#supplies').innerText(),'4');
    } finally { await browser.close(); for(const client of server.clients)client.terminate();await new Promise(resolve=>server.close(resolve)); }
});

test('Word Chain retains its word validation, combo scoring, timer bonus and readable trail', async () => {
    const {chromium}=require('playwright'), browser=await chromium.launch({headless:true});
    try {
        const page=await browser.newPage(); await page.route('https://**',route=>route.abort());
        await page.goto(pathToFileURL(path.join(root,'games/wordchain.html')).href+'?session=isolated-fixture');
        await page.evaluate(()=>{processData({chatname:'A',type:'youtube',chatmessage:'ORANGE',textonly:true});processData({chatname:'A',type:'youtube',chatmessage:'ELEPHANT',textonly:true});});
        assert.equal(await page.locator('#word-display').innerText(),'ELEPHANT');
        assert.match(await page.locator('#score-list').innerText(),/18 pts/);
        assert.ok(await page.evaluate(()=>timeLeft>=64));
        await page.evaluate(()=>processData({chatname:'B',type:'youtube',chatmessage:'ORANGE',textonly:true}));
        assert.equal(await page.locator('.chain-word').count(),2);
        await page.evaluate(()=>{for(let i=0;i<12;i++)addWordToChain('WORD'+i,'Long viewer name');});
        assert.equal(await page.locator('.chain-word').count(),8);
        for(const width of [390,1280]) {await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
    } finally {await browser.close();}
});
