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
        });
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
        for (const event of ['auction_started', 'new_bid', 'auction_ended', 'product_sold', 'payment_failed']) {
            send(packet(event, { product, user: buyer, highestBidder: buyer }));
        }
        await bg.waitForFunction(() => whatnotAfter.some(m => m?.event === 'payment_failed'), null, { timeout: 15000 });
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
        console.log('PASS real SSApp capture, auction/sale/payment fields, Event Flow filtering/templates, repeated sales, and source reload');
    } finally {
        if (app) await app.close();
        for (const client of sockets.clients) client.terminate();
        await new Promise(resolve => sockets.close(resolve));
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
