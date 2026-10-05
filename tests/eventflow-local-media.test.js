#!/usr/bin/env node

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'actions', 'EventFlowSystem.js'), 'utf8');

function loadEventFlowSystem() {
    const sandbox = vm.createContext({
        window: {
            location: { search: '' },
            messageStore: {},
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
    vm.runInContext(source + '\nwindow.EventFlowSystem = EventFlowSystem;', sandbox);
    return sandbox.window.EventFlowSystem;
}

async function run() {
    const sent = [];
    const EventFlowSystem = loadEventFlowSystem();
    const system = new EventFlowSystem({
        sendTargetP2P: (payload, target) => sent.push({ payload, target }),
    });

    await system.executeAction({
        id: 'local-media',
        actionType: 'playTenorGiphy',
        config: {
            sourceType: 'local',
            localAssetId: 'asset_video',
            localAssetName: 'Intro Video',
            localMediaType: 'video',
            mediaUrl: 'C:\\private\\must-not-leak.mp4',
            duration: 0,
        },
    }, { textonly: true });

    await system.executeAction({
        id: 'local-audio',
        actionType: 'playAudioClip',
        config: {
            sourceType: 'local',
            localAssetId: 'asset_audio',
            localAssetName: 'Alert Sound',
            audioUrl: 'C:\\private\\must-not-leak.mp3',
            volume: 0.25,
        },
    }, { textonly: true });

    if (sent.length !== 2) throw new Error(`Expected 2 local media payloads, received ${sent.length}.`);
    const media = sent[0].payload.overlayNinja;
    const audio = sent[1].payload.overlayNinja;
    if (sent[0].target !== 'actions' || sent[1].target !== 'actions') throw new Error('Local media was not routed to Flow Actions.');
    if (media.url !== '' || media.localAssetId !== 'asset_video' || media.mediaType !== 'video' || media.duration !== 0) {
        throw new Error('Local video payload did not preserve its opaque asset reference and options.');
    }
    if (audio.audioUrl !== '' || audio.localAssetId !== 'asset_audio' || audio.volume !== 0.25) {
        throw new Error('Local audio payload did not preserve its opaque asset reference and options.');
    }
    if (JSON.stringify(sent).includes('C:\\private')) throw new Error('A private disk path leaked into an action payload.');

    sent.length = 0;
    await system.executeAction({
        id: 'hosted-audio',
        actionType: 'playAudioClip',
        config: { audioUrl: 'https://example.com/alert.mp3', volume: 1 },
    }, { textonly: true });
    const hosted = sent[0].payload.overlayNinja;
    if (hosted.audioUrl !== 'https://example.com/alert.mp3' || hosted.sourceType !== 'url') {
        throw new Error('Existing hosted audio behavior changed.');
    }

    console.log('Event Flow local media payload checks passed.');
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
