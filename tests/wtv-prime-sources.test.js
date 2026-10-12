const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sources = {};
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
for (const type of ['wtv', 'prime']) {
  sources[type] = fs.readFileSync(path.join(__dirname, '../sources', type + '.js'), 'utf8');
  assert(manifest.content_scripts.some(entry => entry.js.includes('./sources/' + type + '.js')));
  const icon = fs.readFileSync(path.join(__dirname, '../sources/images', type + '.png'));
  assert.strictEqual(icon.toString('hex', 0, 8), '89504e470d0a1a0a');
}

async function fixture(browser, type, options = {}) {
  const page = await browser.newPage();
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(options.url || (type === 'wtv' ? 'https://w.tv/fixture/chat' : 'https://prime.gs/fixture?chat_popout=1'));
  await page.evaluate(({ type, options }) => {
    const wtv = type === 'wtv';
    document.body.innerHTML = wtv ? '<div data-chat-scroll-container></div><div class="chat-input-scrollable" contenteditable="true"></div>' :
      '<div id="chat-messages"></div><input id="chat-input">';
    window.list = document.querySelector(wtv ? '[data-chat-scroll-container]' : '#chat-messages');
    window.messages = [];
    window.addRow = (id, html = 'Hello') => {
      const row = document.createElement('div');
      if (wtv) {
        row.setAttribute('data-testid', 'message-' + id);
        row.innerHTML = '<span><span class="actions">Ignore</span><a href="/someone"><span data-testid="ui-tooltip" style="color: rgb(1, 2, 3)">A &amp; B: </span></a><span class="break-words"></span></span>';
        row.querySelector('.break-words').innerHTML = html;
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-testid', 'chat-message-container');
        wrapper.innerHTML = '<time datetime="2026-09-21T03:00:00Z">23:00</time><div>In reply to: NOT THE MESSAGE</div>';
        wrapper.appendChild(row);
        window.list.appendChild(wrapper);
      } else {
        row.className = 'chat-message';
        row.dataset.messageId = id;
        row.dataset.userId = '42';
        row.innerHTML = '<span class="message-time">23:00</span><a data-user-card="42" href="/someone" style="color: rgb(1, 2, 3)">A &amp; B</a>' +
          '<div class="chat-mod-actions"><button>Ignore</button></div><span data-chat-message-body></span>';
        row.querySelector('[data-chat-message-body]').innerHTML = html;
        window.list.appendChild(row);
      }
      return row;
    };
    if (options.empty) {
      window.list.remove();
      document.body.insertAdjacentHTML('beforeend', '<div data-testid="chat-empty-state">No messages</div>');
    } else if (!options.loading) window.addRow('100', 'History');
    if (options.ipc) {
      window.ninjafy = { sendMessage: (id, payload) => { if (payload.message) window.messages.push(payload.message); } };
    } else {
      window.chrome = { runtime: {
        id: 'fixture',
        sendMessage: (id, payload, callback) => {
          if (payload.message) window.messages.push(payload.message);
          if (callback) callback(payload.getSettings ? { settings: {}, state: true } : {});
        },
        onMessage: { addListener: listener => { window.listener = listener; } }
      } };
    }
  }, { type, options });
  await page.addScriptTag({ content: sources[type] });
  return page;
}
async function flush(page) { await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30))); }
const rows = page => page.evaluate(() => window.messages);
const command = (page, request) => page.evaluate(request => new Promise(resolve => window.listener(request, {}, resolve)), request);

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--renderer-process-limit=2'] });
  try {
    for (const type of ['wtv', 'prime']) {
      let page = await fixture(browser, type);
      assert.strictEqual((await rows(page)).length, 0);
      assert.strictEqual(await command(page, 'getSource'), type);
      assert.strictEqual(await command(page, 'focusChat'), true);
      await page.evaluate(() => window.addRow('101', 'Hi &lt;b&gt; <picture><source srcset="/untrusted"><img src="/emote.png" alt="Smile" onerror="void 0"></picture><script>bad()</script><a href="javascript:bad()">link</a>'));
      await flush(page);
      let messages = await rows(page);
      assert.strictEqual(messages.length, 1);
      assert.strictEqual(messages[0].chatname, 'A & B');
      assert.strictEqual(messages[0].nameColor, 'rgb(1, 2, 3)');
      assert.strictEqual(messages[0].type, type);
      assert.strictEqual(messages[0].chatmessage, 'Hi &lt;b&gt; <img src="https://' + (type === 'wtv' ? 'w.tv' : 'prime.gs') + '/emote.png" alt="Smile">link');
      if (type === 'prime') assert.strictEqual(messages[0].userid, '42');
      await page.evaluate(type => {
        const row = document.querySelector(type === 'wtv' ? '[data-testid="message-101"]' : '[data-message-id="101"]');
        row.parentElement.appendChild(row.cloneNode(true));
        window.addRow('102', 'Repeated');
        window.addRow('103', 'Repeated');
      }, type);
      await flush(page);
      assert.strictEqual((await rows(page)).length, 3, 'remount dedup must preserve identical new messages');
      await command(page, { settings: { textonlymode: true } });
      await page.evaluate(() => window.addRow('104', '&lt;b&gt;<br><img src="javascript:bad()" alt="Smile">'));
      await flush(page);
      messages = await rows(page);
      assert.strictEqual(messages[3].chatmessage, '<b>\nSmile');
      assert.strictEqual(messages[3].textonly, true);
      await command(page, { state: false });
      await page.evaluate(() => window.addRow('105', 'Disabled'));
      await flush(page);
      await command(page, { state: true });
      await page.evaluate(() => window.addRow('106', 'Enabled'));
      await flush(page);
      assert.strictEqual((await rows(page)).length, 5);
      if (type === 'prime') {
        await page.evaluate(() => {
          window.addRow('99', 'Older history');
          window.addRow('107', 'Ignored').querySelector('[data-chat-message-body]').setAttribute('data-ignored-placeholder', '1');
        });
        await flush(page);
        assert.strictEqual((await rows(page)).length, 5);
        await page.evaluate(() => {
          const row = window.addRow('108', 'Guest message');
          const name = row.querySelector('[data-user-card]');
          name.remove();
          const header = document.createElement('span');
          header.innerHTML = '<span class="font-semibold flex-shrink-0" style="color:rgb(1, 2, 3)">Guest name</span><span>: </span>';
          row.insertBefore(header, row.querySelector('[data-chat-message-body]'));
          row.insertAdjacentHTML('afterbegin', '<div data-scroll-to-message="50"><span class="font-semibold">Reply author</span>: Reply preview</div>');
        });
        await flush(page);
        assert.strictEqual((await rows(page)).length, 6);
        assert.strictEqual((await rows(page))[5].chatname, 'Guest name');
        assert.strictEqual((await rows(page))[5].chatmessage, 'Guest message');
      } else {
        await page.evaluate(() => {
          window.list.style.cssText = 'height:50px;overflow:auto';
          window.list.scrollTop = 0;
          window.list.dispatchEvent(new Event('scroll'));
          window.addRow('old', 'Scrolled history');
        });
        await flush(page);
        assert.strictEqual((await rows(page)).length, 5);
        await page.evaluate(() => {
          window.list.scrollTop = window.list.scrollHeight;
          window.list.dispatchEvent(new Event('scroll'));
          window.addRow('108', 'Long live row<br>'.repeat(30));
        });
        await flush(page);
        assert.strictEqual((await rows(page)).length, 6, 'new tall rows must not be mistaken for scrolling up');
      }
      await page.close();
      page = await fixture(browser, type, { ipc: true });
      await page.evaluate(() => window.addRow('101', 'IPC'));
      await flush(page);
      assert.strictEqual((await rows(page)).length, 1);
      await page.close();
      page = await fixture(browser, type, { url: type === 'wtv' ? 'https://w.tv/fixture' : 'https://prime.gs/fixture' });
      await page.evaluate(() => window.addRow('101', 'Unrelated page'));
      await flush(page);
      assert.strictEqual((await rows(page)).length, 0);
      await page.close();
    }
    let page = await fixture(browser, 'wtv', { loading: true });
    await page.evaluate(() => window.addRow('100', 'Delayed history'));
    await flush(page);
    assert.strictEqual((await rows(page)).length, 0);
    await page.evaluate(() => window.addRow('101', 'Live'));
    await flush(page);
    assert.strictEqual((await rows(page)).length, 1);
    await page.close();
    page = await fixture(browser, 'wtv', { empty: true });
    await page.evaluate(() => {
      document.querySelector('[data-testid="chat-empty-state"]').remove();
      document.body.appendChild(window.list);
      window.addRow('1', 'First live message');
    });
    await page.waitForFunction(() => window.messages.length === 1);
    await page.close();
    console.log('w.tv and Prime DOM fixture checks passed (not SSApp or overlay end-to-end validation).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
