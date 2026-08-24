const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const cohost = fs.readFileSync(path.join(root, "cohost.html"), "utf8");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const dock = fs.readFileSync(path.join(root, "dock.html"), "utf8");
const popup = fs.readFileSync(path.join(root, "popup.html"), "utf8");

assert(cohost.includes('avatar.setPosition("calc(100vw - 220px)", "20px")'), "Controller avatar should default to the upper-right");
assert(cohost.includes("padding: 20px 220px 20px 20px"), "Desktop conversation text should reserve space beside the avatar without wasting the top of the chat");
assert(cohost.includes("@media (max-width: 1100px)"), "The controller avatar should stop floating over narrow layouts");
assert(cohost.includes('id="cohostSessionObs"'), "OBS controls should require a controller-page opt-in");
assert(cohost.includes('id="cohostSessionFeaturedChat"'), "Featured chat should require a controller-page opt-in");
assert(cohost.includes('origin: source'), "Realtime response authorization should retain the immutable prompt origin");
assert(cohost.includes('source === "streamer_voice" || source === "streamer_text"'), "Only direct streamer turns may arm tools");
assert(cohost.includes('if (!isCohostToolAvailable(status, "spotify"))'), "Configured LLM Spotify commands should require both permission layers");
assert(cohost.includes("Math.min(commands.length, 1)"), "Configured LLM should execute at most one tool per turn");
assert(cohost.includes('origin: "tool_result", allowTools: false'), "Tool continuations must be no-tools turns");
assert(cohost.includes('calls.every(call => this.processedToolCallIds.has'), "Duplicate Realtime tool calls should be ignored");
assert(cohost.includes("this.pendingResponseOrigins = [];"), "Settled or timed-out responses should discard stale authorization origins");
assert(background.includes("settings.cohostObsControl"), "The background must enforce the persistent OBS permission");
assert(background.includes("getCohostObsSceneAllowlist"), "OBS scenes should be allowlisted in the background");
assert(background.includes("Flow Actions is not connected"), "OBS control should fail clearly when the Actions page is unavailable");
assert(background.includes("settings.cohostFeaturedChatControl"), "The background must enforce the persistent featured-chat permission");
assert(background.includes('sendTargetP2P({ action: "cohostFeatureMessage"'), "Feature requests should route through the Streaming Chat dock");
assert(dock.includes('data.action == "cohostFeatureMessage"'), "The Dock should resolve and feature co-host-selected messages");
assert(popup.includes('id="cohostObsScenes"'), "The popup should expose allowed OBS scene names");

console.log("Co-host stream tools contract passed.");
