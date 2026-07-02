# Public Site Support Status

Status: heavy synthesis pass from `docs/js/sites.js`, supported-site lookup, source inventory, manifest matrices, platform docs, and support docs on 2026-06-24.

Use this page to decide how strong an answer can be when a user asks whether a site is supported. This page does not replace the full site list in `supported-sites-lookup.md`; it explains what a public listing means and what still needs source verification.

## Source Anchors

- `docs/js/sites.js`
- `docs/supported-sites.html`
- `manifest.json`
- `docs/agents/08-platform-sources/supported-sites-lookup.md`
- `docs/agents/08-platform-sources/public-site-implementation-map.md`
- `docs/agents/08-platform-sources/source-inventory.md`
- `docs/agents/08-platform-sources/source-file-processing-matrix.md`
- `docs/agents/08-platform-sources/manifest-content-scripts.md`
- `docs/agents/08-platform-sources/manifest-row-matrix.md`
- `docs/agents/08-platform-sources/platform-capability-matrix.md`
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
- `docs/agents/11-support-kb/support-answer-bank.md`

For one-row-per-site source and manifest routing, use `public-site-implementation-map.md`.

## Core Rule

A public supported-site card proves that SSN publicly presents a setup path for that site. It does not prove:

- every URL on that platform is matched by the manifest
- every event type is captured
- chat send-back is supported
- moderation is supported
- badges, avatars, gifts, tips, follows, raids, rewards, or viewer counts are supported
- the standalone app behaves the same as the Chrome extension
- the platform has not changed since the public card was created

Safe wording:

```text
It is listed as a supported [setup type] source. Start with [setup route]. If that does not work, verify the exact URL against the manifest/source file and check whether this feature depends on a richer WebSocket/API/app mode.
```

## Support Strength Levels

| Level | Evidence | What An Agent Can Safely Say | What Still Needs Verification |
| --- | --- | --- | --- |
| Dedicated heavy doc | Platform has a focused agent page, such as YouTube/TikTok/Twitch/Kick/Rumble/Facebook/Instagram/Discord | Give setup mode, first troubleshooting checks, and broad capability caveats from the platform doc. | Exact line-level fields, send-back, moderation, auth scopes, and app parity. |
| Public card plus manifest/source inventory | Site appears in `docs/js/sites.js` and has manifest/source inventory coverage | Say it is publicly listed and describe the setup type. | Exact current selector/parser behavior and feature coverage. |
| Public card only or source inventory only | Site is listed or counted but not deeply documented | Give only setup-level guidance and ask for exact URL/mode before deeper claims. | Whether the current platform layout still works. |
| WebSocket/API source page | Public setup points at an SSN `sources/websocket/*` page | Say it is a source-page/API workflow and may differ from DOM capture. Route grouped source-page behavior through `websocket-source-pages.md`. | Auth, API limits, event set, read/write support, and app bridge behavior. |
| Static/manual helper | Public setup or manifest points at `sources/static/*` | Say it is not normal automatic live chat and requires user action. | Current helper UI, selector behavior, and page-layout support. |
| Toggle-required sensitive source | Public setup requires an SSN setting/menu toggle | Say the toggle must be enabled and the page reloaded; treat privacy carefully. | Exact setting key, allowed URL path, and current page selectors. |
| Communication/private source doc | Site belongs to ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Meet, Teams, Zoom, Webex, or Chime grouped routing | Say this is rendered page capture, not bot/API access; require web version, panel visibility, reload, and privacy redaction. | Current selectors, opt-in gating, app parity, and any send-back path. |
| Embedded chat widget source doc | Site belongs to CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit, or Online Church grouped routing | Say this is rendered widget/page capture; require exact widget URL, loaded chat frame/page, and a new rendered message. | Current selectors, iframe/all-frame behavior, event limits, and send-back path. |
| Live-commerce source doc | Site belongs to Amazon Live, eBay Live, or Whatnot grouped routing | Say public support includes live shopping capture; separate plain chat from auction/product/viewer/reaction/WebSocket metadata. | Current DOM/API/socket layout, product payload fields, app parity, and send-back path. |
| Webinar/event source doc | Site belongs to Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions, Wave Video, or WebinarGeek grouped routing | Say support is rendered chat/Q&A/sidebar capture, not full webinar analytics. | Current selectors, Q&A behavior, relayed type mapping, app parity, and send-back path. |
| Creator/live-cam source doc | Site belongs to Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, or Stripchat grouped routing | Say support is rendered room/chat capture with source-specific token/tip/private-message behavior. | Current selectors, token/tip/private rows, hidden-tab behavior, app parity, and send-back path. |
| Popout/chat-only source doc | Site belongs to smaller platforms grouped in `popout-chat-only-sources.md` | Say support depends on opening the exact popout/chat-only URL and testing a new rendered message. | Current selectors, exact URL forms, donation/viewer-count extras, app parity, and send-back path. |
| Event/community source doc | Site belongs to Arena Social, Buzzit, CI.ME, Gala, LinkedIn Events, LivePush, MegaphoneTV, QuickChannel, Slido, or TradingView grouped routing | Say support is rendered event/community chat, comment, UGC, or Q&A capture. | Current selectors, exact URL forms, viewer/donation/source-type extras, app parity, and send-back path. |
| Independent live platform source doc | Site belongs to BandLab, Bigo.tv, Bitchute, Blaze, Castr, Cherry TV, CloutHub, Cozy.tv, DLive, Estrim, FC2, Jaco.live, LFG.tv, Locals.com, or Loco.gg grouped routing | Say support is rendered-page chat capture with source-specific viewer/tip/reply/join/image behavior. | Current selectors, exact URL forms, DLive public routing, viewer/tip samples, app parity, and send-back path. |
| Video/broadcast platform source doc | Site belongs to Mixlr, NicoVideo, NonOLive, OpenStreamingPlatform, Owncast, PeerTube, Restream.io Chat, Steam Broadcasts, Trovo, Truffle.vip, TwitCasting, Vimeo, YouNow, or Zap.stream grouped routing | Say support is rendered chat or Q&A/sidebar capture from the exact platform URL or chat-room URL. | Current selectors, exact URL forms, Trovo/OSP public routing, Q&A/upstream source behavior, login/paywall state, app parity, and send-back path. |
| Community/membership web-app source doc | Site belongs to Circle.so, MeetMe, NextCloud, Patreon, Roll20, Simps, Tellonym, Whop, Wix Live/widgets, or Workplace legacy routing | Say support is rendered page capture on pages the user can access; require exact URL, access state, visible panel, and privacy redaction. | Current selectors, exact URL forms, source toggles, viewer-count/image extras, app parity, and send-back path. |
| Regional/emerging platform source doc | Site belongs to Bilibili DOM paths, Favorited, Kwai, Pilled, Portal, Pump.fun, Retake, Rooter, SharePlay, SoulBound, Stream.place, Substack, Tikfinity, uScreen, VK Live, or Xeenon grouped routing | Say support is rendered page or activity-feed capture on exact URL forms; require visible chat/activity and a new-row test. | Current selectors, exact URL forms, viewer/tip/raid/join extras, inactive viewer helpers, app parity, and send-back path. |
| Special-case platform/helper source doc | Site/file belongs to Joystick DOM, Velora DOM, VPZone rendered or source-page modes, X live/static split, Vertical Pixel Zone, Vercel Demo, or top-level YouTube helper copies | Say support depends on the exact mode: rendered site, source-page/API, static/manual helper, or helper copy. | Current selectors, source identity, helper load path, send-back mode, app parity, and whether the helper is manifest-loaded. |
| Duplicate/contradictory public card | Public metadata has duplicate or conflicting setup hints | Mention the safer setup path and verify source before details. | Which public card should be canonical. |
| Manifest-only/helper-only | Manifest/source file exists but no clear public card | Treat as implementation/internal/dev evidence, not a public promise. | Whether Steve wants the source publicly supported. |

## Setup-Type Status Matrix

| Setup Type | Current Public Count | Support Strength | Safe Promise | First Debug Check |
| --- | ---: | --- | --- | --- |
| `standard` | 100 | Setup-level for most sites, stronger only when a platform doc exists | Open the listed site/page with chat visible. | Confirm exact URL pattern, source injection, chat visibility, extension/app surface, and session. |
| `popout` | 23 | Strong setup requirement, feature coverage still varies | Use the platform popout/chat-only URL. | Confirm popout URL, stream/channel still live, source page reloaded after enabling SSN. |
| `toggle` | 9 | Strong privacy/setup requirement, fragile by site | Enable the SSN source toggle, then reload the site. | Confirm toggle setting, web version, channel/page path, and privacy boundary. |
| `websocket` | 4 | Source-page/API workflow, not DOM capture | Use the listed SSN source page and provide required token/API/channel data. | Confirm source-page status, auth/API URL, rate/permission errors, and whether read/write is supported. |
| `manual` | 3 | Manual/static workflow, not automatic live chat | Use the page's manual selection/push controls. | Confirm user clicked the SSN helper control and selected content. |

## Dedicated Heavy-Doc Sites

These sites have focused agent docs and should be routed there before answering detailed behavior:

| Site Or Family | First Doc | Main Status |
| --- | --- | --- |
| YouTube Live / YouTube API / YouTube Static Comments | `youtube.md` | Multiple modes; DOM, Studio, static comments, WebSocket/Data API, app OAuth. |
| TikTok Live | `tiktok.md` | Extension DOM plus app connector/signing modes. |
| Twitch | `twitch.md` | DOM popout plus WebSocket/EventSub/provider paths. |
| Kick.com | `kick.md` | DOM popout/chatroom plus bridge/OAuth/source-page paths. |
| Rumble | `rumble.md` | DOM popout plus read-only Live Stream API source. |
| Facebook Live | `facebook.md` | DOM capture plus managed Page Graph/API bridge. |
| Instagram Live / Instagram Post Comments | `instagram.md` | Live DOM, feed/post/comment capture, joined-event setting caveat. |
| Discord | `discord.md` | Toggle-required web Discord DOM capture, not a bot/API integration. |
| Communication/private sources | `communication-and-sensitive-sources.md` | ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Meet, Teams, Zoom, Webex, and Chime rendered page capture; privacy-sensitive and not assumed send-back capable. |
| Embedded chat widget sources | `embedded-chat-widget-sources.md` | CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit, and Online Church rendered widget/page capture with limited event support. |
| Live-commerce sources | `live-commerce-sources.md` | Amazon Live, eBay Live, and Whatnot live shopping capture; eBay/Whatnot can emit selected commerce metadata. |
| Webinar/event sources | `webinar-and-event-sources.md` | Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions, Wave Video, and WebinarGeek rendered chat/Q&A/sidebar capture. |
| Creator/live-cam sources | `creator-live-cam-sources.md` | Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, and Stripchat rendered room/chat capture with source-specific token/tip handling. |
| Popout/chat-only sources | `popout-chat-only-sources.md` | Beamstream, BoltPlus, Chzzk, FloatPlane, GoodGame, Mixcloud, Nimo, Odysee, Parti, Picarto, Piczel, RokFin, Rutube, SoopLive, and VK chat-only captures. |
| Event/community sources | `event-and-community-sources.md` | Arena Social, Buzzit, CI.ME, Gala, LinkedIn Events, LivePush, MegaphoneTV, QuickChannel, Slido, and TradingView rendered event/community capture. |
| Independent live platform sources | `independent-live-platform-sources.md` | BandLab, Bigo.tv, Bitchute, Blaze, Castr, Cherry TV, CloutHub, Cozy.tv, DLive, Estrim, FC2, Jaco.live, LFG.tv, Locals.com, and Loco.gg rendered live/chat capture. |
| Video/broadcast platform sources | `video-broadcast-platform-sources.md` | Mixlr, NicoVideo, NonOLive, OpenStreamingPlatform, Owncast, PeerTube, Restream.io Chat, Steam Broadcasts, Trovo, Truffle.vip, TwitCasting, Vimeo, YouNow, and Zap.stream rendered video/broadcast chat capture. |
| Community/membership web-app sources | `community-membership-webapp-sources.md` | Circle.so, MeetMe, NextCloud, Patreon, Roll20, Simps, Tellonym, Whop, Wix Live/widgets, and Workplace legacy routing rendered page capture. |
| Regional/emerging platform sources | `regional-and-emerging-platform-sources.md` | Bilibili DOM paths, Favorited, Kwai, Pilled, Portal, Pump.fun, Retake, Rooter, SharePlay, SoulBound, Stream.place, Substack, Tikfinity, uScreen, VK Live, and Xeenon rendered page/activity-feed capture. |
| Special-case platform/helper sources | `special-case-platform-and-helper-sources.md` | Joystick, Velora, VPZone, X live/static split, Vertical Pixel Zone, Vercel demo helper, and top-level YouTube helper-copy routing. |
| Generic/custom/external sources | `generic-and-custom-sources.md` | User-owned custom DOM, API, WebSocket, and overlay workflows. |

## Public Listing Oddities To Verify

Current public metadata has known oddities:

| Item | Why It Matters | Safe Handling |
| --- | --- | --- |
| `On24` and `ON24` both appear | Duplicate public entries can confuse lookup/counting. | Use the ON24 setup path, then verify manifest/source before details. |
| `Blaze` and `Blaze.stream` both appear | Duplicate naming can hide whether a user means the same site. | Ask for exact URL and use source/manifest for final routing. |
| `Pilled.net` is `standard` but instruction says pop out chat | Public setup type conflicts with setup text. | Tell users to follow the popout instruction and verify source behavior before deeper claims. |
| Sites with public "no popout" or "limited/paywall" notes | Public card may describe limits that are not obvious from type. | Preserve the caveat when answering; do not simplify to "fully supported." |
| WebSocket/API alternatives for standard sites | Some standard cards also mention source pages, such as Facebook or VPZone. | Ask which mode the user is using before troubleshooting. |

## What To Say By User Intent

| User Intent | Start With | Answer Boundary |
| --- | --- | --- |
| "Is site X supported?" | `supported-sites-lookup.md` | State public listing and setup type only. |
| "Which URL do I open?" | `supported-sites-lookup.md` plus `manifest-row-matrix.md` if exact | Give the public setup route; verify exact URL pattern if support-critical. |
| "Does site X support channel points/gifts/follows?" | `platform-capability-matrix.md` and platform doc | Usually depends on WebSocket/API/app mode. Do not infer from public listing. |
| "Can SSN send messages back to site X?" | `platform-capability-matrix.md`, `websocket-source-pages.md`, `communication-and-sensitive-sources.md`, `embedded-chat-widget-sources.md`, `live-commerce-sources.md`, `webinar-and-event-sources.md`, `creator-live-cam-sources.md`, `popout-chat-only-sources.md`, `event-and-community-sources.md`, `independent-live-platform-sources.md`, `video-broadcast-platform-sources.md`, `community-membership-webapp-sources.md`, `regional-and-emerging-platform-sources.md`, `special-case-platform-and-helper-sources.md`, and source code | Treat as unverified unless the platform send path is current and documented. |
| "It used to work and now it does not." | Platform doc, source file, manifest, support known issues | Assume third-party layout/API changes are possible. Gather exact URL/mode/version. |
| "Can the desktop app capture this site?" | `04-standalone-app-source-windows.md` plus platform doc | App support depends on Electron session, preload bridge, OAuth/login, and source mode. |
| "Can I add this site?" | `12-development/adding-a-source.md` | Public support requires source file, manifest, docs/site card, event contract, and testing. |

## First Debug Checklist

For any public site support question, check:

1. Public site card name and setup type in `supported-sites-lookup.md`.
2. Exact user URL, including popout/chat/static/source-page form.
3. Product surface: Chrome extension, standalone app, Firefox, Lite, hosted page, local/fork.
4. Source page visibility and whether browser/app throttling may apply.
5. Session ID match between source side, dock, overlay, API, or app source.
6. Manifest match row and loaded source file if the site fails to inject.
7. Platform-specific doc if one exists.
8. Whether the requested feature is plain chat, rich event, send-back, moderation, or custom automation.
9. Whether the site is private/sensitive and needs a toggle or privacy-safe support handling; use `communication-and-sensitive-sources.md` for grouped chat/meeting/assistant page sources.
10. Whether the user's evidence includes secrets that should be redacted.

## App And Browser Support Boundaries

When a site is publicly listed, do not assume app/browser parity.

| Surface | What A Public Site Listing Means | Extra Check |
| --- | --- | --- |
| Chrome/Chromium extension | Usually the strongest baseline for content-script DOM capture. | Extension enabled, page reloaded, correct source URL/mode. |
| Standalone app | The app may load the same source script but through Electron source windows and `window.ninjafy`. | App source mode, custom session, source injection path, OAuth/login, hidden window state. |
| Firefox XPI | Smaller surface and some Chromium-only behavior may be missing. | Reproduce in Chrome before diagnosing Chromium-only features. |
| Lite | Not full SSN. | Confirm the feature exists in Lite before answering. |
| Hosted overlay page | Not a capture source by itself. | Source side must still be running and connected to the same session. |
| External API client | Receives/controls only when API settings are enabled. | API toggles, session, channel, action name, page open/connected state. |

## Evidence Needed Before Marking A Site Broken

Collect:

- site/platform name and exact URL
- public setup type and whether user followed it
- extension/app version and browser/app surface
- screenshot or text of source page state with secrets redacted
- dock status and whether any messages arrive
- OBS/browser overlay test if display is the reported failure
- console errors or app logs where available
- whether another source/site works in the same session
- recent platform change evidence if many users report the same break

## Follow-Up Extraction Needs

- Runtime-validate the public-site-to-manifest-to-source table in `public-site-implementation-map.md`.
- Add per-site current health status from recent issues/support history.
- Mark each public site as DOM, popout, toggle, manual, WebSocket/API, app-tested, Firefox-tested, or unknown.
- Add exact send-chat and rich-event support only after source validation.
- Reconcile duplicate/conflicting public cards in `docs/js/sites.js`.
