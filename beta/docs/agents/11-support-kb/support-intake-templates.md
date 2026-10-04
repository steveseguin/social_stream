# Support Intake Templates

Status: support intake template pass started on 2026-06-24.

## Purpose

Use this page when an AI agent needs to ask a user for enough information to diagnose an SSN issue without collecting secrets or raw private support data.

This page complements:

- `docs/agents/11-support-kb/index.md` for first-answer routing.
- `support-answer-bank.md` for concise answers.
- `support-response-playbook.md` for ready-to-send response phrasing.
- `common-misconceptions-and-boundaries.md` for overclaim guardrails.
- `14-validation-and-refresh-roadmap.md` for source/runtime validation passes.

## Intake Rules

- Ask for the minimum useful evidence.
- Ask for one workflow at a time: extension, standalone app, hosted page, local page, OBS, API, or external integration.
- Redact session IDs, passwords, API keys, OAuth tokens, webhook URLs, private endpoints, private channels, account emails, and private server names.
- For screenshots, ask users to crop or blur private chat, account names, tokens, browser profile details, and private URLs.
- Do not ask users to uninstall/reinstall before checking settings export/backup.
- Do not call a source issue a platform outage until the exact URL/mode/source path is known.
- Do not call an app issue tested unless real Electron in-app/e2e validation was performed.

## Universal First Intake

Use this when the report is too vague to route.

```text
Can you share these details, with secrets redacted?

1. Which SSN surface are you using: Chrome extension, standalone app, hosted page, local page, Lite, API, or WebSocket source page?
2. What platform/source are you trying to capture from?
3. What exact SSN page are you viewing: dock, featured, an overlay/theme/game page, source page, or OBS browser source?
4. Does `dock.html?session=...` receive messages on the same session?
5. Did this start after an SSN update, browser/app update, platform layout change, settings import, or moving the unpacked extension folder?
6. Any console/app errors, with private data redacted?
```

Route after intake:

- If dock receives nothing: `10-troubleshooting/extension-not-capturing.md`.
- If dock works but overlay/OBS is blank: `10-troubleshooting/obs-overlay-display.md`.
- If app source windows are involved: `10-troubleshooting/desktop-app-issues.md`.
- If API or commands are involved: `09-api-and-integrations/websocket-http-api.md`.

## No Chat Anywhere

Use when no SSN page receives messages.

```text
For the no-chat issue, please confirm:

1. SSN is enabled and the source page was reloaded after enabling/updating.
2. The source page URL type, with private details redacted: normal page, popout chat, studio/dashboard, source page, or helper page.
3. Whether new chat messages visibly appear on that source page.
4. Whether the extension/app and dock use the same session ID.
5. Whether the chat/source page is visible and not minimized.
6. Whether the source needs a toggle, login, popout URL, or WebSocket/API source page.
7. Browser/app version and SSN install path: Chrome Web Store, manual unpacked, GitHub local, Firefox, or standalone app.
```

Do not ask for:

- Full session ID.
- Private chat log.
- Account password.
- OAuth token.

Start docs:

- `10-troubleshooting/diagnostic-decision-tree.md`
- `10-troubleshooting/quick-triage.md`
- `10-troubleshooting/extension-not-capturing.md`
- `08-platform-sources/public-site-support-status.md`

## Dock Works, Overlay Or OBS Blank

Use when capture works but display fails.

```text
Since the dock receives messages, please share:

1. The overlay/page URL shape, with session redacted. Example: `featured.html?session=REDACTED` or `themes/name.html?session=REDACTED`.
2. Whether the same URL works in a normal browser outside OBS.
3. Whether OBS is using a browser source, local file, hosted URL, or copied old URL.
4. Browser source width/height and whether custom CSS is applied.
5. Whether the overlay is supposed to show all chat or only selected/featured/event-specific messages.
6. Whether refreshing the OBS browser source changes anything.
```

Common routing:

- All chat overlay: `07-overlays-and-pages/dock.md` or `07-overlays-and-pages/theme-pages.md`.
- Selected message overlay: `07-overlays-and-pages/featured.md`.
- Alert/event overlay: `07-overlays-and-pages/multi-alerts.md` or `07-overlays-and-pages/event-effect-overlays.md`.
- OBS diagnosis: `10-troubleshooting/obs-overlay-display.md`.
- Page selection: `13-reference/surface-url-cheatsheet.md`.

## Listed Site Is Not Working

Use when the user says a supported platform is broken.

```text
For a supported-site issue, please provide:

1. Platform name.
2. Exact URL type, not the private URL: normal watch page, live page, popout chat, studio, dashboard, source page, embedded widget, or helper page.
3. Extension or standalone app.
4. Whether plain chat is expected, or a richer event such as gift, raid, reward, donation, purchase, follow, viewer count, moderation, or send-back.
5. Whether a new chat/event visibly appears on the source page.
6. Whether the dock receives anything.
7. Console/app errors, with private data redacted.
```

Safe first answer:

```text
The supported-site list means there is at least a capture path, but support is mode-specific. The exact URL and expected feature decide the next check.
```

Start docs:

- `08-platform-sources/supported-sites-lookup.md`
- `08-platform-sources/public-site-support-status.md`
- `08-platform-sources/platform-capability-matrix.md`
- Exact platform page under `08-platform-sources/`

## Send-Back, Reply, Or Moderation Fails

Use when reading chat works but SSN cannot send a message or action back to the platform.

```text
Please share:

1. Platform and source mode.
2. Whether reading chat still works.
3. What action is being attempted: send chat, reply, delete/moderate, reward redemption, API action, or page button.
4. Whether the user is logged in with permission to send/moderate on the platform page.
5. Whether this is extension DOM mode, app source window, or WebSocket/API source page.
6. The exact SSN action name if API/Event Flow/StreamDeck is involved.
7. Any error response or console/app error, with tokens redacted.
```

Do not promise support until checked against:

- `08-platform-sources/platform-capability-matrix.md`
- `08-platform-sources/websocket-source-pages.md`
- Exact platform doc/source
- `13-reference/action-command-index.md`

## API, StreamDeck, Companion, Or Automation Command Fails

Use when external control is involved.

```text
Please confirm:

1. Are you using HTTP, WebSocket, StreamDeck, Companion, Streamer.bot, Event Flow, or a custom app?
2. Is remote API control enabled?
3. Is the target page open and on the same session?
4. What exact action name are you sending?
5. Are values URL-encoded if using HTTP GET?
6. Are you targeting a page label with `label`, and does that page use the same label?
7. Did the HTTP/WebSocket request return success while the page still did nothing?
```

Start docs:

- `09-api-and-integrations/websocket-http-api.md`
- `13-reference/action-command-index.md`
- `13-reference/commands-and-actions.md`
- `09-api-and-integrations/streamdeck-companion.md`
- `09-api-and-integrations/streamerbot.md`
- `09-api-and-integrations/event-flow-editor.md`

## Settings Missing, Changed, Or Not Applying

Use when a setting, import/export, backup, or URL parameter is involved.

```text
Please share:

1. Is this a popup setting, URL parameter, imported settings file, or dock URL recovery?
2. Which surface: extension, standalone app, hosted page, local page, or OBS browser source?
3. Did you uninstall/reinstall, move the unpacked folder, switch browser profiles, clear browser data, or import settings?
4. What setting key or URL parameter is involved, if known?
5. Did you reload the target page after changing the setting/URL?
6. Was a settings export or backup made before the change?
```

Do not ask for:

- Full settings file when it may contain tokens.
- Session IDs, passwords, API keys, webhooks, private endpoints.

Start docs:

- `10-troubleshooting/settings-loss-and-backups.md`
- `06-settings-sessions-and-storage.md`
- `13-reference/settings-and-toggles.md`
- `13-reference/settings-key-index.md`
- `13-reference/url-parameter-index.md`

## Standalone App Issue

Use for Electron app problems.

```text
For the standalone app, please share:

1. App version and OS.
2. Source type/platform.
3. Whether the source window opens, loads the platform page, and shows chat.
4. Whether the app dock/session receives messages.
5. Whether the same workflow works in the Chrome extension.
6. Whether the issue involves login/auth, hidden source windows, auto-activate, backups, settings, TikTok, or OAuth.
7. App logs or console errors, with tokens/session details redacted.
```

Important support boundary:

```text
The app uses managed Electron source windows, but it is not guaranteed to bypass platform login restrictions or embedded-browser blocks.
```

Start docs:

- `04-standalone-app-architecture.md`
- `04-standalone-app-source-windows.md`
- `10-troubleshooting/desktop-app-issues.md`
- `10-troubleshooting/auth-and-sign-in.md`

## AI Or TTS Issue

Use when speech, chatbot, cohost, local model, provider key, or generated overlay behavior is involved.

```text
Please share:

1. Feature involved: TTS, AI chat, cohost, generated overlay, local model, cloud provider, or OBS audio.
2. Provider or local path, with keys/endpoints redacted.
3. Whether ordinary chat reaches the dock first.
4. Whether the TTS/AI output works in browser but not OBS, or fails everywhere.
5. Which page is open: dock, TTS page, cohost, cohost overlay, aiprompt, aioverlay, or OBS browser source.
6. Any console/provider error, with keys and private prompts redacted.
```

Start docs:

- `09-api-and-integrations/tts.md`
- `09-api-and-integrations/ai-features.md`
- `07-overlays-and-pages/ai-cohost-pages.md`
- `13-reference/free-paid-and-support-boundaries.md`

## Customization, Plugin, Source, Or Overlay Request

Use when the user wants to build or modify behavior.

```text
What are you trying to change?

1. Visual styling only.
2. A custom OBS overlay.
3. An external tool/API integration.
4. Event Flow automation.
5. A custom source for a platform.
6. A change to core extension/app behavior.

Also share:
- Whether this should work on hosted pages, local files, the extension, the standalone app, or OBS.
- Whether the source should be private/local or shared upstream.
- Whether platform login, API keys, or paid services are involved.
```

Route:

- Styling: `13-reference/url-parameters.md`, `07-overlays-and-pages/custom-overlays.md`
- Custom overlay: `07-overlays-and-pages/custom-overlays.md`
- API or external tool: `09-api-and-integrations/websocket-http-api.md`
- Event Flow: `09-api-and-integrations/event-flow-editor.md`
- New source: `12-development/adding-a-source.md`
- Plugin/custom paths: `13-reference/custom-plugins-and-extensions.md`

## Bug Report Minimum

Use this when the issue is likely a code or platform-breakage report.

```text
Minimum useful bug report:

1. One-sentence symptom.
2. SSN surface and version/install path.
3. Platform/source and URL type.
4. Expected result.
5. Actual result.
6. Whether dock receives messages.
7. Exact SSN page or API action involved.
8. Console/app error text, with secrets redacted.
9. Whether it reproduces in a clean browser profile or app profile, if practical.
10. Whether it started after an SSN, browser/app, OS, or platform update.
```

Use `13-reference/support-resources-and-escalation.md` for where to send the final report.

## Redaction Examples

Use these replacements in support notes:

- `session=REDACTED`
- `password=REDACTED`
- `apiKey=REDACTED`
- `token=REDACTED`
- `webhook=REDACTED`
- `channel=private-channel-redacted`
- `user=private-user-redacted`
- `https://private.example/path/REDACTED`

## When To Stop Asking

Stop asking for more intake when:

- The next step is already clear from the dock/source/overlay split.
- The issue requires inspecting current source code.
- The report requires live platform access or app/OBS validation that the user has not provided.
- The user would need to share secrets to continue.
- The issue belongs in a GitHub bug report or development task instead of support chat.
