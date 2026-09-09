const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function fixture() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'points.js'), 'utf8');
    const context = vm.createContext({ IDBKeyRange: { only: value => value } });
    vm.runInContext(source.slice(source.indexOf('class PointsSystem {'), source.indexOf('\nconst configuredPointsPerEngagement')) + '\nthis.PointsSystem = PointsSystem;', context);
    const system = Object.create(context.PointsSystem.prototype), request = {};
    const tx = { objectStore: () => ({ index: () => ({ openCursor: () => request }) }) };
    system.ensureDB = async () => ({ transaction: () => tx });
    return { system, tx, request };
}
for (const method of ['getLeaderboard', 'getUsersWithSameName']) {
    for (const event of ['request', 'abort']) {
        test(`${method} rejects on ${event} failure instead of remaining pending`, async () => {
            const f = fixture();
            let outcome = 'pending';
            const pending = f.system[method]().then(() => { outcome = 'resolved'; }, () => { outcome = 'rejected'; });
            await flush();
            if (event === 'request') {
                f.request.error = new Error('Cursor failed');
                if (f.request.onerror) f.request.onerror();
            } else {
                f.tx.error = new Error('Read aborted');
                if (f.tx.onabort) f.tx.onabort();
            }
            await flush();
            assert.equal(outcome, 'rejected');
            await pending;
        });
    }
    test(`${method} still returns successful results`, async () => {
        const f = fixture();
        const pending = f.system[method]();
        await flush();
        const user = { username: 'Fixture', type: 'youtube', points: 10, pointsSpent: 2, currentStreak: 1 };
        f.request.onsuccess({ target: { result: { value: user, continue() {} } } });
        f.request.onsuccess({ target: { result: null } });
        const result = await pending;
        assert.equal(result.length, 1);
        assert.equal(result[0].username, 'Fixture');
        if (method === 'getLeaderboard') assert.equal(result[0].available, 8);
    });
}
