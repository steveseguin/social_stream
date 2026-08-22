const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const source = fs.readFileSync(path.resolve(__dirname, "..", "sources", "openai.js"), "utf8");

async function waitForMessageCount(page, count) {
  await page.waitForFunction(
    (expected) => window.__openAiMessages && window.__openAiMessages.length === expected,
    count,
    { timeout: 7000 }
  );
}

async function createHarnessPage(browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.setContent('<main id="conversation"></main><form><div id="prompt-textarea" contenteditable="true"></div></form>');
  await page.addScriptTag({ content: `
    window.__openAiMessages = [];
    window.__runtimeListener = null;
    window.chrome = {
      runtime: {
        id: "test-extension",
        lastError: null,
        sendMessage: function (id, payload, callback) {
          if (payload && payload.getSettings) {
            callback({ settings: { textonlymode: false }, state: true });
            return;
          }
          if (payload && payload.message) window.__openAiMessages.push(payload.message);
          if (callback) callback({});
        },
        onMessage: {
          addListener: function (listener) {
            window.__runtimeListener = listener;
          }
        }
      }
    };
    window.__addOpenAiTurn = function (index, role, text, streaming, messageId) {
      var turn = document.createElement("article");
      turn.setAttribute("data-testid", "conversation-turn-" + index);
      var message = document.createElement("div");
      message.setAttribute("data-message-author-role", role);
      message.setAttribute("data-message-id", messageId || "message-" + index);
      if (streaming) message.setAttribute("data-is-streaming", "true");
      var content = document.createElement("div");
      if (role === "assistant") content.className = "markdown prose";
      else content.setAttribute("data-testid", "user-message");
      content.textContent = text;
      message.appendChild(content);
      turn.appendChild(message);
      document.getElementById("conversation").appendChild(turn);
      return message;
    };
  ` });
  return { page, pageErrors };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, pageErrors } = await createHarnessPage(browser);
    await page.evaluate(() => window.__addOpenAiTurn(0, "user", "Old conversation history", false));
    await page.addScriptTag({ content: source });
    await page.waitForTimeout(1800);
    await page.evaluate(() => window.__addOpenAiTurn(99, "assistant", "Late hydrated conversation history", false));
    await page.waitForFunction(() => document.documentElement.getAttribute("data-ssn-openai-ready") === "true", null, { timeout: 7000 });
    assert.strictEqual(await page.evaluate(() => window.__openAiMessages.length), 0, "existing and late-hydrated conversation history should not emit");

    await page.evaluate(() => {
      var liveTurn = window.__addOpenAiTurn(1, "user", "A live viewer question", false);
      liveTurn.querySelector('[data-testid="user-message"]').innerHTML = "A live <strong>viewer</strong> question";
    });
    await waitForMessageCount(page, 1);
    let message = await page.evaluate(() => window.__openAiMessages[0]);
    assert.strictEqual(message.type, "openai");
    assert.strictEqual(message.chatname, "User");
    assert.strictEqual(message.chatmessage, "A live viewer question");

    await page.evaluate(() => window.__addOpenAiTurn(2, "assistant", "Partial answer", true));
    await page.waitForTimeout(1100);
    assert.strictEqual(await page.evaluate(() => window.__openAiMessages.length), 1, "streaming replies should wait until complete");
    await page.evaluate(() => {
      var assistant = document.querySelector('[data-message-id="message-2"]');
      assistant.querySelector(".markdown").textContent = "Complete answer";
      assistant.removeAttribute("data-is-streaming");
    });
    await waitForMessageCount(page, 2);
    message = await page.evaluate(() => window.__openAiMessages[1]);
    assert.strictEqual(message.chatname, "ChatGPT");
    assert.strictEqual(message.chatmessage, "Complete answer");
    assert.strictEqual(message.chatimg, "./sources/images/openai.png");

    await page.evaluate(() => {
      document.querySelector('[data-testid="conversation-turn-2"]').remove();
      window.__addOpenAiTurn(22, "assistant", "Complete answer", false, "message-2");
    });
    await page.waitForTimeout(1100);
    assert.strictEqual(await page.evaluate(() => window.__openAiMessages.length), 2, "re-mounted turns should not duplicate");

    const focusResult = await page.evaluate(() => new Promise((resolve) => {
      window.__runtimeListener("focusChat", {}, function (response) {
        resolve({ response, focused: document.activeElement && document.activeElement.id === "prompt-textarea" });
      });
    }));
    assert.deepStrictEqual(focusResult, { response: true, focused: true });

    await page.evaluate(() => {
      history.pushState({}, "", "#another-conversation");
      window.__addOpenAiTurn(3, "assistant", "Loaded from another conversation", false);
    });
    await page.waitForFunction(() => document.documentElement.getAttribute("data-ssn-openai-ready") === "true", null, { timeout: 7000 });
    assert.strictEqual(await page.evaluate(() => window.__openAiMessages.length), 2, "conversation navigation history should not emit");
    await page.evaluate(() => window.__addOpenAiTurn(4, "user", "New turn after navigation", false));
    await waitForMessageCount(page, 3);

    assert.deepStrictEqual(pageErrors.map((error) => error.message), []);
    await page.close();
  } finally {
    await browser.close();
  }
  console.log("ChatGPT source passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
