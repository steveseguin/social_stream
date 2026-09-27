'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../candidate');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const properties = {innerHTML:''};
const context = vm.createContext({console, window:{}, document:{getElementById: id => id === 'node-properties-content' ? properties : null}});
vm.runInContext(read('actions/EventFlowEditor.js') + '\nglobalThis.Editor = EventFlowEditor;', context);
const editor = Object.create(context.Editor.prototype);
editor.getNodeTitle = () => 'Time of Day';
editor.triggerTypes = [{id:'timeOfDay',name:'Time of Day'}];
editor.addPropertiesEventListeners = () => {};
const attack = '\" autofocus onfocus=alert(1)><img src=x onerror=alert(1)>';
for (const times of [[attack], attack, ['09:00','18:00']]) {
    editor.showNodeProperties({id:'daily',type:'trigger',triggerType:'timeOfDay',config:{times}});
    const attribute = /id="prop-times" value="([^"]*)"/.exec(properties.innerHTML);
    assert(attribute, 'Time field rendered');
    assert.equal(attribute[1], editor.escapeHtml(Array.isArray(times) ? times.join(', ') : times));
    assert(!properties.innerHTML.includes('<img src=x'));
}
const cohost = read('cohost.html');
assert(!/(?:local|session)Storage\.setItem\([^\n]*apiKey/.test(cohost), 'Co-host API keys stay in memory');
assert(!/localStorage\.getItem\([^\n]*apiKey/.test(cohost), 'Old keys are not restored');
assert(cohost.includes('WEBSTORE_DISABLED_COHOST_PROVIDERS'));
assert(read('actions/EventFlowSystem.js').includes('this.allowEvalCustomJs = false'));
console.log('PASS schedule attribute injection, memory-only co-host keys and retained execution restrictions');
