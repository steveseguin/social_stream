# Diagnostic Decision Tree

Status: heavy troubleshooting routing pass started on 2026-06-24.

## Purpose

Use this page when the symptom is vague, such as "SSN is not working", "chat is blank", "OBS is blank", "the button does nothing", or "the app is different from Chrome".

The goal is to classify the failure before giving platform-specific advice. Once the branch is known, route to the focused troubleshooting, platform, API, or reference page.

## First Split

Ask one concrete question first:

```text
Does the dock receive new messages on the same session?
```

Use the answer:

| Answer | Branch |
| --- | --- |
| No, dock receives nothing | Capture/source problem |
| Yes, dock receives messages but overlay/API does not | Routing/display/API target problem |
| Yes, overlay receives messages but looks wrong | Display/CSS/filter/page-state problem |
| Messages arrive but commands/buttons/replies fail | Control/action/send-back problem |
| It works in Chrome but not the standalone app | App/source-window/auth-parity problem |
| The user does not know what page to open | Surface/page selection problem |

## Branch 1: Capture Or Source Problem

Use this when no messages reach the dock.

First checks:

1. Confirm SSN is enabled and the platform/source page was reloaded after enable/update.
2. Confirm the same session ID is used by source and dock.
3. Confirm the exact setup type: standard page, popout/chat-only URL, toggle-required private source, static/manual helper, injected helper, WebSocket/API source page, or app connector.
4. Confirm the source page visibly has new chat/messages after SSN is active.
5. Confirm the user is not expecting rich events from a mode that only captures plain chat.

Route:

- General extension capture: `extension-not-capturing.md`
- Supported-site setup: `../08-platform-sources/supported-sites-lookup.md`
- Public support strength: `../08-platform-sources/public-site-support-status.md`
- Platform event/mode limits: `../08-platform-sources/platform-capability-matrix.md`
- Source-page/API mode: `../08-platform-sources/websocket-source-pages.md`

Do not mark a platform broken until the exact URL and mode are confirmed.

## Branch 2: Routing Or Session Problem

Use this when the source or dock works, but another receiving page does not.

First checks:

1. Compare session IDs across source, dock, overlay, API client, Event Flow page, and app source window.
2. Check whether the receiving page needs a `label` and whether the API action targets that label.
3. Check whether the page is connected to the hosted relay, local server, or direct WebSocket path the user expects.
4. Refresh the receiving page after changing URL parameters.
5. Test the receiving page in a normal browser before debugging OBS.

Route:

- Page/URL selection: `../13-reference/surface-url-cheatsheet.md`
- Page capabilities: `../07-overlays-and-pages/page-capability-matrix.md`
- API routing: `../09-api-and-integrations/websocket-http-api.md`
- URL parameters: `../13-reference/url-parameters.md`

Common safe answer:

```text
Capture may already be working. Check the receiving page and session path before changing the platform source.
```

## Branch 3: Overlay Or OBS Display Problem

Use this when messages arrive but the visible output is blank, hidden, stale, or wrong.

First checks:

1. Open the overlay URL in a normal browser.
2. Verify the page type matches the expected payload:
   - `featured.html` waits for selected/featured messages.
   - `events.html` needs event/status/donation-style payloads.
   - `wordcloud.html` needs chat text.
   - `reactions.html` needs reaction/like events.
   - `ticker.html` needs a `ticker` payload.
3. Refresh the OBS browser source.
4. Temporarily remove custom CSS, browser-source filters, and URL options that hide content.
5. Check page persistence options if old data reappears.

Route:

- OBS display: `obs-overlay-display.md`
- Page capability matrix: `../07-overlays-and-pages/page-capability-matrix.md`
- Event/effect overlays: `../07-overlays-and-pages/event-effect-overlays.md`
- Live display utilities: `../07-overlays-and-pages/live-display-utilities.md`
- Theme pages: `../07-overlays-and-pages/theme-pages.md`

Do not assume OBS is the problem until the same URL has been tested in a normal browser.

## Branch 4: Control, Command, Or API Action Problem

Use this when messages arrive but a command, button, API action, StreamDeck button, Event Flow action, or send-back action does nothing.

First checks:

1. Identify the command system: API action, viewer chat command, URL parameter, Event Flow action, MIDI/hotkey command, or page-specific UI button.
2. Check the exact action name and required value format.
3. Confirm the target page/source is open and connected.
4. Confirm remote API control is enabled for API actions.
5. Confirm values are URL-encoded for HTTP commands.
6. For send-chat, confirm the platform/mode/auth path supports send-back.

Route:

- Command systems: `../13-reference/commands-and-actions.md`
- Exact action lookup: `../13-reference/action-command-index.md`
- API transport: `../09-api-and-integrations/websocket-http-api.md`
- Event Flow: `../09-api-and-integrations/event-flow-editor.md`
- Send-back support: `../08-platform-sources/platform-capability-matrix.md`

Common safe answer:

```text
The request can be valid while the target still does nothing if the target page/source is not open, not on that session, or does not support that action.
```

## Branch 5: Standalone App Or Auth Problem

Use this when behavior differs between the Electron app and a normal browser, or login/sign-in fails.

First checks:

1. Confirm app version, OS, source mode, and session.
2. Confirm whether the same workflow works in the Chrome extension.
3. Check whether the app source window loaded the intended Social Stream source file.
4. Check whether the platform blocks embedded browsers, popups, cookies, CAPTCHA, OAuth callback, or external-browser flow.
5. For TikTok, check app-specific mode/signing/connector behavior before using generic extension advice.

Route:

- App source windows: `../04-standalone-app-source-windows.md`
- App troubleshooting: `desktop-app-issues.md`
- Auth/sign-in: `auth-and-sign-in.md`
- Settings/backups: `settings-loss-and-backups.md`
- TikTok app modes: `../08-platform-sources/tiktok.md`

Do not call app behavior tested unless the real app workflow was run end to end.

## Branch 6: Settings Or URL Option Problem

Use this when the user changed an option and nothing happened, or the wrong behavior persists.

First checks:

1. Decide whether the option is a popup setting, URL parameter, page-local state, browser storage, app state, or source-page field.
2. Refresh the target page after URL parameter changes.
3. Check whether the page actually supports that parameter.
4. Check whether a setting needs page/source reload.
5. Check whether app and extension settings live in different storage contexts.

Route:

- Settings and toggles: `../13-reference/settings-and-toggles.md`
- Exact setting keys: `../13-reference/settings-key-index.md`
- URL parameter families: `../13-reference/url-parameters.md`
- Exact URL parameter index: `../13-reference/url-parameter-index.md`
- Storage basics: `../06-settings-sessions-and-storage.md`

## Branch 7: Customization Or Development Problem

Use this when the user wants to change behavior, add a source, make a plugin, customize an overlay, or use custom code.

First checks:

1. Identify the desired result: visual styling, custom overlay, automation, external app, custom source, or first-class platform support.
2. Prefer URL parameters and CSS for styling-only changes.
3. Use custom overlays for visual layout changes.
4. Use API/Event Flow for external automation.
5. Use custom/generic source or a new source file for new data capture.
6. Keep untrusted JavaScript and secrets out of public support channels.

Route:

- Plugin/customization paths: `../13-reference/custom-plugins-and-extensions.md`
- Custom overlays: `../07-overlays-and-pages/custom-overlays.md`
- New source development: `../12-development/adding-a-source.md`
- Shared code rules: `../12-development/shared-code-rules.md`

## Escalation Decision

Escalate or mark for deeper source validation when:

- Multiple users report the same platform break after the correct setup type is confirmed.
- The platform page layout, API, OAuth flow, or WebSocket payload changed.
- Dock receives malformed payloads.
- Exact send-back/moderation/reward behavior is unclear.
- App behavior differs from extension behavior and cannot be explained by login/context differences.
- Settings or state are lost after the documented backup/recovery path.
- A support-history claim conflicts with current docs or code.

Route unresolved claims to `../11-support-kb/unresolved-or-stale-claims.md`.

## Minimal Evidence To Request

Ask for:

- Surface/version: extension, app, hosted page, local page, Lite, API, or WebSocket source page.
- Platform/source and exact URL shape, with private identifiers redacted.
- Session consistency: whether source, dock, overlay, and API use the same session.
- Whether the dock receives messages.
- Whether the overlay works in a normal browser.
- Console/app errors or screenshots with secrets removed.

Never ask for raw session IDs, API keys, passwords, OAuth tokens, private webhook URLs, or private endpoints.
