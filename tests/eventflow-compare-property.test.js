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

    console.log('\n[4] OBS system triggers match non-chat OBS payloads');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS();

        const obsStartedNode = {
            id: 'obs1',
            triggerType: 'obsStreamStarted',
            config: {}
        };
        const obsStoppedNode = {
            id: 'obs2',
            triggerType: 'obsStreamStopped',
            config: {}
        };
        const anyMessageNode = {
            id: 'obs3',
            triggerType: 'anyMessage',
            config: {}
        };
        const obsRecordingStartedNode = {
            id: 'obs4',
            triggerType: 'obsRecordingStarted',
            config: {}
        };
        const obsRecordingStoppedNode = {
            id: 'obs5',
            triggerType: 'obsRecordingStopped',
            config: {}
        };
        const obsSceneChangedNode = {
            id: 'obs6',
            triggerType: 'obsSceneChanged',
            config: {}
        };
        const obsReplaybufferSavedNode = {
            id: 'obs7',
            triggerType: 'obsReplaybufferSaved',
            config: {}
        };
        const startedPayload = {
            type: 'obs',
            event: 'stream_started',
            meta: { source: 'obs-websocket', obsEvent: 'StreamStateChanged', outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' }
        };

        assert(
            sys.isMetaOnlyPayload(startedPayload) === false,
            'OBS system payloads are allowed through Event Flow'
        );
        assert(
            !('chatname' in startedPayload) && !('chatmessage' in startedPayload) && Object.keys(startedPayload.meta).join('|') === 'source|obsEvent|outputState',
            'OBS payloads do not use chat fields or extra marker fields'
        );
        assert(
            await sys.evaluateTrigger(obsStartedNode, startedPayload) === true,
            'OBS stream started trigger matches stream_started'
        );
        assert(
            await sys.evaluateTrigger(obsStoppedNode, { type: 'obs', event: 'stream_stopped', meta: { source: 'obs-browser-source', obsEvent: 'obsStreamingStopped' } }) === true,
            'OBS stream stopped trigger matches stream_stopped'
        );
        assert(
            await sys.evaluateTrigger(obsRecordingStartedNode, { type: 'obs', event: 'recording_started', meta: { obsEvent: 'RecordStateChanged' } }) === true,
            'OBS recording started trigger matches recording_started'
        );
        assert(
            await sys.evaluateTrigger(obsRecordingStoppedNode, { type: 'obs', event: 'recording_stopped', meta: { obsEvent: 'obsRecordingStopped' } }) === true,
            'OBS recording stopped trigger matches recording_stopped'
        );
        assert(
            await sys.evaluateTrigger(obsSceneChangedNode, { type: 'obs', event: 'scene_changed', meta: { sceneName: 'Main' } }) === true,
            'OBS scene changed trigger matches scene_changed'
        );
        assert(
            await sys.evaluateTrigger(obsReplaybufferSavedNode, { type: 'obs', event: 'replay_buffer_saved', meta: { savedReplayPath: 'clip.mkv' } }) === true,
            'OBS replay buffer saved trigger matches replay_buffer_saved'
        );
        assert(
            await sys.evaluateTrigger(obsStartedNode, { type: 'twitch', event: 'stream_online' }) === false,
            'OBS trigger does not match platform stream_online events'
        );
        assert(
            await sys.evaluateTrigger(anyMessageNode, startedPayload) === false,
            'OBS system payloads do not trigger Any Message'
        );
        assert(
            sys.isMetaOnlyPayload({ event: 'viewer_updates', meta: { youtube: 10 } }) === true,
            'ordinary meta-only payloads are still ignored'
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
