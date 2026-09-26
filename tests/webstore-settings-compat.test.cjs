'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const popup = fs.readFileSync(path.join(root, 'popup.js'), 'utf8').replace(/\r\n/g, '\n');
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8').replace(/\r\n/g, '\n');
const legacy = popup.match(/^function processLegacySetting\([^]*?^}/m);
assert(legacy, 'Legacy settings loader is present');
const controls = new Map(['server', 'server2', 'server3'].map(key => [key, {checked:false, dataset:{both:key}}]));
const updates = [];
const menu = vm.createContext({
    document: {querySelector(selector) {
        for (const [key, control] of controls) {
            if (selector.split(',').some(part => part.trim() === "input[data-both='" + key + "']")) return control;
        }
        return null;
    }},
    updateSettings(control, sync) { updates.push({key:control.dataset.both,checked:control.checked,sync}); }
});
vm.runInContext(legacy[0], menu);
for (const [key, control] of controls) {
    menu.processLegacySetting(key, true, false);
    assert.equal(control.checked, true, key + ' restored from legacy true');
    menu.processLegacySetting(key, false, false);
    assert.equal(control.checked, false, key + ' restored from legacy false');
}
assert.equal(updates.length, 6, 'Restored flags reach generated-link updates');
assert(updates.every(update => update.sync === false), 'Loading settings does not resave them');

const saveCommand = background.indexOf('request.cmd === "saveSetting"');
const saveEnd = background.indexOf('// If SDK setting changed', saveCommand);
const saveStart = background.lastIndexOf('chrome.storage.local.set(', saveEnd);
assert(saveCommand > 0 && saveStart > saveCommand && saveEnd > saveStart);
for (const error of [null, {message:'Storage unavailable'}]) {
    let complete;
    const replies = [];
    const settings = {server2:{both:true}};
    const context = vm.createContext({
        settings, isExtensionOn:true,
        chrome: {runtime:{lastError:error}, storage:{local:{set(data, callback) {
            assert.equal(data.settings, settings);
            complete = callback;
        }}}},
        sendResponse(reply) { replies.push(reply); }
    });
    vm.runInContext(background.slice(saveStart,saveEnd), context);
    assert.equal(replies.length, 0, 'No success response before persistence finishes');
    assert.equal(typeof complete, 'function');
    complete();
    assert.equal(replies.length, 1);
    assert.equal(replies[0].saved, !error);
    assert.equal(replies[0].error, error ? error.message : undefined);
}

(async () => {
    let listener, reply;
    const start = background.indexOf('chrome.runtime.onMessage.addListener(function (request, sender, sendResponseReal) {');
    const end = background.indexOf('\n});', start) + 4;
    assert(start > 0 && end > start);
    vm.runInNewContext(background.slice(start,end), {
        console,
        chrome:{runtime:{onMessage:{addListener(callback) {listener=callback;}}}},
        async handleRuntimeMessage(request, sender, respond) {
            await Promise.resolve();
            respond({saved:true});
        }
    });
    assert.equal(listener({}, {}, value => {reply=value;}), true, 'Runtime keeps the reply channel open synchronously');
    assert.equal(reply, undefined);
    await Promise.resolve();
    assert.equal(reply.saved, true);
    console.log('PASS Web Store legacy relay flags, delayed save/error acknowledgements and async response channel');
})().catch(error => {console.error(error);process.exitCode=1;});
