const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

class TestCustomEvent extends Event {
  constructor(type, options) {
    super(type);
    this.detail = options && options.detail;
  }
}

class FakeSDK extends EventTarget {
  constructor(options) {
    super();
    this.options = options;
    this.state = {};
    this.calls = [];
  }

  async connect() {
    this.calls.push(['connect']);
  }

  async joinRoom(options) {
    this.calls.push(['joinRoom', options]);
  }

  async announce(options) {
    this.calls.push(['announce', options]);
  }

  stopPublishing() {
    this.calls.push(['stopPublishing']);
  }

  leaveRoom() {
    this.calls.push(['leaveRoom']);
  }

  disconnect() {
    this.calls.push(['disconnect']);
  }

  emit(type, detail) {
    this.dispatchEvent(new TestCustomEvent(type, { detail }));
  }
}

global.CustomEvent = TestCustomEvent;
global.VDONinjaSDK = FakeSDK;
global.window = {};
require('../js/ninja-transport.js');

async function createBridge() {
  const bridge = new window.NinjaBridge();
  await bridge.init({ room: 'test-room', password: false, streamID: 'publisher-stream' });
  return bridge;
}

test('uses only supported joinRoom options', async () => {
  const bridge = await createBridge();
  const joinCall = bridge.vdo.calls.find((call) => call[0] === 'joinRoom');
  assert.deepEqual(joinCall[1], { room: 'test-room', password: false });
});

test('authoritative labels are not overwritten by connection-time fallbacks', async () => {
  const bridge = await createBridge();
  bridge.vdo.emit('listing', { uuid: 'peer-1', label: 'dock' });
  bridge.vdo.emit('peerConnected', {
    uuid: 'peer-1',
    connection: { info: { label: 'SocialStream' } },
  });
  assert.equal(bridge.getPeers()['peer-1'], 'dock');

  bridge.vdo.emit('peerConnected', {
    uuid: 'peer-2',
    connection: { info: { label: 'SocialStream' } },
  });
  bridge.vdo.emit('listing', { uuid: 'peer-2', label: 'ticker' });
  assert.equal(bridge.getPeers()['peer-2'], 'ticker');
});

test('reconnect restores bridge readiness', async () => {
  const bridge = await createBridge();
  bridge.vdo.emit('disconnected');
  assert.equal(bridge.isReady(), false);
  bridge.vdo.emit('reconnected');
  assert.equal(bridge.isReady(), true);
});

test('normalizes one SDK data event into one bridge event', async () => {
  const bridge = await createBridge();
  const received = [];
  bridge.addEventListener('data', (event) => received.push(event.detail));
  bridge.vdo.emit('dataReceived', {
    uuid: 'peer-1',
    data: { overlayNinja: { chatmessage: 'hello' } },
  });
  assert.deepEqual(received, [{ uuid: 'peer-1', data: { chatmessage: 'hello' } }]);
});

test('background consumes only the normalized bridge data event', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  assert.doesNotMatch(source, /ninjaBridge\.vdo\.addEventListener\(["']data(?:Received)?["']/);
});

test('production loader uses the official vendored SDK', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  assert.match(source, /loadScript\(["']\.\/thirdparty\/vdoninja-sdk\.js["']\)/);
  assert.doesNotMatch(source, /sources\/grabvideo\.js/);
});

test('Discord video capture uses the official vendored SDK', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
  const captureEntry = manifest.content_scripts.find((entry) =>
    Array.isArray(entry.js) && entry.js.includes('./sources/capturevideo.js')
  );
  assert.deepEqual(captureEntry.js, ['./thirdparty/vdoninja-sdk.js', './sources/capturevideo.js']);

  const source = fs.readFileSync(path.join(__dirname, '..', 'sources', 'capturevideo.js'), 'utf8');
  assert.doesNotMatch(source, /class VDONinjaSDK/);
  assert.match(source, /joinRoom\(\{ room: ROOM_ID \}\)/);
});

test('destroy closes the SDK signaling connection', async () => {
  const bridge = await createBridge();
  const sdk = bridge.vdo;
  await bridge.destroy();
  assert.equal(sdk.calls.some((call) => call[0] === 'disconnect'), true);
  assert.equal(bridge.isReady(), false);
});
