# Modes And Capability Matrix

Status: heavy reference pass started. This page helps choose the right SSN surface or capture mode before platform-specific debugging.

For setup-choice routing by user goal, use `workflow-setup-decision-tree.md`. For first-stop app/extension/hosted/local/Lite/Firefox decisions, use `app-extension-mode-crosswalk.md`. For feature-level yes/depends/external/dev answers, use `feature-support-decision-matrix.md`. For platform-specific event and send-back routing, use `08-platform-sources/platform-capability-matrix.md`.

## Source Anchors

- `README.md`
- `docs/download.html`
- `docs/guides.html`
- `docs/supported-sites.html`
- `manifest.json`
- `sources/*.js`
- `sources/websocket/*.html`
- `sources/websocket/*.js`
- `docs/agents/01-product-map.md`
- `docs/agents/02-installation-and-surfaces.md`
- `docs/agents/04-standalone-app-source-windows.md`
- `docs/agents/08-platform-sources/*.md`
- `docs/agents/08-platform-sources/websocket-source-pages.md`
- `docs/agents/08-platform-sources/communication-and-sensitive-sources.md`
- `docs/agents/08-platform-sources/embedded-chat-widget-sources.md`
- `docs/agents/08-platform-sources/live-commerce-sources.md`
- `docs/agents/08-platform-sources/webinar-and-event-sources.md`
- `docs/agents/08-platform-sources/creator-live-cam-sources.md`
- `docs/agents/08-platform-sources/popout-chat-only-sources.md`
- `docs/agents/08-platform-sources/event-and-community-sources.md`
- `docs/agents/08-platform-sources/independent-live-platform-sources.md`
- `docs/agents/08-platform-sources/video-broadcast-platform-sources.md`
- `docs/agents/08-platform-sources/community-membership-webapp-sources.md`
- `docs/agents/08-platform-sources/regional-and-emerging-platform-sources.md`
- `docs/agents/08-platform-sources/special-case-platform-and-helper-sources.md`
- `docs/agents/08-platform-sources/tiktok-standalone-app.md`
- `docs/agents/08-platform-sources/platform-capability-matrix.md`
- `docs/agents/13-reference/feature-support-decision-matrix.md`
- `C:\Users\steve\Code\ssapp\AGENTS.md`

## Product Surface Matrix

| Surface | Best For | Main Limits | First Support Check |
| --- | --- | --- | --- |
| Chrome/Chromium extension | Normal browser sessions, cookies, popout chats, most source capture | Browser throttling, manual update if unpacked, MV3 restrictions | Extension icon on/green; source page reloaded |
| Chrome Web Store extension | Easiest Chromium install | Store review lag; MV3 behavior | Version/install source |
| Manual unpacked extension | Latest source and development | User must keep folder and update manually | Folder not moved; extension reloaded |
| Firefox XPI | Firefox users | Missing Chromium-only debugger/tab-capture and some TTS/model paths | Reproduce in Chrome for Chromium-only features |
| Standalone desktop app | Managed source windows, no extension install, always-on-top/transparent workflows | Some embedded login/OAuth flows blocked; app testing required | Which app version, source mode, session, and source-window state |
| Hosted pages | Normal OBS browser source for dock/featured/tools | Cannot load local `custom.js` | Correct hosted URL and session |
| Local/forked pages | Custom overlays, local `custom.js`, development | Manual updates; OS/OBS local-file quirks | Browser console and path correctness |
| Lite web app | Quick/mobile/simple usage | Limited sites/features/customization | Confirm user really means Lite |
| External API client | Bots, StreamDeck, Companion, private apps, chat listeners | Requires API toggles and correct channels | Toggle and channel check |

## Capture Mode Matrix

| Mode | Description | Strengths | Weaknesses |
| --- | --- | --- | --- |
| DOM/content-script capture | Reads rendered chat from a web page/popout | No platform API key for many sites; sees what user sees | Fragile to layout changes; can throttle when hidden |
| Static/manual picker | User clicks/selects posts/comments manually | Useful for static pages, X posts, comments | Not automatic live chat |
| Injected helper | Extension injects helper into page context | Can access page-level variables/sockets | More fragile and permission-sensitive |
| WebSocket/API source page | SSN page connects to platform API/socket | Better background reliability and richer events | Auth/scopes/API limits; feature gaps differ from DOM; route grouped source-page behavior through `08-platform-sources/websocket-source-pages.md` |
| Embedded widget/IRC capture | Content script reads rendered chat widgets or IRC web clients | Useful for embedded chat services and site widgets | Iframe/all-frame setup, brittle widget DOM, limited events; route grouped behavior through `08-platform-sources/embedded-chat-widget-sources.md` |
| Live-commerce capture | Content script reads live shopping chat and selected shopping state | Useful for Amazon Live/eBay/Whatnot chat and commerce metadata | Product/auction metadata is platform-specific; product-list display is a separate page/API path |
| Webinar/event capture | Content script reads rendered webinar/event chat, Q&A, or sidebar rows | Useful for event platforms where chat is rendered in the page | Usually not full webinar analytics, attendance, polls, or registrations; route through `08-platform-sources/webinar-and-event-sources.md` |
| Creator/live-cam capture | Content script reads rendered room/chat rows from supported creator live sites | Useful for visible room chat and source-specific token/tip rows | Sensitive/private context, generated selectors, new-row capture, and no assumed send-back; route through `08-platform-sources/creator-live-cam-sources.md` |
| Popout/chat-only capture | Content script reads a dedicated chat-only URL instead of the normal video/profile page | Reduces page noise and is required for many smaller platforms | Wrong URL is the first failure; route through `08-platform-sources/popout-chat-only-sources.md` |
| Event/community capture | Content script reads rendered event/community chat, comments, UGC, or Q&A rows | Useful for smaller event/community pages without full API setup | Exact event URL and visible panel matter; route through `08-platform-sources/event-and-community-sources.md` |
| Independent live platform capture | Content script reads rendered chat rows from smaller independent live/video/community platforms | Useful for supported sites where chat is visible on a normal or platform-specific page | Exact URL, visible chat, and new-row tests matter; source-specific viewer/tip/reply/join support routes through `08-platform-sources/independent-live-platform-sources.md` |
| Video/broadcast platform capture | Content script reads rendered chat rows from video, audio, broadcast, or chat-only platform pages | Useful for Mixlr, Vimeo, Restream, PeerTube, Steam, and similar chat pages | Exact URL/chat room, visible chat, and new-row tests matter; route through `08-platform-sources/video-broadcast-platform-sources.md` |
| Community/membership web-app capture | Content script reads rendered member/community/workspace/game/app chat or message rows | Useful for Circle, Patreon, Roll20, Wix, Whop, and similar web-app pages where the user already has access | Login/membership/workspace access, source toggles, visible panel, and privacy redaction matter; route through `08-platform-sources/community-membership-webapp-sources.md` |
| Regional/emerging platform capture | Content script reads rendered chat/activity rows from smaller regional, emerging, app-specific, or newly added sites | Useful for Bilibili DOM paths, Favorited, Kwai, Pilled, Pump.fun, SharePlay, Substack, Tikfinity, and similar newer sources | Exact URL form, visible chat/activity panel, new-row tests, and source-specific event caveats matter; route through `08-platform-sources/regional-and-emerging-platform-sources.md` |
| Special-case platform/helper capture | Clarifies files where rendered-site capture, source-page/API capture, and helper copies overlap | Useful for Joystick, Velora, VPZone, X live/static split, Vertical Pixel Zone, Vercel demo helper, and top-level YouTube helper copies | Confirm exact mode before troubleshooting; route through `08-platform-sources/special-case-platform-and-helper-sources.md` |
| Provider core | Shared platform logic under `providers/` | Reusable across app/extension | Needs adapters for UI/runtime |
| External custom source | A bot/app sends SSN JSON through API/WebSocket | Great for private tools and non-browser data | User owns payload quality and reconnection |
| Standalone app source window | Electron loads source page/content logic | Organized and less browser-throttled | Electron cookies/login differ from normal Chrome |

## Platform Mode Rules

| Platform | Common Modes | Support Rule |
| --- | --- | --- |
| YouTube | DOM live chat/Studio, watch shortcut/static comments, Data API polling/streaming | Ask DOM vs WebSocket/API first; API mode differs for badges/gifts/moderation. |
| Twitch | DOM popout, WebSocket/EventSub/API source | Use WebSocket/EventSub for follows/raids/channel points/richer events. |
| TikTok | DOM capture, standalone connector/signing paths | Confirm extension vs app mode, live status, username, current app version, signing provider, and whether replies are expected; route app connector details through `08-platform-sources/tiktok-standalone-app.md`. |
| Kick | DOM/chatroom/popout, WebSocket source, app OAuth/helper | CAPTCHAs/login state often decide extension vs app success. |
| Rumble | DOM capture, Rumble Live Stream API source | API source is read-only; sending chat is not supported by the documented API path. |
| Facebook | DOM capture, managed Page Graph/API bridge | API bridge is for managed Pages/live videos; viewer/publisher context matters. |
| Instagram | DOM live/feed/static capture variants | Exact page type matters: live vs feed/post comments. |
| Discord | DOM content script on web Discord | Requires source toggle/settings and full channel/page access. |
| Communication/private sources | ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Meet, Teams, Zoom, Webex, Chime | Use `08-platform-sources/communication-and-sensitive-sources.md`; confirm web version, source toggle where required, page reload, chat panel visibility, and privacy redaction before debugging. |
| Generic/custom | `sources/generic.js`, custom overlay/API/source | Use for proof-of-concept or external data, not rich platform events. |
| Embedded chat widgets | CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit, Online Church | Use `08-platform-sources/embedded-chat-widget-sources.md`; confirm exact widget URL, loaded iframe/page, new rendered messages, and no assumed send-back. |
| Live commerce | Amazon Live, eBay Live, Whatnot | Use `08-platform-sources/live-commerce-sources.md`; ask whether the user expects chat, viewer counts, auction/product metadata, WebSocket events, or product-list display. |
| Webinars/events | Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions, Wave Video, WebinarGeek | Use `08-platform-sources/webinar-and-event-sources.md`; ask whether the user expects chat, Q&A, sidebar capture, relayed platform type, or analytics. |
| Creator/live-cam sources | Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, Stripchat | Use `08-platform-sources/creator-live-cam-sources.md`; ask whether the user expects plain chat, token/tip rows, private messages, notices, viewer counts, or send-back. |
| Popout/chat-only sources | Beamstream, BoltPlus, Chzzk, FloatPlane, GoodGame, Mixcloud, Nimo, Odysee, Parti, Picarto, Piczel, RokFin, Rutube, SoopLive, VK chat paths | Use `08-platform-sources/popout-chat-only-sources.md`; ask for the exact chat-only URL before debugging platform layout. |
| Event/community sources | Arena Social, Buzzit, CI.ME, Gala, LinkedIn Events, LivePush, MegaphoneTV, QuickChannel, Slido, TradingView | Use `08-platform-sources/event-and-community-sources.md`; ask for exact URL, visible chat/Q&A panel, and whether the user expects viewer counts, donations, upstream source type, or send-back. |
| Independent live platform sources | BandLab, Bigo.tv, Bitchute, Blaze, Castr, Cherry TV, CloutHub, Cozy.tv, DLive, Estrim, FC2, Jaco.live, LFG.tv, Locals.com, Loco.gg | Use `08-platform-sources/independent-live-platform-sources.md`; ask for exact URL, visible chat, new-message test, and whether the user expects viewer counts, tips/donations, replies, joins, stickers/images, or send-back. |
| Video/broadcast platform sources | Mixlr, NicoVideo, NonOLive, OpenStreamingPlatform, Owncast, PeerTube, Restream.io Chat, Steam Broadcasts, Trovo, Truffle.vip, TwitCasting, Vimeo, YouNow, Zap.stream | Use `08-platform-sources/video-broadcast-platform-sources.md`; ask for exact URL, visible chat, new-message test, and whether the user expects Q&A, upstream source labels/icons, badges, login-gated chat, or send-back. |
| Community/membership web-app sources | Circle.so, MeetMe, NextCloud, Patreon, Roll20, Simps, Tellonym, Whop, Wix Live/widgets, Workplace legacy routing | Use `08-platform-sources/community-membership-webapp-sources.md`; ask for exact URL, access/login state, visible panel, source toggle where required, and whether the user expects viewer counts, images, identity fields, or send-back. |
| Regional/emerging platform sources | Bilibili DOM paths, Favorited, Kwai, Pilled, Portal, Pump.fun, Retake, Rooter, SharePlay, SoulBound, Stream.place, Substack, Tikfinity, uScreen, VK Live, Xeenon | Use `08-platform-sources/regional-and-emerging-platform-sources.md`; ask for exact URL form, visible chat/activity panel, new-row test, and whether the user expects viewer counts, tips/gifts, joins, raids/shoutouts, relayed source identity, or send-back. |
| Special-case platform/helper sources | Joystick, Velora, VPZone, X live/static split, Vertical Pixel Zone, Vercel demo helper, top-level YouTube helper copies | Use `08-platform-sources/special-case-platform-and-helper-sources.md`; ask whether the user is on the rendered site, source-page/API mode, static/manual helper, or an unmanifested helper copy. |
| Other WebSocket/API pages | Bilibili, IRC, Joystick, Nostr, Social Stream Chat, StageTEN, Streamlabs, Velora, VPZone | Use `08-platform-sources/websocket-source-pages.md`; send-back and auth vary by source page. |

For richer platform-specific routing by event family, send-back support, and app differences, use `08-platform-sources/platform-capability-matrix.md`.

## Mode Selection For Common Questions

| User Goal | Recommended Starting Point |
| --- | --- |
| "I just want chat in OBS." | Extension or app source plus hosted `dock.html`/`featured.html`. |
| "Chat stops when minimized." | Keep source visible; try standalone app or WebSocket/API mode where available. |
| "I need follows/raids/channel points/subs." | Platform WebSocket/API/EventSub mode when supported. |
| "I need to send chat back." | Confirm source send support, login, permissions, and auto-responder/debugger availability. |
| "I need a private app to receive chat." | API listener on channel 4 with remote control and chat relay toggles enabled. |
| "I need a StreamDeck button." | HTTP GET API command or Bitfocus Companion module. |
| "I need a custom look." | URL params/CSS first; custom overlay if layout must be custom. |
| "I need a new platform." | Existing WebSocket/API/custom source if possible; first-class source only if it should be maintained. |

## Feature Availability Caveats

- "Supported site" does not mean every event type is supported.
- Private communication and meeting sources are rendered page captures; do not assume bot/API access, moderation, or send-back.
- DOM mode can see rendered badges/emotes/cards that APIs do not expose.
- API/WebSocket mode can expose events that DOM mode never sees.
- Firefox lacks some Chromium-only automation paths.
- Lite is not full SSN.
- Standalone app can avoid browser throttling but can hit embedded login restrictions.
- Hosted pages stay current but cannot load local `custom.js`.
- Local pages enable deeper customization but users must maintain them.

## First Question Checklist

Ask or infer:

- Which product surface?
- Which install source/version?
- Which platform and exact source URL type?
- Which capture mode?
- Does dock receive messages?
- Does overlay receive messages outside OBS?
- Are API/server toggles enabled?
- Is the source visible and active?
- Is the user expecting a mode-specific feature?

## Follow-Up Extraction Needs

- Generate a full mode matrix from `manifest.json`, `docs/js/sites.js`, and source filenames.
- Intense-validate per-platform support-status fields in `08-platform-sources/platform-capability-matrix.md` against current support history and source code.
- Intense-validate app-specific compatibility status from `ssapp` source-window definitions and tests, starting with `04-standalone-app-source-windows.md` and `08-platform-sources/tiktok-standalone-app.md`.
- Live/browser validation of `08-platform-sources/community-membership-webapp-sources.md` Patreon toggle/viewer behavior, Simps/Whop viewer updates, Circle/Patreon images, Wix embedded paths, NextCloud domain scope, Workplace routing, and app source-window parity.
- Live/browser validation of `08-platform-sources/regional-and-emerging-platform-sources.md` Bilibili URL variants, SharePlay shoutout/Blitz cards, Tikfinity feed payloads, Stream.place relayed rows, Substack live URL routing, Pump.fun/Retake tips, and inactive viewer helper paths.
- Live/browser validation of `08-platform-sources/special-case-platform-and-helper-sources.md` Joystick/Velora/VPZone mode split, Vertical Pixel Zone selectors/source identity, X live chat URL variants, Vercel session helper consent, and top-level YouTube helper copy behavior.
