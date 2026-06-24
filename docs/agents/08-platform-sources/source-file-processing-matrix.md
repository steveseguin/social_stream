# Source File Processing Matrix

Status: generated inventory/processing pass from `sources/`, `manifest.json`, and `docs/js/sites.js` on 2026-06-24.

This page tracks every current source-file resource at the file level. Exact file names and manifest references are source-backed. Public site-card matches are heuristic and should be verified before making a user-facing claim.

For a one-row-per-public-site card map from `docs/js/sites.js` to source files and manifest row IDs, use `public-site-implementation-map.md`.

## Counts

- Top-level `sources/*.js`: 143
- `sources/static/*.js`: 6
- `sources/inject/*.js`: 3
- `sources/websocket/*.js`: 14
- Other `sources/websocket/*` files: 20
- Manifest scripts mapped here: 154
- Public supported-site cards used for heuristic matching: 139

## How To Use This Matrix

- `heavy` means an agent doc exists, but exact parser behavior still needs source inspection for fragile answers.
- `inventory-only` means the file is known and listed, not behavior-documented. Inspect the file before answering detailed questions.
- `Manifest Refs` is the number of manifest content-script entries that load the file, not the number of URL match patterns.
- `Public Site Card Heuristic` is derived from public site metadata and filename/icon/name matching. It can miss aliases or over-match generic icons.
- For row-level URL pattern routing, use `manifest-row-matrix.md`.

## Top-Level Source Scripts

These are the main `sources/*.js` files. Most are normal extension/app content scripts, but some are helpers, duplicate paths, or source-specific utility scripts.

| File | Public Site Card Heuristic | Public Type | Manifest Refs | Flags | Current Depth | Next Extraction Need |
| --- | --- | --- | ---: | --- | --- | --- |
| `sources/amazon.js` | Amazon Live; Amazon Chime | standard | 1 | document_start | quick/heavy | Amazon Live chat capture; see `live-commerce-sources.md`. |
| `sources/arenasocial.js` | Arena Social | standard | 1 | - | quick/heavy | Arena Social live chat and viewer-update behavior; see `event-and-community-sources.md`. |
| `sources/autoreload.js` | - | - | 1 | - | quick/heavy | Personal reload helper; see `manual-static-and-helper-sources.md`. |
| `sources/bandlab.js` | BandLab | standard | 1 | - | quick/heavy | Independent rendered chat source; see `independent-live-platform-sources.md`. |
| `sources/beamstream.js` | Beamstream | popout | 1 | - | quick/heavy | Beamstream chat-only capture with media/source icon metadata; see `popout-chat-only-sources.md`. |
| `sources/bigo.js` | Bigo.tv | standard | 1 | - | quick/heavy | Independent rendered chat source; see `independent-live-platform-sources.md`. |
| `sources/bilibili.js` | Bilibili.tv; Bilibili.com | standard | 1 | - | quick/heavy | Bilibili.tv rendered live chat capture; see `regional-and-emerging-platform-sources.md`. |
| `sources/bilibilicom.js` | Bilibili.com | standard | 1 | - | quick/heavy | Bilibili.com live chat capture with iframe fallback; see `regional-and-emerging-platform-sources.md`. |
| `sources/bitchute.js` | Bitchute | standard | 1 | - | quick/heavy | Bitchute rendered video-page chat/comment source; see `independent-live-platform-sources.md`. |
| `sources/blaze.js` | Blaze.stream; Blaze | standard | 1 | - | quick/heavy | Blaze chat, donation text, and viewer-update behavior; see `independent-live-platform-sources.md`. |
| `sources/boltplus.js` | BoltPlus.tv | popout | 1 | - | quick/heavy | BoltPlus chatpopout capture with avatar/content image handling; see `popout-chat-only-sources.md`. |
| `sources/bongacams.js` | Bongacams | standard | 1 | - | quick/heavy | Bongacams rendered chat and token-tip capture; see `creator-live-cam-sources.md`. |
| `sources/buzzit.js` | Buzzit | standard | 1 | - | quick/heavy | Buzzit event chat capture; see `event-and-community-sources.md`. |
| `sources/cam4.js` | CAM4 | standard | 1 | - | quick/heavy | CAM4 rendered chat and token-tip capture; see `creator-live-cam-sources.md`. |
| `sources/camsoda.js` | Camsoda | standard | 1 | - | quick/heavy | Camsoda rendered chat and tip capture; see `creator-live-cam-sources.md`. |
| `sources/capturevideo.js` | - | - | 1 | - | quick/heavy | Discord VDO.Ninja media publisher helper; see `manual-static-and-helper-sources.md`. |
| `sources/castr.js` | Castr | standard | 1 | - | quick/heavy | Castr chat-room capture; see `independent-live-platform-sources.md`. |
| `sources/cbox.js` | CBOX | standard | 1 | all_frames | quick/heavy | Embedded CBOX chat widget capture; see `embedded-chat-widget-sources.md`. |
| `sources/chatroll.js` | Chatroll | standard | 1 | all_frames | quick/heavy | Embedded Chatroll widget capture; see `embedded-chat-widget-sources.md`. |
| `sources/chaturbate.js` | Chaturbate | standard | 1 | - | quick/heavy | Chaturbate public/private chat and notice capture; see `creator-live-cam-sources.md`. |
| `sources/cherrytv.js` | Cherry TV | standard | 1 | - | quick/heavy | Cherry TV chat and joined-row behavior; see `independent-live-platform-sources.md`. |
| `sources/chime.js` | Amazon Chime | standard | 1 | - | quick/heavy | Amazon Chime communication source; see `communication-and-sensitive-sources.md`. |
| `sources/chzzk.js` | Chzzk.naver.com | popout | 1 | - | quick/heavy | Chzzk chat-only capture with badge/donation/dedupe behavior; see `popout-chat-only-sources.md`. |
| `sources/cime.js` | CI.ME | standard | 1 | - | quick/heavy | CI.ME chat, donation, and viewer-update behavior; see `event-and-community-sources.md`. |
| `sources/circle.js` | Circle.so | standard | 1 | - | quick/heavy | Circle rendered community message and content-image capture; see `community-membership-webapp-sources.md`. |
| `sources/cloudhub.js` | CloutHub | standard | 1 | - | quick/heavy | CloutHub rendered chat source with type/source spelling caveat; see `independent-live-platform-sources.md`. |
| `sources/cozy.js` | Cozy.tv | standard | 1 | - | quick/heavy | Cozy.tv rendered chat, sticker, and badge capture; see `independent-live-platform-sources.md`. |
| `sources/crowdcast.js` | Crowdcast.io | standard | 1 | - | quick/heavy | Crowdcast webinar chat capture; see `webinar-and-event-sources.md`. |
| `sources/discord.js` | Discord | toggle | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/dlive.js` | - | - | 1 | - | quick/heavy | DLive source and manifest row exist, but public site-card routing needs reconciliation; see `independent-live-platform-sources.md`. |
| `sources/ebay.js` | eBay Live | standard | 1 | all_frames | quick/heavy | eBay Live chat, viewer, reaction, auction, commerce, and follower events; see `live-commerce-sources.md`. |
| `sources/estrim.js` | Estrim | standard | 1 | - | quick/heavy | Estrim rendered chat and badge capture; see `independent-live-platform-sources.md`. |
| `sources/facebook.js` | Facebook Live | standard | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/fansly.js` | Fansly | popout | 1 | - | quick/heavy | Fansly chatroom message and tip capture; see `creator-live-cam-sources.md`. |
| `sources/favorited.js` | Favorited | popout | 1 | - | quick/heavy | Favorited studio popout chat capture with badge handling; see `regional-and-emerging-platform-sources.md`. |
| `sources/fc2.js` | FC2 | standard | 1 | - | quick/heavy | FC2 rendered chat capture with placeholder-avatar handling; see `independent-live-platform-sources.md`. |
| `sources/floatplane.js` | FloatPlane | popout | 1 | - | quick/heavy | FloatPlane popout livechat capture; see `popout-chat-only-sources.md`. |
| `sources/gala.js` | Gala Music | standard | 1 | - | quick/heavy | Gala Music rendered streaming chat capture; see `event-and-community-sources.md`. |
| `sources/generic.js` | Rozy.tv; Instafeed | standard | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/goodgame.js` | GoodGame.ru | popout | 1 | - | quick/heavy | GoodGame chat URL capture with badges/avatar fallback; see `popout-chat-only-sources.md`. |
| `sources/grabvideo.js` | - | - | 0 | - | quick/heavy | Standalone VDO.Ninja SDK/helper; see `manual-static-and-helper-sources.md`. |
| `sources/instafeed.js` | Instafeed | standard | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/instagram.js` | Instagram Live; Instagram Post Comments | standard, toggle | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/instagramlive.js` | Instagram Live | standard | 0 | - | heavy | Intense parser/event/setup validation. |
| `sources/jaco.js` | Jaco.live | standard | 1 | - | quick/heavy | Jaco.live rendered chat with duplicate suppression; see `independent-live-platform-sources.md`. |
| `sources/joystick.js` | Joystick Bot WebSocket; Joystick.tv | websocket, standard | 1 | - | quick/heavy | Joystick rendered chat capture; source-page/API mode is separate; see `special-case-platform-and-helper-sources.md`. |
| `sources/kick.js` | Kick.com | popout | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/kick_new.js` | Kick.com | popout | 0 | - | heavy | Intense parser/event/setup validation. |
| `sources/kiwiirc.js` | IRC KiwiIRC | standard | 1 | - | quick/heavy | KiwiIRC rendered IRC source; see `embedded-chat-widget-sources.md`. |
| `sources/kwai.js` | - | - | 1 | - | quick/heavy | Kwai Studio chat, event/gift, and viewer-update capture; see `regional-and-emerging-platform-sources.md`. |
| `sources/lfg.js` | LFG.tv | standard | 1 | - | quick/heavy | LFG chat, tips, replies, badges, and viewer-update behavior; see `independent-live-platform-sources.md`. |
| `sources/linkedin.js` | LinkedIn Events | standard | 1 | - | quick/heavy | LinkedIn live/event comment capture; see `event-and-community-sources.md`. |
| `sources/livepush.js` | LivePush | standard | 1 | - | quick/heavy | LivePush multichat capture with relayed platform type; see `event-and-community-sources.md`. |
| `sources/livestorm.js` | Livestorm.io | standard | 1 | - | quick/heavy | Livestorm sidebar/plugin chat capture; see `webinar-and-event-sources.md`. |
| `sources/livestream.js` | - | - | 1 | - | quick/heavy | Livestream.com manifest-backed chat capture; see `webinar-and-event-sources.md`. |
| `sources/locals.js` | Locals.com | standard | 1 | - | quick/heavy | Locals chat, replies, content images, tips, dedupe, and viewer-update behavior; see `independent-live-platform-sources.md`. |
| `sources/loco.js` | Loco.gg | standard | 1 | - | quick/heavy | Loco rendered chat, sticker/content image, and dedupe behavior; see `independent-live-platform-sources.md`. |
| `sources/meetme.js` | MeetMe | standard | 1 | all_frames | quick/heavy | MeetMe rendered chat capture with all-frame manifest behavior; see `community-membership-webapp-sources.md`. |
| `sources/meets.js` | Google Meet | toggle | 1 | - | quick/heavy | Google Meet communication source; see `communication-and-sensitive-sources.md`. |
| `sources/megaphonetv.js` | MegaphoneTV | standard | 1 | all_frames | quick/heavy | MegaphoneTV Social Harvest message capture; see `event-and-community-sources.md`. |
| `sources/minnit.js` | Minnit Chat | standard | 1 | all_frames | quick/heavy | Minnit iframe/popout chat capture; see `embedded-chat-widget-sources.md`. |
| `sources/mixcloud.js` | Mixcloud Live | popout | 1 | - | quick/heavy | Mixcloud live chat capture with profile/subscription row parsing; see `popout-chat-only-sources.md`. |
| `sources/mixlr.js` | Mixlr | standard | 1 | - | quick/heavy | Mixlr event chat capture with public limited/paywall caveat; see `video-broadcast-platform-sources.md`. |
| `sources/myfreecams.js` | MyFreeCams | standard | 1 | - | quick/heavy | MyFreeCams rendered chat, badges, avatar, and userid capture; see `creator-live-cam-sources.md`. |
| `sources/nextcloud.js` | NextCloud | standard | 1 | - | quick/heavy | Domain-specific NextCloud Talk/call chat capture; see `community-membership-webapp-sources.md`. |
| `sources/nicovideo.js` | NicoVideo | standard | 1 | - | quick/heavy | NicoVideo rendered live comment capture; see `video-broadcast-platform-sources.md`. |
| `sources/nimo.js` | Nimo.TV | popout | 1 | - | quick/heavy | Nimo popout chat capture with badge parsing; see `popout-chat-only-sources.md`. |
| `sources/nonolive.js` | NonOLive | standard | 1 | - | quick/heavy | NonOLive partial rendered chat capture; see `video-broadcast-platform-sources.md`. |
| `sources/odysee.js` | Odysee | popout | 1 | - | quick/heavy | Odysee popout chat capture; donation/rant parsing not active in inspected source; see `popout-chat-only-sources.md`. |
| `sources/on24.js` | On24; ON24 | standard | 1 | - | quick/heavy | ON24 chat and Q&A capture; see `webinar-and-event-sources.md`. |
| `sources/onlinechurch.js` | Online Church | standard | 1 | - | quick/heavy | Online Church chat and viewer-update source; see `embedded-chat-widget-sources.md`. |
| `sources/openai.js` | ChatGPT | toggle | 1 | - | quick/heavy | ChatGPT/OpenAI page capture; see `communication-and-sensitive-sources.md`. |
| `sources/openstreamingplatform.js` | - | - | 1 | - | quick/heavy | OpenStreamingPlatform demo chat-only capture; public routing needs reconciliation; see `video-broadcast-platform-sources.md`. |
| `sources/owncast.js` | Owncast | standard | 1 | - | quick/heavy | Owncast rendered chat and badge capture; see `video-broadcast-platform-sources.md`. |
| `sources/parti.js` | Parti | popout | 1 | - | quick/heavy | Parti popout chat capture with tip and viewer heartbeat behavior; see `popout-chat-only-sources.md`. |
| `sources/patreon.js` | Patreon | toggle | 1 | - | quick/heavy | Patreon toggle-required chat/image/viewer-update capture; see `community-membership-webapp-sources.md`. |
| `sources/peertube.js` | PeerTube | standard | 1 | - | quick/heavy | PeerTube livechat plugin room capture with login prompt caveat; see `video-broadcast-platform-sources.md`. |
| `sources/picarto.js` | Picarto.tv | popout | 1 | - | quick/heavy | Picarto chatpopout capture with emote/avatar handling; see `popout-chat-only-sources.md`. |
| `sources/piczel.js` | Piczel.tv | popout | 1 | - | quick/heavy | Piczel chat page capture with image/emote handling and fragile DOM traversal; see `popout-chat-only-sources.md`. |
| `sources/pilled.js` | Pilled.net | standard | 1 | - | quick/heavy | Pilled `/comment/` rendered comment/sticker capture; see `regional-and-emerging-platform-sources.md`. |
| `sources/portal.js` | Portal | standard | 1 | - | quick/heavy | Portal stream chat capture; viewer helper needs validation; see `regional-and-emerging-platform-sources.md`. |
| `sources/pumpfun.js` | Pump.fun | standard | 1 | - | quick/heavy | Pump.fun coin-page chat and tip capture; viewer helper needs validation; see `regional-and-emerging-platform-sources.md`. |
| `sources/quakenet.js` | IRC Quakenet | standard | 1 | - | quick/heavy | QuakeNet rendered IRC source; see `embedded-chat-widget-sources.md`. |
| `sources/quickchannel.js` | QuickChannel | standard | 1 | - | quick/heavy | QuickChannel rendered chat capture; see `event-and-community-sources.md`. |
| `sources/restream.js` | Restream.io Chat | standard | 1 | - | quick/heavy | Restream aggregated chat capture with upstream source icon handling; see `video-broadcast-platform-sources.md`. |
| `sources/retake.js` | Retake.tv | standard | 1 | - | quick/heavy | Retake comment and tip capture; viewer helper needs validation; see `regional-and-emerging-platform-sources.md`. |
| `sources/riverside.js` | Riverside.fm | standard | 1 | - | quick/heavy | Riverside chat capture with disable/allow settings; see `webinar-and-event-sources.md`. |
| `sources/rokfin.js` | RokFin | popout | 1 | - | quick/heavy | RokFin popout chat capture with badges/avatar/tip parsing; see `popout-chat-only-sources.md`. |
| `sources/roll20.js` | Roll20 | standard | 1 | - | quick/heavy | Roll20 game chat capture with avatar data-URL conversion; see `community-membership-webapp-sources.md`. |
| `sources/rooter.js` | Rooter | standard | 1 | - | quick/heavy | Rooter `/stream/` live-chat capture with keepalive; see `regional-and-emerging-platform-sources.md`. |
| `sources/rumble.js` | Rumble; Rumble API URL | popout, websocket | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/rutube.js` | Rutube | popout | 1 | - | quick/heavy | Rutube live chat capture with iframe fallback; see `popout-chat-only-sources.md`. |
| `sources/sessions.js` | Sessions.us | standard | 1 | - | quick/heavy | Sessions.us meeting chat capture; see `webinar-and-event-sources.md`. |
| `sources/shareplay.js` | SharePlay.tv | standard | 1 | - | quick/heavy | SharePlay chat, reply, shoutout, Blitz/raid, and viewer-update behavior; see `regional-and-emerging-platform-sources.md`. |
| `sources/simps.js` | Simps | standard | 1 | - | quick/heavy | Simps rendered chat and viewer-update capture; see `community-membership-webapp-sources.md`. |
| `sources/slack.js` | Slack | toggle | 1 | - | quick/heavy | Slack opt-in communication source; see `communication-and-sensitive-sources.md`. |
| `sources/slido.js` | Slido | standard | 1 | - | quick/heavy | Slido question/Q&A capture with `question` flag; see `event-and-community-sources.md`. |
| `sources/sooplive.js` | SoopLive | popout | 1 | - | quick/heavy | SoopLive chat URL capture across supported chat URL shapes; see `popout-chat-only-sources.md`. |
| `sources/soulbound.js` | SoulBound.tv | standard | 0 | - | quick/heavy | SoulBound chat, tip/system, and viewer-update behavior; manifest refs need reconciliation; see `regional-and-emerging-platform-sources.md`. |
| `sources/steam.js` | Steam Broadcasts | standard | 1 | all_frames | quick/heavy | Steam Broadcast chat-only iframe capture and avatar lookup; see `video-broadcast-platform-sources.md`. |
| `sources/streamelements.js` | - | - | 1 | document_start, all_frames | quick/heavy | Source-check before detailed support answers. |
| `sources/streamlabs.js` | - | - | 1 | all_frames | quick/heavy | Source-check before detailed support answers. |
| `sources/streamplace.js` | Stream.place | standard | 1 | - | quick/heavy | Stream.place chat, replies, relayed-source parsing, and viewer updates; see `regional-and-emerging-platform-sources.md`. |
| `sources/stripchat.js` | Stripchat | standard | 1 | all_frames | quick/heavy | Stripchat rendered chat and tip capture with dedupe/scan fallback; see `creator-live-cam-sources.md`. |
| `sources/substack.js` | Substack | standard | 1 | - | quick/heavy | Substack live-stream chat, joined rows, and viewer updates; see `regional-and-emerging-platform-sources.md`. |
| `sources/teams.js` | Microsoft Teams | standard | 1 | all_frames | quick/heavy | Microsoft Teams communication source; see `communication-and-sensitive-sources.md`. |
| `sources/telegram.js` | Telegram | toggle | 1 | - | quick/heavy | Telegram `/z` and `/a` communication source; see `communication-and-sensitive-sources.md`. |
| `sources/telegramk.js` | Telegram | toggle | 1 | - | quick/heavy | Telegram `/k` communication source; see `communication-and-sensitive-sources.md`. |
| `sources/tellonym.js` | Tellonym | standard | 1 | - | quick/heavy | Tellonym message-only capture with blank name/avatar; see `community-membership-webapp-sources.md`. |
| `sources/tikfinity.js` | - | - | 1 | all_frames | quick/heavy | Tikfinity read-only activity-feed ingest normalized as TikTok events; see `regional-and-emerging-platform-sources.md`. |
| `sources/tiktok.js` | TikTok Live | standard | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/tradingview.js` | TradingView Streams | standard | 1 | - | quick/heavy | TradingView Streams rendered chat capture; see `event-and-community-sources.md`. |
| `sources/trovo.js` | - | - | 1 | document_start, all_frames | quick/heavy | Trovo chat URL capture with badges/name color; public routing needs reconciliation; see `video-broadcast-platform-sources.md`. |
| `sources/truffle.js` | Truffle.vip | standard | 1 | - | quick/heavy | Truffle chat capture with upstream Twitch/YouTube type behavior; see `video-broadcast-platform-sources.md`. |
| `sources/twitcasting.js` | TwitCasting | standard | 1 | - | quick/heavy | TwitCasting rendered comment capture; see `video-broadcast-platform-sources.md`. |
| `sources/twitch.js` | Twitch; Twitch IRC WebSocket | popout, websocket | 1 | document_start | heavy | Intense parser/event/setup validation. |
| `sources/uscreen.js` | uScreen | standard | 1 | - | quick/heavy | uScreen-style live chat capture with domain-derived payload type; see `regional-and-emerging-platform-sources.md`. |
| `sources/vdoninja.js` | VDO.Ninja | popout | 1 | all_frames | quick/heavy | Source-check before detailed support answers. |
| `sources/velora.js` | Velora.tv | standard | 1 | - | quick/heavy | Velora rendered chat/activity capture; OAuth/API mode is separate; see `special-case-platform-and-helper-sources.md`. |
| `sources/vercel.js` | Vercel Demo | standard | 1 | - | quick/heavy | Demo launcher session-ID helper, not chat capture; see `special-case-platform-and-helper-sources.md`. |
| `sources/verticalpixelzone.js` | Vertical Pixel Zone | standard | 1 | - | quick/heavy | Vertical Pixel Zone rendered chat capture with source/type identity caveat; see `special-case-platform-and-helper-sources.md`. |
| `sources/vimeo.js` | Vimeo | standard | 1 | all_frames | quick/heavy | Vimeo chat and Q&A/sidebar capture with `question` flag; see `video-broadcast-platform-sources.md`. |
| `sources/vklive.js` | VK Live | standard | 1 | - | quick/heavy | VK Live rendered video chat capture with optional account filter; see `regional-and-emerging-platform-sources.md`. |
| `sources/vkplay.js` | VK Play Live | popout | 0 | - | quick/heavy | Older/unreferenced VK Play chat parser in this pass; see `popout-chat-only-sources.md`. |
| `sources/vkvideo.js` | - | - | 1 | - | quick/heavy | Current manifest-loaded VK Play/VK Video chat-only parser with viewer updates; see `popout-chat-only-sources.md`. |
| `sources/vpzone.js` | VPZone.tv | standard | 1 | - | quick/heavy | VPZone rendered/WS-intercepted site capture; source-page/API mode is separate; see `special-case-platform-and-helper-sources.md`. |
| `sources/wavevideo.js` | Wave Video | standard | 1 | - | quick/heavy | Wave Video aggregated social chat capture; see `webinar-and-event-sources.md`. |
| `sources/webex.js` | Webex | standard | 1 | all_frames | quick/heavy | Webex meeting chat source; see `communication-and-sensitive-sources.md`. |
| `sources/webinargeek.js` | WebinarGeek | standard | 1 | - | quick/heavy | WebinarGeek shadow-DOM chat capture; see `webinar-and-event-sources.md`. |
| `sources/whatnot.js` | Whatnot | standard | 1 | - | quick/heavy | Whatnot DOM and WebSocket-assisted live-commerce capture; see `live-commerce-sources.md`. |
| `sources/whatsapp.js` | WhatsApp Web | toggle | 1 | - | quick/heavy | WhatsApp Web opt-in communication source; see `communication-and-sensitive-sources.md`. |
| `sources/whop.js` | Whop | standard | 1 | - | quick/heavy | Whop rendered chat and viewer-update capture; see `community-membership-webapp-sources.md`. |
| `sources/wix.js` | Wix Live | standard | 1 | - | quick/heavy | Wix Live rendered chat and inline-image capture; see `community-membership-webapp-sources.md`. |
| `sources/wix2.js` | - | - | 1 | all_frames | quick/heavy | Embedded Wix/Annoto widget capture that emits `type: "wix"`; see `community-membership-webapp-sources.md`. |
| `sources/workplace.js` | - | - | 0 | - | quick/heavy | Legacy/unreferenced Workplace parser; current Workplace routing starts in `facebook.md`; see `community-membership-webapp-sources.md`. |
| `sources/x.js` | X Live (Twitter); X Static Posts | popout, manual | 1 | - | quick/heavy | X live/broadcast chat capture; static/manual post capture is separate; see `special-case-platform-and-helper-sources.md`. |
| `sources/xeenon.js` | Xeenon | standard | 1 | - | quick/heavy | Xeenon rendered chat capture; viewer helper needs validation; see `regional-and-emerging-platform-sources.md`. |
| `sources/younow.js` | YouNow | standard | 1 | - | quick/heavy | YouNow rendered chat and badge capture; see `video-broadcast-platform-sources.md`. |
| `sources/youtube.js` | YouTube Live; YouTube Static Comments | popout, manual | 2 | all_frames | heavy | Intense parser/event/setup validation. |
| `sources/youtube_comments.js` | - | - | 0 | - | quick/heavy | Unmanifested YouTube live-chat helper/legacy file; see `special-case-platform-and-helper-sources.md` and `youtube.md`. |
| `sources/youtube_static.js` | - | - | 0 | - | quick/heavy | Temporary top-level YouTube static helper copy; manifest-loaded helper is `sources/static/youtube_static.js`; see `special-case-platform-and-helper-sources.md`. |
| `sources/zapstream.js` | Zap.stream | standard | 1 | - | quick/heavy | Zap.stream rendered chat capture; see `video-broadcast-platform-sources.md`. |
| `sources/zoom.js` | Zoom | standard | 1 | - | quick/heavy | Zoom chat, Q&A, poll, and reaction source; see `communication-and-sensitive-sources.md`. |

## Static Helper Source Scripts

These are helper/manual/static source scripts. They often require a toggle or explicit user action.

| File | Public Site Card Heuristic | Public Type | Manifest Refs | Flags | Current Depth | Next Extraction Need |
| --- | --- | --- | ---: | --- | --- | --- |
| `sources/static/claude.js` | Claude.ai | toggle | 1 | - | quick/heavy | Claude page font/helper behavior; see `manual-static-and-helper-sources.md`. |
| `sources/static/kick_chatroom_scout.js` | - | - | 1 | document_start | quick/heavy | Kick chatroom lookup/cache scout, not chat capture; see `manual-static-and-helper-sources.md`. |
| `sources/static/threads.js` | Threads.net | manual | 1 | - | quick/heavy | Threads manual/static capture helper; see `manual-static-and-helper-sources.md`. |
| `sources/static/twitch_points.js` | - | - | 1 | document_start | quick/heavy | Twitch channel-points/ad helper, not chat parser; see `manual-static-and-helper-sources.md`. |
| `sources/static/x.js` | X Live (Twitter); X Static Posts | popout, manual | 1 | - | quick/heavy | X/Twitter static/manual capture helper; see `manual-static-and-helper-sources.md`. |
| `sources/static/youtube_static.js` | - | - | 1 | - | quick/heavy | YouTube static/watch-page helper; see `manual-static-and-helper-sources.md`. |

## Injected Helper Source Scripts

These run in special page contexts or early-load paths. Treat them as fragile and source-check before detailed answers.

| File | Public Site Card Heuristic | Public Type | Manifest Refs | Flags | Current Depth | Next Extraction Need |
| --- | --- | --- | ---: | --- | --- | --- |
| `sources/inject/streamelements-ws.js` | - | - | 0 | - | quick/heavy | StreamElements main-world WebSocket interceptor consumed by `sources/streamelements.js`; see `manual-static-and-helper-sources.md`. |
| `sources/inject/vpzone-ws.js` | - | - | 1 | document_start | quick/heavy | VPZone main-world WebSocket interceptor consumed by `sources/vpzone.js`; see `manual-static-and-helper-sources.md`. |
| `sources/inject/whatnot-ws.js` | - | - | 1 | document_start | quick/heavy | Whatnot main-world WebSocket interceptor consumed by `sources/whatnot.js`; see `manual-static-and-helper-sources.md` and `live-commerce-sources.md`. |

## WebSocket Source Scripts

These usually pair with `sources/websocket/*.html` pages and hosted/beta source workflows.

| File | Public Site Card Heuristic | Public Type | Manifest Refs | Flags | Current Depth | Next Extraction Need |
| --- | --- | --- | ---: | --- | --- | --- |
| `sources/websocket/bilibili.js` | Bilibili.tv; Bilibili.com | standard | 1 | - | quick/heavy | Bilibili source page, bridge, event families, and send path; see `websocket-source-pages.md`. |
| `sources/websocket/facebook.js` | Facebook Live | standard | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/websocket/irc.js` | IRC WebSocket; IRC Quakenet | websocket, standard | 1 | - | quick/heavy | IRC source page, bridge, and send path; see `websocket-source-pages.md`. |
| `sources/websocket/joystick.js` | Joystick Bot WebSocket; Joystick.tv | websocket, standard | 1 | - | quick/heavy | Joystick bot gateway, OAuth/token handling, event normalization, and send path; see `websocket-source-pages.md`. |
| `sources/websocket/kick.js` | Kick.com | popout | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/websocket/nostr.js` | - | - | 1 | - | quick/heavy | Nostr read-only bridge behavior; see `websocket-source-pages.md`. |
| `sources/websocket/rumble.js` | Rumble; Rumble API URL | popout, websocket | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/websocket/socialstreamchat.js` | - | - | 0 | - | quick/heavy | Internal/custom Social Stream Chat room source path; see `websocket-source-pages.md`. |
| `sources/websocket/stageten.js` | StageTEN.tv | standard | 0 | - | quick/heavy | StageTEN PubNub/GraphQL source page; see `websocket-source-pages.md`. |
| `sources/websocket/streamlabs.js` | - | - | 0 | - | quick/heavy | Streamlabs socket-token alert/event ingestion; see `websocket-source-pages.md`. |
| `sources/websocket/twitch.js` | Twitch; Twitch IRC WebSocket | popout, websocket | 1 | - | heavy | Intense parser/event/setup validation. |
| `sources/websocket/velora.js` | Velora.tv | standard | 1 | - | quick/heavy | Velora OAuth/API event source and send path; see `websocket-source-pages.md`. |
| `sources/websocket/vpzone.js` | VPZone.tv | standard | 1 | - | quick/heavy | VPZone OAuth/API source, event mapping, viewer counts, and send path; see `websocket-source-pages.md`. |
| `sources/websocket/youtube.js` | YouTube Live; YouTube Static Comments | popout, manual | 1 | - | heavy | Intense parser/event/setup validation. |

## Other WebSocket Source Assets

| File | Current Depth | Notes |
| --- | --- | --- |
| `sources/websocket/bilibili.html` | quick/heavy | Bilibili source page UI/socket asset; see `websocket-source-pages.md`. |
| `sources/websocket/custom_emotes.json` | quick/heavy | Shared/custom emote data for WebSocket/API source pages; see `websocket-source-pages.md`. |
| `sources/websocket/emotes.json` | quick/heavy | Shared emote data for WebSocket/API source pages; see `websocket-source-pages.md`. |
| `sources/websocket/facebook.html` | heavy | Facebook API/source page asset; see `facebook.md`. |
| `sources/websocket/irc.html` | quick/heavy | IRC source page UI asset; see `websocket-source-pages.md`. |
| `sources/websocket/joystick.html` | quick/heavy | Joystick source page UI/auth asset; see `websocket-source-pages.md`. |
| `sources/websocket/kick.css` | heavy | Kick source-page styling; see `kick.md`. |
| `sources/websocket/kick.html` | heavy | Kick source page asset; see `kick.md`. |
| `sources/websocket/nostr.html` | quick/heavy | Nostr source page UI asset; see `websocket-source-pages.md`. |
| `sources/websocket/rumble.html` | heavy | Rumble API/source page asset; see `rumble.md`. |
| `sources/websocket/socialstreamchat.html` | quick/heavy | Social Stream Chat source page UI asset; see `websocket-source-pages.md`. |
| `sources/websocket/stageten.html` | quick/heavy | StageTEN source page UI asset; see `websocket-source-pages.md`. |
| `sources/websocket/streamlabs.html` | quick/heavy | Streamlabs socket-token source page UI asset; see `websocket-source-pages.md`. |
| `sources/websocket/twitch.html` | heavy | Twitch IRC/EventSub source page asset; see `twitch.md`. |
| `sources/websocket/velora.css` | quick/heavy | Velora source-page styling; see `websocket-source-pages.md`. |
| `sources/websocket/velora.html` | quick/heavy | Velora source page UI/OAuth asset; see `websocket-source-pages.md`. |
| `sources/websocket/vpzone.html` | quick/heavy | VPZone source page UI/OAuth asset; see `websocket-source-pages.md`. |
| `sources/websocket/websocket-responsive.css` | quick/heavy | Shared responsive source-page styling; see `websocket-source-pages.md`. |
| `sources/websocket/youtube.css` | heavy | YouTube source-page styling; see `youtube.md`. |
| `sources/websocket/youtube.html` | heavy | YouTube Data API/source page asset; see `youtube.md`. |

## Follow-Up Tasks

- Replace heuristic public-site matches with an exact generated manifest-to-site map.
- Keep inventory-only rows at zero for current source files; add a quick extraction note whenever a new source file appears.
- Add columns for auth required, send-chat support, event richness, app parity, and known platform fragility after source validation.
- Update this matrix whenever a source file is added, removed, renamed, or promoted from inventory-only to quick/heavy/intense coverage.
