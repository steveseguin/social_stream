const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");

function runtimeStub(messageStoreName) {
  return `
    window.${messageStoreName} = [];
    window.chrome = {
      runtime: {
        id: "test-extension",
        lastError: null,
        sendMessage: function (id, payload, callback) {
          if (payload && payload.getSettings) {
            if (callback) callback({ state: true, settings: { textonlymode: true } });
            return;
          }
          if (payload && payload.message) window.${messageStoreName}.push(payload.message);
          if (callback) callback({});
        },
        onMessage: { addListener: function () {} }
      }
    };
  `;
}

async function testGeneric(browser) {
  const page = await browser.newPage();
  await page.setContent(`
    <div class="chat-messages" id="generic-chat">
      <div class="chat-message"><span class="username">Old</span><span class="content">old message</span></div>
    </div>
  `);
  await page.addScriptTag({ content: runtimeStub("__genericMessages") });
  await page.addScriptTag({ content: fs.readFileSync(path.join(root, "sources", "generic.js"), "utf8") });
  await page.waitForFunction(() => document.getElementById("generic-chat").hasObserver === true);
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => window.__genericMessages.length), 0, "generic capture should ignore startup history");

  await page.evaluate(() => {
    const row = document.createElement("div");
    row.className = "chat-message";
    row.innerHTML = '<span class="username">Live</span><span class="content">first live message</span>';
    document.getElementById("generic-chat").appendChild(row);
  });
  await page.waitForFunction(() => window.__genericMessages.length === 1);

  await page.evaluate(() => {
    const current = document.getElementById("generic-chat");
    const replacement = current.cloneNode(true);
    current.replaceWith(replacement);
  });
  await page.waitForFunction(() => document.getElementById("generic-chat").hasObserver === true, null, { timeout: 7000 });
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => window.__genericMessages.length), 1, "generic capture should ignore remounted history");

  await page.evaluate(() => {
    const row = document.createElement("div");
    row.className = "chat-message";
    row.innerHTML = '<span class="username">Live</span><span class="content">second live message</span>';
    document.getElementById("generic-chat").appendChild(row);
  });
  await page.waitForFunction(() => window.__genericMessages.length === 2);
  await page.close();
}

async function testEStream(browser) {
  const page = await browser.newPage();
  await page.setContent(`
    <div class="chat-container"><div class="messages" id="estrim-chat">
      <div><span class="username">Old:</span><span class="msg">old message</span></div>
    </div></div>
  `);
  await page.addScriptTag({ content: runtimeStub("__estrimMessages") });
  await page.addScriptTag({ content: fs.readFileSync(path.join(root, "sources", "estrim.js"), "utf8") });
  await page.waitForFunction(() => document.getElementById("estrim-chat").marked === true);
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => window.__estrimMessages.length), 0, "eStream capture should ignore startup history");

  await page.evaluate(() => {
    const row = document.createElement("div");
    row.innerHTML = '<span class="username">Live:</span><span class="msg">first live message</span>';
    document.getElementById("estrim-chat").appendChild(row);
  });
  await page.waitForFunction(() => window.__estrimMessages.length === 1);

  await page.evaluate(() => {
    const current = document.getElementById("estrim-chat");
    const replacement = current.cloneNode(true);
    current.replaceWith(replacement);
  });
  await page.waitForFunction(() => document.getElementById("estrim-chat").marked === true);
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => window.__estrimMessages.length), 1, "eStream capture should ignore remounted history");

  await page.evaluate(() => {
    const row = document.createElement("div");
    row.innerHTML = '<span class="username">Live:</span><span class="msg">second live message</span>';
    document.getElementById("estrim-chat").appendChild(row);
  });
  await page.waitForFunction(() => window.__estrimMessages.length === 2);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await testGeneric(browser);
    await testEStream(browser);
    console.log("Source backlog suppression regression passed.");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
