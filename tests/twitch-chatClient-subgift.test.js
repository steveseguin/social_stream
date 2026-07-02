#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CHAT_CLIENT_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'providers', 'twitch', 'chatClient.js'),
  'utf8'
);

function loadChatClientModule() {
  const sandbox = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math
  });
  const compiled = `${CHAT_CLIENT_SRC.replace(/^export\s+/gm, '')}
this.createTwitchChatClient = createTwitchChatClient;
this.TWITCH_CHAT_EVENTS = TWITCH_CHAT_EVENTS;`;
  vm.runInContext(compiled, sandbox);
  return {
    createTwitchChatClient: sandbox.createTwitchChatClient,
    TWITCH_CHAT_EVENTS: sandbox.TWITCH_CHAT_EVENTS
  };
}

class FakeTmiClient {
  constructor() {
    this.handlers = new Map();
  }

  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(handler);
  }

  removeListener(event, handler) {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    set.delete(handler);
  }

  async connect() {
    return true;
  }

  emit(event, ...args) {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    for (const handler of set) {
      handler(...args);
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const { createTwitchChatClient, TWITCH_CHAT_EVENTS } = loadChatClientModule();
  const fakeClient = new FakeTmiClient();
  const messages = [];
  const chatClient = createTwitchChatClient({
    channel: 'socialstream',
    clientFactory: async () => fakeClient,
    logger: null,
    formatters: {
      sanitize: (value) => String(value ?? ''),
      avatarUrl: (value) => `avatar:${value}`,
      now: () => 1000
    }
  });

  chatClient.on(TWITCH_CHAT_EVENTS.MEMBERSHIP, (payload) => {
    messages.push(payload);
  });

  await chatClient.connect();

  fakeClient.emit(
    'subgift',
    '#socialstream',
    'THErealNEDRYERSON',
    7,
    'abookwitch',
    { prime: false, plan: '1000', planName: 'Channel Subscription (Tier 1)' },
    {
      'display-name': 'THErealNEDRYERSON',
      username: 'therealnedryerson',
      'tmi-sent-ts': '1712435520000'
    }
  );

  fakeClient.emit(
    'anonsubgift',
    '#socialstream',
    1,
    'quietviewer',
    { prime: false, plan: '1000', planName: 'Channel Subscription (Tier 1)' },
    {
      'tmi-sent-ts': '1712435530000'
    }
  );

  assert(messages.length === 2, `Expected 2 membership events, received ${messages.length}`);

  const directGift = messages[0];
  assert(directGift.chatname === 'THErealNEDRYERSON', `Expected gifter name, received ${directGift.chatname}`);
  assert(
    directGift.chatmessage === 'THErealNEDRYERSON gifted a sub to abookwitch!',
    `Unexpected direct gift message: ${directGift.chatmessage}`
  );
  assert(
    directGift.hasDonation === 'THErealNEDRYERSON gifted a sub to abookwitch',
    `Unexpected direct gift donation summary: ${directGift.hasDonation}`
  );

  const anonGift = messages[1];
  assert(anonGift.chatname === 'Anonymous', `Expected Anonymous, received ${anonGift.chatname}`);
  assert(
    anonGift.chatmessage === 'Anonymous gifted a sub to quietviewer!',
    `Unexpected anonymous gift message: ${anonGift.chatmessage}`
  );

  console.log('twitch-chatClient-subgift.test.js passed');
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
