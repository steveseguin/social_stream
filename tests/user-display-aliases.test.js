const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");
const popupSource = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
const dockSource = fs.readFileSync(path.join(repoRoot, "dock.html"), "utf8");

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
  settings: {},
  settingUserDisplayAliasCache: new Map(),
  filterXSS: value => value
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
this.applyUserDisplayAlias = applyUserDisplayAlias;
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
assert.strictEqual(context.applyUserDisplayAlias(fallbackIdentity), true);
assert.strictEqual(fallbackIdentity.chatname, "Jerome");
assert.strictEqual(fallbackIdentity.username, "beastfighter1", "the original chatname should be preserved only when no stronger identity exists");

const userIdIdentity = { type: "youtubeshorts", userid: "UC123", chatname: "Original YouTube Name" };
assert.strictEqual(context.applyUserDisplayAlias(userIdIdentity), true);
assert.strictEqual(userIdIdentity.chatname, "YT Friend");
assert.strictEqual(userIdIdentity.userid, "UC123");
assert.ok(!("username" in userIdIdentity), "an existing userid should prevent a fallback username from being added");

const usernameIdentity = { type: "kick", username: "kick_login", chatname: "Original Kick Name" };
assert.strictEqual(context.applyUserDisplayAlias(usernameIdentity), true);
assert.strictEqual(usernameIdentity.chatname, "Kick Friend");
assert.strictEqual(usernameIdentity.username, "kick_login");

const unmatched = { type: "twitch", chatname: "someone_else" };
assert.strictEqual(context.applyUserDisplayAlias(unmatched), false);
assert.deepStrictEqual(unmatched, { type: "twitch", chatname: "someone_else" });

assert.ok(popupHtml.includes('id="userDisplayAliasesList"'), "the popup should expose the alias editor");
assert.ok(popupSource.includes("setting: 'userdisplayaliases'"), "the popup should persist aliases as a dedicated setting");
assert.ok(backgroundSource.indexOf("prependFirstTimerBadge(data);") < backgroundSource.indexOf("applyUserDisplayAlias(data);"), "identity and first-timer work should happen before the display-name replacement");
assert.ok(backgroundSource.includes("data.userid || data.username || data.chatname"), "user actions should prefer stable identities");
assert.ok(backgroundSource.includes("applyUserDisplayAlias(deletePayload);"), "delete events should target the displayed alias");
assert.ok(backgroundSource.includes("const userToBlock = { username: data.userid || data.username || data.chatname, type: altSourceType };"), "block actions should use the stable source identity");
assert.ok(backgroundSource.includes("chatname: data.username || data.chatname"), "source-side block actions should keep the original username");
assert.ok(dockSource.includes("node.dataset.username = data.username;"), "the dock should retain the source username");
assert.ok(dockSource.includes("sendBlob.username = username;"), "block actions should return the source username");
assert.ok(dockSource.includes("username: username, type: userType"), "VIP actions should return the source username");

console.log("User display alias tests passed.");
