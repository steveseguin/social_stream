# TikTok Source

Status: heavy extraction pass. Usable for support and architecture orientation, not final field-level docs.

## Purpose

Document TikTok standard mode, WebSocket/app mode, signing, app-specific connection management, event handling, and common support problems.

For standalone app connector internals, signing providers, fallback states, reply/send-back behavior, and app TikTok tests, use `tiktok-standalone-app.md`.

## Source Anchors

- `social_stream/manifest.json`
- `social_stream/sources/tiktok.js`
- `social_stream/docs/tiktok-guide.html`
- `social_stream/docs/event-reference.html`
- `ssapp/tiktok/connection-manager.js`
- `ssapp/tiktok-signing/electron-signer.js`
- `ssapp/tiktok-auth.js`
- `ssapp/tiktok-badges.js`
- `ssapp/tests/tiktok/*`
- `stevesbot/resources/instructions/social-stream-support.md`
- `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`

## High-Level Guidance

TikTok is one of the most fragile SSN platforms. The public TikTok guide explicitly says TikTok changes often and not every account sees the same behavior.

Current recommendation from `docs/tiktok-guide.html`:

- Start with `TikTok WS + Auto` for reading.
- Use `Standard` if replies matter.
- Use `TikTok WS + Local Signer` when Standard is unstable but replies are still needed.
- Use `Polling` as compatibility mode when WebSocket paths fail.
- Use `TikFinity OBS Dock` as a read-only fallback when TikTok native paths miss too much chat or fail to connect.

## Browser Extension Standard DOM Mode

`sources/tiktok.js` is the browser-page DOM capture source.

Confirmed behavior:

- The manifest injects it on TikTok live pages.
- It forwards messages with `chrome.runtime.sendMessage(chrome.runtime.id, { message: data })`.
- Normal payloads use `type: "tiktok"`.
- It builds payloads with fields such as `chatname`, `chatbadges`, `nameColor`, `chatmessage`, `chatimg`, `hasDonation`, `membership`, `contentimg`, `textonly`, and `event`.
- It detects event hints from rendered social/system cards.
- It skips TikTok welcome/community-filter boilerplate and duplicate messages.
- It tracks top-viewer/member-level metadata when the page exposes it.
- It uses avatar caching so later social/event rows can inherit avatar/badge/member data from previous chat rows.

Standard mode is best when the user needs replies from SSN and the live TikTok page is visible/usable.

## TikTok DOM Events

Confirmed from `sources/tiktok.js` and `docs/event-reference.html`:

- Regular chat: no special event value.
- Gift rows: `event: "gift"` and `hasDonation` such as `N coins`, `N coin`, `N gifts`, or a gift name/count fallback.
- Join events: `event: "joined"` when capture settings allow join events.
- Follow events: `event: "followed"`; the code requires a `chatname`.
- Like events: `event: "liked"`.
- Generic social/system broadcasts may use boolean `true` as the event value when no subtype is known.
- Share events are detected but standard DOM code currently returns instead of forwarding them in some paths.

The event reference also documents TikFinity activity-feed rows using canonical TikTok fields for chat, follows, shares, gifts, subscriptions, joins, and treasure chests.

## App Native/WebSocket Mode

The standalone app has a much larger TikTok stack in `ssapp/tiktok/connection-manager.js`.

Confirmed responsibilities:

- Uses `tiktok-live-connector` and `@eulerstream/euler-websocket-sdk`.
- Maintains app-side connection managers keyed by WebSocket/source IDs.
- Supports modern Euler WebSocket provider behavior and legacy connector fallback.
- Tracks active TikTok connections by source ID and avoids forwarding messages for inactive/reply-only connections.
- Uses virtual tab IDs starting at `900000 + wssID` to route TikTok app messages through the app/background path.
- Forwards single messages and batches into the Social Stream background frame via `frame.postMessage("fromMain", payload)`, with retry logic.
- Calls `env.onEvent(msg)` for app-side event hooks before forwarding.
- Adds `meta.ssnAccountRole`, `meta.ssnSourceId`, and `meta.ssnSession` for non-normal source account roles.

App event support is broader than DOM capture. `docs/event-reference.html` notes app native mode adds events beyond page/widget capture, including `question_new`, `emote`, and `viewer_update`.

## Signing And Replies

Reply support depends on a valid signed-in TikTok session.

Confirmed from docs and app code:

- `Standard` is the first-choice reply mode.
- `Local Signer` is the fallback reply mode.
- `Auto`, `Polling`, and TikFinity are not meant for replies.
- The app has a direct room/chat route when `tiktok-live-connector` exposes `SendRoomChatRoute`.
- Local signer paths may sign `X-Bogus`, `X-Gnarly`, `_signature`, `msToken`, and related request data.
- Direct chat sends require a TikTok `sessionid` cookie; the connection manager logs/returns an error if it is missing.
- Under local signer, Euler chat fallback can be disabled; the app prefers the active WebSocket connection or direct route depending on mode and availability.

Support implication: if reading works but replies fail, ask which TikTok mode is active and whether the user is signed into the TikTok account that should send messages.

## Gift And Emote Handling

Confirmed behavior:

- DOM mode parses TikTok gift image URLs and quantities from rendered HTML.
- Gift values are mapped through `giftMapping`; when coin values are unavailable, it falls back to gift names or generic gift counts.
- App mode has richer gift/emote handling, including `gift-mapping.json`, emote normalization, top-gifter badges, and text-only rendering paths.
- App chat payloads preserve upstream IDs/timestamps when available for dedupe/debugging.

Gift combo duplicates are historically common support noise. The current code includes duplicate suppression in both DOM and app paths, but TikTok reconnects and gift rendering can still create edge cases that need intense validation.

## Testing And Diagnostics

`ssapp/tests/tiktok/run.js` supports:

- `--mode=websocket`
- `--mode=legacy`
- `--mode=both`
- `--user=username`
- `--duration=milliseconds`
- `--capture-likes`

The test runner creates a TikTok environment, initializes a `ConnectionManager`, logs status, and summarizes forwarded events. Additional regression files cover auto mode, fuzzing, gift counts, dedupe/replay, authenticated bootstrap, single active connection, social signals, chat emotes, and 403 bug validation.

## Common Failures

- User is not live: TikTok chat capture often fails or reports offline if the account is not actually live.
- Username format: use the username without `@` unless the UI explicitly asks for a URL.
- Missing messages: can be TikTok-side, account-specific, region-specific, or mode-specific. Try another mode before treating it as a code bug.
- Auth window closes or CAPTCHA appears: use `Show capture page`, sign in visibly, then reload.
- Replies fail: use Standard or Local Signer and verify signed-in session/cookies.
- Rate limits: close duplicate TikTok tabs/apps, wait, then retry with another mode.
- Duplicates after reconnect: update app, stop the source fully, reconnect cleanly, and try another mode if it persists.
- Extension versus app mismatch: the app has the widest TikTok mode selection; the browser extension is closer to DOM page capture.

## Escalation Rules

Escalate when:

- Multiple users report the same TikTok failure after normal mode switching.
- A recent TikTok page/API change breaks previously working capture.
- App direct chat routes return consistent 403/auth/session errors for signed-in users.
- Duplicate gift/social events survive clean reconnect and current regression expectations.
- A support claim comes only from historical Discord data and has not been checked against current `connection-manager.js`.

## Extraction Notes

Needs intense pass:

- Exact mapping of app WebSocket events to SSN payload fields.
- Local signer request lifecycle and all fallback states.
- Current app UI mode names from `ssapp/renderer.js`/source setup UI.
- Regression test expectations converted into user-facing troubleshooting.

The app-specific heavy pass now lives in `tiktok-standalone-app.md`; keep this page focused on the cross-surface TikTok overview unless a claim applies to both extension DOM capture and the app connector.
