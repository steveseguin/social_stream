# Settings Sessions And Storage

Status: backbone extraction pass. Usable for orientation, not final-grade.

## Purpose

This page documents session IDs, passwords, storage, settings import/export, URL parameters, and how settings differ between extension and standalone app.

For the source-checked storage/session trace, including exact extension sync/local storage split, popup-generated links, standalone app cached-state backups, and settings-loss guardrails, use `13-reference/settings-session-storage-source-trace.md`.

## Source Anchors

- `social_stream/popup.html`
- `social_stream/popup.js`
- `social_stream/settings/*`
- `social_stream/shared/config/settingsDefinitions.js`
- `social_stream/shared/config/urlParameters.js`
- `social_stream/parameters.md`
- `social_stream/background.js`
- `social_stream/service_worker.js`
- `social_stream/docs/agents/13-reference/settings-session-storage-source-trace.md`
- `ssapp/state.js`
- `ssapp/main.js`
- `ssapp/tests/electron/settings-*.js`
- `stevesbot/resources/instructions/social-stream-support.md`

## Session ID

Session ID is the central routing value for docks, overlays, APIs, and source windows. Most support flows should verify:

- The source/capture side and receiving page use the same session ID.
- The user did not accidentally open an old dock/overlay URL with a stale session.
- The app/extension has the session saved in the expected storage layer.
- OBS browser sources were refreshed after a session change.

## Password

Password is optional, but it can matter for control paths and protected sessions. Documentation should avoid saying password is always required. Instead:

- For basic display-only overlays, first verify matching session ID.
- For API/control/moderation paths, check whether the path requires password or admin/control credentials.
- If a user reports receiving messages but not being able to control/moderate/send, password mismatch is a likely category.

## Chrome Extension Storage

Confirmed from `service_worker.js` and `background.js`:

- `chrome.storage.sync` stores:
  - `streamID`
  - `password`
  - `state`
- `chrome.storage.local` stores:
  - the larger `settings` object
  - local flags such as `returningBeepHintShown`

The service worker reads `state` from sync first, then local as fallback. Its settings snapshot combines sync values with local settings.

`background.js` migrates older storage layouts by moving `streamID`, `password`, and `state` to sync storage while keeping `settings` in local storage.

Support implication: extension settings can be partially valid. For example, a session ID can exist in sync storage while a local settings object is stale, missing, or corrupted.

## Standalone App Storage

Confirmed from `state.js` and `main.js`:

- `state.js` stores app UI/runtime state in localStorage under `socialStreamState`.
- `sources` and `groups` are serialized as arrays and restored as Maps.
- App global fields include TikTok mode preferences, YouTube auto-add/cleanup behavior, current page, root order, and session bindings.
- `state.js` migrates older localStorage `settings` into source entries.
- `main.js` reads and writes cached state across disk backups, electron-store backup, and localStorage backup.
- `main.js` mirrors settings/session values into localStorage keys including `settings`, `streamID`, `password`, `state`, `ssninja_stream_id`, and `ssninja_state`.
- On quit, app localStorage can be backed up into electron-store as `localStorageBackup`.

Support implication: app settings-loss troubleshooting needs a separate page. It is not the same as clearing Chrome extension storage.

## Session Binding In The App

`state.js` keeps `sessionBindings` in global state. Bindings remember which session should be used for a source based on stable source identity fields.

Confirmed behavior:

- Binding keys can use target, group, username, channel, video ID, URL, or explicit key.
- Auto/default/blank sessions are not remembered.
- `addSource` applies remembered session bindings when creating source entries.
- Updating global state writes compatibility localStorage keys for selected global preferences.

Documentation should explain this in user terms: the app may remember the session for a source, but it intentionally avoids remembering vague/default sessions.

## URL Parameters

`parameters.md` and `shared/config/urlParameters.js` still need a heavy extraction pass. Until that pass is complete:

- Treat URL parameters as source-backed only when they are listed in `parameters.md` or generated/shared config.
- For common support answers, document the exact page plus parameter, such as dock parameters separately from featured overlay parameters.
- Avoid mixing app storage settings with one-off URL parameters. A URL parameter may affect only that browser source/page instance.

## Import, Export, And Backup Notes

Support history says settings loss is common enough that agents should recommend exporting settings before risky actions. Current confirmed docs should say:

- For extension users, do not advise uninstalling the extension as a casual update step because uninstalling can remove extension storage.
- For standalone app users, settings are more complex and may involve app backups/mirrors; preserve files before clearing app data.
- If a user is switching between extension and app, verify which storage model they are actually using before giving reset instructions.

## Extraction Notes

Deeper passes should build:

- Exact settings export/import workflow from popup/settings UI.
- Exact storage key table with where each key lives.
- Settings-loss recovery guide for extension and app separately.
- URL parameter catalog grouped by page.
- Tests-backed app settings repair behavior from `ssapp/tests/electron/settings-*.js`.
