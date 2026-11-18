const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../actions/EventFlowSystem.js'), 'utf8');

function engine() {
    const context = vm.createContext({ window: {}, console, setTimeout, clearTimeout });
    vm.runInContext(source + '\nglobalThis.Engine = EventFlowSystem;', context);
    const system = Object.create(context.Engine.prototype);
    system.flows = [];
    return system;
}

function raid(config = {}) {
    return { id: 'raid', type: 'trigger', triggerType: 'eventRaid', config };
}

function redirect(id = 'redirect-1') {
    // Standard capture supplies banner text and an optional native ID, not viewers.
    return {
        type: 'youtube', event: 'redirect', chatname: 'Fixture',
        chatmessage: 'Fixture redirected their viewers here', textonly: true,
        membership: 'REDIRECT', meta: { messageId: id }
    };
}

test('YouTube redirects match Raid with absent or zero minimum viewers', async () => {
    const system = engine();
    for (const config of [{}, { minViewers: 0 }, { minViewers: '0' }]) {
        assert.equal(await system.evaluateTrigger(raid(config), redirect()), true);
    }
});

test('YouTube redirects without viewer counts do not meet a positive minimum', async () => {
    const system = engine();
    for (const minViewers of [1, 10, '10']) {
        assert.equal(await system.evaluateTrigger(raid({ minViewers }), redirect()), false);
    }
});

test('Redirects do not require a native ID or redirector name', async () => {
    const system = engine();
    const message = redirect();
    delete message.meta;
    message.chatname = '';
    assert.equal(await system.evaluateTrigger(raid(), message), true);
    assert.equal(await system.evaluateTrigger(raid({ minViewers: 1 }), message), false);
});

test('Raid source filters apply to redirects as well as Twitch raids', async () => {
    const system = engine();
    for (const [sources, expected] of [[undefined, true], [[], true], [['youtube'], true], [['twitch', 'youtube'], true], [['twitch'], false], [['kick'], false]]) {
        assert.equal(await system.evaluateTrigger(raid({ sources }), redirect()), expected);
    }
    const message = { type: 'twitch', event: 'raid', chatname: 'Fixture', meta: { viewers: 10 } };
    assert.equal(await system.evaluateTrigger(raid({ sources: ['youtube'] }), message), false);
    assert.equal(await system.evaluateTrigger(raid({ sources: ['twitch'] }), message), true);
});

test('Redirect is a YouTube-only Raid alias', async () => {
    const system = engine();
    for (const type of ['twitch', 'kick', 'tiktok', '', undefined]) {
        assert.equal(await system.evaluateTrigger(raid(), { ...redirect(), type }), false);
    }
});

test('Raid accepts case-normalized event names but ignores unrelated events', async () => {
    const system = engine();
    for (const event of ['redirect', 'REDIRECT', 'ReDiReCt', 'raid', 'RAID']) {
        assert.equal(await system.evaluateTrigger(raid(), { ...redirect(), event }), true);
    }
    for (const event of ['new_follower', 'sponsorship', 'superchat', '', true, false, null, undefined]) {
        assert.equal(await system.evaluateTrigger(raid(), { ...redirect(), event }), false);
    }
    assert.equal(await system.evaluateTrigger(raid(), null), false);
});

test('Twitch Raid viewer threshold is inclusive and supports existing numeric strings', async () => {
    const system = engine();
    for (const [viewers, expected] of [[9, false], [10, true], [11, true], ['9', false], ['10', true]]) {
        const message = { type: 'twitch', event: 'raid', chatname: 'Fixture', meta: { viewers } };
        assert.equal(await system.evaluateTrigger(raid({ minViewers: 10 }), message), expected);
    }
});

test('Raid viewer lookup prefers meta, including zero, and falls back only when absent', async () => {
    const system = engine();
    const message = { type: 'twitch', event: 'raid', chatname: 'Fixture', viewers: 20 };
    for (const [meta, expected] of [[undefined, true], [{}, true], [{ viewers: null }, true], [{ viewers: 0 }, false], [{ viewers: 9 }, false], [{ viewers: 10 }, true]]) {
        assert.equal(await system.evaluateTrigger(raid({ minViewers: 10 }), { ...message, meta }), expected);
    }
});

test('Missing and non-finite viewer counts cannot pass a positive minimum', async () => {
    const system = engine();
    for (const viewers of [undefined, null, '', 'unknown', NaN, Infinity, -Infinity, -1]) {
        const message = { type: 'twitch', event: 'raid', chatname: 'Fixture', meta: { viewers } };
        assert.equal(await system.evaluateTrigger(raid({ minViewers: 1 }), message), false);
    }
});

test('Raid does not consume metadata-only traffic or mutate the event identity', async () => {
    const system = engine();
    assert.equal(await system.evaluateTrigger(raid(), { type: 'youtube', event: 'redirect', meta: { messageId: 'counter' } }), false);
    const message = redirect();
    const before = JSON.stringify(message);
    assert.equal(await system.evaluateTrigger(raid(), message), true);
    assert.equal(JSON.stringify(message), before);
});

function flow(id, config = {}, active = true) {
    return {
        id, active,
        nodes: [raid(config), { id: 'mark', type: 'action', actionType: 'addSuffix', config: { suffix: ' [raid]' } }],
        connections: [{ from: 'raid', to: 'mark' }]
    };
}

test('Each distinct redirect reaches the matching action exactly once', async () => {
    const system = engine();
    system.flows = [flow('matching', { sources: ['youtube'] }), flow('filtered', { sources: ['twitch'] }), flow('disabled', {}, false)];
    const calls = [];
    const execute = system.executeAction;
    system.executeAction = async function(node, message, ...rest) {
        calls.push(message.meta.messageId);
        return execute.call(this, node, message, ...rest);
    };
    const expected = Array.from({ length: 40 }, (_, i) => 'redirect-' + i);
    // Identical author/text must not collapse distinct events in the flow engine.
    const inputs = expected.map(redirect);
    const outputs = await Promise.all(inputs.map(message => system.processMessage(message)));
    assert.deepEqual(calls.slice().sort(), expected.slice().sort());
    assert.equal(new Set(calls).size, expected.length);
    assert.deepEqual(outputs.map(message => message.meta.messageId), expected);
    for (let i = 0; i < inputs.length; i++) {
        assert.equal(outputs[i].chatmessage, inputs[i].chatmessage + ' [raid]');
        assert.equal(inputs[i].chatmessage, 'Fixture redirected their viewers here');
        assert.equal(outputs[i].event, 'redirect');
    }
});

test('Positive minimum suppresses the action until a counted Raid meets it', async () => {
    const system = engine();
    system.flows = [flow('minimum', { minViewers: 10 })];
    const input = redirect();
    assert.equal((await system.processMessage(input)).chatmessage, input.chatmessage);
    const twitch = { type: 'twitch', event: 'raid', chatname: 'Fixture', chatmessage: 'Raid', textonly: true, meta: { viewers: 10 } };
    assert.equal((await system.processMessage(twitch)).chatmessage, 'Raid [raid]');
});
