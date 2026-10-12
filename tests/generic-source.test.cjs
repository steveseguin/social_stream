const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '../sources/generic.js'), 'utf8');

// Vaughn structure observed at https://vaughn.live/jabooty. Names/text/IDs are
// test data. Other layouts follow their existing sources/*.js integrations.
function vaughnBody(id, text, followup = false) {
  return `<div class="vs_chatv9_msg_body_wrapper ${followup ? 'vs_chatv9_msg_flex_multi' : 'vs_chatv9_msg_flex_firstline'}">
    <div class="vs_chatv9_msg_flex"><div class="vs_chatv9_msg_timestamp_multi">${followup ? '5:19 AM' : ''}</div>
    <div class="${followup ? 'vs_chatv9_msg_body_multi' : 'vs_chatv9_msg_body'}" id="chatv9msg-${id}">${text}</div>
    <div class="vs_chatv9_msg_tools"></div></div></div>`;
}
function vaughnRow(id, text) {
  return `<li class="vs_chatv9_msg" id="chatv9-container-${id}"><div class="vs_chatv9_box_right">
    <div class="vs_chatv9_msg_flex"><div class="vs_chatv9_msg_user_info"><div class="vs_chatv9_msg_flex">
    <div class="vs_chatv9_msg_username"><span>Alice</span></div><div class="vs_chatv9_msg_timestamp">5:18:48 AM</div>
    </div></div></div>${vaughnBody(id, text)}</div></li>`;
}

async function setup(browser, html = '<div class="chat-messages" id="chat"></div>', textonlymode = true) {
  const page = await browser.newPage();
  // No chat messages or assets are sent to a live site by these tests.
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('https://generic.test/room');
  await page.evaluate(textonlymode => {
    window.messages = [];
    window.listeners = [];
    window.RTCPeerConnection = undefined;
    window.chrome = { runtime: {
      id: 'test-extension',
      sendMessage(id, payload, callback) {
        if (payload.message) window.messages.push(payload.message);
        if (callback) callback(payload.getSettings ? { settings: { textonlymode } } : {});
      },
      onMessage: { addListener(listener) { window.listeners.push(listener); } }
    } };
  }, textonlymode);
  await page.addScriptTag({ content: source });
  await page.waitForFunction(() => document.body.hasObserver);
  return page;
}

async function append(page, html, selector = '#chat') {
  await page.evaluate(({html, selector}) => document.querySelector(selector).insertAdjacentHTML('beforeend', html), { html, selector });
}
async function messages(page) {
  // Includes enough time for every queued fragment to run, including duplicates.
  await page.waitForTimeout(200);
  return page.evaluate(() => window.messages.map(m => [m.chatname, m.chatmessage]));
}

async function testVaughn(browser) {
  const page = await setup(browser, '<ul id="chat" class="chat-messages">' + vaughnRow('history', 'Old message') + '</ul>');
  assert.deepStrictEqual(await messages(page), []);
  await append(page, vaughnRow('one', 'Hello everyone'));
  await append(page, vaughnBody('two', '4am in East Coast if I calculated right', true), '#chatv9-container-one > .vs_chatv9_box_right');
  assert.deepStrictEqual(await messages(page), [
    ['Alice', 'Hello everyone'], ['Alice', '4am in East Coast if I calculated right']
  ], 'grouped follow-up must be sent once with its shared author');
  await append(page, vaughnBody('three', 'Hello everyone', true), '#chatv9-container-one > .vs_chatv9_box_right');
  assert.strictEqual((await messages(page)).length, 3, 'different message IDs may have identical text');
  await append(page, vaughnRow('one', 'Hello everyone'));
  assert.strictEqual((await messages(page)).length, 3, 'a remounted ID must not be sent twice');
  await page.addScriptTag({ content: source });
  await append(page, vaughnBody('four', 'A later message', true), '#chatv9-container-one > .vs_chatv9_box_right');
  assert.strictEqual((await messages(page)).length, 4, 'reinjection must not add another capture pipeline');
  assert.strictEqual(await page.evaluate(() => window.listeners.length), 1);
  await page.close();
}

async function testLayouts(browser) {
  const layouts = [
    ['Twitch', '<div class="chat-line__message" data-id="t1"><div class="chat-line__message-container"><span class="chat-author__display-name">Alice</span><span data-a-target="chat-message-text"><span class="text-fragment">Hello </span><span class="text-fragment">everyone</span></span></div></div>'],
    ['YouTube', '<yt-live-chat-text-message-renderer id="y1"><span id="author-name">Alice</span><span id="message">Hello everyone</span></yt-live-chat-text-message-renderer>'],
    ['Owncast CSS modules', '<div class="ChatUserMessage-module-scss-module__hash__root"><span class="ChatUserMessage-module-scss-module__hash__userName">Alice</span><span class="ChatUserMessage-module-scss-module__hash__message">Hello everyone</span></div>'],
    ['Owncast legacy', '<div class="message"><span class="message-author">Alice</span><span class="message-text">Hello everyone</span></div>'],
    ['KiwiIRC', '<div class="kiwi-messagelist-message"><a data-nick="Alice">Alice</a><span class="kiwi-messagelist-body">Hello everyone</span></div>'],
    ['Castyr', '<p class="chat-message" data-username="Alice"><button class="chat-message-username">Alice</button><span>: </span><span class="chat-message-text">Hello everyone</span></p>'],
    ['StreamSpace', '<div class="chat-msg" data-id="s1"><div class="chat-msg-line"><span class="author"><span class="chat-msg__nick">Alice</span></span><span class="text">Hello everyone</span></div></div>'],
    ['eStream', '<div><span class="username">Alice:</span><span class="msg">Hello everyone</span></div>'],
    ['Nested generic', '<div class="message"><div class="chat-header"><span class="username">Alice</span></div><div class="message-content"><span class="chat-fragment">Hello everyone</span></div></div>'],
    ['Attribute author', '<div data-message-id="a1" data-username="Alice"><div class="message-text">Hello everyone</div></div>'],
    ['Plain text fallback', '<div class="message">Alice: Hello everyone</div>']
  ];
  for (const [label, html] of layouts) {
    const page = await setup(browser);
    await append(page, html);
    assert.deepStrictEqual(await messages(page), [['Alice', 'Hello everyone']], label);
    await page.close();
  }
}

async function testRendering(browser) {
  const page = await setup(browser);
  await append(page, '<div class="chat-message" data-message-id="late"><span class="username">Alice</span><span class="message-text"></span></div>');
  assert.deepStrictEqual(await messages(page), [], 'empty body must remain eligible for capture');
  await page.evaluate(() => document.querySelector('.message-text').appendChild(document.createTextNode('')));
  await page.waitForTimeout(100);
  await page.evaluate(() => { document.querySelector('.message-text').firstChild.data = 'Hi'; });
  assert.deepStrictEqual(await messages(page), [['Alice', 'Hi']], 'characterData updates and short messages');
  await page.evaluate(() => {
    const row = document.querySelector('.chat-message');
    row.setAttribute('data-message-id', 'recycled');
    row.querySelector('.message-text').textContent = 'Second message';
  });
  assert.deepStrictEqual(await messages(page), [['Alice', 'Hi'], ['Alice', 'Second message']], 'recycled row with a new message ID');
  await page.evaluate(() => document.querySelector('#chat').appendChild(document.querySelector('.chat-message')));
  assert.strictEqual((await messages(page)).length, 2, 'moving a row is not a new message');
  await page.close();
  const semantic = await setup(browser, '<div role="log" id="chat"></div>');
  await append(semantic, '<div><span class="username">Alice</span><span class="text">Hi</span></div>');
  assert.deepStrictEqual(await messages(semantic), [['Alice', 'Hi']], 'semantic chat list with unlabelled rows');
  await semantic.close();
}

async function testText(browser) {
  for (const textonly of [true, false]) {
    const page = await setup(browser, undefined, textonly);
    await append(page, '<div class="chat-message"><span class="username">Ann &amp; Jamie</span><div class="message-text">Reminder: today at 5:30 &amp; &lt;i&gt;<br><i>OK</i> <img src="data:image/png;base64,AA==" alt=":)"></div></div>');
    const data = await messages(page);
    assert.strictEqual(data.length, 1);
    assert.strictEqual(data[0][0], 'Ann & Jamie');
    if (textonly) assert.strictEqual(data[0][1], 'Reminder: today at 5:30 & <i>\nOK :)');
    else {
      assert.ok(data[0][1].startsWith('Reminder: today at 5:30 &amp; &lt;i&gt;<br>OK '));
      assert.ok(data[0][1].includes('<img '));
    }
    await page.close();
  }
}

async function testTwitchLiveLayout(browser) {
  // Structure observed in the active ironmouse popout: links and emotes are
  // siblings of data-a-target=chat-message-text, inside chat-line-message-body.
  const page = await setup(browser);
  await append(page, '<div class="chat-line__message" data-a-target="chat-line-message"><div class="chat-line__message-container">' +
    '<div><p>Replying to <span>@Bob</span>: <span>Earlier message</span></p></div>' +
    '<div class="chat-line__no-background"><div><div class="chat-line__username-container"><span class="chat-line__username"><span class="chat-author__display-name" data-a-target="chat-message-username">Alice</span></span></div>' +
    '<span aria-hidden="true">: </span><span data-a-target="chat-line-message-body">' +
    '<span class="text-fragment" data-a-target="chat-message-text">Visit </span><a href="https://example.org">example.org</a>' +
    '<span class="text-fragment" data-a-target="chat-message-text"> :) </span><span class="chat-line__message--emote-button"><img alt="Kappa" src="data:image/png;base64,AA=="></span>' +
    '</span></div></div></div><div class="chat-line__icons"><button>Reply</button></div></div>');
  assert.deepStrictEqual(await messages(page), [['Alice', 'Visit example.org :) Kappa']]);
  await page.close();
}

async function testRoots(browser) {
  const page = await setup(browser, '<div id="host"></div><iframe id="frame"></iframe>');
  await page.evaluate(() => {
    document.getElementById('host').className = 'shadow-root-host';
    document.getElementById('host').attachShadow({mode:'open'}).innerHTML = '<div class="chat-messages" id="shadow-chat"></div>';
    document.getElementById('frame').contentDocument.body.innerHTML = '<div class="chat-messages" id="frame-chat"></div>';
  });
  await page.waitForFunction(() => document.getElementById('host').shadowRoot.hasObserver && document.getElementById('frame').contentDocument.body.hasObserver);
  await page.evaluate(() => {
    document.getElementById('host').shadowRoot.querySelector('#shadow-chat').innerHTML = '<div class="chat-message"><span class="username">Alice</span><span class="message-text">Shadow message</span></div>';
    document.getElementById('frame').contentDocument.querySelector('#frame-chat').innerHTML = '<div class="chat-message"><span class="username">Bob</span><span class="message-text">Frame message</span></div>';
  });
  assert.deepStrictEqual((await messages(page)).sort(), [['Alice', 'Shadow message'], ['Bob', 'Frame message']]);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await testVaughn(browser);
    await testLayouts(browser);
    await testRendering(browser);
    await testText(browser);
    await testTwitchLiveLayout(browser);
    await testRoots(browser);
    console.log('Generic source: Vaughn, 11 layouts, live Twitch layout, rendering, identity, reinjection, text, shadow DOM and iframe checks passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
