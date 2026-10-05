const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { startStaticServer } = require("../scripts/playwright-static-server.cjs");

const repoRoot = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const port = 4217;

async function testUrlEditor(page) {
  await page.goto(`http://${host}:${port}/urleditor.html`);
  await page.fill(
    "#urlInput",
    "https://socialstream.ninja/dock.html?darkmode&lightmode=false&transparent=0&compact=off&largeavatar=no&nooutline=random&hidenames=true&alignbottom=1"
  );

  const checked = async (key) => page.isChecked(`[data-param-key="${key}"]`);
  assert.strictEqual(await checked("darkmode"), true, "Bare boolean flags should be checked");
  assert.strictEqual(await checked("lightmode"), false, "false should be unchecked");
  assert.strictEqual(await checked("transparent"), false, "0 should be unchecked");
  assert.strictEqual(await checked("compact"), false, "off should be unchecked");
  assert.strictEqual(await checked("largeavatar"), false, "no should be unchecked");
  assert.strictEqual(await checked("nooutline"), true, "Other values should be checked");
  assert.strictEqual(await checked("hidenames"), true, "true should be checked");
  assert.strictEqual(await checked("alignbottom"), true, "1 should be checked");

  await page.uncheck('[data-param-key="darkmode"]');
  let editedUrl = new URL(await page.inputValue("#urlInput"));
  assert.strictEqual(editedUrl.searchParams.has("darkmode"), false, "Switching a flag off should remove it");

  await page.check('[data-param-key="darkmode"]');
  editedUrl = new URL(await page.inputValue("#urlInput"));
  assert.strictEqual(editedUrl.searchParams.get("darkmode"), "true", "Switching a flag on should use a compatible true value");
}

async function testAiOverlayAlias(context) {
  const state = {
    version: 2,
    activeId: "canonical-id",
    pages: [
      {
        id: "legacy-id",
        name: "legacy",
        html: '<!DOCTYPE html><html><body><div id="selected-overlay">legacy</div></body></html>'
      },
      {
        id: "canonical-id",
        name: "canonical",
        html: '<!DOCTYPE html><html><body><div id="selected-overlay">canonical</div></body></html>'
      }
    ]
  };

  await context.addInitScript(({ state }) => {
    try {
      if (location.hostname === "127.0.0.1") {
        localStorage.setItem("ssnAiPromptPagesV2", JSON.stringify(state));
      }
    } catch (error) {}
  }, { state });

  async function selectedOverlay(query) {
    const page = await context.newPage();
    try {
      await page.goto(`http://${host}:${port}/aioverlay.html?${query}`);
      await page.waitForFunction(() => {
        const frame = document.getElementById("overlayFrame");
        return frame && frame.contentDocument && frame.contentDocument.getElementById("selected-overlay");
      });
      return await page.$eval("#overlayFrame", frame => frame.contentDocument.getElementById("selected-overlay").textContent);
    } finally {
      await page.close();
    }
  }

  assert.strictEqual(await selectedOverlay("page=legacy"), "legacy", "page= should remain a supported alias");
  assert.strictEqual(await selectedOverlay("overlay=canonical"), "canonical", "overlay= should remain canonical");
  assert.strictEqual(
    await selectedOverlay("page=legacy&overlay=canonical"),
    "canonical",
    "overlay= should take precedence over page="
  );
  assert.strictEqual(
    await selectedOverlay("page=legacy&overlay="),
    "canonical",
    "An explicitly empty overlay= should select the active overlay instead of the page= alias"
  );
}

(async () => {
  const guide = fs.readFileSync(path.join(repoRoot, "docs", "ai-overlay-builder-guide.html"), "utf8");
  assert.ok(guide.includes("aioverlay.html?session=YOUR_SESSION&amp;overlay=chat-overlay"));
  assert.ok(!guide.includes("aioverlay.html?session=YOUR_SESSION&amp;page=chat-overlay"));

  const server = await startStaticServer({ root: repoRoot, host, port });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await testUrlEditor(page);
    await page.close();
    await testAiOverlayAlias(context);
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  console.log("PASS URL editor booleans and AI overlay routing");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
