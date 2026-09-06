# Preflight And Maintenance Checklists

Status: support/reference checklist pass started on 2026-06-24.

## Purpose

Use this page when a user asks how to avoid common SSN problems before a stream, after updating, before using OBS, or before relying on API/AI/TTS/custom workflows.

This is a practical checklist page. For exact setup instructions, route to `how-to-recipes.md`; for troubleshooting after failure, route to `10-troubleshooting/diagnostic-decision-tree.md`.

For install path choice, safe update flow, version mismatch symptoms, and reinstall warnings, use `install-update-version-guide.md`.

## Source Anchors

- `02-installation-and-surfaces.md`
- `06-settings-sessions-and-storage.md`
- `07-overlays-and-pages/page-capability-matrix.md`
- `08-platform-sources/public-site-support-status.md`
- `09-api-and-integrations/websocket-http-api.md`
- `09-api-and-integrations/tts.md`
- `09-api-and-integrations/ai-features.md`
- `10-troubleshooting/quick-triage.md`
- `10-troubleshooting/settings-loss-and-backups.md`
- `10-troubleshooting/obs-overlay-display.md`
- `11-support-kb/support-intake-templates.md`
- `13-reference/how-to-recipes.md`
- `13-reference/install-update-version-guide.md`
- `13-reference/modes-and-capability-matrix.md`
- `13-reference/custom-plugins-and-extensions.md`

## Before First Setup

- Choose one main surface first: extension or standalone app. Do not debug both at once unless app-vs-extension parity is the question.
- Pick the correct install path: Chrome Web Store for easiest install, manual unpacked GitHub source for newest fixes, standalone app for managed source windows.
- Decide whether the user needs hosted pages, local/forked pages, Lite, API clients, or custom files.
- Create or copy the session ID intentionally and use the same session across source, dock, overlay, API, and app.
- Treat session IDs, passwords, API keys, OAuth tokens, webhook URLs, and private endpoints as secrets.
- If manual extension install is used, place the unpacked folder somewhere stable before loading it.
- Export settings before experimenting with reinstall, browser profile changes, or major setting changes.

Start docs:

- `02-installation-and-surfaces.md`
- `13-reference/modes-and-capability-matrix.md`
- `10-troubleshooting/settings-loss-and-backups.md`

## Before Each Stream

- Confirm SSN is enabled. For the extension, the icon should be on/green.
- Reload source chat pages after extension reloads, updates, or setting changes that affect content scripts.
- Confirm the source page is the correct setup type: normal page, popout chat, toggle-required page, manual/static helper, embedded widget, or WebSocket/API source page.
- Keep rendered DOM source pages visible and active when possible. Hidden/minimized/discarded tabs can throttle.
- Open `dock.html?session=...` and confirm it receives at least one fresh test message.
- Confirm OBS/browser overlays use the same session as the source and dock.
- Check that the intended overlay page matches the payload: normal chat, featured message, alert/event, game, theme, word cloud, map, ticker, or source page.
- Refresh OBS browser sources after changing URLs, sessions, custom CSS, or local files.
- Avoid making custom JavaScript, CSS, or source-file changes right before going live unless they were tested in a private session.

Fast route:

- Source not sending to dock: `10-troubleshooting/extension-not-capturing.md`.
- Dock works but overlay/OBS is blank: `10-troubleshooting/obs-overlay-display.md`.
- Unsure which page to open: `13-reference/surface-url-cheatsheet.md`.

## After Updating SSN

- For manual extension installs, replace/update files and reload the extension. Do not uninstall just to update unless settings were exported first.
- Reload every already-open source chat page after extension update or reload.
- Refresh dock, overlays, OBS browser sources, and WebSocket/API source pages.
- Recheck the same session ID after any restored settings/imports.
- Re-test one source message into dock before testing overlays.
- If a platform broke right after update, compare against the exact platform/source page and record the install path/version.
- If settings seem missing, stop and inspect backup/export/import paths before changing more settings.

Start docs:

- `10-troubleshooting/settings-loss-and-backups.md`
- `02-installation-and-surfaces.md`
- `11-support-kb/support-intake-templates.md`

## Standalone App Preflight

- Confirm the app version and operating system.
- Confirm whether the workflow is app-only, extension-only, or intentionally mixed.
- Open the app source window and verify the platform page loads, is logged in if needed, and displays new chat.
- Confirm the app source window uses the intended session and source state.
- Check whether the same source works in Chrome extension mode if the issue may be app-specific.
- Do not assume the app bypasses platform login restrictions or embedded-browser blocks.
- For TikTok, Kick, Facebook, or other app/OAuth/provider paths, verify the exact app flow before promising parity with Chrome.
- Keep app/e2e language precise: source inspection is not the same as app testing.

Start docs:

- `04-standalone-app-architecture.md`
- `04-standalone-app-source-windows.md`
- `10-troubleshooting/desktop-app-issues.md`
- `10-troubleshooting/auth-and-sign-in.md`

## OBS Overlay Preflight

- Test the overlay URL in a normal browser first.
- Confirm OBS uses the current hosted/local URL and not an old copied session.
- Confirm page family:
  - `dock.html` for operator dashboard.
  - `featured.html` for selected messages.
  - Theme pages for normal or featured-style visual chat.
  - `multi-alerts.html` for alert popups.
  - Event/effect pages for specific payload families.
  - Game pages for specific chat input rules.
- Set OBS browser source dimensions large enough for the overlay.
- Remove or disable custom CSS temporarily if content is invisible.
- Refresh the OBS browser source after URL/session/CSS changes.
- For local files, test hosted pages first when possible, then validate local-file and browser-source behavior separately.
- For audio/TTS, confirm where audio is produced and whether OBS is capturing that output path.

Start docs:

- `10-troubleshooting/obs-overlay-display.md`
- `07-overlays-and-pages/page-capability-matrix.md`
- `13-reference/surface-url-cheatsheet.md`
- `09-api-and-integrations/tts.md`

## API, StreamDeck, Companion, Event Flow, And Streamer.bot Preflight

- Enable the required API/remote-control toggles.
- Use the same session ID as the target dock/page/source.
- Confirm the target page is open and connected before sending commands.
- Check whether the action belongs to API actions, viewer chat commands, Event Flow actions, URL parameters, or page-specific controls.
- URL-encode values in HTTP GET commands.
- Use `label` only when the target page uses the same label.
- Test with a harmless action before using moderation, send-chat, scene changes, or paid-provider actions.
- Do not assume an HTTP/WebSocket success response means the target page acted.
- For platform send-back, confirm platform/source support, login, auth, and permissions.

Start docs:

- `09-api-and-integrations/websocket-http-api.md`
- `13-reference/action-command-index.md`
- `13-reference/commands-and-actions.md`
- `09-api-and-integrations/streamdeck-companion.md`
- `09-api-and-integrations/event-flow-editor.md`
- `09-api-and-integrations/streamerbot.md`

## AI And TTS Preflight

- Confirm ordinary chat reaches dock before debugging AI or TTS.
- Identify the provider or local path: browser/system TTS, cloud TTS, local TTS/model, cloud AI, local AI, cohost, generated overlay.
- Redact keys, endpoints, private prompts, and private knowledge sources from support screenshots/logs.
- Confirm provider account status, quota, model name, endpoint, and billing outside SSN when applicable.
- Test in a normal browser before OBS if audio or generated overlay display is the issue.
- For cohost overlays, confirm the correct page pair: `cohost.html`, `cohost-overlay.html`, `aiprompt.html`, or `aioverlay.html`.
- Treat AI moderation, reply generation, and content filtering as best-effort automation, not guaranteed safety.

Start docs:

- `09-api-and-integrations/tts.md`
- `09-api-and-integrations/ai-features.md`
- `07-overlays-and-pages/ai-cohost-pages.md`
- `13-reference/free-paid-and-support-boundaries.md`

## Customization Preflight

- Choose the smallest customization path:
  - URL parameters or OBS CSS for simple styling.
  - Theme page for prebuilt visuals.
  - Custom overlay for a custom layout.
  - API/Event Flow for external automation.
  - Custom source/source file for new data capture.
- Test custom CSS/JS in a private session before using it live.
- Avoid putting secrets in custom scripts, public URLs, pasted support logs, or screenshots.
- Do not edit the standalone app fallback mirror for source behavior.
- If hosted pages are used, do not expect them to load local disk `custom.js`.
- If a custom source emits SSN JSON, validate at least `chatname`, `chatmessage` or event content, `type`, `id`, and session transport.

Start docs:

- `13-reference/custom-plugins-and-extensions.md`
- `07-overlays-and-pages/custom-overlays.md`
- `12-development/adding-a-source.md`

## Safe Support Pack

When asking a user for evidence, collect:

- SSN surface and install path.
- Platform/source and URL type, not private full URL unless safe.
- Exact SSN page family: source, dock, overlay, theme, game, source page, OBS, or API.
- Whether dock receives messages.
- Whether overlay works in a normal browser.
- Whether issue started after update, reload, moved folder, platform layout change, or settings import.
- Console/app errors with secrets redacted.
- Screenshot only after session IDs, keys, tokens, private chats, private server names, and private account details are hidden.

Use `11-support-kb/support-intake-templates.md` for copyable request text.

## Do Not Do This As A First Step

- Do not tell users to uninstall/reinstall without settings export warnings.
- Do not ask for full session IDs, API keys, webhook URLs, OAuth tokens, passwords, private endpoints, or raw private logs.
- Do not assume a listed platform supports every feature.
- Do not assume app mode fixes every login issue.
- Do not call a support-history pattern current without source-checking.
- Do not call source review "tested" for app, browser, OBS, or platform behavior.
- Do not debug OBS before confirming dock receives messages.
- Do not debug overlay CSS before confirming the overlay page receives the right payload family.
