const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '..', 'sources', 'tikfinity.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const listeners = {};
const outbound = [];
let nextTimerId = 1;
let now = 100000;
const timers = new Map();
class Clock extends Date {
  static now() { return now; }
}

function advance(ms) {
  const until = now + ms;
  while (true) {
    const next = [...timers].filter(([, timer]) => timer.at <= until)
      .sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    timers.delete(next[0]);
    now = next[1].at;
    next[1].callback();
  }
  now = until;
}

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
  Date: Clock,
  String,
  Object,
  parseInt,
  isFinite,
  setTimeout(callback, delay) {
    const id = nextTimerId++;
    timers.set(id, { callback, at: now + delay });
    return id;
  },
  clearTimeout(id) { timers.delete(id); }
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
assert.strictEqual(outbound.length, 0, 'streak progress should wait for the final total');
advance(3000);
emitGift({ giftType: '1', repeatCount: 4, repeatEnd: true });

assert.strictEqual(outbound.length, 1, 'a completed streak should emit once');
assert.strictEqual(outbound[0].meta.tiktokGiftCount, 4, 'the final cumulative gift count should be retained');
assert.strictEqual(outbound[0].meta.repeatEnd, true, 'TTS should receive the completion flag');
assert.strictEqual(outbound[0].chatmessage, 'Rose x4');
assert.strictEqual(outbound[0].hasDonation, '4 coins');
const firstStreakId = outbound[0].meta.tiktokGiftStreakId;
assert.ok(firstStreakId, 'gift streak should have an ID');
assert.strictEqual(outbound[0].meta.streakable, true, 'string giftType=1 should remain streakable');
assert.strictEqual(outbound[0].meta.tiktokGiftQuietMs, 4500, 'TikFinity should use the native TikTok quiet window');

emitGift({ groupId: 'group-two', repeatCount: 4, repeatEnd: true });
assert.strictEqual(outbound.length, 2, 'a separate gift group with the same total should be forwarded');
assert.notStrictEqual(
  outbound[1].meta.tiktokGiftStreakId,
  firstStreakId,
  'a different TikTok group ID should start a new streak'
);

// Single gifts also send a completion event after the old duplicate window expires.
for (const delay of [2000, 3000, 5000]) {
  for (const groupId of ['delayed-' + delay, undefined]) {
    advance(5000);
    const before = outbound.length;
    const gift = { groupId, msgId: 'single-' + now, repeatEnd: '0' };
    emitGift(gift);
    advance(delay);
    emitGift({ ...gift, repeatEnd: '1' });
    assert.strictEqual(outbound.length, before + 1, 'a single gift should emit once after ' + delay + 'ms, group=' + groupId);
    const final = outbound[outbound.length - 1];
    assert.strictEqual(final.chatmessage, 'Rose');
    assert.strictEqual(final.hasDonation, '1 coin');
    assert.strictEqual(final.meta.repeatEnd, true);
    assert.strictEqual(final.meta.tiktokGiftMessageId, gift.msgId);
    emitGift({ ...gift, repeatEnd: true });
    assert.strictEqual(outbound.length, before + 1, 'an immediate replay of the completion should be deduplicated');
  }
}

const beforeSingleGift = outbound.length;
emitGift({
  giftId: 'single-gift',
  giftName: 'Single Gift',
  giftType: 0,
  groupId: undefined,
  repeatCount: 1,
  repeatEnd: '0'
});
assert.strictEqual(outbound.length, beforeSingleGift + 1, 'a non-streak gift should emit immediately');
assert.strictEqual(
  outbound[beforeSingleGift].meta.tiktokGiftStreakId,
  undefined,
  'a non-streak gift should still be forwarded immediately'
);
assert.strictEqual(outbound[beforeSingleGift].meta.repeatEnd, false, 'string repeatEnd=0 should remain false');

const beforeLegacy = outbound.length;
emitGift({ groupId: 'legacy', repeatEnd: undefined });
emitGift({ groupId: 'legacy', repeatEnd: undefined, repeatCount: 2 });
assert.strictEqual(outbound.length, beforeLegacy + 2, 'legacy gifts without completion flags should still emit updates');
assert.strictEqual(outbound[beforeLegacy].meta.tiktokGiftStreakId, outbound[beforeLegacy + 1].meta.tiktokGiftStreakId);

for (const flag of ['streakable', 'isStreakable']) {
  const before = outbound.length;
  emitGift({ groupId: flag, giftType: undefined, [flag]: 'true', repeatEnd: 0 });
  assert.strictEqual(outbound.length, before, 'explicit streak flags should wait for completion');
  emitGift({ groupId: flag, giftType: undefined, [flag]: 'true', repeatEnd: 1 });
  assert.strictEqual(outbound.length, before + 1);
}

console.log('tikfinity-gift-streak tests passed');
