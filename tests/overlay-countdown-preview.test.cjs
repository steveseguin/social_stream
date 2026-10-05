const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the production template with an inert DOM and controlled clock/storage.
function fixture() {
    let now = Date.UTC(2026, 0, 1, 12);
    const data = new Map();
    const document = {
        head: { appendChild() {} }, getElementById() { return null; },
        createElement() {
            return { style: {}, appendChild() {}, querySelector(selector) {
                return selector === '.tm-big' ? { style: {} } : null;
            } };
        }
    };
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    const window = { addEventListener() {}, removeEventListener() {}, location: { search: '' }, localStorage: {
        getItem(key) { return data.get(key) ?? null; },
        setItem(key, value) { data.set(key, String(value)); },
        removeItem(key) { data.delete(key); }
    } };
    const context = vm.createContext({ window, document, URLSearchParams, Date: Clock, setInterval() {} });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../overlays/core.js'), 'utf8'), context);
    context.SSO = window.SSO;
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../overlays/templates/time.js'), 'utf8'), context);
    const def = window.SSO.get('countdown');
    return { data, advance(ms) { now += ms; }, now() { return now; },
        render(query = '', preview = false) {
            const cfg = window.SSO.readConfig(def, '?font=&' + query);
            def.render({ appendChild() {} }, cfg, { preview });
        }
    };
}

test('A relative countdown preview cannot move an existing remembered deadline', () => {
    const f = fixture(); f.render('remember=1');
    const saved = [...f.data]; f.advance(60000);
    f.render('remember=1', true);
    assert.deepEqual([...f.data], saved);
    f.advance(60000); f.render('remember=1');
    assert.equal(f.data.get('sso:countdown:5:Starting in:end'), saved[0][1]);
});

test('A relative preview does not seed storage before the real viewer starts', () => {
    const f = fixture(); f.render('remember=1', true);
    assert.equal(f.data.size, 0);
    f.advance(60000); f.render('remember=1');
    assert.equal(Number(f.data.get('sso:countdown:5:Starting in:end')), f.now() + 300000);
});

test('A fixed-target preview cannot change the persisted start or end', () => {
    const f = fixture(); const query = 'remember=1&target=2026-01-01T15%3A00%3A00Z';
    f.render(query); const saved = [...f.data]; f.advance(60000);
    f.render(query, true); assert.deepEqual([...f.data], saved);
});

test('A fixed-target preview does not seed remembered state', () => {
    const f = fixture(); f.render('remember=1&target=2026-01-01T15%3A00%3A00Z', true);
    assert.equal(f.data.size, 0);
});

test('Normal remembered reload retains its original deadline', () => {
    const f = fixture(); f.render('remember=1'); const saved = [...f.data];
    f.advance(60000); f.render('remember=1'); assert.deepEqual([...f.data], saved);
});

test('Non-remembered viewers and previews do not write storage', () => {
    const f = fixture(); f.render('remember=0'); f.render('remember=0', true);
    assert.equal(f.data.size, 0);
});

