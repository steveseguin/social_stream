'use strict';
// Ported from beta featured-routing.test.cjs: real Featured startup and Dock sender.
// No network, browser profile or live session is used by these contract tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const root = path.resolve(__dirname, '../candidate');
const popup = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');
const featured = fs.readFileSync(path.join(root, 'featured.html'), 'utf8');
const dock = fs.readFileSync(path.join(root, 'dock.html'), 'utf8');
function extract(source, names) {
    const found = new Map();
    const scripts = source === popup ? [source] : [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
    for (const script of scripts) {
        const ast = acorn.parse(script, { ecmaVersion: 'latest' });
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
    return names.map(name => { assert(found.has(name), name); return found.get(name); }).join('\n');
}
const sender = extract(dock, ['sendDataP2P']);
const dockTransport = dock.slice(dock.indexOf('var conCon = 1;'), dock.indexOf('var conConExtension = 1;'));
const transport = featured.slice(featured.indexOf('var conCon = 1;'), featured.indexOf('var onlyshowdonos = false;'));


function receiver(url) {
    const messages = [], sockets = [];
    const params = new URL(url).searchParams;
    const c = vm.createContext({ URLSearchParams, urlParams: params, roomID: 'fixture', pseudodock: params.has('autoshow'),
        console: { log() {}, error() {} }, setTimeout() {}, clearTimeout() {}, thisLabel: 'overlay',
        SocialStreamLocalServer: { getWebSocketUrl: () => 'ws://127.0.0.1:' + (params.get('localserverport') || '3000') },
        processData(data) { messages.push(data); return null; },
        WebSocket: function(url) { this.url = url; this.send = raw => { this.join = JSON.parse(raw); };
            this.addEventListener = (event, callback) => { this.receive = callback; }; sockets.push(this); }
    });
    vm.runInContext(transport, c);
    sockets.forEach(socket => socket.onopen());
    return { sockets, messages, deliver(channel, payload) {
        sockets.filter(s => s.join.in === channel).forEach(s => s.receive({ data: JSON.stringify(payload) }));
    } };
}
function dockSender(url, receive) {
    const params = new URL(url).searchParams, sockets = [], commands = [], timers = [];
    const c = vm.createContext({ blockMessageSelecting: false, blockMessageSelecting2: false, blockMessageSelecting3: false,
        singlefeaturedwriter: false, syncDocks: false, iframes: [], console: { log() {}, error() {} }, lastMessageClass: 'selected',
        urlParams: params, roomID: 'fixture', featuredMode: params.has('featuredmode'), thisLabel: '', URLSearchParams,
        setTimeout(callback) { timers.push(callback); return timers.length; }, clearTimeout() {},
        processInput(data) { commands.push(data); return true; },
        document: { querySelectorAll: () => [] },
        WebSocket: function(url) {
            this.url = url; this.readyState = 1;
            this.send = raw => {
                const packet = JSON.parse(raw);
                if (packet && packet.join) this.join = packet;
                else if (!(packet && packet.callback)) receive.deliver(this.join.out, packet);
            };
            this.close = () => { this.readyState = 3; };
            this.addEventListener = (event, callback) => { this.receive = callback; };
            sockets.push(this);
        } });
    c.window = c;
    vm.runInContext(fs.readFileSync(path.join(root, 'js/local-server-url.js'), 'utf8'), c);
    vm.runInContext(dockTransport + '\n' + sender, c);
    sockets.forEach(socket => socket.onopen());
    return { c, sockets, commands, timers };
}
function select(url, payload, receive) {
    dockSender(url, receive).c.sendDataP2P(payload);
}

// These are direct saved-URL contracts. Generated links/presets are covered
// separately by the native unpacked-extension smoke test.
for (let flags = 0; flags < 8; flags++) {
    for (const local of [false, true]) {
        const query = ['server', 'server2', 'server3'].filter((key, i) => flags & (1 << i)).join('&') +
            (local ? '&localserver&localserverport=4567' : '');
        for (const auto of [false, true]) {
            test('saved links: ' + (query || 'P2P') + (auto ? ' autoshow' : ' manual'), () => {
                const r = receiver('https://socialstream.ninja/featured.html?session=fixture&' + query + (auto ? '&autoshow' : ''));
                if (!flags) { assert.equal(r.sockets.length, 0); return; }
                const channel = auto ? (flags & 1 ? 1 : flags & 2 ? 4 : 1) : 2;
                assert.equal(r.sockets[0].join.in, channel);
                if (local) assert.equal(r.sockets[0].url, 'ws://127.0.0.1:4567');
                r.deliver(channel === 4 ? 2 : 4, {chatmessage: 'other feed'});
                assert.equal(r.messages.length, 0);
                if (auto) r.deliver(channel, {chatmessage: 'automatic'});
                else select('https://socialstream.ninja/dock.html?session=fixture&' + query, {chatmessage: 'clicked'}, r);
                assert.equal(r.messages[0].contents.chatmessage, auto ? 'automatic' : 'clicked');
                if (auto) r.deliver(channel, false);
                else select('https://socialstream.ninja/dock.html?session=fixture&' + query, false, r);
                assert.equal(r.messages[1].contents, false);
            });
        }
    }
}

test('old extension URLs deliver selections and clear without enabling Dock API commands', () => {
    for (const query of ['server2', 'server3', 'server2&server3', 'server2&server3&localserver&localserverport=4567']) {
        const r = receiver('https://socialstream.ninja/featured.html?session=fixture&' + query);
        const publisher = dockSender('https://socialstream.ninja/dock.html?session=fixture&' + query, r);
        assert.equal(publisher.c.socketserver, false, 'existing API connection stays disabled');
        assert.equal(publisher.sockets.length, 1);
        assert.equal(publisher.sockets[0].receive, undefined, 'selection publisher cannot dispatch incoming commands');
        assert.equal(publisher.sockets[0].onmessage, undefined);
        r.deliver(4, { chatmessage: 'unselected capture' });
        assert.equal(r.messages.length, 0);
        publisher.c.sendDataP2P({ chatmessage: 'old extension selection' });
        publisher.c.sendDataP2P(false);
        assert.equal(r.messages[0].contents.chatmessage, 'old extension selection');
        assert.equal(r.messages[1].contents, false);
    }
});

test('explicit API links retain commands, including Featured-mode Dock input', () => {
    for (const query of ['server', 'server&server2&server3', 'server&featuredmode']) {
        const publisher = dockSender('https://socialstream.ninja/dock.html?session=fixture&' + query, { deliver() {} });
        assert.equal(publisher.c.socketserverFeatured, false);
        assert.equal(publisher.sockets.length, 1);
        assert.equal(publisher.sockets[0].join.in, query.includes('featuredmode') ? 2 : 1);
        publisher.sockets[0].receive({ data: JSON.stringify({ action: 'getQueueSize' }) });
        assert.equal(publisher.commands.length, 1);
    }
});

test('selection publisher reconnects and does not prevent P2P sends while disconnected', () => {
    const r = receiver('https://socialstream.ninja/featured.html?session=fixture&server2&server3');
    const publisher = dockSender('https://socialstream.ninja/dock.html?session=fixture&server2&server3', r);
    const p2p = [];
    publisher.c.iframes.push({connectedPeers:{peer:'overlay'},contentWindow:{postMessage:message=>p2p.push(message)}});
    publisher.sockets[0].readyState = 3;
    publisher.sockets[0].onclose();
    publisher.c.sendDataP2P({chatmessage:'P2P while reconnecting'});
    assert.equal(p2p.length, 1);
    publisher.timers[0]();
    publisher.sockets[1].onopen();
    publisher.c.sendDataP2P({chatmessage:'reconnected'});
    assert.equal(r.messages[0].contents.chatmessage, 'reconnected');
});
