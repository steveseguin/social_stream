#!/usr/bin/env node

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const EFS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'actions', 'EventFlowSystem.js'),
    'utf8'
);
const CURRENCY_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'currency.js'),
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

    vm.runInContext(CURRENCY_SRC + '\n' + EFS_SRC + '\nwindow.EventFlowSystem = EventFlowSystem;', sandbox);
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

    console.log('\n[4] donation thresholds use explicit values first, then currency conversion');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS();

        const bigDonationNode = {
            id: 'cmp5',
            triggerType: 'compareProperty',
            config: { property: 'donoValue', operator: 'gte', value: '10' }
        };
        const donationEventNode = {
            id: 'donation1',
            triggerType: 'eventDonation',
            config: { minAmount: 0 }
        };
        const donationEventMinNode = {
            id: 'donation2',
            triggerType: 'eventDonation',
            config: { minAmount: 10 }
        };

        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'youtube', event: 'superchat', hasDonation: '$15.00' }) === true,
            'YouTube Super Chat labels can satisfy donation value thresholds'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'twitch', event: 'cheer', hasDonation: '500 bits' }) === false,
            '500 bits converts below a $10 threshold'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'twitch', event: 'cheer', hasDonation: '1500 bits' }) === true,
            '1500 bits converts above a $10 threshold'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'youtube', event: 'jeweldonation', hasDonation: '200 Jewels' }) === false,
            'YouTube Jewels no longer compare as raw jewel counts'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'youtube', event: 'jeweldonation', hasDonation: '200 Jewels', donoValue: 12 }) === true,
            'explicit donoValue still wins over label conversion'
        );
        assert(
            await sys.evaluateTrigger(donationEventNode, { type: 'youtube', event: 'jeweldonation', hasDonation: '200 Jewels' }) === true,
            'jeweldonation matches the specific donation event trigger'
        );
        assert(
            await sys.evaluateTrigger(donationEventMinNode, { type: 'youtube', event: 'jeweldonation', hasDonation: '200 Jewels' }) === false,
            'jeweldonation minAmount uses converted value, not raw jewel count'
        );
        assert(
            await sys.evaluateTrigger(donationEventMinNode, { type: 'youtube', event: 'jeweldonation', hasDonation: '3000 Jewels' }) === true,
            'larger jewel gifts can satisfy converted minAmount thresholds'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '100 unknownunits' }) === false,
            'unknown virtual units use the 100 units = $0.01 fallback'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '100unknownunits' }) === false,
            'unknown virtual units without a separating space use the fallback'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '100 points' }) === false,
            'unknown value-plus-unit labels use the fallback'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '100 cadmium' }) === false,
            'unknown unit labels containing fiat-code prefixes do not match fiat currency codes'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '100 goldfish' }) === false,
            'known virtual-unit names are not matched inside longer words'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '100 kickstarter' }) === false,
            'platform token names are not matched inside longer words'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '100 tokens' }) === false,
            'known virtual value-plus-unit labels convert without raw visible counts'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'twitch', event: 'donation', hasDonation: '100 gifted subs' }) === true,
            'real plural gifted-sub labels still convert after whole-term matching'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '500 Stars' }) === false,
            'known virtual units do not fall through to raw visible counts'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '1500 Stars' }) === true,
            'known virtual units can satisfy thresholds after conversion'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '200000 unknownunits' }) === true,
            'large unknown virtual-unit totals can still satisfy thresholds'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '200000unknownunits' }) === true,
            'large unknown virtual-unit totals without a separating space can still satisfy thresholds'
        );
        assert(
            await sys.evaluateTrigger(bigDonationNode, { type: 'unknownsource', event: 'donation', hasDonation: '200000 Jewels' }) === true,
            'generic jewel labels fall back when no source-specific rate applies'
        );
    }

    console.log('\n[5] OBS system triggers match non-chat OBS payloads');
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

    console.log('\n[6] explicit counter events reach only matching Event Type triggers');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS();
        const likesPayload = { type: 'youtube', event: 'likes_update', meta: 42 };
        const likesNode = {
            id: 'counter1',
            triggerType: 'eventOther',
            config: { eventType: 'likes_update' }
        };
        const viewersNode = {
            id: 'counter2',
            triggerType: 'eventOther',
            config: { eventType: 'viewer_update' }
        };
        const anyMessageNode = {
            id: 'counter3',
            triggerType: 'anyMessage',
            config: {}
        };

        assert(
            sys.isCounterEventPayload(likesPayload) === true,
            'likes_update is recognized as an explicit counter event'
        );
        assert(
            await sys.evaluateTrigger(likesNode, likesPayload) === true,
            'matching Event Type trigger receives likes_update'
        );
        assert(
            await sys.evaluateTrigger(viewersNode, likesPayload) === false,
            'non-matching Event Type trigger rejects likes_update'
        );
        assert(
            await sys.evaluateTrigger(anyMessageNode, likesPayload) === false,
            'counter events do not activate Any Message'
        );
        assert(
            sys.isCounterEventPayload({ event: 'viewer_updates', meta: { youtube: 10 } }) === false,
            'unrecognized meta-only events remain excluded'
        );

        let evaluatedFlows = 0;
        sys.flows = [{ id: 'counter-flow', active: true, nodes: [], connections: [] }];
        sys.evaluateFlow = async (_flow, message) => {
            evaluatedFlows++;
            return { modified: false, message, blocked: false };
        };

        await sys.processMessage(likesPayload);
        assert(
            evaluatedFlows === 1,
            'processMessage allows a recognized counter event into Event Flow'
        );

        evaluatedFlows = 0;
        await sys.processMessage({ event: 'viewer_updates', meta: { youtube: 10 } });
        assert(
            evaluatedFlows === 0,
            'processMessage still skips unrelated meta-only traffic'
        );
    }

    console.log('\n[7] Firefox build includes Event Flow guide documentation');
    {
        const guideHtml = fs.readFileSync(
            path.join(__dirname, '..', 'actions', 'event-flow-guide.html'),
            'utf8'
        );
        const prepareFirefox = fs.readFileSync(
            path.join(__dirname, '..', 'scripts', 'prepare-firefox.sh'),
            'utf8'
        );
        const expectedLinks = [
            '../docs/media-hosting-event-flow.html',
            '../docs/source-types-guide.html#youtube-shorts-event-flow'
        ];

        for (const href of expectedLinks) {
            assert(
                guideHtml.includes(`href="${href}"`),
                `guide links to packaged documentation: ${href}`
            );
        }

        const requiredBuildAssets = [
            'docs/media-hosting-event-flow.html',
            'docs/source-types-guide.html',
            'docs/css/guides.css',
            'docs/images/guides/guide-event-flow-overview.png',
            'docs/images/guides/guide-standalone-source-modes.png',
            'docs/images/kick-channel-points-event-flow/event-flow-media-action-values.png'
        ];
        for (const asset of requiredBuildAssets) {
            assert(
                prepareFirefox.includes(`--include='${asset}'`),
                `Firefox build includes ${asset}`
            );
        }
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
