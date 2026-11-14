# Install, Update, And Version Guide

Status: install/update/version reference pass started on 2026-06-24.

## Purpose

Use this page when an AI agent needs to answer:

- "Which SSN version should I install?"
- "Should I use Chrome Web Store, manual GitHub, Firefox, Lite, or the standalone app?"
- "How do I update without losing settings?"
- "Why is the Chrome Web Store version behind GitHub?"
- "Why did things break after updating?"
- "Can I uninstall/reinstall?"

For complete install-surface details, use `02-installation-and-surfaces.md`. For settings recovery, use `10-troubleshooting/settings-loss-and-backups.md`.

## Source Anchors

- `02-installation-and-surfaces.md`
- `10-troubleshooting/settings-loss-and-backups.md`
- `13-reference/modes-and-capability-matrix.md`
- `13-reference/preflight-checklists.md`
- `11-support-kb/support-intake-templates.md`
- `11-support-kb/support-response-playbook.md`
- `README.md`
- `docs/download.html`
- `docs/ssapp.html`
- `<ssapp repo>/RELEASE.md`

## Short Answer

Use the Chrome Web Store extension for the easiest Chromium install. Use manual GitHub/unpacked install when the newest fixes are needed. Use the standalone app when managed source windows or browser-throttling avoidance matter. Use Firefox or Lite only when their smaller capability surface is acceptable.

Do not uninstall just to update unless settings are exported first. For manual updates, replace files, reload the extension/browser, then reload source chat pages.

## Install Path Decision Matrix

| User Need | Best Starting Path | Main Caveat |
| --- | --- | --- |
| Easiest install on Chrome/Edge/Brave | Chrome Web Store extension | Store review can lag GitHub; MV3 behavior can differ. |
| Newest fixes or platform hotfixes | Manual unpacked GitHub install | User must keep folder stable and update manually. |
| Firefox browser use | Firefox XPI | Some Chromium-only features are missing or limited. |
| Managed source windows without browser extension | Standalone app | Embedded login/OAuth/cookie behavior can differ from normal Chrome. |
| OBS/dock/featured pages | Hosted pages | Hosted pages cannot load local disk `custom.js`. |
| Custom overlays, local `custom.js`, or source development | Local/forked pages | User owns updates and local-file quirks. |
| Quick/mobile/lightweight usage | Lite | Not full SSN feature parity. |
| Development or source edits | Local repo checkout | Must follow repo/source boundaries and test real runtime. |

## Safe Update Flow

### Manual Unpacked Extension

1. Export settings first if the user cannot afford to lose configuration.
2. Download or pull the updated `social_stream` files.
3. Replace the old files in the same stable unpacked folder, or update that folder in place.
4. Open the browser extensions page.
5. Reload the Social Stream extension.
6. Reload every open source chat page.
7. Reopen or refresh dock, overlays, OBS browser sources, and WebSocket/API source pages.
8. Send one test message to confirm the dock receives chat before testing overlays.

Do not:

- Delete or move the unpacked folder without reloading the extension from the new path.
- Uninstall just to update.
- Assume old open chat pages pick up new content scripts without reload.

### Chrome Web Store Extension

- Updates are handled by the browser/store.
- Store review can lag behind GitHub/manual builds.
- If a new platform fix exists only in GitHub/manual source, the user may need manual install temporarily.
- Record the install path before debugging version-specific behavior.

### Standalone App

- Download/install from Social Stream release assets.
- Record app version and OS before troubleshooting.
- Confirm whether the app auto-updated or whether the user installed a specific release.
- After app update, re-open source windows and confirm session/source bindings.
- If app behavior differs from Chrome extension behavior, test the Chrome extension as a control before calling it a source bug.

### Local/Forked Pages

- Pull or replace files intentionally.
- Re-test local file paths and browser/OBS permissions.
- Reapply local custom changes only if they were intentionally maintained.
- Hosted pages may have newer runtime behavior than a stale local folder.

## Settings-Safe Rules

- Export settings before uninstalling, switching extension channels, clearing browser data, resetting app data, or moving machines.
- Uninstalling an extension can delete extension storage.
- Browser cleanup tools, profile resets, and "clear on exit" settings can remove extension state.
- App settings and source windows are stored differently from Chrome extension settings.
- Full app session transfer is not the same as a simple settings export.
- A session mismatch can look like settings loss because old dock/overlay URLs still point at a previous session.
- Settings exports can contain secrets; use `privacy-security-and-secrets.md` before sharing them.

Start docs:

- `10-troubleshooting/settings-loss-and-backups.md`
- `06-settings-sessions-and-storage.md`
- `13-reference/privacy-security-and-secrets.md`

## Version Difference Symptoms

| Symptom | Likely Explanation | First Check |
| --- | --- | --- |
| Chrome Web Store user lacks a fix seen on GitHub | Store build is behind manual source | Ask install path and version. |
| Manual extension stopped loading | Folder moved/deleted, manifest reload needed, or bad local edit | Check unpacked folder path and extension errors. |
| Source page still behaves like old version | Page was not reloaded after extension update | Reload the source platform page. |
| Hosted overlay works, local overlay does not | Local files are stale or local-file restrictions apply | Test hosted URL, then local path. |
| App works differently from extension | Electron cookies/login/session/source-window behavior differs | Compare with Chrome extension in same session. |
| Firefox user lacks a feature | Chromium-only path or smaller Firefox capability surface | Reproduce in Chrome/Edge if relevant. |
| Lite user cannot find a feature | Lite is intentionally limited | Route to full extension/app if feature is needed. |
| Settings vanished after update | Uninstall/profile cleanup/storage loss or session mismatch | Stop changes; check backup/export path. |
| Platform broke after update | Could be SSN update, platform change, wrong mode, or stale page | Collect version/install path and exact platform URL type. |

## What To Ask A User

Use this intake when update/version is part of the problem:

```text
Can you share:

1. Install path: Chrome Web Store, manual unpacked GitHub source, Firefox XPI, standalone app, Lite, hosted page, or local/forked page?
2. Browser/app and OS.
3. SSN version/build if visible.
4. Whether this started after an SSN update, browser/app update, platform layout change, moving the unpacked folder, or importing settings.
5. Whether settings were exported before uninstall/reset/cleanup.
6. Whether the dock receives messages after reloading the source page.
7. Any extension/app errors, with sessions, keys, tokens, and private URLs redacted.
```

Route deeper:

- No chat after update: `10-troubleshooting/diagnostic-decision-tree.md`.
- Settings missing: `10-troubleshooting/settings-loss-and-backups.md`.
- App issue: `10-troubleshooting/desktop-app-issues.md`.
- Platform-specific issue: exact page under `08-platform-sources/`.

## User-Facing Answer Patterns

### Which Version Should I Use?

```text
Use the Chrome Web Store version if you want the easiest install. Use manual GitHub install if you need the newest fixes before store review catches up. Use the standalone app if you want managed source windows or fewer hidden-tab issues. Use Firefox/Lite only if their smaller feature set is enough.
```

### How Do I Update Manually?

```text
Replace/update the files in the existing unpacked extension folder, reload the extension, then reload your source chat pages. Do not uninstall just to update unless you exported settings first.
```

### Why Is The Store Version Behind?

```text
Chrome Web Store releases go through store review, so they can lag behind GitHub/manual source. If a fix is needed immediately, manual GitHub install may be the faster path.
```

### Can I Reinstall?

```text
Only do that after exporting settings if you want to keep them. Uninstalling the extension or clearing app/browser data can remove stored settings, sessions, and source state.
```

### Why Did It Break After Updating?

```text
First separate source capture from display. Reload the source page, confirm the dock receives messages on the same session, then refresh overlays/OBS. If only one platform broke, collect the platform URL type and install version before treating it as a general SSN issue.
```

## Bad Answers To Avoid

- "Just uninstall and reinstall."
- "The Chrome Web Store always has the latest version."
- "The app is always better than the extension."
- "Firefox is fully equivalent to Chrome."
- "Lite has all SSN features."
- "Updating cannot affect settings."
- "A platform broke because of SSN" before checking source URL type, install path, and whether the page was reloaded.
- "Share your settings file" without warning that exports can contain secrets.

## Open Verification Needs

- Exact current extension export/import UI labels and storage split.
- Current standalone app auto-update behavior by OS/build.
- Full Firefox feature matrix.
- Full MV2/MV3 behavior matrix.
- Current app sign-in limitations by platform.
