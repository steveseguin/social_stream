# LLM Control and Headless SSApp Finalization Plan

> **Superseded on 2026-07-26.** This document records the earlier token-authenticated,
> HTTP-driven proposal and is retained only as history. The active design is
> `ssn_app/docs/CONTROL_ARCHITECTURE_PLAN.md`: headless is only a launch mode, remote control
> uses Social Stream's existing WebRTC/WebSocket transports, and the optional tokenless
> `/api/v1` + MCP adapter is for same-machine AI tools only. Do not implement the token,
> tunnelling, or cloud HTTP-control work described below.

## Problem Statement

SSApp now has an initial authenticated localhost control API, headless CLI mode, source and settings commands, a public guide, and an AI skill. The current implementation proves the concept and passes isolated Electron tests, but it is not yet ready to be described as complete remote control of the standalone app.

Before release, the control surface needs a stable contract, safer credential handling, broader source and settings coverage, packaged cross-platform validation, and functional regression testing of the normal visible app, headless mode, local media, Stream Deck, and the Chrome extension.

## Objective

Ship an opt-in SSApp control surface that an LLM or ordinary automation client can use reliably without UI clicking, while preserving the existing visible desktop workflow and Chrome extension behavior.

The release should let a user or agent:

- Launch SSApp visibly or headlessly from the CLI.
- Discover supported operations instead of guessing.
- Inspect app, session, source, and server status.
- Add, update, remove, start, stop, and reload supported sources.
- Read and change explicitly approved settings.
- Observe long-running state changes and actionable errors.
- Reload or gracefully shut down the app with confirmation.
- Use a documented skill or deterministic client without gaining arbitrary renderer, filesystem, cookie, or secret access.

## Confirmed Baseline

Implemented now:

- Opt-in `--ssapp-control-api` and `--ssapp-headless-control` modes.
- Loopback HTTP server with token authentication.
- `GET /api/v1/capabilities`, `GET /api/v1/status`, and `POST /api/v1/command`.
- Source list/get/add/update/remove/start/stop/restart and bulk controls.
- Source mute, visibility, and connection-mode controls.
- An allowlisted first set of global settings.
- Confirmation-required app reload and graceful shutdown.
- Separation between the safe public command list and legacy test-only renderer execution routes.
- Headless source-window hiding.
- A checked-in `control-social-stream` skill, API reference, Python client, and public guide.
- Isolated Electron tests for CLI launch, authentication, source/settings persistence, reload, shutdown, Stream Deck compatibility, and local media.

Current limitations:

- The production API and legacy remote test harness still live in the same large `main.js` server implementation.
- A token supplied directly as a command-line argument can be visible to local process inspection tools.
- Source creation is generic and has not been functionally validated across every platform and connection mode.
- Only a small allowlisted settings set is controllable.
- Clients must poll for changes; there is no production event stream.
- Headless behavior has only been functionally exercised from a Windows source checkout, not packaged builds on all supported operating systems.
- The current Python client is a thin HTTP client, not a full MCP server.

## Design Requirements

- Bind to `127.0.0.1` only. Do not add LAN binding as part of finalization.
- Keep control disabled unless explicitly enabled by CLI, environment, or a future app setting.
- Keep the public API declarative. Do not expose arbitrary JavaScript execution, raw IPC, unrestricted store access, cookies, session tokens, or arbitrary file reads.
- Keep legacy diagnostic endpoints available only under the explicit legacy test flag.
- Use capability discovery and structured schemas so clients can adapt across versions.
- Preserve the existing Stream Deck bridge as the source-operation implementation path where practical.
- Keep Electron-only code in `ssapp`; do not add desktop IPC assumptions to Chrome extension runtime code.
- Treat headless as hidden Electron browser execution, not a browser-free Node service.
- Require explicit confirmation for disruptive bulk operations, app reload, restart, shutdown, and destructive removal.

## Required Work Before Release

### Phase 1: Separate and Stabilize the API

- Move the production control API into a focused CommonJS module, tentatively `resources/electron-control-api.js`.
- Leave the legacy renderer execution harness isolated and enabled only by `--remote-control` or its test environment flag.
- Define one command registry containing:
  - Action name.
  - Description.
  - Input schema.
  - Whether it is read-only, mutating, disruptive, or destructive.
  - Whether confirmation is required.
  - Minimum API/app version.
- Generate the capabilities response from that registry so documentation and runtime behavior cannot drift.
- Standardize response envelopes, error codes, HTTP status codes, and validation errors.
- Add a request ID to responses and logs for troubleshooting.
- Define timeouts for renderer-backed commands and return `SSAPP_TIMEOUT` instead of leaving requests open.
- Return `409` for state conflicts such as editing an active source and `503` when the renderer is not ready.
- Document `/api/v1` compatibility rules before expanding the contract.

Exit gate:

- Production control mode cannot reach `/exec`, `/view-exec`, file-selection test hooks, or other legacy diagnostic endpoints.
- Every advertised command has schema validation and a deterministic error contract.

### Phase 2: Fix Credential and Startup UX

- Stop recommending command-line tokens as the primary setup because process arguments may be locally visible.
- Add a safer token workflow:
  - Generate and persist a random per-profile token in Electron storage, or
  - Read a token from `SSAPP_CONTROL_TOKEN`, or
  - Read it from a user-protected `--ssapp-control-token-file`.
- Keep `--ssapp-control-token=...` only as an explicitly documented advanced/testing option if retained.
- Add visible app controls to enable/disable the API, copy the localhost URL, rotate the token, and show server status.
- Redact tokens from logs, errors, diagnostics, crash reports, and status responses.
- Validate ports to the supported range and show clear port-conflict recovery.
- Ensure only one control server owns a configured port and profile.
- Add a `--ssapp-print-control-info` option that prints non-secret connection information; print a generated token only when the user explicitly requests a one-time bootstrap flow.

Exit gate:

- A non-technical user can enable the API without manually inventing or exposing a token.
- Token rotation immediately invalidates the old token and does not break unrelated SSApp sessions.

### Phase 3: Complete Source Lifecycle Controls

- Build a platform-aware source input registry instead of relying on a generic target and URL alone.
- For each supported platform, define required identifiers, URL construction, supported connection modes, and whether sign-in or a visible window is required.
- Add and validate commands for:
  - Source creation.
  - Source removal.
  - Source metadata updates.
  - Start, stop, and reload.
  - Visibility and mute.
  - Connection mode.
  - Auto-activation.
  - Account role and reply-only behavior where supported.
- Add group list/create/update/remove controls only after single-source behavior is stable.
- Return `requiresUserInteraction` and an actionable message for sign-in, CAPTCHA, permission, or native-dialog requirements.
- Report transitional states such as `activating`, `reloading`, `waiting_for_sign_in`, `active`, `stopping`, and `error`.
- Make repeated commands safe:
  - Starting an active source returns its current state.
  - Stopping an inactive source returns its current state.
  - Request retries do not duplicate a source when an idempotency key is supplied.
- Ensure changing a username either updates a generated URL consistently or clearly requires the caller to provide the new URL.

Initial functional platform matrix:

- Twitch: classic and WebSocket.
- Kick: classic and WebSocket.
- YouTube: video/live-chat source and supported API/WebSocket modes.
- TikTok: classic, legacy/polling, and WebSocket behavior, including fallback reporting.
- One classic DOM-only source.
- One custom URL source.

Exit gate:

- Add, start, reload, stop, and remove work through the API for every initial matrix entry in the real app.
- The visible UI updates immediately and accurately when an API client changes a source.

### Phase 4: Expand Settings Safely

- Create a settings registry rather than exposing storage keys directly.
- Each setting definition should include:
  - Public name and description.
  - Type, default, allowed values, and bounds.
  - Current value.
  - Whether it is sensitive.
  - Whether it requires a source reload or app restart.
  - Supported runtime: visible app, headless app, extension, or shared.
- Add commands to list setting definitions, get selected settings, validate a proposed patch, and apply a patch.
- Keep secrets and raw provider credentials out of general settings responses.
- Add separate narrowly scoped secret configuration only if a real use case requires it, with redacted reads and explicit user approval.
- Confirm settings changed through the API update the visible UI and persist through restart.
- Confirm visible UI changes are reflected in subsequent API reads.

Exit gate:

- No arbitrary Electron Store or localStorage keys are exposed.
- All advertised settings pass round-trip UI/API/persistence tests.

### Phase 5: Add Observation and Long-Running Operation Support

- Add a loopback event stream, preferably Server-Sent Events initially, for:
  - App readiness.
  - Source added/updated/removed.
  - Source status changes.
  - Reload completion or failure.
  - Local media server changes.
  - Port conflicts and recoverable errors.
- Include monotonic event IDs so clients can reconnect without silently missing changes.
- Add operation IDs for long-running source activation and reload commands.
- Add `getOperation` or equivalent status lookup.
- Bound event queues and disconnect slow clients safely.
- Do not include chat contents by default; make any future message stream a separate explicit capability with privacy controls.

Exit gate:

- An agent can start or reload a source and reliably wait for completion without fixed sleeps or aggressive polling.

### Phase 6: Harden Headless Runtime Behavior

- Ensure every BrowserWindow creation path respects headless mode, including popups, OAuth/sign-in windows, Flow Actions previews, and error dialogs.
- Prevent tray/menu actions or renderer commands from unexpectedly revealing windows while headless.
- Return a structured interaction-required error instead of opening a hidden prompt that blocks forever.
- Decide how native dialogs behave in headless mode:
  - Reject with `USER_INTERACTION_REQUIRED`, or
  - Accept only pre-approved IDs/paths through narrowly scoped APIs.
- Define graceful signal handling for CLI/service managers.
- Document that Linux may still require a graphical session or Xvfb depending on the packaged Electron environment.
- Test sleep/wake, network loss, app reload, renderer crash recovery, and repeated headless restarts.
- Evaluate an optional tray-less/background-service mode only after the hidden Electron mode is stable.

Exit gate:

- A 2-hour headless soak run does not reveal windows, leak child processes, lose source state, or stop responding to status requests.

### Phase 7: Add the MCP Adapter

- Keep the HTTP API as the single application-control contract.
- Add a small separate stdio MCP adapter that maps typed MCP tools to the localhost API.
- Generate MCP tool schemas and read-only/destructive annotations from the same command registry.
- Initial tools should include:
  - `ssapp_get_status`
  - `ssapp_list_sources`
  - `ssapp_add_source`
  - `ssapp_update_source`
  - `ssapp_start_source`
  - `ssapp_stop_source`
  - `ssapp_reload_source`
  - `ssapp_remove_source`
  - `ssapp_get_settings`
  - `ssapp_update_settings`
- Require the adapter to receive credentials through environment/configuration, not prompts or checked-in files.
- Do not let the MCP adapter broaden API permissions.
- Add MCP initialization, tool discovery, tool-call, error, and shutdown tests.

Exit gate:

- Codex/ChatGPT and at least one other MCP client can discover and run the core tools against an isolated SSApp profile.
- Tool descriptions clearly distinguish read-only and disruptive operations.

### Phase 8: Finalize Skill and Documentation

- Update `docs/skills/control-social-stream/SKILL.md` to use the final command registry and credential workflow.
- Keep the skill concise and move the complete schemas to its reference file.
- Update the Python client or replace it with a generated client from the stable contract.
- Add installation examples for common skill locations without assuming one AI vendor.
- Add troubleshooting for:
  - App not running.
  - Wrong token.
  - Port conflict.
  - Renderer not ready.
  - Source requires sign-in.
  - Headless display/session problems.
- Update `docs/llm-control-guide.html` and the Guides directory.
- Clearly label which controls require the standalone app; do not imply the Chrome extension itself runs the localhost server.
- Validate all documented commands against a packaged build before publishing.

Exit gate:

- Every copied example works unchanged with the released app.
- The skill validator and a real agent-driven skill test both pass.

## Required Regression and Functional Testing

Supporting checks are useful but do not count as completion without real app workflows.

### Automated Supporting Checks

- Syntax checks for all changed CommonJS and browser scripts.
- Command registry/schema tests.
- Authentication and token-rotation tests.
- Unknown action, malformed JSON, oversized body, wrong method, and invalid type tests.
- Loopback binding and legacy-endpoint isolation checks.
- Port conflict and renderer timeout tests.
- API version and capabilities snapshot tests.
- Skill validation and deterministic client tests.
- Existing IPC scaffold and Social Stream path-security tests.

### Visible App Functional Tests

Use an isolated profile in the real Electron app:

1. Launch normal visible SSApp with the control API enabled.
2. Confirm the normal main window and existing source controls still work manually.
3. Add a source in the UI; verify the API sees it.
4. Add a source through the API; verify it appears correctly in the UI.
5. Start, reload, mute, hide/show, stop, and remove it through the API.
6. Confirm status transitions and UI state match the real source window.
7. Change an approved setting through the UI and through the API in both directions.
8. Reload the app and verify source/settings persistence.
9. Rotate the token and verify old-token rejection.
10. Disable the API and verify the port closes while the app continues normally.

### Headless Functional Tests

Use an isolated profile and real Electron runtime:

1. Launch via the final CLI command.
2. Confirm no SSApp or source window becomes visible.
3. Discover capabilities and read status.
4. Add and activate each source in the initial platform matrix.
5. Wait for activation through events/operation status.
6. Reload each source and confirm it reconnects.
7. Change supported settings and verify behavior.
8. Exercise network loss and recovery.
9. Gracefully shut down, restart, and verify persistence.
10. Run a 2-hour repeated-command soak test and check for orphan Electron processes or memory growth.

### Local Media Compatibility

- Choose a real local image, audio file, GIF, and seekable video through the production picker.
- Trigger each from Event Flow and verify playback in local Flow Actions/OBS.
- Run the same workflow while the control API is enabled.
- Verify API reload/shutdown does not corrupt the media registry or token.
- Verify headless mode returns a clear interaction requirement when a native picker would be needed.

### Existing Integration Compatibility

- Run the Stream Deck bridge end to end, including socket start/stop and source control.
- Run Event Flow local-media and general Event Flow tests.
- Run source path-security and IPC boundary checks.
- Verify existing WebSocket relay and HTTP APIs do not conflict with the control port.
- Verify sessions, startup flags, close-to-tray, updater, and restart flows.

### Chrome Extension Compatibility

Load the real unpacked Chrome extension and verify:

- Existing source capture remains unchanged.
- Event Flow URL and hosted-upload media remain unchanged.
- Local File accurately explains that the standalone app/bridge is required when unavailable.
- No Electron control API or preload assumptions leak into extension pages.
- Exported flows remain portable and contain no control token or disk path.

### Packaged Cross-Platform Matrix

- Windows installer build and portable build.
- macOS x64 and arm64 builds.
- Linux AppImage in a desktop session.
- Linux headless/CI environment using the documented display setup if required.

For each package:

- Visible launch.
- Headless CLI launch.
- Custom/default port.
- Credential loading.
- Add/start/reload/stop source.
- Persistence and graceful shutdown.
- Upgrade from a profile created by the previous public release.

## Acceptance Criteria

- Normal SSApp use is unchanged when the control API is disabled.
- The API binds only to loopback and rejects unauthenticated requests.
- Production mode cannot access legacy arbitrary renderer execution endpoints.
- Credentials are not printed, logged, documented, or persisted insecurely by default.
- Capability discovery accurately describes every available command and setting.
- Core source operations work in both visible and headless real-app workflows.
- UI state, API state, and persisted state remain consistent.
- Headless operation never waits indefinitely on hidden prompts or dialogs.
- Packaged Windows, macOS, and Linux validation passes.
- Existing Stream Deck, Event Flow, local media, sessions, and extension behavior pass their functional regression workflows.
- The public guide, skill, reference, and client match the shipped API.
- No control token, absolute media path, cookie, or provider secret appears in exported flows or ordinary API responses.

## Recommended Order

1. Separate the production API and define the command/settings registries.
2. Fix credential storage and visible enable/rotate/copy controls.
3. Complete and functionally test the source lifecycle matrix.
4. Complete safe settings coverage.
5. Add events and long-running operation tracking.
6. Harden and soak-test headless mode.
7. Add the MCP adapter.
8. Run packaged cross-platform and extension regression testing.
9. Update and runtime-verify all public documentation and the skill.

Do not announce the feature as complete or generally available until Phases 1 through 6 and the packaged regression matrix pass. The MCP adapter can ship with the first release or immediately afterward, but the stable authenticated HTTP contract should be finalized first.
