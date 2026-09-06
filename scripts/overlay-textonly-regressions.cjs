const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");

async function loadInlinePage(browser, relativePath) {
  const page = await browser.newPage();
  await page.route("**/*", route => route.abort());
  await page.setContent(fs.readFileSync(path.join(root, relativePath), "utf8"), { waitUntil: "domcontentloaded" });
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const relativePath of [
      "themes/deuks_overlay/overlay1.html",
      "themes/huan-kiara/index.html"
    ]) {
      const page = await loadInlinePage(browser, relativePath);
      await page.evaluate(() => {
        window.__textonlyExecuted = false;
        addMessageToOverlay({
          chatname: '<img id="name-payload" src=x onerror="window.__textonlyExecuted=true">',
          chatmessage: '<img id="message-payload" src=x onerror="window.__textonlyExecuted=true">',
          chatbadges: [],
          textonly: true,
          type: "irc"
        });
      });
      await page.waitForTimeout(50);
      assert.strictEqual(await page.evaluate(() => window.__textonlyExecuted), false, relativePath);
      assert.strictEqual(await page.locator("#name-payload").count(), 0, relativePath);
      assert.strictEqual(await page.locator("#message-payload").count(), 0, relativePath);
      assert.ok((await page.locator(".text").last().textContent()).includes('<img id="message-payload"'), relativePath);
      await page.close();
    }

    const featured = await loadInlinePage(browser, "themes/featured-styles/featured-dynamic.html");
    await featured.evaluate(() => {
      window.__textonlyExecuted = false;
      showMessage({
        chatname: '<img id="featured-name-payload" src=x onerror="window.__textonlyExecuted=true">',
        chatmessage: '<img id="featured-payload" src=x onerror="window.__textonlyExecuted=true">',
        textonly: true,
        type: "irc"
      });
    });
    await featured.waitForSelector(".message-wrapper .text");
    await featured.waitForTimeout(50);
    assert.strictEqual(await featured.evaluate(() => window.__textonlyExecuted), false);
    assert.strictEqual(await featured.locator("#featured-name-payload").count(), 0);
    assert.strictEqual(await featured.locator("#featured-payload").count(), 0);
    assert.ok((await featured.locator(".message-wrapper .text").textContent()).includes('<img id="featured-payload"'));
    await featured.close();

    const grouped = await loadInlinePage(browser, "themes/deuks_overlay/overlay2.html");
    await grouped.evaluate(() => {
      showtime = 10;
      addMessageToOverlay({ chatname: "Alice", chatmessage: "first", chatbadges: [], textonly: true, type: "irc" });
    });
    await grouped.waitForTimeout(1100);
    assert.strictEqual(await grouped.locator(".message-container.fading").count(), 1);
    await grouped.evaluate(() => {
      addMessageToOverlay({ chatname: "Alice", chatmessage: "second", chatbadges: [], textonly: true, type: "irc" });
    });
    assert.strictEqual(await grouped.locator(".message-container").count(), 2);
    assert.strictEqual(await grouped.locator(".message-container").last().textContent().then(text => text.includes("second")), true);
    await grouped.close();

    const syntaxSmokeFiles = [
      "events.html",
      "games/phraseguess.html",
      "sampleemote.html",
      "sources/websocket/youtube.html",
      "themes/featured-styles/featured-3d.html",
      "themes/featured-styles/featured-animated.html",
      "themes/featured-styles/featured-cyberpunk.html",
      "themes/featured-styles/featured-elegant.html",
      "themes/featured-styles/featured-gaming.html",
      "themes/featured-styles/featured-glass.html",
      "themes/featured-styles/featured-gradient.html",
      "themes/featured-styles/featured-modern.html",
      "themes/featured-styles/featured-neon.html",
      "themes/featured-styles/featured-particles.html",
      "themes/featured-styles/featured-retro.html",
      "themes/featured-styles/featured-slide.html"
    ];
    for (const relativePath of syntaxSmokeFiles) {
      const page = await browser.newPage();
      const syntaxErrors = [];
      page.on("pageerror", error => {
        if (error && error.name === "SyntaxError") syntaxErrors.push(error.message);
      });
      await page.route("**/*", route => route.abort());
      await page.setContent(fs.readFileSync(path.join(root, relativePath), "utf8"), { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(25);
      assert.deepStrictEqual(syntaxErrors, [], `${relativePath}: ${syntaxErrors.join("; ")}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log("PASS overlay text-only and sender-group regressions");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
