'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

async function checkRuntime(protocol) {
    const calls = [];
    let stored = { sources: ['youtube'], cheer: false, receipts: [] };
    const context = {
        location: { protocol }, crypto: webcrypto, URL, AbortController,
        setTimeout, clearTimeout,
        fetch() { throw new Error('Unpaired runtime check must not contact a room'); }
    };
    const extension = protocol === 'chrome-extension:' || protocol === 'moz-extension:';
    if (extension) {
        context.chrome = {
            runtime: { lastError: null },
            storage: { local: {
                get(keys, callback) {
                    assert.equal(keys[0], 'ncAudiencePrivate');
                    calls.push('load');
                    callback({ ncAudiencePrivate: stored });
                },
                set(update, callback) {
                    calls.push('save');
                    stored = update.ncAudiencePrivate;
                    callback();
                }
            } }
        };
    } else {
        context.ipcRenderer = { async invoke(channel, request) {
            assert.equal(channel, 'ninjachatter:audience-room');
            calls.push(request.op);
            if (request.op === 'load') return stored;
            assert.equal(request.op, 'save');
            stored = request.config;
        } };
    }
    context.window = context;
    vm.createContext(context);
    for (const name of ['connector.js', 'background.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../shared/audience-room', name), 'utf8'), context);
    }
    await new Promise(resolve => setImmediate(resolve));
    const before = await context.ncAudience.handle({ op: 'status' });
    assert.equal(before.state, 'disconnected');
    assert.equal(before.paired, false);
    assert.deepEqual(Array.from(before.sources), ['youtube']);
    const after = await context.ncAudience.handle({ op: 'save', sources: ['twitch'], cheer: true });
    assert.deepEqual(Array.from(after.sources), ['twitch']);
    assert.equal(after.cheer, true);
    assert.deepEqual(Array.from(stored.sources), ['twitch']);
    assert.deepEqual(calls, ['load', 'save']);
    console.log('PASS Audience storage and status for ' + protocol);
}

(async () => {
    for (const protocol of ['chrome-extension:', 'moz-extension:', 'file:', 'https:']) {
        await checkRuntime(protocol);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
