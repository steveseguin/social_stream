# Support Source Map

Status: framework plus repo-backed FAQ baseline and first historical support-mining pass.

## Purpose

Map each `stevesbot` support source to the kind of SSN documentation it can inform.

## Source Anchors

- `stevesbot/resources/instructions/social-stream-support.md`
- `stevesbot/resources/learnings/social-stream-ninja-top-issues.md`
- `stevesbot/resources/learnings/support-qa/social-stream-*.md`
- `stevesbot/resources/learnings/playbooks/*`
- `stevesbot/data/sqlite/*.sqlite`

## Starter Notes

The useful support sources are mixed with unrelated product material. This page should keep the SSN-relevant support map explicit.

`common-questions.md` now contains a repo-backed support baseline from current public docs, API docs, parameter docs, custom script templates, site metadata, and platform agent pages. It should not be treated as mined support history yet.

Historical support mining has started in `mining-method.md`, `historical-issues.md`, `unresolved-or-stale-claims.md`, and `10-troubleshooting/platform-known-issues.md`. Support-derived facts remain secondary to current source.

## Current Baseline Outputs

- `common-questions.md`: current repo-backed FAQ and triage answers.
- `10-troubleshooting/quick-triage.md`: first-response support flow.
- `08-platform-sources/*.md`: platform-specific setup/support notes for extracted platforms.
- `mining-method.md`: safe support-mining method, DB schemas, counts, query recipes, and first term-frequency tables.
- `historical-issues.md`: recurring support categories and candidate docs impact.
- `unresolved-or-stale-claims.md`: claim register for old, volatile, or unverified advice.
- `10-troubleshooting/platform-known-issues.md`: platform support matrix.

## Source Map

| Source | Type | SSN value | Current status |
| --- | --- | --- | --- |
| `stevesbot/resources/instructions/social-stream-support.md` | curated support instruction | Current support style, first checks, escalation guidance, platform caveats. | heavy-started |
| `stevesbot/resources/instructions/drafter-context.md` | curated bot context | Product boundary and drafting context. | quick-started |
| `stevesbot/resources/learnings/social-stream-ninja-top-issues.md` | generated support summary | Top recurring SSN issues from summarized support threads. | heavy-started |
| `stevesbot/resources/learnings/unresolved-analysis.md` | generated unresolved summary | Repeated unresolved categories and possible product/doc gaps. | heavy-started |
| `stevesbot/resources/learnings/pipeline-analysis.md` | support-bot analysis | Missing KB areas and confidence-gap notes. | heavy-started |
| `stevesbot/resources/learnings/cross-product-integration-guide.md` | generated playbook | Product boundaries: VDO.Ninja, SSN, OBS, Electron Capture. | heavy-started |
| `stevesbot/resources/learnings/playbooks/playbook-obs-overlay-issues.md` | playbook | OBS/browser-source and SSN overlay triage. | heavy-started |
| `stevesbot/resources/learnings/playbooks/playbook-tiktok-connection.md` | playbook | TikTok mode and breakage triage. | heavy-started |
| `stevesbot/resources/learnings/playbooks/triage-macros.md` | macros | Reusable support branches for TikTok and blank overlays. | quick-started |
| `stevesbot/resources/learnings/support-qa/social-stream-configuration.md` | Q&A export | Setup/install/configuration and parameter reminders. | heavy-started |
| `stevesbot/resources/learnings/support-qa/social-stream-qa.md` | Q&A export | Broad historical SSN questions and answers. | heavy-started |
| `stevesbot/resources/learnings/support-qa/social-stream-qa-expanded.md` | Q&A export | Expanded historical platform and feature Q&A. | heavy-started |
| `stevesbot/data/sqlite/knowledge.sqlite` | SQLite summary DB | 2,264 mined threads with product/category/platform fields and summaries. | heavy-started |
| `stevesbot/data/sqlite/stevesbot.sqlite` | SQLite curated support DB | 499 support records and 358 generated Q&A entries. | heavy-started |
| `stevesbot/data/sqlite/archive.sqlite` | SQLite raw archive DB | 47,600 archived messages for anonymized confirmation only. | quick-started |
| `stevesbot/resources/knowledge.sqlite` | SQLite DB | Alternate/older knowledge store. | not-started |

## Pending Support Mining

- Deep-query high-frequency SQLite topics by platform/mode after current source pages are expanded.
- Source-check stale claims before moving them into final docs.
- Use raw archive only for anonymized frequency confirmation.
- Add file-level source links after intense passes through specific source files.
