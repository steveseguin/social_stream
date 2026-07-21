const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const dockSource = fs.readFileSync(path.join(root, 'dock.html'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `Missing function ${name}`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unable to extract function ${name}`);
}

let fakeNow = 1000000;
const sandbox = {
  server2: true,
  Date: { now: () => fakeNow }
};
vm.createContext(sandbox);
vm.runInContext(
  'var CROSS_TRANSPORT_DEDUPE_TTL_MS = 12000;\n' +
  'var recentTransportDeliveries = new Map();\n' +
  `${extractFunction(dockSource, 'isDuplicateTransportDelivery')}\n` +
  'this.isDuplicateTransportDelivery = isDuplicateTransportDelivery;',
  sandbox
);
const isDup = payload => sandbox.isDuplicateTransportDelivery(payload);

const chat = { id: 62509, type: 'twitch', chatname: 'vdoninja', chatmessage: 'hello world' };

// Same feed message over the websocket then the P2P bridge renders only once.
assert.strictEqual(isDup({ ...chat }), false, 'First delivery must pass');
assert.strictEqual(isDup({ ...chat }), true, 'Second transport copy must be dropped');

// A different message with its own id is unaffected.
assert.strictEqual(isDup({ ...chat, id: 62510 }), false, 'New ids must pass');

// Re-sends that change donation or event state are updates, not duplicates.
assert.strictEqual(isDup({ ...chat, hasDonation: '$5' }), false, 'Donation updates must pass');
assert.strictEqual(isDup({ ...chat, id: 62511, event: 'follow', chatmessage: '' }), false);
assert.strictEqual(isDup({ ...chat, id: 62511, event: 'follow', chatmessage: '' }), true);

// Commands, callbacks, dock sync, and idless payloads are never deduplicated.
assert.strictEqual(isDup({ id: 1, action: 'clear', chatname: 'x' }), false);
assert.strictEqual(isDup({ id: 1, action: 'clear', chatname: 'x' }), false);
assert.strictEqual(isDup({ id: 2, mid: 2, chatname: 'x' }), false);
assert.strictEqual(isDup({ id: 2, mid: 2, chatname: 'x' }), false);
assert.strictEqual(isDup({ chatname: 'noid', chatmessage: 'hi' }), false);
assert.strictEqual(isDup({ chatname: 'noid', chatmessage: 'hi' }), false);
assert.strictEqual(isDup({ id: 3, get: 'token', chatmessage: 'hi' }), false);
assert.strictEqual(isDup({ id: 3, get: 'token', chatmessage: 'hi' }), false);

// Entries expire after the TTL so replayed history is not swallowed.
assert.strictEqual(isDup({ ...chat, id: 62512 }), false);
fakeNow += 12001;
assert.strictEqual(isDup({ ...chat, id: 62512 }), false, 'Expired entries must pass again');

// Without the server2 URL param there is only one transport; dedupe stays inert.
sandbox.server2 = false;
assert.strictEqual(isDup({ ...chat, id: 62513 }), false);
assert.strictEqual(isDup({ ...chat, id: 62513 }), false, 'Dedupe must be inactive without server2');

// The dedupe must guard both feed entry points.
assert(
  dockSource.includes('if (!isDuplicateTransportDelivery(data)) {'),
  'server2 websocket listener is not deduplicated'
);
assert(
  dockSource.includes('if (!isDuplicateTransportDelivery(e.data.dataReceived.overlayNinja)) {'),
  'P2P bridge listener is not deduplicated'
);

console.log('PASS dock cross-transport delivery dedupe');
