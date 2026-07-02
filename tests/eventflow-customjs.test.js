#!/usr/bin/env node

/**
 * Tests for EventFlowSystem custom JS eval support.
 *
 * Validates:
 *   1. detectCustomJsEvalSupport() returns correct values in different contexts
 *   2. customJsEvalSupported alias matches allowEvalCustomJs
 *   3. Custom JS trigger executes correctly when allowed
 *   4. Custom JS action executes correctly when allowed
 *   5. Custom JS is blocked (no-op) when allowEvalCustomJs is false
 *
 * Run with: node tests/eventflow-customjs.test.js
 */

const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

// Read once at module load — reused by every loadEventFlowSystem() call
const EFS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'actions', 'EventFlowSystem.js'),
    'utf8'
);

// ---- Minimal stubs required by EventFlowSystem constructor ----
function makeWindow(overrides = {}) {
    return {
        ssapp: undefined,
        ninjafy: undefined,
        electronApi: undefined,
        location: { search: '' },
        sendMessageToTabs: null,
        sendToDestinations: null,
        fetchWithTimeout: null,
        sanitizeRelay: null,
        checkExactDuplicateAlreadyRelayed: null,
        messageStore: {},
        handleMessageStore: null,
        ...overrides,
    };
}

function loadEventFlowSystem(windowOverrides = {}, globals = {}) {
    const sandbox = vm.createContext({
        window: makeWindow(windowOverrides),
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Promise,
        IDBKeyRange: {},
        // Return an object whose callbacks are never invoked — initDatabase hangs
        // silently without creating a rejected promise
        indexedDB: { open: () => ({}) },
        ...globals,
    });

    // class declarations don't auto-attach to the vm global; expose it explicitly
    vm.runInContext(EFS_SRC + '\nwindow.EventFlowSystem = EventFlowSystem;', sandbox);
    return sandbox.window.EventFlowSystem;
}

// ---- Test helpers ----
let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`  PASS  ${label}`);
        passed++;
    } else {
        console.error(`  FAIL  ${label}`);
        failed++;
    }
}

// ---- Test suite ----
async function runTests() {

console.log('\n[1] detectCustomJsEvalSupport — SSApp contexts');
{
    // window.ssapp === true
    const EFS = loadEventFlowSystem({ ssapp: true });
    const sys = new EFS();
    assert(sys.allowEvalCustomJs === true, 'window.ssapp=true → eval allowed');
    assert(sys.customJsEvalSupported === true, 'customJsEvalSupported alias is true');

    // window.ninjafy truthy
    const EFS2 = loadEventFlowSystem({ ninjafy: {} });
    const sys2 = new EFS2();
    assert(sys2.allowEvalCustomJs === true, 'window.ninjafy truthy → eval allowed');
    assert(sys2.customJsEvalSupported === true, 'customJsEvalSupported alias is true (ninjafy)');

    // window.electronApi truthy
    const EFS3 = loadEventFlowSystem({ electronApi: {} });
    const sys3 = new EFS3();
    assert(sys3.allowEvalCustomJs === true, 'window.electronApi truthy → eval allowed');
    assert(sys3.customJsEvalSupported === true, 'customJsEvalSupported alias is true (electronApi)');

    // ?ssapp URL param
    const EFS4 = loadEventFlowSystem({ location: { search: '?ssapp' } });
    const sys4 = new EFS4();
    assert(sys4.allowEvalCustomJs === true, '?ssapp URL param → eval allowed');
    assert(sys4.customJsEvalSupported === true, 'customJsEvalSupported alias is true (?ssapp)');

    // isSSAPP global variable (background.js style)
    const EFS5 = loadEventFlowSystem({}, { isSSAPP: true });
    const sys5 = new EFS5();
    assert(sys5.allowEvalCustomJs === true, 'global isSSAPP=true → eval allowed');
    assert(sys5.customJsEvalSupported === true, 'customJsEvalSupported alias is true (isSSAPP global)');
}

console.log('\n[2] detectCustomJsEvalSupport — Extension context (chrome.runtime present)');
{
    const EFS = loadEventFlowSystem({}, {
        chrome: {
            runtime: {
                getManifest: () => ({}),
                sendMessage: () => {},
            }
        }
    });
    const sys = new EFS();
    assert(sys.allowEvalCustomJs === false, 'chrome.runtime present → eval blocked');
    assert(sys.customJsEvalSupported === false, 'customJsEvalSupported alias is false in extension');
}

console.log('\n[3] options.allowEvalCustomJs override');
{
    const EFS = loadEventFlowSystem({});
    const sysForce = new EFS({ allowEvalCustomJs: true });
    assert(sysForce.allowEvalCustomJs === true, 'options.allowEvalCustomJs=true overrides detection');
    assert(sysForce.customJsEvalSupported === true, 'customJsEvalSupported alias reflects override=true');

    const sysBlock = new EFS({ allowEvalCustomJs: false });
    assert(sysBlock.allowEvalCustomJs === false, 'options.allowEvalCustomJs=false overrides detection');
    assert(sysBlock.customJsEvalSupported === false, 'customJsEvalSupported alias reflects override=false');
}

console.log('\n[4] Custom JS trigger execution (SSApp mode)');
{
    const EFS = loadEventFlowSystem({ ssapp: true });
    const sys = new EFS({ allowEvalCustomJs: true });

    // Node structure: triggerType + config (as used by evaluateTrigger)
    const triggerNode = { id: 'trig1', triggerType: 'customJs', config: { code: 'return message.chatmessage.includes("hello");' } };

    // textonly:true skips the document.createElement HTML-stripping path
    const matchTrue = await sys.evaluateTrigger(triggerNode, { chatmessage: 'hello world', textonly: true });
    assert(matchTrue === true, 'customJs trigger: returns true when code matches');

    const matchFalse = await sys.evaluateTrigger(triggerNode, { chatmessage: 'goodbye', textonly: true });
    assert(matchFalse === false, 'customJs trigger: returns false when code does not match');

    // Syntax error in user code → returns false, does not throw
    const badNode = { id: 'trig1b', triggerType: 'customJs', config: { code: 'return !!!' } };
    const matchError = await sys.evaluateTrigger(badNode, { chatmessage: 'test', textonly: true });
    assert(matchError === false, 'customJs trigger: returns false on syntax error (no crash)');
}

console.log('\n[5] Custom JS action execution (SSApp mode)');
{
    const EFS = loadEventFlowSystem({ ssapp: true });
    const sys = new EFS({ allowEvalCustomJs: true });

    // Node structure: actionType + config (as used by executeAction)
    const message = { chatmessage: 'hi there' };
    const actionNode = { id: 'act1', actionType: 'customJs', config: { code: 'message.chatmessage += " [edited]"; return { modified: true, message };' } };

    const result = await sys.executeAction(actionNode, message);
    assert(result.modified === true, 'customJs action: result.modified set to true');
    assert(message.chatmessage === 'hi there [edited]', 'customJs action: message mutated correctly');
}

console.log('\n[6] Custom JS blocked when allowEvalCustomJs=false');
{
    const EFS = loadEventFlowSystem({}, {
        chrome: { runtime: { getManifest: () => ({}), sendMessage: () => {} } }
    });
    const sys = new EFS({ allowEvalCustomJs: false });

    const triggerNode = { id: 'trig2', triggerType: 'customJs', config: { code: 'return true;' } };
    const matchBlocked = await sys.evaluateTrigger(triggerNode, { chatmessage: 'test', textonly: true });
    assert(matchBlocked === false, 'customJs trigger blocked: returns false when eval disabled');

    const actionNode = { id: 'act2', actionType: 'customJs', config: { code: 'return { blocked: true };' } };
    const result = await sys.executeAction(actionNode, { chatmessage: 'test' });
    // blocked starts as false and action code should NOT have run
    assert(result.blocked === false, 'customJs action blocked: result.blocked unchanged when eval disabled');
}

// ---- Summary ----
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}

} // end runTests

runTests().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
