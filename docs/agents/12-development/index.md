# Development Index

Status: heavy passes started for development repo map, shared-code rules, provider/shared utilities, testing, and release boundaries.

## Purpose

This section covers how agents should reason about SSN development work across the Chrome extension/web repo and the standalone Electron app.

## Pages

- `adding-a-source.md`: heavy extraction pass started.
- `repo-map.md`: heavy extraction pass started.
- `shared-code-rules.md`: heavy extraction pass started.
- `provider-cores-and-shared-utils.md`: provider-core files, shared utilities, web-accessible resources, and adapter boundaries.
- `testing-and-validation.md`: heavy extraction pass started.
- `build-and-release-boundaries.md`: heavy extraction pass started.

## Most Important Rules

- `social_stream` is the source of truth for Social Stream source behavior.
- `ssapp` is the Electron desktop wrapper and app-specific runtime/build repo.
- Do not treat `ssapp/resources/social_stream_fallback` as source.
- Keep shared browser-facing code Chrome 80 friendly unless Steve explicitly changes the baseline.
- Provider cores should stay environment-agnostic.
- Use focused tests/sanity checks honestly; app changes require real in-app/e2e validation before calling them tested.
- App release artifacts belong in `steveseguin/social_stream`, not `steveseguin/ssn_app`.

## Suggested Next Pass

- Build a file-by-file source map for all platform sources and top-level pages.
- Expand the manifest content-script/source-load matrix into a full 155-row public-site mapping.
- Inspect GitHub workflows for release automation and artifact handling.
- Create manual validation recipes for frequent support workflows.
