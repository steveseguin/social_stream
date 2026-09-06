const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };

for (const outcome of ['response', 'error']) {
    test(`YouTube Lite ignores a late polling ${outcome} after reconnect`, async () => {
        const time = clock();
        const oldRequest = deferred();
        let requests = 0;
        const published = [];
        const errors = [];
        const context = vm.createContext({ window: time, console, URLSearchParams,
            storage: { get(key, fallback) { return fallback; }, set() {} },
            fetch: () => ++requests === 1 ? oldRequest.promise : Promise.resolve({
                ok: true, status: 200,
                json: async () => ({ nextPageToken: 'new-page', items: [{ id: 'new' }] })
            })
        });
        for (const file of ['lite/plugins/basePlugin.js', 'lite/plugins/youtubePlugin.js']) {
            vm.runInContext(read(file).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''), context);
        }
        vm.runInContext('globalThis.Plugin = YoutubePlugin;', context);
        const plugin = new context.Plugin({ messenger: { getSessionId() { return 'fixture'; } } });
        plugin.isTokenValid = () => true;
        plugin.token = { accessToken: 'fixture' };
        plugin.state = 'connected';
        plugin.liveChatId = 'old-chat';
        plugin.transformAndPublish = async item => published.push(item.id);
        plugin.reportError = error => errors.push(error);
        plugin.startListening();
        plugin.stopListening();
        plugin.liveChatId = 'new-chat';
        plugin.startListening();
        await flush();
        assert.deepEqual(published, ['new']);
        assert.equal(time.timers.size, 1);
        if (outcome === 'error') oldRequest.reject(new Error('Old connection failed'));
        else oldRequest.resolve({ ok: true, status: 200,
            json: async () => ({ nextPageToken: 'old-page', items: [{ id: 'old' }] }) });
        await flush();
        assert.deepEqual(errors, [], 'Old failures cannot affect the replacement connection');
        assert.deepEqual(published, ['new'], 'Old responses cannot enter the new chat');
        assert.equal(plugin.nextPageToken, 'new-page');
        assert.equal(time.timers.size, 1, 'Only the replacement polling loop continues');
        plugin.stopListening();
        assert.equal(time.timers.size, 0);
    });
}

test('AI overlay defaults use the active page key even when its name is numeric', () => {
    const context = vm.createContext({});
    vm.runInContext(read('shared/aiPrompt/overlayStore.js'), context);
    const store = context.SSNAiPromptOverlayStore;
    const pack = store.buildPackage({ activeId: 'first', pages: [
        { id: 'first', name: '2', html: '<p>Active page</p>' },
        { id: 'second', name: 'other', html: '<p>Other page</p>' }
    ] });
    assert.equal(pack.activeOverlay, '2');
    assert.equal(store.selectOverlay(pack).pageId, 'first');
    assert.equal(store.selectOverlay({ value: pack }, '').pageId, 'first');
    assert.equal(store.selectOverlay(pack, '2').pageId, 'second', 'Explicit numeric URL selectors remain one-based positions');
    assert.equal(store.selectOverlay(pack, '1').pageId, 'first');
    assert.equal(store.selectOverlay(pack, 'other').pageId, 'second');
    assert.equal(store.selectOverlay(pack, 'missing'), null);
    delete pack.activeOverlay;
    assert.equal(store.selectOverlay(pack).pageId, 'first', 'Default first-page key is also not a position');
});

test('Cancelling the Lite TikTok username prompt leaves Connect usable for another attempt', async () => {
    let prompts = 0;
    let connectorLoads = 0;
    let answer = null;
    const context = vm.createContext({
        console: { error() {}, warn() {} },
        window: { prompt() { prompts++; return answer; } },
        storage: { get(key, fallback) { return fallback; }, set() {}, remove() {} }
    });
    for (const file of ['lite/plugins/basePlugin.js', 'lite/plugins/tiktokPlugin.js']) {
        vm.runInContext(read(file).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''), context);
    }
    vm.runInContext('globalThis.Plugin = TikTokPlugin;', context);
    const plugin = new context.Plugin({ messenger: { getSessionId() { return 'fixture'; } } });
    plugin.connectBtn = {};
    plugin.disconnectBtn = {};
    plugin.ensureConnectorLoaded = async () => { connectorLoads++; };
    for (let attempt = 1; attempt <= 2; attempt++) {
        plugin.handleConnect();
        await flush();
        assert.equal(prompts, attempt);
        assert.equal(plugin.state, 'idle');
        assert.equal(plugin.connectBtn.disabled, false);
        assert.equal(plugin.connectBtn.hidden, false);
        assert.equal(plugin.disconnectBtn.hidden, true);
        assert.equal(connectorLoads, 0);
    }
    answer = '';
    plugin.handleConnect();
    await flush();
    assert.equal(prompts, 3);
    assert.equal(plugin.state, 'error', 'Submitting an empty name still reports validation failure');
    assert.equal(plugin.connectBtn.disabled, false);
    assert.equal(connectorLoads, 0);
});

test('Kick badge collection preserves supported SVG badges through display formatting', () => {
    const context = vm.createContext({});
    const source = read('sources/websocket/kick.js');
    vm.runInContext(read('providers/kick/core.js').replace(/^export /gm, '') + '\n'
        + source.slice(source.indexOf('function collectBadgesFromSources('),
            source.indexOf('function collectNameColorFromSources(')), context);
    const svg = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
    const sender = { identity: { badges: [
        { svg },
        { text: 'Moderator' },
        { image_url: 'https://example.com/badge.png' },
        { svg: '<svg/>', selected: false }
    ] } };
    const collected = context.collectBadgesFromSources(sender, sender);
    assert.equal(collected.length, 3, 'Collection retains selected badges and deduplicates them');
    const displayed = context.formatBadgesForDisplay(collected);
    assert.deepEqual(JSON.parse(JSON.stringify(displayed)), [
        { type: 'svg', html: svg },
        { type: 'text', text: 'Moderator' },
        { src: 'https://example.com/badge.png', type: 'img' }
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(context.mapBadges(collected))),
        JSON.parse(JSON.stringify(collected)), 'Normalizing already collected badges must retain them');
});

function clock() {
    const timers = new Map();
    let id = 0;
    return {
        timers,
        setTimeout(fn) { timers.set(++id, fn); return id; },
        clearTimeout(key) { timers.delete(key); },
        async tick() {
            const entry = timers.entries().next().value;
            assert.ok(entry, 'Expected a pending timer');
            timers.delete(entry[0]);
            entry[1]();
            await flush();
        }
    };
}

function dockMessengerFixture() {
    const time = clock();
    const listeners = {};
    const delivered = [];
    const context = vm.createContext({ window: { ...time, addEventListener() {} },
        console: { error() {}, debug() {}, warn() {} } });
    vm.runInContext(read('lite/utils/dockMessenger.js').replace(/^export /gm, '')
        + '\nglobalThis.Messenger = DockMessenger;', context);
    const frame = {
        hasAttribute() { return true; },
        addEventListener(name, callback) { listeners[name] = callback; },
        removeAttribute() { this.src = ''; },
        contentWindow: { postMessage(payload) { delivered.push(payload.sendData.overlayNinja); } }
    };
    const messenger = new context.Messenger(frame);
    messenger.setSessionId('fixture');
    return { messenger, frame, listeners, delivered, time };
}

test('Lite dock retry waits for its timer instead of exhausting retries during a queue flush', async () => {
    const { messenger, frame, listeners, delivered, time } = dockMessengerFixture();
    let attempts = 0;
    const postMessage = frame.contentWindow.postMessage;
    frame.contentWindow.postMessage = payload => {
        attempts++;
        throw new Error('Temporary relay failure');
    };
    messenger.send({ id: 1 });
    messenger.send({ id: 2 });
    listeners.load();
    assert.equal(attempts, 1, 'Only one attempt before the retry delay');
    assert.equal(messenger.pending.length, 2, 'Failed payload and following messages remain queued');
    assert.equal(time.timers.size, 1);
    messenger.send({ id: 3 });
    assert.equal(attempts, 1, 'New messages wait behind the pending retry');
    frame.contentWindow.postMessage = postMessage;
    await time.tick();
    assert.deepEqual(delivered.map(message => message.id), [1, 2, 3]);
    assert.equal(messenger.pending.length, 0);
    assert.equal(time.timers.size, 0);
});

test('Lite dock retry remains bounded and session changes cancel queued retries', async () => {
    const { messenger, frame, listeners, delivered, time } = dockMessengerFixture();
    let attempts = 0;
    const postMessage = frame.contentWindow.postMessage;
    frame.contentWindow.postMessage = payload => {
        if (payload.sendData.overlayNinja.id === 1) {
            attempts++;
            throw new Error('Unsendable payload');
        }
        postMessage(payload);
    };
    messenger.send({ id: 1 });
    messenger.send({ id: 2 });
    listeners.load();
    for (let i = 0; i < 3; i++) await time.tick();
    assert.equal(attempts, 4);
    assert.deepEqual(delivered.map(message => message.id), [2]);
    assert.equal(time.timers.size, 0);
    messenger.send({ id: 1 });
    assert.equal(time.timers.size, 1);
    messenger.setSessionId('replacement');
    assert.equal(time.timers.size, 0);
    assert.equal(messenger.pending.length, 0);
});

for (const ending of ['network error', 'EOF']) {
    test(`YouTube streaming reconnects after ${ending} and stops retries on stop`, async () => {
        const time = clock();
        let requests = 0;
        const context = vm.createContext({ ...time, console, URLSearchParams, AbortController, TextDecoder });
        vm.runInContext(read('providers/youtube/liveChat.js').replace(/^export /gm, '')
            + '\nglobalThis.factory = createYouTubeLiveChat;', context);
        const client = context.factory({
            mode: 'stream',
            fetchImplementation: async () => {
                requests++;
                if (ending === 'network error') throw new Error('Fixture network failure');
                return { ok: true, status: 200, body: { getReader: () => ({
                    read: async () => ({ done: true }), releaseLock() {}
                }) } };
            }
        });
        await client.start({ chatId: 'fixture', token: 'fixture' });
        await time.tick();
        assert.equal(requests, 2, 'Retry must open a new request');
        assert.notEqual(client.getState().status, 'starting');
        client.stop();
        assert.equal(time.timers.size, 0);
    });
}

function flowSystem() {
    const time = clock();
    const context = vm.createContext({ ...time, console });
    vm.runInContext(read('actions/EventFlowSystem.js') + '\nglobalThis.Flow = EventFlowSystem;', context);
    const system = Object.create(context.Flow.prototype);
    system.flows = [];
    for (const key of ['nodeStates', 'stateTimers', 'messageQueues', 'semaphoreStates',
        'throttleStates', 'userMemoryStates']) system[key] = new Map();
    system.saveFlow = async flow => {
        flow.id = `saved-${system.flows.length}`;
        system.flows.push(flow);
        return flow;
    };
    return { system, time, context };
}

test('Import and duplicate remap nodes, connections and state targets without mutating input', async () => {
    const { system } = flowSystem();
    const original = { id: 'original', name: 'Fixture', active: true, nodes: [
        { id: 'latch', type: 'state', stateType: 'LATCH', config: {} },
        { id: 'reset', type: 'action', config: { targetNodeId: 'latch' } }
    ], connections: [{ from: 'latch', to: 'reset' }] };
    system.flows.push(original);
    system.getFlowById = async id => system.flows.find(flow => flow.id === id);
    const snapshot = JSON.stringify(original);
    const imported = await system.importFlow(original);
    const importedAgain = await system.importFlow(snapshot);
    const duplicate = await system.duplicateFlow(original.id);
    const editorContext = vm.createContext({ console });
    vm.runInContext(read('actions/EventFlowEditor.js') + '\nglobalThis.Editor = EventFlowEditor;', editorContext);
    const editor = Object.create(editorContext.Editor.prototype);
    editor.eventFlowSystem = system;
    system.getAllFlows = async () => system.flows;
    const editorImport = await editor.importSingleFlow(original, true);
    assert.equal(editorImport.name, 'Fixture (1)');
    assert.equal(JSON.stringify(original), snapshot);
    const ids = system.flows.flatMap(flow => flow.nodes.map(node => node.id));
    assert.equal(new Set(ids).size, ids.length);
    for (const flow of [original, imported, importedAgain, duplicate, editorImport]) {
        assert.equal(flow.connections[0].from, flow.nodes[0].id);
        assert.equal(flow.connections[0].to, flow.nodes[1].id);
        assert.equal(flow.nodes[1].config.targetNodeId, flow.nodes[0].id);
        assert.equal((await system.evaluateStateNode(flow.nodes[0], {}, true, flow)).active, true);
        assert.equal((await system.evaluateStateNode(flow.nodes[0], {}, true, flow)).active, false);
    }
});

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

test('Current Twitch EventSub producer delivers both bits fields and thresholds use its emitted payload', async () => {
    const { system, context } = flowSystem();
    const source = read('sources/websocket/twitch.js');
    const helpersStart = source.indexOf('function getEventSubMessageText(');
    const helpersEnd = source.indexOf('function buildPowerUpMeta(', helpersStart);
    const pushStart = source.indexOf('function pushMessage(data)');
    const pushEnd = source.indexOf('chrome.runtime.sendMessage(chrome.runtime.id, { "getSettings"', pushStart);
    assert.ok(helpersStart >= 0 && helpersEnd > helpersStart && pushStart >= 0 && pushEnd > pushStart);
    const delivered = [];
    context.settings = {};
    context.updateStats = () => {};
    context.addEvent = () => {};
    context.formatBitAmount = bits => `${bits} bits`;
    context.getTranslation = (key, fallback) => fallback;
    context.chrome = { runtime: { id: 'fixture', sendMessage: (id, payload) => delivered.push(payload.message) } };
    vm.runInContext(source.slice(pushStart, pushEnd) + source.slice(helpersStart, helpersEnd), context);
    const node = { id: 'fixture', triggerType: 'eventCheer', config: { minBits: 100 } };
    for (const bits of [1, 100]) {
        context.forwardEventSubCheer({ user_id: 'fixture', user_name: 'Fixture', user_login: 'fixture',
            bits, message: { text: 'Fixture cheer' } });
        const payload = delivered[delivered.length - 1];
        assert.equal(payload.event, 'cheer');
        assert.equal(payload.bits, bits);
        assert.equal(payload.meta.bits, bits);
        payload.textonly = true;
        assert.equal(await system.evaluateTrigger(node, payload), bits >= 100);
    }
});

for (const [triggerType, event, field, minimum] of [
    ['eventRaid', 'raid', 'viewers', 'minViewers'], ['eventCheer', 'cheer', 'bits', 'minBits']
]) {
    test(`${triggerType} enforces its minimum for zero, missing, and documented metadata counts`, async () => {
        const { system } = flowSystem();
        const node = { id: 'fixture', triggerType, config: { [minimum]: 100, sources: ['twitch'] } };
        const base = { type: 'twitch', event, chatname: 'Fixture' };
        for (const [count, expected] of [[undefined, false], [0, false], [99, false], [100, true],
            [150, true], ['100', true], ['unknown', false], [Infinity, false]]) {
            assert.equal(await system.evaluateTrigger(node, { ...base, meta: { [field]: count } }), expected,
                `${field}=${count} must respect the minimum`);
        }
        assert.equal(await system.evaluateTrigger(node, { ...base, [field]: 100 }), true, 'Legacy top-level counts remain accepted');
        assert.equal(await system.evaluateTrigger(node, { ...base, [field]: 500, meta: { [field]: 0 } }), false,
            'An explicit canonical zero must not fall back to a legacy value');
        node.config[minimum] = 0;
        assert.equal(await system.evaluateTrigger(node, base), true, 'Zero minimum means any matching event');
        assert.equal(await system.evaluateTrigger(node, { ...base, type: 'kick' }), false, 'Source filters remain enforced');
    });
}

test('Documented boolean events do not crash named-event filters or unrelated actions', async () => {
    const { system } = flowSystem();
    const message = { type: 'twitch', event: true, chatname: 'Fixture', chatmessage: 'Activity', textonly: true };
    for (const triggerType of ['eventNewFollower', 'eventNewSubscriber', 'eventResub', 'eventGiftSub',
        'eventDonation', 'eventRaid', 'eventCheer', 'eventType', 'eventOther', 'eventCustom',
        'obsStreamStarted', 'obsStreamStopped', 'obsRecordingStarted', 'obsRecordingStopped',
        'obsSceneChanged', 'obsMediaEnded', 'obsReplaybufferSaved']) {
        assert.equal(await system.evaluateTrigger({ id: triggerType, triggerType,
            config: { eventType: 'new_follower' } }, { ...message, type: triggerType.startsWith('obs') ? 'obs' : 'twitch' }), false,
            `${triggerType} must not treat a boolean activity marker as a named event`);
    }
    assert.equal(await system.evaluateTrigger({ id: 'paid', triggerType: 'eventDonation', config: {} },
        { ...message, hasDonation: '$5' }), true, 'Donation fields still identify paid rows');
    assert.equal(system.eventTypeMatches('ad_break', 'ADBREAK'), true, 'Existing event aliases remain supported');
    const effects = [];
    system.sendTargetP2P = payload => effects.push(payload);
    const flow = { id: 'fixture', active: true, nodes: [
        { id: 'follow', type: 'trigger', triggerType: 'eventNewFollower', config: {} },
        { id: 'any', type: 'trigger', triggerType: 'anyMessage', config: {} },
        { id: 'action', type: 'action', actionType: 'obsChangeScene', config: { sceneName: 'Fixture' } }
    ], connections: [{ from: 'any', to: 'action' }] };
    system.flows = [flow];
    await system.evaluateFlow(flow, message);
    assert.equal(effects.length, 1);
});

for (const [triggerType, field] of [['userPool', 'resetOnFull'], ['accumulator', 'autoReset']]) {
    test(`${triggerType} auto-reset checkbox updates configuration and resets live state`, async () => {
        const { system, context, time } = flowSystem();
        const panel = { innerHTML: '' }, handlers = {};
        const checkbox = { id: `prop-${field}`, type: 'checkbox', tagName: 'INPUT', checked: false,
            addEventListener(name, callback) { (handlers[name] || (handlers[name] = [])).push(callback); } };
        context.document = {
            getElementById: id => id === 'node-properties-content' ? panel : id === checkbox.id ? checkbox : null,
            querySelectorAll: selector => {
                if (!selector.includes('.property-input')) return [];
                const tag = panel.innerHTML.match(new RegExp('<input\\b[^>]*id="' + checkbox.id + '"[^>]*>'));
                return tag && /class="[^"]*\bproperty-input\b/.test(tag[0]) ? [checkbox] : [];
            }
        };
        vm.runInContext(read('actions/EventFlowEditor.js') + '\nglobalThis.Editor = EventFlowEditor;', context);
        const editor = Object.create(context.Editor.prototype);
        const node = { id: 'fixture', type: 'trigger', triggerType, config: {
            poolName: 'fixture', maxUsers: 1, requireEntry: false, resetOnFull: false,
            accumulatorName: 'fixture', threshold: 1, propertyName: 'donoValue', autoReset: false
        } };
        editor.currentFlow = { nodes: [node] };
        editor.escapeHtml = value => value;
        editor.resolveGuideTarget = () => '#';
        editor.getNodeTitle = () => triggerType;
        editor.triggerTypes = [{ id: triggerType, name: triggerType }];
        editor.markUnsavedChanges = () => {};
        editor.renderNodeOnCanvas = () => {};
        editor.getLocalMediaApi = () => null;
        editor.showNodeProperties(node);
        checkbox.checked = true;
        for (const handler of handlers.change || []) handler({ target: checkbox });
        assert.equal(node.config[field], true, 'Checkbox must save the selected reset policy');
        const message = { type: 'twitch', userid: 'fixture', chatname: 'Fixture', donoValue: 1 };
        assert.equal(await system.evaluateTrigger(node, message), true);
        await time.tick();
        if (triggerType === 'userPool') assert.equal(system.userPools.fixture.users.length, 0);
        else assert.equal(system.accumulators.fixture.value, 0);
        checkbox.checked = false;
        for (const handler of handlers.change) handler({ target: checkbox });
        assert.equal(node.config[field], false);
        assert.equal(await system.evaluateTrigger(node, message), true);
        assert.equal(time.timers.size, 0, 'Disabling reset must leave the state intact');
    });
}

test('Rate Limiter honors fractional messages per second and retains integer-rate behavior', async () => {
    const { system, context } = flowSystem();
    context.fixtureNow = 100000;
    vm.runInContext('Date.now = () => fixtureNow', context);
    for (const rate of [0.1, 0.5, 1, 2]) {
        const node = { id: `rate-${rate}`, type: 'state', stateType: 'THROTTLE', config: { messagesPerSecond: rate } };
        const start = context.fixtureNow;
        const capacity = Math.max(1, rate);
        for (let i = 0; i < capacity; i++) {
            assert.equal((await system.evaluateStateNode(node, {}, true)).active, true);
        }
        assert.equal((await system.evaluateStateNode(node, {}, true)).active, false);
        const interval = rate < 1 ? 1000 / rate : 1000;
        context.fixtureNow = start + interval - 1;
        assert.equal((await system.evaluateStateNode(node, {}, true)).active, false,
            `${rate} messages/sec must not release early`);
        context.fixtureNow = start + interval;
        assert.equal((await system.evaluateStateNode(node, {}, true)).active, true);
        assert.equal((await system.evaluateStateNode(node, {}, false)).active, false);
    }
});

function randomTriggerEditor() {
    const properties = { innerHTML: '' }, handlers = {};
    const checkbox = { id: 'prop-requireMessage', type: 'checkbox', tagName: 'INPUT', checked: true,
        addEventListener(name, handler) { (handlers[name] || (handlers[name] = [])).push(handler); } };
    const context = vm.createContext({ console, document: {
        getElementById: id => id === 'node-properties-content' ? properties : id === checkbox.id ? checkbox : null,
        querySelectorAll: selector => {
            if (!selector.includes('.property-input')) return [];
            const tag = properties.innerHTML.match(/<input\b[^>]*id="prop-requireMessage"[^>]*>/);
            return tag && /class="[^"]*\bproperty-input\b/.test(tag[0]) ? [checkbox] : [];
        }
    } });
    vm.runInContext(read('actions/EventFlowEditor.js') + '\nglobalThis.Editor = EventFlowEditor;', context);
    const editor = Object.create(context.Editor.prototype);
    const node = { id: 'fixture', type: 'trigger', triggerType: 'randomChance', config: { probability: 0, requireMessage: true } };
    editor.currentFlow = { nodes: [node] };
    editor.escapeHtml = value => value;
    editor.resolveGuideTarget = () => '#';
    editor.getNodeTitle = () => 'Random Chance';
    editor.triggerTypes = [{ id: 'randomChance', name: 'Random Chance' }];
    editor.markUnsavedChanges = () => {};
    editor.renderNodeOnCanvas = () => {};
    editor.getLocalMediaApi = () => null;
    editor.showNodeProperties(node);
    return { editor, node, properties, checkbox, handlers };
}

test('Random Chance message requirement checkbox saves both unchecked and checked states', () => {
    const { node, checkbox, handlers } = randomTriggerEditor();
    for (const checked of [false, true]) {
        checkbox.checked = checked;
        for (const handler of handlers.change || []) handler({ target: checkbox });
        assert.equal(node.config.requireMessage, checked);
    }
});

test('Random Chance editor displays zero consistently in its description and both probability inputs', () => {
    const { editor, node, properties } = randomTriggerEditor();
    assert.equal(editor.getNodeDescription(node), '0% chance');
    assert.match(properties.innerHTML, /id="prop-probability-slider"[^>]*value="0"/);
    assert.match(properties.innerHTML, /id="prop-probability"[^>]*value="0"/);
});

test('YouTube API Super Chat emits one paid row, with normal chat and backlog behavior preserved', async () => {
    const source = read('sources/websocket/youtube.html');
    const handlerStart = source.indexOf('async function processLiveChatResponseData(');
    const handlerEnd = source.indexOf('function normalizeYouTubeSignInTargetValue(', handlerStart);
    const paidStart = source.indexOf('function processSuperChat(');
    const paidEnd = source.indexOf('function processYouTubeGift(', paidStart);
    assert.ok(handlerStart >= 0 && handlerEnd > handlerStart && paidStart >= 0 && paidEnd > paidStart);
    const queued = [], sent = [];
    const context = vm.createContext({ console, Date,
        youtubeRecommendedInterval: 5000, lastSuccessfulPollTime: 0, currentStream: null, videoId: null,
        initialBacklogProcessing: false, initialBacklogTimestamp: 0, lastMessageTime: null, nextPageToken: null,
        LIVE_CHAT_MAX_RESULTS: 200, consecutiveMaxMessages: 0, consecutiveEmptyPolls: 0, quickPollCount: 0,
        slowerPollingMode: false, isPageVisible: false, youtubeShorts: false, settings: {},
        normalizeLiveChatMessageItem: item => item, extractYouTubeGiftMetadata: () => null,
        queueMessage: row => queued.push(row), pushMessage: row => sent.push(row),
        applySourceIdentity: row => row, preserveKnownModerator: row => row,
        getTranslation: (key, fallback) => fallback, addEvent() {}
    });
    vm.runInContext(source.slice(handlerStart, handlerEnd) + source.slice(paidStart, paidEnd), context);
    const paid = { id: 'fixture-paid', authorDetails: { displayName: 'Fixture', channelId: 'fixture-user' },
        snippet: { type: 'superChatEvent', publishedAt: '2026-09-05T12:00:00Z', displayMessage: 'Thanks!',
            superChatDetails: { amountDisplayString: '$5.00', userComment: 'Thanks!', tier: 1 } } };
    await context.processLiveChatResponseData({ items: [paid] });
    assert.equal(queued.length, 0, 'Paid chat must not also enqueue a plain chat duplicate');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].event, 'superchat');
    assert.equal(sent[0].hasDonation, '$5.00');
    assert.equal(sent[0].chatmessage, 'Thanks!');
    await context.processLiveChatResponseData({ items: [{ ...paid, id: 'fixture-chat', snippet: {
        type: 'textMessageEvent', publishedAt: '2026-09-05T12:00:01Z', displayMessage: 'Hello'
    } }] });
    assert.equal(queued.length, 1, 'Ordinary chat must still enqueue');
    assert.equal(queued[0].message, 'Hello');
    context.initialBacklogProcessing = true;
    context.initialBacklogTimestamp = 0;
    context.lastMessageTime = null;
    await context.processLiveChatResponseData({ items: [paid] });
    assert.equal(sent.length, 1, 'Backlog must not replay old donations');
    assert.equal(queued.length, 1);
});

for (const actionType of ['pinMessage', 'sendMessage']) {
    test(`${actionType} editor dropdown changes complete without exceptions`, () => {
        const handlers = {};
        const id = actionType === 'pinMessage' ? 'prop-mode' : 'prop-sanitizeMode';
        const input = { id, type: 'select-one', tagName: 'SELECT', value: '',
            addEventListener(name, callback) { (handlers[name] || (handlers[name] = [])).push(callback); } };
        const group = { style: { display: '' } };
        const elements = { [id]: input,
            [actionType === 'pinMessage' ? 'pin-message-id-group' : 'sanitize-warning']: group };
        const context = vm.createContext({ console, document: {
            getElementById: key => elements[key] || null,
            querySelectorAll: selector => selector.includes('.property-input') ? [input] : []
        } });
        vm.runInContext(read('actions/EventFlowEditor.js') + '\nglobalThis.Editor = EventFlowEditor;', context);
        const editor = Object.create(context.Editor.prototype);
        const node = { id: 'fixture', type: 'action', actionType, config: {} };
        editor.currentFlow = { nodes: [node] };
        let dirty = false;
        editor.markUnsavedChanges = value => { dirty = value; };
        editor.renderNodeOnCanvas = () => {};
        editor.getLocalMediaApi = () => null;
        editor.addPropertiesEventListeners(node.id);
        const values = actionType === 'pinMessage' ? ['nextPinned', 'messageId'] : ['safe', 'raw'];
        for (const value of values) {
            input.value = value;
            for (const handler of handlers.change) handler({ target: input });
            assert.equal(node.config[actionType === 'pinMessage' ? 'mode' : 'sanitizeMode'], value);
            assert.equal(group.style.display, value === values[0] ? 'none' : actionType === 'sendMessage' ? 'block' : '');
            assert.equal(dirty, true);
        }
    });
}

test('Imported userPool trigger counts distinct entrants and leaves unrelated actions working', async () => {
    const { system } = flowSystem();
    const flow = await system.importFlow({ name: 'Pool fixture', active: true,
        nodes: [
            { id: 'pool', type: 'trigger', triggerType: 'userPool', config: { poolName: 'fixture', maxUsers: 2 } },
            { id: 'any', type: 'trigger', triggerType: 'anyMessage', config: {} },
            { id: 'full', type: 'action', actionType: 'obsChangeScene', config: { sceneName: 'Full' } },
            { id: 'chat', type: 'action', actionType: 'obsChangeScene', config: { sceneName: 'Chat' } }
        ], connections: [{ from: 'pool', to: 'full' }, { from: 'any', to: 'chat' }] });
    const effects = [];
    system.sendTargetP2P = payload => effects.push(payload.overlayNinja.sceneName);
    const first = { type: 'twitch', chatname: 'First', userid: 'first', chatmessage: '!enter', textonly: true };
    await system.evaluateFlow(flow, first);
    assert.deepEqual(effects, ['Chat']);
    await system.evaluateFlow(flow, first);
    assert.deepEqual(effects, ['Chat', 'Chat'], 'Repeat entrant must not fill the pool');
    await system.evaluateFlow(flow, { ...first, userid: 'second', chatname: 'Second' });
    assert.deepEqual(effects, ['Chat', 'Chat', 'Full', 'Chat']);
});

test('Imported accumulator trigger uses its configured threshold and per-user scope', async () => {
    const { system } = flowSystem();
    const flow = await system.importFlow({ name: 'Accumulator fixture', active: true,
        nodes: [
            { id: 'total', type: 'trigger', triggerType: 'accumulator', config: {
                accumulatorName: 'fixture', threshold: 10, propertyName: 'donoValue', operation: 'sum', scope: 'perUser'
            } },
            { id: 'action', type: 'action', actionType: 'obsChangeScene', config: { sceneName: 'Threshold' } }
        ], connections: [{ from: 'total', to: 'action' }] });
    const effects = [];
    system.sendTargetP2P = payload => effects.push(payload);
    const message = { type: 'twitch', chatname: 'First', userid: 'first', donoValue: 6 };
    await system.evaluateFlow(flow, message);
    await system.evaluateFlow(flow, { ...message, userid: 'second' });
    assert.equal(effects.length, 0, 'Different users must not share totals');
    await system.evaluateFlow(flow, { ...message, donoValue: 4 });
    assert.equal(effects.length, 1);
});

for (const actionType of ['sendMessage', 'relay']) {
    test(`${actionType} honors an explicit zero timeout and retains configured/default values`, async () => {
        const { system } = flowSystem();
        const calls = [];
        system.sanitizeRelay = value => value;
        system.sendMessageToTabs = (...args) => calls.push(args);
        const message = { type: 'twitch', chatname: 'Fixture', chatmessage: 'Fixture message', tid: 123 };
        for (const timeout of [0, 2500, undefined]) {
            calls.length = 0;
            await system.executeAction({ id: 'fixture', actionType,
                config: { template: 'Fixture', destination: 'all', timeout } }, message);
            assert.equal(calls.length, 1);
            assert.equal(calls[0][5], timeout === undefined ? 1000 : timeout);
            assert.equal(calls[0][0].reflection, true, 'Outgoing messages retain loop protection');
        }
        calls.length = 0;
        await system.executeAction({ id: 'fixture', actionType, config: { timeout: 0 } }, { ...message, reflection: true });
        assert.equal(calls.length, 0, 'Reflections must still be skipped');
    });
}

test('MIDI note action preserves zero velocity using the bundled WebMidi library', async () => {
    const { system, context } = flowSystem();
    const packets = [];
    const port = { id: 'fixture', name: 'Fixture', type: 'output', state: 'connected', connection: 'open',
        open: async () => {}, close: async () => {},
        send: (data, timestamp) => packets.push({ data: Array.from(data), timestamp }) };
    context.performance = { now: () => 1000 };
    context.navigator = { requestMIDIAccess: async () => ({ inputs: new Map(), outputs: new Map([['fixture', port]]) }) };
    vm.runInContext(read('thirdparty/webmidi3.js'), context);
    await context.window.WebMidi.enable();
    system.midiEnabled = true;
    system.getMIDIOutputDevice = id => context.window.WebMidi.getOutputById(id);
    for (const velocity of [0, 64, undefined]) {
        packets.length = 0;
        await system.executeAction({ id: 'note', actionType: 'midiSendNote',
            config: { deviceId: 'fixture', note: 'C4', channel: 3, velocity, duration: 250 } }, {});
        assert.equal(packets.length, 2, 'Exactly one note-on and note-off on the selected channel');
        assert.deepEqual(packets[0].data, [0x92, 60, velocity === undefined ? 127 : velocity]);
        assert.deepEqual(packets[1].data.slice(0, 2), [0x82, 60]);
        assert.equal(packets[1].timestamp, 1250);
    }
    packets.length = 0;
    await system.executeAction({ id: 'cc', actionType: 'midiSendCC',
        config: { deviceId: 'fixture', controller: 7, value: 45, channel: 4 } }, {});
    assert.deepEqual(packets[0].data, [0xB3, 7, 45], 'Existing CC signature correctly selects its channel');
    await context.window.WebMidi.disable();
});

test('MIDI editor retains the explicitly supported zero velocity', () => {
    const properties = { innerHTML: '' };
    const context = vm.createContext({ console, document: { getElementById: () => properties } });
    vm.runInContext(read('actions/EventFlowEditor.js') + '\nglobalThis.Editor = EventFlowEditor;', context);
    const editor = Object.create(context.Editor.prototype);
    editor.escapeHtml = value => value;
    editor.resolveGuideTarget = () => '#';
    editor.getNodeTitle = () => 'MIDI Note';
    editor.actionTypes = [{ id: 'midiSendNote', name: 'MIDI Note' }];
    editor.addPropertiesEventListeners = () => {};
    editor.populateMIDIOutputDevices = () => {};
    editor.showNodeProperties({ id: 'fixture', type: 'action', actionType: 'midiSendNote', config: { velocity: 0 } });
    assert.match(properties.innerHTML, /id="prop-velocity" value="0"/);
});

test('Scheduler runs timed actions in a flow that also contains chat-dependent triggers', async () => {
    const { system } = flowSystem();
    const nodes = [
        { id: 'timer', type: 'trigger', triggerType: 'timeInterval', config: { interval: 60 } },
        { id: 'follower', type: 'trigger', triggerType: 'eventNewFollower', config: {} },
        { id: 'action', type: 'action', actionType: 'obsChangeScene', config: { sceneName: 'Fixture' } }
    ];
    system.flows = [{ id: 'mixed', active: true, nodes, connections: [{ from: 'timer', to: 'action' }] }];
    const effects = [];
    system.sendTargetP2P = payload => effects.push(payload);
    await system._runTimeBasedTick();
    assert.equal(effects.length, 1, 'A follower trigger must not crash the timer branch');
    await system._runTimeBasedTick();
    assert.equal(effects.length, 1, 'The time interval must still be respected');
});

test('Message triggers do not match or count scheduler ticks, while optional no-message triggers still work', async () => {
    const { system } = flowSystem();
    const cases = [
        ['eventNewFollower', {}], ['fromUser', {}], ['fromChannelName', {}],
        ['hasDonation', {}], ['compareProperty', { property: 'type', operator: 'ne', value: 'youtube' }],
        ['messageLength', { comparison: 'lt', length: 100 }], ['wordCount', { comparison: 'lt', count: 10 }],
        ['messageRegex', { pattern: '.*' }], ['counter', { threshold: 1 }],
        ['messageProperties', {}], ['randomChance', { probability: 1 }], ['obsSceneChanged', {}]
    ];
    for (const [triggerType, config] of cases) {
        assert.equal(await system.evaluateTrigger({ id: triggerType, triggerType, config }, null), false, triggerType);
    }
    const random = { id: 'no-message-random', triggerType: 'randomChance', config: { probability: 1, requireMessage: false } };
    assert.equal(await system.evaluateTrigger(random, null), true);
    system.allowEvalCustomJs = true;
    assert.equal(await system.evaluateTrigger({ id: 'custom', triggerType: 'customJs', config: { code: 'return message === null;' } }, null), true);
    assert.equal(await system.evaluateTrigger({ id: 'follower', triggerType: 'eventNewFollower', config: {} },
        { type: 'twitch', event: 'new_follower', chatname: 'Fixture' }), true);
});

test('Time of Day repeats on later days but only once within each matching minute', async () => {
    const { system, context } = flowSystem();
    context.fixtureNow = new Date(2026, 8, 5, 12, 0, 0).getTime();
    vm.runInContext('Date = class extends Date { constructor() { super(fixtureNow); } }', context);
    const node = { id: 'daily', type: 'trigger', triggerType: 'timeOfDay', config: { times: ['12:00'] } };
    assert.equal(await system.evaluateTrigger(node, null), true);
    context.fixtureNow += 30000;
    assert.equal(await system.evaluateTrigger(node, null), false);
    context.fixtureNow = new Date(2026, 8, 5, 12, 1).getTime();
    assert.equal(await system.evaluateTrigger(node, null), false);
    context.fixtureNow = new Date(2026, 8, 6, 12, 0).getTime();
    assert.equal(await system.evaluateTrigger(node, null), true, 'Daily schedule must fire the next day');
});

test('Time of Day editor preserves an array and can reopen legacy string schedules', async () => {
    const { system, context } = flowSystem();
    const handlers = {};
    const input = { id: 'prop-times', type: 'text', tagName: 'INPUT',
        value: ' 09:00, 12:00, , 18:00 ', addEventListener: (name, handler) => { handlers[name] = handler; } };
    const properties = { innerHTML: '' };
    context.document = { getElementById: id => id === 'node-properties-content' ? properties : null,
        querySelectorAll: selector => selector.includes('.property-input') ? [input] : [] };
    vm.runInContext(read('actions/EventFlowEditor.js') + '\nglobalThis.Editor = EventFlowEditor;', context);
    const editor = Object.create(context.Editor.prototype);
    const node = { id: 'daily-edit', type: 'trigger', triggerType: 'timeOfDay', config: { times: ['12:00'] } };
    editor.currentFlow = { nodes: [node] };
    editor.markUnsavedChanges = () => {};
    editor.renderNodeOnCanvas = () => {};
    editor.getLocalMediaApi = () => null;
    editor.addPropertiesEventListeners(node.id);
    handlers.input({ target: input });
    assert.deepEqual(Array.from(node.config.times), ['09:00', '12:00', '18:00']);
    context.fixtureNow = new Date(2026, 8, 5, 12, 0).getTime();
    vm.runInContext('Date = class extends Date { constructor() { super(fixtureNow); } }', context);
    assert.equal(await system.evaluateTrigger(node, null), true);
    editor.escapeHtml = value => value;
    editor.resolveGuideTarget = () => '#';
    editor.getNodeTitle = () => 'Time of Day';
    editor.triggerTypes = [{ id: 'timeOfDay', name: 'Time of Day' }];
    node.config.times = '09:00, 12:00';
    editor.showNodeProperties(node);
    assert.match(properties.innerHTML, /id="prop-times" value="09:00, 12:00"/);
    node.id = 'legacy';
    assert.equal(await system.evaluateTrigger(node, null), true, 'Already saved string schedules must also work');
});

test('RANDOM gate honors zero and retains its default and full probability', async () => {
    const { system, context } = flowSystem();
    vm.runInContext('Math.random = () => 0.25', context);
    assert.equal(await system.evaluateSpecificLogicNode('RANDOM', [true], { probability: 0 }, {}), false);
    assert.equal(await system.evaluateSpecificLogicNode('RANDOM', [true], {}, {}), true);
    assert.equal(await system.evaluateSpecificLogicNode('RANDOM', [true], { probability: 100 }, {}), true);
    assert.equal(await system.evaluateSpecificLogicNode('RANDOM', [false], { probability: 100 }, {}), false);
});

test('RANDOM gate editor displays and preserves a zero probability', () => {
    const properties = { innerHTML: '' };
    const context = vm.createContext({ console, document: { getElementById: () => properties } });
    vm.runInContext(read('actions/EventFlowEditor.js') + '\nglobalThis.Editor = EventFlowEditor;', context);
    const editor = Object.create(context.Editor.prototype);
    editor.escapeHtml = value => value;
    editor.resolveGuideTarget = () => '#';
    editor.getNodeTitle = () => 'Random';
    editor.logicNodeTypes = [{ id: 'RANDOM', name: 'Random' }];
    editor.addPropertiesEventListeners = () => {};
    const node = { id: 'fixture', type: 'logic', logicType: 'RANDOM', config: { probability: 0 } };
    assert.equal(editor.getNodeDescription(node), '0% chance');
    editor.showNodeProperties(node);
    assert.match(properties.innerHTML, /id="prop-probability" value="0"/);
});

test('YouTube expired token stops retries and accepts an explicit reconnect', async () => {
    const time = clock();
    const nextRequest = deferred();
    const tokens = [];
    const errors = [];
    const context = vm.createContext({ ...time, console, URLSearchParams, AbortController });
    vm.runInContext(read('providers/youtube/liveChat.js').replace(/^export /gm, '')
        + '\nglobalThis.factory = createYouTubeLiveChat;', context);
    const client = context.factory({ mode: 'stream', fetchImplementation: async (url, options) => {
        tokens.push(options.headers.Authorization);
        return tokens.length === 1 ? { status: 401, ok: false } : nextRequest.promise;
    } });
    client.on('error', error => errors.push(error.code));
    await client.start({ chatId: 'fixture', token: 'expired' });
    assert.deepEqual(errors, ['TOKEN_EXPIRED']);
    assert.equal(client.getState().status, 'error');
    assert.equal(time.timers.size, 0, '401 must not schedule retries with the rejected token');
    const restarted = client.start({ chatId: 'fixture', token: 'replacement' });
    await flush();
    assert.deepEqual(tokens, ['Bearer expired', 'Bearer replacement']);
    client.stop();
    nextRequest.reject(new Error('Fixture abort'));
    await restarted;
});

test('YouTube repeated failures back off to the cap and successful data resets the delay', async () => {
    const time = clock();
    const delays = [];
    let attempts = 0;
    const context = vm.createContext({ ...time, console, URLSearchParams, AbortController, TextDecoder,
        setTimeout(fn, delay) { delays.push(delay); return time.setTimeout(fn); } });
    vm.runInContext(read('providers/youtube/liveChat.js').replace(/^export /gm, '')
        + '\nglobalThis.factory = createYouTubeLiveChat;', context);
    const client = context.factory({ mode: 'stream', retry: { maxDelayMs: 5000 },
        fetchImplementation: async () => {
            if (++attempts < 4) throw new Error('Fixture outage');
            let reads = 0;
            return { ok: true, status: 200, body: { getReader: () => ({
                read: async () => {
                    if (reads++) throw new Error('Disconnected after successful data');
                    return { done: false, value: new TextEncoder().encode('{"items":[],"nextPageToken":"fixture"}\n') };
                }, releaseLock() {}
            }) } };
        } });
    await client.start({ chatId: 'fixture', token: 'fixture' });
    for (let i = 0; i < 3; i++) await time.tick();
    client.stop();
    assert.deepEqual(delays, [2000, 4000, 5000, 2000]);
});

test('New flows saved within one millisecond retain separate database records', async () => {
    const { system, context } = flowSystem();
    delete system.saveFlow; // Exercise production saveFlow, including its record keys.
    const records = new Map();
    system.ensureDB = async () => ({ transaction: () => ({ objectStore: () => ({
        put(flow) {
            records.set(flow.id, JSON.parse(JSON.stringify(flow)));
            const request = {};
            queueMicrotask(() => request.onsuccess());
            return request;
        }
    }) }) });
    system.checkMIDIRequirement = async () => {};
    system.setupMIDIListeners = () => {};
    // Freeze the production VM's clock, without affecting other tests.
    vm.runInContext('Date.now = () => 1234567890', context);
        const first = await system.saveFlow({ name: 'First', nodes: [], connections: [] });
        const second = await system.saveFlow({ name: 'Second', nodes: [], connections: [] });
        assert.notEqual(first.id, second.id);
        assert.equal(records.size, 2);
        assert.equal(system.flows.length, 2);
        await system.saveFlow({ ...first, name: 'Updated' });
        assert.equal(records.size, 2, 'Saving an existing ID must still update the original');
        assert.equal(records.get(first.id).name, 'Updated');
});

test('YouTube silent stop permits restart; late old request cannot abort new stream', async () => {
    const requests = [];
    const context = vm.createContext({ console, URLSearchParams, AbortController, TextDecoder, setTimeout, clearTimeout });
    vm.runInContext(read('providers/youtube/liveChat.js').replace(/^export /gm, '')
        + '\nglobalThis.factory = createYouTubeLiveChat;', context);
    const client = context.factory({ mode: 'stream', fetchImplementation: (url, options) => {
        const pending = deferred();
        requests.push({ ...pending, url, signal: options.signal });
        return pending.promise;
    } });
    const statuses = [];
    client.on('status', value => statuses.push(value.status));
    const oldStart = client.start({ chatId: 'first', token: 'fixture' });
    await flush();
    const statusCount = statuses.length;
    client.stop({ suppressStatus: true });
    assert.equal(client.getState().status, 'idle');
    assert.equal(statuses.length, statusCount, 'Silent stop should remain silent');
    const newStart = client.start({ chatId: 'second', token: 'fixture' });
    await flush();
    assert.equal(requests.length, 2);
    assert.ok(requests[0].signal.aborted);
    assert.ok(requests[1].url.includes('liveChatId=second'));
    requests[0].reject(new Error('Late abort'));
    await oldStart;
    assert.equal(requests[1].signal.aborted, false);
    assert.equal(client.getState().status, 'running');
    client.stop();
    requests[1].reject(new Error('Abort'));
    await newStart;
});

test('YouTube stop cancels pending prerequisites', async () => {
    const auth = deferred();
    let requests = 0;
    const context = vm.createContext({ console, URLSearchParams, AbortController, setTimeout, clearTimeout });
    vm.runInContext(read('providers/youtube/liveChat.js').replace(/^export /gm, '')
        + '\nglobalThis.factory = createYouTubeLiveChat;', context);
    const client = context.factory({ mode: 'stream', tokenProvider: () => auth.promise,
        fetchImplementation: async () => { requests++; } });
    const start = client.start({ chatId: 'fixture' });
    await flush();
    client.stop({ suppressStatus: true });
    auth.resolve('fixture');
    await start;
    assert.equal(requests, 0);
    assert.equal(client.getState().status, 'idle');
});

for (const phase of ['auth', 'factory', 'connect']) {
    for (const operation of ['disconnect', 'destroy']) {
        test(`Twitch ${operation} cancels pending ${phase}`, async () => {
            const time = clock();
            const pending = deferred();
            let connects = 0;
            let disconnects = 0;
            const transport = { on() {}, removeAllListeners() {},
                disconnect() { disconnects++; },
                connect() { connects++; return phase === 'connect' ? pending.promise : Promise.resolve(); } };
            const context = vm.createContext({ ...time, console });
            vm.runInContext(read('providers/twitch/chatClient.js').replace(/^export /gm, '')
                + '\nglobalThis.factory = createTwitchChatClient;', context);
            const client = context.factory({ channel: 'fixture', logger: null,
                tokenProvider: () => phase === 'auth' ? pending.promise : 'fixture',
                clientFactory: () => phase === 'factory' ? pending.promise : transport });
            const start = client.connect();
            await flush();
            client[operation]();
            pending.resolve(phase === 'factory' ? transport : 'fixture');
            await start;
            assert.equal(connects, phase === 'connect' ? 1 : 0);
            if (phase !== 'auth') assert.ok(disconnects > 0);
            assert.equal(client.getState().status, operation === 'destroy' ? 'idle' : 'disconnected');
            assert.equal(client.getClient(), null);
            assert.equal(time.timers.size, 0, 'Cancelled connections must not schedule reconnects');
        });
    }
}

test('Twitch stale connection failure cannot tear down a replacement connection', async () => {
    const oldConnect = deferred();
    let count = 0;
    let newDisconnects = 0;
    const context = vm.createContext({ console, setTimeout, clearTimeout });
    vm.runInContext(read('providers/twitch/chatClient.js').replace(/^export /gm, '')
        + '\nglobalThis.factory = createTwitchChatClient;', context);
    const client = context.factory({ channel: 'fixture', logger: null, clientFactory: () => {
        const first = ++count === 1;
        return { on() {}, removeAllListeners() {},
            disconnect() { if (!first) newDisconnects++; },
            connect: () => first ? oldConnect.promise : Promise.resolve() };
    } });
    const original = client.connect();
    await flush();
    client.disconnect();
    await client.connect();
    oldConnect.reject(new Error('Late connection failure'));
    await original;
    assert.equal(client.getState().status, 'connected');
    assert.equal(newDisconnects, 0);
    client.destroy();
});

for (const asyncBranch of [false, true]) {
    for (const operation of ['delete', 'disable', 'complete']) {
        test(`${asyncBranch ? 'Async' : 'Normal'} delayed actions: ${operation}`, async () => {
            const { system, time } = flowSystem();
            const nodes = [{ id: 'trigger', type: 'trigger' }];
            if (asyncBranch) nodes.push({ id: 'async', type: 'action', actionType: 'continueAsync', config: {} });
            nodes.push({ id: 'delay', type: 'action', actionType: 'delay', config: { delayMs: 60000 } },
                { id: 'effect', type: 'action', actionType: 'obsChangeScene', config: { sceneName: 'Fixture' } });
            const flow = { id: 'flow', active: true, nodes,
                connections: nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id })) };
            system.flows.push(flow);
            system.evaluateTrigger = async () => true;
            const effects = [];
            system.sendTargetP2P = value => effects.push(value);
            const running = system.evaluateFlow(flow, {});
            await flush();
            if (asyncBranch) await time.tick();
            assert.equal(time.timers.size, 1, 'Delay must be pending');
            if (operation === 'complete') {
                await time.tick();
            } else if (operation === 'delete') {
                system.cleanupStateNodes(flow.id);
                system.flows = [];
            } else {
                // Match toggleFlowActive's in-place mutation, then re-enable immediately.
                flow.active = false;
                system.reconcileFlowState(system.flows);
                flow.active = true;
            }
            await running;
            await flush();
            assert.equal(time.timers.size, 0, 'Cancellation must release delay timers');
            assert.equal(effects.length, operation === 'complete' ? 1 : 0);
        });
    }
}
