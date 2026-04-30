#!/usr/bin/env node

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const EFS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'actions', 'EventFlowSystem.js'),
    'utf8'
);

function makeWindow(overrides = {}) {
    return {
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
    console.log('\n[1] replaceTemplateVars supports dynamic top-level flow fields');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS();

        const rendered = sys.replaceTemplateVars(
            'Wait {counterRemaining}s ({counterValue}/{counterTarget}) for {cooldownLabel}',
            {
                counterValue: 12,
                counterTarget: 30,
                cooldownLabel: 'tts'
            }
        );

        assert(
            rendered === 'Wait 18s (12/30) for tts',
            'dynamic top-level fields and derived counterRemaining render in templates'
        );
    }

    console.log('\n[2] checkCounter exposes remaining time for downstream templates');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS();

        sys.nodeStates.set('counter_1', {
            count: 9,
            targetCount: 30
        });

        const result = await sys.executeAction(
            {
                id: 'action_1',
                actionType: 'checkCounter',
                config: { targetNodeId: 'counter_1' }
            },
            { chatmessage: '!tts hello' }
        );

        assert(result.modified === true, 'checkCounter marks the message as modified');
        assert(result.message.counterValue === 9, 'checkCounter copies counterValue');
        assert(result.message.counterTarget === 30, 'checkCounter copies counterTarget');
        assert(result.message.counterRemaining === 21, 'checkCounter adds counterRemaining');

        const reply = sys.replaceTemplateVars(
            'You have to wait {counterRemaining} seconds to send a tts!',
            result.message
        );
        assert(
            reply === 'You have to wait 21 seconds to send a tts!',
            'sendMessage-style templates can render the remaining cooldown'
        );
    }

    console.log(`\n${'-'.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
