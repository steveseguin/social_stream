# Kick Source

Status: heavy extraction pass. Usable for support and architecture orientation, not final field-level docs.

## Purpose

Document Kick capture modes, auth, WebSocket bridge behavior, channel rewards, chat sending, and support issues.

## Source Anchors

- `social_stream/manifest.json`
- `social_stream/sources/kick.js`
- `social_stream/sources/kick_new.js`
- `social_stream/sources/websocket/kick.html`
- `social_stream/sources/websocket/kick.js`
- `social_stream/providers/kick/core.js`
- `social_stream/docs/event-reference.html`
- `social_stream/docs/kick-channel-points-event-flow.md`
- `ssapp/resources/electron-kick-handler.js`
- `ssapp/resources/kick-ws-client.js`

## Runtime Surfaces

Kick has two important paths:

- Standard DOM capture from the Kick chatroom/popout page.
- Structured WebSocket/bridge capture from `sources/websocket/kick.html` and `sources/websocket/kick.js`.

The normal chat path can capture visible chat. The bridge page is the reliable path for structured rewards, subscriptions, follows, raids, KICKs/tips, moderation events, and chat sending.

## Standard DOM Capture

`sources/kick_new.js` is the current DOM capture implementation for Kick chat pages. The manifest still references `sources/kick.js`, so future extraction should confirm whether `kick_new.js` is loaded indirectly or is a replacement pending manifest update.

Confirmed behavior in `sources/kick_new.js`:

- Rewrites old `https://kick.com/CHANNEL/chatroom` URLs to `https://kick.com/popout/CHANNEL/chat`.
- Detects new popout chat and older chatroom formats.
- Extracts channel/user data from Kick's channel API.
- Polls viewer count from `https://kick.com/api/v2/channels/CHANNEL` when viewer/hype settings are enabled.
- Builds payloads with `type: "kick"`, `chatname`, `chatmessage`, `chatimg`, `chatbadges`, `nameColor`, `hasDonation`, `membership`, `textonly`, `initial`, and `reply`.
- Supports image/SVG badge extraction.
- Detects deleted/line-through messages and sends delete payloads when possible.
- Includes 7TV/emote DOM support where rendered.

Support setup:

- Prefer the current popout format: `https://kick.com/popout/CHANNEL/chat`.
- If a user has an older `/chatroom` URL, the source attempts to rewrite it.
- Keep the chat page open and signed in if Kick requires that for badges/profile data.

## WebSocket/Bridge Capture

`sources/websocket/kick.js` is the structured Kick integration.

Confirmed behavior:

- Loads shared helpers from `providers/kick/core.js` and falls back when needed.
- Initializes extension/app bridge messaging.
- Loads config, URL params, tokens, event type cache, source window config, and authenticated profile.
- Connects Pusher chat without auth after resolving the channel/chatroom.
- Uses OAuth tokens for subscriptions, bridge events, and chat sending.
- Connects a local socket bridge as well as Kick/bridge paths.
- Sends messages through Chrome runtime, `window.ninjafy`, or parent `postMessage` depending on environment.
- Sends delete payloads through the same environment-aware paths.

Important bootstrap distinction:

- Pusher chat can connect without auth for chat.
- Auth-dependent features require a Kick OAuth token and active bridge/subscription setup.

## OAuth And Standalone App Auth

The standalone app handler `ssapp/resources/electron-kick-handler.js`:

- Uses loopback host `127.0.0.1`.
- Tries ports `8181` then `8080`.
- Uses callback path `/sources/websocket/kick.html`.
- Uses PKCE with `code_challenge_method=S256`.
- Builds auth URLs at `https://id.kick.com/oauth/authorize`.
- Defaults scopes to `user:read`, `channel:read`, `chat:write`, and `events:subscribe` if the payload does not override scopes.
- Supports external browser auth and a local app auth window mode.
- Local auth window can use app preload variants, including a Kasada preload path.
- Shows a port-conflict dialog if both loopback ports are unavailable.

Support implication: if Kick OAuth fails in app, check loopback ports, whether auth opened externally or locally, and whether Kick is blocking with human verification/CAPTCHA.

## Channel Rewards And Event Flow

`docs/kick-channel-points-event-flow.md` is the best current setup doc.

Confirmed setup:

1. Create the reward in Kick.
2. Open `https://socialstream.ninja/sources/websocket/kick.html?channel=YOUR_KICK_CHANNEL`.
3. Click `Sign in with Kick`.
4. Enter/confirm channel slug and click `Connect channel`.
5. Keep the Kick bridge page open.
6. Open the Flow Actions overlay with the same SSN session.
7. In Event Flow Editor, use `User & Source -> Channel Point Redemption`.
8. Set `Reward Name` to the exact Kick reward title, or leave it blank to match any reward.

Reward payload shape:

```json
{
  "type": "kick",
  "event": "reward",
  "chatname": "ViewerName",
  "chatmessage": "Sound Alert - optional user input",
  "meta": {
    "rewardTitle": "Sound Alert",
    "rewardId": "123",
    "redemptionId": "456",
    "cost": 1000,
    "status": "fulfilled",
    "userInput": "optional user input",
    "redeemer": "ViewerName"
  }
}
```

Key support distinction: the normal Kick chatroom may catch visible "redeemed" text, but the bridge source is the reliable path for structured reward events.

## Event And Payload Notes

Important event names from `docs/event-reference.html` and `sources/websocket/kick.js`:

- Regular bridge chat: no special event or `event: "message"` depending on path.
- `reward`: reward/channel point redemption.
- `new_subscriber`: new subscription.
- `resub`: subscription renewal.
- `subscription_gift`: gifted subs.
- `donation`: KICKs/tips/support events.
- `raid`: incoming host/raid.
- `new_follower`: follow event.
- `follower_update`: total follower count.
- `stream_online` / `stream_offline`: live status.
- `viewer_update`: concurrent viewers from live status or DOM polling.
- `user_banned`: metadata-only moderation event.

Payload details:

- Reward meta includes reward/redemption IDs, title, cost, status, user input, redeemed time, description, and redeemer.
- Subscription meta includes subscriber, gifter, total gifted, duration, and plan.
- Donations/KICKs set `hasDonation` and `meta.amount`/`meta.currency`.
- Chat payloads can include `meta.messageId` for delete sync.
- Replies can include `initial`, `reply`, and structured `meta.reply`.
- `providers/kick/core.js` maps and merges badge assets, including image and SVG badges.

## Common Failures

- Only chat works, rewards do not: user has normal Kick chat open but not the Kick bridge page.
- Rewards do not trigger Event Flow: bridge page is not signed in, not connected, closed, or using a different SSN session than Flow Actions.
- Wrong reward triggers: set the `Reward Name` filter in the Channel Point Redemption trigger.
- OAuth or chat sending fails: token missing/expired, scope missing, Kick verification/CAPTCHA, or app loopback port conflict.
- Kick says verifying human: use the Chrome extension path or bridge mode in a normal browser when Electron app sign-in is blocked.
- Viewer count missing: verify viewer/hype settings and live channel state.
- Old URL does not work: use `https://kick.com/popout/CHANNEL/chat`.

## App Vs Extension Differences

- The extension's DOM path sees the normal browser Kick session.
- The bridge page can run hosted/local and communicate through Chrome runtime or app `window.ninjafy`.
- The standalone app OAuth handler can open Kick auth externally or inside a local app window; that can behave differently under Kick's anti-bot/human-verification flows.
- `ssapp/resources/kick-ws-client.js` is currently a small stub; the main Kick bridge behavior is in `sources/websocket/kick.js`.

## Extraction Notes

Needs intense pass:

- Confirm `kick.js` vs `kick_new.js` manifest/runtime loading relationship.
- Exact Kick bridge scope set and token refresh behavior.
- Full event type normalization table in `sources/websocket/kick.js`.
- Chat send retry/error handling and moderation action behavior.
