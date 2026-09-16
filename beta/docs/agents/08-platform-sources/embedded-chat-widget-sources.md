# Embedded Chat Widget Sources

Status: heavy grouped pass started on 2026-06-24. This page documents smaller embedded chat and IRC-style source scripts that were previously inventory-only.

Use this page when a user asks about CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit Chat, or Online Church.

## Source Anchors

- `sources/cbox.js`
- `sources/chatroll.js`
- `sources/kiwiirc.js`
- `sources/quakenet.js`
- `sources/minnit.js`
- `sources/onlinechurch.js`
- `manifest.json`
- `docs/js/sites.js`

## Core Rule

These sources are rendered page/chat-widget capture. They are not platform API integrations.

Support answers should start with:

- Confirm the exact widget URL matches the public setup and manifest row.
- Reload the widget/page after extension install or reload.
- Keep the widget visible enough for new messages to render.
- Test with a new message, not old history.
- Do not promise rich platform events, moderation, or send-back. The inspected scripts implement `getSource` and `focusChat`, but no source-level `SEND_MESSAGE` handler.

`focusChat` only focuses the chat input where possible. It does not prove SSN can send a reply.

## Source Matrix

| Source | Public Setup | Manifest Matches | Captures | Bridge Notes |
| --- | --- | --- | --- | --- |
| CBOX | Standard CBOX card | `https://*.cbox.ws/box/*` | `.msg` rows under `#messages`, sender `.nme`, avatar `img.pic`, and message `.body` | Payload `type` and `getSource` are `cbox`; runs with `all_frames`; focuses `textarea`. |
| Chatroll | Standard Chatroll card | `https://chatroll.com/embed/chat/*` | `.message` rows under `.chat-messages`, sender `.message-profile-name`, avatar background image, and `.message-text` | Payload `type` and `getSource` are `chatroll`; runs with `all_frames`; converts avatar URL to data URL when possible; focuses `.chat-input`. |
| KiwiIRC | Standard IRC KiwiIRC card | `https://kiwiirc.com/nextclient/*` | `.kiwi-messagelist-item` rows, nick from `[data-nick]`, body `.kiwi-messagelist-body`, avatar `.kiwi-avatar img` | Payload `type` and `getSource` are `kiwiirc`; marks traffic/system rows with `event: true`; focuses `.keyboard-input`. |
| QuakeNet | Standard IRC QuakeNet card | `https://webchat.quakenet.org/*` | IRC webchat rows under `.ircwindow`, sender `.hyperlink-whois`, message from adjacent text nodes | Payload `type` and `getSource` are `quakenet`; focuses `.keyboard-input`; parser is brittle and still has console debug logging. |
| Minnit Chat | Standard Minnit Chat card | `https://minnit.chat/*&popout`, `https://*.minnit.chat/*&popout`, `https://*.minnit.chat/*/Main` | Minnit iframe `#chat` entries with `data-muuid`, sender `.msgNick`, avatar `.msgPic img`, and `.msgTextOnly` content | Payload `type` and `getSource` are `minnit`; runs with `all_frames`; converts canvas emoji where possible; sends periodic `keepAlive`; focuses iframe `#textbox`. |
| Online Church | Standard Online Church card | `https://*.online.church/*` | `#publicchat` message containers, sender name, message body, badges/icons, avatar, and optional viewer count updates | Payload `type` and `getSource` are `onlinechurch`; can emit `event: "viewer_update"` when viewer count/hype settings apply; includes hidden-tab WebRTC keepalive; focuses public chat textarea. |

## Capture Behavior

### CBOX

`sources/cbox.js` watches `#messages` for added `.msg` nodes. It extracts:

- sender from `.nme`
- avatar from `img.pic[src]`
- message HTML/text from `.body`

The manifest loads this script in all frames for CBOX box URLs. If capture fails, confirm the user is on the embedded CBOX box URL and that the message list is not inside an unexpected nested frame that did not receive the script.

### Chatroll

`sources/chatroll.js` waits for `.chat-messages`, then watches for `.message` rows. It extracts a visible sender, message text, and profile image from Chatroll's background-image style.

The message listener is only started after the chat message container exists. First checks:

1. The user is on `chatroll.com/embed/chat/*`.
2. The embedded chat has fully loaded.
3. New messages are appearing in `.chat-messages`.
4. The user reloaded after installing/reloading SSN.

### KiwiIRC

`sources/kiwiirc.js` watches `.kiwi-messagelist` for `.kiwi-messagelist-item` rows. It uses `[data-nick]` for the sender and `.kiwi-messagelist-body` for message content.

It sets `event: true` when the row contains `.kiwi-messagelist-message-traffic`, so IRC traffic/system rows may appear as event-like payloads rather than ordinary user chat.

### QuakeNet

`sources/quakenet.js` watches `.ircwindow` and extracts the sender from `.hyperlink-whois`. Message extraction depends on adjacent text nodes or sibling content after the name.

This parser is more fragile than the others in this group because it relies on nearby text-node structure and still includes console debug logging. If QuakeNet stops capturing, inspect the live DOM before assuming a general SSN issue.

### Minnit Chat

`sources/minnit.js` scans iframes until it finds a Minnit `#chat` container. It watches for nodes with `data-muuid`, extracts `.msgNick`, `.msgPic img`, and `.msgTextOnly`, and tries to convert emoji/canvas content into displayable message HTML.

Important support boundaries:

- The public listing says `https://minnit.chat/*`, but the manifest patterns are popout/Main-style URLs.
- If capture fails, ask whether the user opened a popout/Main chat URL and whether the Minnit iframe has finished loading.
- The script sends a periodic `keepAlive` message, but this is not the same as platform send-back.

### Online Church

`sources/onlinechurch.js` watches `#publicchat` for message containers. It ignores existing rows when the observer starts, filters stale rows older than roughly 90 seconds, and dedupes repeated sender/message pairs over a short history window.

It can also emit viewer count updates when `showviewercount` or `hypemode` is enabled:

```text
type: "onlinechurch"
event: "viewer_update"
meta: count
```

It includes a WebRTC loopback keepalive when the tab is hidden. If Online Church chat stops after backgrounding, still check browser throttling, source visibility, and the page's current DOM before relying on the keepalive.

## Send-Back Boundary

For the scripts inspected in this pass:

- All implement `getSource`.
- All implement or attempt `focusChat`.
- None implements a source-level `SEND_MESSAGE` handler.

Support wording should be: "SSN can capture the rendered widget chat when the page matches and the widget is visible. Sending replies back is not documented by these source scripts."

## Common Support Patterns

### "The site is listed, but nothing appears."

Use this order:

1. Confirm exact URL against the matrix above.
2. Confirm the widget has loaded and new messages are visible.
3. Reload the widget/page after extension install/reload.
4. Check whether the chat is inside an iframe and whether the manifest row uses `all_frames`.
5. Test with a new message.
6. Check source-specific stale/dedupe behavior, especially Online Church.

### "Can this source show events or viewer counts?"

Usually no for this group, except:

- KiwiIRC marks traffic/system rows with `event: true`.
- Online Church can emit `viewer_update` events when viewer count/hype settings are enabled.

Do not infer donations, rewards, moderation, or rich platform events from these scripts.

### "Can this source reply back?"

Not through the inspected source scripts. They can focus inputs, but no source-level send handler was found.

## Extraction Gaps

Needed future passes:

- Live validation for current CBOX, Chatroll, KiwiIRC, QuakeNet, Minnit, and Online Church layouts.
- Remove or classify QuakeNet debug logging if it is still present in production builds.
- Verify Minnit public setup wording against manifest popout/Main patterns.
- Check whether any background/dock debugger path can type/send after `focusChat`.
- Add controlled payload samples for KiwiIRC traffic rows and Online Church viewer updates.
