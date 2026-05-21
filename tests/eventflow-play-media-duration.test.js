#!/usr/bin/env node

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const EFS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'actions', 'EventFlowSystem.js'),
    'utf8'
);

function loadEventFlowSystem(windowOverrides = {}, globals = {}) {
    const sandbox = vm.createContext({
        window: {
            location: { search: '' },
            sendMessageToTabs: null,
            sendTargetP2P: null,
            sendToDestinations: null,
            fetchWithTimeout: null,
            sanitizeRelay: null,
            checkExactDuplicateAlreadyRelayed: null,
            messageStore: {},
            handleMessageStore: null,
            ...windowOverrides,
        },
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
    console.log('\n[1] playTenorGiphy preserves explicit duration 0');
    {
        let sentPayload = null;
        const EFS = loadEventFlowSystem();
        const sys = new EFS({
            sendTargetP2P: (payload) => {
                sentPayload = payload;
            },
        });

        await sys.executeAction(
            {
                id: 'media1',
                actionType: 'playTenorGiphy',
                config: {
                    mediaUrl: 'https://giphy.com/embed/X9izlczKyCpmCSZu0l',
                    mediaType: 'iframe',
                    duration: 0,
                },
            },
            { textonly: true }
        );

        assert(sentPayload?.overlayNinja?.duration === 0, 'duration 0 is sent as 0 (manual close)');
    }

    console.log('\n[2] playTenorGiphy keeps default duration when not configured');
    {
        let sentPayload = null;
        const EFS = loadEventFlowSystem();
        const sys = new EFS({
            sendTargetP2P: (payload) => {
                sentPayload = payload;
            },
        });

        await sys.executeAction(
            {
                id: 'media2',
                actionType: 'playTenorGiphy',
                config: {
                    mediaUrl: 'https://giphy.com/embed/X9izlczKyCpmCSZu0l',
                    mediaType: 'iframe',
                },
            },
            { textonly: true }
        );

        assert(sentPayload?.overlayNinja?.duration === 10000, 'undefined duration falls back to 10000ms');
    }

    console.log(`\n${'-'.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
