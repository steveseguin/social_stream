const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const botUrl = pathToFileURL(path.join(repoRoot, "bot.html")).href;

const backgroundSource = fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");
const dockSource = fs.readFileSync(path.join(repoRoot, "dock.html"), "utf8");
const popupSource = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");
assert(backgroundSource.includes('sendTargetP2P({ action: "clearBotOverlay" }, "bot")'), "Background API routing is missing");
assert(dockSource.includes('sendDataP2P({ action: "clearBotOverlay", target: "bot" })'), "Dock API routing is missing");
assert(popupSource.includes("chrome.runtime.sendMessage({ cmd: 'clearBotOverlay' }"), "Popup manual-clear control is missing");

async function openBotPage(browser, query) {
  const context = await browser.newContext();
  await context.route("https://vdo.socialstream.ninja/**", route => route.abort());
  const page = await context.newPage();
  await page.goto(`${botUrl}?session=bot-overlay-test&${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.processData === "function");
  return { context, page };
}

async function showReply(page, message) {
  await page.evaluate(text => {
    window.processData({
      contents: {
        chatname: "NinjaBot",
        chatmessage: text,
        type: "socialstream"
      }
    });
  }, message);
  await page.waitForFunction(text => {
    const messageElement = document.getElementById("message");
    const output = document.getElementById("output");
    return messageElement && messageElement.textContent === text && !output.classList.contains("dropout");
  }, message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    {
      const { context, page } = await openBotPage(browser, "");
      await showReply(page, "Clear this reply manually");
      const result = await page.evaluate(() => {
        TTS.premiumQueueActive = true;
        return {
          cleared: window.processData({ action: "clearBotOverlay" }),
          ttsStillActive: TTS.premiumQueueActive
        };
      });
      assert.strictEqual(result.cleared, true);
      assert.strictEqual(result.ttsStillActive, true);
      await page.waitForFunction(() => document.getElementById("output").classList.contains("dropout"));
      await context.close();
    }

    {
      const { context, page } = await openBotPage(browser, "showtime=250");
      await showReply(page, "Fixed timeout reply");
      await page.waitForFunction(() => document.getElementById("output").classList.contains("dropout"));
      await context.close();
    }

    {
      const { context, page } = await openBotPage(browser, "autohide&mintime=250&maxtime=250");
      await showReply(page, "Length timeout reply");
      await page.waitForFunction(() => document.getElementById("output").classList.contains("dropout"));
      await context.close();
    }

    {
      const { context, page } = await openBotPage(browser, "hideaftertts&hidedelay=50&ttstimeout=5000");
      await page.evaluate(() => {
        TTS.speech = true;
        TTS.initAudioContext = function () {};
        TTS.speechMeta = function () {
          TTS.premiumQueueActive = true;
          setTimeout(function () { TTS.premiumQueueActive = false; }, 250);
        };
      });
      await showReply(page, "Hide after speech reply");
      await page.waitForFunction(() => document.getElementById("output").classList.contains("dropout"));
      await context.close();
    }

    console.log("PASS bot overlay manual clear and auto-hide controls");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
