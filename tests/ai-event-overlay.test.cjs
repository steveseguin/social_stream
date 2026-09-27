const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function service() {
    let stored = {};
    let calls = [];
    let answer = '<style>article{color:white}</style><article><h1 data-field="chatname"></h1><p data-field="chatmessage"></p></article>';
    const sender = { url: 'chrome-extension://test/popup.html' };
    const context = vm.createContext({
        window: {}, console, URL, AbortController, setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto, Uint8Array,
        FileReader: class { readAsDataURL(blob) { blob.arrayBuffer().then(bytes => { this.result = 'data:' + blob.type + ';base64,' + Buffer.from(bytes).toString('base64'); this.onload(); }); } }, CACHE_SIZE: 100, isSSAPP: false,
        settings: { allowChatBot: true, aiProvider: { optionsetting: 'hostedllm' } }, isExtensionOn: true,
        document: { readyState: 'loading', addEventListener() {} },
        chrome: { runtime: { getURL: page => 'chrome-extension://test/' + page }, storage: { local: {
            get(keys, cb) { cb(structuredClone(stored)); },
            set(value, cb) { stored = structuredClone(value); cb(); }
        } } },
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url.includes('llm-trial-config')) return new Response(JSON.stringify({ enabled: true, endpoint: 'https://fixture.test/v1/chat/completions', model: 'basic', token: 'test_token' }));
            if (url.includes('chat/completions') && answer instanceof Error) throw answer;
            if (url.endsWith('/voice.mp3')) return new Response('audio', { headers: { 'content-type': 'audio/mpeg' } });
            if (url.includes('chat/completions')) return new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }));
            if (url.endsWith('/image')) return new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] }), { headers: { 'content-type': 'application/json' } });
            if (url.endsWith('/speech')) return new Response(JSON.stringify({ url: 'https://fixture.test/voice.mp3' }), { headers: { 'content-type': 'application/json' } });
            return new Response('', { status: 500 });
        }
    });
    vm.runInContext(read('ai.js'), context);
    vm.runInContext(read('shared/aiEventOverlay/core.js'), context);
    vm.runInContext(read('shared/aiEventOverlay/background.js'), context);
    return { context, core: context.window.SSNAiEventOverlay, handle: context.window.SSNAiEventBackground.handle, settings: request => context.window.SSNAiEventBackground.handleSettings(request, sender), calls, setAnswer: value => { answer = value; } };
}

test('only local settings can save profiles and saved keys are write-only', async () => {
    const s = service();
    const request = { action: 'saveAiEventProfile', value: { id: 'intro', imageKey: 'image-fixture', imageEndpoint: 'https://fixture.test/image' } };
    await assert.rejects(s.handle(request), /only in the SSN popup/);
    await assert.rejects(s.context.window.SSNAiEventBackground.handleSettings(request, { url: 'https://fixture.test/aievent.html' }), /Open AI Event/);
    const saved = await s.settings(request);
    assert.equal(saved.imageKey, '');
    assert.equal(saved.imageKeySet, true);
    assert.equal(saved.displayToken.length, 64);
    assert.equal(JSON.stringify(await s.settings({ action: 'getAiEventProfiles' })).includes('image-fixture'), false);
    const kept = await s.settings({ action: 'saveAiEventProfile', value: { ...saved, prompt: 'A card with flowers' } });
    assert.equal(kept.imageKeySet, true);
    assert.equal(kept.displayToken, saved.displayToken);
    await assert.rejects(s.settings({ action: 'saveAiEventProfile', value: { ...kept, imageEndpoint: 'https://fixture.test/other' } }), /Enter or remove/);
    const removed = await s.settings({ action: 'saveAiEventProfile', value: { ...kept, imageClearKey: true, imageEndpoint: 'https://fixture.test/other' } });
    assert.equal(removed.imageKeySet, false);
    assert.equal(s.calls.length, 0);
});

test('display authorization is scoped to one profile and never grants settings access', async () => {
    const s = service();
    const p = await s.settings({ action: 'saveAiEventProfile', value: { id: 'intro' } });
    await s.settings({ action: 'saveAiEventProfile', value: { id: 'other' } });
    await assert.rejects(s.handle({ action: 'getAiEventProfiles', profile: p.id }), /new overlay URL/);
    await assert.rejects(s.handle({ action: 'generateAiEvent', profile: 'other', displayToken: p.displayToken }), /new overlay URL/);
    await assert.rejects(s.handle({ action: 'getAiEventProfiles', profile: p.id, displayToken: p.displayToken, edit: true }), /only in the SSN popup/);
    await assert.rejects(s.handle({ action: 'saveAiEventProfile', profile: p.id, displayToken: p.displayToken, value: p }), /only in the SSN popup/);
    const visible = await s.handle({ action: 'getAiEventProfiles', profile: p.id, displayToken: p.displayToken });
    assert.deepEqual(Object.keys(visible), ['intro']);
    for (const field of ['prompt', 'imageKey', 'ttsKey', 'imageEndpoint', 'displayToken']) assert.equal(visible.intro[field], undefined);
    s.context.settings.disablehost = true;
    await assert.rejects(s.handle({ action: 'generateAiEvent', profile: p.id, displayToken: p.displayToken }), /Host controls/);
    assert.equal(s.calls.length, 0);
});

test('actual LLM adapter generates templates from saved instructions and approved variation only', async () => {
    const s = service();
    const p = await s.settings({ action: 'saveAiEventProfile', value: { id: 'intro', prompt: 'A purple celebration card', variations: 'winter\nfireworks', model: 'saved-model' } });
    const input = { action: 'generateAiEvent', profile: p.id, displayToken: p.displayToken, variation: 'winter', message: { chatname: 'ViewerMarker', chatmessage: 'MessageMarker', meta: { reward: 'MetadataMarker' }, textonly: true, hasDonation: 'DonationMarker', donoValue: 0 }, value: { prompt: 'UnstoredMarker', model: 'different-model' } };
    const result = await s.handle(input);
    assert.match(result.template, /data-field="chatname"/);
    const call = s.calls.find(c => c.url.includes('chat/completions'));
    assert.equal(call.options.redirect, 'error');
    const body = JSON.parse(call.options.body);
    assert.equal(body.model, 'saved-model');
    assert.equal(body.stream, false);
    assert.match(body.messages[0].content, /A purple celebration card/);
    assert.match(body.messages[0].content, /winter/);
    assert.doesNotMatch(JSON.stringify(body), /ViewerMarker|MessageMarker|MetadataMarker|DonationMarker|UnstoredMarker/);
    const before = s.calls.length;
    await assert.rejects(s.handle({ ...input, variation: 'not approved' }), /variation saved/);
    assert.equal(s.calls.length, before);
    s.setAnswer(new Error('provider-fixture-details'));
    await assert.rejects(s.handle(input), error => /generation failed/.test(error.message) && !error.message.includes('provider-fixture-details'));
    s.setAnswer(Object.assign(new Error('fixture timeout'), { name: 'AbortError' }));
    await assert.rejects(s.handle(input), /Overlay generation timed out/);
    s.context.settings.allowChatBot = false;
    await assert.rejects(s.handle(input), /Enable SSN/);
});

test('optional media sends keys only to its configured inference endpoint and returns bytes', async () => {
    const s = service();
    const p = await s.settings({ action: 'saveAiEventProfile', value: { id: 'media', imageEnabled: true, imageEndpoint: 'https://fixture.test/image', imageKey: 'image-fixture', imageModel: 'painter', ttsEnabled: true, ttsEndpoint: 'https://fixture.test/speech', ttsKey: 'speech-fixture', ttsVoice: 'narrator' } });
    const result = await s.handle({ action: 'generateAiEvent', profile: p.id, displayToken: p.displayToken, message: { chatname: 'ViewerMarker', chatmessage: 'MessageMarker', textonly: true } });
    assert.match(result.image, /^data:image\/png;base64,/);
    assert.match(result.audio, /^data:audio\/mpeg;base64,/);
    for (const call of s.calls) {
        const auth = call.options && call.options.headers && call.options.headers.Authorization;
        if (auth === 'Bearer image-fixture') assert.equal(call.url, 'https://fixture.test/image');
        if (auth === 'Bearer speech-fixture') assert.equal(call.url, 'https://fixture.test/speech');
        assert.doesNotMatch(call.options.body || '', /image-fixture|speech-fixture/);
    }
    const image = s.calls.find(c => c.url.endsWith('/image'));
    assert.equal(image.options.headers.Authorization, 'Bearer image-fixture');
    assert.equal(image.options.redirect, 'error');
    assert.doesNotMatch(image.options.body, /ViewerMarker|MessageMarker/);
    const speech = s.calls.find(c => c.url.endsWith('/speech'));
    assert.equal(speech.options.headers.Authorization, 'Bearer speech-fixture');
    assert.equal(JSON.parse(speech.options.body).input, 'MessageMarker');
    assert.equal(s.calls.find(c => c.url.endsWith('voice.mp3')).options.headers, undefined);
    assert.doesNotMatch(JSON.stringify(result), /image-fixture|speech-fixture/);
    const failed = await s.settings({ action: 'saveAiEventProfile', value: { id: 'failed-media', imageEnabled: true, imageEndpoint: 'https://fixture.test/fail' } });
    const fallback = await s.handle({ action: 'generateAiEvent', profile: failed.id, displayToken: failed.displayToken });
    assert.match(fallback.template, /article/);
    assert.equal(fallback.warnings.length, 1);
});

test('AI overlay requests enforce endpoint redirects in Electron without changing other LLM calls', async () => {
    const s = service();
    let nativeCalls = 0;
    s.context.ipcRenderer = {};
    s.context.fetchNodeAsync = async () => {
        nativeCalls++;
        return { status: 200, data: JSON.stringify({ choices: [{ message: { content: 'Existing native transport' } }] }) };
    };
    const p = await s.settings({ action: 'saveAiEventProfile', value: { id: 'electron' } });
    const result = await s.settings({ action: 'generateAiEvent', profile: p.id });
    assert.match(result.template, /article/);
    assert.equal(nativeCalls, 0);
    assert.equal(s.calls.find(c => c.url.includes('chat/completions')).options.redirect, 'error');
    assert.equal(await s.context.callLLMAPI('Existing chatbot request'), 'Existing native transport');
    assert.equal(nativeCalls, 1);
    s.context.isSSAPP = true;
    const profiles = await s.context.window.SSNAiEventBackground.handleSettings({ action: 'getAiEventProfiles' }, { aiEventLocalPopup: true });
    assert.equal(profiles.electron.id, 'electron');
});

test('routing distinguishes featured, all-message and targeted flow input', () => {
    const s = service();
    const message = { chatname: 'Jess', chatmessage: 'Hello', textonly: true, meta: { extra: 1 } };
    assert.equal(s.core.eventMessage({ contents: message }, 'featured', 'x'), message);
    assert.equal(s.core.eventMessage(message, 'featured', 'x'), message, 'Dock sends selected messages directly');
    assert.equal(s.core.eventMessage({ content: message }, 'featured', 'x'), message);
    assert.equal(s.core.eventMessage({ action: 'content', value: JSON.stringify(message) }, 'featured', 'x').chatmessage, 'Hello');
    assert.equal(s.core.eventMessage(false, 'featured', 'x'), null);
    assert.equal(s.core.eventMessage({ action: 'content', value: '' }, 'featured', 'x'), null);
    assert.equal(s.core.eventMessage(message, 'all', 'x'), message);
    assert.equal(s.core.eventMessage({ contents: message }, 'all', 'x'), null);
    assert.equal(s.core.eventMessage({ event: 'viewer_updates', meta: { youtube: 8 } }, 'all', 'x'), null);
    const flow = { ...message, meta: { aiEventOverlay: { profile: 'x' } } };
    assert.equal(s.core.eventMessage(flow, 'flow', 'x'), flow);
    assert.equal(s.core.eventMessage(flow, 'flow', 'y'), null);
});

test('local Event Flow lists only choices and reports invalid or disconnected actions', async () => {
    const s = service();
    const api = s.context.window.SSNAiEventBackground;
    const sender = { url: 'chrome-extension://test/actions/index.html' };
    await s.settings({ action: 'saveAiEventProfile', value: { id: 'intro', name: 'Intro', mode: 'flow', variations: 'winter\nfireworks', imageKey: 'image-fixture' } });
    await s.settings({ action: 'saveAiEventProfile', value: { id: 'featured', mode: 'featured' } });
    const choices = await api.handleFlow({ action: 'list' }, sender);
    assert.deepEqual(JSON.parse(JSON.stringify(choices[0])), { id: 'intro', name: 'Intro', mode: 'flow', variations: ['winter', 'fireworks'] });
    await assert.rejects(api.handleSettings({ action: 'getAiEventProfiles' }, sender), /Open AI Event/);
    await assert.rejects(api.handleFlow({ action: 'saveAiEventProfile' }, sender), /Unknown/);
    await assert.rejects(api.handleFlow({ action: 'list' }, { url: 'https://fixture.test/actions/index.html' }), /local Event Flow/);
    const sent = [];
    s.context.sendTargetP2P = (...args) => { sent.push(args); return true; };
    const message = { chatname: 'Jess', chatmessage: 'Hello', donoValue: 0, meta: { reward: 'intro' } };
    const before = JSON.stringify(message);
    await api.handleFlow({ action: 'show', profile: 'intro', variation: 'winter', message }, sender);
    assert.equal(sent[0][1], 'aievent-intro');
    assert.equal(sent[0][0].meta.reward, 'intro');
    assert.equal(sent[0][0].meta.aiEventOverlay.variation, 'winter');
    assert.equal(sent[0][0].donoValue, 0);
    assert.equal(JSON.stringify(message), before);
    await assert.rejects(api.trigger({ profile: 'missing', message }), /saved AI overlay/);
    await assert.rejects(api.trigger({ profile: 'featured', message }), /trigger to Event Flow/);
    await assert.rejects(api.trigger({ profile: 'intro', variation: 'not saved', message }), /variation saved/);
    assert.equal(sent.length, 1);
    s.context.sendTargetP2P = () => false;
    await assert.rejects(api.trigger({ profile: 'intro', message }), /not connected/);
    assert.equal(s.calls.length, 0);
});

test('Event Flow sends a targeted copy and preserves its incoming message and metadata', async () => {
    const context = vm.createContext({ window: { location: { search: '' } }, console, setTimeout, clearTimeout, setInterval, clearInterval, indexedDB: { open: () => ({}) }, IDBKeyRange: {} });
    vm.runInContext(read('actions/EventFlowSystem.js') + '\nwindow.EFS = EventFlowSystem;', context);
    const sent = [];
    const sys = new context.window.EFS({ sendTargetP2P: (...args) => { sent.push(args); return true; } });
    const input = { type: 'youtube', platform: 'youtube', chatname: 'Jess', chatmessage: 'Hello', textonly: true, hasDonation: '$5', donoValue: 0, meta: { reward: 'intro' } };
    const before = JSON.stringify(input);
    const result = await sys.executeAction({ id: 'ai', actionType: 'showAiEventOverlay', config: { profile: 'intro', variation: 'winter' } }, input);
    assert.equal(sent[0][1], 'aievent-intro');
    assert.equal(sent[0][0].meta.reward, 'intro');
    assert.equal(sent[0][0].meta.aiEventOverlay.profile, 'intro');
    assert.equal(sent[0][0].meta.aiEventOverlay.variation, 'winter');
    assert.equal(sent[0][0].donoValue, 0);
    assert.equal(JSON.stringify(input), before);
    assert.equal(result.modified, false);
    await sys.executeAction({ id: 'ai', actionType: 'showAiEventOverlay', config: {} }, { ...input, meta: 7 });
    assert.equal(sent[1][0].meta.value, 7);
    sys.pointsSystem = { spendPoints: async () => ({ success: false, message: 'Insufficient points' }) };
    const declined = await sys.executeAction({ id: 'spend', actionType: 'spendPoints', config: { amount: 100 } }, input);
    assert.equal(declined.blocked, true);
});

test('a direct AI reward refunds its own charge on generation or delivery failure and settles once on success', async () => {
    for (const outcome of ['success', 'generation failure', 'disconnected']) {
        const s = service();
        const api = s.context.window.SSNAiEventBackground;
        const p = await s.settings({ action: 'saveAiEventProfile', value: { id: 'paid', mode: 'flow' } });
        const transactions = [];
        let spent = 0;
        const points = {
            async spendPoints(...args) { transactions.push(['spend', ...args]); spent += args[2]; return { success: true }; },
            async refundPoints(...args) { transactions.push(['refund', ...args]); spent -= args[2]; return { success: true }; },
            async pointRedemption(...args) { transactions.push(['settle', ...args]); return { success: true }; }
        };
        vm.runInContext(read('actions/EventFlowSystem.js') + '\nwindow.EFS = EventFlowSystem;', s.context);
        const sys = Object.create(s.context.window.EFS.prototype);
        sys.flows = []; sys.pointsSystem = points;
        const flow = { id: 'paid-test', active: true, nodes: [
            { id: 'chat', type: 'trigger', triggerType: 'anyMessage', config: {} },
            { id: 'spend', type: 'action', actionType: 'spendPoints', config: { amount: 25 } },
            { id: 'ai', type: 'action', actionType: 'showAiEventOverlay', config: { profile: 'paid' } }
        ], connections: [{ from: 'chat', to: 'spend' }, { from: 'spend', to: 'ai' }] };
        const message = { chatname: 'Paying fixture', type: 'youtube', chatmessage: 'Reward', textonly: true, meta: { reward: 'intro' } };
        let packet;
        s.context.sendTargetP2P = async value => {
            packet = value.aiEventPresentation;
            if (outcome === 'disconnected') return false;
            await api.handle({ action: 'aiEventDelivered', profile: p.id, displayToken: p.displayToken, delivery: packet.id });
            return true;
        };
        if (outcome === 'generation failure') s.setAnswer('No HTML returned');
        if (outcome === 'success') {
            await sys.evaluateFlow(flow, message);
            assert.equal(spent, 25);
            assert.equal(transactions.filter(t => t[0] === 'settle').length, 1);
            assert.equal(JSON.stringify(packet.message), JSON.stringify(message));
            await assert.rejects(api.handle({ action: 'aiEventDelivered', profile: p.id, displayToken: p.displayToken, delivery: packet.id }), /no longer pending/);
        } else {
            await assert.rejects(sys.evaluateFlow(flow, message), /points were returned/);
            assert.equal(spent, 0);
            assert.equal(transactions.filter(t => t[0] === 'refund').length, 1);
        }
        assert.equal(transactions[0][5], 240000);
        assert.equal(transactions[1][4], transactions[0][4], 'settlement uses the exact debit receipt');
        assert.equal(s.calls.filter(call => call.url.includes('chat/completions')).length, 1, 'the host generates one fresh design');
    }
});

test('branched charges retain existing spending behavior and insufficient points skip AI generation', async () => {
    const context = vm.createContext({ window: {}, console, setTimeout, clearTimeout });
    vm.runInContext(read('actions/EventFlowSystem.js') + '\nwindow.EFS = EventFlowSystem;', context);
    const sys = Object.create(context.window.EFS.prototype);
    sys.flows = [];
    const calls = [];
    sys.pointsSystem = { spendPoints: async (...args) => { calls.push(args); return { success: false, message: 'Not enough points' }; } };
    const charge = { id: 'spend', type: 'action', actionType: 'spendPoints', config: { amount: 25 } };
    const flow = { id: 'branches', nodes: [charge, { id: 'ai', type: 'action', actionType: 'showAiEventOverlay', config: {} }], connections: [{ from: 'spend', to: 'ai' }, { from: 'spend', to: 'another-effect' }] };
    const receipts = new Map();
    const result = await sys.executeAction(charge, { chatname: 'Fixture', type: 'youtube' }, flow, null, receipts);
    assert.equal(result.blocked, true);
    assert.equal(calls[0].length, 3);
    assert.equal(receipts.size, 0);
});

test('unconfirmed paid delivery expires and a late acknowledgment cannot settle it', async () => {
    const s = service();
    const p = await s.settings({ action: 'saveAiEventProfile', value: { id: 'paid', mode: 'flow' } });
    let packet;
    s.context.sendTargetP2P = async value => { packet = value.aiEventPresentation; return true; };
    await assert.rejects(s.context.window.SSNAiEventBackground.trigger({ profile: p.id, prepare: true, expiresAt: Date.now() + 120 }), /delivery was not confirmed/);
    await assert.rejects(s.handle({ action: 'aiEventDelivered', profile: p.id, displayToken: p.displayToken, delivery: packet.id }), /no longer pending/);
});
