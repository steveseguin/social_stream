# Quick Triage

Status: backbone extraction pass. Usable for first-pass support, not final-grade.

## Purpose

Give agents a short first-pass troubleshooting checklist for common SSN support questions.

For branch routing from vague symptoms, use `diagnostic-decision-tree.md`.

## Source Anchors

- `stevesbot/resources/instructions/social-stream-support.md`
- `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`
- `social_stream/docs/support.html`
- `social_stream/README.md`
- `social_stream/about.md`
- `social_stream/manifest.json`
- `ssapp/README.md`

## First 60-Second Checks

Start with these before platform-specific advice:

- Confirm whether the user is using the Chrome extension, the standalone Electron app, Electron Capture, or a hosted overlay page.
- Confirm the source page and dock/overlay/API client use the same session ID.
- Confirm the extension/app is enabled and the extension icon/state is on.
- Ask whether the chat/source is popped out when the platform requires a popout.
- Ask whether refreshing the source page and refreshing the OBS browser source changes anything.
- Confirm they are not using an old dock/overlay URL from a previous session.
- Confirm whether the problem is capture, routing, display, or control:
  - capture: SSN does not see messages
  - routing: dock sees messages but overlay/API does not
  - display: overlay loads but text/media is invisible or misplaced
  - control: messages arrive but send/delete/block/feature actions fail
- Ask for the exact platform, source URL, dock/overlay URL type, app/extension version, and whether this worked before.

## Required Info To Ask For

Ask for:

- Product surface: Chrome extension or standalone app.
- Platform/source: YouTube, TikTok, Twitch, Kick, Facebook, Instagram, Rumble, Discord, generic/custom, or other.
- Capture mode when relevant: normal DOM capture, WebSocket mode, API mode, or app-specific connector.
- Whether the source is live right now.
- Exact symptom: no messages, delayed messages, duplicates, missing events, overlay blank, OBS only, auth blocked, settings lost, or control action failed.
- Whether dock receives messages.
- Whether browser preview receives messages outside OBS.
- Whether the same session ID appears on both sender and receiver.

Do not ask for private credentials or tokens. If logs are needed, ask for redacted logs/screenshots.

## Quick Branches

### Extension not capturing

Use this branch when no messages reach the dock:

- Verify the extension is enabled/on.
- Reload the platform page after enabling.
- Use popout chat when the platform requires it.
- Check for wrong platform URL, old stream URL, or non-live stream.
- Try a clean Chrome profile/incognito only when needed to isolate conflicting extensions or cookies.
- Check whether the platform has a WebSocket connector and whether that mode is more appropriate.

### Dock receives messages, overlay does not

Use this branch when capture works but display does not:

- Verify dock and overlay have the same session ID.
- Refresh the OBS browser source or browser tab running the overlay.
- Check URL parameters that hide text, hide events, filter events, or change display style.
- Test the overlay in a normal browser outside OBS.
- For transparent overlays, remember that white/blank-looking pages can be expected in a browser preview if the visible text is white on transparent/white background.

### Standalone app issue

Use this branch when the user is in the Electron app:

- Confirm the app is using the intended Social Stream source root, not an invalid folder or stale imported zip.
- If login is blocked inside the app, try the Chrome extension path or a WebSocket connector from the regular browser where possible.
- For settings loss, avoid telling the user to clear app data first. Preserve settings/backups and inspect app storage behavior.
- If a workflow works in Chrome but not in the app, suspect Electron login context, preload bridge, IPC, or app-specific platform handler differences.

### OBS/browser source issue

Use this branch when it works in a normal browser but not OBS:

- Refresh the OBS browser source.
- Verify the OBS URL is the current overlay URL.
- Check browser-source dimensions.
- Disable or revise custom CSS temporarily.
- Confirm the overlay is not intentionally transparent, hidden, filtered, or waiting for a featured message/event.

## Platform Short Notes

These are support-history notes and should be source-checked during platform deep dives:

- YouTube: popout chat or supported Studio flow may matter. WebSocket mode can cover events that DOM mode does not.
- TikTok: fragile and frequently affected by platform changes. Username should usually be entered without `@`, and the account must be live. WebSocket/API modes and app signing behavior need exact docs.
- Kick: popout/sign-in/captcha state can block capture. Chrome extension or WebSocket mode may be more reliable than embedded app sign-in for some users.
- Twitch: distinguish normal chat capture from EventSub/WebSocket event features.
- Rumble/Facebook/Instagram/Discord: verify exact source URL format and whether the source is supported in extension, app, or both.

## When To Recommend Updating

Recommend updating when:

- The issue matches a known platform breakage category.
- The user's version is old compared with current repo/release notes.
- A platform connector depends on a recent manifest/source-script/provider change.

Avoid saying "update" as the only answer. Pair it with one concrete verification step and one fallback path.

## When To Escalate

Escalate or mark for deeper investigation when:

- Multiple users report the same platform failure after normal checks.
- The platform page layout/API changed.
- Dock receives malformed data.
- WebSocket/API actions fail while display-only flow works.
- The standalone app loses settings repeatedly after current repair logic should preserve them.
- Auth failures involve provider policy changes or embedded-browser restrictions.

## Extraction Notes

Deeper troubleshooting pages should split by symptom and platform. This page is only the first-pass routing checklist.
