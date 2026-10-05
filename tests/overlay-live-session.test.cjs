const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../overlays/templates/obs.js'), 'utf8');
const MINUTE = 60000;
function fixture(options = {}) {
  const clock = options.clock || { now: 100000 };
  const storage = options.storage || new Map();
  const events = {}, intervals = [], definitions = {};
  const display = { textContent: '' };
  const element = () => ({ style: {}, appendChild() {}, querySelector() { return display; }, innerHTML: '', className: '' });
  const SSO = {
    register(def) { definitions[def.id] = def; },
    f: { font: value => ({ key: 'font', default: value }) }, fxFields: () => [],
    esc: String, color: String, fontStack: String, rgba: () => '', loadFont() {},
    store: { get: key => storage.get(key), set: (key, value) => storage.set(key, value) },
    obs: { available: () => options.obs !== false, status: cb => cb(options.obs === false ? null : { streaming: !!options.streaming }), on: (name, fn) => { events[name] = fn; } },
    parseTarget: value => new Date(value),
    splitDuration(ms) { const s = Math.floor(ms / 1000); return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 }; },
    pad: value => String(value).padStart(2, '0')
  };
  new Function('SSO', 'Date', 'setInterval', 'document', source)(SSO, { now: () => clock.now }, (fn, ms) => intervals.push({ fn, ms }), { createElement: element });
  const def = definitions.livetimer;
  const config = Object.fromEntries(def.fields.map(field => [field.key, field.default]));
  Object.assign(config, { obsonly: true }, options.config);
  def.render(element(), config, { preview: !!options.preview, params: { has: key => key === 'reset' && !!options.reset } });
  const tick = () => intervals.filter(item => item.ms === 500).forEach(item => item.fn());
  return {
    clock, storage, display,
    advance(ms) { for (let remaining = ms; remaining > 0;) { const step = Math.min(5000, remaining); clock.now += step; remaining -= step; intervals.forEach(item => item.fn()); } },
    start() { events.obsStreamingStarted(); tick(); },
    stop() { events.obsStreamingStopped(); tick(); }
  };
}
for (const wait of [MINUTE, 120 * MINUTE]) {
  const f = fixture();
  assert.equal(f.display.textContent, 'Offline');
  f.advance(wait);
  assert.equal(f.display.textContent, 'Offline');
  f.start();
  assert.equal(f.display.textContent, '00:00:00', 'First OBS stream must exclude idle source time, including waits within the gap');
  f.advance(MINUTE);
  assert.equal(f.display.textContent, '00:01:00');
}
{
  const first = fixture(); first.advance(120 * MINUTE);
  const reloaded = fixture({ storage: first.storage, clock: first.clock });
  reloaded.advance(MINUTE); reloaded.start();
  assert.equal(reloaded.display.textContent, '00:00:00', 'Reloading an idle source must retain its pending first start');
}
{
  const f = fixture({ streaming: true });
  assert.equal(f.display.textContent, '00:00:00');
  f.advance(10 * MINUTE);
  const reloaded = fixture({ streaming: true, storage: f.storage, clock: f.clock });
  assert.equal(reloaded.display.textContent, '00:10:00', 'Reloading an active source preserves its stream start');
  reloaded.stop(); reloaded.advance(5 * MINUTE); reloaded.start();
  assert.equal(reloaded.display.textContent, '00:15:00', 'Short accidental drops preserve session continuity');
  reloaded.advance(60 * MINUTE); reloaded.start();
  assert.equal(reloaded.display.textContent, '01:15:00', 'An earlier stop must not reset a resumed active stream');
  reloaded.stop(); reloaded.advance(31 * MINUTE); reloaded.start();
  assert.equal(reloaded.display.textContent, '00:00:00', 'A long stream break starts a new session');
}
{
  const f = fixture({ config: { obsonly: false } }); f.advance(2 * MINUTE);
  assert.equal(f.display.textContent, '00:02:00', 'Default timer retains source-load counting');
  const fallback = fixture({ obs: false }); fallback.advance(MINUTE);
  assert.equal(fallback.display.textContent, '00:01:00', 'Outside OBS, fallback counting remains usable');
}
{
  const f = fixture({ preview: true }); f.advance(MINUTE); f.start(); f.stop();
  assert.equal(f.storage.size, 0, 'Preview must not persist a session');
  const fixed = fixture({ config: { since: '1970-01-01T00:00:00Z' } }); fixed.advance(MINUTE); fixed.start();
  assert.equal(fixed.display.textContent, '00:02:40', 'Explicit fixed start remains authoritative');
}
console.log('PASS: OBS first start, idle reload, live reload, short/long drops, duplicate start, fallback, preview and fixed start');
