const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const bridgePages = [
  "sampleoverlay.html",
  "events.html",
  "septapus.html",
  "themes/deuks_overlay/overlay1.html",
  "themes/deuks_overlay/overlay2.html",
  "themes/events/index.html",
  "themes/horizontal.html",
  "themes/huan-kiara/index.html",
  "themes/notimeoutmessages.html",
  "themes/overlay-bubbles.html",
  "themes/overlay-cards.html",
  "themes/overlay-comic-classic.html",
  "themes/overlay-comic-pop.html",
  "themes/overlay-credits.html",
  "themes/overlay-neon-cyberpunk.html",
  "themes/overlay-particles.html",
  "themes/overlay-typewriter.html",
  "themes/overlay-xacception.html",
  "themes/rainbowpuke/index.html",
  "themes/sampleoverlay_reverse.html",
  "themes/spiritoverlay.html",
  "themes/t3nk3y/index.html",
  "themes/Windows3.1/index.html"
];

const dockWrappers = [
  "themes/pretty.html",
  "themes/Neutron/chatOnly.html",
  "themes/Neutron/stream.html"
];

const existingSelectableBridgePages = [
  "themes/compact-classic.html",
  "themes/compact-clean.html",
  "themes/compact-glass.html",
  "themes/overlay-danmaku.html",
  "themes/overlay-ticker-news.html",
  "themes/LuckyLootTube/luckyloottube.html"
];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} was not found`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} did not have a complete body`);
}

function passwordResolver(source, relativePath) {
  const declarations = Array.from(source.matchAll(/\b(?:var|const)\s+password\s*=\s*([^;]+);/g));
  const declaration = declarations.find((match) => match[1].includes("urlParams.get"));
  assert.ok(declaration, `${relativePath} must derive its bridge password from URL parameters`);
  return Function("urlParams", `return (${declaration[1]});`);
}

for (const relativePath of bridgePages) {
  const source = read(relativePath);
  const resolvePassword = passwordResolver(source, relativePath);

  assert.strictEqual(resolvePassword(new URLSearchParams()), "false", `${relativePath} must retain the no-password default`);
  assert.strictEqual(resolvePassword(new URLSearchParams("password=pa%26ss%3D1")), "pa&ss=1", `${relativePath} must read password`);
  assert.strictEqual(resolvePassword(new URLSearchParams("pass=long-alias")), "long-alias", `${relativePath} must read pass alias`);
  assert.strictEqual(resolvePassword(new URLSearchParams("pw=short-alias")), "short-alias", `${relativePath} must read pw alias`);
  assert.strictEqual(resolvePassword(new URLSearchParams("password=primary&pass=secondary&pw=tertiary")), "primary", `${relativePath} must prefer password`);
  assert.ok(source.includes("encodeURIComponent(password)"), `${relativePath} must URL-encode the bridge password`);
}

for (const relativePath of existingSelectableBridgePages) {
  const source = read(relativePath);
  const resolvePassword = passwordResolver(source, relativePath);

  assert.strictEqual(resolvePassword(new URLSearchParams()), "false", `${relativePath} must retain the no-password default`);
  assert.strictEqual(resolvePassword(new URLSearchParams("password=pa%26ss%3D1")), "pa&ss=1", `${relativePath} must read password`);
  assert.ok(source.includes("encodeURIComponent(password)"), `${relativePath} must URL-encode the bridge password`);
}

for (const relativePath of dockWrappers) {
  const source = read(relativePath);
  const resolvePassword = passwordResolver(source, relativePath);

  assert.strictEqual(resolvePassword(new URLSearchParams()), null, `${relativePath} must not add a password by default`);
  assert.strictEqual(resolvePassword(new URLSearchParams("password=pa%26ss%3D1")), "pa&ss=1", `${relativePath} must forward password`);
  assert.strictEqual(resolvePassword(new URLSearchParams("pass=long-alias")), "long-alias", `${relativePath} must forward pass alias`);
  assert.strictEqual(resolvePassword(new URLSearchParams("pw=short-alias")), "short-alias", `${relativePath} must forward pw alias`);
  assert.ok(source.includes('params += "&password=" + encodeURIComponent(password);'), `${relativePath} must URL-encode the forwarded password`);
}

function runScaleBlock(relativePath, query, centering) {
  const source = read(relativePath);
  const start = source.indexOf("var scale = false;");
  const marker = 'document.body.style.width = parseInt(100 / scale) + "%";';
  const markerEnd = source.indexOf(marker, start) + marker.length;
  assert.ok(start >= 0 && markerEnd >= marker.length, `${relativePath} scale block was not found`);

  const scaleBlock = source.slice(start, markerEnd) + "\n}";
  const applyScale = Function("urlParams", "document", "centering", scaleBlock);
  const document = { body: { style: {} } };
  applyScale(new URLSearchParams(query), document, centering);
  return document.body.style;
}

for (const relativePath of ["featured.html", "bot.html"]) {
  const smallerCentered = runScaleBlock(relativePath, "scale=0.5", true);
  assert.strictEqual(smallerCentered.transform, "scale(0.5)", `${relativePath} must use a valid centered transform below 1x`);
  assert.strictEqual(smallerCentered.transformOrigin, "center bottom", `${relativePath} must keep the centered origin below 1x`);

  const largerCentered = runScaleBlock(relativePath, "scale=2", true);
  assert.strictEqual(largerCentered.transform, "scale(2) translate(-50%, 0%)", `${relativePath} must use a valid centered transform above 1x`);
  assert.strictEqual(largerCentered.transformOrigin, "center bottom", `${relativePath} must keep the centered origin above 1x`);

  const smallerLeft = runScaleBlock(relativePath, "scale=0.5", false);
  assert.strictEqual(smallerLeft.transform, "scale(0.5)", `${relativePath} must preserve left-aligned scaling`);
  assert.strictEqual(smallerLeft.transformOrigin, "left bottom", `${relativePath} must preserve the left origin`);
}

const syntaxPages = Array.from(new Set(bridgePages.concat(dockWrappers, ["featured.html", "bot.html"])));
for (const relativePath of syntaxPages) {
  const source = read(relativePath);
  const scripts = Array.from(source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi));
  scripts.forEach((script, index) => {
    assert.doesNotThrow(() => Function(script[1]), `${relativePath} inline script ${index + 1} must parse`);
  });
}

const popupSource = read("popup.js");
const normalizeGeneratedLinkBase = Function(`${extractFunction(popupSource, "normalizeGeneratedLinkBase")}; return normalizeGeneratedLinkBase;`)();
assert.strictEqual(normalizeGeneratedLinkBase("https://socialstream.ninja/"), "https://socialstream.ninja/");
assert.strictEqual(normalizeGeneratedLinkBase("https://beta.socialstream.ninja/beta/ignored"), "https://beta.socialstream.ninja/");
assert.strictEqual(normalizeGeneratedLinkBase("file:///Applications/SSApp/featured.html"), "");
assert.strictEqual(normalizeGeneratedLinkBase("https://example.com/featured.html"), "");

const notFoundSource = read("404.html");
const redirectScriptMatch = notFoundSource.match(/<script>([\s\S]*?)<\/script>/i);
assert.ok(redirectScriptMatch, "404.html fallback redirect script was not found");
function runLegacyRedirect(pathname, search = "", hash = "") {
  let destination = "";
  Function("window", redirectScriptMatch[1])({
    location: {
      pathname,
      search,
      hash,
      replace(value) { destination = value; }
    }
  });
  return destination;
}
assert.strictEqual(
  runLegacyRedirect("/resources/social_stream_fallback/main/featured.html", "?session=test&server", "#view"),
  "/featured.html?session=test&server#view"
);
assert.strictEqual(
  runLegacyRedirect("/resources/social_stream_fallback/beta/themes/compact-clean.html", "?session=test"),
  "/beta/themes/compact-clean.html?session=test"
);
assert.strictEqual(runLegacyRedirect("/resources/social_stream_fallback/main/../featured.html", "?session=test"), "");
assert.strictEqual(runLegacyRedirect("/unrelated/missing.html", "?session=test"), "");

assert.ok(
  read("featured.html").includes("JSON.stringify({ join: roomID, out: 3, in: 4 })"),
  "featured server2 must receive the extension feed on channel 4"
);
assert.ok(
  /allin === 1\)\s*\{\s*message\.in = 4;/.test(read("samplefeatured.html")),
  "samplefeatured server2 must receive the extension feed on channel 4"
);
assert.ok(
  read("emotes.html").includes("if (!urlParams.has('server3')) return;"),
  "emotes server2 must not start a second extension socket"
);

console.log("Overlay link regression tests passed");
