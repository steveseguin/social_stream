const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function extractBetween(source, startToken, endToken) {
    const start = source.indexOf(startToken);
    const end = source.indexOf(endToken, start);
    if (start === -1 || end === -1 || end <= start) {
        throw new Error(`Could not extract snippet between ${startToken} and ${endToken}`);
    }
    return source.slice(start, end);
}

const repoRoot = path.resolve(__dirname, '..');
const aiSource = fs.readFileSync(path.join(repoRoot, 'ai.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(repoRoot, 'local-browser-model-worker.js'), 'utf8');
const luckyLootTubeSource = fs.readFileSync(path.join(repoRoot, 'themes', 'LuckyLootTube', 'luckyloottube.html'), 'utf8');

const censorSnippet = extractBetween(
    aiSource,
    'const CENSOR_CONTEXT_MAX_MESSAGES = 6;',
    'let censorProcessingSlots = [false, false, false];'
);
const censorFlowSnippet = extractBetween(
    aiSource,
    'let censorProcessingSlots = [false, false, false];',
    'async function censorMessageWithHistory(data) {'
);

const context = {
    Date,
    console,
    badWords: ['fuck'],
    isProfanity(value) {
        return value === 'fuck';
    },
    containsProfanity() {
        return false;
    },
    ChatContextManager: {
        added: [],
        addMessage(entry) {
            this.added.push(entry);
        }
    }
};

vm.createContext(context);
vm.runInContext(
    `${censorSnippet}
this.__censorExports = {
    rememberCensorContextMessage,
    getRecentCensorContextMessages,
    buildCompactSequenceCandidates,
    findCompactProfanityCandidate
};`,
    context
);

const {
    rememberCensorContextMessage,
    getRecentCensorContextMessages,
    buildCompactSequenceCandidates,
    findCompactProfanityCandidate
} = context.__censorExports;

rememberCensorContextMessage({ chatname: 'Lucy', userid: 'Lucy', type: 'kick' }, 'F', false);
rememberCensorContextMessage({ chatname: 'Lucy', userid: 'Lucy', type: 'kick' }, 'U', false);
rememberCensorContextMessage({ chatname: 'Lucy', userid: 'Lucy', type: 'kick' }, 'C', false);
rememberCensorContextMessage({ chatname: 'Lucy', userid: 'Lucy', type: 'kick' }, 'K', true);

const recentMessages = getRecentCensorContextMessages(Date.now());
assert.deepStrictEqual(
    Array.from(recentMessages, (entry) => entry.message),
    ['F', 'U', 'C'],
    'blocked moderation fragments should not stay in future censor context'
);
assert.strictEqual(
    findCompactProfanityCandidate(
        buildCompactSequenceCandidates(recentMessages, {
            chatname: 'Lucy',
            message: 'thanks'
        })
    ),
    null,
    'a harmless follow-up should not inherit a blocked compact sequence'
);
assert.strictEqual(
    context.ChatContextManager.added.length,
    3,
    'only allowed messages should be added to chat context'
);

assert(
    workerSource.includes('const stateless = !!message.stateless;'),
    'local browser worker should support stateless requests'
);
assert(
    workerSource.includes('buildMessages(message.systemPrompt, prompt, rawImages.length, !stateless)'),
    'stateless worker requests should skip prior conversation history'
);
assert(
    workerSource.includes('if (!stateless) {'),
    'stateless worker requests should not persist moderation turns into conversation memory'
);
assert(
    aiSource.includes('localBrowserStateless: isLocalBrowserProvider(providerKey)'),
    'local moderation should opt into stateless local-browser generation'
);
assert(
    aiSource.includes('const shouldThrottleCensorRequests = !isLocalBrowserProvider(providerKey);'),
    'local moderation should bypass the shared censor slot limiter'
);
assert(
    !workerSource.includes('WebGPU is unavailable in the extension runtime, falling back to wasm'),
    'extension-hosted local models should keep WebGPU available'
);
assert(
    luckyLootTubeSource.includes('if (h === "files.kick.com") return true;'),
    'LuckyLootTube sanitizer should allow Kick emote URLs'
);

async function runModerationFlowAssertions() {
    const flowContext = {
        console,
        settings: {
            ollamaCensorBotBlockMode: true
        },
        isExtensionOn: false,
        quickPass: 0,
        getActiveCensorProviderKey() {
            return 'localqwen';
        },
        isSafePhrase(data) {
            return {
                isSafe: false,
                cleanedText: data.chatmessage
            };
        },
        buildCensorContextEntry(data, cleanedText) {
            return {
                chatname: data.chatname || '',
                message: cleanedText,
                timestamp: Date.now()
            };
        },
        getRecentCensorContextMessages() {
            return [];
        },
        buildCompactSequenceCandidates() {
            return [];
        },
        findCompactProfanityCandidate() {
            return null;
        },
        rememberCensorContextMessage() {},
        shouldReviewSafePhraseWithContext() {
            return true;
        },
        buildCensorPrompt() {
            return 'prompt';
        },
        shouldUseBinaryCensorPrompt() {
            return true;
        },
        parseBinaryCensorDecision() {
            return {
                blocked: false,
                score: 0
            };
        },
        parseNumericCensorDecision() {
            return {
                blocked: false,
                score: 0
            };
        },
        isLocalBrowserProvider(providerKey) {
            return providerKey === 'localqwen';
        },
        addSafePhrase() {},
        sendToDestinations() {},
        callLLMAPIWasCalled: false,
        async callLLMAPI() {
            flowContext.callLLMAPIWasCalled = true;
            return 'OK';
        }
    };

    vm.createContext(flowContext);
    vm.runInContext(
        `${censorFlowSnippet}
this.__censorMessageWithLLM = censorMessageWithLLM;
this.__setCensorProcessingSlots = (value) => { censorProcessingSlots = value; };`,
        flowContext
    );

    flowContext.__setCensorProcessingSlots([true, true, true]);
    const passed = await flowContext.__censorMessageWithLLM({
        chatname: 'Lucy',
        userid: 'Lucy',
        type: 'youtube',
        textonly: true,
        chatmessage: 'hello'
    });
    assert.strictEqual(passed, true, 'local moderation should still evaluate when the shared slots are full');
    assert.strictEqual(flowContext.callLLMAPIWasCalled, true, 'local moderation should reach callLLMAPI instead of auto-blocking');
}

runModerationFlowAssertions()
    .then(() => {
        console.log('moderation-regressions.test.js passed');
    })
    .catch((error) => {
        console.error(error && error.stack ? error.stack : error);
        process.exit(1);
    });
