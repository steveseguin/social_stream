const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const rootPath = path.resolve(__dirname, '..');
const music = fs.readFileSync(process.env.SSO_MUSIC_SOURCE || path.join(rootPath, 'overlays/templates/music.js'), 'utf8');
const view = fs.readFileSync(process.env.SSO_VIEW_SOURCE || path.join(rootPath, 'overlays/view.html'), 'utf8');
const engine = fs.readFileSync(process.env.SSO_ENGINE_SOURCE || path.join(rootPath, 'overlays/templates/engines.js'), 'utf8');
// Complete production scripts and the real view initialization/OBS callback run
// against deterministic RAF and lightweight DOM/canvas boundaries. No browser.
function run(id, replay = true) {
  let next = 0, now = 1000;
  const frames = new Map(), resize = new Set(), intervals = new Map();
  const events = {}, nodes = [], defs = {};
  function element(tag = 'div') {
    const n = {
      tag, children: [], parentNode: null, clientWidth: 1280, clientHeight: 720,
      writes: 0, paints: 0, queries: {},
      appendChild(child) { this.children.push(child); child.parentNode = this; },
      contains(child) { return child === this || this.children.some(n => n.contains(child)); },
      querySelector(selector) { return this.querySelectorAll(selector)[0]; },
      querySelectorAll(selector) {
        if (!this.queries[selector]) {
          const count = selector === '.bp-dots i' || selector === '.np-eq b' ? 4
            : selector.startsWith('.dk-') && selector !== '.dk-xf i' ? 2 : 1;
          this.queries[selector] = Array.from({ length: count }, () => {
            const child = element(selector === '.dk-wave' ? 'canvas' : 'div');
            this.appendChild(child);
            if (selector === '.dk-vu') {
              for (let i = 0; i < 10; i++) child.appendChild(element());
            }
            return child;
          });
        }
        return this.queries[selector];
      }
    };
    n.style = new Proxy({ cssText: '' }, {
      set(target, key, value) { n.writes++; target[key] = value; return true; }
    });
    for (const key of ['textContent', 'className']) {
      Object.defineProperty(n, key, { set() { n.writes++; } });
    }
    Object.defineProperty(n, 'innerHTML', {
      set() {
        n.children.forEach(child => { child.parentNode = null; });
        n.children = [];
        n.queries = {};
      }
    });
    n.getContext = () => new Proxy({}, {
      get(target, key) {
        if (key.startsWith('create')) return () => ({ addColorStop() {} });
        return () => { n.paints++; };
      },
      set() { return true; }
    });
    nodes.push(n);
    return n;
  }
  const root = element();
  const SSO = {
    esc: value => String(value || ''),
    color: value => String(value || 'fff').replace(/^#?/, '#'),
    rgba: () => '', fontStack: () => '', loadFont() {}, addStyle() {},
    seeded: () => () => 0.5,
    lines: value => String(value || '').split('\n'),
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    CATEGORIES: [], VIBES: [],
    f: { font: () => ({ key: 'font', default: '' }) },
    register: def => { defs[def.id] = def; },
    get: id => defs[id],
    readConfig: def => ({
      ...Object.fromEntries(def.fields.map(field => [field.key, field.default])),
      replay, ...(id === 'decks' ? { layout: 'cdj2' } : {})
    }),
    obs: { on: (name, callback) => { events[name] = callback; } },
    loadScripts: (libs, callback) => callback()
  };
  const sandbox = {
    SSO, console, URLSearchParams,
    location: { search: '?t=' + id }, performance: { now: () => now },
    document: { createElement: element, getElementById: () => root, body: element(), head: element() },
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener(type, callback) { if (type === 'resize') resize.add(callback); },
    removeEventListener(type, callback) { resize.delete(callback); },
    requestAnimationFrame(callback) { frames.set(++next, callback); return next; },
    cancelAnimationFrame: id => frames.delete(id),
    setInterval(callback) { intervals.set(++next, callback); return next; },
    clearInterval: id => intervals.delete(id),
    // Nested transition timeouts are outside this RAF/resize regression.
    setTimeout: () => 0
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(engine, sandbox);
  vm.runInContext(music, sandbox);
  if (id === 'lasers' || id === 'equalizer') {
    defs[id] = { fields: [], render(root) {
      const host = element();
      root.appendChild(host);
      SSO.startEngine(id, host, {});
    } };
  }
  const script = view.slice(view.lastIndexOf('<script>') + 8, view.lastIndexOf('</script>'));
  vm.runInContext(script, sandbox);
  function step() {
    now += 16;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(now));
  }

 const stale = [...frames.values()];
 for (let i = 0; i < 7; i++) { events.obsSceneChanged({ name: 'Scene' + i }); step(); }
 const hasResize = ['visualizer', 'decks', 'lasers', 'equalizer'].includes(id);
 assert.equal(frames.size, 1, id + ': only the current RAF remains');
 assert.equal(resize.size, hasResize ? 1 : 0, id + ': only current resize listener remains');
 const detached = nodes.filter(n => n !== root && !root.contains(n));
 const updates = list => list.reduce((sum, n) => sum + n.writes + n.paints, 0);
 const before = updates(detached);
 const currentBefore = updates(nodes.filter(n => root.contains(n)));
 step();
 assert.equal(updates(detached), before, id + ': removed nodes stop animating');
 assert.ok(updates(nodes.filter(n => root.contains(n))) > currentBefore, id + ': replacement animates');
 if (replay) {
  stale.forEach(fn => fn(now));
  assert.equal(frames.size, 1, id + ': dequeued stale RAF cannot restart');
  assert.equal(updates(detached), before, id + ': stale RAF cannot mutate removed nodes');
 }
 // Root cleanup must preserve another mounted renderer and be idempotent.
 const other = element();
 defs[id].render(other, SSO.readConfig(defs[id]));
 assert.equal(frames.size, 2);
 const otherBefore = updates(nodes.filter(n => other.contains(n)));
 SSO.cleanup(root);
 SSO.cleanup(root);
 assert.equal(frames.size, 1);
 assert.equal(resize.size, hasResize ? 1 : 0);
 const stoppedBefore = updates(nodes.filter(n => root.contains(n)));
 step();
 assert.equal(updates(nodes.filter(n => root.contains(n))), stoppedBefore);
 assert.ok(updates(nodes.filter(n => other.contains(n))) > otherBefore);
 SSO.cleanup(other);
 assert.equal(frames.size, 0);
 assert.equal(resize.size, 0);
 if (id === 'lasers' || id === 'equalizer') {
  const host = element();
  const instance = SSO.startEngine(id, host, {});
  const pending = [...frames.values()];
  instance.stop(); instance.stop();
  const old = updates(nodes.filter(n => host.contains(n)));
  pending.forEach(fn => fn(now));
  assert.equal(frames.size, 0, id + ': direct stop cancels frame');
  assert.equal(resize.size, 0, id + ': direct stop removes resize');
  assert.equal(updates(nodes.filter(n => host.contains(n))), old);
 }
 console.log(id + ': ' + (replay ? 'replay' : 'replay-disabled') + ' cleanup passed');
}
for (const id of ['visualizer', 'bpm', 'decks', 'nowplaying', 'lasers', 'equalizer']) {
 run(id);
 run(id, false);
}

