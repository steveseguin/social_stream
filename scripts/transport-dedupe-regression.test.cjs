const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

// Every page carrying the cross-transport dedupe guard.
const guardedFiles = [
  'dock.html',
  'sampleoverlay.html', 'emotes.html', 'content.html', 'credits.html', 'events.html',
  'games.html', 'leaderboard.html', 'scoreboard.html', 'battle.html',
  'games/chickenroyale.html', 'hype.html', 'streamelements-importer.js',
  'themes/compact-clean.html', 'themes/compact-classic.html', 'themes/compact-glass.html',
  'themes/horizontal.html', 'themes/deuks_overlay/overlay1.html', 'themes/deuks_overlay/overlay2.html',
  'themes/notimeoutmessages.html', 'themes/overlay-bubbles.html', 'themes/events/index.html',
  'themes/overlay-comic-classic.html', 'themes/overlay-cards.html', 'themes/overlay-credits.html',
  'themes/overlay-comic-pop.html', 'themes/overlay-danmaku.html', 'themes/overlay-neon-cyberpunk.html',
  'themes/huan-kiara/index.html', 'themes/overlay-ticker-news.html', 'themes/overlay-xacception.html',
  'themes/overlay-particles.html', 'themes/overlay-typewriter.html', 'themes/sampleoverlay_reverse.html',
  'themes/spiritoverlay.html', 'themes/rainbowpuke/index.html', 'themes/t3nk3y/index.html',
  'themes/Windows3.1/index.html'
];

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

function runSuite(file, source) {
  let fakeNow = 1000000;
  let gateOpen = true;
  const sandbox = {
    server2: true, // dock.html gate
    urlParams: { has: () => gateOpen }, // gate used by the other pages
    Date: { now: () => fakeNow }
  };
  vm.createContext(sandbox);
  vm.runInContext(
    'var CROSS_TRANSPORT_DEDUPE_TTL_MS = 12000;\n' +
    'var recentTransportDeliveries = new Map();\n' +
    `${extractFunction(source, 'isDuplicateTransportDelivery')}\n` +
    'this.isDuplicateTransportDelivery = isDuplicateTransportDelivery;',
    sandbox
  );
  const isDup = payload => sandbox.isDuplicateTransportDelivery(payload);
  const chat = { id: 62509, type: 'twitch', chatname: 'vdoninja', chatmessage: 'hello world' };

  // Same feed message over two transports renders only once.
  assert.strictEqual(isDup({ ...chat }), false, `${file}: first delivery must pass`);
  assert.strictEqual(isDup({ ...chat }), true, `${file}: second transport copy must be dropped`);

  // A different message with its own id is unaffected.
  assert.strictEqual(isDup({ ...chat, id: 62510 }), false, `${file}: new ids must pass`);

  // Re-sends that change donation or event state are updates, not duplicates.
  assert.strictEqual(isDup({ ...chat, hasDonation: '$5' }), false, `${file}: donation updates must pass`);
  assert.strictEqual(isDup({ ...chat, id: 62511, event: 'follow', chatmessage: '' }), false, file);
  assert.strictEqual(isDup({ ...chat, id: 62511, event: 'follow', chatmessage: '' }), true, file);

  // Commands, callbacks, dock sync, and idless payloads are never deduplicated.
  assert.strictEqual(isDup({ id: 1, action: 'clear', chatname: 'x' }), false, file);
  assert.strictEqual(isDup({ id: 1, action: 'clear', chatname: 'x' }), false, file);
  assert.strictEqual(isDup({ id: 2, mid: 2, chatname: 'x' }), false, file);
  assert.strictEqual(isDup({ id: 2, mid: 2, chatname: 'x' }), false, file);
  assert.strictEqual(isDup({ chatname: 'noid', chatmessage: 'hi' }), false, file);
  assert.strictEqual(isDup({ chatname: 'noid', chatmessage: 'hi' }), false, file);
  assert.strictEqual(isDup({ id: 3, get: 'token', chatmessage: 'hi' }), false, file);
  assert.strictEqual(isDup({ id: 3, get: 'token', chatmessage: 'hi' }), false, file);

  // Entries expire after the TTL so replayed history is not swallowed.
  assert.strictEqual(isDup({ ...chat, id: 62512 }), false, file);
  fakeNow += 12001;
  assert.strictEqual(isDup({ ...chat, id: 62512 }), false, `${file}: expired entries must pass again`);

  // Without any server transport params the guard stays inert.
  sandbox.server2 = false;
  gateOpen = false;
  assert.strictEqual(isDup({ ...chat, id: 62513 }), false, file);
  assert.strictEqual(isDup({ ...chat, id: 62513 }), false, `${file}: dedupe must be inactive without server params`);
}

for (const file of guardedFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  runSuite(file, source);
  const guardCalls = (source.match(/if \(!?isDuplicateTransportDelivery\(/g) || []).length;
  assert(guardCalls >= 1, `${file}: guard is defined but never applied`);
}

// The dock and hype guard both transport entry points explicitly.
const dockSource = fs.readFileSync(path.join(root, 'dock.html'), 'utf8');
assert(dockSource.includes('if (!isDuplicateTransportDelivery(data)) {'), 'dock server2 websocket listener is not deduplicated');
assert(dockSource.includes('if (!isDuplicateTransportDelivery(e.data.dataReceived.overlayNinja)) {'), 'dock P2P bridge listener is not deduplicated');
const hypeSource = fs.readFileSync(path.join(root, 'hype.html'), 'utf8');
assert(hypeSource.includes('if (!isDuplicateTransportDelivery(data)) {'), 'hype websocket listener is not deduplicated');
assert(hypeSource.includes('if (isDuplicateTransportDelivery(data)) {'), 'hype bridge handler is not deduplicated');

console.log(`PASS cross-transport delivery dedupe (${guardedFiles.length} pages)`);
