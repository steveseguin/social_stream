# Testing And Validation

Status: heavy extraction pass plus focused config, generated metadata, Event Flow, Twitch, AI prompt builder, local TTS, local AI/moderation/provider fallback, and RAG evidence on 2026-06-24.

## Purpose

Document available tests and how to describe validation honestly for SSN and SSApp work.

## Source Anchors

- `social_stream/package.json`
- `social_stream/tests/*`
- `social_stream/scripts/playwright-*.cjs`
- `ssapp/package.json`
- `ssapp/tests/electron/*`
- `ssapp/tests/tiktok/*`
- `ssapp/AGENTS.md`

## Core Testing Rule

For Electron/app changes, the `ssapp` instructions are explicit:

- Unit tests, smoke tests, syntax checks, mocked checks, and headless checks are supporting sanity checks only.
- Actual testing means functional in-app/end-to-end validation of the real user workflow in the running app.
- Do not report app changes as tested unless real in-app/e2e testing was performed.
- If only scripts/sanity checks ran, say that actual app testing remains incomplete.

For documentation-only changes, it is fine to report doc hygiene checks and source sanity tests as such. Do not call them functional app testing.

For step-by-step runtime validation recipes and evidence templates, use `../16-runtime-validation-playbooks.md`.

For actual runtime validation results, use `../17-runtime-validation-evidence-log.md`. For deterministic focused tests that are useful evidence but not full runtime validation, use `../18-focused-validation-evidence-log.md`.

For a feature-to-test routing matrix, npm command map, direct Node test list, browser fixture list, and Playwright setup assumptions, use `test-asset-matrix.md`.

## social_stream Package Scripts

Current package scripts include:

- `npm run test:rag:benchmark`
- `npm run test:rag:e2e`
- `npm run test:rag:scale`
- `npm run test:aiprompt:smoke`
- `npm run test:aiprompt:adversarial`
- `npm run test:aiprompt:conversation`
- `npm run test:aiprompt:expectations`
- `npm run local-tts-bridge`
- `npm run r2:large-assets:plan`
- `npm run r2:large-assets:verify`
- `npm run r2:large-assets:upload`
- `npm run lint:js`
- `npm run lint:js:background:strict`
- `npm run format:js:background`
- `npm run lint:js:background:indent-audit`
- `npm run lint:js:background:format-audit`

Use focused tests when the touched feature has one. Do not run broad expensive tests without a reason.

## Direct Validation Commands

Additional validation commands:

- `bash scripts/validate-configs.sh`
- Read-only inline Node metadata checker piped to `node -` for generated settings, URL parameter, and public-site metadata

Current focused evidence: on 2026-06-24, `bash scripts/validate-configs.sh` passed for `settings/config_0.json`, `settings/config_linux_0.json`, and `settings/config_mac_0.json`. This proves those files are valid JSON with no duplicate keys according to the script. It does not validate popup UI, generated settings docs, storage, migration, app behavior, or live setting changes.

Current focused metadata evidence: on 2026-06-24, a read-only inline Node checker confirmed `shared/config/settingsDefinitions.js` exposes 327 settings across 54 categories with no duplicate object-key tokens, missing generated category references, or missing required setting fields. It confirmed `shared/config/urlParameters.js` exposes 255 generated URL parameter items across 23 sections and 2 groups with no missing required URL parameter fields, but found duplicate URL aliases for `password` and normalized `strokecolor`. It confirmed `docs/js/sites.js` exposes 139 public site cards with no missing required public-card fields, but found duplicate public `On24`/`ON24` cards. This does not validate popup UI, generated docs UI, page-specific URL parsing, public supported-sites UI, app behavior, OBS, or live platform health.

## social_stream Node Tests

Notable tests found in `tests/`:

- `eventflow-customjs.test.js`
- `eventflow-compare-property.test.js`
- `eventflow-template-vars.test.js`
- `eventflow-play-media-duration.test.js`
- `twitch-chatClient-subgift.test.js`
- `profanity-filter.test.js`
- `moderation-regressions.test.js`
- `local-browser-model-smoke.test.js`
- `local-browser-model-registry.test.js`
- `local-qwen-*`
- `rag-*`
- `kokoro-local-assets.test.js`
- `piper-local-assets.test.js`
- `kitten-tts-assets.test.js`
- `transformers-local-defaults.test.js`

Event Flow tests are useful sanity checks for Event Flow docs and behavior claims, but they are not full UI testing.

Current focused evidence: on 2026-06-24, the four Event Flow Node tests listed above passed and were recorded in `../18-focused-validation-evidence-log.md`. The Twitch subgift provider test, AI prompt builder smoke test, profanity filter test, moderation regression test, local browser model registry test, OpenCode Zen fallback test, Kokoro asset test, Kitten TTS asset test, Transformers local-defaults test, and settings config JSON validation also passed. The generated metadata checker completed with duplicate URL alias and public site card findings. The RAG benchmark and RAG browser-fixture E2E tests passed for local fixture data. The Piper local asset test failed on an expected fallback remote-base string. These are focused checks only; they do not validate live platforms, real popup/bot/chatbot uploads, browser/app runtime behavior, OBS, audio playback, model loading, live provider availability, real moderation quality, live LLM generation, generated overlay quality, settings UI/storage behavior, generated docs UI behavior, page-specific URL parsing, public supported-sites UI behavior, or external integration behavior.

## social_stream Playwright Scripts

Notable Playwright scripts:

- `scripts/playwright-aiprompt-smoke.cjs`
- `scripts/playwright-aiprompt-live-e2e.cjs`
- `scripts/playwright-aiprompt-expectations-e2e.cjs`
- `scripts/playwright-aiprompt-conversation-e2e.cjs`
- `scripts/playwright-ai-stage-overlay-e2e.cjs`
- `scripts/playwright-ai-chatbot-fake-integrations-e2e.cjs`
- `scripts/playwright-cohost-*.cjs`
- `scripts/playwright-local-browser-model-test.cjs`
- `scripts/playwright-local-qwen-browser-test.cjs`
- `scripts/playwright-multi-alerts-overlay-e2e.cjs`
- `scripts/playwright-popup-localgemma-e2e.cjs`
- `scripts/playwright-reactions-overlay-e2e.cjs`
- `scripts/playwright-scoreboard-e2e.cjs`
- `scripts/playwright-tts-provider-check.cjs`

These scripts often start a static server or use custom page setup. If one times out, inspect setup assumptions before treating the feature as broken.

Current documentation pass note: `scripts/playwright-multi-alerts-overlay-e2e.cjs` timed out waiting for the preview frame harness. The docs hygiene checks passed, but that Playwright run did not complete.

## ssapp Package Scripts

Current app test/diagnostic scripts include:

- `npm run test:settings-loss`
- `npm run test:settings-rootcause`
- `npm run test:settings-transfer`
- `npm run test:stability-recovery`
- `npm run test:tts`
- `npm run test:socialstream-path-security`
- `npm run test:ipc-scaffold`
- `npm run test:source-url-parsing`
- `npm run test:tiktok-auto-mode`
- `npm run test:tiktok-gift-regression`
- `npm run test:tiktok-social-signals`
- `npm run test:recent-changes`

These are diagnostics/regression checks. They do not replace real in-app/e2e verification for app workflow changes.

## ssapp Electron Tests

Notable files under `ssapp/tests/electron/`:

- `settings-loss-diagnostics.js`
- `settings-rootcause-diagnostics.js`
- `settings-transfer-e2e.js`
- `stability-recovery-diagnostics.js`
- `source-url-parsing-regression.js`
- `socialstream-path-security-regression.js`
- `ipc-scaffold-regression.js`
- `tts-diagnostics.js`
- `window-state-diagnostics.js`
- `frame-fallback-diagnostics.js`

Use these to support claims about app state, IPC, URL parsing, path security, recovery, and settings transfer.

## ssapp TikTok Tests

Notable files under `ssapp/tests/tiktok/`:

- `run.js`
- `auto-mode-regression.js`
- `gift-count-regression.js`
- `social-signal-regression.js`
- `auth-ws-e2e.js`
- `authenticated-bootstrap-regression.js`
- `single-active-connection-regression.js`
- `dedupe-replay-regression.js`
- `event-capture-regression.js`
- `chat-emote-regression.js`
- `auto-fuzz-regression.js`
- `validate-403-bugs.js`

The app instructions also list manual TikTok commands:

```powershell
cd tests/tiktok
npm install
npm start
npm run ws
npm run legacy
npm run both
node run.js --mode=websocket --user=username --duration=30000
```

## Documentation Validation Checklist

For docs-only changes under `docs/agents`, run:

```powershell
rg -n "[^\x00-\x7F]" docs\agents
git diff --check -- docs/agents
git diff --name-only | Where-Object { $_ -notlike 'docs/agents/*' }
```

Interpretation:

- No output from the non-ASCII search is expected; `rg` exit code 1 means no matches.
- `git diff --check` should exit 0.
- Scope check should return no paths.

If docs cite behavior covered by a small source test, run that focused test, describe it as focused validation or a sanity check, and record the exact result in `../18-focused-validation-evidence-log.md` when the result is useful for future docs/support answers.

## Reporting Validation

Use clear labels:

- "Docs hygiene checks passed."
- "Focused sanity tests passed."
- "Playwright script timed out waiting for X."
- "No functional app/e2e testing was performed."
- "Actual app testing remains incomplete."

Do not say:

- "Fully tested" after only docs checks.
- "E2E tested" unless a real end-to-end workflow was exercised.
- "App tested" unless the running Electron app workflow was validated.

## Remaining Extraction Targets

- Keep `test-asset-matrix.md` current when Event Flow, AI, TTS, overlay, API, platform, or Playwright test assets change.
- Add practical manual test recipes for the most common support workflows.
