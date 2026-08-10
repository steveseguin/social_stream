const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const extensionRoot = path.resolve(process.env.SSN_EXTENSION_ROOT || path.resolve(__dirname, ".."));
const tempRoot = process.env.SSN_SMOKE_TMP || os.tmpdir();
const profileDir = fs.mkdtempSync(path.join(tempRoot, "ssn-webstore-smoke-"));

(async () => {
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`
    ]
  });

  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });
    }
    const extensionId = new URL(serviceWorker.url()).host;
    assert.ok(extensionId, "extension service worker did not expose an extension id");

    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error && error.message ? error.message : error)));
    await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#searchIcon", { state: "visible" });

    assert.equal(await page.locator("#trovo_username").count(), 0);
    assert.equal(await page.locator("#dlive_username").count(), 0);

    await page.locator("#searchIcon").click();
    await page.locator("#searchInput").fill("twitch");
    await page.waitForTimeout(250);
    assert.equal(await page.locator("#searchInput").isVisible(), true, "popup search input did not open");
    assert.equal(await page.evaluate(() => document.body.classList.contains("popup-searching")), true, "popup search did not run");
    assert.equal(page.isClosed(), false, "popup closed while opening search");

    const relevantErrors = pageErrors.filter((message) => !/ResizeObserver loop/i.test(message));
    assert.deepEqual(relevantErrors, [], `popup emitted runtime errors: ${relevantErrors.join(" | ")}`);

    await page.close();
    console.log(`Web Store extension smoke passed (${extensionId}).`);
  } finally {
    await context.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
