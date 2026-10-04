'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const original = fs.readFileSync(process.env.RUMBLE_SOURCE_FILE || path.join(__dirname, '../sources/websocket/rumble.js'), 'utf8');
const bootstrap = original.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(bootstrap > 0);
const source = original.slice(0, bootstrap) + '\nwindow.testRumble = { state, connect, disconnect, pollOnce, startTimers };})();';
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const snapshot = (name = 'Viewer', count = 10) => ({ followers: { num_followers: count,
    recent_followers: [{ username: name, followed_on: '2026-10-04T12:00:00Z' }] }, livestreams: [] });
function fixture() {
    const requests = [], packets = [], timers = new Map();
    let timerId = 0;
    const window = { ninjafy: {
        fetchRumbleJson(url) { return new Promise((resolve, reject) => requests.push({ url,
            resolve: data => resolve({ ok: true, data }), reject })); },
        sendMessage(_id, packet) { packets.push(packet); }
    } };
    vm.runInNewContext(source, { window, document: {}, URL, URLSearchParams, console,
        setTimeout(fn, ms) { timers.set(++timerId, { fn, ms, type: 'timeout' }); return timerId; },
        setInterval(fn, ms) { timers.set(++timerId, { fn, ms, type: 'interval' }); return timerId; },
        clearTimeout(id) { timers.delete(id); }, clearInterval(id) { timers.delete(id); }
    });
    const f = window.testRumble;
    f.state.cfg.apiUrl = 'https://rumble.com/live-api/first';
    f.state.cfg.useSse = false;
    return { ...f, requests, packets, timers };
}
async function connected() {
    const f = fixture(), pending = f.connect();
    f.requests[0].resolve(snapshot()); await pending;
    return f;
}

test('current connection seeds history and forwards later polls', async () => {
    const f = await connected();
    assert.equal(f.state.active, true); assert.equal(f.state.lastSocketState, 'connected');
    assert.equal(f.packets.filter(p => p.message?.chatname).length, 0);
    const poll = f.pollOnce(false); f.requests[1].resolve(snapshot('New viewer', 11)); await poll;
    assert.equal(f.packets.filter(p => p.message?.chatname === 'New viewer').length, 1);
    f.disconnect(true); assert.equal(f.timers.size, 0);
});

test('a poll resolved after Disconnect cannot relay events or statistics', async () => {
    const f = await connected(), poll = f.pollOnce(false);
    f.disconnect(true); const before = f.packets.length;
    f.requests[1].resolve(snapshot('Late viewer', 12)); await poll;
    assert.equal(f.packets.length, before); assert.equal(f.state.lastSocketState, 'disconnected');
});

test('Disconnect while connecting cannot restore connected status or timers', async () => {
    const f = fixture(), pending = f.connect(); f.disconnect(true);
    f.requests[0].resolve(snapshot()); await pending;
    assert.equal(f.state.active, false); assert.equal(f.state.lastSocketState, 'disconnected');
    assert.equal(f.timers.size, 0); assert.equal(f.state.loading, false);
});

for (const outcome of ['success', 'failure']) {
    test('stale initial ' + outcome + ' cannot change the replacement connection', async () => {
        const f = fixture(), old = f.connect(); f.disconnect(true);
        f.state.cfg.apiUrl = 'https://rumble.com/live-api/replacement';
        const replacement = f.connect();
        assert.equal(f.requests.length, 2, 'replacement must start its own snapshot');
        assert.equal(f.requests[1].url, f.state.cfg.apiUrl);
        if (outcome === 'success') f.requests[0].resolve(snapshot('Old viewer', 999));
        else f.requests[0].reject(new Error('Old request failed'));
        await old;
        assert.equal(f.state.active, true); assert.equal(f.state.loading, true);
        assert.equal(f.state.lastSocketState, 'connecting');
        assert.equal(f.packets.filter(p => p.liveStats?.followers === 999).length, 0);
        f.requests[1].resolve(snapshot('Replacement', 20)); await replacement;
        assert.equal(f.state.lastSocketState, 'connected'); assert.equal(f.state.loading, false);
        assert.equal(f.timers.size, 1);
    });
}

test('old rejection cannot deactivate an already connected replacement', async () => {
    const f = fixture(), old = f.connect(); f.disconnect(true);
    const replacement = f.connect(); assert.equal(f.requests.length, 2);
    f.requests[1].resolve(snapshot()); await replacement;
    f.requests[0].reject(new Error('Old failure')); await old;
    assert.equal(f.state.active, true); assert.equal(f.state.lastSocketState, 'connected');
    assert.equal(f.timers.size, 1);
});

test('a queued old interval callback cannot poll a replacement connection', async () => {
    const f = await connected(), oldTick = [...f.timers.values()][0].fn;
    f.disconnect(true); const replacement = f.connect();
    f.requests[1].resolve(snapshot()); await replacement;
    oldTick(); await flush(); assert.equal(f.requests.length, 2);
});

test('an old interval rejection cannot create error state after Disconnect', async () => {
    const f = await connected(); [...f.timers.values()][0].fn();
    f.disconnect(true); const before = f.packets.length;
    const error = new Error('Throttled'); error.rateLimited = true; error.retryAfterSec = 90;
    f.requests[1].reject(error); await flush();
    assert.equal(f.packets.length, before); assert.equal(f.timers.size, 0);
    assert.equal(f.state.lastSocketState, 'disconnected');
});

test('a queued old backoff callback cannot restart polling after Disconnect', async () => {
    const f = await connected(); [...f.timers.values()][0].fn();
    const error = new Error('Throttled'); error.rateLimited = true; error.retryAfterSec = 90;
    f.requests[1].reject(error); await flush();
    const retry = [...f.timers.values()][0]; assert.equal(retry.type, 'timeout'); assert.equal(retry.ms, 90000);
    f.disconnect(true); retry.fn(); await flush();
    assert.equal(f.timers.size, 0); assert.equal(f.requests.length, 2);
});

test('a skipped overlapping poll does not report recovery before the real result', async () => {
    const f = await connected(); f.state.consecutiveErrors = 2;
    const tick = [...f.timers.values()][0].fn; tick(); tick(); await flush();
    assert.equal(f.state.consecutiveErrors, 2); assert.equal(f.requests.length, 2);
    f.requests[1].resolve(snapshot()); await flush(); assert.equal(f.state.consecutiveErrors, 0);
});
