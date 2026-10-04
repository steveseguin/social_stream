'use strict';

// Run the shipped Dock handlers, queues and selection path with offline DOM/I/O fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const dock = fs.readFileSync(path.join(__dirname, '..', 'dock.html'), 'utf8');
function extract(name) {
    const match = dock.match(new RegExp('^([ \\t]*)function ' + name + '\\([^]*?^\\1}', 'm'));
    assert.ok(match, name + ' must exist');
    return match[0];
}
const source = ['processInput', 'blockUser', 'timeoutUser', 'deleteMessages', 'markDeletedMessage',
    'selectedMessage', 'nextInQueue', 'checkAutoShow', 'removeQueue', 'updateQueueButton', 'syncQueueP2P',
    'cancelPendingFeaturedMessage']
    .filter(name => dock.includes('function ' + name + '(')).map(extract).join('\n');

function fixture(showDeleted = false) {
    const rows = [], sent = [], errors = [], syncs = [], extension = [], timers = new Map();
    const controls = { next_in_queue_badge: {}, next_in_queue: { style: {} },
        queueSection: { classList: { remove() {} } } };
    const fields = { 'data-chatname': 'chatname', 'data-source-type': 'sourceType', 'data-mid': 'mid' };
    function makeRow(id, chatname = 'Viewer', type = 'twitch', connected = true) {
        const classes = new Set(['highlight-chat']);
        const row = {
            dataset: { mid: String(id), chatname, sourceType: type },
            children: [{ dataset: {} }], labels: [], contentLength: 12, isConnected: connected,
            rawContents: { id, chatname, type, chatmessage: 'Message ' + id },
            classList: { contains: name => classes.has(name), add(...names) { names.forEach(name => classes.add(name)); },
                remove(...names) { names.forEach(name => classes.delete(name)); } },
            remove() { this.isConnected = false; },
            getAttribute(name) { return this.dataset[fields[name]]; },
            appendChild(label) { this.labels.push(label); },
            querySelector(selector) {
                if (selector === '.queueid') return this.children[0];
                if (selector === '.deleted-message-label') return this.labels[0] || null;
                return null;
            },
            matches(selector) {
                const classMatch = selector.match(/^\.([\w-]+)/);
                if (classMatch && !classes.has(classMatch[1])) return false;
                const attrs = Array.from(selector.matchAll(/\[([\w-]+)="([^"]*)"\]/g));
                return attrs.every(([, name, value]) => this.dataset[fields[name]] === value);
            }
        };
        rows.push(row);
        return row;
    }
    const c = vm.createContext({
        selectedQueue: [], autoShowQueue: [], historyMissedLiveBuffer: [], queue: [], messageBuffer: [],
        showDeleted, deletedDockMessages: new WeakSet(), deleteOnlyLast: false, pendingFeaturedMessage: null,
        localBlockUserList: false, timedOutUsers: {}, autoshowqueued: false, syncDocks: true,
        blockMessageSelecting: false, blockMessageSelecting2: false, blockMessageSelecting3: false,
        autoTimeoutEnabled: false, pressedClass: 'pressed', lastMessageClass: 'last-message',
        checkTimeout: null, timeoutId: null, lastPushed: 0, activeWordLength: 0, activeDonation: false,
        timePerCharacter: 1, autoQueueTimeout: 0, doNotAutoshowFiltered: false, thirdPartyAPI: false,
        socketserver: false, shouldDeferRawDonationWebhook: () => false, isRawDonationWebhook: () => false,
        cancelPendingRawWebhookFallback() {}, getBlockUserUnavailableReason: () => '',
        getNativeSourceControlMessageId: data => data.meta && data.meta.messageId || '',
        dataAttributeSelector: (name, value) => `[${name}="${value}"]`,
        document: { querySelectorAll: selector => rows.filter(row => row.isConnected && row.matches(selector)),
            createElement: () => ({}) },
        getById: id => controls[id], send2Extension: data => extension.push(data),
        syncDataAny: (...args) => syncs.push(args), sendDataP2P: data => sent.push(data),
        setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); },
        console: { log() {}, error: error => errors.push(String(error)) }
    });
    c.window = c;
    vm.runInContext(source, c, { filename: 'dock-moderation-production.js' });
    return { c, rows, sent, errors, syncs, extension, controls, timers, makeRow };
}

const actions = {
    'local block': (f, target) => f.c.blockUser(target),
    'local timeout': (f, target) => f.c.timeoutUser(target, 60),
    'received block': (f, target) => f.c.processInput({ blockUser: { username: target.dataset.chatname, type: target.dataset.sourceType } }),
    'received timeout': (f, target) => f.c.processInput({ timeoutUser: { username: target.dataset.chatname, type: target.dataset.sourceType, duration: 60 } })
};

for (const [name, moderate] of Object.entries(actions)) {
    for (const showDeleted of [false, true]) {
        test(`${name} removes queued rows before Next (showDeleted=${showDeleted})`, () => {
            const f = fixture(showDeleted);
            const target = f.makeRow(1), detached = f.makeRow(2, 'Viewer', 'twitch', false);
            const otherPlatform = f.makeRow(3, 'Viewer', 'kick'), otherUser = f.makeRow(4, 'Other');
            for (const row of [target, detached, otherPlatform, otherUser]) {
                f.c.selectedMessage({ which: 1, ctrlKey: true }, row);
            }
            moderate(f, target);
            assert.deepEqual(f.errors, []);
            assert.equal(target.isConnected, false);
            // Exercise the actual feature sender, not only queue length.
            f.c.nextInQueue();
            assert.equal(f.sent[0].id, 3, 'The next featured row must not belong to the moderated user');
            assert.deepEqual(Array.from(f.c.selectedQueue, row => row.rawContents.id), [4]);
            assert.equal(String(f.controls.next_in_queue_badge.innerText), '1');
            assert.equal(otherUser.children[0].dataset.qid, 1);
        });
        test(`${name} removes auto-feature and delayed messages (showDeleted=${showDeleted})`, () => {
            const f = fixture(showDeleted);
            const target = f.makeRow(1), detached = f.makeRow(2, 'Viewer', 'twitch', false);
            const other = f.makeRow(3, 'Other');
            f.c.autoShowQueue = [target, detached, other];
            const dropped = { id: 4, chatname: 'Viewer', type: 'twitch' };
            const kept = { id: 5, chatname: 'Other', type: 'twitch' };
            f.c.historyMissedLiveBuffer = [dropped, kept];
            f.c.queue = [{ contents: dropped }, { contents: kept }];
            f.c.messageBuffer = [{ contents: dropped }, { contents: kept }];
            moderate(f, target);
            assert.deepEqual(f.errors, []);
            f.c.checkAutoShow();
            assert.equal(f.sent[0].id, 3, 'Auto-feature must not send a removed row');
            assert.deepEqual(Array.from(f.c.historyMissedLiveBuffer, message => message.id), [5]);
            assert.deepEqual(Array.from(f.c.queue, item => item.contents.id), [5]);
            assert.deepEqual(Array.from(f.c.messageBuffer, item => item.contents.id), [5]);
        });
    }
}

test('received unscoped block removes that user across platforms only', () => {
    const f = fixture();
    f.c.autoShowQueue = [f.makeRow(1), f.makeRow(2, 'Viewer', 'kick'), f.makeRow(3, 'Other')];
    f.c.processInput({ blockUser: { username: 'Viewer' } });
    assert.deepEqual(f.errors, []);
    assert.deepEqual(Array.from(f.c.autoShowQueue, row => row.rawContents.id), [3]);
});

for (const action of ['blockUser', 'timeoutUser']) {
    test(`received YouTube ${action} also clears Shorts queues`, () => {
        const f = fixture();
        f.c.autoShowQueue = [f.makeRow(1, 'Viewer', 'youtube'), f.makeRow(2, 'Viewer', 'youtubeshorts'), f.makeRow(3, 'Viewer', 'twitch')];
        f.c.processInput({ [action]: { username: 'Viewer', type: 'youtube', duration: 60 } });
        assert.deepEqual(f.errors, []);
        assert.deepEqual(Array.from(f.c.autoShowQueue, row => row.rawContents.id), [3]);
    });
}

test('ordinary deletion still honors showDeleted and removes its queued entry', () => {
    const f = fixture(true), row = f.makeRow(1);
    f.c.selectedMessage({ which: 1, ctrlKey: true }, row);
    f.c.deleteMessages({ delete: { id: 1, type: 'twitch' } });
    assert.equal(row.isConnected, true);
    assert.equal(row.classList.contains('deleted-message'), true);
    assert.equal(f.c.selectedQueue.length, 0);
    assert.equal(f.c.deletedDockMessages.has(row.rawContents), true);
});

for (const [name, moderate] of Object.entries(actions)) {
    test(`${name} keeps scheduled auto-queue and reconnect state free of removed rows`, () => {
        const f = fixture(), target = f.makeRow(1), survivor = f.makeRow(2, 'Other');
        f.c.selectedMessage({ which: 1, ctrlKey: true }, target);
        f.c.selectedMessage({ which: 1, ctrlKey: true }, survivor);
        f.c.autoshowqueued = true;
        f.c.checkAutoShow();
        const callback = f.timers.get(f.c.timeoutId);
        assert.equal(typeof callback, 'function');
        moderate(f, target);
        f.syncs.length = 0;
        f.c.syncQueueP2P('reconnected-dock');
        assert.deepEqual(Array.from(f.syncs[0][0].queueInit, message => message.id), [2]);
        callback();
        assert.equal(f.sent[0].id, 2);
        assert.equal(f.c.selectedQueue.length, 0);
        assert.deepEqual(f.errors, []);
    });
}

test('a source deletion retains pending showDeleted rows without force removal', () => {
    const f = fixture(true), dropped = { id: 1, chatname: 'Viewer', type: 'twitch' };
    f.c.historyMissedLiveBuffer = [dropped];
    f.c.queue = [{ contents: dropped }];
    f.c.messageBuffer = [{ contents: dropped }];
    f.c.deleteMessages({ delete: { id: 1, type: 'twitch' } });
    assert.equal(f.c.historyMissedLiveBuffer.length, 1);
    assert.equal(f.c.queue.length, 1);
    assert.equal(f.c.messageBuffer.length, 1);
    assert.equal(f.c.deletedDockMessages.has(dropped), true);
});

for (const readyState of [0, 1, 2, 3]) {
    test(`queue status transport failure cannot cancel moderation (readyState=${readyState})`, () => {
        for (const action of ['local block', 'local timeout', 'received block', 'received timeout']) {
            const f = fixture(), target = f.makeRow(1, 'Viewer', 'youtube');
            const shorts = f.makeRow(2, 'Viewer', 'youtubeshorts');
            f.c.selectedMessage({ which: 1, ctrlKey: true }, target);
            f.c.selectedMessage({ which: 1, ctrlKey: true }, shorts);
            let sendCalls = 0;
            f.c.socketserver = { readyState, send() { sendCalls++; throw new Error('Socket closed'); } };
            actions[action](f, target);
            assert.deepEqual(f.errors, [], action + ': transport must not abort moderation');
            assert.equal(target.isConnected, false);
            if (action === 'local block') {
                assert.equal(f.extension.length, 1, 'Persistent block must reach the background');
                assert.equal(f.extension[0].action, 'blockUser');
            } else {
                assert.equal(shorts.isConnected, false, action + ': finish the Shorts removal');
                assert.equal(f.c.selectedQueue.length, 0);
            }
            if (readyState !== 1) assert.equal(sendCalls, 0, 'Skip queue status until the socket is open');
            else assert.ok(sendCalls > 0, 'Cover a socket that closes during send');
        }
    });
}
