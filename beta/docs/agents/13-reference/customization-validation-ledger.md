# Customization Validation Ledger

Status: heavy evidence-ledger pass on 2026-06-24. This is source-backed orientation, not browser, OBS, Chrome extension, or standalone app runtime validation.

## Purpose

Use this page when a user asks whether a customization or plugin-like SSN path "works" and an agent needs to separate:

- what the current source clearly supports,
- what focused non-runtime tests have covered,
- what still needs real runtime proof,
- what must not be promised.

For path selection, start with `customization-path-decision-matrix.md`. For setup recipes, use `customization-plugin-recipes.md`. For code-path details, use `customization-source-trace.md`.

## Related Pages

- `customization-path-decision-matrix.md`
- `customization-source-trace.md`
- `customization-plugin-recipes.md`
- `custom-plugins-and-extensions.md`
- `../07-overlays-and-pages/custom-overlays.md`
- `../12-development/adding-a-source.md`
- `../09-api-and-integrations/websocket-http-api.md`
- `../09-api-and-integrations/event-flow-editor.md`
- `../11-support-kb/common-question-proof-pack.md`
- `../18-focused-validation-evidence-log.md`

## Evidence Labels

| Label | Meaning |
| --- | --- |
| `answer-route` | Safe for choosing the likely customization path, but not enough for exact claims. |
| `source-backed` | Current source/docs show the path exists. Runtime side effects are not proven. |
| `source-trace` | Specific handlers, loaders, or call sites have been inspected. |
| `focused-tested` | A deterministic non-runtime test covers part of the logic. |
| `runtime-needed` | Needs browser, OBS, extension, standalone app, WebSocket relay, or live workflow proof. |
| `do-not-promise` | Do not state this as supported unless new evidence is added. |

## Current Evidence Summary

| Customization Path | Current Evidence | Safe Current Claim | Next Proof Needed |
| --- | --- | --- | --- |
| URL parameters and OBS CSS | `parameters.md`, generated URL metadata, `url-parameter-source-trace.md`, page-specific parser inventory | Good first path for styling and page-supported load-time behavior. | Browser/OBS validation for exact target page, parameter, refresh behavior, and CSS specificity. |
| Built-in themes | Theme page docs and grouped theme inventory | Good first path when the user wants a different existing look. | Controlled payload and OBS/browser validation per theme family. |
| Custom overlay page | `docs/customoverlays.md`, `sampleoverlay.html`, overlay agent docs | Source-backed path for user-owned visual output through iframe bridge or WebSocket. | Real browser/OBS proof with session/password/label, payload samples, and missing-field behavior. |
| Local `custom.js` for dock | `custom_sample.js`, `dock.html` source trace | Local/forked dock can call `applyCustomActions(data)` and use `false`, `null`, or returned replacement data. | Local browser/OBS/app-hosted proof that the script loads and behaves as expected. |
| Local `custom.js` for featured | `custom_sample.js`, `featured.html` source trace | Featured can call `applyCustomFeatureActions(data)` for side effects. | Runtime proof for load behavior and supported side effects; do not claim returned data replaces the message. |
| Uploaded custom user function | `custom_actions.js`, `popup.js`, `popup.html`, `background.js`, setting key `customJsEnabled` | Source-backed advanced trusted-code path exists, but the current loader is constrained and must be tested for the exact function. | Extension and app runtime proof for upload, enable/disable, reset, message mutation/blocking, and failure handling. |
| API/WebSocket external source | `sample_wss_source.html`, `api.md`, WebSocket/API docs | External apps can send SSN-shaped payloads through documented API/WebSocket paths when the session/channel/toggles are correct. | Relay/runtime proof for exact session, channel, reconnect, invalid JSON, and payload display behavior. |
| Event Flow | Event Flow docs plus focused Node tests in `18-focused-validation-evidence-log.md` | Some internal Event Flow custom JS, compare, template/counter, OBS system trigger, and play-media duration logic has focused test evidence. | Editor UI, Flow Actions overlay, OBS, extension/app runtime, import/export, and external integration validation. |
| First-class source file | `sources/README.md`, `manifest.json`, source inventory, development docs | Developer path for maintained platform support, not the right first answer for one private feed. | Extension/app source-window validation, manifest injection, payload contract, icon/docs/site metadata, and live target behavior. |
| Sharing reusable customization | Recipe and boundary docs | Share URL/CSS snippets, hosted/forked overlay files, API scripts, Event Flow descriptions/exports if supported, or PRs. | Redaction pass, setup instructions, version notes, and proof that the shared path works without secrets. |

## Claim Ledger

| Claim Or User Wording | Current Status | Use This Answer Shape |
| --- | --- | --- |
| "Can I make a plugin?" | `answer-route` | Yes, but first define what "plugin" means. SSN has URL/CSS, themes, custom overlays, local `custom.js`, uploaded user functions, API/WebSocket apps, Event Flow, and first-class source paths. |
| "Is there an official plugin ZIP or marketplace?" | `do-not-promise` | No current agent-doc evidence supports one universal plugin package, installer, or marketplace flow. |
| "Can hosted `socialstream.ninja/dock.html` load my local `custom.js`?" | `do-not-promise` | Do not promise local disk JavaScript loading from hosted pages. Use local/forked pages or another supported custom-code path. |
| "Can local/forked dock load `custom.js` and replace a message?" | `source-trace`, `runtime-needed` | Source shows `dock.html` calls `applyCustomActions(data)` and can cancel or replace data based on the return value. Runtime-test the exact local/app/browser setup before calling it proven. |
| "Can local/forked featured load `custom.js` and replace a message?" | `source-trace`, `do-not-promise` | Source shows `featured.html` calls `applyCustomFeatureActions(data)`, but the inspected call site does not use a return value as replacement data. |
| "Can uploaded custom JS filter or rewrite messages?" | `source-backed`, `runtime-needed` | The upload/enable/call path exists, but the current loader is constrained. Validate the exact function in extension/app before promising arbitrary code behavior. |
| "Can I paste custom code from a support chat?" | `do-not-promise` | Treat custom JS as trusted-user code only. Do not paste untrusted JavaScript into SSN pages, custom actions, Event Flow custom code, or browser sources. |
| "Can a custom overlay receive SSN payloads?" | `source-backed`, `runtime-needed` | Yes as an architecture path: use the iframe bridge or WebSocket path, same session, password if needed, and the right label. Runtime-test the target page and OBS/browser source. |
| "Can an outside bot/app send messages into SSN?" | `source-backed`, `runtime-needed` | Yes through API/WebSocket paths when toggles, session, channel, and payload shape are correct. Validate relay/display behavior for the exact workflow. |
| "Can Event Flow run custom code?" | `focused-tested`, `runtime-needed` | Focused Node tests cover selected Event Flow custom JS internals, not the full editor, Flow Actions overlay, OBS, app, or extension workflow. |
| "Can a new platform become first-class support?" | `source-backed`, `runtime-needed` | Yes as a development path through source files, manifest/docs/site metadata, event contract checks, and app/extension validation. |

## Minimum Proof Pack By Path

| Path | Minimum Proof Before Stronger Claim |
| --- | --- |
| URL/CSS | Exact page URL, parameter/CSS snippet, browser or OBS result, reload/refresh note, and whether the setting is load-time only. |
| Theme | Theme URL, payload sample type, browser/OBS render result, asset-loading result, and whether it expects normal chat or featured messages. |
| Custom overlay | Overlay URL/file, session/password/label setup, payload sample, `postMessage` or WebSocket route, source validation, OBS/browser screenshot or log. |
| Local `custom.js` | Local/forked file path, host mode, exact hook function, test message, observed cancel/rewrite/side effect, and failure behavior. |
| Uploaded custom user function | Uploaded code snippet, `customJsEnabled` state, extension/app mode, test payload, observed output, reset/delete behavior, and error handling. |
| API/WebSocket external source | Endpoint, session, in/out channel, toggle state, JSON payload, relay response/log, display target, reconnect/invalid payload behavior. |
| Event Flow | Flow definition/export if available, trigger input, action target, required page/label/session, runtime output, and whether the evidence is UI, page, OBS, or Node-only. |
| First-class source | Source files, manifest row, docs/site metadata, event-reference impact, controlled payload, extension injection result, app source-window result, and live-platform caveat. |

## Update Rules

When a runtime or focused validation pass is completed:

1. Add the exact evidence to `17-runtime-validation-evidence-log.md` or `18-focused-validation-evidence-log.md`.
2. Update the relevant path row in this file.
3. Update `customization-path-decision-matrix.md` and `customization-source-trace.md` only for claims actually strengthened by the evidence.
4. Update `11-support-kb/common-question-proof-pack.md`, `common-question-evidence-status.md`, and `support-evidence-ledger.md` if support-answer strength changes.
5. Re-run the docs navigation audit and update `19-navigation-and-link-audit.md` after adding or renaming agent docs.

## Current Non-Completion Boundary

This page improves answer discipline for plugin/customization questions, but it does not prove runtime behavior. Do not mark local custom JS, uploaded custom user functions, custom overlays, API/WebSocket external sources, Event Flow UI, first-class source creation, app parity, or OBS behavior as tested until actual runtime evidence is recorded.
