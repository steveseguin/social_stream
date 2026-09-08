const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createOpenCodeClient } = require('../.github/scripts/opencode-client.cjs');

test('live free models precede only allowed Go fallbacks, with stable request identity', async () => {
  const calls = [];
  const client = createOpenCodeClient({ apiKey: 'test-key', userAgent: 'test-agent/1.0', sessionId: 'run-123', warn() {},
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [
        { id: 'mimo-v2.5-free' }, { id: 'glm-5.3-flash' }, { id: 'kimi-k3' }, { id: 'unknown-paid', pricing: {} }
      ] }) };
      const { model } = JSON.parse(options.body);
      if (model.endsWith('-free')) return { ok: false, status: 429, json: async () => ({ error: { message: 'Rate limited' } }) };
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'done' } }] }) };
    }
  });
  assert.equal((await client.complete({ messages: [{ role: 'user', content: 'summarize diff' }] })).value, 'done');
  const posts = calls.filter(call => call.options.method === 'POST');
  assert.deepEqual(posts.map(call => JSON.parse(call.options.body).model), ['mimo-v2.5-free', 'glm-5.3-flash']);
  assert.equal(posts[0].url, 'https://opencode.ai/zen/v1/chat/completions');
  assert.equal(posts[1].url, 'https://opencode.ai/zen/go/v1/chat/completions');
  assert.ok(calls.every(call => call.options.headers['x-opencode-session'] === 'run-123'));
  assert.ok(calls.every(call => call.options.headers['User-Agent'] === 'test-agent/1.0'));
  assert.equal(JSON.parse(posts[1].options.body).max_tokens, 2048);
});

test('invalid generated JSON falls through to another model', async () => {
  const client = createOpenCodeClient({ sessionId: 'validation', warn() {}, fetchImpl: async (url, options) => {
    if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'mimo-v2.5-free' }, { id: 'glm-5.3-flash' }] }) };
    return { ok: true, json: async () => ({ choices: [{ message: { content:
      JSON.parse(options.body).model.endsWith('-free') ? 'invalid json' : '{"ok":true}'
    } }] }) };
  } });
  const result = await client.complete({ messages: [], validate: JSON.parse });
  assert.equal(result.model, 'glm-5.3-flash');
  assert.deepEqual(result.value, { ok: true });
});

test('an empty permitted live catalog does not silently try unlisted models', async () => {
  const client = createOpenCodeClient({ warn() {}, fetchImpl: async (url) => {
    assert.ok(url.endsWith('/models'));
    return { ok: true, json: async () => ({ data: [{ id: 'expensive-model' }] }) };
  } });
  await assert.rejects(client.complete({ messages: [] }), /No available/);
});
