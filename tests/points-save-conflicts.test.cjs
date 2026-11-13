const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const clone = value => value === undefined ? undefined : structuredClone(value);
const source = fs.readFileSync(path.join(__dirname, '..', 'points.js'), 'utf8');

const classStart = source.indexOf('class PointsSystem {');
const classEnd = source.indexOf('\nconst configuredPointsPerEngagement');
assert.ok(classStart >= 0 && classEnd > classStart, 'PointsSystem class boundaries must exist');

// Requests and commit/abort are controlled separately; this is not an IndexedDB implementation.
function fixture(current, marker) {
    const context = vm.createContext({});
    vm.runInContext(source.slice(classStart, classEnd) + '\nthis.PointsSystem = PointsSystem;', context);
    const system = Object.create(context.PointsSystem.prototype);
    const durable = new Map();
    if (current) durable.set(current.userKey, clone(current));
    const transactions = [];
    Object.assign(system, { cache: new Map(), storeName: 'userPoints', db: { transaction(names, mode) {
        assert.equal(mode, 'readwrite');
        const tx = { names, requests: [], writes: [], aborted: false,
            objectStore(name) { assert.ok(['userPoints', 'economyRecords'].includes(name)); return {
                get(key) { const request = { result: name === 'userPoints' ? clone(durable.get(key)) : clone(marker) }; tx.requests.push({name, key, request}); return request; },
                put(value) { assert.equal(name, 'userPoints'); tx.writes.push(clone(value)); return {}; }
            }; },
            abort() { tx.aborted = true; if (tx.onabort) tx.onabort(); },
            commit() { assert.equal(tx.aborted, false); for (const value of tx.writes) durable.set(value.userKey, clone(value)); tx.oncomplete(); }
        };
        transactions.push(tx); return tx;
    } } });
    return { system, durable, transactions };
}
const account = overrides => ({ userKey: 'Fixture:youtube', username: 'Fixture', type: 'youtube', points: 100, pointsSpent: 20, revision: 4, ...overrides });

async function begin(f, edited, migration = false) {
    const unchanged = clone(edited);
    f.system.cache.set(edited.userKey, edited);
    let outcome = 'pending';
    const pending = f.system.saveUserPoints(edited, migration).then(value => { outcome = 'resolved'; return { value }; }, error => { outcome = 'rejected'; return { error }; });
    await flush();
    assert.equal(f.system.cache.has(edited.userKey), false, 'Uncommitted edited object must leave cache');
    return { tx: f.transactions[0], pending, unchanged, outcome: () => outcome };
}

for (const [label, current, edited] of [
    ['stale revision', account({ revision: 5 }), account({ points: 200 })],
    ['reserved balance', account({ pointsReserved: 10 }), account({ points: 200 })],
    ['deleted record with stale revision', undefined, account({ points: 200 })]
]) test(`saveUserPoints rejects ${label} without changing durable balance`, { timeout: 1000 }, async () => {
    const f = fixture(current), before = clone([...f.durable]);
    const op = await begin(f, edited);
    op.tx.requests[0].request.onsuccess();
    assert.equal(op.tx.aborted, true, 'The conflict must abort before any transaction completion');
    const result = await op.pending;
    assert.match(result.error?.message || '', /Balance changed or points are reserved/);
    assert.equal(op.tx.aborted, true);
    assert.equal(op.tx.writes.length, 0);
    assert.deepEqual([...f.durable], before);
    assert.equal(f.system.cache.size, 0);
    assert.deepEqual(edited, op.unchanged);
});

for (const [label, current, edited, revision] of [
    ['matching revision', account(), account({ points: 200 }), 5],
    ['new record', undefined, account({ revision: 0 }), 1],
    ['legacy record', account({ revision: undefined }), account({ revision: undefined, points: 200 }), 1],
    ['released reservation', account({ pointsReserved: 0 }), account({ points: 200 }), 5]
]) test(`saveUserPoints commits ${label} only after transaction completion`, { timeout: 1000 }, async () => {
    const f = fixture(current), before = clone([...f.durable]);
    const op = await begin(f, edited);
    op.tx.requests[0].request.onsuccess(); await flush();
    assert.equal(op.outcome(), 'pending');
    assert.equal(op.tx.writes.length, 1);
    assert.equal(f.system.cache.size, 0);
    assert.deepEqual([...f.durable], before);
    op.tx.commit();
    const result = await op.pending;
    assert.equal(result.error, undefined);
    const expected = { ...edited, revision };
    assert.deepEqual(clone(result.value), expected);
    assert.deepEqual(f.durable.get(edited.userKey), expected);
    assert.deepEqual(clone(f.system.cache.get(edited.userKey)), expected);
    assert.deepEqual(edited, op.unchanged);
});

for (const order of ['account-first', 'marker-first']) {
    for (const [label, current, marker, writes] of [
        ['existing account', account(), undefined, 0],
        ['completed migration', undefined, { id: 'migration', complete: true }, 0],
        ['incomplete migration', undefined, { id: 'migration', complete: false }, 1]
    ]) test(`Migration ${label}, ${order}, preserves existing balances`, { timeout: 1000 }, async () => {
        const edited = account({ revision: current ? current.revision : 0, points: 200 });
        const f = fixture(current, marker), before = clone([...f.durable]);
        const op = await begin(f, edited, true);
        assert.deepEqual(Array.from(op.tx.names), ['userPoints', 'economyRecords']);
        assert.deepEqual(op.tx.requests.map(r => [r.name, r.key]), [['userPoints', edited.userKey], ['economyRecords', 'migration']]);
        const requests = order === 'account-first' ? op.tx.requests : [...op.tx.requests].reverse();
        requests[0].request.onsuccess(); await flush();
        assert.equal(op.tx.writes.length, 0, 'Both reads are required before deciding to write');
        assert.equal(op.outcome(), 'pending');
        requests[1].request.onsuccess();
        assert.equal(op.tx.writes.length, writes);
        op.tx.commit();
        const result = await op.pending;
        assert.equal(result.error, undefined);
        if (writes) {
            const expected = { ...edited, revision: 1 };
            assert.deepEqual(clone(result.value), expected);
            assert.deepEqual(f.durable.get(edited.userKey), expected);
            assert.deepEqual(clone(f.system.cache.get(edited.userKey)), expected);
            assert.equal(f.system.cache.size, 1);
        } else {
            assert.deepEqual([...f.durable], before);
            assert.equal(f.system.cache.size, 0);
        }
        assert.deepEqual(edited, op.unchanged);
    });
}

for (const failure of ['read-error', 'transaction-abort']) test(`saveUserPoints ${failure} preserves durable balance and drops edited cache`, { timeout: 1000 }, async () => {
    const f = fixture(account()), before = clone([...f.durable]), edited = account({ points: 200 });
    const op = await begin(f, edited);
    if (failure === 'read-error') {
        op.tx.requests[0].request.error = new Error('Synthetic read failure');
        op.tx.requests[0].request.onerror();
    } else {
        op.tx.requests[0].request.onsuccess();
        assert.equal(op.tx.writes.length, 1);
        op.tx.error = new Error('Synthetic abort'); op.tx.abort();
    }
    const result = await op.pending;
    assert.match(result.error?.message || '', /Synthetic/);
    assert.deepEqual([...f.durable], before);
    assert.equal(f.system.cache.size, 0);
    assert.deepEqual(edited, op.unchanged);
});
