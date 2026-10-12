# Priority Platform Validation Ledger

Status: heavy evidence-ledger pass on 2026-06-24. This page converts high-volume platform support claims into proof targets. It is not runtime validation and does not mark any platform feature as tested.

## Purpose

Use this page when a user or agent needs to know:

- whether a priority platform claim is source-backed, support-derived, focused-tested, or runtime-tested,
- what evidence would be needed before saying a feature "works",
- which docs and source files to inspect before answering,
- which risky platform claims should stay cautious.

For short support wording, use `priority-platform-answer-matrix.md`. For broader feature routing across all source families, use `platform-capability-matrix.md`.

## Evidence Labels

| Label | Meaning |
| --- | --- |
| `orientation` | A doc route or safe answer exists, but the exact behavior is not validated. |
| `source-backed` | Current source/docs were inspected enough for cautious guidance. Still verify exact code paths before public promises. |
| `focused-tested` | A deterministic test or static check supports a narrow claim, but not live runtime behavior. |
| `runtime-needed` | Browser, app, API, OBS, or live platform testing is required before saying the behavior is tested. |
| `stale-risk` | Third-party platform behavior, selectors, OAuth scopes, API policy, or support history could be out of date. |
| `do-not-promise` | Do not claim this currently works unless a later pass adds current source and runtime evidence. |

## Current Platform Evidence Summary

| Platform | Plain Chat Evidence | Rich Event Evidence | Send-Back Evidence | App Parity Evidence | Current Safe Status |
| --- | --- | --- | --- | --- | --- |
| YouTube | source-backed DOM and WebSocket/API docs | source-backed but mode-specific | source-backed routing only; runtime-needed | source-backed OAuth notes; runtime-needed | Answer setup and mode questions; verify write/moderation claims before promising. |
| TikTok | source-backed DOM and app connector docs | source-backed app/DOM event notes | source-backed app reply paths; runtime-needed | source-backed app connector notes; runtime-needed | Treat as volatile and mode-specific; app has broadest routing but not blanket parity. |
| Twitch | source-backed DOM and WebSocket/EventSub docs | source-backed plus focused subgift provider test | source-backed provider paths; runtime-needed | source-backed OAuth notes; runtime-needed | Split DOM chat from EventSub/provider features. |
| Kick | source-backed DOM and bridge docs | source-backed bridge event notes | source-backed bridge send paths; runtime-needed | source-backed OAuth/app notes; runtime-needed | Split popout chat from bridge/OAuth features. |
| Rumble | source-backed DOM and API bridge docs | source-backed API bridge notes | documented read-only bridge; do-not-promise send-back | app parity unknown | API bridge is structured and read-only; keep private API URL secret. |
| Facebook | source-backed DOM and Graph bridge docs | source-backed viewer/comment notes | do-not-promise without new source/runtime proof | app OAuth not deeply validated | Split managed Page API bridge from viewer DOM capture. |
| Instagram | source-backed DOM docs | limited/source-backed live/feed notes | do-not-promise | app parity unknown | Treat as visible DOM capture only. |
| Discord | source-backed web DOM docs | limited/source-backed message/media notes | do-not-promise | app parity unknown | Treat as web Discord DOM capture, not a bot/API integration. |

## Claim Ledger

| Platform | Claim Family | Current Evidence | Risk | Proof Needed Before Strong Claim |
| --- | --- | --- | --- | --- |
| YouTube | Normal live chat/popout capture works. | `youtube.md`, `sources/youtube.js`, manifest/source docs | DOM selectors and YouTube page state can change. | Browser validation with live/popout chat, dock receipt, session match, and reload/stale-chat behavior. |
| YouTube | WebSocket/Data API gives richer events. | `youtube.md`, `sources/websocket/youtube.js`, `providers/youtube/liveChat.js` | OAuth scopes, stream state, polling/streaming behavior, and API limits. | Controlled source-page run with OAuth or mocked provider, event samples, delete/ban/subscriber paths where allowed. |
| YouTube | Send/delete/ban/moderation works. | Source-control and event names appear in docs/source routes | High write-permission and role risk. | Line-level source-control trace plus runtime source-page test with safe account and explicit OAuth scopes. |
| TikTok | DOM Standard mode reads rendered live chat and social rows. | `tiktok.md`, `sources/tiktok.js` | TikTok DOM changes frequently; account/region differences. | Browser validation with live account, visible chat, gifts/social rows, duplicate behavior, and hidden/visible tab comparison. |
| TikTok | App connector supports richer modes and events. | `tiktok.md`, `tiktok-standalone-app.md`, `ssapp/tiktok/connection-manager.js` | Signers, WebSocket bootstrap, rate limits, fallback, and app UI mode names change. | Electron app e2e with Standard, WS Auto, Local Signer, Polling, fallback states, event samples, logs, and app version. |
| TikTok | Replies/send-back work. | App send paths exist in `connection-manager.js`; docs note `sessionid` and mode requirements | Auth/session/signature/rate-limit risk. | Real app send test from a signed-in account in supported modes, with failure logs and mode-specific result. |
| Twitch | DOM chat works for visible Twitch chat. | `twitch.md`, `sources/twitch.js` | Twitch DOM/class changes and sign-in state. | Browser validation with visible chat, badges/emotes/replies, dock receipt, and viewer-count gating. |
| Twitch | EventSub/provider captures follows, raids, rewards, subs, cheers, deletes, bans, ads. | `twitch.md`, `sources/websocket/twitch.js`, `providers/twitch/chatClient.js` | OAuth scopes, broadcaster/moderator role, EventSub subscription availability. | Runtime WebSocket/EventSub setup with scoped token, event samples or controlled fixtures, and permission-error notes. |
| Twitch | Gifted subscription normalization. | Focused Node test in `tests/twitch-chatClient-subgift.test.js` | Synthetic provider test only; no live EventSub/IRC proof. | Live or replayed provider event test plus downstream overlay/API delivery. |
| Twitch | Send chat works. | `providers/twitch/chatClient.js` and `sources/websocket/twitch.js` have send-message paths | Requires connected tmi.js client, OAuth, target channel, and account permissions. | Runtime send test with safe channel and clear failure behavior when disconnected/unauthorized. |
| Kick | Popout chat capture works. | `kick.md`, `sources/kick.js`, `sources/kick_new.js` | Current manifest/runtime loading relationship still needs intense validation. | Browser validation on current popout URL, old chatroom redirect, viewer count, delete payloads, and source-file load confirmation. |
| Kick | Bridge handles rewards, subs, follows, raids, tips, moderation, and send-back. | `kick.md`, `sources/websocket/kick.js`, `providers/kick/core.js` | OAuth token/scopes, bridge state, Pusher behavior, CAPTCHA/human verification. | Runtime bridge validation with signed-in account, reward event, chat send, reconnect/token-refresh, and app-vs-browser comparison. |
| Kick | App OAuth behaves like browser OAuth. | App OAuth docs/source notes exist | CAPTCHA, local/external auth, loopback ports, and Electron window behavior differ. | Electron app OAuth e2e for local and external flows, including failure/CAPTCHA handling. |
| Rumble | Normal DOM capture reads visible chat/rants/raids. | `rumble.md`, `sources/rumble.js` | DOM markup and source-tab state. | Browser validation with normal Rumble page, visible chat/rant/raid samples where available. |
| Rumble | Live Stream API bridge handles structured events. | `rumble.md`, `sources/websocket/rumble.js` | Private API URL, stream state, SSE/polling fallback, replay/dedupe. | Runtime API bridge validation with private test URL, chat/rant/follow/sub/viewer/status samples, and replay off/on comparison. |
| Rumble | API bridge sends chat. | Source logs state read-only behavior for `SEND_MESSAGE` attempts | Do-not-promise. | Only change if source changes and runtime proves send behavior. |
| Facebook | DOM capture reads visible live comments/Stars rows. | `facebook.md`, `sources/facebook.js` | Viewer/admin context, Facebook layout churn. | Browser validation in viewer and page-owner contexts with visible comments and Stars where available. |
| Facebook | Managed Page Graph bridge reads comments/viewers. | `facebook.md`, `sources/websocket/facebook.js` | Page role, token permissions, live video ID, Graph API changes. | Runtime bridge validation with managed Page token, live video, comments, viewer count, token-expiry behavior, and permission errors. |
| Facebook | Send-back or Stars parity is supported. | Not proven by current docs | High API/write and payload risk. | Current source path plus live Graph/API validation before any claim. |
| Instagram | Live DOM capture reads visible live rows. | `instagram.md`, `sources/instagram.js`, `sources/instagramlive.js` | DOM placeholders, login state, page layout, source-file routing. | Browser validation with live page, new chat rows, joined-event setting, and downstream source type check. |
| Instagram | Feed/post/comment capture works. | `instagram.md`, `sources/instagram.js` | Infinite scroll, expanded comment state, media/lazy loading. | Browser validation with feed/post comments, expanded replies, media, duplicate avoidance. |
| Instagram | Send-back/API-style integration works. | Not proven by current docs | Do-not-promise. | New source/API bridge plus runtime evidence would be required. |
| Discord | Web Discord DOM capture works. | `discord.md`, `sources/discord.js` | Discord DOM changes, source toggle, channel filter, login state. | Browser validation on `/channels/` URL, new message, attachment/media, custom channel filter, membership color behavior. |
| Discord | Discord bot/API, role/moderation, or send-back works. | Not proven by current docs | Do-not-promise. | Dedicated bot/API integration and runtime evidence would be required. |

## Minimum Proof Pack By Claim Type

| Claim Type | Minimum Evidence |
| --- | --- |
| Plain chat capture works | Exact source/mode, real or controlled new message, dock receipt, same session proof, browser/app surface, and "what was not tested." |
| Rich event works | Event source/mode, sample payload, downstream receipt, event name/fields, account role/scope, and whether DOM/API/app mode differs. |
| Send-back works | Exact source-control/send path, logged-in account, target channel, OAuth scopes/role, safe sent message, error behavior, and platform policy caveat. |
| Viewer count works | Setting/source mode, stream live state, payload sample, polling interval/source, and missing/zero behavior. |
| App parity exists | Same platform and mode tested in extension and app, with app version, source-window state, session partition, auth path, and observed differences. |
| OBS overlay receives platform event | Source event reaches dock/API first, overlay URL/session/label is correct, OBS/browser source renders it, and refresh/persistence behavior is noted. |

## What To Update After Validation

When a platform claim is validated:

1. Add a dated entry to `../17-runtime-validation-evidence-log.md` for runtime proof or `../18-focused-validation-evidence-log.md` for focused non-runtime proof.
2. Update the relevant platform doc.
3. Update `priority-platform-answer-matrix.md` if safe support wording changes.
4. Update `platform-capability-matrix.md` if capability routing changes.
5. Update `../11-support-kb/support-evidence-ledger.md` if a support claim is promoted, narrowed, or rejected.
6. Add a pass row to `../01-extraction-checklist.md`.
7. Update `../02-resource-processing-ledger.md` and `../15-objective-coverage-and-readiness-audit.md` if evidence strength changes.

## Current Non-Completion Boundary

This ledger makes the validation gaps explicit, but it does not close them. The priority platform docs are useful for cautious answers, not final tested claims. Do not mark platform send-back, moderation, app parity, or live rich-event behavior as `runtime-tested` until the proof pack above exists.
