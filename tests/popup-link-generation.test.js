const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const SocialStreamLocalServer = require("../js/local-server-url.js");

const popupSource = fs.readFileSync(path.resolve(__dirname, "..", "popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.resolve(__dirname, "..", "popup.html"), "utf8");
const dockHtml = fs.readFileSync(path.resolve(__dirname, "..", "dock.html"), "utf8");
const windowsOverlayHtml = fs.readFileSync(path.resolve(__dirname, "..", "themes", "Windows3.1", "index.html"), "utf8");
const backgroundSource = fs.readFileSync(path.resolve(__dirname, "..", "background.js"), "utf8");
const parametersSource = fs.readFileSync(path.resolve(__dirname, "..", "parameters.md"), "utf8");
const urlParameterConfig = fs.readFileSync(path.resolve(__dirname, "..", "shared", "config", "urlParameters.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "manifest.json"), "utf8"));

assert.strictEqual(SocialStreamLocalServer.getPort(new URLSearchParams()), 3000);
assert.strictEqual(SocialStreamLocalServer.getWebSocketUrl(new URLSearchParams("localserverport=3003")), "ws://127.0.0.1:3003");
for (const invalidPort of ["", "80", "1023", "65536", "3000/path", "3000@example.com", "3.5", "port"]) {
  assert.strictEqual(SocialStreamLocalServer.normalizeExplicitPort(invalidPort), null, `accepted invalid port: ${invalidPort}`);
}

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

for (const retiredSource of ['trovo', 'dlive']) {
  assert.ok(!popupHtml.includes(`id="${retiredSource}_username"`), `${retiredSource} quick-open input is still present`);
  assert.ok(!popupHtml.includes(`data-action="openchat" data-value="${retiredSource}"`), `${retiredSource} quick-open button is still present`);
  assert.ok(!backgroundSource.includes(`target == "${retiredSource}"`), `${retiredSource} quick-open handler is still present`);
}

assert.ok(
  popupHtml.includes('data-translate="viewer-count-and-chat-activity-overlay">Viewer Count &amp; Chat Activity Overlay'),
  "viewer-count overlay section title is missing"
);
const reserveViewerSpaceOption = popupHtml.match(/<input type="checkbox" data-param1="reserveviewercountspace"[^>]*>/);
assert.ok(reserveViewerSpaceOption, "reserve viewer-count space option is missing");
assert.ok(!/\bchecked\b/.test(reserveViewerSpaceOption[0]), "reserve viewer-count space must default to off");
assert.ok(
  dockHtml.includes('var reserveviewercountspace = showviewercount && urlParams.has("reserveviewercountspace");'),
  "dock must require both viewer counts and the reserve-space option"
);
assert.ok(dockHtml.includes('--viewer-count-reserved-space: 0px;'), "reserved space must default to zero");
assert.ok(dockHtml.includes('new MutationObserver(scheduleViewerBarSpaceUpdate)'), "viewer bar height tracking is missing");
assert.ok(parametersSource.includes('| `reserveviewercountspace` | boolean |'), "parameter documentation is missing");
assert.ok(urlParameterConfig.includes('"key": "reserveviewercountspace"'), "generated parameter metadata is missing");

assert.ok(!popupHtml.includes('data-param30="showtime"'), "Auto-hide uses the main chat control, without duplicate theme controls");

// Exercise actual preset link generation as the dock timing changes.
{
  const dock = { raw: "https://socialstream.ninja/dock.html?session=test&showtime=12000" };
  const template = { raw: "https://socialstream.ninja/themes/compact-classic.html?session=test&ultra&font=18&showtime=999" };
  const apply = Function("document", "getGeneratedLinkParams", "mergeSupportedServerParamsIntoQuery", "buildGeneratedUrl", "setGeneratedLink", "syncChatOverlayTemplateConfig", "refreshLinks", "DEFAULT_CHAT_OVERLAY_TEMPLATE", "baseURL",
    extractFunction("applyChatOverlayTemplatePreset") + "; return applyChatOverlayTemplatePreset;")(
      { getElementById: id => id === "dock" ? dock : id === "chatoverlaytemplate" ? template : null },
      element => element.raw.split("?")[1], params => params,
      Function("baseURL", extractFunction("buildGeneratedUrl") + "; return buildGeneratedUrl;")("https://socialstream.ninja/"),
      (element, url) => { element.raw = url; }, () => {}, () => {}, "sampleoverlay.html", "https://socialstream.ninja/"
    );
  for (const timing of ["12000", "5000", "0", null]) {
    dock.raw = "https://socialstream.ninja/dock.html?session=test" + (timing === null ? "" : "&showtime=" + timing);
    for (const preset of ["themes/compact-classic.html", "themes/compact-clean.html?style=cute", "themes/compact-clean.html?style=cozy", "themes/compact-clean.html", "sampleoverlay.html"]) {
      apply(preset);
      const params = new URL(template.raw).searchParams;
      assert.strictEqual(params.get("showtime"), timing || "0");
      if (preset.includes("compact-clean")) assert.strictEqual(params.get("style"), new URL(preset, "https://socialstream.ninja/").searchParams.get("style"));
      assert.strictEqual(params.get("font"), "18");
      assert.ok(params.has("ultra"));
      assert.strictEqual(params.get("session"), "test");
    }
  }
}
assert.ok(windowsOverlayHtml.includes('urlParams.has("showtime")'), "Windows 3.1 overlay must consume showtime");

const viewerCountOptionIndex = popupHtml.indexOf('data-param1="showviewercount"');
const likeCountOptionIndex = popupHtml.indexOf('data-param1="showlikecount"');
const reserveViewerSpaceOptionIndex = popupHtml.indexOf('data-param1="reserveviewercountspace"');
assert.ok(viewerCountOptionIndex !== -1 && likeCountOptionIndex > viewerCountOptionIndex, "like totals must follow viewer counts");
assert.ok(likeCountOptionIndex < reserveViewerSpaceOptionIndex, "like totals must be directly below viewer counts");
assert.ok(popupHtml.includes('aria-hidden="true">❤️</span> Show like totals'), "like totals must use the full-width heart icon");

assert.ok(
  backgroundSource.includes('if (settings.showlikecount && syncLikeTotalSettings(settings, true))'),
  "saved dock like-total state must repair global capture settings"
);
assert.ok(
  backgroundSource.includes('request.setting === "showlikecount" && request.value'),
  "enabling dock like totals must enable global capture in the background"
);
assert.ok(
  backgroundSource.includes('request.setting == "showviewercount" || request.setting == "showlikecount"'),
  "enabling dock like totals must refresh source settings"
);

{
  const start = popupSource.indexOf("const sourceTypes = ['relaytargets','eventsSources','ttssources'];");
  const end = popupSource.indexOf('// Function to handle custom JS file upload', start);
  assert.notStrictEqual(start, -1, 'source catalog start marker is missing');
  assert.notStrictEqual(end, -1, 'source catalog end marker is missing');

  const sandbox = vm.createContext({ URL, console, Set, window: {}, chrome: undefined });
  vm.runInContext(
    popupSource.slice(start, end) +
      '\nthis.catalog = { sourceTypes, sourcesList, collectSourcesFromManifest };',
    sandbox
  );

  assert.deepStrictEqual(Array.from(sandbox.catalog.sourceTypes), ['relaytargets', 'eventsSources', 'ttssources']);
  assert.ok(sandbox.catalog.sourcesList.has('velora'), 'Velora must be available without manifest loading');

  sandbox.catalog.collectSourcesFromManifest(manifest);
  assert.ok(!sandbox.catalog.sourcesList.has('dlive'), 'DLive must not appear in source dropdowns');
  assert.ok(!sandbox.catalog.sourcesList.has('trovo'), 'retired Trovo must not appear in source dropdowns');
  for (const expected of [
    'arena', 'clouthub', 'external', 'instagramlive', 'meet', 'obs', 'socialstreamchat',
    'stageten', 'threads', 'twitter', 'velora', 'workplace', 'youtubeshorts', 'zoom_poll'
  ]) {
    assert.ok(sandbox.catalog.sourcesList.has(expected), `missing canonical source type: ${expected}`);
  }

  const manifestSourceFiles = manifest.content_scripts
    .flatMap(entry => entry.js || [])
    .filter(file => file.startsWith('./sources/') && file.endsWith('.js') && !file.startsWith('./sources/inject/'))
    .filter(file => path.basename(file, '.js') !== 'dlive');
  for (const file of manifestSourceFiles) {
    const sourceName = path.basename(file, '.js');
    assert.ok(sandbox.catalog.sourcesList.has(sourceName), `missing manifest source: ${sourceName}`);
  }
  assert.ok(Array.from(sandbox.catalog.sourcesList).every(source => !source.includes('/')));
}

{
  let loaded = loadFunctions(["getLocalServerConnectionParams"], {
    urlParams: new URLSearchParams("localserver&localserverport=3003"),
    SocialStreamLocalServer,
  });
  assert.strictEqual(loaded.functions.getLocalServerConnectionParams(), "&localserver&localserverport=3003");

  loaded = loadFunctions(["getLocalServerConnectionParams"], {
    urlParams: new URLSearchParams("localserver&localserverport=invalid"),
    SocialStreamLocalServer,
  });
  assert.strictEqual(loaded.functions.getLocalServerConnectionParams(), "&localserver");
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
      raw: "https://socialstream.ninja/featured.html?session=room1&password=p%26q&v=9&ln=fr&server&server2=two&server3&localserver&localserverport=3003&scale=2&cssb64=classic",
      id: "overlay",
    },
    dock: {
      raw: "https://socialstream.ninja/dock.html?session=room1&password=p%26q&v=9&ln=fr&server&server2=two&server3&localserver&localserverport=3003",
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
    urlParams: new URLSearchParams("localserver&localserverport=3003"),
    SocialStreamLocalServer,
    FEATURED_CONNECTION_PARAM_NAMES: ["session", "password", "v", "ln", "server", "server2", "server3", "localserver", "localserverport"],
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
  for (const key of ["session", "password", "v", "ln", "server", "server2", "server3", "localserver", "localserverport"]) {
    assert.strictEqual(parsed.searchParams.has(key), true, `Preset lost ${key}`);
  }
  assert.strictEqual(parsed.searchParams.get("localserverport"), "3003");
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

{
  const elements = {
    dock: {
      raw: "https://socialstream.ninja/dock.html?session=current",
    },
  };
  const { functions } = loadFunctions(["normalizeEditableGeneratedLink"], {
    baseURL: "https://socialstream.ninja/",
    document: { getElementById: (id) => elements[id] || null },
  });

  let parsed = functions.normalizeEditableGeneratedLink(
    "https://beta.socialstream.ninja/dock.html?session=scene-one&darkmode&customfuture=kept",
    "dock"
  );
  assert.strictEqual(parsed.searchParams.get("session"), "scene-one");
  assert.strictEqual(parsed.searchParams.has("darkmode"), true);
  assert.strictEqual(parsed.searchParams.get("customfuture"), "kept");

  parsed = functions.normalizeEditableGeneratedLink("?session=scene-two&compact", "dock");
  assert.strictEqual(parsed.pathname, "/dock.html");
  assert.strictEqual(parsed.searchParams.get("session"), "scene-two");

  assert.throws(
    () => functions.normalizeEditableGeneratedLink("https://socialstream.ninja/featured.html?session=scene", "dock"),
    /dock\.html/
  );
  assert.throws(
    () => functions.normalizeEditableGeneratedLink("https://socialstream.ninja/dock.html?darkmode", "dock"),
    /session ID/
  );
}

{
  const { functions } = loadFunctions([
    "normalizeParamKey",
    "getImportedParamCheckboxState",
    "decodeImportedCssParamValue",
    "findImportedOptionValue",
  ], {
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
  });

  const params = new URLSearchParams("darkmode&scale=1.35&chroma=fff&trim=200");
  const paramValues = ["darkmode", "scale", "chromaalpha", "chroma", "chroma=fff", "trim=200"];
  assert.strictEqual(functions.getImportedParamCheckboxState(params, "darkmode", paramValues), true);
  assert.strictEqual(functions.getImportedParamCheckboxState(params, "scale", paramValues), true);
  assert.strictEqual(functions.getImportedParamCheckboxState(params, "chroma=fff", paramValues), true);
  assert.strictEqual(functions.getImportedParamCheckboxState(params, "chroma", paramValues), false);
  assert.strictEqual(functions.getImportedParamCheckboxState(params, "chromaalpha", paramValues), false);
  assert.strictEqual(functions.getImportedParamCheckboxState(params, "trim=200", paramValues), true);

  const alphaParams = new URLSearchParams("chroma=0008");
  assert.strictEqual(functions.getImportedParamCheckboxState(alphaParams, "chromaalpha", paramValues), true);
  assert.strictEqual(functions.getImportedParamCheckboxState(alphaParams, "chroma=fff", paramValues), false);

  const css = "body { color: #fff; }\n.message::after { content: '\u2713'; }";
  const encodedCss = Buffer.from(encodeURIComponent(css), "binary").toString("base64");
  assert.strictEqual(functions.decodeImportedCssParamValue(encodedCss), css);

  const languageSelect = {
    options: [
      { value: "lang=en-US&voice=Voice%20A" },
      { value: "lang=fr-FR&voice=Voice%20B" },
    ],
  };
  const importedLanguage = functions.findImportedOptionValue(
    languageSelect,
    "lang",
    new URLSearchParams("lang=fr-FR&voice=Voice%20B")
  );
  assert.strictEqual(importedLanguage.found, true);
  assert.strictEqual(importedLanguage.value, "lang=fr-FR&voice=Voice%20B");
}

{
  const darkmode = { dataset: { param1: "darkmode" }, checked: false };
  const lightmode = { dataset: { param1: "lightmode" }, checked: true };
  const scaleToggle = { dataset: { param1: "scale" }, checked: false };
  const beepToggle = { dataset: { param1: "beepvolume" }, checked: true };
  const scale = { dataset: { numbersetting: "scale" }, value: "2", defaultValue: "1", type: "range" };
  const staleVolume = { dataset: { numbersetting: "beepvolume" }, value: "90", defaultValue: "30", type: "range" };
  const unrelatedRateLimit = { dataset: { numbersetting: "ollamaRateLimitPerTab" }, value: "9000", defaultValue: "5000", type: "number" };
  const customCss = { dataset: { textparam1: "cssb64" }, value: "", defaultValue: "", id: "customCSS" };
  const staleApiKey = { dataset: { textparam1: "elevenlabskey" }, value: "old-secret", defaultValue: "", id: "elevenLabsAPIKey" };
  const ttsProvider = {
    dataset: { optionparam1: "ttsprovider", optionsetting: "ttsProvider" },
    tagName: "SELECT",
    value: "google",
    options: [{ value: "system", defaultSelected: true }, { value: "google" }],
  };
  const staleFont = {
    dataset: { optionparam1: "font" },
    tagName: "SELECT",
    value: "Arial",
    options: [{ value: "", defaultSelected: true }, { value: "Arial" }],
  };
  const dock = { id: "dock", raw: "https://socialstream.ninja/dock.html?session=current&lightmode" };
  const saved = [];
  let templateSyncCount = 0;
  const css = ".message { color: red; }";
  const encodedCss = Buffer.from(encodeURIComponent(css), "binary").toString("base64");
  const document = {
    getElementById: (id) => id === "dock" ? dock : null,
    querySelectorAll: (selector) => {
      if (selector === "input[data-param1]") return [darkmode, lightmode, scaleToggle, beepToggle];
      if (selector === "[data-numbersetting]") return [scale, staleVolume, unrelatedRateLimit];
      if (selector === "[data-textparam1]") return [customCss, staleApiKey];
      if (selector === "[data-optionparam1]") return [ttsProvider, staleFont];
      return [];
    },
  };
  const { functions } = loadFunctions([
    "normalizeParamKey",
    "decodeImportedCssParamValue",
    "getImportedParamCheckboxState",
    "findImportedOptionValue",
    "getImportedControlDefaultValue",
    "saveImportedLinkControl",
    "applyImportedGeneratedLink",
  ], {
    document,
    chrome: { runtime: { sendMessage: (message) => saved.push(message) } },
    getTargetMap: () => ({ dock: 1 }),
    getPercentFromChromaValue: () => 50,
    updateRangeDisplay: () => {},
    handleColorAndPalette: () => false,
    commaTagInputs: [],
    userTypes: [],
    refreshCommaTagInput: () => {},
    updateUsernameList: () => {},
    ensureSelectValueOption: () => {},
    handleOptionSetting: () => {},
    setGeneratedLink: (element, url) => { element.raw = url; },
    syncChatOverlayTemplateLinkFromDock: () => { templateSyncCount += 1; },
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
  });

  const importedUrl = new URL(
    `https://socialstream.ninja/dock.html?session=scene-one&darkmode&scale=1.5&cssb64=${encodeURIComponent(encodedCss)}&customfuture=kept`
  );
  const loadedCount = functions.applyImportedGeneratedLink("dock", importedUrl);
  assert.ok(loadedCount >= 5);
  assert.strictEqual(darkmode.checked, true);
  assert.strictEqual(lightmode.checked, false);
  assert.strictEqual(scaleToggle.checked, true);
  assert.strictEqual(scale.value, "1.5");
  assert.strictEqual(staleVolume.value, "30");
  assert.strictEqual(unrelatedRateLimit.value, "9000");
  assert.strictEqual(customCss.value, css);
  assert.strictEqual(staleApiKey.value, "");
  assert.strictEqual(ttsProvider.value, "system");
  assert.strictEqual(staleFont.value, "");
  assert.strictEqual(new URL(dock.raw).searchParams.get("customfuture"), "kept");
  assert.strictEqual(templateSyncCount, 1);
  assert.ok(saved.some((message) => message.setting === "darkmode" && message.value === true));
  assert.ok(saved.some((message) => message.setting === "lightmode" && message.value === false));
  assert.ok(saved.some((message) => message.setting === "cssb64" && message.value === css));
  assert.ok(saved.some((message) => message.setting === "beepvolume" && message.value === "30"));
  assert.ok(!saved.some((message) => message.setting === "ollamaRateLimitPerTab"));
  assert.ok(saved.some((message) => message.setting === "elevenlabskey" && message.value === ""));
  assert.ok(saved.some((message) => message.setting === "font" && message.value === ""));
}

{
  let updatedResponse = null;
  let refreshedPassword = null;
  const { functions } = loadFunctions(["handleSpecialSettings"], {
    chrome: {
      storage: { sync: { set: () => {} } },
      runtime: {
        sendMessage: (message, callback) => {
          assert.strictEqual(message.cmd, "sidUpdated");
          callback({ state: true, cohostCapability: "rotated-capability" });
        },
      },
    },
    refreshGeneratedConnectionLinks: (name, value) => {
      if (name === "password") refreshedPassword = value;
    },
    update: (response) => { updatedResponse = response; },
    log: () => {},
  });
  functions.handleSpecialSettings({ dataset: { special: "password" }, value: "new-password" }, true);
  assert.strictEqual(refreshedPassword, "new-password");
  assert.deepStrictEqual(updatedResponse, { state: true, cohostCapability: "rotated-capability" });
}

{
  const sidUpdatedStart = backgroundSource.indexOf('} else if (request.cmd && request.cmd === "sidUpdated")');
  const sidUpdatedEnd = backgroundSource.indexOf('} else if (request.cmd && request.cmd === "uploadCustomJs")', sidUpdatedStart);
  assert.notStrictEqual(sidUpdatedStart, -1, "sidUpdated handler is missing");
  assert.notStrictEqual(sidUpdatedEnd, -1, "sidUpdated handler end marker is missing");
  const sidUpdatedHandler = backgroundSource.slice(sidUpdatedStart, sidUpdatedEnd);
  assert.ok(
    sidUpdatedHandler.includes("cohostCapability: await getOpenAIRealtimeCohostCapability()"),
    "sidUpdated must return the rotated cohost capability"
  );
  assert.ok(
    !/if\s*\(isSSAPP\)\s*\{\s*sendResponse\(\{\s*state:\s*isExtensionOn\s*\}\)/.test(sidUpdatedHandler),
    "SSApp must not receive a reduced sidUpdated response"
  );
}

assert.ok(popupHtml.includes('data-edit-link="dock"'));
assert.ok(popupHtml.includes('id="dock-edit-status"'));
assert.ok(popupSource.includes('input.value = currentLinkElement && currentLinkElement.raw ? currentLinkElement.raw : "";'));
assert.ok(popupSource.includes("input.select();"));
assert.ok(popupSource.includes("refreshGeneratedConnectionLinks('session', xsx);"));
assert.ok(popupSource.includes("refreshGeneratedConnectionLinks('password', ele.value || '');"));
assert.ok(popupSource.includes("${hideLinks ? \"Click to open link\" : visibleURL}</a>"));
assert.ok(popupSource.includes("setGeneratedLink(existingOverlay, existingOverlay.raw);"));
assert.ok(!popupSource.includes(".wrapper:has(.options_group.single_message)"));

console.log("PASS popup link generation regressions");
