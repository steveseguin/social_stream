# Stevesbot Resource Inventory

Status: quick/heavy resource classification pass started on 2026-06-24.

## Purpose

Use this page before mining `C:\Users\steve\Code\stevesbot` for SSN docs. It classifies the support archive into safe curated sources, derivative summaries, raw/private evidence, and skip groups so agents do not repeatedly scan the same large trees or promote stale/private data into current SSN answers. Use `support-history-refresh-playbook.md` for the exact repeatable refresh workflow and query pack.

This is a resource-control page, not a final troubleshooting page.

## Hard Rules

- Write only inside `C:\Users\steve\Code\social_stream\docs\agents`.
- Do not read `stevesbot/resources/secrets`.
- Do not paste raw support conversations, private server/channel names, personal details, attachment contents, tokens, session IDs, webhook URLs, OAuth values, or API keys into docs.
- Treat current `social_stream` and `ssapp` source as higher priority than any historical support answer.
- Treat generated support answers as leads, not as current truth.
- Use raw transcripts, replays, attachments, and archive tables only for anonymized frequency/symptom confirmation when curated summaries are insufficient.

## Directory Snapshot

Checked on 2026-06-24.

| Path | Files | Approx Bytes | Depth | Use |
| --- | ---: | ---: | --- | --- |
| `data/sqlite` | 32 | 961 MB | quick/heavy mixed | Current summary DBs plus many manual-curation backups. Use current DB files first; skip backups unless current DB is missing. |
| `data/mined-threads` | 214 | 116 MB | inventory-only | JSONL mined thread batches and progress files. Prefer `data/sqlite/knowledge.sqlite` for summaries. |
| `data/transcripts` | 889 | 7.9 MB | raw/private | Raw Discord thread exports. Use only for anonymized confirmation after curated sources fail. |
| `data/exports` | 16 | 52.9 MB | quick-started | Periodic Q&A JSON exports. Latest export inspected for shape/counts. Treat as generated and sometimes route-misaligned. |
| `data/imports` | 807 | 33.3 MB | inventory-only | Mixed imported OpenClaw insight material, much of it VDO/general support. Use only selected SSN-specific files after source-checking. |
| `data/replays` | 85 | 37 MB | raw/private | Replay snapshots and replay SQLite files. Use only for narrow validation, not broad docs. |
| `data/attachments` | 1,382 | 303 MB | skip by default | Screenshots/uploads. Do not inspect unless an exact support claim requires visual confirmation and privacy can be preserved. |
| `data/backups` | 9 | 734 MB | skip | Backup DBs. Use only if current DB is missing/corrupt. |
| `data/finetune` | 3 | 3.6 MB | skip by default | Training/export artifacts, not needed for current docs unless Steve asks. |
| `logs` | not counted | not counted | skip | Runtime/mining logs. Avoid unless debugging the mining pipeline itself. |
| `resources/secrets` | not counted | not counted | skip | Explicitly excluded secret material. |

Zero-byte top-level DB stubs in `data` are not useful extraction sources.

## Curated Resource Files

These are the safest support-history inputs because they are already summarized or intentionally authored.

| Source | Depth | Current Use |
| --- | --- | --- |
| `resources/instructions/social-stream-support.md` | heavy-started | Support stance, first checks, escalation tone, platform caveats. |
| `resources/instructions/drafter-context.md` | quick-started | General support drafting context and product boundaries. |
| `resources/learnings/social-stream-ninja-top-issues.md` | heavy-started | Recurring SSN support themes. |
| `resources/learnings/unresolved-analysis.md` | heavy-started | Unresolved clusters and likely doc/product gaps. |
| `resources/learnings/pipeline-analysis.md` | heavy-started | Support-bot confidence gaps and missing KB areas. |
| `resources/learnings/cross-product-integration-guide.md` | heavy-started | Boundaries among SSN, OBS, VDO.Ninja, and Electron Capture. |
| `resources/learnings/product-notes/social-stream-architecture.md` | quick-started | Generated architecture/API summary. Useful as orientation only; it can contain stale version numbers. |
| `resources/learnings/playbooks/playbook-obs-overlay-issues.md` | heavy-started | OBS/browser-source and overlay triage. |
| `resources/learnings/playbooks/playbook-tiktok-connection.md` | heavy-started | TikTok support triage. |
| `resources/learnings/playbooks/triage-macros.md` | quick/heavy-started | Macro-style support routing, mixed breadth; SSN-relevant safe intake, blank overlay, TikTok, and escalation pieces summarized in `support-macro-routing.md`. |
| `resources/learnings/playbooks/rapid-response-decision-tree.md` | quick/heavy-started | Support triage routing, safety gate, SSN overlay/TikTok branch, and escalation matrix summarized in `support-macro-routing.md`. |
| `resources/learnings/playbooks/rapid-macros-wave3.md` | quick/heavy-started | Macro reuse candidates for overlay blank, TikTok blank, Twitch auth, transparent overlay, and platform-change wording summarized in `support-macro-routing.md`. |
| `resources/learnings/playbooks/escalation-prompts-wave3.md` | quick/heavy-started | Safe refusal, redacted evidence, and escalation packet wording summarized in `support-macro-routing.md`. |
| `resources/learnings/playbooks/playbook-audio-mic-routing.md` | inventory-only | Mostly audio/mic routing; only mine if a TTS/OBS audio question needs it. |
| `resources/learnings/support-qa/social-stream-configuration.md` | heavy-started | Setup/configuration Q&A patterns. |
| `resources/learnings/support-qa/social-stream-qa.md` | heavy-started | Broad historical SSN Q&A. |
| `resources/learnings/support-qa/social-stream-qa-expanded.md` | heavy-started | Expanded SSN Q&A and platform/feature leads. |

Skip by default unless a cross-product boundary question needs them:

- `resources/instructions/vdo-ninja-support.md`
- `resources/instructions/raspberry-ninja-support.md`
- `resources/learnings/vdo-ninja-top-issues.md`
- `resources/learnings/support-qa/vdo-ninja-*.md`
- `resources/learnings/support-qa/discord-vdo-ninja-faq.md`
- `resources/learnings/product-notes/*` except SSN-specific or direct integration context

## SQLite Databases

| Source | Depth | Checked Facts | Use |
| --- | --- | --- | --- |
| `data/sqlite/knowledge.sqlite` | heavy-started | `mined_threads` = 2,264 rows in previous pass. | Primary summarized mined-thread DB. Use topic/category/platform queries. |
| `resources/knowledge.sqlite` | quick-started | Same `mined_threads` schema; `mined_threads` = 2,254 rows. | Alternate/older resource copy. Use only if comparing drift or if main DB is unavailable. |
| `data/sqlite/stevesbot.sqlite` | heavy-started | `support_records` = 499; `qa_entries` = 358 in previous pass. | Curated support records and generated Q&A. Filter to `social-stream%` and source-check. |
| `data/sqlite/archive.sqlite` | quick-started | `archived_messages` = 47,600 in previous pass. | Raw archive. Use only for anonymized frequency/symptom language. |
| `data/sqlite/knowledge.sqlite.manual-*.bak` | skip | Many manual curation backups. | Do not mine unless current DB is missing/corrupt. |
| `data/backups/*.sqlite*` | skip | Backup DB copies. | Do not mine unless current DB is missing/corrupt. |

## QA Export Snapshots

Latest checked file:

- `data/exports/qa/qa-export-2026-06-21T09-00-01.json`

Observed top-level shape:

- `exportedAt`
- `sinceDate`
- `counts`
- `approvedRuns`

Observed latest counts:

| Field | Count |
| --- | ---: |
| `approvedRuns` | 344 |
| `supportRecords` | 487 |
| `minedThreads` | 2,244 |

Use rule:

- Prefer the latest export only if the database tables are unavailable or if a snapshot-style approved-answer review is needed.
- Do not trust `routeId` alone. Some SSN-looking entries can appear under broader support routes.
- Expect generated-answer artifacts, old version references, and encoding/mojibake issues. Source-check before reuse.
- Do not paste full Q&A answers into docs; summarize patterns and verification targets.

## Mined JSONL, Transcripts, Replays, And Attachments

These are raw or near-raw support evidence. They are useful for volume and symptom language, but they are not safe final documentation sources.

| Source Group | Depth | Use |
| --- | --- | --- |
| `data/mined-threads/threads-*.jsonl` | inventory-only | Candidate future source for date-bucketed mined summaries. Prefer SQLite first. |
| `data/mined-threads/progress-*.json` | inventory-only | Mining progress/checkpoint files. Usually not useful for docs. |
| `data/transcripts/**/*.jsonl` | raw/private | Raw Discord exports. Only use for anonymized confirmation of a narrow support pattern. |
| `data/replays/**` | raw/private | Replay captures and replay DBs. Only use for controlled validation or exact regression context. |
| `data/attachments/**` | skip by default | Screenshots and uploads. Do not inspect broadly or copy into docs. |

Do not list every raw transcript or attachment file in agent docs. Track the directory group, count, and extraction depth instead.

## Imported OpenClaw Material

`data/imports/openclaw/insights` is mixed historical/imported material. It includes support process docs, VDO-focused artifacts, generated reports, and some SSN-adjacent files.

Candidate future quick-pass files:

- `data/imports/openclaw/insights/social-stream-hardening-plan.md`
- `data/imports/openclaw/insights/social-adapter-testpack-wave3.md`
- `data/imports/openclaw/insights/support-knowledge-graph.md`
- `data/imports/openclaw/insights/support-knowledge-graph.json`
- `data/imports/openclaw/insights/support-gap-priority.md`
- `data/imports/openclaw/insights/support-signal-upgrade.md`

Rules:

- Treat these as historical/generated leads.
- Do not use VDO.Ninja findings as SSN facts unless the integration boundary is explicit.
- Do not mine execution-pack logs, copied runtime assets, or generated probe files for SSN support docs unless a specific validation target requires them.

## Recommended Extraction Order

1. Start with current `social_stream` and `ssapp` source/docs.
2. Use curated SSN support instruction and learning markdown files.
3. Query `data/sqlite/knowledge.sqlite` and `data/sqlite/stevesbot.sqlite` for product-filtered summaries.
4. Use latest QA export only when a snapshot of generated approved answers is useful.
5. Use raw transcript/replay/archive material only for anonymized confirmation.
6. Record every new quick/heavy/intense pass in `01-extraction-checklist.md` and update this inventory if a resource group changes depth.

## Good Queries To Add Later

- Product-filtered category counts from `knowledge.sqlite`.
- Platform-by-platform unresolved count from `knowledge.sqlite`.
- Latest `support_records` by `social-stream%` route, redacted and summarized.
- SSN-specific `approvedRuns` from the latest QA export, grouped by triage category.
- Comparison of `data/sqlite/knowledge.sqlite` versus `resources/knowledge.sqlite` drift.
- OpenClaw SSN-specific insights, filtered to files whose names include `social`, `stream`, `support`, or `adapter`.
