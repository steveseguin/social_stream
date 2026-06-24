# Manifest Content Script Matrix

Status: heavy inventory pass started from `manifest.json`. This page summarizes source-load behavior for agent routing; the manifest remains the exact source of truth.

## Purpose

Use this page when a user asks which file handles a platform URL, why a source script loads in an iframe, why a source must run at `document_start`, or whether a public site card has an actual extension content-script match.

For exact URL pattern answers, inspect `manifest.json` directly.

## Source Anchors

- `manifest.json`
- `sources/*.js`
- `sources/static/*`
- `sources/inject/*`
- `sources/websocket/*`
- `shared/vendor/socket.io.min.js`
- `docs/agents/08-platform-sources/source-inventory.md`
- `docs/agents/12-development/adding-a-source.md`

## Current Manifest Counts

Checked on 2026-06-24 against manifest version `3.50.1`.

| Inventory | Count | Notes |
| --- | ---: | --- |
| Content-script entries | 155 | Each entry is a manifest object with one or more URL match patterns. |
| Unique JS files loaded by content scripts | 155 | One unique JS file per content-script entry in the current manifest. |
| Top-level `sources/*.js` scripts | 135 | Normal platform/source DOM capture scripts. |
| `sources/static/*` helpers | 6 | Manual/static/scout helpers, not normal live-chat capture scripts. |
| `sources/inject/*` helpers | 2 | Page-context helpers that run early for specific platforms. |
| `sources/websocket/*` source-page scripts | 11 | Scripts loaded on hosted/beta WebSocket source pages. |
| Other shared scripts | 1 | `shared/vendor/socket.io.min.js`, currently for Velora WebSocket source pages. |
| `document_start` entries | 8 | Early-load scripts. Usually fragile or page-context sensitive. |
| `all_frames` entries | 18 | Scripts that can run inside iframes as well as the top page. |
| `match_about_blank` entries | 0 | None currently observed. |

## Content Script Buckets

| Bucket | Files | What It Usually Means |
| --- | --- | --- |
| Top-level source scripts | `sources/*.js` | Extension injects directly into platform pages or popout chat pages. |
| Static helper scripts | `sources/static/*.js` | Manual/static capture, source scouting, or helper behavior on a broader site page. |
| Injected helper scripts | `sources/inject/*.js` | Early page-context access for platform internals, often paired with a normal source script. |
| WebSocket source scripts | `sources/websocket/*.js` | Hosted SSN source pages that connect to platform APIs/WebSockets and then forward into SSN. |
| Shared vendor scripts | `shared/vendor/*.js` | Local vendored dependency loaded by a source page. This is not a remote executable dependency. |

## Static Helpers In Manifest

- `sources/static/claude.js`
- `sources/static/kick_chatroom_scout.js`
- `sources/static/threads.js`
- `sources/static/twitch_points.js`
- `sources/static/x.js`
- `sources/static/youtube_static.js`

Support note: static helpers often require an explicit user action or source toggle. Do not treat them as normal automatic live-chat capture without checking the platform doc.

## Injected Helpers In Manifest

| Script | Sample URL Patterns | Notes |
| --- | --- | --- |
| `sources/inject/vpzone-ws.js` | `https://vpzone.tv/*`, `https://www.vpzone.tv/*`, `https://*.vpzone.tv/*` | Runs at `document_start`; paired with VPZone source behavior. |
| `sources/inject/whatnot-ws.js` | `https://www.whatnot.com/live/*`, `https://www.whatnot.com/dashboard/live/*` | Runs at `document_start`; paired with Whatnot source behavior. |

Support note: injected helpers are high-risk when a platform changes its page internals. Check recent source code and support notes before making strong claims.

## WebSocket Source Scripts In Manifest

These are loaded on hosted/beta SSN source-page URLs, not directly on the third-party platform page:

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

Most of these entries match multiple hosted/beta URL variants, such as `socialstream.ninja`, `beta.socialstream.ninja`, and `/beta/` paths.

## Early Or Multi-Frame Entries

These manifest entries have `document_start` and/or `all_frames` enabled. They deserve extra care because load timing and frame context can affect behavior.

| Index | Script | Matches | Run At | All Frames | Sample Pattern |
| ---: | --- | ---: | --- | --- | --- |
| 2 | `sources/stripchat.js` | 3 | default | yes | `https://stripchat.com/*` |
| 7 | `sources/meetme.js` | 2 | default | yes | `https://*.meetme.com/*` |
| 39 | `sources/steam.js` | 1 | default | yes | `https://steamcommunity.com/broadcast/chatonly/*` |
| 40 | `sources/megaphonetv.js` | 1 | default | yes | `https://apps.megaphonetv.com/socialharvest/live/*` |
| 43 | `sources/inject/vpzone-ws.js` | 3 | `document_start` | no | `https://vpzone.tv/*` |
| 52 | `sources/inject/whatnot-ws.js` | 2 | `document_start` | no | `https://www.whatnot.com/live/*` |
| 63 | `sources/cbox.js` | 1 | default | yes | `https://*.cbox.ws/box/*` |
| 80 | `sources/youtube.js` | 1 | default | yes | `https://studio.youtube.com/live_chat*` |
| 88 | `sources/wix2.js` | 1 | default | yes | `https://editor.wixapps.net/render/prod/modals/wix-vod-widget/*` |
| 93 | `sources/static/kick_chatroom_scout.js` | 1 | `document_start` | no | `https://kick.com/*` |
| 110 | `sources/minnit.js` | 3 | default | yes | `https://minnit.chat/*&popout` |
| 111 | `sources/chatroll.js` | 1 | default | yes | `https://chatroll.com/embed/chat/*` |
| 118 | `sources/twitch.js` | 1 | `document_start` | no | `https://*.twitch.tv/popout/*` |
| 119 | `sources/static/twitch_points.js` | 1 | `document_start` | no | `https://*.twitch.tv/*` |
| 121 | `sources/ebay.js` | 22 | default | yes | `https://www.ebay.com/ebaylive/events/*` |
| 128 | `sources/vimeo.js` | 3 | default | yes | `https://www.vimeo.com/live*` |
| 132 | `sources/teams.js` | 3 | default | yes | `https://teams.live.com/*` |
| 137 | `sources/tikfinity.js` | 2 | default | yes | `https://tikfinity.zerody.one/widget/activity-feed*` |
| 138 | `sources/vdoninja.js` | 3 | default | yes | `https://vdo.ninja/popout.html*` |
| 140 | `sources/webex.js` | 2 | default | yes | `https://*.webex.com/*` |
| 144 | `sources/trovo.js` | 1 | `document_start` | yes | `https://trovo.live/chat/*` |
| 145 | `sources/amazon.js` | 2 | `document_start` | no | `https://www.amazon.com/live*` |
| 153 | `sources/streamlabs.js` | 2 | default | yes | `https://streamlabs.com/alert-box/*` |
| 154 | `sources/streamelements.js` | 1 | `document_start` | yes | `https://streamelements.com/overlay/*` |

## High-Coverage URL Match Entries

These scripts have four or more manifest match patterns. This usually means broad domain coverage, multiple hosted variants, or several public URL shapes.

| Script | Match Count | Sample Patterns |
| --- | ---: | --- |
| `sources/ebay.js` | 22 | `https://www.ebay.com/ebaylive/events/*`; `https://www.ebay.co.uk/ebaylive/events/*`; `https://www.ebay.de/ebaylive/events/*` |
| `sources/x.js` | 9 | `https://www.twitter.com/*`; `https://twitter.com/*`; `https://x.com/*/chat` |
| `shared/vendor/socket.io.min.js` | 6 | `https://socialstream.ninja/sources/websocket/velora*`; `https://beta.socialstream.ninja/sources/websocket/velora*`; `https://socialstream.ninja/beta/sources/websocket/velora*` |
| `sources/websocket/bilibili.js` | 6 | hosted/beta Bilibili source page variants |
| `sources/websocket/facebook.js` | 6 | hosted/beta Facebook source page variants |
| `sources/websocket/irc.js` | 6 | hosted/beta IRC source page variants |
| `sources/websocket/joystick.js` | 6 | hosted/beta Joystick source page variants |
| `sources/websocket/kick.js` | 6 | hosted/beta Kick source page variants |
| `sources/websocket/rumble.js` | 6 | hosted/beta Rumble source page variants |
| `sources/websocket/twitch.js` | 6 | hosted/beta Twitch source page variants |
| `sources/websocket/velora.js` | 6 | hosted/beta Velora source page variants |
| `sources/websocket/vpzone.js` | 6 | hosted/beta VPZone source page variants |
| `sources/websocket/youtube.js` | 6 | hosted/beta YouTube source page variants |
| `sources/facebook.js` | 5 | `https://facebook.com/*`; `https://web.facebook.com/*`; `https://www.facebook.com/*` |
| `sources/loco.js` | 5 | `https://*.loco.gg/*`; `https://loco.gg/streamers/*`; `https://*.loco.com/*` |
| `sources/websocket/nostr.js` | 5 | hosted/beta Nostr source page variants |
| `sources/circle.js` | 4 | `https://community.insidethe.show/*`; `https://community.talkinghealthtech.com/*`; `https://members.firstinfam.com/*` |
| `sources/kick.js` | 4 | `https://kick.com/*/chatroom`; `https://kick.com/*/*/chatroom`; `https://kick.com/popout/*/chat` |
| `sources/rumble.js` | 4 | `https://rumble.com/chat/popup/*`; `https://rumble.com/*/live`; `https://www.rumble.com/chat/popup/*` |
| `sources/tiktok.js` | 4 | `https://www.tiktok.com/*live*`; `https://livecenter.tiktok.com/*`; `http://localhost:8080/*/fav.html` |
| `sources/youtube.js` | 4 | `https://www.youtube.com/watch?v=*&socialstream`; `https://youtube.com/live_chat*`; `https://www.youtube.com/live_chat*` |
| `sources/zoom.js` | 4 | `https://*.zoom.us/*`; `https://zoom.us/*`; `https://*.zoom.com/*` |

## How To Answer "Which File Handles This URL?"

Use this order:

1. Search `manifest.json` for the domain or URL shape.
2. Note the matched content-script file and whether it is top-level, static, injected, WebSocket, or shared vendor.
3. If it is a top-level script, inspect `sources/<name>.js`.
4. If it is a WebSocket script, inspect the paired `sources/websocket/<name>.html` and `<name>.js`.
5. If it is static or injected, check whether a normal source script also exists for the same platform.
6. Cross-check the public setup type in `docs/js/sites.js` and `source-inventory.md`.

Safe answer shape:

```text
The extension match for that URL is in `manifest.json` and loads `[script]`. That means this is a [normal/static/injected/websocket] source path. For exact behavior, inspect `[script]` and the platform agent page before promising specific events or send-chat support.
```

## Extraction Gaps

Needed intense passes:

- Generate a full 155-entry manifest table and map each row to a public site card, when one exists.
- Reconcile manifest-only helper/source entries that do not have public `docs/js/sites.js` cards.
- Mark send-chat, event richness, auth, popout, and source-toggle requirements per manifest row.
- Verify whether `document_start` and `all_frames` entries still need those flags.
