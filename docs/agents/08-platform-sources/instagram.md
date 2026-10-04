# Instagram Source

Status: heavy extraction pass started on 2026-06-24.

## Purpose

Document SSN's Instagram and Instagram Live content scripts. Instagram has multiple source files because feed/comment capture and live-chat capture have different DOM behavior.

## Source Anchors

- `social_stream/sources/instagram.js`
- `social_stream/sources/instagramlive.js`
- `social_stream/sources/instafeed.js`
- `stevesbot/data/sqlite/knowledge.sqlite`

## Source Files

`sources/instagram.js` and `sources/instagramlive.js` currently contain overlapping logic for:

- Instagram Live chat capture.
- Instagram feed/post/comment capture.

`sources/instafeed.js` is an older/smaller capture path for Instafeed-style live pages and emits `type: "instagramlive"`.

## Instagram Live Capture

Live chat now has two capture paths, REST-first with DOM fallback.

### REST path (primary)

When a live page exposes a `broadcast_id` (URL `?broadcast_id=` or page scripts), the source polls Instagram's own web API same-origin with session cookies:

- `GET /api/v1/live/{broadcast_id}/get_comment/?last_comment_ts={ts}` every 2s. Response gives `comments[]` and `system_comments[]` with `pk`, `created_at`, `text`, `user.username`, `user.profile_pic_url`, `user.is_verified`. Comment `pk` is used for dedupe; `last_comment_ts` advances to the newest `created_at`.
- `POST /api/v1/live/{broadcast_id}/heartbeat_and_get_viewer_count/` every 5s (only when `showviewercount`/`hypemode` is on). Emits `viewer_update` with `meta` integer when `viewer_count` changes. `broadcast_status !== "live"` stops REST polling.
- Required headers: `X-IG-App-ID: 936619743392459`, `X-CSRFToken` (from cookie), `X-ASBD-ID: 359341`, `X-Requested-With: XMLHttpRequest`.
- After 3 consecutive failures (non-200 or bad JSON) REST polling stops and the DOM path takes over automatically. Ended broadcasts return HTTP 400 ("media has been deleted"), which exercises this fallback.

### DOM path (fallback)

The live path detects live pages by URL/path patterns containing `/live` and looks for live chat rows in the page DOM.

It extracts:

- `chatname`
- `chatmessage`
- `chatimg`
- `chatbadges`
- `hasDonation: ""`
- `membership: ""`
- `contentimg: ""`
- `event`
- `textonly`
- `type: "instagramlive"`

Important behavior:

- It uses profile image candidates and visible text to infer the username.
- It treats the text after the username as the message.
- It preserves inline HTML/emoji images when text-only mode is off.
- It rejects rows where name/message are missing or identical.
- A message of `joined` becomes `event: "joined"` only when `settings.capturejoinedevent` is enabled.
- It delays placeholder-looking rows so Instagram's live DOM has time to finish rendering.
- It uses a `MutationObserver` on the live section and can reprocess rows after character-data changes.

## Instagram Feed/Post Capture

The feed path processes visible `article` nodes and comment nodes.

Post payloads include:

- `chatname` from header link or profile-image alt text.
- `chatmessage` from caption-like nodes.
- `chatimg`
- `contentimg` from post media when available.
- `type: "instagram"`

Comment payloads include:

- `chatname` from comment author link or profile image alt text.
- `chatmessage` from the comment message node.
- `chatimg`
- `contentimg` for comment media when available.
- `type: "instagram"`

Rows are marked with `dataset.ssProcessed` to reduce duplicate sends.

## Instafeed Capture

`sources/instafeed.js` extracts from a simpler DOM structure:

- Username from a `b` element.
- Message from a `span`.
- Avatar image, normalized with `https://instafeed.me` when the path is relative.
- `type: "instagramlive"`.

It uses a `MutationObserver` and sends through the extension runtime.

## Instagram Notifications Capture (News Inbox)

The account's own activity feed (follows, follow requests, likes, comments on our posts) is captured via `POST /api/v1/news/inbox/` every ~45s from any instagram.com page. Same headers as the live REST path, empty urlencoded body.

- Response: `new_stories[]`, `old_stories[]`, `priority_stories[]`. Each story has `notif_name` (classification string), `story_type` (int), `args.text`, `args.profile_name`, `args.profile_image`, `args.timestamp`, `args.tuuid` (dedupe key).
- First poll seeds the seen-set without emitting so backlog never replays.
- Mapping: `follow_request` notif → `event: "follow_request"`; follow notif / `story_type 12` → `event: "new_follower"`; like notifs (incl. `comment_like`) → `event: "liked"`; comment notifs → plain chat row (`event: false`); anything else → `event: "notification"` with `meta.notifName`/`meta.storyType`. All use `type: "instagram"`.
- Known `notif_name` seen live: `private_user_follow_request` (`story_type 75`).
- 5 consecutive failures stops the inbox poller for the page session.

## Finding Instagram Live Streams For Testing

There is no public live directory (IGTV removed, Explore has no live unit) and no web discovery API — `GET /api/v1/feed/reels_tray/` only returns broadcasts for accounts you already follow. Strategy: follow many frequently-live accounts, then watch the tray.

- Machine-readable check: `GET /api/v1/feed/reels_tray/` → `broadcasts[]` with `id` (broadcast_id), `broadcast_owner.username`, `viewer_count`, `broadcast_status`, `cobroadcasters[]`. This is the fast way to detect an active live without DOM scraping the Stories tray.
- DOM equivalent: the Stories tray shows a `LIVE` badge span under the account's avatar; clicking the profile avatar (not the tray item) opens `/<user>/live/?broadcast_id=...`. Direct `/​<user>/live/?broadcast_id=<id>` URLs also work while the broadcast is active; they redirect to the profile once it ends.
- Following accounts quickly: `POST /api/v1/friendships/create/{pk}/` (resolve `pk` via `/api/v1/web/search/topsearch/?query=<name>&context=blended`). Some large accounts disable follows (no Follow button; API returns an error) — skip those.
- Reliable live categories: news/radio (weekday mornings), churches (Sunday mornings US), Latin music/creators (evenings), Brazilian creators (late evening ET), festivals (Tomorrowland etc. during events). Two test accounts also work: post from A, interact from B, watch A's inbox.

## Login And Session Assumptions

The current capture paths are DOM readers. They generally need the user to have the relevant Instagram page open in a browser/app context where the messages are visible. They do not show a separate OAuth/token bridge like the Facebook or Kick bridge pages.

Support answers should avoid promising headless or API-style Instagram capture unless a current source path is verified.

## Payload Notes

Instagram Live uses:

```text
type: instagramlive
```

Instagram feed/comments use:

```text
type: instagram
```

Neither path currently sets donation or membership fields from source code reviewed in this pass; those fields are present but empty.

When text-only mode is off, inline media/emoji markup can be preserved in `chatmessage`. When text-only mode is on, text is escaped/stripped.

## Common Failures

No live messages:

- Confirm the URL is an Instagram Live page.
- Confirm chat rows are visibly appearing.
- Confirm extension capture is enabled.
- Instagram may be delaying/rewriting placeholder rows; wait for actual rendered chat.
- Instagram DOM changes can break selectors.

Joined events missing:

- `joined` rows are filtered unless `capturejoinedevent` is enabled.

Feed/comments missing:

- Confirm the post/comment is visibly loaded in the page DOM.
- Infinite-scroll/comment expansion may require opening or expanding the comment area before SSN can see rows.
- Already processed nodes are skipped to prevent duplicates.

Avatar/media missing:

- Some Instagram media URLs may be blocked, lazy-loaded, or hidden behind DOM changes.
- The capture code only sends `contentimg` when it can find a usable media element.

Wrong source type in downstream filters:

- Use `instagramlive` for live chat.
- Use `instagram` for feed/post/comment capture.

## Remaining Extraction Targets

- Determine which of `instagram.js` and `instagramlive.js` is loaded for each popup/source path.
- Source-check popup button URLs and any Instagram-specific settings labels.
- Mine support history for current Instagram login/session issues and validate against code.
