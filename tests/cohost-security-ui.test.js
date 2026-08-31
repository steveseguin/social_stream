const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    const url = pathToFileURL(path.resolve(__dirname, "..", "cohost.html")).href;
    await page.goto(url);
    await page.evaluate(() => {
      localStorage.setItem("selectedProvider", "chatgpt");
      localStorage.setItem("apiKey", "legacy-generic-secret");
      localStorage.setItem("apiKey_chatgpt", "legacy-provider-secret");
    });
    await page.reload();
    await page.waitForFunction(() => document.getElementById("providerSelect") && document.getElementById("providerSelect").value === "chatgpt");

    const keyState = await page.evaluate(() => ({
      input: document.getElementById("apiKey").value,
      generic: localStorage.getItem("apiKey"),
      provider: localStorage.getItem("apiKey_chatgpt")
    }));
    assert.deepStrictEqual(keyState, { input: "", generic: null, provider: null });

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("modelResponse", {
        detail: { text: '<img src=x onerror="document.body.dataset.xss=1"> **safe**' }
      }));
    });
    const renderState = await page.evaluate(() => {
      const content = document.querySelector(".assistant-message .markdown-content");
      return {
        html: content ? content.innerHTML : "",
        text: content ? content.textContent : "",
        images: content ? content.querySelectorAll("img").length : -1,
        executed: document.body.dataset.xss || ""
      };
    });
    assert.strictEqual(renderState.images, 0, "AI output must not create executable HTML elements");
    assert.strictEqual(renderState.executed, "", "AI output must not execute event handlers");
    assert(renderState.text.includes("<img src=x"), "Unsafe markup should render as text");
    assert(renderState.html.includes("<strong>safe</strong>"), "The small Markdown allowlist should still work");

    const capability = "a".repeat(64);
    await page.goto(url + "?session=security-test#cohostauth=" + capability);
    const capabilityState = await page.evaluate(() => ({
      hash: location.hash,
      query: location.search,
      stored: sessionStorage.getItem("cohostAccessCapability")
    }));
    assert.strictEqual(capabilityState.hash, "", "The co-host capability must be removed from the address bar");
    assert(!capabilityState.query.includes("cohostauth"), "The co-host capability must not remain in the query string");
    assert.strictEqual(capabilityState.stored, capability, "The capability should survive only in the current tab session");
    assert.deepStrictEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
  console.log("Co-host security UI passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
