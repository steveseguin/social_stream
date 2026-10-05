const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Inert DOM: no markup parsing, network, or event execution. CSS acceptance is
// a controllable boundary stub, not a substitute for browser parser testing.
function fixture(accept = () => true) {
    const elements = [];
    const document = { head: { appendChild() {} }, getElementById() { return null; },
        createElement() {
            let color = '';
            const style = { set color(value) { color = accept(value) ? value : ''; }, get color() { return color; } };
            const element = { style, appendChild() {}, querySelector() { return null; }, innerHTML: '' };
            elements.push(element); return element;
        }
    };
    const window = { addEventListener() {}, removeEventListener() {}, location: { search: '' } };
    const context = vm.createContext({ window, document, URLSearchParams });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../overlays/core.js'), 'utf8'), context);
    context.SSO = window.SSO;
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../overlays/templates/countries.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../overlays/templates/engines.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../overlays/templates/socials.js'), 'utf8'), context);
    return { SSO: window.SSO, elements };
}

test('URL colour values cannot inject an inert element into banner HTML', () => {
    const f = fixture(); const def = f.SSO.get('banner');
    const marker = 'red"><span data-overlay-injected="yes"></span><div style="';
    const config = f.SSO.readConfig(def, '?font=&messages=&socialsin=off&bg=' + encodeURIComponent(marker));
    def.render({ appendChild() {} }, config);
    assert.ok(f.elements.some(element => element.innerHTML.includes('bn-bg')));
    assert.ok(f.elements.every(element => !element.innerHTML.includes('data-overlay-injected')));
});

test('Markup delimiters are rejected even when a CSS boundary stub accepts them', () => {
    const { SSO } = fixture();
    for (const value of ['red" data-marker="yes', "red' data-marker='yes", '<span>', 'red>']) {
        assert.equal(SSO.color(value), 'transparent');
        assert.equal(SSO.rgba(value, 0.5), 'rgba(0,0,0,0.5)');
    }
});

test('A CSS parser rejection uses the requested fallback', () => {
    const { SSO } = fixture(() => false);
    assert.equal(SSO.color('red;position:fixed'), 'transparent');
    assert.equal(SSO.color('not-a-color', '#123456'), '#123456');
});

test('Accepted named, functional and variable colors retain their value', () => {
    const { SSO } = fixture();
    for (const value of ['red', 'transparent', 'currentColor', 'rgb(1, 2, 3)', 'rgba(1, 2, 3, 0.5)', 'hsl(120, 50%, 50%)', 'var(--accent, red)', '#1234', '#12345678']) {
        assert.equal(SSO.color(value), value);
    }
    assert.equal(SSO.color('  rebeccapurple  '), 'rebeccapurple');
});

test('Existing hex shorthand, opacity and empty fallback semantics remain', () => {
    const { SSO } = fixture();
    assert.equal(SSO.color('abc'), '#abc');
    assert.equal(SSO.color('aabbcc'), '#aabbcc');
    assert.equal(SSO.color('aabbccdd'), '#aabbccdd');
    assert.equal(SSO.rgba('abc', 0.5), 'rgba(170,187,204,0.5)');
    assert.equal(SSO.color('', '#123456'), '#123456');
});

