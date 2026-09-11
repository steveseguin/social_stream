const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function functions(file, names) {
    const source = read(file);
    const scripts = file.endsWith('.html') ? [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]) : [source];
    const found = new Map();
    for (const script of scripts) {
        let ast;
        try { ast = acorn.parse(script, { ecmaVersion: 'latest' }); } catch (_) { continue; }
        function visit(node) {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'FunctionDeclaration' && names.includes(node.id.name)) found.set(node.id.name, script.slice(node.start, node.end));
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) value.forEach(visit);
                else if (value && typeof value === 'object') visit(value);
            }
        }
        visit(ast);
    }
    return names.map(name => { assert(found.has(name), 'Missing ' + file + ':' + name); return found.get(name); }).join('\n');
}

function relayContext() {
    const sockets = [];
    const context = { URLSearchParams, console, setTimeout, clearTimeout, sockets,
        addEventListener() {},
        WebSocket: function (url) { this.url = url; this.sent = []; this.send = value => this.sent.push(JSON.parse(value)); sockets.push(this); }
    };
    context.window = context; context.self = context;
    vm.createContext(context);
    vm.runInContext(read('js/local-server-url.js'), context);
    return context;
}

test('direct captured-chat relay works hosted, locally, and at explicit endpoints', () => {
    const api = relayContext().SocialStreamLocalServer;
    for (const query of ['server2', 'server2&localserver&localserverport=4567', 'server2=ws%3A%2F%2Ffixture.invalid%3A4567&localserver']) {
        const config = api.getChatRelayConfig(new URLSearchParams(query));
        assert.equal(config.enabled, true, query);
        assert.equal(config.in, 4);
        assert.equal(config.out, 3);
        assert.equal(config.url, query.includes('fixture') ? 'ws://fixture.invalid:4567' : query.includes('localserver') ? 'ws://127.0.0.1:4567' : 'wss://io.socialstream.ninja/extension');
    }
    const explicitApi = api.getChatRelayConfig(new URLSearchParams('server=ws%3A%2F%2Fapi.invalid&server2&localserver'));
    assert.equal(explicitApi.url, 'ws://api.invalid');
    assert.equal(explicitApi.in, 1);
    assert.equal(api.getChatRelayConfig(new URLSearchParams('server3')).enabled, false);
    assert.equal(api.getChatRelayConfig(new URLSearchParams('localserver')).enabled, false);
});

test('legacy Featured relay receives selections and clear on hosted/custom routes', () => {
    for (const query of ['server', 'server=ws%3A%2F%2Ffixture.invalid&localserver', 'server2']) {
        const c = relayContext(), received = [];
        assert.equal(c.SocialStreamLocalServer.connectLocalRelay(new URLSearchParams(query), 'fixture', value => received.push(value), true), true);
        const socket = c.sockets[0]; socket.onopen();
        assert.equal(socket.sent[0].in, query === 'server2' ? 4 : 2);
        if (query.includes('fixture.invalid')) assert.equal(socket.url, 'ws://fixture.invalid');
        socket.onmessage({ data: JSON.stringify({ target: 'another-label', contents: { chatmessage: 'excluded' } }) });
        socket.onmessage({ data: JSON.stringify({ contents: { chatmessage: 'selected' } }) });
        socket.onmessage({ data: JSON.stringify({ contents: false }) });
        assert.equal(received.length, 2);
        assert.equal(received[1].contents, false);
    }
});

test('Map counts mirrored deliveries once while preserving repeated real messages', () => {
    const country = { count: 0 };
    const c = { settings: { multiVote: true }, ready: true, voters: new Map(), uniqueVoters: new Set(), totalEntries: 0,
        shouldAcceptVotes: () => true, isCountryAllowed: () => true, ensureCountryEntry: () => country,
        ensurePlaceEntry: () => ({ count: 0 }), getPlaceKey: () => 'CA', getPlaceName: () => 'Canada',
        buildVoterKey: () => 'fixture', resolveCountry: () => ({ key: 'CA', code: 'CA', name: 'Canada' }),
        debugLog() {}, updateVisuals() {}
    };
    c.window = c;
    vm.createContext(c);
    vm.runInContext(read('shared/overlay-control-transport.js') + '\n' + read('js/transport-dedupe.js') + '\nvar transportDeliveryDedupe = SocialStreamTransportDedupe.create();\n' + functions('map.html', ['processInput', 'handleChatMessage', 'registerVote']), c);
    const message = { id: 1, type: 'youtube', chatname: 'Fixture', chatmessage: 'Canada' };
    c.processInput({ ...message }, 'p2p'); c.processInput({ ...message }, 'extension');
    assert.equal(country.count, 1);
    c.processInput({ ...message, id: 2 }, 'extension'); c.processInput({ ...message, id: 2 }, 'p2p');
    assert.equal(country.count, 2);
    const idless = { ...message }; delete idless.id;
    c.processInput({ ...idless }, 'p2p'); c.processInput({ ...idless }, 'extension');
    c.processInput({ ...idless }, 'p2p'); c.processInput({ ...idless }, 'extension');
    assert.equal(country.count, 4);
});

function controlContext() {
    const c = { console, crypto: require('node:crypto').webcrypto, streamID: 'fixture', settings: {},
        isExtensionOn: true, timerStateInitialized: false, overlayControlPending: new Map(),
        pollControlState: null, mapControlState: null, overlayStateEpoch: 'host', overlayStateSequence: 0,
        overlayStateSnapshots: new Map(), addEventListener() {} };
    c.window = c;
    vm.createContext(c);
    const source = read('background.js');
    const constants = ['POLL_CONTROL_KEYS', 'MAP_CONTROL_KEYS'].map(name => source.match(new RegExp('const ' + name + ' = \\[.*?\\];', 's'))[0]).join('\n');
    vm.runInContext(read('shared/overlay-control-transport.js') + '\n' + constants + '\n' + functions('background.js', ['pollControlSettings', 'prepareOverlayControl', 'handleOverlayControlRequest']), c);
    return c;
}

test('control IDs distinguish repeat commands, reject mirrors and exclude other targets', () => {
    const c = controlContext();
    for (const [target, data] of [['poll', {cmd:'resetpoll'}], ['map', {cmd:'resetmap'}],
        ['timer', {timer:{currentMs:1000}}], ['ticker', {ticker:[]}], ['spotify', {spotify:{}}],
        ['tipjar', {cmd:'resettipjar'}], ['alerts', {action:'clearAlerts'}], ['bot', {action:'clearBotOverlay'}]]) {
        const first = c.prepareOverlayControl(data, target), second = c.prepareOverlayControl(data, target);
        assert.notEqual(first.ssnControl.id, second.ssnControl.id);
        assert.equal(c.SSNOverlayControl.accept(first, 'unrelated'), false);
        assert.equal(c.SSNOverlayControl.accept(first, target), true);
        assert.equal(c.SSNOverlayControl.accept(first, target), false);
        assert.equal(c.SSNOverlayControl.accept(second, target), true);
    }
});

test('snapshots recover a missed round once and reject stale state without exposing private settings', () => {
    const c = controlContext();
    c.settings = { pollQuestion: {textsetting:'Fixture'}, mapTitle: {textsetting:'Map'}, privateApiKey:'never broadcast' };
    for (const target of ['poll', 'map']) {
        const tracker = c.SSNOverlayControl.createStateTracker();
        const field = target + 'State';
        const initial = c.prepareOverlayControl({settings:c.settings}, target);
        assert.equal(initial.settings.privateApiKey, undefined);
        assert.equal(tracker(initial[field]).reset, false);
        c.prepareOverlayControl({cmd:target === 'poll' ? 'resetpoll' : 'resetmap'}, target);
        const packets = [], socket = {send: value => packets.push(JSON.parse(value))};
        c.handleOverlayControlRequest({ssnControlRequest:{target,client:'viewer'}},socket,3,true);
        assert.equal(packets[0].out, 7);
        assert.equal(packets[0].ssnControl.client, 'viewer');
        assert.equal(packets[0].settings.privateApiKey, undefined);
        assert.equal(tracker(packets[0][field]).reset, true);
        assert.equal(tracker(packets[0][field]).reset, false);
        assert.equal(tracker(initial[field]).accept, false);
        const restarted = {...packets[0][field],epoch:'new-host',revision:0};
        assert.equal(tracker(restarted).reset, true);
        assert.equal(tracker(packets[0][field]).accept, false);
        packets.length = 0;
        c.handleOverlayControlRequest({ssnControlRequest:{target,client:'viewer'}},socket,3,false);
        assert.equal(packets.length, 0);
    }
});

test('Events publishes Featured selection and clear on channel 2 even with P2P viewers', () => {
    const packets = [], peers = [];
    const c = { console, log() {}, WebSocket: {OPEN:1},
        socketserver: {readyState:1,send: value => packets.push(JSON.parse(value))},
        iframe: {connectedPeers:{viewer:'overlay',other:'dock'},contentWindow:{postMessage:value=>peers.push(value)}} };
    vm.createContext(c);
    vm.runInContext(functions('events.html',['featureEventMessage','sendViaWebSocketFallback']), c);
    c.featureEventMessage({id:1,chatmessage:'Selected'});
    c.featureEventMessage(false);
    assert.equal(packets.length, 2);
    assert(packets.every(packet => packet.out === 2));
    assert.equal(peers.length, 2);
    assert.equal(packets[0].content.timestamp, peers[0].sendData.overlayNinja.timestamp);
    assert.equal(packets[1].overlayNinja, false);
});

test('Waitlist keeps existing list, draw, custom message and clear payload meanings', () => {
    const sent = [], c = {settings:{},allowNewEntries:true,drawListCount:5,sendTargetP2P:(data,target)=>sent.push({data,target})};
    vm.createContext(c);
    vm.runInContext(functions('background.js',['sendWaitlistConfig']),c);
    const list = [{chatname:'Fixture'}];
    c.sendWaitlistConfig(list);
    assert.equal(sent[0].target,'waitlist');
    assert.equal(sent[0].data.waitlist,list);
    assert.equal(sent[0].data.waitlistmessage,'Type !join to join this wait list');
    c.settings.drawmode = true;
    c.sendWaitlistConfig(list,true,true);
    assert.equal(sent[1].data.winlist,list);
    assert.equal(sent[1].data.drawPoolSize,5);
    assert.equal(sent[1].data.clearWinner,true);
    c.sendWaitlistConfig(list,false);
    assert.equal(sent[2].data.waitlist,list);
    assert.equal(sent[2].data.winlist,undefined);
    c.settings.customwaitlistcommand = {textsetting:'!fixture'};
    c.settings.customwaitlistmessagetoggle = true;
    c.settings.customwaitlistmessage = {textsetting:'Enter {trigger}'};
    c.sendWaitlistConfig(null,true);
    assert.equal(sent[3].data.waitlistmessage,'Enter !fixture');
    c.sendWaitlistConfig(null,false);
    assert.equal(sent.length,4);
});

test('retained state snapshots do not restart effects, and a later state supersedes them', () => {
    const c=controlContext();
    for(const target of ['ticker','spotify','timer']) {
        const value=target==='ticker'?['Fixture']:{label:'Fixture',currentMs:1000,updatedAt:1};
        const first=c.prepareOverlayControl({[target]:value},target);
        const tracker=c.SSNOverlayControl.createStateTracker();
        assert.equal(tracker(first.ssnState).changed,true);
        const repeat=c.prepareOverlayControl({[target]:value},target);
        assert.equal(tracker(repeat.ssnState).changed,false);
        const next=c.prepareOverlayControl({[target]:target==='ticker'?['Next']:{...value,updatedAt:2}},target);
        assert.equal(tracker(next.ssnState).changed,true);
        assert.equal(tracker(first.ssnState).accept,false);
    }
});

test('Word Cloud consumes mirrored targeted words and clears only once', () => {
    const c=controlContext(),words=[];
    Object.assign(c,{countAllWords:false,addWord:word=>words.push(word),updateWordCloud(){},clearWordCloud(){words.length=0;}});
    vm.runInContext(functions('wordcloud.html',['processData']),c);
    const first=c.prepareOverlayControl({chatmessage:'fixture'},'wordcloud');
    c.processData(first);c.processData(first);
    assert.equal(words.length,1);
    const clear=c.prepareOverlayControl({state:false},'wordcloud');
    c.processData(clear);
    c.processData(c.prepareOverlayControl({chatmessage:'next'},'wordcloud'));
    c.processData(clear);
    assert.deepEqual(words,['next']);
});

test('control subscriptions honor endpoints, permissions, client targeting and reconnect without replaying actions', () => {
    for(const [query,url,out] of [
        ['server2','wss://io.socialstream.ninja/extension',3],
        ['server','wss://io.socialstream.ninja/api',1],
        ['server2&localserver&localserverport=4567','ws://127.0.0.1:4567',3],
        ['server2=ws%3A%2F%2Fcustom.invalid&localserver','ws://custom.invalid',3],
        ['server=ws%3A%2F%2Fapi.invalid&server2=ws%3A%2F%2Fchat.invalid','ws://api.invalid',1]
    ]) {
        const c=relayContext(),received=[];
        c.setInterval=()=>1;c.clearInterval=()=>{};c.setTimeout=fn=>{c.reconnect=fn;return 1;};
        vm.runInContext(read('shared/overlay-control-transport.js'),c);
        c.SSNOverlayControl.connect(new URLSearchParams(query),'fixture,unused','poll',data=>received.push(data));
        const socket=c.sockets[0];socket.readyState=1;socket.onopen();
        assert.equal(socket.url,url);assert.equal(socket.sent[0].out,out);assert.equal(socket.sent[0].in,7);assert.equal(socket.sent[0].join,'fixture');
        assert.equal(socket.sent[1].ssnControlRequest.target,'poll');
        const client=socket.sent[1].ssnControlRequest.client;
        socket.onmessage({data:JSON.stringify({ssnControl:{id:'x',target:'poll',client:'different'}})});
        assert.equal(received.length,0);
        socket.onmessage({data:JSON.stringify({ssnControl:{id:'x',target:'poll',client,reply:out},settings:{}})});
        assert.equal(received.length,1);assert.equal(socket.sent[2].out,out);
        socket.onclose();c.reconnect();
        const next=c.sockets[1];next.readyState=1;next.onopen();
        assert.equal(next.sent[1].ssnControlRequest.client,client);
        assert.equal(next.sent[1].cmd,undefined);
    }
    const c=relayContext();
    vm.runInContext(read('shared/overlay-control-transport.js'),c);
    c.SSNOverlayControl.connect(new URLSearchParams('localserver'),'fixture','poll',()=>{});
    assert.equal(c.sockets.length,0);
});

test('Giveaway Manager ignores unrelated display acknowledgements before the host result', () => {
    const source=read('shared/giveaway/control.js');
    const start=source.indexOf('socket.onmessage = function (event) {');
    const end=source.indexOf('socket.onerror =',start);
    assert(start!==-1 && end>start);
    const replies=[],c={socket:{},pending:new Map([['fixture',value=>replies.push(value)]]),console};
    vm.runInNewContext(source.slice(start,end),c);
    for(const result of [undefined,true,false]) c.socket.onmessage({data:JSON.stringify({callback:{get:'fixture',result}})});
    assert.equal(replies.length,0);
    c.socket.onmessage({data:JSON.stringify({type:'commandResult',result:{request:'fixture',ok:true,payload:{ok:true,giveaway:{count:1}}}})});
    assert.equal(replies.length,1);
    assert.equal(replies[0].giveaway.count,1);
    c.socket.onmessage({data:JSON.stringify({callback:{get:'fixture',result:{ok:false,error:'Host declined'}}})});
    assert.equal(replies[1].error,'Host declined');
});

test('every host route-switch combination respects relay permissions and keeps P2P controls served', async () => {
    const c=controlContext(),sent=[];
    Object.assign(c,{
        setTimeout:fn=>setTimeout(fn,0),clearTimeout,
        socketserver:{readyState:1,send:value=>sent.push({route:'api',packet:JSON.parse(value)})},
        socketserverDock:{readyState:1,send:value=>sent.push({route:'extension',packet:JSON.parse(value)})},
        ninjaBridge:null,connectedPeers:{fixture:'poll'},
        iframe:{contentWindow:{postMessage:packet=>sent.push({route:'p2p',packet})}}
    });
    vm.runInContext(functions('background.js',['sendOverlayControlRelay','trySendTargetP2P']),c);
    for(const target of ['poll','actions'])for(let flags=0;flags<8;flags++){
        c.settings={server2:!!(flags&1),server3:!!(flags&2),socketserver:!!(flags&4)};
        c.connectedPeers.fixture=target;sent.length=0;
        const packet=c.prepareOverlayControl(target==='poll'?{cmd:'resetpoll'}:{actionType:'showText',text:'Fixture'},target);
        assert.equal(await c.trySendTargetP2P(packet,target),true);
        assert.equal(sent.filter(x=>x.route==='p2p').length,1,'P2P '+target+' flags '+flags);
        assert.equal(sent.filter(x=>x.route==='api').length,flags&4?1:0);
        assert.equal(sent.filter(x=>x.route==='extension').length,(flags&1)||(target==='actions'&&(flags&2))?1:0);
        for(const item of sent.filter(x=>x.route!=='p2p'))assert.equal(item.packet.ssnControl.id,packet.ssnControl.id);
    }
    c.settings={server2:true,socketserver:true,disablehost:true};sent.length=0;
    await c.sendOverlayControlRelay(c.prepareOverlayControl({cmd:'resetpoll'},'poll'),'poll');
    assert.equal(sent.length,0,'disabled host must not publish controls');
    c.settings.disablehost=false;c.isExtensionOn=false;
    await c.sendOverlayControlRelay(c.prepareOverlayControl({cmd:'resetpoll'},'poll'),'poll');
    assert.equal(sent.length,0,'disabled extension must not publish controls');
});
