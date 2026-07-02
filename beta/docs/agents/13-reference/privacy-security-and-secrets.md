# Privacy, Security, And Secrets

Status: centralized privacy/security reference started on 2026-06-24.

## Purpose

Use this page when an AI agent needs to answer:

- "Can I share this URL, screenshot, log, settings file, or webhook?"
- "Is my session ID private?"
- "Are donation webhook URLs safe?"
- "Can support look at my private chat/source?"
- "What should I redact before posting in Discord or GitHub?"

This page centralizes guidance already scattered across cost/support, settings, URL, API, platform, and support-intake docs.

## Source Anchors

- `06-settings-sessions-and-storage.md`
- `13-reference/free-paid-and-support-boundaries.md`
- `13-reference/support-resources-and-escalation.md`
- `13-reference/settings-and-toggles.md`
- `13-reference/surface-url-cheatsheet.md`
- `13-reference/url-parameters.md`
- `11-support-kb/index.md`
- `11-support-kb/support-intake-templates.md`
- `11-support-kb/common-misconceptions-and-boundaries.md`
- `08-platform-sources/communication-and-sensitive-sources.md`
- `08-platform-sources/community-membership-webapp-sources.md`
- `08-platform-sources/creator-live-cam-sources.md`
- `09-api-and-integrations/websocket-http-api.md`
- `09-api-and-integrations/ai-features.md`
- `09-api-and-integrations/tts.md`

## Short Answer

Treat SSN session IDs, passwords, API keys, OAuth tokens, webhook URLs, private endpoints, provider keys, private chat content, private room/channel names, and exported settings as sensitive.

For public support, share page names, setup type, non-secret parameters, redacted screenshots, and redacted error text. Do not share full live URLs or settings files unless they have been reviewed for secrets.

## Secret Classification

| Item | Treat As Secret? | Why |
| --- | --- | --- |
| SSN session ID | Usually yes | Can route overlays, API commands, app source windows, and webhook paths. |
| Session password | Yes | Can protect/control a session. |
| Full dock/overlay URL | Often yes | Usually includes session and may include password, label, API/provider keys, or private endpoint params. |
| Donation webhook URL | Yes | Public docs say webhook paths do not verify provider signatures; anyone with the URL may spoof events. |
| API keys/provider keys | Yes | Can spend quota, reveal account access, or expose paid services. |
| OAuth tokens/callback data | Yes | Can grant account or integration access. |
| Private API endpoint/custom endpoint | Yes unless intentionally public | Can expose internal services, local network routes, or provider proxies. |
| Exported settings file | Usually yes | Can include sessions, passwords, webhooks, API keys, provider settings, and private endpoints. |
| Browser/app logs | Often yes | Can include URLs, tokens, account names, room IDs, source state, or private chat. |
| Screenshots | Often yes | Can reveal account names, sessions, private chats, server/workspace names, keys, or payment data. |
| Platform source URL | Sometimes | Public stream URLs are often okay; private dashboards, studios, meetings, memberships, rooms, and web apps are sensitive. |
| Source page type | No | "Twitch popout", "YouTube Studio", "Kick WebSocket source", or "Slack web" is safe. |
| Page filename | No | `dock.html`, `featured.html`, `sources/websocket/irc.html`, or `themes/compact-clean.html` is safe. |
| Non-secret URL flag | Usually no | `darkmode`, `compact`, `showtime`, or `transparent` are normally safe. |

## Redaction Patterns

Use these replacements in docs, issues, Discord replies, and support summaries:

```text
session=REDACTED
s=REDACTED
id=REDACTED
password=REDACTED
apiKey=REDACTED
apikey=REDACTED
token=REDACTED
oauth=REDACTED
webhook=REDACTED
endpoint=REDACTED
channel=private-channel-redacted
workspace=private-workspace-redacted
room=private-room-redacted
user=private-user-redacted
https://private.example/path/REDACTED
```

When a user posts a full URL publicly, preserve only:

- Page filename.
- Non-secret flags needed for the issue.
- Source setup type.
- Whether a session/password/key was present, without the value.

Example:

```text
Original: https://socialstream.ninja/featured.html?session=abc123&password=secret&darkmode&label=obs1
Safe: featured.html?session=REDACTED&password=REDACTED&darkmode&label=obs1
```

## URL Sharing Rules

| URL Type | Safe Public Form | Notes |
| --- | --- | --- |
| Dock/overlay URL | Page name plus redacted session/password | Keep labels only if they do not reveal private workflow names. |
| Hosted page URL without session | Usually safe | Still inspect for keys/endpoints in query params. |
| WebSocket/API source page URL | Page name plus redacted token/room/channel | Room/channel can identify private streams; redact when unsure. |
| Donation webhook URL | Do not post publicly | Session is part of the webhook path and can be spoofed. |
| Provider endpoint URL | Redact unless intentionally public | Local/private endpoints can expose network details. |
| Platform public watch URL | Usually okay | Still ask whether it is public, unlisted, private, paid, dashboard, or member-only. |
| Studio/dashboard/creator URL | Redact | Can expose management surfaces and account context. |
| Meeting/workspace/chat URL | Redact | Often private by nature. |
| Export/replay/recover URL | Redact | Can include old settings, chat history, session IDs, or passwords. |

## Settings And Export Rules

Do not ask users to paste a full settings export into public support.

Settings can include:

- Session IDs and passwords.
- Provider API keys.
- AI/TTS provider settings.
- Discord, donation, or custom webhook URLs.
- OAuth-related integration state.
- Private endpoint URLs.
- Source toggles that reveal private workflows.

Safer support options:

- Ask for the setting category and key name, not the value.
- Ask whether the setting is enabled/disabled.
- Ask for a screenshot with secrets hidden.
- Ask for a private, redacted snippet only if exact values are needed.
- Route exact key questions to `13-reference/settings-key-index.md`.

## Donation Webhook Security

Donation webhook routes documented in the API use the session in the URL path, such as:

```text
https://io.socialstream.ninja/SESSION_ID/stripe
https://io.socialstream.ninja/SESSION_ID/kofi
https://io.socialstream.ninja/SESSION_ID/bmac
https://io.socialstream.ninja/SESSION_ID/fourthwall
```

The public API docs say these webhook URLs do not verify platform signatures. Anyone with the URL may be able to inject fake donation events.

Support rule:

- Treat donation webhook URLs as private secrets.
- Rotate/change the session if a webhook URL was posted publicly.
- Do not include full webhook URLs in screenshots, docs, examples, or GitHub issues.
- When debugging, ask for the provider name and whether the webhook path format matches, not the live URL.

## Private Source Families

Some SSN source families are privacy-sensitive even when capture works as intended.

| Source Family | Privacy Risk | First Rule |
| --- | --- | --- |
| Communication/assistant pages | DMs, prompts, phone numbers, workspace names, meeting content | Confirm opt-in toggle, web version, visible panel, and redact content. |
| Meetings/webinars/events | Meeting IDs, attendee names, Q&A, private event URLs | Redact event URLs and attendee data. |
| Community/membership web apps | Member-only content, workspace/community identity, paid access | Do not imply SSN bypasses access rules. |
| Creator/live-cam pages | Room URLs, tips/tokens, private messages, paid-room context | Redact room/user/private-message details. |
| Live commerce | Buyer/seller names, product listings, auction state, store URLs | Redact store/account/product data unless intentionally public. |
| Regional/emerging/crypto/trading pages | Wallet/user identity, trading pages, paid/community context | Redact account, wallet, and private room details. |
| Discord/Slack/Telegram/WhatsApp | Server, channel, contact, and message history | Do not paste raw private messages into docs or issues. |

## AI, TTS, And Provider Keys

SSN can integrate with local and cloud AI/TTS providers, but provider keys and endpoints are user secrets.

Redact:

- OpenAI, Gemini, DeepSeek, xAI, Groq, OpenRouter, Bedrock, Google Cloud TTS, ElevenLabs, Speechify, Giphy, Tenor, Spotify, Stage TEN, YouTube API, and similar keys.
- Custom OpenAI-compatible endpoints when private.
- Provider error logs that echo request headers, model endpoints, organization IDs, tokens, or private prompts.
- Private RAG/knowledge data and private chatbot conversation content.

Support rule:

- Ask which provider family is used.
- Ask whether the key/endpoint is configured.
- Ask for provider error codes with secrets redacted.
- Do not ask users to paste keys or private prompts into public channels.

## API And Automation Safety

API/automation workflows can control pages, clear overlays, send chat, trigger webhooks, or interact with external tools.

Before sharing command examples publicly:

- Replace session/password/API key values with placeholders.
- Verify the action is harmless or clearly label the side effect.
- Avoid using real donation, moderation, send-chat, or webhook actions as public examples.
- Use private test sessions for StreamDeck, Companion, Streamer.bot, Event Flow, and custom clients.
- Remember that an HTTP/WebSocket success response may not prove the target page acted.

Start docs:

- `09-api-and-integrations/websocket-http-api.md`
- `13-reference/action-command-index.md`
- `13-reference/commands-and-actions.md`

## Custom Code Safety

Custom overlays, `custom.js`, uploaded user functions, Event Flow custom JS, and new source files can expose secrets or create unwanted actions.

Safe guidance:

- Keep keys/tokens/session IDs out of custom scripts where possible.
- Do not commit private custom files with secrets to public repos.
- Test custom code in a private session before going live.
- Treat auto-reply/send-chat examples as high risk because they can spam real platform chat.
- Prefer external secret storage or local-only config for private tools.
- Do not edit `ssapp/resources/social_stream_fallback` for source behavior; it is a disposable mirror.

Start docs:

- `13-reference/custom-plugins-and-extensions.md`
- `07-overlays-and-pages/custom-overlays.md`
- `12-development/adding-a-source.md`

## Support History And Logs

Support history is useful for symptom wording and frequency. It is not safe to paste raw support records into these docs.

Rules:

- Summarize and anonymize support history.
- Do not include raw private identities, full Discord messages, private channel names, or attachments.
- Do not record unredacted screenshots or logs.
- Treat support-history claims as historical until current source or runtime validation confirms them.
- Use `11-support-kb/mining-method.md` before mining `stevesbot` data.

## If A Secret Was Shared Publicly

Suggested support response:

```text
Please delete or edit that message and rotate/change the exposed value if possible. For SSN, that usually means changing the session ID/password or regenerating the provider/webhook/API key. For webhook URLs, treat the full URL as exposed because the session is part of the path.
```

Then:

1. Identify what leaked: session, password, webhook, API key, OAuth token, endpoint, settings file, or private chat.
2. Tell the user what to rotate/change.
3. Move troubleshooting back to redacted evidence.
4. Avoid repeating the secret in quotes, issue titles, filenames, or commit messages.

## Answer Patterns

### Can I Share My URL?

```text
Share the page name and non-secret options, but redact session IDs, passwords, API keys, OAuth tokens, webhook URLs, private endpoints, and private room/channel details.
```

### Is My Session ID Private?

```text
Treat it as private if it controls overlays, API actions, source windows, webhooks, or anything live on stream. For public support, say whether the same session is used everywhere without posting the actual value.
```

### Are Webhook URLs Safe?

```text
No. Treat donation webhook URLs as secrets. The documented webhook paths use the SSN session in the URL and do not verify provider signatures, so anyone with the URL may spoof events.
```

### Can Support Look At My Private Chat?

```text
Share only redacted screenshots or error text. For private chats, meetings, communities, dashboards, and member pages, hide user names, room/channel names, message content, account details, and full URLs unless there is a private, trusted reason to share them.
```

## High-Risk Claims

Verify before saying:

- "This URL is safe to post."
- "A session ID is harmless."
- "Webhook spoofing is impossible."
- "This source captures private chats safely by default."
- "The app bypasses platform login restrictions."
- "AI moderation is safe enough to rely on."
- "This settings export has no secrets."
- "This provider error log is safe to paste publicly."
