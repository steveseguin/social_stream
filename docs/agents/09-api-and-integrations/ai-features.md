# AI Features

Status: heavy extraction pass started from `docs/commands.html`, `ai.md`, `background.js`, shared AI files, and AI page inventory.

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
- `tests/rag-*.test.js`

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

Agent guidance:

- RAG answers depend on uploaded documents and selected bot surface.
- Private `chatbot.html` can have separate chat/RAG behavior from the main bot according to command docs.
- Do not assume a document is loaded just because RAG is enabled.
- For stale/wrong answers, ask what files were uploaded and whether the correct bot/page is being used.

## AI Moderation/Censor

Command docs mention content moderation with non-blocking or strict blocking modes. Background code has LLM censor paths around incoming messages.

Support guidance:

- If messages disappear unexpectedly, check AI censor/moderation settings as well as normal filters.
- Strict/blocking modes can prevent messages from reaching overlays.
- Provider latency or failures may affect moderation timing.
- For high-risk broadcasts, test moderation behavior before live use.

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
- Browser local models can be free but may require model assets, memory, GPU/WASM support, and time.

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
| RAG answer ignores docs | Wrong bot/page or no documents loaded | Check uploaded docs and RAG setting. |
| Cohost overlay silent/blank | Overlay page/label missing | Open `cohost-overlay.html`; check target label/status. |
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
- Summaries from Playwright AI and RAG tests.
