# Settings And Toggles

Status: heavy reference pass started from generated settings definitions, generated URL parameter definitions, public settings docs, and existing agent storage docs, plus focused settings config JSON and generated metadata validation.

## Purpose

Use this page when a user asks where a setting lives, whether a toggle applies to the extension or desktop app, why a setting did not take effect, or whether a URL option is the same thing as a popup option.

This is a map of the settings system, not a field-by-field replacement for the generated public reference.

For the practical question "I changed this and nothing happened," use `settings-change-impact-matrix.md` after identifying whether the user changed a popup setting, URL parameter, generated link, app source state, app cached setting, provider/auth value, or page-local state.

For evidence labels and proof requirements before stronger option/setting claims, use `options-settings-proof-ledger.md`.

## Source Anchors

- `popup.html`
- `popup.js`
- `settings/options.html`
- `settings/options.js`
- `docs/settings.html`
- `docs/js/settings.js`
- `shared/config/settingsDefinitions.js`
- `shared/config/urlParameters.js`
- `parameters.md`
- `docs/agents/06-settings-sessions-and-storage.md`
- `docs/agents/13-reference/url-parameters.md`
- `docs/agents/13-reference/settings-key-index.md`
- `docs/agents/13-reference/url-parameter-index.md`
- `docs/agents/13-reference/settings-session-storage-source-trace.md`
- `docs/agents/13-reference/settings-change-impact-matrix.md`
- `docs/agents/18-focused-validation-evidence-log.md`

## Focused Validation Evidence

On 2026-06-24, focused config validation passed:

```powershell
bash scripts/validate-configs.sh
```

Result: `settings/config_0.json`, `settings/config_linux_0.json`, and `settings/config_mac_0.json` parsed as valid JSON and the script reported `All config JSON files are valid.`

Evidence label: `focused-config-validation`; not runtime-tested.

What this supports: the three current `settings/config*.json` files are syntactically valid JSON and did not contain duplicate keys according to the script.

What it does not support: generated settings definitions, URL parameter definitions, popup UI labels, app parity, Chrome/app storage, migration, generated links, or live reload behavior.

On 2026-06-24, focused generated metadata validation also inspected `shared/config/settingsDefinitions.js`, `shared/config/urlParameters.js`, and `docs/js/sites.js` with a read-only inline Node checker.

Evidence label: `focused-metadata-validation`; not runtime-tested.

What this supports for settings: `shared/config/settingsDefinitions.js` currently exposes 327 settings across 54 categories with no duplicate object-key tokens, missing generated category references, or missing required `type`/`category`/`description` fields.

What this supports for URL parameters: `shared/config/urlParameters.js` currently exposes 255 generated URL parameter items across 23 sections and 2 groups with no missing required `key`/`displayName`/`aliases`/`description` fields.

Known metadata findings: generated URL parameter aliases currently include a `password` alias collision across two `password` entries and a normalized `strokecolor` collision from `strokecolor`/`strokeColor` on the same key. Treat these as metadata findings until the source definitions are reconciled.

What it does not support: popup UI behavior, generated link behavior, page-specific URL parser behavior, Chrome/app storage, migration, app parity, OBS refresh behavior, or live setting changes.

## Current Generated Counts

As of the 2026-06-24 extraction pass:

- `shared/config/settingsDefinitions.js` exposes 327 popup setting definitions.
- Setting types: 170 boolean toggles, 98 text fields, 49 number fields, and 10 select fields.
- `shared/config/urlParameters.js` exposes 255 generated URL parameter items across 23 sections and 2 groups, all current items under the dock/streaming-overlay group plus an empty placeholder group for other overlays.

Do not hard-code these counts in user support answers without checking the generated files again; they are useful for agent orientation and extraction tracking.

Some popup controls can appear in `popup.html` before or without a matching generated definition in `shared/config/settingsDefinitions.js`. During the helper-source pass, `youtubeAudioPicker` was found in `popup.html`, `popup.js`, and `sources/static/youtube_static.js`, but not in the generated definitions. If a setting is missing from `settings-key-index.md`, search `popup.html` and the relevant source before saying it does not exist.

## Setting Families

SSN uses several related, but different, configuration layers.

| Layer | Where It Comes From | What It Controls | Support Notes |
| --- | --- | --- | --- |
| Popup settings | `popup.html`, `popup.js`, `shared/config/settingsDefinitions.js` | Extension/app feature toggles, source toggles, API keys, TTS/AI/provider settings, filters, command behavior, integrations | Persistent. Usually changed through the extension popup or equivalent app UI. Some changes require a source/page reload. |
| URL parameters | `parameters.md`, `shared/config/urlParameters.js`, overlay page code | Overlay/page behavior at load time, such as theme, scale, filters, TTS, queue behavior, API/server routing | Not persistent by themselves. Usually require refreshing the page after editing the URL. |
| Session/password URL values | Overlay/tool URLs and API routes | Which channel the source, dock, overlay, and API clients join | Treat session IDs and passwords as private. Session mismatch is a top cause of "not updating" reports. |
| Extension storage | Chrome extension storage/local runtime state | Popup options, permissions/toggles, source routing, compatibility state | Uninstalling the extension can delete settings. Export first if reinstalling. |
| Desktop app state | `ssapp/state.js`, app storage, source-window state | Source bindings, app windows, local app/session compatibility, OAuth/app-only state | The app uses `social_stream` source files but adds Electron-specific state and IPC behavior. |
| Overlay local state | Individual HTML pages and browser localStorage | Page-specific persistence such as tip jar, credits, or tool page state | Page-specific. Do not assume one overlay setting applies globally. |
| Event Flow state | `actions/*` and Event Flow page storage | Automation flows, triggers, actions, variables, enabled flows | Separate from normal popup toggles, although flows can be triggered by normal SSN events. |

## Public Reference Page

`docs/settings.html` is the current public settings catalogue. It has:

- A `Popup settings` tab for the popup control catalogue.
- A `URL parameters` tab for the generated overlay parameter index.
- Search by setting name/key/behavior.
- Grouping by popup section or generated category.
- Live data sourced through `docs/js/settings.js`, `shared/config/settingsDefinitions.js`, and `shared/config/urlParameters.js`.

When a user asks "where is this option?", start with `docs/settings.html` before manually searching `popup.html`.

For local agent lookup, use `settings-key-index.md` for exact popup setting keys and `url-parameter-index.md` for exact URL parameter aliases. For storage, session, password, generated-link, and desktop-app backup behavior, use `settings-session-storage-source-trace.md`. For reload/reconnect/live-update triage, use `settings-change-impact-matrix.md`.

## Generated Popup Categories

The generated category list below comes from `SETTINGS_CATEGORY_INFO` and current setting counts from `SETTINGS_DEFINITIONS`.

| Category | Count | Agent Notes |
| --- | ---: | --- |
| Streaming chat (dock and overlay) | 9 | Core dock/overlay behavior. Check this for chat display defaults before URL overrides. |
| More TTS options | 1 | Additional text-to-speech toggle/control. |
| Text-to-Speech Service Provider | 1 | Main TTS provider selector. |
| Built-in System TTS Options | 2 | Browser/system voice controls. Free, but OBS capture can be more complicated. |
| Kokoro TTS Options | 1 | Local/browser TTS family. Check hardware/browser support before promising performance. |
| Kitten TTS Options | 1 | Local/browser TTS family. Check current implementation before detailed setup answers. |
| ElevenLabs TTS Options | 6 | Provider-backed TTS. Usually requires external account/key. |
| Google Cloud TTS Options | 2 | Provider-backed TTS. Usually requires external account/key. |
| Speechify TTS Options | 1 | Provider-backed TTS. Usually requires external account/key. |
| OpenAI TTS Options | 4 | OpenAI-compatible TTS settings. May be local or third-party depending endpoint. |
| Customize Donation Colors by Threshold | 4 | Donation/tip highlighting thresholds and colors. |
| Featured chat overlay | 2 | Featured-message overlay behavior. Cross-check `featured.html` and featured docs. |
| Colors | 4 | Basic color customization. May overlap with URL/CSS styling. |
| Configure LLM API | 36 | AI/LLM provider, model, prompt, key, and endpoint configuration. Treat keys as private. |
| Chat bot | 16 | AI/chatbot response behavior. Check whether feature is enabled and what trigger rules apply. |
| Give chatbot custom knowledge | 1 | RAG/custom knowledge setting. Validate current file/upload/storage behavior before detailed answers. |
| Enable Text to Speech | 1 | Master TTS enable family. |
| Censor bot options | 2 | AI/moderation/censor behavior. Validate exact behavior against current code before strong claims. |
| Standalone one-on-one chat bot | 1 | Separate chatbot surface. Confirm current page/app behavior before support answers. |
| Sources to Monitor | 1 | Source selection/control family. |
| Display Options | 4 | Popup-level display behavior. URL parameters may still override overlay display. |
| Must enable the trigger to use | 5 | Trigger-gated features. If a command does nothing, check these first. |
| Other customization options | 7 | Mixed customization controls. Search exact key before answering. |
| Configure select-a-winner draw mode | 1 | Giveaway/draw behavior. Cross-check giveaway docs. |
| Poll Settings | 10 | Poll behavior. Cross-check `poll.html` and waitlist/polls/games docs. |
| Top Bar Settings | 1 | Top bar display/tool behavior. |
| Custom GIF Commands Settings | 1 | GIF command setup. Cross-check Giphy/Tenor settings. |
| Global settings and tools | 2 | Broad/global behavior. Be careful with side effects. |
| Opt-in options | 11 | Sensitive/platform-specific capture toggles. Usually require enabling plus reloading the source page. |
| Opt-out options | 10 | Feature/source suppression controls. Check these if a source or event is missing. |
| Miscellaneous options for sites | 11 | Platform-specific quirks. Search the exact platform and setting key. |
| Custom Injection | 25 | Capture/data modification injection. High-risk area; source-check before detailed claims. |
| Printer Control | 21 | Printer/integration behavior. Requires external setup and careful support scoping. |
| Spotify Configuration | 4 | Spotify integration settings. App OAuth may be involved. |
| Now Playing Features | 4 | Music/now-playing display or automation. Check current integration path. |
| General Settings | 3 | General behavior. Search exact key. |
| Commands | 3 | Built-in chat command toggles. A command can exist but still be disabled. |
| Management | 22 | API/remote/control/integration behavior. Check security and server toggles. |
| Custom JavaScript | 1 | Custom user function support. Treat custom code as trusted-user code only. |
| Giphy/Tenor support | 7 | GIF provider setup. May require keys or network access. |
| Trigger webhook URL by a command | 2 | Command-to-webhook behavior. Treat URLs/secrets as private. |
| Send fixed messages at intervals | 1 | Timed message automation. |
| Auto-responder | 2 | Fixed response automation. Check trigger and enable settings. |
| Trigger MIDI note on command | 1 | MIDI command integration. Requires local/browser MIDI support. |
| Message doubling / echos / duplicates / relayed | 6 | Duplicate/relay behavior. Check this before treating duplicate chat as a bug. |
| Other filters | 21 | Message filtering and suppression. Top area to inspect for "missing messages". |
| Blocked / Allowed Users | 4 | User allow/deny lists. Check exact username matching behavior before detailed answers. |
| Assign roles/classes to certain users | 9 | VIP/mod/custom class behavior. Often affects styling/filtering. |
| YouTube API | 1 | YouTube API-specific feature. Usually not the same as DOM chat capture. |
| Opened in new tab | 5 | Source behavior when opened as tab. |
| Opened in new window | 6 | Source behavior when opened as window. |
| Custom | 18 | Miscellaneous custom settings. Search exact key. |
| Hide your links | 1 | Link/privacy behavior. |
| Miscellaneous | 1 | Miscellaneous setting. Search exact key. |

## URL Parameter Relationship

Popup settings and URL parameters are not interchangeable:

- Popup settings are persistent and usually affect capture, processing, or feature behavior.
- URL parameters are load-time instructions for a specific page instance.
- URL parameters can make an overlay look like a setting changed, even when the persistent setting did not change.
- Some page behavior exists only as URL parameters and has no popup toggle.
- Some popup settings affect source capture before data reaches the dock, so URL parameters cannot restore filtered-out data.

When a user says "I changed the setting but the overlay still looks wrong", inspect both the popup setting and the overlay URL.

## Common Support Answers

### Where is this setting?

Use this order:

1. Search `docs/settings.html`.
2. Search `shared/config/settingsDefinitions.js` for the setting key or description.
3. Search `popup.html` for the control if the generated definition is unclear.
4. Search `popup.js` for save/load/runtime behavior.
5. If it is a URL behavior, search `parameters.md`, `shared/config/urlParameters.js`, and the target overlay page.
6. If it is a static/manual helper behavior, check `manual-static-and-helper-sources.md` and the exact helper source.
7. If it is a WebSocket/API source page behavior, check `websocket-source-pages.md` and the exact source-page script because some auth/token/source-page fields live outside generated popup settings.
8. If it is a communication/private source, check `communication-and-sensitive-sources.md` because public setup wording, generated opt-in keys, and source behavior do not always line up cleanly.

### I enabled it, but nothing changed.

Check:

- Whether the affected source page or overlay needs a refresh.
- Whether the user changed a popup setting but the visible page is controlled by a URL parameter.
- Whether the popup generated a new link but the already-open OBS/browser source still uses the old URL.
- Whether the standalone app source window or custom session needs reopening/reconnecting.
- Whether the setting applies only to a specific source mode, such as WebSocket/API mode instead of DOM capture.
- Whether the source toggle requires enabling first, then reloading the platform page.
- Whether the source is a communication/private page where the web version, visible chat panel, and privacy redaction matter as much as the toggle itself.
- Whether the user has both extension and desktop app active on the same session.
- Whether another filter, allowlist, blocklist, duplicate/relay setting, or opt-out setting suppresses the expected behavior.

Route these cases to `settings-change-impact-matrix.md` before making a live-update claim.

### Is this extension-only or app-only?

Default assumption:

- Popup/source settings are owned by `social_stream` and are shared by the extension and standalone app when the app loads those source files.
- Desktop app window/source management, OAuth helpers, local app state, and Electron IPC behavior are app-specific.
- Platform embedded-browser restrictions can make an app workflow behave differently even if the source code is shared.

Check `ssapp` docs only after confirming the behavior is app-specific.

### Does this setting cost money?

The setting itself is part of SSN, but external providers can cost money. Most risky categories are:

- Cloud TTS providers.
- AI/LLM providers.
- Platform API features that require external accounts, keys, or quotas.
- Donation/payment integrations managed by third parties.

Never describe a third-party provider as free unless the current provider docs and SSN docs both support that claim.

### Can I share a screenshot of this setting?

Tell users to hide:

- Session IDs.
- Passwords.
- Webhook URLs.
- API keys.
- OAuth/client secrets.
- Private endpoint URLs.
- Private channel/user identifiers if the issue can be diagnosed without them.

## Extraction Gaps

Needed intense passes:

- Line-level storage behavior for high-risk settings in `popup.js` and background processing.
- Which settings update live versus require page reload/source reload.
- App parity for popup settings loaded inside the Electron app.
- Exact key mapping between popup controls, generated setting definitions, and runtime storage.
- Generated docs pipeline from `popup.html`/`parameters.md` to `shared/config/*` and `docs/settings.html`.
