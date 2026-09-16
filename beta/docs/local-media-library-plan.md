# Local Media Library and Flow Actions Plan

## Problem Statement

Event Flow currently treats media as a URL:

- `Play Audio Clip` stores `config.audioUrl`.
- `Display Media Overlay` stores `config.mediaUrl`.
- The Upload buttons send files to `fileuploads.socialstream.ninja` and save the returned HTTPS URL.
- Event Flow forwards that URL to `actions.html`, which loads it as audio, an image, or an iframe.

This works well for hosted media but does not provide real local-file support.

A hosted `https://socialstream.ninja/actions.html` page cannot reliably read `file://` paths. Current browsers may also block a hosted page from reaching a loopback HTTP media server. The standalone app's existing local server is a WebSocket relay on port 3000; it does not serve arbitrary files or a local copy of Flow Actions. The browser extension also cannot expose arbitrary disk files to OBS by itself.

The result is that users must either upload their media, manually run a local web server, or manage matching local copies of `actions.html` and their media.

## Solution Statement

Add an app-managed **Local Media Library** that serves an approved local copy of `actions.html` and approved media files from the same loopback HTTP origin.

Users should be able to select a local file from Event Flow, receive a stable local asset reference, and copy one generated Flow Actions URL into OBS. The desktop app or a small headless SSN Media Bridge owns file access and local serving; Event Flow and the browser extension never receive unrestricted filesystem access.

The first implementation should target the standalone desktop app. Extension users can gain the same capability later by running the desktop app or Media Bridge in companion mode.

## Objectives and Scope

The first release should deliver the complete local-media workflow in the standalone app while keeping the Event Flow data model and UI portable to the Chrome extension.

In scope for the first release:

- A secure loopback server and persistent media registry owned by `ssapp`.
- Shared Event Flow controls and action payload handling owned by `social_stream`.
- A local Flow Actions URL that uses the user's existing session and transport settings.
- Existing URL and hosted-upload behavior in both the app and extension.
- A clear unavailable/companion-required state when Local File is shown outside the app.

Not required for the first release:

- Arbitrary filesystem access from the extension.
- LAN media serving.
- A separately installed headless bridge.
- Portable media bundles. Bundling remains a later phase after the registry and import/relink model are proven.

## Confirmed Current Constraints

- Event Flow media properties are URL inputs in `actions/EventFlowEditor.js`.
- `actions/EventFlowSystem.js` sends the configured URL unchanged to the `actions` target.
- `actions.html` creates an `Audio`, `img`, or `iframe` using that URL.
- The desktop media picker in `ssapp/resources/electron-media-upload-handler.js` opens the hosted upload service.
- The desktop app already has native file-dialog handling and an approved-path sandbox that can be reused.
- The desktop app's `WebSocketServer` is transport-only and should not be presented as a media server.
- The shared Event Flow code already detects standalone versus extension contexts and can use a capability adapter without forking the editor.
- `actions.html` loads relative dependencies such as `thirdparty/obs-websocket.min.js` and `tts.js`; authentication must cover those requests as well as the HTML and media routes.
- The extension currently has broad HTTP host permissions, but Chrome loopback/private-network rules, CORS, bridge authentication, and store-review implications still need runtime validation before companion support is promised.

## Repository Ownership

Keep the feature split along the existing source-of-truth boundary:

- `C:\Users\steve\Code\ssapp`: registry persistence, native dialogs, approved-path checks, loopback HTTP serving, token storage, server lifecycle, and narrow preload/IPC methods.
- `C:\Users\steve\Code\social_stream`: Event Flow editor UI, shared local-asset schema, action dispatch, `actions.html` playback/resolution, extension unavailable/companion states, exports/imports, tests, and public documentation.

Do not implement Social Stream changes in `ssapp/resources/social_stream_fallback`. That directory is only populated by the normal build/update process after the source changes land in `social_stream`.

## Proposed User Experience

### Event Flow

Media actions show three choices:

1. **URL** — keep the current URL field.
2. **Upload** — keep the current hosted upload workflow.
3. **Local File** — open the Local Media Library picker.

The same editor code should render in both products. It queries a small local-media capability API:

- In the standalone app, Local File is enabled and opens the native-backed library/picker.
- In the extension without a paired bridge, Local File remains visible but disabled or opens an explanation that the desktop app/bridge is required.
- In a future paired extension, the same control uses the bridge adapter and returns the same asset-reference shape.

After selecting a local file, the node shows:

- File name and media type.
- Available, missing, or server-offline status.
- Preview/Test button.
- Replace or Relink button.
- Reveal in Folder button in the desktop app.

### Desktop App

Add a **Local Media Library** screen or modal, reachable from Event Flow and the standalone app, with:

- Add Files and Add Folder controls.
- Searchable audio, image, GIF, and video list.
- Preview, rename display label, relink, and remove controls.
- Server status and selected port.
- **Copy Local Flow Actions URL** button for OBS.
- Clear warning when the server is stopped or OBS is using the hosted Flow Actions URL.

Example generated OBS URL:

```text
http://127.0.0.1:3001/RANDOM_TOKEN/actions.html?session=YOUR_SESSION
```

The final generated URL must preserve the connection mode required by the current setup, such as the hosted relay defaults or `localserver` when the user is using the app's local WebSocket relay. It must not assume that every app user uses the same transport.

Raw disk paths should not appear in exported flows or action payloads.

## Proposed Technical Design

### 1. Local Media Registry

Store a registry in the desktop app using opaque asset IDs:

```json
{
  "id": "asset_f3a8...",
  "displayName": "Booty",
  "fileName": "booty.mp3",
  "mediaType": "audio",
  "approvedPath": "app-owned private value",
  "size": 248193,
  "modifiedAt": 1783872000000
}
```

The path stays in desktop app storage. Event Flow stores only the asset ID, display name, and optional fallback URL.

Asset IDs are stable within one library installation. Relinking updates the private path without changing the ID, so existing flows continue to work. A later bundle import must create or match destination-library IDs and rewrite imported references; copying an ID alone between computers is not considered portability.

Suggested action configuration:

```json
{
  "sourceType": "local",
  "localAssetId": "asset_f3a8...",
  "localAssetName": "Booty",
  "audioUrl": "",
  "volume": 1
}
```

Existing `audioUrl` and `mediaUrl` configurations remain valid without migration.

### 2. Loopback Media Server

Add a dedicated HTTP server in the desktop app. Do not silently change the meaning of the existing WebSocket server.

The server should:

- Bind to `127.0.0.1` only by default.
- Use a dedicated, persisted default port, tentatively `3001`, with visible conflict handling. Do not silently switch ports because that would break an OBS Browser Source URL.
- Serve one version-consistent, validated Social Stream runtime snapshot containing `actions.html` and its required relative assets. Development may use the configured Social Stream source root; packaged builds may use the app-managed/cache or packaged snapshot selected by the existing resolver. Do not mix files from different versions in one server session.
- Serve registered media through opaque routes such as `/RANDOM_TOKEN/media/asset_f3a8...`.
- Support `GET`, `HEAD`, byte ranges, seeking, and correct content types.
- Disable directory listings.
- Reject unregistered paths, traversal attempts, symlink escapes, and unsupported methods.
- Require a high-entropy per-install token for Flow Actions, every relative runtime asset, media, and management/status requests.
- Return useful health information from a token-protected status endpoint.

Using the token as a path prefix allows normal relative requests from `actions.html` to remain inside the authenticated URL space. If implementation instead uses a short-lived bootstrap token plus a cookie, it must be proven to work reliably in OBS Browser Source. A query token by itself is insufficient because relative script requests do not inherit query parameters.

Because the path token is a bearer capability visible to page JavaScript, the local server/runtime must also send `Referrer-Policy: no-referrer` and prevent the local authenticated page from loading arbitrary custom JavaScript through the existing `js` URL option. If custom scripting is retained locally, it must be limited to an explicitly approved local script with a separate trust warning. External media, iframes, CSS, TTS calls, and WebSocket connections must never receive the token through a referrer or copied request URL.

Serving Flow Actions and media from the same origin avoids `file://`, mixed-origin, CORS, and local-network permission failures.

### 3. Flow Actions Resolution

For URL/upload sources, retain the current action payload.

For local sources, send the asset ID rather than a disk path. The local `actions.html` page resolves it against its own origin and carries forward its token:

```text
/RANDOM_TOKEN/media/asset_f3a8...
```

Use one product-neutral payload contract in both the standalone app and extension, for example `sourceType: "local"`, `localAssetId`, and `localAssetName`. Never put the server token, port, origin, or disk path in the flow or relayed action payload. The local Flow Actions page derives its media URL from its own authenticated origin.

If a hosted Flow Actions page receives a local asset action, it should show a clear diagnostic instead of silently failing.

### 4. Desktop IPC and Preload API

Reuse the existing native-dialog and approved-path patterns. Add narrowly scoped bridge methods such as:

- `selectLocalMedia`
- `listLocalMedia`
- `relinkLocalMedia`
- `removeLocalMedia`
- `getLocalMediaServerStatus`
- `startLocalMediaServer`
- `stopLocalMediaServer`
- `getLocalFlowActionsUrl`

Do not expose arbitrary read-file or serve-path methods to page code.

Implement these behind a small shared JavaScript capability adapter rather than scattering checks for `window.ninjafy`, `window.electronApi`, and `chrome.runtime` throughout Event Flow. This keeps the schema and editor behavior common while allowing different backends.

### 5. Extension Companion Mode

The extension cannot implement local serving alone. A later companion mode may:

- Run the desktop app or a small headless Media Bridge in the tray.
- Open a loopback library picker in a user-initiated popup.
- Return only an asset ID and display name to Event Flow.
- Keep OBS on the local Flow Actions URL generated by the bridge.

Before choosing a bridge transport, run a focused feasibility spike in the published Chrome extension and OBS. Compare authenticated loopback HTTP with explicit CORS/origin allowlisting against Chrome Native Messaging. Validate private-network/loopback behavior, extension-store permissions, pairing and token rotation, multiple browser profiles, bridge-offline handling, and upgrade behavior. Do not add broad unauthenticated CORS or expose the library token to hosted pages.

The first release should clearly label Local File as requiring the desktop app/bridge rather than presenting partial extension-only support. Shared schema and UI compatibility are required now; a working extension companion is not an acceptance criterion until the spike selects a safe transport.

## Implementation Phases

### Phase 1: Local Server Foundation

- Add the app-side media registry and approved-file selection.
- Add the secure loopback HTTP server.
- Serve a version-consistent local `actions.html` runtime and registered media from the authenticated origin.
- Add correct media content types and byte-range support.
- Add server status and Copy Local Flow Actions URL controls.
- Validate direct playback in a normal browser and OBS.

### Phase 2: Event Flow Integration

- Add URL, Upload, and Local File source choices to audio and media actions.
- Add local asset status, preview, replace, and relink UI.
- Add local asset action handling to `EventFlowSystem.js` and `actions.html`.
- Preserve existing flows and hosted upload behavior.
- Add clear errors for missing assets, stopped server, wrong Flow Actions URL, and port conflicts.
- Keep one shared editor/schema implementation, with standalone and extension capability adapters.

### Phase 3: Portability and Companion Mode

- Complete the Chrome-extension/OBS bridge feasibility spike and document the selected transport and threat model.
- Add extension-to-bridge local asset selection only if the spike confirms a safe, supportable transport.
- Add optional flow-plus-media bundle export/import.
- Add missing-asset relink workflow after moving computers.
- Add library backup/restore metadata without exporting absolute paths.
- Consider a tray-only Media Bridge mode for users who otherwise prefer the extension.

## Proposed Output

Expected code and documentation output:

- A new local media server/registry module in the desktop app, tentatively `ssapp/resources/electron-local-media-server.js`.
- Narrow IPC and preload methods for library management and status.
- Desktop Local Media Library UI and generated OBS URL.
- Event Flow editor support for local asset references.
- Flow Actions support for resolving and playing local assets.
- Backward-compatible handling of existing hosted URLs and uploads.
- Automated tests for registry persistence, path security, token enforcement, MIME types, range requests, and missing assets.
- Browser and real OBS validation on Windows, macOS, and Linux where available.
- Updated Event Flow and media-hosting documentation.

The output spans both repositories: app-owned code lands in `ssapp`; shared runtime, extension, and guide changes land in `social_stream`. The fallback bundle is generated later by the existing packaging workflow rather than edited directly.

## Security Requirements

- Loopback binding by default; no LAN exposure without a separate explicit feature.
- Random token required in generated URLs.
- Authentication covers `actions.html`, all of its relative assets, media, and status/management endpoints; a bare query token on only the HTML route is not enough.
- Only native-dialog-approved files or folders can enter the registry.
- Canonical/real paths must remain within approved roots after symlink resolution.
- No arbitrary filesystem path in URLs, page messages, logs, exports, or flow JSON.
- `GET` and `HEAD` only for media routes.
- No directory listing or file upload endpoint on the playback server.
- Rate and connection limits sufficient to prevent accidental local abuse.
- Reject unexpected `Origin` values on any browser-callable management API, and never enable wildcard CORS with credentials or library capabilities.
- Avoid logging the full capability URL/token; provide a deliberate token-rotation action that invalidates previously copied OBS URLs.
- Send a no-referrer policy on authenticated pages and disable or tightly approve custom JavaScript on the local Flow Actions page so page code cannot exfiltrate the bearer token.

## Testing Requirements

### Automated

- Registry add, remove, relink, persistence, and missing-file behavior.
- Path traversal, encoded traversal, symlink escape, bad token, and unapproved-path rejection.
- `GET`, `HEAD`, valid/invalid range, content length, content range, and MIME responses.
- Authenticated relative-asset requests, no-referrer behavior, custom-JavaScript rejection, and token rotation.
- Existing URL/upload flows remain unchanged.
- Exported flows do not contain absolute disk paths or tokens.

### Runtime

- Real standalone app file selection and restart persistence.
- Real OBS Browser Source using the generated local Flow Actions URL.
- Audio playback, animated GIF, image, and seekable MP4 playback.
- Flow test and live incoming event paths.
- Port conflict and server restart behavior.
- Renamed, moved, deleted, and relinked media.
- Hosted-relay and local-WebSocket connection modes using their correctly generated URLs.
- Extension unavailable/companion-required behavior in the first release.
- Extension plus companion bridge workflow only when Phase 3 is implemented.

## Acceptance Criteria

- A non-technical user can choose a local media file and add one generated URL to OBS without manually running a server.
- Local media works without uploading it or exposing it to the Internet.
- Audio and video seeking work through byte ranges.
- Existing hosted URLs and Upload actions continue to work unchanged.
- Restarting the app preserves valid library entries.
- Missing files produce actionable relink errors.
- Flow exports do not leak local paths or security tokens.
- The server cannot read files outside approved roots.
- The extension accurately explains when the app/bridge is required.
- Event Flow uses the same local-asset schema and editor implementation in the app and extension; environment differences are isolated behind capability adapters.
- The public guide is updated and runtime-verified before the feature is announced.

## Documentation That Must Be Updated

Update the public [Media Files for Event Flow guide](media-hosting-event-flow.html) when implementation is complete.

The updated guide should replace the manual Python/`file://` workflow as the primary local option, document the Local Media Library and generated OBS URL, retain manual hosting as an advanced fallback, and reflect the final extension-versus-desktop behavior.
