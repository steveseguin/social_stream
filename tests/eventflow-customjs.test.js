#!/usr/bin/env node

/**
 * Web Store branch tests for EventFlowSystem custom JS support.
 *
 * The Chrome Web Store build intentionally disables custom JavaScript nodes
 * in every context so the extension package does not ship executable
 * user-supplied dynamic-code paths.
 *
 * Run with: node tests/eventflow-customjs.test.js
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const EFS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'actions', 'EventFlowSystem.js'),
    'utf8'
);

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
        indexedDB: { open: () => ({}) },
        ...globals,
    });

    vm.runInContext(EFS_SRC + '\nwindow.EventFlowSystem = EventFlowSystem;', sandbox);
    return sandbox.window.EventFlowSystem;
}

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

async function runTests() {
    console.log('\n[1] custom JS eval remains disabled in every context');
    const contexts = [
        ['plain browser context', {}, {}],
        ['window.ssapp=true', { ssapp: true }, {}],
        ['window.ninjafy truthy', { ninjafy: {} }, {}],
        ['window.electronApi truthy', { electronApi: {} }, {}],
        ['?ssapp URL param', { location: { search: '?ssapp' } }, {}],
        ['global isSSAPP=true', {}, { isSSAPP: true }],
        ['chrome.runtime present', {}, { chrome: { runtime: { getManifest: () => ({}), sendMessage: () => {} } } }],
    ];

    for (const [label, windowOverrides, globals] of contexts) {
        const EFS = loadEventFlowSystem(windowOverrides, globals);
        const sys = new EFS();
        assert(sys.allowEvalCustomJs === false, `${label}: allowEvalCustomJs is false`);
        assert(sys.customJsEvalSupported === false, `${label}: customJsEvalSupported is false`);
        assert(sys.detectCustomJsEvalSupport() === false, `${label}: detectCustomJsEvalSupport returns false`);
    }

    console.log('\n[2] constructor override cannot re-enable custom JS eval');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sysForce = new EFS({ allowEvalCustomJs: true });
        assert(sysForce.allowEvalCustomJs === false, 'allowEvalCustomJs=true override ignored');
        assert(sysForce.customJsEvalSupported === false, 'customJsEvalSupported remains false');
    }

    console.log('\n[3] custom JS trigger and action are no-ops');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS({ allowEvalCustomJs: true });

        const triggerNode = {
            id: 'trig1',
            triggerType: 'customJs',
            config: { code: 'return true;' }
        };
        const match = await sys.evaluateTrigger(triggerNode, { chatmessage: 'hello', textonly: true });
        assert(match === false, 'customJs trigger returns false');

        const message = { chatmessage: 'hi there' };
        const actionNode = {
            id: 'act1',
            actionType: 'customJs',
            config: { code: 'message.chatmessage = "changed"; return { modified: true, message };' }
        };
        const result = await sys.executeAction(actionNode, message);
        assert(result.modified !== true, 'customJs action does not mark result modified');
        assert(message.chatmessage === 'hi there', 'customJs action does not mutate message');
    }

    console.log(`\n${'-'.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
