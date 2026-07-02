const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "sources", "parti.js"), "utf8");

async function waitForMessageCount(page, expected, timeout = 7000) {
  await page.waitForFunction(
    (count) => window.__partiMessages && window.__partiMessages.length === count,
    expected,
    { timeout }
  );
}

async function createPartiPage(browser, settings) {
  const page = await browser.newPage();
  const sourceSettings = settings || { textonlymode: false };

  await page.setContent(`
    <!doctype html>
    <html>
      <body>
        <div id="q-app">
          <main>
            <div>
              <div class="parti-shell">
                <div class="creator-chat-stream" id="parti-chat"></div>
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  `);

  await page.addScriptTag({
    content: `
      window.__partiMessages = [];
      window.__partiSettings = ${JSON.stringify(sourceSettings)};
      window.chrome = {
        runtime: {
          id: "test-extension",
          lastError: null,
          sendMessage: function (id, payload, callback) {
            if (payload && payload.getSettings) {
              if (callback) {
                callback({ state: true, settings: window.__partiSettings });
              }
              return;
            }
            if (payload && payload.message) {
              window.__partiMessages.push(payload.message);
            }
            if (callback) {
              callback({});
            }
          },
          onMessage: {
            addListener: function () {}
          }
        }
      };

      window.__addPartiMessage = function (name, message, options) {
        options = options || {};
        var row = document.createElement("div");
        row.className = "ccs-row";

        var link = document.createElement("a");
        link.href = "/@" + name;
        link.textContent = "@" + name;
        link.style.color = options.nameColor || "rgb(10, 20, 30)";
        row.appendChild(link);

        if (options.html) {
          var htmlSpan = document.createElement("span");
          htmlSpan.innerHTML = options.html;
          row.appendChild(htmlSpan);
        } else {
          row.appendChild(document.createTextNode(" " + message));
        }

        if (options.contentimg) {
          var img = document.createElement("img");
          img.src = options.contentimg;
          row.appendChild(img);
        }

        document.getElementById("parti-chat").appendChild(row);
      };

      window.__addPartiTip = function (name, amountText) {
        var row = document.createElement("div");
        row.className = "ccs-row";
        row.textContent = name + " has tipped " + amountText + " \\uD83C\\uDF89";
        document.getElementById("parti-chat").appendChild(row);
      };

      window.__addLegacyPartiMessage = function (name, messageHtml, options) {
        options = options || {};
        var row = document.createElement("div");

        var badge = document.createElement("img");
        badge.className = "q-img__image";
        badge.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
        row.appendChild(badge);

        var avatar = document.createElement("img");
        avatar.className = "q-img__image";
        avatar.src = options.avatar || "https://cdn.parti.test/avatar.png";
        row.appendChild(avatar);

        var username = document.createElement("span");
        username.className = "username";
        var h6 = document.createElement("h6");
        h6.textContent = name;
        h6.style.color = options.nameColor || "rgb(7, 8, 9)";
        username.appendChild(h6);
        row.appendChild(username);

        var message = document.createElement("span");
        message.innerHTML = messageHtml;
        row.appendChild(message);

        document.getElementById("parti-chat").appendChild(row);
      };
    `
  });

  await page.addScriptTag({ content: source });
  await page.waitForFunction(() => document.getElementById("parti-chat").partiObserverAttached === true);
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const page = await createPartiPage(browser, { textonlymode: false });

  await page.evaluate(() => window.__addPartiMessage("Alice", "hello parti"));
  await waitForMessageCount(page, 1);

  await page.evaluate(() => window.__addPartiMessage("Alice", "hello parti"));
  await page.waitForTimeout(300);
  assert.strictEqual(
    await page.evaluate(() => window.__partiMessages.length),
    1,
    "same Parti row cloned within the duplicate window should only send once"
  );

  await page.waitForTimeout(1700);
  await page.evaluate(() => window.__addPartiMessage("Alice", "hello parti"));
  await waitForMessageCount(page, 2);

  const first = await page.evaluate(() => window.__partiMessages[0]);
  assert.strictEqual(first.type, "parti");
  assert.strictEqual(first.chatname, "Alice");
  assert.strictEqual(first.chatmessage, "hello parti");
  assert.strictEqual(first.textonly, false);

  await page.evaluate(() => window.__addPartiMessage("Bob", "5 < 6 & hi", { nameColor: "rgb(1, 2, 3)" }));
  await waitForMessageCount(page, 3);
  const escaped = await page.evaluate(() => window.__partiMessages[2]);
  assert.strictEqual(escaped.chatname, "Bob");
  assert.strictEqual(escaped.chatmessage, "5 &lt; 6 &amp; hi");
  assert.strictEqual(escaped.nameColor, "rgb(1, 2, 3)");

  await page.evaluate(() =>
    window.__addPartiMessage("Cara", "look", { contentimg: "https://cdn.parti.test/image.png" })
  );
  await waitForMessageCount(page, 4);
  const imageMessage = await page.evaluate(() => window.__partiMessages[3]);
  assert.strictEqual(imageMessage.chatname, "Cara");
  assert.strictEqual(imageMessage.chatmessage, "look");
  assert.strictEqual(imageMessage.contentimg, "https://cdn.parti.test/image.png");

  await page.evaluate(() => window.__addPartiTip("Dana", "$12.50"));
  await waitForMessageCount(page, 5);
  const tip = await page.evaluate(() => window.__partiMessages[4]);
  assert.strictEqual(tip.type, "parti");
  assert.strictEqual(tip.chatname, "Dana");
  assert.strictEqual(tip.chatmessage, "Dana has tipped $12.50 \uD83C\uDF89");
  assert.strictEqual(tip.hasDonation, "$12.50");
  assert.strictEqual(tip.donoValue, 12.5);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(tip, "event"), false);

  await page.evaluate(() =>
    window.__addLegacyPartiMessage("LegacyUser", 'legacy <img src="https://cdn.parti.test/emote.png">', {
      avatar: "https://cdn.parti.test/avatar.png",
      nameColor: "rgb(7, 8, 9)"
    })
  );
  await waitForMessageCount(page, 6);
  const legacy = await page.evaluate(() => window.__partiMessages[5]);
  assert.strictEqual(legacy.chatname, "LegacyUser");
  assert.strictEqual(legacy.chatimg, "https://cdn.parti.test/avatar.png");
  assert.strictEqual(legacy.nameColor, "rgb(7, 8, 9)");
  assert.ok(Array.isArray(legacy.chatbadges), "legacy badge should be captured as an array");
  assert.ok(legacy.chatmessage.indexOf("legacy") !== -1, legacy.chatmessage);
  assert.ok(legacy.chatmessage.indexOf("https://cdn.parti.test/emote.png") !== -1, legacy.chatmessage);

  const textOnlyPage = await createPartiPage(browser, { textonlymode: true });

  await textOnlyPage.evaluate(() => window.__addPartiMessage("Eve", "5 < 6 & hi"));
  await waitForMessageCount(textOnlyPage, 1);
  const textOnly = await textOnlyPage.evaluate(() => window.__partiMessages[0]);
  assert.strictEqual(textOnly.chatname, "Eve");
  assert.strictEqual(textOnly.chatmessage, "5 < 6 & hi");
  assert.strictEqual(textOnly.textonly, true);

  await textOnlyPage.evaluate(() =>
    window.__addPartiMessage("Finn", "", {
      html: 'bold <strong>safe</strong><img src="https://cdn.parti.test/ignored.png">'
    })
  );
  await waitForMessageCount(textOnlyPage, 2);
  const textOnlyRich = await textOnlyPage.evaluate(() => window.__partiMessages[1]);
  assert.strictEqual(textOnlyRich.chatname, "Finn");
  assert.strictEqual(textOnlyRich.chatmessage, "bold safe");
  assert.strictEqual(textOnlyRich.contentimg, "");

  await browser.close();
  console.log("Parti source payload regression passed.");
})().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
