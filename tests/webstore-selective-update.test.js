const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const popupSource = read("popup.js");
const popupHtml = read("popup.html");
const backgroundSource = read("background.js");
const serviceWorkerSource = read("service_worker.js");
const spotifySource = read("spotify.js");
const spotifyHtml = read("spotify.html");
const vpzoneWebsocketSource = read("sources/websocket/vpzone.js");
const settingsDefinitions = read("shared/config/settingsDefinitions.js");
const settingsKeyIndex = read("docs/agents/13-reference/settings-key-index.md");
const manifest = JSON.parse(read("manifest.json"));

assert.equal(manifest.version, "3.50.7");
assert.deepEqual(manifest.permissions, [
  "notifications",
  "storage",
  "debugger",
  "tabs",
  "scripting",
  "tabCapture",
  "identity"
]);
assert.ok(spotifySource.includes("chrome.identity.launchWebAuthFlow"), "rebased Web Store Spotify OAuth flow is missing");
assert.ok(spotifySource.includes("chrome.identity.getRedirectURL('spotify')"), "Spotify OAuth no longer uses the extension callback");
assert.ok(serviceWorkerSource.includes("if (backgroundPageTabIdLoaded)"), "Spotify duplicate-auth guard is missing");
assert.ok(spotifyHtml.includes("https://cppibjhfemifednoimlblfcmjgfhfjeg.chromiumapp.org/spotify"), "Web Store Spotify callback instructions are missing");

const vpzoneUsernameFirstId = "data.userid = ev.actorUsername || ev.username || (ev.actorUserId != null ? String(ev.actorUserId) : (ev.userId != null ? String(ev.userId) : \"\"));";
assert.equal(vpzoneWebsocketSource.split(vpzoneUsernameFirstId).length - 1, 2, "VPZone websocket events no longer prefer usernames for user matching");

assert.ok(!popupSource.includes("function preparePopupSearchIndex"), "crashing popup search prebuild returned");
assert.ok(!popupSource.includes("setTimeout(preparePopupSearchIndex"), "popup search still schedules the crashing prebuild");

for (const retiredSource of ["trovo", "dlive"]) {
  assert.ok(!popupHtml.includes(`id="${retiredSource}_username"`), `${retiredSource} quick-open input is still present`);
  assert.ok(!popupHtml.includes(`data-action="openchat" data-value="${retiredSource}"`), `${retiredSource} quick-open button is still present`);
  assert.ok(!backgroundSource.includes(`target == "${retiredSource}"`), `${retiredSource} quick-open handler is still present`);
  assert.ok(!settingsDefinitions.includes(`"${retiredSource}_username"`), `${retiredSource} stale setting definition is still present`);
  assert.ok(!settingsKeyIndex.includes(`\`${retiredSource}_username\``), `${retiredSource} stale setting documentation is still present`);
}

const catalogStart = popupSource.indexOf("const sourceTypes = ['relaytargets','eventsSources','ttssources'];");
const catalogEnd = popupSource.indexOf("let tabsInitialized = false;", catalogStart);
assert.notEqual(catalogStart, -1, "source catalog start marker is missing");
assert.notEqual(catalogEnd, -1, "source catalog end marker is missing");

const sandbox = vm.createContext({ URL, console, Set, window: {}, chrome: undefined });
vm.runInContext(
  popupSource.slice(catalogStart, catalogEnd) +
    "\nthis.catalog = { sourceTypes, sourcesList, collectSourcesFromManifest };",
  sandbox
);

assert.deepEqual(Array.from(sandbox.catalog.sourceTypes), ["relaytargets", "eventsSources", "ttssources"]);
for (const expected of [
  "arena",
  "clouthub",
  "external",
  "instagramlive",
  "meet",
  "obs",
  "socialstreamchat",
  "stageten",
  "threads",
  "twitter",
  "workplace",
  "youtubeshorts",
  "zoom_poll"
]) {
  assert.ok(sandbox.catalog.sourcesList.has(expected), `missing canonical source type: ${expected}`);
}
assert.ok(!sandbox.catalog.sourcesList.has("velora"), "removed Web Store provider returned to source choices");

sandbox.catalog.collectSourcesFromManifest(manifest);
assert.ok(!sandbox.catalog.sourcesList.has("dlive"), "retired DLive source returned to source choices");
assert.ok(Array.from(sandbox.catalog.sourcesList).every((source) => !source.includes("/")), "source list contains a path instead of a type");

const manifestSourceFiles = manifest.content_scripts
  .flatMap((entry) => entry.js || [])
  .filter((file) => file.startsWith("./sources/") && file.endsWith(".js") && !file.startsWith("./sources/inject/"));
for (const file of manifestSourceFiles) {
  const sourceName = path.basename(file, ".js");
  if (sourceName !== "dlive") {
    assert.ok(sandbox.catalog.sourcesList.has(sourceName), `missing manifest source: ${sourceName}`);
  }
}

console.log("Web Store selective update checks passed.");
