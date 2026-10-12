const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '../sources/vaughn.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
assert.deepStrictEqual(manifest.content_scripts.find(entry => entry.js.includes('./sources/vaughn.js')).matches,
  ['https://vaughn.live/*', 'https://www.vaughn.live/*']);
const icon = fs.readFileSync(path.join(__dirname, '../sources/images/vaughn.png'));
assert.strictEqual(icon.toString('hex', 0, 8), '89504e470d0a1a0a');

// Structure from Vaughn's channel page and chatv9_zeta.js renderer. All names,
// IDs and text below are fixtures. Every network request is intercepted.
function body(id, text, followup = false) {
  return `<div class="vs_chatv9_msg_body_wrapper ${followup ? 'vs_chatv9_msg_flex_multi' : 'vs_chatv9_msg_flex_firstline'}">
    <div class="vs_chatv9_msg_flex"><div class="vs_chatv9_msg_timestamp_multi">${followup ? '5:19 AM' : ''}</div>
    <div class="${followup ? 'vs_chatv9_msg_body_multi' : 'vs_chatv9_msg_body'}" id="chatv9msg-${id}">${text}</div>
    <div class="vs_chatv9_msg_tools"><img src="/more.svg"></div></div></div>`;
}
function row(id, text) {
  return `<li class="vs_chatv9_msg" id="chatv9-container-${id}">
    <div class="vs_chatv9_box_left"><img class="vs_chatv9_msg_profile_photo" src="//cdn.vaughnsoft.net/get_profile_photo.php?u=alice"></div>
    <div class="vs_chatv9_box_right">
      <div class="vs_chatv9_msg_user_info"><div class="vs_chatv9_msg_username"><span style="color:rgb(1,2,3)">Alice &amp; Bob</span></div>
      <div class="vs_chatv9_msg_badges"><div data-vs65-tooltip="Moderator"><svg viewBox="0 -960 960 960"><path style="fill:rgb(4,5,6)" d="M0 0h24v24H0z"></path></svg></div></div>
      <div class="vs_chatv9_msg_timestamp">5:18:48 AM</div></div>${body(id, text)}
    </div></li>`;
}
async function setup(browser, options = {}) {
  const page = await browser.newPage();
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto(options.url || 'https://vaughn.live/fixture');
  await page.setContent(`<style>.smile {background-image:url("https://cdn.vaughnsoft.net/img/emoticons/smile.gif")}</style>
    <div class="vs_chatv9_overlay" style="display:${options.loading ? 'flex' : 'none'}"></div>
    <ul id="vs_chatv9_chatbox">${options.loading ? '' : row('history', 'Old message')}</ul>
    <textarea id="vs_chatv9_input_box"></textarea>`);
  await page.evaluate(options => {
    window.messages = [];
    window.listeners = [];
    if (options.ipc) {
      window.ninjafy = { sendMessage(id, payload) { if (payload.message) window.messages.push(payload.message); } };
    } else {
      window.chrome = { runtime: {
        id: 'fixture',
        sendMessage(id, payload, callback) {
          if (payload.message) window.messages.push(payload.message);
          if (callback) callback(payload.getSettings ? { state: !options.disabled, settings: {} } : {});
        },
        onMessage: { addListener(listener) { window.listeners.push(listener); } }
      } };
    }
  }, options);
  await page.addScriptTag({ content: source });
  return page;
}
async function append(page, html, selector = '#vs_chatv9_chatbox') {
  await page.evaluate(({ html, selector }) => document.querySelector(selector).insertAdjacentHTML('beforeend', html), { html, selector });
}
async function messages(page) {
  await page.waitForTimeout(30);
  return page.evaluate(() => window.messages);
}
function command(page, request) {
  return page.evaluate(request => new Promise(resolve => window.listeners[0](request, {}, resolve)), request);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--renderer-process-limit=2'] });
  try {
    let page = await setup(browser);
    assert.deepStrictEqual(await messages(page), [], 'skip attached history');
    assert.strictEqual(await command(page, 'getSource'), 'vaughn');
    assert.strictEqual(await command(page, 'focusChat'), true);
    assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'vs_chatv9_input_box');
    await append(page, row('one', 'Hello'));
    await append(page, body('two', 'Hello', true), '#chatv9-container-one > .vs_chatv9_box_right');
    let captured = await messages(page);
    assert.deepStrictEqual(captured.map(m => [m.chatname, m.chatmessage]), [['Alice & Bob', 'Hello'], ['Alice & Bob', 'Hello']],
      'one event per body, preserving separate messages with identical text');
    assert.strictEqual(captured[1].chatimg, 'https://cdn.vaughnsoft.net/get_profile_photo.php?u=alice');
    assert.strictEqual(captured[1].nameColor, 'rgb(1, 2, 3)');
    assert.strictEqual(captured[1].platform, 'vaughn');
    assert.strictEqual(captured[1].type, 'vaughn');
    assert.strictEqual(captured[1].chatbadges[0].type, 'svg');
    assert(captured[1].chatbadges[0].html.includes('fill="rgb(4, 5, 6)"'));

    await page.evaluate(() => { document.getElementById('chatv9msg-one').id = 'chatv9msg-confirmed'; });
    await append(page, row('confirmed', 'Hello'));
    await append(page, row('one', 'Hello'));
    await page.evaluate(() => { document.getElementById('chatv9msg-two').textContent = '<purged message>'; });
    assert.strictEqual((await messages(page)).length, 2, 'acknowledgement, remounts, and edits must not repeat messages');
    await page.addScriptTag({ content: source });
    await append(page, body('three', 'New message', true), '#chatv9-container-one > .vs_chatv9_box_right');
    assert.strictEqual((await messages(page)).length, 3, 'reinjection must not add another observer');
    assert.strictEqual(await page.evaluate(() => window.listeners.length), 1);

    await append(page, row('late', ''));
    assert.strictEqual((await messages(page)).length, 3);
    await page.evaluate(() => {
      const node = document.createTextNode('');
      document.getElementById('chatv9msg-late').appendChild(node);
    });
    await page.evaluate(() => { document.getElementById('chatv9msg-late').firstChild.data = 'Hi'; });
    assert.strictEqual((await messages(page))[3].chatmessage, 'Hi', 'wait for incomplete bodies');
    await command(page, { state: false });
    await append(page, row('disabled', 'Do not replay'));
    await command(page, { state: true });
    await append(page, row('enabled', 'Back on'));
    assert.strictEqual((await messages(page)).length, 5);
    await page.close();

    page = await setup(browser);
    const emote = '<span title=":)"><div class="vs_chat_retrofit_vmoji"><img class="chat_img smile" src="//cdn.vaughnsoft.net/img/clear.png"></div></span>';
    const content = 'Hi &lt;b&gt; &amp; ' + emote + '<br><a href="https://example.com/">link</a>' +
      '<div class="vs_chatv9_urlpreview">Preview title</div>';
    await append(page, row('html', content));
    captured = await messages(page);
    assert.strictEqual(captured[0].chatmessage, 'Hi &lt;b&gt; &amp; <img src="https://cdn.vaughnsoft.net/img/emoticons/smile.gif" alt=":)"><br><a href="https://example.com/">link</a>');
    assert.strictEqual(captured[0].textonly, false);
    await command(page, { settings: { textonlymode: true } });
    await append(page, row('plain', content));
    captured = await messages(page);
    assert.strictEqual(captured[1].chatmessage, 'Hi <b> & :)\nlink');
    assert.strictEqual(captured[1].textonly, true);
    await append(page, '<li class="vs_chatv9_msg"><div class="vs_chatv9_box_right">CompactUser: <span class="vs_chatv9_msg_body" id="chatv9msg-compact">5:30 hello</span></div></li>');
    captured = await messages(page);
    assert.deepStrictEqual([captured[2].chatname, captured[2].chatmessage], ['CompactUser', '5:30 hello']);
    await page.close();

    page = await setup(browser, { loading: true });
    await append(page, row('async-history', 'Delayed history'));
    assert.deepStrictEqual(await messages(page), [], 'skip history arriving during initial loading');
    await page.evaluate(() => { document.querySelector('.vs_chatv9_overlay').style.display = 'none'; });
    await append(page, row('live', 'Live after history'));
    assert.strictEqual((await messages(page)).length, 1);
    await page.evaluate(html => {
      const old = document.getElementById('vs_chatv9_chatbox');
      old.outerHTML = '<ul id="vs_chatv9_chatbox">' + html + '</ul>';
    }, row('remount-history', 'History on remount'));
    await page.waitForTimeout(1100);
    assert.strictEqual((await messages(page)).length, 1);
    await append(page, row('after-remount', 'New after remount'));
    assert.strictEqual((await messages(page)).length, 2);
    await page.close();

    page = await setup(browser, { ipc: true });
    await append(page, row('ipc', 'Electron transport'));
    assert.strictEqual((await messages(page))[0].chatmessage, 'Electron transport');
    await page.close();
    page = await setup(browser, { disabled: true });
    await append(page, row('off', 'Initially disabled'));
    assert.deepStrictEqual(await messages(page), []);
    await page.close();
    page = await setup(browser, { url: 'https://unrelated.test/fixture' });
    await append(page, row('other-host', 'Ignore'));
    assert.deepStrictEqual(await messages(page), []);
    await page.close();
    console.log('Vaughn source checks passed: grouped/compact chat, ID acknowledgement, history, rendering, state, and transports.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
