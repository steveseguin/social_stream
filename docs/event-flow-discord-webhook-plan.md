# Event Flow Discord Webhook Template Plan

## Status

Validated and approved as an implementation plan. No code changes have been made yet.

The defect is present in both the Live/main source and the current beta source. It also affects the standalone app because SSApp loads the Social Stream source at runtime.

## Goal

Make the built-in **Chat Relay to Discord** Event Flow template send the originating chat message with the source username and avatar, while supporting the same documented template variables as other templated Event Flow actions.

The completed change must also prevent the Discord destination from feeding its own webhook messages back into the flow.

## Confirmed Problems

### 1. Call Webhook does not render template variables

The built-in template contains `{username}` and `{message}`, but the webhook action currently sends `config.body` unchanged. `replaceTemplateVars()` already implements the shared Event Flow variable behavior, but Call Webhook does not use it.

Result: Discord receives literal placeholder text such as `{username}` instead of event data.

### 2. Raw string replacement would corrupt JSON

Replacing placeholders directly in the raw JSON text is unsafe. User messages can contain quotes, backslashes, newlines, Unicode, or other characters that require JSON escaping.

The implementation must parse the custom body first, render every string value, and serialize the result afterward.

### 3. `{message}` can contain HTML

`{message}` and `{chatmessage}` expose the existing `chatmessage` value. Depending on the source and text-only setting, that value can contain HTML, including emote or TikTok sticker `<img>` elements.

Discord needs a plain-text option that preserves useful image `alt` text without changing the established meaning of `{message}` for existing flows.

### 4. The Discord template can create a feedback loop

The current template starts with **Any Message**. If the destination Discord channel is also open as a Social Stream source, the sequence can be:

1. An incoming source message triggers the webhook.
2. Discord displays the webhook post.
3. `sources/discord.js` captures that post as a new `type: "discord"` message, normally with `bot: true`.
4. Event Flow's **Any Message** trigger runs again.
5. The webhook posts the captured message again indefinitely.

Native **Relay Chat** does not have this exact problem in the normal single-instance path because it excludes the originating tab, records the outgoing text per destination, and marks matching re-ingested messages as reflections for about ten seconds. Call Webhook bypasses that relay tracking.

The Discord source also has a legacy heuristic that ignores usernames containing `" @ "`, and the older global Discord relay deliberately formats usernames that way. That heuristic cannot be used here because the requested behavior is to retain the original username exactly.

### 5. Discord-specific safety and logging need tightening

- Discord parses mentions in webhook content by default, so relayed user text can ping users or roles unless `allowed_mentions` is restricted.
- Discord `content` is limited to 2,000 characters.
- `avatar_url` must be a URL Discord can retrieve; some sources omit avatars or expose an inaccessible/data URL.
- The current webhook error path can log the complete URL. A Discord webhook URL contains its secret token and must not appear in logs.

### 6. The Event Flow guide contains inaccurate relay-loop guidance

The guide describes a **No Reflections** or **No Echo** toggle on Relay Chat, but the current Relay Chat action has no such toggle. Relay Chat already skips messages marked as reflections. The separate **Reflection Filter** action controls whether reflected messages continue to the dock/overlays; it does not cause Call Webhook output to be identified as a reflection.

The guide also suggests carrying a custom `meta.source = "relay"` marker through relays. External chat platforms and Discord webhooks do not reliably round-trip that internal metadata, so this is not a complete loop-prevention mechanism.

## Proposed Implementation

### 1. Render custom webhook JSON safely

Add a focused helper in `actions/EventFlowSystem.js` that:

1. Parses `config.body` as JSON.
2. Visits every string value at any nested object or array depth.
3. Applies the existing `replaceTemplateVars(value, message)` helper to each string.
4. Serializes the rendered value with `JSON.stringify()`.

A JSON stringify replacer is sufficient for the recursive string traversal:

```javascript
renderWebhookBody(template, message) {
	const parsed = JSON.parse(template || "{}");
	return JSON.stringify(parsed, (_key, value) =>
		typeof value === "string" ? this.replaceTemplateVars(value, message) : value
	);
}
```

Requirements:

- Render placeholders only in JSON string values, not object keys.
- Preserve numbers, booleans, arrays, objects, and null values.
- Preserve the existing string-template semantics: a placeholder used inside a JSON string still produces a string.
- A structured value such as `{meta}` remains JSON text when inserted into a string; it does not silently become a nested object.
- Missing variables continue to resolve to an empty string.
- Dynamic top-level message fields continue to work case-insensitively through the shared renderer.
- Do not attach a body to `GET` or `HEAD` requests.
- Keep `includeMessage: true` unchanged; it continues to send the complete message object and bypasses custom-body templating.
- If custom JSON is invalid, do not call `fetch`. Attach a clear `webhookError` and preserve the current synchronous `blockOnFailure` behavior.

### 2. Add a documented plain-text message variable

Add `{messageText}` to the shared template renderer.

Behavior:

- Read the current `chatmessage` value when the action executes.
- If the message is already text-only, return it unchanged.
- Otherwise strip HTML using the existing DOM-based helper.
- Preserve the `alt` text of emote and sticker images.
- Do not rely on a potentially stale cached `textContent` value after an earlier action modifies `chatmessage`.

Keep `{message}` and `{chatmessage}` unchanged for backward compatibility.

### 3. Replace the built-in Discord template body

Use this payload for newly created **Chat Relay to Discord** flows:

```json
{
  "content": "{messageText}",
  "username": "{username}",
  "avatar_url": "{chatimg}",
  "allowed_mentions": {
    "parse": []
  }
}
```

This uses Discord's documented per-message username and avatar overrides while preventing relayed text from generating mentions.

Do not add a visible suffix, prefix, or hidden character to the username or message for loop detection.

### 4. Make the built-in template loop-safe

Change the template graph to require both of these conditions:

- **Any Message** is true.
- **From Source: Discord**, passed through a **NOT** gate, is true.

Feed both values into an **AND** gate before Call Webhook:

```text
Any Message -----------------------> AND ---> Call Webhook
From Source: Discord ---> NOT -----> AND
```

This makes the safe default “relay non-Discord chat to Discord.” It prevents both human and webhook-originated Discord messages from being posted back to the Discord destination, without changing the displayed source username.

Users intentionally relaying between two different Discord channels can build a more narrowly filtered custom flow, but the general-purpose template must default to avoiding a cycle.

### 5. Add an opt-in reflection guard for webhooks

Add an **Ignore reflected messages** Call Webhook option:

- Stored config name: `ignoreReflections`.
- Default for existing and generic webhook actions: `false`, preserving current behavior.
- Value in the built-in Discord template: `true`.
- When enabled, skip webhook execution when `message.reflection` is true.

This is a second line of defense against duplicates caused by messages relayed through Social Stream's native send/relay paths. It does not replace the explicit Discord source exclusion because a Discord webhook post is not currently registered in the native reflection cache.

### 6. Protect webhook secrets in logs

Remove the full URL from webhook error messages and console output. Log only safe context such as:

- Event Flow node ID.
- HTTP status.
- A bounded response excerpt when appropriate.

Do not log query strings, webhook IDs, tokens, authorization headers, or the complete configured URL.

### 7. Align the documentation

Update `actions/event-flow-guide.html` to:

- Add **Call Webhook** to the actions supporting template variables.
- Document `{messageText}` as the recommended plain-text value for Discord and other text-only destinations.
- State that all published Event Flow variables and aliases work in nested webhook JSON string values.
- Explain that placeholders do not replace JSON keys and do not change the containing JSON value's type.
- Use `{chatimg}`, not `{avatar}`, for the source avatar.
- Include the corrected Discord JSON example with `allowed_mentions.parse: []`.
- Note Discord's 2,000-character content limit and public-avatar-URL requirement.
- Warn that webhook URLs are secrets.
- Explain the built-in template's Discord source exclusion.
- Correct the inaccurate **No Reflections** toggle description.
- Explain the actual boundary between Relay Chat's automatic reflection protection, the Reflection Filter action, and generic webhooks.

Update the Call Webhook property help in `actions/EventFlowEditor.js` with the same concise rules and examples.

Update `docs/agents/09-api-and-integrations/event-flow-editor.md` so the internal documentation matches the public guide.

Preserve the existing `{source}` output behavior for backward compatibility and describe `{type}` as the raw source identifier. Do not promise brand-specific casing that the renderer does not guarantee.

Do not update `docs/event-reference.html`: this work does not add or rename event payload fields. `{messageText}` is an Event Flow rendering convenience, not a new source payload field.

## Variable Compatibility Matrix

The webhook renderer must use the shared implementation so these published variables and aliases behave exactly as they do elsewhere:

- `{username}` / `{chatname}`
- `{message}` / `{chatmessage}`
- `{messageText}`
- `{source}`
- `{type}`
- `{donation}` / `{hasDonation}`
- `{displayname}`
- `{donoValue}` / `{donationAmount}`
- `{event}`
- `{membership}`
- `{subtitle}`
- `{userid}`
- `{chatimg}`
- `{contentimg}`
- `{rewardTitle}`
- `{meta}`
- `{counterValue}`
- `{counterTarget}`
- `{counterRemaining}`
- Any other top-level message field exposed by the existing dynamic lookup

Variable names remain case-insensitive, and missing values resolve to an empty string.

## Files Expected to Change During Implementation

Primary Social Stream source:

- `actions/EventFlowSystem.js`
- `actions/EventFlowEditor.js`
- `actions/event-flow-guide.html`
- `docs/agents/09-api-and-integrations/event-flow-editor.md`
- A focused test under `tests/`, either extending `eventflow-template-vars.test.js` or adding `eventflow-webhook.test.js`

Functional SSApp validation may add:

- `C:\Users\steve\Code\ssapp\tests\electron\eventflow-discord-webhook-e2e.js`

Do not edit `ssapp/resources/social_stream_fallback` during normal implementation or testing.

## Validation Plan

### Focused sanity checks

Exercise the real `EventFlowSystem` implementation with a mock fetch and verify:

- Every variable and alias in the compatibility matrix resolves in a Discord-style payload.
- Placeholders resolve inside nested objects and arrays.
- Case-insensitive and dynamic fields work.
- Missing fields become empty strings.
- Quotes, backslashes, newlines, Unicode, and emoji survive a JSON round trip.
- `{messageText}` strips HTML while preserving image `alt` text.
- `{message}` remains unchanged.
- `{meta}` remains valid escaped JSON text when used in a string.
- Invalid custom JSON prevents the request and reports a useful error.
- `includeMessage: true` remains unchanged.
- `GET` and `HEAD` do not receive bodies.
- The built-in template contains `username`, `avatar_url`, plain-text content, disabled mentions, the Discord source exclusion, and `ignoreReflections: true`.
- Webhook error logs do not expose the configured URL.

These checks are supporting sanity checks only and do not count as completed application testing.

### Functional Electron test

Run the workflow through SSApp's actual Electron runtime with an isolated profile and the Social Stream source checkout loaded through `--running-from-source` / `--filesource`.

Use a local loopback HTTP receiver instead of a real Discord webhook and verify over the actual Event Flow path:

1. Create or import the built-in Discord template.
2. Point it at the local receiver.
3. Process a complete non-Discord source payload containing username, avatar, formatted message text, and special characters.
4. Confirm exactly one request arrives with the expected Discord JSON fields.
5. Feed back a Discord-captured webhook-style message with `type: "discord"` and `bot: true`.
6. Confirm no second request arrives.
7. Feed a message marked `reflection: true` from another source.
8. Confirm no request arrives when `ignoreReflections` is enabled.
9. Feed a separate legitimate non-Discord message.
10. Confirm it still produces exactly one request, proving loop protection is not a global one-shot or overbroad duplicate filter.
11. Reload the isolated app profile and confirm the saved flow retains the custom JSON and reflection setting.

A real Discord rendering test is optional and requires an explicitly authorized disposable webhook URL. Never place that URL in fixtures, logs, screenshots, or committed files.

## Acceptance Criteria

- A newly created **Chat Relay to Discord** flow sends the original username through Discord's `username` field.
- It sends the source avatar through `avatar_url` when Discord can retrieve the URL.
- It sends a plain-text message without exposing source HTML markup.
- All documented Event Flow template variables work in custom webhook JSON string values.
- Special characters cannot invalidate the outgoing JSON.
- Relayed user text cannot create Discord mentions by default.
- Capturing the destination Discord channel cannot cause the built-in flow to repost its own webhook messages.
- Native reflected messages are ignored by the built-in template.
- Existing saved webhook flows and `includeMessage` behavior remain compatible.
- Invalid JSON produces an actionable Event Flow error instead of an unhandled request failure.
- Webhook secrets do not appear in logs.
- Public and internal documentation describe the implemented behavior accurately.
- Functional behavior is verified in the actual isolated Electron runtime, not only with static or mocked checks.

## References

- [Discord: Execute Webhook](https://docs.discord.com/developers/resources/webhook#execute-webhook)
- [Discord: Allowed Mentions](https://docs.discord.com/developers/resources/message#allowed-mentions-object)

