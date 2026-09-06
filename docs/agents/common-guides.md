# Common Guides And Support Routing

Status: public-docs bridge added on 2026-07-01.

## Purpose

Use this page as the first stop when the goal is to find a common user guide or route a support question into the deeper agent documentation.

This page bridges:

- Public docs that users should read first.
- Agent docs that support agents should check before giving exact or high-risk answers.
- Common guide gaps that should stay easy to find from the website.

## Public Guide Shortcuts

| Need | Public page | Agent page to check before detailed support |
| --- | --- | --- |
| Install or update SSN | [Download](../download.html), [Extension setup](../guides.html#extension-getting-started), [Standalone setup](../guides.html#standalone-getting-started) | [Install/update/version guide](13-reference/install-update-version-guide.md), [Installation and surfaces](02-installation-and-surfaces.md) |
| Get chat into OBS | [OBS Quick Start](../obs-quick-start.html), [Troubleshooting](../guides.html#extension-troubleshooting) | [How-to recipes](13-reference/how-to-recipes.md), [Surface URL cheatsheet](13-reference/surface-url-cheatsheet.md), [OBS overlay display](10-troubleshooting/obs-overlay-display.md) |
| Choose a platform setup path | [Platform Setup Picker](../platform-setup-picker.html), [Supported Sites](../supported-sites.html) | [Workflow setup decision tree](13-reference/workflow-setup-decision-tree.md), [App/extension mode crosswalk](13-reference/app-extension-mode-crosswalk.md), [Supported sites lookup](08-platform-sources/supported-sites-lookup.md) |
| Check whether a platform is supported | [Supported Sites](../supported-sites.html) | [Supported sites lookup](08-platform-sources/supported-sites-lookup.md), [Public site support status](08-platform-sources/public-site-support-status.md), [Platform capability matrix](08-platform-sources/platform-capability-matrix.md) |
| Use the standalone desktop app | [Standalone guide](../guides.html#standalone-getting-started), [Standalone docs](../ssapp.html) | [App/extension mode crosswalk](13-reference/app-extension-mode-crosswalk.md), [Standalone app architecture](04-standalone-app-architecture.md), [Desktop app issues](10-troubleshooting/desktop-app-issues.md) |
| Fix TikTok app or source problems | [TikTok guide](../tiktok-guide.html), [Standalone TikTok section](../guides.html#standalone-tiktok) | [TikTok source](08-platform-sources/tiktok.md), [TikTok standalone app](08-platform-sources/tiktok-standalone-app.md), [Platform known issues](10-troubleshooting/platform-known-issues.md) |
| Customize overlays | [Templates](../templates.html), [Guides customization](../guides.html#extension-customization), [Custom fonts](../custom-fonts.html) | [Customization decision matrix](13-reference/customization-path-decision-matrix.md), [Custom overlays](07-overlays-and-pages/custom-overlays.md), [URL option examples](13-reference/url-option-examples.md) |
| Set up TTS or local voices | [TTS guide](../tts.html), [Local TTS guide](../local-tts.html) | [TTS agent guide](09-api-and-integrations/tts.md), [Free/paid boundaries](13-reference/free-paid-and-support-boundaries.md) |
| Use AI/cohost features | [AI cohost guide](../ai-cohost-guide.html) | [AI features](09-api-and-integrations/ai-features.md), [Feature cost proof ledger](13-reference/feature-cost-claims-proof-ledger.md) |
| Use commands, API, or automation | [Commands and API](../commands.html), [Event Reference](../event-reference.html) | [WebSocket/HTTP API](09-api-and-integrations/websocket-http-api.md), [API command validation matrix](13-reference/api-command-validation-matrix.md), [Command/action source trace](13-reference/command-action-source-trace.md) |
| Use Event Flow or Kick rewards | [Event Flow Guide](../../actions/event-flow-guide.html), [Kick Event Flow Markdown](../index.html?file=kick-channel-points-event-flow.md) | [Event Flow editor](09-api-and-integrations/event-flow-editor.md), [Kick source](08-platform-sources/kick.md) |
| Prepare a support reply | [Support](../support.html) | [Support KB index](11-support-kb/index.md), [Question intent router](11-support-kb/question-intent-router.md), [Support response playbook](11-support-kb/support-response-playbook.md) |

## First Support Routes

Use these before searching the whole tree:

- User asks "how do I do this?": [How-to recipes](13-reference/how-to-recipes.md).
- User asks "which page or URL should I open?": [Surface URL cheatsheet](13-reference/surface-url-cheatsheet.md).
- User says "nothing works": [Diagnostic decision tree](10-troubleshooting/diagnostic-decision-tree.md), then [Quick triage](10-troubleshooting/quick-triage.md).
- User asks about app versus extension: [App/extension mode crosswalk](13-reference/app-extension-mode-crosswalk.md).
- User asks whether a claim is safe to make: [Public claims boundary matrix](13-reference/public-claims-boundary-matrix.md).
- User asks for exact settings or URL options: [Settings and toggles](13-reference/settings-and-toggles.md), [URL parameters](13-reference/url-parameters.md).
- User asks whether something was tested: [Runtime validation playbooks](16-runtime-validation-playbooks.md), then [Runtime validation evidence log](17-runtime-validation-evidence-log.md).

## Website Integration Notes

The public website should keep common paths visible without exposing every agent page:

- `guides.html` should keep a compact searchable guide directory before the extension/app tabs.
- `support.html` should link directly to common help paths before asking users to join Discord or file issues.
- `docs/index.html` should default to this bridge page so the markdown viewer starts with practical routing.
- Deep agent pages should stay behind the advanced support library link unless they are rewritten into concise public docs.

## Refinement Queue

- Convert the highest-value agent recipes into short public guide pages as they become source-checked and stable.
- Expand the public "OBS quick start" page if support traffic keeps clustering around dock/featured/browser-source setup.
- Expand the public "platform setup picker" if users struggle to choose popout chat, toggle-required pages, app source windows, or WebSocket source pages.
- Keep support-history claims in agent docs until current code or runtime validation supports public wording.
