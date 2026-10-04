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
    'toDataURL', 'sendDataP2P', 'cancelPendingFeaturedMessage', 'deleteMessage', 'buildSourceControlPayload', 'normalizeSourceControlType']
    .filter(name => dock.includes('function ' + name + '(')).map(extract).join('\n');

function fixture(showDeleted = false) {
    const rows = [], sent = [], errors = [], syncs = [], extension = [], timers = new Map();
    const controls = { next_in_queue_badge: {}, next_in_queue: { style: {} },
        queueSection: { classList: { remove() {} } } };
    const fields = { 'data-chatname': 'chatname', 'data-source-type': 'sourceType', 'data-mid': 'mid', 'data-userid': 'userid' };
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
        singlefeaturedwriter: false, iframes: [], socketserverFeatured: { readyState: 1, send: raw => sent.push(JSON.parse(raw)) },
        socketserver: false, shouldDeferRawDonationWebhook: () => false, isRawDonationWebhook: () => false,
        cancelPendingRawWebhookFallback() {}, getBlockUserUnavailableReason: () => '',
        getNativeSourceControlMessageId: data => data.meta && data.meta.messageId || '',
        dataAttributeSelector: (name, value) => `[${name}="${value}"]`,
        document: { querySelector: selector => rows.find(row => row.isConnected && row.matches(selector)) || null,
            querySelectorAll: selector => rows.filter(row => row.isConnected && row.matches(selector)),
            createElement: () => ({}) },
        pinIt() {}, applyHiddenState() {}, getById: id => controls[id], send2Extension: data => extension.push(data),
        syncDataAny: (...args) => syncs.push(args), sendDataP2P: data => sent.push(data),
        setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); },
        console: { log() {}, error: error => errors.push(String(error)) }
    });
    c.window = c;
    vm.runInContext(source, c, { filename: 'dock-moderation-production.js' });
    return { c, rows, sent, errors, syncs, extension, controls, timers, makeRow };
}


function avatarFixture(showDeleted = false) {
    const f = fixture(showDeleted), xhrs = [], readers = [];
    f.c.XMLHttpRequest = class {
        open(method, url) { this.method = method; this.url = url; }
        send() { xhrs.push(this); }
    };
    f.c.FileReader = class {
        readAsDataURL() { readers.push(this); }
    };
    f.avatarRow = (id, chatname = 'Viewer', type = 'youtube', connected = true) => {
        const row = f.makeRow(id, chatname, type, connected);
        row.rawContents.chatimg = 'https://example.invalid/avatar=s32-test';
        return row;
    };
    f.startRead = index => {
        xhrs[index].response = {};
        xhrs[index].onload();
        return readers[readers.length - 1];
    };
    f.finishRead = reader => {
        reader.result = 'data:image/png;base64,OFFLINE';
        reader.onloadend();
    };
    f.complete = index => f.finishRead(f.startRead(index));
    f.xhrs = xhrs;
    return f;
}
function feature(f, row) { f.c.selectedMessage(false, row); }
function ids(f) { return f.sent.map(message => message && message.id || false); }

test('current YouTube feature keeps its avatar backup and larger image', () => {
    const f = avatarFixture(), row = f.avatarRow(1);
    feature(f, row);
    assert.equal(f.sent.length, 0);
    f.complete(0);
    assert.deepEqual(ids(f), [1]);
    assert.equal(f.sent[0].chatimg, 'https://example.invalid/avatar=s256-test');
    assert.equal(f.sent[0].backupChatimg, 'data:image/png;base64,OFFLINE');
    assert.deepEqual(f.errors, []);
});

for (const order of [[0, 1], [1, 0]]) {
    test('newest async selection wins with avatar completion order ' + order, () => {
        const f = avatarFixture(), first = f.avatarRow(1), second = f.avatarRow(2);
        feature(f, first);
        feature(f, second);
        order.forEach(index => f.complete(index));
        assert.deepEqual(ids(f), [2]);
        assert.equal(first.rawContents.chatimg, 'https://example.invalid/avatar=s32-test', 'Stale callback must not mutate the original row');
        assert.deepEqual(f.errors, []);
    });
}

for (const stage of ['xhr', 'reader']) {
    test('Clear cannot be undone by an avatar pending at the ' + stage + ' stage', () => {
        const f = avatarFixture();
        feature(f, f.avatarRow(1));
        const reader = stage === 'reader' ? f.startRead(0) : null;
        f.c.sendDataP2P(false);
        reader ? f.finishRead(reader) : f.complete(0);
        assert.deepEqual(ids(f), [false]);
        assert.deepEqual(f.errors, []);
    });
}

test('a later synchronous message is not overwritten by an old avatar', () => {
    const f = avatarFixture();
    feature(f, f.avatarRow(1));
    feature(f, f.makeRow(2));
    f.complete(0);
    assert.deepEqual(ids(f), [2]);
});

test('a direct featured update supersedes a pending selection', () => {
    const f = avatarFixture();
    feature(f, f.avatarRow(1));
    f.c.sendDataP2P({ id: 2, chatmessage: 'Replacement' });
    f.complete(0);
    assert.deepEqual(ids(f), [2]);
});

const actions = {
    'local block': (f, row) => f.c.blockUser(row),
    'local timeout': (f, row) => f.c.timeoutUser(row, 60),
    'received block': (f, row) => f.c.processInput({ blockUser: { username: row.dataset.chatname, type: row.dataset.sourceType } }),
    'received timeout': (f, row) => f.c.processInput({ timeoutUser: { username: row.dataset.chatname, type: row.dataset.sourceType, duration: 60 } }),
    'unscoped block': (f, row) => f.c.processInput({ blockUser: { username: row.dataset.chatname } }),
    'source deletion': (f, row) => f.c.processInput({ delete: { id: row.rawContents.id, type: row.dataset.sourceType } })
};
for (const [name, moderate] of Object.entries(actions)) {
    for (const showDeleted of [false, true]) {
        test(name + ' cancels an already-started feature (showDeleted=' + showDeleted + ')', () => {
            const f = avatarFixture(showDeleted), row = f.avatarRow(1);
            // Consume the real queue, so cancellation cannot rely on retained queue membership.
            f.c.selectedMessage({ which: 1, ctrlKey: true }, row);
            f.c.nextInQueue();
            assert.equal(f.c.selectedQueue.length, 0);
            const reader = f.startRead(0);
            moderate(f, row);
            f.finishRead(reader);
            assert.deepEqual(ids(f), []);
            assert.deepEqual(f.errors, []);
        });
    }
}

for (const name of ['local block', 'local timeout', 'received block', 'received timeout', 'source deletion']) {
    test(name + ' of another user leaves a pending feature valid', () => {
        const f = avatarFixture(), row = f.avatarRow(1), other = f.avatarRow(2, 'Other');
        feature(f, row);
        actions[name](f, other);
        f.complete(0);
        assert.deepEqual(ids(f), [1]);
        assert.deepEqual(f.errors, []);
    });
}

test('user moderation on another platform leaves a pending feature valid', () => {
    const f = avatarFixture(), row = f.avatarRow(1), other = f.makeRow(2, 'Viewer', 'twitch');
    feature(f, row);
    f.c.blockUser(other);
    f.complete(0);
    assert.deepEqual(ids(f), [1]);
});

for (const action of ['blockUser', 'timeoutUser']) {
    test('received YouTube ' + action + ' cancels pending Shorts', () => {
        const f = avatarFixture(), row = f.avatarRow(1, 'Viewer', 'youtubeshorts');
        feature(f, row);
        f.c.processInput({ [action]: { username: 'Viewer', type: 'youtube', duration: 60 } });
        f.complete(0);
        assert.deepEqual(ids(f), []);
        assert.deepEqual(f.errors, []);
    });
}

for (const nativeId of [false, true]) {
    test('source deletion cancels a detached pending row (nativeId=' + nativeId + ')', () => {
        const f = avatarFixture(), row = f.avatarRow(1, 'Viewer', 'youtube', false);
        row.rawContents.meta = { messageId: 'native-message' };
        feature(f, row);
        f.c.processInput({ delete: nativeId ? { meta: { messageId: 'native-message' }, type: 'youtube' } : { id: 1, type: 'youtube' } });
        f.complete(0);
        assert.deepEqual(ids(f), []);
        assert.deepEqual(f.errors, []);
    });
}

test('onlyLast does not cancel an older pending feature when a newer row matches', () => {
    const f = avatarFixture(), row = f.avatarRow(1);
    f.avatarRow(2);
    feature(f, row);
    f.c.processInput({ delete: { chatname: 'Viewer', type: 'youtube', onlyLast: true } });
    f.complete(0);
    assert.deepEqual(ids(f), [1]);
});

for (const detachedAtStart of [false, true]) {
    test('ordinary pruning or a detached queue row must still finish (detachedAtStart=' + detachedAtStart + ')', () => {
        const f = avatarFixture(), row = f.avatarRow(1, 'Viewer', 'youtube', !detachedAtStart);
        feature(f, row);
        row.remove(); // Normal Dock pruning is not moderation.
        f.complete(0);
        assert.deepEqual(ids(f), [1]);
    });
}

for (const mid of [2, false]) {
    test('a synchronized remote choice cancels local avatar work (mid=' + mid + ')', () => {
        const f = avatarFixture();
        f.makeRow(2);
        feature(f, f.avatarRow(1));
        f.c.processInput({ mid });
        f.complete(0);
        assert.deepEqual(ids(f), []);
        assert.deepEqual(f.errors, []);
    });
}

test('ignored remote choices and queue/pin clicks do not cancel a pending feature', () => {
    const f = avatarFixture(), row = f.avatarRow(1), other = f.makeRow(2);
    feature(f, row);
    f.c.syncDocks = false;
    f.c.processInput({ mid: 2 });
    f.c.selectedMessage({ which: 1, ctrlKey: true }, other);
    f.c.selectedMessage({ which: 1, altKey: true }, other);
    f.complete(0);
    assert.deepEqual(ids(f), [1]);
    assert.deepEqual(f.errors, []);
});

test('avatar network failure still publishes the current selection', () => {
    const f = avatarFixture();
    feature(f, f.avatarRow(1));
    f.xhrs[0].onerror();
    assert.deepEqual(ids(f), [1]);
});

test('avatar network failure cannot publish a cancelled selection', () => {
    const f = avatarFixture();
    feature(f, f.avatarRow(1));
    f.c.sendDataP2P(false);
    f.xhrs[0].onerror();
    assert.deepEqual(ids(f), [false]);
});

test('synchronous avatar startup failure preserves the current fallback', () => {
    const f = avatarFixture();
    f.c.XMLHttpRequest = function () { throw new Error('No XHR'); };
    feature(f, f.avatarRow(1));
    assert.deepEqual(ids(f), [1]);
});

test('clearing the separate bot overlay does not cancel a human message', () => {
    const f = avatarFixture();
    feature(f, f.avatarRow(1));
    f.c.sendDataP2P({ action: 'clearBotOverlay', target: 'bot' });
    f.complete(0);
    assert.deepEqual(ids(f), [false, 1]);
    assert.equal(f.sent[0].action, 'clearBotOverlay');
});

for (const showDeleted of [false, true]) {
    test('local Delete cancels a pending row without a Dock ID (showDeleted=' + showDeleted + ')', () => {
        const f = avatarFixture(showDeleted), row = f.avatarRow(null);
        delete row.dataset.mid;
        feature(f, row);
        f.c.deleteMessage(row);
        f.complete(0);
        assert.deepEqual(ids(f), []);
        assert.deepEqual(f.errors, []);
    });
}

test('local Delete of another ID-less row does not cancel the selected row', () => {
    const f = avatarFixture(), row = f.avatarRow(null), other = f.avatarRow(null);
    delete row.dataset.mid;
    delete other.dataset.mid;
    feature(f, row);
    f.c.deleteMessage(other);
    f.complete(0);
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].chatimg, 'https://example.invalid/avatar=s256-test');
    assert.deepEqual(f.errors, []);
});

test('a cleared single-feature export is not overwritten by an old avatar', () => {
    const f = avatarFixture(), writes = [];
    f.c.singlefeaturedwriter = true;
    f.c.overwriteFile = data => writes.push(data);
    feature(f, f.avatarRow(1));
    f.c.sendDataP2P(false);
    f.complete(0);
    assert.deepEqual(writes, [false]);
    assert.deepEqual(ids(f), [false]);
});
