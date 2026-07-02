# API Command Proof Ledger

Status: heavy command evidence-ledger pass on 2026-06-24. This is source-backed orientation plus documentation consistency evidence, not hosted relay, browser, OBS, Chrome extension, or standalone app runtime validation.

## Purpose

Use this page when a user asks:

- what command or API action to send,
- whether an API action "works",
- why a command returned success but nothing changed,
- whether a command can control a page, source, waitlist, poll, timer, overlay, or platform chat.

This ledger is the proof gate over the command docs. It separates relay acceptance, background handling, target-page handling, platform send-back, callbacks, and runtime proof.

## Related Pages

- `commands-and-actions.md`
- `action-command-index.md`
- `command-action-source-trace.md`
- `api-command-validation-matrix.md`
- `api-command-examples.md`
- `../09-api-and-integrations/websocket-http-api.md`
- `../09-api-and-integrations/streamdeck-companion.md`
- `../09-api-and-integrations/event-flow-editor.md`
- `../16-runtime-validation-playbooks.md`
- `../17-runtime-validation-evidence-log.md`
- `../18-focused-validation-evidence-log.md`

## Evidence Labels

| Label | Meaning |
| --- | --- |
| `answer-route` | Safe for picking the right command family, not enough for exact behavior. |
| `source-backed` | Current source/docs show the command path exists. |
| `source-trace` | Specific handlers, target routing, callback paths, or gates were inspected. |
| `focused-doc-check` | Static documentation consistency was checked, but runtime was not exercised. |
| `runtime-needed` | Needs hosted/local relay, browser page, extension, app, OBS, or platform runtime proof. |
| `runtime-tested` | Only use after a matching dated evidence entry exists in `17-runtime-validation-evidence-log.md`. |
| `do-not-promise` | Do not state this behavior as supported without new evidence. |

## Current Evidence Summary

| Command Area | Current Evidence | Safe Current Claim | Next Proof Needed |
| --- | --- | --- | --- |
| Command-system classification | `commands-and-actions.md`, `control-surface-crosswalk.md`, `action-command-index.md` | First decide whether the user means viewer chat command, remote API action, URL parameter, popup setting, page-local control, MIDI/hotkey, or Event Flow action. | Exact source or runtime validation for the selected command family. |
| Remote API socket actions | `background.js` source trace, `api-command-validation-matrix.md` | Background directly handles several actions and forwards unknown target/page actions. | Hosted/local relay proof with exact session, toggle, transport, action, target, value, callback, and observed effect. |
| Page-target actions | `dock.html`, `featured.html`, `poll.html`, `timer.html`, `waitlist.html` source trace | Target pages must be open, connected, and listening; source shows some page handlers. | Browser/OBS proof for the target page, label, session, and command payload. |
| Send-back to platform chat | `background.js` `sendMessageToTabs` trace, platform docs | `sendChat` and related paths can attempt platform send-back only when source/mode/login/permissions allow it. | Runtime proof on the exact platform, source mode, login state, destination, and anti-spam/cooldown state. |
| External content injection | `extContent` source trace and examples | External apps can submit SSN-shaped payloads through documented API paths when JSON and type fields are valid. | Runtime proof that the payload reaches the intended destination page/source and survives bot/Event Flow processing. |
| Numbered content channel actions | `api.md`, action index, documentation consistency check | `content` through `content7` are documented channel patterns. | Runtime relay proof for each needed channel and target listener before promising visible page output. |
| Waitlist, poll, timer, tip jar, and map control | Background and page source traces | Actions exist across background and page handlers, but some only mutate state or forward page commands. | Runtime proof of state changes, page display changes, callbacks, downloads, and label/session routing. |
| Callback-style actions | `gettimerstate`, `getpollpresets`, `getHype`, some page callbacks | Source shows callback paths for selected actions. | Runtime proof of callback token, transport, response shape, timeout, and target state. |
| Event Flow actions | Event Flow docs plus focused Node tests | Event Flow action types are a separate command system; selected internals have focused tests. | Runtime proof for editor UI, Flow Actions overlay, external actions, OBS, extension/app, and import/export. |
| StreamDeck and Companion buttons | API examples and integration docs | These usually send remote API URLs or WebSocket actions. | Runtime proof that the tool sends the intended URL/action and the SSN target acts. |

## Claim Ledger

| Claim Or User Wording | Current Status | Use This Answer Shape |
| --- | --- | --- |
| "The API returned success, so it worked." | `do-not-promise` | Relay acceptance is not proof the target acted. Confirm the target page/source is open, connected, same session, correct label/channel, and supports that action. |
| "Which command should I use?" | `answer-route` | First classify the control surface, then use `action-command-index.md` and the target doc. |
| "`clearOverlay` should clear my overlay." | `source-backed`, `runtime-needed` | It can clear supported featured/overlay output only when the dock/featured route is connected and listening. Validate the exact target page. |
| "`nextInQueue` should feature a queued message." | `source-trace`, `runtime-needed` | Source shows dock handling, but the dock must have queue state and receive the action. |
| "`getQueueSize` returns the numeric queue size." | `do-not-promise` | Source checks did not prove a numeric direct dock callback. Do not promise the value shape without runtime proof. |
| "`sendChat` sends to every connected platform." | `do-not-promise` | It attempts send-back through eligible source tabs/windows only. Platform, mode, login, permissions, destination, host state, and anti-spam gates matter. |
| "`blockUser` has one universal JSON shape." | `do-not-promise` | The API socket branch and bridge/P2P branch use different shapes. Specify the transport before giving a recipe. |
| "`extContent` injects a chat message." | `source-trace`, `runtime-needed` | It needs valid SSN-shaped JSON, including `type` in some paths, and open destinations. Runtime-test the payload. |
| "`content4` will show up in my page." | `source-backed`, `runtime-needed` | It is a documented channel pattern, not proof a specific page is listening to channel 4. |
| "`drawmode` and `emoteonly` are just page commands." | `source-trace` | They behave like global/background setting-style actions in the traced API branch. Expect downstream behavior only after later message/page processing. |
| "`gettimerstate` returns the current timer state." | `source-trace`, `runtime-needed` | Source shows callback paths in background and timer page, but runtime proof is needed for response shape and timing. |
| "Event Flow action names can be sent as API actions." | `do-not-promise` | Event Flow action types are separate from remote API action names unless routed through an Event Flow bridge action or a documented API path. |
| "A StreamDeck button will work if the URL is right." | `runtime-needed` | The URL can be syntactically right and still fail if SSN toggles, session, target page, platform, or label are wrong. |

## Minimum Proof Pack By Command Type

| Command Type | Minimum Proof Before Stronger Claim |
| --- | --- |
| HTTP GET action | Full redacted URL, encoded value, session placeholder, target placeholder, remote API toggle state, relay response, target page/source open, observed effect. |
| HTTP POST/PUT JSON | Endpoint, JSON body, headers if any, toggle state, response body, target state before/after, error behavior for bad JSON. |
| WebSocket remote control | WebSocket URL, join/session/channel mode, sent JSON, received response, target page/source state, reconnect/error notes. |
| Page-target command | Page URL, `session`, `label`, server mode, action payload, observed page DOM/output, same-session proof, target mismatch test if labels matter. |
| Platform send-back | Platform/source, login state, source mode, permissions, destination, command payload, sent-message proof, cooldown/anti-spam behavior, failure behavior. |
| Callback command | Callback token, transport, response payload shape, timeout behavior, target state that produced the callback, missing-target behavior. |
| Channel content action | Channel number, in/out channel setup, target listener URL, payload, relay receipt, displayed/received result, no-listener behavior. |
| Event Flow bridge | Bridge action payload, flow definition, trigger match, action result, target page/source, focused-vs-runtime evidence boundary. |
| StreamDeck/Companion command | Button config, exact URL/action sent, SSN toggle state, target page/source, observed effect, tool-side error/log. |

## Recommended Answer Flow

1. Classify the command family with `control-surface-crosswalk.md`.
2. Find the action in `action-command-index.md`.
3. Check handler caveats in `command-action-source-trace.md`.
4. Check acceptance-versus-action notes in `api-command-validation-matrix.md`.
5. Use `api-command-examples.md` only for safe copy/paste shape.
6. If the claim is high-side-effect, platform-specific, callback-based, or page-targeted, require runtime evidence before saying it works.

## Update Rules

When command evidence changes:

1. Add runtime evidence to `17-runtime-validation-evidence-log.md` or focused evidence to `18-focused-validation-evidence-log.md`.
2. Update the matching row in this file.
3. Update `api-command-validation-matrix.md`, `command-action-source-trace.md`, `action-command-index.md`, and `api-command-examples.md` only for claims actually strengthened or corrected.
4. Update support routing in `common-question-proof-pack.md`, `common-question-evidence-status.md`, and `support-evidence-ledger.md` if answer strength changes.
5. Re-run the docs navigation audit after adding, renaming, or moving command docs.

## Current Non-Completion Boundary

This page improves command-answer discipline, but it does not prove command runtime behavior. Do not mark HTTP/WebSocket API actions, target-page commands, callbacks, numbered content channels, platform send-back, StreamDeck/Companion buttons, Event Flow bridge actions, OBS behavior, Chrome extension behavior, or standalone app behavior as tested until matching runtime evidence is recorded.
