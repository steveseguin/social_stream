# Manifest Row Matrix

Status: generated inventory pass from `manifest.json` on 2026-06-24.

This page lists every current `manifest.json` content-script entry. Use it when answering whether a URL shape has an extension content-script match and which file loads first. The manifest remains the source of truth; public site/type hints are agent-routing hints, not final support proof.

For the inverse lookup from public site card to manifest row/source file, use `public-site-implementation-map.md`.

## Counts

- Content-script rows: 155
- Manifest version checked: 3.50.1
- Rows with `document_start`: 8
- Rows with `all_frames`: 18

## Reading Rules

- `Match Count` is the number of URL patterns on that manifest row.
- `Sample Match` is only the first pattern; inspect `manifest.json` for the full row.
- `Public Site Hint` and `Public Type Hint` are routing hints from script names and known public setup groups.
- Rows that load `shared/vendor/*` are local packaged dependencies for a source page, not remote executable code.

## Rows

| Row | Script(s) | Bucket | Match Count | Flags | Sample Match | Public Site Hint | Public Type Hint |
| ---: | --- | --- | ---: | --- | --- | --- | --- |
| 0 | `sources/portal.js` | top-level source | 1 | - | `https://portal.abs.xyz/stream/*` | Portal | - |
| 1 | `sources/camsoda.js` | top-level source | 1 | - | `https://www.camsoda.com/*` | Camsoda | - |
| 2 | `sources/stripchat.js` | top-level source | 3 | all_frames | `https://stripchat.com/*` | Stripchat | - |
| 3 | `sources/bongacams.js` | top-level source | 2 | - | `https://www.bongacams.com/*` | Bongacams | - |
| 4 | `sources/cam4.js` | top-level source | 2 | - | `https://www.cam4.com/*` | CAM4 | - |
| 5 | `sources/generic.js` | top-level source | 1 | - | `https://versus.cam/?testchat` | Generic/custom | - |
| 6 | `sources/zapstream.js` | top-level source | 1 | - | `https://zap.stream/*` | Zap.stream | - |
| 7 | `sources/meetme.js` | top-level source | 2 | all_frames | `https://*.meetme.com/*` | MeetMe | - |
| 8 | `sources/bigo.js` | top-level source | 1 | - | `https://www.bigo.tv/*` | Bigo.tv | - |
| 9 | `sources/lfg.js` | top-level source | 1 | - | `https://lfg.tv/*` | LFG.tv | - |
| 10 | `sources/chaturbate.js` | top-level source | 1 | - | `https://chaturbate.com/*` | Chaturbate | - |
| 11 | `sources/fansly.js` | top-level source | 1 | - | `https://fansly.com/chatroom/*` | Fansly | - |
| 12 | `sources/kwai.js` | top-level source | 1 | - | `https://studio.kwai.com/*` | - | - |
| 13 | `sources/cherrytv.js` | top-level source | 1 | - | `https://cherry.tv/*` | Cherry TV | - |
| 14 | `sources/blaze.js` | top-level source | 1 | - | `https://blaze.stream/*` | Blaze | - |
| 15 | `sources/velora.js` | top-level source | 1 | - | `https://velora.tv/*` | Velora.tv | - |
| 16 | `sources/myfreecams.js` | top-level source | 2 | - | `https://myfreecams.com/*` | MyFreeCams | - |
| 17 | `sources/pumpfun.js` | top-level source | 1 | - | `https://pump.fun/coin/*` | Pump.fun | - |
| 18 | `sources/onlinechurch.js` | top-level source | 1 | - | `https://*.online.church/*` | Online Church | - |
| 19 | `sources/beamstream.js` | top-level source | 1 | - | `https://beamstream.gg/*/chat` | Beamstream | - |
| 20 | `sources/chzzk.js` | top-level source | 2 | all frames | `https://chzzk.naver.com/live/*/chat`, `https://chzzk.naver.com/iframe/live/*/chat` | Chzzk.naver.com | - |
| 21 | `sources/parti.js` | top-level source | 1 | - | `https://parti.com/*` | Parti | - |
| 22 | `sources/wavevideo.js` | top-level source | 1 | - | `https://wave.video/*` | Wave Video | - |
| 23 | `sources/webinargeek.js` | top-level source | 2 | - | `https://*.webinargeek.com/webinar/*` | WebinarGeek | - |
| 24 | `sources/openstreamingplatform.js` | top-level source | 1 | - | `https://demo.openstreamingplatform.com/view/*chatOnly=True*` | - | - |
| 25 | `sources/streamplace.js` | top-level source | 1 | - | `https://stream.place/*` | Stream.place | - |
| 26 | `sources/simps.js` | top-level source | 1 | - | `https://simps.com/app/*` | Simps | - |
| 27 | `sources/retake.js` | top-level source | 1 | - | `https://retake.tv/*` | Retake.tv | - |
| 28 | `sources/truffle.js` | top-level source | 1 | - | `https://chat.truffle.vip/chat/*` | Truffle.vip | - |
| 29 | `sources/riverside.js` | top-level source | 1 | - | `https://riverside.fm/studio/*` | Riverside.fm | - |
| 30 | `sources/favorited.js` | top-level source | 1 | - | `https://studio.favorited.com/popout/chat` | Favorited | - |
| 31 | `sources/pilled.js` | top-level source | 1 | - | `https://pilled.net/*` | Pilled.net | - |
| 32 | `sources/whop.js` | top-level source | 1 | - | `https://whop.com/*` | Whop | - |
| 33 | `sources/uscreen.js` | top-level source | 1 | - | `https://www.ilmfix.de/programs/*` | uScreen | - |
| 34 | `sources/nicovideo.js` | top-level source | 1 | - | `https://live.nicovideo.jp/watch/*` | NicoVideo | - |
| 35 | `sources/rutube.js` | top-level source | 1 | - | `https://rutube.ru/live/chat/*/` | Rutube | - |
| 36 | `sources/fc2.js` | top-level source | 1 | - | `https://live.fc2.com/*/` | FC2 | - |
| 37 | `sources/autoreload.js` | top-level source | 1 | - | `https://*/*autoreloadwithsocialstream` | - | - |
| 38 | `sources/steam.js` | top-level source | 1 | all_frames | `https://steamcommunity.com/broadcast/chatonly/*` | Steam Broadcasts | - |
| 39 | `sources/megaphonetv.js` | top-level source | 1 | all_frames | `https://apps.megaphonetv.com/socialharvest/live/*` | MegaphoneTV | - |
| 40 | `sources/verticalpixelzone.js` | top-level source | 1 | - | `https://verticalpixelzone.com/*` | Vertical Pixel Zone | - |
| 41 | `sources/vpzone.js` | top-level source | 3 | - | `https://vpzone.tv/*` | VPZone.tv | - |
| 42 | `sources/inject/vpzone-ws.js` | injected helper | 3 | document_start | `https://vpzone.tv/*` | - | - |
| 43 | `sources/mixlr.js` | top-level source | 1 | - | `https://*.mixlr.com/events/*` | Mixlr | - |
| 44 | `sources/shareplay.js` | top-level source | 2 | - | `https://*.shareplay.tv/*` | SharePlay.tv | - |
| 45 | `sources/jaco.js` | top-level source | 1 | - | `https://jaco.live/*` | Jaco.live | - |
| 46 | `sources/cozy.js` | top-level source | 1 | - | `https://cozy.tv/*` | Cozy.tv | - |
| 47 | `sources/gala.js` | top-level source | 1 | - | `https://music.gala.com/streaming/*` | Gala Music | - |
| 48 | `sources/circle.js` | top-level source | 4 | - | `https://community.insidethe.show/*` | Circle.so | - |
| 49 | `sources/patreon.js` | top-level source | 2 | - | `https://*.patreon.com/*` | Patreon | toggle |
| 50 | `sources/sessions.js` | top-level source | 1 | - | `https://app.sessions.us/*` | Sessions.us | - |
| 51 | `sources/inject/whatnot-ws.js` | injected helper | 2 | document_start | `https://www.whatnot.com/live/*` | - | - |
| 52 | `sources/whatnot.js` | top-level source | 3 | - | `https://www.whatnot.com/live/*` | Whatnot | - |
| 53 | `sources/younow.js` | top-level source | 1 | - | `https://www.younow.com/*` | YouNow | - |
| 54 | `sources/estrim.js` | top-level source | 1 | - | `https://estrim.com/publications/view/*` | Estrim | - |
| 55 | `sources/boltplus.js` | top-level source | 2 | - | `https://boltplus.tv/chatpopout/*` | BoltPlus.tv | - |
| 56 | `sources/livestorm.js` | top-level source | 1 | - | `https://app.livestorm.co/*/live?*` | Livestorm.io | - |
| 57 | `sources/openai.js` | top-level source | 2 | - | `https://chat.openai.com/*` | ChatGPT | toggle |
| 58 | `sources/sooplive.js` | top-level source | 3 | - | `https://www.sooplive.com/chat/*` | SoopLive | - |
| 59 | `sources/bandlab.js` | top-level source | 1 | - | `https://*.bandlab.com/*` | BandLab | - |
| 60 | `sources/vercel.js` | top-level source | 1 | - | `https://maestro-launcher.vercel.app/` | Vercel Demo | - |
| 61 | `sources/twitcasting.js` | top-level source | 2 | - | `https://*.twitcasting.tv/*` | TwitCasting | - |
| 62 | `sources/cbox.js` | top-level source | 1 | all_frames | `https://*.cbox.ws/box/*` | CBOX | - |
| 63 | `sources/nonolive.js` | top-level source | 1 | - | `https://www.nonolive.com/*` | NonOLive | - |
| 64 | `sources/quakenet.js` | top-level source | 1 | - | `https://webchat.quakenet.org/*` | IRC Quakenet | - |
| 65 | `sources/kiwiirc.js` | top-level source | 1 | - | `https://kiwiirc.com/nextclient/*` | IRC KiwiIRC | - |
| 66 | `sources/loco.js` | top-level source | 5 | - | `https://*.loco.gg/*` | Loco.gg | - |
| 67 | `sources/joystick.js` | top-level source | 1 | - | `https://joystick.tv/u/*/chat` | Joystick | standard/websocket |
| 68 | `sources/rooter.js` | top-level source | 1 | - | `https://*.rooter.gg/*` | Rooter | - |
| 69 | `sources/static/claude.js` | static helper | 1 | - | `https://claude.ai/*` | Claude.ai | toggle |
| 70 | `sources/x.js` | top-level source | 9 | - | `https://www.twitter.com/*` | X / Twitter | popout/manual |
| 71 | `sources/static/x.js` | static helper | 2 | - | `https://www.x.com/*` | X / Twitter | popout/manual |
| 72 | `sources/static/threads.js` | static helper | 1 | - | `https://www.threads.net/*` | Threads.net | manual |
| 73 | `sources/tellonym.js` | top-level source | 1 | - | `https://tellonym.me/*` | Tellonym | - |
| 74 | `sources/floatplane.js` | top-level source | 1 | - | `https://*.floatplane.com/popout/livechat` | FloatPlane | - |
| 75 | `sources/castr.js` | top-level source | 1 | - | `https://chat.castr.io/*` | Castr | - |
| 76 | `sources/tradingview.js` | top-level source | 1 | - | `https://www.tradingview.com/streams/*` | TradingView Streams | - |
| 77 | `sources/nextcloud.js` | top-level source | 1 | - | `https://cloud.malte-schroeder.de/call/*` | NextCloud | - |
| 78 | `sources/youtube.js` | top-level source | 3 | - | `https://www.youtube.com/watch?v=*&socialstream` | YouTube | popout/manual |
| 79 | `sources/youtube.js` | top-level source | 1 | all_frames | `https://studio.youtube.com/live_chat*` | YouTube | popout/manual |
| 80 | `sources/websocket/youtube.js` | websocket source | 6 | - | `https://socialstream.ninja/sources/websocket/youtube*` | YouTube | popout/manual |
| 81 | `sources/static/youtube_static.js` | static helper | 1 | - | `https://www.youtube.com/*` | - | - |
| 82 | `sources/meets.js` | top-level source | 1 | - | `https://meet.google.com/*` | Google Meet | toggle |
| 83 | `sources/rokfin.js` | top-level source | 2 | - | `https://*.rokfin.com/popout/chat/*` | RokFin | - |
| 84 | `sources/slido.js` | top-level source | 3 | - | `https://app.sli.do/event/*` | Slido | - |
| 85 | `sources/quickchannel.js` | top-level source | 1 | - | `https://play.quickchannel.com/*` | QuickChannel | - |
| 86 | `sources/locals.js` | top-level source | 2 | - | `https://*.locals.com/*` | Locals.com | - |
| 87 | `sources/wix2.js` | top-level source | 1 | all_frames | `https://editor.wixapps.net/render/prod/modals/wix-vod-widget/*` | - | - |
| 88 | `sources/wix.js` | top-level source | 1 | - | `https://*.wix.com/*` | Wix Live | - |
| 89 | `sources/nimo.js` | top-level source | 2 | - | `https://www.nimo.tv/popout/chat/*` | Nimo.TV | - |
| 90 | `sources/kick.js` | top-level source | 4 | - | `https://kick.com/*/chatroom` | Kick.com | - |
| 91 | `sources/goodgame.js` | top-level source | 2 | - | `https://goodgame.ru/*/chat*` | GoodGame.ru | - |
| 92 | `sources/static/kick_chatroom_scout.js` | static helper | 1 | document_start | `https://kick.com/*` | Kick.com | - |
| 93 | `sources/cloudhub.js` | top-level source | 1 | - | `https://app.clouthub.com/*` | CloutHub | - |
| 94 | `sources/websocket/bilibili.js` | websocket source | 6 | - | `https://socialstream.ninja/sources/websocket/bilibili*` | Bilibili | - |
| 95 | `sources/bilibili.js` | top-level source | 2 | - | `https://bilibili.tv/*/live/*` | Bilibili | - |
| 96 | `sources/bilibilicom.js` | top-level source | 1 | - | `https://live.bilibili.com/*` | Bilibili.com | - |
| 97 | `sources/bitchute.js` | top-level source | 2 | - | `https://www.bitchute.com/video/*` | Bitchute | - |
| 98 | `sources/piczel.js` | top-level source | 1 | - | `https://piczel.tv/chat/*` | Piczel.tv | - |
| 99 | `sources/roll20.js` | top-level source | 2 | - | `https://*.roll20.net/*` | Roll20 | - |
| 100 | `sources/websocket/twitch.js` | websocket source | 6 | - | `https://socialstream.ninja/sources/websocket/twitch*` | Twitch | popout/websocket |
| 101 | `sources/websocket/kick.js` | websocket source | 6 | - | `https://socialstream.ninja/sources/websocket/kick*` | Kick.com | - |
| 102 | `sources/websocket/facebook.js` | websocket source | 6 | - | `https://socialstream.ninja/sources/websocket/facebook*` | Facebook Live | - |
| 103 | `shared/vendor/socket.io.min.js`<br>`sources/websocket/velora.js` | websocket source | 6 | - | `https://socialstream.ninja/sources/websocket/velora*` | Velora.tv | - |
| 104 | `sources/websocket/rumble.js` | websocket source | 6 | - | `https://socialstream.ninja/sources/websocket/rumble*` | Rumble | popout/websocket |
| 105 | `sources/websocket/joystick.js` | websocket source | 6 | - | `https://socialstream.ninja/sources/websocket/joystick*` | Joystick | standard/websocket |
| 106 | `sources/websocket/vpzone.js` | websocket source | 6 | - | `https://socialstream.ninja/sources/websocket/vpzone*` | VPZone.tv | - |
| 107 | `sources/websocket/irc.js` | websocket source | 6 | - | `https://socialstream.ninja/sources/websocket/irc*` | IRC WebSocket | websocket |
| 108 | `sources/websocket/nostr.js` | websocket source | 5 | - | `https://socialstream.ninja/sources/websocket/nostr*` | Nostr | - |
| 109 | `sources/minnit.js` | top-level source | 3 | all_frames | `https://minnit.chat/*&popout` | Minnit Chat | - |
| 110 | `sources/chatroll.js` | top-level source | 1 | all_frames | `https://chatroll.com/embed/chat/*` | Chatroll | - |
| 111 | `sources/odysee.js` | top-level source | 1 | - | `https://odysee.com/$/popout/*` | Odysee | - |
| 112 | `sources/picarto.js` | top-level source | 2 | - | `https://picarto.tv/chatpopout/*` | Picarto.tv | - |
| 113 | `sources/livepush.js` | top-level source | 1 | - | `https://multichat.livepush.io/*` | LivePush | - |
| 114 | `sources/dlive.js` | top-level source | 1 | - | `https://dlive.tv/c/*` | - | - |
| 115 | `sources/instafeed.js` | top-level source | 1 | - | `https://instafeed.me/*` | Instafeed | - |
| 116 | `sources/whatsapp.js` | top-level source | 1 | - | `https://web.whatsapp.com/` | WhatsApp Web | toggle |
| 117 | `sources/twitch.js` | top-level source | 1 | document_start | `https://*.twitch.tv/popout/*` | Twitch | popout/websocket |
| 118 | `sources/static/twitch_points.js` | static helper | 1 | document_start | `https://*.twitch.tv/*` | Twitch channel points | - |
| 119 | `sources/facebook.js` | top-level source | 5 | - | `https://facebook.com/*` | Facebook Live | - |
| 120 | `sources/ebay.js` | top-level source | 22 | all_frames | `https://www.ebay.com/ebaylive/events/*` | eBay Live | - |
| 121 | `sources/owncast.js` | top-level source | 2 | - | `https://watch.owncast.online/*` | Owncast | - |
| 122 | `sources/zoom.js` | top-level source | 4 | - | `https://*.zoom.us/*` | Zoom | - |
| 123 | `sources/crowdcast.js` | top-level source | 1 | - | `https://www.crowdcast.io/e/*` | Crowdcast.io | - |
| 124 | `sources/discord.js` | top-level source | 2 | - | `https://discord.com/*` | Discord | toggle |
| 125 | `sources/capturevideo.js` | top-level source | 1 | - | `https://discord.com/channels/*` | - | - |
| 126 | `sources/mixcloud.js` | top-level source | 1 | - | `https://www.mixcloud.com/live/*/chat/` | Mixcloud Live | - |
| 127 | `sources/vimeo.js` | top-level source | 3 | all_frames | `https://www.vimeo.com/live*` | Vimeo | - |
| 128 | `sources/livestream.js` | top-level source | 1 | - | `https://livestream.com/accounts/*` | - | - |
| 129 | `sources/on24.js` | top-level source | 1 | - | `https://*.on24.com/view/*` | ON24 | - |
| 130 | `sources/arenasocial.js` | top-level source | 1 | - | `https://arena.social/*` | Arena Social | - |
| 131 | `sources/teams.js` | top-level source | 3 | all_frames | `https://teams.live.com/*` | Microsoft Teams | - |
| 132 | `sources/peertube.js` | top-level source | 2 | - | `https://*/plugins/livechat/*router/webchat/room/*` | PeerTube | - |
| 133 | `sources/instagram.js` | top-level source | 1 | - | `https://www.instagram.com/*` | Instagram | standard/toggle |
| 134 | `sources/substack.js` | top-level source | 2 | - | `https://substack.com/*` | Substack | - |
| 135 | `sources/tiktok.js` | top-level source | 4 | - | `https://www.tiktok.com/*live*` | TikTok Live | - |
| 136 | `sources/tikfinity.js` | top-level source | 2 | all_frames | `https://tikfinity.zerody.one/widget/activity-feed*` | - | - |
| 137 | `sources/vdoninja.js` | top-level source | 3 | all_frames | `https://vdo.ninja/popout.html*` | VDO.Ninja | - |
| 138 | `sources/linkedin.js` | top-level source | 2 | - | `https://www.linkedin.com/*` | LinkedIn Events | - |
| 139 | `sources/webex.js` | top-level source | 2 | all_frames | `https://*.webex.com/*` | Webex | - |
| 140 | `sources/telegram.js` | top-level source | 2 | - | `https://*.telegram.org/z/*` | Telegram | toggle |
| 141 | `sources/telegramk.js` | top-level source | 1 | - | `https://*.telegram.org/k/*` | Telegram | toggle |
| 142 | `sources/restream.js` | top-level source | 1 | - | `https://chat.restream.io/*` | Restream.io Chat | - |
| 143 | `sources/amazon.js` | top-level source | 2 | document_start | `https://www.amazon.com/live*` | Amazon Live / Amazon Chime | - |
| 144 | `sources/rumble.js` | top-level source | 4 | - | `https://rumble.com/chat/popup/*` | Rumble | popout/websocket |
| 145 | `sources/slack.js` | top-level source | 1 | - | `https://app.slack.com/client/*` | Slack | toggle |
| 146 | `sources/chime.js` | top-level source | 1 | - | `https://app.chime.aws/meetings/*` | Amazon Chime | - |
| 147 | `sources/cime.js` | top-level source | 2 | - | `https://ci.me/*` | CI.ME | - |
| 148 | `sources/buzzit.js` | top-level source | 1 | - | `https://www.buzzit.ca/event/*/chat` | Buzzit | - |
| 149 | `sources/vklive.js` | top-level source | 1 | - | `https://vk.com/*` | VK Live | - |
| 150 | `sources/vkvideo.js` | top-level source | 3 | - | `https://live.vkplay.ru/*/only-chat?*` | - | - |
| 151 | `sources/streamlabs.js` | top-level source | 2 | all_frames | `https://streamlabs.com/alert-box/*` | Streamlabs | - |
| 152 | `sources/streamelements.js` | top-level source | 1 | document_start, all_frames | `https://streamelements.com/overlay/*` | StreamElements | - |

## Follow-Up Tasks

- Replace public site/type hints with an exact curated manifest-to-site map where support precision matters.
- Add auth, popout/toggle/manual/websocket requirement, send-chat, event richness, and fragility columns after source validation.
- Reconcile manifest-only rows, helper rows, and public site cards with no direct manifest match.
- Update this page whenever `manifest.json` content scripts change.
