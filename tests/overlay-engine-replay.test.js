const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const engineSource = fs.readFileSync(process.env.SSO_ENGINE_SOURCE || path.join(root, 'overlays/templates/engines.js'), 'utf8');
const viewSource = fs.readFileSync(process.env.SSO_VIEW_SOURCE || path.join(root, 'overlays/view.html'), 'utf8');
const drawSource = viewSource.match(/function draw\(\) \{[\s\S]*?\n\t\t\}/)[0];

function fixture(webgl = false) {
  let next = 0;
  const frames = new Map();
  const resize = new Set();
  const canvases = [];
  function element(tag = 'div') {
    const node = {
      tag, style: {}, children: [], parentNode: null, clientWidth: 640, clientHeight: 360,
      appendChild(child) { this.children.push(child); child.parentNode = this; },
      contains(child) { return child === this || this.children.some(n => n.contains(child)); }
    };
    Object.defineProperty(node, 'innerHTML', {
      set() { this.children.forEach(child => { child.parentNode = null; }); this.children = []; }
    });
    if (tag === 'canvas') {
      node.paints = 0;
      node.lost = 0;
      const gradient = { addColorStop() {} };
      const ctx = new Proxy({}, {
        get(target, key) {
          if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
          if (key === 'fillRect') return () => { node.paints++; };
          return () => {};
        },
        set() { return true; }
      });
      const gl = new Proxy({}, {
        get(target, key) {
          if (key === 'getExtension') return () => ({ loseContext() { node.lost++; } });
          if (key === 'getShaderParameter') return () => true;
          if (key === 'getAttribLocation') return () => 0;
          if (key === 'drawArrays') return () => { node.paints++; };
          return () => ({});
        }
      });
      node.getContext = type => type === '2d' ? ctx : (webgl ? gl : null);
      canvases.push(node);
    }
    return node;
  }
  const SSO = {
    color(value) { return String(value || '#ffffff').replace(/^([^#])/, '#$1'); },
    rgba() { return 'rgba(255,255,255,1)'; },
    clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  };
  const context = vm.createContext({
    SSO, console, document: { createElement: element },
    window: {
      innerWidth: 640, innerHeight: 360, devicePixelRatio: 1,
      addEventListener(type, fn) { if (type === 'resize') resize.add(fn); },
      removeEventListener(type, fn) { if (type === 'resize') resize.delete(fn); }
    },
    requestAnimationFrame(fn) { const id = ++next; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    clearInterval() {}
  });
  vm.runInContext(engineSource, context);
  function step() {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(fn => fn(1000));
  }
  function view(engine = 'aquarium') {
    const container = element();
    context.root = container;
    context.timers = [];
    context.cfg = {};
    context.ctx = {};
    context.def = { render(parent) {
      const host = element();
      parent.appendChild(host);
      SSO.startEngine(engine, host, { count: 3 });
    } };
    vm.runInContext(drawSource + '; this.draw = draw;', context);
    return { root: container, draw: context.draw };
  }
  return { SSO, element, frames, resize, canvases, step, view };
}

// Exercise the actual view draw() and actual aquarium engine, including repeated OBS replay.
{
  const f = fixture();
  const view = f.view();
  for (let i = 0; i < 8; i++) { view.draw(); f.step(); }
  assert.equal(f.frames.size, 1, 'replay retains only the current animation loop');
  assert.equal(f.resize.size, 1, 'replay retains only the current resize listener');
  const oldPaints = f.canvases.slice(0, -1).map(cv => cv.paints);
  const latest = f.canvases[f.canvases.length - 1];
  const currentPaints = latest.paints;
  f.step();
  assert.deepEqual(f.canvases.slice(0, -1).map(cv => cv.paints), oldPaints, 'removed canvases stop drawing');
  assert.ok(latest.paints > currentPaints, 'current aquarium continues drawing');
  f.SSO.stopEngines(view.root);
  f.SSO.stopEngines(view.root);
  assert.equal(f.frames.size, 0);
  assert.equal(f.resize.size, 0);
}

// One overlay's cleanup must not stop another host.
{
  const f = fixture();
  const a = f.element(), b = f.element();
  const first = f.SSO.startEngine('aquarium', a, { count: 1 });
  f.SSO.startEngine('aquarium', b, { count: 1 });
  first.stop();
  first.stop();
  assert.equal(f.frames.size, 1);
  assert.equal(f.resize.size, 1);
  f.step();
  assert.equal(f.canvases[0].paints, 0);
  assert.ok(f.canvases[1].paints > 0);
  f.SSO.stopEngines(b);
  assert.equal(f.frames.size, 0);
}

// Both WebGL implementations release their context on replay.
for (const engine of ['nebula', 'galaxy']) {
  const f = fixture(true);
  const view = f.view(engine);
  view.draw();
  f.step();
  const previous = f.canvases[0], paints = previous.paints;
  view.draw();
  f.step();
  assert.equal(previous.lost, 1, engine + ' releases old context');
  assert.equal(previous.paints, paints, engine + ' stops old draw calls');
  assert.ok(f.canvases[1].paints > 0, engine + ' replacement continues drawing');
  assert.equal(f.frames.size, 1);
  assert.equal(f.resize.size, 1);
  f.SSO.stopEngines(view.root);
  assert.equal(f.canvases[1].lost, 1);
}

// No-WebGL fallback also unregisters the canvas resize listener.
{
  const f = fixture();
  const host = f.element();
  f.SSO.startEngine('nebula', host, {});
  assert.equal(f.frames.size, 0);
  assert.equal(f.resize.size, 1);
  f.SSO.stopEngines(host);
  assert.equal(f.resize.size, 0);
}

console.log('Overlay engine replay checks passed (fake RAF/canvas/WebGL; no live OBS or browser).');
