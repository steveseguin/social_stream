# Feature Support Decision Matrix

Status: heavy reference pass from public feature docs, generated setting categories, platform inventory, mode docs, and current agent pages on 2026-06-24.

Use this page to answer "can SSN do X?" quickly. It is a decision matrix, not a substitute for source validation. For setup-choice routing by user goal, use `workflow-setup-decision-tree.md`. For broad public/marketing-style claims, use `public-claims-boundary-matrix.md`. For platform-specific or provider-specific details, follow the linked docs and source files.

## Legend

| Status | Meaning |
| --- | --- |
| Yes | Included in normal SSN capability, with normal setup. |
| Depends | Supported only for some platforms, modes, providers, pages, or user setup. |
| External | SSN integrates with it, but an external tool/account/service controls part of the feature. |
| Dev | Possible through code/custom development, not a normal user toggle. |
| No / Not Primary | Not the right SSN feature path, or not documented as a primary supported workflow. |

## Quick Decision Table

| User Wants | Status | Best Starting Surface | Main Requirement | First Doc |
| --- | --- | --- | --- | --- |
| Capture live chat from supported sites | Yes | Extension or standalone app | Supported URL/source mode and matching session | `08-platform-sources/source-inventory.md` |
| Capture private/work chat or meeting chat | Depends | Extension/app rendered page capture | Web version, explicit toggle where required, visible chat panel, privacy redaction, and no assumed send-back | `08-platform-sources/communication-and-sensitive-sources.md` |
| Capture embedded chat widgets or IRC web clients | Depends | Extension/app rendered widget capture | Exact widget URL, loaded frame/page, new messages, and limited event/send-back expectations | `08-platform-sources/embedded-chat-widget-sources.md` |
| Capture live shopping, auctions, products, or commerce metadata | Depends | Extension/app source plus page/API display path | Amazon/eBay/Whatnot source mode, live page state, event family, and separate product-list display routing | `08-platform-sources/live-commerce-sources.md` |
| Capture webinar chat or Q&A | Depends | Extension/app rendered event page capture | Exact event URL, visible chat/Q&A/sidebar, source-specific limits, and no assumed webinar analytics | `08-platform-sources/webinar-and-event-sources.md` |
| Capture creator live room chat, tips, or private rows | Depends | Extension/app rendered room/chat capture | Exact room/chat URL, visible chat panel, new rows, privacy redaction, source-specific token/tip/private-message behavior, and no assumed send-back | `08-platform-sources/creator-live-cam-sources.md` |
| Capture a smaller platform's popout chat | Depends | Extension/app rendered chat-only URL capture | Exact popout/chat-only URL, loaded chat list, new rows, and source-specific donation/viewer-count limits | `08-platform-sources/popout-chat-only-sources.md` |
| Capture event/community chat, comments, UGC, or Q&A | Depends | Extension/app rendered event/community page capture | Exact URL, visible chat/comment/UGC/Q&A panel, new rows, and source-specific viewer/donation/type behavior | `08-platform-sources/event-and-community-sources.md` |
| Capture a smaller independent live platform | Depends | Extension/app rendered platform page capture | Exact URL, visible chat panel, new rows, and source-specific viewer/tip/reply/join/image behavior | `08-platform-sources/independent-live-platform-sources.md` |
| Capture video/broadcast platform chat or Q&A | Depends | Extension/app rendered video/chat page capture | Exact URL, visible chat/Q&A panel, new rows, and source-specific upstream-type/source-icon/login behavior | `08-platform-sources/video-broadcast-platform-sources.md` |
| Capture community, membership, workspace, game-table, or web-app chat | Depends | Extension/app rendered web-app page capture | Exact URL, login/access state, source toggle where required, visible panel, new rows, privacy redaction, and source-specific viewer/image/identity behavior | `08-platform-sources/community-membership-webapp-sources.md` |
| Capture a regional, emerging, app-specific, or newly added platform source | Depends | Extension/app rendered page or activity-feed capture | Exact URL form, visible chat/activity panel, new rows, privacy redaction, and source-specific viewer/tip/raid/join behavior | `08-platform-sources/regional-and-emerging-platform-sources.md` |
| Resolve a source mode/helper-copy confusion | Depends | Extension/app source routing | Exact mode: rendered site, source-page/API, static/manual helper, or unmanifested helper copy | `08-platform-sources/special-case-platform-and-helper-sources.md` |
| Put chat in OBS | Yes | `dock.html` or `featured.html` as browser source | Session ID, OBS browser source URL, source page receiving messages | `07-overlays-and-pages/dock.md` |
| Show only selected/featured messages | Yes | Dock plus `featured.html` | Dock open, same session, feature/queue/manual selection | `07-overlays-and-pages/featured.md` |
| Use a chat dashboard/operator view | Yes | `dock.html` | Matching session and source capture | `07-overlays-and-pages/dock.md` |
| Style overlays with URL options | Yes | Hosted/local overlay pages | Correct page URL parameters | `13-reference/url-parameters.md` |
| Style overlays with CSS | Yes | OBS custom CSS, URL CSS, or custom overlay | CSS safety and correct page context | `07-overlays-and-pages/custom-overlays.md` |
| Use prebuilt visual themes | Yes | `themes/**/*.html` | Correct theme family, session, and source/featured payload path | `07-overlays-and-pages/theme-pages.md` |
| Build a fully custom overlay | Yes | Custom HTML page or sample overlay | WebSocket/API or iframe bridge, payload handling | `07-overlays-and-pages/custom-overlays.md` |
| Receive chat in a Node/Python app | Yes | API WebSocket channel 4 | Remote API enabled and Send chat messages to API server enabled | `09-api-and-integrations/websocket-http-api.md` |
| Send API commands from StreamDeck | Yes | HTTP GET or Companion | Remote API enabled, session ID, URL-encoded value | `09-api-and-integrations/streamdeck-companion.md` |
| Use Bitfocus Companion | Yes | Companion module or HTTP/WebSocket | Companion setup and API session | `09-api-and-integrations/streamdeck-companion.md` |
| Use Streamer.bot | Yes | Streamer.bot integration path | Streamer.bot setup and SSN API route | `09-api-and-integrations/streamerbot.md` |
| Run visual automation workflows | Yes | Event Flow Editor | Flow setup, triggers/actions, payload support | `09-api-and-integrations/event-flow-editor.md` |
| Choose which overlay/tool page handles a feature | Yes | Page capability matrix | Correct page, source side, session, and whether dock/API/Event Flow/OBS is required | `07-overlays-and-pages/page-capability-matrix.md` |
| Use viewer commands like `!joke` | Depends | Extension/app source send path | Command toggle plus send-back support | `13-reference/action-command-index.md` |
| Send chat back to the platform | Depends | Platform source/app OAuth/API mode | Platform support, login/auth, permissions, source mode | `08-platform-sources/platform-capability-matrix.md`, `08-platform-sources/websocket-source-pages.md`, plus platform doc |
| Capture follows, subs, raids, rewards | Depends | WebSocket/API/EventSub modes | Platform-specific event support and usually WebSocket mode | `08-platform-sources/platform-capability-matrix.md`, `08-platform-sources/websocket-source-pages.md`, plus Event Flow docs |
| Use channel points/rewards | Depends | Twitch/Kick style WebSocket/API paths | Platform-specific support and correct mode | `08-platform-sources/platform-capability-matrix.md` plus platform docs |
| Use AI chatbot/cohost | Depends | AI settings, cohost pages/tools | Provider/local model, key/endpoint, prompts, privacy review | `09-api-and-integrations/ai-features.md` |
| Use AI cohost stage overlay | Depends | `cohost.html` plus `cohost-overlay.html` | Session, label, provider/private chat bot for AI answers, OBS audio/TTS if speaking | `07-overlays-and-pages/ai-cohost-pages.md` |
| Build AI-generated custom overlays | Depends | `aiprompt.html` plus `aioverlay.html` | Private Chat Bot/provider for generation and saved overlay package for runtime | `07-overlays-and-pages/ai-cohost-pages.md` |
| Use local AI | Depends | Ollama/local browser model paths | Hardware/runtime/model setup; Transformers default-host focused test passed, but runtime model loading is not validated | `09-api-and-integrations/ai-features.md` |
| Use cloud AI providers | External | AI settings | Provider account/API key/quota/cost | `13-reference/free-paid-and-support-boundaries.md` |
| Read chat aloud with system TTS | Yes | TTS page/settings | Browser/system voice and audio routing | `09-api-and-integrations/tts.md` |
| Use premium/cloud TTS | External | TTS provider settings | Provider account/API key/quota/cost | `09-api-and-integrations/tts.md` |
| Use local/browser TTS models | Depends | Local TTS settings | Browser/runtime/model asset support; Kokoro and Kitten focused asset tests passed, Piper focused asset test failed, and runtime audio is not validated | `09-api-and-integrations/tts.md` |
| Run polls | Yes | `poll.html` | Poll page/session/settings | `07-overlays-and-pages/page-capability-matrix.md` |
| Run waitlist/queue/giveaway | Yes | `waitlist.html`, dock queue, giveaway pages | Page setup and/or dock queue controls | `07-overlays-and-pages/page-capability-matrix.md` |
| Use timers | Yes | `timer.html` | Timer page/session/API route for remote control | `07-overlays-and-pages/page-capability-matrix.md` |
| Use mini-games | Yes | `games.html` and `games/*.html` | Same session, source chat, and page-specific command/input rules | `07-overlays-and-pages/game-pages.md` plus `07-overlays-and-pages/page-capability-matrix.md` |
| Show alerts for stream events | Yes/Depends | `multi-alerts.html` or Event Flow | Event payload support by platform/mode | `07-overlays-and-pages/page-capability-matrix.md` |
| Show event logs, hype counts, word clouds, leaderboards, or waitlist confetti | Yes/Depends | `events.html`, `hype.html`, `wordcloud.html`, `leaderboard.html`, or `confetti.html` | Matching payload family, same session, page-specific filters or persistence | `07-overlays-and-pages/event-effect-overlays.md` |
| Show emotes, reactions, scoreboards, ticker text, or maps | Yes/Depends | `emotes.html`, `reactions.html`, `scoreboard.html`, `ticker.html`, or `map.html` | Matching payload family, same session, page-specific flags or map assets | `07-overlays-and-pages/live-display-utilities.md` |
| Generate synthetic test chat/events | Yes | `createtestmessage.html` | Session, remote API toggle or matching direct channel, target page open | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Replay stored chat history | Depends | `replaymessages.html` | Stored local message DB, SSN enabled, target pages open, privacy review | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Recover settings from a URL | Yes | `recover.html` | Old `dock.html` URL or query string with session/params | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Edit URL parameters visually | Yes | `urleditor.html` | Full URL and current parameter support validation | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Import StreamElements/Streamlabs chat widget | Depends/Dev | `streamelements-importer.html` | Widget package/files, exported HTML, and OBS validation | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Show Spotify now playing | Depends/External | `spotify-overlay.html` | Spotify payload sender, session/label, optional provider/account setup | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Test giveaway page communication | Yes | `test-giveaway-webrtc.html` | Same browser context, same session/password, giveaway pages open | `07-overlays-and-pages/diagnostic-helper-pages.md` |
| Show donation/tip jars/goals | Yes/External | Tip jar/donation webhook pages | External donation platform and private webhook URL | `07-overlays-and-pages/tipjar-credits.md` |
| Show credits/supporter roll | Yes | `credits.html` | Credits page open during chat or `persistcredits` saved state | `07-overlays-and-pages/tipjar-credits.md` |
| Use Stripe/Ko-Fi/BMAC/Fourthwall webhooks | External | Inbound donation webhook endpoints | External account and private session/webhook URL | `13-reference/free-paid-and-support-boundaries.md` |
| Print chat/messages | Depends | Printer settings | Printer setup and exact setting path | `13-reference/settings-key-index.md` |
| Use Spotify/now-playing actions | Depends/External | Spotify settings/Event Flow | Spotify account/OAuth/path support | Event Flow and app integration docs |
| Use OBS remote scene control | Depends/External | Dock commands or Event Flow | OBS WebSocket or OBS Browser Source API | `09-api-and-integrations/obs.md` |
| Use H2R/SPX/Singular graphics | External | URL/API integration settings | External graphics system endpoint/config | `13-reference/url-parameters.md` |
| Use MIDI controls | Yes | MIDI settings/Event Flow | Browser/app MIDI access and device mapping | `13-reference/action-command-index.md` |
| Use hotkeys | Depends | Dock/page shortcuts/settings | Focus/page support and exact shortcut mapping | Overlay docs and source |
| Use custom JavaScript hooks | Depends/Dev | Custom JS/user function paths | Trusted context and current hook behavior | `13-reference/custom-plugins-and-extensions.md` |
| Upload custom user functions | Depends/Dev | Custom injection/settings paths | Security review and exact current implementation | `13-reference/custom-plugins-and-extensions.md` |
| Make a "plugin" | Dev | Custom overlay/API/Event Flow/source file | Choose the right extension point; no normal marketplace path | `13-reference/custom-plugins-and-extensions.md` |
| Add a new site/source | Dev | `sources/*.js`, manifest, docs | Source script, manifest matches, event contract, tests | `12-development/adding-a-source.md` |
| Use the standalone desktop app instead of extension | Yes | `ssapp` | App install/version and source-window setup | `04-standalone-app-source-windows.md` |
| Avoid browser throttling/minimized issues | Depends | Standalone app or WebSocket/API mode | Platform support and source mode | `13-reference/modes-and-capability-matrix.md` |
| Use Firefox | Depends | Firefox XPI | Smaller capability surface than Chromium paths | `02-installation-and-surfaces.md` |
| Use Lite/mobile/simple page | Depends | Lite web app | Limited features compared with full extension/app | `13-reference/modes-and-capability-matrix.md` |
| Bypass platform restrictions/paywalls | No / Not Primary | None | SSN does not bypass platform access rules | `13-reference/free-paid-and-support-boundaries.md` |
| Repeat a broad public claim literally | Depends | Public docs plus source/runtime evidence | Narrow the claim by exact platform, mode, provider, and validation level | `13-reference/public-claims-boundary-matrix.md` |

## Surface Decision Matrix

| Feature Family | Extension | Standalone App | Hosted Pages | Local/Forked Pages | External API Client |
| --- | --- | --- | --- | --- | --- |
| Browser page chat capture | Strong default | Supported through managed source windows | No | No, unless custom source app sends data | No capture, receive only |
| Source window management | Browser tabs/windows | Strong default | No | No | No |
| Normal dock/featured overlays | Yes | Yes | Strong default for OBS | Yes, with manual updates | Can feed/control |
| Custom overlay rendering | Yes as viewer/control path | Yes | Yes for hosted custom pages | Strongest for local custom code | Can feed/control |
| Remote control API | Yes | Yes, app/source dependent | Page-dependent | Page-dependent | Strong default |
| Chat listener API | Yes, if relay enabled | Yes, if relay enabled | No by itself | No by itself | Strong default |
| Two-way platform chat | Depends by source | Depends by app/source/auth | No by itself | No by itself | Can request through source path |
| AI/TTS settings | Yes | Often shared plus app specifics | Page-dependent | Page-dependent | Can trigger/receive |
| Local file/custom JS | Restricted in hosted/extension context | App/source dependent | Limited | Strongest | External app owns code |

## Cost Decision Matrix

| Feature | SSN Cost | External Cost Risk | Note |
| --- | --- | --- | --- |
| Core extension/app/overlays/API | Free | Low | Hosted relay availability is still not a paid SLA. |
| DOM chat capture | Free | Low | Platform account/login may be required. |
| Communication/private page capture | Free integration | Privacy/consent | User controls access; support evidence should redact workspaces, meeting IDs, DMs, phone numbers, and AI conversations. |
| Embedded widget capture | Free | Low/medium | Widget layout and iframe behavior can change without platform API guarantees. |
| Live-commerce capture | Free integration | Commercial/private data | Seller IDs, buyer names, product listings, auction data, and store URLs can be sensitive; third-party layouts can change. |
| Webinar/event capture | Free integration | Event/private data | Attendee names, event URLs, Q&A text, and host settings can be sensitive; source scripts are not full webinar analytics APIs. |
| Creator/live-cam capture | Free integration | Private/paid-room data | Usernames, room URLs, token/tip rows, private-message text, and paid-room context can be sensitive; source scripts do not bypass platform access rules. |
| Popout/chat-only capture | Free | Low/medium | Platform login, exact chat URL, and rendered-page layout can still limit capture; some chat URLs expose private channel details. |
| Event/community capture | Free | Low/medium | Event URLs, UGC/comment panels, viewer counts, and Q&A text can be sensitive; source scripts are not event analytics APIs. |
| Independent live platform capture | Free | Low/medium | Community names, page URLs, viewer counts, tips/donations, replies, avatars, and message text can be sensitive; source scripts are rendered-page parsers, not official APIs. |
| Video/broadcast platform capture | Free | Low/medium | Event URLs, chat-room URLs, Q&A text, upstream platform icons, account names, avatars, and chat text can be sensitive; source scripts are rendered-page parsers, not official APIs. |
| Community/membership web-app capture | Free | Privacy/membership data | Member/community/workspace URLs, paid content, game tables, avatars, viewer counts, question text, and chat messages can be sensitive; source scripts do not bypass access rules. |
| Regional/emerging platform capture | Free | Low/medium | App account URLs, regional platform rooms, crypto/trading pages, viewer counts, tips/gifts, avatars, and message text can be sensitive; source scripts are rendered-page or activity-feed parsers, not official APIs. |
| Special-case platform/helper routing | Free | Low/medium | Mode confusion can expose session IDs, auth/token expectations, X/Twitter identity settings, or helper-copy behavior; confirm exact file/mode before sharing logs. |
| Cloud TTS | Free integration | High | Provider controls pricing and quotas. |
| Local TTS | Free integration | Hardware/time | Model/runtime support matters. |
| Cloud AI | Free integration | High | Provider controls pricing, quotas, data handling. |
| Local AI | Free integration | Hardware/time | User owns setup and performance. |
| Donation/payment webhooks | Free integration | Medium/high | Payment platforms control fees and rules. |
| OBS/graphics integrations | Free integration | Varies | External apps may be paid or self-hosted. |
| Custom development | Free source | Time/maintenance | User/fork owner maintains custom code. |

## Answer Patterns

### If The Answer Is Yes

Use:

```text
Yes. Start with [surface/doc]. The usual requirements are [session/mode/toggle]. If it fails, check [first likely issue].
```

### If The Answer Is Depends

Use:

```text
It depends on the platform/mode. SSN supports the general feature, but exact support depends on [platform/source/auth/page/provider]. Check [specific doc/source] before promising it.
```

### If The Answer Is External

Use:

```text
SSN supports integrating with it, but [provider/tool/platform] controls account access, pricing, limits, and availability.
```

### If The Answer Is Development

Use:

```text
This is possible as custom development through [custom overlay/API/Event Flow/source file], but it is not a one-click normal-user plugin path.
```

## High-Risk Claims To Verify First

- "This exact platform can send chat back."
- "This exact event type is supported on this platform."
- "This provider is free."
- "This works in Firefox/Lite/the desktop app exactly like Chrome."
- "This custom JS hook runs on hosted pages."
- "This webhook is secure without keeping the URL private."
- "This feature works while the source page is hidden/minimized."
- "This private chat/meeting source can send messages back."

## Follow-Up Extraction Needs

- Intense-validate the per-platform capability rows in `08-platform-sources/platform-capability-matrix.md` for send-back, badges, gifts, follows, raids, rewards, moderation, and private messages.
- Intense-validate app-specific support status for desktop source windows and OAuth flows against `04-standalone-app-source-windows.md` and current `ssapp` code.
- Add provider-specific AI/TTS capability rows with exact setting keys and URL parameters.
- Source-check every feature family against current public docs and runtime code before marking final.
