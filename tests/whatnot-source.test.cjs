const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Synthetic Phoenix packets exercise the existing source entry points. They
// are not a claim that every optional field is present in the live feed.
const buyer = { id: 'buyer-1', username: 'Buyer <One>' };
const product = {
    id: 'product-1', name: 'Blue mug <large>', auctionId: 'auction-1',
    orderId: 'order-1', livestreamId: 'stream-1', bidCount: 2,
    auctionEndTime: '2026-09-23T19:00:00Z', auctionMinimumCents: 100,
    highestBid: { id: 'bid-2', user: buyer, price: { amount: 1250, currency: 'USD' } },
    purchaserUser: buyer
};
const packet = (event, payload) => JSON.stringify([null, null, 'public_livestream:stream-1', event, payload]);

function capture() {
    const messages = [], listeners = {};
    let electronListener, settingsListener, now = 10000;
    const window = { addEventListener: (name, callback) => { listeners[name] = callback; },
        ninjafy: { onWebSocketMessage: callback => { electronListener = callback; } } };
    const context = vm.createContext({
        window, document: { querySelector: () => null, querySelectorAll: () => [] },
        console: { log() {}, warn() {}, error() {} }, setInterval() {}, setTimeout() {}, clearTimeout() {},
        Date: { now: () => now }, TextDecoder, ArrayBuffer, Uint8Array,
        chrome: { runtime: { id: 'fixture', onMessage: { addListener: fn => { settingsListener = fn; } },
            sendMessage(_id, request, callback) {
                if (request.getSettings) callback({ settings: {}, state: true });
                if (request.message) messages.push(JSON.parse(JSON.stringify(request.message)));
            } } }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../sources/whatnot.js'), 'utf8'), context);
    return {
        messages,
        receive: data => electronListener({ type: 'message', data }),
        page: data => listeners.message({ source: window, data: { source: 'whatnot-ws-interceptor', type: 'receive', data } }),
        advance: () => { now += 1500; },
        enabled: state => settingsListener({ state }, {}, () => {})
    };
}

test('auction and sale details reach existing source output without claiming a paid purchase', () => {
    const c = capture();
    for (const event of ['auction_started', 'new_bid', 'auction_ended', 'product_sold']) {
        c.receive(packet(event, { product, highestBidder: buyer }));
    }
    assert.deepEqual(c.messages.map(m => m.event), ['auction_started', 'new_bid', 'auction_ended', 'product_sold']);
    const sale = c.messages[3];
    assert.equal(sale.platform, 'whatnot');
    assert.equal(sale.type, 'whatnot');
    assert.equal(sale.chatname, buyer.username);
    assert.equal(sale.userid, buyer.id);
    assert.equal(sale.subtitle, product.name);
    assert.equal(sale.textonly, true);
    assert.equal(sale.meta.orderId, 'order-1');
    assert.equal(sale.meta.auctionId, 'auction-1');
    assert.equal(sale.meta.productId, 'product-1');
    assert.equal(sale.meta.price, 12.5);
    assert.equal(sale.meta.currency, 'USD');
    assert.equal(c.messages[0].meta.price, 1);
    assert.equal(sale.meta.paymentStatus, undefined);
    assert.equal(sale.hasDonation, '');
    assert.equal(sale.donoValue, undefined);
});

test('payment failures preserve supplied identity/IDs but exclude raw payment data', () => {
    const c = capture();
    c.receive(packet('payment_failed', { user: buyer, product, transactionId: 'transaction-1',
        payment: { cardNumber: 'private fixture' }, address: 'private fixture' }));
    const failure = c.messages[0];
    assert.equal(failure.event, 'payment_failed');
    assert.equal(failure.meta.paymentStatus, 'failed');
    assert.equal(failure.userid, buyer.id);
    assert.equal(failure.meta.transactionId, 'transaction-1');
    assert.equal(failure.meta.orderId, 'order-1');
    assert(!JSON.stringify(failure).includes('private fixture'));
    c.receive(packet('payment_failed', { orderId: 'order-2' }));
    assert.equal(c.messages[1].chatname, '');
    assert.equal(c.messages[1].subtitle, '');
    assert.equal(c.messages[1].meta.orderId, 'order-2');
    assert.equal(c.messages[1].meta.productId, undefined);
    c.receive(packet('payment_failed', { product: { highestBid: product.highestBid } }));
    assert.equal(c.messages[2].userid, undefined, 'a current highest bidder is not necessarily the failed payer');
});

test('duplicate capture bridges emit once, but later/repeated item sales are preserved', () => {
    const c = capture(), data = packet('product_sold', { product });
    c.receive(data); c.page(data);
    assert.equal(c.messages.length, 1);
    c.receive(packet('product_sold', { product: { ...product, auctionId: 'auction-2', orderId: 'order-2' } }));
    assert.equal(c.messages.length, 2);
    c.advance(); c.page(data);
    assert.equal(c.messages.length, 3);
});

test('disabled capture and malformed packets do not produce commerce events', () => {
    const c = capture();
    for (const value of [null, false, 'invalid', 5, []]) c.receive(packet('product_sold', value));
    c.receive('not json');
    c.enabled(false); c.receive(packet('product_sold', { product }));
    assert.equal(c.messages.length, 0);
    c.enabled(true); c.receive(packet('product_sold', { product }));
    assert.equal(c.messages.length, 1);
});

test('explicit payment status is retained, while ordinary chat still uses its existing contract', () => {
    const c = capture();
    c.receive(packet('product_sold', { product, paymentStatus: 'pending' }));
    assert.equal(c.messages[0].meta.paymentStatus, 'pending');
    c.receive(packet('new_msg', { id: 'chat-1', user: { id: 'viewer-1', username: 'Viewer' }, message: 'Hello' }));
    const chat = c.messages[1];
    assert.equal(chat.chatmessage, 'Hello');
    assert.equal(chat.event, false);
    assert.equal(chat.userid, 'viewer-1');
});

test('new source events already work with Event Flow event filters and nested templates', async () => {
    const c = capture();
    c.receive(packet('payment_failed', { user: buyer, product }));
    const context = vm.createContext({ window: {}, console });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../actions/EventFlowSystem.js'), 'utf8') + '\nthis.EFS = EventFlowSystem;', context);
    const flow = Object.create(context.EFS.prototype), message = c.messages[0];
    assert.equal(await flow.evaluateTrigger({ triggerType: 'eventOther', config: { eventType: 'payment_failed' } }, message), true);
    assert.equal(await flow.evaluateTrigger({ triggerType: 'compareProperty', config: { property: 'meta.paymentStatus', operator: 'eq', value: 'failed' } }, message), true);
    assert.equal(flow.replaceTemplateVars('{username}|{subtitle}|{meta.orderId}', message), 'Buyer <One>|Blue mug <large>|order-1');
});
