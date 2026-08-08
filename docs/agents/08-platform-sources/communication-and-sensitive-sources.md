# Communication And Sensitive Sources

Status: heavy grouped pass started on 2026-06-24. This page documents source scripts for private communication, meeting, and assistant pages that are easy to confuse with normal public live-stream sources.

Use this page when a user asks about ChatGPT/OpenAI page capture, Slack, Telegram, WhatsApp, Google Meet, Microsoft Teams, Zoom, Webex, or Amazon Chime.

## Source Anchors

- `sources/openai.js`
- `sources/slack.js`
- `sources/telegram.js`
- `sources/telegramk.js`
- `sources/whatsapp.js`
- `sources/meets.js`
- `sources/teams.js`
- `sources/zoom.js`
- `sources/webex.js`
- `sources/chime.js`
- `manifest.json`
- `docs/js/sites.js`
- `shared/config/settingsDefinitions.js`
- Related dedicated page: `discord.md`

## Core Rule

These sources capture rendered web-page chat. They are not platform bot/API integrations, and they should be treated as privacy-sensitive.

Support answers should include:

- Confirm the user is using the web version of the service.
- Confirm any required SSN source toggle is enabled, then reload the page.
- Keep the chat panel open and visible enough for messages to render.
- Treat screenshots and URLs as private, because they can contain workspace names, meeting IDs, phone numbers, DMs, internal channels, or AI conversation content.
- Do not promise send-back or moderation. The inspected scripts implement `getSource`, `focusChat`, and settings handling, but no source-level `SEND_MESSAGE` path.

`focusChat` only focuses the platform input. It is not the same as sending a message.

## Source Matrix

| Source | Public Setup | Generated Setting | Manifest Matches | Captures | Bridge Notes |
| --- | --- | --- | --- | --- | --- |
| ChatGPT/OpenAI page | Toggle-required ChatGPT card | `openai` | `https://chat.openai.com/*`, `https://chatgpt.com/*` | ChatGPT conversation rows, with user/assistant name inference and assistant icon fallback | `getSource` returns `openai`; `focusChat` targets `#prompt-textarea`; waits for streaming responses before sending. |
| Slack | Toggle-required Slack card | `slack` | `https://app.slack.com/client/*` | Message text, sender, avatar, images/emotes preserved when not in text-only mode | `getSource` returns `slack`; focuses contenteditable textbox; dedupes by Slack virtual-list IDs and recent sender/message state. |
| Telegram | Toggle-required Telegram card | `telegram` | `https://*.telegram.org/z/*`, `https://*.telegram.org/a/*`, `https://*.telegram.org/k/*` | Web Telegram messages, images/content images, chat title/avatar fallback | `telegram.js` handles `/z` and `/a`; `telegramk.js` handles `/k`; both return source/type `telegram`. |
| WhatsApp Web | Toggle-required WhatsApp card | `whatsapp` | `https://web.whatsapp.com/` | Rendered WhatsApp messages, excluding quoted/reply text where possible | `getSource` returns `whatsapp`; focuses footer textbox; public docs note no avatar support; script includes a hidden-tab keepalive. |
| Google Meet | Toggle-required Meet card | `meet` | `https://meet.google.com/*` | Meet side-panel chat messages and participant images when available | `getSource` returns `meets` while payload `type` is `meet`; supports host/my-name override settings. |
| Microsoft Teams | Public card says standard; generated toggle exists | `teams` | `https://teams.live.com/*`, `https://teams.microsoft.com/*`, `https://teams.cloud.microsoft/*` | Teams message-pane chat in iframe and newer chat-pane layouts | `getSource` and payload `type` are `teams`; focuses Teams textbox in iframe or top page. |
| Zoom | Standard Zoom web card | none found in generated setting index | `https://*.zoom.us/*`, `https://zoom.us/*`, `https://*.zoom.com/*`, `https://zoom.com/*` | Chat messages, Q&A questions, poll HTML payloads, and reaction events | Payloads include `type: "zoom"`, `type: "zoom_poll"`, `question: true`, and `event: "reaction"` paths; includes visibility/keepalive patches. |
| Webex | Standard Webex card | none found in generated setting index | `https://*.webex.com/*`, `https://webex.com/*` | Webex meeting-panel chat messages, sender names, avatars when convertible | `getSource` and payload `type` are `webex`; scans meeting panel in top page and iframe. |
| Amazon Chime | Standard Amazon Chime card; generated toggle exists | `chime` | `https://app.chime.aws/meetings/*` | Chime chat message wrappers/bubbles, sender names, plain text | `getSource` and payload `type` are `chime`; source comment says it does not support sending messages. |

## Privacy And Opt-In Notes

These are not ordinary public stream-chat sources:

- Slack, Telegram, WhatsApp, Meet, ChatGPT/OpenAI page, Discord, and similar sources are explicitly privacy-sensitive.
- Public site cards for Slack, Telegram, WhatsApp, Meet, and ChatGPT say the menu toggle is required.
- Generated opt-in setting keys found in this pass: `openai`, `slack`, `telegram`, `whatsapp`, `meet`, `teams`, and `chime`.
- Zoom and Webex were found as standard public cards and no generated `zoom` or `webex` toggle was found in `shared/config/settingsDefinitions.js` during this pass.
- Teams and Chime have generated opt-in setting keys even though their public cards are standard. If support behavior is unclear, check both the public setup wording and the current popup/source routing before saying the toggle is irrelevant.

## Capture Behavior

### ChatGPT/OpenAI Page

`sources/openai.js` watches the ChatGPT page for added conversation groups and ignores assistant messages that are still streaming. It emits `type: "openai"` with `chatname` inferred as `User` or `ChatGPT`.

Do not confuse this with SSN's OpenAI API/LLM integration. This is page capture from `chat.openai.com` or `chatgpt.com`, not the provider used by SSN AI features.

### Slack

`sources/slack.js` scans Slack's virtual message list under `#message-list`, extracts `[data-qa="message-text"]`, sender names, and avatars, and tries previous siblings when Slack omits repeated sender names. It tracks recent IDs/messages to reduce duplicates.

First checks:

- Slack source toggle enabled.
- URL is under `app.slack.com/client/*`.
- The actual channel/DM message list is visible.
- The page was reloaded after enabling SSN.

### Telegram

Telegram has two scripts because Telegram Web has multiple UI routes:

- `sources/telegram.js` handles `/z` and `/a`.
- `sources/telegramk.js` handles `/k`.

Both emit `type: "telegram"`, poll rendered message lists, use the current chat title/avatar as fallback sender metadata, and convert local blob images to data URLs when practical.

Support note: public setup says "web.telegram.org in stream mode"; ask for the exact `/z`, `/a`, or `/k` URL when debugging.

### WhatsApp Web

`sources/whatsapp.js` watches `#main` for new `[data-id]` messages, extracts the visible selectable text, and tries to avoid quoted/reply text. It carries forward recent sender names where WhatsApp omits them.

The public site card says no avatar support. The script may attempt avatar extraction/conversion, but support answers should keep the public caveat unless current testing proves otherwise.

### Google Meet

`sources/meets.js` watches the Meet side-panel live region and emits `type: "meet"`. It can infer "You" from the participant list and supports name overrides from host/my-name settings.

First checks:

- The Meet source toggle is enabled.
- Chat side panel is open.
- The user reloaded the meeting after enabling the toggle.
- If the host appears as "You" or "Host", check `mynameext` and `hostnamesext` style settings before calling it broken.

### Microsoft Teams

`sources/teams.js` handles both older iframe message-pane layouts and newer `#chat-pane-list` style layouts. It emits `type: "teams"`, removes bracketed tags from names, and downscales/converts avatars.

Because the public site card says standard but a generated `teams` setting exists, source-check current popup behavior before telling users that no toggle can be involved.

### Zoom

`sources/zoom.js` is broader than plain chat capture. It can emit:

- Normal chat payloads with `type: "zoom"`.
- Q&A question payloads with `question: true`.
- Poll payloads with `type: "zoom_poll"` and raw poll HTML.
- Reaction payloads with `event: "reaction"`.

It scans top-page, iframe, and shadow DOM containers, keeps chat scrolled, tries to reopen the chat pane when it closes after screen share, and includes visibility/keepalive patches to reduce throttling.

For support, ask whether the user is using Zoom web, whether chat/Q&A is open, and whether they expect normal chat, Q&A, polls, or reactions.

### Webex

`sources/webex.js` watches `#meeting-panel-container`, including iframe cases, and emits `type: "webex"` for meeting-panel chat items. It tracks a bounded message history and carries forward sender/avatar context when repeated messages omit it.

First checks:

- User is on Webex web.
- The live chat panel is open, not a popout.
- The meeting panel exists in the top page or accessible iframe.

### Amazon Chime

`sources/chime.js` scans Chime chat message wrappers/bubbles and emits `type: "chime"`. It has a source comment stating it does not support sending messages.

Generated settings include a `chime` opt-in key. If capture is not working, check both the URL and whether the current UI exposes or requires the source toggle.

## Send-Back And Auto-Reply Boundary

For the scripts inspected in this pass:

- All implement `getSource`.
- All inspected scripts implement or attempt `focusChat`.
- None implements a source-level `SEND_MESSAGE` handler.

That means a user seeing chat in SSN does not prove SSN can reply into Slack, Telegram, WhatsApp, Meet, Teams, Zoom, Webex, Chime, or ChatGPT through these content scripts.

If a feature appears to send back through some other automation path, source-check that exact background/dock/debugger path before documenting it.

## Support Answer Patterns

### "Why does this private chat source not capture?"

Use this order:

1. Confirm the exact web URL matches the manifest.
2. Confirm the source toggle if the public card or generated setting requires one.
3. Reload the page after enabling SSN or changing the toggle.
4. Open the chat/message side panel.
5. Keep the page visible and not minimized.
6. Test with a new message, not old history.
7. Check whether the platform changed its DOM layout.

### "Can SSN capture DMs/internal work chats?"

Technically some web chats can be captured when the user enables the source and has access to the page. Support wording should emphasize consent, privacy, and redaction. Do not ask users to post private chat screenshots or meeting URLs publicly.

### "Can SSN send replies back?"

Not through the inspected source scripts. They can focus inputs, but they do not implement `SEND_MESSAGE`. Treat send-back as unsupported until a current source-control path is verified.

## Extraction Gaps

Needed future passes:

- Intense validation of popup toggle gating for Teams and Chime because generated settings exist while public cards say standard.
- Live browser validation for each current platform layout.
- Line-level check of any background/dock debugger automation that might send text after `focusChat`.
- Exact URL-pattern and UI-label refresh for public docs and popup menu.
- Privacy-safe support-history mining for common failure wording without copying private conversations.
