const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../actions/EventFlowSystem.js'), 'utf8');
function engine() {
    const context = vm.createContext({ window: { location: { search: '' } }, console,
        setTimeout, clearTimeout, setInterval, clearInterval, indexedDB: { open: () => ({}) } });
    vm.runInContext(source + '\nglobalThis.Engine = EventFlowSystem;', context);
    const system = new context.Engine({ allowEvalCustomJs: true });
    // These fixtures exercise cache lifetime, not the separately tested DOM parser.
    system.stripHtml = text => text.replace(/<[^>]*>/g, '');
    return system;
}
const input = () => ({ type: 'twitch', chatname: 'Fixture', chatmessage: 'hello', textContent: 'hello', textonly: false });
function flow(id, trigger, action) {
    return { id, active: true, nodes: [
        { id: id + '-trigger', type: 'trigger', ...trigger },
        { id: id + '-action', type: 'action', ...action }
    ], connections: [{ from: id + '-trigger', to: id + '-action' }] };
}

for (const [actionType, config, expected] of [
    ['modifyMessage', { newMessage: '<b>changed</b>' }, 'changed'],
    ['addPrefix', { prefix: 'new: ' }, 'new: hello'],
    ['addSuffix', { suffix: '!' }, 'hello!'],
    ['findReplace', { find: 'hello', replace: 'bye' }, 'bye'],
    ['removeText', { removeType: 'removeFirst', count: 1 }, 'ello'],
    ['setProperty', { property: 'chatmessage', value: 'replacement' }, 'replacement'],
    ['customJs', { code: 'message.chatmessage = "custom"; return { modified: true, message };' }, 'custom']
]) {
    test(`${actionType} refreshes text seen by later flows`, async () => {
        const system = engine();
        system.flows = [
            flow('edit', { triggerType: 'anyMessage', config: {} }, { actionType, config }),
            flow('match', { triggerType: 'messageEquals', config: { text: expected } },
                { actionType: 'setProperty', config: { property: 'matched', value: 'yes' } })
        ];
        const result = await system.processMessage(input());
        assert.equal(result.matched, 'yes');
        assert.equal(result.textContent, expected);
    });
}

test('format-only changes invalidate the old parsed value', async () => {
    const system = engine();
    const message = { ...input(), chatmessage: '<b>hello</b>', textonly: true, textContent: '<b>hello</b>' };
    const result = await system.executeAction({ actionType: 'customJs', config: {
        code: 'return { modified: true, message: { ...message, textonly: false } };'
    } }, message);
    assert.equal(Object.hasOwn(result.message, 'textContent'), false);
    assert.equal(await system.evaluateTrigger({ triggerType: 'messageEquals', config: { text: 'hello' } }, result.message), true);
});

test('literal text stays literal and unrelated actions preserve the cache', async () => {
    const system = engine();
    const unchanged = await system.executeAction({ actionType: 'setProperty', config: { property: 'nameColor', value: 'red' } }, input());
    assert.equal(unchanged.message.textContent, 'hello');
    const literal = { ...input(), chatmessage: '<b>hello</b>', textonly: true };
    const changed = await system.executeAction({ actionType: 'addPrefix', config: { prefix: 'new ' } }, literal);
    assert.equal(Object.hasOwn(changed.message, 'textContent'), false);
    system.stripHtml = () => assert.fail('Literal chat must not be parsed as HTML');
    assert.equal(await system.evaluateTrigger({ triggerType: 'messageEquals', config: { text: 'new <b>hello</b>' } }, changed.message), true);
});

test('empty replacements cannot retain the previous cached text', async () => {
    const system = engine();
    const result = await system.executeAction({ actionType: 'modifyMessage', config: { newMessage: '' } }, input());
    assert.equal(Object.hasOwn(result.message, 'textContent'), false);
    assert.equal(await system.evaluateTrigger({ triggerType: 'messageEquals', config: { text: '' } }, result.message), true);
});
