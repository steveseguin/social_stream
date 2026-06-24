# Public Site Implementation Map

Status: generated-source inventory pass on 2026-06-24. No browser, platform, app, or OBS runtime validation was performed.

## Purpose

Use this page when a user asks whether a listed site is supported and the answer needs the current source route, manifest row, or grouped platform doc.

This page maps the 139 public site cards in `docs/js/sites.js` to current source files, source-page assets, manifest row IDs, and agent routing docs. It does not prove that the third-party site still works today.

## Source Anchors

- `docs/js/sites.js`
- `manifest.json`
- `sources/*.js`
- `sources/static/*.js`
- `sources/inject/*.js`
- `sources/websocket/*`
- `docs/agents/08-platform-sources/supported-sites-lookup.md`
- `docs/agents/08-platform-sources/public-site-support-status.md`
- `docs/agents/08-platform-sources/manifest-row-matrix.md`
- `docs/agents/08-platform-sources/source-file-processing-matrix.md`

## Counts

| Item | Count |
| --- | ---: |
| Public site cards mapped | 139 |
| Public `standard` cards | 100 |
| Public `popout` cards | 23 |
| Public `toggle` cards | 9 |
| Public `websocket` cards | 4 |
| Public `manual` cards | 3 |

## Focused Validation Note

On 2026-06-24, a read-only inline Node metadata checker confirmed the 139 public card count and setup-type counts from `docs/js/sites.js`. It found no missing required public-card fields.

Known metadata finding: `On24` and `ON24` are duplicate normalized public card names. Both route to the same `sources/on24.js` implementation family in this map.

Evidence label: `focused-metadata-validation`; not runtime-tested. This map remains a generated/source routing aid, not proof of current third-party platform health or public supported-sites UI behavior.

## Reading Rules

- `M#` means the content-script row number from `manifest-row-matrix.md`.
- `file-only` means a current source file exists but no manifest content-script row loads it in this pass.
- `source-page asset` means the route is an SSN-hosted page or script under `sources/websocket/`, not a normal third-party DOM content-script match.
- `graveyard` means the matching implementation is under `sources/graveyard`; treat the public card as stale-risk until a current load path is confirmed.
- `host permission only` means the public card or host permission exists, but no active content-script route was found in this pass.
- A route can include both DOM capture and a source page. Ask which mode the user is using before troubleshooting.

## Implementation Map

| Site | Type | Route | Routing Doc | Note |
| --- | --- | --- | --- | --- |
| YouTube Live | popout | `sources/youtube.js` (M79/M80)<br>`sources/websocket/youtube.js` (M81) | `youtube.md` | DOM plus source page |
| YouTube Static Comments | manual | `sources/static/youtube_static.js` (M82)<br>`sources/youtube_comments.js` (file-only) | `special-case-platform-and-helper-sources.md` | manual/helper |
| Twitch | popout | `sources/twitch.js` (M118)<br>`sources/websocket/twitch.js` (M101) | `twitch.md` | DOM plus source page |
| Facebook Live | standard | `sources/facebook.js` (M120)<br>`sources/websocket/facebook.js` (M103) | `facebook.md` | DOM plus source page |
| Instagram Live | standard | `sources/instagram.js` (M134)<br>`sources/instagramlive.js` (file-only) | `instagram.md` | file-only route present |
| Instagram Post Comments | toggle | `sources/instagram.js` (M134) | `instagram.md` | toggle, reload |
| X Live (Twitter) | popout | `sources/x.js` (M71) | `special-case-platform-and-helper-sources.md` | manifest route |
| X Static Posts | manual | `sources/static/x.js` (M72) | `special-case-platform-and-helper-sources.md` | manual/helper |
| Threads.net | manual | `sources/static/threads.js` (M73) | `special-case-platform-and-helper-sources.md` | manual/helper |
| TikTok Live | standard | `sources/tiktok.js` (M136) | `tiktok.md` | manifest route |
| Discord | toggle | `sources/discord.js` (M125) | `discord.md` | toggle, reload |
| Zoom | standard | `sources/zoom.js` (M123) | `communication-and-sensitive-sources.md` | manifest route |
| Google Meet | toggle | `sources/meets.js` (M83) | `communication-and-sensitive-sources.md` | toggle, reload |
| WhatsApp Web | toggle | `sources/whatsapp.js` (M117) | `communication-and-sensitive-sources.md` | toggle, reload |
| Telegram | toggle | `sources/telegram.js` (M141)<br>`sources/telegramk.js` (M142) | `communication-and-sensitive-sources.md` | toggle, reload |
| VPZone.tv | standard | `sources/vpzone.js` (M42)<br>`sources/inject/vpzone-ws.js` (M43)<br>`sources/websocket/vpzone.js` (M107) | `special-case-platform-and-helper-sources.md` | DOM plus source page |
| Slack | toggle | `sources/slack.js` (M147) | `communication-and-sensitive-sources.md` | toggle, reload |
| LinkedIn Events | standard | `sources/linkedin.js` (M139) | `event-and-community-sources.md` | manifest route |
| VDO.Ninja | popout | `sources/vdoninja.js` (M138) | `special-case-platform-and-helper-sources.md` | manifest route |
| Microsoft Teams | standard | `sources/teams.js` (M132) | `communication-and-sensitive-sources.md` | manifest route |
| Restream.io Chat | standard | `sources/restream.js` (M143) | `video-broadcast-platform-sources.md` | manifest route |
| Owncast | standard | `sources/owncast.js` (M122) | `video-broadcast-platform-sources.md` | manifest route |
| Twitch IRC WebSocket | websocket | `sources/websocket/twitch.js` (M101) | `websocket-source-pages.md` | source page |
| Joystick Bot WebSocket | websocket | `sources/websocket/joystick.js` (M106) | `websocket-source-pages.md` | source page |
| IRC WebSocket | websocket | `sources/websocket/irc.js` (M108) | `websocket-source-pages.md` | source page |
| Kick.com | popout | `sources/kick.js` (M91)<br>`sources/kick_new.js` (file-only)<br>`sources/websocket/kick.js` (M102) | `kick.md` | DOM plus source page |
| GoodGame.ru | popout | `sources/goodgame.js` (M92) | `popout-chat-only-sources.md` | manifest route |
| Rumble | popout | `sources/rumble.js` (M146)<br>`sources/websocket/rumble.js` (M105) | `rumble.md` | DOM plus source page |
| Rumble API URL | websocket | `sources/websocket/rumble.js` (M105) | `websocket-source-pages.md` | source page |
| Odysee | popout | `sources/odysee.js` (M112) | `popout-chat-only-sources.md` | manifest route |
| Amazon Live | standard | `sources/amazon.js` (M145) | `live-commerce-sources.md` | manifest route |
| Vimeo | standard | `sources/vimeo.js` (M128) | `video-broadcast-platform-sources.md` | manifest route |
| Picarto.tv | popout | `sources/picarto.js` (M113) | `popout-chat-only-sources.md` | manifest route |
| Crowdcast.io | standard | `sources/crowdcast.js` (M124) | `webinar-and-event-sources.md` | manifest route |
| Mixcloud Live | popout | `sources/mixcloud.js` (M127) | `popout-chat-only-sources.md` | manifest route |
| Bilibili.tv | standard | `sources/bilibili.js` (M96) | `regional-and-emerging-platform-sources.md` | manifest route |
| Whop | standard | `sources/whop.js` (M33) | `community-membership-webapp-sources.md` | manifest route |
| Bilibili.com | standard | `sources/bilibilicom.js` (M97) | `regional-and-emerging-platform-sources.md` | manifest route |
| VK Play Live | popout | `sources/vkvideo.js` (M152)<br>`sources/vkplay.js` (file-only) | `popout-chat-only-sources.md` | current manifest uses `vkvideo.js`; `vkplay.js` is older/file-only |
| VK Live | standard | `sources/vklive.js` (M151) | `regional-and-emerging-platform-sources.md` | manifest route |
| Piczel.tv | popout | `sources/piczel.js` (M99) | `popout-chat-only-sources.md` | manifest route |
| Locals.com | standard | `sources/locals.js` (M87) | `independent-live-platform-sources.md` | manifest route |
| Nimo.TV | popout | `sources/nimo.js` (M90) | `popout-chat-only-sources.md` | manifest route |
| Amazon Chime | standard | `sources/chime.js` (M148) | `communication-and-sensitive-sources.md` | manifest route |
| NonOLive | standard | `sources/nonolive.js` (M64) | `video-broadcast-platform-sources.md` | manifest route |
| StageTEN.tv | standard | `sources/websocket/stageten.html` (source-page asset)<br>`sources/websocket/stageten.js` (file-only) | `websocket-source-pages.md` | source page; no active third-party content-script row found |
| Blaze.stream | standard | `sources/blaze.js` (M14) | `independent-live-platform-sources.md` | manifest route |
| BandLab | standard | `sources/bandlab.js` (M60) | `independent-live-platform-sources.md` | manifest route |
| FloatPlane | popout | `sources/floatplane.js` (M75) | `popout-chat-only-sources.md` | manifest route |
| ChatGPT | toggle | `sources/openai.js` (M58) | `communication-and-sensitive-sources.md` | toggle, reload |
| Livestorm.io | standard | `sources/livestorm.js` (M57) | `webinar-and-event-sources.md` | manifest route |
| Cozy.tv | standard | `sources/cozy.js` (M47) | `independent-live-platform-sources.md` | manifest route |
| Steam Broadcasts | standard | `sources/steam.js` (M39) | `video-broadcast-platform-sources.md` | manifest route |
| Whatnot | standard | `sources/whatnot.js` (M53)<br>`sources/inject/whatnot-ws.js` (M52) | `live-commerce-sources.md` | injected helper also |
| eBay Live | standard | `sources/ebay.js` (M121) | `live-commerce-sources.md` | manifest route |
| Sessions.us | standard | `sources/sessions.js` (M51) | `webinar-and-event-sources.md` | manifest route |
| Chzzk.naver.com | popout | `sources/chzzk.js` (M20) | `popout-chat-only-sources.md` | manifest route |
| IRC Quakenet | standard | `sources/quakenet.js` (M65) | `embedded-chat-widget-sources.md` | manifest route |
| IRC KiwiIRC | standard | `sources/kiwiirc.js` (M66) | `embedded-chat-widget-sources.md` | manifest route |
| Webex | standard | `sources/webex.js` (M140) | `communication-and-sensitive-sources.md` | manifest route |
| Riverside.fm | standard | `sources/riverside.js` (M30) | `webinar-and-event-sources.md` | manifest route |
| Fansly | popout | `sources/fansly.js` (M11) | `creator-live-cam-sources.md` | manifest route |
| Camsoda | standard | `sources/camsoda.js` (M1) | `creator-live-cam-sources.md` | manifest route |
| MyFreeCams | standard | `sources/myfreecams.js` (M16) | `creator-live-cam-sources.md` | manifest route |
| Bongacams | standard | `sources/bongacams.js` (M3) | `creator-live-cam-sources.md` | manifest route |
| CAM4 | standard | `sources/cam4.js` (M4) | `creator-live-cam-sources.md` | manifest route |
| Stripchat | standard | `sources/stripchat.js` (M2) | `creator-live-cam-sources.md` | manifest route |
| TwitCasting | standard | `sources/twitcasting.js` (M62) | `video-broadcast-platform-sources.md` | manifest route |
| Bigo.tv | standard | `sources/bigo.js` (M8) | `independent-live-platform-sources.md` | manifest route |
| Substack | standard | `sources/substack.js` (M135) | `regional-and-emerging-platform-sources.md` | manifest route |
| Roll20 | standard | `sources/roll20.js` (M100) | `community-membership-webapp-sources.md` | manifest route |
| On24 | standard | `sources/on24.js` (M130) | `webinar-and-event-sources.md` | manifest route |
| Chaturbate | standard | `sources/chaturbate.js` (M10) | `creator-live-cam-sources.md` | manifest route |
| Cherry TV | standard | `sources/cherrytv.js` (M13) | `independent-live-platform-sources.md` | manifest route |
| Claude.ai | toggle | `sources/static/claude.js` (M70) | `communication-and-sensitive-sources.md` | toggle, reload |
| SoulBound.tv | standard | `sources/soulbound.js` (file-only) | `regional-and-emerging-platform-sources.md` | source exists; no manifest row found |
| Truffle.vip | standard | `sources/truffle.js` (M29) | `video-broadcast-platform-sources.md` | manifest route |
| Favorited | popout | `sources/favorited.js` (M31) | `popout-chat-only-sources.md` | manifest route |
| Simps | standard | `sources/simps.js` (M26) | `community-membership-webapp-sources.md` | manifest route |
| Pilled.net | standard | `sources/pilled.js` (M32) | `independent-live-platform-sources.md` | public card says standard but setup text says pop out chat |
| Portal | standard | `sources/portal.js` (M0) | `regional-and-emerging-platform-sources.md` | manifest route |
| Pump.fun | standard | `sources/pumpfun.js` (M17) | `regional-and-emerging-platform-sources.md` | manifest route |
| Noice | standard | `sources/graveyard/noice.js` (graveyard) | `special-case-platform-and-helper-sources.md` | public card only in active route; verify before support claims |
| NicoVideo | standard | `sources/nicovideo.js` (M35) | `video-broadcast-platform-sources.md` | manifest route |
| Rutube | popout | `sources/rutube.js` (M36) | `popout-chat-only-sources.md` | manifest route |
| Moonbeam | standard | `sources/graveyard/moonbeam.js` (graveyard) | `special-case-platform-and-helper-sources.md` | public card only in active route; verify before support claims |
| FC2 | standard | `sources/fc2.js` (M37) | `independent-live-platform-sources.md` | manifest route |
| Vertical Pixel Zone | standard | `sources/verticalpixelzone.js` (M41) | `special-case-platform-and-helper-sources.md` | manifest route |
| Mixlr | standard | `sources/mixlr.js` (M44) | `video-broadcast-platform-sources.md` | manifest route |
| Jaco.live | standard | `sources/jaco.js` (M46) | `independent-live-platform-sources.md` | manifest route |
| Gala Music | standard | `sources/gala.js` (M48) | `event-and-community-sources.md` | manifest route |
| Circle.so | standard | `sources/circle.js` (M49) | `community-membership-webapp-sources.md` | manifest route |
| Estrim | standard | `sources/estrim.js` (M55) | `independent-live-platform-sources.md` | manifest route |
| Online Church | standard | `sources/onlinechurch.js` (M18) | `embedded-chat-widget-sources.md` | manifest route |
| Parti | popout | `sources/parti.js` (M21) | `popout-chat-only-sources.md` | manifest route |
| Wave Video | standard | `sources/wavevideo.js` (M22) | `webinar-and-event-sources.md` | manifest route |
| WebinarGeek | standard | `sources/webinargeek.js` (M23) | `webinar-and-event-sources.md` | manifest route |
| uScreen | standard | `sources/uscreen.js` (M34) | `regional-and-emerging-platform-sources.md` | manifest route |
| Zap.stream | standard | `sources/zapstream.js` (M6) | `video-broadcast-platform-sources.md` | manifest route |
| MeetMe | standard | `sources/meetme.js` (M7) | `community-membership-webapp-sources.md` | manifest route |
| SoopLive | popout | `sources/sooplive.js` (M59) | `popout-chat-only-sources.md` | manifest route |
| Beamstream | popout | `sources/beamstream.js` (M19) | `popout-chat-only-sources.md` | manifest route |
| CI.ME | standard | `sources/cime.js` (M149) | `event-and-community-sources.md` | manifest route |
| Castr | standard | `sources/castr.js` (M76) | `independent-live-platform-sources.md` | manifest route |
| Chatroll | standard | `sources/chatroll.js` (M111) | `embedded-chat-widget-sources.md` | manifest route |
| Tellonym | standard | `sources/tellonym.js` (M74) | `community-membership-webapp-sources.md` | manifest route |
| LivePush | standard | `sources/livepush.js` (M114) | `event-and-community-sources.md` | manifest route |
| MegaphoneTV | standard | `sources/megaphonetv.js` (M40) | `event-and-community-sources.md` | manifest route |
| NextCloud | standard | `sources/nextcloud.js` (M78) | `community-membership-webapp-sources.md` | manifest route |
| PeerTube | standard | `sources/peertube.js` (M133) | `video-broadcast-platform-sources.md` | manifest route |
| Bitchute | standard | `sources/bitchute.js` (M98) | `independent-live-platform-sources.md` | manifest route |
| Buzzit | standard | `sources/buzzit.js` (M150) | `event-and-community-sources.md` | manifest route |
| Joystick.tv | standard | `sources/joystick.js` (M68) | `special-case-platform-and-helper-sources.md` | manifest route |
| Rooter | standard | `sources/rooter.js` (M69) | `independent-live-platform-sources.md` | manifest route |
| Loco.gg | standard | `sources/loco.js` (M67) | `independent-live-platform-sources.md` | manifest route |
| ON24 | standard | `sources/on24.js` (M130) | `webinar-and-event-sources.md` | duplicate public card with `On24` |
| Arena Social | standard | `sources/arenasocial.js` (M131) | `event-and-community-sources.md` | manifest route |
| Blaze | standard | `sources/blaze.js` (M14) | `independent-live-platform-sources.md` | duplicate public card with `Blaze.stream` |
| Versus.cam | standard | `sources/generic.js` (M5) | `special-case-platform-and-helper-sources.md` | manifest route |
| Vercel Demo | standard | `sources/vercel.js` (M61) | `special-case-platform-and-helper-sources.md` | manifest route |
| CBOX | standard | `sources/cbox.js` (M63) | `embedded-chat-widget-sources.md` | manifest route |
| Wix Live | standard | `sources/wix.js` (M89)<br>`sources/wix2.js` (M88) | `community-membership-webapp-sources.md` | manifest route |
| Xeenon | standard | `sources/xeenon.js` (M28) | `regional-and-emerging-platform-sources.md` | manifest route |
| Retake.tv | standard | `sources/retake.js` (M27) | `regional-and-emerging-platform-sources.md` | manifest route |
| BoltPlus.tv | popout | `sources/boltplus.js` (M56) | `popout-chat-only-sources.md` | manifest route |
| Velora.tv | standard | `sources/velora.js` (M15)<br>`sources/websocket/velora.js` (M104) | `special-case-platform-and-helper-sources.md` | DOM plus source page |
| RokFin | popout | `sources/rokfin.js` (M84) | `popout-chat-only-sources.md` | manifest route |
| Stream.place | standard | `sources/streamplace.js` (M25) | `regional-and-emerging-platform-sources.md` | manifest route |
| TradingView Streams | standard | `sources/tradingview.js` (M77) | `event-and-community-sources.md` | manifest route |
| SharePlay.tv | standard | `sources/shareplay.js` (M45) | `regional-and-emerging-platform-sources.md` | manifest route |
| CloutHub | standard | `sources/cloudhub.js` (M94) | `independent-live-platform-sources.md` | manifest route |
| Slido | standard | `sources/slido.js` (M85) | `event-and-community-sources.md` | manifest route |
| YouNow | standard | `sources/younow.js` (M54) | `video-broadcast-platform-sources.md` | manifest route |
| Rozy.tv | standard | public card; host permission only | `source-file-processing-matrix.md` | no active content script found |
| QuickChannel | standard | `sources/quickchannel.js` (M86) | `event-and-community-sources.md` | manifest route |
| Instafeed | standard | `sources/instafeed.js` (M116) | `special-case-platform-and-helper-sources.md` | manifest route |
| Patreon | toggle | `sources/patreon.js` (M50) | `community-membership-webapp-sources.md` | toggle, reload |
| Minnit Chat | standard | `sources/minnit.js` (M110) | `embedded-chat-widget-sources.md` | manifest route |
| LFG.tv | standard | `sources/lfg.js` (M9) | `independent-live-platform-sources.md` | manifest route |

## Stale-Risk Rows From This Pass

Treat these rows with extra caution before giving support advice:

| Site | Reason |
| --- | --- |
| Noice | Public card exists, but only `sources/graveyard/noice.js` was found in this pass. |
| Moonbeam | Public card exists, but only `sources/graveyard/moonbeam.js` was found in this pass. |
| Rozy.tv | Public card and host permission exist, but no active content-script row was found. |
| SoulBound.tv | Active source file exists, but no manifest content-script row was found. |
| StageTEN.tv | Public card says standard, but current active route appears to be the WebSocket/source-page asset. |
| VK Play Live | Current manifest loads `vkvideo.js`; `vkplay.js` exists as older/file-only route. |
| Pilled.net | Public setup type is `standard`, while public setup text says pop out chat. |
| On24 / ON24 | Duplicate public cards map to the same source file. |
| Blaze.stream / Blaze | Duplicate public cards map to the same source file. |

## Support Use

When answering "is X supported?", combine:

1. `supported-sites-lookup.md` for public setup wording.
2. This file for source/manifest routing.
3. The grouped routing doc named in the table.
4. Current source inspection before exact event, selector, send-back, auth, or app-parity claims.

Do not use this file as a health check. It proves current repository routing, not current third-party site behavior.
