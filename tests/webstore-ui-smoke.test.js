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
    // Exercise the packaged pages without contacting live services or OBS.
    await context.route(/^https?:/, (route) => route.abort());
    const obsUrl = "ws://127.0.0.1:4455";
    const obsRequests = [];
    await context.routeWebSocket(/.*/, (socket) => {
      if (socket.url() !== obsUrl && socket.url() !== obsUrl + "/") {
        socket.close();
        return;
      }
      socket.onMessage((raw) => {
        const message = JSON.parse(String(raw));
        if (message.op === 1) {
          socket.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
        } else if (message.op === 6) {
          obsRequests.push(message.d.requestType);
          socket.send(JSON.stringify({
            op: 7,
            d: {
              requestType: message.d.requestType,
              requestId: message.d.requestId,
              requestStatus: { result: true, code: 100 },
              responseData: { obsVersion: "30.0.0", obsWebSocketVersion: "5.5.0", rpcVersion: 1 }
            }
          }));
        }
      });
      socket.send(JSON.stringify({ op: 0, d: { obsWebSocketVersion: "5.5.0", rpcVersion: 1 } }));
    });

    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });
    }
    const extensionId = new URL(serviceWorker.url()).host;
    assert.ok(extensionId, "extension service worker did not expose an extension id");

    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error && error.message ? error.message : error)));
    page.on("console", (message) => {
      if (message.type() === "error" && /Content Security Policy|Refused to execute|Refused to load/i.test(message.text())) {
        pageErrors.push(message.text());
      }
    });
    await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: "domcontentloaded" });
    await page.locator("body.loaded").waitFor();
    await page.locator("#searchInput").waitFor({ state: "visible" });

    assert.equal(await page.locator("#trovo_username").count(), 0);
    assert.equal(await page.locator("#dlive_username").count(), 0);

    const presetValues = await page.locator("#featured-preset-select option").evaluateAll((options) => options.map((option) => option.value));
    for (const beginner of [true, false]) {
      await page.evaluate((enabled) => applyPopupBeginnerMode(enabled), beginner);
      await page.locator("#featured-preset-select").selectOption("");
      for (const section of ["overlay", "mechanics", "tts", "visibility", "styling", "effects"]) {
        assert.equal(await page.locator(`label[for="wrapper-featured-${section}-options"]`).isVisible(), true,
          `Featured ${section} section must be visible in ${beginner ? "beginner" : "full"} mode`);
      }
      for (const preset of ["modern", "animated", "3d", "particles"]) {
        const value = presetValues.find((value) => value.includes(`/featured-${preset}.html`));
        assert.ok(value, `Missing ${preset} preset`);
        await page.locator("#featured-preset-select").selectOption(value);
        assert.equal(await page.locator(`label[for="wrapper-preset-${preset}-options"]`).isVisible(), true,
          `${preset} settings must be visible in ${beginner ? "beginner" : "full"} mode`);
      }
    }
    await page.locator("#featured-preset-select").selectOption("");

    await page.locator("#searchInput").fill("twitch");
    await page.locator(".popup-search-result").first().waitFor({ state: "visible" });
    assert.equal(await page.locator("#searchInput").isVisible(), true, "popup search input is not visible");
    assert.equal(await page.evaluate(() => document.body.classList.contains("popup-searching")), true, "popup search did not run");
    assert.equal(page.isClosed(), false, "popup closed while opening search");
    assert.equal(await page.locator('a[href="./obs-websocket-test.html"]').count(), 1);
    assert.equal(await page.locator("#spotifySetupGuide").count(), 1);

    await page.goto(`chrome-extension://${extensionId}/obs-websocket-test.html`);
    await page.locator("#connectButton").click();
    await page.locator("#connectionStatus.ok").waitFor();
    assert.match(await page.locator("#connectionStatus").innerText(), /OBS 30\.0\.0/);
    await page.locator("#getVersionButton").click();
    await page.locator("#logOutput").filter({ hasText: "OBS request succeeded: GetVersion" }).waitFor();
    assert.deepEqual(obsRequests, ["GetVersion", "GetVersion"]);
    await page.locator("#disconnectButton").click();
    await page.locator("#connectionStatus.idle").filter({ hasText: "Disconnected from OBS WebSocket." }).waitFor();

    // Observe clipboard calls without granting the extension new permissions.
    await page.addInitScript(() => {
      window.copiedUris = [];
      navigator.clipboard.writeText = async (text) => window.copiedUris.push(text);
    });
    await page.goto(`chrome-extension://${extensionId}/spotify.html`);
    const expectedUris = await page.locator("[data-uri]").allTextContents();
    for (const button of await page.locator("[data-copy]").all()) {
      await button.click();
      assert.equal(await button.textContent(), "Copied!");
    }
    assert.deepEqual(await page.evaluate(() => window.copiedUris), expectedUris.map((uri) => uri.trim()));

    // Keep the existing selection fallback when clipboard access is denied.
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => { throw new Error("Clipboard denied in fixture"); };
    });
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator("[data-copy]").first().click();
    await page.waitForFunction(() => window.getSelection().toString().length > 0);
    assert.equal(await page.evaluate(() => window.getSelection().toString().trim()), expectedUris[0].trim());

    await page.goto(`chrome-extension://${extensionId}/spotify.html?error=access_denied`);
    await page.locator("#status").filter({ hasText: "Authorization failed: access_denied" }).waitFor();
    assert.equal(await page.locator("#guide-container").isVisible(), false);
    assert.equal(await page.locator("#callback-container").isVisible(), true);

    await page.goto(`chrome-extension://${extensionId}/actions/obs-control-guide.html`);
    const editor = page.getByRole("link", { name: "Event Flow Editor", exact: true });
    assert.equal(await editor.evaluate((link) => link.href), `chrome-extension://${extensionId}/actions/index.html`);
    assert.ok(fs.existsSync(path.join(extensionRoot, "actions/index.html")));

    const relevantErrors = pageErrors.filter((message) => !/ResizeObserver loop/i.test(message));
    assert.deepEqual(relevantErrors, [], `packaged pages emitted runtime/CSP errors: ${relevantErrors.join(" | ")}`);

    await page.close();
    console.log(`Web Store extension smoke passed: Featured Chat beginner/full visibility, popup search, OBS connect/request/disconnect, Spotify copy/fallback/callback, editor link (${extensionId}).`);
  } finally {
    await context.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
