# Support History Refresh Playbook

Status: support-history refresh workflow pass on 2026-06-24. This page documents how to rerun SSN support-history mining safely and consistently.

## Purpose

Use this page when an agent needs to refresh common-question priorities, support wording, stale-claim lists, or topic frequency signals from `C:\Users\steve\Code\stevesbot`.

This is a workflow and query playbook. It is not a user-facing FAQ, not product runtime validation, and not permission to copy raw support conversations into documentation.

Start here for a refresh, then update:

- `support-topic-frequency-index.md`
- `support-question-phrasebook.md`
- `common-question-test-set.md`
- `support-evidence-ledger.md`
- `unresolved-or-stale-claims.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

## Hard Safety Rules

- Do not read `C:\Users\steve\Code\stevesbot\resources\secrets`.
- Do not paste raw support conversations, user names, server names, channel names, thread URLs, screenshots, attachment contents, private URLs, API keys, webhook URLs, OAuth tokens, passwords, or session IDs into docs.
- Use counts, paraphrases, category labels, and verification targets.
- Treat current `social_stream` and `ssapp` code/docs as higher priority than support history.
- Treat generated support answers and mined summaries as leads, not final truth.
- Use raw archive tables, transcripts, replays, and attachments only for narrow anonymized confirmation after curated summaries are not enough.

## Refresh Levels

| Level | Use When | Allowed Sources | Output |
| --- | --- | --- | --- |
| Quick refresh | New QA export or DB snapshot exists and priorities may have shifted. | Latest QA export, aggregate SQLite counts, curated summaries. | Updated counts, changed topic priorities, checklist row. |
| Heavy refresh | A support topic needs better answer routing or wording. | Curated support markdown, SQLite summary rows, generated Q&A summaries. | Updated phrasebook, test-set rows, evidence ledger, stale claims. |
| Intense refresh | A high-frequency support claim needs final-grade documentation. | Current source/docs first, then support summaries, raw archive only for anonymized confirmation. | Source-checked topic doc, validation target, stale/current claim decision. |

## Source Order

1. Current `social_stream` docs/code.
2. Current `ssapp` docs/code for desktop app behavior.
3. `stevesbot/resources/instructions/social-stream-support.md`.
4. `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`.
5. `stevesbot/resources/learnings/support-qa/social-stream-*.md`.
6. `stevesbot/resources/learnings/playbooks/*.md`, filtered to SSN.
7. `stevesbot/data/sqlite/knowledge.sqlite` aggregate or summarized rows.
8. `stevesbot/data/sqlite/stevesbot.sqlite` aggregate or summarized rows.
9. Latest `stevesbot/data/exports/qa/qa-export-*.json`.
10. Raw archives/transcripts/replays only with a narrow anonymized purpose.

## Preflight Checklist

Before running queries:

- Confirm the current docs root is `C:\Users\steve\Code\social_stream\docs\agents`.
- Confirm the support repo exists at `C:\Users\steve\Code\stevesbot`.
- Confirm `sqlite3.exe` is available.
- Read `stevesbot-resource-inventory.md`, `mining-method.md`, and `support-source-map.md`.
- Decide the refresh level: quick, heavy, or intense.
- Decide which docs will be updated before reading broad support material.

Command checks:

```powershell
Get-Command sqlite3.exe
Get-ChildItem C:\Users\steve\Code\stevesbot\data\sqlite -Filter *.sqlite
Get-ChildItem C:\Users\steve\Code\stevesbot\data\exports\qa -Filter qa-export-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 5 Name,Length,LastWriteTime
```

## Current Snapshot

Checked on 2026-06-24:

| Source | Current Fact |
| --- | --- |
| `data/sqlite/knowledge.sqlite` | Product-filtered `mined_threads` rows for `products_json like '%Social Stream%'`: 1,037 |
| `data/sqlite/stevesbot.sqlite` | `support_records` product counts: `social-stream-support` 180, `social-stream` 24 |
| `data/sqlite/stevesbot.sqlite` | `qa_entries` route `social-stream-support`: 163 rows, average confidence 0.941, min 0.6, max 1.0 |
| Latest QA export | `qa-export-2026-06-21T09-00-01.json` |
| Latest QA export counts | 344 approved runs, 487 support records, 2,244 mined threads |

The QA export uses a broader text filter in `support-topic-frequency-index.md`; its filtered totals are not expected to match the stricter SQLite product-filter count exactly.

## Aggregate Query Pack

Run aggregate queries first. These are safe because they do not expose raw support content.

### Mined Thread Count

```powershell
sqlite3.exe C:\Users\steve\Code\stevesbot\data\sqlite\knowledge.sqlite "select count(*) from mined_threads where products_json like '%Social Stream%';"
```

### Category Counts

```powershell
sqlite3.exe C:\Users\steve\Code\stevesbot\data\sqlite\knowledge.sqlite "select category, count(*) from mined_threads where products_json like '%Social Stream%' group by category order by count(*) desc limit 20;"
```

Current result:

| Category | Count |
| --- | ---: |
| troubleshooting | 550 |
| bug-report | 161 |
| configuration | 114 |
| how-to | 109 |
| feature-request | 66 |
| general-discussion | 16 |
| compatibility | 16 |
| performance | 5 |

### Resolved Status Counts

```powershell
sqlite3.exe C:\Users\steve\Code\stevesbot\data\sqlite\knowledge.sqlite "select resolved, count(*) from mined_threads where products_json like '%Social Stream%' group by resolved order by count(*) desc;"
```

Current result:

| Resolved Flag | Count |
| --- | ---: |
| 1 | 660 |
| 0 | 377 |

Use the unresolved count as a prioritization signal only. Do not assume every unresolved thread is a current bug.

### Platform Label Counts

```powershell
sqlite3.exe C:\Users\steve\Code\stevesbot\data\sqlite\knowledge.sqlite "select json_each.value, count(*) from mined_threads, json_each(mined_threads.platforms_json) where products_json like '%Social Stream%' group by json_each.value order by count(*) desc limit 20;"
```

Current result:

| Platform Label | Count | Caveat |
| --- | ---: | --- |
| Discord | 505 | Often the support venue, not only the Discord source. |
| YouTube | 300 | High-priority platform validation target. |
| Twitch | 293 | High-priority platform validation target. |
| Chrome | 293 | Browser/extension install and capture context. |
| Windows | 285 | App/desktop environment context. |
| TikTok | 240 | App/extension mode and connector validation target. |
| OBS | 150 | Overlay/browser-source support context. |
| Kick | 134 | Source-mode, auth, and CAPTCHA validation target. |
| GitHub | 60 | Install/update/customization context. |
| Facebook | 57 | Platform source validation target. |
| Linux | 53 | App/browser environment context. |
| macOS | 46 | App/browser environment context. |
| Firefox | 38 | Capability limitation and repro-routing context. |
| iOS | 31 | Usually mobile/device context. |
| Rumble | 31 | Platform source validation target. |
| Android | 27 | Usually mobile/device context. |
| Instagram | 18 | Platform source validation target. |
| Safari | 17 | Browser limitation context. |
| Browser | 16 | Generic web context. |
| Google | 13 | Often account/browser/provider context. |

### Term Count Pack

```powershell
sqlite3.exe C:\Users\steve\Code\stevesbot\data\sqlite\knowledge.sqlite "with terms(term) as (values ('TikTok'),('YouTube'),('Twitch'),('Kick'),('Rumble'),('Facebook'),('Instagram'),('OBS'),('TTS'),('dock.html'),('featured.html'),('WebSocket'),('OAuth'),('settings'),('CSS'),('Electron'),('Chrome Extension'),('Desktop App'),('plugin'),('custom'),('API'),('Event Flow')) select term, (select count(*) from mined_threads where products_json like '%Social Stream%' and searchable_text like '%' || term || '%') as count from terms order by count desc;"
```

Current result:

| Term | Count |
| --- | ---: |
| Desktop App | 357 |
| Twitch | 295 |
| YouTube | 294 |
| settings | 293 |
| OBS | 278 |
| TikTok | 240 |
| WebSocket | 235 |
| dock.html | 180 |
| API | 145 |
| custom | 141 |
| Kick | 138 |
| Chrome Extension | 122 |
| TTS | 68 |
| Facebook | 55 |
| Rumble | 46 |
| CSS | 40 |
| featured.html | 34 |
| Event Flow | 31 |
| Electron | 27 |
| Instagram | 25 |
| plugin | 15 |
| OAuth | 10 |

Use this to decide which docs deserve the next source-check or runtime-validation pass. Do not cite these as public usage statistics.

### Curated Support Record Counts

```powershell
sqlite3.exe C:\Users\steve\Code\stevesbot\data\sqlite\stevesbot.sqlite "select product_id, count(*) from support_records where product_id like 'social-stream%' group by product_id order by count(*) desc;"
```

Current result:

| Product ID | Count |
| --- | ---: |
| social-stream-support | 180 |
| social-stream | 24 |

### Generated QA Confidence Summary

```powershell
sqlite3.exe C:\Users\steve\Code\stevesbot\data\sqlite\stevesbot.sqlite "select count(*), round(avg(review_confidence), 3), min(review_confidence), max(review_confidence) from qa_entries where route_id like 'social-stream%';"
```

Current result:

| Rows | Avg Confidence | Min | Max |
| ---: | ---: | ---: | ---: |
| 163 | 0.941 | 0.6 | 1.0 |

High confidence is not proof of current source behavior. It only says the generated/curated QA item was reviewed with that confidence in the support pipeline.

## Heavy Refresh Query Pattern

Use this only after aggregate counts identify a topic. Keep output summarized and redacted.

```sql
select category,
       resolved,
       substr(problem_statement, 1, 160) as problem_lead,
       substr(solution, 1, 180) as solution_lead
from mined_threads
where products_json like '%Social Stream%'
  and searchable_text like '%TikTok%'
order by last_message_at desc
limit 20;
```

Do not paste the result table directly into docs if it contains private wording. Convert it into:

- symptom pattern,
- likely route,
- source-check target,
- stale-risk note,
- suggested user-facing intake question.

## Raw Archive Gate

Use `archive.sqlite`, raw transcripts, replays, or attachments only if all are true:

- The curated sources do not answer the question.
- The user-facing answer would be materially better with anonymized frequency or symptom confirmation.
- The query is narrow: one topic, platform, error, or exact phrase family.
- The output can be summarized without names, URLs, screenshots, attachments, raw quotes, or private details.
- The final claim is still checked against current `social_stream` or `ssapp` source before being called current behavior.

## Refresh Output Rules

After a quick refresh, update:

- `support-topic-frequency-index.md` with new counts and date.
- `common-question-test-set.md` if new recurring prompt shapes appear.
- `01-extraction-checklist.md` with the refresh scope, level, sources, and status.

After a heavy refresh, also update:

- `support-question-phrasebook.md` with paraphrased wording patterns.
- `support-evidence-ledger.md` with evidence labels and next validation.
- `unresolved-or-stale-claims.md` for claims that are old, volatile, generated, or contradicted.
- Any routed topic doc that needs a new caveat or setup branch.

After an intense refresh, also update:

- The exact platform, command, setting, app, API, overlay, or customization doc.
- `17-runtime-validation-evidence-log.md` if real browser/app/OBS/API/platform validation was performed.
- `18-focused-validation-evidence-log.md` if deterministic non-runtime tests were performed.
- `15-objective-coverage-and-readiness-audit.md` if answer readiness changed.

## Stale-Claim Decision Tree

1. If the claim is confirmed by current source and does not require runtime behavior, label it `source-backed`.
2. If the claim is confirmed by current source and matching runtime evidence, label it `runtime-tested` only for that exact workflow.
3. If the claim appears in support history but current source has not been checked, label it `support-derived`.
4. If the claim depends on a third-party platform UI, auth, API, policy, model, pricing, or quota, label it `stale-risk`.
5. If current source contradicts the support claim, move it to `unresolved-or-stale-claims.md` and do not use it as current guidance.

## Recommended Next Splits

The current aggregate data points to these high-value splits:

1. Platform capture/support by YouTube, Twitch, TikTok, Kick, Facebook, Rumble, Instagram, and Discord.
2. App/desktop wording split by source windows, login/OAuth, settings, portable app, and app-vs-extension behavior.
3. URL/settings split by popup setting, generated URL parameter, page-specific parser, generated link, and reload/reconnect behavior.
4. Customization split by CSS, themes, custom overlays, custom JS/user functions, API apps, Event Flow, and new source development.
5. API/automation split by receive-chat, send-command, send-chat, target label, Event Flow, StreamDeck, Streamer.bot, and WebSocket source pages.

## Good Refresh Stop Point

Stop a refresh when:

- aggregate counts were recorded,
- new recurring prompt shapes were added to `common-question-test-set.md`,
- stale-risk claims were moved or labeled,
- routed topic docs were updated if needed,
- checklist and ledger rows were updated,
- docs link/scope checks pass.

Do not keep mining raw support data just because it exists. Stop when the current docs have enough safer routing or when current source/runtime validation becomes the real next step.
