const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const sourceRoot = path.resolve(process.argv[2] || path.join(__dirname, '..'));

function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
async function drain() { for (let i = 0; i < 30; i++) await Promise.resolve(); }

// Entire tts.js is evaluated. DOM, audio, network, timers and the model are inert doubles.
function environment() {
  const events = [], errors = [], timers = new Map(), blobs = new Map();
  let timerId = 0, blobId = 0;
  class Audio {
    constructor() { this.listeners = {}; this.onended = null; this.paused = true; this.currentTime = 0; this.duration = 1; this.ended = false; }
    addEventListener(type, fn) { (this.listeners[type] ||= new Set()).add(fn); }
    removeEventListener(type, fn) { this.listeners[type]?.delete(fn); }
    dispatch(type) {
      const handler = this['on' + type];
      if (handler) handler({ type });
      for (const fn of [...(this.listeners[type] || [])]) fn({ type });
    }
    play() { this.paused = false; this.ended = false; events.push({ type: 'play', src: this.src }); return Promise.resolve(); }
    pause() { const wasPlaying = !this.paused; this.paused = true; events.push({ type: 'pause' }); if (wasPlaying) this.dispatch('pause'); }
    end() { this.ended = true; this.paused = true; this.currentTime = this.duration; events.push({ type: 'end', src: this.src }); this.dispatch('ended'); }
  }
  class AudioContext { constructor() { this.state = 'running'; } resume() { this.state = 'running'; return Promise.resolve(); } }
  const context = {
    console: { log() {}, warn(...a) { errors.push(a.map(String).join(' ')); }, error(...a) { errors.push(a.map(String).join(' ')); } },
    AudioContext, Blob, URLSearchParams, AbortController, Map, Set,
    URL: Object.assign(class extends URL {}, {
      createObjectURL(blob) { const url = 'blob:synthetic-' + (++blobId); blobs.set(url, blob); return url; },
      revokeObjectURL(url) { events.push({ type: 'revoke', src: url }); }
    }),
    document: { addEventListener() {}, getElementById() { return null; }, createElement(type) { assert.equal(type, 'audio'); return new Audio(); } },
    navigator: { userAgent: 'OfflineSynthetic', vendor: '' },
    speechSynthesis: { getVoices() { return [{}]; }, speaking: false, pending: false, cancel() {} },
    location: { href: 'https://example.invalid/dock.html', search: '' },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { throw Error('No interval permitted in this harness'); },
    fetch() { throw Error('No unstubbed fetch permitted in this harness'); }
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(sourceRoot, 'tts.js'), 'utf8'), context, { filename: 'tts.js' });
  const TTS = context.TTS;
  const originalFinish = TTS.finishedAudio;
  TTS.finishedAudio = function (...a) { events.push({ type: 'finish' }); return originalFinish.apply(this, a); };
  TTS.initKokoro = async () => true;
  TTS.configure(new URLSearchParams('ttsprovider=kokoro&speech=1'));
  TTS.speech = true;
  TTS.TextSplitterStream = class { push(text) { this.text = text; } close() {} };
  return { context, TTS, Audio, events, errors, timers, blobs };
}

function modelGate(env, behavior = 'yield') {
  const gate = deferred();
  env.TTS.kokoroTtsInstance = { async *stream(input) {
    env.events.push({ type: 'generation', text: input.text });
    await gate.promise;
    if (behavior === 'throw') throw Error('synthetic inference failure');
    if (behavior === 'yield') yield { audio: { toBlob() { return new Blob(['kokoro:' + input.text]); } } };
  } };
  return gate;
}

async function crossProvider({ failure = true, action = 'skip', provider = 'openai' } = {}) {
  const env = environment(), { TTS, context, events } = env;
  const gate = modelGate(env, failure ? 'throw' : 'yield');
  context.fetch = async (url, options) => {
    events.push({ type: 'fetch', text: JSON.parse(options.body).input || JSON.parse(options.body).text });
    return { ok: true, headers: { get() { return 'audio/wav'; } }, async blob() { return new Blob(['replacement']); } };
  };
  TTS.openAISettings.endpoint = 'https://example.invalid/synthetic-tts';
  TTS.ElevenLabsKey = 'inert-fixture-value';
  TTS.speak('old Kokoro');
  await drain();
  TTS.TTSProvider = provider;
  if (action === 'skip') {
    TTS.speak('replacement');
    TTS.speak('third');
    TTS.skipCurrent();
  } else {
    TTS.toggle();
    TTS.toggle();
    TTS.speak('replacement');
    TTS.speak('third');
  }
  await drain();
  const replacementResolver = TTS.resolveCurrentAudioPlayback;
  gate.resolve();
  await drain();
  const handlerBeforeEnd = typeof TTS.audio.onended;
  const resolverPreserved = TTS.resolveCurrentAudioPlayback === replacementResolver;
  TTS.audio.end();
  await drain();
  const afterFirstEnd = { active: TTS.premiumQueueActive, queued: TTS.premiumQueueTTS.length };
  if (events.filter(x => x.type === 'play').length >= 2) { TTS.audio.end(); await drain(); }
  return {
    failure, action, provider, handlerBeforeEnd, resolverPreserved, afterFirstEnd,
    fetched: events.filter(x => x.type === 'fetch').map(x => x.text),
    plays: events.filter(x => x.type === 'play').length,
    finishes: events.filter(x => x.type === 'finish').length,
    active: TTS.premiumQueueActive, queued: TTS.premiumQueueTTS.length,
    errors: env.errors
  };
}


function setupCohost(env) {
  const source = fs.readFileSync(path.join(sourceRoot, 'cohost.html'), 'utf8');
  const applyStart = source.indexOf('function applyCohostTtsProvider(');
  const applyEnd = source.indexOf('\n\t\t\tfunction runCohostTts(', applyStart);
  const runEnd = source.indexOf('\n\t\t\tfunction ', applyEnd + 1);
  const cancelStart = source.indexOf('cancelBrowserTts(errorMessage = "") {');
  const cancelEnd = source.indexOf('\n\t\t\t\tpauseRecognitionForSpeech()', cancelStart);
  const stopStart = source.indexOf('function stopCohostSpeakingNow() {');
  const stopEnd = source.indexOf('\n\t\t\tfunction syncMuteButtonState(', stopStart);
  const selector = { value: 'kokoro', callbacks: {}, addEventListener(type, cb) { this.callbacks[type] = cb; }, change(value) { this.value = value; this.callbacks.change.call(this); } };
  env.context.ttsProviderSelect = selector;
  env.context.providerSelect = { value: 'localqwen' };
  env.context.localStorage = { values: new Map(), getItem(k) { return this.values.get(k) || null; }, setItem(k, v) { this.values.set(k, v); } };
  env.context.BROWSER_TTS_AVAILABLE = true;
  env.context.syncVoiceModeSummary = () => {};
  env.context.renderCohostPreflight = () => {};
  env.context.getStoredCohostTtsProvider = () => selector.value;
  env.context.updateVoiceTelemetry = () => {};
  vm.runInNewContext(source.slice(applyStart, runEnd) + '\nwindow.publisher = {' + source.slice(cancelStart, cancelEnd) + ', clearActiveTtsRequest() {}};\n' + source.slice(stopStart, stopEnd), env.context);
  // Locate the unique real selector change handler; do not invent provider switching behavior.
  const listenerText = source.slice(source.lastIndexOf('if (ttsProviderSelect) {', source.indexOf('ttsProviderSelect.addEventListener("change"')), source.indexOf('\n\t\t\tmessageInput.addEventListener', source.indexOf('ttsProviderSelect.addEventListener("change"')));
  assert.ok(listenerText.includes('applyCohostTtsProvider(this.value)'));
  vm.runInNewContext(listenerText, env.context);
  return selector;
}

async function scenario(failure, lateOld = false) {
  const env = environment(), { TTS, context, events } = env;
  const selector = setupCohost(env);
  const gate = modelGate(env, failure ? 'throw' : 'yield');
  TTS.espeakLoaded = true;
  TTS.espeakInstance = { async speak(text) { events.push({ type: 'espeak-generation', text }); return new ArrayBuffer(8); } };
  const oldAudio = TTS.audio;
  context.runCohostTts('old Kokoro', 'kokoro');
  await drain();
  assert.equal(context.stopCohostSpeakingNow(), true);
  selector.change('espeak');
  context.runCohostTts('replacement', 'espeak');
  TTS.speak('third', true);
  await drain();
  assert.equal(TTS.audio, oldAudio, 'real cohost selector reuses the audio element');
  if (!lateOld) { gate.resolve(); await drain(); }
  const handlerBeforeEnd = typeof TTS.audio.onended;
  TTS.audio.end();
  await drain();
  const firstEnd = { active: TTS.premiumQueueActive, queued: TTS.premiumQueueTTS.length };
  if (events.filter(e => e.type === 'play').length >= 2) { TTS.audio.end(); await drain(); }
  if (lateOld) { gate.resolve(); await drain(); }
  return { failure, lateOld, selectedProvider: TTS.TTSProvider, handlerBeforeEnd, firstEnd,
    generated: events.filter(e => e.type === 'espeak-generation').map(e => e.text),
    plays: events.filter(e => e.type === 'play').length,
    finishes: events.filter(e => e.type === 'finish').length,
    active: TTS.premiumQueueActive, queued: TTS.premiumQueueTTS.length,
    timersPending: [...env.timers.values()].map(t => t.ms), errors: env.errors };
}


(async () => {
  const rows = [];
  for (const failure of [true, false]) for (const lateOld of [false, true]) {
    const row = await scenario(failure, lateOld);
    assert.deepEqual(row.generated, ['replacement', 'third']);
    assert.equal(row.plays, 2);
    assert.equal(row.finishes, 2);
    assert.equal(row.active, false);
    assert.equal(row.queued, 0);
    assert.equal(row.handlerBeforeEnd, 'function');
    rows.push(row);
  }
  for (const provider of ['openai', 'elevenlabs']) for (const action of ['skip', 'toggle']) for (const failure of [false, true]) {
    const row = await crossProvider({ provider, action, failure });
    assert.deepEqual(row.fetched, ['replacement', 'third']);
    assert.equal(row.plays, 2);
    assert.equal(row.finishes, action === 'skip' ? 3 : 2);
    assert.equal(row.active, false);
    assert.equal(row.queued, 0);
    assert.equal(row.resolverPreserved, true);
    rows.push(row);
  }
  console.log('PASS', rows.length, 'Kokoro cancellation and provider replacement controls; every expected replacement and third item plays once and drains.');
})().catch(e => { console.error(e); process.exitCode = 1; });
