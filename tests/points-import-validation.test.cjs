const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function fixture() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'points.js'), 'utf8');
    const context = vm.createContext({ console: { error() {} }, setTimeout,
        POINTS_MS_PER_MINUTE: 60000, POINTS_MS_PER_HOUR: 3600000 });
    vm.runInContext(source.slice(source.indexOf('class PointsSystem {'), source.indexOf('\nconst configuredPointsPerEngagement')) + '\nthis.PointsSystem = PointsSystem;', context);
    const system = Object.create(context.PointsSystem.prototype);
    const saved = new Map();
    Object.assign(system, { cache: new Map(), userLocks: new Map(), engagementWindow: 900000,
        streakBreakTime: 3600000, pointsPerEngagement: 1, streakMultiplierBase: 0.1, streakCap: 10 });
    system.ensureDB = async () => ({});
    system.getUserPoints = async (name, type) => saved.get(system.getUserKey(name, type)) || system.createDefaultUserData(name, type);
    system.saveUserPoints = async user => { saved.set(user.userKey, user); };
    system.mutateUserPoints = async (name,type,mutate) => { const user=structuredClone(await system.getUserPoints(name,type));const result=mutate(user);if(!result || result.success!==false)await system.saveUserPoints(user);return result; };
    const user = system.createDefaultUserData('Fixture', 'youtube');
    user.points = 100;
    saved.set(user.userKey, user);
    return { system, saved, user };
}

test('Non-backup JSON is rejected without throwing or writing points', async () => {
    for (const input of ['null', '[]', '42', '{}']) {
        const { system, saved } = fixture();
        const result = await system.importPoints(input, 'replace');
        assert.equal(result.success, false);
        assert.equal(saved.get('Fixture:youtube').points, 100);
    }
});

test('Invalid rows are skipped without losing valid rows later in the backup', async () => {
    const { system, saved, user } = fixture();
    const result = await system.importPoints(JSON.stringify({ users: [null, { ...user, points: 120 }] }), 'replace');
    assert.equal(result.imported, 1);
    assert.equal(result.skipped, 1);
    assert.equal(saved.get(user.userKey).points, 120);
});

test('Malformed point values and mismatched user keys cannot replace saved balances', async () => {
    const invalidFields = [
        { points: '500' }, { points: false }, { points: null }, { pointsSpent: '2' },
        { currentStreak: -1 }, { lastEngagement: 'yesterday' }, { engagementHistory: 'bad' },
        { engagementHistory: [null] }, { username: 'AnotherViewer' }
    ];
    for (const fields of invalidFields) {
        const { system, saved, user } = fixture();
        const result = await system.importPoints(JSON.stringify({ users: [{ ...user, ...fields }] }), 'replace');
        assert.equal(result.imported, 0, JSON.stringify(fields));
        assert.equal(result.skipped, 1);
        assert.equal(saved.get(user.userKey).points, 100);
    }
});

test('Older minimal records get defaults needed for subsequent chat awards', async () => {
    const { system, saved } = fixture();
    const result = await system.importPoints(JSON.stringify({ users: [
        { username: 'Legacy', userKey: 'Legacy:default', points: 10 }
    ] }), 'replace');
    assert.equal(result.imported, 1);
    await system.recordEngagement('Legacy', 'default', 1700000000000);
    const user = saved.get('Legacy:default');
    assert.equal(user.points, 11);
    assert.equal(user.pointsSpent, 0);
    assert.equal(user.engagementHistory.length, 1);
});

test('Valid exported records retain merge and replace behavior', async () => {
    const { system, saved, user } = fixture();
    let result = await system.importPoints(JSON.stringify({ users: [{ ...user, points: 90 }] }), 'merge');
    assert.equal(result.skipped, 1);
    result = await system.importPoints(JSON.stringify({ users: [{ ...user, points: 110, pointsSpent: 5 }] }), 'merge');
    assert.equal(result.imported, 1);
    assert.equal(saved.get(user.userKey).pointsSpent, 5);
    result = await system.importPoints(JSON.stringify({ users: [{ ...user, points: 80 }] }), 'replace');
    assert.equal(result.imported, 1);
    assert.equal(saved.get(user.userKey).points, 80);
});
