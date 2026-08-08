# Webinar And Event Sources

Status: heavy grouped pass started on 2026-06-24. This page documents webinar, studio, meeting-event, and hosted event source scripts that were previously inventory-only.

Use this page when a user asks about Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions.us, Wave Video, or WebinarGeek.

## Source Anchors

- `sources/crowdcast.js`
- `sources/livestorm.js`
- `sources/livestream.js`
- `sources/on24.js`
- `sources/riverside.js`
- `sources/sessions.js`
- `sources/wavevideo.js`
- `sources/webinargeek.js`
- `manifest.json`
- `docs/js/sites.js`
- `shared/config/settingsDefinitions.js`

## Core Rule

These sources are rendered webinar/event page captures. They are not full platform APIs, and most only capture visible chat or Q&A rows.

Support answers should start with:

- Confirm the exact event/webinar URL matches the manifest row.
- Confirm the chat, Q&A, or sidebar panel is open and visible.
- Reload the event page after extension install or reload.
- Test with a new message/question, not old history.
- Ask whether the user expects normal chat, Q&A questions, cross-platform relayed chat, or a host/bot display name.
- Do not promise moderation, attendance data, registrations, polls, or send-back unless the exact source path is verified.

## Source Matrix

| Source | Public Setup | Manifest Matches | Captures | Notes |
| --- | --- | --- | --- | --- |
| Crowdcast | Standard Crowdcast card | `https://www.crowdcast.io/e/*` | Chat rows under `div.chat-messages`, sender `.name`, avatar `.avatar-s`, message `.message-content-main` | Payload `type` and `getSource` are `crowdcast`; focuses `textarea#input-chat`. |
| Livestorm | Standard Livestorm card | `https://app.livestorm.co/*/live?*` | Recycle-scroller chat rows, sender `.item-identity>.name`, avatar `figure.user-avatar`, message `[data-testid='msg']` | Payload `type` and `getSource` are `livestorm`; dedupes recent sender/message pairs; public lookup says open the external sidebar/plugin that contains chat. |
| Livestream.com | Manifest/source only in current lookup | `https://livestream.com/accounts/*` | `.comment` rows in `.chat_container`, including iframe `#liveChatContainer`, sender/avatar/content | Payload `type` and `getSource` are `livestream`; focuses iframe textarea. No public site card match was found in the generated lookup pass. |
| ON24 | Duplicate public `On24`/`ON24` cards | `https://*.on24.com/view/*` | `.message-list .message` chat rows and `.table-row-question` Q&A rows | Payload `type` and `getSource` are `on24`; Q&A rows set `question: true`; focuses `textarea`. |
| Riverside.fm | Standard Riverside card | `https://riverside.fm/studio/*` | `.message` rows under `#root`, sender details, avatar, stickers/images except `/sticker/` images | Payload `type` and `getSource` are `riverside`; stops processing when `customriversidestate` is enabled; focuses placeholder textarea. |
| Sessions.us | Standard Sessions card | `https://app.sessions.us/*` | `#chat-body-messages chatMessage` rows, sender `[data-id='message-sender-name']`, message `[data-id='chat-message']` | Payload `type` and `getSource` are `sessions`; skips initial history; can replace `You` with host/my-name settings. |
| Wave Video | Standard Wave Video card | `https://wave.video/*` | Aggregated chat rows in Wave Video chat UI, username, profile image, social source icon, text | Does not implement `getSource`/`focusChat` in inspected source. Emits `type` based on social icon alt: YouTube, Twitch, Facebook, Instagram, LinkedIn, Amazon, or `wavevideo`. |
| WebinarGeek | Standard WebinarGeek card | `https://*.webinargeek.com/webinar/*`, `https://*.webinargeek.com/watch/*` | Shadow-DOM sidebar chat list, sender, avatar, message body | Payload `type` and `getSource` are `webinargeek`; focuses `textarea`; public lookup says chat only. Current selector flow needs live validation. |

## Capture Behavior

### Crowdcast

`sources/crowdcast.js` watches `div.chat-messages` for `.message` nodes. It extracts sender name, message text, and avatar. If the message text starts with the sender name, the source trims the duplicate name from the message.

First checks:

- User is on `https://www.crowdcast.io/e/*`.
- The chat panel is visible and `div.chat-messages` exists.
- A new message arrives after the observer starts.

### Livestorm

`sources/livestorm.js` watches `.vue-recycle-scroller__item-wrapper` for message views. It extracts sender, avatar, and `[data-testid='msg']` content, then dedupes the last 100 sender/message pairs.

Public setup wording says to open the external sidebar/plugin that contains chat. If a user only opens a video page without the chat sidebar/plugin, SSN may have nothing to capture.

### Livestream.com

`sources/livestream.js` watches `.chat_container` both in the top page and inside `#liveChatContainer`. It processes `.comment` rows, extracting `.commenter_name_wrapper`, `.commenter_content`, and `.commenter_avatar_wrapper img`.

No public supported-site card was found for this source in the generated lookup pass, so treat it as manifest/source-backed rather than a strong public listing. Ask for the exact Livestream URL before giving setup advice.

### ON24

`sources/on24.js` has two paths:

- `processMessage` for normal `.message-list .message` chat rows.
- `processQuestion` for `.table-row-question` Q&A rows.

Q&A payloads include:

```text
type: "on24"
question: true
```

There are duplicate public cards for `On24` and `ON24`; support answers should route both to `https://*.on24.com/view/*` and verify the current source before making stronger claims.

### Riverside.fm

`sources/riverside.js` watches `#root` and extracts `.message` nodes. It uses nearby `.chat-sender-details` for the sender name and avatar.

Important setting behavior:

- `customriversidestate` disables Riverside chat processing when enabled.
- `customriversideaccount` appears in settings as a channel/name allow field.

The public supported-site lookup says Riverside has an opt-out in the extension menu. If Riverside capture does nothing, check that disable setting before assuming the source is broken.

### Sessions.us

`sources/sessions.js` watches `#chat-body-messages` for new `chatMessage` elements. It marks initial history so old messages are ignored, then processes new rows only.

When the sender name is `You`, it can use `myname` or `hostnamesext` style settings to replace the display name. That matters for support reports about the host showing up with the wrong name.

### Wave Video

`sources/wavevideo.js` reads Wave Video's aggregated chat UI. It extracts:

- username
- profile image
- message text
- social source icon URL
- social source icon alt text

Unlike most source scripts in this group, the inspected file does not implement `chrome.runtime.onMessage`, `getSource`, or `focusChat`. It sends payloads with `type` based on the upstream social icon alt text:

- `youtube`
- `twitch`
- `facebook`
- `instagram`
- `linkedin`
- `amazon`
- `wavevideo` fallback

Support implication: a message captured through Wave Video may appear as the original platform type rather than `wavevideo`. Do not diagnose that as a type bug without checking the Wave Video source path.

### WebinarGeek

`sources/webinargeek.js` targets the WebinarGeek shadow-DOM sidebar and the visible chat section. It extracts sender name, avatar, and message from chat-list items.

The public lookup says WebinarGeek supports webinar/watch pages and chat only. Do not promise Q&A, polls, attendee data, or send-back.

Current extraction caveat: the source uses shadow-DOM selectors and some follow-up selector strings currently include `uul[class^='ChatList']`. Live validation is needed before treating WebinarGeek behavior as confirmed.

## Send-Back Boundary

For the scripts inspected in this pass:

- Crowdcast, Livestorm, Livestream.com, ON24, Riverside, Sessions.us, and WebinarGeek implement `getSource` and `focusChat`.
- Wave Video does not implement `getSource` or `focusChat` in the inspected file.
- No source-level `SEND_MESSAGE` handler was found in these scripts.

Support wording should be: "SSN can capture rendered webinar/event chat where the panel and URL match. Sending replies back is not documented by these source scripts."

## Common Support Patterns

### "The webinar is listed but no chat appears."

Use this order:

1. Confirm the exact URL against the matrix above.
2. Confirm the chat/Q&A/sidebar panel is open.
3. Reload after extension install/reload.
4. Test with a new message or question.
5. Check whether the source ignores initial history.
6. For Riverside, check the disable/allow settings.
7. For WebinarGeek, verify the current shadow-DOM chat list selectors.

### "ON24 questions do not show like normal chat."

ON24 Q&A is a separate path. The source marks Q&A rows with `question: true`, so downstream pages or filters may treat them differently than normal chat.

### "Wave Video messages show as YouTube/Twitch/Facebook/etc."

That can be expected. Wave Video maps the emitted `type` from the social icon alt text, so the payload may use the original platform type rather than `wavevideo`.

### "Can SSN collect attendees, registrations, polls, or webinar analytics?"

Do not promise that from these source scripts. This grouped pass found rendered chat/Q&A capture, not full webinar analytics or registration APIs.

## Extraction Gaps

Needed future passes:

- Live validation for each current platform layout.
- Controlled payload samples for ON24 Q&A and Wave Video relayed platform types.
- Riverside setting behavior validation for `customriversidestate` and `customriversideaccount`.
- WebinarGeek selector review and current shadow-DOM behavior check.
- Check whether any background/dock/debugger path can type/send after `focusChat`.
