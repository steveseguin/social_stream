'use strict';

// Run the production Dock handler and queue helpers with local DOM/I/O fixtures.
// No browser profile, network connection or live session is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const dock = fs.readFileSync(path.join(__dirname, '..', 'dock.html'), 'utf8');
function extractFunction(name) {
    const start = dock.indexOf(`\t\t\tfunction ${name}(`);
    assert.ok(start >= 0, `Missing Dock function: ${name}`);
    const end = dock.indexOf('\n\t\t\t}', start);
    assert.ok(end > start, `Missing Dock function end: ${name}`);
    return dock.slice(start, end + '\n\t\t\t}'.length);
}
const source = ['rememberDockTtsArrival', 'processInput', 'updateQueueButton', 'removeQueue', 'selectedMessage',
    'checkAutoShow', 'nextInQueue', 'syncQueueP2P', 'cancelPendingFeaturedMessage'].map(extractFunction).join('\n');

function fixture(ids = [1, 2, 3]) {
    const rows = new Map();
    function makeRow(id) {
        const classes = new Set();
        const row = {
            dataset: { mid: String(id) }, children: [{ dataset: {} }],
            rawContents: { id, type: 'youtube', chatname: 'Local fixture', chatmessage: `Message ${id}` },
            contentLength: 10,
            classList: {
                add: name => classes.add(name), remove: name => classes.delete(name),
                contains: name => classes.has(name)
            }
        };
        rows.set(String(id), row);
        return row;
    }
    for (const id of [1, 2, 3, 4, 5]) makeRow(id);
    const controls = {
        next_in_queue_badge: { innerText: '0' }, next_in_queue: { title: '', style: {} },
        queueSection: { classList: { remove() {} } }
    };
    const lengths = [], syncs = [], timers = new Map();
    let timerId = 0;
    const c = vm.createContext({
        TTS: { ttscommand: false }, dockTtsArrivals: new WeakMap(),
        selectedQueue: [], pendingFeaturedMessage: null, syncDocks: true, autoshowqueued: false,
        blockMessageSelecting: false, blockMessageSelecting2: false,
        shouldDeferRawDonationWebhook: () => false, isRawDonationWebhook: () => false,
        cancelPendingRawWebhookFallback() {}, isDuplicateWebhookDelivery: () => false, applyHiddenState() {},
        dataAttributeSelector: (attribute, id) => String(id),
        document: { querySelector: id => rows.get(id) || null },
        getById: id => controls[id], socketserver: { readyState: 1, send: raw => lengths.push(JSON.parse(raw).queueLength) },
        syncDataAny: data => syncs.push(JSON.parse(JSON.stringify(data))),
        processData: ({ contents }) => rows.get(String(contents.id)) || makeRow(contents.id),
        pauseState: false, smoothMessageBuffer: false,
        checkTimeout: null, timeoutId: null, autoShowQueue: [], lastPushed: 0,
        activeWordLength: 0, timePerCharacter: 1, autoQueueTimeout: 0,
        doNotAutoshowFiltered: false, pressedClass: 'pressed', console,
        setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
        clearTimeout(id) { timers.delete(id); }
    });
    c.window = c;
    vm.runInContext(source, c, { filename: 'dock-queue-production.js' });
    for (const id of ids) c.selectedMessage({ which: 1, ctrlKey: true }, rows.get(String(id)));
    lengths.length = 0;
    syncs.length = 0;
    return { c, rows, controls, lengths, syncs, timers };
}

function assertQueue(f, ids) {
    assert.deepEqual(Array.from(f.c.selectedQueue, row => Number(row.dataset.mid)), ids);
    assert.equal(String(f.controls.next_in_queue_badge.innerText), String(ids.length));
    for (const [id, row] of f.rows) {
        const index = ids.indexOf(Number(id));
        assert.equal(row.classList.contains('queued'), index !== -1, `Message ${id}: queued marker`);
        assert.equal(row.children[0].dataset.qid === undefined ? undefined : String(row.children[0].dataset.qid),
            index === -1 ? undefined : String(index + 1), `Message ${id}: queue position`);
    }
}

for (const ids of [[], [3], [1], [2], [3, 1], [4], [3, 2, 1]]) {
    test(`remote queue ${JSON.stringify(ids)} removes every stale row and preserves order`, () => {
        const f = fixture();
        assert.equal(f.c.processInput({ queue: ids }), true);
        assertQueue(f, ids);
        assert.deepEqual(f.lengths, [ids.length], 'Publish only the reconciled queue length');
        assert.deepEqual(f.syncs, [], 'Do not echo received queue changes to other Docks');
        f.c.processInput({ queue: ids });
        assertQueue(f, ids);
    });
}

for (const modifier of ['ctrlKey', 'metaKey']) {
    test(`${modifier} re-enqueues a removed row on the first click`, () => {
        const f = fixture();
        f.c.processInput({ queue: [] });
        f.c.selectedMessage({ which: 1, [modifier]: true }, f.rows.get('2'));
        assertQueue(f, [2]);
        assert.deepEqual(f.syncs, [{ queue: [f.rows.get('2').rawContents] }]);
        f.c.selectedMessage({ which: 1, [modifier]: true }, f.rows.get('2'));
        assertQueue(f, []);
        assert.deepEqual(f.syncs[1], { queue: [] });
    });
}

test('mixed message objects and IDs can reuse existing rows or render new rows', () => {
    const f = fixture();
    const incoming = [{ id: 4, type: 'youtube', chatmessage: 'Existing row' }, 3,
        { id: 6, type: 'youtube', chatmessage: 'New row' }];
    f.c.processInput({ queue: incoming });
    assertQueue(f, [4, 3, 6]);
    assert.deepEqual(f.lengths, [3]);
});

test('queue synchronization still requires sync mode or a forced request', () => {
    const f = fixture();
    f.c.syncDocks = false;
    assert.equal(f.c.processInput({ queue: [] }), undefined);
    assertQueue(f, [1, 2, 3]);
    assert.deepEqual(f.lengths, []);
    assert.equal(f.c.processInput({ queue: [] }, true), true);
    assertQueue(f, []);
});

test('auto-show sees the replacement queue without consuming the fallback queue', () => {
    const f = fixture([1]);
    f.c.autoshowqueued = true;
    f.c.autoShowQueue.push(f.rows.get('5'));
    // Prevent featuring any row; the real scheduler still runs and changes its queues.
    f.c.blockMessageSelecting = true;
    f.c.processInput({ queue: [4] });
    assertQueue(f, [4]);
    assert.deepEqual(Array.from(f.c.autoShowQueue, row => Number(row.dataset.mid)), [5]);
    assert.deepEqual(f.lengths, [1]);
    assert.equal(f.timers.size, 1, 'Schedule the next queued message once');
});

test('an already scheduled auto-show advances the reconciled queue', () => {
    const f = fixture();
    f.c.autoshowqueued = true;
    f.c.checkAutoShow();
    const pending = f.c.timeoutId;
    f.c.processInput({ queue: [3] });
    assertQueue(f, [3]);
    assert.equal(f.c.timeoutId, pending, 'Keep the existing auto-show schedule');
    const callback = f.timers.get(pending);
    f.timers.delete(pending);
    f.c.blockMessageSelecting = true;
    callback();
    assertQueue(f, []);
});

for (const state of [
    { name: 'uninterrupted', paused: false, nextSerial: 0, expected: 0 },
    { name: 'paused before arrival', paused: true, nextSerial: 1, expected: -1 },
    { name: 'paused and resumed while waiting', paused: false, nextSerial: 1, expected: 0 }
]) {
    test(`deferred webhook keeps its TTS arrival after normalization: ${state.name}`, () => {
        const { c, timers } = fixture([]);
        const received = [];
        Object.assign(c, {
            TTS: { ttscommand: true, paused: state.paused, pauseSerial: 0 },
            Currencies: {}, WEBHOOK_BACKGROUND_GRACE_MS: 1500,
            pendingRawWebhookFallbacks: new Map(), recentWebhookDeliveries: new Map(),
            pendingRawWebhookSequence: 0,
            shouldDeferRawDonationWebhook: () => true,
            isRawDonationWebhook: data => !!data.kofi,
            updateMeta: () => false,
            errorlog: error => { throw error; },
            processData: ({ contents }) => received.push(contents)
        });
        vm.runInContext(['normalizeWebhookDeliveryId', 'getRawDonationWebhookIdentity',
            'getWebhookDeliveryKey', 'setRawWebhookMeta', 'pruneRecentWebhookDeliveries',
            'queueRawDonationWebhookFallback'].map(extractFunction).join('\n'), c);
        const incoming = { kofi: { data: JSON.stringify({ type: 'Donation', is_public: true,
            message_id: 'arrival-1', from_name: 'Local fixture', message: 'Thank you',
            amount: '5', currency: 'USD' }) } };
        const before = JSON.stringify(incoming);
        assert.equal(c.processInput(incoming), false);
        assert.equal(received.length, 0, 'Do not normalize before the fallback timer');
        assert.equal(timers.size, 1);
        c.TTS.paused = false;
        c.TTS.pauseSerial = state.nextSerial;
        const [timerId, callback] = timers.entries().next().value;
        timers.delete(timerId);
        callback();
        assert.equal(received.length, 1, 'Normalize exactly one deferred message');
        assert.equal(received[0].meta.webhookId, 'arrival-1');
        assert.equal(received[0].chatmessage, 'Thank you');
        assert.equal(c.dockTtsArrivals.get(received[0]), state.expected,
            'The replacement message must inherit the original arrival, not the current serial');
        assert.equal(c.dockTtsArrivals.get(incoming), state.expected);
        assert.equal(c.pendingRawWebhookFallbacks.size, 0);
        assert.equal(JSON.stringify(incoming), before, 'Keep pause metadata out of the payload');
    });
}

for (const paused of [false, true]) {
    test(`JSON content records TTS arrival without altering payload: paused=${paused}`, () => {
        const { c } = fixture([]);
        const received = [];
        c.TTS = { ttscommand: true, paused, pauseSerial: 0 };
        c.processData = ({ contents }) => received.push(contents);
        const content = { id: 41, type: 'youtube', chatmessage: 'Local fixture' };
        const incoming = { action: 'content', value: JSON.stringify(content) };
        const before = JSON.stringify(incoming);
        c.processInput(incoming);
        assert.equal(received.length, 1);
        assert.equal(JSON.stringify(received[0]), JSON.stringify(content));
        assert.equal(c.dockTtsArrivals.get(received[0]), paused ? -1 : 0);
        assert.equal(JSON.stringify(incoming), before);
    });
}
