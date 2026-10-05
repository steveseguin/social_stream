const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const source = fs.readFileSync(path.resolve(__dirname, "..", "sources", "vkvideo.js"), "utf8");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent('<div class="Chat_root_current" id="chat"></div>');
  await page.addScriptTag({ content: `
    window.__vkMessages = [];
    window.chrome = {
      runtime: {
        id: "test-extension",
        lastError: null,
        sendMessage: function (id, payload, callback) {
          if (payload && payload.getSettings) {
            callback({ settings: { textonlymode: false }, state: true });
            return;
          }
          if (payload && payload.message) window.__vkMessages.push(payload.message);
          if (callback) callback({});
        },
        onMessage: { addListener: function () {} }
      }
    };
    window.__addVkMessage = function (name, message, color) {
      var row = document.createElement("div");
      row.className = "ChatMessage_root_current MessagesList_message_current";
      document.getElementById("chat").appendChild(row);

      var author = document.createElement("span");
      author.className = "ChatMessageAuthorPanel_name_current";
      author.style.color = color || "";
      author.textContent = name + ":";
      row.appendChild(author);

      var content = document.createElement("div");
      content.dataset.role = "messageMainContent";
      content.textContent = message;
      row.appendChild(content);
      return row;
    };
  ` });
  await page.addScriptTag({ content: source });
  await page.waitForFunction(() => document.getElementById("chat").marked === true);

  await page.evaluate(() => {
    window.__addVkMessage("History", "Hydrated backlog", "");
  });
  await page.waitForTimeout(2200);
  assert.strictEqual(await page.evaluate(() => window.__vkMessages.length), 0, "hydrated startup history should not send");

  await page.evaluate(() => {
    window.__addVkMessage("PumychPlay", "VK popup works", "rgb(10, 20, 30)");
  });

  await page.waitForFunction(() => window.__vkMessages.length === 1);
  const message = await page.evaluate(() => window.__vkMessages[0]);
  assert.strictEqual(message.type, "vkvideo");
  assert.strictEqual(message.chatname, "PumychPlay");
  assert.strictEqual(message.chatmessage, "VK popup works");
  assert.strictEqual(message.nameColor, "rgb(10, 20, 30)");

  await page.evaluate(() => {
    document.querySelector("[data-role='messageMainContent']").appendChild(document.createElement("span"));
  });
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => window.__vkMessages.length), 1, "message should not duplicate");

  await browser.close();
  console.log("VK Video source passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
