const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { webcrypto } = require("crypto");

const background = fs.readFileSync(path.resolve(__dirname, "..", "background.js"), "utf8");
const start = background.indexOf("let openAIRealtimeSafetyIdentifierPromise");
const end = background.indexOf("\nlet videoStatsPollTimer", start);
assert(start >= 0 && end > start, "OpenAI Realtime broker function should be present");

let capturedRequest = null;
let capturedRequests = [];
let queuedResponses = [];
function makeResponse(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}
const context = vm.createContext({
  settings: { chatgptApiKey: { textsetting: "sk-test-standard-key" } },
  streamID: "test-install-session",
  crypto: webcrypto,
  TextEncoder,
  Uint8Array,
  Array,
  fetchWithTimeout: async (url, options, timeout) => {
    capturedRequest = { url, options, timeout };
    capturedRequests.push(capturedRequest);
    return queuedResponses.length ? queuedResponses.shift() : makeResponse(200, { value: "ek_test_ephemeral", expires_at: 123456 });
  }
});
vm.runInContext(background.slice(start, end) + "\nthis.createSecret = createOpenAIRealtimeClientSecret; this.getCapability = getOpenAIRealtimeCohostCapability; this.enforceMintRateLimit = enforceOpenAIRealtimeMintRateLimit;", context);

(async () => {
  const result = await context.createSecret({
    model: "gpt-realtime-2.1",
    instructions: "Be concise.",
    outputModalities: "audio",
    reasoningEffort: "low",
    vadEagerness: "high"
  });
  assert.strictEqual(capturedRequest.url, "https://api.openai.com/v1/realtime/client_secrets");
  assert.strictEqual(capturedRequest.options.headers.Authorization, "Bearer sk-test-standard-key");
  assert.match(capturedRequest.options.headers["OpenAI-Safety-Identifier"], /^[a-f0-9]{64}$/);
  const body = JSON.parse(capturedRequest.options.body);
  assert.strictEqual(body.session.type, "realtime");
  assert.strictEqual(body.session.model, "gpt-realtime-2.1");
  assert.deepStrictEqual(body.session.output_modalities, ["audio"]);
  assert.strictEqual(body.session.max_output_tokens, 512, "Realtime replies should have a conservative cost guardrail");
  assert.strictEqual(body.session.reasoning.effort, "low");
  assert.strictEqual(body.session.audio.input.transcription.model, "gpt-4o-mini-transcribe");
  assert.strictEqual(body.session.audio.input.turn_detection.eagerness, "high");
  assert.strictEqual(body.session.audio.input.turn_detection.interrupt_response, true);
	assert(background.includes("function getOpenAIRealtimeCohostCapability()"), "The broker should create a co-host link capability");
	assert(background.includes("function enforceOpenAIRealtimeMintRateLimit(peerId, capability)"), "The broker should rate limit hosted token requests");
	assert(background.includes("COHOST_CAPABILITY_LIFETIME_MS = 12 * 60 * 60 * 1000"), "Hosted co-host capabilities should expire");
	const capability = await context.getCapability();
	assert.match(capability, /^[a-f0-9]{64}$/);
	assert.strictEqual(await context.getCapability(), capability, "The same background lifetime should reuse its co-host capability");
	context.enforceMintRateLimit("peer-one", capability);
	assert.throws(
		() => context.enforceMintRateLimit("peer-two", capability),
		/Wait a few seconds/,
		"Changing peer IDs must not bypass the per-capability mint limit"
	);
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(result)),
    { value: "ek_test_ephemeral", expires_at: 123456, model: "gpt-realtime-2.1", reasoning_supported: true },
    "The broker response should contain only short-lived connection data"
  );

  capturedRequests = [];
  const legacyResult = await context.createSecret({ model: "gpt-realtime-1.5", reasoningEffort: "medium" });
  assert.strictEqual(capturedRequests.length, 1, "Known legacy models should omit reasoning before the request");
  assert.strictEqual(JSON.parse(capturedRequests[0].options.body).session.reasoning, undefined);
  assert.strictEqual(legacyResult.reasoning_supported, false);

  capturedRequests = [];
  queuedResponses = [
    makeResponse(400, { error: { param: "session.reasoning", message: "Unsupported reasoning field" } }),
    makeResponse(200, { value: "ek_fallback", expires_at: 234567 })
  ];
  const fallbackResult = await context.createSecret({ model: "gpt-realtime-3", reasoningEffort: "high" });
  assert.strictEqual(capturedRequests.length, 2, "A reasoning compatibility error should retry exactly once");
  assert.strictEqual(JSON.parse(capturedRequests[0].options.body).session.reasoning.effort, "high");
  assert.strictEqual(JSON.parse(capturedRequests[1].options.body).session.reasoning, undefined);
  assert.strictEqual(fallbackResult.reasoning_supported, false);

  capturedRequests = [];
  queuedResponses = [makeResponse(401, { error: { message: "Invalid API key" } })];
  await assert.rejects(() => context.createSecret({ model: "gpt-realtime-3", reasoningEffort: "high" }), /401.*Invalid API key/);
  assert.strictEqual(capturedRequests.length, 1, "Authentication errors must not be retried as reasoning fallbacks");

  context.settings.chatgptApiKey.textsetting = "";
  await assert.rejects(() => context.createSecret({}), /Add your OpenAI API key/);
  console.log("OpenAI Realtime broker passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
