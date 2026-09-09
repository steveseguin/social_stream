const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function pointsFixture() {
    const source = read('points.js');
    const context = vm.createContext({ setTimeout, POINTS_MS_PER_MINUTE: 60000, POINTS_MS_PER_HOUR: 3600000 });
    vm.runInContext(source.slice(source.indexOf('class PointsSystem {'), source.indexOf('\nconst configuredPointsPerEngagement')) + '\nthis.PointsSystem = PointsSystem;', context);
    const system = Object.create(context.PointsSystem.prototype);
    const transactions = [];
    Object.assign(system, { cache: new Map(), userLocks: new Map(), storeName: 'userPoints', db: {
        transaction(names, mode) {
            const request = {};
            const tx = { request, objectStore() { return {
                get(key) { tx.operation = 'get'; if(mode==='readwrite' && system.cache.has(key)) queueMicrotask(()=>{request.result=structuredClone(system.cache.get(key));request.onsuccess();}); return request; },
                getAll() { request.result=[]; return request; },
                put(value) { tx.operation = 'put'; tx.value = value; tx.request={}; return tx.request; },
                clear() { tx.operation = 'clear'; return request; }
            }; } };
            transactions.push(tx);
            return tx;
        }
    } });
    return { system, transactions };
}

for (const method of ['spendPoints', 'addPoints']) test(`Invalid ${method} amounts cannot corrupt a saved points balance`, async () => {
    for (const amount of [NaN, Infinity, -Infinity, undefined, '10', 0, -1]) {
        const { system, transactions } = pointsFixture();
        const user = system.createDefaultUserData('Fixture', 'youtube');
        user.points = 100;
        system.cache.set(user.userKey, user);
        const pending = system[method]('Fixture', 'youtube', amount);
        await flush();
        for (const tx of transactions) if (tx.oncomplete) tx.oncomplete();
        const result = await pending;
        assert.equal(result.success, false, String(amount));
        assert.equal(transactions.length, 0, 'Invalid amounts must never reach storage');
        assert.equal(user.pointsSpent, 0);
        assert.equal(user.points, 100);
    }
});

for (const method of ['spendPoints', 'addPoints']) test(`${method} still accepts positive fractional amounts`, async () => {
    const { system, transactions } = pointsFixture();
    const user = system.createDefaultUserData('Fixture', 'youtube');
    user.points = 100;
    system.cache.set(user.userKey, user);
    const pending = system[method]('Fixture', 'youtube', 1.5);
    await flush();
    assert.equal(transactions.length, 1);
    transactions[0].oncomplete();
    assert.equal((await pending).success, true);
    const saved = system.cache.get(user.userKey);
    assert.equal(saved.points - saved.pointsSpent, method === 'spendPoints' ? 98.5 : 101.5);
});

test('A failed points read cannot overwrite a saved balance with a new zero-based balance', async () => {
    const { system, transactions } = pointsFixture();
    const pending = system.addPoints('Fixture', 'youtube', 1);
    const result = pending.then(() => 'resolved', () => 'rejected');
    await flush();
    transactions[0].request.error = new Error('Read failed');
    transactions[0].request.onerror();
    await flush();
    assert.equal(transactions.length, 1, 'No write may follow a failed read');
    assert.equal(await result, 'rejected');
    assert.equal(system.cache.size, 0);
    assert.equal(system.userLocks.size, 0);
});

test('A genuinely missing points record still starts at zero', async () => {
    const { system, transactions } = pointsFixture();
    const pending = system.getUserPoints('NewViewer', 'youtube');
    await flush();
    transactions[0].request.result = undefined;
    transactions[0].request.onsuccess();
    const user = await pending;
    assert.equal(user.points, 0);
    assert.equal(user.username, 'NewViewer');
});

for (const abort of [false, true]) {
    test(`Points writes wait for transaction ${abort ? 'abort and discard changed cache' : 'commit'}`, async () => {
        const { system, transactions } = pointsFixture();
        const user = system.createDefaultUserData('Fixture', 'youtube');
        user.points = 100;
        system.cache.set(user.userKey, user);
        let outcome = 'pending';
        const pending = system.addPoints('Fixture', 'youtube', 5).then(
            () => { outcome = 'saved'; }, () => { outcome = 'failed'; });
        await flush();
        const tx = transactions[0];
        assert.equal(tx.operation, 'put');
        if (tx.request.onsuccess) tx.request.onsuccess();
        await flush();
        assert.equal(outcome, 'pending', 'Request success does not mean the transaction committed');
        if (abort) {
            tx.error = new Error('Transaction aborted');
            tx.onabort();
        } else {
            tx.oncomplete();
        }
        await pending;
        assert.equal(outcome, abort ? 'failed' : 'saved');
        assert.equal(system.cache.has(user.userKey), !abort);
        if (!abort) assert.equal(system.cache.get(user.userKey).points, 105);
        assert.equal(system.userLocks.size, 0);
        if (abort) {
            const restored = system.getUserPoints('Fixture', 'youtube');
            await flush();
            transactions[1].request.result = { userKey: user.userKey, points: 100 };
            transactions[1].request.onsuccess();
            assert.equal((await restored).points, 100, 'The next read must recover the saved balance');
        }
    });
}

test('A failed points reset retains the cached balance and reports failure', async () => {
    const { system, transactions } = pointsFixture();
    system.cache.set('Fixture:youtube', { points: 100 });
    let outcome = 'pending';
    const pending = system.resetAllPoints().then(() => { outcome = 'reset'; }, () => { outcome = 'failed'; });
    await flush();
    const tx = transactions[0];
    if (tx.request.onsuccess) tx.request.onsuccess();
    await flush();
    assert.equal(outcome, 'pending');
    tx.error = new Error('Reset aborted');
    tx.onabort();
    await pending;
    assert.equal(outcome, 'failed');
    assert.equal(system.cache.get('Fixture:youtube').points, 100);
});

test('A committed points reset clears the cache', async () => {
    const { system, transactions } = pointsFixture();
    system.cache.set('Fixture:youtube', { points: 100 });
    const pending = system.resetAllPoints();
    await flush();
    transactions[0].oncomplete();
    assert.equal(await pending, true);
    assert.equal(system.cache.size, 0);
});

function streamerbotFixture() {
    const source = read('background.js');
    const context = vm.createContext({ WebSocket: { OPEN: 1, CONNECTING: 0 }, console });
    vm.runInContext(source.slice(source.indexOf('class StreamerbotWebsocketClient {'), source.indexOf('\nfunction sendToStreamerBot(')) + '\nthis.client = new StreamerbotWebsocketClient();', context);
    return context;
}

test('Streamer.bot retains its queue while closed and drains it once after reconnect', () => {
    const context = streamerbotFixture();
    vm.runInContext(`
        client.isAuthenticated = true;
        client.socket = { readyState: 3 };
        client.messageQueue = [{id: 'first'}, {id: 'second'}];
    `, context);
    vm.runInContext('client._processQueue();', context, { timeout: 100 });
    assert.equal(context.client.messageQueue.length, 2);
    vm.runInContext(`
        var sent = [];
        client.socket = { readyState: 1, send(value) { sent.push(JSON.parse(value).id); } };
        client._processQueue();
        client._processQueue();
    `, context);
    assert.deepEqual(Array.from(context.sent), ['first', 'second']);
    assert.equal(context.client.messageQueue.length, 0);
});

test('Streamer.bot stops draining if the socket closes during a batch', () => {
    const context = streamerbotFixture();
    vm.runInContext(`
        client.isAuthenticated = true;
        client.messageQueue = [{id: 'first'}, {id: 'second'}];
        var sent = [];
        client.socket = { readyState: 1, send(value) { sent.push(JSON.parse(value).id); this.readyState = 3; } };
    `, context);
    vm.runInContext('client._processQueue();', context, { timeout: 100 });
    assert.deepEqual(Array.from(context.sent), ['first']);
    assert.equal(context.client.messageQueue.length, 1);
    assert.equal(context.client.messageQueue[0].id, 'second');
});
