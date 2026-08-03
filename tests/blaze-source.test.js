const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const source = fs.readFileSync(path.resolve(__dirname, "..", "sources", "blaze.js"), "utf8");

function waitForMessageCount(page, expected) {
  return page.waitForFunction(
    (count) => window.__blazeMessages && window.__blazeMessages.length === count,
    expected,
    { timeout: 7000 }
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent('<div data-testid="virtuoso-item-list" id="chat"></div>');
  await page.addScriptTag({ content: `
    window.__blazeMessages = [];
    window.chrome = {
      runtime: {
        id: "test-extension",
        lastError: null,
        sendMessage: function (id, payload, callback) {
          if (payload && payload.getSettings) {
            callback({ settings: { textonlymode: false }, state: true });
            return;
          }
          if (payload && payload.message) window.__blazeMessages.push(payload.message);
          if (callback) callback({});
        },
        onMessage: { addListener: function () {} }
      }
    };

    window.__addBlazeMessage = function (index, name, message, includeOwnerButton) {
      var row = document.createElement("div");
      row.dataset.itemIndex = String(index);
      row.dataset.index = String(index);
      row.dataset.knownSize = "42";

      var avatar = document.createElement("button");
      avatar.setAttribute("aria-label", name + " avatar");
      var image = document.createElement("img");
      image.src = "https://cdn.blaze.stream/uploads/avatar/test.png";
      avatar.appendChild(image);
      row.appendChild(avatar);

      if (includeOwnerButton) {
        var owner = document.createElement("button");
        owner.title = "User actions";
        row.appendChild(owner);
      }

      var nameButton = document.createElement("button");
      nameButton.title = "User actions";
      var nameSpan = document.createElement("span");
      nameSpan.className = "truncate";
      nameSpan.textContent = name + ":";
      nameButton.appendChild(nameSpan);
      row.appendChild(nameButton);

      var body = document.createElement("span");
      body.className = "text-text pl-1 font-normal";
      body.textContent = message;
      row.appendChild(body);
      document.getElementById("chat").appendChild(row);
      return row;
    };
  ` });

  await page.evaluate(() => window.__addBlazeMessage(0, "Backlog", "Old message", false));
  await page.addScriptTag({ content: source });
  await page.waitForFunction(() => document.querySelector('[data-item-index="0"]').dataset.ssnBlazeMessageSignature);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages.length), 0, "initial backlog should not send");

  await page.evaluate(() => window.__addBlazeMessage(1, "Streamer", "Owner message", true));
  await waitForMessageCount(page, 1);
  const ownerMessage = await page.evaluate(() => window.__blazeMessages[0]);
  assert.strictEqual(ownerMessage.type, "blaze");
  assert.strictEqual(ownerMessage.chatname, "Streamer");
  assert.strictEqual(ownerMessage.chatmessage, "Owner message");

  await page.evaluate(() => {
    var row = document.querySelector('[data-item-index="1"]');
    row.querySelector("button[title='User actions'] span.truncate").textContent = "Viewer:";
    row.querySelector(".text-text.pl-1.font-normal").textContent = "Recycled message";
  });
  await waitForMessageCount(page, 2);
  const recycledMessage = await page.evaluate(() => window.__blazeMessages[1]);
  assert.strictEqual(recycledMessage.chatname, "Viewer");
  assert.strictEqual(recycledMessage.chatmessage, "Recycled message");

  await page.waitForTimeout(600);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages.length), 2, "unchanged rows should not duplicate");

  await browser.close();
  console.log("Blaze source passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
