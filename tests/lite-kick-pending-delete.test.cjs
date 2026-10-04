'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = process.env.SSN_SOURCE_ROOT || path.join(__dirname, '..');
const strip = source => source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '').replace(/^export\s+/gm, '');
function fixture() {
    const context = vm.createContext({ console, URL,
        window: { location: { origin: 'https://socialstream.ninja' }, addEventListener() {},
            setTimeout() { return 1; }, clearTimeout() {}, clearInterval() {} },
        storage: { get: (_key, fallback) => fallback, set() {}, remove() {} },
        getKickRoleBadge: () => null, safeHtml: value => String(value ?? ''), htmlToText: value => String(value ?? ''),
        getChatPreviewText: payload => payload.chatmessage || '', formatTime: () => ''
    });
    for (const file of ['providers/kick/core.js', 'lite/plugins/basePlugin.js', 'lite/plugins/kickPlugin.js']) {
        vm.runInContext(strip(fs.readFileSync(path.join(root, file), 'utf8')), context, { filename: file });
    }
    vm.runInContext('this.KickPlugin = KickPlugin', context);
    const messages = [], deletes = [], lookups = [], emotes = [];
    const plugin = new context.KickPlugin({ messenger: { send: p => messages.push(p), sendDelete: p => deletes.push(p) } });
    plugin.resolveSenderDetails = () => new Promise((resolve, reject) => lookups.push({ resolve, reject }));
    return { plugin, messages, deletes, lookups, emotes,
        holdEmotes() { plugin.emotes = { render: () => new Promise((resolve, reject) => emotes.push({ resolve, reject })) }; },
        emit(id = 'one') { return plugin.emitMessage({ id, sender: { username: 'Viewer' }, content: 'message ' + id }); },
        remove(id = 'one', event = 'App\\Events\\ChatMessageDeletedEvent') {
            plugin.handleWsMessage({ data: JSON.stringify({ event, data: { message_id: id } }) });
        }
    };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

for (const event of ['App\\Events\\ChatMessageDeletedEvent', 'App\\Events\\MessageDeletedEvent']) {
    test(event + ' cancels a message waiting for its profile', async () => {
        const f = fixture(), pending = f.emit(); f.remove('one', event);
        f.lookups[0].resolve({}); await pending;
        assert.equal(f.deletes.length, 1); assert.equal(f.messages.length, 0);
    });
}
for (const reject of [false, true]) {
    test('moderation cancels an emote wait even when enrichment ' + (reject ? 'fails' : 'succeeds'), async () => {
        const f = fixture(); f.holdEmotes(); const pending = f.emit();
        f.lookups[0].resolve({}); await flush(); assert.equal(f.emotes.length, 1);
        f.remove();
        if (reject) f.emotes[0].reject(new Error('Emote download failed'));
        else f.emotes[0].resolve('rendered');
        await pending; assert.equal(f.messages.length, 0);
    });
}

test('deleting one pending ID preserves another and published deletes still work', async () => {
    const f = fixture(), first = f.emit('one'), second = f.emit('two'); f.remove('one');
    f.lookups[0].resolve({}); f.lookups[1].resolve({}); await Promise.all([first, second]);
    assert.deepEqual(f.messages.map(p => p.id), ['kick-two']);
    f.remove('two'); assert.equal(f.deletes[1].id, 'kick-two');
});

test('ordinary messages are published once despite duplicate input', async () => {
    const f = fixture(), pending = f.emit(); await f.emit();
    assert.equal(f.lookups.length, 1); f.lookups[0].resolve({}); await pending;
    assert.equal(f.messages.length, 1); assert.equal(f.messages[0].chatmessage, 'message one');
});

for (const stop of ['disconnectWebsocket', 'disable']) {
    test(stop + ' prevents old work from affecting a new message with the same ID', async () => {
        const f = fixture(), old = f.emit(); f.plugin[stop]();
        const fresh = f.emit(); assert.equal(f.lookups.length, 2);
        f.lookups[0].resolve({}); await old;
        assert.equal(f.messages.length, 0);
        // Old finally cleanup must not unregister the fresh pending message.
        f.remove(); f.lookups[1].resolve({}); await fresh;
        assert.equal(f.messages.length, 0);
        assert.equal(f.plugin.pendingMessages.size, 0);
    });
}

test('a socket close cancels pending work and permits replay on reconnect', async () => {
    const f = fixture(), old = f.emit(); f.plugin.handleWsClose({ code: 1006 });
    const fresh = f.emit(); assert.equal(f.lookups.length, 2);
    f.lookups[1].resolve({}); await fresh; f.lookups[0].resolve({}); await old;
    assert.equal(f.messages.length, 1); assert.equal(f.plugin.pendingMessages.size, 0);
});

test('failed profile processing cleans up its pending record', async () => {
    const f = fixture(), pending = f.emit(); f.lookups[0].reject(new Error('Profile failed')); await pending;
    assert.equal(f.messages.length, 0); assert.equal(f.plugin.pendingMessages.size, 0);
});

test('numeric and string forms identify the same pending deletion', async () => {
    const f = fixture(), pending = f.emit(123); f.remove('123');
    f.lookups[0].resolve({}); await pending; assert.equal(f.messages.length, 0);
});

test('transport reconnect does not replay a message already moderated', async () => {
    const f = fixture(), pending = f.emit(); f.remove(); f.plugin.disconnectWebsocket();
    await f.emit(); assert.equal(f.lookups.length, 1);
    f.lookups[0].resolve({}); await pending; assert.equal(f.messages.length, 0);
});

test('a stale emote completion cannot publish or unregister a new same-ID message', async () => {
    const f = fixture(); f.holdEmotes(); const old = f.emit();
    f.lookups[0].resolve({}); await flush(); f.plugin.disconnectWebsocket();
    const fresh = f.emit(); f.lookups[1].resolve({}); await flush();
    f.emotes[0].resolve('old'); await old; f.remove();
    f.emotes[1].resolve('new'); await fresh;
    assert.equal(f.messages.length, 0); assert.equal(f.plugin.pendingMessages.size, 0);
});

test('published rows keep deduplication if disconnect happens before finally cleanup', async () => {
    const f = fixture(); f.plugin.onActivity = event => { if (event.kind === 'event') f.plugin.disconnectWebsocket(); };
    const pending = f.emit(); f.lookups[0].resolve({}); await pending; await f.emit();
    assert.equal(f.messages.length, 1); assert.equal(f.lookups.length, 1);
});
