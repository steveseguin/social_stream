const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const script = fs.readFileSync(path.join(__dirname, '../sources/sooplive.js'), 'utf8');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--renderer-process-limit=2'] });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<body><div id="chat_area"></div><span id="nAllViewer">1,234</span><div id="write_area" contenteditable="true"></div></body>' }));
    await page.goto('https://play.sooplive.com/fixture/123');
    await page.evaluate(() => {
      window.messages = [];
      window.chrome = { runtime: { id: 'fixture', sendMessage(id, data, callback) {
        if (data.message) messages.push(data.message);
        if (callback) callback(data.getSettings ? { state: true, settings: { showviewercount: true } } : {});
      }, onMessage: { addListener(fn) { window.listener = fn; } } } };
      window.row = (id, text = 'Hello', partial = false) => {
        const el = document.createElement('div');
        el.className = 'chatting-list-item';
        el.innerHTML = '<div class="message-container"><div class="username"><button user_nick="A &amp; B" user_id="someone"><span class="author" data-color="123abc">A &amp; B</span></button></div>' +
          (partial ? '' : '<div class="message-text" id="chat-' + id + '"><p class="msg">' + text + '</p><div class="message-translation">duplicate original</div></div>') + '</div>';
        document.querySelector('#chat_area').appendChild(el);
        return el;
      };
      row(1, 'History');
    });
    await page.addScriptTag({ content: script });
    const flush = () => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
    const read = () => page.evaluate(() => messages);
    const command = request => page.evaluate(request => new Promise(resolve => listener(request, {}, resolve)), request);
    assert.deepStrictEqual((await read()).map(m => m.meta), [1234]);
    assert.strictEqual(await command('focusChat'), true);
    await page.evaluate(() => {
      row(2, 'Hi &lt;b&gt; <img src="/emote.png" alt="Smile" onerror="void 0"><script>bad()</script>');
      row(3, 'Same'); row(4, 'Same');
    });
    await flush();
    let messages = await read();
    assert.strictEqual(messages.length, 4);
    assert.strictEqual(messages[1].chatname, 'A & B');
    assert.strictEqual(messages[1].userid, 'someone');
    assert.strictEqual(messages[1].nameColor, '#123abc');
    assert.strictEqual(messages[1].chatmessage, 'Hi &lt;b&gt; <img src="https://play.sooplive.com/emote.png" alt="Smile">');
    await page.evaluate(() => {
      row(2, 'duplicate id');
      const whisper = row(5, 'private');
      whisper.querySelector('.message-container').className = 'bubble-container whispering';
      window.partial = row(6, '', true);
    });
    await flush();
    assert.strictEqual((await read()).length, 4);
    await page.evaluate(() => partial.querySelector('.message-container').insertAdjacentHTML('beforeend', '<div class="message-text" id="chat-6">Hydrated</div>'));
    await flush();
    assert.strictEqual((await read()).at(-1).chatmessage, 'Hydrated');
    await command({ settings: { textonlymode: true } });
    await page.evaluate(() => row(7, 'A &amp; B <img src="javascript:bad()" alt="Smile">'));
    await flush();
    assert.strictEqual((await read()).at(-1).chatmessage, 'A & B Smile');
    await command({ state: false });
    await page.evaluate(() => row(8, 'disabled'));
    await flush();
    await command({ state: true });
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div><span class="channel-text">Global Name</span><span type="body" color="label/labelSecondary">Global text</span></div>'));
    await flush();
    assert.strictEqual((await read()).at(-1).chatname, 'Global Name');
    assert(!(await read()).some(m => m.chatmessage === 'disabled'));
    await page.addScriptTag({ content: script });
    await page.evaluate(() => row(9, 'once'));
    await flush();
    assert.strictEqual((await read()).filter(m => m.chatmessage === 'once').length, 1);
    await page.evaluate(() => { document.querySelector('#nAllViewer').textContent = '2,345'; });
    await command({ settings: { showviewercount: true } });
    assert.strictEqual((await read()).at(-1).meta, 2345);
    await command({ settings: { showviewercount: true } });
    assert.strictEqual((await read()).filter(m => m.meta === 2345).length, 1);
    await page.evaluate(() => { document.querySelector('#nAllViewer').textContent = 'Loading'; });
    await command({ settings: { showviewercount: true } });
    assert.strictEqual((await read()).filter(m => m.event === 'viewer_update').length, 2);

    // Only detached SSApp popouts navigate; extension popouts keep their opener.
    const navigation = await browser.newPage();
    await navigation.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
    await navigation.goto('https://play.sooplive.co.kr/fixture/123?foo=1&vtype=chat');
    await navigation.evaluate(() => { window.__SSAPP_TAB_ID__ = 1; });
    await navigation.addScriptTag({ content: script }).catch(error => {
      if (!/context was destroyed/i.test(error.message)) throw error;
    });
    await navigation.waitForURL('https://play.sooplive.co.kr/fixture/123?foo=1');
    await navigation.goto('https://play.sooplive.com/fixture/123?vtype=chat');
    await navigation.addScriptTag({ content: script });
    assert.strictEqual(new URL(navigation.url()).searchParams.get('vtype'), 'chat');
    await navigation.goto('https://www.sooplive.com/chat/fixture');
    await navigation.evaluate(() => { window.__SSAPP_TAB_ID__ = 1; });
    await navigation.addScriptTag({ content: script }).catch(error => {
      if (!/context was destroyed/i.test(error.message)) throw error;
    });
    await navigation.waitForURL('https://play.sooplive.com/fixture/');
    await page.close();
    await navigation.close();
    console.log('SOOP source fixtures passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
