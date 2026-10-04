# Support Response Playbook

Status: response-template pass started on 2026-06-24.

## Purpose

Use this page when an AI agent needs to turn the reference docs into a practical support reply. Before answering a broad or ambiguous claim, check `common-misconceptions-and-boundaries.md`.

For shorter macro-style routing from curated support playbooks, use `support-macro-routing.md` first, then return here for fuller replies.

This page is deliberately phrased as answer templates. Before using a template for a fragile platform, exact command, exact setting, send-back, moderation, rewards, auth, or standalone app behavior, check the linked source docs and current code.

## Standard Answer Shape

Use this shape for most replies:

1. Direct answer in one sentence.
2. Name the surface or mode: extension, standalone app, hosted page, local page, Lite, API, WebSocket source page, or overlay.
3. Give the first two or three checks.
4. Name the next doc or source area.
5. Ask for only the evidence needed, with secrets redacted.

Avoid:

- Promising that a feature works on all platforms.
- Saying a third-party provider is free.
- Asking for session IDs, API keys, OAuth tokens, webhook URLs, passwords, or private endpoints.
- Calling source inspection or smoke checks "tested" for app/Electron behavior.
- Recommending uninstall/reinstall before warning about settings export/backup.

## Quick Follow-Up Questions

| Problem Type | Ask First |
| --- | --- |
| No chat appears anywhere | Product surface, source platform, exact source URL type, session ID match, whether dock receives messages. |
| OBS overlay blank | Whether dock works, exact overlay page, OBS URL/session, browser preview result, custom CSS/filter state. |
| Supported site broken | Exact platform URL, setup type, source mode, extension/app version, whether plain chat or rich event is expected. |
| Send-chat/reply failure | Platform, source mode, login/auth state, send-back support doc, whether reading still works. |
| API command failure | Action name, HTTP/WebSocket path, remote API toggle, target page open, label/session, URL encoding. |
| Setting/option question | Setting key or URL parameter, target page, whether the page was refreshed, app versus extension surface; route apply/reload questions to `13-reference/settings-change-impact-matrix.md`. |
| Standalone app issue | App version, OS, source mode, source window state, whether same workflow works in Chrome extension. |
| AI/TTS issue | Provider/local path, surface producing audio/text, settings used, redacted key/endpoint status, OBS audio path. |
| Customization question | Desired output, whether URL params/CSS are enough, and which path in `13-reference/customization-path-decision-matrix.md` fits before suggesting custom overlay/API/Event Flow/source work. |

## Templates

### Is SSN free?

```text
Yes. Social Stream Ninja itself is free and open source.

The important boundary is third-party services: cloud AI, cloud TTS, payment platforms, graphics tools, platform accounts, and provider APIs can have their own costs, quotas, or limits. Donations to Steve are gifts, not paid support contracts.

Start with `13-reference/free-paid-and-support-boundaries.md` if you need the full cost/support boundary.
```

### Should I use the extension or the standalone app?

```text
Use the Chrome/Chromium extension first when the platform already works in your normal browser and you need that browser's cookies/login state.

Use the standalone app when you want managed source windows, fewer hidden-tab/minimized-tab issues, or app-specific source/OAuth flows. The app is not automatically better for every login flow; some platforms block embedded browsers, so extension mode can still be the right path.

For support, isolate one surface first: extension only or app only, same session ID, then test whether the dock receives messages.
```

Route: `13-reference/modes-and-capability-matrix.md`, `04-standalone-app-source-windows.md`.

For a broader workflow setup choice, route to `13-reference/workflow-setup-decision-tree.md`.

### How do I install or update manually?

```text
For a manual extension install, download the GitHub source, extract it to a stable folder, open the browser extensions page, enable Developer Mode, and load the extracted folder as unpacked.

Do not uninstall just to update unless settings are exported first. Uninstalling can remove extension settings. For a normal manual update, replace/update the files and reload the extension, then reload the source chat pages.
```

Route: `02-installation-and-surfaces.md`, `10-troubleshooting/settings-loss-and-backups.md`.

### Chat is not showing anywhere.

```text
Start by splitting this into capture versus display.

First check:
1. Is SSN enabled and was the source page reloaded after enabling/updating?
2. Is the source on the exact supported page/popout/source-page mode?
3. Does `dock.html?session=...` receive messages on the same session ID?
4. Is the source page visible/active if this is DOM capture?

If the dock receives nothing, troubleshoot the source/platform. If the dock receives messages but OBS/overlay does not, troubleshoot the overlay URL/session/display path.
```

Route: `10-troubleshooting/diagnostic-decision-tree.md`, `10-troubleshooting/quick-triage.md`, `10-troubleshooting/extension-not-capturing.md`.

### Dock works but OBS or the overlay is blank.

```text
If the dock receives messages, capture is probably working. The next checks are overlay routing and display.

Check:
1. The OBS browser source uses the current overlay URL, not an old session.
2. The overlay page matches the job: `featured.html` waits for a selected/featured message, while theme/chat pages may show normal chat.
3. The same session ID is on source, dock, and overlay.
4. The overlay works in a normal browser before debugging OBS.
5. Custom CSS, filters, transparency, dimensions, or persistence are not hiding content.
```

Route: `10-troubleshooting/obs-overlay-display.md`, `13-reference/surface-url-cheatsheet.md`.

### Is this site supported?

```text
Check the public supported-site lookup first, but treat "supported" as mode-specific.

A site being listed usually means a capture path exists. It does not prove every URL, event type, send-back action, reward, gift, moderation event, viewer count, or app mode works. Ask for the exact URL and whether the user expects plain chat, rich events, or sending messages back.
```

Route: `08-platform-sources/supported-sites-lookup.md`, `08-platform-sources/public-site-support-status.md`.

### The platform is listed but not working.

```text
For a listed platform, the first failure is often the wrong mode or URL.

Ask for:
1. Exact platform and URL shape, with private details redacted.
2. Extension or standalone app.
3. Standard DOM, popout, toggle-required, static/manual helper, or WebSocket/API source page.
4. Whether a new visible chat message appears on the source page.
5. Whether the dock receives anything on the same session.

Do not mark the platform broken until the exact expected setup type has been checked.
```

Route: `08-platform-sources/public-site-support-status.md`, exact platform doc.

### Does this platform support rewards, gifts, raids, follows, moderation, or send-back?

```text
It depends on platform and mode.

Plain chat capture is separate from rich events and sending chat back. DOM mode can see rendered chat/cards, while WebSocket/API/EventSub modes may expose richer metadata but need auth/scopes and can have different gaps.

Do not promise send-back, moderation, rewards, gifts, raids, or follower events until the exact platform doc/source says that mode supports it.
```

Route: `08-platform-sources/platform-capability-matrix.md`, `08-platform-sources/websocket-source-pages.md`, exact platform doc.

### Which URL or page should I open?

```text
Pick the page by job:

- `dock.html?session=...` for the operator dashboard.
- `featured.html?session=...` for selected messages in OBS.
- `multi-alerts.html?session=...` for alert popups.
- `events.html?session=...` for an event log/dashboard.
- `actions.html?session=...` for Event Flow output.
- `sampleapi.html?session=...` for API testing.
- `sources/websocket/*.html` for source setup, not normal OBS overlays.

Use the same session ID across the source, dock, overlay, and API client.
```

Route: `13-reference/surface-url-cheatsheet.md`.

### What command or action should I use?

```text
First identify the command system.

SSN has API actions, viewer chat commands, URL parameters, Event Flow actions, MIDI/hotkey commands, and page-specific controls. A command that works in one system is not automatically valid in another.

For API actions, check the exact action name, remote API toggle, session ID, target page/source being open, and URL encoding.
```

Route: `13-reference/commands-and-actions.md`, `13-reference/action-command-index.md`, `13-reference/api-command-validation-matrix.md`.

### My API command does nothing.

```text
An HTTP/WebSocket request can succeed even if the target page does not act.

Check:
1. Remote API control is enabled.
2. The session ID is correct.
3. The target page/source is open and connected.
4. The action name is exact.
5. Values are URL-encoded.
6. A `label` target is used only when the target page supports labels.
```

Route: `13-reference/api-command-validation-matrix.md`, `09-api-and-integrations/websocket-http-api.md`, `13-reference/action-command-index.md`.

### Is this a setting or a URL parameter?

```text
Popup settings persist in SSN settings storage. URL parameters are page options and are usually read when that page loads.

If a URL option does not work, refresh the target page and confirm that parameter belongs to that page. If a popup setting does not apply, check whether that page/source listens live or needs a reload.
```

Route: `13-reference/settings-and-toggles.md`, `13-reference/settings-change-impact-matrix.md`, `13-reference/url-parameters.md`, generated key/index docs.

### I changed a setting, option, or generated link but nothing happened.

```text
The change may be saved but not read by the already-open target.

First classify what changed: popup setting, URL parameter, generated link, app source setting, provider/auth value, or page-local state. Popup/source settings may need the source page or app source window reloaded. URL parameters and OBS links usually need the exact page/browser source refreshed or replaced. Generated popup links do not update old OBS sources by themselves.
```

Route: `13-reference/settings-change-impact-matrix.md`, `13-reference/settings-session-storage-source-trace.md`, `13-reference/url-parameter-source-trace.md`.

### Can I make my own plugin?

```text
Be precise about "plugin."

SSN supports custom overlays, custom CSS/URL styling, API clients, Event Flow actions, custom JavaScript hooks/user functions, generic/custom sources, and new source files. It is not mainly a one-click plugin marketplace.

Choose the smallest extension point:
- Styling only: URL params or CSS.
- Custom visual layout: custom overlay.
- External automation: API/Event Flow.
- New data source: custom source or source file.
```

Route: `13-reference/customization-path-decision-matrix.md`, `13-reference/custom-plugins-and-extensions.md`, `12-development/adding-a-source.md`.

### Can SSN read chat aloud or use AI?

```text
Yes, but provider boundaries matter.

System/browser TTS and some local paths can be free. Cloud TTS and AI providers can require accounts, API keys, quotas, or payment. SSN integrates with providers; it does not control their pricing, limits, uptime, or data policies.

For OBS, the page that produces audio must be open, allowed to autoplay/speak, and routed into the audio path OBS captures.
```

Route: `09-api-and-integrations/tts.md`, `09-api-and-integrations/ai-features.md`, `13-reference/free-paid-and-support-boundaries.md`.

### The standalone app login or source window is different from Chrome.

```text
That can happen. The app uses Electron source windows and app-specific bridges, not the user's normal Chrome profile.

If a platform blocks embedded login or CAPTCHA loops inside the app, test the Chrome extension path or a WebSocket/API/external-browser flow where the platform supports it. If Chrome works and the app does not, collect app version, OS, source mode, source window state, and whether the dock receives messages.

Do not call an app fix tested unless it was verified in the running app with the real workflow.
```

Route: `10-troubleshooting/desktop-app-issues.md`, `04-standalone-app-source-windows.md`, `10-troubleshooting/auth-and-sign-in.md`.

### Is this support advice current or historical?

```text
Check whether the advice is source-backed, mixed, support-derived, stale-risk, or needs live validation.

Support history is useful for symptom wording and likely failure points, but current code/docs win. If a claim is version-specific, platform-volatile, generated by a support bot, or not checked against current source, keep it cautious or put it in the stale-claim register.
```

Route: `11-support-kb/support-evidence-ledger.md`, `11-support-kb/unresolved-or-stale-claims.md`.

### What should I collect for a bug report?

```text
Collect the smallest useful evidence set:

- Product surface and version: extension, app, hosted page, local page, Lite, API.
- Platform/source and exact URL shape, with secrets redacted.
- Capture mode: DOM, popout, source page, WebSocket/API, app connector, helper.
- Whether dock receives messages.
- Whether overlay works in a normal browser outside OBS.
- Console/app errors, screenshots, or logs with session IDs, keys, tokens, webhooks, private endpoints, and personal data removed.
```

Route: `13-reference/support-resources-and-escalation.md`, `11-support-kb/index.md`.

## Bad Shortcuts

| Shortcut | Safer Replacement |
| --- | --- |
| "Update/reinstall it." | "Update after backing up settings; reload source pages; then test dock capture." |
| "It supports that platform." | "It supports this setup/mode; exact events and send-back need checking." |
| "Use the app; it fixes browser issues." | "The app can help with source-window management and throttling, but login/app parity varies." |
| "Send your full URL." | "Share the page name and parameters with session/password/key/webhook values redacted." |
| "This provider is free." | "SSN integration is free; the provider controls account cost, quota, and limits." |
| "The API command works." | "The request path is valid; the target page/source must also be open and support that action." |

## When To Stop And Source-Check

Source-check before final answers when the question involves:

- Exact platform event support.
- Send-back, deletion, ban, timeout, moderation, rewards, gifts, follows, raids, or channel points.
- OAuth scopes, tokens, external-browser login, or app bridge behavior.
- Exact URL parameter support for one page.
- Exact setting key, storage location, live-update behavior, or app parity.
- Private/communication/meeting/membership sources.
- Electron app behavior, TikTok behavior, or any claim described as historical.
