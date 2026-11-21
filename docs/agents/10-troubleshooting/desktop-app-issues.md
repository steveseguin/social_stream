# Desktop App Issues

Status: heavy extraction pass started.

## Purpose

Document common standalone app support issues and the operational differences between the SSN desktop app and the Chrome extension.

The app is a host for Social Stream source files. For Social Stream feature behavior, use `<social_stream repo>` as the source of truth. For desktop shell behavior, use `<ssapp repo>`.

For source-window lifecycle, custom session, injection, and app-parity routing, use `../04-standalone-app-source-windows.md`. For app-specific TikTok modes, signing providers, fallbacks, replies, and test assets, use `../08-platform-sources/tiktok-standalone-app.md`.

## Source Anchors

- `ssapp/main.js`
- `ssapp/preload.js`
- `ssapp/state.js`
- `ssapp/settings-backup.js`
- `ssapp/transfer-backup.js`
- `ssapp/transfer-restore-runner.js`
- `ssapp/tests/electron/settings-transfer-e2e.js`
- `ssapp/tests/electron/settings-loss-diagnostics.js`
- `ssapp/tests/electron/settings-rootcause-diagnostics.js`
- `docs/agents/08-platform-sources/tiktok-standalone-app.md`
- `stevesbot/resources/instructions/social-stream-support.md`
- `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`

## App vs Extension Boundary

Use the desktop app when the user needs app-managed source windows, standalone packaging, local server controls, full-session backup/restore, app-side OAuth helpers, or app-specific TikTok connection handling.

Use the Chrome extension when the platform blocks embedded browser sessions, depends on an existing logged-in browser profile, or is easier to capture from a normal visible browser tab.

Support history repeatedly shows that Google, Kick, Rumble, and other protected sites may reject embedded or app-created browser contexts. Do not present the desktop app as universally easier than the extension.

## Source Loading And Local Files

Confirmed from `ssapp/main.js`:

- The app can run from source with `--running-from-source`.
- `package.json` includes commands such as `npm run start2` and `npm run start3` that pass source-mode flags.
- A `--filesource` value can point the app at a local Social Stream source folder.
- Saved local source roots are validated before reuse.
- A valid local Social Stream source folder must include `manifest.json`, `background.html`, `popup.html`, and `sources/twitch.js`.
- Local source can be loaded from a folder or from a ZIP; ZIP extraction happens under the app user-data folder before validation.
- Startup Preferences can persist `preferLocalAssets`, `forceTikTokClassic`, and `allowMultipleInstances`.

Important support rule:

- Do not tell users to edit the packaged fallback mirror for normal work.
- For source edits, use `<social_stream repo>`.
- If the app is pointed at the wrong local folder, clear the saved local source or reload with a validated Social Stream source folder.

## Window And Tray Behavior

Confirmed from `ssapp/main.js`:

- The Window menu has `Minimize to Tray`.
- The Window menu has a `Close to Tray` checkbox persisted in `startupFlags.closeToTray`.
- Startup Preferences includes startup flags and requires restart after save/reset.
- The app has a right-click menu item to make windows unclickable until focus shortcut handling.
- Window state restore has diagnostic support under `ssapp/tests/electron/window-state-diagnostics.js`.

Support handling:

- If the app appears closed but still running, check the tray first.
- If a window is unclickable, use the app/window controls or restart the app if the shortcut is not known.
- If a window opens off-screen or wrong-sized, use window-state diagnostics or reset relevant app state rather than reinstalling blindly.

## Reset Options

The app has different reset levels:

| Action | Source-backed behavior | When to use |
| --- | --- | --- |
| Clear All Sources | Sends `app:clear-all-sources`; keeps app sessions, cookies, and other settings intact. | Bad source list, duplicate/stale sources, source setup confusion. |
| Reset Everything / Full Reset | Clears store data, localStorage keys, cookies/cache/storage for sessions and partitions, and reloads the main window. It preserves stream ID/password when possible. | Corrupt app state, bad cached sessions, stuck embedded browser data. |
| Settings Backup export/import | Saves and restores recognized Social Stream settings plus selected app localStorage keys. | Normal settings migration or before risky changes. |
| Advanced Full Session Transfer | Encrypted `.ssappbk` backup/restore of the Electron user-data folder. Restore replaces local session data and keeps a pre-restore copy. | Whole-profile migration, not routine settings moves. |

Do not advise Full Session Transfer for a simple overlay/session settings export unless the user needs a whole app profile move.

## Local Server

The File menu includes `Enable Local Server` / `Stop Local Server`. The local server is app-side infrastructure, not a replacement for hosted overlay URLs in OBS.

Support guidance:

- If a user asks for OBS overlay URLs, use hosted `socialstream.ninja` overlay/dock URLs unless they are explicitly developing local files.
- If a local server feature fails, collect port, firewall, and exact URL/action details.

## Common Desktop-App Symptoms

### App Sign-In Fails

Likely causes:

- Protected site rejects embedded/app browser.
- OAuth callback port is occupied.
- Default browser/profile is not the one where the user is signed in.
- Platform auth changed.

First checks:

- Which platform and which connection mode?
- Does the Chrome extension work in a normal browser profile?
- Does the app show a port conflict?
- Did the auth page open in a separate browser window?
- Is another app using ports listed in `auth-and-sign-in.md`?

### Settings Look Wiped

Likely causes:

- Real disk/user-data loss.
- LocalStorage or cached-state hydration race.
- Cleanup tool/security software removed app data.
- User performed a full reset.
- User is running a different app profile/user-data path.

Use `settings-loss-and-backups.md` for detailed handling.

### Source Windows Reopen Or Do Not Stay Hidden

Support history mentions hidden capture pages reopening with auto-activate in older builds. Current source has source persistence, auto-activate flags, and tests/diagnostics around settings loss, but this specific issue needs a current source pass before being documented as current behavior.

Collect:

- App version.
- Source target.
- Whether auto-activate is enabled.
- Whether the source is Standard/page mode or WebSocket/API mode.
- Whether the issue survives after clearing sources.

### App Uses Wrong Social Stream Source

Check:

- `--filesource` command-line argument.
- Saved `localSourcePath`.
- Startup Preference: Prefer bundled/local assets.
- Whether the selected folder passes validation.
- Whether the app is on `beta` or `main` Social Stream branch.

If local source is invalid, the app clears/ignores the saved path and falls back to online/packaged assets.

### TikTok App Mode Or Signing Fails

The app has TikTok behavior that is not the same as the browser extension's DOM source.

First checks:

- Is the user in Standard/classic, WebSocket, legacy/polling, local signer, Euler, custom, or auto mode?
- Is the creator currently live?
- Is the app signed into the TikTok account that should read or send replies?
- Is the user trying to read chat, capture gifts/social events, or send replies?
- Did the app auto-fallback to compatibility mode?
- Is a custom signing service/API key configured?

Use `../08-platform-sources/tiktok-standalone-app.md` before giving detailed mode, fallback, local signer, or reply/send-back advice.

## Reporting Checklist

Ask for:

- App version and OS.
- Exact platform source and connection mode.
- Whether it is desktop app or Chrome extension.
- Whether local source / ZIP / `--filesource` is being used.
- Whether Startup Preferences are changed.
- Session ID mismatch symptoms, without asking user to post private session IDs publicly.
- Screenshot of any app error dialog.
- For auth: exact port conflict or OAuth error text.
- For settings loss: whether `File -> Settings Backup` exists, and whether `savedSync.json` appears in the app user-data folder.

## Open Verification Tasks

- Source-check every startup flag and document its CLI/env/store equivalent.
- Intense-check app source-window lifecycle, hidden/visible state, auto-activate, reconnect behavior, and app-parity claims from `../04-standalone-app-source-windows.md`.
- Source-check platform-specific source windows with current source files.
- Runtime-check TikTok app connector paths from `../08-platform-sources/tiktok-standalone-app.md`.
- Convert settings-loss diagnostics into a user-safe troubleshooting flow after current in-app verification.
