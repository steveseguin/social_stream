# Settings Change Impact Matrix

Status: heavy source-check pass on 2026-06-24. No Chrome extension runtime, hosted page, OBS, or Electron app e2e validation was performed.

## Purpose

Use this page when a user says a setting, option, generated link, session, app source field, or URL parameter was changed but nothing happened.

This page is the practical "what has to reload or reconnect?" layer over:

- `settings-and-toggles.md`
- `settings-session-storage-source-trace.md`
- `url-parameter-source-trace.md`
- `options-settings-proof-ledger.md`
- `04-standalone-app-source-windows.md`
- `10-troubleshooting/settings-loss-and-backups.md`

## Source Anchors

Extension and shared source checked:

- `background.js`
- `popup.js`
- `shared/config/settingsDefinitions.js`
- `shared/config/urlParameters.js`
- `dock.html`
- `featured.html`
- `poll.html`
- `timer.html`
- `waitlist.html`
- `tipjar.html`
- `actions.html`

Standalone app source checked:

- `ssapp/state.js`
- `ssapp/main.js`
- `ssapp/settings-backup.js`

## Evidence Boundary

Confirmed by source inspection:

- Popup settings are saved through `background.js` `cmd: "saveSetting"` into `chrome.storage.local.settings`.
- Session/password changes use `cmd: "sidUpdated"` and are not the same save path as normal popup settings.
- `popup.js` generates overlay/tool URLs from the current response and session/password state.
- Many HTML pages create their own `URLSearchParams(window.location.search)` and read URL options during page initialization.
- The standalone app stores source/window state separately from SSN popup settings.
- The standalone app maintains cached SSN settings and backup/mirror layers that can intentionally reject empty or partial settings snapshots.

Not confirmed here:

- Whether a specific source script live-updates a specific setting without reload.
- Whether a specific OBS browser source refreshes correctly.
- Whether a specific Electron source window applies a source-state edit without reopening.
- Whether import/export/reset behavior works in a real running app profile.

Use `16-runtime-validation-playbooks.md` before promoting any row here to runtime-tested.

## Mental Model

"Setting" is overloaded. First classify what changed.

| Thing Changed | Stored Where | Main Reader | Typical Impact Timing |
| --- | --- | --- | --- |
| Popup setting/toggle/text field | `chrome.storage.local.settings` in extension mode; app shim/cached state in standalone app mode | Background, popup, source scripts, pages, or target page messages depending on feature | Some effects are immediate, but many need target page reload, source reload, reconnect, or a target page message path. |
| Session ID | `chrome.storage.sync.streamID` in extension mode; cached app state in app mode; generated page URLs | Background transport, popup link builder, dock/overlays/API pages | Transport can reset, but already-open OBS/overlay URLs still need refresh or replacement if they contain the old session. |
| Password | `chrome.storage.sync.password` in extension mode; cached app state in app mode; generated page URLs | Background transport, generated links, protected/control pages | Same as session: new links include it, old links do not change themselves. |
| URL parameter | The URL string for one page instance | That page's parser | Usually page-load only. Edit URL and refresh the page or OBS browser source. |
| Generated link in popup | Derived output from popup state | User, OBS/browser source, opened page | Regenerating/copying a link does not update an already-open browser source. |
| App saved source entry | `localStorage.socialStreamState` in `ssapp/state.js` | App renderer/source-window lifecycle | May affect future source-window creation more than the currently running window. Reopen/reload the source window when in doubt. |
| App cached SSN settings | `savedSync.json`, `.bak`, electron-store backup, localStorage mirror/backup | App IPC, embedded popup/background shim | App can preserve older good settings instead of accepting a tiny/empty snapshot. |
| Page-local feature state | Individual page localStorage or page variables | The specific tool page | Page-specific. Reset, command, reload, or storage cleanup depends on the page. |
| Provider/auth/token/account setting | Popup setting plus external provider/account/session state | Provider code, app OAuth handler, source page, or platform | Saving the setting is not proof the provider/account/token is valid. |

## Impact Matrix

| User Says | Likely Changed | What To Check First | Why It May Not Take Effect |
| --- | --- | --- | --- |
| "I enabled the option but the source still does not capture it." | Popup source/capture setting | Exact key in `settings-key-index.md`; exact source doc/file; source page reload state | Many source scripts read settings during setup or filter before forwarding. Messages already filtered upstream cannot be recovered by dock or overlay settings. |
| "I changed the overlay style but OBS still looks the same." | URL parameter or generated overlay URL | Current OBS browser-source URL; target page support in `url-parameter-source-trace.md` | URL parameters are usually read when the overlay loads. OBS may still have the old URL or an unrefreshed page instance. |
| "I changed my session but the overlay is blank." | Session ID | Same session on source, dock, overlay, API client, and OBS URL | `sidUpdated` can reset transport, but existing links still contain the old `session=` unless refreshed or replaced. |
| "I copied a new popup link but the old browser source did not update." | Generated link output | Whether OBS/browser source URL was replaced and refreshed | Popup links are derived output. Copying a new link does not mutate old tabs or OBS sources. |
| "This URL option works on dock but not on another page." | Page-specific URL parameter | Target page parser, not only generated URL parameter docs | Generated URL parameter docs mostly prove the dock/overlay catalogue. Other pages read their own narrower option sets. |
| "The API command returned success but nothing changed after a settings/URL edit." | API action plus target/page state | `api-command-validation-matrix.md`; target page open, session, label, channel | A command can be accepted by the transport while the intended page is closed, on a different label, or does not implement that action. |
| "I changed a setting in the app, but Chrome extension behavior did not change." | App cached state or app source state | Whether the user is in standalone app or Chrome extension; `04-standalone-app-source-windows.md` | App and extension do not share the same browser profile/storage. The app emulates extension APIs and also has its own state layers. |
| "I edited a source in the app but the running source window kept the old behavior." | App saved source entry | Source ID, source window reuse, custom session, active connection mode | `ssapp/main.js` can reuse a live source window. Saved state may apply on reopen/reload, not necessarily to an already-running window. |
| "The app keeps using the wrong login/account." | App custom session/source partition | Source `customSession`, source identity fields, app session binding | The app uses Electron partitions. Chrome login state does not automatically apply, and remembered custom sessions can follow source identity keys. |
| "I imported/restored settings but the current page still looks old." | Backup/import plus stale page instance | Whether the app/popup reloaded, whether source windows/OBS links were reopened | Import can restore cached settings and localStorage keys, but existing pages/source windows may still need reload. |
| "The app did not accept my settings change." | App partial/empty settings guard | App logs and cached-state key counts; `settings-loss-and-backups.md` | `ssapp/main.js` can block empty or partial settings overwrites to protect established settings. |
| "I changed TTS/AI/provider settings but it still fails." | Provider settings plus provider runtime | Provider key/account/endpoint/model, page producing audio/text, browser/app audio permission | The popup setting can save while the external provider, local model, audio autoplay, OBS audio capture, or account quota still fails. |
| "I changed custom CSS/JS but nothing changed." | URL param, uploaded custom JS, or app custom file state | Hosted/local/app context and page support for `css`, `js`, `custom.js`, or base64 params | Custom code support is page-specific and context-sensitive. Some pages only allow script injection in trusted/local/OBS/Electron contexts. |
| "Poll/timer/tip jar state did not reset." | Page-local state or page action | The exact page's commands and local storage behavior | Tool pages can have their own runtime state. Popup settings and URL params are not a universal reset path. |

## Reload And Reconnect Rules

Use these as support defaults until the exact feature source proves otherwise.

| Change Type | Default Support Advice |
| --- | --- |
| Popup setting that affects a source script | Save the setting, then reload or reconnect the source page/window if behavior does not change. |
| Popup setting that affects an overlay page | Save the setting, then refresh the target page if the page does not receive a live settings message. |
| URL parameter | Edit the target URL and reload that exact page or OBS browser source. |
| Generated popup link | Replace the URL wherever it is used, then refresh/open that target. |
| Session/password | Regenerate or update source, dock, overlay, API, and OBS URLs so all surfaces use the same session/password. |
| App saved source entry | Reopen or reload the app source window, especially if URL, mode, custom session, or account identity changed. |
| App cached settings import | Let the app reload when it does, then reopen stale source windows and refresh OBS/browser sources. |
| Provider/auth key | Save the setting, then test the provider path; do not assume storage success means account/auth success. |

## Decision Tree

1. Identify the product surface: extension, standalone app, hosted page, local page, OBS browser source, API client, or source page.
2. Classify the changed thing: popup setting, session/password, URL parameter, generated URL, app source state, app cached settings, page-local state, provider/auth, or custom code.
3. Find the exact key or parameter:
   - Popup setting: `settings-key-index.md`
   - URL parameter: `url-parameter-index.md` and `url-parameter-source-trace.md`
   - App source state: `04-standalone-app-source-windows.md`
   - App backup/import/reset: `10-troubleshooting/settings-loss-and-backups.md`
4. Check where the user changed it:
   - Popup UI
   - OBS URL
   - Browser address bar
   - App source editor
   - App backup/import
   - API command
   - Custom file/CSS/JS
5. Check whether the affected target was refreshed, reloaded, reopened, or reconnected.
6. If data is missing, check upstream filters/source settings before overlay styling. A dock/overlay URL cannot display events that were never captured.
7. If the standalone app is involved, check whether app cached state, source-window state, source session partition, or Chrome extension storage is being mixed up.
8. Before destructive recovery, export/backup settings if any useful state remains.

## Common False Positives

### "It saved, so it should apply everywhere."

Saving a popup setting proves the stored `settings` object changed. It does not prove every source script, overlay, page, app source window, OBS browser source, or external provider has reloaded or re-read it.

### "The generated URL changed, so OBS should update."

Generated URLs are copied output. OBS keeps its own browser-source URL and page instance until the user replaces or refreshes it.

### "A URL parameter is global."

URL parameters are page-specific. `dock.html`, `featured.html`, `poll.html`, `timer.html`, `waitlist.html`, `tipjar.html`, and `actions.html` each parse their own parameters.

### "The app and extension share settings."

They can use the same Social Stream source files, but they do not share the same browser profile. The app has Electron IPC, localStorage app state, cached settings, source-window partitions, and backup/mirror behavior.

### "The app lost settings because a tiny payload appeared."

Maybe, but source shows app guardrails that block many empty or partial settings overwrites. Check backups and logs before assuming disk loss.

### "Changing a filter can bring back old messages."

Filters that run before forwarding can prevent data from reaching the dock or overlay. Old filtered events usually need new source events after the filter is changed and the source is reloaded if needed.

## Support Answer Pattern

```text
That change is probably saved, but it may not be read by the already-open page/source.

First identify whether this is a popup setting, a URL parameter, a generated link, or an app source setting. For popup settings, reload/reconnect the affected source or page if it does not update live. For URL parameters or OBS links, replace the URL and refresh that exact browser source. If this is the standalone app, also check whether the running source window or custom session needs reopening.
```

## Runtime Validation Needed

High-value follow-up passes:

- Build a per-setting live-update/reload-required table for top support settings.
- Validate session/password changes in Chrome extension, hosted pages, and OBS browser sources.
- Validate app settings import/export/reset and app source-window reload behavior in a real Electron run.
- Validate source-specific capture toggles for high-volume platforms after source page reloads.
- Validate custom CSS/JS behavior by hosted page, local file, OBS/browser source, and app context.
