const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '..', 'sources', 'tikfinity.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const listeners = {};
const outbound = [];
let nextTimerId = 1;

const windowStub = {
  location: {
    pathname: '/widget/vite/src/activity-feed/test',
    href: 'https://tikfinity.zerody.one/widget/vite/src/activity-feed/test'
  },
  addEventListener(type, handler) {
    listeners[type] = handler;
  },
  removeEventListener(type, handler) {
    if (listeners[type] === handler) {
      delete listeners[type];
    }
  }
};

const chromeStub = {
  runtime: {
    id: 'test-extension',
    lastError: null,
    onMessage: {
      addListener() {}
    },
    sendMessage(_id, payload, callback) {
      if (payload && payload.getSettings) {
        if (callback) callback({ settings: {}, state: true });
        return;
      }
      if (payload && payload.message) {
        outbound.push(payload.message);
      }
      if (callback) callback({});
    }
  }
};

const sandbox = vm.createContext({
  window: windowStub,
  document: {},
  chrome: chromeStub,
  console,
  URL,
  Map,
  Math,
  Date,
  String,
  Object,
  parseInt,
  isFinite,
  setTimeout() {
    return nextTimerId++;
  },
  clearTimeout() {}
});

vm.runInContext(source, sandbox);
assert.strictEqual(typeof listeners.message, 'function', 'TikFinity message listener should be installed');

function emitGift(overrides = {}) {
  listeners.message({
    data: {
      type: 'gift',
      payload: {
        uniqueId: 'tester',
        nickname: 'Tester',
        giftId: '5655',
        giftName: 'Rose',
        giftType: 1,
        diamondCount: 1,
        repeatCount: 1,
        repeatEnd: false,
        groupId: 'group-one',
        ...overrides
      }
    }
  });
}

emitGift({ giftType: '1', repeatCount: 1 });
emitGift({ repeatCount: 2 });
emitGift({ repeatCount: 3 });
emitGift({ repeatCount: 4, repeatEnd: true });

assert.strictEqual(outbound.length, 4, 'cumulative gift updates should remain available to overlays');
assert.deepStrictEqual(
  outbound.map((message) => message.meta.tiktokGiftCount),
  [1, 2, 3, 4],
  'each update should expose its cumulative gift count'
);
const firstStreakId = outbound[0].meta.tiktokGiftStreakId;
assert.ok(firstStreakId, 'gift streak should have an ID');
assert.strictEqual(outbound[0].meta.streakable, true, 'string giftType=1 should remain streakable');
assert.ok(
  outbound.every((message) => message.meta.tiktokGiftStreakId === firstStreakId),
  'one TikFinity gift streak should keep one ID for TTS and alert coalescing'
);
assert.ok(
  outbound.every((message) => message.meta.tiktokGiftQuietMs === 4500),
  'TikFinity should use the native TikTok quiet window'
);

emitGift({ groupId: 'group-two', repeatCount: 1 });
assert.notStrictEqual(
  outbound[4].meta.tiktokGiftStreakId,
  firstStreakId,
  'a different TikTok group ID should start a new streak'
);

emitGift({
  giftId: 'single-gift',
  giftName: 'Single Gift',
  giftType: 0,
  groupId: undefined,
  repeatCount: 1,
  repeatEnd: '0'
});
assert.strictEqual(
  outbound[5].meta.tiktokGiftStreakId,
  undefined,
  'a non-streak gift should still be forwarded immediately'
);
assert.strictEqual(outbound[5].meta.repeatEnd, false, 'string repeatEnd=0 should remain false');

console.log('tikfinity-gift-streak tests passed');
