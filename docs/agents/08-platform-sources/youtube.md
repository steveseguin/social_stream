# YouTube Source

Status: intense extraction pass on 2026-07-22, correcting and extending the 2026-06-24 heavy pass. Source-backed with line anchors; not live-stream validated. Known defects tracked in `../issues/ISSUE-015` through `ISSUE-018`.

## Purpose

Document YouTube capture modes, mode selection, OAuth/API behavior, state machines and fallbacks, URL parameters, settings toggles, message payloads, and common support issues.

## Source Anchors

- `social_stream/manifest.json` (`:378-392`)
- `social_stream/sources/youtube.js` (DOM mode, 2751 lines)
- `social_stream/sources/static/youtube_static.js`
- `social_stream/sources/youtube_comments.js` (not manifest-registered; orphaned/dynamically loaded)
- `social_stream/sources/websocket/youtube.html` (API polling + streaming, inline implementation, 7433 lines)
- `social_stream/sources/websocket/youtube.js` (extension/app relay)
- `social_stream/providers/youtube/liveChat.js` (provider core — **Lite only**, see below)
- `social_stream/lite/plugins/youtubePlugin.js`, `lite/plugins/youtubeStreamingPlugin.js`
- `social_stream/docs/event-reference.html`
- `social_stream/docs/youtube-project-setup.html`
- `ssapp/resources/electron-youtube-handler.js` (separate ssapp repo)

## Capture Mode Inventory

| Mode | Implementation | How selected |
| --- | --- | --- |
| DOM scraping | `sources/youtube.js` | Manifest injects on `watch?v=*&socialstream`, `youtube.com/live_chat*`, `studio.youtube.com/live_chat*` (`manifest.json:378-384`). Just open the chat page. |
| Static page scraping | `sources/static/youtube_static.js` | Injected on `https://www.youtube.com/*` (`manifest.json:391-392`). |
| Data API **streaming** (default for WS page) | inline in `sources/websocket/youtube.html:3840-3924` | Default when the websocket page connects (`connect()` schedules `startLiveChatStream`, `:5938`). |
| Data API **polling** (fallback only) | inline in `sources/websocket/youtube.html` | Entered only via `liveChatPollingFallbackActive` (`:3757-3765`, `:3895-3897`). **No user toggle or URL param forces polling.** |
| Lite polling / streaming | `lite/plugins/youtubePlugin.js` (`pollInterval=5000`, `:99`), `youtubeStreamingPlugin.js` | Lite UI checkbox "Use YouTube streaming API (beta)" (`youtubePlugin.js:220-264`). |
| ssapp owner-auth discovery | `ssapp/resources/electron-youtube-handler.js` | App UI; seeds the websocket page token store (see OAuth section). |

Key correction from the previous pass: **the websocket page implements polling and streaming inline** (`youtube.html:3530-3962`). `providers/youtube/liveChat.js` is used **only by Lite** (`youtubeStreamingPlugin.js:1-6,71-78`); nothing in the extension/Electron path imports it. The provider's polling mode is **not implemented** — it throws `NOT_IMPLEMENTED` (`liveChat.js:180-182`) and its 4000 ms polling default is dead config.

## Standard DOM Capture

Entry: 1s `checkTimer` finds the chat renderer (`sources/youtube.js:1986-1992`, `:2406-2411`), binds a MutationObserver (`:2342-2368`), seeds/skips existing items (`:2304-2320`), dispatches per node via `checkType` (`:1849-1886`) after `captureDelay` (200 ms default).

Tag → event map (`:1851-1885`):

| DOM card | `event` value |
| --- | --- |
| paid-message | `superchat` |
| paid-sticker | `supersticker` |
| `yt-gift-message-view-model` | `jeweldonation` |
| membership-item w/ `show-only-header`+`modern` | `membershiprenewal` (see ISSUE-017 — undocumented event leak) |
| header-renderer | `sponsorship` |
| gift redemption / purchase renderers | `giftredemption` / `giftpurchase` |
| redirect banner | `redirect` (DOM-only; not in the Data API) |

Captured fields (`:1576-1642`): `chatname`, `nameColor` (mod `#5e84f1`, member `#107516`, gated by `nosubcolor`), `chatbadges`, `backgroundColor`/`textColor` from CSS vars, `chatmessage` (emote HTML), `chatimg`, `initial`/`reply` (skipped by `excludeReplyingTo`), `hasDonation`, `donoValue`, `membership`, `mod`, `member`, `subtitle` (member months/tier), `videoid`, `textonly`, `type` `youtube`|`youtubeshorts` (Shorts from URL `:1668-1679`), `contentimg`+`meta.youtubeGift` for jewels, `meta.messageId` = DOM element id (dock delete-sync depends on this), `sourceName`/`sourceImg` via `api.socialstream.ninja/youtube/channel_info`, `event`.

Other DOM behaviors:

- Donation parsing: `#purchase-amount` selectors + aria-label/currency heuristics (`:109-149`); jewel/gift parsing `:187-305`.
- Deletes: MutationObserver on `is-deleted` → `{delete:{chatname,type,id}}` (`:307-340`).
- Viewer count: `api.socialstream.ninja/youtube/viewers?video=` every 30 s when `showviewercount`/`hypemode`; quota failure → scrape watch page `originalViewCount`, slow to 118 s (`:2521-2653`).
- Dedupe: element-id Set capped at 300 (`:1006-1028`).
- `customyoutubestate` kills capture entirely (`:999-1001`).

## YouTube Studio Capture

Studio live chat (`studio.youtube.com/live_chat`) is a supported DOM surface, but membership/gift cards depend on what YouTube renders for the signed-in account — do not promise popout parity.

## Stale Chat Recovery

Stale-feed reload exists only on `youtube.com/live_chat` and `studio.youtube.com/live_chat`: needs ≥3 messages seen, adaptive 60 s–5 min window, ≤60 reloads/hr, disabled by `disableYoutubeStaleReload` (`sources/youtube.js:2217-2274`). Soak-test findings (2026-05-24, comments at `:2217-2231`): reloading the popout reliably restarts the feed; synthetic events do not.

Support implication: "chat stopped after working" → reload the chat popout; this is source-backed, not generic advice.

## Data API Capture (websocket page)

The page is opened with `?v=VIDEO` or `?channel=NAME` (`youtube.html:6787-6788`). OAuth sign-in is **mandatory** — there is no API-key-only path (`:3948-3951`); a custom API key is only appended when authSource=custom (`applyApiKeyOverride :7144-7160`).

### Shared message funnel

Polling and streaming both funnel into `processLiveChatResponseData` (`:4196-4504`) — one mapping to maintain. Snake_case keys and SNAKE types are normalized first (`:3556-3582`, `:3491-3512`).

### Streaming (default)

- Endpoint: `GET www.googleapis.com/youtube/v3/liveChat/messages/stream`, `part=id,snippet,authorDetails`, maxResults 500 (`:3584-3596`). (Comment at `:3594`: the gRPC `:streamList` path 404s.)
- Long-lived `fetch` + `ReadableStream` reader (`:3855-3863`) with a custom incremental JSON extractor (`:3611-3690`).
- `offlineAt` → `handleLiveChatEnded` → emits `live_chat_ended` (`:3703-3705`, `:5690-5724`).

### Polling (fallback)

- Endpoint: `GET .../liveChat/messages?liveChatId&part=id,snippet,authorDetails&maxResults=500&profileImageSize=88&pageToken=` (`buildLiveChatPollingUrl :3598-3609`).
- Interval: `data.pollingIntervalMillis || 5000` (`:4200-4201`); quiet-chat backoff 2500/5000/8000 ms after 1/3/10 empty polls (`:4472-4491`); `slowerpoll` ×1.5 (`:4493-4495`), auto-disabled after 3 consecutive maxed pages (`:4462-4467`).
- `nextPageToken` persisted (`:4454`); initial backlog suppressed via `initialBacklogTimestamp` (`:4215-4224`, `:4234`).

### liveChatId resolution

Video → `videos.list part=snippet,liveStreamingDetails,statistics` (`:5789-5798`). Channel → `channels.list` by id / forUsername / forHandle / cached search / `search.list` (warns 100 quota units, `:5048-5054`) → `search.list eventType=live` → `videos.list` (`:5082-5107`); `getLiveChatId` fallback (`:5108-5125`). Channel→search cache TTL 1 h (`:575-576`, `:2631-2677`).

### State machine and fallbacks

Flags: `liveChatStreamActive/AbortController/Stopping/PollingFallbackActive/PollingActive` (`:635-640`).

| Condition | Behavior |
| --- | --- |
| stream 403 quota | quota banner + stream retry in 5 min (`:3781-3786`) |
| stream 403 non-quota | **sticky switch to polling** after 30 s (`:3787-3789`) — never returns to streaming until full reconnect |
| stream 429 | quota banner + backoff 60 s·2^n, cap 300 s (`:3791-3797`) |
| stream other error | polling fallback, backoff 10 s·2^n, cap 60 s (`:3799-3802`) |
| polling errors | mirror the above but stay polling (`:3805-3838`) |
| 401 | refresh token, then `scheduleAuthRetry` (`:3776-3779`, `:3476-3489`) |
| clean EOF | reschedule at `max(1000, pollingIntervalMillis)` (`:3884-3890`) |
| `liveChatEnded` / `offlineAt` | `handleLiveChatEnded`, emits `live_chat_ended` (`:3739-3742`) |

There is **no DOM↔API cross-mode fallback**; the quota message only suggests switching to scraping (`:3751`).

Status beacons to the extension/app: `signin_required`/`connected`/`disconnected`/`error` with codes `youtube_not_live|youtube_chat_not_ready|youtube_chat_inactive|youtube_connect_error|youtube_send_not_ready|youtube_fetch_abort` (`sources/websocket/youtube.js:10-29,64-76,98-110`; `youtube.html:720-756`).

Known gaps: API-mode `messageDeleted`/`messageRetracted` are dropped (ISSUE-018); Super Chat is double-emitted (ISSUE-015).

## OAuth Flows

| Flow | Where | Scopes | Token handling |
| --- | --- | --- | --- |
| Hosted SSO bridge (default; extension/web/app) | `youtube.html:282-291,4668-4722`; `youtube_auth.js:4-6,183-226` | readonly: `youtube.readonly` + `youtube.channel-memberships.creator`; admin adds `youtube.force-ssl` (`:275-281`) | `sso.socialstream.ninja/youtube/auth|/token|/refresh`, legacy `ytauth.socialstream.ninja` as fallback on network/401/403/405/5xx (`:4692-4722`). Tokens in page localStorage `youtubeOAuthToken/Expiry/RefreshToken` (`:3229-3252`); auto-refresh `refreshAccessToken :4723-4766` |
| Implicit fragment (legacy) | `youtube.html:4587-4604` | same | `#access_token` parsed; no refresh token |
| Custom Google OAuth (desktop only) | `youtube.html:366-399,4784-4800` | same levels | Requires `client_id`+`client_secret`+`api_key` (URL or localStorage overrides). Exchange/refresh via app IPC → `electron-youtube-handler.js:884-919`; `access_type=offline&prompt=consent` (`:83-93`) |
| Loopback server (app) | `electron-youtube-handler.js:137-287` | caller-supplied | `127.0.0.1`, ports **8181 then 8080** (`:15-17`), callback `/sources/websocket/youtube.html`, opens default browser, state-mismatch CSRF page (`:183-194`), 5-min timeout, port-conflict dialog naming Streamer.bot (`:262-277`) |
| Owner-auth (app) | `electron-youtube-handler.js:625-723` | **readonly only** (`:25-28`) | IPC `youtube-owner-auth-start/-confirm/-list/-clear` + `youtube-owner-broadcasts` (`:941-981`); multi-channel pick after `channels?mine=true`; tokens encrypted with `safeStorage` in electron-store (`:29-35`, `:373-398`); refresh via hosted `/refresh` 60 s early (`:725-757`); seeds the websocket page localStorage via hidden window `SSYouTubeAuthStore.seed` (`:476-551`) |

Access-level default is **`admin`** (write scope) when unset (`youtube.html:300-303`) — readonly is opt-in. Write gates: send (`:5195-5197`), delete (`:5366-5368`), ban (`:5390-5397`), metadata edit (`:5313-5317`).

Owner vs viewer: "owner" = the signed-in broadcaster's own channel — required for `myRecentSubscribers` new-follower alerts (`:2502-2508` requires target == authenticated channel) and all write actions. Reading other channels' chats works with a readonly token.

Support implication: app sign-in failures → check port conflicts on 8181/8080 (Streamer.bot commonly holds 8080).

## URL Parameters (websocket page)

Query or hash (`:599-620,6787-6792,7021`):

| Param | Effect |
| --- | --- |
| `v` / `videoId` / `video_id` | target video |
| `channel` / `username` / `c` | target channel |
| `slowerpoll` | ×1.5 poll interval |
| `authonly` / `signinonly` | auth-only mode, no connect |
| `autostartauth` / `autoauth` | auto-start OAuth |
| `ssapp` | force desktop-context detection (`:350-356`) |
| `shorts` | emit `type: youtubeshorts` (`:475-489`) |
| `client_id` / `client_secret` / `api_key` | custom Google project creds (desktop) |
| `code`, `state` | OAuth callback |
| `#access_token` | legacy implicit token |

## Settings Toggles

DOM mode: `textonlymode`, `nosubcolor`, `customyoutubestate`, `limitedyoutubememberchat`, `memberchatonly`, `excludeReplyingTo`, `bttv`/`seventv`/`ffz`, `delayyoutube`, `youtubeLargerFont`, `showviewercount`, `hypemode`, `disableAutoLiveYoutube`, `disableYoutubeAutoScroll`, `disableYoutubeStaleReload`, `translation`, `customDonationThankYou`.

WS/API page adds: `captureliketotals` (`likes_update` opt-in; legacy `captureyoutubelikes` is synchronized as a compatibility alias), `showsubscount` (`:5739`), `memberchatonly`/`limitedyoutubememberchat` (`:6013`, `:6120-6125`), `excludeReplyingTo` (`:2727-2730`), plus page-local advanced toggles in localStorage `youtubeAdvancedControls`: `syncDeleteMessages`/`syncBlockUsers`/`hideMetrics`/`subscriberAlertMessages` (default false), `groupSubscriberAlerts` (default **true**) (`:2587-2606`).

## Event And Payload Notes

Chat base (`:6128-6147`): `chatname, chatbadges, userid, nameColor, chatmessage, chatimg, videoid, membership, mod, type, textonly, hasDonation:"", initial/reply?, meta.messageId`.

| Event | Where | Key fields |
| --- | --- | --- |
| `superchat` | `:6167-6211` | `hasDonation=amount`, `chatmessage=userComment`, `textColor:"#111"` — double-emitted, ISSUE-015 |
| `supersticker` | `:6629-6688` | `hasDonation=amount`, message = parsed quote or altText; **no sticker image** |
| `jeweldonation` | `:6212-6280` | `hasDonation="N Jewels"|"1 YouTube Gift"`, `subtitle=giftName`, `contentimg=giftUrl`, `meta.youtubeGift` |
| `sponsorship` | `:6513-6560`, `:6320-6407` | `membership:"new_sponsor"|"new_member"`, `subtitle=level` |
| `resub` | `:6345-6357` | `membership:"renewed_member"|"upgraded_member"` |
| `giftpurchase` | `:6458-6511` | `membership:"gift_giver"`, `subtitle="N x level"`; no donation value |
| `giftredemption` | `:6409-6456` | `membership:"gift_recipient"`, `subtitle=level` |
| `membermilestone` | `:6562-6627` | `membership:"member_milestone"`, `subtitle="N months - level"` |
| `user_banned` | `:4148-4194` | `meta{action:timeout|ban, username, userId, moderator, durationSeconds, permanent, bannedAt, endsAt}` |
| `new_follower` | `:2310-2401` | myRecentSubscribers (5-min poll, 6 h lookback, owner-only, public subs only, up to 4 h delay); grouped variant when >3 |
| `viewer_update` | `:6692-6697` | int meta; 30 s stats poll with SSN API fallback |
| `subscriber_update` | `:5738-5741` | int meta; immediate + 30-min interval |
| `view_update` | `:5743-5750` | int meta (channel viewCount) |
| `likes_update` | `:6701-6711` | absolute int meta, opt-in via `captureliketotals` or legacy `captureyoutubelikes`, 90 s heartbeat |
| `live_chat_ended` | `:5716-5723` | `meta.streamTitle?` |

DOM-only events: `membershiprenewal` (ISSUE-017), `thankyou`, `redirect`, legacy `donation`. WS/API-only: `membermilestone`, `new_follower`, `user_banned`, `live_chat_ended`, `likes_update`, `view_update`, `subscriber_update`.

Cross-platform: YouTube `sponsorship` ≈ Twitch/Kick `new_subscriber`; YouTube `giftpurchase`/`giftredemption` ≈ `subscription_gift`. Donation-value events signal via `hasDonation`; membership purchases are not donation-value events.

## Common Failures

- No messages: extension/app on, correct chat popout/Studio open, stream live; WS page needs completed OAuth.
- Wrong URL: convert watch URLs to `watch?v=VIDEO_ID` or popout chat URLs.
- Dock sees messages but overlay does not: check session ID, refresh the OBS browser source.
- Viewer count missing: enable `showviewercount` or `hypemode`.
- Membership/gift cards missing (DOM): YouTube may not render them for this account.
- Subscriber alerts late/missing: API limitation (up to 4 h, public subs only, owner auth required).
- App OAuth fails: port conflicts on 8181/8080.
- Chat stalls after working: reload the popout (stale-feed recovery exists).
- Duplicate Super Chat rows (WS mode): known defect ISSUE-015.
- Deletes not syncing (WS mode): known gap ISSUE-018 (DOM mode works).

## App Vs Extension Differences

- Extension standard mode runs in the user's Chrome session and sees whatever YouTube renders there.
- The app relays the WS page through `window.ninjafy`; the extension uses `chrome.runtime` (`sources/websocket/youtube.js`). Bridge-specific failures differ.
- Owner-auth, loopback OAuth, and custom-project creds are app-only.
- Lite is a third surface with its own polling plugin and the streaming provider core.

## Do Not Overclaim

- Do not say the WS page "uses the provider core" — streaming/polling are inline in `youtube.html`; `providers/youtube/liveChat.js` is Lite-only and its polling mode is unimplemented (ISSUE-016 covers its retry defect).
- Streaming is the default with sticky polling fallback; users cannot force polling.
- Hosted auth primary domain is `sso.socialstream.ninja`; `ytauth.socialstream.ninja` is fallback only.

## Extraction Notes

Remaining: innertube rich-chat enrichment pipeline (badges/emojis, `youtube.html:653-673,1559-1874` + `background.js:5332-5530+`); `SOURCE_CONTROL` behavior detail (`:7091-7142`, gated by advanced toggles + admin write); cross-check against `youtube-project-setup.html`.
