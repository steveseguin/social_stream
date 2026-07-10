const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const popupHtml = fs.readFileSync(path.join(repoRoot, "popup.html"), "utf8");
const ttsJs = fs.readFileSync(path.join(repoRoot, "tts.js"), "utf8");

const volumeSections = [
  { param: "1", numberAttribute: "data-numbersetting" },
  { param: "2", numberAttribute: "data-numbersetting2" },
  { param: "10", numberAttribute: "data-numbersetting10" },
];

for (const section of volumeSections) {
  const sectionPattern = new RegExp(
    `data-param${section.param}="volume"[\\s\\S]*?` +
      `data-translate="system-tts-volume">[^<]*<\\/span>\\s*` +
      `<input[^>]*${section.numberAttribute}="volume"`,
  );
  assert.match(
    popupHtml,
    sectionPattern,
    `TTS volume input for param${section.param} must remain outside translated markup`,
  );
}

const translationsDir = path.join(repoRoot, "translations");
for (const fileName of fs.readdirSync(translationsDir)) {
  if (!fileName.endsWith(".json")) continue;
  const translation = JSON.parse(
    fs.readFileSync(path.join(translationsDir, fileName), "utf8"),
  );
  const volumeLabel = translation.innerHTML?.["system-tts-volume"];
  if (volumeLabel === undefined) continue;
  assert.ok(
    !volumeLabel.includes("<input") && !volumeLabel.includes("data-numbersetting"),
    `${fileName} must translate only the TTS volume label`,
  );
}

assert.ok(ttsJs.includes("TTS.normalizeVolume = function(value)"));
assert.ok(ttsJs.includes("TTS.applyVolume = function(audio)"));
assert.ok(
  ttsJs.includes(
    'TTS.volume = TTS.normalizeVolume(TTS.parseFloatParam(urlParams, "volume", 1));',
  ),
);
assert.ok(!ttsJs.includes("if (TTS.volume)"));

console.log("PASS TTS volume control");
