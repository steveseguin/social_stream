# Support KB Mining Method

Status: heavy extraction pass started.

## Purpose

This file explains how future agents should mine `<stevesbot repo>` for Social Stream Ninja documentation without re-processing the same files, leaking unrelated/private data, or promoting stale support advice into current docs.

The support archive is evidence of real user problems. Current `social_stream` and `ssapp` source files remain the source of truth for how SSN works today.

For the latest SSN-filtered topic-count pass from curated QA exports, use `support-topic-frequency-index.md`. For the repeatable refresh workflow, aggregate SQLite query pack, redaction rules, and required downstream doc updates, use `support-history-refresh-playbook.md`.

## Safety Boundary

Write only inside `docs/agents`.

Read support data in this order:

1. Current SSN source/docs in `social_stream` and `ssapp`.
2. Curated SSN support instructions and generated summaries in `stevesbot/resources`.
3. Curated SQLite summary tables.
4. Raw archive/message tables only when a summarized source is insufficient.

Do not broad-search `stevesbot/resources` without excluding `resources/secrets`. Prefer known safe paths listed below and check `stevesbot-resource-inventory.md` before opening raw support data. Do not copy raw user conversations into docs. Summarize symptoms, advice, and verification targets instead.

## Safe Source Set

Curated instruction files:

| Source | Use | Extraction status |
| --- | --- | --- |
| `resources/instructions/social-stream-support.md` | Support stance, first-response checks, platform caveats, escalation style. | heavy-started |
| `resources/instructions/drafter-context.md` | Bot drafting context and product boundaries. | quick-started |

Curated learning files:

| Source | Use | Extraction status |
| --- | --- | --- |
| `resources/learnings/social-stream-ninja-top-issues.md` | Top recurring support themes from summarized threads. | heavy-started |
| `resources/learnings/unresolved-analysis.md` | Unresolved pattern clusters and possible product/doc gaps. | heavy-started |
| `resources/learnings/pipeline-analysis.md` | Support-bot confidence gaps and missing KB areas. | heavy-started |
| `resources/learnings/cross-product-integration-guide.md` | OBS, VDO.Ninja, Electron Capture, and SSN boundary confusion. | heavy-started |
| `resources/learnings/playbooks/playbook-obs-overlay-issues.md` | OBS/browser-source and overlay triage. | heavy-started |
| `resources/learnings/playbooks/playbook-tiktok-connection.md` | TikTok mode and breakage triage. | heavy-started |
| `resources/learnings/playbooks/triage-macros.md` | Reusable triage branches for SSN/OBS/TikTok. | quick/heavy-started in `support-macro-routing.md` |
| `resources/learnings/playbooks/rapid-response-decision-tree.md` | Rapid support triage, safety gates, and escalation routing. | quick/heavy-started in `support-macro-routing.md` |
| `resources/learnings/playbooks/rapid-macros-wave3.md` | Copy/paste macro candidates, filtered to SSN-relevant support rows. | quick/heavy-started in `support-macro-routing.md` |
| `resources/learnings/playbooks/escalation-prompts-wave3.md` | Safe refusal and redacted escalation packet wording. | quick/heavy-started in `support-macro-routing.md` |
| `resources/learnings/support-qa/social-stream-configuration.md` | Setup and configuration Q&A. | heavy-started |
| `resources/learnings/support-qa/social-stream-qa.md` | Broad SSN Q&A. | heavy-started |
| `resources/learnings/support-qa/social-stream-qa-expanded.md` | Expanded SSN Q&A. | heavy-started |

SQLite databases:

| Source | Tables checked | Use | Extraction status |
| --- | --- | --- | --- |
| `data/sqlite/knowledge.sqlite` | `mined_threads`, FTS tables | Thread-level summaries, categories, products, platforms, issue frequency. | heavy-started |
| `data/sqlite/stevesbot.sqlite` | `support_records`, `qa_entries` | Curated support records and generated Q&A entries. | heavy-started |
| `data/sqlite/archive.sqlite` | `archived_messages`, FTS tables | Raw archived messages for final confirmation only. | quick-started |
| `resources/knowledge.sqlite` | `mined_threads`, FTS tables | Older/alternate knowledge DB copy; 2,254 rows in quick check. | quick-started |

Derivative/raw resource groups:

| Source | Use | Extraction status |
| --- | --- | --- |
| `data/exports/qa/qa-export-*.json` | Generated Q&A snapshots; latest export has approved runs, support records, and mined-thread counts. | quick-started |
| `data/mined-threads/threads-*.jsonl` | Date-bucketed mined summaries. Prefer SQLite first. | inventory-only |
| `data/transcripts/**/*.jsonl` | Raw Discord exports. Use only for anonymized confirmation. | raw-private |
| `data/replays/**` | Replay captures and replay DBs. Use only for narrow validation. | raw-private |
| `data/attachments/**` | Screenshots/uploads. Avoid broad inspection. | skip by default |

Avoid backups unless a current DB is missing or corrupted.

## Database Shapes

Observed schemas:

`knowledge.sqlite`:

- `mined_threads`: `thread_id`, `thread_name`, `channel_name`, `source_url`, date fields, counts, `summary`, `problem_statement`, `solution`, `resolved`, JSON product/platform/error fields, `category`, `searchable_text`.
- Count checked: 2,264 mined threads.

`stevesbot.sqlite`:

- `support_records`: `route_id`, `product_id`, thread reference, date range, `question_summary`, `answer_summary`, `status_flags`, `searchable_text`.
- Count checked: 499 support records.
- Product counts checked: `social-stream-support` 180, `social-stream` 24, plus other non-SSN products.
- `qa_entries`: `question_text`, `answer_text`, support/repo refs, confidence.
- Count checked: 358 Q&A entries.

`archive.sqlite`:

- `archived_messages`: raw `content`, author/thread/channel fields, timestamps, source URL.
- Count checked: 47,600 archived messages.
- Use only for anonymized confirmation of symptom language or frequency.

## Query Recipes

Use these patterns from `<ssapp repo>` or any shell where `sqlite3.exe` resolves:

```powershell
sqlite3.exe <stevesbot repo>/data/sqlite/knowledge.sqlite ".schema mined_threads"
sqlite3.exe <stevesbot repo>/data/sqlite/knowledge.sqlite "select count(*) from mined_threads;"
sqlite3.exe <stevesbot repo>/data/sqlite/stevesbot.sqlite "select product_id, count(*) from support_records group by product_id order by count(*) desc;"
```

Product-filtered term count:

```sql
with terms(term) as (
  values ('TikTok'),('YouTube'),('Twitch'),('Kick'),('Rumble'),('Facebook'),
         ('Instagram'),('OBS'),('TTS'),('dock.html'),('featured.html'),
         ('WebSocket'),('OAuth'),('settings'),('CSS'),('Electron'),
         ('Chrome Extension'),('Desktop App')
)
select term,
       (select count(*)
        from mined_threads
        where products_json like '%Social Stream%'
          and searchable_text like '%' || term || '%') as mined_threads
from terms
order by mined_threads desc;
```

Curated support-record sample:

```sql
select product_id,
       status_flags,
       substr(question_summary, 1, 180),
       substr(answer_summary, 1, 220)
from support_records
where product_id like 'social-stream%'
order by date_end desc
limit 25;
```

## First-Pass Frequency Results

`knowledge.sqlite` mined thread term counts for `products_json like '%Social Stream%'`:

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
| Kick | 138 |
| Chrome Extension | 122 |
| TTS | 68 |
| Facebook | 55 |
| Rumble | 46 |
| CSS | 40 |
| featured.html | 34 |
| Electron | 27 |
| Instagram | 25 |
| OAuth | 10 |

`stevesbot.sqlite` support-record term counts for `product_id like 'social-stream%'`:

| Term | Count |
| --- | ---: |
| WebSocket | 36 |
| YouTube | 33 |
| Twitch | 31 |
| settings | 27 |
| TikTok | 25 |
| OBS | 24 |
| dock.html | 16 |
| Desktop App | 16 |
| Kick | 14 |
| Chrome Extension | 13 |
| Facebook | 9 |
| TTS | 9 |
| Electron | 9 |
| Instagram | 8 |
| featured.html | 8 |
| CSS | 8 |
| OAuth | 7 |
| Rumble | 5 |

These counts are only rough indicators because one thread can mention many terms.

## Extraction Levels

Quick extraction:

- List the file/table and its purpose.
- Capture product filters, schema, and candidate terms.
- Record whether the source is curated, generated, raw, or mixed-product.

Heavy extraction:

- Extract repeated symptoms, setup mistakes, workarounds, and support wording.
- Separate SSN extension, SSN desktop app, OBS/browser source, and unrelated VDO.Ninja issues.
- Link each claim to a source family: current repo, curated support docs, SQLite summary, or raw archive.
- Move risky claims into `unresolved-or-stale-claims.md`.

Intense extraction:

- For high-volume or fragile areas, verify each support claim against current code/docs.
- Use raw archive only for anonymized frequency/symptom confirmation.
- Produce final-grade troubleshooting pages with current-version caveats.

## Claim Handling Rules

Use these labels while drafting:

- `current-source-backed`: verified in current `social_stream` or `ssapp` source/docs.
- `support-derived`: seen in support history but not yet source-checked.
- `historical`: tied to an older version, older platform state, or generated support output.
- `volatile-platform`: likely to change outside SSN control.
- `needs-verification`: do not promote to final user-facing docs yet.

Support material often contains old version numbers, stale UI names, and generated prose. Keep the user problem and troubleshooting shape, but re-check final wording against current source before presenting as current behavior.
