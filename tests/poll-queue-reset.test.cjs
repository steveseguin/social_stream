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


for (const action of ['resetpoll', 'startpoll']) {
 test(action + ' drops pre-reset queued hashtag and accepts same voter again', () => {
  const f = fixture();
  f.input('#old', {userid:'same'}); f.advance(25);
  f.run('processInput({action:"' + action + '"})');
  assert.equal(f.state().totalVotes, 0);
  f.input('#new', {userid:'same'}); f.advance(25);
  assert.deepEqual(f.state(), {results:{new:1}, totalVotes:1});
 });
}
test('core question/options change discards old numeric vote', () => {
 const f = fixture('?pollType=multiple&pollEnabled=true&pollOptions=apple,banana');
 f.input('1', {userid:'same'}); f.advance(25);
 f.run('processInput({settings:{pollQuestion:"New question",multipleChoiceOptions:"red,blue"}})');
 assert.equal(f.state().totalVotes,0);
 f.input('2',{userid:'same'}); f.advance(25);
 assert.deepEqual(f.state(),{results:{blue:1},totalVotes:1});
});
test('closed poll message queued before start is discarded', () => {
 const f=fixture(); f.run('processInput({action:"closepoll"})');
 f.input('#closed'); f.advance(25); f.run('processInput({action:"startpoll"})');
 f.advance(25); assert.deepEqual(f.state(),{results:{},totalVotes:0});
});
test('control: queue drained before reset leaves new poll clean',()=>{
 const f=fixture(); f.input('#old',{userid:'same'}); f.advance(50);
 f.run('processInput({action:"resetpoll"})'); f.input('#new',{userid:'same'}); f.advance(250);
 assert.deepEqual(f.state(),{results:{new:1},totalVotes:1});
});
test('control: reset before new vote starts clean',()=>{
 const f=fixture(); f.run('processInput({action:"resetpoll"})'); f.input('#new'); f.advance(50);
 assert.deepEqual(f.state(),{results:{new:1},totalVotes:1});
});
for (const cmd of ['resetpoll','startpoll']) {
 test(cmd+' through processData cmd transport also drops old queue',()=>{
  const f=fixture(); f.input('#old'); f.advance(25);
  f.run('processData({cmd:"'+cmd+'"}, "p2p")'); f.advance(25);
  assert.deepEqual(f.state(),{results:{},totalVotes:0});
 });
}
test('UI-only settings preserve queued votes (intended control)',()=>{
 const f=fixture(); f.input('#old'); f.advance(25);
 f.run('processInput({settings:{pollTally:true}})'); f.advance(25);
 assert.deepEqual(f.state(),{results:{old:1},totalVotes:1});
});

test('empty pending drain finishes and a later vote starts a fresh batch', () => {
    const f = fixture();
    f.input('#old');
    f.advance(25);
    f.run('processInput({action:"resetpoll"})');
    f.advance(25);
    assert.equal(f.run('processingQueue'), false);
    assert.equal(f.state().totalVotes, 0);
    f.input('#new');
    f.advance(50);
    assert.deepEqual(f.state(), { results: { new: 1 }, totalVotes: 1 });
});

test('repeated resets keep only the newest round and its voter eligibility', () => {
    const f = fixture();
    f.input('#first', { userid: 'same' });
    f.advance(10);
    f.run('processInput({action:"resetpoll"})');
    f.input('#second', { userid: 'same' });
    f.advance(10);
    f.run('processInput({action:"startpoll"})');
    f.input('#third', { userid: 'same' });
    f.advance(30);
    assert.deepEqual(f.state(), { results: { third: 1 }, totalVotes: 1 });
    assert.equal(f.run('processingQueue'), false);
});

test('yes/no reset accepts the new answer from the same voter', () => {
    const f = fixture('?pollType=yesno&pollEnabled=true');
    f.input('1', { userid: 'same' });
    f.advance(25);
    f.run('processInput({action:"resetpoll"})');
    f.input('2', { userid: 'same' });
    f.advance(25);
    assert.deepEqual(f.state(), { results: { No: 1 }, totalVotes: 1 });
});

test('unchanged core settings do not discard queued votes', () => {
    const f = fixture();
    f.input('#current');
    f.advance(25);
    f.run('processInput({settings:{pollType:"freeform"}})');
    f.advance(25);
    assert.deepEqual(f.state(), { results: { current: 1 }, totalVotes: 1 });
});

