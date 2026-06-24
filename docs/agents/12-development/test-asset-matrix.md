# Existing Test And Validation Asset Matrix

Status: heavy inventory pass on 2026-06-24, plus focused config, generated metadata, Event Flow, Twitch, AI prompt builder, local TTS, local AI/moderation/provider fallback, and RAG test results. This page maps existing test assets and validation helpers. Except where a row explicitly says a test passed or failed, this does not mean those tests were run during this pass.

## Purpose

Use this page before creating a new validation plan. It answers:

- Which existing repo asset can support this claim?
- Which command or script should be tried first?
- What does the asset actually prove?
- What does it not prove?

Pair this page with `testing-and-validation.md`, `../16-runtime-validation-playbooks.md`, `../17-runtime-validation-evidence-log.md`, and `../18-focused-validation-evidence-log.md`.

## Source Anchors

- `package.json`
- `tests/*.test.js`
- `tests/*.html`
- `tests/fixtures/*`
- `tests/artifacts/*`
- `scripts/playwright-*.cjs`
- `scripts/aiprompt-*.cjs`
- `scripts/playwright-static-server.cjs`
- `scripts/validate-configs.sh`
- `ssapp/tests/tiktok/*`
- `ssapp/package.json`

## Evidence Boundaries

| Asset Type | Good Evidence For | Not Enough For |
| --- | --- | --- |
| Node test under `tests/*.test.js` | Parser logic, provider utility behavior, asset catalog checks, Event Flow logic, deterministic regressions. | Real Chrome extension behavior, OBS display, Electron app workflows, live platform health. |
| Browser fixture under `tests/*.html` | Manual or scripted local-page behavior, API/client experiments, SSE/WebSocket examples, local AI/RAG harnesses. | Live platform capture or app parity unless paired with a full workflow. |
| Playwright script under `scripts/*.cjs` | Headless browser behavior for overlays, AI prompt pages, local model checks, popup URL generation, page parsing. | OBS browser-source rendering, real user login/auth, Electron app windows, live platform selectors unless the script explicitly covers them. |
| npm package script | Repeatable focused regression or smoke command. | Full validation unless the npm script runs the real target workflow end to end. |
| Generated artifact under `tests/artifacts/*` | Prior benchmark/eval output and useful comparison baseline. | Current behavior unless regenerated on the current code. |

Do not report "tested" from this matrix alone. Report the exact command and result, then state what was not tested.

## Npm-Wired Commands

Current `social_stream/package.json` exposes these validation commands:

| Command | Primary Area | Notes |
| --- | --- | --- |
| `npm run test:rag:benchmark` | RAG benchmark | Runs `tests/rag-benchmark.test.js`. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `npm run test:rag:e2e` | RAG browser workflow | Runs `tests/rag-e2e.test.js`, which starts a local static server and uses a fixture dataset. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `npm run test:rag:scale` | RAG scale benchmark | Runs `tests/rag-scale-benchmark.test.js`; writes `tests/artifacts/rag-scale-benchmark-latest.json`, so only run when artifact writes are in scope. |
| `npm run test:aiprompt:smoke` | AI prompt page smoke | Runs `scripts/playwright-aiprompt-smoke.cjs`; headless browser with mocked bridge behavior. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `npm run test:aiprompt:adversarial` | AI prompt patching | Runs `scripts/aiprompt-ssnpatch-adversarial-e2e.cjs`; can use `AIPROMPT_ENDPOINT`, `AIPROMPT_API_KEY`, and `AIPROMPT_MODEL`. |
| `npm run test:aiprompt:conversation` | AI prompt conversation | Runs `scripts/playwright-aiprompt-conversation-e2e.cjs`. |
| `npm run test:aiprompt:expectations` | AI prompt expected behavior | Runs `scripts/playwright-aiprompt-expectations-e2e.cjs`. |
| `npm run lint:js` | JS lint | Broad ESLint pass. |
| `npm run lint:js:background:strict` | Background strict lint | Extra strict checks for `background.js`. |
| `npm run lint:js:background:indent-audit` | Background formatting check | Prettier check for `background.js`. |
| `npm run lint:js:background:format-audit` | Background formatting check | Prettier check for `background.js`. |
| `npm run local-tts-bridge` | Local TTS bridge | Starts `local-tts-bridge/server.cjs`; this is a service command, not a test by itself. |
| `npm run r2:large-assets:plan` | Large asset sync plan | Dry planning for R2 large assets. |
| `npm run r2:large-assets:verify` | Large asset verification | Verifies R2 large asset state. |

## Direct Shell Validation

Run these from the repository root.

| Command | Area | What It Checks |
| --- | --- | --- |
| `bash scripts/validate-configs.sh` | Settings config JSON | Parses `settings/config*.json` files and rejects duplicate JSON keys. Passed on 2026-06-24 for `settings/config_0.json`, `settings/config_linux_0.json`, and `settings/config_mac_0.json`; see `../18-focused-validation-evidence-log.md`. |
| Read-only inline Node metadata checker piped to `node -` | Generated metadata | VM-evaluates `shared/config/settingsDefinitions.js` and `shared/config/urlParameters.js`, bracket-matches `sitesData` from `docs/js/sites.js`, and checks counts, required fields, duplicate setting keys, duplicate URL aliases, and duplicate public site names. Completed on 2026-06-24 with findings: duplicate URL aliases for `password` and normalized `strokecolor`, plus duplicate public `On24`/`ON24` cards; see `../18-focused-validation-evidence-log.md`. |

## Direct Node Tests

Run these with `node tests/<file>.test.js` unless an npm alias exists.

| Test File | Area | What It Checks |
| --- | --- | --- |
| `eventflow-customjs.test.js` | Event Flow custom JS | Eval enablement detection for app-like contexts, extension blocking, trigger/action execution, syntax-error behavior. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `eventflow-compare-property.test.js` | Event Flow compare triggers | Property comparison behavior inside `actions/EventFlowSystem.js`. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `eventflow-template-vars.test.js` | Event Flow template variables | Template/counter variable substitution and message mutation behavior. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `eventflow-play-media-duration.test.js` | Event Flow media action | Overlay payload duration behavior for play-media actions. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `twitch-chatClient-subgift.test.js` | Twitch provider core | Direct and anonymous subgift membership payload shaping. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `profanity-filter.test.js` | Moderation/profanity | Profanity helper behavior. Passed on 2026-06-24 with 743 bad words and 18467 generated variations; see `../18-focused-validation-evidence-log.md`. |
| `moderation-regressions.test.js` | AI moderation | Local moderation context, stateless worker calls, WebGPU fallback expectations, sanitizer allowance checks. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `localqwen-censor-sequence-flow.test.js` | Local Qwen moderation | Compact sequence moderation flow. |
| `local-qwen-moderation-eval.test.js` | Local Qwen moderation eval | Browser-backed moderation eval harness. |
| `local-qwen-sequence-moderation-eval.test.js` | Local Qwen sequence eval | Sequence moderation eval harness. |
| `local-browser-model-registry.test.js` | Local browser AI model registry | Local Gemma/Qwen catalog exposure, self-hosted asset host, worker init defaults, popup/cohost provider visibility. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `local-browser-model-smoke.test.js` | Local browser AI extension smoke | Launches a persistent Chrome/Edge profile with the unpacked extension and runs `tests/local-browser-model-smoke.html`. Long-running and model-dependent. |
| `kokoro-local-assets.test.js` | Local TTS assets | Kokoro remote host, model/voice catalog, popup and TTS integration strings. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `piper-local-assets.test.js` | Local TTS assets | Piper model/asset expectations. Failed on 2026-06-24 on the expected `FALLBACK_REMOTE_PIPER_BASE` string; see `../18-focused-validation-evidence-log.md`. |
| `kitten-tts-assets.test.js` | Local TTS assets | Kitten TTS WASM/model path behavior. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `transformers-local-defaults.test.js` | Local AI asset defaults | Confirms bundled defaults point to `largefiles.socialstream.ninja` rather than Hugging Face. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `opencode-zen-fallback.test.js` | AI/provider fallback | OpenCode Zen fallback behavior. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `rag-benchmark.test.js` | RAG benchmark | Deterministic benchmark against fixture data. Passed on 2026-06-24 with 6 fixture documents, 3 processed chunks, 10/10 retrieval top1, 10/10 retrieval topK, and 8/8 question accuracy; see `../18-focused-validation-evidence-log.md`. |
| `rag-e2e.test.js` | RAG browser workflow | Starts a local server, opens `tests/rag-e2e.html`, seeds fixture documents, blocks external requests, verifies persistence after reload. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `rag-scale-benchmark.test.js` | RAG scale benchmark | Larger RAG benchmark and artifact generation path. Not run in the 2026-06-24 docs-only pass because it writes `tests/artifacts/rag-scale-benchmark-latest.json`. |

## Browser Fixture Pages

These are useful manual or script targets:

| Fixture | Use |
| --- | --- |
| `tests/browser-test.html` | General browser test harness. |
| `tests/sendapi.html` | Manual/API send tests. |
| `tests/sse.html` | SSE/API style test page. |
| `tests/nostr-test.html` | Nostr source experimentation. |
| `tests/multi.html` | Multi-source/manual test page. |
| `tests/emojis.html` | Emoji rendering checks. |
| `tests/rag-e2e.html` | Browser page used by `rag-e2e.test.js`. |
| `tests/local-browser-model-smoke.html` | Extension-hosted local model smoke harness. |
| `tests/local-qwen-moderation-eval.html` | Local Qwen moderation browser eval harness. |
| `tests/local-qwen-sequence-moderation-eval.html` | Local Qwen sequence moderation browser eval harness. |

## Shared Playwright Server

`scripts/playwright-static-server.cjs` exports `startStaticServer(options)`.

Observed behavior:

- Serves files from a selected root, usually the repo root.
- Defaults to `127.0.0.1:4173` when callers do not pass a port.
- Adds COOP/COEP/CORP headers, which matters for local AI and WASM assets.
- Blocks path traversal by ensuring resolved file paths stay under the root.
- Serves `index.html` for directory requests.

Many Playwright scripts use fixed ports. If a script hangs or fails to bind, check for a port conflict before treating product behavior as broken.

## Direct Playwright Scripts

Run these with `node scripts/<file>.cjs` unless an npm alias exists.

| Script | Area | Setup Assumptions |
| --- | --- | --- |
| `playwright-aiprompt-smoke.cjs` | AI prompt page | Starts local static server on port 4199, mocks the VDO bridge iframe, verifies startup sync, templates, patching, and preview behavior. Passed on 2026-06-24; see `../18-focused-validation-evidence-log.md`. |
| `playwright-aiprompt-conversation-e2e.cjs` | AI prompt conversation | npm-wired; validates conversation path with Playwright. Calls a live LLM endpoint by default; do not run during docs-only/local-only passes without explicit endpoint handling. |
| `playwright-aiprompt-expectations-e2e.cjs` | AI prompt expected behavior | npm-wired; validates expected AI prompt behavior. Calls a live LLM endpoint by default; do not run during docs-only/local-only passes without explicit endpoint handling. |
| `playwright-aiprompt-live-e2e.cjs` | AI prompt live behavior | Uses a live or configured endpoint; check environment variables before running. |
| `aiprompt-ssnpatch-adversarial-e2e.cjs` | AI prompt patch output | Uses `AIPROMPT_ENDPOINT`, `AIPROMPT_API_KEY`, and `AIPROMPT_MODEL`; default endpoint points at the SSN LLM endpoint with a test token fallback. |
| `aiprompt-overlay-e2e.cjs` | Generated overlay output | Accepts endpoint/model args or `AIPROMPT_*` env vars, starts local server on port 4201, runs generated overlay HTML in browser. |
| `aiprompt-overlay-replay.cjs` | Generated overlay replay | Replays a generated HTML file against a scenario using local server port 4202. |
| `aiprompt-vllm-e2e.cjs` | vLLM endpoint checks | Defaults to a local/private endpoint shape; configure endpoint/model before using. |
| `playwright-ai-stage-overlay-e2e.cjs` | AI stage overlay | Headless overlay behavior check. |
| `playwright-ai-chatbot-fake-integrations-e2e.cjs` | AI chatbot integrations | Uses fake integrations for repeatable chatbot validation, but removes `debug.log` in the repo root; avoid in docs-only write-boundary passes. |
| `playwright-cohost-configuredllm-e2e.cjs` | Cohost configured LLM | LLM-backed cohost path; inspect env/endpoint expectations first. |
| `playwright-cohost-customopenai-e2e.cjs` | Cohost custom OpenAI | Custom OpenAI-compatible endpoint path. |
| `playwright-cohost-customopenai-live-e2e.cjs` | Cohost custom OpenAI live | Live endpoint validation; avoid recording secrets. |
| `playwright-cohost-device-fallback-e2e.cjs` | Cohost device fallback | Local model device fallback behavior. |
| `playwright-cohost-file-worker-check.cjs` | Cohost file worker | Opens `cohost.html` by `file://` and checks worker bootstrap does not hit the null-origin failure. |
| `playwright-cohost-gemini-validation-e2e.cjs` | Cohost Gemini | Provider validation path; configure provider assumptions first. |
| `playwright-cohost-live-device-validation.cjs` | Cohost live device | Live local-device validation. |
| `playwright-cohost-localgemma-e2e.cjs` | Cohost local Gemma | Local model path; can be slow and hardware/browser dependent. |
| `playwright-cohost-localqwen-08b-e2e.cjs` | Cohost local Qwen | Local model path; can be slow and hardware/browser dependent. |
| `playwright-cohost-localqwen-partial-bundle-fallback-e2e.cjs` | Cohost local Qwen fallback | Partial bundle fallback behavior. |
| `playwright-cohost-localqwen-tts-emoji-e2e.cjs` | Cohost local Qwen plus TTS/emoji | Combined local AI/TTS/emoji behavior. |
| `playwright-local-browser-model-test.cjs` | Local browser model | Browser local model behavior. |
| `playwright-local-qwen-browser-test.cjs` | Local Qwen browser model | Local Qwen browser behavior. |
| `playwright-popup-localgemma-e2e.cjs` | Popup/local Gemma | Popup-generated settings and local Gemma path. |
| `playwright-multi-alerts-overlay-e2e.cjs` | Multi-alerts overlay | Starts local server on port 4178, stubs Chrome APIs, validates popup links and overlay behavior. |
| `playwright-reactions-overlay-e2e.cjs` | Reactions overlay | Starts local server on port 4177, stubs Chrome APIs, checks popup URL generation, URL parsing, VDO bridge behavior, layout/limit/server-mode behavior. |
| `playwright-scoreboard-e2e.cjs` | Scoreboard overlay | Starts local server on port 4181, validates preview data, layout, theme, filtering, and hidden-points behavior. |
| `playwright-tts-provider-check.cjs` | TTS providers | Uses live beta dock by default or local server with `--local`; supports `--providers=...`, `--url=...`, and `--block-local-piper-models`. |

## Feature-To-Test Routing

| Question Area | First Existing Asset | Follow-Up Needed Before Final Claim |
| --- | --- | --- |
| "Did this Event Flow trigger/action logic regress?" | `eventflow-*.test.js` focused Node tests. | Browser editor workflow if UI/editor behavior changed. |
| "Does custom JS execute in app-like mode and stay blocked in extension mode?" | `node tests/eventflow-customjs.test.js` | Real app/browser validation before claiming app e2e coverage. |
| "Did Twitch subgift payload text change?" | `node tests/twitch-chatClient-subgift.test.js` | Live Twitch/EventSub/IRC validation for broader Twitch claims. |
| "Did moderation/local censor logic regress?" | `node tests/profanity-filter.test.js`, `node tests/moderation-regressions.test.js`. Both passed on 2026-06-24 for static/VM checks. | Runtime local model validation, real chat classification quality, and current provider checks. |
| "Did local AI model registry/defaults change?" | `node tests/local-browser-model-registry.test.js`, `node tests/transformers-local-defaults.test.js`. Both passed on 2026-06-24 for static/catalog checks. | Browser model smoke/e2e for actual model load. |
| "Did OpenCode Zen free fallback behavior regress?" | `node tests/opencode-zen-fallback.test.js`, passed on 2026-06-24 for a stubbed retry sequence. | Live provider availability, current free/paid model status, and real API behavior. |
| "Does the extension-hosted local model smoke path work?" | `node tests/local-browser-model-smoke.test.js` | Long-running real browser run; document browser and hardware assumptions. |
| "Did RAG behavior regress?" | `npm run test:rag:e2e`, `npm run test:rag:benchmark`. Both passed on 2026-06-24 for the fixture harness. | Real popup/bot/chatbot upload/delete/provider workflows before user-facing runtime claims; run `test:rag:scale` only when artifact writes are allowed. |
| "Did generated AI prompt overlay behavior regress?" | `npm run test:aiprompt:smoke`, passed on 2026-06-24 for local mocked builder behavior; `aiprompt-overlay-e2e.cjs` for generated overlay output when endpoint/artifact assumptions are in scope. | Live provider validation, real extension sync, `aioverlay.html` runtime checks, and OBS/browser-source validation before user-facing runtime claims. |
| "Does cohost local/cloud provider behavior work?" | Matching `playwright-cohost-*.cjs` script. | Provider account/key, hardware, and privacy checks. |
| "Do multi-alerts, reactions, or scoreboard pages parse options and render sample payloads?" | Matching Playwright overlay script. | OBS/browser-source validation for actual production display. |
| "Do TTS providers initialize?" | Asset tests plus `playwright-tts-provider-check.cjs`. | Real audio device/browser/OBS validation for audible output claims. |
| "Are settings config JSON files well-formed?" | `bash scripts/validate-configs.sh`, passed on 2026-06-24 for the three current `settings/config*.json` files. | Feature-specific runtime validation if config behavior changed; this does not prove popup/app settings behavior. |
| "Are generated settings, URL parameter, and public-site metadata structurally complete?" | Read-only inline Node metadata checker, completed on 2026-06-24 with duplicate metadata findings; see `../18-focused-validation-evidence-log.md`. | Runtime validation of popup UI, generated docs UI, page-specific URL parsing, public supported-sites UI, app behavior, OBS, and live platform health. |
| "Does a public supported site work today?" | No broad existing automated coverage. | Use `../16-runtime-validation-playbooks.md` public-site health recipe. |
| "Does a command/API action work through HTTP/WebSocket?" | Some page scripts and examples exist, but no universal command runner. | Use command/API runtime playbook and record exact payload/target/result. |
| "Does the standalone app workflow work?" | App-specific tests live in `ssapp`; this repo matrix is supporting context only. | Run the real Electron app workflow per `ssapp` testing rules. |
| "Did the standalone app TikTok connector regress?" | `ssapp/package.json` TikTok aliases and `ssapp/tests/tiktok/*`; see `../08-platform-sources/tiktok-standalone-app.md`. | Run focused app regressions first, then a real Electron app workflow and live TikTok validation before final product claims. |

## Manual And Semi-Manual Assets

Use these when the issue is not covered by a focused automated test:

- `tests/sendapi.html` for API send/client experiments.
- `tests/sse.html` for SSE or stream-style behavior.
- `tests/browser-test.html` for general local browser checks.
- `tests/nostr-test.html` for Nostr-specific source experiments.
- `tests/multi.html` for multi-source/manual routing checks.
- `capture-editor-final.js` for the local actions editor capture path; it targets `http://localhost:7788/actions/index.html`.

Record these as manual or semi-manual validation, not automated product coverage.

## Common Setup Risks

- Playwright scripts require dependencies installed in `social_stream`.
- Several scripts use fixed localhost ports: examples include 4177, 4178, 4181, 4197, 4199, 4201, 4202, and 4217.
- Local AI, TTS, and model scripts can download or load large assets and may depend on WebGPU, WASM, browser version, GPU drivers, and memory.
- Live AI/provider scripts may use network endpoints and keys. Never paste secrets into docs or logs.
- Some scripts stub Chrome APIs or VDO bridge behavior. That makes them repeatable, but it also means they do not prove the real extension bridge or production relay is healthy.
- Headless browser success does not prove OBS browser-source behavior.
- A passing source-level or VM test does not prove current live platform selectors or auth flows.

## How To Report Results

Good reporting:

```text
Ran: node tests/eventflow-customjs.test.js
Result: passed
Evidence label: focused sanity test
Not tested: real app Event Flow editor UI, Chrome extension runtime, OBS output
```

Good failure report:

```text
Ran: node scripts/playwright-reactions-overlay-e2e.cjs
Result: failed binding port 4177
Evidence label: blocked
Next step: close the process using that port or rerun on a patched/free port before making product claims
```

Avoid:

```text
Fully tested.
```

## Update Checklist

When adding, renaming, or relying on a test asset:

1. Update this file.
2. Update `testing-and-validation.md` if the asset changes validation policy or common commands.
3. Update the narrow feature doc if the asset becomes the preferred validation path.
4. Add a pass entry in `../01-extraction-checklist.md`.
5. Run docs-only scope checks if only documentation changed.
