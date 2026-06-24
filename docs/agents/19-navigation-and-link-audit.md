# Navigation And Link Audit

Status: focused docs-navigation audit recorded on 2026-06-24.

## Purpose

Use this page to verify that the growing `docs/agents` documentation set is discoverable and that agent-doc references are not drifting into broken or ambiguous links.

This is a documentation hygiene audit. It is not product runtime validation and does not prove that commands, settings, platform sources, overlays, the standalone app, OBS, or provider integrations work.

## Scope

Audited path:

- `C:\Users\steve\Code\social_stream\docs\agents`

Audited files:

- Markdown files under `docs/agents`, including section indexes, support KB files, reference files, validation logs, and templates.

Not audited as broken links:

- Intentional references to source files outside `docs/agents`.
- Intentional references to `social_stream`, `ssapp`, or `stevesbot` resources.
- Wildcard references such as `docs/agents/08-platform-sources/*.md`; these are routing shorthand, not exact file links.
- Product runtime pages, rendered HTML, hosted docs, browser behavior, or external URLs.

## 2026-06-24 Result

Read-only inline Node audit result:

```text
totalMarkdown: 164
orphanishCount: 0
localBrokenCount: 0
ambiguousBareSectionIndexCount: 0
wildcardAgentRefCount: 49
```

Interpretation:

- Every non-template agent Markdown file had at least one inbound reference, excluding intentional root entry files.
- No agent-scoped exact Markdown reference resolved to a missing `docs/agents` file.
- Bare ambiguous section-index filenames were cleaned up and no longer appear in the narrowed audit.
- Wildcard references remain by design where a doc points to a section family rather than one exact file.
- Root `docs/agents/SITEMAP.md` and per-section `docs/agents/*/SITEMAP.md` files are included in the audit and resolve through explicit agent-doc links.

Browser smoke result:

```text
viewer: docs/index.html
default doc: SSN AI Documentation Index loaded
deep link: agents/13-reference/customization-source-trace.md loaded
section sitemap link: agents/13-reference/workflow-setup-decision-tree.md loaded from Reference SITEMAP
sidebar filter: applied and hid non-matching rows
consoleErrors: 0
```

This proves the static Markdown viewer can load and route local docs from static hosting. It does not validate product behavior, external links, source-file links, or every heading anchor.

## Cleanup Performed

The audit found six ambiguous bare section-index filename references before cleanup. They were replaced with explicit paths:

- `docs/agents/01-extraction-checklist.md`: changed a pass-log output from a bare section-index filename to `07-overlays-and-pages/index.md`.
- `docs/agents/11-support-kb/common-questions.md`: changed first-stop routing to `docs/agents/11-support-kb/index.md`.
- `docs/agents/11-support-kb/question-intent-router.md`: changed support section map routing to `docs/agents/11-support-kb/index.md`.
- `docs/agents/11-support-kb/support-answer-bank.md`: changed fallback support routing to `docs/agents/11-support-kb/index.md`.
- `docs/agents/11-support-kb/support-intake-templates.md`: changed first-answer routing to `docs/agents/11-support-kb/index.md`.
- `docs/agents/11-support-kb/support-source-map.md`: changed current baseline output from a bare section-index filename to `docs/agents/11-support-kb/index.md`.

The static docs viewer pass also added `docs/agents/SITEMAP.md` plus one `docs/agents/*/SITEMAP.md` in every immediate `docs/agents` subfolder. Section sitemap file links were rewritten with explicit folder paths such as `../13-reference/index.md` so agents and audits do not confuse repeated local section-index filenames.

## Known Non-Failures

The audit reports wildcard references separately. Current wildcard references include section-family shortcuts such as:

- `docs/agents/07-overlays-and-pages/*.md`
- `docs/agents/08-platform-sources/*.md`
- `docs/agents/09-api-and-integrations/*.md`
- `docs/agents/10-troubleshooting/*.md`
- `docs/agents/11-support-kb/*.md`
- `docs/agents/12-development/*.md`
- `docs/agents/13-reference/*.md`
- `docs/agents/*/SITEMAP.md`
- Support-refresh globs such as `qa-export-*.json` and `social-stream-*.md`.

These should not be treated as broken file references unless a future rule requires replacing all wildcard section shorthand with concrete section indexes.

## Recheck Recipe

Use a read-only script that:

1. Enumerates every `*.md` file under `docs/agents`.
2. Counts inbound references by exact relative path, backslash-normalized path, or unique basename.
3. Exempts root entry files such as `AGENT.md`, `99-agent-index.md`, and `00-inventory-and-plan.md` from inbound-reference requirements.
4. Parses Markdown links and backtick references ending in `.md`.
5. Treats `docs/agents/...` paths and in-folder relative paths as agent-doc references.
6. Ignores source/support/product references outside `docs/agents`.
7. Separates wildcard references from broken exact links.
8. Reports bare section-index filename references as ambiguous because multiple section indexes exist.

Record future results here when the docs tree grows significantly, new section indexes are added, or many pages are renamed.

## Remaining Gaps

- This does not check rendered Markdown links in a browser or docs site.
- This does not validate heading anchors after `#fragment` links.
- This does not validate external URLs or links to current source files outside `docs/agents`.
- This does not enforce a canonical relative-link style; many docs intentionally use repo-root-style paths for agent readability.
- This does not replace content coverage audits in `15-objective-coverage-and-readiness-audit.md` or runtime validation evidence in `17-runtime-validation-evidence-log.md`.
