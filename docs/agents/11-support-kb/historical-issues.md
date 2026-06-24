# Historical Support Issues

Status: heavy extraction pass started.

## Purpose

This file tracks recurring SSN support issues found in historical support summaries, playbooks, Q&A exports, and SQLite summary tables. It is not a final troubleshooting page. It is a mined evidence map for future docs and source verification.

Use `10-troubleshooting/platform-known-issues.md` for the platform-facing matrix and `unresolved-or-stale-claims.md` for claims that should not be promoted yet.

## Source Anchors

- `stevesbot/resources/instructions/social-stream-support.md`
- `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`
- `stevesbot/resources/learnings/unresolved-analysis.md`
- `stevesbot/resources/learnings/pipeline-analysis.md`
- `stevesbot/resources/learnings/playbooks/playbook-obs-overlay-issues.md`
- `stevesbot/resources/learnings/playbooks/playbook-tiktok-connection.md`
- `stevesbot/resources/learnings/support-qa/social-stream-configuration.md`
- `stevesbot/resources/learnings/support-qa/social-stream-qa.md`
- `stevesbot/resources/learnings/support-qa/social-stream-qa-expanded.md`
- `stevesbot/data/sqlite/knowledge.sqlite`
- `stevesbot/data/sqlite/stevesbot.sqlite`

## High-Volume Categories

### Source Opens But Messages Are Blank

Status: support-derived, needs current source verification per platform.

Repeated symptoms:

- Chat source opens but no messages appear in the dock or overlay.
- User is on the wrong page shape: full stream page instead of popout chat, creator/publisher view instead of viewer view, Studio page with a different DOM, or platform-specific URL mismatch.
- Capture tab/window is hidden, minimized, backgrounded, or throttled.
- User has not pressed `Activate` after adding or signing into a source.
- Extension is disabled, missing site permission, or conflicted by another extension/ad blocker/privacy tool.

Historical support actions:

- Confirm the extension icon is enabled/green.
- Confirm the exact session ID matches source, dock, and overlay.
- Use platform popout chat where the source expects popout.
- Reload/re-activate after login or CAPTCHA completion.
- Test in a clean Chrome profile or incognito window with only SSN enabled.
- Compare with another platform to separate platform-specific failure from general SSN setup failure.

Docs impact:

- Keep in `10-troubleshooting/extension-not-capturing.md`.
- Add platform-specific URL/page-shape notes to each source page.
- Do not claim all platforms require popout chat; current source pages differ.

### Embedded-Browser Auth Fails

Status: support-derived, volatile-platform.

Repeated symptoms:

- Google, Twitch, Kick, Rumble, LinkedIn, Zoom, Slack, Facebook, or other protected sites reject the standalone app's embedded browser.
- User sees "browser not supported", CAPTCHA/verification loops, Cloudflare-like anti-bot pages, missing popup state, or failed cookie persistence.
- The same site works in a normal browser or with the Chrome extension.

Historical support actions:

- Prefer the Chrome extension for sites that depend on an existing browser session.
- Use an external-browser or WebSocket flow when the app offers one.
- After sign-in, stop and activate the source again.
- Clear browser data only when a stale embedded session is suspected.
- Avoid promising that embedded login will work for every protected site.

Docs impact:

- Add an `auth-and-sign-in.md` troubleshooting pass later.
- Mark platform support as mode-dependent: extension, app Standard, app WebSocket, API/EventSub, or external browser.

### TikTok Mode And Stability Issues

Status: support-derived, volatile-platform, needs current source verification.

Repeated symptoms:

- TikTok worked before and suddenly stops.
- Standard mode requires the live page/capture page to stay visible or active.
- WebSocket mode works in the background but may miss some messages/users.
- Some regions, age verification flows, new accounts, VPNs, or TikTok anti-bot state affect capture.
- Gift combos appear as multiple incremental messages.
- Long sessions can stall, duplicate, or queue messages.

Historical support actions:

- Confirm the creator is currently live.
- Use the username from `tiktok.com/@USERNAME`, not the display name.
- Try Standard and WebSocket modes separately.
- Update SSN before debugging deep TikTok breakage.
- Re-auth, clear TikTok cookies, or try a clean browser profile when auth/session state is suspect.
- Treat gift combo updates as TikTok-side behavior unless current code says aggregation is available.

Docs impact:

- Keep TikTok guidance cautious and date-sensitive.
- Add a current-code pass through `ssapp/tiktok/*`, `ssapp/tiktok-signing/*`, `ssapp/tests/tiktok/*`, and `social_stream/sources/tiktok.js`.

### YouTube Setup, Studio, Gifts, And Moderation Events

Status: support-derived, partially source-backed from existing YouTube page pass.

Repeated symptoms:

- User opens a YouTube page but not the right chat view.
- Popout vs Studio vs WebSocket mode confusion.
- "Go live, trigger fake message, reload" style workflows take minutes.
- Auto-select/live-chat behavior was mentioned historically for Standard mode.
- YouTube gifts/memberships and moderation events can appear differently across capture paths.
- Google sign-in is blocked in embedded app contexts.

Historical support actions:

- Use popout chat or Studio-supported capture paths as documented by current source.
- If Google embedded sign-in fails, use browser extension or WebSocket/external-browser flow where available.
- Reopen/reload capture after login or mode changes.
- Verify whether gifts/memberships are supported in both Standard and WebSocket modes for the current build before documenting.

Docs impact:

- Add a YouTube intense pass for gifts, moderation replay, auto-select-live-chat, and app OAuth behavior.

### Twitch Activation, OAuth, And EventSub

Status: support-derived, needs current source verification for scopes/events.

Repeated symptoms:

- Twitch source added but not activated.
- "Bad Request" or token/auth failures.
- Channel points, subs, raids, bans, or other events require different modes/scopes than normal chat.
- Desktop app OAuth can fail if callback ports are blocked.

Historical support actions:

- Press `Activate` for Twitch after adding/signing in.
- Re-authenticate or remove/re-add source if token state is bad.
- Try WebSocket/EventSub mode when IRC/basic chat mode does not expose an event.
- Check local ports 8080 and 8181 if app OAuth callback fails.

Docs impact:

- Add source-backed Twitch mode matrix: chat, send, channel points, subs, user bans/timeouts, and required auth.

### Kick, Rumble, And CAPTCHA/Verification Loops

Status: support-derived, volatile-platform.

Repeated symptoms:

- Kick or Rumble sign-in gets stuck at human verification/CAPTCHA.
- Embedded browser fails while a regular browser can sign in.
- Kick external-browser login may open in the wrong browser profile.
- Users need to stop/re-activate after completing sign-in.

Historical support actions:

- Use Chrome extension when app embedded login is blocked.
- Try app WebSocket/external-browser mode if available.
- Copy the external-browser login URL into the browser profile where the correct account is signed in.
- Re-activate the source after successful login.

Docs impact:

- Source-check current Kick and Rumble implementations before finalizing exact steps.

### OBS Overlay Blank, White, Or Not Updating

Status: support-derived, partially source-backed from overlay/OBS pages.

Repeated symptoms:

- `featured.html` looks white/blank in Chrome but is transparent in OBS.
- `dock.html` is confused with the overlay page.
- Overlay URL has the wrong session ID or wrong page.
- Messages show in dock but not overlay.
- OBS browser source dimensions, cache, or refresh state prevent display.
- User expects dock setting changes to automatically alter an already-open overlay without reopening/refreshing the generated link.

Historical support actions:

- Distinguish dock/control page from overlay/display page.
- Confirm `?session=` matches exactly.
- Open overlay URL in a normal browser before debugging OBS.
- Feature a message manually or use `&autoshow`.
- Refresh or recreate OBS browser source when the browser engine caches bad state.
- Reopen generated links after settings that are encoded in URL parameters.

Docs impact:

- Keep in `10-troubleshooting/obs-overlay-display.md`.
- Add source-backed mapping of dock settings that change stored state vs URL parameters vs per-page local state.

### Text Is Invisible Or Styling Does Not Apply

Status: support-derived, partially source-backed.

Repeated symptoms:

- White text on white/transparent background.
- Custom OBS CSS conflicts with SSN theme CSS.
- Streamlabs CSS snippets do not map directly to SSN classes/variables.
- Ticker/horizontal scroll messages wrap unexpectedly.
- Donation/member highlight colors are not distinct enough.

Historical support actions:

- Inspect background and text color settings first.
- Use built-in themes or documented CSS variables before arbitrary CSS.
- Reopen overlay/dock link when generated URL parameters changed.
- Use CSS variables and source-specific classes only after source-checking current class names.

Docs impact:

- Add a custom overlay/CSS heavy pass later.
- Move exact class/variable lists into current-source-backed docs only.

### TTS Audio Missing, Intermittent, Or Wrong Device

Status: support-derived, partially source-backed from TTS page.

Repeated symptoms:

- Browser-native/system TTS plays on the wrong output device or not in OBS.
- OBS Browser Source audio is not routed because "Control Audio via OBS" is off or the page has not been interacted with.
- Cloud TTS drops due to provider/API rate limits or key restrictions.
- Queue overflow drops messages when chat arrives faster than speech playback.
- Local/custom TTS endpoints historically had build-specific bugs.

Historical support actions:

- Test TTS in a normal browser outside OBS.
- Click/interact with the page to satisfy autoplay requirements.
- Use OBS audio controls or a virtual audio cable when needed.
- Check provider credentials and restrictions.
- Use current/beta build only if a known fix is verified.

Docs impact:

- Add provider-by-provider source verification.
- Avoid claiming local/cloud provider support without checking current provider menu and code.

### Settings Loss, Migration, And Backups

Status: support-derived, needs source verification.

Repeated symptoms:

- Some app settings are lost after restart/update/cleanup, while sources or Event Flow settings survive.
- Users uninstall the extension to update and lose extension storage.
- Migration from Web Store extension to manual extension or desktop app loses settings.
- New machine transfer is unclear.

Historical support actions:

- Do not uninstall the Chrome extension just to update.
- Export settings before switching builds or machines when an export option exists.
- Keep critical session IDs, overlay URLs, API keys, and Event Flow notes backed up separately.
- Check app user-data/localStorage paths for desktop backups before documenting exact paths.

Docs impact:

- Needs heavy pass through `ssapp/state.js`, app storage, extension storage/export code, and current settings UI.

### Release Channel And Version Confusion

Status: support-derived.

Repeated symptoms:

- Chrome Web Store lag vs GitHub/manual build.
- Users are on older app versions with known fixed bugs.
- Platform-specific breakages require beta or latest release.
- Users cannot tell whether app/extension/source files are current.

Historical support actions:

- Ask for exact SSN version, app vs extension, OS, browser, platform source, and connection mode.
- For app bugs, ask whether the build loads local Social Stream source or bundled/remote source.
- For extension bugs, ask whether Web Store or manual GitHub build is installed.

Docs impact:

- Keep install/update docs separated by surface.
- Add a "reporting checklist" to final support docs.

## Newer Curated Support Records To Source-Check

Recent `stevesbot.sqlite` summaries mention these items. Treat them as candidates, not final facts:

| Topic | Historical support summary | Verification target |
| --- | --- | --- |
| Twitch OAuth callback ports | Desktop app Twitch WebSocket OAuth can fail when local ports 8080/8181 are occupied. | `ssapp` OAuth/server handlers. |
| Close to Tray/start minimized | Desktop app supports Close to Tray and startup flags. | `ssapp/main.js`, window/menu/tray handling. |
| Profiles | Global Settings profiles can save and switch overlay configurations. | current settings UI/storage code. |
| Fixed messages at intervals | Global Settings can send fixed chat messages on a timer. | settings/action code. |
| Horizontal ticker | Horizontal Scroll preset or ticker toggles control ticker layout. | overlay/theme/settings code. |
| YouTube gifts | Gifts supported in Standard and WebSocket modes in a recent build. | YouTube source and WebSocket source code. |
| Local Kokoro/custom TTS | Local TTS endpoint fixes landed in beta. | TTS provider code/current docs. |
| VPZone source | VPZone username casing and source button behavior. | VPZone source code. |
| `user_banned` event | Beta event stream exposes ban/timeout metadata for Twitch/Kick/YouTube. | event schema/source emitters. |
| YouTube translations | Captured translations can come from YouTube creator/platform settings. | YouTube source and UI docs. |

## Open Extraction Gaps

- Raw archive frequency checks have not been performed beyond schema/count inspection.
- `resources/knowledge.sqlite` has not been schema-checked in this pass.
- Many support answers reference older SSN versions such as `v0.3.127` or `v0.3.128`; current behavior must be checked against source before final docs.
- Exact settings labels, paths, CSS class names, and provider menus need current UI/source verification.
