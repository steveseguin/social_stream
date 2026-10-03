'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'sources/static/twitch_points.js'), 'utf8');
function extractFunction(name) {
    const match = background.match(new RegExp('^(?:async )?function ' + name + '\\([^]*?^}', 'm'));
    assert.ok(match, name + ' exists');
    return match[0];
}

const settings = {};
const outputs = [];
const automationEvents = [];
const errors = [];
const quietConsole = {log() {}, warn(error) {errors.push(error);}, error(error) {errors.push(error);}};
const record = target => message => outputs.push({target, message: JSON.parse(JSON.stringify(message))});
const context = vm.createContext({
    settings, console: quietConsole, isExtensionOn: true, messageCounter: 0,
    captureLiveStatsFromMessage() {}, captureBackgroundCreditsMessage() {}, giveawayHost: false,
    checkIfAllowed: () => true,
    checkExactDuplicateAlreadyReceived: () => false,
    noteTabActivity() {},
    applyBotActions: async message => message,
    window: {eventFlowSystem: {async processMessage(message) {
        automationEvents.push(message.event);
        return message;
    }}},
    filterXSS: value => value,
    sendDataP2P: record('dock'),
    sendTargetP2P: record('target'),
    sendToDisk: record('disk'), sendToH2R: record('h2r'),
    sendToPost: record('post'), sendToDiscord: record('discord'),
    sendToStreamerBot: record('streamerbot'),
    addMessageDB: async message => {record('history')(message); return 1;}
});
vm.runInContext([
    extractFunction('getSettingFlag'),
    extractFunction('normalizeEventName'),
    extractFunction('isIndividualLikeEvent'),
    extractFunction('isEventBlockedByCustomFilter'),
    extractFunction('routeIndividualLikeEvent'),
    extractFunction('hasTargetedMetaPayload'),
    extractFunction('processIncomingMessage'),
    extractFunction('sendToDestinations')
].join('\n'), context);

const document = new EventTarget();
document.body = new EventTarget();
const mainVideo = new EventTarget();
const adVideo = new EventTarget();
document.querySelectorAll = selector => selector === 'video' ? [mainVideo, adVideo] : [];
let adPlaying = false;
let observeAd;
document.querySelector = selector => selector.includes('video-ad-label') ? (adPlaying ? {} : null) : selector === 'video[id]' ? mainVideo : selector === 'video:not([id])' ? adVideo : null;
const helperMessages = [];
vm.runInNewContext(helper, {
    document, console: quietConsole, MutationObserver: class { constructor(callback) {observeAd = callback;} observe() {} },
    chrome: {runtime: {id: 'local-test', onMessage: {addListener() {}},
        sendMessage(id, request, callback) {
            if (request.getSettings) callback({settings: {twichadannounce: true}});
            if (request.message) helperMessages.push(JSON.parse(JSON.stringify(request.message)));
        }
    }}
});
document.dispatchEvent(new Event('DOMContentLoaded'));
for (let count = 0; count < 3; count += 1) adVideo.dispatchEvent(new Event('play'));
adVideo.dispatchEvent(new Event('abort'));
assert.equal(helperMessages.length, 0, 'Ordinary video events do not establish an ad');
adPlaying = true;
for (let count = 0; count < 3; count += 1) observeAd();
adPlaying = false;
observeAd();
assert.equal(helperMessages.length, 2, 'The actual helper emits one start and one stop for confirmed ad UI');

async function incoming(message) {
    await context.processIncomingMessage(JSON.parse(JSON.stringify(message)));
}

(async () => {
    for (const message of helperMessages) await incoming(message);
    assert.equal(outputs.length, 0, 'Default-off ad announcements must not reach overlays or other destinations');
    assert.equal(automationEvents.length, 2, 'Incoming ad events still reach Event Flow before announcement filtering');

    for (const enabledValue of [{setting: true}, true]) {
        settings.twichadannounce = enabledValue;
        outputs.length = 0;
        for (const message of helperMessages) await incoming(message);
        assert.equal(outputs.filter(output => output.target === 'dock').length, 2, 'Enabled announcements reach Dock once per incoming event');
    }

    delete settings.twichadannounce;
    outputs.length = 0;
    await incoming(helperMessages[0]);
    assert.equal(outputs.length, 0, 'Disabling announcements takes effect without restarting capture');

    for (const event of ['ad_break', 'ad_request', 'ad_schedule']) {
        outputs.length = 0;
        await incoming({type: 'twitch', event, chatmessage: 'Ad status', textonly: true, meta: {length: 30}});
        assert.equal(outputs.length, 0, event + ' is blocked with announcements off');
        settings.twichadannounce = {setting: true};
        await incoming({type: 'twitch', event, chatmessage: 'Ad status', textonly: true, meta: {length: 30}});
        assert.equal(outputs.filter(output => output.target === 'dock').length, 1, event + ' is allowed with announcements on');
        delete settings.twichadannounce;
    }

    for (const message of [
        {type: 'twitch', chatname: 'Viewer', chatmessage: 'Hello', textonly: true},
        {type: 'twitch', event: 'new_follower', chatname: 'Viewer', chatmessage: 'Followed', textonly: true},
        {type: 'kick', event: 'ad_break', chatmessage: 'Other source event', textonly: true}
    ]) {
        outputs.length = 0;
        await incoming(message);
        assert.equal(outputs.filter(output => output.target === 'dock').length, 1, 'Unrelated messages keep their existing routing');
    }
    assert.deepEqual(errors, [], 'Production paths complete without errors');
    console.log('PASS Web Store Twitch ad default/off/on states, live changes, helper/API events, Event Flow and unrelated routing');
})().catch(error => {console.error(error); process.exitCode = 1;});
