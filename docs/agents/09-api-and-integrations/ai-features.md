# AI Features

Status: heavy extraction pass plus focused AI prompt builder, AI moderation, local model registry, local AI asset-test, provider fallback, and RAG fixture evidence on 2026-06-24.

## Source Anchors

- `docs/commands.html`
- `ai.md`
- `ai.js`
- `background.js`
- `aiprompt.html`
- `aioverlay.html`
- `bot.html`
- `chatbot.html`
- `cohost.html`
- `cohost-overlay.html`
- `shared/ai/*`
- `shared/aiPrompt/overlayStore.js`
- `scripts/playwright-ai*.cjs`
- `scripts/playwright-aiprompt-smoke.cjs`
- `tests/rag-*.test.js`
- `tests/profanity-filter.test.js`
- `tests/moderation-regressions.test.js`
- `tests/local-browser-model-registry.test.js`
- `tests/opencode-zen-fallback.test.js`

## Focused Validation Evidence

On 2026-06-24, this focused Node test passed:

```powershell
node tests/transformers-local-defaults.test.js
```

Result: `PASS transformers local defaults`.

Evidence label: `focused-node-test`; not runtime-tested.

What this supports: the bundled Transformers core/web files use `https://largefiles.socialstream.ninja/` as the checked remote host and do not include the Hugging Face default remote-host strings checked by the test.

What it does not support: local model download success, WebGPU/WASM runtime behavior, browser model loading, popup/cohost UI behavior, RAG behavior, provider calls, OBS output, extension runtime, or standalone app runtime.

Full evidence entry: `../18-focused-validation-evidence-log.md`.

On 2026-06-24, these focused AI moderation, local model registry, and provider fallback tests passed:

```powershell
node tests/profanity-filter.test.js
node tests/moderation-regressions.test.js
node tests/local-browser-model-registry.test.js
node tests/opencode-zen-fallback.test.js
```

Results:

- Profanity dataset loaded 743 base bad words and generated 18467 variations.
- `moderation-regressions.test.js passed`.
- `local-browser-model-registry.test.js` passed all printed checks for `localgemma`, `localqwen`, popup/cohost provider exposure, and checked worker/client fallback strings.
- `opencode-zen-fallback.test.js` exited successfully.

Evidence label: `focused-node-test`; not runtime-tested.

What this supports: deterministic source/VM checks for profanity data shape, moderation context cleanup, stateless local-browser moderation wiring, local Gemma/Qwen catalog and popup/cohost exposure, checked WebGPU-to-WASM retry strings, and OpenCode Zen auto fallback staying within free-model candidates in the tested sequence.

What it does not support: live moderation quality, real chat classification, actual model download/loading, WebGPU/WASM execution, provider endpoint availability, provider pricing/model changes, popup/cohost runtime behavior, extension runtime, standalone app runtime, or OBS behavior.

On 2026-06-24, this focused AI prompt builder smoke test passed:

```powershell
npm run test:aiprompt:smoke
```

Result: `aiprompt.html smoke test passed.`

Evidence label: `focused-browser-smoke`; not app/extension/OBS/runtime-tested.

What this supports: local headless Chromium behavior for `aiprompt.html` startup, mocked bridge sync, seeded template loading, template modal, unique page naming, delete focus behavior, code/preview tab switching, preview iframe chat payload handling, `textonly` HTML behavior, mocked chatbot chunk/final settling, and builder localStorage migration/sync paths.

What it does not support: live LLM/provider calls, real extension background delivery, hosted sync, standalone app behavior, `aioverlay.html` runtime behavior, OBS rendering, real generated overlay quality, or live SSN payload handling.

On 2026-06-24, these focused RAG browser-fixture tests passed:

```powershell
npm run test:rag:benchmark
npm run test:rag:e2e
```

Results:

- `PASS rag benchmark`
- `PASS rag e2e`

Evidence label: `focused-browser-fixture`; not app/extension/OBS/runtime-tested.

What this supports: deterministic fixture behavior for document seeding, processed/raw document persistence, database descriptor generation, retrieval ranking, off-topic abstain behavior, prompt placeholder replacement, and reload persistence. The benchmark loaded 6 fixture documents and 3 processed chunks with 10/10 retrieval top1, 10/10 retrieval topK, and 8/8 question accuracy.

What it does not support: real user document uploads/deletes, file size or file type limits, popup settings, bot/chatbot UI, live provider calls, embedding/model runtime, hosted pages, OBS, Chrome extension storage, standalone app behavior, or long-running private document workflows.

## What AI Covers

SSN AI features include:

- Public chat bot replies.
- Private one-on-one chatbot page.
- AI moderation/censor behavior.
- RAG/document-backed answers.
- Chat summaries.
- AI translation/processing paths.
- AI cohost pages and overlays.
- Local browser/runtime models.
- Hosted API providers.
- Optional TTS for AI replies.

Use this as a feature map. For exact current menu labels and models, check `docs/commands.html`, settings definitions, and `background.js`.

For page-specific routing and bridge behavior for `cohost.html`, `cohost-overlay.html`, `aiprompt.html`, and `aioverlay.html`, use `../07-overlays-and-pages/ai-cohost-pages.md`.

## Bot Surfaces

| Surface | Role |
| --- | --- |
| `bot.html` | Main bot overlay/page with optional public chat responses and TTS. |
| `chatbot.html` | Dedicated private one-on-one chatbot page; command docs say it does not share the main bot's RAG dataset or chat history. |
| `cohost.html` | Multimodal AI cohost page. |
| `cohost-overlay.html` | Output/overlay surface for cohost behavior. |
| `aiprompt.html` | AI prompt/testing/configuration surface. |
| `aioverlay.html` | AI output overlay surface. |
| Background processing | Censor bot, LLM processing, RAG file handling, summaries, provider tests, and chat routing. |

Support rule: if AI appears to "do nothing", confirm the relevant page is open and the relevant background setting is enabled before debugging the provider.

## Provider Families

Command docs list these provider families:

| Provider Family | Cost/Runtime Boundary | Notes |
| --- | --- | --- |
| Ollama | Free/self-hosted local runtime | Uses Ollama native API, normally `http://localhost:11434`. |
| Local browser models | Local/browser runtime and hosted model assets | Current docs mention local Gemma/Qwen style browser assets. |
| OpenAI / ChatGPT | Provider API account/key/billing | Includes chat and realtime/voice model paths in docs. |
| Google Gemini | Provider API account/key/billing | Includes text and live multimodal options in docs. |
| DeepSeek | Provider API account/key/billing | Conversational provider option. |
| xAI / Grok | Provider API account/key/billing | Docs mention realtime voice sessions with ephemeral secrets. |
| AWS Bedrock | Cloud provider credentials/billing | Enterprise provider family. |
| OpenRouter | Provider/API account/key/billing | Unified multi-model API. |
| Groq | Provider/API account/key/billing | Low-latency OpenAI-compatible chat inference. |
| Custom API | User-hosted or third-party OpenAI-compatible endpoint | For llama.cpp, LM Studio, vLLM, and similar servers. |

Important distinction from command docs: Ollama uses its own native API. For llama.cpp, LM Studio, vLLM, or other OpenAI-compatible servers, choose Custom API.

## Ollama Setup Notes

`ai.md` gives a basic local Llama/Ollama setup:

- Install Ollama.
- Pull/run a model such as Llama.
- Ollama is normally available at `http://localhost:11434`.
- Browser extension use can hit CORS issues unless Ollama is configured to allow extension/browser origins.
- Standalone app may be less constrained, but `ai.md` still suggests setting `OLLAMA_ORIGINS` when needed.

Support checks:

- Is Ollama running?
- Does `http://localhost:11434` respond locally?
- Is the selected model installed?
- Did the user configure CORS/origins for extension use?
- Did the user choose Ollama, not Custom API, in SSN?

## Custom API Notes

Use Custom API for OpenAI-compatible servers such as:

- llama.cpp server
- LM Studio
- vLLM
- Local or private OpenAI-compatible gateways

Collect:

- Endpoint URL.
- Model ID.
- Optional API key.
- Whether the endpoint permits browser/extension requests.
- Whether the standalone app or extension is being used.

## RAG And Documents

Command docs describe RAG as Retrieval-Augmented Generation for custom knowledge-base answers. `background.js` includes commands for uploading and deleting RAG files and returns `documentsRAG` with settings/popup state.

Focused fixture evidence exists for the local RAG harness: `npm run test:rag:benchmark` and `npm run test:rag:e2e` passed on 2026-06-24. Use that as regression evidence for the fixture path only, not as proof that a user's real uploaded documents, provider, popup settings, app, extension, or OBS workflow is working.

Agent guidance:

- RAG answers depend on uploaded documents and selected bot surface.
- Private `chatbot.html` can have separate chat/RAG behavior from the main bot according to command docs.
- Do not assume a document is loaded just because RAG is enabled.
- For stale/wrong answers, ask what files were uploaded and whether the correct bot/page is being used.
- For "RAG passed tests but my bot ignores docs" issues, separate fixture regression evidence from real setup: uploaded documents, selected bot surface, enabled setting, provider/model health, and whether the user is asking an answerable question all still matter.

## AI Moderation/Censor

Command docs mention content moderation with non-blocking or strict blocking modes. Background code has LLM censor paths around incoming messages.

Focused evidence exists for selected moderation internals: `node tests/profanity-filter.test.js` and `node tests/moderation-regressions.test.js` passed on 2026-06-24. Use this as evidence for dataset/variation sanity and tested source snippets only. It does not prove live moderation quality or provider behavior.

Support guidance:

- If messages disappear unexpectedly, check AI censor/moderation settings as well as normal filters.
- Strict/blocking modes can prevent messages from reaching overlays.
- Provider latency or failures may affect moderation timing.
- For high-risk broadcasts, test moderation behavior before live use.

## Local Browser Models

Focused evidence exists for selected local browser model registry wiring: `node tests/local-browser-model-registry.test.js` passed on 2026-06-24. It confirmed `localgemma` and `localqwen` catalog entries, self-hosted remote-host strings, popup/cohost provider options, worker init defaults, and checked retry strings.

Do not treat that as proof that the model downloads, initializes, fits in memory, runs on WebGPU/WASM, or performs acceptably on a user's device.

## OpenCode Zen Fallback

Focused evidence exists for the OpenCode Zen auto fallback path: `node tests/opencode-zen-fallback.test.js` passed on 2026-06-24. The tested sequence stayed within free-model candidates and did not fall through to a paid model after retryable failures.

Do not treat that as current public pricing, provider availability, or reliability proof. Live provider behavior and model availability can change.

## Chat Bot Replies

Chat bot behavior can involve:

- Enabling the LLM AI chat bot.
- Selecting provider/model.
- Setting bot name/trigger words.
- Setting response rate limits.
- Choosing whether replies go back to chat or only to bot/overlay pages.
- Enabling TTS for bot replies.
- Routing bot replies to selected source accounts/roles where configured.

Support checks:

- Can the selected provider pass the built-in test?
- Is the chat bot enabled, not just the provider configured?
- Does the source platform allow sending chat?
- Is the user signed in and permitted to send messages?
- Is the response rate limited?
- Are bot trigger words too restrictive?

## AI Cohost

Command docs describe the cohost as a multimodal AI that can see screen, hear audio, and interact. `background.js` includes cohost overlay labels, tool status, and cohost tool request/response routing.

Support checks:

- Is `cohost.html` open?
- Is `cohost-overlay.html` open when visual/audio output is expected?
- Is the overlay label correct? Code defaults include labels such as `cohost-overlay` and `ai-overlay`.
- Is the selected provider capable of the requested multimodal mode?
- Are microphone/screen/media permissions available in the active browser/app context?

## AI Prompt Builder And Generated Overlays

For page-specific builder and runtime notes, use `../07-overlays-and-pages/ai-cohost-pages.md`.

Support checks:

- Is the user editing in `aiprompt.html` or trying to display a saved overlay in `aioverlay.html`?
- Is the same `session` used for builder sync and runtime display?
- Is Private Chat Bot enabled when AI generation is expected?
- Is a provider configured and passing its own test?
- Is the user relying on live AI output, or only loading/editing a local saved overlay?

Focused smoke evidence exists for the local builder harness, but not for live LLM output or OBS rendering.

## TTS With AI

AI replies can be paired with TTS. Use the TTS doc for provider details.

Common issue: the LLM reply appears in text but no audio plays. Check:

- TTS provider enabled.
- TTS-producing page open.
- Browser audio gate/OBS audio capture.
- Provider key/model/voice.
- Whether TTS is disabled or queue cleared.

## Free vs Paid Boundaries

Free/local:

- Ollama and local models can be free software paths but require user hardware.
- Browser local models can be free but may require model assets, memory, GPU/WASM support, and time. A focused static test passed on 2026-06-24 for Transformers remote-host defaults, but that does not prove runtime model loading.
- Local Gemma/Qwen registry wiring has focused static evidence, but that does not prove runtime model loading or device compatibility.

Paid/provider:

- OpenAI, Gemini, DeepSeek, xAI, Groq, OpenRouter, Bedrock, and similar cloud APIs depend on provider accounts, keys, quotas, and billing.

Do not frame cloud AI as included/free with SSN. SSN supports the integration; the provider controls pricing and access.

## Common Failures

| Symptom | Likely Cause | First Checks |
| --- | --- | --- |
| Provider test fails | Bad key/endpoint/model/CORS | Use built-in provider test; check endpoint from same surface. |
| Ollama works in app but not extension | CORS/origin issue | Configure `OLLAMA_ORIGINS`; restart Ollama/browser. |
| Bot does not reply | Bot disabled, trigger mismatch, rate limit, source cannot send | Enable bot, test provider, send manual chat, check triggers. |
| Messages vanish | AI censor strict/blocking mode | Disable moderation temporarily; check filters. |
| Local moderation behaves oddly | Prompt/provider/model/runtime issue | Check censor settings, provider choice, and whether a live runtime validation exists. |
| RAG answer ignores docs | Wrong bot/page or no documents loaded | Check uploaded docs and RAG setting. |
| Cohost overlay silent/blank | Overlay page/label missing | Open `cohost-overlay.html`; check target label/status. |
| AI generated overlay not appearing | Builder/runtime page mismatch or unsynced overlay | Confirm `aiprompt.html` saved/synced it, then open `aioverlay.html` with the same session and overlay name. |
| Local browser model slow | Hardware/runtime/model size | Use smaller model or hosted provider. |
| API key appears in URL/screenshot | Secret exposure | Rotate key if public; avoid sharing URLs with keys. |

## Safety Notes

- AI replies are generated content and can be wrong, unsafe, or off-brand.
- Use custom instructions and moderation, but do not treat them as guarantees.
- Test in a private session before live public replies.
- Rate-limit bot responses to avoid platform spam or account restrictions.
- Avoid sending private chat or sensitive viewer data to cloud providers unless the user understands the privacy boundary.

## Follow-Up Extraction Needs

- Exact current popup setting names and storage keys for AI features.
- Provider-by-provider request/response behavior from `ai.js` and background helpers.
- RAG file format/size/embedding behavior.
- Current cohost tool list and permission model.
- Runtime validation for AI moderation quality, local Gemma/Qwen browser loading, and OpenCode Zen live provider behavior.
- Runtime validation for real `aiprompt.html` extension sync, live LLM generation, and `aioverlay.html` OBS/render behavior.
- Runtime validation for real RAG upload/delete, popup/bot/chatbot UI, provider/model behavior, and app/extension storage.
- Intense validation of `../07-overlays-and-pages/ai-cohost-pages.md` against dock cohost commands, generated overlay runtime, and local model worker behavior.
- Runtime validation for local browser model loading, device fallback, and cohost/local model behavior.
