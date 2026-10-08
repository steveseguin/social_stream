const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'recover.js'), 'utf8');
const dockControl = '<input data-param1="color">';
const featuredControl = '<input data-param2="fade">';
const validHtml = dockControl + featuredControl;

function createPage(responses) {
    function element() {
        return {
            value: '', textContent: '', disabled: false, hidden: true, handlers: {},
            addEventListener(name, handler) { this.handlers[name] = handler; },
            appendChild() {}, querySelectorAll() { return []; }
        };
    }
    const elements = Object.create(null);
    const document = {
        getElementById(id) { return elements[id] || (elements[id] = element()); },
        createElement(tag) {
            const node = element();
            if (tag === 'template') {
                // Deliberately tiny inert DOM fixture: only parse this suite's input tags.
                Object.defineProperty(node, 'innerHTML', { set(html) {
                    const controls = Array.from(html.matchAll(/<input data-(param[12])="([^"]+)">/g), match => ({
                        attributes: [{ name: 'data-' + match[1], value: match[2] }],
                        getAttribute() { return null; }
                    }));
                    node.content = {
                        querySelectorAll(selector) { return selector === 'input, textarea, select' ? controls : []; },
                        getElementById() { return null; }
                    };
                } });
            }
            return node;
        }
    };
    let fetches = 0;
    vm.runInNewContext(source, {
        document, window: {}, URL, URLSearchParams, Set,
        fetch: async url => {
            assert.equal(url, 'popup.html');
            const html = responses[fetches++];
            assert.notEqual(html, undefined, 'unexpected extra fetch');
            return { ok: true, text: async () => html };
        }
    });
    elements.recoveryUrls.value = 'dock.html?session=RecoveryDemo&color\nfeatured.html?session=RecoveryDemo&fade';
    elements.queryPage.value = 'dock.html';
    return { elements, build: () => elements.generateBtn.handlers.click(), fetches: () => fetches };
}

function assertBlocked(page) {
    const e = page.elements;
    assert.match(e.error.textContent, /settings controls could not be read/);
    assert.equal(e.output.value, '');
    assert.equal(e.result.hidden, true);
    assert.equal(e.downloadBtn.disabled, true);
    assert.equal(e.copyBtn.disabled, true);
    assert.equal(e.generateBtn.disabled, false);
}

function assertReady(page) {
    const e = page.elements;
    assert.equal(e.error.textContent, '');
    assert.equal(e.result.hidden, false);
    assert.equal(e.downloadBtn.disabled, false);
    assert.equal(e.copyBtn.disabled, false);
    assert.equal(e.generateBtn.disabled, false);
    assert.deepEqual(JSON.parse(e.output.value).settings, {
        featuredOverlayStyle: { optionsetting: '' },
        color: { param1: true }, fade: { param2: true }
    });
}

for (const [name, invalidHtml] of [
    ['error HTML with HTTP 200', '<html>Temporary error page</html>'],
    ['missing featured controls', dockControl],
    ['missing dock controls', featuredControl]
]) {
    test('Recovery rejects repeated ' + name + ' and retries a fresh schema', async () => {
        const page = createPage([invalidHtml, invalidHtml, validHtml]);
        await page.build();
        assertBlocked(page);
        await page.build();
        assertBlocked(page);
        assert.equal(page.fetches(), 2);
        await page.build();
        assertReady(page);
        assert.equal(page.fetches(), 3);
        await page.build();
        assertReady(page);
        assert.equal(page.fetches(), 3, 'successful retry should cache only the validated schema');
    });
}

test('Recovery reuses a valid schema across repeated builds', async () => {
    const page = createPage([validHtml]);
    await page.build();
    assertReady(page);
    await page.build();
    assertReady(page);
    assert.equal(page.fetches(), 1);
});
