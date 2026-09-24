// Real SSApp source window -> existing WebSocket monitor -> source -> IPC -> Event Flow.
// Synthetic local packets; no live account, purchases, or physical printing.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const appRoot = process.env.SSAPP_REPO || path.resolve(root, '../ssn_app');
const { _electron } = require(path.join(appRoot, 'node_modules/playwright-core'));
const { WebSocketServer } = require(path.join(appRoot, 'node_modules/ws'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'settings/config_0.json'), 'utf8')).whatnot;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-whatnot-e2e-'));
fs.writeFileSync(path.join(profile, 'savedSync.json'), JSON.stringify({
    streamID: 'whatnot_fixture_' + Date.now(), password: 'false', state: true, settings: {}, wsServer: false
}));
const packet = (event, payload) => JSON.stringify([null, null, 'public_livestream:fixture', event, payload]);
const buyer = { id: 'fixture-buyer', username: 'Fixture Buyer' };
const product = { id: 'fixture-product', name: 'Blue mug', auctionId: 'auction-1', orderId: 'order-1',
    purchaserUser: buyer, highestBid: { id: 'bid-1', user: buyer, price: { amount: 1250, currency: 'USD' } } };

(async () => {
    let app, source;
    const server = http.createServer((_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><title>Whatnot capture fixture</title><h1>Local capture test</h1>' +
            '<script>window.fixtureSocket=new WebSocket("ws://"+location.host+"/whatnot.com/socket");</script>');
    });
    const sockets = new WebSocketServer({ server });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port + '/whatnot.com/live/fixture';
    const send = data => { for (const client of sockets.clients) if (client.readyState === 1) client.send(data); };
    try {
        app = await _electron.launch({ executablePath: require(path.join(appRoot, 'node_modules/electron')),
            cwd: appRoot, args: ['.', '--running-from-source', '--multiinstance', '--filesource=' + pathToFileURL(root + path.sep).href],
            env: { ...process.env, SSAPP_USER_DATA_DIR: profile } });
        const main = await app.firstWindow();
        await main.waitForFunction(() => window.stateManager?.initialized && configReady, null, { timeout: 60000 });
        await main.waitForFunction(() => document.getElementById('frame2')?.contentWindow?.eventFlowSystem, null, { timeout: 45000 });
        const bg = main.frames().find(frame => frame.url().includes('/background.html'));
        await bg.evaluate(async () => {
            window.whatnotBefore = []; window.whatnotAfter = [];
            const original = processIncomingMessage;
            processIncomingMessage = function (data) {
                if (data.type === 'whatnot') whatnotBefore.push(JSON.parse(JSON.stringify(data)));
                return original.apply(this, arguments);
            };
            const processFlow = eventFlowSystem.processMessage.bind(eventFlowSystem);
            eventFlowSystem.processMessage = async function (data) {
                const result = await processFlow(data);
                if (data.type === 'whatnot') whatnotAfter.push(JSON.parse(JSON.stringify(result)));
                return result;
            };
            await eventFlowSystem.saveFlow({ id: 'whatnot-fixture', name: 'Whatnot payment label', active: true,
                nodes: [
                    { id: 'event', type: 'trigger', triggerType: 'eventOther', config: { eventType: 'payment_failed' } },
                    { id: 'status', type: 'trigger', triggerType: 'compareProperty', config: { property: 'meta.paymentStatus', operator: 'eq', value: 'failed' } },
                    { id: 'both', type: 'logic', logicType: 'AND', config: {} },
                    { id: 'mark', type: 'action', actionType: 'addPrefix', config: { prefix: '[FAILED] ' } }
                ], connections: [{ from: 'event', to: 'both' }, { from: 'status', to: 'both' }, { from: 'both', to: 'mark' }] });
            await eventFlowSystem.saveFlow({ id: 'whatnot-success-fixture', name: 'Whatnot payment success', active: true,
                nodes: [
                    { id: 'success-event', type: 'trigger', triggerType: 'eventType', x: 80, y: 80, config: { eventType: 'payment_succeeded' } },
                    { id: 'success-source', type: 'trigger', triggerType: 'fromSource', x: 80, y: 260, config: { source: 'whatnot' } },
                    { id: 'success-both', type: 'logic', logicType: 'AND', x: 380, y: 170, config: {} },
                    { id: 'success-mark', type: 'action', actionType: 'addPrefix', x: 680, y: 170, config: { prefix: '[PAID] ' } }
                ], connections: [{ from: 'success-event', to: 'success-both' }, { from: 'success-source', to: 'success-both' }, { from: 'success-both', to: 'success-mark' }] });
        });
        // Verify that users can configure the supported Custom Event trigger in the editor.
        await main.locator('#main-navigation a[data-page="event-flow-editor"]').click();
        await bg.locator('.flow-item').filter({ hasText: 'Whatnot payment success' }).click();
        await bg.locator('.node[data-id="success-event"]').click();
        assert.equal(await bg.locator('#prop-eventType-select').inputValue(), '_custom');
        assert.equal(await bg.locator('#prop-eventType').inputValue(), 'payment_succeeded');
        await bg.locator('#save-flow-btn').click();
        await main.evaluate(args => ipcRenderer.sendSync('createWindow', args), {
            url, visible: true, sourceFiles: ['sources/whatnot.js'], config
        });
        for (let i = 0; i < 100 && !source; i++) {
            source = app.windows().find(page => page.url() === url);
            if (!source) await main.waitForTimeout(200);
        }
        assert(source, 'normal IPC created the source window');
        const ready = async id => {
            for (let i = 0; i < 60; i++) {
                send(packet('new_msg', { id, user: buyer, message: 'Fixture ready' }));
                if (await bg.evaluate(id => whatnotBefore.some(m => m.meta?.messageId === id), id)) return;
                await main.waitForTimeout(250);
            }
            throw new Error('The existing WebSocket capture did not receive the readiness packet');
        };
        await ready('ready-1');
        for (const event of ['auction_started', 'new_bid', 'auction_ended', 'product_sold', 'payment_failed', 'payment_succeeded']) {
            send(packet(event, { product, user: buyer, highestBidder: buyer }));
        }
        await bg.waitForFunction(() => whatnotAfter.some(m => m?.event === 'payment_succeeded'), null, { timeout: 15000 });
        const results = await bg.evaluate(() => ({ before: whatnotBefore, after: whatnotAfter }));
        const sale = results.before.find(m => m.event === 'product_sold');
        const failed = results.after.find(m => m.event === 'payment_failed');
        assert.equal(sale.userid, buyer.id);
        assert.equal(sale.subtitle, product.name);
        assert.equal(sale.meta.price, 12.5);
        assert.equal(sale.meta.paymentStatus, undefined);
        assert.equal(failed.meta.orderId, sale.meta.orderId);
        assert.equal(failed.meta.paymentStatus, 'failed');
        assert.match(failed.chatmessage, /^\[FAILED\] Payment failed: Blue mug/);
        assert.equal(await bg.evaluate(message => eventFlowSystem.replaceTemplateVars('{username}|{subtitle}|{meta.orderId}', message), sale), 'Fixture Buyer|Blue mug|order-1');
        const success = results.after.find(m => m.event === 'payment_succeeded');
        assert.equal(success.meta.paymentStatus, 'succeeded');
        assert.equal(success.meta.orderId, sale.meta.orderId);
        assert.equal(success.userid, buyer.id);
        assert.equal(success.subtitle, product.name);
        assert.match(success.chatmessage, /^\[PAID\] Payment succeeded: Blue mug/);
        assert.equal(success.hasDonation, '');
        assert.equal(success.donoValue, undefined);
        assert(!results.after.some(m => m?.event === 'purchase'));
        assert.equal(results.after.filter(m => m?.chatmessage?.startsWith('[PAID]')).length, 1);
        assert.equal(await bg.evaluate(message => eventFlowSystem.replaceTemplateVars('{username}|{subtitle}|{meta.orderId}', message), success), 'Fixture Buyer|Blue mug|order-1');
        const otherSource = await bg.evaluate(() => eventFlowSystem.processMessage({ type: 'ebay', event: 'payment_succeeded', chatname: 'Other buyer', chatmessage: 'Ignore' }));
        assert.equal(otherSource.chatmessage, 'Ignore');

        // A second purchase of the same product must still arrive.
        send(packet('product_sold', { product: { ...product, orderId: 'order-2', auctionId: 'auction-2' } }));
        await bg.waitForFunction(() => whatnotAfter.some(m => m?.meta?.orderId === 'order-2'));
        await source.reload({ waitUntil: 'domcontentloaded' });
        await ready('ready-after-reload');
        send(packet('payment_failed', { orderId: 'order-3' }));
        await bg.waitForFunction(() => whatnotAfter.some(m => m?.meta?.orderId === 'order-3'));
        const partial = await bg.evaluate(() => whatnotAfter.find(m => m?.meta?.orderId === 'order-3'));
        assert.equal(partial.chatname, '');
        assert.equal(partial.subtitle, '');
        assert.match(partial.chatmessage, /^\[FAILED\] Payment failed/);
        // A later event is self-contained: no remembered buyer/title from the sale.
        send(packet('payment_failed', { product: { id: 'listing-4', orderId: 'order-4',
            purchaserUserId: 'buyer-id-only', productId: 'catalog-4', parentId: 'parent-4',
            transactionType: 'BUY_IT_NOW', placeOrderErrorReason: 'card_authorization_required' } }));
        await bg.waitForFunction(() => whatnotAfter.some(m => m?.meta?.orderId === 'order-4'));
        const idOnly = await bg.evaluate(() => whatnotAfter.find(m => m?.meta?.orderId === 'order-4'));
        assert.equal(idOnly.userid, 'buyer-id-only');
        assert.equal(idOnly.chatname, '');
        assert.equal(idOnly.subtitle, '');
        assert.equal(idOnly.meta.productId, 'listing-4');
        assert.equal(idOnly.meta.catalogProductId, 'catalog-4');
        assert.equal(idOnly.meta.parentProductId, 'parent-4');
        assert.equal(idOnly.meta.transactionType, 'BUY_IT_NOW');
        assert.equal(idOnly.meta.placeOrderErrorReason, 'card_authorization_required');
        assert.match(idOnly.chatmessage, /^\[FAILED\] Payment failed/);
        assert.equal(await bg.evaluate(async message => {
            const matches = await eventFlowSystem.evaluateTrigger({ triggerType: 'compareProperty',
                config: { property: 'meta.transactionType', operator: 'eq', value: 'BUY_IT_NOW' } }, message);
            return matches && eventFlowSystem.replaceTemplateVars('{meta.parentProductId}|{meta.placeOrderErrorReason}', message);
        }, idOnly), 'parent-4|card_authorization_required');
        // Success can be the first event received for an order, including after reload.
        send(packet('payment_succeeded', { product: { ...product, orderId: 'order-5' } }));
        await bg.waitForFunction(() => whatnotAfter.some(m => m?.meta?.orderId === 'order-5'));
        const paidAfterReload = await bg.evaluate(() => whatnotAfter.find(m => m?.meta?.orderId === 'order-5'));
        assert.match(paidAfterReload.chatmessage, /^\[PAID\] Payment succeeded: Blue mug/);
        assert.equal(paidAfterReload.userid, buyer.id);
        send(packet('payment_succeeded', { orderId: 'order-6' }));
        await bg.waitForFunction(() => whatnotAfter.some(m => m?.meta?.orderId === 'order-6'));
        const paidPartial = await bg.evaluate(() => whatnotAfter.find(m => m?.meta?.orderId === 'order-6'));
        assert.equal(paidPartial.chatname, '');
        assert.equal(paidPartial.subtitle, '');
        assert.equal(paidPartial.userid, undefined);
        assert.equal(paidPartial.meta.paymentStatus, 'succeeded');
        assert.equal(paidPartial.chatmessage, '[PAID] Payment succeeded');
        console.log('PASS real SSApp capture, auction/sale/payment fields, Event Flow filtering/templates, repeated sales, and source reload');
    } finally {
        if (app) await app.close();
        for (const client of sockets.clients) client.terminate();
        await new Promise(resolve => sockets.close(resolve));
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
