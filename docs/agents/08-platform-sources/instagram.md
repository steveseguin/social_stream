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
