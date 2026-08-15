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

function waitForSeededRows(page, indexes) {
  return page.waitForFunction(
    (expectedIndexes) => expectedIndexes.every((index) => {
      const row = document.querySelector('[data-item-index="' + index + '"]');
      return row && row.dataset.ssnBlazeMessageSignature;
    }),
    indexes,
    { timeout: 7000 }
  );
}

async function createHarnessPage(browser, includeChatList) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.setContent(includeChatList ? '<div data-testid="virtuoso-item-list" id="chat"></div>' : '<main id="root"></main>');
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

    window.__createBlazeChat = function () {
      var existing = document.getElementById("chat");
      if (existing) return existing;
      var chat = document.createElement("div");
      chat.id = "chat";
      chat.setAttribute("data-testid", "virtuoso-item-list");
      document.getElementById("root").appendChild(chat);
      return chat;
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

      // Mirrors the live site: badges, the bot icon, and the name button share a
      // span.inline-flex wrapper, so the production badge scope is exercised.
      var nameWrap = document.createElement("span");
      nameWrap.className = "inline-flex max-w-full items-center gap-1";

      if (opts.botIcon) {
        var bot = document.createElement("button");
        bot.setAttribute("aria-label", "Open user actions for " + name + " (Bot)");
        bot.innerHTML = '<svg class="lucide lucide-bot"><path d="M12 8V4H8"></path></svg>';
        nameWrap.appendChild(bot);
      }

      if (opts.subBadge) {
        var subWrap = document.createElement("span");
        subWrap.className = "relative inline-flex items-center";
        var sub = document.createElement("button");
        sub.setAttribute("aria-label", "Subscriber");
        sub.innerHTML = '<svg class="lucide lucide-star"><path d="M11.5 2.3"></path></svg>';
        subWrap.appendChild(sub);
        nameWrap.appendChild(subWrap);
      }

      if (opts.vipBadge) {
        var vipWrap = document.createElement("span");
        vipWrap.className = "relative inline-flex items-center";
        var vip = document.createElement("button");
        vip.setAttribute("aria-label", "VIP");
        var vipImg = document.createElement("img");
        vipImg.src = "https://cdn.blaze.stream/site/icons/vip.png";
        vip.appendChild(vipImg);
        vipWrap.appendChild(vip);
        nameWrap.appendChild(vipWrap);
      }

      var nameButton = document.createElement("button");
      nameButton.className = "inline-flex min-w-0 max-w-36 items-center gap-1";
      nameButton.title = "User actions";
      var nameSpan = document.createElement("span");
      nameSpan.className = "truncate";
      nameSpan.textContent = name + ":";
      nameButton.appendChild(nameSpan);
      nameWrap.appendChild(nameButton);
      row.appendChild(nameWrap);

      var body = document.createElement("span");
      body.className = "text-text pl-1 font-normal";
      body.textContent = message;
      row.appendChild(body);
      document.getElementById("chat").appendChild(row);
      return row;
    };
  ` });
  return { page, pageErrors };
}

async function loadSource(page) {
  await page.addScriptTag({ content: source });
}

async function waitForChatConnection(page) {
  await page.waitForFunction(() => {
    var chat = document.getElementById("chat");
    return chat && chat.marked === true;
  }, null, { timeout: 7000 });
}

async function assertNoPageErrors(pageErrors, scenario) {
  assert.deepStrictEqual(pageErrors.map((error) => error.message), [], scenario + " should not raise page errors");
}

async function testBacklogAndSteadyState(browser) {
  const { page, pageErrors } = await createHarnessPage(browser, true);
  await page.evaluate(() => {
    window.__addBlazeMessage(0, "Backlog", "Old message", false);
    window.__addBlazeMessage(1, "Hydrated", "Late backlog", false);
  });
  await loadSource(page);
  await waitForSeededRows(page, [0, 1]);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages.length), 0, "initial backlog should not send");

  await page.evaluate(() => window.__addBlazeMessage(2, "Streamer", "Owner message", true, { vipBadge: true, subBadge: true, botIcon: true }));
  await waitForMessageCount(page, 1);
  const ownerMessage = await page.evaluate(() => window.__blazeMessages[0]);
  assert.strictEqual(ownerMessage.type, "blaze");
  assert.strictEqual(ownerMessage.chatname, "Streamer");
  assert.strictEqual(ownerMessage.chatmessage, "Owner message");
  assert.strictEqual(ownerMessage.chatbadges.length, 2, "subscriber svg and VIP image badges should be captured");
  assert.strictEqual(typeof ownerMessage.chatbadges.find((badge) => typeof badge === "string" && badge.includes("vip.png")), "string", "VIP badge should be an image URL");
  const svgBadge = ownerMessage.chatbadges.find((badge) => badge && badge.type === "svg");
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

  await page.evaluate(() => document.querySelector('[data-item-index="2"]').remove());
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__addBlazeMessage(2, "Viewer", "Recycled message", false));
  await page.waitForTimeout(700);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages.length), 2, "re-mounted rows should not re-emit");

  await page.evaluate(() => window.__addBlazeMessage(3, "Viewer", "Recycled message", false));
  await waitForMessageCount(page, 3);
  await assertNoPageErrors(pageErrors, "steady-state capture");
  await page.close();
}

async function testEmptyChatFirstMessage(browser) {
  const { page, pageErrors } = await createHarnessPage(browser, true);
  await loadSource(page);
  await waitForChatConnection(page);
  await page.evaluate(() => window.__addBlazeMessage(0, "First", "Do not lose me", false));
  await waitForMessageCount(page, 1);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages[0].chatmessage), "Do not lose me");
  await assertNoPageErrors(pageErrors, "empty chat first message");
  await page.close();
}

async function testLazyListFirstMessage(browser) {
  const { page, pageErrors } = await createHarnessPage(browser, false);
  await loadSource(page);
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    window.__createBlazeChat();
    window.__addBlazeMessage(0, "Lazy", "List and message appeared together", false);
  });
  await waitForMessageCount(page, 1);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages[0].chatname), "Lazy");
  await assertNoPageErrors(pageErrors, "lazy list first message");
  await page.close();
}

async function testDelayedHistoryBatch(browser) {
  const { page, pageErrors } = await createHarnessPage(browser, true);
  await loadSource(page);
  await waitForChatConnection(page);
  await page.waitForTimeout(1700);
  await page.evaluate(() => {
    for (var index = 0; index < 20; index++) {
      window.__addBlazeMessage(index, "History" + index, "Delayed history " + index, false);
    }
  });
  await waitForSeededRows(page, Array.from({ length: 20 }, (_, index) => index));
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages.length), 0, "history arriving after the old timeout should not send");
  await page.evaluate(() => window.__addBlazeMessage(20, "Live", "After delayed history", false));
  await waitForMessageCount(page, 1);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages[0].chatmessage), "After delayed history");
  await assertNoPageErrors(pageErrors, "delayed history batch");
  await page.close();
}

async function testProgressiveHistoryBatch(browser) {
  const { page, pageErrors } = await createHarnessPage(browser, true);
  await loadSource(page);
  await waitForChatConnection(page);
  await page.evaluate(() => {
    window.__addBlazeMessage(0, "History0", "Progressive history 0", false);
    setTimeout(function() {
      window.__addBlazeMessage(1, "History1", "Progressive history 1", false);
    }, 150);
  });
  await waitForSeededRows(page, [0, 1]);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages.length), 0, "a progressively hydrated history batch should not send");
  await page.evaluate(() => window.__addBlazeMessage(2, "Live", "After progressive history", false));
  await waitForMessageCount(page, 1);
  await assertNoPageErrors(pageErrors, "progressive history batch");
  await page.close();
}

async function testAdvancedHistoryIndex(browser) {
  const { page, pageErrors } = await createHarnessPage(browser, true);
  await loadSource(page);
  await waitForChatConnection(page);
  await page.evaluate(() => window.__addBlazeMessage(17, "History", "Advanced index history", false));
  await waitForSeededRows(page, [17]);
  assert.strictEqual(await page.evaluate(() => window.__blazeMessages.length), 0, "an advanced initial row should be treated as history");
  await page.evaluate(() => window.__addBlazeMessage(18, "Live", "After advanced history", false));
  await waitForMessageCount(page, 1);
  await assertNoPageErrors(pageErrors, "advanced history index");
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await testBacklogAndSteadyState(browser);
    await testEmptyChatFirstMessage(browser);
    await testLazyListFirstMessage(browser);
    await testDelayedHistoryBatch(browser);
    await testProgressiveHistoryBatch(browser);
    await testAdvancedHistoryIndex(browser);
  } finally {
    await browser.close();
  }
  console.log("Blaze source passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
