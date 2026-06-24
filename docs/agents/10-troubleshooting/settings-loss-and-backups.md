# Settings Loss And Backups

Status: heavy extraction pass started.

## Purpose

Document settings loss, export/import, backup/restore, and app/extension storage differences.

This page is source-backed for the desktop app storage and backup paths. Extension storage split and app cached-state guardrails now have a source-check trace in `../13-reference/settings-session-storage-source-trace.md`, but runtime app/extension testing is still needed before final user-facing claims.

For safe update/reinstall/version-choice guidance before settings are lost, use `../13-reference/install-update-version-guide.md`.

If the user's settings still exist but a change did not affect an open page, OBS browser source, app source window, or generated link, start with `../13-reference/settings-change-impact-matrix.md` before treating it as settings loss.

## Source Anchors

- `ssapp/state.js`
- `ssapp/main.js`
- `ssapp/settings-backup.js`
- `ssapp/transfer-backup.js`
- `ssapp/transfer-restore-runner.js`
- `ssapp/tests/electron/settings-transfer-e2e.js`
- `ssapp/tests/electron/settings-loss-diagnostics.js`
- `ssapp/tests/electron/settings-rootcause-diagnostics.js`
- `social_stream/README.md`
- `social_stream/popup.js`
- `social_stream/service_worker.js`
- `social_stream/docs/agents/13-reference/settings-session-storage-source-trace.md`
- `stevesbot/resources/instructions/social-stream-support.md`

## Storage Model

### Desktop App

Confirmed from `ssapp` source:

- `state.js` persists app source/group/global state into browser `localStorage` under its persistence key, then also writes an older `settings` format for compatibility.
- `state.js` migrates old `localStorage.settings` data if the newer state has no sources yet.
- `main.js` maintains a cached Electron-side state object.
- `main.js` writes cached state to `savedSync.json` in the app user-data folder.
- `main.js` also uses `savedSync.json.bak`, electron-store cached-state backup, and `localStorageBackup`.
- `main.js` has quality/downgrade gates to avoid replacing good settings with a partial/empty settings payload.
- `main.js` can mirror cached state back into the main window `localStorage`.
- `settings-backup.js` exports recognized cached state fields plus selected app `localStorage` keys.

Recognized desktop settings backup localStorage keys:

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

### Chrome Extension

Confirmed from public docs/support and initial source scans:

- Extension state and settings use Chrome extension storage APIs and extension page state.
- The public README warns not to uninstall the extension when updating because uninstalling deletes settings.
- Manual extension update should replace files and reload the extension/browser instead.
- If uninstall is required, export settings first where possible.

Source-checked in `../13-reference/settings-session-storage-source-trace.md`, still needing runtime validation:

- Exact split between `chrome.storage.sync`, `chrome.storage.local`, popup state, and generated export files.
- Exact export/import UI labels and whether browser File System Access API restrictions affect the current export flow.

## Backup Tools

### File -> Settings Backup

Source-backed:

- Menu path exists under `File -> Settings Backup`.
- `Export Settings...` writes a JSON-like `.data` or `.json` file through `settings-backup.js`.
- Export includes recognized cached fields: `streamID`, `password`, `state`, and `settings`.
- Export can include selected local app settings, including source list state.
- Import reads the file, validates recognized Social Stream settings, restores cached state/localStorage keys, and reloads the main app window.
- `tests/electron/settings-transfer-e2e.js` exercises a settings export/import round trip and checks that unrecognized localStorage keys are excluded.

Use this for:

- Normal settings moves.
- Before switching app/source versions.
- Before risky troubleshooting.
- Before a user tries Full Reset.

### Advanced Full Session Transfer

Source-backed:

- Menu path exists under `File -> Advanced Full Session Transfer`.
- It creates encrypted `.ssappbk` backups using the Electron user-data folder.
- Manual backup can exclude caches, which is recommended in the UI.
- Restore replaces local session data and creates a `pre-restore-*` copy beside the user-data folder.
- The app warns that normal settings moves should use Settings Backup instead.
- Auto Full Session Transfer can be configured with secure credential storage and runs only when sources are inactive/idle according to app runtime state.
- `tests/electron/settings-transfer-e2e.js` exercises full session backup/restore round trip logic.

Use this for:

- Whole-profile migration.
- Preserving cookies/session data and app profile state.
- Moving to another machine when normal settings export is not enough.

Avoid this for:

- Simple overlay styling changes.
- Simple source list cleanup.
- First-line troubleshooting when a smaller export/import is enough.

## Reset And Recovery

### Clear All Sources

Source-backed:

- Removes configured sources/groups from the embedded core.
- Keeps sessions, cookies, and other settings.

Use when:

- Source list is duplicated/corrupt.
- A source keeps auto-activating incorrectly.
- User wants to rebuild sources without wiping auth state.

### Reset Everything / Full Reset

Source-backed:

- Shows a destructive warning.
- Clears store data, app localStorage keys, cache/cookies/storage for known sessions and partitions.
- Preserves stream ID and password where possible.
- Resets sessions to default.
- Reloads the main window.

Use when:

- App profile state is corrupt.
- Bad cookies/cache cause repeated login/source failures.
- The user explicitly wants a full reset and understands the consequence.

Do not use when:

- The user only needs to clear sources.
- The user has not exported settings and wants to keep configuration.

## Settings Loss Diagnosis

First classify the symptom:

| Symptom | Likely area | First action |
| --- | --- | --- |
| Source list disappeared, but session ID/settings remain. | `socialStreamState` / state manager localStorage. | Check Settings Backup export and app user-data `savedSync.json`. |
| Global settings disappeared, but sources remain. | cached state/settings hydration or partial persistence. | Check whether `savedSync.json` still has settings; avoid full reset until backed up. |
| Setting is visible/saved but did not change behavior. | stale page/source/link or reload boundary, not necessarily loss. | Use `../13-reference/settings-change-impact-matrix.md` before reset/recovery advice. |
| Everything reset after reinstall/update. | user-data or extension storage removed. | Ask whether app profile was deleted or extension was uninstalled. |
| Event Flow survived but other settings vanished. | storage split or stale support claim. | Source-check current Event Flow storage before stating cause. |
| Settings appear briefly then disappear. | hydration/race/partial-state issue. | Use diagnostics; collect logs and whether `savedSync.json` has settings. |

Diagnostics source notes:

- `settings-loss-diagnostics.js` checks app code signatures around popup hydration, synchronous `getSettings`, background `tryAgain`, and partial settings threshold.
- It interprets non-empty `savedSync` as evidence that symptoms may be hydration/IPC timing rather than true disk loss.
- `settings-rootcause-diagnostics.js` compares source paths, saved settings counts, fallback/core asset checks, and local backups.

These diagnostics are supporting sanity checks, not full in-app testing.

## User-Facing Recovery Flow

1. Stop making changes.
2. Use `File -> Settings Backup -> Export Settings...` if the app still opens and has any useful settings left.
3. Check whether `savedSync.json` exists in the app user-data folder.
4. If there is a recent exported settings file, import it through `File -> Settings Backup -> Import Settings...`.
5. If restoring a whole app profile, use `Advanced Full Session Transfer -> Restore Full Session Transfer Backup...`.
6. If only sources are bad, use `Clear All Sources` instead of Full Reset.
7. Use Full Reset only after export/backup or when the user accepts total local cleanup.
8. After import/restore, reload/reactivate sources and reopen generated dock/overlay links.

## Extension Update Guidance

Source/public-doc-backed:

- Do not uninstall the extension to update if settings should be kept.
- Replace the manual extension files and reload the extension/browser.
- Chrome Web Store updates are automatic but can lag manual builds.
- Export settings before uninstalling or switching extension channels where possible.

Support reminders:

- Browser cleanup tools, "clear on exit", profile resets, or Chrome profile changes can remove extension state.
- Session ID mismatch can look like settings loss because existing dock/overlay links point at a different session.

## What To Ask For

- Desktop app or extension?
- OS and app/extension version.
- Did the user update, uninstall, run cleanup tools, or reset browser/app data?
- Which settings vanished: source list, global settings, session ID, Event Flow, Spotify IDs, TTS, overlays?
- Does the app still show `File -> Settings Backup`?
- Was there a prior `.data`, `.json`, or `.ssappbk` backup?
- Does `savedSync.json` exist and have recent modified time?
- Was the user running a custom `--user-data-dir` / `SSAPP_USER_DATA_DIR`?

## Source-Backed Facts To Keep Current

- Normal backup file format marker: `ssapp-settings-backup`.
- Normal backup version: `1`.
- Full session backup file extension: `.ssappbk`.
- Full session restore keeps a `pre-restore-*` copy.
- Local-source ZIP extraction uses app user-data under `localSource`.
- The app has safeguards against partial settings downgrades.

## Open Verification Tasks

- Extension export/import exact UI and storage split.
- Event Flow storage location and why it may survive when other settings do not.
- Current user-data folder names per OS/build/package ID.
- Whether backup/import covers all newer settings added after this pass.
- Real in-app validation of export/import menu behavior.
