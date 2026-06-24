# TikTok Standalone App Connector

Status: heavy app-source pass on 2026-06-24. This is source-backed orientation for the Electron app TikTok connector, not proof from a live TikTok or real in-app/e2e run.

## Purpose

Use this page when the question is specifically about TikTok inside the standalone desktop app: app source modes, WebSocket versus legacy behavior, local signing, reply/send-back, fallback states, app regression tests, and support triage.

For TikTok browser extension DOM capture, start with `tiktok.md`. For general standalone app source-window behavior, use `../04-standalone-app-source-windows.md`.

## Source Anchors

- `ssapp/tiktok/connection-manager.js`
- `ssapp/tiktok/gift-mapping.json`
- `ssapp/tiktok-signing/electron-signer.js`
- `ssapp/main.js`
- `ssapp/preload.js`
- `ssapp/state.js`
- `ssapp/index.html`
- `ssapp/package.json`
- `ssapp/tests/tiktok/*`
- `docs/agents/08-platform-sources/tiktok.md`
- `docs/agents/04-standalone-app-source-windows.md`

## Connector Mental Model

The standalone app does not only run the extension `sources/tiktok.js` file. It also has a native TikTok connector under `ssapp/tiktok/connection-manager.js`.

The app connector can:

- Maintain a TikTok connection manager per app source/WebSocket ID.
- Use the modern WebSocket provider path when possible.
- Use the legacy or polling connector path as compatibility mode.
- Use an Electron signing window for local signer behavior.
- Route messages through virtual app tabs with IDs based on `900000 + wssID`.
- Forward app-native TikTok events through the same Social Stream background/dock path used by other source windows.
- Suppress capture forwarding for inactive or reply-only TikTok connections.

Support implication: "TikTok in the app" is not a single mode. Always identify the app mode and signing provider before comparing it to Chrome extension capture.

## Mode Map

| User-Facing Idea | Internal Clues | Best For | Main Limits |
| --- | --- | --- | --- |
| Standard/classic page capture | `classic`, `forceTikTokClassic`, extension-style page capture | Replies and manual verification when the TikTok page is usable | Fragile DOM, CAPTCHA/login prompts, visible page state matters |
| TikTok WebSocket connector | `tiktok-websocket`, `ConnectionManager`, preferred strategy `websocket` | App-native reading, richer event families, virtual tab routing | TikTok auth, rate limits, WebSocket provider failures, fallback states |
| Legacy/Polling connector | `tiktok-legacy`, `legacy`, polling fallback | Compatibility when WebSocket/signing paths fail | Lower event richness and not the first choice for replies |
| Local Signer | signing provider `local` or effective mode `Local Signer` | WebSocket mode with local signing and reply support fallback | Needs signed-in TikTok origin/session in the app signer window |
| Euler WS relay | signing provider `euler-ws` or effective mode `Euler WS relay` | Relayed WebSocket behavior, optionally with API key | Provider close codes and key/session state decide many failures |
| Custom signer | signing provider `custom`, custom signing service URL/key | Advanced/custom signing service setups | User owns service health, URL, key, and request compatibility |
| Auto provider | signing provider `auto` | First attempt path before app fallback choices | May move through several fallback states; inspect status/logs |

Do not collapse these into "TikTok works" or "TikTok does not work." A support answer should say which mode was tested.

## Stored App State

`ssapp/state.js` stores TikTok-specific global and per-source fields.

Global fields include:

- `forceTikTokClassic`
- `preferTikTokLegacy`
- `tiktokModeExplicitlySelected`
- `lastTikTokMode`

Allowed connection-mode values include:

- `classic`
- `tiktok-websocket`
- `tiktok-legacy`

Important source-level fields include:

- `disableTikTokAutoFallback`
- `tiktokSigningApiKey`
- `tiktokSigningServiceUrl`
- `tiktokSigningParameters`
- `showTikTokSigningTools`
- `tiktokSigningRoomId`
- `tiktokSigningEmail`
- `tiktokSigningAutoValidate`
- `tiktokSigningProvider`

Current source behavior observed in `state.js`:

- New TikTok source defaults are affected by `forceTikTokClassic`, `preferTikTokLegacy`, `tiktokModeExplicitlySelected`, and `lastTikTokMode`.
- If a saved mode is not explicitly selected and the last mode is `tiktok-websocket`, the state migration can downgrade it to `tiktok-legacy`.
- Providers such as `custom`, `euler-ws`, and `local` force signing tools visible in the saved source state.

Support implication: ask whether the user deliberately selected WebSocket mode, legacy mode, local signer, or custom/Euler signing. A remembered/default mode can differ from what the user thinks they selected.

## Runtime Environment Hooks

`createTikTokEnvironment(options)` builds the app-side environment used by TikTok connection managers.

Important environment responsibilities:

- Store `browserViews`, `connectionStates`, and `websocketConnections`.
- Report status updates and forwarded events back to the app.
- Gate capture settings such as joined, liked, viewer update, and text-only modes.
- Provide local signer and signing helper hooks.
- Expose callback points for diagnostics and app UI state.

`ConnectionManager` is constructed with:

```text
new ConnectionManager(username, wssID, sessionId, ttTargetIdc, options)
```

Important constructor behavior:

- Trims `sessionId` and `ttTargetIdc`.
- Chooses `websocket` unless forced into legacy mode.
- Tracks diagnostic counters, failure counters, reconnect state, dedupe state, and active connection status.
- Supports a direct TikTok chat route only when the installed `tiktok-live-connector` exposes that route and the app has not disabled it.
- Uses a WebSocket failure threshold of three strikes before compatibility fallback logic.

## Virtual Tab Routing

The app connector uses virtual tab IDs rather than real browser tabs for native TikTok messages.

Observed behavior:

- Virtual IDs are based on `900000 + wssID`.
- Test harnesses mark the virtual view with `isTikTokVirtual`.
- The virtual URL shape is TikTok live-like, using `https://www.tiktok.com/@username/live`.
- Messages are forwarded to the Social Stream background frame as app-originated source messages.
- App metadata can include source/session/account role details.

Support implication: app-native TikTok capture can appear in downstream SSN surfaces like a normal source even when there is no normal TikTok browser tab doing DOM capture.

## Connection Fallbacks

The app connector has several fallback paths. These are source-backed from `connection-manager.js`, but should still be checked against current logs and runtime behavior before making final bug claims.

### WebSocket Instability

When WebSocket failures reach the strike threshold, the connector can force polling/legacy compatibility mode and emit a fallback warning.

Support handling:

- Ask whether the app switched modes automatically.
- Ask whether the user disabled automatic fallback.
- Ask whether duplicate TikTok tabs/apps are also connected.
- Do not treat polling fallback as proof that TikTok is unsupported; it is a compatibility path.

### Rate Limits

Rate-limit handling can try multiple recovery paths, including local signer, shared/default provider behavior, proxy/relay fallback, polling fallback, and delayed retry.

Support handling:

- Close duplicate TikTok source windows/tabs/apps.
- Wait before reconnecting.
- Try another mode only after a clean stop/reconnect.
- Collect mode, provider, API key/custom URL presence, and close/status text.

### Sign Server Or Bootstrap Failures

Sign server failures can trigger local signer, Euler proxy, polling fallback, or session rejection paths depending on the provider/session state.

Support handling:

- Check whether the user has a saved TikTok session/cookies in the app.
- Check whether local signer window preparation completed.
- Check whether the custom signing service URL/key is set and reachable.
- Avoid asking users to post raw `sessionid`, API keys, or full signing parameters publicly.

### Offline And Terminal Close Codes

Observed close-code handling includes:

- `4404` and `4005`: treated as not-live/ended style states and can enter offline retry.
- `4401`: invalid API key/JWT style failure.
- `4403`: permission style failure.
- `4429`: rate limit style failure.
- `4555`: provider lifetime close after a long connection.
- `1011`: provider/internal server style failure.

Support handling:

- If the creator is not live, do not debug as a parser failure.
- For auth/permission codes, check API key, account, provider, and session before reconnect loops.
- For long-running lifetime closes, ask whether reconnect recovered cleanly.

## Local Signer Behavior

`ssapp/tiktok-signing/electron-signer.js` supports local signing from an Electron window at TikTok origin.

Observed signer responsibilities:

- Inject the bundled ByteDance crawler/signing bundle into the signer window.
- Read TikTok cookies such as `sessionid` and `msToken` from the Electron session.
- Find or derive room ID from page state, URL, or document data.
- Build TikTok webcast fetch parameters.
- Generate or return signing values such as `X-Bogus`, `X-Gnarly`, `_signature`, and `msToken`.
- Optionally perform a signed in-page `webcast/im/fetch` request and return status/body details.

Local signer requirements:

- The signer window must be on a TikTok origin.
- The user must be signed in where reply/send-back needs that signed-in identity.
- The signer helper must be injected before signing parameters are generated.
- Room ID, cookies, and TikTok page state can all be failure points.

Support implication: local signer problems are usually not solved by changing an overlay URL. Check app session/cookies, signer window state, room ID, and provider mode.

## Replies And Send-Back

TikTok replies are more constrained than reading chat.

Observed behavior:

- `sendChatMessage()` requires a TikTok `sessionid`; without it, the connector returns an error that TikTok chat sending requires the `sessionid` cookie.
- `ttTargetIdc` is recommended and the connector can warn when it is missing.
- The connector prefers a direct room/chat route when supported by `tiktok-live-connector`.
- Local signer can perform signed fetch behavior in the signing window.
- Euler chat endpoint fallback is disabled under local signer.
- App bridge code avoids duplicate sending for TikTok virtual-tab paths in some response routes.

Support handling when reading works but replies fail:

1. Confirm this is the standalone app, not the Chrome extension.
2. Confirm the active TikTok mode and signing provider.
3. Confirm the user is signed into the TikTok account that should send replies inside the app session.
4. Check whether `sessionid` exists without exposing its value.
5. Check whether local signer or Standard mode is being used for reply-capable workflows.
6. Collect the exact app error/status text and whether the send failed instantly or after a provider response.

## Event Families

App-native TikTok event handling is broader than page DOM capture.

Observed families from app code and tests:

- Normal chat messages.
- Gifts and gift streaks.
- Reactions/hidden gift tray style events where applicable.
- Followed/shared/liked social events.
- Joined events when capture is enabled.
- `question_new`.
- Emotes and stickers.
- `viewer_update`, throttled by app settings and timing.

Important behavior:

- Liked events can be routed to the reactions target when capture-liked is disabled for the main stream.
- Follow/share events have dedupe behavior.
- Liked events can intentionally pass through more often than other social rows.
- Gift handling uses upstream IDs, streak identity, gift names, quantities, and `gift-mapping.json` when available.
- Text-only mode avoids image HTML for emote/sticker handling.

Support implication: ask whether the user is missing normal chat, gifts, follows, likes, joins, questions, emotes, viewer counts, or replies. Each can fail for a different reason.

## Regression Test Assets

These app tests are useful orientation and regression assets. They do not replace real Electron app testing or live TikTok validation.

From `ssapp/package.json`:

| Command | Area |
| --- | --- |
| `npm run test:tiktok-auto-mode` | Auto-mode fallback behavior. |
| `npm run test:tiktok-gift-regression` | Gift count and gift payload regressions. |
| `npm run test:tiktok-social-signals` | Social event canonicalization/dedupe behavior. |
| `npm run test:recent-changes` | Combined recent app checks including TikTok-focused regressions. |

From `ssapp/tests/tiktok/package.json`:

| Command | Area |
| --- | --- |
| `npm start` | Runs `run.js` with default options. |
| `npm run ws` | WebSocket mode run. |
| `npm run legacy` | Legacy/polling mode run. |
| `npm run both` | Sequential WebSocket and legacy run. |
| `npm run auto` | Auto-mode regression. |
| `npm run gift` | Gift count regression. |
| `npm run social` | Social signal regression. |
| `npm run events` | Event capture regression. |
| `npm run emote` | Chat emote regression. |
| `npm run single-active` | Single active connection regression. |
| `npm run regression` | Combined TikTok regression set. |

`ssapp/tests/tiktok/run.js` supports:

- `--mode=websocket`
- `--mode=legacy`
- `--mode=both`
- `--user=username`
- `--duration=milliseconds`
- `--capture-likes`

Observed test coverage themes:

- Auto fallback order for rate limits, sign failures, local signer, proxy/provider fallback, polling, offline, and fatal room/user lookup errors.
- Authenticated WebSocket bootstrap behavior for session, `ttTargetIdc`, local signer, Euler, custom provider, and legacy mode.
- Gift count, gift image, internal URI filtering, streak identity, and queue continuation after send failure.
- Social event canonicalization, liked-event routing, passthrough/dedupe behavior, and replay suppression.
- Chat emote/sticker normalization and text-only behavior.
- Single active connection cleanup, virtual tab cleanup, inactive/reply-only filtering, and stopped connect cleanup.
- Dedupe/replay and 403 validation assets for known fragile behavior.

## Support Triage Checklist

Ask or infer:

- App version and OS.
- Standalone app versus Chrome extension.
- TikTok username or URL, and whether the creator is currently live.
- Active mode: Standard/classic, WebSocket, legacy/polling, local signer, Euler, custom, or auto.
- Whether the source was explicitly set to WebSocket or migrated/defaulted to legacy.
- Whether the TikTok source is active, visible, hidden, reply-only, or auto-activated.
- Whether the user is signed into TikTok inside the app session.
- Whether the issue is reading chat, gifts, social events, viewer counts, emotes, or replies.
- Whether automatic fallback is disabled.
- Whether a custom signing URL/API key is configured.
- Whether another TikTok tab, app source, browser extension, or bot is connected at the same time.
- Exact close/status/error text, with secrets redacted.

## First Answers For Common Symptoms

### "TikTok connects in Chrome but not the app."

Use:

```text
The app uses its own Electron session and TikTok connector modes, so it may not share your normal Chrome login or exact extension behavior. Check the app TikTok mode, app session/sign-in state, and whether WebSocket, legacy, Standard, or local signer is active.
```

### "TikTok says not live or keeps retrying."

Use:

```text
First confirm the exact account is live right now and the username is correct. The app treats some provider close codes as not-live/ended states and may enter offline retry instead of showing a parser error.
```

### "Reading works but replies fail."

Use:

```text
TikTok replies need a valid signed-in TikTok session in a reply-capable mode. Check Standard or Local Signer, verify the app has the TikTok `sessionid` cookie without sharing its value, and capture the exact send error.
```

### "Likes do not appear in the dock."

Use:

```text
TikTok liked events have separate capture/routing behavior. When liked capture is disabled for the main stream, they may be routed to reactions instead of normal dock chat. Check the liked-event capture setting and the reactions page/target.
```

### "Gifts duplicate or counts look wrong."

Use:

```text
The app has regression coverage for gift counts, streak identity, dedupe, and replay suppression, but TikTok reconnects and provider payloads can still create edge cases. Record the mode, whether a reconnect happened, the gift type/count, and whether it repeats after a clean stop/reconnect.
```

### "Local signer is stuck."

Use:

```text
Local signer depends on a TikTok-origin signer window, app cookies, room ID detection, and signing bundle injection. Check whether the signer window is signed in, whether the live room is open, and whether the app reports a signer preparation or validation error.
```

## Do Not Overclaim

Avoid saying:

- TikTok app and TikTok extension behavior are identical.
- A signed-in Chrome profile means the app has the same TikTok session.
- WebSocket mode is always better than legacy/polling.
- Local signer can work without a TikTok-origin signed-in app session.
- A passing regression script proves the live platform is healthy today.
- Reply support is available from every TikTok mode.

## Follow-Up Extraction Needs

- Intense line-level payload table for app TikTok chat, gifts, social events, questions, emotes, viewer updates, and replies.
- Current renderer/UI label trace for every TikTok mode and signing control.
- Real Electron app e2e validation for WebSocket, legacy, Standard, local signer, reply send-back, fallback warnings, virtual tab routing, and source cleanup.
- Live TikTok validation using a controlled live room and redacted logs.
- Support-history reconciliation for the most common TikTok app symptoms and stale advice.
