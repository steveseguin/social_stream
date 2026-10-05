const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const background = read('background.js');
function extract(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `Missing ${name}`);
    let depth = 0;
    for (let i = source.indexOf('{', start); i < source.length; i++) {
        if (source[i] === '{') depth++;
        if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
    }
    throw new Error(`Cannot extract ${name}`);
}

test('Hype counts distinct accounts sharing a display name only once each', () => {
    const ctx = vm.createContext({ settings: { hypemode: true }, users: {}, hype: {}, hypeInterval: 1,
        combineHypeData() {}, sendHypeP2P() {} });
    vm.runInContext(extract(background, 'processHype'), ctx);
    for (const userid of ['UC111', 'UC222', 'UC111']) {
        ctx.processHype({ type: 'youtube', chatname: 'Alex', userid });
    }
    ctx.processHype({ type: 'youtube', userid: 'UC333', event: 'user_banned' });
    assert.equal(ctx.hype.youtube, 2);
});

test('Waitlist keeps distinct accounts and allows a removed account to rejoin', () => {
    const ctx = vm.createContext({ settings: {}, allowNewEntries: true, waitListUsers: {}, waitlist: [],
        drawListCount: 0, extractWaitlistMessage: () => '', sendWaitlistConfig() {}, console });
    vm.runInContext(extract(background, 'processWaitlist') + '\n' + extract(background, 'forgetWaitlistUser'), ctx);
    const a = { type: 'youtube', chatname: 'Alex', userid: 'UC111', chatmessage: '!join' };
    const b = { ...a, userid: 'UC222' };
    ctx.processWaitlist(a);
    ctx.processWaitlist(b);
    ctx.processWaitlist(a);
    assert.equal(ctx.waitlist.length, 2);
    ctx.forgetWaitlistUser(a);
    ctx.waitlist.splice(0, 1);
    ctx.processWaitlist(a);
    assert.equal(ctx.waitlist.length, 2);
});

test('Mixed Stream Deck and legacy SDK peers both receive the feed without duplicate sends', () => {
    const sends = [];
    const ctx = vm.createContext({ settings: {}, iframe: null, connectedPeers: {}, socketserverDock: null,
        getOverlayDisplayPayload: x => x, getSettingFlag: () => false, markP2PFailure() {}, console,
        ninjaBridge: { isReady: () => true, getPeers: () => ({ deck: 'streamdeck', legacy: false }),
            send(data, id) { sends.push(id || 'broadcast'); }, sendToLabel(data, label) { sends.push(label); } } });
    vm.runInContext(extract(background, 'sendDataToStreamDeckPeersP2P') + '\n' + extract(background, 'sendDataP2P'), ctx);
    ctx.sendDataP2P({ chatname: 'Alex', chatmessage: 'hello', type: 'youtube' });
    assert.deepEqual(sends, ['streamdeck', 'legacy']);
});

test('Plain text reflection keys preserve comparisons and literal HTML', () => {
    const ctx = vm.createContext({});
    vm.runInContext(extract(background, 'normalizeMessageForTracking'), ctx);
    for (const value of ['2 < 3', 'hello <b>world</b>', '&lt;b&gt;', '<img alt="Wave">']) {
        assert.equal(ctx.normalizeMessageForTracking(value, true), value);
    }
});

test('VPZone text-only messages retain line breaks and literal markup', () => {
    const ctx = vm.createContext({ settings: { textonlymode: true }, escapeHtmlMaybe: x => x });
    vm.runInContext(extract(read('sources/vpzone.js'), 'renderWsMessage'), ctx);
    assert.equal(ctx.renderWsMessage('one\n<two>', {}), 'one\n<two>');
});

test('VPZone delivers chat while branding is pending', () => {
    const sent = [];
    const ctx = vm.createContext({ isExtensionOn: true, sourceName: 'fixture', sourceImg: '',
        sourceBrandPending: new Promise(() => {}), refreshSourceBranding: () => new Promise(() => {}),
        chrome: { runtime: { id: 'fixture', sendMessage(id, payload) { sent.push(payload.message); } } } });
    vm.runInContext(extract(read('sources/vpzone.js'), 'pushMessage'), ctx);
    ctx.pushMessage({ type: 'vpzone', chatmessage: 'hello' });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].sourceName, 'fixture');
});

for (const outcome of ['success', 'error', 'skipped']) {
test(`Desktop NeuroSync queue handles ${outcome} without advancing an unrelated utterance`, async () => {
    const source = read('tts.js');
    let finish, fail;
    const pending = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    let completed = 0;
    const TTS = { premiumSerial: 0, neuroSyncEnabled: true,
        getDesktopSystemTtsBridge: () => ({ systemTts: async () => ({ wavBuffer: new Uint8Array([1]) }) }),
        getVoiceOverride: () => '', sendToNeuroSync: () => pending,
        finishedAudio() { completed++; this.premiumQueueActive = false; }, updateButtonState() {},
        webSystemTTS() { throw new Error('Unexpected Web Speech fallback'); } };
    const ctx = vm.createContext({ TTS, Blob, console: { error() {} } });
    vm.runInContext(source.slice(source.indexOf('TTS.desktopSystemTTS ='), source.indexOf('TTS.pcm16ToWav =')) +
        source.slice(source.indexOf('TTS.playAudioBlob ='), source.indexOf('TTS.openAITTS =')), ctx);
    const operation = TTS.desktopSystemTTS('hello', {});
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(completed, 0);
    if (outcome === 'skipped') TTS.premiumSerial++;
    if (outcome === 'error') fail(new Error('Fixture service failure'));
    else finish();
    await operation;
    assert.equal(completed, outcome === 'skipped' ? 0 : 1);
    assert.equal(TTS.premiumQueueActive, outcome === 'skipped');
});
}

test('Thermal print diagnostics preserve chat fields and existing metadata', async () => {
    const ctx = vm.createContext({ window: {}, console });
    vm.runInContext(read('actions/EventFlowSystem.js') + '\nglobalThis.EFS = EventFlowSystem;', ctx);
    const flow = Object.create(ctx.EFS.prototype);
    flow.resolveThermalPrinter = () => null;
    const message = { type: 'youtube', chatname: 'Alex', chatmessage: 'hi', meta: { original: true } };
    const result = await flow.executeAction({ actionType: 'printThermal', config: {} }, message);
    assert.equal(result.message.thermalPrintResult, undefined);
    assert.equal(result.message.meta.original, true);
    assert.equal(result.message.meta.thermalPrintResult.code, 'SSAPP_PRINT_UNAVAILABLE');
    assert.equal(message.meta.thermalPrintResult, undefined);
    const counter = { event: 'viewer_update', type: 'youtube', meta: 25 };
    const counterResult = await flow.executeAction({ actionType: 'printThermal', config: {} }, counter);
    assert.equal(counterResult.message, counter);
    assert.equal(counterResult.modified, false);
    assert.equal(counterResult.message.meta, 25);
});

test('Twitch fallback lookups retain the account login when the display name changes', async () => {
    const message = { type: 'twitch', username: 'account_login', chatname: 'Member Name' };
    const ctx = vm.createContext({ message, data: message, encodeURIComponent,
        getPronounsNames: name => name });
    const pronounExpression = background.match(/let pronoun = await (getPronounsNames\([^;]+\));/)[1];
    assert.equal(vm.runInContext(pronounExpression, ctx), 'account_login');
    const avatarExpressions = Array.from(background.matchAll(/"https:\/\/api.socialstream.ninja\/twitch\/large\?username=" \+ encodeURIComponent\(([^;]+)\);/g));
    assert.equal(avatarExpressions.length, 4);
    for (const match of avatarExpressions) {
        assert.equal(vm.runInContext(match[1], ctx), 'account_login');
    }
});

test('History lookup uses the stored display name when no user ID is available', () => {
    const expression = background.match(/getMessagesDB\((request.value[^,]+), request.value.type/)[1];
    const ctx = vm.createContext({ request: { value: { username: 'shortname', chatname: 'ShortName' } } });
    assert.equal(vm.runInContext(expression, ctx), 'ShortName');
    ctx.request.value.userid = 'UC1234567890';
    assert.equal(vm.runInContext(expression, ctx), 'UC1234567890');
});

for (const enabled of [false, true]) for (const textOnly of [false, true]) for (const reply of [false, true]) {
test(`Twitch emotes: PluralMind=${enabled}, textOnly=${textOnly}, reply=${reply}`, async () => {
    const source = read('sources/websocket/twitch.js');
    const ctx = vm.createContext({ settings: { pluralmind: enabled, textonlymode: textOnly }, normalizedPayload: null,
        normalizedEventTypeLower: '', normalizedEventType: '', message: 'L: Kappa', user: 'account',
        userInfo: null, badgeList: [], parsedMessage: { tags: { emotes: '25:3-7' } },
        rememberTwitchDisplayName() {}, escapeHtml: x => x, markSubscriberAsMembership: false,
        document: { createElement: () => ({}), querySelector: () => ({ appendChild() {}, childNodes: [] }) },
        SSNPluralmindIntegration: {
            resolveMessage: async () => ({ name: 'Member', body: 'Kappa', cleanedMessage: 'Kappa' }),
            resolveRenderedMessage: async options => ({ name: 'Member', body: 'Kappa', cleanedMessage: options.message.replace(/^L: /, '') }),
            createPronounBadge: () => null
        }, console });
    vm.runInContext(read('shared/utils/twitchEmotes.js').replace(/^export /gm, '') +
        '\nfunction replaceEmotesWithImages(text, emotes) { return renderTwitchNativeEmotes(text, emotes, { textOnly: settings.textonlymode }); }', ctx);
    if (reply) ctx.parsedMessage.tags['reply-parent-msg-body'] = 'Parent';
    const code = source.slice(source.indexOf('const sourceDisplayName ='), source.indexOf('\n\t\tif (data.contentimg)', source.indexOf('const sourceDisplayName =')));
    const data = await vm.runInContext('(async () => {' + code + '; return data; })()', ctx);
    if (textOnly) {
        assert.equal(data.chatmessage, (reply ? 'Parent: ' : '') + (enabled ? '' : 'L: ') + 'Kappa');
    } else {
        assert.match(data.chatmessage, /<img [^>]*alt="Kappa"/);
        assert.equal(data.chatmessage.includes('L: '), !enabled);
        assert.equal(data.chatmessage.includes('<i><small>Parent:'), reply);
    }
    assert.equal(data.chatname, enabled ? 'Member' : 'account');
    assert.equal(data.username, 'account');
});
}
