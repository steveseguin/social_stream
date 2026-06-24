# Installation And Surfaces

Status: heavy extraction pass started from README/download/app docs.

For a support-oriented decision guide covering install path choice, safe update flow, version mismatch symptoms, and reinstall/settings warnings, use `13-reference/install-update-version-guide.md`.

## Source Anchors

- `README.md`
- `docs/download.html`
- `docs/ssapp.html`
- `docs/commands.html`
- `C:\Users\steve\Code\ssapp\AGENTS.md`
- `C:\Users\steve\Code\ssapp\package.json`
- `C:\Users\steve\Code\ssapp\RELEASE.md`

## Install Choices

| Choice | Best For | Main Limits |
| --- | --- | --- |
| Chrome Web Store extension | Easiest install for Chromium users | Store review means it can lag GitHub; MV3 restrictions apply. |
| Manual unpacked extension | Latest code, development, advanced users | Manual update required; do not uninstall to update. |
| Firefox XPI | Firefox users | Missing some Chromium-only features, including debugger/tab capture behaviors and some TTS/model features. |
| Standalone app | Users who want app-managed sources and no browser extension | Embedded sign-in can be blocked by some platforms; app behavior needs real app testing. |
| Hosted pages | Normal OBS/dock/featured use | Cannot load local-only custom files like a local `custom.js`. |
| Local/forked pages | Advanced customization and source work | User must manage updates and local path quirks. |
| Lite web app | Quick/mobile/lightweight sessions | Very limited features and customization. |

## Manual Extension Install

Current public flow:

1. Download the GitHub source archive.
2. Extract it into a folder.
3. Open the browser extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
4. Enable Developer Mode.
5. Click Load unpacked.
6. Select the extracted Social Stream folder.
7. Reload any already-open chat pages.

Support reminders:

- Extension icon red means off; green means enabled.
- Reload source chat pages after extension reload/update.
- Keep the extracted folder in place. Moving/deleting it breaks the unpacked extension.

## Updating The Extension

Do:

- Download new files.
- Replace the old files.
- Reload the extension or restart the browser.
- Reload source chat pages.

Do not:

- Uninstall just to update.

Reason: uninstalling deletes extension settings. If uninstall is required, export settings first and import them after reinstalling.

## Browser Store Builds

Chrome Web Store:

```text
https://chromewebstore.google.com/detail/social-stream-ninja/cppibjhfemifednoimlblfcmjgfhfjeg
```

Firefox direct XPI:

```text
https://raw.githubusercontent.com/steveseguin/social_stream/firefox/social-stream-ninja.xpi
```

The README says the Chrome Web Store build is updated every few weeks because of review restrictions. For newest features/fixes, use manual GitHub install.

## Manifest Version Notes

The README says Manifest V2 warnings can be ignored for current function. Manifest V3 exists and is used by Chrome Web Store builds, but the README notes MV3 may require a small browser tab to remain open.

When debugging an extension issue, record whether the user is on:

- Manual MV2/unpacked.
- Manual MV3 branch/build.
- Chrome Web Store MV3.
- Firefox XPI.

Do not assume all features are available across those surfaces.

## Firefox Limits

Current public docs mention Firefox limitations:

- Some TTS voice/model support is missing or limited.
- Tab capture/debugger-dependent features are not available.
- Auto-responder/debugger behavior should be treated as Chromium-only unless current code says otherwise.

Ask Firefox users to reproduce in Chrome/Edge when diagnosing source capture or auto-response features that depend on Chromium APIs.

## Standalone App Install

The download page points Windows, macOS, and Linux app downloads to Social Stream release assets:

```text
https://github.com/steveseguin/social_stream/releases
```

Download-page notes:

- Windows: Windows 10/11 x64.
- macOS: standalone desktop app.
- Linux: AppImage, limited support.
- No browser extension required.
- App docs say standalone builds automatically update.

Repo boundary:

- App code lives in `C:\Users\steve\Code\ssapp`.
- Social Stream source edits still belong in `C:\Users\steve\Code\social_stream`.
- Do not use `ssapp/resources/social_stream_fallback` as the source of truth.

## Choosing Extension vs App

Recommend extension first when:

- Platform login/session is already working in Chrome/Edge/Brave.
- The source needs normal browser cookies.
- The user relies on a Chrome extension workflow.
- The user is testing whether a site still works with the canonical extension source.

Recommend standalone app when:

- Browser windows are getting throttled or discarded.
- The user wants app-managed source windows.
- The user wants always-on-top/transparent source viewing.
- The user cannot or does not want to install an extension.
- Source organization matters more than sharing a normal browser login.

Warn that some platforms block embedded sign-in or behave differently in Electron. If a sign-in fails in app mode, verify the same source in a normal browser extension before treating it as a source-code bug.

## Hosted Pages

Common hosted pages:

- `https://socialstream.ninja/dock.html?session=SESSION`
- `https://socialstream.ninja/featured.html?session=SESSION`
- `https://socialstream.ninja/sampleapi.html?session=SESSION`
- `https://socialstream.ninja/sampleoverlay?session=SESSION`
- `https://socialstream.ninja/actions/`
- `https://socialstream.ninja/docs/`

Hosted pages are usually the right answer for OBS browser sources and normal users because they stay current.

Limit:

- Hosted pages cannot load a local `custom.js` file from the user's disk.

## Local/Forked Pages

Use local or forked pages when:

- Building a custom overlay from scratch.
- Testing source changes.
- Loading local `custom.js`.
- Running a fork with stream-specific changes.

Risks:

- The user must update local files manually.
- Local-file behavior differs by OS and browser.
- README notes OBS local-file CSS/page behavior can be problematic on macOS/Linux.
- If the user edits files in an installed/unpacked extension folder, updates may overwrite local changes.

## Lite Web App

Download docs describe Lite as:

- No install needed.
- Lightweight and usable on mobile.
- Extremely limited feature set and customization options.
- Supports only a handful of core services.
- Useful for quick checks, not full production parity.

Do not use Lite docs to answer full extension/app questions unless the user is explicitly using Lite.

## Development/Source Mode

For Social Stream extension/source development:

- Work in `C:\Users\steve\Code\social_stream`.
- Load unpacked extension from that folder or a build-specific folder.
- Use local/localhost source pages where manifest entries support them.
- Use `scripts/validate-configs.sh` before commits/pushes that touch settings/config JSON.

For standalone app development:

- Work in `C:\Users\steve\Code\ssapp`.
- Read `ssapp/AGENTS.md` and `RELEASE.md` before release work.
- Run app behavior in the actual Electron app for real validation.

## First Support Questions

When a user says "SSN is installed but not working", ask or infer:

- Which surface: extension, standalone app, Lite, hosted overlay, local page?
- Which browser/app version/install source?
- Which source platform and URL pattern?
- Is the extension/app enabled?
- Is the source page reloaded after install/update?
- Is the chat page visible and not minimized?
- Does dock/overlay use the same session ID?
- Are toggle-required sources enabled?
- Is the user expecting a feature unavailable in Firefox, Lite, MV3, or app mode?

## Open Documentation Gaps

- Exact stable/beta branch guidance for every distribution path.
- Current auto-update behavior by OS/app channel.
- Full Firefox feature matrix.
- Full MV2/MV3 behavior matrix.
- App sign-in limitations by platform.
