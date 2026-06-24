# Platform Sources Index

Status: framework plus heavy passes for source inventory, supported-site lookup, public site support status, public site implementation map, public-card metadata validation, source-file processing matrix, full manifest row matrix, manifest content-script matrix, platform capability matrix, YouTube, TikTok, TikTok standalone app connector, Twitch, Kick, Rumble, Facebook, Instagram, Discord, generic/custom sources, manual/static/helper source scripts, WebSocket/API source pages, communication/sensitive source scripts, embedded chat widget sources, live-commerce sources, webinar/event sources, creator/live-cam source scripts, popout/chat-only source scripts, event/community source scripts, independent live platform source scripts, video-broadcast platform source scripts, community/membership web-app source scripts, regional/emerging platform source scripts, and special-case platform/helper source scripts.

## Purpose

This section tracks platform-specific source capture behavior.

For support-facing high-volume platform questions, start with `priority-platform-answer-matrix.md` before making exact claims about rich events, send-back, app parity, or mode-specific behavior. Use `priority-platform-validation-ledger.md` to check the proof state behind those short answers.

## High-Priority Pages

- `source-inventory.md`: heavy inventory pass started.
- `supported-sites-lookup.md`: public supported-site cards grouped by setup type with support answer patterns.
- `public-site-support-status.md`: support-strength rules for public site listings, setup types, app/browser boundaries, and safe claims.
- `public-site-implementation-map.md`: public site-card to source-file, source-page, manifest-row, and grouped-doc routing for all public cards.
- Public-card metadata validation note: the 2026-06-24 focused checker confirmed 139 public cards with no missing required fields, but found duplicate normalized `On24`/`ON24` cards.
- `source-file-processing-matrix.md`: file-level processing depth matrix for `sources/`, static helpers, injected helpers, and WebSocket source assets.
- `manifest-content-scripts.md`: manifest source-load matrix and special content-script flags.
- `manifest-row-matrix.md`: full 155-row content-script matrix with script, bucket, match count, flags, sample pattern, and public routing hints.
- `platform-capability-matrix.md`: high-value platform and setup-type capability routing for chat capture, rich events, send-back, app differences, and support triage.
- `priority-platform-answer-matrix.md`: safe support phrasing, first checks, and no-overclaim routing for YouTube, TikTok, Twitch, Kick, Rumble, Facebook, Instagram, and Discord.
- `priority-platform-validation-ledger.md`: evidence labels, per-platform claim ledger, and proof packs for high-risk priority-platform claims.
- `youtube.md`: heavy extraction pass complete.
- `tiktok.md`: heavy extraction pass complete.
- `tiktok-standalone-app.md`: app-specific TikTok connector, signing, fallbacks, replies, event families, tests, and support triage.
- `twitch.md`: heavy extraction pass complete.
- `kick.md`: heavy extraction pass complete.
- `facebook.md`: heavy extraction pass started.
- `instagram.md`: heavy extraction pass started.
- `rumble.md`: heavy extraction pass started.
- `discord.md`: heavy extraction pass started.
- `generic-and-custom-sources.md`: heavy extraction pass started.
- `manual-static-and-helper-sources.md`: static/manual source helpers, injected WebSocket interceptors, and VDO/helper scripts.
- `websocket-source-pages.md`: grouped source-page/API/socket workflows for Bilibili, IRC, Joystick, Nostr, Social Stream Chat, StageTEN, Streamlabs, Velora, VPZone, and shared assets.
- `communication-and-sensitive-sources.md`: grouped private communication, meeting, and assistant page sources for ChatGPT/OpenAI, Slack, Telegram, WhatsApp, Google Meet, Microsoft Teams, Zoom, Webex, and Amazon Chime.
- `embedded-chat-widget-sources.md`: grouped embedded widget and IRC-style sources for CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit Chat, and Online Church.
- `live-commerce-sources.md`: grouped live shopping and auction sources for Amazon Live, eBay Live, and Whatnot, including commerce metadata boundaries.
- `webinar-and-event-sources.md`: grouped webinar, studio, and hosted event sources for Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions, Wave Video, and WebinarGeek.
- `creator-live-cam-sources.md`: grouped creator/live-cam chat sources for Bongacams, CAM4, Camsoda, Chaturbate, Fansly, MyFreeCams, and Stripchat.
- `popout-chat-only-sources.md`: grouped smaller popout/chat-only sources for Beamstream, BoltPlus, Chzzk, FloatPlane, GoodGame, Mixcloud, Nimo, Odysee, Parti, Picarto, Piczel, RokFin, Rutube, SoopLive, and VK chat paths.
- `event-and-community-sources.md`: grouped event/community sources for Arena Social, Buzzit, CI.ME, Gala Music, LinkedIn Events, LivePush, MegaphoneTV, QuickChannel, Slido, and TradingView.
- `independent-live-platform-sources.md`: grouped independent live/chat platform sources for BandLab, Bigo.tv, Bitchute, Blaze, Castr, Cherry TV, CloutHub, Cozy.tv, DLive, Estrim, FC2, Jaco.live, LFG.tv, Locals.com, and Loco.gg.
- `video-broadcast-platform-sources.md`: grouped video/audio/broadcast chat sources for Mixlr, NicoVideo, NonOLive, OpenStreamingPlatform, Owncast, PeerTube, Restream.io Chat, Steam Broadcasts, Trovo, Truffle.vip, TwitCasting, Vimeo, YouNow, and Zap.stream.
- `community-membership-webapp-sources.md`: grouped community, membership, collaboration, and web-app sources for Circle.so, MeetMe, NextCloud, Patreon, Roll20, Simps, Tellonym, Whop, Wix Live/widgets, and Workplace legacy routing.
- `regional-and-emerging-platform-sources.md`: grouped regional, emerging, app-specific, and newly added rendered-page sources for Bilibili DOM paths, Favorited, Kwai, Pilled, Portal, Pump.fun, Retake, Rooter, SharePlay, SoulBound, Stream.place, Substack, Tikfinity, uScreen, VK Live, and Xeenon.
- `special-case-platform-and-helper-sources.md`: remaining special-case routing for Joystick DOM chat, Velora DOM chat, VPZone rendered/WS-intercepted capture, X live chat, Vertical Pixel Zone, Vercel demo helper, and top-level YouTube helper copies.

## Source Anchors

- `social_stream/sources/*.js`
- `social_stream/sources/websocket/*`
- `social_stream/providers/*`
- `ssapp/resources/electron-*-handler.js`
- `ssapp/tiktok/*`
- `ssapp/tiktok-signing/*`
- `ssapp/tests/tiktok/*`
- `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`

## Suggested Next Pass

Continue with one of:

- Runtime/intense validation of TikTok app mode, signing, send-back, and fallback behavior using `tiktok-standalone-app.md`.
- Intense extraction on Kick bridge event normalization and `kick.js` vs `kick_new.js` runtime loading.
- Intense extraction on Rumble API/SSE payloads and popup URL generation.
- Intense extraction on Facebook OAuth/Graph API behavior and viewer-mode support claims.
- Intense extraction on Instagram/Discord popup settings and support-history validation.
- API/Event Flow pass to connect platform events to integration docs.
- Runtime validation of `public-site-implementation-map.md` into a current health/status matrix, building on `public-site-support-status.md`.
- Keep current source-file inventory rows promoted out of inventory-only as new files are added.
- Intense validation of `platform-capability-matrix.md` send-back, event-family, app-parity, and source-control claims.
- Live/browser validation for `manual-static-and-helper-sources.md`, especially X/Threads static DOM capture, YouTube audio picker, Kick scout auth/cache behavior, Twitch ad/points behavior, and injected WebSocket consumers.
- Line-level validation for `websocket-source-pages.md`, especially send-back, OAuth/app bridge parity, token refresh, CORS, reconnect behavior, and controlled socket/API payload samples.
- Live/browser validation for `communication-and-sensitive-sources.md`, especially opt-in toggle gating, current DOM selectors, meeting panel states, and any background send-back path that might use `focusChat`.
- Live/browser validation for `embedded-chat-widget-sources.md`, especially iframe/all-frame behavior, current widget selectors, QuakeNet parser fragility, Minnit popout/Main URL wording, and Online Church viewer updates.
- Live/browser validation for `live-commerce-sources.md`, especially eBay auction/commerce/follower payloads, Whatnot WebSocket interception, and product-list overlay routing.
- Live/browser validation for `webinar-and-event-sources.md`, especially ON24 Q&A, Wave Video relayed platform types, Riverside disable/allow settings, and WebinarGeek shadow-DOM selectors.
- Live/browser validation for `creator-live-cam-sources.md`, especially token/tip payloads, private-message capture, hidden-tab behavior, and app source-window parity.
- Live/browser validation for `popout-chat-only-sources.md`, especially exact chat-only URL setup, Chzzk donations, Parti/VK viewer counts, Beamstream source icons, Mixcloud subscription rows, and app source-window parity.
- Live/browser validation for `event-and-community-sources.md`, especially Slido question rows, CI.ME donation/viewer data, Arena Social viewer counts, LivePush relayed source types, LinkedIn path gating, and MegaphoneTV source identity.
- Live/browser validation for `independent-live-platform-sources.md`, especially Blaze/LFG/Locals viewer and tip paths, Cherry TV joined/gift rows, DLive public routing, CloutHub type/source spelling, and app source-window parity.
- Live/browser validation for `video-broadcast-platform-sources.md`, especially Vimeo Q&A rows, Truffle upstream type behavior, Restream `sourceImg`, PeerTube login-gated chat, Trovo public routing, Steam iframe/avatar behavior, and app source-window parity.
- Live/browser validation for `community-membership-webapp-sources.md`, especially Patreon toggle/viewer behavior, Simps/Whop viewer updates, Circle and Patreon images, Wix vs Wix2 embedded paths, NextCloud domain scope, Workplace legacy routing, and app source-window parity.
- Live/browser validation for `regional-and-emerging-platform-sources.md`, especially Bilibili URL variants, SharePlay shoutout/Blitz cards, Tikfinity activity-feed payloads, Stream.place relayed rows, Substack live URL routing, Pump.fun/Retake tip rows, and inactive viewer helper paths.
- Live/browser validation for `special-case-platform-and-helper-sources.md`, especially Vertical Pixel Zone selectors/source identity, VPZone duplicate suppression, X live chat URL variants, Vercel demo session sharing, and top-level YouTube helper load status.
