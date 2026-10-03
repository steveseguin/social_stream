'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const source = fs.readFileSync(path.join(root, 'sources/websocket/twitch.js'), 'utf8');
const functions = ['processMessage', 'pushDeleteMessage', 'attachTmiModerationDeleteHandlers'].map(name => {
    const match = source.match(new RegExp('^\t(?:async )?function ' + name + '\\([^]*?^\t}', 'm'));
    assert.ok(match, name);
    return match[0];
}).join('\n');

async function check(stage, deletion) {
    let unblock, reached;
    const blocked = new Promise(resolve => { unblock = resolve; });
    const waiting = new Promise(resolve => { reached = resolve; });
    const messages = [], deletes = [], handlers = new Map();
    const rows = {childNodes: [], appendChild(node) { this.childNodes.push(node); }};
    const settings = {textonlymode: true, delaytwitch: stage === 'delay', pluralmind: stage === 'pluralmind'};
    async function pause() { reached(); await blocked; }
    const sandbox = vm.createContext({
        console: {log() {}, error(error) { throw error; }}, settings,
        pendingTwitchMessages: new Set(), channel: 'fixture',
        TWITCH_DELAYTWITCH_MS: 3000, TWITCH_DELETE_DELAY_BUFFER_MS: 50,
        setTimeout(callback, delay) { if (delay === 3000) pause().then(callback); },
        normalizeTwitchLogin: name => String(name || '').toLowerCase(),
        pickSourceControlMessageId: value => value,
        getRememberedTwitchDisplayName: name => name,
        getTwitchMessageText: (normalized, text) => text,
        getUserInfo: async () => { if (stage === 'lookup') await pause(); return {display_name: 'Fixture'}; },
        getTwitchMessageSourceInfo: async () => ({}),
        parseBadges: () => [], escapeHtml: text => text,
        replaceEmotesWithImages: text => text, rememberTwitchDisplayName() {},
        SSNPluralmindIntegration: {
            async resolveRenderedMessage() { await pause(); return null; }
        },
        document: {createElement: () => ({}), querySelector: () => rows},
        pushMessage: message => messages.push(message), sendDeleteMessage: message => deletes.push(message)
    });
    vm.runInContext(functions, sandbox);
    sandbox.attachTmiModerationDeleteHandlers({on: (name, callback) => handlers.set(name, callback)});
    const pending = sandbox.processMessage({prefix: 'viewer!fixture', params: ['#fixture'], tags: {id: 'message-1'}, trailing: 'Hello'});
    await waiting;
    assert.equal(sandbox.pendingTwitchMessages.size, 1);
    if (deletion === 'id') handlers.get('messagedeleted')('#fixture', 'viewer', 'Hello', {'target-msg-id': 'message-1'});
    if (deletion === 'ban') handlers.get('ban')('#fixture', 'VIEWER');
    if (deletion === 'timeout') handlers.get('timeout')('#fixture', 'viewer');
    if (deletion === 'other') handlers.get('messagedeleted')('#fixture', 'other', 'Other', {'target-msg-id': 'message-2'});
    unblock();
    await pending;
    assert.equal(sandbox.pendingTwitchMessages.size, 0, 'Pending records are cleaned up');
    assert.equal(messages.length, deletion === 'other' ? 1 : 0, stage + '/' + deletion);
    assert.equal(rows.childNodes.length, messages.length, 'Deleted pending messages are not rendered locally');
    assert.equal(deletes.length, 1, 'Moderation deletion is still forwarded');
    if (messages.length) assert.equal(messages[0].chatmessage, 'Hello');
}

(async () => {
    for (const stage of ['lookup', 'delay', 'pluralmind']) {
        for (const deletion of ['id', 'ban', 'timeout', 'other']) await check(stage, deletion);
    }
    console.log('PASS Twitch pending moderation during profile lookup, delay and PluralMind; unrelated messages remain deliverable.');
})().catch(error => {console.error(error); process.exitCode = 1;});
