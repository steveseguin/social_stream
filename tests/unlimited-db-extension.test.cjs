"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");

async function getExtensionId(context) {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 30000 });
  return new URL(worker.url()).hostname;
}

async function sendRuntimeMessage(page, message) {
  return page.evaluate(value => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(value, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  }), message);
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ssn-unlimited-db-extension-"));
  const validateInactiveDownload = process.env.SSN_VALIDATE_INACTIVE_DOWNLOAD === "1";
  let context;

  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: validateInactiveDownload ? "chrome" : "chromium",
      headless: !validateInactiveDownload,
      acceptDownloads: true,
      args: [
        `--disable-extensions-except=${repoRoot}`,
        `--load-extension=${repoRoot}`
      ]
    });

    const extensionId = await getExtensionId(context);
    const backgroundPage = await context.newPage();
    await backgroundPage.goto(`chrome-extension://${extensionId}/background.html`, {
      waitUntil: "domcontentloaded",
      timeout: 120000
    });
    await backgroundPage.waitForFunction(() => {
      return typeof messageStoreDB !== "undefined" && !!messageStoreDB.db &&
        typeof replayMessagesFromTimestamp === "function";
    }, null, { timeout: 120000 });

    const seeded = await backgroundPage.evaluate(async () => {
      const setting = { unlimitedDB: { setting: false } };
      settings = setting;
      await new Promise(resolve => chrome.storage.local.set({ settings: setting }, resolve));
      await messageStoreDB.clearMessages();

      const activeToken = "extension-active-" + Date.now();
      const expiredToken = "extension-expired-" + Date.now();
      const activeId = await messageStoreDB.addMessage({ chatname: "active", chatmessage: activeToken, type: "test" });
      const expiredId = await messageStoreDB.addMessage({ chatname: "expired", chatmessage: expiredToken, type: "test" });
      const db = await messageStoreDB.ensureDB();
      const expired = await new Promise((resolve, reject) => {
        const request = db.transaction(messageStoreDB.storeName, "readonly").objectStore(messageStoreDB.storeName).get(expiredId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expired.expiresAt = Date.now() - 1000;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(messageStoreDB.storeName, "readwrite");
        tx.objectStore(messageStoreDB.storeName).put(expired);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      isExtensionOn = true;
      sendDataP2P = function() {};
      return {
        activeId,
        expiredId,
        activeToken,
        expiredToken,
        startTimestamp: Math.min(expired.timestamp, Date.now()) - 1000,
        endTimestamp: Date.now() + 1000
      };
    });

    const historyPage = await context.newPage();
    await historyPage.goto(`chrome-extension://${extensionId}/chathistory.html`, { waitUntil: "load" });
    await historyPage.waitForFunction(token => {
      return document.getElementById("messages-container").textContent.includes(token);
    }, seeded.activeToken);
    let historyText = await historyPage.locator("#messages-container").innerText();
    assert.ok(historyText.includes(seeded.activeToken));
    assert.ok(!historyText.includes(seeded.expiredToken), "Packaged extension exposed expired history in default mode");

    const defaultReplay = await sendRuntimeMessage(historyPage, {
      action: "startReplay",
      startTimestamp: seeded.startTimestamp,
      endTimestamp: seeded.endTimestamp,
      speed: 1000000
    });
    assert.ok(defaultReplay && !defaultReplay.error, defaultReplay && defaultReplay.error);
    assert.strictEqual(defaultReplay.messageCount, 1, "Default extension replay included expired history");
    assert.strictEqual(defaultReplay.messages[0].chatmessage, seeded.activeToken);

    await backgroundPage.evaluate(async () => {
      const setting = { unlimitedDB: { setting: true } };
      settings = setting;
      await new Promise(resolve => chrome.storage.local.set({ settings: setting }, resolve));
      await messageStoreDB.clearCache();
    });

    const unlimitedReplay = await sendRuntimeMessage(historyPage, {
      action: "startReplay",
      startTimestamp: seeded.startTimestamp,
      endTimestamp: seeded.endTimestamp,
      speed: 1000000
    });
    assert.ok(unlimitedReplay && !unlimitedReplay.error, unlimitedReplay && unlimitedReplay.error);
    assert.strictEqual(unlimitedReplay.messageCount, 2, "Unlimited extension replay omitted expired history");

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html?ssapp=1`, { waitUntil: "domcontentloaded" });
    await popupPage.waitForFunction(() => {
      return typeof readSsappUnlimitedDBSetting === "function" &&
        !!document.querySelector('[data-setting="unlimitedDB"]');
    }, null, { timeout: 60000 });
    const snapshotSetting = await popupPage.evaluate(async () => {
      popupStartupSettingsHydrated = false;
      document.querySelector('[data-setting="unlimitedDB"]').checked = false;
      return readSsappUnlimitedDBSetting();
    });
    assert.strictEqual(snapshotSetting, true, "SSApp snapshot setting fell back to an unhydrated checkbox");
    await popupPage.close();

    await historyPage.reload({ waitUntil: "load" });
    await historyPage.waitForFunction(token => {
      return document.getElementById("messages-container").textContent.includes(token);
    }, seeded.expiredToken);
    historyText = await historyPage.locator("#messages-container").innerText();
    assert.ok(historyText.includes(seeded.activeToken));
    assert.ok(historyText.includes(seeded.expiredToken));

    await historyPage.selectOption("#export-format", "json");
    await historyPage.selectOption("#export-timeframe", "all");
    const downloadPromise = historyPage.waitForEvent("download");
    await historyPage.click("#export-button");
    const download = await downloadPromise;
    assert.ok(download.suggestedFilename().startsWith("chat_export_"));
    assert.ok(download.suggestedFilename().endsWith(".json"));
    const content = fs.readFileSync(await download.path(), "utf8");
    const exported = JSON.parse(content);
    assert.ok(exported.some(message => message.chatmessage === seeded.activeToken));
    assert.ok(exported.some(message => message.chatmessage === seeded.expiredToken));
    await download.delete();

    if (validateInactiveDownload) {
      await historyPage.evaluate(() => {
        const loadMessages = loadAllMessagesMatchingFilters;
        loadAllMessagesMatchingFilters = activeFilters => loadMessages(activeFilters).then(messages => {
          return new Promise(resolve => setTimeout(() => resolve(messages), 250));
        });
      });
      const foregroundPage = await context.newPage();
      await foregroundPage.goto("about:blank");
      await historyPage.bringToFront();
      await historyPage.selectOption("#export-format", "json");
      const inactiveDownload = historyPage.waitForEvent("download", { timeout: 5000 }).catch(() => null);
      await historyPage.click("#export-button");
      await foregroundPage.bringToFront();
      const backgroundDownload = await inactiveDownload;
      if (backgroundDownload) {
        console.log("Inactive-tab extension download succeeded in headed Chrome.");
        await backgroundDownload.delete();
      } else {
        console.log("Inactive-tab extension download was blocked in headed Chrome.");
      }
      await foregroundPage.close();
    }

    console.log("Unlimited database packaged-extension tests passed.");
  } finally {
    if (context) await context.close().catch(() => {});
    try {
      const resolvedProfile = path.resolve(profile);
      const expectedParent = path.resolve(os.tmpdir());
      if (path.dirname(resolvedProfile) !== expectedParent || !path.basename(resolvedProfile).startsWith("ssn-unlimited-db-extension-")) {
        throw new Error(`Refusing to remove unexpected test profile: ${resolvedProfile}`);
      }
      fs.rmSync(resolvedProfile, { recursive: true, force: true });
    } catch (_error) {}
  }
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
