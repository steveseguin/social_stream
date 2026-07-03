const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(repoRoot, "popup.js"), "utf8");

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

console.log("PASS popup TTS language options");
