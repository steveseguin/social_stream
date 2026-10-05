const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "sources", "flextv.js"), "utf8");
const soakIterations = Number(process.env.FLEXTV_SOAK_ITERATIONS || 30);

function waitForMessageCount(page, expected, timeout = 7000) {
  return page.waitForFunction(
    (count) => window.__flextvMessages && window.__flextvMessages.length === count,
    expected,
    { timeout }
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(`
    <!doctype html>
    <html>
      <body>
        <div class="chat-content relative!">
          <div class="chat-list overscroll-none touch-scroll-y" style="display: flex; flex-direction: column-reverse;">
            <div id="chat-feed" style="display: block; z-index: 1; zoom: 1;">
              <div id="message-root"></div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `);

  await page.addScriptTag({
    content: `
      window.__flextvMessages = [];
      window.__memberId = 970221;
      window.chrome = {
        runtime: {
          id: "test-extension",
          lastError: null,
          sendMessage: function (id, payload, callback) {
            if (payload && payload.getSettings) {
              if (callback) {
                callback({ settings: { textonlymode: false } });
              }
              return;
            }
            if (payload && payload.message) {
              window.__flextvMessages.push(payload.message);
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

      window.__addFlexMessage = function (id, name, messageHtml, options) {
        options = options || {};
        var member = {
          id: options.userId || window.__memberId++,
          channelId: options.channelId || 708210,
          loginId: options.loginId || "sh5712",
          nickname: name,
          gender: "M",
          level: options.level || 0,
          month: 0,
          role: { app: "V", channel: "V" },
          isIdentify: true,
          ranking: typeof options.ranking === "number" ? options.ranking : -1,
          isDumb: false
        };

        var wrapper = document.createElement("div");
        var item = document.createElement("div");
        item.className = "chat-item";
        item.id = id;

        var bg = document.createElement("div");
        bg.className = "bg";
        bg.style.paddingLeft = "0px";

        var emojiWrap = document.createElement("div");
        emojiWrap.className = "emoji-wrap ";

        var txtWrap = document.createElement("div");
        txtWrap.className = "txt-wrap";
        txtWrap.style.marginBottom = "0px";

        var header = document.createElement("div");
        header.className = "flex items-center gap-[6px]";

        var badge = document.createElement("img");
        badge.className = "h-[20px] sm:h-[24px] object-contain";
        badge.src = options.badge || "https://static.flextv.co.kr/20240802/ico_user_normal_81685e8c4b.png";
        header.appendChild(badge);

        var nameWrapper = document.createElement("span");
        nameWrapper.className = "chat-user-name cursor-pointer flex items-center";
        nameWrapper.style.color = options.nameColor || "rgb(0, 0, 0)";
        nameWrapper.style.textShadow = "none";

        var nameSpan = document.createElement("span");
        nameSpan.className = "inline-block";
        nameSpan.dataset.member = JSON.stringify(member);
        nameSpan.textContent = name;
        nameWrapper.appendChild(nameSpan);

        var gender = document.createElement("img");
        gender.alt = "gender";
        gender.className = "w-[8px] h-[10px] object-contain ml-1";
        gender.src = "/svg/ico_man.svg";
        nameWrapper.appendChild(gender);
        header.appendChild(nameWrapper);

        var body = document.createElement("div");
        body.className = "flex flex-col";
        var chat = document.createElement("div");
        chat.className = "chat ml-[30px]!";
        chat.style.color = "rgb(0, 0, 0)";
        chat.style.textShadow = "none";
        var chatInner = document.createElement("div");
        chatInner.innerHTML = messageHtml;
        chat.appendChild(chatInner);
        body.appendChild(chat);

        txtWrap.appendChild(header);
        txtWrap.appendChild(body);
        bg.appendChild(emojiWrap);
        bg.appendChild(txtWrap);
        item.appendChild(bg);
        wrapper.appendChild(item);
        document.getElementById("message-root").appendChild(wrapper);
        return id;
      };

      window.__updateFlexMessageText = function (id, message) {
        var span = document.querySelector("#" + id + " .chat span");
        if (!span) {
			return false;
		}
        if (span.firstChild) {
          span.firstChild.nodeValue = message;
        } else {
          span.textContent = message;
        }
        return true;
      };
    `
  });

  await page.evaluate(() => {
    window.__addFlexMessage("backlog-1", "\uD604\uC774:)", "<span>\uC774\uC804</span>", { userId: 970221 });
  });

  await page.addScriptTag({ content: source });
  await page.waitForFunction(() => document.querySelector("#backlog-1")?.dataset.ssnLastMessageSignature);
  assert.strictEqual(await page.evaluate(() => window.__flextvMessages.length), 0, "initial backlog should not send");

  await page.evaluate(() => {
    window.__addFlexMessage("pending-1", "\uB290\uB9B0\uC0AC\uC6A9\uC790", "<span></span>", { userId: 970223 });
  });
  await page.waitForTimeout(1300);
  assert.strictEqual(await page.evaluate(() => window.__flextvMessages.length), 0, "empty pending row should not send");

  await page.evaluate(() => window.__updateFlexMessageText("pending-1", "\uB2A6\uAC8C \uB4E4\uC5B4\uC628 \uCC44\uD305"));
  await waitForMessageCount(page, 1);
  assert.strictEqual(await page.evaluate(() => window.__flextvMessages[0].chatmessage), "\uB2A6\uAC8C \uB4E4\uC5B4\uC628 \uCC44\uD305");

  await page.evaluate(() => {
    window.__addFlexMessage("live-1", "\uD604\uC774:)", "<span>\u3145\u3145\u3145</span>", {
      userId: 970222,
      badge: "https://static.flextv.co.kr/fanIcon/202507/fd6d7f343c6eed67.png",
      nameColor: "rgb(255, 2, 74)",
      ranking: 2
    });
  });
  await waitForMessageCount(page, 2);

  const first = await page.evaluate(() => window.__flextvMessages[1]);
  assert.strictEqual(first.type, "flextv");
  assert.strictEqual(first.chatname, "\uD604\uC774:)");
  assert.strictEqual(first.chatmessage, "\u3145\u3145\u3145");
  assert.strictEqual(first.userid, "970222", JSON.stringify(first));
  assert.strictEqual(first.meta.userId, 970222);
  assert.strictEqual(first.meta.ranking, 2);
  assert.deepStrictEqual(first.chatbadges, ["https://static.flextv.co.kr/fanIcon/202507/fd6d7f343c6eed67.png"]);
  assert.ok(first.nameColor.indexOf("255") !== -1, "name color should be preserved");

  await page.waitForTimeout(1300);
  assert.strictEqual(await page.evaluate(() => window.__flextvMessages.length), 2, "idle scan should not duplicate");

  await page.evaluate(() => window.__updateFlexMessageText("live-1", "\uBCC0\uACBD\uB41C \uCC44\uD305"));
  await waitForMessageCount(page, 3);
  assert.strictEqual(await page.evaluate(() => window.__flextvMessages[2].chatmessage), "\uBCC0\uACBD\uB41C \uCC44\uD305");

  await page.evaluate(async (count) => {
    for (var i = 0; i < count; i++) {
      window.__addFlexMessage("soak-" + i, "soak-user-" + i, "<span>soak message " + i + "</span>", {
        userId: 980000 + i
      });
      await new Promise((resolve) => setTimeout(resolve, 3));
    }
  }, soakIterations);
  await waitForMessageCount(page, 3 + soakIterations, 15000);

  const reuseIterations = Math.max(5, Math.floor(soakIterations / 5));
  await page.evaluate(async (count) => {
    for (var i = 0; i < count; i++) {
      window.__updateFlexMessageText("live-1", "reuse message " + i);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }, reuseIterations);
  await waitForMessageCount(page, 3 + soakIterations + reuseIterations, 15000);

  await page.waitForTimeout(1700);
  assert.strictEqual(
    await page.evaluate(() => window.__flextvMessages.length),
    3 + soakIterations + reuseIterations,
    "post-soak idle scan should not duplicate"
  );

  await browser.close();
  console.log(`FLEX TV source passed (${soakIterations} appended, ${reuseIterations} reused).`);
})().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
