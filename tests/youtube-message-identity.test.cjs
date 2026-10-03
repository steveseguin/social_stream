'use strict';

// Offline fixtures execute the shipped API, bridge and dock deletion handlers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../sources/websocket/youtube.html'), 'utf8');

function section(text, start, end) {
    const first = text.indexOf(start);
    const last = text.indexOf(end, first + start.length);
    assert.ok(first >= 0 && last > first, 'Missing source anchors: ' + start);
    return text.slice(first, last);
}
function extract(text, name) {
    if (name === 'processSuperChat') return section(text, '    function processSuperChat(', '\tfunction processYouTubeGift(');
    const match = text.match(new RegExp('^([ \\t]*)(?:async )?function ' + name + '\\([^]*?^\\1}', 'm'));
    assert.ok(match, name + ' must exist');
    return match[0];
}

function fixture() {
    const queued = [], events = [], errors = [], listeners = {}, packets = [];
    const c = vm.createContext({
        console: { log() {}, warn() {}, error(...args) { errors.push(args.map(String).join(' ')); } },
        Date, settings: { textonlymode: true }, youtubeShorts: false,
        youtubeRecommendedInterval: 5000, lastSuccessfulPollTime: 0,
        initialBacklogProcessing: false, initialBacklogTimestamp: null,
        nextPageToken: null, LIVE_CHAT_MAX_RESULTS: 500,
        consecutiveMaxMessages: 0, consecutiveEmptyPolls: 0, quickPollCount: 0, slowerPollingMode: false,
        currentStream: null, videoId: null, liveChatId: 'offline-chat', isPageVisible: false,
        currentSourceName: '', currentSourceImage: '',
        queueMessage: message => queued.push(message),
        document: { getElementById: () => ({ setAttribute() {} }), querySelector: () => null },
        strictEscapeHtml: text => text, escapeHtml: text => text,
        getTranslation: (_key, fallback) => fallback,
        chooseTranslatedAlertText: (fallback, text) => text || fallback, addEvent() {},
        deletedYouTubeMessageIds: new Set(), pendingYouTubeMessages: new Set(),
        cancelledYouTubeMessages: new WeakSet(), messageQueue: [], pendingRelayMessages: [],
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
        window: {
            addEventListener(type, listener) { listeners[type] = listener; },
            dispatchEvent(event) { events.push(event); if (listeners[event.type]) listeners[event.type](event); }
        },
        extensionRelayQueue: [], isProcessingExtensionQueue: true,
        chrome: { runtime: { id: 'offline', sendMessage(_id, data, callback) { packets.push(data); callback(); } } },
        setTimeout() {}, clearTimeout() {}, clearInterval() {}, activeTimeouts: new Set(),
        releaseYouTubeBroadcastMonitorLease() {}, stopLiveChatStream() {}, stopRecentSubscriberPolling() {},
        stopStreamStatsPolling() {}, resetViewerCountFallbackState() {}, clearChannelEmojiEntries() {},
        resetRichChatCache() {}, clearSourceIdentity() {},
        channelStatsInterval: null, fetchTimeout: null, queueDrainTimeout: null,
        lastKnownViewers: null, lastKnownLikes: null, lastLikesEmitTime: 0,
        channelEmojiFetchToken: 0, channelEmojiAssetsReady: true
    });
    vm.runInContext(section(source, 'var lastMessageTime = null;', 'var liveChatId = null;'), c);
    const names = ['normalizeLiveChatType', 'normalizeLiveChatMessageItem', 'normalizeYouTubeApiKeys',
        'normalizeLiveChatStreamPayload', 'parseYouTubeGiftInteger', 'extractYouTubeGiftMetadata',
        'processLiveChatResponseData', 'forwardYouTubeDelete', 'processSuperChat', 'processSuperSticker',
        'processYouTubeGift', 'pushMessage', 'applySourceIdentity', 'preserveKnownModerator', 'clearPolling'];
    // Let the same behavior fixtures run against the pre-fix page for the failure control.
    if (source.includes('function shouldProcessLiveChatItem(')) names.push('shouldProcessLiveChatItem');
    vm.runInContext(names.map(name => extract(source, name)).join('\n'), c);
    const bridge = fs.readFileSync(path.join(__dirname, '../sources/websocket/youtube.js'), 'utf8');
    vm.runInContext(section(bridge, "window.addEventListener('youtubeMessage'", "window.addEventListener('youtubeVideoChanged'"), c);
    return {
        c, queued, events, errors, packets,
        async response(items, streaming = false) {
            const response = { items, pollingIntervalMillis: 5000 };
            await c.processLiveChatResponseData(streaming ? c.normalizeLiveChatStreamPayload(response) : response);
            assert.deepEqual(errors, [], 'Production handlers must not swallow an error');
        },
        messages: () => events.filter(event => event.type === 'youtubeMessage').map(event => event.detail)
    };
}

function message(id, publishedAt = '2026-10-02T12:00:00.123Z', snippet = {}) {
    return { id, snippet: { type: 'textMessageEvent', publishedAt, displayMessage: id || 'no ID', ...snippet },
        authorDetails: { displayName: 'Viewer', channelId: 'viewer-id', profileImageUrl: '', isChatModerator: true } };
}
function paid(id, kind) {
    const snippets = {
        superchat: { type: 'superChatEvent', superChatDetails: { amountDisplayString: '$5.00', userComment: 'Thanks!', tier: 1 } },
        supersticker: { type: 'superStickerEvent', superStickerDetails: { amountDisplayString: '$2.00', superStickerMetadata: { stickerId: 'sticker', altText: 'Wave' } } },
        jeweldonation: { type: 'giftEvent', giftEventDetails: { giftMetadata: { giftName: 'Rose', jewelsAmount: 10, comboCount: 1 } } }
    };
    return message(id, undefined, snippets[kind]);
}
function deletion(id, kind = 'messageDeletedEvent') {
    return { id: 'moderation-' + id, snippet: { type: kind,
        ...(kind === 'messageRetractedEvent' ? { messageRetractedDetails: { retractedMessageId: id } } : { messageDeletedDetails: { deletedMessageId: id } }) } };
}

for (const streaming of [false, true]) {
    test((streaming ? 'Streaming' : 'Polling') + ' keeps distinct native IDs at equal and sub-millisecond timestamps', async () => {
        const f = fixture();
        const items = [message('one'), message('two'), message('three', '2026-10-02T12:00:00.123100Z'), message('four', '2026-10-02T12:00:00.123900Z')];
        await f.response(items, streaming);
        await f.response([items[3], message('five', items[3].snippet.publishedAt)], streaming);
        assert.deepEqual(f.queued.map(row => row.messageId), ['one', 'two', 'three', 'four', 'five']);
        await f.response(items, streaming);
        assert.equal(f.queued.length, 5, 'An overlapping response must not replay native IDs');
    });
}

test('Out-of-order native IDs do not move the no-ID timestamp fallback backwards', async () => {
    const f = fixture();
    await f.response([message('newest', '2026-10-02T12:00:02Z'), message('older', '2026-10-02T12:00:01Z')]);
    await f.response([message(null, '2026-10-02T12:00:01.500Z'), message(null, '2026-10-02T12:00:02Z'), message(null, '2026-10-02T12:00:03Z')]);
    await f.response([message('newest', '2026-10-02T12:00:04Z')]);
    assert.deepEqual(f.queued.map(row => row.messageId), ['newest', 'older', null]);
    assert.equal(f.c.lastMessageTime.toISOString(), '2026-10-02T12:00:03.000Z');
});

test('No-ID messages retain strict timestamp fallback and invalid rows do not consume identity', async () => {
    const f = fixture();
    const missingAuthor = message('incomplete');
    delete missingAuthor.authorDetails;
    await f.response([missingAuthor, message('invalid', 'not-a-date'), message(null), message(undefined), message('invalid'), message('incomplete')]);
    assert.deepEqual(f.queued.map(row => row.messageId), [null, 'invalid', 'incomplete']);
});

test('Initial backlog IDs stay suppressed across the final page and a replay', async () => {
    const f = fixture();
    f.c.initialBacklogProcessing = true;
    f.c.LIVE_CHAT_MAX_RESULTS = 3;
    const backlog = [message('old-one'), message('old-two'), paid('old-paid', 'superchat')];
    await f.response(backlog);
    assert.equal(f.c.initialBacklogProcessing, true);
    await f.response([message('old-page-two', '2026-10-02T11:59:59Z')]);
    assert.equal(f.c.initialBacklogProcessing, false);
    await f.response(backlog.concat(message('live', '2026-10-02T12:00:01Z')));
    assert.deepEqual(f.queued.map(row => row.messageId), ['live']);
    assert.equal(f.messages().length, 0, 'Backlog paid events must not alert');
});

test('Gift combo revisions sharing a native ID emit once each, including older revision replays', async () => {
    const f = fixture();
    const first = paid('combo', 'jeweldonation');
    const next = structuredClone(first);
    next.snippet.giftEventDetails.giftMetadata.comboCount = 2;
    await f.response([first, first, next, next, first]);
    assert.equal(f.messages().length, 2, 'A new combo count is a revision, not a duplicate ID');
    const streamNext = { id: 'combo', snippet: { type: 'GIFT_EVENT', published_at: first.snippet.publishedAt,
        display_message: first.snippet.displayMessage,
        gift_event_details: { gift_metadata: { gift_name: 'Rose', jewels_amount: '10', combo_count: 2 } } },
        author_details: { display_name: 'Viewer', channel_id: 'viewer-id', is_chat_moderator: true } };
    await f.response([streamNext], true);
    assert.equal(f.messages().length, 2, 'Equivalent polling and streaming revisions deduplicate');
});

test('Startup cutoff still suppresses evicted backlog IDs and its equal-time boundary', async () => {
    const f = fixture();
    f.c.initialBacklogProcessing = true;
    const limit = vm.runInContext('MAX_SEEN_LIVE_CHAT_ITEMS', f.c);
    const backlog = Array.from({ length: limit + 3 }, (_, index) => message('old-' + index));
    await f.response(backlog);
    await f.response([]);
    assert.equal(f.c.initialBacklogProcessing, false);
    const live = Array.from({ length: limit + 3 }, (_, index) => message('live-' + index, '2026-10-02T12:00:01Z'));
    await f.response(live);
    await f.response([backlog[0], backlog[limit + 2], paid('old-paid', 'superchat'), message('unseen-at-cutoff')]);
    assert.equal(f.queued.length, live.length);
    assert.ok(f.queued.every(row => row.messageId.startsWith('live-')));
    assert.equal(f.messages().length, 0, 'Evicted backlog paid items must not alert');
});

test('Native identity history is bounded and clearPolling resets it for a new session', async () => {
    const f = fixture();
    const limit = vm.runInContext('MAX_SEEN_LIVE_CHAT_ITEMS', f.c);
    assert.equal(limit, 2000);
    await f.response(Array.from({ length: limit + 3 }, (_, index) => message('message-' + index)));
    assert.equal(vm.runInContext('seenLiveChatItems.size', f.c), limit);
    await f.response([message('message-' + (limit + 2))]);
    assert.equal(f.queued.length, limit + 3);
    f.c.clearPolling();
    assert.equal(vm.runInContext('seenLiveChatItems.size', f.c), 0);
    assert.equal(f.c.lastMessageTime, null);
    await f.response([message('message-' + (limit + 2))]);
    assert.equal(f.queued.length, limit + 4);
});

for (const kind of ['superchat', 'supersticker', 'jeweldonation']) {
    test(kind + ' carries native identity through API delivery and queued native deletion', async () => {
        const f = fixture();
        await f.response([paid('paid-id', kind)]);
        const [payload] = f.messages();
        assert.equal(payload.event, kind);
        assert.equal(payload.meta && payload.meta.messageId, 'paid-id');
        assert.equal(payload.mod, true, 'Moderator metadata survives');
        assert.equal(f.c.extensionRelayQueue.length, 1);
        await f.response([deletion('paid-id')]);
        assert.equal(f.c.extensionRelayQueue.length, 0, 'The native delete removes paid support still awaiting relay');
        assert.equal(f.packets[0].delete.meta.messageId, 'paid-id');
        if (kind === 'jeweldonation') assert.equal(payload.meta.youtubeGift.jewelsAmount, 10);
    });

    test(kind + ' stays suppressed when its native deletion arrives before the paid item', async () => {
        const f = fixture();
        await f.response([deletion('already-deleted'), paid('already-deleted', kind)]);
        assert.equal(f.messages().length, 0);
        assert.equal(f.c.extensionRelayQueue.length, 0);
    });

    test(kind + ' without a native ID keeps its original payload shape', async () => {
        const f = fixture();
        await f.response([paid(undefined, kind)]);
        const [payload] = f.messages();
        assert.equal(payload.event, kind);
        assert.equal(payload.meta && payload.meta.messageId, undefined);
        assert.equal(Object.hasOwn(payload, 'meta'), kind === 'jeweldonation');
    });

    test(kind + ' native retraction removes the matching rendered dock row only', async () => {
        const f = fixture();
        await f.response([paid('rendered-id', kind)]);
        const target = f.messages()[0];
        const kept = { ...target, meta: { ...target.meta, messageId: 'keep-id' } };
        function row(payload, id) {
            return { rawContents: payload, dataset: { mid: id, sourceType: 'youtube' },
                removed: false, remove() { this.removed = true; }, matches: () => true };
        }
        const rows = [row(target, 'dock-1'), row(kept, 'dock-2')];
        const dock = vm.createContext({
            document: { querySelectorAll: () => rows }, selectedQueue: [], autoShowQueue: [],
            historyMissedLiveBuffer: [], queue: [{ contents: target }, { contents: kept }], messageBuffer: [],
            showDeleted: false, dataAttributeSelector: (name, value) => '[' + name + '="' + value + '"]',
            updateQueueButton() {}
        });
        const dockSource = fs.readFileSync(path.join(__dirname, '../dock.html'), 'utf8').replace(/\r\n/g, '\n');
        vm.runInContext(['deleteMessages', 'getNativeSourceControlMessageId'].map(name => extract(dockSource, name)).join('\n'), dock);
        await f.response([deletion('rendered-id', 'messageRetractedEvent')]);
        dock.deleteMessages(f.packets[0]);
        assert.equal(rows[0].removed, true);
        assert.equal(rows[1].removed, false);
        assert.equal(dock.queue.length, 1);
        assert.equal(dock.queue[0].contents.meta.messageId, 'keep-id');
    });
}
