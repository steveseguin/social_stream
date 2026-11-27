# Development Index

Status: heavy passes started for development repo map, shared-code rules, provider/shared utilities, testing, test assets, focused validation evidence, TikTok app test routing, and release boundaries.

## Purpose

This section covers how agents should reason about SSN development work across the Chrome extension/web repo and the standalone Electron app.

## Pages

- `adding-a-source.md`: heavy extraction pass started.
- `repo-map.md`: heavy extraction pass started.
- `shared-code-rules.md`: heavy extraction pass started.
- `provider-cores-and-shared-utils.md`: provider-core files, shared utilities, web-accessible resources, and adapter boundaries.
- `testing-and-validation.md`: heavy extraction pass started.
- `test-asset-matrix.md`: existing Node tests, browser fixtures, Playwright scripts, npm aliases, app TikTok regression assets, setup assumptions, and feature-to-test routing.
- `../18-focused-validation-evidence-log.md`: focused non-runtime validation evidence, currently including settings config JSON, Event Flow, Twitch provider, AI prompt builder, AI moderation, local model registry, provider fallback, local TTS, local AI asset, and RAG fixture tests.
- `build-and-release-boundaries.md`: heavy extraction pass started.

## Most Important Rules

- `social_stream` is the source of truth for Social Stream source behavior.
- `ssapp` is the Electron desktop wrapper and app-specific runtime/build repo.
- Do not treat `ssapp/resources/social_stream_fallback` as source.
- Before adding a first-class source file, use `../13-reference/customization-path-decision-matrix.md` to rule out simpler URL/CSS, custom overlay, API/WebSocket, Event Flow, or local custom-hook paths.
- Keep shared browser-facing code Chrome 80 friendly unless Steve explicitly changes the baseline.
- Provider cores should stay environment-agnostic.
- Use focused tests/sanity checks honestly; app changes require real in-app/e2e validation before calling them tested.
- App release artifacts belong in `steveseguin/social_stream`, not `steveseguin/ssn_app`.

## Suggested Next Pass

- Add quick extraction notes for inventory-only source files and top-level pages.
- Curate the generated manifest row matrix into an exact public-site mapping with support status.
- Inspect GitHub workflows for release automation and artifact handling.
- Keep `test-asset-matrix.md` current when test scripts or npm aliases change.
- Create manual validation recipes for frequent support workflows.
- Runtime-validate app TikTok connector flows from `../08-platform-sources/tiktok-standalone-app.md` before treating them as tested.
