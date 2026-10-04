'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const original = fs.readFileSync(path.join(__dirname, '../sources/websocket/rumble.js'), 'utf8');
const bootstrap = original.lastIndexOf("    if (document.readyState === 'loading') {");
assert.ok(bootstrap > 0, 'Rumble bootstrap must exist');
const source = original.slice(0, bootstrap) + `
    window.testRumble = { state, fetchJson, startTimers };
})();`;
const background = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8').replace(/\r\n/g, '\n');
const helperStart = background.indexOf('async function fetchRumbleJsonResponse(url)');
const helperEnd = background.indexOf('function buildRumbleSseUrlFromStreamId', helperStart);
const handlerMarker = '} else if (request.cmd && request.cmd === "rumbleFetchJson") {';
const handlerStart = background.indexOf(handlerMarker);
const handlerEnd = background.indexOf('} else if (request.cmd && request.cmd === "rumbleFetchSseBatch")', handlerStart);
assert.ok(helperStart > 0 && helperEnd > helperStart && handlerStart > 0 && handlerEnd > handlerStart,
    'Exercise the actual background fetch helper and message handler');
const backgroundSource = background.slice(helperStart, helperEnd) + `
async function handleRequest(request, sendResponse) {
${background.slice(handlerStart + handlerMarker.length, handlerEnd)}
}`;
const now = Date.parse('2026-10-04T12:00:00Z');
const apiUrl = 'https://rumble.com/live-api/test';

function fixture(route, options = {}) {
    let timerId = 0;
    let bodyReads = 0;
    const timers = new Map();
    const packets = [];
    const window = {};
    const fetch = async () => {
        if (options.networkError) throw new Error('Network unavailable');
        const status = options.status === undefined ? 429 : options.status;
        return {
            status, ok: status >= 200 && status < 300,
            headers: { get(name) { assert.equal(name, 'Retry-After'); return options.retryAfter || null; } },
            async text() {
                bodyReads++;
                if (options.bodyError) throw new Error('Body unavailable');
                return options.body === undefined ? '{"message":"Rate limit exceeded"}' : options.body;
            }
        };
    };
    const backgroundContext = vm.createContext({ fetch, URL });
    vm.runInContext(backgroundSource, backgroundContext);
    const context = {
        window, document: {}, URL, URLSearchParams, fetch,
        Date: class extends Date { static now() { return now; } },
        setInterval(callback, delay) { timers.set(++timerId, { callback, delay, type: 'interval' }); return timerId; },
        setTimeout(callback, delay) { timers.set(++timerId, { callback, delay, type: 'timeout' }); return timerId; },
        clearInterval(id) { timers.delete(id); },
        clearTimeout(id) { timers.delete(id); }
    };
    if (route === 'extension') {
        context.chrome = { runtime: {
            id: 'test-extension',
            sendMessage(id, packet, callback) {
                if (packet.type !== 'toBackground') return;
                assert.equal(id, 'test-extension');
                assert.equal(packet.data.cmd, 'rumbleFetchJson');
                backgroundContext.handleRequest(packet.data, response => {
                    const serialized = JSON.parse(JSON.stringify(response));
                    packets.push(serialized);
                    callback(serialized);
                });
            }
        } };
    }
    if (route === 'electron') {
        window.ninjafy = { fetchRumbleJson: async () => options.electronResponse };
    }
    vm.runInContext(source, vm.createContext(context));
    const result = window.testRumble;
    result.state.active = true;
    result.state.cfg.apiUrl = apiUrl;
    return { ...result, timers, packets, bodyReads: () => bodyReads };
}

async function flushPromises() {
    for (let i = 0; i < 30; i++) await Promise.resolve();
}

for (const route of ['extension', 'direct']) {
    for (const [name, retryAfter, seconds] of [
        ['seconds', '90', 90],
        ['HTTP date', 'Sun, 04 Oct 2026 12:02:00 GMT', 120],
        ['missing header', undefined, null],
        ['invalid header', 'not a delay', null],
        ['negative delay', '-90', null],
        ['partially numeric header', '90 seconds', null],
        ['expired date', 'Sun, 04 Oct 2026 11:59:00 GMT', null]
    ]) {
        test(`${route}: HTTP 429 with ${name} reaches the polling backoff`, async () => {
            const f = fixture(route, { retryAfter });
            await assert.rejects(f.fetchJson(apiUrl), error => {
                assert.equal(error.status, 429);
                assert.equal(error.rateLimited, true);
                assert.equal(error.retryAfterSec, seconds);
                return true;
            });
            if (route === 'extension') {
                assert.equal(f.packets[0].status, 429);
                assert.equal(f.packets[0].retryAfter, retryAfter || null);
            }
            f.startTimers();
            [...f.timers.values()][0].callback();
            await flushPromises();
            assert.deepEqual([...f.timers.values()].map(timer => [timer.type, timer.delay]),
                [['timeout', seconds ? seconds * 1000 : 6000]]);
        });
    }

    for (const options of [{ body: '<html>Too many requests</html>' }, { body: 'invalid JSON' }, { bodyError: true }]) {
        test(`${route}: 429 does not depend on a readable JSON body ${JSON.stringify(options)}`, async () => {
            const f = fixture(route, { ...options, retryAfter: '90' });
            await assert.rejects(f.fetchJson(apiUrl), error => error.rateLimited === true && error.retryAfterSec === 90);
            assert.equal(f.bodyReads(), 0, 'Use HTTP metadata before reading the response body');
        });
    }

    test(`${route}: success and ordinary failures retain their behavior`, async () => {
        const success = fixture(route, { status: 200, body: '{"livestreams":[]}' });
        assert.equal(JSON.stringify(await success.fetchJson(apiUrl)), '{"livestreams":[]}');
        for (const options of [
            { status: 503, body: '{"error":"Service unavailable"}', retryAfter: '90' },
            { status: 200, body: 'invalid JSON' },
            { networkError: true }
        ]) {
            const f = fixture(route, options);
            await assert.rejects(f.fetchJson(apiUrl), error => !error.rateLimited);
            f.startTimers();
            [...f.timers.values()][0].callback();
            await flushPromises();
            assert.deepEqual([...f.timers.values()].map(timer => [timer.type, timer.delay]), [['interval', 3000]]);
        }
    });
}

test('Electron-reported HTTP status and retry metadata are retained when available', async () => {
    const f = fixture('electron', { electronResponse: { ok: false, status: 429, retryAfter: '90', error: 'Rate limited' } });
    await assert.rejects(f.fetchJson(apiUrl), error => error.rateLimited === true && error.retryAfterSec === 90);
});

test('Background URL validation still rejects disallowed destinations before fetching', async () => {
    const f = fixture('extension');
    await assert.rejects(f.fetchJson('https://example.com/live-api/test'), /Rumble fetch URL not allowed/);
    assert.equal(f.bodyReads(), 0);
});
