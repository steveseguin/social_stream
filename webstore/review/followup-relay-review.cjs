'use strict';
// Review-only variants of the existing isolated extension test.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const filename = path.join(__dirname, 'extension-relay.test.cjs');
let source = fs.readFileSync(filename, 'utf8');
const mode = process.argv[2] || 'two-switches';
const proposed = process.argv.includes('--proposed');
if (proposed) {
    const prepared = JSON.parse(fs.readFileSync(path.join(__dirname, 'followup-proposed.json'), 'utf8'));
    source = source.replace("const root = path.resolve(__dirname, '../candidate');", 'const root = ' + JSON.stringify(prepared.isolated_directory) + ';');
}
source = source.replace("console.log('PASS real extension startup, all three server switches, storage and regenerated URLs');", `
        const saved = await popup.evaluate(() => new Promise(resolve => chrome.runtime.sendMessage({cmd:'saveSetting', type:'both', setting:'server2', value:true}, resolve)));
        assert.equal(saved.saved, true, 'Settings success acknowledged after persistence');
        console.log('PASS enabled server switches persist and acknowledge storage');`);
if (mode === 'legacy-settings') {
    source = source.replace('settings.server = false; settings.server2 = false; settings.server3 = false;',
        'settings.server = true; settings.server2 = true; settings.server3 = true;');
    source = source.replace('await openPopup();', `await openPopup();
        const legacy = await popup.evaluate(() => {
            const url = new URL(document.getElementById('docklink').href);
            return ['server', 'server2', 'server3'].map(key => ({
                key,
                checked: document.querySelector('input[data-both="' + key + '"]').checked,
                inDockUrl: url.searchParams.has(key)
            }));
        });
        console.log('LEGACY_BOOLEAN_SETTINGS', JSON.stringify(legacy));
        assert(legacy.every(item => item.checked && item.inDockUrl), 'Legacy flags restored to switches and URL');
        return;`);
} else if (mode === 'two-switches') {
    source = source.replaceAll("['server', 'server2', 'server3']", "['server2', 'server3']");
    source = source.replace("dockUrl.searchParams.set('server', relayUrl);", '');
} else throw Error('Unknown review mode');
const test = new Module(filename, module);
test.filename = filename;
test.paths = Module._nodeModulePaths(__dirname);
test._compile(source, filename);
