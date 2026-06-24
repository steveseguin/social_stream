# Supported Sites Lookup

Status: heavy public-site lookup pass started from `docs/js/sites.js`. This is a support routing table, not proof that every source currently works.

## Purpose

Use this page when a user asks whether a platform is supported, which page or popout URL to open, or whether a platform is a standard, popout, toggle-required, manual, or WebSocket source.

For support-strength rules, safe wording, app/browser boundaries, and what a public listing does or does not prove, use `public-site-support-status.md`.

For source-file, source-page, manifest-row, and grouped-doc routing for every public card, use `public-site-implementation-map.md`.

For exact implementation, check `manifest.json`, the source script, and the platform-specific agent page.

## Source Anchors

- `docs/js/sites.js`
- `docs/supported-sites.html`
- `manifest.json`
- `docs/agents/08-platform-sources/public-site-implementation-map.md`
- `sources/*.js`
- `sources/static/*`
- `sources/inject/*`
- `sources/websocket/*`
- `docs/agents/08-platform-sources/source-inventory.md`
- `docs/agents/08-platform-sources/manifest-content-scripts.md`
- `docs/agents/08-platform-sources/public-site-support-status.md`

## Current Public Counts

Checked on 2026-06-24:

| Setup Type | Count | Meaning |
| --- | ---: | --- |
| `standard` | 100 | Open the normal site/page with chat visible unless the row says otherwise. |
| `popout` | 23 | Open the platform's popout chat or equivalent chat-only URL. |
| `toggle` | 9 | Enable the matching SSN source toggle first, then reload the site. |
| `websocket` | 4 | Use an SSN source page/API workflow. |
| `manual` | 3 | Manually select/push content from the page. |
| Total | 139 | Public site cards in `docs/js/sites.js`. |

## Focused Validation Note

On 2026-06-24, a read-only inline Node metadata checker confirmed the current `docs/js/sites.js` public card counts and found no missing required `name`/`description`/`icon`/`type`/`instructions` fields.

Known metadata finding: the public card list currently has a duplicate normalized `on24` entry: card 72 is `On24` and card 116 is `ON24`. Both are `standard` cards with `on24.png`.

Evidence label: `focused-metadata-validation`; not runtime-tested. This does not prove live platform health, manifest/source behavior, public UI rendering, standalone app behavior, OBS behavior, or whether duplicate cards are visible to users.

## Answer Rules

When asked "is X supported?":

1. Search this page for the public site card.
2. State the setup type and first setup step.
3. If the user reports failure, check `manifest.json` and the source script before calling it broken.
4. If the platform has a dedicated agent page, use that page for troubleshooting.
5. Avoid promising exact events, badges, donations, moderation, or send-chat support unless the platform-specific code/docs confirm it.

Safe answer shape:

```text
It is listed as a [setup type] source. Start by [setup instruction]. If that does not capture, reload the source page after enabling SSN, confirm the session ID in the dock/overlay, and then check the current source file/manifest entry for that platform.
```

## Popout Sources

| Site | Setup |
| --- | --- |
| YouTube Live | Pop out chat from studio or guest view, or add `&socialstream` to the YouTube watch URL. |
| Twitch | Use Twitch popout chat: `https://*.twitch.tv/popout/*`. |
| X Live (Twitter) | Open the chat popout such as `https://x.com/CHANNEL/chat`; confirm chat permissions. |
| VDO.Ninja | Use the popout chat feature. |
| Kick.com | Use Kick chatroom/popout URL, such as `https://kick.com/*/chatroom` or `https://kick.com/popout/*/chat`. |
| GoodGame.ru | Use the popout chat page: `https://goodgame.ru/*/chat`. |
| Rumble | Use `https://rumble.com/chat/popup/*`; creator API source also exists in `sources/websocket/rumble.html`. |
| Odysee | Use `https://odysee.com/$/popout/*`. |
| Picarto.tv | Use `https://picarto.tv/chatpopout/CHANNELNAMEHERE/public`. |
| Mixcloud Live | Use `https://www.mixcloud.com/live/*/chat/`. |
| VK Play Live | Use `https://live.vkplay.ru/*/only-chat?*`. |
| Piczel.tv | Use `https://piczel.tv/chat/*`. |
| Nimo.TV | Use `https://www.nimo.tv/popout/chat/xxxx`. |
| FloatPlane | Use `https://*.floatplane.com/popout/livechat`; keep the main window open. |
| Chzzk.naver.com | Use `https://chzzk.naver.com/live/*/chat`. |
| Fansly | Use `https://fansly.com/chatroom/*`. |
| Favorited | Use `https://studio.favorited.com/popout/chat`. |
| Rutube | Use `https://rutube.ru/live/chat/*/`. |
| Parti | Use `https://parti.com/popout-chat?id=*`. |
| SoopLive | Use `https://www.sooplive.com/chat/*` or `https://play.sooplive.com/*?vtype=chat`. |
| Beamstream | Open `https://beamstream.gg/USERNAME/chat`. |
| BoltPlus.tv | Use `https://boltplus.tv/chatpopout*`. |
| RokFin | Use `https://rokfin.com/popout/chat/*`. |

## Toggle-Required Sources

| Site | Setup |
| --- | --- |
| Instagram Post Comments | Enable the Instagram post comments toggle, then open an Instagram post. |
| Discord | Enable the Discord toggle, then use the web version at `discord.com`. |
| Google Meet | Enable the Google Meet toggle; host/bot settings can set a custom name instead of "You". |
| WhatsApp Web | Enable the WhatsApp toggle, then use `https://web.whatsapp.com`; no avatar support is listed. |
| Telegram | Enable the Telegram toggle, then use web Telegram in stream mode. |
| Slack | Enable the Slack toggle, then use `https://app.slack.com/`. |
| ChatGPT | Enable the ChatGPT toggle, then use `https://chat.openai.com/chat` or current ChatGPT web path if supported by manifest. |
| Claude.ai | Enable the Claude toggle, then use `https://claude.ai/*`. |
| Patreon | Enable the Patreon toggle, then use `https://patreon.com/*`. |

Support note: after enabling a toggle, reload the target site. If capture still fails, check whether the current manifest entry covers the exact domain/path.

## Manual Sources

| Site | Setup |
| --- | --- |
| YouTube Static Comments | Click the SS control on YouTube, then select comments with the added buttons. |
| X Static Posts | Click Enable Overlay in X, then manually select posts to display. |
| Threads.net | Click the select/star-style control near the share icon to push a thread to dock. |

Support note: these are not normal automatic live chat capture paths.

## WebSocket Sources

| Site | Setup |
| --- | --- |
| Twitch IRC WebSocket | Use `https://socialstream.ninja/sources/websocket/twitch`. |
| Joystick Bot WebSocket | Use `https://socialstream.ninja/sources/websocket/joystick`; enter bot client ID/client secret, then connect to GatewayChannel. |
| IRC WebSocket | Use `http://socialstream.ninja/sources/websocket/irc`; supports Libera Chat and custom IRC servers. |
| Rumble API URL | Use `https://socialstream.ninja/sources/websocket/rumble.html`; paste the Live Stream API URL from Rumble. Treat that API URL as secret. |

Support note: WebSocket source pages can have different event coverage and auth requirements than DOM content scripts.

## Standard Sources

| Site | Setup |
| --- | --- |
| Facebook Live | Works with guest view, publisher view, or producer pop-up chat; creator API bridge exists at `sources/websocket/facebook.html`. |
| Instagram Live | Use `instagram.com/*/live/`; no popout needed. |
| TikTok Live | Use `tiktok.com/*/live`; keep chat open/visible when using extension capture. |
| Zoom | Use web Zoom; no popout needed. |
| VPZone.tv | Open `https://vpzone.tv/watch/USERNAME` with chat visible; API source exists at `sources/websocket/vpzone.html?channel=USERNAME`. |
| LinkedIn Events | Use supported LinkedIn live/event pages. |
| Microsoft Teams | Use Teams web pages. |
| Restream.io Chat | Use `https://chat.restream.io/chat`. |
| Owncast | Use normal Owncast page or embedded read/write chat URL. |
| Amazon Live | Use `https://www.amazon.com/live`. |
| Vimeo | Use Vimeo event/live-chat pages. |
| Crowdcast.io | Use `https://www.crowdcast.io/e/*`. |
| Bilibili.tv | Use normal live page with chat. |
| Whop | Use `https://whop.com/*`. |
| Bilibili.com | Use `https://live.bilibili.com/*`. |
| VK Live | Use `https://vk.com/*`. |
| Locals.com | Use Locals post/feed pages. |
| Amazon Chime | Use `https://app.chime.aws/meetings/xxxxxxxxx`. |
| NonOLive | Partial support; no popout needed. |
| StageTEN.tv | Use `stageten.tv` pages. |
| Blaze.stream | Keep the page/chat open; public notes say no popout support. |
| BandLab | Keep the page/chat open; public notes say no popout available. |
| Livestorm.io | Open the external sidebar/plugin that contains chat. |
| Cozy.tv | Open the normal view page. |
| Steam Broadcasts | Use `https://steamcommunity.com/broadcast/chatonly/XXXXXXXX`. |
| Whatnot | Open the normal view page. |
| eBay Live | Open the watch page. |
| Sessions.us | Use the meeting video chat, not a popout; host/bot settings can set a custom name. |
| IRC Quakenet | Use `https://webchat.quakenet.org`. |
| IRC KiwiIRC | Use `https://kiwiirc.com/nextclient/*`. |
| Webex | Use the live chat, not popout. |
| Riverside.fm | Open the chat bar; opt-out exists in extension menu. |
| Camsoda | Use `https://www.camsoda.com/*`. |
| MyFreeCams | Use `https://myfreecams.com/*` or `https://www.myfreecams.com/*`. |
| Bongacams | Use `https://bongacams.com/*` or `https://www.bongacams.com/*`. |
| CAM4 | Use `https://cam4.com/*` or `https://www.cam4.com/*`. |
| Stripchat | Use `https://stripchat.com/*`. |
| TwitCasting | Use `twitcasting.tv` pages. |
| Bigo.tv | Use `https://www.bigo.tv/*`. |
| Substack | Use live stream pages with `liveStream` or `/live-stream/` URL patterns. |
| Roll20 | Use `roll20.net` pages. |
| On24 | Use `https://*.on24.com/view/*`; Q&A questions supported. |
| Chaturbate | Use `https://chaturbate.com/*/`. |
| Cherry TV | Use `https://cherry.tv/*`. |
| SoulBound.tv | Use `https://soulbound.tv/*`. |
| Truffle.vip | Use `https://chat.truffle.vip/chat/*`. |
| Simps | Use `https://simps.com/app/*`. |
| Pilled.net | Public card says pop out chat, but setup type is standard; verify source/manifest before answering details. |
| Portal | Use `https://portal.abs.xyz/stream/*`. |
| Pump.fun | Use coin page with live chat visible. |
| Noice | Use `https://noice.com/*`; studio popout also noted historically. |
| NicoVideo | Use `https://live.nicovideo.jp/watch/*`. |
| Moonbeam | Use `https://www.moonbeam.stream/*`. |
| FC2 | Use `https://live.fc2.com/*/`. |
| Vertical Pixel Zone | Use `https://verticalpixelzone.com/*`. |
| Mixlr | Use `https://*.mixlr.com/events/*`; public notes warn of paywall/limited support. |
| Jaco.live | Use `https://jaco.live/golive`. |
| Gala Music | Use `https://music.gala.com/streaming/*`. |
| Circle.so | Use Circle-powered domains, including `https://*.circle.so/*`. |
| Estrim | Use `https://estrim.com/publications/view/*`. |
| Online Church | Use `https://*.online.church/`. |
| Wave Video | Use `https://wave.video/*`. |
| WebinarGeek | Use webinar/watch pages; chat only. |
| uScreen | Use `https://www.ilmfix.de/programs/*`. |
| Zap.stream | Use `https://zap.stream/*`. |
| MeetMe | Use `https://*.meetme.com/*` or `https://meetme.com/*`. |
| CI.ME | Use `https://ci.me/@USERNAME/live`; keep chat visible. |
| Castr | Use `https://chat.castr.io/room/XXXXXXXX`. |
| Chatroll | Use `https://chatroll.com/embed/chat/*`. |
| Tellonym | Use `https://tellonym.me/*`. |
| LivePush | Use `https://multichat.livepush.io/*`; public notes say no input field support. |
| MegaphoneTV | In Studio, select UGC and open Recent messages. |
| NextCloud | Requires domain support; example is a NextCloud call URL. |
| PeerTube | Use livechat plugin room URLs. |
| Bitchute | Use `https://www.bitchute.com/video/*`; no popout chat. |
| Buzzit | Use `https://www.buzzit.ca/event/*/chat`; community-submitted integration. |
| Joystick.tv | Use `https://joystick.tv/u/*/chat`. |
| Rooter | Use rooter pages; no popout available, pause video if needed. |
| Loco.gg | Use Loco stream pages; also works with `loco.com` domains. |
| ON24 | Duplicate public card for ON24; use `https://*.on24.com/view/*`. |
| Arena Social | Use `https://arena.social/live/*`. |
| Blaze | Use `https://blaze.stream/*`. |
| Versus.cam | Test platform at `https://versus.cam/?testchat`. |
| Vercel Demo | Demo launcher at `https://maestro-launcher.vercel.app/`. |
| CBOX | Use `https://*.cbox.ws/box/*`. |
| Wix Live | Use Wix pages and embedded Wix video widget URLs. |
| Xeenon | Use `https://xeenon.xyz/dashboard`; public notes say popout not supported. |
| Retake.tv | Use `https://retake.tv/live/*`. |
| Velora.tv | Use `https://velora.tv/*`. |
| Stream.place | Use `https://stream.place/*`. |
| TradingView Streams | Use `https://www.tradingview.com/streams/*`. |
| SharePlay.tv | Use `https://shareplay.tv/*`. |
| CloutHub | Use `https://app.clouthub.com/*`. |
| Slido | Use admin, app, or wall Slido event pages. |
| YouNow | Use `https://www.younow.com/*`. |
| Rozy.tv | Use `https://play.rozy.tv/*`. |
| QuickChannel | Use `https://play.quickchannel.com/*`. |
| Instafeed | Use `https://instafeed.me/*`. |
| Minnit Chat | Use `https://minnit.chat/*`. |
| LFG.tv | Use `https://lfg.tv/*`. |

## Known Public-List Oddities

- `On24` and `ON24` both appear as public entries.
- `Blaze` and `Blaze.stream` both appear as public entries.
- `Pilled.net` is classified as `standard` in public metadata but its instruction says to pop out chat.
- Public cards, manifest entries, and source files overlap but do not perfectly match.

Do not "fix" support answers by guessing. Check current `docs/js/sites.js`, `manifest.json`, and source files.

## Extraction Gaps

Needed intense passes:

- Generate a full public-site-to-manifest/source-file table, using `public-site-support-status.md` as the support-strength layer.
- Add health/known-issue status per platform from current support history.
- Mark send-chat, event coverage, badge/avatar/donation support, and auth requirements per site.
- Reconcile duplicated or contradictory public site cards.
