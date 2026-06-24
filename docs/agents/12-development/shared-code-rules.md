# Shared Code Rules

Status: heavy extraction pass started on 2026-06-24.

## Purpose

Document rules for code shared between the Chrome extension, Electron app, hosted pages, Lite pages, overlays, provider cores, and bridge/source pages.

## Source Anchors

- `social_stream/AGENTS.md`
- `social_stream/manifest.json`
- `social_stream/shared/**`
- `social_stream/providers/**`
- `social_stream/sources/websocket/**`
- `ssapp/preload.js`

## Compatibility Baseline

Browser-facing SSN code should stay old-school and Chrome 80 friendly unless Steve explicitly raises the baseline.

Avoid by default:

- `<script type="module">`
- top-level `import`
- top-level `export`
- newer syntax/APIs without a fallback

This applies especially to:

- overlay pages
- root HTML tool pages
- content scripts
- `sources/websocket/*`
- pages used by both extension and Electron

## Extension And Electron Shared Scripts

`sources/` and `sources/websocket/` scripts are shared between the Chrome extension and the Electron desktop app.

Shared source scripts should:

- feature-detect `chrome.runtime`
- avoid assuming `chrome.*` exists
- use Electron helpers such as `window.ninjafy` or `window.electronApi` only after checking they exist
- support URL-parameter configuration where existing pages do
- preserve message payload contracts

When loading shared helpers from content scripts, follow existing guarded dynamic import patterns:

- use `chrome.runtime.getURL(...)` when extension runtime exists
- use a relative fallback when running outside the extension

## Provider Core Rules

Provider cores under `providers/` should remain environment-agnostic.

They should not directly depend on:

- DOM APIs
- Chrome extension APIs
- Electron IPC
- specific overlay pages

Instead:

- keep transports in adapters
- pass logging as optional callbacks/options
- keep returned data plain JSON where possible
- avoid side effects that make tests or app/extension reuse harder

Examples called out by repo instructions:

- `providers/twitch/chatClient.js`
- `providers/kick/core.js`
- `providers/youtube/liveChat.js`

## Shared Utility Placement

Use `shared/` for cross-surface utilities.

When adding shared utilities:

1. Put reusable code under `shared/`.
2. Update `manifest.json` `web_accessible_resources` if extension pages/content scripts need to load it.
3. Ensure hosted/Lite deployment serves the same shared path next to consumers.
4. Keep old browser compatibility in mind.

Lite pages under `lite/` are deployed independently from extension/Electron bundles. If they import `../../shared/...`, that `shared/**` path must also be deployed/served alongside Lite.

## No Remote Executable Code In Extension Package

The extension package should keep executable code self-contained.

Do not add:

- static CDN script tags such as `<script src="https://...">`
- remote JS imports such as `import("https://...")`
- remote WASM imports
- `from "https://..."` module imports

If a third-party executable dependency is approved, vendor it locally under paths such as:

- `thirdparty/`
- `shared/vendor/`
- `lite/vendor/`

Remote fetches may load data/resources such as JSON, API responses, images, and static media assets, but not executable logic.

## Manifest Rules

The MV3 manifest exposes specific shared/provider files through `web_accessible_resources`, including:

- provider cores
- `shared/utils/scriptLoader.js`
- `shared/utils/html.js`
- Twitch emote helpers
- shared AI/browser model helpers
- vendored local socket/tmi files

When content scripts need a helper, the helper must be reachable from the extension context. Forgetting the manifest update can make a feature work in local hosted pages but fail inside the packaged extension.

## Payload Contract Rules

Outbound events follow the canonical shape referenced in:

```text
docs/event-reference.html
```

Keep standard fields intact:

- `platform`
- `type`
- `chatname`
- `chatmessage`
- `chatimg`
- `chatbadges`
- `backgroundColor`
- `textColor`
- `hasDonation`
- `membership`
- `contentimg`
- `event`
- `meta`

Additional non-standard details should go inside top-level `meta` as plain JSON.

Avoid ad-hoc top-level keys unless the event reference and downstream consumers are updated.

## Overlay Rules

Most overlays receive traffic by:

- hidden VDO.Ninja iframe bridge
- WebSocket connection

Common receive shape:

```javascript
event.data?.dataReceived?.overlayNinja
```

Overlay code should treat traffic as mixed:

- ordinary chat
- alert-like events
- meta-only updates
- command/control payloads for tool pages

For styling, prefer:

- URL-driven CSS (`css`, `b64css`)
- CSS variables
- class toggles
- payload-compatible filtering

Do not change payload shape just to style a single overlay.

## When To Update Docs

Update `docs/event-reference.html` when:

- a source adds an event type
- a source renames event fields
- payload shape changes
- `meta` content becomes part of a downstream contract

Update custom overlay docs when:

- the recommended iframe/WebSocket pattern changes
- new common URL params are added
- a new shared helper changes overlay best practices

## Remaining Extraction Targets

- Trace representative dynamic import patterns in `sources/websocket/twitch.js`, Kick bridge files, and YouTube provider loaders.
- Produce a manifest update checklist for adding a shared helper.
- Add examples of safe provider-core interfaces from current code.
