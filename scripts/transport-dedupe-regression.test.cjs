const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sharedDedupeSource = fs.readFileSync(path.join(root, 'js', 'transport-dedupe.js'), 'utf8');

// Every page carrying the cross-transport dedupe guard.
const guardedFiles = [
  'dock.html',
  'sampleoverlay.html', 'featured.html', 'emotes.html', 'content.html', 'credits.html', 'events.html',
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
  let quote = '';
  let escaped = false;
  for (let index = braceStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unable to extract function ${name}`);
}

function runSuite(file, source) {
  const isDock = file === 'dock.html';
  const usesSharedDedupe = source.includes('SocialStreamTransportDedupe.create()');
  const supportsIdlessDedupe = isDock || usesSharedDedupe;
  let fakeNow = 1000000;
  let gateOpen = true;
  const sandbox = {
    server2: true, // dock.html gate
    urlParams: { has: () => gateOpen }, // gate used by the other pages
    Date: { now: () => fakeNow }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  if (usesSharedDedupe) vm.runInContext(sharedDedupeSource, sandbox);
  const supportingFunctions = isDock
    ? `${extractFunction(source, 'stableTransportStringify')}\n` +
      `${extractFunction(source, 'getTransportDeliveryKey')}\n` +
      `${extractFunction(source, 'isDuplicateIdlessTransportDelivery')}\n`
    : '';
  vm.runInContext(
    'var CROSS_TRANSPORT_DEDUPE_TTL_MS = 12000;\n' +
    'var IDLESS_CROSS_TRANSPORT_DEDUPE_TTL_MS = 1000;\n' +
    'var recentTransportDeliveries = new Map();\n' +
    'var recentIdlessTransportDeliveries = new Map();\n' +
    (usesSharedDedupe
      ? 'var transportDeliveryDedupe = SocialStreamTransportDedupe.create();\n'
      : '') +
    supportingFunctions +
    `${extractFunction(source, 'isDuplicateTransportDelivery')}\n` +
    'this.isDuplicateTransportDelivery = isDuplicateTransportDelivery;',
    sandbox
  );
  const isDup = (payload, sourceName) => sandbox.isDuplicateTransportDelivery(payload, sourceName);
  const chat = { id: 62509, type: 'twitch', chatname: 'vdoninja', chatmessage: 'hello world' };

  // Same feed message over two transports renders only once.
  assert.strictEqual(isDup({ ...chat }, 'p2p'), false, `${file}: first delivery must pass`);
  assert.strictEqual(isDup({ ...chat }, 'server'), true, `${file}: second transport copy must be dropped`);

  // A different message with its own id is unaffected.
  assert.strictEqual(isDup({ ...chat, id: 62510 }), false, `${file}: new ids must pass`);

  // Re-sends that change donation or event state are updates, not duplicates.
  assert.strictEqual(isDup({ ...chat, hasDonation: '$5' }), false, `${file}: donation updates must pass`);
  assert.strictEqual(isDup({ ...chat, id: 62511, event: 'follow', chatmessage: '' }, 'p2p'), false, file);
  assert.strictEqual(isDup({ ...chat, id: 62511, event: 'follow', chatmessage: '' }, 'server'), true, file);

  // Commands, callbacks, and dock sync payloads are never deduplicated.
  assert.strictEqual(isDup({ id: 1, action: 'clear', chatname: 'x' }), false, file);
  assert.strictEqual(isDup({ id: 1, action: 'clear', chatname: 'x' }), false, file);
  assert.strictEqual(isDup({ id: 2, mid: 2, chatname: 'x' }), false, file);
  assert.strictEqual(isDup({ id: 2, mid: 2, chatname: 'x' }), false, file);
  assert.strictEqual(isDup({ chatname: 'noid', chatmessage: 'hi' }, 'p2p'), false, file);
  assert.strictEqual(
    isDup({ chatname: 'noid', chatmessage: 'hi' }, supportsIdlessDedupe ? 'server' : 'p2p'),
    supportsIdlessDedupe,
    `${file}: shared guard must deduplicate idless cross-transport payloads`
  );

  if (supportsIdlessDedupe) {
    const repeatedNoId = { chatname: 'repeat', chatmessage: 'same legitimate message', type: 'youtube' };
    assert.strictEqual(isDup({ ...repeatedNoId }, 'server'), false, `${file}: first idless message must pass`);
    assert.strictEqual(isDup({ ...repeatedNoId }, 'server'), false, `${file}: same-source idless repeat must pass`);
    assert.strictEqual(isDup({ ...repeatedNoId }, 'p2p'), true, `${file}: first mirrored idless copy must be paired`);
    assert.strictEqual(isDup({ ...repeatedNoId }, 'p2p'), true, `${file}: second mirrored idless copy must be paired`);

    const delayedNoId = { chatname: 'repeat', chatmessage: 'outside pairing window', type: 'youtube' };
    assert.strictEqual(isDup({ ...delayedNoId }, 'server'), false, `${file}: initial delayed idless message must pass`);
    fakeNow += 1001;
    assert.strictEqual(isDup({ ...delayedNoId }, 'p2p'), false, `${file}: idless message outside one second must pass`);
  }
  assert.strictEqual(isDup({ id: 3, get: 'token', chatmessage: 'hi' }), false, file);
  assert.strictEqual(isDup({ id: 3, get: 'token', chatmessage: 'hi' }), false, file);

  // Entries expire after the TTL so replayed history is not swallowed.
  assert.strictEqual(isDup({ ...chat, id: 62512 }), false, file);
  fakeNow += 12001;
  assert.strictEqual(isDup({ ...chat, id: 62512 }), false, `${file}: expired entries must pass again`);

  // Without server transport params, only Dock's same-source path remains active.
  sandbox.server2 = false;
  gateOpen = false;
  assert.strictEqual(isDup({ ...chat, id: 62513 }, 'p2p'), false, file);
  assert.strictEqual(isDup({ ...chat, id: 62513 }, 'p2p'), false, `${file}: same-source delivery must remain active`);
}

for (const file of guardedFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  runSuite(file, source);
  const guardCalls = (source.match(/if \(!?isDuplicateTransportDelivery\(/g) || []).length;
  assert(guardCalls >= 1, `${file}: guard is defined but never applied`);
}

// The dock and hype guard both transport entry points explicitly.
const dockSource = fs.readFileSync(path.join(root, 'dock.html'), 'utf8');
assert(dockSource.includes('if (!isDuplicateTransportDelivery(data, "server")) {'), 'dock server2 websocket listener is not source-aware');
assert(dockSource.includes('if (!isDuplicateTransportDelivery(remotePayload, "p2p")) {'), 'dock P2P bridge listener is not source-aware');
const hypeSource = fs.readFileSync(path.join(root, 'hype.html'), 'utf8');
assert(hypeSource.includes('if (!isDuplicateTransportDelivery(data)) {'), 'hype websocket listener is not deduplicated');
assert(hypeSource.includes('if (isDuplicateTransportDelivery(data)) {'), 'hype bridge handler is not deduplicated');

function createDockRoutingContext(version, hasPeer) {
  const peerMessages = [];
  const serverMessages = [];
  const sandbox = {
    URLSearchParams,
    urlParams: new URLSearchParams(version ? `v=${version}` : ''),
    SERVER_EXCLUSIVE_TRANSPORT_VERSION: '3.52.0',
    blockMessageSelecting: false,
    blockMessageSelecting3: false,
    server3: true,
    iframes: [{
      connectedPeers: hasPeer ? { peer: 'SocialStream' } : {},
      contentWindow: { postMessage: message => peerMessages.push(message) }
    }],
    socketserverExtension: {
      readyState: 1,
      send: message => serverMessages.push(JSON.parse(message))
    },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${extractFunction(dockSource, 'versionAtLeast')}\n` +
    `${extractFunction(dockSource, 'usesLegacyExtensionTransport')}\n` +
    `${extractFunction(dockSource, 'sendExtensionDataToServer')}\n` +
    `${extractFunction(dockSource, 'sendExtensionDataToPeers')}\n` +
    `${extractFunction(dockSource, 'send2Extension')}\n` +
    'this.send2Extension = send2Extension; this.usesLegacyExtensionTransport = usesLegacyExtensionTransport;',
    sandbox
  );
  return { sandbox, peerMessages, serverMessages };
}

const legacyDock = createDockRoutingContext('3.50.4', true);
assert.strictEqual(legacyDock.sandbox.usesLegacyExtensionTransport(), true, '3.50.4 must retain legacy routing');
assert.strictEqual(legacyDock.sandbox.send2Extension({ action: 'clearOverlay' }), true);
assert.strictEqual(legacyDock.peerMessages.length, 1, 'legacy Dock commands must prefer P2P');
assert.strictEqual(legacyDock.serverMessages.length, 0, 'legacy Dock must not duplicate commands over server3');

const legacyFallbackDock = createDockRoutingContext('', false);
assert.strictEqual(legacyFallbackDock.sandbox.send2Extension({ action: 'clearOverlay' }), true);
assert.strictEqual(legacyFallbackDock.serverMessages.length, 1, 'legacy Dock must fall back to server3 without a P2P peer');

const currentDock = createDockRoutingContext('3.52.0', true);
assert.strictEqual(currentDock.sandbox.usesLegacyExtensionTransport(), false, '3.52.0 must use current routing');
assert.strictEqual(currentDock.sandbox.send2Extension({ action: 'clearOverlay' }), true);
assert.strictEqual(currentDock.serverMessages.length, 1, 'current Dock commands must prefer server3');
assert.strictEqual(currentDock.peerMessages.length, 0, 'current Dock commands must not duplicate over P2P');

console.log(`PASS cross-transport delivery dedupe (${guardedFiles.length} pages)`);
