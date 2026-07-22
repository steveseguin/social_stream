const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const popupSource = fs.readFileSync(path.resolve(__dirname, "..", "popup.js"), "utf8");

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = popupSource.indexOf(marker);
  assert.notStrictEqual(start, -1, `Missing ${name}`);
  const bodyStart = popupSource.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < popupSource.length; index += 1) {
    if (popupSource[index] === "{") depth += 1;
    if (popupSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return popupSource.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

function loadFunctions(names, context) {
  const sandbox = vm.createContext(Object.assign({
    URL,
    URLSearchParams,
    encodeURIComponent,
    decodeURIComponent,
    console,
  }, context));
  const exports = names.map((name) => `${name}: ${name}`).join(",");
  vm.runInContext(`${names.map(extractFunction).join("\n")}\nthis.testExports = {${exports}};`, sandbox);
  return { sandbox, functions: sandbox.testExports };
}

{
  const { functions } = loadFunctions(["buildGeneratedUrl"], { baseURL: "https://socialstream.ninja/" });
  const generated = functions.buildGeneratedUrl(
    "themes/compact-classic.html?ultra",
    "session=room%26one&password=p%2Bq&v=1.2.3"
  );
  const parsed = new URL(generated);
  assert.strictEqual(parsed.pathname, "/themes/compact-classic.html");
  assert.strictEqual(parsed.searchParams.has("ultra"), true);
  assert.strictEqual(parsed.searchParams.get("session"), "room&one");
  assert.strictEqual(parsed.searchParams.get("password"), "p+q");
  assert.strictEqual((generated.match(/\?/g) || []).length, 1);
}

{
  const elements = {
    overlay: {
      raw: "https://socialstream.ninja/featured.html?session=room1&password=p%26q&v=9&ln=fr&server&server2=two&server3&localserver&scale=2&cssb64=classic",
      id: "overlay",
    },
    dock: {
      raw: "https://socialstream.ninja/dock.html?session=room1&password=p%26q&v=9&ln=fr&server&server2=two&server3&localserver",
      id: "dock",
    },
    "featured-preset-select": { value: "" },
    sessionid: { value: "room1" },
    sessionpassword: { value: "p&q" },
  };
  const document = {
    body: { classList: { contains: () => false } },
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
  };
  let refreshCount = 0;
  const loaded = loadFunctions([
    "buildGeneratedUrl",
    "appendMissingGeneratedParams",
    "getFeaturedConnectionParams",
    "getFeaturedClassicParams",
    "applyFeaturedOverlayPreset",
  ], {
    baseURL: "https://socialstream.ninja/",
    document,
    lastResponse: { streamID: "room1", password: "p&q" },
    urlParams: new URLSearchParams("localserver"),
    FEATURED_CONNECTION_PARAM_NAMES: ["session", "password", "v", "ln", "server", "server2", "server3", "localserver"],
    getPopupVersionParam: () => "&v=9",
    getSelectedTranslationLinkParam: () => "&ln=fr",
    normalizeGeneratedPath: (raw) => new URL(raw, "https://socialstream.ninja/").pathname.replace(/^\//, ""),
    setGeneratedLink: (element, url) => { element.raw = url; },
    refreshLinks: () => { refreshCount += 1; },
  });

  loaded.functions.applyFeaturedOverlayPreset("themes/featured-styles/featured-modern.html?style=glass");
  let parsed = new URL(elements.overlay.raw);
  assert.strictEqual(parsed.pathname, "/themes/featured-styles/featured-modern.html");
  assert.strictEqual(parsed.searchParams.get("style"), "glass");
  for (const key of ["session", "password", "v", "ln", "server", "server2", "server3", "localserver"]) {
    assert.strictEqual(parsed.searchParams.has(key), true, `Preset lost ${key}`);
  }
  assert.strictEqual(parsed.searchParams.has("scale"), false);
  assert.strictEqual(parsed.searchParams.has("cssb64"), false);

  loaded.functions.applyFeaturedOverlayPreset("");
  parsed = new URL(elements.overlay.raw);
  assert.strictEqual(parsed.pathname, "/featured.html");
  assert.strictEqual(parsed.searchParams.get("scale"), "2");
  assert.strictEqual(parsed.searchParams.get("cssb64"), "classic");
  assert.strictEqual(parsed.searchParams.has("style"), false);
  assert.strictEqual(refreshCount, 2);
}

{
  const target = {
    raw: "https://socialstream.ninja/dock.html?session=room&base64css=one&b64css=two&cssbase64=three&cssb64=four",
  };
  const css = 'body::after{content:"\u00ff"}';
  const document = {
    getElementById: () => target,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const { functions } = loadFunctions([
    "updateURL",
    "removeQueryParamWithValue",
    "cleanURL",
    "syncDuplicateParamValues",
    "handleTextParam",
  ], {
    document,
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    chrome: { runtime: { sendMessage: () => {} } },
    handleColorAndPalette: () => false,
    updateRangeDisplay: () => {},
  });
  functions.handleTextParam({ dataset: { textparam1: "cssb64" }, value: css }, "dock", "textparam1", false);
  const parsed = new URL(target.raw);
  const expected = Buffer.from(encodeURIComponent(css), "binary").toString("base64");
  assert.strictEqual(parsed.searchParams.get("cssb64"), expected);
  assert.strictEqual(parsed.searchParams.has("base64css"), false);
  assert.strictEqual(parsed.searchParams.has("b64css"), false);
  assert.strictEqual(parsed.searchParams.has("cssbase64"), false);
  assert.ok(target.raw.includes(`cssb64=${encodeURIComponent(expected)}`));
}

{
  const { functions } = loadFunctions([
    "updateURL",
    "removeQueryParamWithValue",
    "cleanURL",
    "replaceGeneratedConnectionParam",
  ], {});
  let generated = functions.replaceGeneratedConnectionParam(
    "https://socialstream.ninja/dock.html?room=old&session=older&password=old&darkmode",
    "session",
    "new room&one"
  );
  let parsed = new URL(generated);
  assert.strictEqual(parsed.searchParams.get("session"), "new room&one");
  assert.strictEqual(parsed.searchParams.has("room"), false);
  assert.strictEqual(parsed.searchParams.has("darkmode"), true);

  generated = functions.replaceGeneratedConnectionParam(generated, "password", "");
  parsed = new URL(generated);
  assert.strictEqual(parsed.searchParams.has("password"), false);
  assert.strictEqual(parsed.searchParams.get("session"), "new room&one");
}

{
  const current = { dataset: { param2: "scale=2" }, checked: true };
  const conflicting = { dataset: { param2: "scale=1" }, checked: true };
  const duplicate = { dataset: { param2: "scale=2" }, checked: false };
  const target = { raw: "https://socialstream.ninja/featured.html?session=room&scale=1" };
  const saved = [];
  const document = {
    getElementById: () => target,
    querySelector: () => null,
    querySelectorAll: (selector) => selector === "input[data-param2]" ? [current, conflicting, duplicate] : [current, conflicting, duplicate],
  };
  const { functions } = loadFunctions([
    "updateURL",
    "removeQueryParamWithValue",
    "cleanURL",
    "syncDuplicateParamCheckboxes",
    "saveParamCheckboxState",
    "handleElementParam",
  ], {
    document,
    chrome: { runtime: { sendMessage: (message) => saved.push(message) } },
    normalizeParamKey: (key) => key,
    handleExclusiveCases: () => {},
    updateFirstTimerUiState: () => {},
  });
  functions.handleElementParam(current, "overlay", "param2", true);
  assert.strictEqual(new URL(target.raw).searchParams.get("scale"), "2");
  assert.strictEqual(conflicting.checked, false);
  assert.strictEqual(duplicate.checked, true);
  assert.ok(saved.some((message) => message.setting === "scale=1" && message.value === false));
}

{
  const current = { dataset: { numbersetting2: "showtime" }, value: "12000" };
  const duplicate = { dataset: { numbersetting2: "showtime" }, value: "30000" };
  const unrelated = { dataset: { numbersetting2: "scale" }, value: "2" };
  const document = {
    querySelectorAll: () => [current, duplicate, unrelated],
  };
  const { functions } = loadFunctions(["syncDuplicateParamValues"], {
    document,
    updateRangeDisplay: () => {},
  });
  functions.syncDuplicateParamValues(current, "numbersetting2", "showtime");
  assert.strictEqual(duplicate.value, "12000");
  assert.strictEqual(unrelated.value, "2");
}

assert.ok(popupSource.includes("refreshGeneratedConnectionLinks('session', xsx);"));
assert.ok(popupSource.includes("refreshGeneratedConnectionLinks('password', ele.value || '');"));
assert.ok(popupSource.includes("${hideLinks ? \"Click to open link\" : displayURL}</a>"));
assert.ok(popupSource.includes("setGeneratedLink(existingOverlay, existingOverlay.raw);"));
assert.ok(!popupSource.includes(".wrapper:has(.options_group.single_message)"));

console.log("PASS popup link generation regressions");
