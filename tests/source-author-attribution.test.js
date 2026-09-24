const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const avatar = 'https://fixture.invalid/alice.png';

async function harness(browser, provider, html, textonly = true) {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  await page.setContent(html);
  await page.evaluate(textonly => {
    window.sent = [];
    window.intervals = [];
    window.setInterval = fn => intervals.push(fn);
    window.chrome = { runtime: {
      id: 'fixture',
      sendMessage(id, payload, callback) {
        if (payload.message) sent.push(payload.message);
        if (callback) callback(payload.getSettings ? { settings: { textonlymode: textonly } } : {});
      },
      onMessage: { addListener(fn) { window.settingsListener = fn; } }
    } };
  }, textonly);
  let source = fs.readFileSync(path.join(root, 'sources', provider + '.js'), 'utf8');
  // Expose entry points only in the test, while running the entire source script.
  // Avatar downloading/resizing is separate from identifying its owner.
  source = source.replace(/\}\)\(\);\s*$/, 'if (typeof toDataURL === "function") { toDataURL = function(url, done) { done(url); }; } window.capture = processMessage;' +
    (provider === 'teams' ? 'window.captureNew = processMessage2;' : '') + '})();');
  await page.addScriptTag({ content: source });
  return page;
}

// Structure checked against Piczel's public chat DOM on 2026-09-23.
// CSS module hashes are deliberately omitted: they are not stable selectors.
function piczelGroup(name, rows, options = {}) {
  const image = options.image ? `<img src="${avatar}">` : '<span><span>B</span></span>';
  const header = options.noHeader ? '' :
    (options.noAvatar ? '' : `<button type="button">${image}</button>`) +
    `<div><button type="button">${name}<div><i title="Moderator">Badge</i></div></button></div>`;
  return `<div ${options.legacy ? '' : 'data-chat-row="true"'}><div style="height:auto">` +
    '<div title="Today at 12:00"><div>Today at 12:00</div></div>' + header +
    '<div>' + rows.map(([id, text]) => `<div id="Message_${id}"><div><span>${text}</span></div><div></div></div>`).join('') +
    '</div></div></div>';
}

async function piczelTests(browser, textonly) {
  const page = await harness(browser, 'piczel', '<div id="PiczelChat"><div><div id="feed">' +
    piczelGroup('History', [['old', 'Backlog']], { image: true }) + '</div></div></div>', textonly);
  try {
    await page.evaluate(() => intervals.forEach(fn => fn()));
    assert.strictEqual(await page.evaluate(() => sent.length), 0, 'skip initial history');
    const cases = [
      [piczelGroup('Alice', [['a', 'A']], { image: true }), 'Alice', avatar],
      [piczelGroup('Bob', [['b', 'B']]), 'Bob', ''],
      [piczelGroup('NoAvatar', [['c', 'C']], { noAvatar: true }), 'NoAvatar', ''],
      [piczelGroup('', [['system', 'System notice']], { noHeader: true }), '', ''],
      [piczelGroup('A &amp; B', [['special', 'Hello &amp; goodbye']]), 'A & B', ''],
      [piczelGroup('Legacy', [['legacy', 'Legacy']], { legacy: true }), 'Legacy', ''],
      [piczelGroup('', [['blank', 'Pending header']], { image: true }), '', '']
    ];
    for (let i = 0; i < cases.length; i++) {
      const [html, name, image] = cases[i];
      await page.evaluate(html => document.querySelector('#feed').insertAdjacentHTML('beforeend', html), html);
      await page.waitForFunction(n => sent.length === n, i + 1);
      const message = await page.evaluate(() => sent[sent.length - 1]);
      assert.strictEqual(message.chatname, name, `Piczel author, case ${i}, textonly=${textonly}`);
      assert.strictEqual(message.chatimg, image, `Piczel avatar, case ${i}`);
      assert.strictEqual(message.type, 'piczel');
      assert.strictEqual(message.textonly, textonly);
    }
    const special = await page.evaluate(() => sent[4]);
    assert.strictEqual(special.chatmessage, textonly ? 'Hello & goodbye' : 'Hello &amp; goodbye');

    // One mutation can contain several groups and several consecutive messages.
    const batch = piczelGroup('BatchOne', [['one', 'One'], ['two', 'Two']]) +
      piczelGroup('BatchTwo', [['three', 'Three']], { image: true });
    await page.evaluate(html => document.querySelector('#feed').insertAdjacentHTML('beforeend', '<section>' + html + '</section>'), batch);
    await page.waitForFunction(() => sent.length === 10);
    assert.deepStrictEqual(await page.evaluate(() => sent.slice(-3).map(m => m.chatname)), ['BatchOne', 'BatchOne', 'BatchTwo']);
    await page.evaluate(() => {
      const list = document.querySelector('#Message_two').parentElement;
      list.insertAdjacentHTML('beforeend', '<div id="Message_four">Four</div>');
      const row = document.querySelector('#Message_four');
      // Mutation batches and moving existing rows must not duplicate captures.
      list.appendChild(row);
      document.querySelector('#Message_one').appendChild(document.createElement('span'));
    });
    await page.waitForFunction(() => sent.length === 11);
    assert.strictEqual(await page.evaluate(() => sent[10].chatname), 'BatchOne');

    // A message outside a real content wrapper must not pick up nearby controls.
    await page.evaluate(() => document.querySelector('#feed').insertAdjacentHTML('beforeend',
      '<div id="Message_orphan"><button><img src="https://fixture.invalid/emoji.png"></button><button>Wrong</button>Orphan</div>'));
    await page.waitForFunction(() => sent.length === 12);
    assert.strictEqual(await page.evaluate(() => sent[11].chatname), '');
    assert.strictEqual(await page.evaluate(() => sent[11].chatimg), '');
  } finally { await page.close(); }
}

async function teamsTests(browser) {
  const page = await harness(browser, 'teams', '<div id="feed"></div>');
  try {
    const result = await page.evaluate(avatar => {
      const feed = document.querySelector('#feed');
      const oldRow = (name, img, text, timestamp = false) => {
        const row = document.createElement('div');
        row.innerHTML = (name ? `<span class="ui-chat__message__author">${name}</span>` : '') +
          (img ? `<div data-tid="message-avatar"><img src="${img}"></div>` : '') +
          (timestamp ? '<span class="ui-chat__message__timestamp" style="width:30px">12:00</span>' : '') +
          `<div class="ui-chat__message__content">${text}</div>`;
        feed.appendChild(row);
        capture(row);
      };
      oldRow('Alice', avatar, 'First', true);
      oldRow('Bob', '', 'Own name without avatar');
      oldRow('', '', 'Bob continuation');
      oldRow('', '', 'New group missing author', true);
      feed.innerHTML = '';
      const newRow = (name, attr, img, text) => {
        const row = document.createElement('div');
        row.innerHTML = '<div>' + (name ? `<span data-tid="${attr}">${name}</span>` : '') +
          (img ? `<div data-tid="message-avatar"><img src="${img}"></div>` : '') +
          `<div id="content-${feed.children.length}">${text}</div></div>`;
        feed.appendChild(row);
        captureNew(row);
      };
      newRow('Alice', 'message-author-name', avatar, 'First');
      newRow('Bob', 'threadBodyDisplayName', '', 'Own name in alternate layout');
      newRow('', '', '', 'Bob continuation');
      return sent.map(m => [m.chatname, m.chatimg]);
    }, avatar);
    assert.deepStrictEqual(result, [
      ['Alice', avatar], ['Bob', ''], ['Bob', ''], ['', ''],
      ['Alice', avatar], ['Bob', ''], ['Bob', '']
    ], 'Teams must preserve explicit authors and stop at the nearest header');
  } finally { await page.close(); }
}

async function riversideTests(browser) {
  const page = await harness(browser, 'riverside', '<title>Studio | Host\'s studio</title><div id="root"><div id="feed"></div></div>');
  try {
    const result = await page.evaluate(avatar => {
      const feed = document.querySelector('#feed');
      const group = (name, texts, image = '') => {
        const row = document.createElement('div');
        row.innerHTML = (name === null ? '' : `<div class="chat-sender-details"><span data-automation-class="sender-name">${name}</span>` +
          (image ? `<span class="chat-avatar"><img src="${image}"></span>` : '') + '</div>') +
          '<div>' + texts.map(text => `<div class="message">${text}</div>`).join('') + '</div>';
        feed.appendChild(row);
        row.querySelectorAll('.message').forEach(message => capture(message));
      };
      group('Alice', ['One'], avatar);
      group('Bob', ['Two', 'Three']);
      group(null, ['Missing author']);
      group('', ['Empty header']);
      // Nested content wrappers still belong to the one header in their group.
      const nested = document.createElement('div');
      nested.innerHTML = '<div><div class="chat-sender-details"><span data-automation-class="sender-name">Carol</span></div></div>' +
        '<section><div><div class="message">Nested one</div></div><div><div class="message">Nested two</div></div></section>';
      feed.appendChild(nested);
      nested.querySelectorAll('.message').forEach(message => capture(message));
      return sent.map(m => [m.chatname, m.chatimg]);
    }, avatar);
    assert.deepStrictEqual(result, [['Alice', avatar], ['Bob', ''], ['Bob', ''], ['', ''], ['', ''], ['Carol', ''], ['Carol', '']],
      'Riverside must not borrow another group or the studio title');
  } finally { await page.close(); }
}

async function picartoTests(browser) {
  const page = await harness(browser, 'picarto', '<div id="feed"></div>');
  try {
    const names = await page.evaluate(async () => {
      for (const name of ['Alice', 'Bob']) {
        const group = document.createElement('div');
        group.className = 'ChannelChat__MessageBoxWrapper';
        group.innerHTML = `<span class="ChannelDisplayName__Name">${name}</span><div><div class="StandardTypeMessagecontainer__BlockRow"><span class="Message__StyledSpan">First</span></div><div class="StandardTypeMessagecontainer__BlockRow"><span class="Message__StyledSpan">Second</span></div></div>`;
        document.querySelector('#feed').appendChild(group);
        for (const row of group.querySelectorAll('.StandardTypeMessagecontainer__BlockRow')) await capture(group, row);
      }
      return sent.map(m => m.chatname);
    });
    assert.deepStrictEqual(names, ['Alice', 'Alice', 'Bob', 'Bob'], 'Picarto consecutive messages remain within their group');
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await piczelTests(browser, true);
    await piczelTests(browser, false);
    await teamsTests(browser);
    await riversideTests(browser);
    await picartoTests(browser);
    console.log('Author attribution passed: Piczel (text/HTML, grouped mutations), Teams (both layouts), Riverside, Picarto.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
