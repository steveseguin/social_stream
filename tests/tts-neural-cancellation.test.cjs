'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
// All browser APIs below are inert fixtures. No model, audio, browser, or network is used.
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
function harness({suspendFirst = false, deferDecode = false, failWorker = false, resumeOnClose = 'reject'} = {}) {
  const workers = [], contexts = [], starts = [], errors = [], timers = new Map();
  let nextTimer = 0;
  class AudioContext {
    constructor() { this.index = contexts.length; this.state = suspendFirst && this.index === 1 ? 'suspended' : 'running'; this.sampleRate = 24000; this.currentTime = 0; this.destination = {}; this.sources = []; this.resumeRequests = []; contexts.push(this); }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
    resume() {
      return new Promise((resolve, reject) => {
        const request = { settled: false };
        request.resolve = () => {
          if (request.settled) return;
          request.settled = true;
          if (this.state !== 'closed') this.state = 'running';
          resolve();
        };
        request.reject = error => {
          if (request.settled) return;
          request.settled = true;
          reject(error);
        };
        this.resumeRequests.push(request);
        this.resumeResolve = request.resolve;
        this.resumeReject = request.reject;
      });
    }
    resolvePendingResumes() { this.resumeRequests.forEach(request => request.resolve()); }
    rejectPendingResumes(error) { this.resumeRequests.forEach(request => request.reject(error)); }
    close() { this.state = 'closed'; if (resumeOnClose === 'reject') this.rejectPendingResumes(new Error('Cannot resume a closed AudioContext')); return Promise.resolve(); }
    createBuffer(channels, length, sampleRate) { return { duration: length / sampleRate, copyToChannel() {} }; }
    createBufferSource() { const source = { connect() {}, disconnect() { this.disconnected = true; }, stop() { this.stopped = true; }, start(time) { this.startTime = time; if (!this.loop) starts.push(this); }, end() { if (this.onended) this.onended(); } }; this.sources.push(source); return source; }
    decodeAudioData() { if (deferDecode) return new Promise((resolve, reject) => { this.decodeResolve = resolve; this.decodeReject = reject; }); return Promise.resolve({ sampleRate: 24000, getChannelData() { return new Float32Array(240); } }); }
  }
  class Worker {
    constructor() { if (failWorker) { failWorker = false; throw Error('Worker constructor failed'); } this.terminated = false; this.requests = []; workers.push(this); }
    postMessage(data) { this.requests.push(data); }
    terminate() { this.terminated = true; }
    emit(data) { this.onmessage({ data }); }
  }
  const context = { AudioContext, Worker, URL, Blob, console: { warn() {}, log() {}, error(...x) { errors.push(x.map(String).join(' ')); } }, setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, {fn, ms}); return id; }, clearTimeout(id) { timers.delete(id); }, navigator: { userAgent: 'VM', vendor: 'VM' }, document: { addEventListener() {}, getElementById() { return null; } }, speechSynthesis: { getVoices() { return []; }, speaking: false, pending: false }, location: { href: 'https://fixture.invalid/tts.html' } };
  context.window = context; vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'tts.js'), 'utf8'), context);
  const client = fs.readFileSync(path.join(root, 'shared/tts/neural-client.js'), 'utf8').replace('import.meta.url', JSON.stringify('https://fixture.invalid/shared/tts/neural-client.js'));
  vm.runInContext(client, context);
  const TTS = context.TTS; TTS.speech = true; TTS.TTSProvider = 'kokoro'; TTS.kokoroSettings.background = true; TTS.kokoroSettings.stream = true;
  function current(worker = workers.at(-1)) { return worker.requests.at(-1).id; }
  function chunk(worker = workers.at(-1), count = 240) { worker.emit({ id: current(worker), progress: { chunk: new Float32Array(count), sampleRate: 24000 } }); }
  function done(worker = workers.at(-1)) { worker.emit({ id: current(worker), result: { blob: { arrayBuffer: async () => new ArrayBuffer(0) } } }); }
  function requestTexts() { return workers.flatMap(w => w.requests.map(r => r.options.text)); }
  function cleanup() { TTS.premiumQueueTTS = []; TTS.cancelNeuralSpeech(); }
  return { TTS, workers, contexts, starts, errors, timers, chunk, done, current, requestTexts, cleanup };
}
async function test(name, run) {
  const skipped = await run();
  console.log((skipped ? 'SKIP ' : 'PASS ') + name + (skipped ? ': ' + skipped : ''));
}
(async () => {
  await test('Streaming queue owns completion until every scheduled PCM chunk ends', async () => {
    const h = harness(); const t = h.TTS;
    t.speak('A'); t.speak('B'); h.chunk(undefined, 24000); h.chunk(undefined, 12000); h.done(); await flush();
    assert.deepEqual(h.requestTexts(), ['A']); assert.equal(h.starts.length, 2);
    assert.equal(h.starts[0].startTime, 0.15); assert.equal(h.starts[1].startTime, 1.15);
    h.starts[0].end(); await flush(); assert.deepEqual(h.requestTexts(), ['A']);
    h.starts[1].end(); await flush(); assert.deepEqual(h.requestTexts(), ['A', 'B']);
    h.chunk(); h.done(); await flush(); h.starts[2].end(); await flush();
    assert.equal(t.premiumQueueActive, false); assert.equal(t.neuralActive, false); assert.equal(h.timers.size, 0); h.cleanup();
  });
  await test('Skip during generation ignores late completion and preserves the next message', async () => {
    const h = harness(); h.TTS.speak('A'); h.TTS.speak('B'); const old = h.workers[0]; h.TTS.skipCurrent(); h.done(old); await flush();
    assert.deepEqual(h.requestTexts(), ['A', 'B']); assert.equal(h.workers[1].terminated, false); assert.equal(h.TTS.premiumQueueActive, true); h.cleanup();
  });
  await test('Skip during scheduled playback suppresses the old ended callback', async () => {
    const h = harness(); h.TTS.speak('A'); h.TTS.speak('B'); h.chunk(); h.done(); await flush(); const source = h.starts[0]; h.TTS.skipCurrent(); source.end(); await flush();
    assert.equal(source.stopped, true); assert.equal(source.onended, null); assert.deepEqual(h.requestTexts(), ['A', 'B']); assert.equal(h.workers[1].terminated, false); h.cleanup();
  });
  await test('A late cancelled non-stream decode error cannot cancel the new message', async () => {
    const h = harness({deferDecode: true}); h.TTS.kokoroSettings.stream = false; h.TTS.speak('A'); h.TTS.speak('B'); h.done(); await flush(); h.TTS.skipCurrent(); h.contexts[1].decodeReject(Error('Decode aborted')); await flush();
    assert.deepEqual(h.requestTexts(), ['A', 'B']); assert.equal(h.workers[1].terminated, false); h.cleanup();
  });
  await test('Worker construction failure closes its player and releases the queue', async () => {
    const h = harness({failWorker: true}); h.TTS.speak('A'); h.TTS.speak('B'); await flush();
    assert.equal(h.contexts[1].state, 'closed'); assert.deepEqual(h.requestTexts(), ['B']); assert.equal(h.workers[0].terminated, false); h.cleanup();
  });
  await test('Worker load failure cancels its worker and starts the queued next message', async () => {
    const h = harness(); h.TTS.speak('A'); h.TTS.speak('B'); h.workers[0].onerror(); await flush();
    assert.deepEqual(h.requestTexts(), ['A', 'B']); assert.equal(h.workers[0].terminated, true); assert.equal(h.workers[1].terminated, false); h.cleanup();
  });
  await test('Timeout cancels generation and advances the queue once', async () => {
    const h = harness(); h.TTS.speak('A'); h.TTS.speak('B'); assert.equal(h.timers.size, 1); Array.from(h.timers.values())[0].fn(); await flush();
    assert.deepEqual(h.requestTexts(), ['A', 'B']); assert.equal(h.workers[0].terminated, true); assert.equal(h.workers[1].terminated, false); h.cleanup();
  });
  await test('A successful old streaming resume after cancellation cannot play or cancel B', async () => {
    const h = harness({suspendFirst: true, resumeOnClose: 'manual'}); h.TTS.speak('A'); h.TTS.speak('B'); h.chunk(); await flush();
    h.TTS.skipCurrent(); h.contexts[1].resolvePendingResumes(); await flush();
    assert.deepEqual(h.requestTexts(), ['A', 'B']); assert.equal(h.workers[1].terminated, false); assert.equal(h.starts.length, 0);
    h.chunk(); h.done(); await flush(); assert.equal(h.starts.length, 1); h.starts[0].end(); await flush(); assert.equal(h.TTS.premiumQueueActive, false); h.cleanup();
  });
  await test('A current-owned streaming resume rejection still cancels A and advances once', async () => {
    const h = harness({suspendFirst: true}); h.TTS.speak('A'); h.TTS.speak('B'); h.chunk(); await flush();
    h.contexts[1].resumeReject(Error('Resume failed')); await flush();
    assert.deepEqual(h.requestTexts(), ['A', 'B']); assert.equal(h.workers[0].terminated, true); assert.equal(h.workers[1].terminated, false); assert.equal(h.TTS.premiumQueueActive, true);
    h.chunk(); h.done(); await flush(); assert.equal(h.starts.length, 1); h.starts[0].end(); await flush(); assert.equal(h.TTS.premiumQueueActive, false); h.cleanup();
  });
  await test('Skipping before PCM safely rejects the warmup-only resume', async () => {
    const h = harness({suspendFirst: true}); h.TTS.speak('A'); h.TTS.speak('B');
    const oldContext = h.contexts[1];
    if (!oldContext.sources.some(source => source.loop)) { h.cleanup(); await flush(); return 'This version has no warmup source'; }
    assert.equal(oldContext.resumeRequests.length, 1); assert.equal(oldContext.sources[0].loop, true);
    h.TTS.skipCurrent(); await flush();
    assert.equal(oldContext.resumeRequests[0].settled, true); assert.equal(oldContext.sources[0].stopped, true); assert.equal(oldContext.sources[0].disconnected, true);
    assert.deepEqual(h.requestTexts(), ['A', 'B']); assert.equal(h.workers[1].terminated, false); assert.equal(h.TTS.premiumQueueActive, true); h.cleanup();
  });
  await test('Successful warmup resume avoids a second resume and stops at completion', async () => {
    const h = harness({suspendFirst: true}); h.TTS.speak('A'); const oldContext = h.contexts[1];
    if (!oldContext.sources.some(source => source.loop)) { h.cleanup(); await flush(); return 'This version has no warmup source'; }
    assert.equal(oldContext.resumeRequests.length, 1); oldContext.resolvePendingResumes(); await flush();
    h.chunk(); h.done(); await flush(); assert.equal(oldContext.resumeRequests.length, 1); assert.equal(h.starts.length, 1);
    h.starts[0].end(); await flush(); assert.equal(h.TTS.premiumQueueActive, false); assert.equal(oldContext.sources[0].stopped, true); assert.equal(oldContext.sources[0].disconnected, true); h.cleanup();
  });
  await test('Rejected warmup resume does not cancel speech; PCM can retry resume', async () => {
    const h = harness({suspendFirst: true}); h.TTS.speak('A'); const oldContext = h.contexts[1];
    if (!oldContext.sources.some(source => source.loop)) { h.cleanup(); await flush(); return 'This version has no warmup source'; }
    oldContext.resumeReject(Error('Warmup resume failed')); await flush(); assert.equal(h.workers[0].terminated, false); assert.equal(h.TTS.premiumQueueActive, true);
    h.chunk(); await flush(); assert.equal(oldContext.resumeRequests.length, 2); oldContext.resumeResolve(); h.done(); await flush();
    assert.equal(h.starts.length, 1); h.starts[0].end(); await flush(); assert.equal(h.TTS.premiumQueueActive, false); assert.equal(oldContext.sources[0].stopped, true); h.cleanup();
  });
  await test('A late rejected streaming resume must not cancel the message started by Skip', async () => {
    const h = harness({suspendFirst: true}); h.TTS.speak('A'); h.TTS.speak('B'); h.chunk(); await flush();
    const oldContext = h.contexts[1];
    const warmup = oldContext.sources.find(source => source.loop);
    const expectedResumeRequests = warmup ? 2 : 1;
    assert.equal(oldContext.resumeRequests.length, expectedResumeRequests, 'Each suspended warmup/PCM path requested resume');
    assert.equal(oldContext.resumeRequests.filter(request => !request.settled).length, expectedResumeRequests);
    h.TTS.skipCurrent(); assert.equal(h.workers[1].terminated, false); await flush();
    assert.equal(oldContext.resumeRequests.filter(request => !request.settled).length, 0, 'Closing rejects every outstanding resume');
    if (warmup) {
      assert.equal(warmup.stopped, true);
      assert.equal(warmup.disconnected, true);
    }
    const observed = { requests: h.requestTexts(), workerTerminated: h.workers.map(w => w.terminated), playbackStarts: h.starts.length, queued: h.TTS.premiumQueueTTS.length, active: h.TTS.premiumQueueActive, neuralStatus: h.TTS.neuralStatus };
    console.log(JSON.stringify(observed));
    try { assert.equal(h.workers[1].terminated, false, 'Cancelled A resumed rejection terminated B'); assert.equal(h.TTS.premiumQueueActive, true); h.chunk(); h.done(); await flush(); assert.equal(h.starts.length, 1); h.starts[0].end(); await flush(); assert.equal(h.TTS.premiumQueueActive, false); } finally { h.cleanup(); }
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
