const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const M = require('../shared/monetization/core.js');
function flow(extra = {}) {
    const context = vm.createContext({ window: {}, setTimeout, clearTimeout, console: { warn() {}, error() {}, log() {} }, ...extra });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../actions/EventFlowSystem.js'), 'utf8') + '\nglobalThis.EFS = EventFlowSystem;', context);
    return Object.create(context.EFS.prototype);
}
const gift = event_type => M.throne({ contract_version: '1', event_id: event_type, event_type, data: { item_name: 'Mug', currency: 'USD', price: 2500, amount: 500, creator_username: 'fixture', gifter_username: 'Supporter' } });
const samples = [
    M.tip({ type: 'tip', amount: 5, currency: 'USD', timestamp: 123, anonymous: true }),
    gift('gift_purchased'), gift('contribution_purchased'), gift('gift_crowdfunded'),
    M.providerEvent('kofi', { type: 'Donation', is_public: true, amount: '5', currency: 'USD' }, 'kofi-tip'),
    M.providerEvent('kofi', { type: 'Shop Order', is_public: true, amount: '25', currency: 'USD', shop_items: [{ item_name: 'Mug' }] }, 'kofi-sale'),
    M.providerEvent('bmac', { type: 'wishlist_payment.created', data: { amount: 5, currency: 'USD', wishlist: { title: 'Mug', completed: true } } }, 'bmac-gift'),
    M.providerEvent('fourthwall', { type: 'GIFT_PURCHASE', data: { amounts: { total: { value: 25, currency: 'USD' } }, offer: { name: 'Gift to viewer' } } }, 'fourthwall-gift'),
    ...['ebay', 'shopify'].map(type => ({ platform: type, type, event: 'purchase', id: type + '-fixture', chatname: 'Anonymous', chatmessage: 'Purchased Mug', textonly: true, subtitle: 'Mug', meta: { commerce: { quantity: 2, currency: 'USD' } } }))
];
for (const sample of samples) test(`${sample.type}/${sample.event || 'tip'} routes to the intended triggers and action connectors`, async () => {
    const f = flow();
    assert.equal(await f.evaluateTrigger({ triggerType: 'eventDonation', config: {} }, sample), !!sample.hasDonation);
    assert.equal(await f.evaluateTrigger({ triggerType: 'eventGiftSub', config: {} }, sample), false);
    if (sample.event) for (const triggerType of ['eventType', 'eventOther']) assert.equal(await f.evaluateTrigger({ triggerType, config: { eventType: sample.event } }, sample), true);
    assert.equal(await f.evaluateTrigger({ triggerType: 'eventDonation', config: { sources: ['unrelated'] } }, sample), false);
    let audio;
    f.sendTargetP2P = (data, destination) => { audio = { data, destination }; };
    await f.executeAction({ actionType: 'playAudioClip', config: { sourceType: 'local', localAssetId: 'fixture-sound', volume: 0.5 } }, sample);
    assert.equal(audio.destination, 'actions'); assert.equal(audio.data.overlayNinja.actionType, 'play_audio'); assert.equal(audio.data.overlayNinja.localAssetId, 'fixture-sound');
    let receipt;
    f.printThermal = async (html, options) => { receipt = { html, options }; return { success: true, jobId: 'fixture' }; };
    const printed = await f.executeAction({ actionType: 'printThermal', config: { text: '**{username}**\n{subtitle}\n{donation}\n{meta.commerce.quantity}', fontWeight: 'selected' } }, sample);
    assert(receipt.html.includes(sample.chatname)); assert.equal(printed.message.meta.thermalPrintResult.success, true);
    assert.equal(sample.meta.thermalPrintResult, undefined);
});
test('native commerce action passes board fields and safely substitutes sale names', async () => {
 const f=flow();let sent;f.requestCommerceControl=async request=>{sent=request;return {commerceState:{boards:{}}};};
 let result=await f.executeAction({actionType:'commerceControl',config:{command:'boardSpot',data:'{"id":"12","status":"claimed"}'}},{});
 assert.equal(sent.data.id,'12');assert.equal(result.message.meta.commerceControlResult.success,true);
 await f.executeAction({actionType:'commerceControl',config:{command:'saleAdd',data:'{"title":"{subtitle}"}'}},{subtitle:'Card "A"\nSigned'});assert.equal(sent.data.title,'Card "A"\nSigned');
 sent=null;result=await f.executeAction({actionType:'commerceControl',config:{command:'saleAdd',data:'[]'}},{});
 assert.equal(sent,null);assert.equal(result.stopChain,true);
});
test('Nested gift details filter correctly without treating completion or re-gifting as another donation', async () => {
    const f = flow();
    assert.equal(await f.evaluateTrigger({ triggerType: 'compareProperty', config: { property: 'meta.commerce.recipient', operator: 'eq', value: 'creator' } }, gift('gift_purchased')), true);
    assert.equal(samples.find(x => x.type === 'fourthwall').meta.commerce.recipient, 'other');
    assert.equal(gift('gift_crowdfunded').hasDonation, undefined);
    assert.equal(f.replaceTemplateVars('{meta.commerce.goalAmount}/{meta.commerce.constructor}/{meta.__proto__.polluted}', gift('gift_crowdfunded')), '25//');
});
test('Receipt failures remain inspectable downstream and template data cannot insert HTML', async () => {
    const f = flow(), sample = { ...samples[0], chatname: '<img src=x>', subtitle: '**Mug** & Tea' };
    f.printThermal = async () => { throw new Error('Printer offline'); };
    const reply = await f.executeAction({ actionType: 'printThermal', config: {} }, sample);
    assert.equal(reply.message.meta.thermalPrintResult.success, false);
    assert.match(reply.message.meta.thermalPrintResult.error, /offline/);
    assert.equal(f.renderThermalPrintText('{username}\n{subtitle}', sample, 'selected'), '&lt;img src=x&gt;\n**Mug** &amp; Tea');
});
test('Synchronous webhooks return callbacks or block failed commerce actions without real requests', async () => {
    const f = flow(), sample = { ...samples[0], chatname: 'A"\nB' };
    const config = { url: 'https://example.invalid/fixture', body: '{"name":"{username}","currency":"{meta.ninjabacker.currency}"}', syncMode: true, blockOnFailure: true };
    let captured;
    f.fetchWithTimeout = async (url, options) => { captured = JSON.parse(options.body); return { ok: true, status: 200, text: async () => '{"accepted":true}' }; };
    let result = await f.executeAction({ actionType: 'webhook', config }, sample);
    assert.equal(captured.name, sample.chatname); assert.equal(captured.currency, 'USD'); assert.equal(result.message.webhookResponse.accepted, true); assert.equal(result.blocked, false);
    f.fetchWithTimeout = async () => ({ ok: false, status: 503, text: async () => 'offline' });
    result = await f.executeAction({ actionType: 'webhook', config }, sample);
    assert.equal(result.blocked, true); assert.match(result.message.webhookError, /503/);
    f.fetchWithTimeout = async () => { throw new Error('Timeout'); };
    result = await f.executeAction({ actionType: 'webhook', config }, sample);
    assert.equal(result.blocked, true); assert.match(result.message.webhookError, /Timeout/);
});
test('Provider optional product arrays tolerate malformed entries', () => {
    const junk = [null, false, 3, '', [], {}, { item_name: 'Mug', title: 'Mug', name: 'Mug' }];
    for (const [provider, payload] of [
        ['kofi', { type: 'Shop Order', is_public: true, shop_items: junk }],
        ['bmac', { type: 'extra_purchase.created', data: { extras: junk } }],
        ['fourthwall', { type: 'ORDER_PLACED', data: { offers: junk, amounts: { total: { value: 5, currency: 'USD' } } } }]
    ]) assert.equal(M.providerEvent(provider, payload, 'fixture').subtitle, 'Mug');
});
test('Inherited object names never become Throne event types', () => {
    for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) assert.equal(gift(name), null);
});
test('Product controls expose confirmed state without mutating the purchase payload', async () => {
    const commerce = { mode: 'pinned', selected: { name: 'Mug', url: 'https://example.invalid/mug' } };
    for (const extra of [
        { window: { handleMonetizationRequest: async () => ({ commerceState: commerce }) } },
        { chrome: { runtime: { sendMessage: (request, callback) => setTimeout(() => callback({ commerceState: commerce }), 1) } } }
    ]) {
        const f = flow(extra), sample = samples[0];
        const result = await f.executeAction({ actionType: 'commerceControl', config: { command: 'next' } }, sample);
        assert.equal(result.blocked, false); assert.equal(result.message.meta.commerceControlResult.success, true);
        assert.equal(result.message.meta.commerceControlResult.commerce.selected.name, 'Mug');
        assert.equal(sample.meta.commerceControlResult, undefined);
    }
});
test('Product controls report direct, callback, unavailable and timeout failures', async () => {
    for (const extra of [
        { window: { handleMonetizationRequest: async () => ({ error: 'No products saved' }) } },
        { window: { handleMonetizationRequest: async () => { throw Error('Storage offline'); } } },
        { window: { handleMonetizationRequest: async () => { throw null; } } },
        { chrome: { runtime: { lastError: { message: 'Host unavailable' }, sendMessage: (request, callback) => callback() } } },
        { chrome: { runtime: { sendMessage: (request, callback) => callback({ error: 'Invalid product' }) } } },
        { chrome: { runtime: { sendMessage: (request, callback) => callback() } } },
        { chrome: { runtime: { sendMessage: (request, callback) => callback({}) } } },
        { window: { handleMonetizationRequest: () => new Promise(() => {}) }, setTimeout: callback => setTimeout(callback, 1) },
        { chrome: { runtime: { sendMessage() {} } }, setTimeout: callback => setTimeout(callback, 1) },
        {}
    ]) {
        const f = flow(extra);
        const result = await f.executeAction({ actionType: 'commerceControl', config: { command: 'show' } }, samples[0]);
        assert.equal(result.blocked, false); assert.equal(result.stopChain, true); assert.equal(result.message.meta.commerceControlResult.success, false);
        assert(result.message.meta.commerceControlResult.error);
    }
});
test('Product controls preserve numeric counter metadata', async () => {
    const f = flow({ window: { handleMonetizationRequest: async () => ({ commerceState: { mode: 'hidden' } }) } });
    const result = await f.executeAction({ actionType: 'commerceControl', config: { command: 'hide' } }, { event: 'counter', meta: 3 });
    assert.equal(result.message.meta, 3); assert.equal(result.commerceControlResult.success, true);
});
test('Product callback requests settle once and keep out-of-order replies with their own action', async () => {
    const callbacks = [], f = flow({ chrome: { runtime: { sendMessage: (request, callback) => callbacks.push(callback) } } });
    const first = f.executeAction({ actionType: 'commerceControl', config: { command: 'show' } }, samples[0]);
    const second = f.executeAction({ actionType: 'commerceControl', config: { command: 'hide' } }, samples[0]);
    callbacks[1]({ commerceState: { mode: 'hidden' } });
    callbacks[0]({ commerceState: { mode: 'pinned' } });
    callbacks[0]({ error: 'Late duplicate' });
    assert.equal((await first).message.meta.commerceControlResult.commerce.mode, 'pinned');
    assert.equal((await second).message.meta.commerceControlResult.commerce.mode, 'hidden');
});
test('Failed product action stops the real flow chain and retains its outcome', async () => {
    const f = flow({ window: { handleMonetizationRequest: async () => ({ error: 'No products saved' }) } });
    const definition = { id: 'fixture', active: true, nodes: [
        { id: 'trigger', type: 'trigger', triggerType: 'eventDonation', config: {} },
        { id: 'control', type: 'action', actionType: 'commerceControl', config: { command: 'next' } },
        { id: 'audio', type: 'action', actionType: 'playAudioClip', config: { audioUrl: './audio/chime.wav' } }
    ], connections: [{ from: 'trigger', to: 'control' }, { from: 'control', to: 'audio' }] };
    f.flows = [definition];
    let sounds = 0;
    f.sendTargetP2P = () => sounds++;
    const result = await f.evaluateFlow(definition, samples[0]);
    assert.equal(sounds, 0); assert.equal(result.blocked, false);
    assert.equal(result.message.meta.commerceControlResult.success, false);
});
test('Failed product action stops its asynchronous chain without consuming the original event', async () => {
    const f = flow({ window: { handleMonetizationRequest: async () => ({ error: 'No products saved' }) } });
    const definition = { id: 'async-fixture', active: true, nodes: [
        { id: 'trigger', type: 'trigger', triggerType: 'eventDonation', config: {} },
        { id: 'async', type: 'action', actionType: 'continueAsync', config: {} },
        { id: 'control', type: 'action', actionType: 'commerceControl', config: { command: 'next' } },
        { id: 'audio', type: 'action', actionType: 'playAudioClip', config: { audioUrl: './audio/chime.wav' } }
    ], connections: [{ from: 'trigger', to: 'async' }, { from: 'async', to: 'control' }, { from: 'control', to: 'audio' }] };
    f.flows = [definition];
    let sounds = 0, controlFinished;
    const finished = new Promise(resolve => controlFinished = resolve), execute = f.executeAction;
    f.executeAction = async function (node, ...args) {
        const result = await execute.call(this, node, ...args);
        if (node.id === 'control') controlFinished(result);
        return result;
    };
    f.sendTargetP2P = () => sounds++;
    const result = await f.evaluateFlow(definition, samples[0]);
    assert.equal(result.blocked, false);
    assert.equal((await finished).stopChain, true);
    await new Promise(resolve => setTimeout(resolve, 1));
    assert.equal(sounds, 0);
});
