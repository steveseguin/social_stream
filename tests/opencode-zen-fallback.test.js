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

function rateLimitError(model) {
    const error = new Error(model + ' quota exhausted');
    error.status = 429;
    error.code = 'rate_limit_exceeded';
    error.model = model;
    return error;
}

const repoRoot = path.resolve(__dirname, '..');
const aiSource = fs.readFileSync(path.join(repoRoot, 'ai.js'), 'utf8');
const openCodeSnippet = extractBetween(
    aiSource,
    'const OPENCODE_ZEN_MODELS_URL',
    'function noteChatBotDecision'
);

const context = {
    Date,
    console: {
        warn() {},
        error() {}
    },
    fetch: null
};

vm.createContext(context);
vm.runInContext(`
function getLLMHint() { return null; }
function reportLLMError() {}
function createLLMError(baseDetails, extra) {
    const error = new Error((extra && extra.message) || 'LLM request failed');
    Object.assign(error, baseDetails || {}, extra || {});
    return error;
}
${openCodeSnippet}
this.__opencode = {
    requestOpenCodeZenWithFallback,
    getOpenCodeZenCandidateModels, getOpenCodeZenSelectedModel, inferOpenCodeZenModelFreeFlag
};
`, context);

const { requestOpenCodeZenWithFallback } = context.__opencode;
const llmSettings = {
    opencodeApiKey: {
        textsetting: 'test-key'
    }
};

let fetchCalls = 0;
context.fetch = async function () {
    fetchCalls += 1;
    return {
        ok: true,
        async json() {
            return {
                data: [
                    { id: 'minimax-m2.7' },
                    { id: 'deepseek-v4-flash-free' },
                    { id: 'mimo-v2.5-free' },
                    { id: 'big-pickle' }, { id: 'nemotron-3.5-lightning-free' }, { id: 'muse-spark-1.3-contributor-free' }
                ]
            };
        }
    };
};

(async () => {
    const firstTried = [];
    const firstResult = await requestOpenCodeZenWithFallback(llmSettings, async function (model) {
        firstTried.push(model);
        if (firstTried.length === 1) {
            assert.strictEqual(fetchCalls, 1, 'Auto should load the live catalog before generation');
            throw rateLimitError(model);
        }
        return 'ok:' + model;
    });

    assert.strictEqual(firstResult, 'ok:mimo-v2.5-free');
    assert.deepStrictEqual(firstTried, ['nemotron-3.5-lightning-free', 'mimo-v2.5-free']);
    assert.strictEqual(fetchCalls, 1, 'A retryable free-model failure should fetch the live list once');

    const secondTried = [];
    const secondResult = await requestOpenCodeZenWithFallback(llmSettings, async function (model) {
        secondTried.push(model);
        assert.notStrictEqual(model, 'nemotron-3.5-lightning-free', 'Cooling down free models should not be retried');
        assert.notStrictEqual(model, 'minimax-m2.7', 'Auto should not fall through to paid models');
        if (model === 'mimo-v2.5-free') {
            throw rateLimitError(model);
        }
        return 'ok:' + model;
    });

    assert.strictEqual(secondResult, 'ok:big-pickle');
    assert.deepStrictEqual(secondTried, ['mimo-v2.5-free', 'big-pickle']);
    assert.strictEqual(fetchCalls, 1, 'The model list endpoint should not be queried again inside the one-hour cache window');
    assert.strictEqual(context.__opencode.getOpenCodeZenSelectedModel({ opencodemodel: { optionsetting: 'go-auto' } }), 'go-auto');
    assert.strictEqual(context.__opencode.inferOpenCodeZenModelFreeFlag('paid', { pricing: {} }), false);
    assert.strictEqual(context.__opencode.inferOpenCodeZenModelFreeFlag('paid', { pricing: { input: 0, output: 1 } }), false);
    assert.strictEqual(context.__opencode.inferOpenCodeZenModelFreeFlag('free', { pricing: { input: 0, output: 0 } }), true);
    const goAttempts = [];
    context.fetch = async function () {
        return { ok: true, json: async function () { return { data: [{ id: 'glm-5.3-flash' }, { id: 'kimi-k3' }] }; } };
    };
    const goResult = await requestOpenCodeZenWithFallback(llmSettings, async function (model) {
        goAttempts.push(model);
        if (model.indexOf('go/') !== 0) throw rateLimitError(model);
        return model;
    }, true);
    assert.strictEqual(goResult, 'go/glm-5.3-flash');
    assert.ok(!goAttempts.includes('muse-spark-1.3-contributor-free'), 'Responses models must not go to chat/completions');
    assert.ok(!goAttempts.includes('go/kimi-k3'), 'Unapproved expensive models must not enter the Go fallback chain');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
