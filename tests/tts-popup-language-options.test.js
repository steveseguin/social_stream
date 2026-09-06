const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");
const ttsJs = fs.readFileSync(path.join(repoRoot, "tts.js"), "utf8");

function includes(haystack, needle) {
  assert.ok(haystack.includes(needle), `Missing expected content: ${needle}`);
}

const sections = [
  { suffix: "", param: "1", numberAttr: "data-numbersetting" },
  { suffix: "2", param: "2", numberAttr: "data-numbersetting2" },
  { suffix: "10", param: "10", numberAttr: "data-numbersetting10" },
  { suffix: "18", param: "18", numberAttr: "data-numbersetting18" },
];

for (const section of sections) {
  includes(popupHtml, `id="piperTTS${section.suffix}"`);
  includes(popupHtml, `id="espeakTTS${section.suffix}"`);
  includes(popupHtml, `data-optionparam${section.param}="pipervoice"`);
  includes(popupHtml, `data-optionparam${section.param}="espeakvoice"`);
  includes(popupHtml, `${section.numberAttr}="piperspeed"`);
  includes(popupHtml, `${section.numberAttr}="espeakspeed"`);
}

for (const voice of [
  "es_ES-davefx-medium",
  "es_MX-ald-medium",
  "pt_BR-faber-medium",
  "pt_BR-edresson-low",
  "pt_PT-tug&#227;o-medium",
  "pt-br",
  "pt-pt",
]) {
  includes(popupHtml, `value="${voice}"`);
}

includes(popupHtml, 'id="ttsProvider18" data-optionparam18="ttsprovider" data-optionsetting18="ttsProvider"');
includes(popupJs, '"piperTTS", "espeakTTS"');
includes(popupJs, '"piperTTS10", "espeakTTS10"');
includes(popupJs, '"piperTTS18", "espeakTTS18"');
includes(popupJs, '`piperTTS${suffix}`, `espeakTTS${suffix}`');
includes(popupJs, 'const getSavedTtsProvider = (paramType) => {');
includes(popupJs, 'const inferTtsProvider = (ttsService, paramNum) => {');
includes(popupJs, 'response.settings.ttsProvider.optionsetting18 = ttsService;');

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notStrictEqual(start, -1, `Missing start marker: ${startMarker}`);
  assert.notStrictEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

function getWindowsVoices() {
  return [
    { name: "Microsoft Zira Desktop - English (United States)", lang: "en-US", default: true },
    { name: "Microsoft Raul - Spanish (Mexico)", lang: "es-MX" },
    { name: "Microsoft Sabina - Spanish (Mexico)", lang: "es-MX" },
    { name: "Microsoft Sabina Desktop - Spanish (Mexico)", lang: "es-MX" },
  ];
}

// Chrome ships one "Google <language>" voice per language, several of which have
// non-Latin names. Matching on "Google" must still respect the requested language.
function getChromeGoogleVoices() {
  return [
    { name: "Google Deutsch", lang: "de-DE" },
    { name: "Google US English", lang: "en-US", default: true },
    { name: "Google UK English Female", lang: "en-GB" },
    { name: "Google UK English Male", lang: "en-GB" },
    { name: "Google español", lang: "es-ES" },
    { name: "Google français", lang: "fr-FR" },
    { name: "Google हिन्दी", lang: "hi-IN" },
    { name: "Google italiano", lang: "it-IT" },
    { name: "Google 日本語", lang: "ja-JP" },
    { name: "Google 한국의", lang: "ko-KR" },
    { name: "Google Nederlands", lang: "nl-NL" },
    { name: "Google русский", lang: "ru-RU" },
    { name: "Google 普通话（中国大陆）", lang: "zh-CN" },
  ];
}

// Older popup builds stored accent-stripped voice ids (popup.js getLegacyPopup-
// SystemVoiceIdentifiers), and those are baked into saved settings and shared
// overlay links, so they still have to resolve.
function getAccentedVoices() {
  return [
    { name: "Google US English", lang: "en-US", default: true },
    { name: "Google français", lang: "fr-FR" },
    { name: "Google español", lang: "es-ES" },
    { name: "Google português do Brasil", lang: "pt-BR" },
    { name: "Google 日本語", lang: "ja-JP" },
    { name: "Amélie", lang: "fr-CA" },
    { name: "Mónica", lang: "es-ES" },
  ];
}

const legacyVoiceId = name => name.replace(/[^a-zA-Z0-9]/g, "");

{
  const context = vm.createContext({ URLSearchParams, encodeURIComponent });
  vm.runInContext(
    sourceBetween(
      popupJs,
      "function normalizePopupSystemVoiceIdentifier",
      "var popupSpeechVoiceCache"
    ),
    context
  );

  const voices = context.createUniqueVoiceIdentifiers(getWindowsVoices());
  const sabina = voices.find((voice) => voice.name === "Microsoft Sabina - Spanish (Mexico)");
  assert.strictEqual(sabina.code, "lang=es-MX&voice=Microsoft%20Sabina%20-%20Spanish%20(Mexico)");

  for (const legacyValue of [
    "lang=es-MX&voice=Microsoft_Sabina__Spanish_Mexico",
    "lang=es-MX&voice=MicrosoftSabinaSpanishMexico",
    "lang=es-MX&voice=Sabina",
  ]) {
    assert.strictEqual(context.resolvePopupSystemVoice(voices, legacyValue).name, sabina.name);
  }
}

{
  const voices = getWindowsVoices();
  const context = vm.createContext({
    TTS: { voices: null },
    window: { speechSynthesis: { getVoices: () => voices } },
  });
  vm.runInContext(
    sourceBetween(ttsJs, "TTS.normalizeSystemVoiceIdentifier", "// Provider settings"),
    context
  );

  const sabina = "Microsoft Sabina - Spanish (Mexico)";
  assert.strictEqual(context.TTS.findSystemVoice(sabina, "es-MX").name, sabina);
  assert.strictEqual(context.TTS.findSystemVoice("Microsoft_Sabina__Spanish_Mexico", "es-MX").name, sabina);
  assert.strictEqual(context.TTS.findSystemVoice("MicrosoftSabinaSpanishMexico", "es-MX").name, sabina);
  assert.strictEqual(context.TTS.findSystemVoice("Sabina", "es-MX").name, sabina);
  assert.strictEqual(
    context.TTS.findSystemVoice("Desktop", "es-MX").name,
    "Microsoft Sabina Desktop - Spanish (Mexico)"
  );
}

{
  // dock.html?voice=Google&lang=en-US must not land on a Japanese voice.
  const voices = getChromeGoogleVoices();
  const context = vm.createContext({
    TTS: { voices: null },
    window: { speechSynthesis: { getVoices: () => voices } },
  });
  vm.runInContext(
    sourceBetween(ttsJs, "TTS.normalizeSystemVoiceIdentifier", "// Provider settings"),
    context
  );

  assert.strictEqual(context.TTS.findSystemVoice("Google", "en-US").name, "Google US English");
  assert.strictEqual(context.TTS.findSystemVoice("google", "en-US").name, "Google US English");
  assert.strictEqual(context.TTS.findSystemVoice("Google", "en-GB").name, "Google UK English Male");
  assert.strictEqual(context.TTS.findSystemVoice("Google", "fr-FR").name, "Google français");
  assert.strictEqual(context.TTS.findSystemVoice("Google", "ja-JP").name, "Google 日本語");
  // An explicit non-Latin voice name still wins over the requested language.
  assert.strictEqual(context.TTS.findSystemVoice("Google 日本語", "en-US").name, "Google 日本語");
  // No Google voice speaks Swedish, so fall back to the default voice rather than
  // to whichever matching name happens to be shortest.
  assert.strictEqual(context.TTS.findSystemVoice("Google", "sv-SE").name, "Google US English");
}

{
  // Accent-stripped legacy ids must still reach their voice, without letting the
  // accent-folding tier bring back the "Google" -> non-Latin collapse.
  const voices = getAccentedVoices();
  const context = vm.createContext({
    TTS: { voices: null },
    window: { speechSynthesis: { getVoices: () => voices } },
  });
  vm.runInContext(
    sourceBetween(ttsJs, "TTS.normalizeSystemVoiceIdentifier", "// Provider settings"),
    context
  );

  for (const [name, lang] of [
    ["Google français", "fr-FR"],
    ["Google español", "es-ES"],
    ["Google português do Brasil", "pt-BR"],
    ["Amélie", "fr-CA"],
    ["Mónica", "es-ES"],
  ]) {
    assert.strictEqual(context.TTS.findSystemVoice(legacyVoiceId(name), lang).name, name);
    // The full name still wins outright, and the legacy id resolves even when the
    // link carries no matching language.
    assert.strictEqual(context.TTS.findSystemVoice(name, lang).name, name);
    assert.ok(context.TTS.findSystemVoice(legacyVoiceId(name), "en-US"));
  }

  assert.strictEqual(context.TTS.findSystemVoice("Google", "en-US").name, "Google US English");
  assert.strictEqual(context.TTS.findSystemVoice("Google", "ja-JP").name, "Google 日本語");
  assert.strictEqual(context.TTS.findSystemVoice("Google", "fr-FR").name, "Google français");
}

{
  const voices = getAccentedVoices();
  const context = vm.createContext({ URLSearchParams, encodeURIComponent });
  vm.runInContext(
    sourceBetween(
      popupJs,
      "function normalizePopupSystemVoiceIdentifier",
      "var popupSpeechVoiceCache"
    ),
    context
  );

  const descriptors = context.createUniqueVoiceIdentifiers(voices);
  for (const [name, lang] of [
    ["Google français", "fr-FR"],
    ["Amélie", "fr-CA"],
    ["Mónica", "es-ES"],
  ]) {
    const selection = `lang=${lang}&voice=${legacyVoiceId(name)}`;
    assert.strictEqual(context.resolvePopupSystemVoice(descriptors, selection).name, name);
  }
  assert.strictEqual(
    context.resolvePopupSystemVoice(descriptors, "lang=en-US&voice=Google").name,
    "Google US English"
  );
}

{
  const voices = getChromeGoogleVoices();
  const context = vm.createContext({ URLSearchParams, encodeURIComponent });
  vm.runInContext(
    sourceBetween(
      popupJs,
      "function normalizePopupSystemVoiceIdentifier",
      "var popupSpeechVoiceCache"
    ),
    context
  );

  const descriptors = context.createUniqueVoiceIdentifiers(voices);
  assert.strictEqual(
    context.resolvePopupSystemVoice(descriptors, "lang=en-US&voice=Google").name,
    "Google US English"
  );
  assert.strictEqual(
    context.resolvePopupSystemVoice(descriptors, "Google", "en-US").name,
    "Google US English"
  );
  assert.strictEqual(
    context.resolvePopupSystemVoice(descriptors, "lang=ja-JP&voice=Google").name,
    "Google 日本語"
  );
}

console.log("PASS popup TTS language options");
