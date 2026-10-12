const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'sources/starvios.js'), 'utf8');
const identitySource = fs.readFileSync(path.join(root, 'sources/inject/starvios.js'), 'utf8');
require('acorn').parse(source, { ecmaVersion: 2020 });
require('acorn').parse(identitySource, { ecmaVersion: 2020 });
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.deepEqual(manifest.content_scripts.find(e => e.js.includes('./sources/starvios.js')).matches,
  ['https://starvios.com/popout/chat/*', 'https://www.starvios.com/popout/chat/*']);
const identityEntry = manifest.content_scripts.find(e => e.js.includes('./sources/inject/starvios.js'));
assert.deepEqual(identityEntry.matches, manifest.content_scripts.find(e => e.js.includes('./sources/starvios.js')).matches);
assert.equal(identityEntry.world, 'MAIN');
assert.equal(identityEntry.run_at, 'document_start');
assert.equal(fs.readFileSync(path.join(root, 'sources/images/starvios.png')).toString('hex', 0, 8), '89504e470d0a1a0a');

async function fixture(browser, url = 'https://starvios.com/popout/chat/fixture', ipc = false) {
  const page = await browser.newPage();
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(url);
  await page.evaluate(ipc => {
    // Markup from Starvios LiveChat-DA29kr0d.js, reviewed 2026-10-04.
    document.body.innerHTML = '<main><aside id="pinned"></aside><div class="overscroll-contain overflow-y-auto"></div><form><input aria-autocomplete="list"><button type="submit">Send</button></form></main>';
    window.list = document.querySelector('.overscroll-contain');
    window.messages = [];
    window.nextMessageId = 0;
    window.addRow = (html = 'Hello', paid = false, id = 'message-' + ++window.nextMessageId) => {
      const row = document.createElement('div');
      row.__reactFiber$fixture = { key: id };
      row.className = paid ? 'group border-chat-starvie/70' : 'group relative flex';
      row.innerHTML = (paid ? '<div><p class="tabular-nums">viewer · 1.000 Starvies</p></div>' : '') +
        '<div><p class="text-muted-foreground">Respondiendo a @other: quoted text</p><p class="break-words leading-relaxed">' +
        '<span>12:34</span><button class="mr-1 font-semibold hover:underline" style="color: rgb(1, 2, 3)">A &amp; B</button>' +
        '<span>:</span><span class="text-foreground/90"></span></p></div><button aria-label="Responder">Reply</button>';
      row.querySelector('[class="text-foreground/90"]').innerHTML = html;
      window.list.appendChild(row);
      return row;
    };
    window.addRow('Existing history');
    if (ipc) {
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
  }, ipc);
  await page.addScriptTag({ content: identitySource });
  await page.addScriptTag({ content: source });
  return page;
}
const flush = page => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
const messages = page => page.evaluate(() => window.messages);
const command = (page, request) => page.evaluate(request => new Promise(resolve => window.listener(request, {}, resolve)), request);

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--renderer-process-limit=2'] });
  try {
    const page = await fixture(browser);
    await page.evaluate(() => window.addRow('Asynchronous history'));
    await page.waitForTimeout(1650);
    assert.equal((await messages(page)).length, 0);
    await page.evaluate(() => window.addRow('Hi &amp; &lt;b&gt; <img src="https://starvios.com/emote.png" alt=":wave:" onerror="bad()">'));
    await flush(page);
    let captured = await messages(page);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].chatname, 'A & B');
    assert.equal(captured[0].nameColor, 'rgb(1, 2, 3)');
    assert.equal(captured[0].chatmessage, 'Hi &amp; &lt;b&gt; <img src="https://starvios.com/emote.png" alt=":wave:">');
    assert.equal(captured[0].type, 'starvios');
    assert.equal(captured[0].textonly, false);
    await page.evaluate(() => {
      document.querySelector('#pinned').appendChild(window.list.lastElementChild.cloneNode(true));
      window.list.lastElementChild.querySelector('button').textContent = 'Changed name';
      window.list.insertAdjacentHTML('beforeend', '<div><p>Someone is raiding!</p></div>');
    });
    await flush(page);
    assert.equal((await messages(page)).length, 1, 'Edits to an existing row, pinned cards and notices are not new messages');
    await command(page, { settings: { textonlymode: true } });
    await page.evaluate(() => window.addRow('&lt;b&gt; &amp; <img src="https://starvios.com/emote.png" alt=":wave:">'));
    await flush(page);
    captured = await messages(page);
    assert.equal(captured[1].chatmessage, '<b> & :wave:');
    assert.equal(captured[1].textonly, true);
    await page.evaluate(() => { window.addRow('Paid', true); window.addRow('Paid', true); });
    await flush(page);
    captured = await messages(page);
    assert.equal(captured.length, 4, 'Separate identical messages are retained');
    assert.equal(captured[2].hasDonation, '1.000 Starvies');
    assert.equal(captured[2].donoValue, undefined);
    assert.equal(captured[2].event, undefined);
    assert.equal(await command(page, 'getSource'), 'starvios');
    assert.equal(await command(page, 'focusChat'), true);
    await page.evaluate(() => { document.querySelector('input').disabled = true; });
    assert.equal(await command(page, 'focusChat'), false);
    await command(page, { state: false });
    await page.evaluate(() => window.addRow('Disabled'));
    await flush(page);
    await command(page, { state: true });
    await page.waitForTimeout(1050);
    assert.equal((await messages(page)).length, 4, 'Disabled messages are not replayed');
    await page.evaluate(() => {
      const next = window.list.cloneNode(true);
      window.list.replaceWith(next);
      window.list = next;
    });
    await page.waitForTimeout(2700);
    await page.evaluate(() => window.addRow('After replacement'));
    await flush(page);
    assert.equal((await messages(page)).length, 5, 'Reconnect skips old rows and captures new ones');
    await page.addScriptTag({ content: source });
    await page.evaluate(() => window.addRow('After reinjection'));
    await flush(page);
    assert.equal((await messages(page)).length, 6);
    await page.evaluate(() => { history.pushState({}, '', '/fixture'); window.addRow('Outside popout'); });
    await flush(page);
    assert.equal(await command(page, 'focusChat'), false);
    assert.equal((await messages(page)).length, 6);
    await page.close();

    const replacement = await fixture(browser);
    await replacement.waitForTimeout(1650);
    await replacement.evaluate(() => window.addRow('Sent once', false, 'tmp-send-1'));
    await flush(replacement);
    assert.equal((await messages(replacement)).length, 0, 'Temporary send is not captured');
    await replacement.waitForTimeout(1100);
    assert.equal((await messages(replacement)).length, 0, 'Polling does not capture unconfirmed sends');
    await replacement.evaluate(() => {
      window.list.lastElementChild.remove();
      window.addRow('Sent once', false, 'confirmed-1');
    });
    await flush(replacement);
    assert.equal((await messages(replacement)).length, 1, 'Confirmed replacement is captured once');
    await replacement.evaluate(() => {
      window.list.lastElementChild.remove();
      window.addRow('Sent once', false, 'confirmed-1');
      window.addRow('Sent once', false, 'confirmed-2');
      window.addRow('Failed send', false, 'tmp-failed');
    });
    await flush(replacement);
    assert.equal((await messages(replacement)).length, 2, 'Same ID is ignored; separate identical message is captured');
    await replacement.evaluate(() => window.list.lastElementChild.remove());
    await flush(replacement);
    assert.equal((await messages(replacement)).length, 2, 'Failed send is never captured');
    await replacement.close();

    const ipc = await fixture(browser, undefined, true);
    await ipc.waitForTimeout(1650);
    await ipc.evaluate(() => window.addRow('IPC capture'));
    await flush(ipc);
    assert.equal((await messages(ipc))[0].chatmessage, 'IPC capture');
    await ipc.close();
    for (const url of ['https://starvios.com/fixture', 'https://example.com/popout/chat/fixture']) {
      const excluded = await fixture(browser, url);
      assert.equal(await excluded.evaluate(() => !!window.__SSN_STARVIOS_SOURCE_ACTIVE__), false);
      await excluded.close();
    }
    console.log('Starvios source fixture checks passed (live authenticated sending not tested).');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
