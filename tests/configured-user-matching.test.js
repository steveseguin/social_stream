const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(repoRoot, "background.js"), "utf8");
const popupSource = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");

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

const context = vm.createContext({});
vm.runInContext(
  `${extractFunction(backgroundSource, "normalizeRoleIdentifier")}
${extractFunction(backgroundSource, "matchesConfiguredUser")}
this.matchesConfiguredUser = matchesConfiguredUser;`,
  context
);

const matchesConfiguredUser = context.matchesConfiguredUser;
const clive = { userid: "UC-account-id", chatname: "Clive's Adventures" };

assert.strictEqual(
  matchesConfiguredUser({ name: "clive's adventures", type: "" }, clive, "youtube"),
  true,
  "a legacy/manual display-name entry should match even when a user ID is present"
);
assert.strictEqual(
  matchesConfiguredUser({ name: "clive's adventures", type: "youtube" }, clive, "youtube"),
  true,
  "a source-specific display-name entry should match its source"
);
assert.strictEqual(
  matchesConfiguredUser({ name: "clive's adventures", type: "twitch" }, clive, "youtube"),
  false,
  "source-specific entries should not match another source"
);
assert.strictEqual(
  matchesConfiguredUser({ name: "uc-account-id", type: "youtube" }, { userid: "UC-account-id", chatname: "Renamed Host" }, "youtube"),
  true,
  "a captured user-ID entry should continue matching after a display-name change"
);
assert.strictEqual(
  matchesConfiguredUser({ name: "@Clive", type: "" }, { chatname: "clive" }, "twitch"),
  true,
  "leading @ and casing should be normalized"
);

assert.strictEqual(
  matchesConfiguredUser({ name: "clive_login", type: "twitch" }, { username: "Clive_Login", chatname: "Clive" }, "twitch"),
  true,
  "a source username should match independently of the display name"
);

assert.ok(
  backgroundSource.includes('const storageUsername = request.value.userid || request.value.username || request.value.chatname || "";'),
  "right-click role additions should prefer the captured user ID or username"
);
assert.ok(!backgroundSource.includes("settings.matchRolesByDisplayName"), "role matching should no longer require an optional toggle");
assert.ok(!popupSource.includes('data-setting="matchRolesByDisplayName"'), "the obsolete display-name toggle should not remain in the popup");

console.log("Configured user matching tests passed.");
