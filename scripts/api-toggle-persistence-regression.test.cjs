const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const popupSource = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');
const backgroundSource = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const popupHtml = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `Missing function ${name}`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unable to extract function ${name}`);
}

const server2Toggle = { checked: false };
const updated = [];
const sandbox = {
  commaTagInputs: [],
  sourceSelectTagInputs: [],
  document: {
    querySelector(selector) {
      if (selector.includes("input[data-both='server2']")) return server2Toggle;
      return null;
    }
  },
  updateSettings(element, sync) {
    updated.push({ element, sync });
  },
  refreshCommaTagInput() {},
  updateSourceTypeList() {}
};

vm.createContext(sandbox);
vm.runInContext(
  `${extractFunction(popupSource, 'processLegacySetting')}\nthis.processLegacySetting = processLegacySetting;`,
  sandbox
);

sandbox.processLegacySetting('server2', true, false);
assert.strictEqual(server2Toggle.checked, true, 'Legacy server2=true did not populate the visible data-both toggle');
assert.strictEqual(updated.length, 1, 'Legacy server2 state did not update generated links');

const saveSettingStart = backgroundSource.indexOf('request.cmd && request.cmd === "saveSetting"');
assert(saveSettingStart >= 0, 'Background saveSetting handler is missing');
const saveBlockStart = backgroundSource.indexOf('chrome.storage.local.set(', saveSettingStart);
const saveBlockEnd = backgroundSource.indexOf('// If SDK setting changed', saveBlockStart);
const saveBlock = backgroundSource.slice(saveBlockStart, saveBlockEnd);
assert(saveBlock.includes('saved: !storageError'), 'Background does not acknowledge persisted setting state');
assert(saveBlock.includes('sendResponse({'), 'Background responds before confirming setting persistence');
assert(
  popupHtml.includes('Changing the three Dock/API transport toggles updates generated links only.'),
  'Popup does not warn users to reopen saved transport links'
);

console.log('PASS API transport toggles restore legacy state and warn about saved links');
