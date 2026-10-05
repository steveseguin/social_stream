'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const sourceFile = process.env.PIPER_SOURCE || path.join(__dirname, '..', 'thirdparty', 'piper', 'piper-tts-proper.js');
const source = fs.readFileSync(sourceFile, 'utf8');

async function playOne(settings) {
  const played = [];
  const revoked = [];
  class FakeAudio {
    constructor() { this.volume = 1; }
    async play() {
      played.push({ volume: this.volume, src: this.src });
      setImmediate(() => this.onended());
    }
  }
  const window = { location: { href: 'https://example.test/dock.html' } };
  if (settings !== undefined) window.TTS = settings;
  const context = { window, URL: { createObjectURL: () => 'blob:test', revokeObjectURL: v => revoked.push(v) }, Audio: FakeAudio,
    console: { log() {}, warn() {}, error() {} }, Blob, setTimeout, clearTimeout };
  vm.runInNewContext(source, context, { filename: sourceFile });
  const piper = new window.ProperPiperTTS();
  piper.initialized = true;
  piper.synthesize = async (text, speed) => { assert.equal(text, 'volume test'); assert.equal(speed, 1); return new Blob(['audio']); };
  await piper.speak('volume test');
  assert.equal(played.length, 1);
  assert.deepEqual(revoked, ['blob:test']);
  assert.equal(piper.synthesisQueue.length, 0);
  assert.equal(piper.isProcessingQueue, false);
  return played[0].volume;
}

test('Piper honors numeric zero set by the volume slider or volume=0 URL', async () => {
  assert.equal(await playOne({ volume: 0 }), 0);
});
test('Piper honors negative zero as mute', async () => {
  assert.equal(await playOne({ volume: -0 }) === 0, true);
});
for (const volume of [0.01, 0.25, 0.5, 1]) {
  test(`Piper preserves numeric volume ${volume}`, async () => { assert.equal(await playOne({ volume }), volume); });
}
test('Piper defaults to full volume without the TTS host', async () => { assert.equal(await playOne(undefined), 1); });
test('Piper defaults to full volume without a setting', async () => { assert.equal(await playOne({}), 1); });
