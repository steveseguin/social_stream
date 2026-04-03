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
    console.log('\n[1] compareProperty supports string equality');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS();

        const youtubeNode = {
            id: 'cmp1',
            triggerType: 'compareProperty',
            config: { property: 'type', operator: 'eq', value: 'youtube' }
        };
        const kofiNode = {
            id: 'cmp2',
            triggerType: 'compareProperty',
            config: { property: 'type', operator: 'eq', value: 'kofi' }
        };

        assert(
            await sys.evaluateTrigger(youtubeNode, { type: 'youtube', hasDonation: '$5.00' }) === true,
            'type = youtube matches YouTube donation events'
        );
        assert(
            await sys.evaluateTrigger(kofiNode, { type: 'youtube', hasDonation: '$5.00' }) === false,
            'type = kofi does not match YouTube events'
        );
        assert(
            await sys.evaluateTrigger(kofiNode, { type: 'kofi', hasDonation: '$3.00' }) === true,
            'type = kofi matches Ko-fi events'
        );
    }

    console.log('\n[2] compareProperty keeps numeric comparisons working');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS();

        const donationNode = {
            id: 'cmp3',
            triggerType: 'compareProperty',
            config: { property: 'donationAmount', operator: 'gte', value: '10' }
        };

        assert(
            await sys.evaluateTrigger(donationNode, { donationAmount: 15 }) === true,
            'numeric gte comparison still matches'
        );
        assert(
            await sys.evaluateTrigger(donationNode, { donationAmount: 5 }) === false,
            'numeric gte comparison still rejects lower values'
        );
    }

    console.log('\n[3] compareProperty does not treat digit-prefixed strings as numbers');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS();

        const exactMatchNode = {
            id: 'cmp4',
            triggerType: 'compareProperty',
            config: { property: 'sourceName', operator: 'eq', value: '123abc' }
        };

        assert(
            await sys.evaluateTrigger(exactMatchNode, { sourceName: '123abc' }) === true,
            'digit-prefixed strings still match exact string equality'
        );
        assert(
            await sys.evaluateTrigger(exactMatchNode, { sourceName: '123xyz' }) === false,
            'digit-prefixed strings no longer match on numeric prefix only'
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
