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
| YouTube Live | popout | `sources/youtube.js` (M79/M80)<br>`sources/websocket/youtube.js` (M80) | `youtube.md` | DOM plus source page |
| YouTube Static Comments | manual | `sources/static/youtube_static.js` (M81)<br>`sources/youtube_comments.js` (file-only) | `special-case-platform-and-helper-sources.md` | manual/helper |
| Twitch | popout | `sources/twitch.js` (M117)<br>`sources/websocket/twitch.js` (M100) | `twitch.md` | DOM plus source page |
| Facebook Live | standard | `sources/facebook.js` (M119)<br>`sources/websocket/facebook.js` (M102) | `facebook.md` | DOM plus source page |
| Instagram Live | standard | `sources/instagram.js` (M133)<br>`sources/instagramlive.js` (file-only) | `instagram.md` | file-only route present |
| Instagram Post Comments | toggle | `sources/instagram.js` (M133) | `instagram.md` | toggle, reload |
| X Live (Twitter) | popout | `sources/x.js` (M70) | `special-case-platform-and-helper-sources.md` | manifest route |
| X Static Posts | manual | `sources/static/x.js` (M71) | `special-case-platform-and-helper-sources.md` | manual/helper |
| Threads.net | manual | `sources/static/threads.js` (M72) | `special-case-platform-and-helper-sources.md` | manual/helper |
| TikTok Live | standard | `sources/tiktok.js` (M135) | `tiktok.md` | manifest route |
| Discord | toggle | `sources/discord.js` (M124) | `discord.md` | toggle, reload |
| Zoom | standard | `sources/zoom.js` (M122) | `communication-and-sensitive-sources.md` | manifest route |
| Google Meet | toggle | `sources/meets.js` (M82) | `communication-and-sensitive-sources.md` | toggle, reload |
| WhatsApp Web | toggle | `sources/whatsapp.js` (M116) | `communication-and-sensitive-sources.md` | toggle, reload |
| Telegram | toggle | `sources/telegram.js` (M140)<br>`sources/telegramk.js` (M141) | `communication-and-sensitive-sources.md` | toggle, reload |
| VPZone.tv | standard | `sources/vpzone.js` (M41)<br>`sources/inject/vpzone-ws.js` (M42)<br>`sources/websocket/vpzone.js` (M106) | `special-case-platform-and-helper-sources.md` | DOM plus source page |
| Slack | toggle | `sources/slack.js` (M146) | `communication-and-sensitive-sources.md` | toggle, reload |
| LinkedIn Events | standard | `sources/linkedin.js` (M138) | `event-and-community-sources.md` | manifest route |
| VDO.Ninja | popout | `sources/vdoninja.js` (M137) | `special-case-platform-and-helper-sources.md` | manifest route |
| Microsoft Teams | standard | `sources/teams.js` (M131) | `communication-and-sensitive-sources.md` | manifest route |
| Restream.io Chat | standard | `sources/restream.js` (M142) | `video-broadcast-platform-sources.md` | manifest route |
| Owncast | standard | `sources/owncast.js` (M121) | `video-broadcast-platform-sources.md` | manifest route |
| Twitch IRC WebSocket | websocket | `sources/websocket/twitch.js` (M100) | `websocket-source-pages.md` | source page |
| Joystick Bot WebSocket | websocket | `sources/websocket/joystick.js` (M105) | `websocket-source-pages.md` | source page |
| IRC WebSocket | websocket | `sources/websocket/irc.js` (M107) | `websocket-source-pages.md` | source page |
| Kick.com | popout | `sources/kick.js` (M90)<br>`sources/kick_new.js` (file-only)<br>`sources/websocket/kick.js` (M101) | `kick.md` | DOM plus source page |
| GoodGame.ru | popout | `sources/goodgame.js` (M91) | `popout-chat-only-sources.md` | manifest route |
| Rumble | popout | `sources/rumble.js` (M145)<br>`sources/websocket/rumble.js` (M104) | `rumble.md` | DOM plus source page |
| Rumble API URL | websocket | `sources/websocket/rumble.js` (M104) | `websocket-source-pages.md` | source page |
| Odysee | popout | `sources/odysee.js` (M111) | `popout-chat-only-sources.md` | manifest route |
| Amazon Live | standard | `sources/amazon.js` (M144) | `live-commerce-sources.md` | manifest route |
| Vimeo | standard | `sources/vimeo.js` (M127) | `video-broadcast-platform-sources.md` | manifest route |
| Picarto.tv | popout | `sources/picarto.js` (M112) | `popout-chat-only-sources.md` | manifest route |
| Crowdcast.io | standard | `sources/crowdcast.js` (M123) | `webinar-and-event-sources.md` | manifest route |
| Mixcloud Live | popout | `sources/mixcloud.js` (M126) | `popout-chat-only-sources.md` | manifest route |
| Bilibili.tv | standard | `sources/bilibili.js` (M95) | `regional-and-emerging-platform-sources.md` | manifest route |
| Whop | standard | `sources/whop.js` (M32) | `community-membership-webapp-sources.md` | manifest route |
| Bilibili.com | standard | `sources/bilibilicom.js` (M96) | `regional-and-emerging-platform-sources.md` | manifest route |
| VK Play Live | popout | `sources/vkvideo.js` (M151)<br>`sources/vkplay.js` (file-only) | `popout-chat-only-sources.md` | current manifest uses `vkvideo.js`; `vkplay.js` is older/file-only |
| VK Live | standard | `sources/vklive.js` (M150) | `regional-and-emerging-platform-sources.md` | manifest route |
| Piczel.tv | popout | `sources/piczel.js` (M98) | `popout-chat-only-sources.md` | manifest route |
| Locals.com | standard | `sources/locals.js` (M86) | `independent-live-platform-sources.md` | manifest route |
| Nimo.TV | popout | `sources/nimo.js` (M89) | `popout-chat-only-sources.md` | manifest route |
| Amazon Chime | standard | `sources/chime.js` (M147) | `communication-and-sensitive-sources.md` | manifest route |
| NonOLive | standard | `sources/nonolive.js` (M63) | `video-broadcast-platform-sources.md` | manifest route |
| StageTEN.tv | standard | `sources/websocket/stageten.html` (source-page asset)<br>`sources/websocket/stageten.js` (file-only) | `websocket-source-pages.md` | source page; no active third-party content-script row found |
| Blaze.stream | standard | `sources/blaze.js` (M14) | `independent-live-platform-sources.md` | manifest route |
| BandLab | standard | `sources/bandlab.js` (M59) | `independent-live-platform-sources.md` | manifest route |
| FloatPlane | popout | `sources/floatplane.js` (M74) | `popout-chat-only-sources.md` | manifest route |
| ChatGPT | toggle | `sources/openai.js` (M57) | `communication-and-sensitive-sources.md` | toggle, reload |
| Livestorm.io | standard | `sources/livestorm.js` (M56) | `webinar-and-event-sources.md` | manifest route |
| Cozy.tv | standard | `sources/cozy.js` (M46) | `independent-live-platform-sources.md` | manifest route |
| Steam Broadcasts | standard | `sources/steam.js` (M38) | `video-broadcast-platform-sources.md` | manifest route |
| Whatnot | standard | `sources/whatnot.js` (M52)<br>`sources/inject/whatnot-ws.js` (M51) | `live-commerce-sources.md` | injected helper also |
| eBay Live | standard | `sources/ebay.js` (M120) | `live-commerce-sources.md` | manifest route |
| Sessions.us | standard | `sources/sessions.js` (M50) | `webinar-and-event-sources.md` | manifest route |
| Chzzk.naver.com | popout | `sources/chzzk.js` (M20) | `popout-chat-only-sources.md` | manifest route |
| IRC Quakenet | standard | `sources/quakenet.js` (M64) | `embedded-chat-widget-sources.md` | manifest route |
| IRC KiwiIRC | standard | `sources/kiwiirc.js` (M65) | `embedded-chat-widget-sources.md` | manifest route |
| Webex | standard | `sources/webex.js` (M139) | `communication-and-sensitive-sources.md` | manifest route |
| Riverside.fm | standard | `sources/riverside.js` (M29) | `webinar-and-event-sources.md` | manifest route |
| Fansly | popout | `sources/fansly.js` (M11) | `creator-live-cam-sources.md` | manifest route |
| Camsoda | standard | `sources/camsoda.js` (M1) | `creator-live-cam-sources.md` | manifest route |
| MyFreeCams | standard | `sources/myfreecams.js` (M16) | `creator-live-cam-sources.md` | manifest route |
| Bongacams | standard | `sources/bongacams.js` (M3) | `creator-live-cam-sources.md` | manifest route |
| CAM4 | standard | `sources/cam4.js` (M4) | `creator-live-cam-sources.md` | manifest route |
| Stripchat | standard | `sources/stripchat.js` (M2) | `creator-live-cam-sources.md` | manifest route |
| TwitCasting | standard | `sources/twitcasting.js` (M61) | `video-broadcast-platform-sources.md` | manifest route |
| Bigo.tv | standard | `sources/bigo.js` (M8) | `independent-live-platform-sources.md` | manifest route |
| Substack | standard | `sources/substack.js` (M134) | `regional-and-emerging-platform-sources.md` | manifest route |
| Roll20 | standard | `sources/roll20.js` (M99) | `community-membership-webapp-sources.md` | manifest route |
| On24 | standard | `sources/on24.js` (M129) | `webinar-and-event-sources.md` | manifest route |
| Chaturbate | standard | `sources/chaturbate.js` (M10) | `creator-live-cam-sources.md` | manifest route |
| Cherry TV | standard | `sources/cherrytv.js` (M13) | `independent-live-platform-sources.md` | manifest route |
| Claude.ai | toggle | `sources/static/claude.js` (M69) | `communication-and-sensitive-sources.md` | toggle, reload |
| SoulBound.tv | standard | `sources/soulbound.js` (file-only) | `regional-and-emerging-platform-sources.md` | source exists; no manifest row found |
| Truffle.vip | standard | `sources/truffle.js` (M28) | `video-broadcast-platform-sources.md` | manifest route |
| Favorited | popout | `sources/favorited.js` (M30) | `popout-chat-only-sources.md` | manifest route |
| Simps | standard | `sources/simps.js` (M26) | `community-membership-webapp-sources.md` | manifest route |
| Pilled.net | standard | `sources/pilled.js` (M31) | `independent-live-platform-sources.md` | public card says standard but setup text says pop out chat |
| Portal | standard | `sources/portal.js` (M0) | `regional-and-emerging-platform-sources.md` | manifest route |
| Pump.fun | standard | `sources/pumpfun.js` (M17) | `regional-and-emerging-platform-sources.md` | manifest route |
| Noice | standard | `sources/graveyard/noice.js` (graveyard) | `special-case-platform-and-helper-sources.md` | public card only in active route; verify before support claims |
| NicoVideo | standard | `sources/nicovideo.js` (M34) | `video-broadcast-platform-sources.md` | manifest route |
| Rutube | popout | `sources/rutube.js` (M35) | `popout-chat-only-sources.md` | manifest route |
| Moonbeam | standard | `sources/graveyard/moonbeam.js` (graveyard) | `special-case-platform-and-helper-sources.md` | public card only in active route; verify before support claims |
| FC2 | standard | `sources/fc2.js` (M36) | `independent-live-platform-sources.md` | manifest route |
| Vertical Pixel Zone | standard | `sources/verticalpixelzone.js` (M40) | `special-case-platform-and-helper-sources.md` | manifest route |
| Mixlr | standard | `sources/mixlr.js` (M43) | `video-broadcast-platform-sources.md` | manifest route |
| Jaco.live | standard | `sources/jaco.js` (M45) | `independent-live-platform-sources.md` | manifest route |
| Gala Music | standard | `sources/gala.js` (M47) | `event-and-community-sources.md` | manifest route |
| Circle.so | standard | `sources/circle.js` (M48) | `community-membership-webapp-sources.md` | manifest route |
| Estrim | standard | `sources/estrim.js` (M54) | `independent-live-platform-sources.md` | manifest route |
| Online Church | standard | `sources/onlinechurch.js` (M18) | `embedded-chat-widget-sources.md` | manifest route |
| Parti | profile/popout | `sources/parti.js` (M21) | `popout-chat-only-sources.md` | manifest route |
| Wave Video | standard | `sources/wavevideo.js` (M22) | `webinar-and-event-sources.md` | manifest route |
| WebinarGeek | standard | `sources/webinargeek.js` (M23) | `webinar-and-event-sources.md` | manifest route |
| uScreen | standard | `sources/uscreen.js` (M33) | `regional-and-emerging-platform-sources.md` | manifest route |
| Zap.stream | standard | `sources/zapstream.js` (M6) | `video-broadcast-platform-sources.md` | manifest route |
| MeetMe | standard | `sources/meetme.js` (M7) | `community-membership-webapp-sources.md` | manifest route |
| SoopLive | popout | `sources/sooplive.js` (M58) | `popout-chat-only-sources.md` | manifest route |
| Beamstream | popout | `sources/beamstream.js` (M19) | `popout-chat-only-sources.md` | manifest route |
| CI.ME | standard | `sources/cime.js` (M148) | `event-and-community-sources.md` | manifest route |
| Castr | standard | `sources/castr.js` (M75) | `independent-live-platform-sources.md` | manifest route |
| Chatroll | standard | `sources/chatroll.js` (M110) | `embedded-chat-widget-sources.md` | manifest route |
| Tellonym | standard | `sources/tellonym.js` (M73) | `community-membership-webapp-sources.md` | manifest route |
| LivePush | standard | `sources/livepush.js` (M113) | `event-and-community-sources.md` | manifest route |
| MegaphoneTV | standard | `sources/megaphonetv.js` (M39) | `event-and-community-sources.md` | manifest route |
| NextCloud | standard | `sources/nextcloud.js` (M77) | `community-membership-webapp-sources.md` | manifest route |
| PeerTube | standard | `sources/peertube.js` (M132) | `video-broadcast-platform-sources.md` | manifest route |
| Bitchute | standard | `sources/bitchute.js` (M97) | `independent-live-platform-sources.md` | manifest route |
| Buzzit | standard | `sources/buzzit.js` (M149) | `event-and-community-sources.md` | manifest route |
| Joystick.tv | standard | `sources/joystick.js` (M67) | `special-case-platform-and-helper-sources.md` | manifest route |
| Rooter | standard | `sources/rooter.js` (M68) | `independent-live-platform-sources.md` | manifest route |
| Loco.gg | standard | `sources/loco.js` (M66) | `independent-live-platform-sources.md` | manifest route |
| ON24 | standard | `sources/on24.js` (M129) | `webinar-and-event-sources.md` | duplicate public card with `On24` |
| Arena Social | standard | `sources/arenasocial.js` (M130) | `event-and-community-sources.md` | manifest route |
| Blaze | standard | `sources/blaze.js` (M14) | `independent-live-platform-sources.md` | duplicate public card with `Blaze.stream` |
| Versus.cam | standard | `sources/generic.js` (M5) | `special-case-platform-and-helper-sources.md` | manifest route |
| Vercel Demo | standard | `sources/vercel.js` (M60) | `special-case-platform-and-helper-sources.md` | manifest route |
| CBOX | standard | `sources/cbox.js` (M62) | `embedded-chat-widget-sources.md` | manifest route |
| Wix Live | standard | `sources/wix.js` (M88)<br>`sources/wix2.js` (M87) | `community-membership-webapp-sources.md` | manifest route |
| Xeenon | retired | `sources/graveyard/xeenon.js` | - | moved to graveyard; site is hibernating |
| Retake.tv | standard | `sources/retake.js` (M27) | `regional-and-emerging-platform-sources.md` | manifest route |
| BoltPlus.tv | popout | `sources/boltplus.js` (M55) | `popout-chat-only-sources.md` | manifest route |
| Velora.tv | standard | `sources/velora.js` (M15)<br>`sources/websocket/velora.js` (M103) | `special-case-platform-and-helper-sources.md` | DOM plus source page |
| RokFin | popout | `sources/rokfin.js` (M83) | `popout-chat-only-sources.md` | manifest route |
| Stream.place | standard | `sources/streamplace.js` (M25) | `regional-and-emerging-platform-sources.md` | manifest route |
| TradingView Streams | standard | `sources/tradingview.js` (M76) | `event-and-community-sources.md` | manifest route |
| SharePlay.tv | standard | `sources/shareplay.js` (M44) | `regional-and-emerging-platform-sources.md` | manifest route |
| CloutHub | standard | `sources/cloudhub.js` (M93) | `independent-live-platform-sources.md` | manifest route |
| Slido | standard | `sources/slido.js` (M84) | `event-and-community-sources.md` | manifest route |
| YouNow | standard | `sources/younow.js` (M53) | `video-broadcast-platform-sources.md` | manifest route |
| Rozy.tv | standard | public card; host permission only | `source-file-processing-matrix.md` | no active content script found |
| QuickChannel | standard | `sources/quickchannel.js` (M85) | `event-and-community-sources.md` | manifest route |
| Instafeed | standard | `sources/instafeed.js` (M115) | `special-case-platform-and-helper-sources.md` | manifest route |
| Patreon | toggle | `sources/patreon.js` (M49) | `community-membership-webapp-sources.md` | toggle, reload |
| Minnit Chat | standard | `sources/minnit.js` (M109) | `embedded-chat-widget-sources.md` | manifest route |
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
