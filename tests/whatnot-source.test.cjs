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
    const window = { location: { pathname: '/live/fixture' },
        addEventListener: (name, callback) => { listeners[name] = callback; },
        ninjafy: { onWebSocketMessage: callback => { electronListener = callback; } } };
    const context = vm.createContext({
        window, document: { body: { getAttribute: () => null }, querySelector: () => null, querySelectorAll: () => [] },
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

// Whatnot's v20260924-0044 client chunk 2575-1a83fd123331ef67.js subscribes
// to PAYMENT_SUCCEEDED and reads product.purchaserUser (or giftRecipientUser
// for recipient shipping). Capture keeps the purchaser as the buyer.
test('payment success carries its own buyer/item/order details without generating another purchase', () => {
    const c = capture();
    const paidProduct = { ...product, giftRecipientUser: { id: 'recipient-1', username: 'Recipient' },
        paymentId: 'private-payment-id' };
    c.receive(packet('product_sold', { product: paidProduct }));
    c.receive(packet('payment_failed', { product: paidProduct }));
    const successPacket = packet('payment_succeeded', { product: paidProduct,
        paymentStatus: 'pending', payment: { clientSecret: 'private-secret' } });
    c.receive(successPacket); c.page(successPacket);
    assert.deepEqual(c.messages.map(message => message.event), ['product_sold', 'payment_failed', 'payment_succeeded']);
    const success = c.messages[2];
    assert.equal(success.platform, 'whatnot');
    assert.equal(success.type, 'whatnot');
    assert.equal(success.userid, buyer.id);
    assert.equal(success.chatname, buyer.username);
    assert.equal(success.subtitle, product.name);
    assert.equal(success.chatmessage, 'Payment succeeded: ' + product.name);
    assert.equal(success.textonly, true);
    assert.equal(success.meta.orderId, product.orderId);
    assert.equal(success.meta.paymentStatus, 'succeeded', 'the explicit notification defines its payment status');
    assert.equal(success.meta.websocketEvent, 'payment_succeeded');
    assert.equal(success.hasDonation, '');
    assert.equal(success.donoValue, undefined);
    assert(!JSON.stringify(success).includes('private-'));
    assert.equal(c.messages[0].meta.paymentStatus, undefined, 'an earlier sale is not retroactively changed');

    c.page(packet('payment_succeeded', { product: { ...paidProduct, orderId: 'order-2' } }));
    assert.equal(c.messages.length, 4, 'another order for the same item still arrives');
    assert.equal(c.messages[3].meta.orderId, 'order-2');
});

test('partial payment-success events never borrow a previous buyer/item or a highest bidder', () => {
    const c = capture();
    c.receive(packet('product_sold', { product }));
    c.receive(packet('payment_succeeded', { orderId: product.orderId }));
    const partial = c.messages[1];
    assert.equal(partial.meta.orderId, product.orderId);
    assert.equal(partial.meta.paymentStatus, 'succeeded');
    assert.equal(partial.chatmessage, 'Payment succeeded');
    assert.equal(partial.chatname, '');
    assert.equal(partial.userid, undefined);
    assert.equal(partial.subtitle, '');
    assert.equal(partial.meta.productId, undefined);
    c.receive(packet('payment_succeeded', { product: { highestBid: product.highestBid } }));
    assert.equal(c.messages[2].userid, undefined, 'highest bidder does not establish the payer');
    c.receive(packet('payment_succeeded', { product: { purchaserUserId: 'payer-2', name: 'Other item' } }));
    assert.equal(c.messages[3].userid, 'payer-2');
    assert.equal(c.messages[3].chatname, '');
    assert.equal(c.messages[3].subtitle, 'Other item');
});

// Field paths checked against Whatnot's web client v20260924-0044:
// live/[id]/page-6ad5437309237759.js handles purchaserUserId, parentId,
// transactionType and placeOrderErrorReason, and maps productId to the catalog.
// These fixtures model that contract; they are not recorded payment events.
test('sale/payment metadata exposes supplied references and error codes without copying payment objects', () => {
    const c = capture();
    const details = { ...product, productId: 'catalog-1', parentId: 'listing-1',
        transactionType: 'BUY_IT_NOW', quantity: 50, paymentId: 'private-payment-id',
        placeOrderErrorReason: 'card_authorization_required' };
    c.receive(packet('product_sold', { product: details }));
    const sale = c.messages[0];
    assert.equal(sale.meta.productId, product.id, 'existing listing reference is preserved');
    assert.equal(sale.meta.catalogProductId, 'catalog-1');
    assert.equal(sale.meta.parentProductId, 'listing-1');
    assert.equal(sale.meta.transactionType, 'BUY_IT_NOW');
    assert.equal(sale.meta.placeOrderErrorReason, 'card_authorization_required');
    assert.equal(sale.meta.orderId, 'order-1');
    assert.equal(sale.meta.quantity, undefined, 'stock count is not a purchase quantity');
    assert.equal(sale.meta.paymentStatus, undefined, 'sale type and error code do not infer payment status');
    assert(!JSON.stringify(sale).includes('private-payment-id'));
    c.receive(packet('payment_failed', { product: details, placeOrderErrorReason: 'payment_method_declined' }));
    assert.equal(c.messages[1].meta.placeOrderErrorReason, 'payment_method_declined', 'event-level error takes precedence');
    assert.equal(c.messages[1].meta.paymentStatus, 'failed');

    c.receive(packet('product_sold', { product: { id: 'minimal-product', productId: {}, parentId: [],
        transactionType: {}, placeOrderErrorReason: { private: true } } }));
    const minimal = c.messages[2];
    for (const field of ['catalogProductId', 'parentProductId', 'transactionType', 'placeOrderErrorReason', 'orderId']) {
        assert.equal(minimal.meta[field], undefined, field + ' must not copy structured/previous data');
    }
});

test('scalar purchaser IDs identify sale/payment events without inventing a name or choosing another bidder', () => {
    const c = capture();
    const idOnly = { id: 'listing-2', purchaserUserId: 'buyer-2', highestBid: product.highestBid };
    c.receive(packet('product_sold', { product: idOnly }));
    c.receive(packet('payment_failed', { product: idOnly }));
    for (const message of c.messages) {
        assert.equal(message.userid, 'buyer-2');
        assert.equal(message.chatname, '');
        assert.equal(message.meta.orderId, undefined);
    }
    c.receive(packet('new_bid', { product: idOnly, highestBidder: buyer }));
    assert.equal(c.messages[2].userid, buyer.id, 'bid events still identify the bidder');
    c.receive(packet('product_sold', { product: { ...idOnly, purchaserUser: buyer } }));
    assert.equal(c.messages[3].userid, buyer.id, 'existing full user identity keeps its precedence');
    c.receive(packet('payment_failed', { product: { id: 'listing-3', purchaserUserId: {} } }));
    assert.equal(c.messages[4].userid, undefined, 'invalid and previous purchaser IDs are not used');
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
    for (const event of ['product_sold', 'payment_succeeded']) {
        for (const value of [null, false, 'invalid', 5, []]) c.receive(packet(event, value));
    }
    c.receive('not json');
    c.enabled(false);
    c.receive(packet('product_sold', { product }));
    c.page(packet('payment_succeeded', { product }));
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
    c.receive(packet('payment_failed', { user: buyer, product: { ...product, transactionType: 'BUY_IT_NOW' },
        placeOrderErrorReason: 'card_authorization_required' }));
    const context = vm.createContext({ window: {}, console });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../actions/EventFlowSystem.js'), 'utf8') + '\nthis.EFS = EventFlowSystem;', context);
    const flow = Object.create(context.EFS.prototype), message = c.messages[0];
    assert.equal(await flow.evaluateTrigger({ triggerType: 'eventOther', config: { eventType: 'payment_failed' } }, message), true);
    assert.equal(await flow.evaluateTrigger({ triggerType: 'compareProperty', config: { property: 'meta.paymentStatus', operator: 'eq', value: 'failed' } }, message), true);
    assert.equal(await flow.evaluateTrigger({ triggerType: 'compareProperty', config: { property: 'meta.transactionType', operator: 'eq', value: 'BUY_IT_NOW' } }, message), true);
    assert.equal(flow.replaceTemplateVars('{username}|{subtitle}|{meta.orderId}', message), 'Buyer <One>|Blue mug <large>|order-1');
    assert.equal(flow.replaceTemplateVars('{meta.placeOrderErrorReason}', message), 'card_authorization_required');
    c.page(packet('payment_succeeded', { product }));
    const success = c.messages[1];
    assert.equal(await flow.evaluateTrigger({ triggerType: 'eventType', config: { eventType: 'payment_succeeded' } }, success), true);
    assert.equal(await flow.evaluateTrigger({ triggerType: 'compareProperty', config: { property: 'meta.paymentStatus', operator: 'eq', value: 'succeeded' } }, success), true);
    for (const event of ['product_sold', 'payment_failed', 'purchase']) {
        assert.equal(await flow.evaluateTrigger({ triggerType: 'eventType', config: { eventType: event } }, success), false);
    }
    assert.equal(flow.replaceTemplateVars('{username}|{subtitle}|{meta.orderId}', success), 'Buyer <One>|Blue mug <large>|order-1');
});
