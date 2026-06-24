# YouTube Source

Status: heavy extraction pass. Usable for support and architecture orientation, not final field-level docs.

## Purpose

Document YouTube capture modes, setup, OAuth/API behavior, WebSocket/Data API behavior, message payloads, and common support issues.

## Source Anchors

- `social_stream/manifest.json`
- `social_stream/sources/youtube.js`
- `social_stream/sources/youtube_static.js`
- `social_stream/sources/youtube_comments.js`
- `social_stream/sources/websocket/youtube.html`
- `social_stream/sources/websocket/youtube.js`
- `social_stream/providers/youtube/liveChat.js`
- `social_stream/providers/youtube/contextResolver.js`
- `social_stream/docs/event-reference.html`
- `social_stream/docs/youtube-project-setup.html`
- `social_stream/docs/youtube-websocket-streaming-plan.md`
- `ssapp/resources/electron-youtube-handler.js`
- `ssapp/youtube.js`

## Runtime Surfaces

YouTube has two main SSN capture paths:

- Standard DOM capture through `sources/youtube.js`.
- WebSocket/Data API capture through `sources/websocket/youtube.html` and `sources/websocket/youtube.js`, with provider helpers in `providers/youtube/*`.

The manifest injects `sources/youtube.js` on YouTube live chat URLs and includes content-script matches for the hosted/local `sources/websocket/youtube.html` page. The WebSocket/Data API page is also the OAuth callback path for standalone app loopback auth.

## Standard DOM Capture

Use standard capture when the user has an actual YouTube live chat page open. It reads rendered chat DOM and forwards `{ message: data }` to the extension runtime.

Confirmed behavior:

- `sources/youtube.js` processes `yt-live-chat-*` DOM elements and sends payloads with `type: "youtube"` or `type: "youtubeshorts"`.
- Chat payloads include fields such as `chatname`, `chatmessage`, `chatimg`, `chatbadges`, `nameColor`, `backgroundColor`, `textColor`, `membership`, `subtitle`, `hasDonation`, `donoValue`, `videoid`, `sourceName`, `sourceImg`, `textonly`, and `event`.
- When YouTube exposes a native live-chat element ID, the script adds `meta.messageId`; dock/source-control delete sync depends on this.
- Replies can be included as `initial` and `reply` unless `settings.excludeReplyingTo` is enabled.
- Super Chats, Super Stickers, YouTube Gifts/Jewels, memberships, gift purchases, gift redemptions, resubs, and redirect banners are detected from DOM cards when YouTube renders them.
- Viewer counts use `https://api.socialstream.ninja/youtube/viewers?video=VIDEO_ID` when `showviewercount` or `hypemode` is enabled. If the API quota path fails, the script can fall back to scraping the watch page and slows the polling interval.
- YouTube Shorts are detected from URL/query context and are sent as `type: "youtubeshorts"`.

Support setup:

- The user should open the live chat popout or supported Studio live chat view.
- The stream must be live for live-chat behavior to be meaningful.
- For a watch URL, the canonical form is usually `https://www.youtube.com/watch?v=VIDEO_ID`.
- If the user gives a video ID manually, the script can redirect to `https://www.youtube.com/live_chat?is_popout=1&v=VIDEO_ID`.

## YouTube Studio Capture

`sources/youtube.js` explicitly checks for `studio.youtube.com/live_chat` in stale-chat handling. Treat Studio chat as a supported DOM-capture surface, but do not assume all popout-only DOM cards are visible in Studio. Membership/gift cards depend on what YouTube renders for the signed-in account.

## Stale Chat Recovery

`sources/youtube.js` includes a stale DOM feed detector for live chat. The source comments document soak-test findings from 2026-05-24:

- Reloading the live chat popout reliably restarted DOM/message flow.
- Trusted Electron wheel input also restarted the feed, but that is not currently used from `youtube.js` because it can steal focus.
- Synthetic page events, resize nudges, and component updates did not reliably restart the feed.

Support implication: if YouTube chat stops after working, refreshing/reloading the chat popout is a source-backed workaround, not just generic advice.

## WebSocket/Data API Capture

The WebSocket/Data API path is the richer YouTube integration.

Confirmed behavior:

- `sources/websocket/youtube.js` relays page events such as `youtubeMessage`, `youtubeDelete`, `youtubeVideoChanged`, `youtubeEmojiRequest`, and `youtubeRichChatRequest`.
- It can send through `chrome.runtime.sendMessage` in the extension or through `window.ninjafy.sendMessage` in the standalone app.
- It listens for `SOURCE_CONTROL` and `SEND_MESSAGE` messages from the extension/app bridge.
- It requests settings from the background page and forwards settings changes to the source page through custom DOM events.
- `providers/youtube/liveChat.js` supports polling mode and streaming mode. Default polling interval is 4000 ms; the streaming endpoint is `https://www.googleapis.com/youtube/v3/liveChat/messages:stream`.
- Provider events include status, chat, membership, Super Chat, Super Sticker, sponsor, ban, delete message, metric, error, and debug.

Event-reference notes:

- WebSocket/Data API mode is required for broader YouTube event support such as API membership/subscriber events.
- New subscriber alerts use the `myRecentSubscribers` API, can be delayed by up to 4 hours, and only include public subscriptions.
- Redirect banners are not exposed by the YouTube Data API; `redirect` remains standard DOM only.
- Optional write access uses `youtube.force-ssl`, which Google may present broadly because YouTube does not expose a chat-only write scope.

## OAuth And Standalone App Auth

The standalone app handler `ssapp/resources/electron-youtube-handler.js`:

- Uses loopback host `127.0.0.1`.
- Tries ports `8181` then `8080`.
- Uses callback path `/sources/websocket/youtube.html`.
- Supports hosted auth through `https://ytauth.socialstream.ninja/auth`.
- Supports custom Google OAuth mode through `https://accounts.google.com/o/oauth2/v2/auth`.
- Requests offline access and `prompt=consent` for custom Google mode.
- Opens the auth URL in the default browser.
- Returns an explicit port-conflict dialog when both loopback ports are unavailable.

Support implication: if YouTube sign-in fails in the standalone app, check whether ports `8181` or `8080` are already in use. Streamer.bot commonly uses port `8080`.

## Event And Payload Notes

Important event names from `docs/event-reference.html`:

- Standard DOM: `sponsorship`, `giftpurchase`, `giftredemption`, `resub`, `jeweldonation`, `donation`, `thankyou`, `redirect`, `viewer_update`.
- WebSocket/Data API: `donation`, `supersticker`, `jeweldonation`, `sponsorship`, `resub`, `giftpurchase`, `giftredemption`, `membermilestone`, `viewer_update`, `subscriber_update`, `view_update`, `live_chat_ended`, `user_banned`, `new_follower`.

Cross-platform note:

- YouTube uses `sponsorship` for new members. Twitch and Kick use `new_subscriber`.
- YouTube gift events use `giftpurchase` and `giftredemption`, not Twitch/Kick `subscription_gift`.
- Donation-like events are often signaled by `hasDonation`, even when the event name differs.

## Common Failures

- No messages: verify the extension/app is on, the correct live chat popout or Studio chat is open, and the stream is live.
- Wrong URL: convert watch URLs to `watch?v=VIDEO_ID` or popout chat URLs; stale or ended stream URLs are a common cause.
- Dock sees messages but overlay does not: check session ID and refresh the OBS browser source.
- Viewer count missing: ensure `showviewercount` or `hypemode` is enabled.
- Membership/gift cards missing: YouTube may not render these for the current account; broadcaster/moderator auth can matter.
- Subscriber alerts late/missing: YouTube API limitation. Up to 4-hour delay and private subscriptions do not appear.
- App OAuth fails: check port conflicts on `8181` and `8080`.
- Chat stalls after working: reload the live chat popout; the source has a stale-feed reload path for this exact symptom.

## App Vs Extension Differences

- Extension standard mode runs in the user's Chrome session and can see whatever YouTube renders there.
- Standalone app OAuth opens the default browser for loopback auth but the app still has Electron-specific bridge behavior.
- The WebSocket page can relay through Chrome runtime or `window.ninjafy`; failures can be bridge-specific.

## Extraction Notes

Needs intense pass:

- Exact OAuth scopes and UI labels in `sources/websocket/youtube.html`.
- Exact field mapping for every YouTube API message type.
- Send/delete/ban/moderation behavior through `SOURCE_CONTROL`.
- Current public setup docs cross-check against `youtube-project-setup.html`.
