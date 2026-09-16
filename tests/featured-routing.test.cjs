'use strict';
// Execute the real link generator, Featured socket startup and Dock sender.
// No network, browser profile or live session is used by these contract tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
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
const popupFunctions = extract(popup, ['getQueryParamTokenFromUrl', 'getServerParamToken', 'collectServerParamTokens',
    'isBothParamChecked', 'normalizeGeneratedPath', 'getFeaturedServerParamSupport', 'getServerParamSupportForTarget', 'targetSupportsServerParam',
    'syncSupportedServerParamsForTarget', 'updateURL', 'removeQueryParamWithValue', 'cleanURL',
    'enableServerFallbackForDockLinks', 'getServerFallbackInputState', 'setServerFallbackInputState', 'undoServerFallbackForDockLinks']);
const sender = extract(dock, ['sendDataP2P']);
const transport = featured.slice(featured.indexOf('var conCon = 1;'), featured.indexOf('var onlyshowdonos = false;'));

function links(query = '', auto = false) {
    const params = new URLSearchParams(query);
    const inputs = Object.fromEntries(['server', 'server2', 'server3'].map(key => [key, { checked: params.has(key), dataset: { both: key } }]));
    const elements = {
        dock: { raw: 'https://socialstream.ninja/dock.html?session=fixture&' + query },
        overlay: { raw: 'https://socialstream.ninja/featured.html?session=fixture&font=Lucida%20Console&' + query + (auto ? '&autoshow' : '') }
    };
    const c = vm.createContext({ URL, URLSearchParams, console, baseURL: 'https://socialstream.ninja/',
        SERVER_LINK_PARAM_NAMES: ['server', 'server2', 'server3'], FULL_SERVER_LINK_SUPPORT: { server: true, server2: true, server3: true },
        SERVER_PARAM_SUPPORT_BY_TARGET: { dock: { server: true, server2: true, server3: true }, poll: { server: true, server2: true, server3: true } },
        CHAT_OVERLAY_SERVER_PARAM_SUPPORT: { 'themes/compact-clean.html': { server: true, server2: true, server3: false } },
        NO_SERVER_LINK_SUPPORT: {}, serverFallbackUndoState: null, confirm: () => true, showServerFallbackBanner() {},
        document: { getElementById: id => inputs[id] || elements[id], querySelector: selector => {
            const match = selector.match(/data-both='([^']+)'/); return match ? inputs[match[1]] : null;
        } }
    });
    vm.runInContext(popupFunctions, c);
    c.refreshLinks = () => {
        const tokens = c.collectServerParamTokens(elements.dock);
        for (const id of ['dock', 'overlay']) c.syncSupportedServerParamsForTarget(id, elements[id], elements.dock, null, tokens);
    };
    c.updateSettings = () => c.refreshLinks();
    c.refreshLinks();
    return { c, inputs, elements };
}
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
function select(url, payload, receive) {
    const enabled = new URL(url).searchParams.has('server');
    const c = vm.createContext({ blockMessageSelecting: false, blockMessageSelecting2: false, blockMessageSelecting3: false,
        singlefeaturedwriter: false, iframes: [], console, lastMessageClass: 'selected',
        document: { querySelectorAll: () => [] }, socketserver: enabled ? { send: raw => receive.deliver(2, JSON.parse(raw)) } : false });
    vm.runInContext(sender, c);
    c.sendDataP2P(payload);
}

for (let flags = 0; flags < 8; flags++) {
    for (const local of [false, true]) {
        const query = ['server', 'server2', 'server3'].filter((key, i) => flags & (1 << i)).join('&') +
            (local ? '&localserver&localserverport=4567' : '');
        test('manual selection, raw chat and clear: ' + (query || 'P2P'), () => {
            const { elements } = links(query), r = receiver(elements.overlay.raw);
            if (!flags) { assert.equal(r.sockets.length, 0, 'keep P2P, including localserver alone'); return; }
            assert.equal(r.sockets[0].join.in, 2, 'Featured must subscribe to selections');
            if (local) assert.equal(r.sockets[0].url, 'ws://127.0.0.1:4567');
            r.deliver(4, { chatmessage: 'unselected capture' });
            r.deliver(1, { chatmessage: 'unselected API chat' });
            assert.equal(r.messages.length, 0);
            select(elements.dock.raw, { chatmessage: 'clicked' }, r);
            assert.equal(r.messages[0].contents.chatmessage, 'clicked');
            select(elements.dock.raw, false, r);
            assert.equal(r.messages[1].contents, false);
        });
        test('explicit auto-show: ' + (query || 'P2P'), () => {
            const { elements } = links(query, true), r = receiver(elements.overlay.raw);
            if (!flags) { assert.equal(r.sockets.length, 0); return; }
            const channel = flags & 2 ? 4 : 1;
            assert.equal(r.sockets[0].join.in, channel, 'auto-show keeps the incoming chat feed');
            r.deliver(channel, { chatmessage: 'automatic' });
            assert.equal(r.messages[0].contents.chatmessage, 'automatic');
        });
    }
}
test('Server Fallback creates a working manual pair and Undo restores the switches', () => {
    const { c, inputs, elements } = links();
    c.enableServerFallbackForDockLinks();
    const r = receiver(elements.overlay.raw);
    r.deliver(4, { chatmessage: 'not clicked' });
    assert.equal(r.messages.length, 0);
    select(elements.dock.raw, { chatmessage: 'clicked' }, r);
    assert.equal(r.messages[0].contents.chatmessage, 'clicked');
    c.undoServerFallbackForDockLinks();
    assert.equal(inputs.server.checked, false);
    assert.equal(inputs.server2.checked, false);
    assert.equal(inputs.server3.checked, false);
    assert.equal(receiver(elements.overlay.raw).sockets.length, 0);
});
test('manual/auto changes, disable, custom endpoints and unrelated targets', () => {
    const { c, inputs, elements } = links('server2=ws%3A%2F%2Fcustom.invalid%2Frelay&localserver');
    assert.equal(receiver(elements.overlay.raw).sockets[0].url, 'ws://custom.invalid/relay');
    assert.equal(new URL(elements.dock.raw).searchParams.get('server'), 'ws://custom.invalid/relay');
    elements.overlay.raw += '&autoshow'; c.refreshLinks();
    assert.equal(receiver(elements.overlay.raw).sockets[0].join.in, 4);
    elements.overlay.raw = elements.overlay.raw.replace('&autoshow', ''); c.refreshLinks();
    assert.equal(receiver(elements.overlay.raw).sockets[0].join.in, 2);
    assert.equal(new URL(elements.overlay.raw).searchParams.get('font'), 'Lucida Console');
    const other = { raw: 'https://socialstream.ninja/poll.html?session=fixture' };
    c.syncSupportedServerParamsForTarget('poll', other, elements.dock);
    assert.equal(new URL(other.raw).searchParams.has('server'), false, 'no implicit API route on unrelated pages');
    const chat = { raw: 'https://socialstream.ninja/themes/compact-clean.html?session=fixture' };
    c.syncSupportedServerParamsForTarget('chatoverlaytemplate', chat, elements.dock, 'themes/compact-clean.html');
    assert.equal(new URL(chat.raw).searchParams.has('server'), false, 'regular chat must keep its captured-chat route');
    assert.equal(new URL(chat.raw).searchParams.get('server2'), 'ws://custom.invalid/relay');
    inputs.server2.checked = false; c.refreshLinks();
    assert.equal(receiver(elements.overlay.raw).sockets.length, 0);
});

test('separate explicit API and chat endpoints retain their roles', () => {
    const query = 'server=ws%3A%2F%2Fapi.invalid&server2=ws%3A%2F%2Fchat.invalid&localserver';
    const manual = links(query), auto = links(query, true);
    assert.equal(receiver(manual.elements.overlay.raw).sockets[0].url, 'ws://api.invalid');
    assert.equal(new URL(manual.elements.dock.raw).searchParams.get('server'), 'ws://api.invalid');
    assert.equal(receiver(auto.elements.overlay.raw).sockets[0].url, 'ws://chat.invalid');
});
test('Fallback and Undo preserve every previous switch combination', () => {
    for (let flags = 0; flags < 8; flags++) {
        const query = ['server', 'server2', 'server3'].filter((key, i) => flags & (1 << i)).join('&');
        for (const auto of [false, true]) {
            const { c, inputs, elements } = links(query, auto);
            const before = Object.fromEntries(Object.entries(elements).map(([key, el]) => [key, [...new URL(el.raw).searchParams].sort()]));
            c.enableServerFallbackForDockLinks(); c.undoServerFallbackForDockLinks();
            for (const [key, el] of Object.entries(elements)) assert.deepEqual([...new URL(el.raw).searchParams].sort(), before[key]);
            for (const [i, key] of ['server', 'server2', 'server3'].entries()) assert.equal(inputs[key].checked, !!(flags & (1 << i)));
        }
    }
});
