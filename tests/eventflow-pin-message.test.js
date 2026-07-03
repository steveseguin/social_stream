#!/usr/bin/env node

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const EFS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'actions', 'EventFlowSystem.js'),
    'utf8'
);

function loadEventFlowSystem(windowOverrides = {}) {
    const sandbox = vm.createContext({
        window: {
            location: { search: '' },
            sendMessageToTabs: null,
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
    console.log('\n[1] pinMessage marks incoming message and sends dock pin command');
    {
        const targeted = [];
        const EFS = loadEventFlowSystem({
            sendTargetP2P: (payload, target) => {
                targeted.push({ payload, target });
            },
            sendToDestinations: async () => {
                throw new Error('pin should not use chat fan-out');
            }
        });
        const sys = new EFS();
        const result = await sys.executeAction(
            { id: 'pin1', actionType: 'pinMessage', config: { mode: 'pin', messageId: '{id}' } },
            { id: 12345, chatname: 'Inky', chatmessage: 'pin this', type: 'whatnot' }
        );

        assert(result.modified === true, 'pin action modifies the message');
        assert(result.message.meta && result.message.meta.pinned === true, 'pin action sets meta.pinned');
        assert(targeted.length === 1, 'pin action sends one dock command');
        assert(targeted[0].target === 'dock', 'pin action uses the dock P2P label');
        assert(JSON.stringify(targeted[0].payload) === JSON.stringify({ action: 'pin', value: 12345 }), 'pin command matches dock pin API');
    }

    console.log('\n[2] pinMessage can scope pinned metadata to a dock label');
    {
        const targeted = [];
        const EFS = loadEventFlowSystem({
            sendTargetP2P: (payload, target) => {
                targeted.push({ payload, target });
            },
            sendToDestinations: async () => {
                throw new Error('targeted pin should not broadcast');
            }
        });
        const sys = new EFS();
        const result = await sys.executeAction(
            { id: 'pinTarget', actionType: 'pinMessage', config: { mode: 'pin', messageId: '{id}', target: 'moderator-dock' } },
            { id: 'abc123', chatname: 'Inky', chatmessage: 'pin only one dock', type: 'whatnot' }
        );

        assert(result.modified === true, 'targeted pin action modifies the message');
        assert(result.message.meta && result.message.meta.pinned === true, 'targeted pin action sets meta.pinned');
        assert(result.message.meta && result.message.meta.pinnedTarget === 'moderator-dock', 'targeted pin action records the dock label');
        assert(targeted.length === 1, 'targeted pin sends one direct dock command');
        assert(targeted[0].target === 'dock', 'targeted pin command uses the dock P2P label');
        assert(JSON.stringify(targeted[0].payload) === JSON.stringify({ action: 'pin', value: 'abc123', target: 'moderator-dock' }), 'targeted pin command matches dock pin API');
    }

    console.log('\n[3] pinMessage custom IDs do not pin the trigger row');
    {
        const targeted = [];
        const EFS = loadEventFlowSystem({
            sendTargetP2P: (payload, target) => {
                targeted.push({ payload, target });
            },
            sendToDestinations: async () => {
                throw new Error('custom ID pin should not use chat fan-out');
            }
        });
        const sys = new EFS();
        const result = await sys.executeAction(
            { id: 'pinCustomId', actionType: 'pinMessage', config: { mode: 'pin', messageId: 'existing-row-1' } },
            { id: 'trigger-row-1', chatname: 'Inky', chatmessage: 'pin another row', type: 'whatnot' }
        );

        assert(result.modified === false, 'custom ID pin does not modify the triggering message');
        assert(!(result.message.meta && result.message.meta.pinned === true), 'custom ID pin does not set meta.pinned on the trigger row');
        assert(targeted.length === 1, 'custom ID pin sends one dock command');
        assert(targeted[0].target === 'dock', 'custom ID pin uses the dock P2P label');
        assert(JSON.stringify(targeted[0].payload) === JSON.stringify({ action: 'pin', value: 'existing-row-1' }), 'custom ID pin command targets the requested row');
    }

    console.log('\n[4] pinMessage unpin sends dock unpin command');
    {
        const targeted = [];
        const EFS = loadEventFlowSystem({
            sendTargetP2P: (payload, target) => {
                targeted.push({ payload, target });
            },
            sendToDestinations: async () => {
                throw new Error('unpin should not use chat fan-out');
            }
        });
        const sys = new EFS();
        const result = await sys.executeAction(
            { id: 'pin2', actionType: 'pinMessage', config: { mode: 'unpin', messageId: '{id}' } },
            { id: 67890, chatname: 'Inky', chatmessage: 'unpin this', type: 'whatnot', meta: { pinned: true, pinnedTarget: 'moderator-dock' } }
        );

        assert(result.modified === true, 'unpin action modifies the message');
        assert(result.message.meta && result.message.meta.pinned === false, 'unpin action clears meta.pinned');
        assert(!('pinnedTarget' in result.message.meta), 'unpin action clears stale meta.pinnedTarget');
        assert(targeted[0].target === 'dock', 'unpin action uses the dock P2P label');
        assert(JSON.stringify(targeted[0].payload) === JSON.stringify({ action: 'unpin', value: 67890 }), 'unpin command matches dock unpin API');
    }

    console.log('\n[5] pinMessage can feature next pinned row');
    {
        const targeted = [];
        const EFS = loadEventFlowSystem({
            sendTargetP2P: (payload, target) => {
                targeted.push({ payload, target });
            },
            sendToDestinations: async () => {
                throw new Error('nextPinned should not use chat fan-out');
            }
        });
        const sys = new EFS();
        const result = await sys.executeAction(
            { id: 'pin3', actionType: 'pinMessage', config: { mode: 'nextPinned' } },
            { id: 1, chatmessage: 'ignored' }
        );

        assert(result.modified === false, 'nextPinned does not modify the message');
        assert(targeted[0].target === 'dock', 'nextPinned uses the dock P2P label');
        assert(JSON.stringify(targeted[0].payload) === JSON.stringify({ action: 'nextPinned' }), 'nextPinned command matches dock API');
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
