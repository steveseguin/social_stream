# How-To Recipes

Status: heavy reference pass started. These are source-backed workflow recipes for common SSN questions. Verify line-level behavior before using them as release docs.

## Purpose

Use this page when a user asks how to do a complete task rather than asking for one setting, one command, or one file.

Each recipe points to the deeper page that should be checked for exact options, platform limits, and troubleshooting.

For a fast "which URL/page do I open?" lookup, use `surface-url-cheatsheet.md`. For setup-choice routing before the recipe, use `workflow-setup-decision-tree.md`. For pre-stream and after-update checks, use `preflight-checklists.md`.

## Source Anchors

- `README.md`
- `api.md`
- `parameters.md`
- `docs/commands.html`
- `docs/features.html`
- `docs/settings.html`
- `docs/supported-sites.html`
- `docs/customoverlays.md`
- `custom_sample.js`
- `custom_actions.js`
- `sample_wss_source.html`
- `docs/agents/02-installation-and-surfaces.md`
- `docs/agents/07-overlays-and-pages/*.md`
- `docs/agents/08-platform-sources/*.md`
- `docs/agents/09-api-and-integrations/*.md`
- `docs/agents/10-troubleshooting/*.md`
- `docs/agents/12-development/*.md`
- `docs/agents/13-reference/*.md`

## Choose The Right Surface

Use the Chrome/Chromium extension when:

- The user already has the platform working in their normal browser.
- They need normal browser login/cookie state.
- They want the standard supported-site capture path.
- They are diagnosing whether a source still works in the canonical extension.

Use the standalone app when:

- The user wants managed source windows.
- Browser tabs are being throttled, hidden, or discarded.
- They do not want to install a browser extension.
- They need app-specific source or OAuth flows.

Use hosted pages when:

- The user needs OBS browser sources, dock, featured overlay, alert pages, games, or API examples.
- They want current pages without managing local files.

Use local/forked pages when:

- They need local `custom.js`.
- They are building a custom overlay.
- They are testing source or page changes.

Use Lite only for lightweight/limited workflows, not full feature parity.

Deeper docs: `02-installation-and-surfaces.md`, `modes-and-capability-matrix.md`.

## Install The Extension Manually

1. Download the GitHub source archive.
2. Extract it to a stable folder.
3. Open `chrome://extensions/`, `edge://extensions/`, or the equivalent Chromium extensions page.
4. Enable Developer Mode.
5. Click Load unpacked.
6. Select the extracted Social Stream folder.
7. Turn the extension on and reload any open source chat pages.

Do not uninstall just to update; uninstalling can delete extension settings. Replace files and reload the extension instead.

Deeper docs: `02-installation-and-surfaces.md`, `settings-loss-and-backups.md`.

## Get Chat Into The Dock

1. Pick the source platform and confirm its setup type in `supported-sites-lookup.md`.
2. Enable SSN. In the extension, green means enabled.
3. Open the required source page, popout chat, toggle-required page, or WebSocket source page.
4. Keep the source page visible and not minimized when using DOM capture.
5. Open the dock:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID
```

6. Confirm the same session ID is used by the source side and dock.
7. Send a test chat on the source platform.

If nothing appears, start with `10-troubleshooting/quick-triage.md` and `extension-not-capturing.md`.

For WebSocket/API source pages, also use `08-platform-sources/websocket-source-pages.md` to check room/channel/token/OAuth setup and send-back caveats.

## Add A Featured Chat Overlay To OBS

1. Open the dock:

```text
https://socialstream.ninja/dock.html?session=SESSION_ID
```

2. Add a browser source in OBS:

```text
https://socialstream.ninja/featured.html?session=SESSION_ID
```

3. Click a message in the dock to feature it.
4. Use the dock clear-featured button or API `clearOverlay` to clear it.
5. Add styling with OBS custom CSS, URL parameters, or a custom overlay.

Common setup details:

- Use the same `session` in dock and featured.
- If multiple featured overlays are open, add `&label=NAME` and target that label from API commands.
- Use `&transparent` or OBS transparency settings when needed.

Deeper docs: `07-overlays-and-pages/dock.md`, `featured.md`, `obs-overlay-display.md`.

## Use The Dock As An Operator Dashboard

1. Open `dock.html?session=SESSION_ID`.
2. Click a message to feature it.
3. Hold CTRL on Windows/Linux or cmd on macOS and click a message to queue it.
4. Use next-in-queue to feature queued messages.
5. Hold ALT and click to pin/unpin messages.
6. Use dock URL parameters for operator-specific modes:

```text
&viewonly
&helpermode
&chatmode
&queueonly
&pinnedonly
&label=operator1
```

Deeper docs: `07-overlays-and-pages/dock.md`, `commands-and-actions.md`.

## Run A Chat Game

1. Choose the game:
   - Spam Power: `games.html`.
   - Individual games: pages under `games/`, such as `games/petrace.html`, `games/phraseguess.html`, or `games/chickenroyale.html`.
2. Open the game with the same session as the source side:

```text
https://socialstream.ninja/games.html?session=SESSION_ID
https://socialstream.ninja/games/petrace.html?session=SESSION_ID
```

3. Keep the source page, extension, or standalone app source window running on that same session.
4. Tell viewers the exact input for that game, such as `!join`, `!drop`, `!dig B5`, a color word, a plant word, an emoji, or a valid chained word.
5. Use `?demo` only to prove the local game page can animate.
6. If old state appears, reload the page first, then clear localStorage for the known persistent games if needed.

Checks:

- Most games listen for ordinary chat payloads with `chatname` and `chatmessage`.
- Phrase Guess must be started before guesses count and has its own settings/phrase storage.
- Chicken Royale has `jointime`, `maxplayers`, and `autojoin` options.
- Do not promise game bot responses will appear in real platform chat unless the exact page/source/platform send-back path has been checked.

Deeper docs: `07-overlays-and-pages/game-pages.md`, `07-overlays-and-pages/page-capability-matrix.md`.

## Add Event, Stats, Word Cloud, Or Leaderboard Overlays

1. Choose the page by output:
   - `events.html` for an event dashboard/log.
   - `hype.html` for viewer/chatter counts.
   - `confetti.html` for waitlist draw winner celebration.
   - `wordcloud.html` for a chat word cloud.
   - `leaderboard.html` for top chatters, donors, gifters, contributors, or loyalty snapshots.
2. Use the same session as the source side:

```text
https://socialstream.ninja/events.html?session=SESSION_ID
https://socialstream.ninja/hype.html?session=SESSION_ID
https://socialstream.ninja/wordcloud.html?session=SESSION_ID
https://socialstream.ninja/leaderboard.html?session=SESSION_ID
```

3. Add the URL as an OBS Browser Source if it should appear on stream.
4. Send a payload the page actually understands:
   - `events.html` needs event/status/donation-style payloads.
   - `hype.html` needs hype/viewer-count style payloads.
   - `confetti.html` needs waitlist draw winner state.
   - `wordcloud.html` needs `chatmessage`; add `&allwords` if viewers type sentences.
   - `leaderboard.html` needs `chatname` and `type`, or a `points_leaderboard` snapshot.
5. Check page-specific filters and persistence before assuming capture is broken.

Deeper docs: `07-overlays-and-pages/event-effect-overlays.md`, `surface-url-cheatsheet.md`.

## Add Emotes, Reactions, Scoreboard, Ticker, Or Map Displays

1. Choose the page by payload:
   - `emotes.html` for emoji/image/SVG emotes inside chat messages.
   - `reactions.html` for `reaction`, `liked`, or `like` event bursts.
   - `scoreboard.html` for points snapshots or local score counters.
   - `ticker.html` for explicit `ticker` text payloads.
   - `map.html` for viewer-location voting from chat text.
2. Use the same session as the source side:

```text
https://socialstream.ninja/emotes.html?session=SESSION_ID
https://socialstream.ninja/reactions.html?session=SESSION_ID
https://socialstream.ninja/scoreboard.html?session=SESSION_ID
https://socialstream.ninja/ticker.html?session=SESSION_ID
https://socialstream.ninja/map.html?session=SESSION_ID
```

3. Add the URL to OBS only if the output should be visible on stream.
4. Test with a matching payload:
   - For emotes, send a real emoji or platform emote.
   - For reactions, confirm the source emits reaction/like events.
   - For scoreboard, send `points_leaderboard` or enable `chatpoints`, `donationpoints`, or `customtriggers`.
   - For ticker, send top-level `ticker` as a string or array.
   - For map, test a simple country name first.

Deeper docs: `07-overlays-and-pages/live-display-utilities.md`, `surface-url-cheatsheet.md`.

## Use A Prebuilt Theme

1. Choose the theme family:
   - Normal chat theme: use a page such as `themes/compact-clean.html`, `themes/overlay-bubbles.html`, or `themes/t3nk3y/`.
   - Featured-message theme: use `themes/featured-styles/*.html`.
   - Wrapper theme: use `themes/pretty.html` or Neutron when the page should embed a styled dock.
2. Open the URL with the same session as the source side:

```text
https://socialstream.ninja/themes/compact-clean.html?session=SESSION_ID
https://socialstream.ninja/themes/featured-styles/featured-modern.html?session=SESSION_ID&style=glass
```

3. Add it to OBS as a Browser Source if it should appear on stream.
4. For featured-style themes, feature a message from dock before judging the page blank.
5. For local theme files in OBS v31, prefer hosted URLs first; if a local file receives nothing, use `&server` or `&localserver&server` only when that theme supports WebSocket mode.

Checks:

- Normal chat themes need live chat payloads.
- Featured-style themes need selected/featured payloads.
- Wrapper themes embed `dock.html`, so debug the embedded dock/session path.
- Not every theme supports every URL parameter.

Deeper docs: `07-overlays-and-pages/theme-pages.md`, `07-overlays-and-pages/custom-overlays.md`.

## Style An Overlay Quickly

For simple styling, add URL parameters:

```text
featured.html?session=SESSION_ID&transparent&scale=1.2&font=Arial
dock.html?session=SESSION_ID&darkmode&compact&hidesource
```

For stronger styling:

- Use OBS browser-source custom CSS.
- Use `&css=` or base64 CSS parameters where supported.
- Use a custom overlay for full layout/rendering control.

Do not ask normal users to edit core source files for styling unless they are maintaining a fork.

Deeper docs: `13-reference/url-parameters.md`, `07-overlays-and-pages/custom-overlays.md`.

## Use Text-To-Speech

1. Decide which TTS path the user wants:
   - System/browser TTS for free built-in voices.
   - Local/browser models where supported.
   - Provider-backed TTS such as Google Cloud, ElevenLabs, Speechify, Gemini, or OpenAI-compatible endpoints.
2. Enable TTS in settings or URL parameters.
3. Configure language, voice, rate, pitch, and volume.
4. Confirm the page is allowed to play audio.
5. For OBS, confirm whether audio comes from the browser source or from system audio.

Common URL parameters:

```text
&speech=en-US
&volume=1
&rate=1
&pitch=1
&voice=VOICE_NAME
```

Provider API keys and session URLs should not be shared publicly.

Deeper docs: `09-api-and-integrations/tts.md`, `free-paid-and-support-boundaries.md`.

## Use AI Or A Chatbot

1. Decide whether the user wants local AI, such as Ollama/local browser models, or a cloud/provider endpoint.
2. Configure provider, endpoint, model, and key where required.
3. Configure chatbot trigger rules and whether it should always respond or respond only to keywords/mentions.
4. Add custom instructions or knowledge only after privacy and scope are clear.
5. Test with a small prompt before adding automation.

For cohost stage output, use `cohost-overlay.html?session=YOUR_SESSION&tts` in OBS and keep the target label aligned with the dock/cohost commands.

For AI-generated custom overlays, build/save in `aiprompt.html?session=YOUR_SESSION`, then open the generated `aioverlay.html?...` URL in OBS.

Support boundaries:

- SSN includes the integration surface, but third-party AI providers can cost money.
- Local AI can require strong hardware and model setup.
- Do not ask users to paste private keys or private knowledge into public support channels.

Deeper docs: `09-api-and-integrations/ai-features.md`, `07-overlays-and-pages/ai-cohost-pages.md`, `settings-and-toggles.md`.

## Receive Chat In An External App

1. Enable `Enable remote API control of extension`.
2. Enable `Send chat messages to API server`.
3. Connect to channel 4:

```javascript
const ws = new WebSocket("wss://io.socialstream.ninja/join/SESSION_ID/4");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.chatname) {
    console.log(data.type, data.chatname, data.chatmessage || "");
  }
};
```

4. Treat `SESSION_ID` as private if it controls live overlays or webhook paths.

Deeper docs: `09-api-and-integrations/websocket-http-api.md`.

## Control SSN From StreamDeck Or Companion

1. Enable remote API control.
2. Use HTTP GET actions for simple buttons:

```text
https://io.socialstream.ninja/SESSION_ID/clearOverlay
https://io.socialstream.ninja/SESSION_ID/nextInQueue
https://io.socialstream.ninja/SESSION_ID/sendEncodedChat/null/Hello%20chat
```

3. Use the Bitfocus Companion Social Stream Ninja module for richer control.
4. Use page labels when multiple docks/overlays are open:

```text
dock.html?session=SESSION_ID&label=producer
https://io.socialstream.ninja/SESSION_ID/nextInQueue/producer/null
```

Deeper docs: `streamdeck-companion.md`, `websocket-http-api.md`.

## Generate Test Messages And Events

1. Open `createtestmessage.html?session=YOUR_SESSION`.
2. Choose the delivery mode:
   - Use Extension API ingest for normal dock/overlay testing.
   - Use direct channel 1 or 4 only when the target page is listening on that matching server/channel path.
3. Choose a preset or edit the JSON payload directly.
4. Submit, then watch the target page on the same session.

Checks:

- Enable `Enable remote API control of extension` before using Extension API ingest.
- Synthetic payloads prove the target page can receive that payload shape. They do not prove a real platform emits that event.

Deeper docs: `07-overlays-and-pages/diagnostic-helper-pages.md`, `09-api-and-integrations/websocket-http-api.md`.

## Recover Or Edit An Overlay URL

For settings recovery:

1. Open `recover.html`.
2. Paste a full `dock.html` URL or a query string beginning with `session=`.
3. Generate the JSON.
4. Download the `.data` file and import it through the extension/app import flow.

For URL editing:

1. Open `urleditor.html`.
2. Paste a full overlay or dock URL.
3. Add, remove, or edit parameters.
4. Copy the resulting URL and test it in a browser before OBS.

Checks:

- `recover.html` only converts URL params. It cannot recover settings that were not in the URL.
- `urleditor.html` has a hardcoded parameter catalog. Verify exact parameter support in `url-parameter-index.md` and the target page docs.

Deeper docs: `07-overlays-and-pages/diagnostic-helper-pages.md`, `url-parameter-index.md`.

## Import A StreamElements Or Streamlabs Chat Widget

1. Open `streamelements-importer.html`.
2. Choose the widget zip, folder, or files.
3. Paste the SSN session ID if the exported file should work without URL edits.
4. Click Preview, then Download OBS HTML.
5. Add the downloaded HTML file to OBS as a Browser Source.
6. Test with `?demo`, then test live with `?session=YOUR_SESSION` if needed.

Checks:

- The importer page is not the OBS overlay; the downloaded HTML file is.
- Widgets that depend on private StreamElements/Streamlabs APIs or overlay-store state may need manual edits.

Deeper docs: `07-overlays-and-pages/diagnostic-helper-pages.md`, `07-overlays-and-pages/custom-overlays.md`.

## Add Donations Or Webhooks

1. Pick the integration service: Stripe, Ko-Fi, Buy Me A Coffee, Fourthwall, or another supported path.
2. Use the webhook path documented in `api.md`.
3. Keep the webhook URL and session ID private.
4. Avoid enabling duplicate donation paths unless the workflow intentionally deduplicates.

Security note: public API docs state these webhook URLs do not use signature verification. Anyone with the session/webhook URL may be able to inject fake donation events.

Deeper docs: `websocket-http-api.md`, `free-paid-and-support-boundaries.md`.

## Build A Custom Overlay

1. Start with URL parameters and CSS if the change is mostly visual.
2. Use `sampleoverlay` or `docs/customoverlays.md` when full rendering control is needed.
3. Connect to SSN through the documented iframe/WebSocket pattern.
4. Render defensively: fields vary by platform and event.
5. Keep private keys, session IDs, and user data out of public examples.

Minimum payload fields to expect:

```json
{
  "chatname": "Viewer",
  "chatmessage": "Hello",
  "type": "youtube"
}
```

Deeper docs: `07-overlays-and-pages/custom-overlays.md`, `07-overlays-and-pages/page-capability-matrix.md`, `05-message-flow-and-event-contracts.md`.

## Use `custom.js`

1. Copy or rename `custom_sample.js` to `custom.js`.
2. Use a local/forked dock or featured page that can load the local file.
3. Implement hooks such as `applyCustomActions(data)` or `applyCustomFeatureActions(data)`.
4. Test with a few sample messages from different platforms.

Important limitation: hosted `https://socialstream.ninja/dock.html` does not load a local `custom.js` file from the user's disk.

Deeper docs: `custom-plugins-and-extensions.md`, `custom-overlays.md`.

## Use Uploaded Custom Actions

1. Start from `custom_actions.js`.
2. Define:

```javascript
window.customUserFunction = function(data) {
  return data;
};
```

3. Return modified `data` to continue processing.
4. Return `false` only when intentionally blocking a message.
5. Treat uploaded/custom code as trusted-user code only.

Deeper docs: `custom-plugins-and-extensions.md`.

## Add A New Source Or "Plugin"

For a fuller path-selection guide, start with `customization-plugin-recipes.md`.

For user-level customization, prefer:

- URL parameters.
- Custom CSS.
- Custom overlay.
- API/WebSocket integration.
- Event Flow.
- `custom.js` or custom user function.

For developer-level source support:

1. Check whether the site is already in `docs/js/sites.js`, `manifest.json`, or `sources/`.
2. Add or update the source script under `sources/`.
3. Add the manifest match pattern.
4. Add any static/injected/WebSocket helper only if needed.
5. Preserve payload field compatibility.
6. Update public docs and agent docs.
7. Test in the browser extension and, when shared by app, in the standalone app.

Deeper docs: `customization-plugin-recipes.md`, `12-development/adding-a-source.md`, `provider-cores-and-shared-utils.md`.

## Troubleshoot "Nothing Works"

Use this first-pass order:

1. Identify surface: extension, app, hosted overlay, local page, Lite, API.
2. Confirm exact platform/source URL and setup type.
3. Confirm extension/app enabled.
4. Reload source pages after install/update/setting changes.
5. Confirm the same session ID everywhere.
6. Keep DOM-capture source pages visible and not minimized.
7. Disable conflicting extensions or test clean profile.
8. Check source-specific docs and known platform issues.
9. Collect console errors/screenshots only after private data is hidden.

Deeper docs: `10-troubleshooting/quick-triage.md`, `extension-not-capturing.md`, `platform-known-issues.md`.

## Privacy And Secret Handling

Always hide:

- Session IDs.
- Passwords.
- Webhook URLs.
- API keys.
- OAuth tokens.
- Provider endpoints when private.
- Private Discord/server/channel/user details unless needed and safe.

Do not paste raw support logs publicly if they contain private chat, tokens, emails, or user identifiers.

Deeper docs: `support-resources-and-escalation.md`, `free-paid-and-support-boundaries.md`.

## Extraction Gaps

Needed intense passes:

- Turn these into tested, versioned user-facing recipes.
- Add screenshots or UI-label references where current docs need them.
- Verify each recipe against exact current UI labels and reload behavior.
- Add app-specific variants for source-window setup and OAuth workflows.
