const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Exercise the shipped handlers with controlled avatar/badge timing, without live services.
function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}
function extract(source, name) {
  const match = source.match(new RegExp('^([ \\t]*)(?:async )?function ' + name + '\\([^]*?^\\1}', 'm'));
  assert.ok(match, name + ' must exist');
  return match[0];
}
function install(context, source, names) {
  vm.runInContext(names.map(name => extract(source, name)).join('\n'), context);
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function runtime(packets) {
  return { runtime: { id: 'fixture', sendMessage(_id, packet, callback) {
    packets.push(packet);
    if (callback) callback({ id: 123 });
  } } };
}
function fixtureConsole(errors) {
  return { log() {}, warn() {}, error(...args) { errors.push(args.map(String).join(' ')); } };
}

for (const mode of ['Old', 'New']) {
  test('Kick DOM ' + mode + ' cancels deletion during avatar lookup', async () => {
    const source = read('sources/kick.js'), packets = [], errors = [];
    const avatar = deferred();
    let lookupStarted = false;
    const author = { innerText: 'Viewer', style: { color: '' } };
    function row() {
      return {
        isConnected: true, dataset: {}, removed: false, nativeId: 'deleted',
        querySelector(selector) {
          if (selector === '.line-through') return this.removed ? {} : null;
          if (selector === '.chat-entry-username') return author;
          if (selector === '.chat-message-identity') return { querySelectorAll: () => [] };
          return null;
        },
        querySelectorAll: () => []
      };
    }
    const c = vm.createContext({
      settings: { textonlymode: true, excludeReplyingTo: true }, kickUsername: 'channel',
      channelImg: '', processedMessages: new Set(), chrome: runtime(packets),
      console: fixtureConsole(errors), kickDebugLog() {}, getKickDebugRowInfo: () => ({}),
      getKickUsernameButton: () => author, getKickMessageKey: ele => ele.nativeId,
      getKickMessageContainer: ele => ele, hasKickDeletedLabel: () => false,
      getKickDeleteChatname: () => 'Viewer', getKickTrackedMessageId: () => null,
      rememberKickTrackedMessageId() {}, getKickMessageText: () => 'Original message',
      escapeHtml: value => value, normalizeKickChatname: value => value,
      rememberKickProcessedMessage(id) { c.processedMessages.add(id); },
      collectKickBadges: () => ({ chatbadges: [], member: false, mod: false }),
      getKickAvatarImage() { lookupStarted = true; return avatar.promise; },
      looksLikeKickRewardMessage: () => false
    });
    install(c, source, ['processMessage' + mode, 'deleteThis', 'isDeletedKickMessage', 'clearKickProcessingState']);
    const target = row();
    const pending = c['processMessage' + mode](target);
    assert.equal(lookupStarted, true);
    target.removed = true;
    c.deleteThis(target);
    avatar.resolve('');
    await pending;
    assert.equal(packets.filter(p => p.delete).length, 1);
    assert.equal(packets.filter(p => p.message).length, 0, 'A deleted row must not be sent after lookup');
    assert.equal(target.dataset.ssProcessingKey, undefined, 'A cancelled row must release its processing state');
    target.removed = false;
    target.nativeId = 'later';
    await c['processMessage' + mode](target);
    assert.equal(packets.filter(p => p.message).length, 1, 'Later messages from the same user still work');
    assert.equal(packets.find(p => p.message).message.chatmessage, 'Original message');
    assert.deepEqual(errors, []);
  });
}

test('YouTube DOM cancels deletion during its placeholder-avatar wait', async () => {
  const source = read('sources/youtube.js'), packets = [], errors = [];
  const avatar = deferred();
  let lookupStarted = false;
  const author = { innerText: 'Viewer', classList: { contains: () => false } };
  const text = { textContent: 'Original message', cloneNode() { return this; }, querySelectorAll: () => [] };
  function row(id) {
    return {
      id: id + '-native-message-id-longer-than-forty-characters',
      tagName: 'YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER',
      style: { getPropertyValue: () => '' }, isConnected: true, dataset: {}, removed: false,
      hasAttribute(name) { return name === 'is-deleted' && this.removed; },
      querySelector(selector) {
        if (selector === '#author-name') return author;
        if (selector === '#message, .seventv-yt-message-content') return text;
        if (selector === '#img[src], #author-photo img[src]') return { src: 'data:image/gif;base64,placeholder' };
        return null;
      },
      querySelectorAll: () => []
    };
  }
  const c = vm.createContext({
    settings: { textonlymode: true, excludeReplyingTo: true }, youtubeShorts: false,
    messageHistory: new Set(), avatarHistory: new Map(), channelName: '', channelThumbnail: '', videoId: '',
    EMOTELIST: false, BTTV: false, SEVENTV: false, FFZ: false, chrome: runtime(packets),
    delay() { lookupStarted = true; return avatar.promise; }, escapeHtml: value => value,
    getAllContentNodes: node => node ? node.textContent : '', getYouTubeDonationAmount: () => '',
    document: { querySelector: () => null }, isHTMLElement: () => false, isObject: () => false,
    console: fixtureConsole(errors)
  });
  install(c, source, ['processMessage', 'deleteThis', 'isYouTubePaidChatNode']);
  const target = row('deleted'), pending = c.processMessage(target);
  assert.equal(lookupStarted, true);
  target.removed = true;
  c.deleteThis(target);
  avatar.resolve();
  await pending;
  assert.equal(packets.filter(p => p.delete).length, 1);
  assert.equal(packets.filter(p => p.message).length, 0);
  await c.processMessage(row('later'));
  assert.equal(packets.filter(p => p.message).length, 1);
  assert.equal(packets.find(p => p.message).message.chatmessage, 'Original message');
  assert.deepEqual(errors, []);
});

test('Kick websocket cancels matching pending messages without blocking later chat', async () => {
  const source = read('sources/websocket/kick.js'), packets = [], errors = [], preview = [], echoes = [];
  const avatar = deferred();
  const c = vm.createContext({
    console: fixtureConsole(errors), settings: {}, window: {}, state: {}, pendingKickMessages: new Set(),
    gatherProfileState: sender => ({ profile: { displayName: sender && sender.username || '' }, ids: {} }),
    pickDisplayName: values => values.find(Boolean) || '', collectBadgesFromSources: () => [],
    formatBadgesForDisplay: () => [], pickImage: () => '', queueAvatarLookup: () => avatar.promise,
    delay: () => new Promise(() => {}), AVATAR_LOOKUP_TIMEOUT_MS: 650,
    collectNameColorFromSources: () => '', resolvePendingKickChatEcho(id) { echoes.push(id); },
    renderKickMessageHtml: (_message, content) => content, resolveChannelBranding: () => ({}),
    extractChatDonationLabel: () => '', mapKickChatEventToSocialStream: () => '',
    extractReplyDetails: () => null, isTextOnlyMode: () => true, rememberKickChatMessage() {},
    normalizeKickMessageId: value => String(value),
    pushMessage: message => packets.push({ message }),
    appendChatFeedMessage: message => preview.push(message), log() {}, isElectronEnvironment: () => false,
    sendRuntimeMessageFireAndForget: packet => { packets.push(packet); return true; },
    createBridgeMeta: () => ({}), bridgeEventMatchesCurrentChannel: () => true
  });
  install(c, source, ['pickFirstString', 'extractMessageContent', 'extractFragmentText', 'forwardChatMessage',
    'forwardDeletedMessage', 'pushDeleteMessage', 'processBridgeEvent']);
  function add(id, username = 'Viewer') {
    return c.forwardChatMessage({ id, content: id, sender: { username } });
  }
  const pending = [add('deleted'), add('same-user-kept'), add('other-kept', 'Other')];
  c.processBridgeEvent({ type: 'chat.message.deleted', body: { message: { id: 'deleted' } } });
  avatar.resolve('');
  await Promise.all(pending);
  assert.deepEqual(packets.filter(p => p.message).map(p => p.message.id), ['same-user-kept', 'other-kept']);
  assert.deepEqual(preview.map(p => p.id), ['same-user-kept', 'other-kept']);
  assert.ok(echoes.includes('deleted'), 'Moderated outgoing echoes must still acknowledge the send');
  assert.equal(c.pendingKickMessages.size, 0);
  c.pushDeleteMessage({ type: 'kick', id: 'same-user-kept' });
  assert.equal(packets[packets.length - 1].delete.id, 'same-user-kept');

  const nextAvatar = deferred();
  c.queueAvatarLookup = () => nextAvatar.promise;
  const userPending = [add('user-deleted'), add('other-user-kept', 'Other')];
  c.pushDeleteMessage({ type: 'kick', chatname: 'Viewer' });
  nextAvatar.resolve('');
  await Promise.all(userPending);
  assert.equal(packets.some(p => p.message && p.message.id === 'user-deleted'), false);
  assert.equal(packets.some(p => p.message && p.message.id === 'other-user-kept'), true);
  await add('later');
  assert.equal(packets[packets.length - 1].message.id, 'later');
  assert.equal(c.pendingKickMessages.size, 0);
  assert.deepEqual(errors, []);
});

function youtubeFixture(retry) {
  const source = read('sources/websocket/youtube.html'), events = [], timers = [], errors = [];
  let ready = false;
  const c = vm.createContext({
    console: fixtureConsole(errors), settings: { textonlymode: true, excludeReplyingTo: true },
    youtubeShorts: false, messageQueue: [], deletedYouTubeMessageIds: new Set(),
    pendingYouTubeMessages: new Set(), cancelledYouTubeMessages: new WeakSet(),
    isPageVisible: false, currentStream: null, videoId: null, currentSourceName: '', currentSourceImage: '',
    youtubeRecommendedInterval: 5000, lastSuccessfulPollTime: 0, initialBacklogProcessing: false, initialBacklogTimestamp: null,
    seenLiveChatItems: new Set(), MAX_SEEN_LIVE_CHAT_ITEMS: 2000,
    lastMessageTime: null, nextPageToken: null, LIVE_CHAT_MAX_RESULTS: 500,
    consecutiveMaxMessages: 0, consecutiveEmptyPolls: 0, slowerPollingMode: false, quickPollCount: 0,
    document: { getElementById: () => ({ setAttribute() {} }) }, extractYouTubeGiftMetadata: () => null,
    getRichMessageForMessageData: () => null,
    getRichBadgesForMessageData: () => ready ? [{ type: 'text', text: 'Member' }] : [],
    messageDataNeedsRichChannelEmojiResolution: () => retry === 'emoji' && !ready,
    RICH_BADGE_RETRY_DELAYS_MS: [100, 500, 1200], CHANNEL_EMOJI_RICH_RETRY_DELAYS_MS: [600, 1400],
    setTrackedTimeout: callback => { timers.push(callback); return timers.length; },
    replaceEmojis: value => value, strictEscapeHtml: value => value, stripHtmlContent: value => value,
    rememberChannelName() {}, rememberChatMessage() {}, repliesAreExcluded: () => true, addEvent() {},
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    window: { dispatchEvent: event => events.push({ type: event.type, detail: event.detail }) }
  });
  install(c, source, ['normalizeLiveChatType', 'normalizeLiveChatMessageItem', 'shouldProcessLiveChatItem', 'processLiveChatResponseData',
    'forwardYouTubeDelete', 'processYouTubeUserBanned', 'normalizeYouTubeBanType', 'normalizeYouTubeBanDurationSeconds',
    'queueMessage', 'messageDataNeedsRichBadgeResolution', 'queueMessageAfterRichBadgeRetry',
    'queueMessageAfterRichEmojiRetry', 'continueQueuedMessageAfterRichEmojiResolution',
    'processQueuedMessageData', 'processMessage', 'pushMessage', 'applySourceIdentity']);
  return {
    c, events, timers, errors, ready() { ready = true; },
    add(id, user = 'Viewer', time = '00') {
      return c.processLiveChatResponseData({ items: [{
        id, snippet: { type: 'textMessageEvent', publishedAt: '2026-10-02T12:00:' + time + 'Z', displayMessage: id },
        authorDetails: { displayName: user, channelId: user + '-id', isChatSponsor: true }
      }] });
    },
    chatIds() {
      return events.filter(e => e.type === 'youtubeMessage' && !e.detail.event).map(e => e.detail.meta.messageId);
    }
  };
}

for (const retry of ['badge', 'emoji']) {
  for (const kind of ['delete', 'retract', 'ban', 'timeout']) {
    const existingProtection = kind === 'delete' || kind === 'retract';
    test('YouTube API ' + kind + ' suppresses ' + retry + ' retry output' + (existingProtection ? ' (existing behavior)' : ''), async () => {
      const f = youtubeFixture(retry);
      await f.add('target');
      await f.add('other-user', 'Other', '01');
      assert.equal(f.timers.length, 2);
      assert.equal(f.events.length, 0);
      if (kind === 'delete' || kind === 'retract') {
        const details = kind === 'delete' ? 'messageDeletedDetails' : 'messageRetractedDetails';
        const idKey = kind === 'delete' ? 'deletedMessageId' : 'retractedMessageId';
        await f.c.processLiveChatResponseData({ items: [{ id: 'moderation', snippet: {
          type: kind === 'delete' ? 'messageDeletedEvent' : 'messageRetractedEvent',
          [details]: { [idKey]: 'target' }
        } }] });
      } else {
        await f.c.processLiveChatResponseData({ items: [{ id: 'moderation', snippet: {
          type: 'userBannedEvent', publishedAt: '2026-10-02T12:00:02Z',
          userBannedDetails: { banType: kind === 'ban' ? 'permanent' : 'temporary',
            banDurationSeconds: kind === 'timeout' ? 30 : undefined,
            bannedUserDetails: { displayName: 'Viewer', channelId: 'Viewer-id' } }
        } }] });
      }
      f.ready();
      while (f.timers.length) await f.timers.shift()();
      assert.deepEqual(f.chatIds(), ['other-user']);
      assert.equal(f.events.filter(e => e.type === 'youtubeDelete').length, 1);
      assert.equal(f.c.pendingYouTubeMessages.size, 0);
      await f.add('later', 'Viewer', '03');
      assert.deepEqual(f.chatIds(), ['other-user', 'later']);
      assert.deepEqual(f.errors, []);
    });
  }
}
