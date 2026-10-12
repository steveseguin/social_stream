const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../actions/EventFlowSystem.js'), 'utf8') + '\nglobalThis.EFS = EventFlowSystem;', context);
const flow = Object.create(context.EFS.prototype);

test('Selected bold applies only to template-marked text, including individual words and lines', () => {
    assert.equal(flow.renderThermalPrintText('**{buyer}**\n{itemName}', { buyer: 'Inky', itemName: 'Blue mug' }, 'selected'), '<strong>Inky</strong>\nBlue mug');
    assert.equal(flow.renderThermalPrintText('Order **{counterValue}**: **Thank you**', { counterValue: 0 }, 'selected'), 'Order <strong>0</strong>: <strong>Thank you</strong>');
    assert.equal(flow.renderThermalPrintText('**unclosed', {}, 'selected'), '**unclosed');
});
test('Buyer and product values cannot introduce HTML or additional bold spans', () => {
    assert.equal(flow.renderThermalPrintText('**{username}**\n{itemName}', { chatname: '<img src=x>**test**', itemName: '<b>Mug</b> & **Tea**' }, 'selected'), '<strong>&lt;img src=x&gt;**test**</strong>\n&lt;b&gt;Mug&lt;/b&gt; &amp; **Tea**');
});
for (const weight of [undefined, 'bold', 'normal']) test(`Existing ${weight || 'default'} labels retain literal asterisks and escaped text`, () => {
    assert.equal(flow.renderThermalPrintText('**{username}**\n{itemName}', { chatname: 'Inky', itemName: '<Mug>' }, weight), '**Inky**\n&lt;Mug&gt;');
});
test('Thermal action sends mixed weights without changing label dimensions, copies or metadata', async () => {
    let captured;
    flow.printThermal = async (html, options) => { captured = { html, options }; return { success: true }; };
    const input = { type: 'whatnot', chatname: 'Inky', itemName: 'Blue mug', meta: { purchase: true } };
    const result = await flow.executeAction({ actionType: 'printThermal', config: { text: '**{username}**\n{itemName}', fontWeight: 'selected', fontSize: 14, printerName: 'Fixture printer', labelHeight: 25.4, copies: 2 } }, input);
    assert.match(captured.html, /font-weight:normal/);
    assert.match(captured.html, /<strong>Inky<\/strong>\nBlue mug/);
    assert.equal(captured.options.height, '25.4mm'); assert.equal(captured.options.printerName, 'Fixture printer'); assert.equal(captured.options.copies, 2);
    assert.equal(result.message.meta.purchase, true); assert.equal(result.message.meta.thermalPrintResult.success, true);
    assert.deepEqual(input.meta, { purchase: true });
});
