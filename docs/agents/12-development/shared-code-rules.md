# Shared Code Rules

Status: framework only. Detailed extraction not started.

## Purpose

Document rules for code shared between extension, app, hosted pages, and standalone web surfaces.

## Source Anchors

- `social_stream/AGENTS.md`
- `social_stream/shared/**`
- `social_stream/providers/**`
- `social_stream/sources/websocket/**`
- `ssapp/preload.js`

## Starter Notes

Repo instructions say shared source scripts must work in both Chrome extension and Electron app contexts. Provider cores should remain environment agnostic.

## Planned Sections

- Chrome 80 compatibility
- No remote executable code in extension package
- Dynamic import patterns
- Provider core boundaries
- Shared utility placement
- Manifest/web-accessible resources
