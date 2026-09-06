#!/usr/bin/env node

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const EFS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'actions', 'EventFlowSystem.js'),
    'utf8'
);
const EDITOR_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'actions', 'EventFlowEditor.js'),
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

    console.log('\n[3] native OBS and overlay text actions render counter fields');
    {
        const sent = [];
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS({
            sendTargetP2P: (payload, target) => sent.push({ payload, target })
        });
        const message = {
            chatname: 'Placksa',
            chatmessage: 'hello',
            counterValue: 2,
            counterTarget: 15,
            counterRemaining: 13
        };

        await sys.executeAction({
            id: 'obs_text_1',
            actionType: 'obsSetText',
            config: {
                sourceName: 'Counter Text',
                text: '{username}: now {counterValue}, need {counterTarget}'
            }
        }, message);

        const obsAction = sent.shift();
        assert(obsAction.target === 'actions', 'OBS text is routed to Flow Actions');
        assert(obsAction.payload.overlayNinja.actionType === 'obsSetText', 'OBS text uses the native action type');
        assert(obsAction.payload.overlayNinja.sourceName === 'Counter Text', 'OBS text preserves the source name');
        assert(
            obsAction.payload.overlayNinja.text === 'Placksa: now 2, need 15',
            'OBS text renders counter placeholders'
        );

        await sys.executeAction({
            id: 'show_text_1',
            actionType: 'showText',
            config: {
                text: '{username}: now {counterValue}, need {counterTarget}',
                duration: 0
            }
        }, message);

        const showTextAction = sent.shift().payload.overlayNinja;
        assert(showTextAction.text === 'Placksa: now 2, need 15', 'Show Text renders counter placeholders');
        assert(showTextAction.duration === 0, 'Show Text preserves duration 0');
        assert(showTextAction.textProcessed === true, 'Show Text prevents a second template pass');
    }

    console.log('\n[4] edited counter settings refresh live state');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS();
        sys.nodeStates.set('counter_2', {
            count: 2,
            targetCount: 10,
            resetOnTarget: true,
            mode: 'INCREMENT'
        });

        await sys.evaluateStateNode({
            id: 'counter_2',
            type: 'state',
            stateType: 'COUNTER',
            config: {
                initialCount: 0,
                targetCount: 15,
                resetOnTarget: true,
                mode: 'INCREMENT'
            }
        }, {}, false);

        assert(
            sys.nodeStates.get('counter_2').targetCount === 15,
            'changing a counter target updates the existing counter node'
        );
    }

    console.log('\n[5] OBS media, volume, browser, replay, and media-ended contracts');
    {
        const sent = [];
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS({
            sendTargetP2P: (payload, target) => sent.push({ payload, target })
        });

        await sys.executeAction({
            id: 'obs_media_1',
            actionType: 'obsMediaControl',
            config: { sourceName: 'Intro Video', operation: 'pause' }
        }, {});
        await sys.executeAction({
            id: 'obs_volume_1',
            actionType: 'obsSetVolume',
            config: { sourceName: 'Music', volumeDb: -18.5 }
        }, {});
        await sys.executeAction({
            id: 'obs_browser_1',
            actionType: 'obsRefreshBrowser',
            config: { sourceName: 'Alerts' }
        }, {});
        await sys.executeAction({
            id: 'obs_replay_control_1',
            actionType: 'obsReplayBufferControl',
            config: { operation: 'stop' }
        }, {});

        const actions = sent.map(item => item.payload.overlayNinja);
        assert(sent.every(item => item.target === 'actions'), 'new OBS actions route to Flow Actions');
        assert(
            actions[0].actionType === 'obsMediaControl' && actions[0].sourceName === 'Intro Video' && actions[0].operation === 'pause',
            'media control preserves source and operation'
        );
        assert(
            actions[1].actionType === 'obsSetVolume' && actions[1].sourceName === 'Music' && actions[1].volumeDb === -18.5,
            'volume control sends a numeric dB value'
        );
        assert(
            actions[2].actionType === 'obsRefreshBrowser' && actions[2].sourceName === 'Alerts',
            'browser refresh preserves the source name'
        );
        assert(
            actions[3].actionType === 'obsReplayBufferControl' && actions[3].operation === 'stop',
            'replay buffer control preserves the selected operation'
        );

        const anyMediaEnded = await sys.evaluateTrigger({
            id: 'obs_media_ended_any',
            triggerType: 'obsMediaEnded',
            config: { sourceName: '' }
        }, {
            type: 'obs',
            event: 'media_ended',
            meta: { inputName: 'Intro Video', inputUuid: 'media-uuid' }
        });
        const matchingMediaEnded = await sys.evaluateTrigger({
            id: 'obs_media_ended_match',
            triggerType: 'obsMediaEnded',
            config: { sourceName: 'intro video' }
        }, {
            type: 'obs',
            event: 'media_ended',
            meta: { inputName: 'Intro Video' }
        });
        const otherMediaEnded = await sys.evaluateTrigger({
            id: 'obs_media_ended_other',
            triggerType: 'obsMediaEnded',
            config: { sourceName: 'Outro Video' }
        }, {
            type: 'obs',
            event: 'media_ended',
            meta: { inputName: 'Intro Video' }
        });

        assert(anyMediaEnded === true, 'media-ended trigger supports any OBS media input');
        assert(matchingMediaEnded === true, 'media-ended trigger matches source names case-insensitively');
        assert(otherMediaEnded === false, 'media-ended trigger rejects a different source');
    }

    console.log('\n[6] webhook JSON renders every documented template variable safely');
    {
        const requests = [];
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS({
            fetchWithTimeout: async (url, options) => {
                requests.push({ url, options });
                return {
                    ok: true,
                    status: 204,
                    text: async () => ''
                };
            }
        });
        const specialUsername = 'Erallie "Live"\nBack\\slash';
        const specialMessage = 'Hello "Discord"\nEmoji 😀 and \\path';
        const message = {
            chatname: specialUsername,
            displayname: 'Display Name',
            chatmessage: specialMessage,
            type: 'youtube',
            hasDonation: '$5.00',
            donoValue: 5,
            event: 'cheer',
            membership: 'MEMBERSHIP',
            subtitle: 'Member for 3 months',
            userid: '12345678',
            chatimg: 'https://example.com/avatar.png',
            contentimg: 'https://example.com/content.png',
            rewardTitle: 'Highlight My Message',
            meta: { viewers: 100 },
            counterValue: 12,
            counterTarget: 30,
            customField: 'dynamic value'
        };
        const body = JSON.stringify({
            username: '{username}',
            chatname: '{chatname}',
            message: '{message}',
            chatmessage: '{chatmessage}',
            source: '{source}',
            type: '{type}',
            donation: '{donation}',
            hasDonation: '{hasDonation}',
            displayname: '{displayname}',
            donoValue: '{donoValue}',
            donationAmount: '{donationAmount}',
            event: '{event}',
            membership: '{membership}',
            subtitle: '{subtitle}',
            userid: '{userid}',
            chatimg: '{chatimg}',
            contentimg: '{contentimg}',
            rewardTitle: '{rewardTitle}',
            meta: '{meta}',
            counterValue: '{counterValue}',
            counterTarget: '{counterTarget}',
            counterRemaining: '{counterRemaining}',
            nested: ['{USERNAME}', { dynamic: '{CUSTOMFIELD}', missing: '{missingField}' }]
        });

        await sys.executeAction({
            id: 'webhook_1',
            actionType: 'webhook',
            config: {
                url: 'http://127.0.0.1:9999/webhook',
                method: 'POST',
                body,
                includeMessage: false,
                syncMode: true,
                blockOnFailure: false
            }
        }, message);

        assert(requests.length === 1, 'templated webhook sends one request');
        const rendered = JSON.parse(requests[0].options.body);
        const expected = {
            username: specialUsername,
            chatname: specialUsername,
            message: specialMessage,
            chatmessage: specialMessage,
            source: 'Youtube',
            type: 'youtube',
            donation: '$5.00',
            hasDonation: '$5.00',
            displayname: 'Display Name',
            donoValue: '5',
            donationAmount: '5',
            event: 'cheer',
            membership: 'MEMBERSHIP',
            subtitle: 'Member for 3 months',
            userid: '12345678',
            chatimg: 'https://example.com/avatar.png',
            contentimg: 'https://example.com/content.png',
            rewardTitle: 'Highlight My Message',
            meta: '{"viewers":100}',
            counterValue: '12',
            counterTarget: '30',
            counterRemaining: '18'
        };

        Object.entries(expected).forEach(([key, value]) => {
            assert(rendered[key] === value, `webhook renders {${key}}`);
        });
        assert(rendered.nested[0] === specialUsername, 'webhook variables remain case-insensitive in arrays');
        assert(rendered.nested[1].dynamic === 'dynamic value', 'webhook renders dynamic fields in nested objects');
        assert(rendered.nested[1].missing === '', 'webhook replaces missing fields with an empty string');
    }

    console.log('\n[7] webhook bodies without variables remain byte-for-byte unchanged');
    {
        const requests = [];
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS({
            fetchWithTimeout: async (url, options) => {
                requests.push({ url, options });
                return {
                    ok: true,
                    status: 204,
                    text: async () => ''
                };
            }
        });
        const originalBody = '{\n  "literal": "unchanged \\\\ path"\n}\n';

        await sys.executeAction({
            id: 'webhook_2',
            actionType: 'webhook',
            config: {
                url: 'http://127.0.0.1:9999/webhook',
                method: 'POST',
                body: originalBody,
                includeMessage: false,
                syncMode: true
            }
        }, { chatmessage: 'unused' });

        assert(requests.length === 1, 'non-templated webhook sends one request');
        assert(requests[0].options.body === originalBody, 'non-templated webhook body is unchanged');
    }

    console.log('\n[8] invalid templated webhook JSON fails before fetch');
    {
        const requests = [];
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS({
            fetchWithTimeout: async (url, options) => {
                requests.push({ url, options });
                return {
                    ok: true,
                    status: 204,
                    text: async () => ''
                };
            }
        });

        const result = await sys.executeAction({
            id: 'webhook_3',
            actionType: 'webhook',
            config: {
                url: 'http://127.0.0.1:9999/webhook',
                method: 'POST',
                body: '{"content":"{message}"',
                includeMessage: false,
                syncMode: true,
                blockOnFailure: true
            }
        }, { chatmessage: 'hello' });

        assert(requests.length === 0, 'invalid templated JSON does not call fetch');
        assert(result.modified === true, 'invalid templated JSON attaches an error to the message');
        assert(result.blocked === true, 'invalid templated JSON follows synchronous block-on-failure behavior');
        assert(
            typeof result.message.webhookError === 'string' && result.message.webhookError.startsWith('Invalid custom webhook JSON:'),
            'invalid templated JSON reports a focused webhook error'
        );
    }

    console.log('\n[9] built-in Discord template maps message, username, and avatar fields');
    {
        assert(
            EDITOR_SRC.includes(`body: '{"content": "{message}", "username": "{username}", "avatar_url": "{chatimg}"}'`),
            'Discord template uses the existing message, username, and avatar variables'
        );
    }

    console.log('\n[10] duplicated flows receive independent node IDs');
    {
        const EFS = loadEventFlowSystem({ ssapp: true });
        const sys = new EFS();
        const original = {
            id: 'flow_original',
            name: 'LOSS_CONTROL',
            nodes: [
                { id: 'trigger_1', type: 'trigger', triggerType: 'messageEquals', config: { text: '!loss' } },
                { id: 'counter_1', type: 'state', stateType: 'COUNTER', config: { name: 'LOSSCOUNT' } },
                { id: 'reset_1', type: 'action', actionType: 'setCounter', config: { targetNodeId: 'counter_1', value: 0 } }
            ],
            connections: [
                { from: 'trigger_1', to: 'counter_1' },
                { from: 'counter_1', to: 'reset_1' }
            ]
        };

        sys.flows = [original];
        sys.getFlowById = async id => id === original.id ? original : null;
        sys.saveFlow = async flow => flow;

        const duplicate = await sys.duplicateFlow(original.id);
        const duplicateTrigger = duplicate.nodes.find(node => node.type === 'trigger');
        const duplicateCounter = duplicate.nodes.find(node => node.type === 'state');
        const duplicateReset = duplicate.nodes.find(node => node.actionType === 'setCounter');
        const originalIds = new Set(original.nodes.map(node => node.id));

        assert(
            duplicate.nodes.every(node => !originalIds.has(node.id)),
            'Duplicate Flow regenerates every node ID'
        );
        assert(
            duplicate.connections[0].from === duplicateTrigger.id && duplicate.connections[0].to === duplicateCounter.id &&
                duplicate.connections[1].from === duplicateCounter.id && duplicate.connections[1].to === duplicateReset.id,
            'Duplicate Flow remaps connection endpoints'
        );
        assert(
            duplicateReset.config.targetNodeId === duplicateCounter.id,
            'Duplicate Flow remaps state-node action targets'
        );
        assert(
            original.nodes[2].config.targetNodeId === 'counter_1',
            'duplicating does not mutate the original flow'
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
