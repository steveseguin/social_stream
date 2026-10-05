'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const original = fs.readFileSync(path.join(__dirname, '../sources/websocket/rumble.js'), 'utf8');
const bootstrap = original.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(bootstrap > 0, 'Rumble bootstrap must exist');
// Keep the source functions intact; expose them without starting UI/network timers.
const source = original.slice(0, bootstrap) + `
    window.testRumble = { state, ensureRumbleEmoteCatalog, buildRumbleChatMessage, stopSseLoop,
        pollOnce, startTimers, disconnect };
})();`;
const catalog = '{name:"r+leotoast",is_subs_only:false,position:0,file:"https://example.com/toast.gif"}';
const message = ':r+leotoast::r+leotoast: \uD83D\uDC4B';

function fixture(firstResponse) {
    let now = 100000;
    let timerId = 0;
    let rejectFirst;
    let aborted = false;
    const timers = new Map();
    const requests = [];
    const window = {};
    const context = vm.createContext({
        window, URL, URLSearchParams, AbortController,
        setTimeout(callback, delay) {
            timers.set(++timerId, { callback, at: now + delay });
            return timerId;
        },
        clearTimeout(id) { timers.delete(id); },
        Date: class extends Date { static now() { return now; } },
        async fetch(url, options) {
            requests.push(url);
            if (requests.length === 1 && (firstResponse === 'hung-request' || firstResponse === 'hung-body')) {
                const pending = new Promise((resolve, reject) => {
                    rejectFirst = reject;
                    if (options.signal) options.signal.addEventListener('abort', () => {
                        aborted = true;
                        reject(new Error('Aborted'));
                    });
                });
                return firstResponse === 'hung-body' ? { ok: true, text: () => pending } : pending;
            }
            if (requests.length === 1 && firstResponse === 'network-error') {
                throw new Error('Failed to fetch');
            }
            return { ok: true, text: async () => requests.length === 1 && firstResponse === 'empty'
                ? '<html>Temporarily unavailable</html>' : catalog };
        }
    });
    vm.runInContext(source, context);
    return { ...window.testRumble, requests, timers,
        wasAborted: () => aborted,
        rejectFirst: () => rejectFirst(new Error('Old request failed')),
        advance(ms) {
            now += ms;
            for (const [id, timer] of timers) {
                if (timer.at <= now) {
                    timers.delete(id);
                    timer.callback();
                }
            }
        }
    };
}

async function flushPromises() {
    for (let i = 0; i < 20; i++) await Promise.resolve();
}

for (const failure of ['hung-request', 'hung-body']) {
    test(`Rumble times out a ${failure} and recovers without reconnecting`, async () => {
        const f = fixture(failure);
        let settled = false;
        const first = f.ensureRumbleEmoteCatalog('123').then(result => { settled = true; return result; });
        await flushPromises();
        f.advance(9999);
        await flushPromises();
        assert.equal(settled, false, 'Allow the catalog time to download');
        f.advance(1);
        await flushPromises();
        assert.equal(settled, true, 'A stalled download must finish after 10 seconds');
        assert.equal(await first, false);
        assert.equal(f.wasAborted(), true, 'Cancel the stalled browser request');
        assert.equal(f.state.sseEmoteCatalogPromise, null);
        f.advance(30000);
        assert.equal(await f.ensureRumbleEmoteCatalog('123'), true);
        assert.equal(f.buildRumbleChatMessage(message).rendered, true);
        assert.equal(f.timers.size, 0, 'Successful requests must clear their timeout');
    });
}

test('An old failed download cannot erase emotes loaded after reconnecting', async () => {
    const f = fixture('hung-request');
    const oldRequest = f.ensureRumbleEmoteCatalog('123');
    await flushPromises();
    f.stopSseLoop();
    assert.equal(await f.ensureRumbleEmoteCatalog('123'), true);
    f.rejectFirst();
    await oldRequest;
    assert.equal(f.buildRumbleChatMessage(message).rendered, true);
    assert.equal(f.timers.size, 0);
});

for (const failure of ['network-error', 'empty']) {
    test(`Rumble recovers from ${failure} without reconnecting or hammering the catalog`, async () => {
        const f = fixture(failure);
        assert.equal(await f.ensureRumbleEmoteCatalog('123'), false);
        assert.equal(f.buildRumbleChatMessage(message).chatmessage, message);
        for (let i = 0; i < 29; i++) {
            f.advance(1000);
            assert.equal(await f.ensureRumbleEmoteCatalog('123'), false);
        }
        assert.equal(f.requests.length, 1, 'Chat polling must not immediately retry every time');
        f.advance(1000);
        assert.equal(await f.ensureRumbleEmoteCatalog('123'), true, 'Retry after 30 seconds must recover');
        assert.equal(f.requests.length, 2);
        const rendered = f.buildRumbleChatMessage(message);
        assert.equal(rendered.rendered, true);
        assert.equal((rendered.chatmessage.match(/<img /g) || []).length, 2);
        assert.ok(rendered.chatmessage.endsWith(' \uD83D\uDC4B'));
        f.advance(60000);
        assert.equal(await f.ensureRumbleEmoteCatalog('123'), true);
        assert.equal(f.requests.length, 2, 'A successful catalog remains cached');
        f.state.settings.textonlymode = true;
        assert.equal(f.buildRumbleChatMessage(message).chatmessage, message);
    });
}

test('A failed stream does not delay another stream or an explicit reconnect', async () => {
    const otherStream = fixture('network-error');
    await otherStream.ensureRumbleEmoteCatalog('123');
    assert.equal(await otherStream.ensureRumbleEmoteCatalog('456'), true);
    assert.equal(otherStream.requests[1], 'https://rumble.com/chat/popup/456');

    const reconnect = fixture('network-error');
    await reconnect.ensureRumbleEmoteCatalog('123');
    reconnect.stopSseLoop();
    assert.equal(await reconnect.ensureRumbleEmoteCatalog('123'), true);
});

function pollFixture() {
    const window = {}, requests = [], timers = new Map();
    let nextTimer = 0;
    window.ninjafy = { fetchRumbleJson: () => new Promise(resolve => requests.push(resolve)), sendMessage() {} };
    vm.runInNewContext(source, { window, document: {}, URL, URLSearchParams,
        setInterval(callback, delay) { timers.set(++nextTimer, { callback, delay, type: 'interval' }); return nextTimer; },
        setTimeout(callback, delay) { timers.set(++nextTimer, { callback, delay, type: 'timeout' }); return nextTimer; },
        clearInterval(id) { timers.delete(id); }, clearTimeout(id) { timers.delete(id); }
    });
    const f = window.testRumble;
    f.state.active = true;
    f.state.cfg.apiUrl = 'https://rumble.com/live-api/fixture';
    return { ...f, requests, timers,
        fire() {
            const [id, timer] = timers.entries().next().value;
            if (timer.type === 'timeout') timers.delete(id);
            timer.callback();
        }
    };
}

test('Every consecutive Rumble rate limit honors Retry-After, then resumes ordinary polling', async () => {
    const f = pollFixture(); f.startTimers();
    for (let i = 0; i < 3; i++) {
        f.fire();
        f.requests.shift()({ ok: false, status: 429, retryAfter: '90', error: 'Rate limited' });
        await flushPromises();
        assert.deepEqual([...f.timers.values()].map(t => [t.type, t.delay]), [['timeout', 90000]]);
    }
    f.fire();
    f.requests.shift()({ ok: true, data: { livestreams: [] } });
    await flushPromises();
    assert.equal(f.state.consecutiveErrors, 0);
    assert.equal(f.state.lastSocketState, 'connected');
    assert.deepEqual([...f.timers.values()].map(t => [t.type, t.delay]), [['interval', 3000]]);
    f.disconnect(true); assert.equal(f.timers.size, 0);
});

test('Disconnect invalidates a pending Rumble response without processing its snapshot', async () => {
    const f = pollFixture(); const pending = f.pollOnce(false);
    f.disconnect(true);
    f.requests.shift()({ ok: true, data: { followers: { num_followers: 999 }, livestreams: [] } });
    assert.equal(await pending, false);
    assert.equal(f.state.lastFollowerCount, null);
    assert.equal(f.state.lastSocketState, 'disconnected');
    assert.equal(f.state.loading, false);
});
