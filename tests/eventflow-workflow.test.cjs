'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const router = require('../js/streamdeck-remote-control.js');
function system() {
    const context = vm.createContext({ window: {}, console, setTimeout, clearTimeout });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../actions/EventFlowSystem.js'), 'utf8') + '\nglobalThis.EFS = EventFlowSystem;', context);
    const engine = Object.create(context.EFS.prototype);
    engine.flows = [fixture('one'), fixture('two'), fixture('disabled', false), { id: 'chat', active: true, nodes: [{ type: 'trigger', triggerType: 'anyMessage', config: {} }] }];
    return engine;
}
function fixture(id, active = true) {
    return { id, name: id, active, nodes: [1, 2].map(n => ({ id: id + n, type: 'trigger', triggerType: 'apiTrigger', config: { trigger: 'break' } })) };
}
test('Discovery lists each enabled flow/name once and exact targeting preserves unrelated flows', async () => {
    const engine = system(), calls = [];
    engine.evaluateFlow = async (flow, message) => calls.push({ id: flow.id, message });
    assert.equal(engine.getWorkflowTriggers().length, 2);
    assert.equal(engine.triggerWorkflow({ trigger: ' break ', flowId: 'one', data: { minutes: 5 } }).matchedFlows, 1);
    await new Promise(setImmediate);
    assert.deepEqual(calls.map(c => c.id), ['one']);
    assert.equal(calls[0].message.meta.workflow.data.minutes, 5);
    assert.equal(engine.triggerWorkflow({ trigger: 'break', flowId: 'disabled' }).code, 'WORKFLOW_NOT_FOUND');
    assert.equal(engine.triggerWorkflow('Break').code, 'WORKFLOW_NOT_FOUND');
    assert.equal(engine.triggerWorkflow('break').matchedFlows, 2);
});
test('Malformed values cannot start workflows', () => {
    const engine = system();
    engine.evaluateFlow = () => assert.fail('Invalid input executed');
    const circular = {}; circular.self = circular;
    for (const value of [undefined, null, [], {}, '{broken', '', ' '.repeat(5), { trigger: 'x'.repeat(101) }, { trigger: 'break', data: [] }, { trigger: 'break', data: null }, { trigger: 'break', flowId: '' }, { trigger: 'break', extra: true }, { trigger: 'break', data: circular }, { trigger: 'break', data: { large: 'x'.repeat(32768) } }]) {
        assert.equal(engine.triggerWorkflow(value).code, 'INVALID_VALUE');
    }
});
test('Acceptance does not wait for delayed actions and repeated calls each start a run', async () => {
    const engine = system(), pending = [], messages = [];
    engine.evaluateFlow = async (flow, message) => { messages.push(message); await new Promise(resolve => pending.push(resolve)); };
    for (let i = 0; i < 3; i++) assert.equal(engine.triggerWorkflow(JSON.stringify({ trigger: 'break', flowId: 'one', data: { n: i } })).status, 'accepted');
    await new Promise(setImmediate);
    assert.equal(pending.length, 3);
    assert.equal(new Set(messages).size, 3);
    assert.deepEqual(messages.map(m => m.meta.workflow.data.n), [0, 1, 2]);
    for (const resolve of pending) resolve();
    await new Promise(setImmediate);
    assert(messages.every(m => !engine.workflowMessages.has(m)), 'Authority marker released after completion');
});
test('Chat cannot forge API authority; workflow data uses existing nested template variables', async () => {
    const engine = system(), trigger = engine.flows[0].nodes[0];
    const message = engine.createWorkflowMessage('break', { minutes: 5, nested: { name: 'Fixture' } });
    assert.equal(await engine.evaluateTrigger(trigger, message), true);
    assert.equal(await engine.evaluateTrigger(trigger, JSON.parse(JSON.stringify(message))), false);
    assert.equal(engine.replaceTemplateVars('{meta.workflow.trigger}: {meta.workflow.data.minutes} / {meta.workflow.data.nested.name}', message), 'break: 5 / Fixture');
    assert.equal(engine.renderWebhookBody('{"minutes":"{meta.workflow.data.minutes}"}', message), '{"minutes":"5"}');
    assert.equal(engine.renderWebhookBody('{"literal":"unchanged"}', message), '{"literal":"unchanged"}');
});
test('Named workflows are advertised as background-owned SSN commands', () => {
    const capabilities = router.buildCapabilities({});
    assert.equal(capabilities.ssn.actions.getWorkflowTriggers, true);
    assert.equal(capabilities.ssn.actions.triggerWorkflow, true);
});
