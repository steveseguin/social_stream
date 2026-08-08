# AI And Cohost Pages

Status: heavy extraction pass from `cohost.html`, `cohost-overlay.html`, `aioverlay.html`, `aiprompt.html`, `message-ai-export.html`, `background.js`, `ai.js`, `shared/aiPrompt/overlayStore.js`, and `docs/ai-cohost-guide.html` on 2026-06-24, plus focused `aiprompt.html` browser-smoke evidence.

Use this page when a user asks which AI page to open, why the cohost overlay is blank, why generated AI overlays are not loading, how `aiprompt.html` and `aioverlay.html` relate, or why AI requests time out.

## Source Anchors

- `cohost.html`
- `cohost-overlay.html`
- `aioverlay.html`
- `aiprompt.html`
- `message-ai-export.html`
- `background.js`
- `ai.js`
- `shared/aiPrompt/overlayStore.js`
- `docs/ai-cohost-guide.html`
- `docs/agents/09-api-and-integrations/ai-features.md`
- `docs/agents/09-api-and-integrations/tts.md`
- `docs/agents/18-focused-validation-evidence-log.md`

## Focused Validation Evidence

On 2026-06-24, this focused browser smoke test passed:

```powershell
npm run test:aiprompt:smoke
```

Result: `aiprompt.html smoke test passed.`

Evidence label: `focused-browser-smoke`; not app/extension/OBS/runtime-tested.

What this supports: local headless Chromium behavior for `aiprompt.html` startup, mocked bridge sync, seeded template loading, template modal, unique page naming, delete focus behavior, code/preview tab switching, preview iframe chat payload handling, `textonly` HTML behavior, mocked chatbot chunk/final settling, and builder localStorage migration/sync paths.

What it does not support: live LLM provider calls, real extension background/service-worker delivery, standalone app behavior, hosted sync, `aioverlay.html` runtime behavior, OBS rendering, real generated overlay quality, or live SSN payload handling.

## Page Roles

| Page | Role | OBS Output | Needs Session | Needs AI Provider |
| --- | --- | --- | --- | --- |
| `cohost.html` | Multimodal cohost control/conversation page. Can monitor live chat and talk to AI providers. | Usually no; it is the control/conversation surface. | Yes for SSN live chat and configured popup LLM bridge. | Yes for AI responses, except local/manual UI actions. |
| `cohost-overlay.html` | Stage/avatar/speech-bubble output for cohost and AI overlay commands. | Yes. This is the normal OBS stage overlay. | Yes for session bridge/server mode, unless testing direct `postMessage`. | No for direct `say`/`emote`; yes upstream when AI generates text. |
| `aiprompt.html` | AI-assisted custom overlay builder/editor. Builds, previews, saves, syncs, and asks the configured private chatbot to generate HTML. | No; builder/editor. | Optional for local editing; required for AI requests and extension sync. | Yes for AI generation. |
| `aioverlay.html` | Runtime page that loads a saved/generated AI overlay and forwards live SSN payloads to it. | Yes. This is the OBS page for generated overlays. | Yes for live data and extension sync; can load local saved overlay without session. | No at runtime unless the generated overlay itself calls AI. |
| `message-ai-export.html` | AI/export helper page by filename; not a primary live overlay route in current agent docs. | No normal route yet. | Source-check before recipes. | Depends on workflow; source-check before support answers. |

## First Choice Routing

| User Wants | Use This |
| --- | --- |
| AI avatar/speech bubble in OBS | `cohost-overlay.html?session=SESSION_ID&tts` |
| Multimodal cohost that sees/hears media and can monitor live chat | `cohost.html?session=SESSION_ID` |
| Dock right-click "Co-host" stage output | `cohost-overlay.html?session=SESSION_ID&label=cohost-overlay` plus the dock |
| Generate a custom overlay with AI | `aiprompt.html?session=SESSION_ID` |
| Put an AI-generated custom overlay in OBS | `aioverlay.html?session=SESSION_ID&overlay=OVERLAY_NAME` |
| Test/edit generated overlay locally without AI | `aiprompt.html` local state and preview |

## Cohost Stage Overlay

`cohost-overlay.html` is the playout surface. It receives targeted `aiOverlay` or `cohostOverlay` payloads and displays an avatar, emotion, name, speech text, and optional browser TTS.

Typical URL:

```text
https://socialstream.ninja/cohost-overlay.html?session=SESSION_ID&tts
```

Common URL parameters:

| Parameter | Behavior |
| --- | --- |
| `session` / `room` | SSN session room. |
| `password` | Optional session password. |
| `label` | Target label; default is `cohost-overlay`. |
| `name` / `botname` | Default speaker name; default is `AI`. |
| `avatar` | Default avatar image URL. |
| `position` | Stage position; default is `bottom-right`. |
| `scale` | CSS scale; default `1`. |
| `hideafter` | Clears the bubble after this many ms; default `12000`. |
| `tts` / `speak=1` | Enables browser speech synthesis. Payload still needs `tts` or `speak` for that message. |
| `hideidle` | Hides the stage when idle. Without it the stage starts visible. |
| `hidebubble` / `bubble=0` | Hides the speech bubble. |
| `pagebg` | Sets page background color. |
| `status` | Shows connection/status text. |
| `preview` | Prevents the session bridge from opening. Useful for direct test messages. |
| `server` | Uses API WebSocket mode; default `wss://io.socialstream.ninja/api` unless `localserver` is present. |
| `server2` / `server3` | Uses extension WebSocket mode; default `wss://io.socialstream.ninja/extension` unless `localserver` is present. |
| `localserver` | Uses `ws://127.0.0.1:3000`. |
| `out` / `outchan` | WebSocket out channel; default `3`. |
| `in` / `inchan` | WebSocket in channel; default `4`. |

Default bridge behavior:

- If `session` is present and `preview` is absent, the page creates a hidden VDO.Ninja iframe.
- The iframe uses `label=LABEL`, `view=SESSION`, and `room=SESSION`.
- Messages are accepted only from that bridge frame for bridge-origin payloads.

Server behavior:

- `server`, `server2`, `server3`, and `localserver` open WebSocket mode.
- The socket sends `{ join: sessionId, out: outChannel, in: inChannel }`.
- Reconnects are automatic.

## Cohost Overlay Payloads

Accepted wrapper shapes include:

- `dataReceived.overlayNinja`
- `overlayNinja`
- `aiOverlay`
- `cohostOverlay`
- direct payloads with `chatmessage` or `text`
- chunked `ssnBridgeChunk` payloads

Targeting:

- If `target` is missing, `null`, or `*`, the page accepts it.
- Otherwise `target` must match the page `label`.

Command handling:

| Command | Behavior |
| --- | --- |
| `say` / `speak` | Shows text, name/avatar if provided, sets emotion, and optionally speaks. |
| `emote` | Changes avatar emotion/talking state. |
| `show` | Shows the stage. |
| `hide` | Hides the stage. |
| `clear` | Clears text and bubble. |
| `setavatar` | Sets avatar image from `avatar` or `url`. |

Common meta fields:

- `text`, `value`, or `chatmessage`
- `name` or `chatname`
- `avatar` or `chatimg`
- `emotion` or `mood`
- `talking`
- `tts` or `speak`
- `command`

Debug helper:

- The page exposes `window.__aiStageOverlay.processPayload(...)`.
- It also exposes `getState()`, `clear()`, `hide()`, and `show()`.

## Cohost Control Page

`cohost.html` is a full control/conversation surface. It includes camera/audio controls, provider selection, system prompt, Live Chat mode, diagnostics, and a start/connect flow.

Provider paths visible in current source include:

- Google Gemini Live.
- Local Qwen browser model.
- Local Gemma browser model, with user-hosted assets.
- OpenAI-compatible custom endpoint.
- SSN Configured LLM, which uses the provider configured in the SSN popup.
- Realtime-style providers shown in code paths such as OpenAI/xAI.

Important URL/query behavior:

| Parameter | Behavior |
| --- | --- |
| `session` | Required for SSN live chat and configured popup LLM bridge. |
| `password` | Optional session password. |
| `aioverlay` / `overlaylabel` / `cohostOverlayLabel` | Target label for mirrored overlay payloads; default `cohost-overlay`. |
| `noaioverlay` / `nooverlay` | Stops mirroring cohost output to the stage overlay. |
| `livechat` / `chat` | Sets live chat mode. Values: `off`, `monitor`, `questions`, `all`; truthy values map to `questions`. |
| `nochat` | Forces live chat off. |
| `server`, `server2`, `server3`, `localserver` | Live-chat WebSocket transport options. |

Live Chat mode:

| Mode | Behavior |
| --- | --- |
| `off` | Does not process SSN chat feed. |
| `monitor` | Receives and displays last chat status but does not prompt the AI. This is the default. |
| `questions` | Prompts the AI for questions, mentions, or messages containing cohost/host/AI/bot language. |
| `all` | Prompts the AI for every received message, subject to queue/rate checks. |

Live Chat state:

- Stored in localStorage key `cohostLiveChatMode`.
- Queue cap is 5.
- Prompt age limit is 45 seconds.
- Minimum prompt interval is 3500 ms.
- Response settle time is 1200 ms.

Live Chat transport:

- WebSocket mode uses `{ join: room, out: 3, in: 4 }`.
- Bridge mode uses a hidden VDO.Ninja iframe with `label=cohost`.
- Chat/control payloads such as `aiOverlay`, `cohostOverlay`, `chatbot`, `chatbotChunk`, `chatbotResponse`, and AI prompt overlay responses are ignored by the live-chat input filter.

Configured LLM bridge:

- `cohost.html` can use the SSN popup's configured LLM provider through a hidden bridge labeled `cohost-llm`.
- If no `session` is present, the configured LLM bridge cannot reach the SSN background service.
- Timeouts tell the user to check that SSN is on, the same session is used, and Chat Bot - Private Interface is enabled.

Stage mirroring:

- `cohost.html` sends `aiOverlay` payloads to the label from `aioverlay`, `overlaylabel`, or `cohostOverlayLabel`, defaulting to `cohost-overlay`.
- It sends `say` and `emote` commands.
- `noaioverlay` or `nooverlay` disables this mirroring.

## AI Prompt Builder

`aiprompt.html` is an AI-assisted overlay builder. It can create/edit overlay HTML, preview it, save it locally, sync it to the extension, and generate an `aioverlay.html` URL for OBS.

Focused browser-smoke evidence exists for the local builder workflow: `npm run test:aiprompt:smoke` passed on 2026-06-24 with a mocked VDO bridge and mocked chatbot responses. Use this as regression evidence for the builder harness only, not as proof of live AI generation, real extension sync, app behavior, or OBS output.

Typical URL:

```text
https://socialstream.ninja/aiprompt.html?session=SESSION_ID
```

Key behavior:

- Loads and saves builder pages through `shared/aiPrompt/overlayStore.js`.
- Local storage key is `ssnAiPromptPagesV2`; legacy key is `ssnAiPromptPagesV1`.
- Default templates include blank canvas, chat overlay, alert banner, viewer counter ticker, sub goal tracker, and starting soon/BRB.
- `aitimeout` controls AI request timeout; default is 180000 ms, minimum clamped to 500 ms.
- Local editing, preview, import, and export can work without `session`.
- AI generation and extension sync need a session bridge.

Session bridge:

- Hidden VDO.Ninja iframe uses `label=aiprompt`.
- AI requests send `{ action: "chatbot", value: prompt, target: MESSAGE_ID, turbo: false }`.
- Large bridge payloads are chunked with `ssnBridgeChunk`, using 12000-character chunks.
- The background replies with `chatbotChunk` and `chatbotResponse`.

Required SSN setup for AI generation:

- SSN must be on and using the same session.
- A supported LLM provider must be configured in the popup.
- The Private Chat Bot setting must be enabled. In generated setting keys this is `allowChatBot`.

Overlay sync:

- `aiprompt.html` sends `saveAiPromptOverlays` to the background.
- The background saves normalized overlay packages to `chrome.storage.local` key `aiPromptOverlays`.
- `aiprompt.html` can request existing packages with `getAiPromptOverlays`.
- Responses can be chunked when the package is large.

Generated overlay safety rules baked into the prompt:

- Default live chat overlays should use `label=dock`.
- Dedicated auction/commerce/viewer-meta overlays should use `label=meta`.
- Generated overlays should expose `window.handleOverlayPayload`.
- Plain chat is valid with `chatname`, `chatmessage`, `chatimg`, and `type`; it does not require `event`.
- Alert and metadata overlays should preserve unrelated event branches when edited.
- If rendering `chatmessage` as HTML, only that field should use `innerHTML` unless the overlay has explicit sanitization logic.

## AI Overlay Runtime

`aioverlay.html` is the runtime page for generated overlays.

Typical URL:

```text
https://socialstream.ninja/aioverlay.html?session=SESSION_ID&label=aioverlay&overlay=chat-overlay
```

What it loads:

- First tries localStorage state through `OverlayStore.localStateToPackage(localStorage)`.
- If `session` is present, creates a bridge frame with `label=aioverlay` and requests saved extension overlays.
- Selects the requested overlay using `overlay=NAME`; if omitted, uses the active overlay.
- If no saved overlay is found, logs an error instructing the user to open `aiprompt.html`, save, and reload.

Transport:

| Mode | Behavior |
| --- | --- |
| Default bridge | Hidden iframe with `label=aioverlay`, `view=session`, and `room=session`. |
| `server` | API WebSocket default `wss://io.socialstream.ninja/api`, joining out `2`, in `1`. |
| `server2` / `server3` | Extension WebSocket default `wss://io.socialstream.ninja/extension`, joining out `3`, in `4`. |

Payload forwarding:

- Incoming `dataReceived.overlayNinja`, `overlayNinja`, or plain payloads are forwarded to the generated overlay iframe.
- The generated overlay receives `{ dataReceived: { overlayNinja: payload } }` through `postMessage`.
- Payloads wait in a queue until the generated overlay iframe is ready.
- Pending queue is capped at 100 payloads.
- Metadata-like duplicate payloads are suppressed for about 500 ms.

Support rule: `aioverlay.html` is not the builder. If it shows no saved overlay, the user needs to save from `aiprompt.html` or use a browser/profile that has the local saved state.

## Background Actions

Relevant bridge actions in `background.js`:

| Action | Behavior |
| --- | --- |
| `aiOverlay` | Normalizes and sends an overlay command to the configured/target overlay label. |
| `cohostOverlay` | Same route, with source metadata set to `cohost`. |
| `saveAiPromptOverlays` | Normalizes and saves generated overlay package to `chrome.storage.local.aiPromptOverlays`. |
| `getAiPromptOverlays` | Loads generated overlay package and returns it, chunked if large. |
| `chatbot` with `target` | Uses the private chatbot path when `allowChatBot` is enabled; streams chunks or final response. |
| `cohostToolStatus` | Returns available cohost tool status. |
| `cohostTool` | Runs a cohost tool request and returns a response. |

AI chat bot replies can also send overlay commands through `ai.js` when `aiOverlayFromChatBot` is enabled. The default target comes from `aiOverlayLabel` or falls back to `cohost-overlay`; TTS behavior uses `aiOverlayTts`.

## Common Support Issues

Cohost overlay is blank:

- Confirm `cohost-overlay.html` is open with the same `session`.
- Confirm the payload target matches `label`; default label is `cohost-overlay`.
- If the dock cohost menu is missing, the stage overlay is not detected in the same session.
- If using `hideidle`, send a `show`, `say`, or `emote` command.

Text appears but no audio:

- Add `&tts` or `&speak=1` to `cohost-overlay.html`.
- The incoming payload still needs `meta.tts` or `meta.speak`.
- Check browser autoplay/audio gate and OBS Browser Source audio capture.

Answer or Light Roast times out:

- Confirm SSN is on and the same session is used.
- Enable Chat Bot - Private Interface (`allowChatBot`).
- Check the selected LLM provider, endpoint, key, model, CORS, and billing/quota.
- For hosted trial LLM, remember it can be disabled or rate-limited.

`cohost.html` sees no live chat:

- Add `?session=SESSION_ID`.
- Use Live Chat mode `monitor`, `questions`, or `all`; `off` and `nochat` disable it.
- Check source side is sending normal chat payloads.
- If using server mode, confirm the WebSocket route and channels.

Generated AI overlay does not load:

- Open `aiprompt.html`, save the overlay, then reload `aioverlay.html`.
- Confirm `overlay=NAME` matches the saved overlay slug.
- Confirm the same browser/profile or extension storage is being used.
- If using extension sync, confirm the session bridge is connected.

Generated overlay receives no chat:

- Confirm `aioverlay.html` has the same session as the source side.
- Confirm the generated overlay's internal label matches the data family. Normal chat usually uses `label=dock`; metadata overlays may need `label=meta`.
- Check whether the generated overlay actually exposes a payload handler and updates visible DOM.

`aiprompt.html` AI generation does nothing:

- Add `?session=SESSION_ID` if trying to use AI.
- Confirm Private Chat Bot is enabled.
- Confirm the configured LLM provider works from the popup or cohost page.
- Increase/check `aitimeout` only after provider/session setup is known good.

Local browser model fails:

- Check model files are accessible from the current page origin.
- If opened from `file://`, local workers can be blocked; use `http://localhost` or the extension/app path.
- For Gemma/Qwen-style paths, check required model asset files and CORS/public access.

## Safe Answer Patterns

For cohost stage output:

```text
Use `cohost-overlay.html?session=YOUR_SESSION&tts` in OBS. The target label defaults to `cohost-overlay`, so dock or API commands must target that label. If text appears without audio, the overlay needs `&tts` and the command needs `tts` or `speak`.
```

For generated AI overlays:

```text
Build and save the overlay in `aiprompt.html?session=YOUR_SESSION`, then open the generated `aioverlay.html?session=YOUR_SESSION&label=aioverlay&overlay=NAME` URL in OBS. If it cannot find the overlay, save from the builder again or check whether extension/local storage is the same browser profile.
```

For cohost live chat:

```text
Open `cohost.html?session=YOUR_SESSION`. Live Chat defaults to monitor mode; switch to Questions or All if the cohost should answer. The AI provider and Private Chat Bot bridge must be configured before it can generate responses.
```

## Do Not Overclaim

- Do not say `cohost-overlay.html` generates AI by itself; it only displays commands it receives.
- Do not say `aiprompt.html` requires a session for local editing; it needs a session for AI generation and extension sync.
- Do not say `aioverlay.html` contains the generated overlay permanently; it loads saved local/extension overlay packages.
- Do not say every generated overlay receives normal chat; labels and generated handler code decide what it consumes.
- Do not say cloud AI is free; providers control pricing, quotas, keys, and availability.
- Do not ask users to paste API keys, session URLs, or private endpoints in public support.

## Remaining Extraction Targets

- Trace dock right-click cohost menu detection and exact commands sent to `cohost-overlay.html`.
- Source-check `message-ai-export.html` before adding recipes.
- Add exact setting-key docs for `aiOverlayFromChatBot`, `aiOverlayLabel`, `aiOverlayTts`, and cohost-related tool settings if they are generated outside `settingsDefinitions.js`.
- Validate local browser model setup with current worker files and hosted asset paths.
- Add a rendered/OBS verification pass for `cohost-overlay.html`, `aiprompt.html`, and `aioverlay.html`.
