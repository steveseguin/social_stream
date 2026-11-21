# Options And Settings Proof Ledger

Status: heavy options/settings evidence-ledger pass on 2026-06-24. This is source-backed orientation plus focused metadata evidence, not browser, OBS, Chrome extension, standalone app, or generated-docs UI runtime validation.

## Purpose

Use this page when a user asks:

- what option, URL parameter, or popup setting controls something,
- why a setting saved but behavior did not change,
- why a URL option works on one page but not another,
- whether a setting applies to the Chrome extension, standalone app, OBS page, hosted page, source page, or tool page,
- whether a generated link updates an already-open browser source.

This ledger is the proof gate over URL parameters, popup settings, sessions, passwords, generated links, app source state, and page-local options.

## Related Pages

- `settings-and-toggles.md`
- `settings-key-index.md`
- `settings-session-storage-source-trace.md`
- `settings-change-impact-matrix.md`
- `url-parameters.md`
- `url-parameter-index.md`
- `url-parameter-source-trace.md`
- `root-page-url-parameter-matrix.md`
- `subpage-url-parameter-matrix.md`
- `url-option-examples.md`
- `surface-url-cheatsheet.md`
- `../06-settings-sessions-and-storage.md`
- `../16-runtime-validation-playbooks.md`
- `../17-runtime-validation-evidence-log.md`
- `../18-focused-validation-evidence-log.md`

## Evidence Labels

| Label | Meaning |
| --- | --- |
| `answer-route` | Safe for choosing the right docs or control surface, not enough for exact behavior. |
| `generated-inventory` | Generated settings or URL metadata exists. Useful for lookup, not runtime proof. |
| `source-backed` | Current source/docs show the setting, parameter, storage path, or parser exists. |
| `source-trace` | Specific save/load/parser/storage/reload behavior was inspected. |
| `focused-config-check` | Settings config JSON or metadata was checked without running the product. |
| `runtime-needed` | Needs Chrome, app, browser page, OBS, generated-docs UI, source-window, or provider runtime proof. |
| `do-not-promise` | Do not state this behavior as supported without new evidence. |

## Current Evidence Summary

| Area | Current Evidence | Safe Current Claim | Next Proof Needed |
| --- | --- | --- | --- |
| Generated popup settings | `shared/config/settingsDefinitions.js`, `settings-key-index.md`, focused metadata check | Current generated definitions provide a strong lookup map for popup setting keys, categories, types, and descriptions. | Popup UI runtime proof, save behavior, live-update behavior, migration, and app parity. |
| Settings config JSON files | `settings/config_0.json`, `settings/config_linux_0.json`, `settings/config_mac_0.json`, `scripts/validate-configs.sh` | Focused validation proved the current config JSON files parse and have no duplicate keys according to the script. | Product runtime behavior after loading/importing those configs. |
| Generated URL parameters | `shared/config/urlParameters.js`, `url-parameter-index.md`, focused metadata check | Current generated metadata provides a strong lookup map for generated dock/streaming-overlay parameters. | Page-specific parser/runtime proof and duplicate alias reconciliation. |
| Page-specific URL parser behavior | `url-parameter-source-trace.md`, root/subpage matrices | Many pages parse their own narrower option sets and URL parameters are not global. | Browser/OBS proof for exact page, parameter, value shape, load timing, and channel/server mode. |
| Popup setting save path | `popup.js`, `background.js`, `service_worker.js`, `settings-session-storage-source-trace.md` | Popup settings generally save to the extension/app settings object through `saveSetting`; session/password use a separate `sidUpdated` path. | Real extension/app proof that the exact control saves and affects the target feature. |
| Session and password behavior | Storage source trace, popup generated-link trace | Session/password are separate from ordinary settings and must match across source, dock, overlay, API, and OBS URLs. | Runtime proof for transport reset, stale links, protected sessions, and app cached state. |
| Generated popup links | `popup.js` `setupPageLinks()` trace | Generated links are derived output; copying a new link does not update already-open tabs or OBS sources. | Browser/OBS proof that replacing and refreshing the exact URL changes behavior. |
| Standalone app settings and source state | `ssapp/state.js`, `ssapp/main.js`, `ssapp/settings-backup.js` source traces | App source state, cached SSN settings, and backup layers are separate from Chrome extension storage. | Electron app e2e proof for source-window reload, import/export/reset, and cached-state recovery. |
| Provider/auth settings | Settings docs and provider docs | Saving a key/model/endpoint setting is not proof the external provider, account, quota, browser audio, or OBS audio path works. | Provider/runtime proof with redacted credentials and observed output/failure. |
| Page-local state | Individual tool/overlay pages | Some pages keep their own local state outside popup settings and URL parameters. | Page-specific browser/OBS proof and storage reset behavior. |

## Claim Ledger

| Claim Or User Wording | Current Status | Use This Answer Shape |
| --- | --- | --- |
| "This setting exists, so it must work." | `do-not-promise` | Generated metadata proves the setting is listed, not that runtime behavior works in every surface. |
| "This URL parameter is in the docs, so every page supports it." | `do-not-promise` | URL parameters are page-specific. Check the target page parser before claiming support. |
| "I saved the popup setting, so OBS should update." | `do-not-promise` | Saving a setting does not refresh an OBS browser source. Refresh or replace the exact OBS URL when needed. |
| "I copied a new generated link, so the old source changed." | `do-not-promise` | Generated links are copied output. Existing browser tabs and OBS sources keep their old URL until changed and refreshed. |
| "Changing session/password updates old overlay URLs." | `do-not-promise` | Existing URLs still contain the old values. Regenerate/replace source, dock, overlay, API, and OBS URLs so they match. |
| "Chrome extension settings and standalone app settings are the same storage." | `do-not-promise` | The app loads Social Stream source files but has Electron-specific state, app source entries, shims, cached settings, and backups. |
| "`server`, `server2`, `server3`, and `localserver` mean the same thing everywhere." | `do-not-promise` | These are page-specific. Use `url-parameter-source-trace.md` before giving server/channel examples. |
| "A boolean parameter always accepts true/false." | `do-not-promise` | Boolean parsing differs by page. Some use presence-only flags; others parse specific values. |
| "A URL option can recover messages the source never captured." | `do-not-promise` | Overlay/dock options cannot display data that upstream source settings or filters prevented from being captured. |
| "A provider key saved successfully, so AI/TTS must work." | `do-not-promise` | Provider account, endpoint, model, quota, CORS, browser audio, app behavior, and OBS capture still need proof. |
| "The duplicate URL aliases prove a user-facing bug." | `source-backed`, `runtime-needed` | Treat duplicate `password` and normalized `strokecolor` aliases as metadata findings until lookup/UI/runtime behavior is tested or definitions are reconciled. |
| "A missing key in `settings-key-index.md` means no setting exists." | `runtime-needed` | Generated definitions are strong, but some popup controls may exist outside generated metadata. Search `popup.html`, `popup.js`, and relevant source before saying no. |

## Minimum Proof Pack By Question Type

| Question Type | Minimum Proof Before Stronger Claim |
| --- | --- |
| Exact popup setting | Setting key, UI label if known, generated definition, save path, target source/page, whether reload/reconnect is required, observed before/after behavior. |
| Exact URL parameter | Target page URL, parameter name and value, page parser evidence, generated index evidence if relevant, refresh/load timing, observed browser/OBS effect. |
| Generated link | Popup state, generated URL, destination surface, old URL versus new URL, refresh/reopen step, observed behavior. |
| Session/password issue | Redacted session/password state, source/dock/overlay/API/OBS URLs, same-session proof, password-protected path if any, transport reconnect evidence. |
| App setting/source state | App source entry, source-window identity, cached settings file/backup state if relevant, reopen/reload step, observed app behavior. |
| Provider/auth option | Redacted key/account/endpoint/model/voice, saved setting proof, provider response or error, browser/app/OBS output, current provider limit/cost note. |
| Page-local state | Exact page, localStorage or page-state key if known, reset/change command, page reload behavior, observed UI state. |
| Duplicate metadata finding | Current generated source entry, duplicate normalized key/alias/name, UI/lookup/runtime impact if tested, decision to reconcile or document caveat. |

## Recommended Answer Flow

1. Classify the changed thing: popup setting, URL parameter, generated link, session/password, app source entry, app cached settings, provider/auth, or page-local state.
2. Find the exact key or parameter:
   - Popup settings: `settings-key-index.md`.
   - URL parameters: `url-parameter-index.md`.
   - Page behavior: `url-parameter-source-trace.md`, `root-page-url-parameter-matrix.md`, and `subpage-url-parameter-matrix.md`.
   - Storage/reload behavior: `settings-session-storage-source-trace.md` and `settings-change-impact-matrix.md`.
3. Check the affected surface: Chrome extension, standalone app, hosted page, local page, OBS browser source, source window, API client, or provider.
4. Check whether the affected target was refreshed, reloaded, reopened, or reconnected.
5. Require runtime evidence before saying an option or setting is tested.

## Update Rules

When option/settings evidence changes:

1. Add runtime evidence to `17-runtime-validation-evidence-log.md` or focused evidence to `18-focused-validation-evidence-log.md`.
2. Update the matching row in this file.
3. Update `settings-and-toggles.md`, `settings-session-storage-source-trace.md`, `settings-change-impact-matrix.md`, `url-parameters.md`, and `url-parameter-source-trace.md` only for claims actually strengthened or corrected.
4. Update support routing in `common-question-proof-pack.md`, `common-question-evidence-status.md`, and `support-evidence-ledger.md` if answer strength changes.
5. Re-run the docs navigation audit after adding, renaming, or moving option/settings docs.

## Current Non-Completion Boundary

This page improves option/settings answer discipline, but it does not prove runtime behavior. Do not mark popup setting changes, generated links, page-specific URL parameters, server/channel modes, session/password updates, OBS browser-source refreshes, app source-window state, app settings import/export/reset, provider/auth settings, or generated docs UI behavior as tested until matching runtime evidence is recorded.
