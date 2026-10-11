# Text To Speech

Status: heavy extraction pass plus focused local TTS asset-test evidence on 2026-06-24.

## Source Anchors

- `README.md`
- `docs/commands.html`
- `docs/tts.html`
- `docs/local-tts.html`
- `parameters.md`
- `tts.html`
- `tts.js`
- `dock.html`
- `featured.html`
- `local-tts-bridge/README.md`
- `local-tts-bridge/server.cjs`

## Focused Validation Evidence

On 2026-06-24, these focused Node tests were run:

```powershell
node tests/kokoro-local-assets.test.js
node tests/piper-local-assets.test.js
node tests/kitten-tts-assets.test.js
```

Results:

- Kokoro: passed with `PASS kokoro local asset wiring`
- Piper: failed on an expected `FALLBACK_REMOTE_PIPER_BASE` string in `thirdparty/piper/piper-tts-proper.js`
- Kitten TTS: passed with `PASS kitten TTS asset wiring`

Evidence label: `focused-node-test`; not runtime-tested.

What this supports: static/source wiring for Kokoro local asset host/model/voice paths and Kitten TTS WASM path setup. It also identifies that the Piper asset wiring test currently fails on a fallback remote-base expectation.

What it does not support: actual model download, audio generation, browser playback, OBS Browser Source audio capture, WebGPU/WASM/CPU runtime behavior, standalone app TTS behavior, or cloud provider behavior.

Full evidence entry: `../18-focused-validation-evidence-log.md`.

## What TTS Does

SSN can read chat, featured messages, bot replies, and some events aloud. It can use browser/system voices, local/browser model providers, cloud providers, or OpenAI-compatible custom/local endpoints.

The page that should produce audio must be open. For many workflows that means `dock.html`, `featured.html`, `bot.html`, `chatbot.html`, `cohost.html`, or another overlay/browser source.

## Free vs Paid Boundaries

| Provider/Mode | Cost Boundary | Notes |
| --- | --- | --- |
| System/Web Speech API | Free | Uses browser/OS voices; language/voice availability varies heavily. |
| Kokoro | Free/local in current docs | Runs in browser with WebGPU/CPU/WASM options; can require a powerful computer. Focused asset wiring test passed on 2026-06-24, but runtime audio was not tested. |
| Kitten TTS | Free/local in current docs | Lightweight browser model download for local voice generation. Focused asset wiring test passed on 2026-06-24, but runtime audio was not tested. |
| Local/custom OpenAI-compatible endpoint | Depends on self-hosted server | SSN can call local bridges/endpoints; user supplies compute/server. |
| Google Cloud TTS | Paid/Google account | Requires user's API key and provider billing/quotas. |
| ElevenLabs | Account/provider pricing | Free tier may exist for testing; account/API key required. |
| Speechify | Provider pricing | Account/API key/provider terms apply. |
| Gemini TTS | Provider/API pricing or preview terms | Requires key/model setup. |
| OpenAI TTS | Provider/API pricing | Requires API key unless using compatible local endpoint. |

Do not promise that a third-party provider is free. Say SSN supports it, and the provider's own account/pricing applies.

## Basic URL Parameters

From `parameters.md`:

| Parameter | Meaning |
| --- | --- |
| `speech` / `tts` | Enables TTS with language code such as `en-US`. |
| `volume` | TTS volume. |
| `rate` | Speaking rate. |
| `pitch` | Voice pitch. |
| `voice` | Partial voice-name match for system/browser voices. |
| `ttscommand` | Custom command to trigger TTS, defaulting to `!say` in docs. |
| `ttscommandmembersonly` | Restricts TTS command to members only. |
| `simpletts` | Simplified TTS output. |
| `readevents` | Enables TTS for stream events. |
| `readouturls` | Reads URLs instead of saying a generic link phrase. |

Example:

```text
featured.html?session=SESSION_ID&speech=en-US&volume=1&rate=1&pitch=1
```

## Provider Parameters

API key/provider parameters from `parameters.md`:

- `ttskey` / `googlettskey`
- `elevenlabskey`
- `speechifykey`
- `geminikey`
- `openaikey` / `customttskey` / `localttskey`

OpenAI-compatible/custom/local parameters:

- `ttsprovider=openai`
- `ttsprovider=customtts`
- `ttsprovider=localtts`
- `openaiendpoint` / `customttsendpoint` / `localttsendpoint`
- `voiceopenai` / `customttsvoice` / `localttsvoice`
- `openaimodel` / `customttsmodel` / `localttsmodel`
- `openaispeed` / `customttsspeed` / `localttsspeed`
- `openaiformat` / `customttsformat` / `localttsformat`

Provider-specific parameters also exist for Google, Gemini, ElevenLabs, and Speechify. Use `parameters.md` before answering exact parameter names.

## System/Web Speech TTS

System TTS is the simplest free path:

```text
featured.html?session=SESSION_ID&speech=en-US
```

Important behavior from README:

- Voice availability depends on OS and browser.
- Chrome/Edge can show local system voices and some cloud/browser voices.
- Firefox/Chromium variants may show only local voices or no useful voices.
- Standalone app may show a limited system voice list.
- Users can add OS language/voice packs, then restart browsers/apps.
- Some third-party SAPI/OS voices may not appear in Chromium browsers.

Support test page:

```text
https://socialstream.ninja/tts
```

## Kokoro And Browser Local TTS

Current public docs describe Kokoro as a free browser-based TTS option that runs directly in the browser. Benefits:

- Better OBS Browser Source capture than system TTS.
- No virtual audio cable when browser-source audio control works.
- Local/private generation.

Limits:

- It can be slow on weaker machines.
- WebGPU/CPU/WASM behavior depends on browser/platform.
- README mentions forcing WASM/q8 for browser overlays:

```text
&kokorodevice=wasm&kokorodtype=q8
```

Command docs also list Kitten TTS as a lightweight browser-based local model. Verify current model/download behavior before giving detailed support.

Focused evidence note:

- Kokoro and Kitten static asset wiring tests passed on 2026-06-24.
- Piper static asset wiring test failed on 2026-06-24 because `thirdparty/piper/piper-tts-proper.js` did not contain the expected fallback remote-base constant.
- Do not describe Piper focused evidence as passing until that test is investigated or rerun successfully.

## Cloud Provider TTS

Provider setup pattern:

1. Create provider account.
2. Generate API key.
3. Configure key and voice/provider settings in SSN page/menu/URL.
4. Open the TTS-producing page in OBS/browser.
5. Test with a short message before going live.

Provider notes:

- Google Cloud TTS requires a Google Cloud API key and enabled service.
- ElevenLabs requires account/API key; free tier may be available for testing.
- Speechify requires provider credentials.
- Gemini/OpenAI TTS require the relevant API/provider setup.

## Local TTS Bridge

`local-tts-bridge/README.md` documents a small Node server with no npm dependencies. It exposes:

```text
http://127.0.0.1:8124/v1/audio/speech
```

SSN sends OpenAI-compatible JSON:

```json
{
  "model": "tts-1",
  "input": "Chat message text",
  "voice": "nova",
  "response_format": "wav",
  "speed": 1
}
```

Example SSN URL:

```text
dock.html?session=SESSION_ID&speech=en-US&ttsprovider=customtts&openaiendpoint=http://127.0.0.1:8124/v1/audio/speech&voiceopenai=nova&openaiformat=wav
```

Bridge modes documented:

- OpenAI-compatible servers, such as openedai-speech, Chatterbox, Kokoro-FastAPI, and similar `/v1/audio/speech` servers.
- GPT-SoVITS via bridge mode.
- F5-TTS wrappers via bridge mode.

Desktop app note from the bridge README: standalone app windows may be less CORS constrained than Chrome, but the bridge remains the safest path for third-party local servers that do not allow browser requests or do not expose an OpenAI-compatible endpoint.

## OBS Audio Capture

README distinction:

- System/Web Speech TTS often plays through the OS default output device, so OBS Browser Source audio control may not capture it.
- Provider/browser TTS options such as Kokoro, Google Cloud, ElevenLabs, and Speechify play through the browser page and are better suited to OBS Browser Source audio capture with "Control audio via OBS" enabled.

System TTS capture options:

- Route system audio through a virtual audio cable and capture that device.
- Use OBS Application Audio Capture on a process that carries system TTS where applicable.
- Use Desktop Audio capture, with the tradeoff that it captures other system sounds.

Browser audio gate:

- In normal browsers, users may need to click the page before audio playback is allowed.
- OBS Browser Sources and Electron Capture/app contexts can behave differently.

## Dock/Featured Controls

`dock.html` includes a TTS toggle. Disabling TTS stops playback and clears the queue.

API actions:

```json
{"action":"toggleTTS","value":"toggle"}
{"action":"tts","value":"on"}
```

HTTP/API example:

```text
https://io.socialstream.ninja/SESSION_ID/toggleTTS/null/toggle
```

Verify current accepted HTTP path behavior against `api.md`/code before documenting a public user URL.

## Common Failures

| Symptom | Likely Cause | First Checks |
| --- | --- | --- |
| No voices listed | Browser/OS has no exposed voices | Test `https://socialstream.ninja/tts`; install OS language pack; restart browser/app. |
| TTS works in browser but not OBS | Wrong capture path | Check Browser Source audio control; system TTS may need virtual cable/desktop capture. |
| Cloud TTS fails | API key/model/provider issue | Verify key, billing/quota, selected voice/model, console errors. |
| Local TTS blocked by CORS | Local server not browser-safe | Use `local-tts-bridge` endpoint. |
| Audio starts only after click | Browser autoplay gate | Click page or use OBS Browser Source/app context. |
| Kokoro slow or broken | Device/runtime/model issue | Try WASM/q8 parameters or a lighter provider. |
| Piper local asset check fails | Current source does not match the focused test's expected fallback remote-base constant | Treat Piper as needing source/test reconciliation before using that focused test as proof. |
| Firefox missing features | Firefox limitation | Test Chromium/app and check provider support. |
| TTS reads unsafe chat | User-generated content risk | Use filters, moderation, member-only command, or provider limits. |

## Safety Notes

- Treat live chat TTS as user-generated audio. It can read offensive text, URLs, private information, or spam.
- Use moderation/filtering before enabling public TTS.
- Restrict `ttscommand` to members/moderators where needed.
- Avoid placing provider API keys in public screenshots or shared URLs.

## Follow-Up Extraction Needs

- Line-level provider matrix from `tts.js`.
- Current exact popup setting names for every provider.
- App-specific TTS worker behavior from `ssapp`.
- E2E validation notes from `scripts/playwright-tts-provider-check.cjs`.
- Reconcile the failing Piper focused asset test before promoting Piper wiring claims.
