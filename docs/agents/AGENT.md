# SSN AI Documentation Agent Brief

This folder is a temporary, AI-focused documentation workspace for Social Stream Ninja. It is not a release artifact, not a ZIP package, and should not be treated as end-user website docs unless Steve later asks for that.

## Scope

Create exhaustive markdown documentation for:

- Social Stream Ninja Chrome extension in `C:\Users\steve\Code\social_stream`
- Social Stream Ninja standalone Electron app in `C:\Users\steve\Code\ssapp`
- Shared behavior between the extension and app, especially source scripts, overlays, sessions, APIs, settings, and troubleshooting
- Support knowledge from `C:\Users\steve\Code\stevesbot`, filtered to SSN-related material

## Write Boundary

Only write inside:

`C:\Users\steve\Code\social_stream\docs\agents`

Do not edit project code, public docs, generated docs, release files, app files, or support bot files while building this documentation set unless Steve explicitly changes the scope.

## Source Priority

Use sources in this order:

1. Current code in `social_stream` and `ssapp`
2. Existing repo docs in `social_stream`, especially `README.md`, `api.md`, `parameters.md`, `docs/event-reference.html`, `docs/customoverlays.md`, `docs/ssapp.html`, `docs/tiktok-guide.html`, `docs/local-tts.html`, and `docs/tts.html`
3. Current app docs in `ssapp`, especially `README.md`, `RELEASE.md`, and test files that document expected behavior
4. Curated support material in `stevesbot/resources/instructions` and `stevesbot/resources/learnings`
5. SQLite summaries in `stevesbot/resources/knowledge.sqlite`, `stevesbot/data/sqlite/knowledge.sqlite`, and `stevesbot/data/sqlite/stevesbot.sqlite`
6. Raw Discord archive data only when needed to confirm real-world symptoms, wording, or frequency

## Exclusions

Do not use or document from:

- `C:\Users\steve\Code\ssapp\resources\social_stream_fallback`
- `C:\Users\steve\Code\stevesbot\resources\secrets`
- Non-SSN support content unless it directly clarifies an SSN integration
- Raw private support identities unless they are needed as anonymized examples

## Documentation Style

Write for future AI agents first, but keep the content usable by humans. Prefer factual, source-backed notes over generic guidance.

Each topic page should include:

- Purpose
- Where the relevant code and docs live
- How the feature works
- How users set it up
- Common failure modes
- Troubleshooting steps
- Known differences between Chrome extension and standalone app
- Open questions or areas needing deeper review

When support data conflicts with current code, mark it as historical and verify against source before turning it into current guidance.

## Current First Pass

The starting inventory and proposed file structure are in:

`docs/agents/00-inventory-and-plan.md`

Use these before starting any extraction pass:

- `docs/agents/01-extraction-checklist.md`
- `docs/agents/02-resource-manifest.md`

The first source-backed backbone pages are:

- `docs/agents/03-extension-architecture.md`
- `docs/agents/04-standalone-app-architecture.md`
- `docs/agents/05-message-flow-and-event-contracts.md`
- `docs/agents/06-settings-sessions-and-storage.md`
- `docs/agents/10-troubleshooting/quick-triage.md`

These are orientation-grade, not final. Treat them as the base map for deeper platform, API, settings, and support-KB extraction.
