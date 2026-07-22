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

console.log("PASS popup TTS language options");
