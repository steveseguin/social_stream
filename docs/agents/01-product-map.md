# SSN Product Map

Status: framework only. Detailed extraction not started.

## Purpose

This page explains what Social Stream Ninja is, what surfaces it includes, and how those surfaces fit together for live chat capture, dashboards, overlays, automation, TTS, and AI tools.

## Source Anchors

- `C:\Users\steve\Code\social_stream\README.md`
- `C:\Users\steve\Code\social_stream\about.md`
- `C:\Users\steve\Code\social_stream\docs\features.html`
- `C:\Users\steve\Code\social_stream\docs\ssapp.html`
- `C:\Users\steve\Code\ssapp\README.md`
- `C:\Users\steve\Code\stevesbot\resources\instructions\social-stream-support.md`

## Starter Notes

SSN has at least two primary delivery surfaces: the Chrome extension and the standalone Electron app. The extension captures chat from many platform pages through browser scripts. The standalone app wraps the same Social Stream source files inside Electron and adds app-specific source management, OAuth helpers, persistence behavior, and platform glue.

Public overlay/tool pages such as `dock.html`, `featured.html`, alert pages, games, TTS pages, and API examples are part of the same ecosystem. Some pages are shipped with the extension, some are hosted, and some are used by the app.

## Planned Sections

- What SSN does
- Chrome extension vs standalone app
- Hosted pages vs packaged pages
- OBS workflow overview
- Source windows, dashboard, featured overlay, and optional tools
- AI/cohost, TTS, Event Flow, and external integrations

## Open Questions

- Which related products should be included in this product map: Electron Capture, Caption.Ninja, VDO.Ninja bridge, or only SSN proper?
