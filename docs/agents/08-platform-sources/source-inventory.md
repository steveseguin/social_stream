# Source Inventory

Status: heavy inventory pass started from public site metadata, manifest, and source folders. This page is an orientation map, not proof that every source currently works.

## Source Anchors

- `docs/js/sites.js`
- `docs/supported-sites.html`
- `README.md`
- `manifest.json`
- `sources/*.js`
- `sources/static/*`
- `sources/inject/*`
- `sources/websocket/*`
- `docs/agents/08-platform-sources/*.md`
- `docs/agents/13-reference/modes-and-capability-matrix.md`

## Counts Observed

Checked on 2026-06-24.

| Inventory | Count | Notes |
| --- | ---: | --- |
| Public supported-site entries in `docs/js/sites.js` | 139 | User-facing site cards grouped by setup type. |
| `manifest.json` content-script entries | 155 | Implementation URL match entries. Some entries are helpers/source pages, not public site cards. |
| Top-level `sources/*.js` files | 143 | Includes active, helper, generic, duplicate/new variants, and source-specific utilities. |
| `sources/websocket/*` HTML/JS files | 28 | 14 page/script pairs or near-pairs, plus shared source-page assets. |
| Manifest top-level source scripts | 135 | Unique `./sources/*.js` scripts referenced directly by manifest content scripts. |
| Manifest static helper scripts | 6 | `sources/static/*` scripts referenced by manifest. |
| Manifest injected helper scripts | 2 | `sources/inject/*` scripts referenced by manifest. |
| Manifest WebSocket source scripts | 11 | `sources/websocket/*.js` scripts referenced by manifest. |

Important rule: the public site list, manifest entries, and source files are overlapping but not identical. For a support answer, check all three when precision matters.

## Public Site Setup Types

`docs/js/sites.js` currently classifies public site cards into these types:

| Type | Count | Meaning |
| --- | ---: | --- |
| `standard` | 100 | User normally opens the site/page directly; no public "popout required" tag. |
| `popout` | 23 | Public setup expects a popout chat or equivalent popout URL. |
| `toggle` | 9 | Requires an explicit SSN setting/menu toggle before capture. |
| `websocket` | 4 | Public setup points at an SSN WebSocket/API source page. |
| `manual` | 3 | User manually selects/pushes content. |

## Public Popout Entries

- Beamstream
- BoltPlus.tv
- Chzzk.naver.com
- Fansly
- Favorited
- FloatPlane
- GoodGame.ru
- Kick.com
- Mixcloud Live
- Nimo.TV
- Odysee
- Parti
- Picarto.tv
- Piczel.tv
- RokFin
- Rumble
- Rutube
- SoopLive
- Twitch
- VDO.Ninja
- VK Play Live
- X Live (Twitter)
- YouTube Live

Support note: if one of these sources is not capturing, first verify that the user opened the required popout/chat URL and reloaded it after enabling/reloading SSN.

## Public Toggle-Required Entries

- ChatGPT
- Claude.ai
- Discord
- Google Meet
- Instagram Post Comments
- Patreon
- Slack
- Telegram
- WhatsApp Web

Support note: for these, first verify the specific source toggle is enabled in settings, then reload the target site.

## Public Manual Entries

- Threads.net
- X Static Posts
- YouTube Static Comments

Support note: these are not normal automatic live-chat capture paths. The user must manually select/push content from the page.

## Public WebSocket Entries

- IRC WebSocket
- Joystick Bot WebSocket
- Rumble API URL
- Twitch IRC WebSocket

Support note: these public entries represent source-page/API workflows. They can differ from DOM capture in setup, event coverage, and send-chat support.

## Public Standard Entries

- Amazon Chime
- Amazon Live
- Arena Social
- BandLab
- Bigo.tv
- Bilibili.com
- Bilibili.tv
- Bitchute
- Blaze
- Blaze.stream
- Bongacams
- Buzzit
- CAM4
- Camsoda
- Castr
- CBOX
- Chatroll
- Chaturbate
- Cherry TV
- CI.ME
- Circle.so
- CloutHub
- Cozy.tv
- Crowdcast.io
- eBay Live
- Estrim
- Facebook Live
- FC2
- Gala Music
- Instafeed
- Instagram Live
- IRC KiwiIRC
- IRC Quakenet
- Jaco.live
- Joystick.tv
- LFG.tv
- LinkedIn Events
- LivePush
- Livestorm.io
- Locals.com
- Loco.gg
- MeetMe
- MegaphoneTV
- Microsoft Teams
- Minnit Chat
- Mixlr
- Moonbeam
- MyFreeCams
- NextCloud
- NicoVideo
- Noice
- NonOLive
- On24
- ON24
- Online Church
- Owncast
- PeerTube
- Pilled.net
- Portal
- Pump.fun
- QuickChannel
- Restream.io Chat
- Retake.tv
- Riverside.fm
- Roll20
- Rooter
- Rozy.tv
- Sessions.us
- SharePlay.tv
- Simps
- Slido
- SoulBound.tv
- StageTEN.tv
- Steam Broadcasts
- Stream.place
- Stripchat
- Substack
- Tellonym
- TikTok Live
- TradingView Streams
- Truffle.vip
- TwitCasting
- uScreen
- Velora.tv
- Vercel Demo
- Versus.cam
- Vertical Pixel Zone
- Vimeo
- VK Live
- VPZone.tv
- Wave Video
- Webex
- WebinarGeek
- Whatnot
- Whop
- Wix Live
- Xeenon
- YouNow
- Zap.stream
- Zoom

Support note: "standard" does not mean "always works with any URL". Verify the exact match pattern in `manifest.json` and the parser in `sources/*.js`.

## Manifest WebSocket Source Scripts

These `sources/websocket/*.js` files are currently referenced by `manifest.json`:

- `sources/websocket/bilibili.js`
- `sources/websocket/facebook.js`
- `sources/websocket/irc.js`
- `sources/websocket/joystick.js`
- `sources/websocket/kick.js`
- `sources/websocket/nostr.js`
- `sources/websocket/rumble.js`
- `sources/websocket/twitch.js`
- `sources/websocket/velora.js`
- `sources/websocket/vpzone.js`
- `sources/websocket/youtube.js`

The `sources/websocket/` folder also contains page/script pairs for:

- Bilibili
- Facebook
- IRC
- Joystick
- Kick
- Nostr
- Rumble
- Social Stream Chat
- StageTEN
- Streamlabs
- Twitch
- Velora
- VPZone
- YouTube

Not every page in the folder has the same manifest/public-doc status. Verify before promising support.

## Manifest Static And Injected Helpers

Static helper scripts referenced by manifest:

- `sources/static/claude.js`
- `sources/static/kick_chatroom_scout.js`
- `sources/static/threads.js`
- `sources/static/twitch_points.js`
- `sources/static/x.js`
- `sources/static/youtube_static.js`

Injected helper scripts referenced by manifest:

- `sources/inject/vpzone-ws.js`
- `sources/inject/whatnot-ws.js`

These helpers are not the same as ordinary DOM source scripts. They often support manual/static capture or page-context access.

## Top-Level Source Scripts

The top-level `sources/*.js` folder currently contains 143 JavaScript files:

```text
amazon.js
arenasocial.js
autoreload.js
bandlab.js
beamstream.js
bigo.js
bilibili.js
bilibilicom.js
bitchute.js
blaze.js
boltplus.js
bongacams.js
buzzit.js
cam4.js
camsoda.js
capturevideo.js
castr.js
cbox.js
chatroll.js
chaturbate.js
cherrytv.js
chime.js
chzzk.js
cime.js
circle.js
cloudhub.js
cozy.js
crowdcast.js
discord.js
dlive.js
ebay.js
estrim.js
facebook.js
fansly.js
favorited.js
fc2.js
floatplane.js
gala.js
generic.js
goodgame.js
grabvideo.js
instafeed.js
instagram.js
instagramlive.js
jaco.js
joystick.js
kick.js
kick_new.js
kiwiirc.js
kwai.js
lfg.js
linkedin.js
livepush.js
livestorm.js
livestream.js
locals.js
loco.js
meetme.js
meets.js
megaphonetv.js
minnit.js
mixcloud.js
mixlr.js
myfreecams.js
nextcloud.js
nicovideo.js
nimo.js
nonolive.js
odysee.js
on24.js
onlinechurch.js
openai.js
openstreamingplatform.js
owncast.js
parti.js
patreon.js
peertube.js
picarto.js
piczel.js
pilled.js
portal.js
pumpfun.js
quakenet.js
quickchannel.js
restream.js
retake.js
riverside.js
rokfin.js
roll20.js
rooter.js
rumble.js
rutube.js
sessions.js
shareplay.js
simps.js
slack.js
slido.js
sooplive.js
soulbound.js
steam.js
streamelements.js
streamlabs.js
streamplace.js
stripchat.js
substack.js
teams.js
telegram.js
telegramk.js
tellonym.js
tikfinity.js
tiktok.js
tradingview.js
trovo.js
truffle.js
twitcasting.js
twitch.js
uscreen.js
vdoninja.js
velora.js
vercel.js
verticalpixelzone.js
vimeo.js
vklive.js
vkplay.js
vkvideo.js
vpzone.js
wavevideo.js
webex.js
webinargeek.js
whatnot.js
whatsapp.js
whop.js
wix.js
wix2.js
workplace.js
x.js
xeenon.js
younow.js
youtube.js
youtube_comments.js
youtube_static.js
zapstream.js
zoom.js
```

## Graveyard And Deprecated Sources

`sources/graveyard/` contains retired/old source files and icons. Do not treat those as current support without checking current docs and manifest entries.

Observed graveyard examples include:

- AfreecaTV / Sooplive old variant
- Arena/Arena Social old variants
- Caffeine
- DLive old variant
- Glimesh
- Livespace
- Moonbeam
- Noice
- Omlet
- Soulbound old variant
- StageTEN old variant
- Theta
- Trovo old variant
- Twitter old variant
- Vimm
- Vstream
- Xeenon old variant

## How To Answer "Is X Supported?"

Use this order:

1. Check `docs/js/sites.js` or `docs/supported-sites.html` for public user-facing support and setup type.
2. Check `manifest.json` for URL match patterns.
3. Check `sources/*.js`, `sources/static/*`, `sources/inject/*`, or `sources/websocket/*` for current implementation.
4. Check platform-specific agent docs and support-history pages for known breakage.
5. State the setup mode and any caveat.

Safe answer shape:

```text
It is listed as supported as a [standard/popout/toggle/manual/websocket] source. Use [setup detail]. I would still verify the current source file and recent support notes before promising a specific event or send-chat feature.
```

## Follow-Up Extraction Needs

- Generate a manifest-derived table mapping every content script to URL patterns and public site names.
- Mark which public site entries have matching top-level scripts, WebSocket pages, static helpers, or injected helpers.
- Add health/status columns from recent support history.
- Reconcile duplicate public names, such as `On24` / `ON24` and `Blaze` / `Blaze.stream`.
