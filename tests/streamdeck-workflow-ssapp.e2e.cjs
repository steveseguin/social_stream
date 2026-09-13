'use strict';
// Explicit opt-in SSApp test: hidden windows, isolated profile, loopback fixtures.
// SSN_STREAMDECK_BUNDLE must name a freshly built plugin. No installed profile is edited.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { _electron } = require('playwright');
const root = path.resolve(__dirname, '..');
const ssapp = process.env.SSAPP_REPO || path.resolve(root, '../ssapp');
const { WebSocketServer, WebSocket } = require(path.join(ssapp, 'node_modules/ws'));
const bundle = process.env.SSN_STREAMDECK_BUNDLE;
assert(bundle && fs.existsSync(path.join(bundle, 'bin/plugin.js')), 'Set SSN_STREAMDECK_BUNDLE to a freshly built plugin');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'ssn-workflow-e2e-'));
const session = 'workflowfixture' + Date.now();
const liveTransports = process.argv.includes('--live-transports');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(predicate, label, ms = 20000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { const value = await predicate(); if (value) return value; await delay(50); }
    throw new Error('Timed out: ' + label);
}
const received = [], wire = [], events = [], cleanup = [];
let app, plugin, deckSocket;
async function run() {
    console.log('Workflow test artifacts: ' + output);
    const receiver = http.createServer(async (request, response) => {
        let body = ''; for await (const chunk of request) body += chunk;
        received.push({ url: request.url, body: JSON.parse(body || '{}') });
        response.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        response.end('{"received":true}');
    });
    await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve));
    cleanup.push(() => new Promise(resolve => receiver.close(resolve)));
    const endpoint = 'http://127.0.0.1:' + receiver.address().port;
    const relay = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    await new Promise(resolve => relay.once('listening', resolve));
    cleanup.push(() => { for (const socket of relay.clients) socket.terminate(); relay.close(); });
    relay.on('connection', socket => socket.on('message', raw => {
        const packet = JSON.parse(raw); wire.push(packet);
        if (packet.join) { socket.room = packet.join; socket.input = packet.in; socket.output = packet.out; return; }
        for (const peer of relay.clients) {
            if (peer !== socket && peer.readyState === WebSocket.OPEN && peer.room === socket.room && peer.input === (packet.out || socket.output)) peer.send(raw.toString());
        }
    }));
    const relayURL = 'ws://127.0.0.1:' + relay.address().port + '/api';
    const deck = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    await new Promise(resolve => deck.once('listening', resolve));
    cleanup.push(() => { for (const socket of deck.clients) socket.terminate(); deck.close(); });
    const globals = { sessionId: session, transport: 'websocket', apiHost: '127.0.0.1:' + relay.address().port, useTls: false, httpFallback: false, inChannel: 2, outChannel: 1, requestTimeoutMs: 3000 };
    deck.on('connection', socket => {
        deckSocket = socket;
        socket.on('message', raw => {
            const packet = JSON.parse(raw); events.push(packet);
            if (packet.event === 'getGlobalSettings') socket.send(JSON.stringify({ event: 'didReceiveGlobalSettings', context: packet.context, payload: { settings: globals } }));
        });
    });
    fs.writeFileSync(path.join(output, 'savedSync.json'), JSON.stringify({ streamID: session, password: 'false', state: false, settings: {}, wsServer: false }));
    const wrapper = path.join(output, 'bootstrap.cjs');
    const allowedHosts = ['127.0.0.1', ...(liveTransports ? ['io.socialstream.ninja', 'wss.socialstream.ninja'] : [])];
    fs.writeFileSync(wrapper, `const {app}=require('electron');app.setAppPath(${JSON.stringify(ssapp)});app.on('session-created',s=>s.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(d,cb)=>cb({cancel:!${JSON.stringify(allowedHosts)}.includes(new URL(d.url).hostname)})));require(${JSON.stringify(path.join(ssapp, 'bootstrap.js'))});`);
    app = await _electron.launch({ executablePath: require(path.join(ssapp, 'node_modules/electron')), cwd: ssapp,
        args: [wrapper, '--running-from-source', '--multiinstance', '--ssapp-headless-control', '--filesource', pathToFileURL(root + path.sep).href],
        env: { ...process.env, SSAPP_USER_DATA_DIR: output, SSAPP_DIAGNOSTICS_SAFE_GPU: '1' } });
    cleanup.push(() => app.close());
    const main = await app.firstWindow();
    await main.waitForFunction(() => !!document.getElementById('frame2')?.contentWindow?.eventFlowSystem, null, { timeout: 60000 });
    await delay(6000);
    const bg = main.frames().find(frame => frame.url().includes('background.html'));
    assert(bg, 'Real Social Stream background');
    await bg.evaluate(({ relayURL, session }) => {
        if (socketserver) { socketserver.onclose = null; socketserver.close(); }
        socketserver = false; serverURL = relayURL; streamID = session; password = false;
        isExtensionOn = true; settings.socketserver = true; settings.disablehost = false;
        setupSocket();
    }, { relayURL, session });
    await main.evaluate(() => document.querySelector('[data-page="event-flow-editor"]').click());
    await bg.waitForFunction(() => !!window.flowEditor);
    // Use the shipped starter template, then edit and save its real node properties.
    await bg.evaluate(async () => { await flowEditor.loadTemplate('streamdeck-workflow'); });
    const flowId = await bg.evaluate(() => flowEditor.currentFlow.id);
    assert.equal(await bg.evaluate(() => flowEditor.currentFlow.active), false);
    assert.equal(await bg.evaluate(() => eventFlowSystem.getWorkflowTriggers().length), 0);
    await bg.evaluate(() => flowEditor.selectNode(flowEditor.currentFlow.nodes.find(node => node.triggerType === 'apiTrigger').id));
    await bg.locator('#prop-trigger').fill('fixture.run');
    await bg.locator('#prop-trigger').dispatchEvent('change');
    await bg.evaluate(async ({ endpoint }) => {
        const flow = flowEditor.currentFlow;
        flow.name = 'Workflow fixture'; flow.active = true;
        const action = flow.nodes.find(node => node.type === 'action');
        action.actionType = 'webhook';
        action.config = { url: endpoint + '/workflow', method: 'POST', includeMessage: false, syncMode: true, body: '{"label":"{meta.workflow.data.label}","minutes":"{meta.workflow.data.minutes}"}' };
        await flowEditor.saveCurrentFlow();
        await flowEditor.loadFlow(flow.id);
    }, { endpoint });
    assert.equal(await bg.evaluate(() => flowEditor.currentFlow.nodes.find(node => node.triggerType === 'apiTrigger').config.trigger), 'fixture.run');
    await bg.evaluate(async ({ endpoint }) => {
        await eventFlowSystem.saveFlow({ id: 'unrelated', name: 'Unrelated chat', active: true, nodes: [
            { id: 'u1', type: 'trigger', triggerType: 'anyMessage', config: {} },
            { id: 'u2', type: 'action', actionType: 'webhook', config: { url: endpoint + '/unrelated', method: 'POST', body: '{}', includeMessage: false, syncMode: true } }
        ], connections: [{ from: 'u1', to: 'u2' }] });
    }, { endpoint });
    console.log('PASS actual editor template, trigger property, save/reload, disabled-by-default');
    // Newly added volume actions must save the value shown before touching the slider.
    await bg.evaluate(() => {
        flowEditor.createNode('action', 'spotifyVolume', 600, 50);
        flowEditor.createNode('action', 'ttsVolume', 600, 250);
    });
    assert.equal(await bg.evaluate(() => flowEditor.currentFlow.nodes.find(node => node.actionType === 'spotifyVolume').config.volume), 50);
    assert.equal(await bg.evaluate(() => flowEditor.currentFlow.nodes.find(node => node.actionType === 'ttsVolume').config.volume), 100);
    await bg.evaluate(() => flowEditor.selectNode(flowEditor.currentFlow.nodes.find(node => node.actionType === 'spotifyVolume').id));
    await bg.locator('#prop-volume').evaluate(input => { input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await bg.locator('#prop-volume').dispatchEvent('change');
    await bg.evaluate(async () => { await flowEditor.saveCurrentFlow(); await flowEditor.loadFlow(flowEditor.currentFlow.id); flowEditor.selectNode(flowEditor.currentFlow.nodes.find(node => node.actionType === 'spotifyVolume').id); });
    assert.equal(await bg.locator('#prop-volume').inputValue(), '0');
    console.log('PASS volume-node defaults persist and Spotify zero survives editor save/reload (no provider playback changed)');
    const info = { application: { font: 'Segoe UI', language: 'en', platform: 'windows', platformVersion: '10.0.0', version: '7.5.0' }, colors: {}, devicePixelRatio: 2, devices: [{ id: 'qa-deck', name: 'Workflow QA', size: { columns: 5, rows: 3 }, type: 0 }], plugin: { uuid: 'ninja.socialstream.streamdeck', version: '0.2.4.0' } };
    plugin = spawn(process.execPath, [path.join(bundle, 'bin/plugin.js'), '-port', String(deck.address().port), '-pluginUUID', 'workflow-qa', '-registerEvent', 'registerPlugin', '-info', JSON.stringify(info)], { cwd: bundle, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    cleanup.push(() => plugin.kill());
    plugin.stderr.on('data', chunk => fs.appendFileSync(path.join(output, 'plugin.stderr'), chunk));
    await wait(() => wire.find(packet => packet.callback?.result?.ssn?.actions?.triggerWorkflow), 'capability discovery');
    let index = 0;
    async function press(command, value, success = true) {
        const context = 'workflow-key-' + (++index), offset = wire.length;
        const event = { action: 'ninja.socialstream.streamdeck.command', context, device: 'qa-deck', payload: { controller: 'Keypad', coordinates: { column: 0, row: 0 }, isInMultiAction: false, resources: {}, state: 0, settings: { command, value: JSON.stringify(value), awaitResponse: true } } };
        deckSocket.send(JSON.stringify({ ...event, event: 'willAppear' }));
        await wait(() => events.find(packet => packet.context === context && packet.event === 'setTitle'), 'key title');
        deckSocket.send(JSON.stringify({ ...event, event: 'keyDown' }));
        const feedback = await wait(() => events.find(packet => packet.context === context && ['showOk', 'showAlert'].includes(packet.event)), 'key feedback');
        assert.equal(feedback.event, success ? 'showOk' : 'showAlert');
        const request = wire.slice(offset).find(packet => packet.action === command);
        const response = wire.slice(offset).find(packet => packet.callback?.get === request?.get)?.callback.result;
        return { context, response };
    }
    const list = await press('getWorkflowTriggers');
    assert.equal(list.response.payload.triggers.length, 1);
    await wait(() => events.find(packet => packet.context === list.context && packet.event === 'setTitle' && packet.payload.title.includes('1')), 'workflow count on key');
    const started = await press('triggerWorkflow', { trigger: 'fixture.run', flowId, data: { label: 'Deck button', minutes: 5 } });
    assert.equal(started.response.status, 'accepted');
    await wait(() => received.length === 1, 'real webhook from plugin key');
    assert.deepEqual(received[0], { url: '/workflow', body: { label: 'Deck button', minutes: '5' } });
    for (let n = 0; n < 3; n++) await press('triggerWorkflow', { trigger: 'fixture.run', flowId, data: { label: 'Repeat ' + n, minutes: n } });
    await wait(() => received.length === 4, 'three repeated workflow runs');
    assert(received.every(item => item.url === '/workflow'), 'Unrelated chat flow never executed');
    console.log('PASS fresh plugin -> actual SSN WebSocket -> saved Event Flow -> real HTTP side effect, repeated presses, query feedback, unrelated flow isolation');
    // Exercise the public unversioned shape separately from the plugin's protocol-2 envelope.
    const api = new WebSocket(relayURL), responses = [];
    await new Promise(resolve => api.once('open', resolve));
    cleanup.push(() => api.terminate());
    api.on('message', raw => responses.push(JSON.parse(raw)));
    api.send(JSON.stringify({ join: session, in: 2, out: 1 }));
    async function call(action, value) {
        const get = 'plain-api-' + (++index);
        api.send(JSON.stringify({ action, value, get }));
        return (await wait(() => responses.find(packet => packet.callback?.get === get), 'plain API callback')).callback.result;
    }
    assert.equal((await call('triggerWorkflow', JSON.stringify({ trigger: 'fixture.run', flowId, data: { label: 'HTTP-shaped JSON', minutes: 7 } }))).status, 'accepted');
    await wait(() => received.length === 5, 'stringified HTTP-compatible value');
    assert.equal((await call('triggerWorkflow', { trigger: 'missing' })).error.code, 'WORKFLOW_NOT_FOUND');
    assert.equal((await call('triggerWorkflow', { trigger: 'fixture.run', data: [] })).error.code, 'INVALID_VALUE');
    await bg.evaluate(async id => { const flow = eventFlowSystem.flows.find(flow => flow.id === id); flow.active = false; await eventFlowSystem.saveFlow(flow); }, flowId);
    const disabled = await press('triggerWorkflow', { trigger: 'fixture.run', flowId }, false);
    assert.equal(disabled.response.error.code, 'WORKFLOW_NOT_FOUND');
    assert.equal((await call('getWorkflowTriggers')).payload.triggers.length, 0);
    await delay(1000); assert.equal(received.length, 5);
    console.log('PASS unversioned API, stringified value, missing/disabled workflows and invalid data');
    // Save a delayed graph, verify acceptance is immediate, then observe the later real request.
    await bg.evaluate(async id => {
        const flow = eventFlowSystem.flows.find(flow => flow.id === id); flow.active = true;
        const from = flow.connections[0].from, to = flow.connections[0].to;
        flow.nodes.push({ id: 'wait', type: 'action', actionType: 'delay', config: { delayMs: 1500 } });
        flow.connections = [{ from, to: 'wait' }, { from: 'wait', to }];
        await eventFlowSystem.saveFlow(flow);
    }, flowId);
    const before = Date.now();
    assert.equal((await call('triggerWorkflow', { trigger: 'fixture.run', flowId, data: { label: 'Delayed', minutes: 8 } })).status, 'accepted');
    assert(Date.now() - before < 1200, 'Acknowledgement arrives before delay');
    assert.equal(received.length, 5);
    await wait(() => received.length === 6, 'delayed graph completion');
    await bg.evaluate(async () => { await eventFlowSystem.loadFlows(); });
    assert.equal((await call('getWorkflowTriggers')).payload.triggers[0].trigger, 'fixture.run');
    const capabilityPacket = wire.find(packet => packet.callback?.result?.ssn?.actions?.triggerWorkflow).callback.result;
    const triggers = (await call('getWorkflowTriggers')).payload.triggers;
    const inspectorOffset = events.length;
    deckSocket.send(JSON.stringify({ event: 'propertyInspectorDidAppear', action: 'ninja.socialstream.streamdeck.command', context: list.context, device: 'qa-deck' }));
    deckSocket.send(JSON.stringify({ event: 'sendToPlugin', action: 'ninja.socialstream.streamdeck.command', context: list.context, payload: { type: 'requestWorkflows' } }));
    const inspector = await wait(() => events.slice(inspectorOffset).find(packet => packet.event === 'sendToPropertyInspector' && packet.payload?.type === 'workflows'), 'real plugin workflow discovery for inspector');
    assert.equal(inspector.payload.result.payload.triggers[0].flowId, flowId);
    await require('./streamdeck-workflow-ui-helper.cjs')(app, bundle, output, capabilityPacket, triggers);
    if (liveTransports) {
        // Only the random fixture session is used on hosted services; the effect stays loopback.
        await bg.evaluate(() => {
            socketserver.onclose = null; socketserver.close(); socketserver = false;
            serverURL = 'wss://io.socialstream.ninja/api'; settings.socketserver = true; setupSocket();
        });
        await bg.waitForFunction(() => socketserver && socketserver.readyState === 1);
        await delay(500);
        const httpValue = { trigger: 'fixture.run', flowId, data: { label: 'Hosted HTTP POST', minutes: 9 } };
        const post = await fetch('https://io.socialstream.ninja/' + session, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'triggerWorkflow', value: httpValue }), signal: AbortSignal.timeout(15000) });
        assert(post.ok, 'Hosted HTTP accepted POST');
        await wait(() => received.length === 7, 'hosted POST reaches actual workflow');
        const getValue = { ...httpValue, data: { label: 'Hosted HTTP GET', minutes: 10 } };
        const get = await fetch('https://io.socialstream.ninja/' + session + '/triggerWorkflow/null/' + encodeURIComponent(JSON.stringify(getValue)), { signal: AbortSignal.timeout(15000) });
        assert(get.ok, 'Hosted HTTP accepted GET');
        await wait(() => received.length === 8, 'encoded hosted GET reaches actual workflow');
        assert.equal(received[6].body.label, 'Hosted HTTP POST');
        assert.equal(received[7].body.label, 'Hosted HTTP GET');
        console.log('PASS hosted HTTP POST and URL-encoded GET -> actual SSApp workflow -> local webhook');
        await bg.evaluate(async () => {
            await handleRuntimeMessage({ cmd: 'saveSetting', setting: 'socketserver', value: false }, null, function () {});
            await handleRuntimeMessage({ cmd: 'saveSetting', setting: 'sdk', value: true }, null, function () {});
        });
        await bg.waitForFunction(() => ninjaBridge && ninjaBridge.isReady(), null, { timeout: 45000 });
        Object.assign(globals, { transport: 'p2p', password: '', requestTimeoutMs: 15000 });
        deckSocket.send(JSON.stringify({ event: 'didReceiveGlobalSettings', context: 'workflow-qa', payload: { settings: globals } }));
        await bg.waitForFunction(() => getDockTransportHealth().p2pPeerLabels.includes('streamdeck'), null, { timeout: 45000 });
        const p2p = await press('triggerWorkflow', { trigger: 'fixture.run', flowId, data: { label: 'Real P2P', minutes: 11 } });
        await wait(() => received.length === 9, 'real P2P reaches workflow');
        assert.equal(received[8].body.label, 'Real P2P');
        assert.equal(await bg.evaluate(() => !!settings.socketserver), false);
        console.log('PASS fresh plugin P2P -> actual SSApp workflow -> local webhook with remote WebSocket API disabled');
    }
    assert.equal(plugin.exitCode, null);
    console.log('PASS delayed action acknowledgement and database reload; artifacts: ' + output);
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, flowId, received, artifacts: output }, null, 2));
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    for (const close of cleanup.reverse()) { try { await close(); } catch (_) {} }
});
