# Streamer.bot Integration

Status: heavy extraction pass started on 2026-06-24.

## Purpose

SSN can send captured chat/events into Streamer.bot over Streamer.bot's WebSocket server. Streamer.bot then runs a chosen Action for each incoming SSN payload.

## Source Anchors

- `social_stream/streamerbot.html`
- `social_stream/popup.html`
- `social_stream/background.js`
- `social_stream/api.md`

## Integration Model

The integration is outbound from SSN to Streamer.bot:

1. SSN captures and normalizes a platform message.
2. SSN connects to Streamer.bot's WebSocket server.
3. SSN sends a DoAction-style request to a configured Streamer.bot Action ID.
4. Streamer.bot exposes the SSN payload fields as action arguments.
5. The user's Streamer.bot action handles filtering, routing, logging, chat replies, OBS actions, sound alerts, or any other Streamer.bot side effects.

This does not replace the SSN dock or overlays. It gives Streamer.bot access to SSN's normalized cross-platform message payloads.

## Prerequisites

- Streamer.bot installed locally.
- Streamer.bot WebSocket Server enabled and running.
- SSN standalone app or extension configured with the Streamer.bot WebSocket URL.
- A Streamer.bot Action created specifically to process Social Stream messages.

The existing guide recommends Streamer.bot `v0.2.3` or newer and notes that `v1.0+` moved WebSocket server settings into the redesigned settings area. For current Streamer.bot UI locations, agents should verify against Streamer.bot's current docs before giving exact menu names.

## Streamer.bot Setup

1. In Streamer.bot, open the WebSocket Server settings.
2. Enable the server.
3. Enable auto-start if the user wants it to run whenever Streamer.bot launches.
4. Note the port. The common default is `8080`.
5. If Streamer.bot WebSocket authentication is enabled, note the password.
6. Start the server and confirm it is listening.

Recommended local URL:

```text
ws://127.0.0.1:8080
```

Use `127.0.0.1` when SSN and Streamer.bot run on the same PC.

## Required Streamer.bot Action

The Streamer.bot Action is required. Without an Action ID, SSN can connect but has no target action to run.

1. Open the Streamer.bot Actions tab.
2. Create an action such as `Process SocialStream Message`.
3. Right-click the action and copy the Action ID.
4. Paste that Action ID into SSN's Streamer.bot settings.
5. Add sub-actions in Streamer.bot to log, filter, route, reply, play sounds, or run other actions.

For simple workflows, no C# is required. Incoming SSN fields are available directly as `%fieldname%` in Streamer.bot sub-actions that support arguments.

Example direct message template:

```text
[%originalPlatform%] %chatname%: %chatmessage%
```

## SSN Settings

The setup page describes these required values in SSN:

- Integration enabled.
- WebSocket URL, for example `ws://127.0.0.1:8080`.
- Password, only if Streamer.bot WebSocket auth is enabled.
- Action ID copied from Streamer.bot.

If the password is blank in Streamer.bot, leave it blank in SSN. If auth is enabled in Streamer.bot, the SSN password must match exactly.

## Payload Fields

Common fields sent as Streamer.bot action arguments:

| Field | Meaning |
| --- | --- |
| `chatmessage` | Message body. May include HTML when text-only mode is off. |
| `chatname` | Sender display name. |
| `userid` | Platform user ID when available. |
| `chatimg` | Sender avatar URL or data URL when available. |
| `bot` | Boolean bot marker when detected. |
| `mod` | Boolean moderator marker when detected. |
| `host` | Boolean broadcaster/host marker when detected. |
| `admin` | Boolean admin/channel-owner marker when detected. |
| `vip` | Boolean VIP marker when detected. |
| `originalPlatform` | Platform origin such as `youtube`, `twitch`, `kick`, etc. |
| `source` | Source label, often `SocialStream.Ninja`. |

Additional fields may appear depending on platform and event type:

| Field | Meaning |
| --- | --- |
| `contentimg` | Attached image/media URL or converted data URL. |
| `subtitle` | Extra platform status or metadata text. |
| `membership` | Membership/subscriber tier/status when available. |
| `hasDonation` | Donation/Super Chat/Rant amount label when available. |
| `type` | SSN source type. |
| `id` | Message ID when available. |
| `nameColor` | Sender name color when available. |
| `chatbadges` | Badge data or badge images when available. |
| `textonly` | Whether SSN stripped HTML from the message. |
| `tid` | Transaction/dedupe ID when available. |
| `meta` | Structured source-specific extra data when available. |

## Optional C# Normalization

The guide includes an optional C# sub-action that reads SSN arguments with `CPH.TryGetArg`, logs the message, and sets cleaner `ss_*` arguments such as:

- `%ss_message%`
- `%ss_username%`
- `%ss_userId%`
- `%ss_avatar%`
- `%ss_platform%`
- `%ss_source%`
- `%ss_bot%`
- `%ss_mod%`
- `%ss_host%`
- `%ss_admin%`
- `%ss_vip%`

Use C# when the user wants richer filtering, platform-specific handling, or consistent argument names. For basic echo/log/sound workflows, direct arguments are enough.

## Common Recipes

Filter out bots:

- Add an If/Else sub-action early.
- Condition: argument `bot` equals `True`.
- Then branch: exit action or do nothing.

Route by platform:

- Condition on `originalPlatform`.
- Example: play one sound for `youtube`, another for `twitch`, and a fallback for everything else.

Donation/Super Chat/Rant alert:

- Check whether `hasDonation` is non-empty.
- Trigger a separate Streamer.bot alert action or OBS action.

Update an OBS text source:

- Use Streamer.bot's OBS sub-actions if available.
- Or write a text file from Streamer.bot and point an OBS text source at that file.

## Troubleshooting

Cannot connect:

- Verify Streamer.bot WebSocket Server is enabled and running.
- Confirm the SSN URL matches the Streamer.bot port.
- Use `ws://127.0.0.1:8080` for same-machine setups.
- Check Windows firewall or security software if connecting across devices.
- Confirm the password matches only when Streamer.bot auth is enabled.

Messages do not trigger the action:

- Confirm the Action ID was copied from the target action, not the action name.
- Confirm the SSN Action ID field has the exact copied ID.
- Check Streamer.bot Action Queues/History to see whether the action is firing and failing.
- Add a simple Log Message sub-action first to prove the action is being invoked.
- Check SSN console logs for send/DoAction errors.

C# compile errors:

- Use `CPH.TryGetArg<T>("key", out value)`.
- Do not assume old helper names exist in the user's Streamer.bot version.
- Check braces and argument names.
- Start with direct `%fieldname%` arguments if C# is not needed.

Arguments are blank:

- Confirm the sub-action supports argument substitution.
- Check exact casing of argument names.
- If using C# normalization, ensure the C# sub-action runs before sub-actions that use `%ss_*%`.
- Inspect a recent action run in Streamer.bot to see which arguments SSN sent.

## Remaining Extraction Targets

- Trace the exact background connection and DoAction request code in `background.js`.
- Cross-check current popup labels for the Streamer.bot settings fields.
- Verify current Streamer.bot v1.x UI paths against official Streamer.bot docs before publishing end-user step-by-step screenshots.
