const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '../sources/streamspace.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
const entry = manifest.content_scripts.find(row => row.js.includes('./sources/streamspace.js'));
assert.deepStrictEqual(entry.matches, [
  'https://beta.stream.space/chat-popup.php*', 'https://stream.space/chat-popup.php*'
]);
const icon = fs.readFileSync(path.join(__dirname, '../sources/images/streamspace.png'));
assert.strictEqual(icon.toString('hex', 0, 8), '89504e470d0a1a0a');

async function setup(browser, url, options = {}) {
  const page = await browser.newPage();
  // All network requests stay local to this fixture, including image loads.
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(url);
  await page.evaluate(options => {
    document.body.innerHTML = '<div id="chatMessages"></div><div id="chatPinned"></div>' +
      '<span id="popupViewersNum">6</span><textarea id="chatInput"></textarea>';
    window.messages = [];
    window.listener = null;
    window.addRow = (id, message = 'Hello', parent = document.getElementById('chatMessages')) => {
      const row = document.createElement('div');
      row.className = 'chat-msg';
      row.dataset.id = id;
      row.dataset.userId = '42';
      row.innerHTML = '<span class="chat-msg__avatar-wrap"><img class="chat-msg__avatar" src="/avatar.png"></span>' +
        '<div class="chat-reply-ref">Do not capture this quote</div>' +
        '<div class="chat-msg-line"><span class="chat-msg-line__prefix">' +
        '<span class="author" style="color: rgb(1, 2, 3)"><span class="badge">MOD</span>' +
        '<img class="chat-msg__level" src="/level.svg"><button class="chat-msg__nick">A &amp; B</button></span></span>' +
        '<span class="text"></span><button class="chat-msg__action-btn">Reply</button></div>';
      row.querySelector('.text').innerHTML = message;
      parent.appendChild(row);
      return row;
    };
    window.addRow('history');
    if (options.loading) {
      document.getElementById('chatMessages').innerHTML = '<p class="chat-empty">Loading...</p>';
    } else {
      document.getElementById('chatMessages').insertAdjacentHTML('beforeend', '<div class="chat-welcome">Welcome</div>');
    }
    if (options.ipc) {
      window.ninjafy = { sendMessage: (id, payload) => { if (payload.message) window.messages.push(payload.message); } };
    } else {
      window.chrome = { runtime: {
        id: 'fixture',
        sendMessage: (id, payload, callback) => {
          if (payload.message) window.messages.push(payload.message);
          if (callback) callback(payload.getSettings ? { state: true, settings: { showviewercount: true } } : {});
        },
        onMessage: { addListener: listener => { window.listener = listener; } }
      } };
    }
  }, options);
  await page.addScriptTag({ content: source });
  return page;
}

const chats = page => page.evaluate(() => window.messages.filter(row => !row.event));
async function flush(page) { await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30))); }
async function command(page, request) {
  return page.evaluate(request => new Promise(resolve => window.listener(request, {}, resolve)), request);
}

(async () => {
  // One browser and one active page at a time; no worker pool.
  const browser = await chromium.launch({ headless: true, args: ['--renderer-process-limit=2'] });
  try {
    let page = await setup(browser, 'https://beta.stream.space/chat-popup.php?channel=fixture');
    assert.strictEqual((await chats(page)).length, 0, 'existing history must be skipped');
    assert.strictEqual(await command(page, 'getSource'), 'streamspace');
    assert.strictEqual(await command(page, 'focusChat'), true);
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'chatInput');
    await page.evaluate(() => {
      window.addRow('1', 'Hi &lt;b&gt; <img src="/emote.png" alt="Smile" onerror="void 0"><script>bad()</script><a href="javascript:bad()">link</a>');
      window.addRow('pin', 'Pinned', document.getElementById('chatPinned'));
    });
    await flush(page);
    let messages = await chats(page);
    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].chatname, 'A & B');
    assert.strictEqual(messages[0].chatmessage, 'Hi &lt;b&gt; <img src="https://beta.stream.space/emote.png" alt="Smile">link');
    assert.strictEqual(messages[0].chatimg, 'https://beta.stream.space/avatar.png');
    assert.deepStrictEqual(messages[0].chatbadges, ['https://beta.stream.space/level.svg']);
    assert.strictEqual(messages[0].userid, '42');
    assert.strictEqual(messages[0].nameColor, 'rgb(1, 2, 3)');
    assert.strictEqual(messages[0].type, 'streamspace');
    assert.strictEqual(messages[0].textonly, false);
    await page.evaluate(() => {
      window.addRow('1', 'Duplicate render');
      document.querySelector('.chat-msg[data-id="1"] .text').textContent = 'Edited';
      window.addRow('2', 'Same text');
      window.addRow('3', 'Same text');
    });
    await flush(page);
    assert.strictEqual((await chats(page)).length, 3, 'IDs deduplicate edits without collapsing identical new messages');
    await command(page, { settings: { textonlymode: true, showviewercount: true } });
    await page.evaluate(() => window.addRow('4', '&lt;b&gt;<br><img src="javascript:bad()" alt="Smile">'));
    await flush(page);
    messages = await chats(page);
    assert.strictEqual(messages[3].chatmessage, '<b>\nSmile');
    assert.strictEqual(messages[3].textonly, true);
    await command(page, { state: false });
    await page.evaluate(() => window.addRow('5', 'Disabled'));
    await flush(page);
    await command(page, { state: true });
    await page.evaluate(() => window.addRow('6', 'Enabled'));
    await flush(page);
    assert.strictEqual((await chats(page)).length, 5);
    await page.evaluate(() => { document.getElementById('popupViewersNum').textContent = '0'; });
    await page.waitForFunction(() => window.messages.some(row => row.event === 'viewer_update' && row.meta === 0));
    await page.evaluate(() => {
      const replacement = document.createElement('div');
      replacement.id = 'chatMessages';
      window.addRow('replacement-history', 'History', replacement);
      document.getElementById('chatMessages').replaceWith(replacement);
    });
    await page.waitForTimeout(1100);
    await page.evaluate(() => window.addRow('7', 'After replacement'));
    await flush(page);
    assert.strictEqual((await chats(page)).length, 6);
    await page.addScriptTag({ content: source });
    await page.evaluate(() => window.addRow('8', 'After reinjection'));
    await flush(page);
    assert.strictEqual((await chats(page)).length, 7);
    await page.close();

    page = await setup(browser, 'https://stream.space/chat-popup.php?channel=fixture', { loading: true });
    await page.evaluate(() => {
      window.addRow('late-history', 'Delayed history');
      document.getElementById('chatMessages').insertAdjacentHTML('beforeend', '<div class="chat-welcome">Welcome</div>');
    });
    await flush(page);
    assert.strictEqual((await chats(page)).length, 0, 'delayed initial history must be skipped');
    await page.evaluate(() => window.addRow('new', 'Live'));
    await flush(page);
    assert.strictEqual((await chats(page)).length, 1);
    await page.close();

    page = await setup(browser, 'https://stream.space/chat-popup.php?channel=fixture', { ipc: true });
    await page.evaluate(() => window.addRow('ipc', 'IPC fallback'));
    await flush(page);
    assert.strictEqual((await chats(page)).length, 1);
    await page.close();

    for (const url of ['https://unrelated.example/chat-popup.php', 'https://beta.stream.space/profile.php', 'https://stream.space/chat-popup.php-extra']) {
      page = await setup(browser, url);
      await page.evaluate(() => window.addRow('unrelated', 'Ignore'));
      await flush(page);
      assert.strictEqual((await chats(page)).length, 0, 'unrelated pages must remain inactive');
      assert.strictEqual(await page.evaluate(() => window.listener), null);
      await page.close();
    }
    console.log('Stream.space DOM fixture checks passed (not live-site or SSApp validation).');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
