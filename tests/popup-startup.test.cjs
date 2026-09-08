'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.SSN_POPUP_ROOT || path.resolve(__dirname, '..');
const workerSource = fs.readFileSync(path.join(root, 'service_worker.js'), 'utf8').replace(/\r\n/g, '\n');
const bootstrap = fs.readFileSync(path.join(root, 'js/popup-bootstrap.js'), 'utf8');

function backgroundHarness() {
    let now = 100000, nextId = 1, creates = 0, fail = false;
    const tabs = new Map(), timers = new Map(), removed = [];
    const event = { addListener() {}, removeListener() {} };
    const context = vm.createContext({
        console: { warn() {}, error() {} }, log() {},
        Date: { now: () => now },
        setTimeout(fn, ms) { const id = nextId++; timers.set(id, { fn, ms }); return id; },
        clearTimeout(id) { timers.delete(id); },
        backgroundPageTabId: null, backgroundPageTabIdLoaded: false, messageQueue: [],
        async checkBackgroundPageIsOpen() { return [...tabs.values()].some(t => t.status === 'complete'); },
        async queryBackgroundTabs() { return [...tabs.values()]; },
        getBackgroundPageUrl() { return 'chrome-extension://test/background.html'; },
        async updateIconToOn() {}, async updateIconToOff() {},
        sendMessageToBackgroundPage() {},
        chrome: { tabs: {
            onUpdated: event, onRemoved: { addListener(fn) { removed.push(fn); } },
            async get(id) { if (!tabs.has(id)) throw Error('Missing tab'); return tabs.get(id); },
            async create() {
                creates++;
                if (fail) throw Error('Tabs cannot be edited right now');
                const tab = { id: nextId++, status: 'complete' }; tabs.set(tab.id, tab); return tab;
            }
        } }
    });
    const start = workerSource.indexOf('let lastBackgroundPageCreated =');
    const end = workerSource.indexOf('\nfunction sendMessageToBackgroundPage(', start);
    vm.runInContext(workerSource.slice(start, end), context);
    return {
        context, timers,
        get creates() { return creates; },
        advance(ms) { now += ms; },
        fail() { fail = true; },
        async close(id = context.backgroundPageTabId) {
            tabs.delete(id);
            for (const fn of removed) await fn(id);
        }
    };
}

function bootstrapHarness(protocol) {
    const classes = new Set(), timers = new Map(), listeners = {};
    let id = 0;
    vm.runInNewContext(bootstrap, {
        location: { protocol },
        document: {
            documentElement: { classList: { add: x => classes.add(x), remove: x => classes.delete(x) } },
            addEventListener(name, fn) { listeners[name] = fn; }
        },
        setTimeout(fn, ms) { timers.set(++id, { fn, ms }); return id; },
        clearTimeout(id) { timers.delete(id); }
    });
    return { classes, timers, listeners };
}

(async () => {
    const normal = backgroundHarness();
    await normal.context.ensureBackgroundPageIsOpen();
    normal.advance(100);
    await normal.close();
    assert.equal(normal.creates, 1, 'Closing a background does not itself reopen it');
    await normal.context.ensureBackgroundPageIsOpen();
    assert.equal(normal.creates, 2, 'Popup can immediately reopen a previously healthy background');
    assert.equal(normal.timers.size, 0, 'Healthy restart does not wait for a retry timer');

    const failed = backgroundHarness();
    failed.fail();
    await failed.context.ensureBackgroundPageIsOpen();
    await failed.context.ensureBackgroundPageIsOpen();
    assert.equal(failed.creates, 1, 'Failed creation remains throttled');
    assert.equal(failed.timers.size, 1, 'Concurrent retries share a timer');
    failed.advance(5000);
    await failed.context.ensureBackgroundPageIsOpen();
    assert.equal(failed.creates, 2, 'Failed creation can retry after cooldown');

    const loading = backgroundHarness();
    await loading.context.ensureBackgroundPageIsOpen();
    loading.context.backgroundPageTabIdLoaded = false;
    await loading.close();
    await loading.context.ensureBackgroundPageIsOpen();
    assert.equal(loading.creates, 1, 'Closing an uninitialized tab retains failure protection');

    const concurrent = backgroundHarness();
    await Promise.all([concurrent.context.ensureBackgroundPageIsOpen(), concurrent.context.ensureBackgroundPageIsOpen()]);
    assert.equal(concurrent.creates, 1, 'Concurrent requests create only one background');
    await concurrent.close(9999);
    assert.equal(concurrent.context.backgroundPageTabIdLoaded, true, 'Unrelated tab closure keeps background readiness');

    const menu = bootstrapHarness('chrome-extension:');
    assert(menu.classes.has('popup-initializing'));
    menu.listeners.DOMContentLoaded();
    assert(menu.classes.has('popup-initializing'), 'Synchronous menu setup finishes before reveal');
    [...menu.timers.values()].find(t => t.ms === 0).fn();
    assert(!menu.classes.has('popup-initializing'), 'Parsed menu is revealed without waiting for background');
    assert(![...menu.timers.values()].some(t => t.ms === 1500), 'Normal reveal cancels fallback');

    const broken = bootstrapHarness('chrome-extension:');
    [...broken.timers.values()].find(t => t.ms === 1500).fn();
    assert(!broken.classes.has('popup-initializing'), 'Fallback reveals menu even without DOMContentLoaded');
    for (const protocol of ['file:', 'https:']) {
        const standalone = bootstrapHarness(protocol);
        assert.equal(standalone.classes.size, 0, 'Standalone/Electron menu is not gated');
        assert.equal(standalone.timers.size, 0);
    }
    console.log('Popup startup, fallback, background restart, concurrency and retry regressions passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
