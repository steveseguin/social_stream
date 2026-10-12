// Free Zen models first; only the explicit inexpensive fallback list uses Go.
// Catalogs expose IDs, not reliable pricing: never infer free from absent prices.
const { randomUUID } = require('node:crypto');
const FREE_MODELS = [
  'nemotron-3.5-lightning-free', 'mimo-v2.5-free', 'ling-3.0-flash-fin-free',
  'nemotron-3-ultra-free', 'big-pickle', 'deepseek-v4-flash-free'
];
const GO_MODELS = ['glm-5.3-flash', 'mimo-v2.5', 'deepseek-v4-flash'];
const ZEN = 'https://opencode.ai/zen/v1';
const GO = 'https://opencode.ai/zen/go/v1';

function createOpenCodeClient({ apiKey, userAgent, sessionId, fetchImpl = fetch, warn = console.warn }) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': userAgent || 'steveseguin-coding-automation/1.0',
    'x-opencode-session': sessionId || [process.env.GITHUB_REPOSITORY, process.env.GITHUB_RUN_ID, randomUUID()].filter(Boolean).join(':')
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  let catalogs;
  const unavailable = new Set();

  async function catalog(base, defaults) {
    try {
      const response = await fetchImpl(base + '/models', { headers, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.data) || !data.data.length) throw new Error('Empty model catalog');
      return new Set(data.data.map(entry => entry.id));
    } catch (error) {
      warn(`OpenCode catalog unavailable: ${error.message}; using documented defaults.`);
      return new Set(defaults);
    }
  }

  async function candidates(models) {
    if (!catalogs) catalogs = Promise.all([catalog(ZEN, FREE_MODELS), catalog(GO, GO_MODELS)]);
    const [freeCatalog, goCatalog] = await catalogs;
    const requested = models && models.length && !models.includes('auto') ? new Set(models) : null;
    // Explicit list keeps incompatible endpoints and unknown paid models out.
    return FREE_MODELS.filter(id => freeCatalog.has(id) && (!requested || requested.has(id)))
      .map(model => ({ model, base: ZEN }))
      .concat(GO_MODELS.filter(id => goCatalog.has(id) && (!requested || requested.has(id)))
        .map(model => ({ model, base: GO })));
  }

  async function complete({ messages, maxTokens = 2048, temperature = 0.2, models, json = false, validate = text => text }) {
    let lastError;
    for (const { model, base } of await candidates(models)) {
      if (unavailable.has(model)) continue;
      try {
        const response = await fetchImpl(base + '/chat/completions', {
          method: 'POST', headers, signal: AbortSignal.timeout(45000),
          body: JSON.stringify({ model, messages, stream: false, temperature, max_tokens: maxTokens, ...(json ? { response_format: { type: 'json_object' } } : {}) })
        });
        const data = await response.json();
        if (!response.ok) {
          const detail = data.error || data;
          const error = new Error(`${model}: HTTP ${response.status}: ${detail.message || detail.type || 'Request failed'}`);
          error.status = response.status;
          // These failures will persist for the rest of this invocation/batch.
          if ([401, 403, 404, 429].includes(response.status)) unavailable.add(model);
          throw error;
        }
        const text = data.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) throw new Error(`${model}: Empty response`);
        return { model, value: validate(text.trim()) };
      } catch (error) {
        lastError = error;
        warn(`OpenCode fallback: ${error.message}`);
      }
    }
    throw lastError || new Error('No available OpenCode models in the permitted free/Go fallback chain.');
  }
  return { candidates, complete };
}

module.exports = { createOpenCodeClient, FREE_MODELS, GO_MODELS };

// CLI used by the review workflow; prompts are passed through the environment.
if (require.main === module) {
  const client = createOpenCodeClient({
    apiKey: process.env.OPENCODE_API_KEY || process.env.ZEN_API_TOKEN,
    userAgent: 'social-stream-code-review/1.0',
    sessionId: [process.env.GITHUB_REPOSITORY, process.env.GITHUB_RUN_ID, 'review'].join(':')
  });
  client.complete({ messages: [
    { role: 'system', content: process.env.SYSTEM_PROMPT },
    { role: 'user', content: process.env.USER_PROMPT }
  ] }).then(result => require('node:fs').writeFileSync(process.argv[2], result.value + '\n'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
