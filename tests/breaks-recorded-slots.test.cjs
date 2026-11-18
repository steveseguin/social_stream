const { test } = require('node:test');
const assert = require('node:assert/strict');
const breaks = require('../shared/monetization/breaks-core.js');

const copy = value => JSON.parse(JSON.stringify(value));

function apply(state, command, patch = {}) {
    const data = { revision: state.revision, boardId: state.active && state.active.id,
        showId: state.showId, ...patch };
    const before = copy(state), beforeData = { ...data, ...copy(patch) };
    try {
        return breaks.apply(state, command, data, 1700000000000 + state.revision);
    } finally {
        assert.deepEqual(state, before, 'command must not mutate its input state');
        assert.deepEqual(data, beforeData, 'command must not mutate its input data');
    }
}

function board(patch = {}) {
    let state = breaks.normalize();
    state = apply(state, 'breakShow', { create: true, title: 'Test show' });
    state = apply(state, 'breakCreate', { count: 3 });
    return apply(state, 'breakSpot', { id: '1', ...patch });
}

function withSuggestion(state) {
    // Only the pending auction is a restored-state fixture; spot records use commands.
    return breaks.normalize({ ...state, auctions: { source: 'whatnot', pending: [
        { id: 'test-auction', buyer: 'New buyer', nativeSpot: 'native-1' }
    ] } });
}

const records = [
    ['saved hits', { hits: ['Recorded card'] }],
    ['order reference', { orderRef: 'ORDER-TEST' }],
    ['zero paid amount', { paid: 0 }],
    ['positive paid amount', { paid: 12 }]
];

for (const [name, patch] of records) {
    for (const operation of ['remove', 'assign']) {
        test(`${operation} rejects a spot with ${name}`, () => {
            let state = board(patch);
            if (operation === 'assign') state = withSuggestion(state);
            const spot = state.active.spots[0];
            // These look unassigned but still contain a record that must not be lost.
            assert.equal(spot.buyer, '');
            assert.equal(spot.status, 'available');
            assert.equal(spot.result, '');
            assert.equal(spot.payment, 'unknown');
            for (const key of Object.keys(patch)) assert.deepEqual(spot[key], patch[key]);
            const before = copy(state);
            if (operation === 'remove') {
                assert.throws(() => apply(state, 'breakSpot', { id: '1', remove: true }), {
                    name: 'Error', message: 'Only empty, available spots can be removed while filling.'
                });
            } else {
                assert.throws(() => apply(state, 'breakSuggestion', {
                    spotId: '1', suggestionId: 'test-auction'
                }), {
                    name: 'Error', message: 'Choose an empty spot. Existing assignments are never replaced.'
                });
            }
            assert.deepEqual(state, before, 'rejection must preserve records and pending suggestions');
        });
    }
}

for (const [name, patch] of [
    ['blank', {}],
    ['setup-only', { price: 0, description: 'Setup description', note: 'Setup note' }]
]) {
    test(`remove accepts a ${name} spot`, () => {
        const state = board(patch);
        const removed = apply(state, 'breakSpot', { id: '1', remove: true });
        assert.deepEqual(removed.active.spots, state.active.spots.slice(1));
    });

    test(`auction assignment accepts a ${name} spot without confirming payment`, () => {
        const state = withSuggestion(board(patch));
        const assigned = apply(state, 'breakSuggestion', { spotId: '1', suggestionId: 'test-auction' });
        assert.deepEqual(assigned.active.spots[0], {
            ...state.active.spots[0], buyer: 'New buyer', platform: 'whatnot', status: 'claimed'
        });
        assert.deepEqual(assigned.active.spots.slice(1), state.active.spots.slice(1));
        assert.equal(assigned.active.spots[0].payment, 'unknown');
        assert.equal(assigned.active.spots[0].paid, null);
        assert.deepEqual(assigned.auctions.pending, []);
        assert.throws(() => apply(assigned, 'breakSuggestion', {
            spotId: '2', suggestionId: 'test-auction'
        }), { name: 'Error', message: 'That suggestion was already reviewed. Refresh the list.' });
    });
}
