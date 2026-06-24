# Discord Source

Status: heavy extraction pass started on 2026-06-24.

## Purpose

Document Discord as an SSN platform source. This is separate from Discord support-history mining in `stevesbot`; that support archive is a data source for documentation, not the same thing as SSN's Discord capture script.

## Source Anchors

- `social_stream/sources/discord.js`
- `social_stream/docs/event-reference.html`
- `stevesbot/data/sqlite/archive.sqlite`

## Capture Model

`sources/discord.js` is a DOM-based content script for Discord web pages. It watches the message list under:

```text
[data-list-id="chat-messages"]
```

It only runs message capture on URLs containing:

```text
/channels/
```

New Discord message rows are processed through a `MutationObserver`.

## Enablement Rules

The script checks:

- `settings.discord`, unless running inside SSApp/Electron-like contexts (`window.ninjafy` or `window.electronApi`).
- Optional custom channel restrictions from `settings.customdiscordchannel.textsetting`.

If custom Discord channels are configured, the current URL's final path segment must match one of the configured values. This can be used to limit capture to specific channels.

## Message Extraction

For each Discord row, the script extracts:

- Message ID into `id`.
- Username from `#message-username-*`.
- Avatar URL from Discord avatar images.
- Name color from the username node.
- Bot marker from bot tag selectors.
- Message body from `#message-content-*`.
- Embed description fallback from `#message-accessories-*`.
- Attached image/video/sticker/canvas media into `contentimg`.

If a message row omits the username/avatar because Discord visually groups consecutive messages, the script walks backward through previous rows to find the prior username/avatar.

Rows where the inferred name contains ` @ ` are treated as likely relayed webhook messages and skipped.

## Payload Fields

Discord payloads include:

- `id`
- `chatname`
- `chatbadges`
- `backgroundColor`
- `textColor`
- `bot`
- `event`
- `chatmessage`
- `chatimg`
- `nameColor`
- `hasDonation: ""`
- `membership`
- `contentimg`
- `textonly`
- `type: "discord"`

If no name is found, `event` is set to `true`.

If a name color exists and `settings.discordmemberships` is enabled, `membership` is set to the localized membership label.

The script converts `contentimg` and `chatimg` to data URLs where possible before relaying.

## UI Helper Behavior

The script includes a keyboard helper:

- `Ctrl+Shift+<` hides most page elements except video/overlay title elements.
- `Ctrl+Shift+>` restores them.

This appears intended for cleaning up a Discord view when used as a visual source.

The source also listens for `focusChat` messages and focuses Discord's text area when the active channel is allowed.

## Common Failures

No Discord messages:

- Confirm the Discord setting is enabled, unless using SSApp/Electron where the script bypasses that specific setting check.
- Confirm the page URL includes `/channels/`.
- Confirm the channel is allowed by `customdiscordchannel` if configured.
- Confirm the Discord web page is open and showing new messages.
- Discord DOM class/name changes can break selectors.

Attachments missing:

- The script searches normal images, video posters, sticker images, and sticker canvas. Other attachment layouts may not be captured.
- Some media conversion to data URL can fail due to browser/CORS behavior.

Bot messages missing:

- Bots are marked with `bot: true`, not automatically blocked by this script.
- A relayed webhook-style name containing ` @ ` is skipped to avoid echo loops.

Membership missing:

- `settings.discordmemberships` must be enabled.
- Discord must expose a usable name color.
- This is a heuristic membership marker, not a full Discord role API lookup.

Duplicate messages:

- The script keeps a `lastMessage` serialized payload check and a highest message ID tracker, but DOM rerenders can still create edge cases.

## Support Boundary

When mining Discord support data from `stevesbot`, keep these concepts separate:

- Discord as an SSN source: this page and `sources/discord.js`.
- Discord as historical support archive: user conversations and bot support logs stored in SQLite or exported files.

Do not cite support archive data as if it were Discord source behavior unless the current source code confirms the behavior.

## Remaining Extraction Targets

- Source-check popup/source setup labels for Discord.
- Verify current Discord setting names in `settings/*` and `popup.js`.
- Mine support history for current Discord-specific capture failures and validate against this source.
