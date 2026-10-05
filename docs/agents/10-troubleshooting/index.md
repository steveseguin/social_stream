# Troubleshooting Index

Status: framework plus diagnostic decision tree, quick triage, extension capture, OBS overlay, desktop app, app source-window parity, TikTok app connector routing, auth, settings/backup, support answer bank, and support-mined platform known-issue passes.

## Purpose

This section converts code, docs, tests, and support history into practical troubleshooting pages.

## Pages

- `quick-triage.md`: backbone extraction pass complete.
- `diagnostic-decision-tree.md`: symptom-to-branch routing for capture, routing, display, control, app/auth, settings, and customization failures.
- `extension-not-capturing.md`: heavy extraction pass started.
- `desktop-app-issues.md`: heavy extraction pass started.
- `../04-standalone-app-source-windows.md`: app source-window lifecycle, custom session, injection, and app-vs-extension parity routing.
- `../08-platform-sources/tiktok-standalone-app.md`: app-specific TikTok connector modes, signing, fallbacks, replies, event families, test assets, and support triage.
- `auth-and-sign-in.md`: heavy extraction pass started.
- `obs-overlay-display.md`: heavy extraction pass started.
- `settings-loss-and-backups.md`: heavy extraction pass started.
- `platform-known-issues.md`: heavy support extraction pass started.

## Suggested Next Pass

- Use `11-support-kb/support-answer-bank.md` when turning troubleshooting findings into short user-facing replies.
- Use `diagnostic-decision-tree.md` when the symptom is vague or when it is unclear whether the problem is capture, routing, display, control, app/auth, settings, or customization.
- Intense-check desktop source-window lifecycle, hidden/visible behavior, auto-activate, reconnect logic, and TikTok app connector behavior against `../04-standalone-app-source-windows.md` and `../08-platform-sources/tiktok-standalone-app.md`.
- Intense extraction for extension export/import behavior and Event Flow storage.
- Intense extraction for OAuth scopes and event availability per platform.
- Source-check `platform-known-issues.md` against current platform files and app handlers.
- Intense support-history pass against `stevesbot` SQLite files.
