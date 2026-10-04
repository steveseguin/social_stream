const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../actions/EventFlowSystem.js'), 'utf8');
const flush = async () => { for (let i = 0; i < 150; i++) await Promise.resolve(); };
function fixture(nodes, edges) {
    const timers = new Map(), calls = [], warnings = [];
    let timerId = 0, now = 10000;
    const context = vm.createContext({ window: { location: { search: '' } },
        console: { log() {}, error() {}, warn(...args) { warnings.push(args); } },
        setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
        clearTimeout(id) { timers.delete(id); }, setInterval() {}, clearInterval() {},
        Date: { now: () => now }, indexedDB: { open: () => ({}) } });
    vm.runInContext(source + '\nglobalThis.Engine = EventFlowSystem;', context);
    const system = new context.Engine({ allowEvalCustomJs: true });
    const original = system.executeAction;
    system.executeAction = async function(node, ...args) {
        calls.push(node.id);
        return original.call(this, node, ...args);
    };
    const flow = { id: 'fixture', active: true, nodes, connections: edges.map(([from, to]) => ({ from, to })) };
    system.flows = [flow];
    return { system, flow, calls, timers, warnings,
        async tick() { const item = timers.entries().next().value; assert.ok(item, 'Expected timer'); timers.delete(item[0]); item[1](); await flush(); },
        advance(ms) { now += ms; },
        run(message = { chatname: 'Fixture', chatmessage: 'hello', textonly: true }) { return system.evaluateFlow(flow, message); }
    };
}
const trigger = (id = 't', active = true) => ({ id, type: 'trigger', triggerType: active ? 'anyMessage' : 'messageEquals', config: active ? {} : { text: 'never' } });
const action = (id, actionType = 'addSuffix', config = { suffix: ` ${id}` }) => ({ id, type: 'action', actionType, config });
const logic = (id = 'g', logicType = 'AND') => ({ id, type: 'logic', logicType, config: {} });
const state = (id, stateType, config) => ({ id, type: 'state', stateType, config });

test('action output reaches logic and subsequent actions', async () => {
    const f = fixture([trigger(), action('a'), logic(), action('z')], [['t','a'],['a','g'],['g','z']]);
    assert.equal((await f.run()).message.chatmessage, 'hello a z');
    assert.deepEqual(f.calls, ['a','z']);
});

test('rate limiter after an action runs once per message and gates its output', async () => {
    const f = fixture([trigger(), action('a'), state('g','THROTTLE',{ messagesPerSecond: 1 }), action('z')], [['t','a'],['a','g'],['g','z']]);
    assert.equal((await f.run()).message.chatmessage, 'hello a z');
    assert.equal((await f.run()).message.chatmessage, 'hello a');
    f.advance(1001);
    assert.equal((await f.run()).message.chatmessage, 'hello a z');
});

test('AND join waits for both action outputs and increments a counter only once', async () => {
    const f = fixture([trigger(), action('a'), action('b'), logic(), state('counter','COUNTER',{ targetCount: 2, resetOnTarget: false }), action('z')],
        [['t','a'],['t','b'],['a','g'],['b','g'],['g','counter'],['counter','z']]);
    assert.equal((await f.run()).message.chatmessage, 'hello a b');
    assert.equal(f.system.nodeStates.get('counter').count, 1);
    assert.equal((await f.run()).message.chatmessage, 'hello a z');
    assert.equal(f.system.nodeStates.get('counter').count, 2);
});

for (const [operator, expected] of [['AND', false], ['OR', true]]) {
    test(`${operator} join receives false from an action whose trigger is inactive`, async () => {
        const f = fixture([trigger(), trigger('off',false), action('a'), action('b'), logic('g',operator), action('z')],
            [['t','a'],['off','b'],['a','g'],['b','g'],['g','z']]);
        await f.run();
        assert.equal(f.calls.includes('b'), false);
        assert.equal(f.calls.includes('z'), expected);
    });
}

test('NOT receives a false action output, without executing the inactive action', async () => {
    const f = fixture([trigger('off',false), action('a'), logic('g','NOT'), action('z')], [['off','a'],['a','g'],['g','z']]);
    await f.run();
    assert.deepEqual(f.calls,['z']);
});

test('logic reads the message produced by its upstream action', async () => {
    const f = fixture([trigger(), action('a','setProperty',{property:'containsBadWords',value:true}), logic('g','CHECK_BAD_WORDS'), action('z')], [['t','a'],['a','g'],['g','z']]);
    await f.run();
    assert.deepEqual(f.calls,['a','z']);
});

for (const fork of ['continueAsync','returnMessage','blockMessage']) {
    test(`${fork} defers its logic/state/action descendants`, async () => {
        const f = fixture([trigger(), action('fork',fork,{}), logic(), state('s','THROTTLE',{messagesPerSecond:1}), action('z')],
            [['t','fork'],['fork','g'],['g','s'],['s','z']]);
        const result = await f.run();
        assert.deepEqual(f.calls,['fork']);
        assert.equal(result.message.chatmessage,'hello');
        assert.equal(result.blocked, fork === 'blockMessage');
        if (fork === 'returnMessage') assert.equal(result.returnNow,true);
        await f.tick();
        assert.deepEqual(f.calls,['fork','z']);
        assert.equal(result.message.chatmessage,'hello','Background mutations do not change the returned message');
    });
}

test('two asynchronous branches resolve their shared join exactly once', async () => {
    const f = fixture([trigger(), action('a','continueAsync',{}), action('b','continueAsync',{}), logic(), action('z')],
        [['t','a'],['t','b'],['a','g'],['b','g'],['g','z']]);
    await f.run();
    await f.tick();
    assert.deepEqual(f.calls,['a','b']);
    await f.tick();
    assert.deepEqual(f.calls,['a','b','z']);
});

test('an action reached by both live and deferred branches executes at most once', async () => {
    const f = fixture([trigger(), action('a','continueAsync',{}), action('b'), logic(), action('z')],
        [['t','a'],['t','b'],['a','g'],['g','z'],['b','z']]);
    await f.run();
    assert.deepEqual(f.calls,['a','b','z']);
    await f.tick();
    assert.deepEqual(f.calls,['a','b','z']);
});

test('nested async continuations remain in the existing background branch', async () => {
    const f = fixture([trigger(), action('a','continueAsync',{}), logic(), action('b','continueAsync',{}), logic('g2'), action('z')],
        [['t','a'],['a','g'],['g','b'],['b','g2'],['g2','z']]);
    await f.run(); await f.tick();
    assert.deepEqual(f.calls,['a','b','z']);
    assert.equal(f.timers.size,0);
});

test('delay finishes before emitting into a state node, and cancellation prevents output', async () => {
    for (const cancel of [false,true]) {
        const f = fixture([trigger(), action('a','delay',{delayMs:1000}), state('s','THROTTLE',{messagesPerSecond:1}), action('z')], [['t','a'],['a','s'],['s','z']]);
        const pending = f.run(); await flush();
        assert.deepEqual(f.calls,['a']);
        if (cancel) f.system.cancelFlowExecutions(f.flow.id); else await f.tick();
        await pending;
        assert.equal(f.calls.includes('z'),!cancel);
        assert.equal(f.timers.size,0);
    }
});

test('disabling a flow prevents a deferred branch from restarting it', async () => {
    const f = fixture([trigger(), action('a','continueAsync',{}), logic(), action('z')], [['t','a'],['a','g'],['g','z']]);
    await f.run(); f.flow.active=false; await f.tick();
    assert.deepEqual(f.calls,['a']);
});

test('stopChain publishes no signal that a NOT gate could invert', async () => {
    const f = fixture([trigger(), action('a','customJs',{code:'return { stopChain: true };'}), logic('g','NOT'), action('z')], [['t','a'],['a','g'],['g','z']]);
    await f.run(); assert.deepEqual(f.calls,['a']);
});

test('resuming a queue traverses downstream action/gates without replaying triggers', async () => {
    const q=state('queue','QUEUE',{autoDequeue:true,processingDelayMs:10,maxSize:10});
    const f=fixture([trigger(),q,action('a'),logic(),action('z'),trigger('other'),action('unrelated')],
        [['t','queue'],['queue','a'],['a','g'],['g','z'],['other','unrelated']]);
    f.system.evaluateTrigger=()=>assert.fail('Queue resume must not rerun triggers');
    const result=await f.system.evaluateFlow(f.flow,{chatname:'Fixture',chatmessage:'queued',textonly:true},'queue');
    assert.equal(result.message.chatmessage,'queued a z');
    assert.deepEqual(f.calls,['a','z']);
});

test('a cycle cannot execute the same action twice', async () => {
    const f=fixture([trigger(),action('a'),logic(),action('z')],[['t','a'],['a','g'],['g','a'],['g','z']]);
    await f.run(); assert.deepEqual(f.calls,['a','z']);
});

test('control actions can initialize downstream state resources on the first event', async () => {
    const gate = fixture([trigger(), action('set','setGateState',{targetNodeId:'g',state:'ALLOW'}), state('g','GATE',{defaultState:'BLOCK'}),action('z')],
        [['t','set'],['set','g'],['g','z']]);
    await gate.run();
    assert.deepEqual(gate.calls,['set','z']);
    const counter = fixture([trigger(), action('set','setCounter',{targetNodeId:'c',value:4}), state('c','COUNTER',{initialCount:0,targetCount:5,resetOnTarget:false}),action('z')],
        [['t','set'],['set','c'],['c','z']]);
    await counter.run();
    assert.deepEqual(counter.calls,['set','z']);
    assert.equal(counter.system.nodeStates.get('c').count,5,'Resource initialization must not increment the counter');
});

test('state-generated payload fields survive processMessage with and without an upstream action', async () => {
    for (const hasAction of [false,true]) {
        const nodes=[trigger(),state('c','COUNTER',{targetCount:1,resetOnTarget:false})];
        const edges=hasAction?[['t','a'],['a','c']]:[['t','c']];
        if(hasAction) nodes.splice(1,0,action('a','customJs',{code:'return {};'}));
        const f=fixture(nodes,edges);
        const result=await f.system.processMessage({chatname:'Fixture',chatmessage:'hello',textonly:true});
        assert.equal(result.counterValue,1);
        assert.equal(result.counterTriggered,true);
    }
});

for (const reverse of [false,true]) {
    test(`async join uses the first input payload regardless of completion order (${reverse})`, async () => {
        const f=fixture([trigger(), action('fork1','continueAsync',{}),action('fork2','continueAsync',{}),
            action('flag','setProperty',{property:'containsBadWords',value:true}),action('suffix'),logic('g','CHECK_BAD_WORDS'),action('z')],
            [['t','fork1'],['t','fork2'],['fork1','flag'],['fork2','suffix'],['flag','g'],['suffix','g'],['g','z']]);
        await f.run();
        if(reverse) { const entries=[...f.timers.entries()].reverse(); f.timers.clear(); entries.forEach(([id,fn])=>f.timers.set(id,fn)); }
        await f.tick(); await f.tick();
        assert.equal(f.calls.filter(id=>id==='z').length,1);
    });
}

test('nested background block retains its terminal behavior', async () => {
    const f=fixture([trigger(),action('fork','continueAsync',{}),action('stop','blockMessage',{}),logic(),action('z')],
        [['t','fork'],['fork','stop'],['stop','g'],['g','z']]);
    await f.run(); await f.tick();
    assert.deepEqual(f.calls,['fork','stop']);
    assert.equal(f.timers.size,0);
});

test('nested Continue Async preserves action-only sibling order', async () => {
    const f=fixture([trigger(),action('fork','continueAsync',{}),action('nested','continueAsync',{}),action('z'),action('sibling')],
        [['t','fork'],['fork','nested'],['nested','z'],['fork','sibling']]);
    await f.run(); await f.tick();
    assert.deepEqual(f.calls,['fork','nested','z','sibling']);
});

test('an inactive first input does not discard the active OR branch payload', async () => {
    const f=fixture([trigger('off',false),trigger(),action('inactive'),action('flag','setProperty',{property:'containsBadWords',value:true}),
        logic('join','OR'),logic('check','CHECK_BAD_WORDS'),action('z')],
        [['off','inactive'],['t','flag'],['inactive','join'],['flag','join'],['join','check'],['check','z']]);
    await f.run();
    assert.deepEqual(f.calls,['flag','z']);
});

test('an inactive join cannot undo an unrelated branch edit', async () => {
    const f=fixture([trigger(),trigger('off',false),action('a'),action('c'),action('b'),logic()],
        [['off','a'],['t','c'],['off','b'],['a','g'],['b','g']]);
    const result=await f.run();
    assert.deepEqual(f.calls,['c']);
    assert.equal(result.message.chatmessage,'hello c');
});

test('a false join carries its local payload through a NOT descendant', async () => {
    const f=fixture([trigger(),trigger('off',false),action('a'),action('c'),action('b'),logic(),logic('invert','NOT'),action('z')],
        [['off','a'],['t','c'],['off','b'],['a','g'],['b','g'],['g','invert'],['invert','z']]);
    const result=await f.run();
    assert.deepEqual(f.calls,['c','z']);
    assert.equal(result.message.chatmessage,'hello z');
});

test('selecting a join payload alone is not a message edit', async () => {
    for(const logicType of ['AND','CHECK_BAD_WORDS']) {
        const f=fixture([trigger(),action('a','customJs',{code:'return {};'}),action('b'),logic('g',logicType)],
            [['t','a'],['t','b'],['a','g'],['b','g']]);
        assert.equal((await f.run()).message.chatmessage,'hello b');
    }
});
