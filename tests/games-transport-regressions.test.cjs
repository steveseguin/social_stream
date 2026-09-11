const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const acorn = require('acorn');
const {chromium} = require('playwright');
const {createStaticServer, closeServer, configureNetworkMocks} = require('./background-overlay-compat-matrix.test.cjs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function functions(file, names) {
    let source = fs.readFileSync(path.join(root, file), 'utf8');
    if (file.endsWith('.html')) source = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
    const found = new Map();
    function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'FunctionDeclaration' && names.includes(node.id.name)) found.set(node.id.name, source.slice(node.start, node.end));
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
        }
    }
    visit(acorn.parse(source, {ecmaVersion: 'latest'}));
    return names.map(name => { assert(found.has(name), name); return found.get(name); }).join('\n');
}
const message = (extra = {}) => ({id:'fixture', chatname:'Same Name', chatmessage:'hello', type:'youtube', userid:'one', textonly:true, ...extra});

test('mixed games suppress raw/wrapped mirrors, but accept distinct message IDs', () => {
    for (const file of ['games.html', 'games/chickenroyale.html']) {
        for (const wraps of [[false,false], [false,true], [true,false], [true,true]]) {
            let count = 0;
            const c = {console, URLSearchParams, urlParams:new URLSearchParams('server2'), Date, Map,
                CROSS_TRANSPORT_DEDUPE_TTL_MS:12000, recentTransportDeliveries:new Map(),
                gameState:{isActive:true,messageTimestamps:[],multiplier:1,power:0,totalPower:0},
                updateMessageRate(){}, updateDisplay(){}, createPowerParticle(){count++;}, createMessageBurst(){},
                sanitizeText:s=>s || '', G:{mode:'battle',players:new Map([[JSON.stringify(['youtube','one']),{alive:true,boost(){count++;}}]])}, AUTO_JOIN:false, announce(){}
            };
            vm.createContext(c); vm.runInContext(functions(file, ['isDuplicateTransportDelivery', 'processData']), c);
            for (const wrap of wraps) c.processData(wrap ? {content:message()} : message());
            assert.equal(count, 1, file + ' ' + wraps);
            c.processData(message({id:'second'})); assert.equal(count, 2);
        }
    }
});

test('Phrase Guess replies match the native and API contracts and retain host guards', async () => {
    const chat = [], dock = [], sent = [], logs = [];
    const host = {window:{}, settings:{}, isExtensionOn:true, handleStreamDeckDockCallback:()=>false,
        handleBridgeChunkRequest:async()=>false, getStreamDeckRemoteControlRouter:()=>require('../js/streamdeck-remote-control.js'),
        isGiveawayAction:()=>false, isCreditsRemoteAction:()=>false, sendMessageToTabs:x=>chat.push(x), sendToDestinations:x=>dock.push(x)};
    vm.createContext(host); vm.runInContext(functions('background.js', ['routeStreamDeckRemoteRequest','processIncomingRequest']), host);
    let mode = 'chat';
    const c = {demo:false, config:{botName:'Fixture Bot'}, document:{getElementById:()=>({value:mode})},
        serverUrl:'ws://fixture', chatRelay:{in:4}, socketserver:{readyState:1,send:s=>sent.push(JSON.parse(s))},
        WebSocket:{OPEN:1}, iframe:null, addMessage:s=>logs.push(s)};
    vm.createContext(c); vm.runInContext(functions('games/phraseguess.html', ['sendResponse']), c);
    c.sendResponse('chat fixture'); await host.processIncomingRequest(sent.pop()); assert.equal(chat[0].response,'chat fixture');
    mode = 'dock'; c.sendResponse('dock fixture'); const packet = sent.pop(); await host.processIncomingRequest(packet);
    assert.equal(dock.length,1); assert.equal(dock[0].chatmessage,'dock fixture'); assert.equal(dock[0].textonly,true);
    assert.equal(chat.length,1,'dock mode must not publish public chat');
    host.settings.disablehost = true; await host.processIncomingRequest(packet); assert.equal(dock.length,1);
    host.settings.disablehost = false; host.isExtensionOn = false; await host.processIncomingRequest(packet); assert.equal(dock.length,1);
    c.chatRelay.in = 2; c.sendResponse('legacy'); assert.equal(sent.pop().action,'extContent');
    mode = 'chat'; c.sendResponse('legacy'); assert.equal(sent.pop().action,'sendChat');
    c.socketserver.readyState = 3; c.sendResponse('offline'); assert.equal(sent.length,0); assert.match(logs.pop(),/unavailable/);
    assert(!logs.some(log=>/Bot sent/.test(log)), 'socket send is not confirmed delivery');
});

test('server3 remains required for Phrase Guess native replies', async () => {
    for (const allowed of [false,true]) {
        let receive, dispatched = 0;
        function Socket() { this.readyState=1; this.addEventListener=(_,fn)=>receive=fn; }
        Socket.CONNECTING=0; Socket.OPEN=1;
        const c = {settings:{server2:true,server3:allowed}, isExtensionOn:true, reconnectionTimeoutDock:null,
            socketserverDock:false, serverURLDock:'ws://fixture', streamID:'fixture', WebSocket:Socket,
            handleOverlayControlRequest:()=>false, processIncomingRequest:()=>dispatched++};
        vm.createContext(c); vm.runInContext(functions('background.js',['setupSocketDock']), c); c.setupSocketDock();
        await receive({data:JSON.stringify({action:'phraseGuessResponse',value:{type:'bot',chatname:'Bot',chatmessage:'fixture'}})});
        assert.equal(dispatched,allowed?1:0);
    }
});

test('Chicken Royale saves wins per account without guessing ownership of old name-only records', () => {
    let saved;
    const c={careerWins:{'same name':12},localStorage:{setItem:(_,value)=>saved=JSON.parse(value)}};
    vm.createContext(c); vm.runInContext(functions('games/chickenroyale.html',['getCareerWins','addCareerWin']),c);
    const first=JSON.stringify(['youtube','one']),second=JSON.stringify(['twitch','one']);
    assert.equal(c.getCareerWins(first),0); c.addCareerWin(first); c.addCareerWin(first); c.addCareerWin(second);
    assert.equal(c.getCareerWins(first),2); assert.equal(c.getCareerWins(second),1); assert.equal(saved['same name'],12);
});

test('real game pages keep same-name accounts separate and retain readable scores', async () => {
    const server = await createStaticServer(), browser = await chromium.launch({headless:true});
    try {
        const context = await browser.newContext(); await configureNetworkMocks(context);
        for (const game of ['chatwars','dancingparade','petrace','colorwars','emojitower','treasurehunt','wordchain','chickenroyale']) {
            const page = await context.newPage(), errors=[];
            page.on('pageerror', e=>errors.push(String(e)));
            await page.routeWebSocket('**', s=>s.onMessage(()=>{}));
            await page.goto(server.baseUrl+'/games/'+game+'.html?session=identityfixture&server2&v=3.52.0');
            const result = await page.evaluate(game => {
                const accounts=[{type:'youtube',userid:'one'},{type:'twitch',userid:'one'},{type:'youtube',userid:'two'}];
                if (game==='treasurehunt') { grid[0][0]={emoji:'X',name:'Fixture',value:10}; grid[0][1]=grid[0][0]; grid[0][2]=grid[0][0]; }
                for(let i=0;i<3;i++) {
                    let command={chatwars:'!red',dancingparade:'!join',petrace:'!join dog',colorwars:'!red',emojitower:'!drop',chickenroyale:'!join'}[game];
                    if(game==='wordchain') command=currentWord.slice(-1)+['ALPHA','BETA','GAMMA'][i];
                    if(game==='treasurehunt') command='!dig '+String.fromCharCode(65+i)+'1';
                    if(game==='emojitower') dropCooldown=false;
                    processData(Object.assign({chatname:'Same Name',chatmessage:command,textonly:true,id:'identity-'+i},accounts[i]));
                }
                if(game==='chatwars') return gameState.teams.red.players.size;
                if(game==='dancingparade') { processData({chatname:'Same Name',chatmessage:'!leave',textonly:true,type:'youtube',userid:'one'}); return dancers.size+1; }
                if(game==='petrace') return racers.size;
                if(game==='colorwars') return teams.red.players.size;
                if(game==='emojitower') return contributors.size;
                if(game==='treasurehunt'||game==='wordchain') return scores.size;
                return document.getElementById('roster-count').textContent;
            }, game);
            if(game==='chickenroyale') assert.match(result,/3/,game); else assert.equal(result,3,game);
            assert.deepEqual(errors,[],game);
            assert(!(await page.locator('body').innerText()).includes('["youtube"'),game+' must not display account keys');
            if (['chatwars','petrace','colorwars','wordchain'].includes(game)) {
                assert.equal(await page.evaluate(game=>{
                    if(game==='chatwars'){startNewBattle();return gameState.teams.red.players.size;}
                    if(game==='petrace'){resetRace();return racers.size;}
                    if(game==='colorwars'){startNewRound();return teams.red.players.size;}
                    startNewRound();return roundScores.size;
                },game),game==='chatwars'?1:0,game+' reset (Chat Wars retains its newest 30%)');
            }
            await page.close();
        }
        await context.close();
    } finally { await browser.close(); await closeServer(server.server); }
});

test('Spam Power reconnects its server route and continues the same round', async () => {
    const server=await createStaticServer(), browser=await chromium.launch({headless:true});
    try {
        const context=await browser.newContext(); await configureNetworkMocks(context); const page=await context.newPage(), sockets=[];
        await page.routeWebSocket('**', s=>{sockets.push(s);s.onMessage(()=>{});});
        await page.goto(server.baseUrl+'/games.html?session=reconnectfixture&server');
        await page.waitForTimeout(100); sockets[0].send(JSON.stringify(message()));
        await page.waitForFunction(()=>gameState.totalPower>0); const before=await page.evaluate(()=>gameState.totalPower);
        sockets[0].close(); await page.waitForTimeout(5400); assert.equal(sockets.length,2);
        sockets[1].send(JSON.stringify(message({id:'after'})));
        await page.waitForFunction(before=>gameState.totalPower>before,before); await context.close();
    } finally { await browser.close(); await closeServer(server.server); }
});
