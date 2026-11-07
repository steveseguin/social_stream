# Platform Known Issues

Status: heavy support extraction pass started.

## Purpose

Track platform-specific support patterns for SSN. This page combines current platform-agent pages with mined support history, but every support-derived item should be source-checked before becoming final user-facing documentation.

## Source Anchors

- Current platform docs: `08-platform-sources/*.md`
- Current source targets: `social_stream/sources/*`, `social_stream/sources/websocket/*`
- App targets: `ssapp/main.js`, `ssapp/resources/electron-*-handler.js`, `ssapp/tiktok/*`, `ssapp/tiktok-signing/*`, `ssapp/tests/tiktok/*`
- Support mining: `11-support-kb/mining-method.md`, `historical-issues.md`, `unresolved-or-stale-claims.md`
- Support source anchors: `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`, SSN Q&A exports, playbooks, and SQLite summary tables.

## First Checks For Any Platform

1. Identify surface: Chrome extension, standalone app Standard mode, standalone app WebSocket/API mode, external-browser flow, OBS overlay only, or custom/API source.
2. Confirm the source platform account/page is actually live or has active chat where required.
3. Confirm the exact page URL or username expected by the source.
4. Confirm the source is activated/reloaded after login or mode changes.
5. Confirm messages are appearing in the dock before debugging overlay display.
6. Confirm session ID matches source, dock, and overlay.
7. Ask for OS, app/extension version, browser, platform, connection mode, and screenshot/log/error text.

## Platform Matrix

| Platform | Support-derived symptoms | First checks | Verification needed |
| --- | --- | --- | --- |
| TikTok | Chat fails to connect, Standard and WebSocket disagree, messages/users missing, gift combo duplicates, long sessions stall or duplicate, regional/account verification changes. | Confirm live stream, username from profile URL, current SSN version, Standard vs WebSocket mode, page visibility for Standard, no VPN/session block, try re-auth/clear TikTok cookies if auth state is suspect. | Current TikTok source/app mode behavior, message-loss claims, gift aggregation/dedupe settings, regional age verification handling. |
| YouTube | Popout/Studio/live-chat page confusion, Google embedded sign-in blocked, auto-select/live-chat setting confusion, gifts/memberships/moderation events differ by mode, setup may require reload after going live. | Confirm popout/Studio/source path, extension vs app, Standard vs WebSocket, Google sign-in state, test message in active live chat, reload after login. | Gift support by mode, auto-select-live-chat setting path, moderation replay behavior, app OAuth fallback behavior. |
| Twitch | Source added but not activated, `Bad Request` or OAuth/token issues, channel points/subs/bans require specific modes/scopes, app OAuth callback ports may be occupied. | Press Activate, re-auth/remove/re-add if token state is bad, check IRC vs WebSocket/EventSub mode, check local port conflicts for app OAuth if callback fails. | EventSub scope matrix, port 8080/8181 current behavior, channel point/event payloads. |
| Kick | CAPTCHA/human verification loops, wrong browser profile during external login, chat unreliable until source is stopped/reactivated. | Try regular Chrome with extension, try WebSocket/external-browser mode when available, complete login in the right profile, stop and activate source after login. | Current Kick auth modes, event normalization, external-browser login flow, CAPTCHA handling limits. |
| Rumble | Verification loop, wrong popup/live URL, source only works after live starts or reactivation. | Verify current accepted URL shape, try popup/live URL from current source docs, activate only after live page/chat is ready, prefer extension if embedded login fails. | Current Rumble URL parser/source behavior; do not reuse old example IDs as generic instructions. |
| Facebook | User opens publisher/creator view instead of viewer view, chat dies when popup/source closes, embedded auth/session fragility. | Use viewer-facing live/chat context, confirm network/session state, try browser extension if app auth is blocked. | Current Facebook source requirements, mobile-data claim, app-vs-extension support. |
| Instagram | User needs live chat capture but login/page state is unclear. | Identify extension vs app and exact Instagram live URL/account; sign in in the active browser/session; test only while live. | Current Instagram source coverage and page requirements. |
| Discord | User enters a generic Discord URL instead of a channel URL, source not enabled/toggled, chat is expected from app/extension without page access. | Use full channel URL when needed, enable Discord source/toggle, confirm browser/session access. | Current Discord source setup and permission requirements. |
| Slack/WhatsApp/Telegram | Messages parsed/sent incorrectly or send queue fills input without submitting; platform pages require toggles. | Enable the platform-specific source/toggle, confirm web session and permissions, test manual send first. | Current source send/ACK behavior and parsing fixes. |
| X/Twitter | Source stops working after platform changes or auth/popup changes. | Confirm current support status, logged-in browser session, exact URL, and whether extension/app mode is supported. | Current X source viability and known-broken status. |
| LinkedIn | Own comments or some messages may not appear; beta extension was historically suggested. | Confirm current extension/app version, source page, and whether messages appear for other users. | Current LinkedIn source selectors and beta/current status. |
| Mixcloud | Chat historically stopped after 30-45 minutes and refresh restored it. | Refresh/reload as a temporary workaround if current source still behaves that way. | Current Mixcloud source and recent support reports. |
| Steam Broadcast | Users cannot find a normal popout chat URL. | Use current Quick Link/source instructions; support record mentioned Broadcast Chat quick link and Steam broadcast setup. | Current Steam source docs and source URL behavior. |
| VPZone | Source can reject channel casing or revert to generic channel. | Add from VPZone source button and verify username casing. | Current VPZone source code. |
| VK Video Live | Login error or incorrect URL in embedded flow. | Ask extension vs app and exact live URL; verify platform login page behavior. | Current VK source/auth support. |
| Beamstream | Historical blank capture/timing issues and source URL examples. | Verify current source URL syntax before use. | Current Beamstream source, timing fixes, and whether the platform is still supported. |

## Cross-Platform Patterns

### Extension vs Desktop App

Support history repeatedly shows the Chrome extension works better when the platform depends on a real browser profile, cookies, or anti-bot checks. The desktop app is useful for integrated source windows and WebSocket/API flows, but embedded login can be blocked by Google, Kick, Rumble, and other protected sites.

Doc rule: avoid saying "the app is easier" or "the extension is better" globally. Tie the recommendation to the platform and auth mode.

### Standard vs WebSocket/API Modes

Support history repeatedly shows mode confusion:

- Standard/page-scrape modes can depend on page visibility, DOM changes, and browser throttling.
- WebSocket/API modes can be better for background operation but may expose different events, require scopes/auth, or miss platform-rendered messages.
- Some features such as sending, replies, channel points, memberships, gifts, or moderation events may be mode-specific.

Doc rule: source pages should include a mode matrix for capture, send, events, gifts/donos, moderation, and background reliability.

### Auth And Callback Problems

Support records mention app OAuth callback port conflicts, wrong default browser profiles, and embedded-browser rejection. These need app-source verification before exact steps are documented.

Doc rule: ask for exact error text and app/extension surface before prescribing.

### Platform Breakage

TikTok, X/Twitter, Kick, Rumble, and LinkedIn are historically volatile. Final docs should explain that platform-side changes can break integrations without over-promising repair timelines.

## Source-Check Queue

Prioritize these intense passes:

1. TikTok: Standard vs WebSocket, app signing, visibility/background behavior, gift combos, reconnect/dedupe.
2. YouTube: Studio/popout/WebSocket setup, gifts, memberships, moderation events, Google sign-in fallback.
3. Twitch: Activate/auth, IRC vs EventSub/WebSocket, channel points, subscriptions, ban/timeout events, OAuth callback ports.
4. Kick: OAuth/CAPTCHA/external browser, WebSocket bridge, rewards/event payloads.
5. Rumble/Facebook/Instagram/Discord: exact URL/page requirements and extension/app differences.
6. Settings/auth pages: app browser data clearing, profile migration, extension update without uninstall.
