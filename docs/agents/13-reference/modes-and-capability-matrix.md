# Modes And Capability Matrix

Status: heavy reference pass started. This page helps choose the right SSN surface or capture mode before platform-specific debugging.

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
- `docs/agents/08-platform-sources/*.md`
- `C:\Users\steve\Code\ssapp\AGENTS.md`

## Product Surface Matrix

| Surface | Best For | Main Limits | First Support Check |
| --- | --- | --- | --- |
| Chrome/Chromium extension | Normal browser sessions, cookies, popout chats, most source capture | Browser throttling, manual update if unpacked, MV3 restrictions | Extension icon on/green; source page reloaded |
| Chrome Web Store extension | Easiest Chromium install | Store review lag; MV3 behavior | Version/install source |
| Manual unpacked extension | Latest source and development | User must keep folder and update manually | Folder not moved; extension reloaded |
| Firefox XPI | Firefox users | Missing Chromium-only debugger/tab-capture and some TTS/model paths | Reproduce in Chrome for Chromium-only features |
| Standalone desktop app | Managed source windows, no extension install, always-on-top/transparent workflows | Some embedded login/OAuth flows blocked; app testing required | Which app version and source mode |
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
| WebSocket/API source page | SSN page connects to platform API/socket | Better background reliability and richer events | Auth/scopes/API limits; feature gaps differ from DOM |
| Provider core | Shared platform logic under `providers/` | Reusable across app/extension | Needs adapters for UI/runtime |
| External custom source | A bot/app sends SSN JSON through API/WebSocket | Great for private tools and non-browser data | User owns payload quality and reconnection |
| Standalone app source window | Electron loads source page/content logic | Organized and less browser-throttled | Electron cookies/login differ from normal Chrome |

## Platform Mode Rules

| Platform | Common Modes | Support Rule |
| --- | --- | --- |
| YouTube | DOM live chat/Studio, watch shortcut/static comments, Data API polling/streaming | Ask DOM vs WebSocket/API first; API mode differs for badges/gifts/moderation. |
| Twitch | DOM popout, WebSocket/EventSub/API source | Use WebSocket/EventSub for follows/raids/channel points/richer events. |
| TikTok | DOM capture, standalone connector/signing paths | Confirm extension vs app mode, live status, username, and current app version. |
| Kick | DOM/chatroom/popout, WebSocket source, app OAuth/helper | CAPTCHAs/login state often decide extension vs app success. |
| Rumble | DOM capture, Rumble Live Stream API source | API source is read-only; sending chat is not supported by the documented API path. |
| Facebook | DOM capture, managed Page Graph/API bridge | API bridge is for managed Pages/live videos; viewer/publisher context matters. |
| Instagram | DOM live/feed/static capture variants | Exact page type matters: live vs feed/post comments. |
| Discord | DOM content script on web Discord | Requires source toggle/settings and full channel/page access. |
| Slack/Telegram/WhatsApp/Meet/ChatGPT | Toggle-required/sensitive page capture | Confirm the required menu toggle is enabled before debugging. |
| Generic/custom | `sources/generic.js`, custom overlay/API/source | Use for proof-of-concept or external data, not rich platform events. |

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
- Add per-platform support-status fields from current support history.
- Add app-specific compatibility status from `ssapp` source-window definitions and tests.
