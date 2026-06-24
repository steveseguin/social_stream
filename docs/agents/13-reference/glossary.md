# SSN Glossary

Status: heavy terminology pass from current agent docs on 2026-06-24.

Use this page when a user uses an ambiguous SSN term such as "command", "plugin", "source", "dock", "session", "WebSocket", or "overlay". Each definition is intentionally short and points to the deeper doc to use next.

## Core Product Terms

| Term | Meaning | Use Next |
| --- | --- | --- |
| SSN | Social Stream Ninja, the free/open-source chat capture, overlay, API, TTS, AI, and automation ecosystem. | `01-product-map.md` |
| Social Stream | Often used interchangeably with SSN; also refers to the `social_stream` repo/source. | `01-product-map.md` |
| Standalone app | Electron desktop app from `ssapp` that manages source windows and loads Social Stream source files. | `04-standalone-app-architecture.md` |
| Chrome extension | Browser extension surface for capturing platform pages through content scripts. | `03-extension-architecture.md` |
| Lite | Smaller/simple web app surface. Not full SSN feature parity. | `02-installation-and-surfaces.md` |
| Hosted pages | Pages served from `socialstream.ninja`, such as dock, featured, TTS, tools, and source pages. | `02-installation-and-surfaces.md` |
| Local/forked pages | User-run copy of SSN pages/source, often for custom overlays or development. | `12-development/repo-map.md` |

## Routing And Session Terms

| Term | Meaning | Use Next |
| --- | --- | --- |
| Session ID | Main routing value that connects sources, dock, overlays, API clients, and app source windows. Treat as private when it grants control. | `06-settings-sessions-and-storage.md` |
| Password | Optional value that can protect or gate control paths. Not required for every display-only workflow. | `06-settings-sessions-and-storage.md` |
| Label | URL/API targeting value used when multiple docks, featured pages, or overlays are open in the same session. | `13-reference/url-parameters.md` |
| Channel | API/WebSocket routing lane, such as channel 4 for receiving chat in external apps. Do not confuse with a platform channel/user. | `09-api-and-integrations/websocket-http-api.md` |
| Stream ID | Older/common wording for session ID in some code/docs. | `06-settings-sessions-and-storage.md` |
| Source-to-session binding | Standalone app behavior that remembers a meaningful custom session for a source identity. | `04-standalone-app-source-windows.md` |

## Source And Capture Terms

| Term | Meaning | Use Next |
| --- | --- | --- |
| Source | A platform page, source page, source script, or app source entry that captures messages/events and sends them into SSN. Ask what surface/mode the user means. | `08-platform-sources/source-inventory.md` |
| Source script | JavaScript under `sources/`, `sources/static/`, `sources/inject/`, or `sources/websocket/` that handles a site/source path. | `08-platform-sources/source-file-processing-matrix.md` |
| Source window | Standalone app Electron window that loads a source URL/page and injects source code. | `04-standalone-app-source-windows.md` |
| DOM capture | Content script reads the rendered platform page/chat DOM. It sees what the page renders and can break when layouts change. | `13-reference/modes-and-capability-matrix.md` |
| Popout source | Setup where the user must open a platform chat-only/popout URL. | `08-platform-sources/supported-sites-lookup.md` |
| Toggle-required source | Sensitive/private source that needs an SSN setting/menu toggle before capture, then a page reload. | `08-platform-sources/public-site-support-status.md` |
| Communication/private source | Rendered web-page capture for work chats, meetings, messaging apps, or assistant pages such as Slack, Telegram, WhatsApp, Meet, Teams, Zoom, Webex, Chime, or ChatGPT/OpenAI. Treat support evidence as private and do not assume send-back. | `08-platform-sources/communication-and-sensitive-sources.md` |
| Embedded widget source | Rendered capture from a smaller embedded chat widget or IRC web client such as CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit, or Online Church. | `08-platform-sources/embedded-chat-widget-sources.md` |
| Live-commerce source | Live shopping source such as Amazon Live, eBay Live, or Whatnot. May capture plain chat plus platform-specific auction, product, viewer, reaction, or WebSocket-derived events. | `08-platform-sources/live-commerce-sources.md` |
| Webinar/event source | Rendered capture from event or webinar pages such as Crowdcast, Livestorm, ON24, Riverside, Sessions, Wave Video, or WebinarGeek. Usually chat/Q&A/sidebar capture, not full event analytics. | `08-platform-sources/webinar-and-event-sources.md` |
| Creator/live-cam source | Rendered capture from supported creator live room/chat pages such as Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, or Stripchat. May include token/tip or private-row handling where the source implements it. | `08-platform-sources/creator-live-cam-sources.md` |
| Popout/chat-only source | Platform source that requires a dedicated chat-only or popout URL rather than the normal watch/profile page. Wrong URL shape is usually the first support check. | `08-platform-sources/popout-chat-only-sources.md` |
| Event/community source | Rendered capture from event/community pages such as Arena Social, Buzzit, CI.ME, Gala, LinkedIn Events, LivePush, MegaphoneTV, QuickChannel, Slido, or TradingView. Usually chat/comment/Q&A capture, not full event analytics. | `08-platform-sources/event-and-community-sources.md` |
| Independent live platform source | Rendered capture from smaller live/video/community platforms such as BandLab, Bigo.tv, Bitchute, Blaze, Castr, Cherry TV, CloutHub, Cozy.tv, DLive, Estrim, FC2, Jaco.live, LFG.tv, Locals.com, or Loco.gg. Usually visible chat capture with source-specific extras, not official API access. | `08-platform-sources/independent-live-platform-sources.md` |
| Video/broadcast platform source | Rendered capture from smaller video, audio, broadcast, or chat-only pages such as Mixlr, NicoVideo, NonOLive, Owncast, PeerTube, Restream.io Chat, Steam Broadcasts, Trovo, Truffle.vip, TwitCasting, Vimeo, YouNow, or Zap.stream. Usually chat/Q&A capture, not official API access. | `08-platform-sources/video-broadcast-platform-sources.md` |
| Community/membership web-app source | Rendered capture from member/community/workspace/game/app pages such as Circle.so, MeetMe, NextCloud, Patreon, Roll20, Simps, Tellonym, Whop, Wix Live/widgets, or Workplace legacy routing. Usually visible page capture, not official API access. | `08-platform-sources/community-membership-webapp-sources.md` |
| Regional/emerging platform source | Rendered page or activity-feed capture from smaller regional, emerging, app-specific, or newly added sources such as Bilibili DOM paths, Favorited, Kwai, Pilled, Pump.fun, SharePlay, Stream.place, Substack, Tikfinity, VK Live, or Xeenon. Usually exact URL form matters. | `08-platform-sources/regional-and-emerging-platform-sources.md` |
| Special-case platform/helper source | Source routing where rendered-site capture, source-page/API mode, static/manual capture, or helper-copy behavior overlap, such as Joystick, Velora, VPZone, X live/static split, Vertical Pixel Zone, Vercel Demo, and top-level YouTube helper copies. | `08-platform-sources/special-case-platform-and-helper-sources.md` |
| Manual/static source | Source where the user manually selects posts/comments or uses helper controls; not automatic live chat. | `08-platform-sources/public-site-support-status.md` |
| WebSocket/API source page | SSN page under `sources/websocket/*` that connects to an API/socket and forwards data into SSN. | `08-platform-sources/websocket-source-pages.md` |
| Provider core | Environment-agnostic platform helper under `providers/`, currently used for newer shared logic. | `12-development/provider-cores-and-shared-utils.md` |
| Source mode | Capture route such as DOM/classic, WebSocket/API, EventSub, app connector, static/manual, or custom external source. | `13-reference/modes-and-capability-matrix.md` |
| WSS | Often means WebSocket/source-page mode in SSN context. Ask whether the user means WebSocket source, hosted socket server, or secure WebSocket URL. | `08-platform-sources/websocket-source-pages.md` or `09-api-and-integrations/websocket-http-api.md` |

## Display And Overlay Terms

| Term | Meaning | Use Next |
| --- | --- | --- |
| Dock | `dock.html`, the main chat dashboard/control page for messages, filtering, queues, featuring, TTS, and controls. | `07-overlays-and-pages/dock.md` |
| Featured overlay | `featured.html`, the overlay that shows selected/featured messages, often in OBS. | `07-overlays-and-pages/featured.md` |
| Overlay | Browser/display page used in OBS or production output. May mean dock, featured, alerts, TTS, custom overlays, or game/tool pages. | `07-overlays-and-pages/index.md` |
| Browser source | OBS source type that loads an SSN page URL. It does not capture chat by itself. | `10-troubleshooting/obs-overlay-display.md` |
| Multi-alerts | Alert page for stream events where supported by platform/mode. | `07-overlays-and-pages/multi-alerts.md` |
| Waitlist/queue | Page/dock workflow for viewer queues, giveaway lists, and selected entries. | `07-overlays-and-pages/waitlist-polls-games.md` |
| Custom overlay | User-created HTML/CSS/JS display page consuming SSN payloads through iframe/API/WebSocket paths. | `07-overlays-and-pages/custom-overlays.md` |

## Command And Automation Terms

| Term | Meaning | Use Next |
| --- | --- | --- |
| Command | Ambiguous. Could mean viewer chat command, API action, URL parameter, MIDI/hotkey, Event Flow action, or custom JS function. Clarify first. | `13-reference/commands-and-actions.md` |
| Viewer chat command | Text typed by viewers in platform chat, such as `!joke`, `!say`, or `!join`. | `13-reference/commands-and-actions.md` |
| API action | Remote control action sent through HTTP/WebSocket API, such as `clearOverlay`, `nextInQueue`, or `sendChat`. | `13-reference/action-command-index.md` |
| URL parameter | Option added to a page URL, often read at page load, such as `&darkmode`, `&scale`, or `&server`. | `13-reference/url-parameters.md` |
| Event Flow | Visual automation editor with triggers, actions, state nodes, media, OBS, TTS, webhooks, and custom JS paths. | `09-api-and-integrations/event-flow-editor.md` |
| StreamDeck | Hardware/control surface usually connected through HTTP GET API buttons or Bitfocus Companion. | `09-api-and-integrations/streamdeck-companion.md` |
| Companion | Bitfocus Companion integration/control path. | `09-api-and-integrations/streamdeck-companion.md` |
| Streamer.bot | External automation tool that can integrate through SSN API/WebSocket routes. | `09-api-and-integrations/streamerbot.md` |
| OBS remote | OBS control path through OBS WebSocket or OBS browser-source APIs. | `09-api-and-integrations/obs.md` |

## Customization And Development Terms

| Term | Meaning | Use Next |
| --- | --- | --- |
| Plugin | Ambiguous in SSN. Usually means custom overlay, API client, Event Flow, custom JS hook, uploaded user function, or custom source. Not a normal plugin marketplace. | `13-reference/custom-plugins-and-extensions.md` |
| Custom JS | User-controlled JavaScript hook, often local/forked page behavior such as `custom.js` or `custom_actions.js`. | `13-reference/custom-plugins-and-extensions.md` |
| Custom user function | Uploaded or configured user function path where supported. Treat as trusted code and source-check current implementation. | `13-reference/custom-plugins-and-extensions.md` |
| Custom source | User-created source script/page/API client that emits SSN-shaped payloads. | `08-platform-sources/generic-and-custom-sources.md` |
| First-class source | Maintained built-in platform source with source file, manifest match, docs/site metadata, and tests/validation expectations. | `12-development/adding-a-source.md` |
| Event contract | Expected payload fields and event names. `docs/event-reference.html` is the canonical public anchor. | `05-message-flow-and-event-contracts.md` |
| Payload | Message/event object that sources send and overlays/API/Event Flow consume. | `05-message-flow-and-event-contracts.md` |
| `meta` | Payload sub-object for source-specific, experimental, or integration-specific details. | `05-message-flow-and-event-contracts.md` |

## Platform Feature Terms

| Term | Meaning | Use Next |
| --- | --- | --- |
| Rich events | Platform events beyond plain chat, such as follows, raids, subscriptions, gifts, channel points, donations, deletes, bans, or viewer updates. | `08-platform-sources/platform-capability-matrix.md` |
| Send-back | SSN sending a message back to the platform chat. Receiving chat does not automatically mean send-back is supported. | `08-platform-sources/platform-capability-matrix.md` |
| Moderation | Blocking, deleting, banning, or related platform-control actions. Requires platform/mode/source validation. | `08-platform-sources/platform-capability-matrix.md` |
| Channel points/rewards | Twitch/Kick-style reward redemptions. Usually requires WebSocket/API/EventSub/bridge mode. | `08-platform-sources/platform-capability-matrix.md` |
| Donation | Paid/tip-like payload. Often appears as `hasDonation`, but exact event names differ by platform. | `08-platform-sources/platform-capability-matrix.md` |
| Gift/subscription event | Platform membership/subscription event. YouTube, Twitch, Kick, and Rumble use different event names and fields. | `08-platform-sources/platform-capability-matrix.md` |
| Viewer count/status | Platform metric/status event. Availability can be delayed, missing, approximate, or API-limited. | `08-platform-sources/platform-capability-matrix.md` |

## Cost, Support, And Safety Terms

| Term | Meaning | Use Next |
| --- | --- | --- |
| Free | SSN itself is free/open source. Third-party providers, APIs, AI, TTS, graphics tools, platforms, or hosting can still cost money. | `13-reference/free-paid-and-support-boundaries.md` |
| Donation | Gift/support for Steve. Not payment for guaranteed support, integrations, or feature work. | `13-reference/free-paid-and-support-boundaries.md` |
| Best-effort support | Support via Discord/GitHub/docs without a paid SLA or guaranteed fix. | `13-reference/support-resources-and-escalation.md` |
| Secret | Session IDs, passwords, OAuth tokens, API keys, webhooks, private endpoints, and Rumble API URLs should be redacted. | `13-reference/support-resources-and-escalation.md` |
| Public listing | A site card in `docs/js/sites.js`; proves public setup guidance exists, not full feature coverage. | `08-platform-sources/public-site-support-status.md` |

## Common Ambiguities

| User Says | Ask Or Infer |
| --- | --- |
| "The overlay does not work." | Is dock receiving messages? Is OBS blank only? Which overlay URL/page? |
| "Commands do not work." | Viewer chat command, API action, URL parameter, Event Flow action, hotkey/MIDI, or custom JS? |
| "WebSocket is broken." | Hosted API socket, local server, platform source page, EventSub, or app connector? |
| "Plugin" | Custom overlay, custom source, custom JS, Event Flow, API client, or a new built-in source? |
| "The app does not capture." | Source mode, source window visibility, custom session, app version, exact platform URL, and whether extension works as a control. |
| "Site is supported but broken." | Public setup type, exact URL, surface, source mode, whether feature requested is plain chat or rich/send-back/moderation. |

## Follow-Up Extraction Needs

- Add exact UI labels from popup, dock, app, and Event Flow where user wording differs from source wording.
- Add synonyms from recent support transcripts after privacy-safe support mining.
- Add links from high-traffic docs to this glossary where term confusion appears repeatedly.
