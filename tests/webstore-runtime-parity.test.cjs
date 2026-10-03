'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const storeRoot = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const readStore = file => fs.readFileSync(storeRoot + '/' + file, 'utf8');
const readBeta = process.argv[3] ? file => fs.readFileSync(path.join(process.argv[3], file), 'utf8') : null;
function extract(source, name, indent = '', closing = indent) {
    const match = source.match(new RegExp('^' + indent + '(?:async )?function ' + name + '\\([^]*?^' + closing + '}', 'm'));
    assert.ok(match, name);
    return match[0];
}
const quiet = {log() {}, warn() {}, error(error) {throw error;}};
async function historyCase(read, enabled, open) {
    const source = read('service_worker.js');
    let opened = 0;
    let forwarded = 0;
    let cleared = 0;
    const backgroundSource = read('background.js');
    const background = vm.createContext({
        console: quiet, loadedFirst: true, isExtensionOn: enabled, settings: {},
        messageStoreDB: {clearMessages: async () => {cleared++; return 2;}},
        sendDataP2P() {}
    });
    vm.runInContext(extract(backgroundSource, 'handleRuntimeMessage'), background);
    if (backgroundSource.includes('function clearSavedMessageHistory(')) {
        vm.runInContext(['isClearHistoryConfirmed', 'clearSavedMessageHistory'].map(name => extract(backgroundSource, name)).join('\n'), background);
    }
    const worker = vm.createContext({
        console: quiet,
        backgroundPageTabIdLoaded: true,
        checkBackgroundPageIsOpen: async () => open,
        getStoredExtensionState: async () => enabled,
        ensureBackgroundPageIsOpen: async () => {opened++;},
        sendMessageToBackgroundPage: (message, reply) => {
            assert.equal(message.data.action, 'clearHistory');
            assert.equal(message.data.value.confirm, true);
            forwarded++;
            background.handleRuntimeMessage(message, {}, reply).catch(error => {throw error;});
        },
        notifyBackgroundRecoveryFailure(error) {throw error;}
    });
    vm.runInContext(['isSettingsRequest', 'isEnableRequest', 'isBackgroundWriteRequest', 'shouldRouteWhileDisabled', 'wrapBackgroundMessage', 'routeBackgroundBoundMessage'].map(name => extract(source, name)).join('\n'), worker);
    const page = vm.createContext({snapshotMode: false, chrome: {runtime: {
        sendMessage(message, reply) {worker.routeBackgroundBoundMessage(message, reply).catch(error => {throw error;});}
    }}});
    vm.runInContext(extract(read('chathistory.js'), 'requestHistoryClear'), page);
    const reply = await page.requestHistoryClear();
    return {enabled, open, opened, forwarded, cleared, reply};
}
class FakeTmiClient {
    constructor() {this.handlers = new Map();}
    on(event, handler) {if (!this.handlers.has(event)) this.handlers.set(event, new Set()); this.handlers.get(event).add(handler);}
    removeListener(event, handler) {this.handlers.get(event)?.delete(handler);}
    emit(event, ...args) {for (const handler of this.handlers.get(event) || []) handler(...args);}
    async connect() {return ['local-fixture'];}
    disconnect() {}
}
async function cheerCase(read, bits) {
    const module = await import('data:text/javascript;base64,' + Buffer.from(read('providers/twitch/chatClient.js')).toString('base64'));
    const fake = new FakeTmiClient();
    const client = module.createTwitchChatClient({channel: 'localfixture', clientFactory: async () => fake, logger: quiet});
    await client.connect();
    let payload;
    client.on('membership', value => {payload = value;});
    fake.emit('cheer', '#localfixture', {username: 'viewer', 'display-name': 'Viewer', bits: String(bits), id: 'fixture-' + bits}, 'Cheer' + bits);
    assert.equal(payload.event, 'cheer');
    assert.equal(payload.bits, bits);
    let emitted;
    const textarea = {appendChild() {}, childNodes: []};
    const context = vm.createContext({
        console: quiet, settings: {textonlymode: true}, channel: 'localfixture', activeSubscriptions: new Set(), pendingTwitchMessages: new Set(),
        noteTwitchChatEcho() {}, getUserInfo: async () => ({display_name: 'Viewer'}),
        getTwitchMessageSourceInfo: async () => ({}), parseBadges: () => [],
        getTranslation: (key, fallback) => fallback, replaceEmotesWithImages: value => value,
        escapeHtml: value => value, rememberTwitchDisplayName() {},
        document: {createElement: () => ({}), querySelector: () => textarea},
        pushMessage(value) {emitted = value;}
    });
    const source = read('sources/websocket/twitch.js');
    vm.runInContext(extract(source, 'normalizeTwitchLogin', '\t'), context);
    vm.runInContext(['formatBitAmount', 'getTwitchMessageText', 'handleNormalizedChatMessage', 'handleNormalizedMembership', 'processMessage'].map(name => extract(source, name, '\t')).join('\n') + '\n' + extract(source, 'convertChatPayloadToLegacyMessage', '\t\t', '\t'), context);
    await context.handleNormalizedMembership(payload);
    assert.equal(emitted.event, 'cheer');
    assert.equal(emitted.donoValue, bits / 100);
    // Exercise each source with its matching Event Flow consumer.
    const flowContext = vm.createContext({console: quiet});
    vm.runInContext(read('actions/EventFlowSystem.js') + '\nglobalThis.flow = Object.create(EventFlowSystem.prototype);', flowContext);
    const matches = {};
    for (const minBits of [0, 50, 150]) {
        matches[minBits] = await flowContext.flow.evaluateTrigger({triggerType: 'eventCheer', config: {sources: ['twitch'], minBits}}, emitted);
    }
    client.destroy();
    return {bits, emittedBits: emitted.meta?.bits ?? emitted.bits ?? null, display: emitted.hasDonation, matches};
}
(async () => {
    const results = {historyUi: {}, history: {}, cheer: {}, likes: {}, instagram: {}};
    const targets = [['webstore', readStore]];
    if (readBeta) targets.push(['beta', readBeta]);
    for (const [label, read] of targets) {
        // Directly invoking the copied request helper does not establish an exposed UI path.
        results.historyUi[label] = {
            hasDeleteButton: /id=["']clear-history["']/.test(read('chathistory.html')),
            hasClickHandler: read('chathistory.js').includes("clearHistoryButton.addEventListener('click', clearSavedHistory)"),
            hasRuntimeHandler: read('background.js').includes('request.action === "clearHistory"')
        };
        results.history[label] = [];
        for (const [enabled, open] of [[false, false], [true, false], [false, true]]) {
            results.history[label].push(await historyCase(read, enabled, open));
        }
        results.cheer[label] = await cheerCase(read, 100);
        results.likes[label] = await likesCase(read);
        results.instagram[label] = await instagramCase(read);
    }
    for (const [label] of targets) {
        assert.equal(results.historyUi[label].hasDeleteButton, true);
        assert.equal(results.history[label][0].forwarded, 1);
        for (const result of results.history[label]) {
            assert.equal(result.cleared, 1);
            assert.equal(result.reply.ok, true);
        }
        assert.equal(results.history[label][1].forwarded, 1);
        assert.equal(results.history[label][2].forwarded, 1);
        assert.equal(results.cheer[label].matches[0], true);
        assert.equal(results.cheer[label].matches[150], false);
        assert.equal(results.cheer[label].matches[50], true);
    }
    if (readBeta) for (const values of Object.values(results)) assert.deepEqual(JSON.parse(JSON.stringify(values.webstore)), JSON.parse(JSON.stringify(values.beta)));
    console.log('PASS: history UI/worker/background on/off, IRC Bits thresholds, like default/off/on routing, Instagram source polling/coordination/deduplication' + (readBeta ? '; results match pinned beta.' : '.'));
})().catch(error => {console.error(error); process.exitCode = 1;});

async function likesCase(read) {
    const background = read('background.js'), output = [], settings = {}, results = [];
    const context = vm.createContext({
        settings, console: quiet, isExtensionOn: true, messageCounter: 0, giveawayHost: false,
        captureLiveStatsFromMessage() {}, captureBackgroundCreditsMessage() {},
        checkIfAllowed: () => true, checkExactDuplicateAlreadyReceived: () => false,
        applyBotActions: async m => m, window: {eventFlowSystem: {processMessage: async m => m}},
        filterXSS: x => x, sendDataP2P: m => output.push('dock'), sendTargetP2P: (m,target) => output.push(target),
        sendToDisk() {}, sendToH2R() {}, sendToPost() {}, sendToDiscord() {}, sendToStreamerBot() {}, addMessageDB: async () => 1
    });
    vm.runInContext(['getSettingFlag','normalizeEventName','isIndividualLikeEvent','isEventBlockedByCustomFilter','routeIndividualLikeEvent','hasTargetedMetaPayload','processIncomingMessage','sendToDestinations'].map(n=>extract(background,n)).join('\n'),context);
    for(const type of ['tiktok','meetme']) for(const enabled of [null,false,true]) {
        if(enabled===null)delete settings.capturelikeevent;else settings.capturelikeevent=enabled?{setting:true}:false;
        output.length=0;
        await context.processIncomingMessage({type,event:'liked',chatname:'Viewer',chatmessage:'liked',textonly:true});
        const result={type,enabled,dock:output.filter(x=>x==='dock').length,reactions:output.filter(x=>x==='reactions').length};
        assert.equal(result.dock,enabled?1:0);assert.equal(result.reactions,1);results.push(result);
    }
    output.length=0;
    settings.hideevents={setting:true};
    await context.processIncomingMessage({type:'tiktok',event:'liked',chatname:'Viewer',chatmessage:'liked',textonly:true});
    assert.equal(output.length,0);
    return results;
}

async function instagramCase(read) {
    const results=[];
    for(const file of ['sources/instagram.js','sources/instagramlive.js']) {
        const background=read('background.js'), source=read(file), emitted=[];
        const context=vm.createContext({console:quiet,loadedFirst:true,isExtensionOn:true,settings:{}});
        const lease=background.slice(background.indexOf('const INSTAGRAM_INBOX_POLLER_LEASE_MS'),background.indexOf('function claimInstagramInboxPoller'));
        vm.runInContext(lease+'\n'+['claimInstagramInboxPoller','filterInstagramInboxStoryKeys','handleRuntimeMessage'].map(n=>extract(background,n)).join('\n'),context);
        let fetches=0,stories=[];
        const page=vm.createContext({
            console:quiet,settings:{textonlymode:true},isExtensionOn:true,notifInboxClaimantId:'fixture',
            getIgUserId:()=>'fixture-account',checkOwnLive(){},canPollNotifInbox:()=>true,igApiHeaders:()=>({}),
            notifInboxState:{polling:false,seen:{},seenOrder:[]},ensureNotifInboxInterval(){},
            handleNotifInboxFailure(){assert.fail('Unexpected Instagram polling failure');},
            escapeHtml:x=>x,pushMessage:m=>emitted.push(m),sendOut:m=>emitted.push(m),
            fetch:async()=>{fetches++;return{ok:true,json:async()=>({status:'ok',new_stories:stories})};},
            chrome:{runtime:{id:'fixture',sendMessage(id,request,reply){context.handleRuntimeMessage(request,{tab:{id:1}},reply).catch(e=>{throw e;});}}}
        });
        vm.runInContext(['claimNotifInboxPolling','filterNotifInboxStories','seenNotifStory','emitNotifStory','pollNotifInbox'].map(n=>extract(source,n,'\t')).join('\n'),page);
        const story=(pk)=>({pk,notif_name:'follow',args:{profile_name:'Viewer',text:'followed',timestamp:1}});
        stories=[story('old')];page.pollNotifInbox();await new Promise(setImmediate);assert.equal(emitted.length,0);
        stories=[story('old'),story('new')];page.pollNotifInbox();await new Promise(setImmediate);assert.equal(emitted.length,1);
        page.pollNotifInbox();await new Promise(setImmediate);assert.equal(emitted.length,1);
        assert.equal(emitted[0].event,'new_follower');assert.equal(context.claimInstagramInboxPoller(2,'second'),false);
        page.isExtensionOn=false;page.pollNotifInbox();await new Promise(setImmediate);assert.equal(fetches,3);
        results.push({file,fetches,emitted:emitted.length,event:emitted[0].event});
    }
    return results;
}
