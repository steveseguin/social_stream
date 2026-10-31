# Support Question Phrasebook

Status: support-history wording pass on 2026-06-24 from curated support docs, summarized support records, mined topic counts, and current agent docs. This is not runtime validation.

## Purpose

Use this page when a user describes an SSN problem in casual or incomplete wording. The goal is to translate the wording into the right documented intent without copying private support conversations.

Use with:

- `question-intent-router.md` for canonical routing.
- `support-answer-bank.md` for short answer patterns.
- `support-response-playbook.md` for ready-to-send responses.
- `support-intake-templates.md` for redaction-safe follow-up questions.
- `support-topic-frequency-index.md` for frequency priorities.

## Source Snapshot

Safe sources used:

- `<stevesbot repo>/resources/learnings/social-stream-ninja-top-issues.md`
- `<stevesbot repo>/resources/learnings/support-qa/social-stream-configuration.md`
- `<stevesbot repo>/resources/learnings/support-qa/social-stream-qa.md`
- `<stevesbot repo>/resources/learnings/support-qa/social-stream-qa-expanded.md`
- `<stevesbot repo>/data/sqlite/stevesbot.sqlite` summarized `support_records`
- Existing agent docs under `docs/agents`

No raw Discord transcript text, private support URLs, usernames, session IDs, or attachments were copied into this page.

The latest support-topic pass found 1,801 SSN-filtered text items in the curated QA export, with the largest buckets around platform capture, capture not working, customization/development, URL/settings/options, standalone app/desktop, install/update/version, OBS/overlay display, session/routing/server modes, API/commands/automation, and TTS/AI/cohost.

## Phrase Pattern Map

| User Phrase Pattern | Likely Intent | Route First | Answer Boundary |
| --- | --- | --- | --- |
| "Is the desktop app easier than the browser extension?" | Surface choice and app-vs-extension tradeoff | `question-intent-router.md`, `../13-reference/modes-and-capability-matrix.md` | The app can help with source windows/throttling, but normal Chrome cookies/login can still make the extension better for some sites. |
| "Should I switch to full mode?" | Simple/full mode or UI complexity confusion | `../13-reference/modes-and-capability-matrix.md`, `../13-reference/workflow-setup-decision-tree.md` | Ask what feature is missing before recommending a mode change. |
| "I connected my socials. What should I do before testing?" | Preflight setup | `../13-reference/preflight-checklists.md`, `../13-reference/how-to-recipes.md` | Start with one platform, one session, dock first, then OBS/API/features. |
| "The control dock does not change the chat window" | Dock-vs-overlay or generated-link confusion | `../07-overlays-and-pages/dock.md`, `../10-troubleshooting/obs-overlay-display.md` | Dock controls do not automatically mutate every already-open overlay URL. Some options require reopening or refreshing the generated link. |
| "The dock is blank/white" | Expected blank state vs source failure | `../10-troubleshooting/diagnostic-decision-tree.md`, `../07-overlays-and-pages/dock.md` | Decide whether the dock has no source messages or whether a display/selection state is expected. |
| "What is the OBS link?" | Featured/dock/theme overlay URL routing | `../13-reference/surface-url-cheatsheet.md`, `../13-reference/how-to-recipes.md` | Do not expose a real session ID in public examples. |
| "I selected a message but it is not visible in OBS" | Featured overlay/session/OBS issue | `../10-troubleshooting/obs-overlay-display.md`, `../07-overlays-and-pages/featured.md` | Test the same URL in a normal browser and verify same session before OBS-specific debugging. |
| "The notification is in the corner / source stopped after navigation" | App/source-window navigation or platform redirect | `../10-troubleshooting/desktop-app-issues.md`, exact platform doc | Treat as source/window lifecycle and login/navigation behavior, not a generic overlay issue. |
| "I cannot right-click the dock in the app" | Electron context-menu or click-through behavior | `../10-troubleshooting/desktop-app-issues.md`, `../04-standalone-app-source-windows.md` | App UI behavior needs app-version and runtime validation before making exact shortcut claims. |
| "I cannot sign in; it says port 8080/8181 unavailable" | OAuth callback port conflict | `../10-troubleshooting/auth-and-sign-in.md`, `../10-troubleshooting/desktop-app-issues.md` | Do not claim ports are configurable unless current app source proves it. Ask what process uses the ports. |
| "External browser sign-in opened the wrong browser/profile" | OAuth/profile mismatch | `../10-troubleshooting/auth-and-sign-in.md`, `../04-standalone-app-source-windows.md` | The signed-in browser profile and app callback route both matter. |
| "Do I need to press Activate?" | Source activation state | exact platform doc, `../10-troubleshooting/extension-not-capturing.md` | Some source flows require activation or reload after login; verify exact platform/mode. |
| "Twitch channel points should trigger media/emotes" | Rich events plus action/alert routing | `../08-platform-sources/twitch.md`, `../08-platform-sources/platform-capability-matrix.md`, `../09-api-and-integrations/event-flow-editor.md` | Channel points/rewards are not the same as basic chat. Check EventSub/WebSocket mode and action target. |
| "Are these Twitch subs/memberships?" | Event payload and CSS class mapping | `../05-message-flow-and-event-contracts.md`, `../07-overlays-and-pages/page-capability-matrix.md` | Confirm current payload field and page class behavior before giving CSS snippets. |
| "Can likes pop up like donations?" | Reaction/like event alert support | `../07-overlays-and-pages/live-display-utilities.md`, `../08-platform-sources/platform-capability-matrix.md` | Likes/reactions require source event support and a page that consumes that event; donations are a different payload family. |
| "Can TTS read only followers/subscribers/members?" | TTS filters plus platform event support | `../09-api-and-integrations/tts.md`, `../13-reference/settings-key-index.md`, `../08-platform-sources/platform-capability-matrix.md` | Do not promise follower/sub/member filtering for a platform until source/event fields and TTS settings are checked. |
| "TTS plays nowhere / OBS cannot hear it" | TTS audio routing | `../09-api-and-integrations/tts.md`, `../10-troubleshooting/obs-overlay-display.md` | Browser/system TTS, cloud TTS, local model TTS, and OBS audio routing have different failure modes. |
| "A local TTS endpoint has CORS errors" | Local provider/browser request setup | `../09-api-and-integrations/tts.md`, `../13-reference/privacy-security-and-secrets.md` | Check provider CORS or local bridge options; do not ask for private endpoint/key in public chat. |
| "TikTok stream key app might break SSN" | TikTok OBS streaming vs SSN chat capture confusion | `../08-platform-sources/tiktok.md`, `../13-reference/modes-and-capability-matrix.md` | TikTok stream keys for OBS streaming are separate from SSN chat capture. Still diagnose SSN mode separately. |
| "TikTok worked before and stopped" | Volatile platform/source mode issue | `../08-platform-sources/tiktok.md`, `historical-issues.md` | Ask live status, username, app/extension mode, visibility, app version, signing/connector path. |
| "YouTube scheduled stream chat is not picked up" | Live-state and YouTube page/mode issue | `../08-platform-sources/youtube.md`, `historical-issues.md` | Check whether the stream is live/public/unlisted and which YouTube path is used. |
| "YouTube needs go-live, fake message, reload" | YouTube live discovery/setup friction | `../08-platform-sources/youtube.md`, `../14-validation-and-refresh-roadmap.md` | Treat as a workflow/support-derived pattern until current source/runtime validation confirms exact behavior. |
| "Private or geo-restricted stream cannot be accessed" | Platform access boundary | `../13-reference/free-paid-and-support-boundaries.md`, exact platform doc | SSN does not bypass platform access rules, privacy, geo restrictions, or account requirements. |
| "Instagram live capture setup?" | Platform setup | `../08-platform-sources/instagram.md`, `../08-platform-sources/public-site-implementation-map.md` | Ask whether it is live, post/feed comments, app, or extension mode. |
| "VK Video sign-in or incorrect URL error" | Platform URL/auth issue | `../08-platform-sources/popout-chat-only-sources.md`, `../10-troubleshooting/auth-and-sign-in.md` | Need exact URL shape and app/extension mode; do not generalize from other VK paths. |
| "Can I show avatars/profile pictures?" | Payload field/display styling | `../05-message-flow-and-event-contracts.md`, `../07-overlays-and-pages/dock.md`, `../07-overlays-and-pages/featured.md` | Avatar availability depends on the platform/source payload and page options/classes. |
| "Can I extract username/profile data?" | Payload/API/privacy/custom integration | `../13-reference/privacy-security-and-secrets.md`, `../09-api-and-integrations/websocket-http-api.md` | Clarify whether the user means overlay display, API listener, scraping, or private profile data. |
| "Can I make this public through my VPS/domain?" | Hosting/privacy/security | `../13-reference/privacy-security-and-secrets.md`, `../13-reference/free-paid-and-support-boundaries.md` | Do not expose control/session/API/webhook URLs casually; recommend a minimal relay/view-only design when needed. |
| "Is there human support?" | Support expectation | `../13-reference/support-resources-and-escalation.md` | State best-effort support and what evidence to provide. |
| "Can I change app OAuth port?" | App runtime/config limitation | `../10-troubleshooting/auth-and-sign-in.md`, current `ssapp` source if answering final | Source-check before saying configurable, hardcoded, or version-specific. |
| "Multi-stream alert widget is not working" | Ambiguous alert/overlay feature | `../07-overlays-and-pages/page-capability-matrix.md`, `../07-overlays-and-pages/event-effect-overlays.md` | Clarify exact page/widget name. Do not invent a feature label. |
| "Language should be Spanish" | UI language vs TTS language vs overlay text | `../13-reference/settings-and-toggles.md`, `../09-api-and-integrations/tts.md`, `../13-reference/url-parameters.md` | Ask which surface: interface, TTS voice/language, translated chat, or overlay labels. |
| "Emotes should be removed from chat but not emote wall" | Filtering vs display-page split | `../13-reference/settings-and-toggles.md`, `../07-overlays-and-pages/live-display-utilities.md` | Need exact setting/page behavior; chat filtering and emote wall rendering are separate. |
| "RetroArch/game slows down when TTS runs" | Performance/audio routing | `../09-api-and-integrations/tts.md`, `../13-reference/modes-and-capability-matrix.md` | Ask surface, OS, TTS provider, OBS audio path, and CPU/GPU load before advising. |

## Paraphrased High-Frequency Symptom Families

These are wording patterns, not final claims:

| Family | User Usually Means | First Safe Response |
| --- | --- | --- |
| "It used to work" | Platform/source changed, extension/app updated, settings changed, or page mode changed. | Ask what changed, route by platform/mode, and avoid promising old support behavior still applies. |
| "I signed in but nothing happens" | Login succeeded but source did not activate, page did not reload, wrong browser profile, or wrong mode. | Ask app vs extension, exact source mode, and whether the dock receives messages. |
| "The link is wrong" | User has dock/featured/source/API/test page confusion. | Identify what the link is supposed to do: source capture, operator dock, OBS display, API test, or diagnostic helper. |
| "The overlay is white" | Normal transparent/blank page state, wrong OBS page, no featured message, CSS issue, or wrong session. | Test in normal browser, same session, then confirm target page needs a selected or matching payload. |
| "The command is not working" | User may mean chat command, API action, URL parameter, StreamDeck button, or Event Flow action. | Classify the command system first. |
| "I need a plugin" | User may mean styling, custom overlay, message automation, external data, or new platform. | Route to the cheapest extension point before suggesting source-code work. |
| "Is this supported?" | User may mean capture, display, rich events, send-back, moderation, or app parity. | Split support by platform, exact URL/mode, and expected feature. |
| "Can it read only X messages?" | User expects filters based on role/event/platform field. | Check whether the source emits that role/event and whether the target page/TTS filter consumes it. |
| "Can I share this publicly?" | User may expose session IDs, API commands, webhook URLs, or local network services. | Route to privacy/security docs and suggest redacted/view-only/minimal relay designs. |

## Routing Additions From Support History

Support summaries show recurring questions that should not be answered from memory:

- App vs extension questions need `modes-and-capability-matrix.md` plus app source-window docs.
- Twitch/Kick reward or channel-point automation needs platform capability docs plus Event Flow/action docs.
- TikTok questions need mode, live-state, username, visibility, app version, and connector/signing context.
- Dock/featured/OBS questions need page-role routing before CSS or settings advice.
- OAuth port or callback questions need current app source before version-specific claims.
- Public URL/VPS questions need privacy and security routing before setup instructions.
- TTS/AI questions need provider/cost/privacy routing before feature claims.
- Plugin questions need the customization recipe tree before development advice.

## Safe Wording Patterns

Use these when support history suggests a pattern but current runtime validation is missing:

```text
This sounds like [likely category], but the exact fix depends on [mode/platform/page]. Start by checking [first doc] and confirm [one concrete prerequisite].
```

```text
SSN supports that general workflow, but not every platform or mode exposes the same events. Before promising it, check [platform capability doc] and the current source path.
```

```text
That link should be treated as private if it includes a session, password, webhook path, API command, or local endpoint. Share a redacted version and describe the page name/options instead.
```

```text
The app can help with managed source windows, but it is not automatically better for every sign-in flow. If the platform blocks embedded login, compare with the Chrome extension path.
```

## Do Not Promote Without Verification

Keep these as support-derived until current source or runtime validation proves them:

- Exact app OAuth port behavior or whether it is configurable in a specific release.
- Exact YouTube auto-find/go-live/reload timing.
- Exact Twitch/Kick channel-point, reward, moderation, and send-back behavior.
- Exact TTS filters for followers/subscribers/members on a named platform.
- Exact effect of dock settings on already-open overlay pages.
- Exact CSS class names for membership/subscription/donation styling.
- Exact behavior of language, translation, or TTS language controls.

## Follow-Up Extraction Needs

- Re-run a phrasebook pass after the next curated QA export and log date/count deltas.
- Split this phrasebook into platform-specific mini phrasebooks after intense validation of YouTube, TikTok, Twitch, Kick, Instagram, and app OAuth flows.
- Add a "final answer ready" column only after the routed docs have source/runtime validation for that topic.
