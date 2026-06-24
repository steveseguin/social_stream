# Focused Validation Evidence Log

Status: focused validation evidence entries updated on 2026-06-24.

## Purpose

Use this file to record deterministic validation results that are useful evidence but are not full runtime validation.

Examples:

- Focused Node tests.
- Parser or provider-core tests.
- Deterministic Event Flow tests.
- Asset catalog checks.
- Browser smoke tests that do not cover the real production workflow.

Keep `17-runtime-validation-evidence-log.md` for browser, app, OBS, API, source-page, live-platform, or integration runtime evidence. Do not promote a focused test result to `runtime-tested`, `browser-validated`, `app-e2e-validated`, or `obs-validated` unless a matching runtime pass was actually performed and recorded there.

## Evidence Rules

- Record the exact command, result, and what the test proves.
- Record what it does not prove.
- If a test uses a VM, stub, fake browser API, fixture, or synthetic payload, say so.
- Do not record real session IDs, passwords, OAuth tokens, API keys, webhook URLs, private endpoints, or private support identities.

## Evidence Entries

### Settings Config JSON Focused Validation

Validation date: 2026-06-24

Validator: Codex

Area: `settings/config*.json` parseability and duplicate-key detection

Evidence label: `focused-config-validation`; not runtime-tested

Command run:

```powershell
bash scripts/validate-configs.sh
```

Result:

```text
Validated settings/config_0.json
Validated settings/config_linux_0.json
Validated settings/config_mac_0.json
All config JSON files are valid.
```

Product surface: Shell/Python validation of JSON files matching `settings/config*.json`. The script parses JSON with duplicate-key detection. It does not load the extension popup, standalone app, settings UI, generated docs, browser storage, or any runtime page.

What this supports:

- `settings/config_0.json` parsed as valid JSON.
- `settings/config_linux_0.json` parsed as valid JSON.
- `settings/config_mac_0.json` parsed as valid JSON.
- The tested files did not contain duplicate JSON keys according to the script's strict object-pair hook.

What was not tested:

- Whether settings definitions in `shared/config/settingsDefinitions.js` are complete or correct.
- Whether URL parameter definitions in `shared/config/urlParameters.js` are complete or correct.
- Whether `docs/js/settings.js`, `docs/settings.html`, or public settings docs are current.
- Popup UI labels, generated links, import/export, Chrome storage, app storage, migration behavior, or live update/reload behavior.
- Platform-specific config behavior, OS packaging behavior, or Electron app behavior.

Docs updated:

- `12-development/test-asset-matrix.md`
- `12-development/testing-and-validation.md`
- `13-reference/settings-and-toggles.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

Follow-up:

- Runtime-validate popup/app settings workflows before saying settings are tested.
- Re-run generated settings and URL parameter extraction after config or settings-definition changes.
- Add focused validation for generated settings docs only if a script or explicit checker exists.

### Generated Metadata Focused Validation

Validation date: 2026-06-24

Validator: Codex

Area: generated popup setting definitions, generated URL parameter definitions, and public supported-site metadata

Evidence label: `focused-metadata-validation`; not runtime-tested

Command run:

```powershell
@'
# Read-only inline Node metadata checker:
# - VM-evaluate shared/config/settingsDefinitions.js after stripping ESM exports.
# - VM-evaluate shared/config/urlParameters.js after stripping ESM exports.
# - Bracket-match and VM-evaluate const sitesData from docs/js/sites.js.
# - Print counts, missing required fields, duplicate key/alias/name findings, and type counts.
'@ | node -
```

Result: completed with findings. The checker intentionally returned exit code 1 because duplicate metadata entries were found.

Summary output:

```text
settings:
  categories: 54
  settings: 327
  duplicateKeyTokens: 0
  missingCategoryRefs: 0
  missingRequiredFields: 0
  typeCounts: boolean=170, number=49, select=10, text=98

urlParameters:
  groups: 2
  sections: 23
  items: 255
  lookupEntries: 302
  aliasCount: 304
  missingRequiredFields: 0
  duplicateAliases:
    password: 2 owners, both key=password, in Basic Configuration Parameters and Privacy & Security Parameters
    strokecolor: 2 owners, both key=strokecolor, from aliases strokecolor and strokeColor in Visual Style Parameters

publicSites:
  sites: 139
  missingRequiredFields: 0
  typeCounts: manual=3, popout=23, standard=100, toggle=9, websocket=4
  duplicateNames:
    on24: 2 owners, card 72 On24 and card 116 ON24, both standard, both icon on24.png
```

Product surface: static metadata validation only. The checker evaluated generated/public data structures in Node without importing the extension runtime, opening `docs/settings.html`, opening `docs/supported-sites.html`, loading the popup, loading the standalone app, launching Chrome, loading OBS, or visiting any third-party platform.

What this supports:

- `shared/config/settingsDefinitions.js` currently exposes 327 settings across 54 categories.
- The checked setting definitions have no duplicate object-key tokens, missing generated category references, or missing required `type`/`category`/`description` fields.
- `shared/config/urlParameters.js` currently exposes 255 generated URL parameter items across 23 sections and 2 groups.
- The checked URL parameter items have no missing required `key`/`displayName`/`aliases`/`description` fields.
- `docs/js/sites.js` currently exposes 139 public site cards with the setup-type counts listed above.
- The checked public site cards have no missing required `name`/`description`/`icon`/`type`/`instructions` fields.

What this found:

- The generated URL parameter metadata has a `password` alias collision between two `password` entries in the dock parameter group.
- The generated URL parameter metadata has a normalized `strokecolor` alias collision because `strokecolor` and `strokeColor` are aliases for the same key.
- The public supported-site metadata has a duplicate normalized `on24` card: `On24` and `ON24`.

What was not tested:

- Popup settings UI behavior, storage, migration, generated links, live updates, or app parity.
- Page-specific URL parameter parsing outside the generated metadata.
- Whether duplicate aliases cause a user-visible issue in `docs/settings.html`, URL lookup code, overlay parsing, or generated links.
- Whether the duplicate `On24`/`ON24` cards both appear in the public supported-sites UI.
- Live platform health for any supported-site card.
- Browser extension runtime, standalone app runtime, OBS, hosted pages, third-party auth, or live source capture.

Docs updated:

- `08-platform-sources/supported-sites-lookup.md`
- `08-platform-sources/public-site-implementation-map.md`
- `12-development/test-asset-matrix.md`
- `12-development/testing-and-validation.md`
- `13-reference/settings-and-toggles.md`
- `13-reference/settings-key-index.md`
- `13-reference/url-parameter-index.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

Follow-up:

- Reconcile whether the two `password` metadata entries are intentional documentation duplication or should be consolidated.
- Reconcile whether the `strokecolor`/`strokeColor` normalized alias collision should be ignored as same-key aliasing or filtered in generated lookup diagnostics.
- Reconcile duplicate public `On24`/`ON24` cards before treating the 139-card list as 139 unique platform names.
- Runtime-validate `docs/settings.html`, `docs/supported-sites.html`, and any generated lookup UI before making user-facing claims about public docs display behavior.

### AI Prompt Builder Focused Browser Smoke Test

Validation date: 2026-06-24

Validator: Codex

Area: `aiprompt.html` builder/editor startup, template handling, mocked bridge sync, patching behavior, preview iframe payload handling, and local storage migration paths

Evidence label: `focused-browser-smoke`; not app/extension/OBS/runtime-tested

Command run:

```powershell
npm run test:aiprompt:smoke
```

Result: passed with output `aiprompt.html smoke test passed.`

Product surface: Headless Chromium against local `aiprompt.html` through `scripts/playwright-static-server.cjs` on `127.0.0.1:4199`. The script mocks the VDO.Ninja bridge iframe and chatbot responses. It does not use a live LLM provider, the real Chrome extension background/service worker, the standalone app, hosted pages, OBS, or real relay delivery.

Observed result:

- `aiprompt.html` loaded with session and timeout parameters.
- Startup sync published the local active overlay to the mocked remote store.
- The seeded chat overlay template loaded into the editor.
- Prompt guidance included expected bridge-label and `ssnpatch` JSON safety wording.
- Template modal opened and exposed at least six templates.
- New overlay pages received stable unique names.
- Deleting an overlay left the user request textbox focusable.
- Code and preview tabs switched correctly.
- The preview iframe accepted synthetic chat payloads.
- HTML chat content could render inline images when `textonly` was false.
- HTML-like chat content stayed literal when `textonly` was true.
- Mocked chatbot chunks and final responses settled through the builder.
- Local storage migration/sync paths were exercised for the builder store.

What was not tested:

- Live LLM/provider calls or model output quality.
- Real `chatbot`, `chatbotChunk`, or `chatbotResponse` delivery through the extension background.
- Real extension storage, Chrome profile storage, standalone app storage, or hosted-page sync.
- `aioverlay.html` runtime rendering in OBS.
- Real generated overlay behavior with live SSN payloads.
- Long-running editing sessions, import/export files, secrets, or provider keys.
- `npm run test:aiprompt:conversation` and `npm run test:aiprompt:expectations`; they call a live LLM endpoint by default.
- `node scripts/playwright-ai-chatbot-fake-integrations-e2e.cjs`; it deletes `debug.log` in the repo root, so it was not run during this docs-only pass.

Docs updated:

- `07-overlays-and-pages/ai-cohost-pages.md`
- `09-api-and-integrations/ai-features.md`
- `12-development/test-asset-matrix.md`
- `12-development/testing-and-validation.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

Follow-up:

- Run a real extension/background AI prompt workflow before claiming extension sync is runtime-tested.
- Run `aioverlay.html` with a saved overlay and controlled payloads before claiming generated overlays are browser/OBS validated.
- Run live LLM/provider tests only with explicit endpoint/key handling and secret-safe evidence capture.

### AI Moderation, Local Model Registry, And OpenCode Zen Focused Tests

Validation date: 2026-06-24

Validator: Codex

Area: profanity dataset/variation sanity, AI moderation context behavior, local browser model registry/defaults, and OpenCode Zen free-model fallback behavior

Evidence label: `focused-node-test`; not runtime-tested

Commands run:

```powershell
node tests/profanity-filter.test.js
node tests/moderation-regressions.test.js
node tests/local-browser-model-registry.test.js
node tests/opencode-zen-fallback.test.js
```

Results:

- `profanity-filter.test.js`: passed with output `[profanity-test] Loaded 743 bad words -> 18467 variations.`
- `moderation-regressions.test.js`: passed with output `moderation-regressions.test.js passed`.
- `local-browser-model-registry.test.js`: passed all 28 printed checks.
- `opencode-zen-fallback.test.js`: exited successfully; wrapper output recorded as `opencode-zen-fallback.test.js passed`.

Product surface: Node-based deterministic and VM/static-source checks. These tests inspect source files, shared data, catalog definitions, and extracted snippets. They do not open the real popup, bot UI, cohost page, Chrome extension runtime, standalone app, OBS, live provider endpoints, or actual model runtime.

Observed moderation/profanity result:

- The profanity dataset loaded 743 base entries and generated 18467 variations.
- Sentinel words existed in both the base profanity dataset and generated variation output.
- Blocked compact moderation fragments were not retained in later censor context.
- A harmless follow-up did not inherit a blocked compact sequence.
- Only allowed messages were added to the chat context in the tested snippet.
- Local moderation could still evaluate when shared censor slots were full.
- Local moderation reached the LLM call path instead of auto-blocking only because shared slots were full.
- Local browser moderation used stateless request wiring and did not persist moderation turns into normal conversation memory.
- The checked local worker/client source preserved WebGPU availability and recoverable WebGPU-to-WASM retry wiring.
- The LuckyLootTube sanitizer still allowed Kick emote URLs in the checked source.

Observed local browser model registry result:

- `localgemma` and `localqwen` configs existed.
- `localgemma` was marked vision-capable, used `Gemma4ForConditionalGeneration`, defaulted to q4 quantization, and used a self-hosted `socialstream.ninja` host.
- `localqwen` was marked text-only, used `Qwen3_5ForCausalLM`, defaulted to q4 embedding-token quantization, and used a self-hosted `socialstream.ninja` host.
- The model catalog did not reference Hugging Face in the checked JSON.
- Worker init preserved Gemma/Qwen runtime settings and normalized custom remote host strings.
- Popup and cohost HTML exposed `localgemma` and `localqwen` provider options.
- The local browser model worker and client retained checked WebGPU recovery and WASM reconnect strings.

Observed OpenCode Zen fallback result:

- Auto mode started from the remembered built-in free list.
- A retryable free-model failure fetched the live model list once.
- Cooling-down free models were skipped on the next request.
- Auto mode did not fall through to a paid model in the tested sequence.
- The model-list endpoint was not queried again inside the one-hour cache window.

What was not tested:

- Real AI moderation behavior in the popup, dock, bot, cohost, extension runtime, standalone app, or OBS.
- Whether a live model correctly classifies real chat, profanity edge cases, harassment, multilingual content, or platform-specific moderation events.
- Actual browser local model loading, model downloads, WebGPU/WASM execution, memory use, device fallback, or performance.
- Live OpenCode Zen endpoint availability, real account limits, provider pricing, paid/free model availability, network failures, or API response changes.
- Live provider calls, API keys, hosted pages, app source windows, or long-running state.
- `localqwen-censor-sequence-flow.test.js`, `local-qwen-moderation-eval.test.js`, or `local-qwen-sequence-moderation-eval.test.js`; those launch persistent browser contexts and/or write `tests/artifacts` reports, so they were intentionally not run during this docs-only pass.

Docs updated:

- `09-api-and-integrations/ai-features.md`
- `12-development/test-asset-matrix.md`
- `12-development/testing-and-validation.md`
- `13-reference/free-paid-and-support-boundaries.md`
- `11-support-kb/common-question-evidence-status.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

Follow-up:

- Run real browser/app/provider moderation workflows before claiming AI moderation is runtime-tested.
- Run local model browser/device validation before claiming local Gemma/Qwen model loading works on user hardware.
- Re-check live OpenCode Zen provider behavior and current pricing/model availability before making public cost or reliability claims.
- Run Qwen browser eval scripts only when writing `tests/artifacts` and creating temporary browser profiles is in scope.

### RAG Browser Fixture And Benchmark Tests

Validation date: 2026-06-24

Validator: Codex

Area: RAG/document-backed answer fixture loading, retrieval ranking, answer/abstain behavior, prompt placeholder handling, and persistence across reload

Evidence label: `focused-browser-fixture`; not app/extension/OBS/runtime-tested

Commands run:

```powershell
npm run test:rag:benchmark
npm run test:rag:e2e
```

Results:

- `test:rag:benchmark`: passed with output `PASS rag benchmark`.
- `test:rag:e2e`: passed with output `PASS rag e2e`.

Product surface: Headless Chromium tests against the local `tests/rag-e2e.html` fixture through `scripts/playwright-static-server.cjs`. The tests use fixture datasets, block external requests, and do not open the real popup, bot UI, Chrome extension runtime, standalone app, OBS, or a live provider.

Benchmark details:

- Loaded 6 fixture documents and 3 processed chunks.
- Retrieval top1: 10/10, 100.0%.
- Retrieval topK: 10/10, 100.0%.
- Question accuracy: 8/8, 100.0%.
- Answerable accuracy: 6/6, 100.0%.
- Abstain accuracy: 2/2, 100.0%.
- Question retrieval top1: 8/8, 100.0%.
- Question retrieval topK: 8/8, 100.0%.

Fixture E2E details:

- Seeded 3 fixture documents.
- Verified processed shipping/setup documents and a raw schedule document.
- Verified database descriptor generation.
- Verified exact and fuzzy search retrieval for fixture questions.
- Verified RAG answers for Canada shipping and Friday schedule questions.
- Verified off-topic questions returned `false` rather than forcing a bot answer.
- Verified RAG decision prompts used the generated descriptor and did not retain the literal `${databaseDescriptor}` placeholder.
- Reloaded the page and verified the same document count, search order, answer behavior, and off-topic abstain behavior persisted.
- Verified no unexpected page errors and no unexpected external requests.

What was not tested:

- Real user document upload, deletion, size limits, parsing, or file-type handling.
- Real popup settings, bot/chatbot UI, provider selection, API keys, or cloud model calls.
- Live embeddings, browser local model loading, WebGPU/WASM behavior, or remote model asset downloads.
- Chrome extension runtime storage, standalone app storage, app source windows, OBS Browser Source behavior, or hosted page behavior.
- Long-running document updates, concurrent documents beyond the benchmark fixture, user-specific private data, or live chat routing.
- `npm run test:rag:scale`; it writes `tests/artifacts/rag-scale-benchmark-latest.json`, so it was intentionally not run during this docs-only pass.

Docs updated:

- `09-api-and-integrations/ai-features.md`
- `12-development/test-asset-matrix.md`
- `12-development/testing-and-validation.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

Follow-up:

- Run real popup/bot/chatbot RAG workflows before claiming user-facing RAG is runtime-tested.
- Validate real upload/delete/file-size/file-type behavior before documenting hard limits.
- Run the scale benchmark only when writing `tests/artifacts/rag-scale-benchmark-latest.json` is in scope.

### Event Flow Focused Node Tests

Validation date: 2026-06-24

Validator: Codex

Area: Event Flow system internals, custom JS boundaries, compare-property triggers, template variables, counters, OBS system triggers, and play-media duration payloads

Evidence label: `focused-node-test`; not runtime-tested

Commands run:

```powershell
node tests/eventflow-customjs.test.js
node tests/eventflow-compare-property.test.js
node tests/eventflow-template-vars.test.js
node tests/eventflow-play-media-duration.test.js
```

Results:

- `eventflow-customjs.test.js`: `23 passed, 0 failed`
- `eventflow-compare-property.test.js`: `18 passed, 0 failed`
- `eventflow-template-vars.test.js`: `6 passed, 0 failed`
- `eventflow-play-media-duration.test.js`: `2 passed, 0 failed`

Product surface: Node-based deterministic tests against Event Flow source logic. These tests do not open the Event Flow editor UI, the Flow Actions overlay, OBS, the Chrome extension runtime, or the standalone Electron app.

Input payloads or actions:

- Synthetic/custom JS Event Flow trigger and action definitions.
- Synthetic app-like and extension-like context detection objects.
- Synthetic message/event payloads for compare-property tests.
- Synthetic OBS system payloads for stream, recording, scene, and replay-buffer events.
- Synthetic counter state and template strings.
- Synthetic `playTenorGiphy` action options with `duration: 0` and undefined duration.

Observed result:

- Event Flow custom JS eval support was allowed in SSApp/Electron-like contexts and blocked in a Chrome-extension-like context.
- Explicit `allowEvalCustomJs` options overrode context detection.
- Custom JS triggers returned expected booleans in the allowed context.
- Custom JS syntax errors failed the node without failing the whole test run.
- Custom JS actions could mutate the message in the allowed context and were blocked when eval was disabled.
- `compareProperty` supported string equality and numeric comparisons.
- Digit-prefixed strings were treated as strings for exact matching rather than by numeric prefix only.
- OBS system payloads matched OBS-specific triggers and did not trigger `anyMessage`.
- Template rendering included dynamic top-level fields and derived `counterRemaining`.
- `checkCounter` exposed `counterValue`, `counterTarget`, and `counterRemaining`.
- `playTenorGiphy` preserved explicit `duration: 0` and used `10000` ms when duration was undefined.

What was not tested:

- Event Flow editor UI creation, saving, import/export, or active-flow toggles.
- Flow Actions overlay rendering or audio playback.
- OBS Browser Source behavior.
- OBS WebSocket behavior.
- Webhook, relay, Spotify, TTS, MIDI, points, or send-message actions.
- Chrome extension runtime behavior beyond the test's context detection objects.
- Standalone app runtime behavior beyond the test's app-like context detection objects.
- Live source payloads, session routing, labels, passwords, or long-running state.

Docs updated:

- `09-api-and-integrations/event-flow-editor.md`
- `13-reference/customization-path-decision-matrix.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

Follow-up:

- Runtime-validate Event Flow editor UI and Flow Actions overlay behavior before calling flows browser-validated.
- Validate OBS actions against OBS WebSocket v5 and/or OBS Browser Source access before making OBS control claims.
- Run targeted tests for webhook, relay, TTS, Spotify, MIDI, points, and send-message actions before promoting those action families.

### Twitch Provider Subgift Focused Node Test

Validation date: 2026-06-24

Validator: Codex

Area: Twitch provider chat normalization, gifted subscription event summaries

Evidence label: `focused-node-test`; not runtime-tested

Command run:

```powershell
node tests/twitch-chatClient-subgift.test.js
```

Result: passed with output `twitch-chatClient-subgift.test.js passed`.

Product surface: Node-based deterministic test of `providers/twitch/chatClient.js` loaded into a VM with a fake tmi.js-style client. This test does not connect to Twitch, EventSub, IRC, a browser tab, the extension runtime, OBS, or the standalone app.

Input payloads or actions:

- Synthetic `subgift` event for gifter `THErealNEDRYERSON`, recipient `abookwitch`, and gift count 7.
- Synthetic `anonsubgift` event for recipient `quietviewer`.

Observed result:

- Two membership payloads were emitted.
- Direct gifted sub payload used `chatname: "THErealNEDRYERSON"`.
- Direct gifted sub message became `THErealNEDRYERSON gifted a sub to abookwitch!`.
- Direct gifted sub donation summary became `THErealNEDRYERSON gifted a sub to abookwitch`.
- Anonymous gifted sub payload used `chatname: "Anonymous"`.
- Anonymous gifted sub message became `Anonymous gifted a sub to quietviewer!`.

What was not tested:

- Live Twitch IRC/EventSub behavior.
- Twitch OAuth, scopes, reconnects, or send-back.
- DOM capture path in `sources/twitch.js`.
- OBS overlays, Event Flow runtime, standalone app bridge behavior, or live platform permissions.

Docs updated:

- `08-platform-sources/twitch.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

Follow-up:

- Validate live Twitch gifted subscription payloads through the actual WebSocket/EventSub path before making a live-platform claim.
- Validate downstream alert/leaderboard/Event Flow handling for these payloads separately.

### Local TTS And Local AI Asset Wiring Focused Tests

Validation date: 2026-06-24

Validator: Codex

Area: Local/browser TTS asset wiring and local AI Transformers default host wiring

Evidence label: `focused-node-test`; not runtime-tested

Commands run:

```powershell
node tests/kokoro-local-assets.test.js
node tests/piper-local-assets.test.js
node tests/kitten-tts-assets.test.js
node tests/transformers-local-defaults.test.js
```

Results:

- `kokoro-local-assets.test.js`: passed with output `PASS kokoro local asset wiring`
- `piper-local-assets.test.js`: failed with an assertion error
- `kitten-tts-assets.test.js`: passed with output `PASS kitten TTS asset wiring`
- `transformers-local-defaults.test.js`: passed with output `PASS transformers local defaults`

Piper failure detail:

```text
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert.ok(properPiperFile.includes("const FALLBACK_REMOTE_PIPER_BASE = 'https://raw.githubusercontent.com/steveseguin/social_stream/beta/thirdparty/piper';"))
```

Follow-up source check:

- `thirdparty/piper/piper-tts-web.js` still contains `const DEFAULT_REMOTE_PIPER_BASE = "https://largefiles.socialstream.ninja/piper";`.
- `thirdparty/piper/piper-tts-proper.js` still contains `const DEFAULT_REMOTE_PIPER_BASE = 'https://largefiles.socialstream.ninja/piper';`.
- `thirdparty/piper/piper-tts-proper.js` did not contain the exact fallback constant expected by the test.

Product surface: Node-based static asset wiring tests. These tests inspect source bundles and configuration strings. They do not load models, generate audio, open a browser, test WebGPU/WASM runtime, run OBS, validate the standalone app, or call external providers.

Observed result:

- Kokoro catalog wiring pointed at `https://largefiles.socialstream.ninja/` and exposed 28 unique voices.
- Kokoro model URLs used the q8 and fp16 ONNX asset paths expected by the test.
- Kokoro TTS source included parameters for `kokorospeed`, `kokorodevice`, and `kokorodtype`.
- Kokoro browser and extension bundles did not include Hugging Face remote-host defaults checked by the test and did include `largefiles.socialstream.ninja`.
- Kitten TTS source included explicit WASM path mapping and called `TTS.kittenInstance.init(modelUrl, voicesUrl, kittenWasmPaths)`.
- Transformers core/web bundles used `https://largefiles.socialstream.ninja/` as the remote host and did not include the Hugging Face default host strings checked by the test.
- Piper local asset test did not pass because the expected fallback remote constant was absent from `piper-tts-proper.js`.

What was not tested:

- Whether Kokoro, Kitten, Piper, or Transformers models actually download at runtime.
- Browser audio playback.
- OBS Browser Source audio capture.
- WebGPU, WASM, CPU fallback, memory, device compatibility, or model performance.
- Cloud TTS providers.
- Local TTS bridge behavior.
- Standalone app TTS behavior.

Docs updated:

- `09-api-and-integrations/tts.md`
- `09-api-and-integrations/ai-features.md`
- `13-reference/free-paid-and-support-boundaries.md`
- `11-support-kb/common-question-evidence-status.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

Follow-up:

- Investigate the Piper fallback expectation before using the Piper focused test as passed evidence.
- Run browser/runtime TTS checks before claiming audio output works.
- Run OBS validation before claiming OBS Browser Source audio capture works.

### API Command Examples Documentation Consistency Check

Validation date: 2026-06-24

Validator: Codex

Area: API command examples, action lookup, validation matrix, and source-trace documentation consistency

Evidence label: `focused-doc-consistency`; not runtime-tested

Command run:

```powershell
node -e "<static extractor over docs/agents/13-reference/api-command-examples.md, action-command-index.md, api-command-validation-matrix.md, and command-action-source-trace.md>"
```

Product surface: static Markdown/source-reference consistency only. This check did not connect to `io.socialstream.ninja`, open a browser page, run OBS, exercise platform source tabs, or start the standalone app.

Observed result:

- Extracted 29 distinct action names from `api-command-examples.md`.
- Initial comparison found zero missing entries from `action-command-index.md`.
- Initial comparison found `content4` missing from explicit validation-matrix/source-trace text and found several grouped actions missing from literal source-trace coverage.
- After doc updates, the rerun found zero missing example actions across `action-command-index.md`, `api-command-validation-matrix.md`, and `command-action-source-trace.md`.
- The check verifies documentation consistency only; each action still needs transport/page/runtime validation before final recipes are called tested.

Docs updated:

- `13-reference/api-command-examples.md`
- `13-reference/api-command-validation-matrix.md`
- `13-reference/command-action-source-trace.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`
- `14-validation-and-refresh-roadmap.md`

Follow-up:

- Runtime-test representative HTTP and WebSocket examples before calling them tested.
- Validate numbered channel content actions such as `content4` against real relay/page behavior before promising a visible page result.
- Keep `blockUser`, `getQueueSize`, send-back, and target-label examples marked as transport/page dependent until runtime evidence exists.
