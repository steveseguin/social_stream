const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const background = fs.readFileSync(path.resolve(__dirname, "..", "background.js"), "utf8");
const start = background.indexOf("function getCohostObsSceneAllowlist()");
const end = background.indexOf("\nfunction sendTickerP2P", start);
assert(start >= 0 && end > start, "Co-host tool broker functions should be present");

const deliveries = [];
let targetAvailable = true;
const context = vm.createContext({
  settings: {
    cohostSpotifyControl: false,
    spotifyEnabled: false,
    cohostObsControl: false,
    cohostObsScenes: { textsetting: "Main, BRB" },
    cohostFeaturedChatControl: false
  },
  spotify: null,
  sendTargetP2P: async (data, target) => {
    deliveries.push({ data, target });
    return targetAvailable;
  },
  sendToDestinations: async data => deliveries.push({ data, target: "destinations" }),
  handleSpotifyAction: async () => ({ success: false }),
  sanitizeRelayPayloadFields: value => value,
  console
});
vm.runInContext(background.slice(start, end) + "\nthis.handleTool = handleCohostToolRequest; this.getStatus = getCohostToolStatus;", context);

(async () => {
  let result = await context.handleTool({ tool: "obs", command: "switchScene", value: { sceneName: "Main" } });
  assert.strictEqual(result.success, false, "OBS must be denied while its popup permission is off");

  context.settings.cohostObsControl = true;
  result = await context.handleTool({ tool: "obs", command: "switchScene", value: { sceneName: "Secret" } });
  assert.strictEqual(result.success, false, "OBS scenes outside the allowlist must be denied");
  assert.strictEqual(deliveries.length, 0, "Denied OBS scenes must not be delivered");

  targetAvailable = false;
  result = await context.handleTool({ tool: "obs", command: "switchScene", value: { sceneName: "BRB" } });
  assert.strictEqual(result.success, false, "OBS should report a failure when Flow Actions is unavailable");
  assert.match(result.message, /Flow Actions is not connected/);
  deliveries.length = 0;
  targetAvailable = true;

  result = await context.handleTool({ tool: "obs", command: "switchScene", value: { sceneName: "brb" } });
  assert.strictEqual(result.success, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(deliveries[0])), {
    data: { actionType: "obsChangeScene", sceneName: "BRB" },
    target: "actions"
  });

  result = await context.handleTool({ tool: "featuredChat", command: "clear", value: {} });
  assert.strictEqual(result.success, false, "Featured chat must be denied while its popup permission is off");

  context.settings.cohostFeaturedChatControl = true;
  targetAvailable = false;
  result = await context.handleTool({
    tool: "featuredChat",
    command: "feature",
    value: { message: { id: "chat_1", chatname: "Viewer", chatmessage: "Hello", type: "youtube", textonly: true } }
  });
  assert.strictEqual(result.success, false, "Featured chat should report a failure when the Dock is unavailable");
  assert.match(result.message, /No Streaming Chat dock is connected/);
  deliveries.length = 0;
  targetAvailable = true;

  result = await context.handleTool({
    tool: "featuredChat",
    command: "feature",
    value: { message: { id: "chat_1", chatname: "Viewer", chatmessage: "Hello", type: "youtube", textonly: true, action: "unsafe" } }
  });
  assert.strictEqual(result.success, true);
  const featureDelivery = deliveries[deliveries.length - 1];
  assert.strictEqual(featureDelivery.target, "dock");
  assert.strictEqual(featureDelivery.data.action, "cohostFeatureMessage");
  assert.strictEqual(featureDelivery.data.value.action, undefined, "Feature payloads must drop ad-hoc control keys");

  const status = context.getStatus();
  assert.deepStrictEqual(Array.from(status.tools.obs.scenes), ["Main", "BRB"]);
  console.log("Co-host stream tools background passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
