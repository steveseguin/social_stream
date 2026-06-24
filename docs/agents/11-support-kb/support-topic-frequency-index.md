# Support Topic Frequency Index

Status: quick support-history frequency pass on 2026-06-24.

## Purpose

Use this page to prioritize SSN documentation and support-answer work by what appears often in curated support exports.

This is not a raw transcript dump. It uses counts and anonymized topic labels only. Do not copy private support conversations into agent docs.

For the repeatable refresh workflow, SQLite query pack, raw archive gate, and required downstream doc updates, use `support-history-refresh-playbook.md`.

## Source Snapshot

Source used:

- `C:\Users\steve\Code\stevesbot\data\exports\qa\qa-export-2026-06-21T09-00-01.json`

Export metadata:

| Field | Value |
| --- | --- |
| Exported at | `2026-06-21T09:00:01.573Z` |
| Since date | `all` |
| Total approved runs | 344 |
| Total support records | 487 |
| Total mined threads | 2244 |

SSN-focused filter used for this pass:

| Filtered Source | Count |
| --- | ---: |
| Support records with `social-stream*` product IDs | 194 |
| Approved QA runs matching SSN terms | 193 |
| Mined thread summaries matching SSN/product terms | 1414 |
| Combined filtered text items counted | 1801 |

The filter is intentionally broad. It catches SSN-adjacent material, but can include mixed OBS/VDO.Ninja context when the same thread mentions SSN.

## Safety Notes

- Counts are directional, not final proof of current behavior.
- Use these counts to choose documentation and validation priorities.
- Do not cite a count as a product metric or public usage statistic.
- Do not quote raw questions, thread names, Discord usernames, channel URLs, or private support details.
- "Discord" appears frequently because Discord is also the support venue. Do not treat the Discord count as only the Discord source integration.
- Source-check current `social_stream` and `ssapp` code before converting a support-history pattern into current guidance.

## Mined Thread Category Counts

These counts come from SSN-filtered mined thread summaries.

| Category | Count |
| --- | ---: |
| `troubleshooting` | 744 |
| `bug-report` | 191 |
| `how-to` | 168 |
| `configuration` | 147 |
| `feature-request` | 100 |
| `general-discussion` | 29 |
| `compatibility` | 23 |
| `performance` | 12 |

Implication: troubleshooting, bug reports, how-to setup, and configuration deserve stronger first-answer routing than feature marketing.

## Directional Topic Buckets

The topic buckets below were counted from filtered support records, approved QA runs, and mined thread summaries using keyword patterns. A single text item can count in multiple buckets.

| Topic Bucket | Count | What It Usually Means | Start Docs |
| --- | ---: | --- | --- |
| Platform-specific capture/support | 1338 | Questions mention YouTube, TikTok, Twitch, Kick, Rumble, Facebook, Instagram, Discord, or mode-specific source behavior. | `08-platform-sources/index.md`, `08-platform-sources/platform-capability-matrix.md` |
| Capture not working | 1180 | Chat not appearing, source not capturing, wrong page, hidden chat, reload/refresh, extension off, or source mode mismatch. | `10-troubleshooting/diagnostic-decision-tree.md`, `10-troubleshooting/extension-not-capturing.md` |
| Customization/development | 984 | Custom overlays, CSS, JS, sources, plugins, forks, GitHub, and custom code paths. | `13-reference/customization-path-decision-matrix.md`, `13-reference/customization-plugin-recipes.md`, `12-development/adding-a-source.md` |
| URL/settings/options | 972 | URL parameters, popup settings, toggles, CSS/JS params, scale, dark/light mode, dock/featured options. | `13-reference/url-parameters.md`, `13-reference/settings-and-toggles.md`, `13-reference/settings-change-impact-matrix.md` |
| Standalone app/desktop | 945 | Desktop app, Electron, source windows, portable app, app-vs-extension behavior. | `04-standalone-app-source-windows.md`, `10-troubleshooting/desktop-app-issues.md` |
| Install/update/version | 833 | Load unpacked, Chrome Web Store lag, beta/latest version, update process, extension folder, manifest. | `13-reference/install-update-version-guide.md` |
| OBS/overlay display | 776 | OBS browser source, blank/transparent overlays, dock/featured pages, StreamElements/Streamlabs overlay context. | `10-troubleshooting/obs-overlay-display.md`, `07-overlays-and-pages/index.md` |
| Session/routing/server modes | 659 | Session ID, password, dock/featured labels, `server`, `server2`, `server3`, `localserver`, room IDs. | `13-reference/surface-url-cheatsheet.md`, `13-reference/url-parameter-source-trace.md` |
| API/commands/automation | 545 | HTTP API, WebSocket/WSS, send-chat, StreamDeck, Companion, Streamer.bot, Event Flow, automation. | `13-reference/action-command-index.md`, `13-reference/command-action-source-trace.md` |
| Donation/events/tools | 246 | Donations, tips, gifts, subs, members, alerts, credits, tip jar, leaderboard, hype, polls, timers, giveaways, waitlist. | `07-overlays-and-pages/page-capability-matrix.md`, `07-overlays-and-pages/tipjar-credits.md` |
| Privacy/auth/secrets | 245 | Login, OAuth, tokens, keys, private pages, passwords, permissions, cookies, privacy. | `13-reference/privacy-security-and-secrets.md`, `10-troubleshooting/auth-and-sign-in.md` |
| TTS/AI/cohost | 188 | Text-to-speech, voices, OpenAI/Gemini, prompts, cohost, translation. | `09-api-and-integrations/tts.md`, `09-api-and-integrations/ai-features.md` |

## Frequent Keywords

Top SSN-filtered mined-thread keywords from the latest export:

| Keyword | Count |
| --- | ---: |
| `Social Stream Ninja` | 670 |
| `SSN` | 210 |
| `dock.html` | 190 |
| `SSN Desktop App` | 173 |
| `standalone app` | 164 |
| `OBS` | 156 |
| `Twitch` | 121 |
| `TikTok` | 116 |
| `YouTube` | 105 |
| `Chrome extension` | 82 |
| `standard mode` | 69 |
| `websocket mode` | 69 |
| `Kick` | 68 |
| `configuration` | 62 |
| `beta version` | 58 |
| `browser extension` | 55 |
| `Chrome` | 53 |
| `update` | 51 |
| `TTS` | 49 |
| `overlay` | 48 |
| `chat overlay` | 47 |
| `YouTube chat` | 44 |
| `browser source` | 44 |
| `websocket` | 43 |
| `sign in` | 43 |
| `URL parameters` | 40 |
| `featured.html` | 39 |
| `session ID` | 37 |

## Platform Mentions

Top platform labels in SSN-filtered mined-thread summaries:

| Platform Label | Count | Interpretation Caveat |
| --- | ---: | --- |
| `Discord` | 699 | Often the support venue, not only the Discord source. |
| `YouTube` | 433 | High-priority platform doc and source validation target. |
| `Chrome` | 377 | Extension/browser install and capture troubleshooting. |
| `Twitch` | 377 | High-priority platform doc and EventSub/IRC validation target. |
| `Windows` | 368 | App/desktop and install/update support context. |
| `TikTok` | 305 | App/extension mode selection and connector validation target. |
| `Kick` | 165 | OAuth/app/websocket/source-mode validation target. |
| `OBS` | 164 | Overlay/browser-source display and routing context. |
| `Linux` | 77 | App/browser environment context. |
| `Facebook` | 68 | Platform-specific source validation target. |
| `GitHub` | 63 | Manual install, update, fork/customization context. |
| `macOS` | 61 | App/browser environment context. |
| `Firefox` | 54 | Capability limitation and reproduction-routing context. |
| `Rumble` | 35 | Platform-specific source validation target. |
| `Instagram` | 20 | Platform-specific source validation target. |

## Documentation Priority Implications

Use this queue when choosing the next support-history-backed pass:

1. Keep platform source docs and `platform-capability-matrix.md` current. Platform-specific issues are the largest bucket.
2. Strengthen capture troubleshooting flows with exact source-mode, reload, session, and dock-first checks.
3. Keep customization docs practical. Custom CSS/JS/overlay/source questions appear frequently enough to need clear routing.
4. Keep URL/settings docs paired. Support questions often mix popup settings, URL params, and page-specific parser behavior.
5. Validate standalone app source-window behavior. App/desktop wording is frequent and high-risk without real app testing.
6. Preserve install/update/version guidance. Web Store lag, manual install, beta/latest, and settings-preservation questions recur.
7. Treat OBS/browser-source blank overlays as a core support path, not an edge case.
8. Keep commands/API/Event Flow examples source-checked and eventually runtime-validated.
9. Mine donation/events/tool-page threads only after current page behavior is source-checked; payload shapes can be narrow.
10. Keep privacy/auth/secrets guidance visible in intake templates and troubleshooting.

## Safe Answer Routing

| If The User Mentions | Route First | Then Check |
| --- | --- | --- |
| "not showing", "nothing appears", "no chat" | `10-troubleshooting/diagnostic-decision-tree.md` | exact platform doc, dock/source session |
| YouTube, TikTok, Twitch, Kick | exact platform doc | `08-platform-sources/platform-capability-matrix.md` |
| app, standalone, source window | `04-standalone-app-source-windows.md` | `10-troubleshooting/desktop-app-issues.md` |
| OBS, browser source, blank overlay | `10-troubleshooting/obs-overlay-display.md` | `13-reference/surface-url-cheatsheet.md` |
| URL parameter, setting, option, scale, CSS | `13-reference/url-parameters.md` | `13-reference/url-parameter-source-trace.md`, `settings-and-toggles.md`, `settings-change-impact-matrix.md` |
| plugin, custom overlay, custom JS, source code | `13-reference/customization-path-decision-matrix.md` | `13-reference/customization-plugin-recipes.md`, `12-development/adding-a-source.md` |
| command, API, StreamDeck, Streamer.bot, Event Flow | `13-reference/action-command-index.md` | `13-reference/command-action-source-trace.md` |
| TTS, AI, voice, cohost | `09-api-and-integrations/tts.md` | `09-api-and-integrations/ai-features.md` |
| login, token, key, private, password | `13-reference/privacy-security-and-secrets.md` | `10-troubleshooting/auth-and-sign-in.md` |

For paraphrased examples of how these buckets appear in user wording, use `support-question-phrasebook.md`.

## Follow-Up Extraction Needs

- Re-run this pass after each new QA export and record date/count deltas.
- Query `stevesbot/data/sqlite/knowledge.sqlite` and `stevesbot/data/sqlite/stevesbot.sqlite` with the same SSN filter for a second-source frequency check.
- Split "platform-specific" into per-platform symptom types, not just platform name counts.
- Split "customization/development" into CSS, custom JS, custom overlay, custom source, and plugin wording.
- Split "URL/settings/options" into popup setting, URL parameter, generated parameter, and page-specific parser issues.
- Expand `support-question-phrasebook.md` with new paraphrased problem patterns after each curated QA export.
