# Priority Platform Answer Matrix

Status: heavy source-routing pass on 2026-06-24. This page is source-backed orientation from current platform docs plus focused source greps for send-back, source-control, auth, and event terms. It is not live platform testing.

## Purpose

Use this page when a user asks a high-volume platform question and needs a safe support answer quickly:

- Does YouTube, TikTok, Twitch, Kick, Rumble, Facebook, Instagram, or Discord work?
- Which mode should I use for this platform?
- Does it support follows, gifts, raids, rewards, viewer counts, moderation, or send-back?
- Why does app mode differ from browser extension mode?
- What should I ask before escalating a platform bug?

This page sits between:

- `supported-sites-lookup.md` for public site-card/setup lookup.
- `public-site-support-status.md` for what a public listing does and does not prove.
- `platform-capability-matrix.md` for broader cross-platform capability routing.
- Individual platform docs for current source-backed details.
- `../13-reference/app-extension-mode-crosswalk.md` for app-vs-extension caveats.
- `../13-reference/public-claims-boundary-matrix.md` for broad public wording boundaries.

For proof status behind these short answers, use `priority-platform-validation-ledger.md`.

## Source Scan Anchors

This pass checked the current docs plus source terms in:

- `sources/youtube.js`, `sources/websocket/youtube.js`, `providers/youtube/liveChat.js`
- `sources/tiktok.js`, `<ssapp repo>/tiktok/connection-manager.js`
- `sources/twitch.js`, `sources/websocket/twitch.js`, `providers/twitch/chatClient.js`
- `sources/kick.js`, `sources/kick_new.js`, `sources/websocket/kick.js`, `providers/kick/core.js`
- `sources/rumble.js`, `sources/websocket/rumble.js`
- `sources/facebook.js`, `sources/websocket/facebook.js`
- `sources/instagram.js`, `sources/instagramlive.js`, `sources/instafeed.js`
- `sources/discord.js`

Terms checked included `SEND_MESSAGE`, `SOURCE_CONTROL`, `sendMessage`, `sendChat`, `viewer_update`, `new_follower`, `subscription_gift`, `reward`, `raid`, `user_banned`, token/auth terms, and platform-specific bridge terms.

## Safe Answer Matrix

| Platform | First Safe Answer | Best Mode To Check First | Do Not Promise Without More Proof | First Follow-Up Question |
| --- | --- | --- | --- | --- |
| YouTube | Yes, SSN supports YouTube through rendered live chat and a richer WebSocket/Data API source path. | Normal visible chat: DOM live chat/popout. Richer API events: WebSocket/Data API page. | Send-back, delete, ban, moderation, subscriber alerts, redirects through API, or app parity. | Are you using normal live chat/popout, Studio chat, or the YouTube WebSocket/API source page? |
| TikTok | Yes, but TikTok is fragile and mode-specific. The standalone app has the broadest TikTok mode set. | App users: TikTok app connector modes. Browser users: standard DOM mode. | Replies, complete gift dedupe, live availability, exact event parity, or sign-server reliability. | Are you using the app or extension, and which TikTok mode: Standard, WS Auto, Local Signer, Polling, or TikFinity? |
| Twitch | Yes, visible chat works through DOM capture; richer events need WebSocket/EventSub/provider mode and OAuth scopes. | Normal chat: DOM/popout. Follows, raids, rewards, subs, moderation: WebSocket/EventSub. | Channel points, moderation, send-back, ads, follows, or subscriber data without checking scopes/role. | Do you need only visible chat, or EventSub features like rewards, raids, subs, follows, or moderation? |
| Kick | Yes, normal Kick chat can be captured, but structured rewards, follows, subs, raids, tips, moderation, and send-back are bridge/OAuth work. | Normal chat: current popout chat URL. Rich events/send-back: Kick WebSocket bridge. | Chat sending, reward events, OAuth health, CAPTCHA behavior, or `kick.js` vs `kick_new.js` runtime load. | Are you using `https://kick.com/popout/CHANNEL/chat` or the Kick bridge source page? |
| Rumble | Yes, through normal DOM capture and a read-only Rumble Live Stream API bridge. | Creator/API workflow: Rumble API bridge. Viewer/page workflow: DOM page capture. | Sending chat through the Rumble API bridge; it is documented as read-only in current source. | Are you using the private Rumble Live Stream API URL or just a normal Rumble page? |
| Facebook | Yes, but viewer DOM capture and managed Page Graph API bridge are different workflows. | Page owner/admin: Graph API bridge. Viewer/browser workflow: DOM page capture. | Graph token permissions, viewer count, Page role behavior, app OAuth, or Stars parity. | Are you viewing as a normal viewer or managing the Page/live video as the owner/admin? |
| Instagram | Limited DOM capture is supported for Instagram Live and feed/post/comment capture. | Live chat: Instagram Live DOM page. Feed/comments: normal Instagram page with visible comments. | Send-back, API/headless capture, membership/donation fields, or app parity. | Is this Instagram Live chat or regular feed/post/comment capture? |
| Discord | SSN captures visible Discord web messages from the web app. It is not a Discord bot/API integration. | Web Discord page with `/channels/` URL and the source enabled. | Discord bot behavior, roles/moderation, direct-message automation, or send-back. | Is the Discord web page open on the exact channel, and is any custom channel filter enabled? |

## Event And Send-Back Cheat Sheet

| User Asks | Safer Answer | Check Next |
| --- | --- | --- |
| Can SSN send chat back to YouTube? | Maybe. YouTube source-control/send behavior is mode- and auth-specific, so do not answer from capture support alone. | `youtube.md`, `sources/websocket/youtube.js`, `providers/youtube/liveChat.js` |
| Can SSN reply to TikTok? | Sometimes. TikTok replies require a suitable app/source mode and a signed-in session; reading can work while replies fail. | `tiktok.md`, `tiktok-standalone-app.md`, app `connection-manager.js` |
| Can SSN send Twitch chat? | WebSocket/provider mode has send-message paths, but the client must be connected to the right channel with OAuth and role/scope coverage. | `twitch.md`, `sources/websocket/twitch.js`, `providers/twitch/chatClient.js` |
| Can SSN send Kick chat? | The Kick bridge has send paths when OAuth tokens/scopes are valid; DOM capture alone is not the send path. | `kick.md`, `sources/websocket/kick.js` |
| Can SSN send Rumble chat? | No for the documented Rumble API bridge in current notes; it logs read-only behavior for send attempts. | `rumble.md`, `sources/websocket/rumble.js` |
| Can SSN send Facebook/Instagram/Discord messages? | Do not promise. Current docs describe capture paths, not a verified send-back integration for these surfaces. | `facebook.md`, `instagram.md`, `discord.md`, current source |
| Does a platform support rewards/channel points? | Twitch and Kick have structured reward paths in richer source modes; normal DOM capture may only see visible text. | `twitch.md`, `kick.md`, Event Flow docs |
| Does a platform support follows/raids/subs/gifts? | Often yes only in richer source/API modes or when the platform renders a visible system row. Check mode and source. | `platform-capability-matrix.md`, individual platform doc |
| Does a platform support viewer counts? | Sometimes, gated by settings/source mode/API availability. Treat viewer counts as optional and platform-limited. | individual platform doc and source |
| Does a platform support moderation/delete/ban? | This is high risk. It needs source-control, OAuth/scopes, role, and live validation before a strong answer. | `api-command-validation-matrix.md`, platform source |

## Platform-Specific Safe Phrasing

### YouTube

Safe:

```text
YouTube support depends on the capture mode. Use the normal live chat/popout for rendered chat. Use the WebSocket/Data API source page for richer API-backed events. Do not assume send-back, delete, ban, moderation, or subscriber alerts work unless that mode and auth path are verified.
```

Ask:

- Is the stream live?
- Is the user using a watch URL, live chat popout, Studio chat, or WebSocket/Data API page?
- Does the dock receive messages before OBS is involved?
- Are they expecting normal chat, gifts/memberships, viewer counts, moderation, or send-back?

Do not say:

- "YouTube API mode exposes every DOM event."
- "Subscriber alerts are instant."
- "YouTube capture means YouTube send-back works."

### TikTok

Safe:

```text
TikTok is mode-sensitive. The extension DOM path reads rendered TikTok Live rows. The standalone app has broader connector/signing modes and reply paths, but replies still need the right mode and a signed-in session.
```

Ask:

- App or extension?
- Which mode: Standard, WS Auto, Local Signer, Polling, or TikFinity?
- Is the TikTok account actually live?
- Does reading fail, or only replies?
- Is the app version current?

Do not say:

- "TikTok WS always works."
- "If reading works, replies will work."
- "TikFinity fallback supports replies."

### Twitch

Safe:

```text
Twitch visible chat can work in DOM mode. Follows, raids, channel points, subs, bits, deletes, bans, ads, and stronger event support belong to WebSocket/EventSub/provider mode and depend on OAuth scopes and channel role.
```

Ask:

- DOM chat or WebSocket/EventSub?
- Broadcaster, moderator, or viewer account?
- Which event is missing?
- Did sign-in grant the needed scopes?

Do not say:

- "DOM capture gives full EventSub support."
- "Channel points work without broadcaster authorization."
- "Send chat works without a connected Twitch chat client."

### Kick

Safe:

```text
Use Kick popout chat for visible chat. Use the Kick bridge source page for structured rewards, follows, subs, raids, KICKs/tips, moderation events, and chat sending. OAuth/CAPTCHA and token state can change the result.
```

Ask:

- Popout chat or bridge source page?
- Same SSN session as dock/Flow Actions?
- Signed in with Kick and connected channel?
- CAPTCHA/human verification shown?
- Exact reward title if Event Flow is involved?

Do not say:

- "Opening Kick chat is enough for channel point events."
- "Kick OAuth will behave the same in Chrome and the app."
- "DOM capture is the reliable send-chat path."

### Rumble

Safe:

```text
Rumble has normal DOM capture and a Rumble Live Stream API bridge. The API bridge is read-only in current docs/source, but it is the structured path for chat, rants, followers, subscribers, gifted subs, viewer counts, and stream status.
```

Ask:

- Normal page or API bridge?
- Is the private API URL pasted into the bridge page?
- Is the stream active?
- Is replay enabled and causing old messages?

Do not say:

- "Rumble API mode can send chat."
- "The private API URL is safe to share publicly."

### Facebook

Safe:

```text
Facebook support depends on whether this is visible DOM capture or managed Page Graph API bridge. Page-token/API behavior depends on Page role, token permissions, live video ID, and current Graph API behavior.
```

Ask:

- Viewer page or managed Page workflow?
- Page owner/admin or normal viewer?
- Live video ID known?
- Is the token expired or missing permissions?
- Are comments visible in the opened page?

Do not say:

- "Any Facebook viewer can use the Page API bridge."
- "DOM capture and Graph API mode expose the same data."
- "Stars/viewer counts are guaranteed."

### Instagram

Safe:

```text
Instagram support is DOM capture for visible live/feed/comment content. It is not a verified headless or API bridge. Live join events require visible rows and the join-event setting.
```

Ask:

- Live or feed/post/comments?
- Are messages visibly appearing?
- Is the page logged in and loaded?
- Are join events expected, and is `capturejoinedevent` enabled?

Do not say:

- "Instagram send-back is supported."
- "Instagram API capture is built in."
- "Live and feed capture use identical downstream source types."

### Discord

Safe:

```text
Discord support means DOM capture from the Discord web app. It watches visible web messages on `/channels/` URLs. It is not a Discord bot/API integration.
```

Ask:

- Is Discord open in the browser/app source window on a `/channels/` URL?
- Is the Discord source setting enabled?
- Is a custom channel filter configured?
- Are messages visible and new after source load?

Do not say:

- "SSN has a Discord bot."
- "Discord roles/moderation are exposed."
- "Discord send-back is supported."

## Escalation Rules

Escalate or source-check before giving a final answer when:

- The user needs send-back, moderation, deletes, bans, or API write behavior.
- The user needs follows, raids, rewards, gifts, tips, viewer counts, or purchases to trigger automation.
- The behavior differs between app and extension.
- The source depends on OAuth, loopback auth, CAPTCHA, platform tokens, or a private API URL.
- The user says the public site list proves a feature should work.
- The platform recently changed layout, login policy, API access, or event names.

## Answer Template

```text
Short answer: [yes/no/depends]. For [platform], [feature] depends on [mode/auth/source]. Start with [best mode/setup]. Do not assume [common overclaim]. If this needs a final support answer, verify [exact source/doc/runtime evidence].
```

## Follow-Up Needs

- Line-level source-control/send-back validation for YouTube, Twitch, Kick, and TikTok app paths.
- Runtime browser/app checks for top-platform DOM capture versus WebSocket/API source-page behavior.
- OAuth/scope/role validation for YouTube, Twitch, Kick, and Facebook.
- App parity validation for each priority platform.
- Support-history refresh focused on platform-specific current failures, without copying raw support transcripts.
