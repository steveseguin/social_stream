const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");
const popupSource = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
const dockSource = fs.readFileSync(path.join(repoRoot, "dock.html"), "utf8");
const pollSource = fs.readFileSync(path.join(repoRoot, "poll.html"), "utf8");
const mapSource = fs.readFileSync(path.join(repoRoot, "map.html"), "utf8");
const reactionsSource = fs.readFileSync(path.join(repoRoot, "reactions.html"), "utf8");

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notStrictEqual(start, -1, `Missing ${name}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

const context = vm.createContext({
  Map,
  JSON,
  String,
  Array,
  Promise,
  setTimeout,
  console,
  settings: {},
  settingUserDisplayAliasCache: new Map(),
  filterXSS: value => value,
  getSettingFlag: () => false,
  markP2PFailure: () => {},
  connectedPeers: {},
  iframe: null,
  ninjaBridge: null,
  socketserverDock: null
});
vm.runInContext(
  `${extractFunction(backgroundSource, "trimSettingCache")}
${extractFunction(backgroundSource, "normalizeSourceType")}
${extractFunction(backgroundSource, "normalizeRoleIdentifier")}
${extractFunction(backgroundSource, "normalizeConfiguredUserSourceType")}
${extractFunction(backgroundSource, "getCachedUserDisplayAliases")}
${extractFunction(backgroundSource, "matchesConfiguredUser")}
${extractFunction(backgroundSource, "getUserDisplayAliasEntries")}
${extractFunction(backgroundSource, "findUserDisplayAlias")}
${extractFunction(backgroundSource, "applyUserDisplayAlias")}
${extractFunction(backgroundSource, "getOverlayDisplayMessage")}
${extractFunction(backgroundSource, "getOverlayDisplayPayload")}
${extractFunction(backgroundSource, "sendDataToStreamDeckPeersP2P")}
${extractFunction(backgroundSource, "sendDataP2P")}
async ${extractFunction(backgroundSource, "trySendTargetP2P")}
async ${extractFunction(backgroundSource, "sendTargetP2P")}
this.getOverlayDisplayPayload = getOverlayDisplayPayload;
this.sendDataP2P = sendDataP2P;
this.sendTargetP2P = sendTargetP2P;
this.matchesConfiguredUser = matchesConfiguredUser;`,
  context
);

context.settings.userdisplayaliases = {
  object: [
    { type: "twitch", identifier: "beastfighter1", displayName: "Jerome" },
    { type: "youtube", identifier: "UC123", displayName: "YT Friend" },
    { type: "kick", identifier: "kick_login", displayName: "Kick Friend" }
  ]
};

const fallbackIdentity = { type: "twitch", chatname: "beastfighter1" };
const fallbackDisplay = context.getOverlayDisplayPayload(fallbackIdentity);
assert.notStrictEqual(fallbackDisplay, fallbackIdentity);
assert.deepStrictEqual(fallbackIdentity, { type: "twitch", chatname: "beastfighter1" }, "aliasing must not mutate the canonical message");
assert.strictEqual(fallbackDisplay.chatname, "Jerome");
assert.strictEqual(fallbackDisplay.username, "beastfighter1", "the overlay copy should preserve the original chatname for user actions");

const userIdIdentity = { type: "youtubeshorts", userid: "UC123", chatname: "Original YouTube Name" };
const userIdDisplay = context.getOverlayDisplayPayload(userIdIdentity);
assert.strictEqual(userIdDisplay.chatname, "YT Friend");
assert.strictEqual(userIdDisplay.userid, "UC123");
assert.ok(!("username" in userIdDisplay), "an existing userid should prevent a fallback username from being added");
assert.strictEqual(userIdIdentity.chatname, "Original YouTube Name");

const usernameIdentity = { type: "kick", username: "kick_login", chatname: "Original Kick Name" };
const usernameDisplay = context.getOverlayDisplayPayload(usernameIdentity);
assert.strictEqual(usernameDisplay.chatname, "Kick Friend");
assert.strictEqual(usernameDisplay.username, "kick_login");
assert.strictEqual(usernameIdentity.chatname, "Original Kick Name");

const historyPayload = { recentHistory: [fallbackIdentity] };
const historyDisplay = context.getOverlayDisplayPayload(historyPayload);
assert.strictEqual(historyDisplay.recentHistory[0].chatname, "Jerome");
assert.strictEqual(historyPayload.recentHistory[0].chatname, "beastfighter1", "history records must remain canonical before transport");

const deletePayload = { delete: { type: "twitch", chatname: "beastfighter1" } };
const deleteDisplay = context.getOverlayDisplayPayload(deletePayload);
assert.strictEqual(deleteDisplay.delete.chatname, "Jerome");
assert.strictEqual(deletePayload.delete.chatname, "beastfighter1", "delete controls must only be aliased on the overlay copy");

const unmatched = { type: "twitch", chatname: "someone_else" };
assert.strictEqual(context.getOverlayDisplayPayload(unmatched), unmatched);
assert.deepStrictEqual(unmatched, { type: "twitch", chatname: "someone_else" });

const configuredAliases = context.settings.userdisplayaliases;
context.settings.userdisplayaliases = { object: [] };
const disabledPayload = { type: "twitch", chatname: "beastfighter1" };
assert.strictEqual(context.getOverlayDisplayPayload(disabledPayload), disabledPayload, "disabled aliases must be a no-op");
context.settings.userdisplayaliases = configuredAliases;

assert.ok(popupHtml.includes('id="userDisplayAliasesList"'), "the popup should expose the alias editor");
assert.ok(popupSource.includes("setting: 'userdisplayaliases'"), "the popup should persist aliases as a dedicated setting");
assert.ok(!extractFunction(backgroundSource, "applyBotActions").includes("applyUserDisplayAlias"), "aliases must not change internal message processing");
assert.ok(extractFunction(backgroundSource, "sendDataP2P").includes("getOverlayDisplayPayload(data)"), "dock and socket output should receive the display-only copy");
assert.ok(extractFunction(backgroundSource, "sendTargetP2P").includes("getOverlayDisplayPayload(data)"), "targeted overlays should receive the display-only copy");
assert.ok(!extractFunction(backgroundSource, "sendToDestinations").includes("applyUserDisplayAlias"), "non-overlay destinations must retain the canonical message");
assert.strictEqual((backgroundSource.match(/applyUserDisplayAlias\(/g) || []).length, 2, "aliases should only be defined and applied to an overlay copy");
assert.ok(backgroundSource.includes("data.userid || data.username || data.chatname"), "user actions should prefer stable identities");
assert.ok(backgroundSource.includes("checkUserTypeExists(data.userid || data.chatname, data.type, data.chatname)"), "first-timer checks should retain their original identity behavior");
assert.ok(backgroundSource.includes("message.idx = await addMessageDB(message);"), "database writes should receive the canonical message unchanged");
assert.ok(backgroundSource.includes("const userToBlock = { username: data.userid || data.username || data.chatname, type: altSourceType };"), "block actions should use the stable source identity");
assert.ok(backgroundSource.includes("chatname: data.username || data.chatname"), "source-side block actions should keep the original username");
assert.ok(dockSource.includes("node.dataset.username = data.username;"), "the dock should retain the source username");
assert.ok(dockSource.includes("username: username, type: type"), "history requests should use the retained source username");
assert.ok(dockSource.includes("sendBlob.username = username;"), "block actions should return the source username");
assert.ok(dockSource.includes("username: username, type: userType"), "VIP actions should return the source username");
assert.ok(pollSource.includes("payload.uid || payload.username || null"), "poll voting should prefer the stable source username over an alias");
assert.ok(mapSource.includes("data.uid || data.username"), "map voting should prefer the stable source username over an alias");
assert.ok(reactionsSource.includes("payload.userid || payload.username || payload.chatname"), "reaction deduplication should prefer stable identity over an alias");

(async () => {
  const canonicalMessage = { type: "twitch", chatname: "beastfighter1", chatmessage: "hello" };
  const p2pPayloads = [];
  context.ninjaBridge = {
    isReady: () => true,
    getPeers: () => ({ peer: "dock" }),
    sendToLabel: (payload, label) => {
      p2pPayloads.push({ payload, label });
      return true;
    }
  };
  context.sendDataP2P(canonicalMessage);
  assert.ok(p2pPayloads.length > 0);
  assert.ok(p2pPayloads.every(sent => sent.payload.chatname === "Jerome"), "P2P overlay output should use the alias");
  assert.strictEqual(canonicalMessage.chatname, "beastfighter1", "P2P output must not mutate its input");

  const socketPayloads = [];
  context.settings.server2 = true;
  context.socketserverDock = {
    readyState: 1,
    send: payload => socketPayloads.push(JSON.parse(payload))
  };
  context.sendDataP2P(canonicalMessage);
  assert.strictEqual(socketPayloads[0].chatname, "Jerome", "socket overlay output should use the alias");
  assert.strictEqual(canonicalMessage.chatname, "beastfighter1", "socket output must not mutate its input");

  context.settings.server2 = false;
  p2pPayloads.length = 0;
  context.ninjaBridge.getPeers = () => ({ peer: "alerts" });
  await context.sendTargetP2P(canonicalMessage, "alerts", { retry: false });
  assert.ok(p2pPayloads.length > 0);
  assert.ok(p2pPayloads.every(sent => sent.payload.chatname === "Jerome"), "targeted overlay output should use the alias");
  assert.strictEqual(canonicalMessage.chatname, "beastfighter1", "targeted output must not mutate its input");

  console.log("User display alias tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
