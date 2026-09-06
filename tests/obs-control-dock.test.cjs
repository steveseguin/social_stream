"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const dockHtml = fs.readFileSync(path.join(repoRoot, "obs-control-dock.html"), "utf8");
const guideHtml = fs.readFileSync(path.join(repoRoot, "docs", "obs-control-dock-guide.html"), "utf8");
const creditsGuideHtml = fs.readFileSync(path.join(repoRoot, "docs", "credits-roll-guide.html"), "utf8");
const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");

for (const match of dockHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
	if (match[1].trim()) new vm.Script(match[1], { filename: "obs-control-dock-inline.js" });
}

assert.ok(dockHtml.includes('new WebSocket(WEBSOCKET_URL)'));
assert.ok(dockHtml.includes('{ join: sessionId, out: 1, in: 2 }'));
assert.ok(dockHtml.includes('params.get("session") || params.get("s") || params.get("id")'));
assert.ok(dockHtml.includes('localStorage.setItem(STORAGE_KEY, value)'));
assert.ok(dockHtml.includes('fullApiLink.href = "./sampleapi.html?session=" + encodeURIComponent(sessionId)'));
assert.ok(!/<script[^>]+src=["']https?:\/\//i.test(dockHtml), "control dock must not load remote executable scripts");
assert.ok(!/<script[^>]+type=["']module["']/i.test(dockHtml), "control dock must remain a classic browser page");

[
	"creditsStart",
	"creditsPreview",
	"creditsTest",
	"creditsReset",
	"nextInQueue",
	"nextPinned",
	"clearOverlay",
	"clearDock",
	"starttimer",
	"pausetimer",
	"resettimer",
	"startentries",
	"stopentries",
	"selectwinner",
	"resetwaitlist"
].forEach(action => {
	assert.ok(dockHtml.includes('data-action="' + action + '"'), "missing control dock action: " + action);
});

assert.ok(guideHtml.includes("Docks</strong> &rarr; <strong>Custom Browser Docks"));
assert.ok(guideHtml.includes("https://socialstream.ninja/obs-control-dock.html?session=YOUR_SESSION_ID"));
assert.ok(guideHtml.includes("remote API control of extension"));
assert.ok(guideHtml.includes("No <code>&amp;server</code> is needed"));
assert.ok(guideHtml.includes("OBS's <strong>WebSocket Server Settings</strong> are unrelated"));
assert.ok(guideHtml.includes("Background collection"));
assert.ok(guideHtml.includes("Test uses built-in names"));

assert.ok(creditsGuideHtml.includes("Open the OBS Control Dock"));
assert.ok(popupHtml.includes('id="obs_control_dock_url"'));
assert.ok(popupJs.includes('buildGeneratedUrl("obs-control-dock.html"'));
assert.ok(popupJs.includes("'obs_control_dock_url'"));

console.log("OBS control dock checks passed.");
