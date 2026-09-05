# Settings Session Storage Source Trace

Status: intense source-check pass on 2026-06-24. No browser, OBS, Chrome extension runtime, or Electron app e2e testing was performed.

## Purpose

Use this page when a support answer depends on where SSN stores settings, where session IDs and passwords come from, whether a popup toggle is the same as a URL parameter, or why a setting appears to save but does not affect a page.

This page is a source trace. It narrows storage and session claims, but it does not prove runtime behavior in a real browser or app profile.

For practical reload/reconnect triage after a setting, URL option, generated link, or app source change, use `settings-change-impact-matrix.md` after this source trace.

For evidence labels and proof requirements before stronger settings, URL option, generated link, session/password, or app-state claims, use `options-settings-proof-ledger.md`.

## Source Anchors

Extension and shared source:

- `service_worker.js`
- `background.js`
- `popup.js`
- `popup.html`
- `shared/config/settingsDefinitions.js`
- `shared/config/urlParameters.js`
- `parameters.md`

Standalone app source:

- `ssapp/state.js`
- `ssapp/main.js`
- `ssapp/settings-backup.js`

Agent docs that route here:

- `06-settings-sessions-and-storage.md`
- `13-reference/settings-and-toggles.md`
- `13-reference/settings-change-impact-matrix.md`
- `10-troubleshooting/settings-loss-and-backups.md`
- `13-reference/url-parameter-source-trace.md`
- `13-reference/settings-key-index.md`
- `13-reference/url-parameter-index.md`

## High-Level Rule

SSN has several configuration layers. Do not collapse them into one "settings" bucket.

| Layer | Main Source | Persistence | First Support Check |
| --- | --- | --- | --- |
| Extension session ID | `background.js`, `service_worker.js`, `popup.js` | `chrome.storage.sync.streamID` plus session persistence helpers | Same session on source, dock, overlay, API, and OBS URL. |
| Extension password | `background.js`, `popup.js` | `chrome.storage.sync.password` | Password mismatch only matters on protected/control paths; it is not always required. |
| Extension on/off state | `background.js`, `service_worker.js` | `chrome.storage.sync.state`, with local fallback in service worker | Verify the extension/service is actually on before chasing overlays. |
| Extension popup settings | `background.js`, `popup.js` | `chrome.storage.local.settings` | Search `settings-key-index.md`, then source-check `popup.html` and the target feature. |
| Popup-generated URLs | `popup.js` | Derived from current session, password, URL params, selected pages, and popup controls | Stale OBS/browser-source URLs are common. Regenerate or refresh after session changes. |
| URL parameters | Individual page source plus generated index | Usually not persistent by themselves | Check page-specific parser support before claiming a param is global. |
| Desktop app source list/state | `ssapp/state.js` | `localStorage.socialStreamState` | App source-window state is separate from extension popup settings. |
| Desktop app cached SSN settings | `ssapp/main.js` | `savedSync.json`, `.bak`, electron-store backup, localStorage mirror/backup | Use app backup/recovery docs, not Chrome extension assumptions. |
| Desktop app settings export/import | `ssapp/settings-backup.js`, `ssapp/main.js` | User-selected `.data` or `.json` file | Normal app settings move; not the same as full session transfer. |
| Feature-specific page/local state | Individual pages/features | Page localStorage, background localStorage, or feature storage keys | Source-check the page/feature before promising export/import behavior. |

## Extension Storage Split

Confirmed in `service_worker.js`:

- `getStoredExtensionState()` reads `state` from `chrome.storage.sync` first.
- If sync state is missing, it falls back to `chrome.storage.local.state`.
- `getStoredSettingsSnapshot()` reads `streamID`, `password`, and `state` from `chrome.storage.sync`.
- The same snapshot reads the larger `settings` object from `chrome.storage.local`.
- `beginnerMode` is derived from `settings.beginnerMode.setting === true`.

Confirmed in `background.js` startup:

- `window.onload` tries a local `settings.json` override first.
- If no override exists, it loads `streamID`, `password`, and `state` from sync storage.
- It loads `settings` and `returningBeepHintShown` from local storage.
- It combines those objects before calling `loadSettings()`.
- If the old layout has `settings` in a combined local record, startup migrates `streamID`, `password`, and `state` into sync storage, keeps `settings` in local storage, and removes `settings` from sync storage.

Support implication: a user's session ID can be valid while the local settings object is stale, missing, partial, or corrupted. Avoid answers like "Chrome sync stores all settings."

## Extension Load And Save Flow

### Startup Load

`background.js` `loadSettings(item, resave)` does the main hydration work:

- Uses persisted session helpers first when possible.
- Accepts an incoming `streamID`, validates it, and generates one if no session exists.
- Persists the session ID through `persistSession({ streamId })`.
- Accepts `password` and writes it to `chrome.storage.sync`.
- Replaces the runtime `settings` object when `item.settings` exists.
- Prunes stale imported object-setting fields where needed.
- Defaults `beginnerMode` on first run if no prior settings state exists.
- Accepts boolean `state` and persists the extension on/off state.
- Can reinitialize transport when the effective SDK setting changes.
- Writes normalized settings back to `chrome.storage.local` only when resave or cleanup is needed.

### Popup Setting Save

`background.js` handles `cmd: "saveSetting"`:

- Updates `settings[request.setting]`.
- Supports object fields such as `setting`, `textsetting`, `numbersetting`, `optionsetting`, `param*`, `textparam*`, and `json`.
- Deletes empty values or false toggle fields where the current setting shape allows it.
- Parses `json` fields into an `object` helper field.
- Rebuilds dynamic event-pattern arrays.
- Saves the full `settings` object to `chrome.storage.local`.
- Handles `translationlanguage` specially by waiting for the translation file update before responding.
- Can forward the request to a target page with `sendTargetP2P()` when `request.target` is present.
- Reinitializes transport when the `sdk` setting changes while the extension is on.

Support implication: a visible popup toggle can be saved correctly while the destination page still needs refresh, a source reconnect, or a target-page message path to react.

For the support matrix of which kind of change usually needs page refresh, OBS URL replacement, source reconnect, or app source-window reopen, use `settings-change-impact-matrix.md`.

### Session ID And Password Save

`background.js` handles `cmd: "sidUpdated"` separately from normal settings:

- Updates `streamID` when provided and validates it.
- Updates `password` when the key exists in the request.
- Updates boolean `state` when present.
- In standalone-app mode, writes `streamID` and `password` through the shimmed `chrome.storage.sync`.
- Calls `persistSession({ streamId, state })`.
- Tears down the existing iframe transport and reinitializes it when the extension/service is on.

Support implication: changing session/password is not just another popup toggle. It can reset transport and requires stale dock/overlay/OBS links to be refreshed.

## Popup And Generated Links

`popup.js` receives settings through `chrome.runtime.sendMessage({ cmd: "getSettings" })` and `update(response, sync)`.

Confirmed behavior:

- `update()` stores the latest response, fills `#sessionid` and `#sessionpassword`, and calls `setupPageLinks()`.
- `setupPageLinks()` generates URLs for dock, chat overlay templates, featured, alerts, emotes, hype, waitlist, tip jar, games, ticker, word cloud, poll, bot/chatbot, cohost, giveaway, credits, AI prompt, events dashboard, reactions, Event Flow actions, custom GIF, Spotify, scoreboard, map, and timer pages.
- Generated links include `session=<streamID>`.
- Generated links include `password=<password>` only when a password exists.
- Generated links preserve `localserver` when the popup itself was opened with that URL parameter.
- Generated links append the popup manifest version as `v=` when available.
- `setupPageLinks()` intentionally ignores `session`, `password`, and `localserver` from the current popup URL while building custom parameter carryover.
- It also strips a set of TTS-related parameters from generated links to avoid leaking or duplicating provider settings.

Support implication: overlay URLs are derived output. They are not the canonical saved settings record. If OBS has an old URL, changing the popup session does not magically edit the OBS browser source.

## Popup Electron Shim

When `popup.js` runs without a real `chrome.runtime`, it creates an Electron compatibility shim:

- `chrome.storage.local.get/set/remove` reads and writes browser `localStorage` keys prefixed with `chrome_storage_`.
- `chrome.storage.sync` delegates to that same local storage shim.
- `chrome.runtime.sendMessage()` sends IPC to the app through `ipcRenderer`.
- Callback requests get a generated callback ID.
- `getSettings` gets a longer startup timeout than ordinary messages so popup hydration is not forced from a stale sync fallback too aggressively.
- `chrome.runtime.getURL()` builds a URL relative to the current app page path.
- `chrome.tabs.create()` opens URLs externally through Electron shell when available.

Support implication: the app popup compatibility layer is not the same storage backend as the Chrome extension. It emulates enough of the extension API for the embedded SSN UI, while `ssapp/main.js` still maintains app-specific cached state and backups.

## Standalone App State

`ssapp/state.js` owns the app's source/group/global UI state:

- Main persistence key: `localStorage.socialStreamState`.
- `sources` and `groups` serialize as arrays and restore as Maps.
- Global state includes:
  - `betaMode`
  - TikTok mode flags and last mode
  - YouTube auto-add and cleanup flags
  - current page
  - root order
  - `sessionBindings`
- It migrates older `localStorage.settings` source/group data when no newer source list exists.
- `persist()` writes `socialStreamState` and then writes an older compatibility `localStorage.settings` format through `saveOldFormat()`.

Compatibility localStorage keys written by `state.js` include:

- `settings`
- `betaMode`
- `youtubeAutoAdd`
- `youtubeAutoCleanup`
- `youtubeCheckInterval`
- `forceTikTokClassic`
- `preferTikTokLegacy`
- `tiktokModeExplicitlySelected`
- `lastTikTokMode`

## App Session Bindings

`ssapp/state.js` uses `sessionBindings` to remember a custom session for a source.

Binding keys can be based on:

- target
- group ID
- username
- channel ID
- video ID
- normalized URL
- explicit session binding key

Auto/default/blank sessions are not kept as remembered bindings. If a source has a meaningful custom session already, `applyRememberedSessionToSource()` does not overwrite it.

Support implication: when an app source reopens with an unexpected session, inspect source identity and app session bindings before assuming the popup session is wrong.

## Standalone App Cached State And Backups

`ssapp/main.js` maintains a separate `cachedState` object for core SSN settings/session data.

Confirmed core fields:

- `settings`
- `streamID`
- `password`
- `state`

Confirmed localStorage mirror keys:

- `settings`
- `streamID`
- `password`
- `state`
- `ssninja_stream_id`
- `ssninja_state`

Confirmed persisted backup sources:

- `savedSync.json`
- `savedSync.json.bak`
- electron-store `cachedStateBackup`
- electron-store `cachedStateBackupTime`
- electron-store `localStorageBackup`
- electron-store `localStorageBackupTime`
- browser localStorage mirror

Confirmed candidate priority in `main.js`:

| Source | Priority |
| --- | ---: |
| runtime | 100 |
| `savedSync.json` | 80 |
| `savedSync.json.bak` | 70 |
| electron-store backup | 60 |
| localStorage backup | 40 |
| localStorage mirror | 30 |

Confirmed downgrade guards:

- Existing settings are considered established after more than 5 keys.
- An incoming settings payload with less than 50 percent of the established key count is treated as a likely partial load.
- Empty or partial incoming settings can be blocked or repaired from a better baseline.
- `fromBackground` and `storageSave` both protect against replacing good settings with empty or sharply smaller settings snapshots.
- `persistCachedStateSafely()` skips writes without meaningful core data unless an explicit reset/import path allows the downgrade.
- `updateLocalStorageBackup()` also blocks partial downgrade payloads unless explicitly allowed.

Support implication: the app has deliberate anti-loss logic. Do not recommend deleting app data, clearing store data, or full reset as a first-line repair.

## App Settings Export And Import

`ssapp/settings-backup.js` defines the normal settings backup format:

- Format marker: `ssapp-settings-backup`.
- Version: `1`.
- Recognized cached-state fields:
  - `streamID`
  - `password`
  - `state`
  - `settings`
- Recognized app localStorage keys:
  - `socialStreamState`
  - `settings`
  - `betaMode`
  - `youtubeAutoAdd`
  - `youtubeAutoCleanup`
  - `youtubeCheckInterval`
  - `forceTikTokClassic`
  - `preferTikTokLegacy`
  - `tiktokModeExplicitlySelected`
  - `lastTikTokMode`
  - `language`

`ssapp/main.js` export/import behavior:

- Export flushes pending app storage saves first.
- Export recovers cached state if needed before writing the file.
- Export writes a `.data` or `.json` file.
- Import validates the settings file, applies recognized cached fields, applies recognized localStorage keys, mirrors cached state back to localStorage, and reloads the main app window.
- Import uses `allowSettingsDowngrade: true` because importing an intentionally smaller backup is an explicit user action.

Support implication: for normal app setting moves, use File -> Settings Backup. Full Session Transfer is for whole-profile moves, not basic setting edits.

## Reset And Recovery Boundaries

Confirmed from `ssapp/main.js` reset flow:

- Reset preserves stream ID and password where possible.
- Reset clears persisted app store data.
- Reset clears the app localStorage mirror keys:
  - `settings`
  - `streamID`
  - `password`
  - `state`
  - `ssninja_stream_id`
  - `ssninja_state`
- Reset clears session data, cache/cookies/storage for known sessions and partitions.
- Reset recreates the default session record.

Confirmed from app quit flow:

- The app tries to persist `cachedState`.
- It mirrors cached state to localStorage.
- It stores a full localStorage snapshot as `localStorageBackup` with a timestamp.

Support implication: reset is destructive even if it preserves some session credentials. Ask for a settings backup first unless the user explicitly wants a full wipe.

## User-Facing Support Implications

### "My setting did not stick"

Check:

- Is the user in Chrome extension, standalone app, hosted page, local page, Lite, or Firefox?
- Is it a popup setting, URL parameter, app source-window setting, or page-local setting?
- Is the exact key in `settings-key-index.md`?
- Is the same setting present in `popup.html` but missing from generated definitions?
- Did `background.js` save it into `chrome.storage.local.settings`?
- Does the destination page require a refresh, source reconnect, or regenerated URL?
- Is a URL parameter overriding the page's behavior at load time?
- In the app, did `cachedState` reject a partial/empty overwrite?

### "My OBS link is old"

Check:

- Was the link copied before the session changed?
- Does the OBS URL have the current `session=` value?
- Does it include `password=` only if the current session needs it?
- Is `localserver` present only when intentionally using a local server path?
- Is the page itself one that supports the URL options being used?

### "My settings disappeared"

Check:

- Chrome extension or standalone app first; the recovery path differs.
- For extension: do not uninstall/reinstall casually. Uninstalling can remove extension storage.
- For extension: remember the main settings object is local storage, not sync storage.
- For app: use Settings Backup/Import for normal moves.
- For app: inspect `savedSync.json`, `.bak`, electron-store `cachedStateBackup`, and `localStorageBackup` before reset.
- For app: partial/empty settings overwrites may have been blocked, so current app state may be better than a stale mirror.

### "The app and extension do not match"

Check:

- The app loads SSN source files but wraps storage and runtime messaging through Electron IPC.
- App source list/state lives under `socialStreamState`.
- App popup shim stores emulated Chrome storage as `chrome_storage_*` localStorage keys.
- App cached SSN settings live in `cachedState` backups and localStorage mirror keys.
- Chrome extension settings live in Chrome extension storage APIs.

## Claims To Avoid

Do not say:

- "All settings sync through Chrome."
- "URL parameters are saved settings."
- "Changing the popup session automatically changes old OBS URLs."
- "The standalone app stores settings exactly like the extension."
- "Reinstalling is safe."
- "Full reset is the normal way to fix settings."
- "This toggle updates live" unless the exact source path has been checked.
- "This backup includes everything" unless the backup type is named.

Safer wording:

- "The extension keeps session/password/state in sync storage, but the larger settings object is local extension storage."
- "Overlay URLs are generated from the current session and options. Refresh or recopy the URL after session changes."
- "The standalone app has its own cached state and backup layers; use Settings Backup before destructive troubleshooting."
- "This is source-checked, not runtime-tested."

## Remaining Validation

Needed before this becomes final-grade user-facing documentation:

- Chrome extension runtime test for save/load, migration, and uninstall/update behavior.
- Electron app e2e test for export/import, reset, backup selection, localStorage restore, and stale mirror recovery.
- UI-label pass for exact popup controls that trigger `saveSetting`, `sidUpdated`, and page-specific link refreshes.
- Page/runtime pass for which settings update live versus require page reload or source reconnect.
- Support-history reconciliation for real settings-loss cases after redaction and source-checking.
