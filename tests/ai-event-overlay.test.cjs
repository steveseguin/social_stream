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
    let answer = 'Jess enters the arena!';
    const context = vm.createContext({
        window: {}, console, URL, AbortController, setTimeout, clearTimeout, CACHE_SIZE: 100, isElectron: false,
        settings: { allowChatBot: true, aiProvider: { optionsetting: 'hostedllm' } }, isExtensionOn: true,
        document: { readyState: 'loading', addEventListener() {} },
        chrome: { runtime: {}, storage: { local: {
            get(keys, cb) { cb(structuredClone(stored)); },
            set(value, cb) { stored = structuredClone(value); cb(); }
        } } },
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url.includes('llm-trial-config')) return new Response(JSON.stringify({ enabled: true, endpoint: 'https://fixture.test/v1/chat/completions', model: 'basic', token: 'test_token' }));
            if (url.includes('chat/completions')) return new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }));
            if (url.endsWith('/image')) return new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] }), { headers: { 'content-type': 'application/json' } });
            if (url.endsWith('/speech')) return new Response(JSON.stringify({ url: 'https://fixture.test/voice.mp3' }), { headers: { 'content-type': 'application/json' } });
            return new Response('', { status: 500 });
        }
    });
    vm.runInContext(read('ai.js'), context);
    vm.runInContext(read('shared/aiEventOverlay/core.js'), context);
    vm.runInContext(read('shared/aiEventOverlay/background.js'), context);
    return { context, core: context.window.SSNAiEventOverlay, handle: context.window.SSNAiEventBackground.handle, calls, setAnswer: value => { answer = value; } };
}

test('saved configuration uses the actual SSN hosted LLM adapter with plain text and no structured output', async () => {
    const s = service();
    await s.handle({ action: 'saveAiEventProfile', value: { id: 'intro', style: 'neon', autoStyle: true, imageKey: 'secret' } });
    const profiles = await s.handle({ action: 'getAiEventProfiles' });
    assert.equal(profiles.intro.imageKey, undefined);
    assert.equal(profiles.intro.prompt, undefined);
    const result = await s.handle({ action: 'generateAiEvent', profile: 'intro', message: { chatname: 'Jess', chatmessage: '<3', textonly: true, hasDonation: '€5', donoValue: 0 } });
    assert.equal(result.text, 'Jess enters the arena!');
    assert.equal(result.style, 'neon');
    assert.equal(result.donation, '€5');
    const request = JSON.parse(s.calls.find(c => c.url.includes('chat/completions')).options.body);
    assert.equal(request.stream, false);
    assert.equal(request.tools, undefined);
    assert.equal(request.response_format, undefined);
    assert.match(request.messages[0].content, /<3/);
    s.setAnswer('A new adventurer! [style: storybook]');
    const chosen = await s.handle({ action: 'generateAiEvent', profile: 'intro', message: {} });
    assert.equal(chosen.text, 'A new adventurer!');
    assert.equal(chosen.style, 'storybook');
});

test('optional endpoints receive their own keys; failures preserve generated text', async () => {
    const s = service();
    await s.handle({ action: 'saveAiEventProfile', value: { id: 'media', imageEnabled: true, imageEndpoint: 'https://fixture.test/image', imageKey: 'image-secret', imageModel: 'painter', ttsEnabled: true, ttsEndpoint: 'https://fixture.test/speech', ttsKey: 'speech-secret', ttsVoice: 'narrator' } });
    const result = await s.handle({ action: 'generateAiEvent', profile: 'media', message: { chatname: 'Jess' } });
    assert.match(result.image, /^data:image\/png;base64,/);
    assert.equal(result.audio, 'https://fixture.test/voice.mp3');
    const image = s.calls.find(c => c.url.endsWith('/image'));
    assert.equal(image.options.headers.Authorization, 'Bearer image-secret');
    assert.equal(JSON.parse(image.options.body).model, 'painter');
    const speech = s.calls.find(c => c.url.endsWith('/speech'));
    assert.equal(speech.options.headers.Authorization, 'Bearer speech-secret');
    assert.equal(JSON.parse(speech.options.body).input, result.text);
    assert.equal(JSON.parse(speech.options.body).voice, 'narrator');
    assert.equal(JSON.stringify(result).includes('secret'), false);
    await s.handle({ action: 'saveAiEventProfile', value: { id: 'failed-media', imageEnabled: true, imageEndpoint: 'https://fixture.test/fail' } });
    const failed = await s.handle({ action: 'generateAiEvent', profile: 'failed-media', message: {} });
    assert.equal(failed.text, 'Jess enters the arena!');
    assert.equal(failed.warnings.length, 1);
    s.setAnswer('');
    await assert.rejects(s.handle({ action: 'generateAiEvent', profile: 'media', message: {} }), /no display text/);
    s.context.settings.allowChatBot = false;
    await assert.rejects(s.handle({ action: 'generateAiEvent', profile: 'media', message: {} }), /Enable SSN/);
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

test('Event Flow sends a targeted copy and preserves its incoming message and metadata', async () => {
    const context = vm.createContext({ window: { location: { search: '' } }, console, setTimeout, clearTimeout, setInterval, clearInterval, indexedDB: { open: () => ({}) }, IDBKeyRange: {} });
    vm.runInContext(read('actions/EventFlowSystem.js') + '\nwindow.EFS = EventFlowSystem;', context);
    const sent = [];
    const sys = new context.window.EFS({ sendTargetP2P: (...args) => { sent.push(args); return true; } });
    const input = { type: 'youtube', platform: 'youtube', chatname: 'Jess', chatmessage: 'Hello', textonly: true, hasDonation: '$5', donoValue: 0, meta: { reward: 'intro' } };
    const before = JSON.stringify(input);
    const result = await sys.executeAction({ id: 'ai', actionType: 'showAiEventOverlay', config: { profile: 'intro' } }, input);
    assert.equal(sent[0][1], 'aievent-intro');
    assert.equal(sent[0][0].meta.reward, 'intro');
    assert.equal(sent[0][0].meta.aiEventOverlay.profile, 'intro');
    assert.equal(sent[0][0].donoValue, 0);
    assert.equal(JSON.stringify(input), before);
    assert.equal(result.modified, false);
    await sys.executeAction({ id: 'ai', actionType: 'showAiEventOverlay', config: {} }, { ...input, meta: 7 });
    assert.equal(sent[1][0].meta.value, 7);
    sys.pointsSystem = { spendPoints: async () => ({ success: false, message: 'Insufficient points' }) };
    const declined = await sys.executeAction({ id: 'spend', actionType: 'spendPoints', config: { amount: 100 } }, input);
    assert.equal(declined.blocked, true);
});
