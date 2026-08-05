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

    window.__addBlazeMessage = function (index, name, message, includeOwnerButton, opts) {
      opts = opts || {};
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

      if (opts.botIcon) {
        var bot = document.createElement("button");
        bot.setAttribute("aria-label", "Open user actions for " + name + " (Bot)");
        bot.innerHTML = '<svg class="lucide lucide-bot"><path d="M12 8V4H8"></path></svg>';
        row.appendChild(bot);
      }

      if (opts.subBadge) {
        var sub = document.createElement("button");
        sub.setAttribute("aria-label", "Subscriber");
        sub.innerHTML = '<svg class="lucide lucide-star"><path d="M11.5 2.3"></path></svg>';
        row.appendChild(sub);
      }

      if (opts.vipBadge) {
        var vip = document.createElement("button");
        vip.setAttribute("aria-label", "VIP");
        var vipImg = document.createElement("img");
        vipImg.src = "https://cdn.blaze.stream/site/icons/vip.png";
        vip.appendChild(vipImg);
        row.appendChild(vip);
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

  // Rows arriving while the freshly detected list is still hydrating are backlog.
  await page.evaluate(() => window.__addBlazeMessage(1, "Hydrated", "Late backlog", false));
  await page.waitForFunction(() => document.querySelector('[data-item-index="1"]').dataset.ssnBlazeMessageSignature);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages.length), 0, "hydrating backlog should not send");
  await page.waitForTimeout(1500);

  await page.evaluate(() => window.__addBlazeMessage(2, "Streamer", "Owner message", true, { vipBadge: true, subBadge: true, botIcon: true }));
  await waitForMessageCount(page, 1);
  const ownerMessage = await page.evaluate(() => window.__blazeMessages[0]);
  assert.strictEqual(ownerMessage.type, "blaze");
  assert.strictEqual(ownerMessage.chatname, "Streamer");
  assert.strictEqual(ownerMessage.chatmessage, "Owner message");
  assert.strictEqual(ownerMessage.chatbadges.length, 2, "subscriber svg and VIP image badges should be captured");
  assert.strictEqual(typeof ownerMessage.chatbadges.find(b => typeof b === "string" && b.includes("vip.png")), "string", "VIP badge should be an image URL");
  const svgBadge = ownerMessage.chatbadges.find(b => b && b.type === "svg");
  assert(svgBadge && svgBadge.html.includes("<svg"), "subscriber badge should be captured as inline svg");
  assert.strictEqual(ownerMessage.vip, true, "VIP badge should set the vip flag");
  assert.strictEqual(ownerMessage.bot, true, "bot icon should set the bot flag");

  await page.evaluate(() => {
    var row = document.querySelector('[data-item-index="2"]');
    row.querySelector("button[title='User actions'] span.truncate").textContent = "Viewer:";
    row.querySelector(".text-text.pl-1.font-normal").textContent = "Recycled message";
  });
  await waitForMessageCount(page, 2);
  const recycledMessage = await page.evaluate(() => window.__blazeMessages[1]);
  assert.strictEqual(recycledMessage.chatname, "Viewer");
  assert.strictEqual(recycledMessage.chatmessage, "Recycled message");

  await page.waitForTimeout(600);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages.length), 2, "unchanged rows should not duplicate");

  // Virtuoso re-mount: an already-captured message returning as a fresh node must not re-emit.
  await page.evaluate(() => {
    document.querySelector('[data-item-index="2"]').remove();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__addBlazeMessage(2, "Viewer", "Recycled message", false));
  await page.waitForTimeout(700);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages.length), 2, "re-mounted rows should not re-emit");

  // A genuine repeat (same user, same text) at a new index is a new message.
  await page.evaluate(() => window.__addBlazeMessage(3, "Viewer", "Recycled message", false));
  await waitForMessageCount(page, 3);

  await browser.close();
  console.log("Blaze source passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
