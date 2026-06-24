# Twitch Source

Status: heavy extraction pass. Usable for support and architecture orientation, not final field-level docs.

## Purpose

Document Twitch capture, WebSocket/EventSub behavior, OAuth, chat sending, badges/emotes, and known support issues.

## Source Anchors

- `social_stream/manifest.json`
- `social_stream/sources/twitch.js`
- `social_stream/sources/websocket/twitch.html`
- `social_stream/sources/websocket/twitch.js`
- `social_stream/providers/twitch/chatClient.js`
- `social_stream/docs/event-reference.html`
- `social_stream/tests/twitch-chatClient-subgift.test.js`
- `ssapp/resources/electron-twitch-handler.js`

## Focused Validation Evidence

On 2026-06-24, this focused Node test passed:

```powershell
node tests/twitch-chatClient-subgift.test.js
```

Result: `twitch-chatClient-subgift.test.js passed`.

Evidence label: `focused-node-test`; not runtime-tested.

What this supports: provider-core normalization for synthetic direct and anonymous Twitch gifted subscription events in `providers/twitch/chatClient.js`.

What it does not support: live Twitch IRC/EventSub behavior, OAuth/scopes, DOM capture, OBS overlays, Event Flow runtime, standalone app bridge behavior, or downstream alert rendering.

Full evidence entry: `../18-focused-validation-evidence-log.md`.

## Runtime Surfaces

Twitch has two main capture paths:

- Standard DOM capture through `sources/twitch.js`.
- WebSocket/EventSub and IRC-style chat through `sources/websocket/twitch.html`, `sources/websocket/twitch.js`, and `providers/twitch/chatClient.js`.

The manifest injects `sources/twitch.js` for Twitch chat pages and includes hosted/local matches for `sources/websocket/twitch.html`.

## Standard DOM Capture

`sources/twitch.js` reads rendered Twitch chat DOM.

Confirmed behavior:

- It watches chat containers such as `.chat-list--other`, `.chat-list--default`, `.chat-room__content`, and later `#root`.
- It marks pre-existing chat rows as ignored to avoid replaying loaded history.
- It forwards payloads with `type: "twitch"`.
- Payload fields include `chatname`, `username`, `chatbadges`, `nameColor`, `chatmessage`, `chatimg`, `membership`, `subtitle`, `mod`, `vip`, `hasDonation`, `contentimg`, `highlightColor`, `textonly`, `initial`, and `reply`.
- It supports Twitch, FFZ, BTTV, and 7TV badge/emote paths where the DOM/settings expose them.
- Bits/Cheers populate `hasDonation` such as `500 bits` even when `data.event` may be empty in DOM mode.
- Reply context is added unless `settings.excludeReplyingTo` is enabled.
- Viewer counts use Social Stream's Twitch viewer proxy every 30 seconds when viewer/hype settings allow it.
- DOM fallback supports limited system events such as reward cards, gift/sub text, hype train community highlights, Stream Together knocks, and viewer updates.

Support setup:

- Open Twitch chat/popout with the extension enabled.
- Sign in when the user needs badge/member/moderation context that only appears for signed-in/broadcaster/moderator accounts.
- Use WebSocket/EventSub mode for full followers, raids, channel point redemptions, and reliable event support.

## WebSocket/EventSub Capture

`sources/websocket/twitch.js` is the richer Twitch integration.

Confirmed behavior:

- Uses Twitch API/EventSub WebSocket at `wss://eventsub.wss.twitch.tv/ws`.
- Creates EventSub subscriptions based on the authenticated user's permissions/scopes.
- Uses `providers/twitch/chatClient.js` as shared provider logic for chat normalization and tmi.js client behavior.
- Relays messages with `chrome.runtime.sendMessage`; app/preload mock messages can use `window.postMessage` for `SEND_MESSAGE`.
- Suppresses `viewer_update` relays unless `showviewercount` or `hypemode` is enabled.
- Handles reconnect and permission-error states.

EventSub events documented/confirmed include:

- `new_follower`
- `new_subscriber`
- `resub`
- `subscription_gift`
- `cheer`
- `reward`
- `raid`
- `viewer_update`
- `follower_update`
- `subscriber_update`
- `stream_online`
- `stream_offline`
- `ad_break`, `ad_request`, `ad_schedule`
- `hype_train`
- `user_banned`

## OAuth And Standalone App Auth

The standalone app handler `ssapp/resources/electron-twitch-handler.js`:

- Uses loopback host `127.0.0.1`.
- Tries ports `8181` then `8080`.
- Uses callback path `/sources/websocket/twitch.html`.
- Builds a Twitch implicit OAuth URL at `https://id.twitch.tv/oauth2/authorize`.
- Opens the auth URL in the default browser.
- Extracts the access token from the callback landing page and posts it back to the local loopback server.
- Returns a port-conflict dialog if both ports are unavailable.

Support implication: app sign-in failures can be simple loopback port conflicts, especially if another app already uses `8080`.

## Scopes And Permissions

`docs/event-reference.html` lists the broad Twitch WebSocket/EventSub scope set:

- `chat:read`
- `chat:edit`
- `bits:read`
- `moderator:read:followers`
- `channel:read:subscriptions`
- `channel:read:hype_train`
- `channel:moderate`
- `moderator:manage:banned_users`
- `moderator:manage:chat_messages`
- `channel:read:redemptions`
- `channel:read:ads`
- `channel:manage:ads`

Actual EventSub subscriptions are created only when permission checks allow them. For example, channel point redemption events require broadcaster-level access with redemption scope.

## Chat Sending And Moderation

Provider behavior from `providers/twitch/chatClient.js`:

- `sendMessage(message, targetChannel)` requires a connected tmi.js client with `say()`.
- Missing channel throws `Channel is required to send a message`.
- Missing connected client throws `Twitch client is not connected`.
- Chat messages are normalized with `chatname`, `chatmessage`, `chatimg`, `timestamp`, `chatbadges`, `hasDonation`, `bits`, moderator/owner/subscriber flags, `userId`, `event`, and raw metadata.

Delete/moderation behavior:

- WebSocket Twitch has source-control delete paths that send `{ delete: ... }`.
- `user_banned` is metadata-only for moderation widgets.
- Custom overlays should process delete payloads before normal message-add rendering.

## Event And Payload Notes

Important mappings:

- Regular chat should not set `data.event`; true system events do.
- `/me` action messages become an `action`-style event in provider normalization.
- Bits can be `event: "cheer"` or provider-normalized `bits` depending on path; downstream donation widgets should also check `hasDonation`.
- Gifted subs are normalized as `subscription_gift`. The test `tests/twitch-chatClient-subgift.test.js` confirms direct and anonymous gifted sub summaries:
  - `THErealNEDRYERSON gifted a sub to abookwitch!`
  - `Anonymous gifted a sub to quietviewer!`

## Common Failures

- Chat works but follows/raids/subs do not: user is likely in DOM mode or lacks EventSub scopes/permissions.
- EventSub auth expired: reconnect/sign in again; the source has status hooks for auth/API failures.
- Channel points missing: must be broadcaster-authorized with `channel:read:redemptions`.
- Subscriber totals missing: require broadcaster token and subscription access.
- OBS overlay does not update: verify session ID, refresh browser source, and confirm dock/source receives messages first.
- Replies look duplicated or noisy: check `excludeReplyingTo` and text-only settings.
- App OAuth fails: check loopback ports `8181` and `8080`.

## App Vs Extension Differences

- Extension DOM mode reads the user's visible Twitch page.
- WebSocket/EventSub mode is closer to API/IRC and depends on OAuth scopes.
- Standalone app uses loopback OAuth and the app bridge; browser-login state alone may not be enough for app WebSocket features.

## Extraction Notes

Needs intense pass:

- Exact Twitch WebSocket UI setup flow.
- All EventSub subscription gating rules.
- Full source-control command list for send/delete/ban/unban/ad/channel changes.
- Current Twitch OAuth token storage and refresh behavior.
