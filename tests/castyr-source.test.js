const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "sources", "castyr.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
assert.ok(fs.existsSync(path.join(root, "sources", "images", "castyr.png")), "Castyr source icon is missing");

const manifestEntry = manifest.content_scripts.find((entry) =>
  entry.js && entry.js.includes("./sources/castyr.js")
);
assert.ok(manifestEntry, "Castyr content script entry is missing");
assert.deepStrictEqual(manifestEntry.matches, ["https://castyr.live/homebeta/popout-chat/*"]);

function chatMessages(page) {
  return page.evaluate(() => window.__castyrMessages.filter((message) => !message.event));
}

function waitForChatCount(page, expected) {
  return page.waitForFunction(
    (count) => window.__castyrMessages.filter((message) => !message.event).length === count,
    expected,
    { timeout: 7000 }
  );
}

async function installFixture(page, useChromeRuntime) {
  await page.setContent(`
    <!doctype html>
    <html>
      <body>
        <div class="chat-message-list">
          <p class="chat-system-message"><span>System</span><span>: Welcome to the stream!</span></p>
          <p id="backlog" class="chat-message" data-username="Backlog" data-timestamp="2026-08-15T12:00:00.000+00:00">
            <span class="chat-message-timestamp">08:00</span>
            <button class="chat-message-username" style="color: rgb(244, 114, 182)">Backlog</button>
            <span>: </span>
            <span class="chat-message-text">Already visible</span>
          </p>
        </div>
        <form><input id="chat-input" placeholder="Send a message…" type="text"></form>
        <div id="viewer-count" title="1 active in chat"><svg></svg><span>1</span></div>
      </body>
    </html>
  `);

  await page.addScriptTag({
    content: `
      window.__castyrMessages = [];
      window.__castyrRuntimeListener = null;
      window.__addCastyrMessage = function (timestamp, name, messageHtml, color) {
        var row = document.createElement("p");
        row.className = "chat-message";
        row.setAttribute("data-username", name);
        row.setAttribute("data-timestamp", timestamp);

        var time = document.createElement("span");
        time.className = "chat-message-timestamp";
        time.textContent = "08:37";

        var username = document.createElement("button");
        username.className = "chat-message-username";
        username.style.color = color || "";
        username.textContent = name;

        var separator = document.createElement("span");
        separator.textContent = ": ";

        var message = document.createElement("span");
        message.className = "chat-message-text";
        message.innerHTML = messageHtml;

        row.appendChild(time);
        row.appendChild(username);
        row.appendChild(separator);
        row.appendChild(message);
        document.querySelector(".chat-message-list").appendChild(row);
        return row;
      };

      window.__sendCastyrRuntimeMessage = function (request) {
        return new Promise(function (resolve) {
          window.__castyrRuntimeListener(request, {}, resolve);
        });
      };
    `
  });

  if (useChromeRuntime) {
    await page.addScriptTag({
      content: `
        window.chrome = {
          runtime: {
            id: "test-extension",
            lastError: null,
            sendMessage: function (id, payload, callback) {
              if (payload && payload.getSettings) {
                if (callback) callback({ state: true, settings: { textonlymode: false, showviewercount: true } });
                return;
              }
              if (payload && payload.message) window.__castyrMessages.push(payload.message);
              if (callback) callback({});
            },
            onMessage: {
              addListener: function (listener) {
                window.__castyrRuntimeListener = listener;
              }
            }
          }
        };
      `
    });
  } else {
    await page.addScriptTag({
      content: `
        window.ninjafy = {
          sendMessage: function (id, payload) {
            if (payload && payload.message) window.__castyrMessages.push(payload.message);
          }
        };
      `
    });
  }

  await page.addScriptTag({ content: source });
  await page.waitForFunction(() => document.getElementById("backlog").dataset.ssnCastyrMessageKey);
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const extensionPage = await browser.newPage();
  await installFixture(extensionPage, true);

  assert.strictEqual((await chatMessages(extensionPage)).length, 0, "initial chat history should be skipped");
  await extensionPage.waitForFunction(() =>
    window.__castyrMessages.some((message) => message.event === "viewer_update" && message.meta === 1)
  );

  await extensionPage.evaluate(() => {
    window.__addCastyrMessage(
      "2026-08-15T12:37:37.051+00:00",
      "evarate",
      'Hello &lt;Castyr&gt; <strong>friends</strong> <img src="https://castyr.live/emote.png" alt=":wave:">',
      "rgb(244, 114, 182)"
    );
  });
  await waitForChatCount(extensionPage, 1);

  const richMessage = (await chatMessages(extensionPage))[0];
  assert.strictEqual(richMessage.type, "castyr");
  assert.strictEqual(richMessage.chatname, "evarate");
  assert.strictEqual(richMessage.textonly, false);
  assert.ok(richMessage.chatmessage.includes("Hello &lt;Castyr&gt; friends"), richMessage.chatmessage);
  assert.ok(richMessage.chatmessage.includes('<img src="https://castyr.live/emote.png" alt=":wave:">'));
  assert.strictEqual(richMessage.nameColor, "rgb(244, 114, 182)");

  await extensionPage.evaluate(() => {
    window.__addCastyrMessage(
      "2026-08-15T12:37:37.051+00:00",
      "evarate",
      "Hello again after a redraw",
      "rgb(244, 114, 182)"
    );
  });
  await extensionPage.waitForTimeout(400);
  assert.strictEqual((await chatMessages(extensionPage)).length, 1, "a remounted timestamp must not duplicate");

  await extensionPage.evaluate(() => {
    window.__addCastyrMessage(
      "2026-08-15T12:37:38.051+00:00",
      "evarate",
      "Hello again after a redraw",
      "rgb(244, 114, 182)"
    );
  });
  await waitForChatCount(extensionPage, 2);

  await extensionPage.evaluate(() => {
    var system = document.createElement("p");
    system.className = "chat-system-message";
    system.textContent = "System: someone followed";
    document.querySelector(".chat-message-list").appendChild(system);
  });
  await extensionPage.waitForTimeout(300);
  assert.strictEqual((await chatMessages(extensionPage)).length, 2, "system history must not be emitted as chat");

  await extensionPage.evaluate(() => {
    var count = document.getElementById("viewer-count");
    count.title = "2 active in chat";
    count.querySelector("span").textContent = "2";
    return window.__sendCastyrRuntimeMessage({ settings: { textonlymode: false, showviewercount: true } });
  });
  await extensionPage.waitForFunction(() =>
    window.__castyrMessages.some((message) => message.event === "viewer_update" && message.meta === 2)
  );

  assert.strictEqual(await extensionPage.evaluate(() => window.__sendCastyrRuntimeMessage("getSource")), "castyr");
  assert.strictEqual(await extensionPage.evaluate(() => window.__sendCastyrRuntimeMessage("focusChat")), true);
  assert.strictEqual(await extensionPage.evaluate(() => document.activeElement.id), "chat-input");

  await extensionPage.evaluate(() =>
    window.__sendCastyrRuntimeMessage({ settings: { textonlymode: true, showviewercount: true } })
  );
  await extensionPage.evaluate(() => {
    window.__addCastyrMessage(
      "2026-08-15T12:37:39.051+00:00",
      "plain-user",
      'Plain <strong>bold</strong> <img src="https://castyr.live/emote.png" alt=":wave:">',
      ""
    );
  });
  await waitForChatCount(extensionPage, 3);
  const plainMessage = (await chatMessages(extensionPage))[2];
  assert.strictEqual(plainMessage.textonly, true);
  assert.strictEqual(plainMessage.chatmessage, "Plain bold :wave:");

  await extensionPage.evaluate(() => window.__sendCastyrRuntimeMessage({ state: false }));
  await extensionPage.evaluate(() => {
    window.__addCastyrMessage(
      "2026-08-15T12:37:40.051+00:00",
      "disabled-user",
      "Should not send",
      ""
    );
  });
  await extensionPage.waitForTimeout(400);
  assert.strictEqual((await chatMessages(extensionPage)).length, 3, "disabled source should not send chat");

  const electronPage = await browser.newPage();
  await installFixture(electronPage, false);
  await electronPage.evaluate(() => {
    window.__addCastyrMessage(
      "2026-08-15T12:37:41.051+00:00",
      "electron-user",
      "App bridge message",
      ""
    );
  });
  await waitForChatCount(electronPage, 1);
  assert.strictEqual((await chatMessages(electronPage))[0].chatmessage, "App bridge message");

  await browser.close();
  console.log("Castyr source passed (chat, viewer count, focus, state, and app bridge).");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
