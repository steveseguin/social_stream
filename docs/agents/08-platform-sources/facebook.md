# Facebook Source

Status: heavy extraction pass started on 2026-06-24.

## Purpose

Document SSN's Facebook capture paths: DOM capture on Facebook/Workplace pages and the managed Page Graph API bridge.

## Source Anchors

- `social_stream/sources/facebook.js`
- `social_stream/sources/websocket/facebook.html`
- `social_stream/sources/websocket/facebook.js`
- `ssapp/resources/electron-facebook-handler.js`
- `stevesbot/resources/instructions/social-stream-support.md`

## Capture Modes

### DOM Capture

`sources/facebook.js` is a Chrome extension content script. It watches Facebook live/chat DOM rows and extracts visible messages.

It can emit:

- `type: "facebook"` for Facebook.
- `type: "workplace"` when the URL is Workplace.
- `chatname`
- `chatmessage`
- `chatimg`
- `chatbadges`
- `contentimg`
- `hasDonation` for Stars data
- `donoValue` for parsed Stars amount
- `highlightColor` for highlighted messages
- `initial` and `reply` when reply context is included
- `textonly`

It has duplicate protection for recent rows and special handling for Stars row IDs.

### Managed Page API Bridge

`sources/websocket/facebook.html` and `sources/websocket/facebook.js` implement a Facebook Live comments bridge using the Facebook Graph API.

The page is meant for Pages the user manages. The setup notes in the page say:

1. This only works for Pages you manage.
2. Sign in, pick a Page, resolve the live video, then connect.
3. Manual fallback: paste a Page token and video ID yourself.
4. Auto-connect URL can include `videoId`, `access_token`, and `autoconnect=1`.

The bridge polls live video comments and optionally viewer count. Keep the page open while it should relay Facebook Live comments into SSN.

## API Bridge Setup

Normal setup:

1. Open the Facebook bridge page.
2. Click Sign in with Facebook.
3. Select a managed Page.
4. Resolve or enter the live video ID.
5. Click Connect.

Manual setup:

1. Paste a Page access token.
2. Paste a live video ID or Facebook video URL.
3. Optionally enter a Page ID/page name for resolve.
4. Connect.

Advanced fields in the page:

- `videoId`
- `pageId`
- `access_token` or `token`
- `poll`
- `autoconnect`
- `live_filter`
- `oauthBase`

The default OAuth service URL in source is:

```text
https://auth.socialstream.ninja/auth/facebook/pages
```

Support should not ask users to change that unless debugging a known auth-service issue.

## API Bridge Payloads

Comment payloads include:

- `platform: "facebook"`
- `type: "facebook"`
- `chatname`
- `chatmessage`
- `chatimg` from Graph profile picture URL when a sender ID is available
- `chatbadges`
- `backgroundColor`
- `textColor`
- `hasDonation`
- `membership`
- `textonly`
- `timestamp`
- `meta`

`meta` includes:

- `commentId`
- `fromId`
- `fromName`
- `createdTime`
- `permalink`
- `videoId`
- `pageId`
- `attachment` when present

Viewer-count payloads use:

- `platform: "facebook"`
- `type: "facebook"`
- `event: "viewer_update"`
- `meta` set to the viewer value
- empty chat fields
- `textonly: true`

## Polling And Errors

The API bridge polls comments using Graph API fields:

```text
id,from{name,id},message,created_time,permalink_url,attachment
```

If live filter is enabled, it requests `live_filter=stream`; otherwise it falls back to chronological ordering. If the API reports live filter is unsupported, the code switches to chronological polling.

For invalid token or permission errors, especially Graph error codes `190` or `10`, the bridge stops and shows an access-token/permission error.

Polling uses backoff after failures, up to a larger delay.

## DOM Capture Notes

DOM capture is useful when the user is watching a Facebook live page in a browser tab and the extension can read visible comments. It is more fragile than API polling because Facebook markup changes frequently.

DOM capture includes reply context unless `excludeReplyingTo` is enabled. It can parse Stars information into `hasDonation` and `donoValue`.

Existing support history says Facebook can depend on the viewing context. For end-user troubleshooting, ask whether the user is viewing the live as a normal viewer/Page admin and whether comments are visibly appearing in the opened source tab.

## Common Failures

API bridge cannot sign in:

- Popup blocked by browser.
- Auth service unavailable.
- User does not manage any Pages.
- Browser/local storage has stale auth state; use Clear sign-in and sign in again.

API bridge connects but no comments:

- Wrong Page selected.
- Wrong live video ID.
- No active live comments yet.
- Live filter not supported; allow chronological fallback.
- Page token lacks needed permission or has expired.

Viewer count missing:

- Viewer-count polling may be disabled.
- The Graph API may return a different viewer field or no live viewer count for the video state.
- In extension use, the page notes viewer count can be controlled by SSN's `showviewercount` setting.

DOM capture sees no messages:

- The wrong Facebook surface is open.
- The page is in a publisher/admin mode that does not expose comments the same way as viewer mode.
- Facebook changed selectors.
- Extension capture is off or settings did not reach the content script.

Stars/donations missing:

- Confirm the Stars row is visible in the DOM for DOM capture.
- The API bridge comment payload extraction does not currently document Stars parsing the same way DOM capture does.

## Remaining Extraction Targets

- Read `ssapp/resources/electron-facebook-handler.js` line-by-line for standalone OAuth details.
- Cross-check current Graph API permission names and token lifetime expectations against Facebook's current official docs before publishing public auth instructions.
- Verify support-mined viewer-mode advice against current Facebook DOM capture behavior.
