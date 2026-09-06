const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");

(async () => {
  const cohostSource = fs.readFileSync(path.join(root, "cohost.html"), "utf8");
  const popupSource = fs.readFileSync(path.join(root, "popup.html"), "utf8");
  const guidePaths = [
    path.join(root, "docs", "ai-cohost-guide.html"),
    path.join(root, "docs", "ai-modes-guide.html")
  ];

  assert(cohostSource.includes('selectionElem.setAttribute("role", "dialog")'));
  assert(cohostSource.includes('selectionElem.setAttribute("aria-modal", "true")'));
  assert(cohostSource.includes('selectionElem.setAttribute("aria-labelledby", "desktopCaptureTitle")'));
  assert(cohostSource.includes('alt=""'));
  assert(cohostSource.includes('id="customModelSelectLabel"'));
  assert(cohostSource.includes('aria-live="off" aria-label="Co-host conversation"'));
  assert(cohostSource.includes('responseTypeValue === "text" || cohostOutputMuted'));

  for (const id of ["cohostSpotifyControl", "cohostObsControl", "cohostFeaturedChatControl", "aiOverlayFromChatBot", "aiOverlayTts"]) {
    const input = popupSource.match(new RegExp(`<input[^>]+id="${id}"[^>]*>`));
    assert(input, `${id} should exist`);
    assert(/aria-labelledby=/.test(input[0]), `${id} should have an accessible name`);
  }

  for (const guidePath of guidePaths) {
    const guide = fs.readFileSync(guidePath, "utf8");
    assert(guide.includes('class="skip-link" href="#main-content"'));
    assert(guide.includes('id="main-content"'));
    assert(guide.includes('<button type="button" class="mobile-nav-toggle"'));
    assert(guide.includes('aria-expanded="false"'));
    assert(guide.includes('aria-controls="site-navigation"'));
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 480, height: 800 } });
    await page.goto(pathToFileURL(guidePaths[0]).href);
    const menuButton = page.locator(".mobile-nav-toggle");
    await menuButton.click();
    assert.strictEqual(await menuButton.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    assert.strictEqual(await menuButton.getAttribute("aria-expanded"), "false");
    assert.strictEqual(await menuButton.evaluate(element => document.activeElement === element), true);

    await page.goto(pathToFileURL(path.join(root, "cohost.html")).href);
    await page.waitForFunction(() => document.getElementById("providerSelect"));
    assert.strictEqual(await page.locator("#puppet-container").evaluate(element => getComputedStyle(element).display), "none");
    assert.strictEqual(await page.locator("#stopCohostSpeech").isDisabled(), true);
    const liveRegions = await page.evaluate(() => ({
      chat: document.getElementById("liveChatStatusSummary").getAttribute("aria-live"),
      voice: document.getElementById("voiceStatusSummary").getAttribute("aria-live"),
      action: document.getElementById("actionStatusSummary").getAttribute("aria-live"),
      transcript: document.getElementById("responses").getAttribute("aria-live")
    }));
    assert.deepStrictEqual(liveRegions, { chat: null, voice: null, action: null, transcript: "off" });

    const announcementState = await page.evaluate(async () => {
      const region = document.getElementById("cohostStatusAnnouncement");
      await new Promise(resolve => setTimeout(resolve, 400));
      region.textContent = "";
      let mutations = 0;
      const observer = new MutationObserver(() => { mutations += 1; });
      observer.observe(region, { childList: true, characterData: true, subtree: true });
      queueCohostStatusAnnouncement("test", "Connected");
      queueCohostStatusAnnouncement("test", "Connected");
      await new Promise(resolve => setTimeout(resolve, 400));
      observer.disconnect();
      return { text: region.textContent, mutations };
    });
    assert.strictEqual(announcementState.text, "Connected");
    assert.strictEqual(announcementState.mutations, 1);

    const responseAnnouncements = await page.evaluate(() => {
      const responseType = document.getElementById("responseType");
      const announcement = document.getElementById("finalResponseAnnouncement");
      responseType.value = "audio";
      cohostOutputMuted = false;
      messageFormatter.appendMessage("Audio answer");
      messageFormatter.finalizeMessage();
      const audio = announcement.textContent;
      responseType.value = "text";
      messageFormatter.appendMessage("Text answer");
      messageFormatter.finalizeMessage();
      return { audio, text: announcement.textContent };
    });
    assert.strictEqual(responseAnnouncements.audio, "");
    assert.strictEqual(responseAnnouncements.text, "AI co-host: Text answer");

    await page.setViewportSize({ width: 1440, height: 900 });
    const desktopLayout = await page.evaluate(() => {
      const avatar = document.getElementById("puppet-container").getBoundingClientRect();
      const responses = document.getElementById("responses");
      const input = document.querySelector(".input-container").getBoundingClientRect();
      return {
        avatarDisplay: getComputedStyle(document.getElementById("puppet-container")).display,
        avatarBottom: avatar.bottom,
        inputTop: input.top,
        avatarWidth: avatar.width,
        responsePaddingRight: parseFloat(getComputedStyle(responses).paddingRight)
      };
    });
    assert.strictEqual(desktopLayout.avatarDisplay, "block");
    assert(desktopLayout.avatarBottom < desktopLayout.inputTop, "Avatar should stay above the chat input");
    assert(desktopLayout.responsePaddingRight >= desktopLayout.avatarWidth, "Conversation text should reserve space beside the avatar");
  } finally {
    await browser.close();
  }

  console.log("Co-host accessibility checks passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
