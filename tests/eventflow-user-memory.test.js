#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const EFS_SRC = fs.readFileSync(path.join(ROOT, 'actions', 'EventFlowSystem.js'), 'utf8');
const EDITOR_SRC = fs.readFileSync(path.join(ROOT, 'actions', 'EventFlowEditor.js'), 'utf8');
const EDITOR_CSS = fs.readFileSync(path.join(ROOT, 'actions', 'styles.css'), 'utf8');
const EDITOR_INDEX_SRC = fs.readFileSync(path.join(ROOT, 'actions', 'index.html'), 'utf8');
const GUIDE_SRC = fs.readFileSync(path.join(ROOT, 'actions', 'user-memory-guide.html'), 'utf8');
const GUIDES_INDEX_SRC = fs.readFileSync(path.join(ROOT, 'docs', 'guides.html'), 'utf8');
const EXAMPLE_FLOW = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'actions', 'examples', 'user-memory-participation-draw.json'),
    'utf8'
));

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

function loadEventFlowSystem({ windowOverrides = {}, globals = {} } = {}) {
    const document = {
        createElement() {
            let html = '';
            const getText = () => String(html).replace(/<[^>]*>/g, '');
            return {
                set innerHTML(value) { html = value; },
                get textContent() { return getText(); },
                get innerText() { return getText(); },
                querySelectorAll() { return []; },
            };
        },
        createTextNode(value) { return { textContent: String(value) }; },
    };
    const sandbox = vm.createContext({
        window: makeWindow(windowOverrides),
        document,
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

    vm.runInContext(`${EFS_SRC}\nwindow.EventFlowSystem = EventFlowSystem;`, sandbox);
    return sandbox.window.EventFlowSystem;
}

function createMemoryNode(id, name, config = {}) {
    return {
        id,
        type: 'state',
        stateType: 'USER_MEMORY',
        config: {
            name,
            persistence: 'session',
            resetAfterMs: 0,
            resetOnStreamStart: false,
            resetOnStreamStop: false,
            ...config,
        },
    };
}

function createFlow(nodes, id = 'flow_memory') {
    return {
        id,
        name: 'User Memory test flow',
        active: true,
        nodes,
        connections: [],
    };
}

function createMemoryDb(initialRecords = []) {
    const records = new Map(initialRecords.map(record => [record.id, structuredClone(record)]));

    return {
        records,
        objectStoreNames: { contains: name => name === 'userMemoryState' },
        transaction() {
            const transaction = {
                objectStore() {
                    return {
                        get(id) {
                            const request = {};
                            setTimeout(() => {
                                request.result = records.has(id) ? structuredClone(records.get(id)) : undefined;
                                if (request.onsuccess) request.onsuccess();
                            }, 0);
                            return request;
                        },
                        put(record) {
                            records.set(record.id, structuredClone(record));
                            setTimeout(() => {
                                if (transaction.oncomplete) transaction.oncomplete();
                            }, 0);
                        },
                    };
                },
            };
            return transaction;
        },
    };
}

async function runTests() {
    console.log('\n[1] A memory deduplicates stable identities and tracks participation');
    {
        const EFS = loadEventFlowSystem();
        const system = new EFS();
        const memory = createMemoryNode('memory_participants', 'Participants');
        const flow = createFlow([memory]);
        system.flows = [flow];

        const first = await system.rememberUserInMemory(memory.id, {
            type: 'tiktok',
            userid: 'User-42',
            chatname: 'First name',
            event: 'like',
        }, flow, 'liked');
        const second = await system.rememberUserInMemory(memory.id, {
            type: 'TIKTOK',
            userid: 'user-42',
            chatname: 'Updated name',
            event: 'gift',
        }, flow, 'Heart Me');

        assert.equal(first.added, true);
        assert.equal(second.added, false);
        assert.equal(second.count, 1);
        assert.equal(second.entry.chatname, 'Updated name');
        assert.equal(second.entry.participationCount, 2);
        assert.equal(second.entry.reason, 'Heart Me');
        assert.equal(await system.isUserRemembered(memory.id, { type: 'tiktok', userid: 'USER-42' }, flow), true);
        assert.equal(await system.isUserRemembered(memory.id, { type: 'youtube', userid: 'USER-42' }, flow), false);
    }

    console.log('[2] Separate User Memory nodes remain isolated, including Clear All');
    {
        const EFS = loadEventFlowSystem();
        const system = new EFS();
        const likes = createMemoryNode('memory_likes', 'Liked the stream');
        const giveaway = createMemoryNode('memory_giveaway', 'Giveaway entries');
        const flow = createFlow([likes, giveaway], 'flow_isolation');
        system.flows = [flow];

        const alice = { type: 'youtube', userid: 'alice', chatname: 'Alice' };
        const bob = { type: 'youtube', userid: 'bob', chatname: 'Bob' };
        await system.rememberUserInMemory(likes.id, alice, flow, 'liked');
        await system.rememberUserInMemory(giveaway.id, alice, flow, '!enter');
        await system.rememberUserInMemory(giveaway.id, bob, flow, '!enter');

        const cleared = await system.clearUserMemory(likes.id, flow, 'test');
        assert.equal(cleared.clearedCount, 1);
        assert.equal(await system.isUserRemembered(likes.id, alice, flow), false);
        assert.equal(await system.isUserRemembered(giveaway.id, alice, flow), true);
        assert.equal(system.getUserMemorySummary(giveaway.id, flow).count, 2);
    }

    console.log('[3] Forget User removes only the triggering user');
    {
        const EFS = loadEventFlowSystem();
        const system = new EFS();
        const memory = createMemoryNode('memory_forget', 'Participants');
        const flow = createFlow([memory], 'flow_forget');
        system.flows = [flow];
        await system.rememberUserInMemory(memory.id, { type: 'twitch', userid: 'alice' }, flow);
        await system.rememberUserInMemory(memory.id, { type: 'twitch', userid: 'bob' }, flow);

        const forgotten = await system.forgetUserFromMemory(memory.id, { type: 'twitch', userid: 'alice' }, flow);
        assert.equal(forgotten.removed, true);
        assert.equal(forgotten.count, 1);
        assert.equal(await system.isUserRemembered(memory.id, { type: 'twitch', userid: 'bob' }, flow), true);
    }

    console.log('[4] Pick Random User can remove a winner and expose draw variables');
    {
        const EFS = loadEventFlowSystem({
            globals: {
                crypto: {
                    getRandomValues(values) {
                        values[0] = 1;
                        return values;
                    },
                },
            },
        });
        const system = new EFS();
        const memory = createMemoryNode('memory_draw', 'Prize Draw');
        const flow = createFlow([memory], 'flow_draw');
        system.flows = [flow];
        await system.rememberUserInMemory(memory.id, { type: 'twitch', userid: 'alice', chatname: 'Alice' }, flow);
        await system.rememberUserInMemory(memory.id, { type: 'twitch', userid: 'bob', chatname: 'Bob' }, flow);

        const actionResult = await system.executeAction({
            id: 'pick_winner',
            type: 'action',
            actionType: 'pickRandomUser',
            config: { targetNodeId: memory.id, removeSelected: true },
        }, { type: 'twitch', chatname: 'Moderator', chatmessage: '!draw' }, flow);

        assert.equal(actionResult.modified, true);
        assert.equal(actionResult.message.selectedUser, 'Bob');
        assert.equal(actionResult.message.selectedUserRemoved, true);
        assert.equal(actionResult.message.userMemoryCount, 1);
        assert.equal(await system.isUserRemembered(memory.id, { type: 'twitch', userid: 'bob' }, flow), false);
        assert.equal(await system.isUserRemembered(memory.id, { type: 'twitch', userid: 'alice' }, flow), true);
    }

    console.log('[5] Generic Reset State Node clears only its selected memory');
    {
        const EFS = loadEventFlowSystem();
        const system = new EFS();
        const firstMemory = createMemoryNode('memory_reset_one', 'Round one');
        const secondMemory = createMemoryNode('memory_reset_two', 'Round two');
        const flow = createFlow([firstMemory, secondMemory], 'flow_reset');
        system.flows = [flow];
        const user = { type: 'kick', userid: 'entrant' };
        await system.rememberUserInMemory(firstMemory.id, user, flow);
        await system.rememberUserInMemory(secondMemory.id, user, flow);

        await system.executeAction({
            id: 'reset_memory',
            type: 'action',
            actionType: 'resetStateNode',
            config: { targetNodeId: firstMemory.id },
        }, { chatmessage: '!reset' }, flow);

        assert.equal(await system.isUserRemembered(firstMemory.id, user, flow), false);
        assert.equal(await system.isUserRemembered(secondMemory.id, user, flow), true);
    }

    console.log('[6] Inactivity and stream reset policies are scoped per memory');
    {
        const EFS = loadEventFlowSystem();
        const system = new EFS();
        const expiring = createMemoryNode('memory_expiring', 'Temporary', { resetAfterMs: 1000 });
        const streamReset = createMemoryNode('memory_stream', 'Per stream', { resetOnStreamStart: true });
        const stopReset = createMemoryNode('memory_stop', 'Until stream stop', { resetOnStreamStop: true });
        const retained = createMemoryNode('memory_retained', 'Retained');
        const flow = createFlow([expiring, streamReset, stopReset, retained], 'flow_policy');
        system.flows = [flow];
        const user = { type: 'tiktok', userid: 'participant' };
        await system.rememberUserInMemory(expiring.id, user, flow);
        await system.rememberUserInMemory(streamReset.id, user, flow);
        await system.rememberUserInMemory(stopReset.id, user, flow);
        await system.rememberUserInMemory(retained.id, user, flow);

        const expiringState = system.userMemoryStates.get(system.getUserMemoryStateKey(flow, expiring.id));
        expiringState.lastActivity = Date.now() - 2000;
        assert.equal(await system.isUserRemembered(expiring.id, user, flow), false);

        await system.processMessage({ type: 'tiktok', event: 'stream_started' });
        assert.equal(await system.isUserRemembered(streamReset.id, user, flow), false);
        assert.equal(await system.isUserRemembered(stopReset.id, user, flow), true);
        assert.equal(await system.isUserRemembered(retained.id, user, flow), true);

        await system.processMessage({ type: 'tiktok', event: 'stream_stopped' });
        assert.equal(await system.isUserRemembered(stopReset.id, user, flow), false);
        assert.equal(await system.isUserRemembered(retained.id, user, flow), true);
    }

    console.log('[7] Persistent memories load from and save back to their own state record');
    {
        const EFS = loadEventFlowSystem();
        const system = new EFS();
        const memory = createMemoryNode('memory_saved', 'Saved entrants', { persistence: 'persistent' });
        const sessionMemory = createMemoryNode('memory_session', 'Session entrants');
        const flow = createFlow([memory, sessionMemory], 'flow_saved');
        const stateId = `${flow.id}::${memory.id}`;
        const db = createMemoryDb([{
            id: stateId,
            flowId: flow.id,
            nodeId: memory.id,
            name: 'Saved entrants',
            persistence: 'persistent',
            resetAfterMs: 0,
            entries: [{
                key: 'youtube:alice',
                userid: 'alice',
                chatname: 'Alice',
                type: 'youtube',
                participationCount: 1,
            }],
            lastActivity: Date.now(),
            updatedAt: Date.now(),
        }]);
        system.db = db;
        system.initPromise = Promise.resolve();
        system.flows = [flow];

        assert.equal(await system.isUserRemembered(memory.id, { type: 'youtube', userid: 'alice' }, flow), true);
        await system.rememberUserInMemory(memory.id, { type: 'youtube', userid: 'bob', chatname: 'Bob' }, flow);
        const state = system.userMemoryStates.get(stateId);
        await system.savePersistentUserMemoryState(state);
        assert.equal(db.records.get(stateId).entries.length, 2);

        await system.rememberUserInMemory(sessionMemory.id, { type: 'youtube', userid: 'carol' }, flow);
        const sessionStateId = `${flow.id}::${sessionMemory.id}`;
        await system.savePersistentUserMemoryState(system.userMemoryStates.get(sessionStateId));
        assert.equal(db.records.has(sessionStateId), false);
    }

    console.log('[8] A realistic eligibility flow remembers participation, then gates later messages');
    {
        const EFS = loadEventFlowSystem();
        const system = new EFS();
        const memory = createMemoryNode('memory_heart_me', 'Heart Me senders');
        const rememberFlow = createFlow([
            { id: 'gift_event', type: 'trigger', triggerType: 'eventOther', config: { eventType: 'gift' } },
            { id: 'gift_name', type: 'trigger', triggerType: 'messageContains', config: { text: 'Heart Me' } },
            { id: 'heart_me_gift', type: 'logic', logicType: 'AND', config: {} },
            { id: 'remember', type: 'action', actionType: 'rememberUser', config: { targetNodeId: memory.id, reason: '{event}' } },
            memory,
        ], 'flow_heart_me');
        rememberFlow.connections = [
            { from: 'gift_event', to: 'heart_me_gift' },
            { from: 'gift_name', to: 'heart_me_gift' },
            { from: 'heart_me_gift', to: 'remember' },
        ];

        const eligibilityFlow = createFlow([
            memory,
            { id: 'question', type: 'trigger', triggerType: 'messageStartsWith', config: { text: '?' } },
            { id: 'remembered', type: 'trigger', triggerType: 'userMemoryContains', config: { targetNodeId: memory.id } },
            { id: 'eligible', type: 'logic', logicType: 'AND', config: {} },
            { id: 'mark', type: 'action', actionType: 'addPrefix', config: { prefix: '[eligible] ' } },
        ], 'flow_heart_me');
        eligibilityFlow.connections = [
            { from: 'question', to: 'eligible' },
            { from: 'remembered', to: 'eligible' },
            { from: 'eligible', to: 'mark' },
        ];
        system.flows = [rememberFlow];

        await system.processMessage({
            type: 'tiktok',
            userid: 'alice',
            chatname: 'Alice',
            event: 'gift',
            chatmessage: 'sent Heart Me',
            hasDonation: '1 Heart Me',
        });
        system.flows = [eligibilityFlow];

        const eligible = await system.processMessage({ type: 'tiktok', userid: 'alice', chatname: 'Alice', chatmessage: '? hello' });
        const missingCommand = await system.processMessage({ type: 'tiktok', userid: 'alice', chatname: 'Alice', chatmessage: 'hello' });
        const stranger = await system.processMessage({ type: 'tiktok', userid: 'bob', chatname: 'Bob', chatmessage: '? hello' });
        assert.equal(eligible.chatmessage, '[eligible] ? hello');
        assert.equal(missingCommand.chatmessage, 'hello');
        assert.equal(stranger.chatmessage, '? hello');
    }

    console.log('[9] Events without a usable identity are safely ignored');
    {
        const EFS = loadEventFlowSystem();
        const system = new EFS();
        const memory = createMemoryNode('memory_identity', 'Identified users');
        const flow = createFlow([memory], 'flow_identity');
        system.flows = [flow];
        const result = await system.rememberUserInMemory(memory.id, { type: 'youtube', event: 'like' }, flow);
        assert.equal(result.success, false);
        assert.match(result.error, /identity/i);
        assert.equal(system.getUserMemorySummary(memory.id, flow).count, 0);
    }

    console.log('[10] Editor wiring and controls remain discoverable in the shipped sources');
    {
        assert.match(EDITOR_SRC, /id: 'userMemoryContains'/);
        assert.match(EDITOR_SRC, /id: 'rememberUser'/);
        assert.match(EDITOR_SRC, /id: 'clearUserMemory'/);
        assert.match(EDITOR_SRC, /id: 'pickRandomUser'/);
        assert.match(EDITOR_SRC, /stateType: 'USER_MEMORY'/);
        assert.match(EDITOR_SRC, /renderStateReferences\(\)/);
        assert.match(EDITOR_SRC, /Clear All Users Now/);
        assert.match(EDITOR_CSS, /\.state-reference-point/);
        assert.match(EDITOR_CSS, /stroke-dasharray: 7 6/);
    }

    console.log('[11] The guide, reviewed screenshots, and importable example stay wired together');
    {
        assert.match(GUIDE_SRC, /TikTok Heart Me or Team Member/);
        assert.match(GUIDE_SRC, /Remember people who liked or participated/);
        assert.match(GUIDE_SRC, /Unique-entry prize draw/);
        assert.match(GUIDE_SRC, /user-memory-participation-draw\.json/);
        assert.match(EDITOR_INDEX_SRC, /href="user-memory-guide\.html"/);
        assert.match(EDITOR_SRC, /user-memory-guide\.html/);
        assert.match(GUIDES_INDEX_SRC, /actions\/user-memory-guide\.html/);

        const guideImages = [...GUIDE_SRC.matchAll(/<img\s+[^>]*src="([^"]+)"[^>]*alt="([^"]+)"/g)];
        assert.equal(guideImages.length, 4, 'guide should contain the four reviewed screenshots');
        for (const [, relativePath, altText] of guideImages) {
            const imagePath = path.join(ROOT, 'actions', relativePath);
            assert.ok(altText.trim(), `${relativePath} should have descriptive alt text`);
            assert.ok(fs.existsSync(imagePath), `${relativePath} should exist`);
            assert.ok(fs.statSync(imagePath).size > 10_000, `${relativePath} should contain a real cropped screenshot`);
        }

        const memoryNode = EXAMPLE_FLOW.nodes.find(node => node.stateType === 'USER_MEMORY');
        assert.ok(memoryNode, 'example should include a User Memory hub');
        assert.ok(
            EXAMPLE_FLOW.nodes.some(node => node.triggerType === 'userRole' && node.config?.role === 'mod'),
            'example draw and reset commands should include a moderator check'
        );
        const linkedNodes = EXAMPLE_FLOW.nodes.filter(node => node.config?.targetNodeId === memoryNode.id);
        assert.equal(linkedNodes.length, 4, 'example should link four operations/checks to its memory');
        assert.deepEqual(
            linkedNodes.map(node => node.actionType || node.triggerType).sort(),
            ['clearUserMemory', 'pickRandomUser', 'rememberUser', 'userMemoryContains'].sort()
        );
    }

    console.log('\nAll User Memory tests passed.');
}

runTests().catch(error => {
    console.error(error);
    process.exit(1);
});
