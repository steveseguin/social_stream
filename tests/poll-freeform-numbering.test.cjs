'use strict';

// Offline production-code fixture. DOM, transport, currency and clock boundaries
// are stubbed; poll input, batching, matching, tallying and rendering are real.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.POLL_SOURCE || path.join(__dirname, '..', 'poll.html'), 'utf8');
const start = source.indexOf('const urlParams =');
const end = source.indexOf('// Memory optimization - create connection manager');
assert.ok(start >= 0 && end > start, 'poll core extraction anchors exist');

function element() {
    return {
        children: [], style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
        appendChild(child) { this.children.push(child); return child; },
        set innerHTML(value) { this.html = value; this.children = []; },
        get innerHTML() { return this.html || ''; }
    };
}

function fixture(query = '?pollType=freeform&pollEnabled=true') {
    const elements = Object.fromEntries(['poll-container', 'poll-title', 'poll-options'].map(id => [id, element()]));
    let now = 1000;
    let nextUser = 0;
    const timers = [];
    class Clock extends Date { static now() { return now; } }
    const context = vm.createContext({
        window: { location: { search: query } }, URLSearchParams, console, Date: Clock,
        setTimeout(callback, delay = 0) { timers.push({ callback, due: now + delay }); },
        document: { body: element(), documentElement: element(), getElementById(id) { return elements[id]; }, createElement: element, createDocumentFragment: element },
        SocialStreamTransportDedupe: { create() { return () => false; } },
        SSNOverlayControl: { createStateTracker() { return () => null; }, accept() { return true; } },
        getDonationValueUSD(data) { return typeof data.donoValue === 'number' ? data.donoValue : 0; }
    });
    vm.runInContext(source.slice(start, end), context, { filename: 'poll.html' });
    function run(code) { return vm.runInContext(code, context); }
    run('initializePoll()');
    return {
        run,
        input(text, options = {}) {
            context.input = { chatmessage: text, chatname: 'user' + (++nextUser), type: 'youtube', ...options };
            run('processInput(input, "api")');
        },
        advance(ms) {
            const until = now + ms;
            for (;;) {
                timers.sort((a, b) => a.due - b.due);
                if (!timers.length || timers[0].due > until) break;
                const timer = timers.shift(); now = timer.due; timer.callback();
            }
            now = until;
        },
        state() { return JSON.parse(run('JSON.stringify({results,totalVotes})')); },
        rows() {
            const fragment = elements['poll-options'].children[0];
            return fragment ? fragment.children.filter(row => row.className === 'poll-option').map(row => ({
                number: Number((row.innerHTML.match(/option-number">(\d+)/) || [])[1]),
                option: row.innerHTML.match(/option-text">([^<]+)/)[1]
            })) : [];
        }
    };
}

function ranked() {
    const f = fixture();
    f.input('#apple'); f.input('#banana'); f.input('#banana'); f.advance(50);
    assert.deepEqual(f.rows(), [{ number: 1, option: 'banana' }, { number: 2, option: 'apple' }]);
    return f;
}

test('freeform number 1 votes for the displayed leader, not the first inserted option', () => {
    const f = ranked(); f.input('1'); f.advance(50);
    assert.deepEqual(f.state(), { results: { apple: 1, banana: 3 }, totalVotes: 4 });
});

test('freeform number 2 votes for the displayed runner-up', () => {
    const f = ranked(); f.input('2'); f.advance(50);
    assert.deepEqual(f.state(), { results: { apple: 2, banana: 2 }, totalVotes: 4 });
});

test('ties use the same order in rendering and numeric matching', () => {
    const f = fixture(); f.input('#pear'); f.input('#apple'); f.advance(50);
    assert.deepEqual(f.rows(), [{ number: 1, option: 'pear' }, { number: 2, option: 'apple' }]);
    f.input('2'); f.advance(50);
    assert.deepEqual(f.state().results, { pear: 1, apple: 2 });
});

test('a hashtag overtaking the leader inside one batch does not change visible number meaning', () => {
    const f = ranked();
    f.input('#apple'); f.input('#apple'); f.input('1'); f.advance(50);
    assert.deepEqual(f.state().results, { apple: 3, banana: 3 });
    assert.equal(f.rows()[0].option, 'banana');
});

test('numeric mapping follows the rendered order across the UI throttle', () => {
    const f = ranked();
    f.input('#apple'); f.input('#apple'); f.input('#apple'); f.advance(50);
    assert.equal(f.rows()[0].option, 'banana');
    f.input('1'); f.advance(50);
    assert.deepEqual(f.state().results, { apple: 4, banana: 3 });
    assert.equal(f.rows()[0].option, 'banana');
    f.advance(150);
    assert.equal(f.rows()[0].option, 'apple');
    f.input('1'); f.advance(50);
    assert.deepEqual(f.state().results, { apple: 5, banana: 3 });
});

test('a newly collected but not yet rendered option has no visible numeric vote target', () => {
    const f = fixture(); f.input('#apple'); f.input('1'); f.advance(50);
    assert.deepEqual(f.state(), { results: { apple: 1 }, totalVotes: 1 });
});

test('the displayed top ten can select a later-inserted leading option', () => {
    const f = fixture();
    for (let i = 1; i <= 11; i++) f.input('#choice' + i);
    f.input('#choice11'); f.advance(50);
    assert.equal(f.rows().length, 10); assert.equal(f.rows()[0].option, 'choice11');
    f.input('1'); f.advance(50);
    assert.equal(f.state().results.choice11, 3);
});

test('numbers outside the displayed top ten are ignored', () => {
    const f = fixture();
    for (let i = 1; i <= 11; i++) f.input('#choice' + i);
    f.advance(50); f.input('11'); f.input('0'); f.input('12'); f.advance(50);
    assert.equal(f.state().totalVotes, 11);
});

test('numeric-looking hashtags use their rendered rank, not object key order', () => {
    const f = fixture(); f.input('#20'); f.input('#3'); f.input('#20'); f.advance(50);
    assert.equal(f.rows()[0].option, '20'); f.input('1'); f.advance(50);
    assert.deepEqual(f.state().results, { 3: 1, 20: 3 });
});

test('weighted numeric votes use the visible option', () => {
    const f = fixture('?pollType=freeform&pollEnabled=true&pollDonationWeighted');
    f.input('#apple'); f.input('#banana', { hasDonation: '$5', donoValue: 5 }); f.advance(50);
    f.input('1', { hasDonation: '$3', donoValue: 3 }); f.advance(50);
    assert.deepEqual(f.state().results, { apple: 1, banana: 8 });
});

test('duplicate voters remain suppressed after numeric selection', () => {
    const f = ranked(); f.input('1', { userid: 'repeat' }); f.input('2', { userid: 'repeat' }); f.advance(50);
    assert.deepEqual(f.state().results, { apple: 1, banana: 3 });
});

for (const action of ['resetpoll', 'startpoll']) {
    test(action + ' clears the old visible numeric targets', () => {
        const f = ranked(); f.run('processInput({action: "' + action + '"})');
        f.input('1'); f.advance(50);
        assert.deepEqual(f.state(), { results: {}, totalVotes: 0 });
        f.input('#new'); f.advance(200); f.input('1'); f.advance(50);
        assert.deepEqual(f.state().results, { new: 2 });
    });
}

test('switching poll type clears freeform targets and preserves multiple choice numbers', () => {
    const f = ranked();
    f.run('processData({settings:{pollType:"multiple",multipleChoiceOptions:"red,blue"}})');
    f.input('2'); f.advance(50); assert.deepEqual(f.state().results, { blue: 1 });
    f.run('processData({settings:{pollType:"freeform"}})');
    f.input('1'); f.advance(50); assert.equal(f.state().totalVotes, 0);
});

test('closed polls reject numeric votes', () => {
    const f = ranked(); f.run('processInput({action:"closepoll"})'); f.input('1'); f.advance(50);
    assert.equal(f.state().totalVotes, 3);
});

test('yes/no numeric aliases are unchanged', () => {
    const f = fixture('?pollType=yesno&pollEnabled=true');
    f.input('1'); f.input('2'); f.input('0'); f.advance(50);
    assert.deepEqual(f.state(), { results: { Yes: 1, No: 2 }, totalVotes: 3 });
});

