# Platform Capability Matrix

Status: heavy synthesis pass from current agent platform docs, source inventory, manifest matrices, and reference pages on 2026-06-24.

Use this page when an agent needs to answer "does SSN support this platform feature?" quickly. This is a routing matrix, not the final line-level source of truth. Before making a public or support-critical promise, check the linked platform doc and the current source.

## Source Anchors

- `docs/agents/08-platform-sources/youtube.md`
- `docs/agents/08-platform-sources/tiktok.md`
- `docs/agents/08-platform-sources/tiktok-standalone-app.md`
- `docs/agents/08-platform-sources/twitch.md`
- `docs/agents/08-platform-sources/kick.md`
- `docs/agents/08-platform-sources/rumble.md`
- `docs/agents/08-platform-sources/facebook.md`
- `docs/agents/08-platform-sources/instagram.md`
- `docs/agents/08-platform-sources/discord.md`
- `docs/agents/08-platform-sources/generic-and-custom-sources.md`
- `docs/agents/08-platform-sources/manual-static-and-helper-sources.md`
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
- `docs/agents/08-platform-sources/source-inventory.md`
- `docs/agents/08-platform-sources/supported-sites-lookup.md`
- `docs/agents/08-platform-sources/manifest-content-scripts.md`
- `docs/agents/08-platform-sources/manifest-row-matrix.md`
- `docs/agents/13-reference/feature-support-decision-matrix.md`
- `docs/agents/13-reference/modes-and-capability-matrix.md`
- `docs/event-reference.html`

## Legend

| Term | Meaning |
| --- | --- |
| DOM | Content script reads the rendered page or chat popout. |
| WebSocket/API | SSN source page or provider talks to a platform socket/API. |
| Static/manual | User selects posts/comments or opens a non-live capture page; use `manual-static-and-helper-sources.md` for helper-script routing. |
| Communication/private | Content script reads a user-enabled work chat, meeting chat, messaging app, or assistant page; use `communication-and-sensitive-sources.md`. |
| Embedded widget | Content script reads a rendered embedded chat widget or IRC web client; use `embedded-chat-widget-sources.md`. |
| Live commerce | Content script reads live shopping chat and selected auction/product/viewer state; use `live-commerce-sources.md`. |
| Webinar/event | Content script reads rendered webinar/event chat, Q&A, or sidebar rows; use `webinar-and-event-sources.md`. |
| Creator/live-cam | Content script reads rendered room/chat rows from supported creator live sites; use `creator-live-cam-sources.md`. |
| Popout/chat-only | Content script reads a dedicated chat-only URL; use `popout-chat-only-sources.md`. |
| Event/community | Content script reads rendered event/community chat, comment, UGC, or Q&A rows; use `event-and-community-sources.md`. |
| Independent live platform | Content script reads rendered chat rows from smaller independent live/video/community platforms; use `independent-live-platform-sources.md`. |
| Video/broadcast platform | Content script reads rendered chat rows from video, audio, broadcast, or chat-only pages; use `video-broadcast-platform-sources.md`. |
| Community/membership web-app | Content script reads rendered community, membership, workspace, game-table, or web-app message rows; use `community-membership-webapp-sources.md`. |
| Regional/emerging platform | Content script reads rendered chat/activity rows from smaller regional, emerging, app-specific, or newly added sites; use `regional-and-emerging-platform-sources.md`. |
| Special-case platform/helper | Source routing where rendered-site capture, source-page/API mode, and helper copies overlap; use `special-case-platform-and-helper-sources.md`. |
| Depends | Supported only in some modes, auth states, account roles, or page layouts. |
| Do not promise | The feature may exist in code or support history, but needs current source verification before giving a firm answer. |

## High-Value Platform Matrix

| Platform | Main Capture Modes | Rich Events | Send Chat Back | Standalone App Notes | First Support Check |
| --- | --- | --- | --- | --- | --- |
| YouTube | DOM live chat/popout, Studio live chat, watch/video shortcut, static comments, WebSocket/Data API source | Depends. DOM sees rendered cards; WebSocket/Data API exposes broader membership, donation, subscriber, viewer, delete, and ban-style events. Redirect banners are DOM-only in current notes. | Depends on mode, auth, permissions, and source-control path. Do not promise without checking `youtube.md` and source-control handling. | App OAuth uses loopback auth and bridge behavior; source pages may relay through `window.ninjafy`. | Ask DOM vs WebSocket/API, exact URL, whether stream is live, and whether chat stalled after working. |
| TikTok | Extension DOM capture, standalone app connector/signing, WebSocket/legacy connector paths | Depends. App mode is broader than DOM and includes extra events such as questions/emotes/viewer updates in current notes. DOM handles chat, gifts, joins, follows, likes, and social rows when rendered. | Depends. Direct chat sends need suitable TikTok auth/session context; reading can work while replies fail. | App has the widest TikTok mode selection and dedicated connection/signing code; route app details through `tiktok-standalone-app.md`. | Confirm app vs extension, live status, username, WebSocket vs legacy/polling, signing provider, account sign-in, reply expectation, and current app version. |
| Twitch | DOM popout/page capture, WebSocket/EventSub source, IRC/tmi.js provider path | Strongest in WebSocket/EventSub. Follows, raids, channel points, subs, gifts, cheers, deletes, bans, and viewer-like events are mode/permission dependent. | Depends. WebSocket/provider send uses connected chat client/auth/channel; moderation actions require scopes and role. | App OAuth uses loopback flow; browser login alone may not satisfy app source auth. | Ask whether they need only visible chat or EventSub features, and verify OAuth scopes/role for rewards/moderation. |
| Kick | DOM chatroom/popout capture, WebSocket bridge/source, app OAuth/helper | Strongest in bridge mode. Rewards, subs, gifted subs, follows, raids, KICKs/tips, and moderation events are bridge/auth dependent. | Depends. Bridge path can support chat sending when OAuth token/scopes are valid; DOM capture alone is not the reliable send path. | App OAuth can open external or local auth; Kick verification/CAPTCHA can affect app and browser differently. | Prefer `https://kick.com/popout/CHANNEL/chat`; check OAuth token, scopes, CAPTCHA, and bridge status. |
| Rumble | Normal DOM page capture, Rumble Live Stream API bridge | API bridge supports structured chat, donations/rants, followers, subscribers, gifted subs, viewer/status events, and SSE/polling behavior. DOM sees visible chat/raids/rants when rendered. | No for documented API bridge. The Rumble Live Stream API bridge is read-only in current notes. | App parity needs current source check before promising. | Ask whether they use the private Live Stream API URL or normal page capture; keep API URL private. |
| Facebook | DOM capture on Facebook/Workplace pages, managed Page Graph API bridge | Depends. API bridge handles managed Page live comments/viewer data where Graph permissions allow; DOM can see visible comments and Stars rows. | Depends. Graph/API behavior, Page role, token scopes, and current source need verification. | App Facebook OAuth details still need line-level extraction. | Ask viewer vs page owner/publisher, Page role, live video ID, token age, and DOM vs API bridge. |
| Instagram | Instagram Live DOM capture, feed/post/comment capture, older Instafeed capture | Limited/depends. Live DOM can mark joins when enabled and visible; feed/post capture is page/comment oriented. | Do not promise. Current notes describe DOM readers, not a separate OAuth/API send bridge. | App parity needs current source check before promising. | Ask live vs feed/post, whether the page is visible/logged in, and whether `capturejoinedevent` is enabled for joins. |
| Discord | Web Discord DOM content script with source toggle/settings | Limited. Captures visible web Discord messages and some media/sticker/image content. This is not a Discord API integration. | Do not promise. Treat as capture-only unless source says otherwise. | App parity needs current source check before promising. | Confirm Discord source toggle, exact web URL/channel, login/page access, and channel filter settings. |
| Communication/private sources | ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Google Meet, Microsoft Teams, Zoom, Webex, Amazon Chime rendered page capture | Limited/depends. Captures visible rendered messages; Zoom also has inspected Q&A, poll, and reaction paths. This is not bot/API access. | Do not promise. Inspected scripts expose `focusChat` but no source-level `SEND_MESSAGE` handler. | App parity needs current source-window and embedded-login validation before promising. | Confirm web version, source toggle where required, page reload, visible chat/meeting panel, and privacy redaction. |
| Live commerce sources | Amazon Live, eBay Live, Whatnot | Depends. Amazon is mostly rendered chat; eBay can emit viewer, reaction, auction, commerce, and follower events; Whatnot can emit DOM and WebSocket-derived chat/tip/raid/loyalty/product/giveaway/viewer events. | Do not promise. Inspected scripts expose `focusChat`, but no source-level `SEND_MESSAGE` handler. | Whatnot app parity depends on `window.ninjafy.onWebSocketMessage`; needs Electron validation. | Ask whether the user expects chat, viewer counts, auction/product metadata, WebSocket events, or product-list display. |
| Webinar/event sources | Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions, Wave Video, WebinarGeek | Limited/depends. Mostly rendered chat; ON24 has Q&A with `question: true`; Wave Video can emit the upstream platform type. | Do not promise. Most inspected scripts expose `focusChat`, but no source-level `SEND_MESSAGE`; Wave Video lacks `getSource`/`focusChat` in inspected source. | App parity needs source-window validation. | Confirm exact event URL, chat/Q&A/sidebar panel visibility, and whether the user expects analytics rather than chat. |
| Creator/live-cam sources | Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, Stripchat | Limited/depends. Mostly rendered chat, with source-specific token/tip capture; Chaturbate can capture notices and private-message rows. | Do not promise. Inspected scripts expose `focusChat`, but no source-level `SEND_MESSAGE` handler. | App parity needs source-window validation; generated selectors and hidden-tab behavior are fragile. | Confirm exact room/chat URL, visible chat panel, new-message test, and whether the user expects token/tip rows, private messages, viewer counts, or send-back. |
| Popout/chat-only sources | Beamstream, BoltPlus, Chzzk, FloatPlane, GoodGame, Mixcloud, Nimo, Odysee, Parti, Picarto, Piczel, RokFin, Rutube, SoopLive, VK chat paths | Limited/depends. Mostly rendered chat; Chzzk/Parti/RokFin/Mixcloud/VK have selected donation or viewer-count paths. | Do not promise. Inspected scripts expose `focusChat`, but no source-level `SEND_MESSAGE` handler. | App parity needs source-window validation; exact URL shape is often the main compatibility boundary. | Confirm exact popout/chat-only URL, loaded chat list, new-message test, and whether the user expects donations, viewer counts, or send-back. |
| Event/community sources | Arena Social, Buzzit, CI.ME, Gala, LinkedIn Events, LivePush, MegaphoneTV, QuickChannel, Slido, TradingView | Limited/depends. Mostly rendered chat/comment rows; Slido has Q&A with `question: true`; Arena Social and CI.ME can emit `viewer_update`; CI.ME can emit donation rows; LivePush can relay upstream type. | Do not promise. Inspected scripts expose `focusChat`, but no source-level `SEND_MESSAGE` handler. | App parity needs source-window validation; broad manifest rows such as LinkedIn/CI.ME need path checks. | Confirm exact URL, visible chat/comment/UGC/Q&A panel, new-message test, and whether the user expects viewer counts, donations, upstream type, or send-back. |
| Independent live platform sources | BandLab, Bigo.tv, Bitchute, Blaze, Castr, Cherry TV, CloutHub, Cozy.tv, DLive, Estrim, FC2, Jaco.live, LFG.tv, Locals.com, Loco.gg | Limited/depends. Mostly rendered chat; Blaze/LFG/Locals have selected viewer/tip/reply paths; Cherry TV forwards joined rows but only logs several gift/VIP detections in this pass. | Do not promise. Inspected scripts expose `focusChat`, but no source-level `SEND_MESSAGE` handler. | App parity needs source-window validation; DLive public site-card routing needs reconciliation. | Confirm exact URL, visible chat panel, new-message test, and whether the user expects viewer counts, tips/donations, replies, joins, stickers/images, or send-back. |
| Video/broadcast platform sources | Mixlr, NicoVideo, NonOLive, OpenStreamingPlatform, Owncast, PeerTube, Restream.io Chat, Steam Broadcasts, Trovo, Truffle.vip, TwitCasting, Vimeo, YouNow, Zap.stream | Limited/depends. Mostly rendered chat; Vimeo can mark Q&A rows; Truffle can relay upstream platform type; Restream can include source icons; Owncast/Trovo/YouNow can capture badges. | Do not promise. Inspected scripts expose `focusChat`, but no source-level `SEND_MESSAGE` handler. | App parity needs source-window validation; Trovo and OpenStreamingPlatform public site-card routing need reconciliation. | Confirm exact URL/chat-room shape, visible chat panel, new-message test, and whether the user expects Q&A, upstream identity, badges, login-gated chat, or send-back. |
| Community/membership web-app sources | Circle.so, MeetMe, NextCloud, Patreon, Roll20, Simps, Tellonym, Whop, Wix Live/widgets, Workplace legacy routing | Limited/depends. Mostly rendered member/community chat; Patreon/Simps/Whop can emit `viewer_update`; Circle/Patreon/Wix can carry image content; Tellonym is message-only; Workplace current routing starts in `facebook.md`. | Do not promise. Inspected scripts expose `focusChat`, but no source-level `SEND_MESSAGE` handler. | App parity needs source-window validation; member/paywall/workspace/game pages are privacy-sensitive. | Confirm exact URL, login/access/toggle state, visible panel, new-message test, and whether the user expects viewer counts, images, identity fields, or send-back. |
| Regional/emerging platform sources | Bilibili DOM paths, Favorited, Kwai, Pilled, Portal, Pump.fun, Retake, Rooter, SharePlay, SoulBound, Stream.place, Substack, Tikfinity, uScreen, VK Live, Xeenon | Limited/depends. Mostly rendered chat/activity rows; Kwai/SharePlay/SoulBound/Stream.place/Substack have active or gated viewer paths; Tikfinity emits TikTok-style feed events; SharePlay has shoutout/raid paths. | Do not promise. Inspected scripts are capture-oriented; Tikfinity explicitly returns false for `getSource` and `focusChat`; no source-level `SEND_MESSAGE` handler was verified. | App parity needs source-window validation; several sources use generated selectors, special URL forms, or keepalive/visibility workarounds. | Confirm exact URL form, visible chat/activity panel, new-row test, and whether the user expects viewer counts, tips/gifts, joins, raids/shoutouts, relayed source identity, or send-back. |
| Special-case platform/helper sources | Joystick DOM, Velora DOM, VPZone rendered/WS-intercepted site capture, X live chat, Vertical Pixel Zone, Vercel demo helper, top-level YouTube helper copies | Depends. Joystick/Velora/VPZone rendered-site scripts capture visible chat/activity; source-page/API modes are separate. X live can emit viewer updates; YouTube helper copies are not current manifest-loaded live routes. | Depends by mode. Rendered-site scripts do not have verified source-level `SEND_MESSAGE`; Joystick/Velora/VPZone source-page/API paths have separate send-back notes in `websocket-source-pages.md`. | App parity needs source-window/source-page validation; Vercel helper exposes session ID after user approval; Vertical Pixel Zone has a payload/source identity caveat. | First ask rendered site vs source page/API vs static/manual helper. Then confirm exact URL, source identity, and whether the user expects send-back. |
| Generic/custom | Generic DOM capture, local `custom.js`, uploaded custom user function, custom external WebSocket/API source | User-owned. Generic DOM has generic message fields; custom sources can send any SSN-shaped payload they build. | Depends on custom implementation and `sendCustomReply` or source-control path. | App/source compatibility depends on where the custom code runs. | Ask whether it is a DOM site, custom overlay, custom source, API client, or user function. |

## Event Family Matrix

| Event Or Capability | Best Platform Paths | Notes |
| --- | --- | --- |
| Plain visible chat | DOM capture for most supported sites; app source windows for app users | Confirm the source page is open, live, visible enough to render chat, and extension/app capture is active. |
| Badges, avatars, emotes | DOM for rendered details; WebSocket/API where provider normalizes them | DOM and API may expose different badge/emote sets. Do not assume parity. |
| Donations, tips, paid messages | YouTube DOM/API, Twitch bits/cheers, Kick bridge, Rumble API/DOM rants, Facebook Stars DOM | Use `hasDonation` plus platform event names. Exact field names vary. |
| Memberships/subs/gift subs | YouTube DOM/API, Twitch EventSub/provider, Kick bridge, Rumble API | Platform event names differ. YouTube gifts are `giftpurchase`/`giftredemption`; Twitch/Kick/Rumble may use `subscription_gift`. |
| Follows/raids | Twitch EventSub/provider, Kick bridge, Rumble API; TikTok DOM/app has follows/social rows | Usually not a plain DOM-chat guarantee. Check mode and account permissions. |
| Channel points/rewards | Twitch EventSub/provider, Kick bridge/Event Flow path | Requires correct source mode and auth. DOM may see visible text but is not the reliable structured route. |
| Viewer counts/status | YouTube API/viewer polling, Rumble API bridge, Facebook Graph/API where available, some DOM paths | Viewer counts are platform-limited and can be delayed, missing, or approximate. |
| Deletes, bans, moderation events | YouTube API/source-control paths, Twitch EventSub/provider, Kick bridge | Role/scopes matter. DOM capture may only infer deletes when visible. |
| Sending chat back | Twitch provider, Kick bridge, TikTok app paths, possible YouTube source-control paths, custom source paths | Always verify per platform and mode. Chat reading support does not imply send-back support. |
| Static comments/posts | YouTube static/comments, Instagram feed/post, X/Twitter-style static helpers, Threads/static helpers | Not the same as live chat. Often manual or page-selection oriented. |
| Private/direct messages | Communication/private source scripts where explicitly supported by rendered web page capture | Treat as opt-in, privacy-sensitive, and capture-only unless current source-control code proves send-back. |

## Setup-Type Matrix

| Setup Type | Common Platforms Or Files | What It Is Good For | First Failure Check |
| --- | --- | --- | --- |
| Standard DOM page | Many `sources/*.js` entries | Quick capture from normal browser pages where chat is rendered | Extension enabled, correct source toggle, page reloaded, chat visible |
| Popout chat | YouTube, Twitch, Kick and similar chat pages | More stable chat-only capture and less page noise | Correct popout URL and stream/channel still live |
| Toggle-required sensitive capture | Discord, Slack, Telegram, WhatsApp, Meet, ChatGPT/OpenAI-style pages | User-selected capture from private/sensitive sites | Required menu/source toggle enabled and exact page/channel allowed; route grouped private source behavior to `communication-and-sensitive-sources.md` |
| Communication/meeting DOM capture | ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Meet, Teams, Zoom, Webex, Chime | Work-chat, meeting-chat, messaging, and assistant page capture when the user has access and opts in where required | Web version, visible chat/meeting panel, page reload after enabling, and privacy-safe support evidence |
| Embedded widget/IRC capture | CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit, Online Church | Smaller rendered chat widgets and IRC web clients | Exact widget URL, iframe/all-frame behavior, new rendered messages, and source-specific event limits |
| Live-commerce capture | Amazon Live, eBay Live, Whatnot | Live shopping chat and selected commerce/auction/product metadata | Exact live-commerce URL, chat panel visibility, product/auction DOM state, WebSocket interceptor state for Whatnot, and separate product-list overlay routing |
| Webinar/event capture | Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions, Wave Video, WebinarGeek | Event/webinar chat, Q&A, and sidebar capture | Exact event URL, visible chat/Q&A/sidebar, no assumed analytics/registrations/polls, and source-specific caveats |
| Creator/live-cam capture | Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, Stripchat | Room/chat capture with selected token/tip/private-message paths | Exact room/chat URL, visible chat panel, new rendered message, privacy redaction, no assumed viewer counts or send-back |
| Popout/chat-only capture | Beamstream, BoltPlus, Chzzk, FloatPlane, GoodGame, Mixcloud, Nimo, Odysee, Parti, Picarto, Piczel, RokFin, Rutube, SoopLive, VK chat paths | Smaller platform chat capture through exact chat-only URLs | Exact popout/chat-only URL, loaded chat list, new rendered message, and source-specific rich-event caveats |
| Event/community capture | Arena Social, Buzzit, CI.ME, Gala, LinkedIn Events, LivePush, MegaphoneTV, QuickChannel, Slido, TradingView | Event/community chat, comments, UGC, and Q&A rows | Exact event/community URL, visible panel, new rendered row, and source-specific extras |
| Independent live platform capture | BandLab, Bigo.tv, Bitchute, Blaze, Castr, Cherry TV, CloutHub, Cozy.tv, DLive, Estrim, FC2, Jaco.live, LFG.tv, Locals.com, Loco.gg | Smaller independent live/video/community platform chat capture | Exact page/chat URL, visible chat panel, new rendered row, and source-specific viewer/tip/reply/join/image caveats |
| Video/broadcast platform capture | Mixlr, NicoVideo, NonOLive, OpenStreamingPlatform, Owncast, PeerTube, Restream.io Chat, Steam Broadcasts, Trovo, Truffle.vip, TwitCasting, Vimeo, YouNow, Zap.stream | Smaller video/audio/broadcast platform chat capture | Exact page/chat-room URL, visible chat panel, new rendered row, and source-specific Q&A/upstream-type/source-icon/login caveats |
| Community/membership web-app capture | Circle.so, MeetMe, NextCloud, Patreon, Roll20, Simps, Tellonym, Whop, Wix Live/widgets, Workplace legacy routing | Member/community/workspace/game/app chat and message rows | Exact URL, login/membership/workspace access, visible panel, new rendered row, source toggle where required, and privacy redaction |
| Regional/emerging platform capture | Bilibili DOM paths, Favorited, Kwai, Pilled, Portal, Pump.fun, Retake, Rooter, SharePlay, SoulBound, Stream.place, Substack, Tikfinity, uScreen, VK Live, Xeenon | Smaller regional, emerging, app-specific, or newly added rendered-page/activity-feed captures | Exact URL form, visible chat/activity panel, new rendered row, source-specific viewer/tip/raid/join caveats, and privacy redaction |
| Special-case platform/helper capture | Joystick, Velora, VPZone, X live/static split, Vertical Pixel Zone, Vercel demo helper, top-level YouTube helper copies | Separating rendered-site capture, source-page/API capture, static/manual helpers, and unmanifested helper copies | Exact mode, URL, source identity, helper load path, and whether send-back belongs to source-page/API rather than DOM capture |
| Static/manual capture | Comment/post helpers and static source files | Pulling comments/posts that are not live chat | User selected the target content and the helper supports the current layout; route helper-script details to `manual-static-and-helper-sources.md` |
| WebSocket/API source page | YouTube, Twitch, Kick, Rumble, Facebook, Bilibili, IRC, Joystick, Nostr, Social Stream Chat, StageTEN, Streamlabs, Velora, VPZone | Richer events, lower DOM fragility, API/socket behavior | Auth/token/scopes/API URL, source page status, platform rate/permission errors; route grouped source-page details to `websocket-source-pages.md` |
| Injected helper | `sources/inject/*` and page-context helpers | Access to page-level data that content scripts cannot directly see | Page context changed, permission blocked, helper loaded too early/late; verify the paired content script consumer |
| External custom source | `sample_wss_source.html`, API clients, user bots/apps | Private systems, bots, non-browser data, custom payloads | API/server toggles, session ID, channel, payload shape, reconnect logic |

## Platform-Specific Support Routes

### YouTube

Start with `youtube.md`.

- DOM/live chat is best for normal visible chat and rendered YouTube cards.
- WebSocket/Data API is the richer route for broader events and API-backed behavior.
- YouTube subscriber alerts can be delayed and limited to public subscriptions.
- Reloading the live chat popout is a source-backed workaround for stale DOM chat.
- Verify before promising send/delete/ban/moderation behavior.

### TikTok

Start with `tiktok.md`. For standalone app connector modes, signing providers, fallback states, replies, and tests, use `tiktok-standalone-app.md`.

- Extension DOM mode is page-rendered capture.
- Standalone app mode adds connector, signing, and WebSocket/legacy options.
- Reading chat and sending replies have different auth/session requirements.
- Gift duplicates, reconnects, sign-server issues, and "not live" status are recurring support areas.
- Verify exact event mapping for app WebSocket mode before final payload claims.

### Twitch

Start with `twitch.md`.

- DOM mode is fine for visible chat, badges, emotes, and some rendered system cards.
- WebSocket/EventSub/provider mode is the normal route for follows, raids, rewards, reliable subs, deletes, bans, and richer events.
- Chat sending depends on a connected chat client, channel, OAuth, and role/scopes.
- Channel point redemptions require broadcaster-level access and redemption scope.

### Kick

Start with `kick.md`.

- Prefer the current popout format for DOM chat: `https://kick.com/popout/CHANNEL/chat`.
- Structured rewards, follows, subs, raids, KICKs/tips, moderation, and chat sending belong to the bridge/OAuth path.
- Kick OAuth can be affected by CAPTCHA/human verification and app loopback behavior.
- `kick.js` vs `kick_new.js` runtime loading still needs intense validation.

### Rumble

Start with `rumble.md`.

- The Rumble Live Stream API bridge is the structured route and currently documented as read-only.
- The private API URL includes sensitive stream credentials; do not paste it into public logs.
- DOM capture can see visible chat/raids/rants but is more layout dependent.
- SSE fallback, replay, and dedupe behavior need line-level validation for exact troubleshooting.

### Facebook

Start with `facebook.md`.

- DOM capture is useful for visible comments and Stars when rendered.
- Graph API bridge is for managed Page live videos and depends on Page role, token, permissions, and live video state.
- Viewer mode vs page owner/publisher mode is a key support distinction.
- App OAuth and current Graph permission names need line-level refresh before publishing exact setup promises.

### Instagram

Start with `instagram.md`.

- Confirm whether the user means live chat, feed comments, or post comments.
- Current docs describe DOM readers, not a headless/API bridge.
- Join events require both visible rows and `capturejoinedevent`.
- Avoid promising send-back or full API-style event coverage.

### Discord

Start with `discord.md`.

- This is web Discord DOM capture, not a Discord bot/API integration.
- It should be treated as sensitive/private page capture with explicit source toggle/settings.
- Channel filters can block capture if the URL path does not match.
- Avoid promising roles, moderation, direct messages, or send-back unless source-verified.

### Communication And Sensitive Sources

Start with `communication-and-sensitive-sources.md`.

- These are rendered web-page captures for ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Google Meet, Teams, Zoom, Webex, and Chime.
- Slack, Telegram, WhatsApp, Meet, ChatGPT/OpenAI, and similar sources should be treated as opt-in/private captures.
- Teams and Chime have generated opt-in setting keys even though the public cards are standard; source-check current popup behavior before saying a toggle cannot matter.
- Zoom can emit chat, Q&A, poll, and reaction payloads in the inspected source.
- Do not promise send-back. The inspected scripts expose `focusChat`, but no source-level `SEND_MESSAGE` handler was found in this pass.

### Live Commerce Sources

Start with `live-commerce-sources.md`.

- Amazon Live is mostly rendered chat capture in the inspected source.
- eBay Live can emit `viewer_update`, `reaction`, `auction_update`, `commerce_update`, and `follower_update` events when page data is available.
- Whatnot combines rendered DOM capture with `whatnot-ws.js` WebSocket frame interception for chat, tips, raids, loyalty, viewer counts, products, giveaways, and livestream updates.
- Product-list display with `shop_the_stream.html` is a separate display/API path, not automatic proof that a live-commerce source is feeding it.
- Do not promise send-back without source-control validation.

### Webinar And Event Sources

Start with `webinar-and-event-sources.md`.

- Crowdcast, Livestorm, Livestream.com, Sessions, Riverside, and WebinarGeek are mostly rendered chat capture.
- ON24 also captures Q&A rows with `question: true`.
- Wave Video can emit the original upstream platform type based on the social icon rather than always using `wavevideo`.
- Riverside can be disabled through `customriversidestate`; check settings before calling capture broken.
- Do not promise attendee lists, registrations, poll analytics, webinar analytics, or send-back from these source scripts.

### Creator Live-Cam Sources

Start with `creator-live-cam-sources.md`.

- Bongacams, CAM4, Camsoda, Fansly, MyFreeCams, and Stripchat are mostly rendered room/chat capture with site-specific token/tip parsing.
- Chaturbate also captures room notices and private-message rows in the inspected source.
- Many scripts intentionally skip existing history and capture only new rows after the source is connected.
- Support evidence can include private room/chat context, so ask for redaction before sharing screenshots or logs.
- Do not promise viewer counts, full token/tip parity, private-message parity, or send-back without current source/live validation.

### Popout And Chat-Only Sources

Start with `popout-chat-only-sources.md`.

- Beamstream, BoltPlus, Chzzk, FloatPlane, GoodGame, Mixcloud, Nimo, Odysee, Parti, Picarto, Piczel, RokFin, Rutube, SoopLive, and VK chat paths usually need the exact chat-only URL.
- Wrong URL shape is the first thing to check before selector debugging.
- Chzzk, Parti, RokFin, Mixcloud, and VK Video have selected donation, tip, subscription, or viewer-count behavior; do not generalize that across the group.
- Current VK chat-only manifest rows use `vkvideo.js`; `vkplay.js` is an older/unreferenced parser in this pass.
- Do not promise send-back from these DOM popout parsers.

### Event And Community Sources

Start with `event-and-community-sources.md`.

- Arena Social, Buzzit, Gala, QuickChannel, and TradingView are mostly rendered chat/comment capture.
- Slido is Q&A-oriented and can set `question: true`.
- Arena Social and CI.ME can emit `viewer_update` only when relevant settings and page data are available.
- LivePush can emit the upstream platform type (`twitch`, `youtube`, `facebook`) instead of always `livepush`.
- MegaphoneTV payload type and `getSource` response differ in inspected source; check source identity carefully.
- Do not promise full event analytics, attendance, moderation, or send-back.

### Independent Live Platform Sources

Start with `independent-live-platform-sources.md`.

- BandLab, Bigo.tv, Bitchute, Castr, Estrim, FC2, Jaco.live, and Loco.gg are mostly rendered chat capture.
- Blaze, LFG.tv, and Locals.com have selected viewer/tip/donation/reply paths.
- Cherry TV forwards normal chat and joined rows; gifts, Lovense/vibrator rows, and VIP rows were detected/logged but not forwarded in this pass.
- CloutHub has a source identity spelling caveat: payload `type` is `clouthub`, while `getSource` responds `cloudhub`.
- DLive has a source file and manifest row, but public site-card routing needs reconciliation before a public listing promise.
- Do not promise send-back, complete gift/tip parity, complete viewer-count parity, or app parity without validation.

### Video Broadcast Platform Sources

Start with `video-broadcast-platform-sources.md`.

- Mixlr, NicoVideo, NonOLive, OpenStreamingPlatform, Owncast, PeerTube, Steam, TwitCasting, YouNow, and Zap.stream are mostly rendered chat capture.
- Vimeo can capture chat and Q&A/sidebar rows with `question: true`.
- Truffle can emit `type: "twitch"` or `type: "youtube"` based on source icons; Restream keeps `type: "restream"` and can include `sourceImg`.
- PeerTube and Mixlr can be blocked by login/access/paywall state.
- Trovo and OpenStreamingPlatform have manifest/source evidence but need public site-card routing reconciliation.
- Do not promise send-back, platform API behavior, full event analytics, or app parity without validation.

### Community Membership Web-App Sources

Start with `community-membership-webapp-sources.md`.

- These are rendered-page captures for member/community/workspace/game/web-app pages, not official bot/API integrations.
- Patreon requires its source toggle and a reload.
- Patreon, Simps, and Whop can emit `viewer_update` when settings and page counts allow it.
- Circle and Patreon can forward content images; Wix can carry inline images; Tellonym is message-only in this pass.
- Current Workplace URL handling routes through Facebook/Workplace DOM capture; `sources/workplace.js` is legacy/unreferenced in this pass.
- Do not promise send-back, broad NextCloud domain support, or app parity without validation.

### Regional And Emerging Platform Sources

Start with `regional-and-emerging-platform-sources.md`.

- These are rendered-page or activity-feed captures for smaller regional, emerging, app-specific, or newly added platforms.
- Exact URL form matters: Bilibili.tv and Bilibili.com use different source files, Pilled needs `/comment/`, Substack needs live-stream URLs, Tikfinity needs the activity-feed widget path, and Rooter expects `/stream/`.
- Kwai, SharePlay, SoulBound, Stream.place, and Substack have source-backed viewer-update paths gated by settings and page data.
- SharePlay has source-backed shoutout and Blitz/raid paths; Tikfinity emits TikTok-style events from its feed payloads.
- Portal, Pump.fun, Retake, and Xeenon contain viewer helper code, but the active inspected path does not prove viewer-count emission.
- Do not promise send-back, app parity, broad URL support, or full tip/gift/raid parity without validation.

### Special-Case Platform And Helper Sources

Start with `special-case-platform-and-helper-sources.md`.

- Joystick, Velora, and VPZone have rendered-site scripts and separate WebSocket/API source pages. Ask which mode the user is using before answering send-back or auth questions.
- X live/broadcast chat uses `sources/x.js`; X static/manual post capture uses `sources/static/x.js`.
- The X `detweet` setting changes source identity from `x` to `twitter`.
- `sources/youtube_comments.js` and top-level `sources/youtube_static.js` are not current manifest-loaded live chat routes; normal YouTube live chat starts with `youtube.md`.
- Vertical Pixel Zone has an inspected source identity caveat: `getSource` returns `verticalpixelzone`, but payloads use `type: "arena"`.
- Vercel Demo is a session-ID helper, not a chat source.

### Generic And Custom

Start with `generic-and-custom-sources.md`.

- Use generic DOM capture for proof-of-concept capture on ordinary message pages.
- Use custom WebSocket/API sources when the user owns a cleaner data source.
- Use custom overlays/API clients for rendering or automation that SSN does not provide as a built-in page.
- The user or fork owner is responsible for custom source payload quality and maintenance.

### Other WebSocket/API Source Pages

Start with `websocket-source-pages.md`.

- Bilibili and IRC have source-page bridges with inspected send paths.
- Joystick, Velora, and VPZone have auth/token/source-page workflows with inspected send paths.
- Nostr is read-only in the inspected bridge.
- Streamlabs is alert/event ingestion through a socket token, not platform chat send-back.
- Social Stream Chat and StageTEN have local page send functions, but extension/API send-back needs source-checking before promising it.
- YouTube, Twitch, Kick, Rumble, and Facebook WebSocket/API pages remain routed to their dedicated platform docs.

## Answer Routing Patterns

### If Asked "Does Platform X Support Event Y?"

Use this order:

1. Check the platform row above for the likely mode.
2. Check the platform doc for the event family and known limitations.
3. Check `docs/event-reference.html` for canonical event names and payload fields.
4. If support depends on auth/API/source mode, answer "depends" and name the mode.

Good answer shape:

```text
It depends on the capture mode. For [platform], [event] is handled through [WebSocket/API/bridge/DOM] rather than normal chat capture. Start with [specific setup], then verify [auth/scope/page URL/source status].
```

### If Asked "Can SSN Send Chat Back?"

Use this answer shape unless the exact source has been verified:

```text
Maybe, but it is platform- and mode-specific. SSN receiving chat from a platform does not automatically mean it can send chat back. Check the platform source mode, login/auth, account role, and the source-control/send path before promising it.
```

### If Asked "Why Does App Behave Differently From The Extension?"

Use this answer shape:

```text
The extension runs in the user's browser session, while the standalone app runs managed source windows and Electron bridges. Login cookies, OAuth loopback, popups, CAPTCHA, browser throttling, and bridge routing can differ by platform.
```

## High-Risk Claims

Verify these before public/support answers:

- Exact send-chat support for a platform.
- Exact moderation commands for a platform.
- Exact event names and payload fields for a platform.
- App parity with extension behavior.
- Firefox or Lite parity with Chrome extension behavior.
- Whether a source works while hidden, minimized, or backgrounded.
- Whether a third-party platform API remains available or free.
- Whether a private API URL/token can be safely shared. It usually cannot.

## Follow-Up Extraction Needs

- Intense pass for send-chat support by platform and mode.
- Intense pass for source-control command handling by YouTube, Twitch, Kick, and TikTok app paths.
- Intense pass for event payload fields by platform against `docs/event-reference.html` and source code.
- Current app parity check against `ssapp` source-window definitions and OAuth handlers.
- Source-validated public support status for sensitive/toggle-required capture sites.
- Live/browser validation for static/manual helper source behavior and injected WebSocket consumers.
- Line-level/live validation for grouped WebSocket/API source pages: send-back, auth, app bridge parity, token refresh, CORS, reconnects, and payload samples.
