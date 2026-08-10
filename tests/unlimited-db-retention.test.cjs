const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const dbSource = fs.readFileSync(path.join(repoRoot, "db.js"), "utf8");
const backgroundSource = fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");
const historyHtml = fs.readFileSync(path.join(repoRoot, "chathistory.html"), "utf8");
const historySource = fs.readFileSync(path.join(repoRoot, "chathistory.js"), "utf8");

const harnessHtml = String.raw`<!doctype html>
<html>
<body>
<script>
var settings = {};
var storedSettings = {};
var storageReadError = false;
var storageReadDelay = 0;
window.chrome = window.chrome || {};
window.chrome.runtime = window.chrome.runtime || { lastError: null };
window.chrome.storage = {
  local: {
    get: function(keys, callback) {
      setTimeout(function() {
        if (storageReadError) {
          window.chrome.runtime.lastError = { message: "intentional storage read failure" };
          callback(undefined);
          window.chrome.runtime.lastError = null;
          return;
        }
        callback({ settings: storedSettings });
      }, storageReadDelay);
    }
  }
};
</script>
<script src="/db.js"></script>
<script>
function assertTest(condition, message) {
  if (!condition) throw new Error(message);
}

function requestResult(request) {
  return new Promise(function(resolve, reject) {
    request.onsuccess = function() { resolve(request.result); };
    request.onerror = function() { reject(request.error); };
  });
}

function transactionDone(transaction) {
  return new Promise(function(resolve, reject) {
    transaction.oncomplete = function() { resolve(); };
    transaction.onerror = function() { reject(transaction.error); };
    transaction.onabort = function() { reject(transaction.error || new Error("Transaction aborted")); };
  });
}

async function rawGet(store, id) {
  var db = await store.ensureDB();
  return requestResult(db.transaction(store.storeName, "readonly").objectStore(store.storeName).get(id));
}

async function rawPut(store, message) {
  var db = await store.ensureDB();
  var transaction = db.transaction(store.storeName, "readwrite");
  transaction.objectStore(store.storeName).put(message);
  await transactionDone(transaction);
}

async function rawGetAll(store) {
  var db = await store.ensureDB();
  return requestResult(db.transaction(store.storeName, "readonly").objectStore(store.storeName).getAll());
}

function deleteDatabase(name) {
  return new Promise(function(resolve, reject) {
    var request = indexedDB.deleteDatabase(name);
    request.onsuccess = function() { resolve(); };
    request.onerror = function() { reject(request.error); };
    request.onblocked = function() { reject(new Error("Delete blocked for " + name)); };
  });
}

async function createOldDatabase(messages) {
  await deleteDatabase("chatMessagesDB");
  var database = await new Promise(function(resolve, reject) {
    var request = indexedDB.open("chatMessagesDB", 1);
    request.onupgradeneeded = function(event) {
      event.target.result.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = function() { resolve(request.result); };
    request.onerror = function() { reject(request.error); };
  });
  var transaction = database.transaction("messages", "readwrite");
  messages.forEach(function(message) {
    transaction.objectStore("messages").add(message);
  });
  await transactionDone(transaction);
  database.close();
}

async function createCurrentDatabase(name, messages) {
  await deleteDatabase(name);
  var database = await new Promise(function(resolve, reject) {
    var request = indexedDB.open(name, 4);
    request.onupgradeneeded = function(event) {
      var store = event.target.result.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
      store.createIndex("timestamp", "timestamp");
    };
    request.onsuccess = function() { resolve(request.result); };
    request.onerror = function() { reject(request.error); };
  });
  var transaction = database.transaction("messages", "readwrite");
  messages.forEach(function(message) {
    transaction.objectStore("messages").add(message);
  });
  await transactionDone(transaction);
  database.close();
}

async function waitForCondition(check, message) {
  var deadline = Date.now() + 5000;
  while (!(await check()) && Date.now() < deadline) {
    await new Promise(function(resolve) { setTimeout(resolve, 10); });
  }
  assertTest(await check(), message);
}

async function databaseExists(name) {
  var databases = await indexedDB.databases();
  return databases.some(function(database) { return database.name === name; });
}

function setUnlimited(value, asBoolean) {
  var entry = value ? (asBoolean ? true : { setting: true }) : { setting: false };
  settings = { unlimitedDB: entry };
  storedSettings = { unlimitedDB: entry };
}

async function waitForDefaultStore() {
  await messageStoreDB.initPromise;
  var deadline = Date.now() + 5000;
  while (!messageStoreDB.migration.migrationAttempted && Date.now() < deadline) {
    await new Promise(function(resolve) { setTimeout(resolve, 10); });
  }
  assertTest(messageStoreDB.migration.migrationAttempted, "Default store did not finish initialization");
}

window.runRetentionTests = async function() {
  await waitForDefaultStore();

  var suffix = Date.now() + "_" + Math.random().toString(16).slice(2);
  var defaultDbName = "retention_default_" + suffix;
  var unlimitedMigrationDbName = "retention_migration_unlimited_" + suffix;
  var defaultMigrationDbName = "retention_migration_default_" + suffix;
  var retryMigrationDbName = "retention_migration_retry_" + suffix;
  var unknownMigrationDbName = "retention_migration_unknown_" + suffix;
  var startupDefaultDbName = "retention_startup_default_" + suffix;
  var startupUnlimitedDbName = "retention_startup_unlimited_" + suffix;
  var startupUnknownDbName = "retention_startup_unknown_" + suffix;
  var stores = [];

  try {
    setUnlimited(false);
    var store = new MessageStoreDB({ dbName: defaultDbName, storeName: "messages", daysToKeep: 30 });
    stores.push(store);
    await store.initPromise;

    var defaultId = await store.addMessage({ chatname: "default", chatmessage: "retained", type: "test" });
    var defaultMessage = await rawGet(store, defaultId);
    assertTest(defaultMessage.expiresAt - defaultMessage.timestamp === 30 * MS_PER_DAY, "Default rows must retain a 30-day expiry");

    defaultMessage.expiresAt = Date.now() - 1000;
    await rawPut(store, defaultMessage);
    await store.clearCache();
    var limitedMessages = await store.getRecentMessages(20);
    assertTest(!limitedMessages.some(function(message) { return message.id === defaultId; }), "Default reads exposed an expired row");

    setUnlimited(true);
    var unlimitedMessages = await store.getRecentMessages(20);
    assertTest(unlimitedMessages.some(function(message) { return message.id === defaultId; }), "Unlimited reads did not expose an existing expired row");

    var unlimitedId = await store.addMessage({ chatname: "unlimited", chatmessage: "still has metadata", type: "test" });
    var unlimitedMessage = await rawGet(store, unlimitedId);
    assertTest(Number.isFinite(unlimitedMessage.expiresAt), "Unlimited rows must keep reversible expiry metadata");

    setUnlimited(false);
    var limitedAgain = await store.getRecentMessages(20);
    assertTest(!limitedAgain.some(function(message) { return message.id === defaultId; }), "Turning Unlimited off did not restore expiry filtering");

    var updateId = await store.addMessage({ chatname: "updated", chatmessage: "before", type: "test" });
    var beforeUpdate = await rawGet(store, updateId);
    await store.clearCache();
    await store.getRecentMessages(2);
    var updated = await store.updateMessage(updateId, { chatmessage: "after", botResponse: "response" });
    var afterUpdate = await rawGet(store, updateId);
    assertTest(updated.chatname === "updated" && afterUpdate.chatname === "updated", "Updates must merge with the stored row");
    assertTest(afterUpdate.expiresAt === beforeUpdate.expiresAt, "Updates must preserve expiry metadata");
    var recentAfterUpdate = await store.getRecentMessages(3);
    assertTest(recentAfterUpdate.filter(function(message) { return message.id === updateId; }).length === 1, "Updating a row must not duplicate it in the recent cache");

    var legacyId = updateId + 1000;
    var legacyTimestamp = Date.now() - (31 * MS_PER_DAY);
    await rawPut(store, { id: legacyId, chatname: "legacy", chatmessage: "missing expiry", type: "test", timestamp: legacyTimestamp });
    await store.clearCache();
    var beforeLegacyCleanup = await store.getRecentMessages(100);
    assertTest(!beforeLegacyCleanup.some(function(message) { return message.id === legacyId; }), "Legacy rows without expiry must derive it from their timestamp");
    var legacyDeleted = await store.cleanupExpiredMessages();
    assertTest(legacyDeleted >= 1 && !(await rawGet(store, legacyId)), "Cleanup must remove expired legacy rows");

    setUnlimited(true, true);
    unlimitedMessage.expiresAt = Date.now() - 1000;
    await rawPut(store, unlimitedMessage);
    assertTest(await store.cleanupExpiredMessages() === 0, "Unlimited cleanup must not delete rows");
    assertTest(!!(await rawGet(store, unlimitedId)), "Unlimited cleanup deleted a row");
    setUnlimited(false);
    assertTest(await store.cleanupExpiredMessages() >= 1, "Default cleanup did not resume after disabling Unlimited");
    assertTest(!(await rawGet(store, unlimitedId)), "Expired row survived after disabling Unlimited");

    var startupExpired = {
      id: 1,
      chatname: "startup",
      chatmessage: "expired before startup",
      type: "test",
      timestamp: Date.now() - (31 * MS_PER_DAY),
      expiresAt: Date.now() - 1000
    };
    await createCurrentDatabase(startupDefaultDbName, [startupExpired]);
    setUnlimited(false);
    var startupDefaultStore = new MessageStoreDB({ dbName: startupDefaultDbName, storeName: "messages", daysToKeep: 30 });
    stores.push(startupDefaultStore);
    await startupDefaultStore.initPromise;
    await waitForCondition(async function() {
      return !(await rawGet(startupDefaultStore, startupExpired.id));
    }, "Default startup cleanup did not remove an expired row");

    await createCurrentDatabase(startupUnlimitedDbName, [startupExpired]);
    settings = { unlimitedDB: { setting: false } };
    storedSettings = { unlimitedDB: true };
    var startupUnlimitedStore = new MessageStoreDB({ dbName: startupUnlimitedDbName, storeName: "messages", daysToKeep: 30 });
    stores.push(startupUnlimitedStore);
    await startupUnlimitedStore.initPromise;
    await new Promise(function(resolve) { setTimeout(resolve, 50); });
    assertTest(!!(await rawGet(startupUnlimitedStore, startupExpired.id)), "Startup cleanup raced settings hydration and deleted Unlimited history");

    await createCurrentDatabase(startupUnknownDbName, [startupExpired]);
    settings = {};
    storedSettings = {};
    storageReadError = true;
    var startupUnknownStore = new MessageStoreDB({ dbName: startupUnknownDbName, storeName: "messages", daysToKeep: 30 });
    stores.push(startupUnknownStore);
    await startupUnknownStore.initPromise;
    await new Promise(function(resolve) { setTimeout(resolve, 50); });
    assertTest(!!(await rawGet(startupUnknownStore, startupExpired.id)), "Cleanup deleted history when the Unlimited setting could not be read");
    storageReadError = false;

    var oldTimestamp = Date.now() - (90 * MS_PER_DAY);
    var recentTimestamp = Date.now() - MS_PER_DAY;
    var unlimitedLegacyMessages = [];
    for (var legacyIndex = 0; legacyIndex < 10005; legacyIndex++) {
      unlimitedLegacyMessages.push({
        chatname: "old-" + legacyIndex,
        chatmessage: "old-" + legacyIndex,
        type: "test",
        timestamp: oldTimestamp + legacyIndex
      });
    }
    await createOldDatabase(unlimitedLegacyMessages);
    setUnlimited(true);
    var unlimitedMigrationStore = new MessageStoreWithMigration({ dbName: unlimitedMigrationDbName, storeName: "messages", daysToKeep: 30 });
    stores.push(unlimitedMigrationStore);
    await unlimitedMigrationStore.init();
    var unlimitedMigrated = await rawGetAll(unlimitedMigrationStore);
    assertTest(unlimitedMigrated.length === unlimitedLegacyMessages.length, "Unlimited migration must not stop at the legacy 10,000-row cap");
    assertTest(unlimitedMigrated.some(function(message) { return message.timestamp === oldTimestamp; }), "Migration must preserve original numeric timestamps");
    var newestMigrated = await unlimitedMigrationStore.getRecentMessages(10);
    assertTest(newestMigrated[0] && newestMigrated[0].chatname === "old-10004", "Migration must not reverse the recent-message cache");
    assertTest(!(await databaseExists("chatMessagesDB")), "Successful Unlimited migration must remove the old database");

    await createOldDatabase([
      { chatname: "old", chatmessage: "old", type: "test", timestamp: oldTimestamp },
      { chatname: "recent", chatmessage: "recent", type: "test", timestamp: recentTimestamp }
    ]);
    setUnlimited(false);
    var defaultMigrationStore = new MessageStoreWithMigration({ dbName: defaultMigrationDbName, storeName: "messages", daysToKeep: 30 });
    stores.push(defaultMigrationStore);
    await defaultMigrationStore.init();
    var defaultMigrated = await rawGetAll(defaultMigrationStore);
    assertTest(defaultMigrated.length === 1 && defaultMigrated[0].chatname === "recent", "Default migration must keep only the last 30 days");

    await createOldDatabase([
      { chatname: "unknown-setting", chatmessage: "preserve", type: "test", timestamp: oldTimestamp }
    ]);
    settings = {};
    storedSettings = {};
    storageReadError = true;
    var unknownMigrationStore = new MessageStoreWithMigration({ dbName: unknownMigrationDbName, storeName: "messages", daysToKeep: 30 });
    stores.push(unknownMigrationStore);
    await unknownMigrationStore.init();
    assertTest(await databaseExists("chatMessagesDB"), "Migration deleted the old database when the Unlimited setting could not be read");
    assertTest((await rawGetAll(unknownMigrationStore)).length === 0, "Migration guessed a retention mode when the setting could not be read");
    storageReadError = false;

    var retryMessages = [];
    for (var retryIndex = 0; retryIndex < 60; retryIndex++) {
      retryMessages.push({ chatname: "retry-" + retryIndex, chatmessage: "retry-" + retryIndex, type: "test", timestamp: recentTimestamp + retryIndex });
    }
    await createOldDatabase(retryMessages);
    setUnlimited(true);
    var retryMigrationStore = new MessageStoreWithMigration({ dbName: retryMigrationDbName, storeName: "messages", daysToKeep: 30 });
    stores.push(retryMigrationStore);
    await retryMigrationStore.initPromise;
    await retryMigrationStore.addMessage({ chatname: "live", chatmessage: "keep me", type: "test" });
    var addMigratedBatch = retryMigrationStore.addMigratedMessages.bind(retryMigrationStore);
    var migratedBatchCount = 0;
    retryMigrationStore.addMigratedMessages = async function(messages, migrationSource) {
      migratedBatchCount++;
      if (migratedBatchCount === 2) throw new Error("intentional partial migration failure");
      return addMigratedBatch(messages, migrationSource);
    };
    await retryMigrationStore.init();
    var partialRows = await rawGetAll(retryMigrationStore);
    assertTest(partialRows.length > 1 && partialRows.length < retryMessages.length + 1, "Partial migration test did not copy a partial batch");
    assertTest(await databaseExists("chatMessagesDB"), "Partial migration failure deleted the old database");

    retryMigrationStore.addMigratedMessages = addMigratedBatch;
    retryMigrationStore.migration.migrationAttempted = false;
    await retryMigrationStore.migration.checkAndMigrate();
    var retriedRows = await rawGetAll(retryMigrationStore);
    var retriedNames = retriedRows.map(function(message) { return message.chatname; });
    assertTest(retriedRows.length === retryMessages.length + 1, "Migration retry duplicated or lost messages");
    assertTest(new Set(retriedNames).size === retriedNames.length, "Migration retry created duplicate messages");
    assertTest(retriedNames.includes("live"), "Migration retry removed a live destination message");
    assertTest(!retriedRows.some(function(message) { return message.__ssnMigrationSource; }), "Successful migration left internal retry markers in saved messages");
    assertTest(!(await databaseExists("chatMessagesDB")), "Successful migration retry did not remove the old database");

    return {
      defaultRetention: true,
      unlimitedToggle: true,
      updatePreservesExpiry: true,
      cleanupBehavior: true,
      migrationBehavior: true
    };
  } finally {
    stores.forEach(function(store) {
      if (store.db) store.db.close();
    });
    await deleteDatabase(defaultDbName);
    await deleteDatabase(unlimitedMigrationDbName);
    await deleteDatabase(defaultMigrationDbName);
    await deleteDatabase(retryMigrationDbName);
    await deleteDatabase(unknownMigrationDbName);
    await deleteDatabase(startupDefaultDbName);
    await deleteDatabase(startupUnlimitedDbName);
    await deleteDatabase(startupUnknownDbName);
    if (await databaseExists("chatMessagesDB")) await deleteDatabase("chatMessagesDB");
  }
};
</script>
</body>
</html>`;

async function main() {
  assert.ok(backgroundSource.includes("messageStoreDB.isMessageExpired(cursor.value"), "Replay must use the shared retention rule");

  const server = http.createServer((request, response) => {
    if (request.url === "/db.js") {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      response.end(dbSource);
      return;
    }
    if (request.url.startsWith("/chathistory.js")) {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      response.end(historySource);
      return;
    }
    if (request.url.startsWith("/chathistory.html")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(historyHtml);
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(harnessHtml);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.chrome = window.chrome || {};
      window.chrome.runtime = {
        lastError: null,
        sendMessage(request, callback) {
          const unlimited = window.location.search.includes("unlimited=1");
          setTimeout(() => callback({
            settings: { unlimitedDB: unlimited ? { setting: true } : { setting: false } }
          }), 0);
        }
      };
      window.chrome.storage = {
        local: {
          get(keys, callback) {
            const unlimited = window.location.search.includes("unlimited=1");
            setTimeout(() => callback({
              settings: { unlimitedDB: unlimited ? { setting: true } : { setting: false } }
            }), 0);
          }
        }
      };
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "load" });
    const result = await page.evaluate(() => window.runRetentionTests());
    assert.deepStrictEqual(result, {
      defaultRetention: true,
      unlimitedToggle: true,
      updatePreservesExpiry: true,
      cleanupBehavior: true,
      migrationBehavior: true
    });

    const historyTokens = await page.evaluate(async () => {
      settings = { unlimitedDB: { setting: false } };
      storedSettings = settings;
      const activeToken = "active-history-" + Date.now();
      const expiredToken = "expired-history-" + Date.now();
      await messageStoreDB.addMessage({ chatname: "active", chatmessage: activeToken, type: "test" });
      const expiredId = await messageStoreDB.addMessage({ chatname: "expired", chatmessage: expiredToken, type: "test" });
      const expiredMessage = await rawGet(messageStoreDB, expiredId);
      expiredMessage.expiresAt = Date.now() - 1000;
      await rawPut(messageStoreDB, expiredMessage);
      return { activeToken, expiredToken };
    });

    await page.goto(`http://127.0.0.1:${address.port}/chathistory.html`, { waitUntil: "load" });
    await page.waitForFunction(token => document.getElementById("messages-container").textContent.includes(token), historyTokens.activeToken);
    let historyText = await page.locator("#messages-container").innerText();
    assert.ok(historyText.includes(historyTokens.activeToken));
    assert.ok(!historyText.includes(historyTokens.expiredToken), "Default history view exposed an expired row");
    let exportedTokens = await page.evaluate(async () => {
      const exported = await loadAllMessagesMatchingFilters({ ...filters, dateFrom: 0, dateTo: Date.now() });
      return exported.map(message => message.chatmessage);
    });
    assert.ok(exportedTokens.includes(historyTokens.activeToken));
    assert.ok(!exportedTokens.includes(historyTokens.expiredToken), "Default Export All included an expired row");

    await page.goto(`http://127.0.0.1:${address.port}/chathistory.html?unlimited=1`, { waitUntil: "load" });
    await page.waitForFunction(token => document.getElementById("messages-container").textContent.includes(token), historyTokens.expiredToken);
    historyText = await page.locator("#messages-container").innerText();
    assert.ok(historyText.includes(historyTokens.activeToken));
    assert.ok(historyText.includes(historyTokens.expiredToken), "Unlimited history view hid an expired row");
    exportedTokens = await page.evaluate(async () => {
      const exported = await loadAllMessagesMatchingFilters({ ...filters, dateFrom: 0, dateTo: Date.now() });
      return exported.map(message => message.chatmessage);
    });
    assert.ok(exportedTokens.includes(historyTokens.activeToken));
    assert.ok(exportedTokens.includes(historyTokens.expiredToken), "Unlimited Export All omitted an expired row");

    for (const format of ["json", "tsv", "html"]) {
      await page.selectOption("#export-format", format);
      await page.selectOption("#export-timeframe", "all");
      const downloadPromise = page.waitForEvent("download");
      await page.click("#export-button");
      const download = await downloadPromise;
      assert.ok(download.suggestedFilename().startsWith("chat_export_"));
      assert.ok(download.suggestedFilename().endsWith("." + format));
      const exportedContent = fs.readFileSync(await download.path(), "utf8");
      assert.ok(exportedContent.includes(historyTokens.activeToken), format + " download omitted the active message");
      assert.ok(exportedContent.includes(historyTokens.expiredToken), format + " download omitted Unlimited history");
      if (format === "json") assert.doesNotThrow(() => JSON.parse(exportedContent));
      await download.delete();
    }

    const snapshotTokens = {
      activeToken: "active-snapshot-" + Date.now(),
      expiredToken: "expired-snapshot-" + Date.now()
    };
    const postHistorySnapshot = unlimitedDB => page.evaluate(({ tokens, unlimited }) => {
      const now = Date.now();
      window.postMessage({
        type: "ssapp-chat-history-snapshot",
        snapshot: {
          unlimitedDB: unlimited,
          messages: [
            { id: 1, chatname: "active", chatmessage: tokens.activeToken, type: "test", timestamp: now, expiresAt: now + (30 * 24 * 60 * 60 * 1000) },
            { id: 2, chatname: "expired", chatmessage: tokens.expiredToken, type: "test", timestamp: now - (31 * 24 * 60 * 60 * 1000), expiresAt: now - 1000 }
          ]
        }
      }, "*");
    }, { tokens: snapshotTokens, unlimited: unlimitedDB });

    await page.goto(`http://127.0.0.1:${address.port}/chathistory.html?ssappSnapshot=1`, { waitUntil: "load" });
    await postHistorySnapshot(false);
    await page.waitForFunction(token => document.getElementById("messages-container").textContent.includes(token), snapshotTokens.activeToken);
    historyText = await page.locator("#messages-container").innerText();
    assert.ok(!historyText.includes(snapshotTokens.expiredToken), "Default SSApp snapshot exposed an expired row");

    await page.goto(`http://127.0.0.1:${address.port}/chathistory.html?ssappSnapshot=1`, { waitUntil: "load" });
    await postHistorySnapshot(true);
    await page.waitForFunction(token => document.getElementById("messages-container").textContent.includes(token), snapshotTokens.expiredToken);
    historyText = await page.locator("#messages-container").innerText();
    assert.ok(historyText.includes(snapshotTokens.activeToken));
    assert.ok(historyText.includes(snapshotTokens.expiredToken), "Unlimited SSApp snapshot hid an expired row");

    assert.deepStrictEqual(pageErrors, []);
    console.log("Unlimited database retention browser tests passed.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
