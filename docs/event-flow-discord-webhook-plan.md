# Event Flow Discord Webhook Variables Plan

## Status

Implemented and validated on 2026-08-15.

## Original Issue

The built-in **Chat Relay to Discord** Event Flow template used placeholders such as `{username}` and `{message}`, but the Call Webhook action sent its Custom Body JSON unchanged. Discord therefore received literal placeholder text.

The requested result was for Discord to receive the source message, username, and avatar using the existing Event Flow template-variable vocabulary.

## Approved Scope

The implementation is intentionally limited to the reported template-substitution problem:

1. Apply the existing `replaceTemplateVars()` behavior to string values in a templated webhook JSON body.
2. Parse the JSON before substitution and serialize it afterward so quotes, newlines, backslashes, Unicode, and other message content remain valid JSON.
3. Leave custom webhook bodies without placeholders byte-for-byte unchanged.
4. Update the built-in Discord template to use the existing `{message}`, `{username}`, and `{chatimg}` variables.
5. Document that Call Webhook supports the same existing variables as other templated Event Flow actions.
6. Test the complete documented variable set and the actual SSApp Electron workflow.

## Implemented Behavior

### Templated webhook bodies

When a Custom Body contains an Event Flow placeholder:

- The body must be valid JSON.
- Template variables are replaced only in JSON string values.
- String values may be nested inside objects or arrays.
- JSON object keys are not templated.
- Missing variables retain the shared Event Flow behavior and become empty strings.
- Case-insensitive aliases and dynamic top-level message fields retain the shared Event Flow behavior.

When a Custom Body contains no placeholders, it is sent unchanged. This avoids altering existing raw/imported webhook configurations unnecessarily.

Invalid templated JSON does not call the webhook. It attaches a focused `webhookError` and follows the existing synchronous Block on Error behavior.

### Built-in Discord template

New **Chat Relay to Discord** flows use:

```json
{
  "content": "{message}",
  "username": "{username}",
  "avatar_url": "{chatimg}"
}
```

No new template variables were introduced.

## Documented Variables Covered

- `{username}` / `{chatname}`
- `{message}` / `{chatmessage}`
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
- Dynamic top-level message fields supported by the existing renderer

## Explicitly Deferred

These adjacent ideas were deliberately excluded to avoid broad or speculative changes:

- New variables such as `{messageText}`.
- Relay Chat or reflection behavior changes.
- New webhook reflection settings.
- Discord-specific routing gates or automatic source exclusions.
- Saved-flow migrations.
- Username or source formatting changes.
- Mention policy changes.
- Webhook export-secret handling or unrelated logging changes.
- Broad rewrites of existing relay documentation.

The possible feedback loop when a catch-all webhook flow also captures its destination Discord channel is a separate concern. It predates this substitution fix and should be handled independently so intentional Discord-to-Discord workflows are not changed without a dedicated design.

## Files Changed

Social Stream source:

- `actions/EventFlowSystem.js`
- `actions/EventFlowEditor.js`
- `actions/event-flow-guide.html`
- `docs/agents/09-api-and-integrations/event-flow-editor.md`
- `tests/eventflow-template-vars.test.js`

Functional SSApp test:

- `C:\Users\steve\Code\ssapp\tests\electron\eventflow-webhook-e2e.js`

`docs/event-reference.html` was not changed because no source payload fields were added or renamed. The SSApp fallback mirror was not read or modified.

## Validation

### Focused sanity test

Command:

```text
node tests/eventflow-template-vars.test.js
```

Result: **55 passed, 0 failed**.

Coverage includes every documented variable and alias, nested objects and arrays, dynamic fields, case-insensitive names, missing values, structured `{meta}` text, JSON escaping, unchanged non-templated bodies, invalid templated JSON, and the shipped Discord template body.

### Functional Electron test

Command from the SSApp repository:

```text
node tests/electron/eventflow-webhook-e2e.js
```

Result: **passed**.

The test launched SSApp with an isolated profile and the real Social Stream source checkout, created the built-in Discord flow through the Event Flow editor, saved a loopback webhook URL, ran the flow in the actual Electron runtime, and confirmed that exactly one HTTP request contained the expected message, username, and avatar values.

