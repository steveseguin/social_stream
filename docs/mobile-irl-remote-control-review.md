# Mobile IRL Remote Control Review

Status: Social Stream protocol and routing implemented; Flutter client and UI pending
Date: 2026-08-02
Primary client: VDO.Ninja Publisher Flutter app  
Related repositories: `vdon_flutter`, `social_stream`, and `ssapp`

## Executive summary

Social Stream now has a versioned, capability-driven remote-control contract and authoritative routing for the selected mobile actions, but the Flutter app is not yet a production control client. It currently receives chat and has a debug-only send path; it does not discover capabilities, send correlated commands, process command results, maintain remote state, or expose SSApp source controls.

Social Stream currently advertises 42 SSN actions and remotely exposes 13 SSApp source actions. The safest first release is a capability-driven in-call control panel focused on:

- clearing or advancing the featured overlay;
- recovering failed desktop capture sources;
- starting, stopping, muting, hiding, or restarting individual sources;
- basic timer control;
- connection and command-result feedback.

Polls, giveaways, desktop TTS, per-message moderation, and source editing are valuable follow-ups, but their state and response contracts should be standardized first.

The SSApp localhost API must remain local-only. Mobile control should continue to use Social Stream's existing WebRTC or WebSocket transport and only the remotely approved SSApp subset.

## Current implementation status

Implemented in this `social_stream` worktree:

- protocol version 2 documentation, capability descriptors, availability states, host identity, action ownership, and universal results;
- authoritative background, default-Dock, and SSApp routing over WebRTC and WebSocket;
- bounded WebRTC Dock correlation, duplicate handling, default unlabeled Dock enforcement, timer-reset confirmation, and chat-size validation;
- VDO.Ninja-compatible password interoperability vectors for the Flutter handoff;
- focused protocol tests plus the existing Electron/SSApp WebRTC and local-relay bridge regression test.

The production Flutter command client, transport integration, state management, and control-panel UI remain the next repository task. No SSApp code change was required.

## Goals

- Give an IRL streamer useful one-handed Social Stream controls without returning to the desktop.
- Work in both Social Stream WebRTC and server/WebSocket modes.
- Work whether SSApp is present or absent, using runtime capabilities rather than version guesses.
- Keep Social Stream configuration independent of the VDO.Ninja publishing room, stream ID, and publishing password.
- Clearly distinguish phone controls from controls that affect Social Stream or desktop capture windows.
- Require explicit confirmation for destructive actions and never blindly replay mutations after a timeout.

## Non-goals

- Exposing SSApp's loopback API to the internet.
- Remotely exposing arbitrary SSApp settings, app reload, app shutdown, or unrestricted renderer execution.
- Replacing the app's existing phone camera, microphone, recording, PiP, or OBS controls.
- Treating a Social Stream session ID as a strong authentication mechanism.
- Adding a new pairing, controller-token, or authentication system in Phase 1. The first release uses Social Stream's existing opt-in, session-based remote-control model.

## Confirmed current capabilities

### SSApp localhost control API

Source anchors:

- `ssapp/resources/electron-control-api.js`
- `ssapp/index.html`, around the `SSAppStreamDeckBridge` implementation
- `social_stream/docs/skills/control-social-stream/`

The SSApp Control API is version `1.1.5`, binds to `127.0.0.1` by default, is opt-in, and is intended for same-machine scripts and agents.

Available local actions include:

- Discovery and reads: `getCapabilities`, `getSources`, `getSource`, `getSettings`, `getOperation`.
- Source lifecycle: `addSource`, `updateSource`, `removeSource`, `startSource`, `stopSource`, `restartSource`.
- Bulk lifecycle: `startAllSources`, `stopAllSources`, `restartAllSources`.
- Live source controls: `setSourceMute`, `toggleSourceMute`, `setSourceVisibility`, `toggleSourceVisibility`.
- Source configuration: `setSourceConnectionMode`.
- Approved settings: `updateSettings`.
- App lifecycle: `reloadApp`, `shutdownApp`.

The local API also provides status, operations, and Server-Sent Events. These broader local capabilities are not an authorization to expose them remotely.

### Remotely exposed SSApp source controls

Source anchors:

- `social_stream/js/streamdeck-remote-control.js`
- `social_stream/background.js`, around `routeStreamDeckRemoteRequest()` and `processIncomingRequest()`

Social Stream deliberately exposes only the public capture-source subset over its existing remote transports:

1. `getSources`
2. `getSource`
3. `addSource`
4. `updateSource`
5. `removeSource`
6. `startSource`
7. `stopSource`
8. `restartSource`
9. `setSourceVisibility`
10. `toggleSourceVisibility`
11. `setSourceMute`
12. `toggleSourceMute`
13. `setSourceConnectionMode`

Remote app lifecycle, settings, and bulk controls are intentionally suppressed even when the local SSApp capability provider advertises them.

Remote source responses are sanitized to fields such as source ID, platform, username/video ID, status, connection mode, visibility, mute state, auto-activate state, and group ID. Stored source URLs and credentials are not returned. Remote add/update also reject credential-bearing URLs and unsupported fields.

Supported source platforms currently include Twitch, Kick, YouTube, YouTube Shorts, TikTok, Instagram, Instagram Live, Picarto, Mixcloud, Chzzk, Nimo, Bilibili.com, and Bilibili.tv. Valid connection modes vary by platform and are advertised dynamically.

### Advertised SSN actions

`social_stream/js/streamdeck-remote-control.js` currently advertises 42 SSN actions.

Message, overlay, and queue:

- `nextInQueue`
- `clearOverlay`
- `clearDock`, `clear`, `clearAll`
- `clearHistory`
- `getQueueSize`
- `sendChat`, `sendEncodedChat`
- `pin`, `unpin`, `nextPinned`
- `drawmode`

Waitlist, giveaway, and leaderboard:

- `removefromwaitlist`
- `highlightwaitlist`
- `resetwaitlist`
- `resetleaderboard`
- `stopentries`
- `startentries`, `openentries`, `resumeentries`
- `waitlistmessage`, `setwaitlistmessage`
- `downloadwaitlist`
- `selectwinner`

Timer:

- `starttimer`
- `pausetimer`
- `toggletimer`
- `resettimer`
- `timeradd`
- `timersubtract`
- `settimer`
- `gettimerstate`

Poll:

- `loadpoll`
- `setpollsettings`
- `getpollpresets`
- `createpoll`
- `resetpoll`
- `closepoll`

Map:

- `startmap`
- `pausemap`
- `resetmap`

### Existing Flutter integration

Source anchors:

- `vdon_flutter/lib/src/services/social_stream_service.dart`
- `vdon_flutter/lib/src/models/social_stream_config.dart`
- `vdon_flutter/lib/src/call_sample/call_sample.dart`
- `vdon_flutter/lib/main.dart`, Social Stream settings section

The Flutter app currently provides:

- independent Social Stream session, mode, password, and enabled settings;
- WebRTC data-only viewing using a `dock`-labelled data channel;
- server/WebSocket chat reception using channels 3/4;
- robust incoming chat parsing and lifecycle cleanup;
- an in-call chat overlay;
- local, on-phone text-to-speech;
- a connection-status icon;
- a debug-only test-message sender.

It does not currently provide:

- a public `sendCommand()` API;
- capability discovery;
- request/callback correlation;
- command timeouts or structured errors;
- parsing of `capabilities`, `callback`, or `commandResult` packets;
- remote source state;
- remote SSN state;
- a reactive connection-state callback for the Flutter UI;
- production remote-control UI.

## Confirmed gaps and issues

### 1. Flutter has no production command layer

The service only exposes connection status, lifecycle methods, debug logging, and `sendTestMessage()`. A control UI cannot safely be placed directly on top of that debug method.

Recommended client primitives:

- `Future<RemoteCapabilities> getCapabilities()`
- `Future<RemoteCommandResult> sendCommand(RemoteCommand command)`
- `Stream<SocialStreamConnectionState>`
- `Stream<RemoteEvent>`
- bounded pending-request storage keyed by a unique `get` token;
- per-command timeout and cancellation on disconnect/dispose;
- no automatic replay of mutating commands after timeout or reconnect.

The client should always send a `get` token when it needs a result. This avoids depending on the less useful uncorrelated `commandResult` shape.

### 2. WebSocket chat and control require different channel pairs

The existing Flutter server-mode socket joins with:

```json
{ "join": "SESSION", "out": 3, "in": 4 }
```

That is appropriate for receiving the extension chat feed, but normal remote-control commands go to channel 1 and extension responses go to channel 2.

Recommended server-mode design:

- Keep the existing chat socket on channels 3/4.
- Add a separate control socket using output channel 1 and input channel 2.
- Reconnect and report the two lanes independently.
- Consider the remote-control panel available only when the control lane is ready, even if chat remains connected.

Do not silently replace the current chat connection with a control-only connection, since that would regress chat reception.

### 3. WebRTC needs control packet envelopes and response parsing

The current WebRTC data channel can carry both chat and control traffic, but the client must:

- send commands using the established Social Stream/VDO.Ninja `overlayNinja` envelope;
- intercept `capabilities`, `callback`, and `commandResult` packets before chat parsing;
- correlate replies to the originating request;
- tolerate wrapper variants already handled by the incoming chat parser;
- select the correct Social Stream host peer if more than one data-channel peer exists;
- avoid broadcasting a destructive source command to multiple host peers.

The precise outgoing envelope should be locked down with an end-to-end test against `processIncomingRequest()` rather than inferred only from the debug sender.

Host selection should be explicit:

- capability responses should identify the sender as a Social Stream host and include a host-instance identifier;
- Flutter may send read-only capability discovery to candidate peers, then bind commands to the peer UUID that returned the selected host response;
- if no host responds, control is unavailable;
- if multiple hosts respond, mutating controls remain blocked until exactly one host is selected;
- mutating commands must never be broadcast to every open data channel.

### 4. The Flutter Social Stream password is displayed but unused

The settings UI exposes an optional Social Stream encryption password. `SocialStreamService` logs `config.password`, but it does not use it in WebRTC room joining, stream IDs, SDP setup, or encryption derivation.

This field currently creates a false expectation that password-protected Social Stream WebRTC sessions are supported.

Recommended resolution:

- implement password behavior in Flutter compatible with Social Stream's VDO.Ninja WebRTC transport and test it end to end;
- label the setting as WebRTC-only and leave WebSocket mode unchanged.

This is the Social Stream transport password. It is separate from the VDO.Ninja publishing room/password, which must not influence Social Stream control.

### 5. Connection state is not reactive

The Flutter UI reads `isConnected`, but the service does not notify the widget when that value changes. The existing cloud icon can therefore become stale after initial build, reconnect, peer loss, or server failure.

The service should expose a state stream or callback containing at least:

- disabled;
- connecting;
- chat connected;
- control connected;
- fully connected;
- reconnecting;
- failed, with a safe error summary.

For WebRTC, a signaling WebSocket alone is not sufficient evidence that remote commands can be sent. At least one appropriate open data channel is required.

### 6. The SSN capability list is incomplete relative to runtime behavior

The runtime and documentation also contain useful actions that are not currently advertised in `SSN_ACTIONS`, including examples such as:

- `clearBotOverlay`
- `autoShow`
- `feature`
- `toggleTTS` / `tts`
- `skipTTS`
- `emoteonly`
- `blockUser`
- viewer-count requests

Mobile should not assume these actions merely because code paths exist. SSN should decide which are public, stabilize their request/result semantics, and advertise only that approved set.

### 7. Readable remote state is incomplete

A mobile controller needs confirmed state, not only fire-and-forget actions.

Current problems include:

- `getQueueSize` triggers a dock refresh and commonly produces a boolean callback or a separate `queueLength` event rather than a reliable numeric response.
- Timer state exists, but response behavior differs between server and peer paths.
- Poll presets are readable, but there is no unified current poll-state query.
- Waitlist entry acceptance, entry count, current selection, and winner state lack one stable snapshot.
- Desktop TTS has action paths but no advertised, unified state query.
- Overlay/featured/pinned state is not available as one controller snapshot.
- Remote SSApp source state is snapshot-based; there is no remote equivalent of the local SSE event stream.

Recommended new read contracts:

- `getRemoteState`
- `getQueueState`
- `getOverlayState`
- `getTTSState`
- `getWaitlistState`
- `getPollState`
- source status-change events, or documented polling guidance

`getRemoteState` can be a bounded summary and need not include full chat history or sensitive source details.

### 8. Capabilities need richer descriptors

The current SSN capability map is boolean-only. A generic mobile UI also needs to know:

- whether an action is supported by the runtime;
- whether its required owner is currently available, unavailable, or unknown;
- a safe reason when it is unavailable;
- category;
- display label;
- value schema;
- whether a state query exists;
- whether confirmation is required;
- its read-only, mutating, disruptive, or destructive safety class;
- whether a dock, overlay, timer, poll, waitlist, SSApp, or another page must be open;
- whether target labels are supported;
- whether a callback is guaranteed.

This can be added without breaking current clients by retaining the boolean action map as the stable `supported` view and adding a versioned descriptor and availability map. Availability may be `unknown` when SSN cannot prove that a separate dock or overlay page is connected. The UI should hide unsupported actions, disable known-unavailable actions with a reason, and show the documented prerequisite for unknown availability.

### 9. Phase 1 uses the existing session-based access model

Server-mode API examples use the session ID as the practical control boundary. Anyone with the session can potentially issue commands when remote API control is enabled.

Phase 1 intentionally does not add pairing or a separate controller secret. It uses Social Stream's existing opt-in remote-control setting and session-based access model. This is an accepted scope decision, not a blocker; a separate pairing token remains optional future hardening.

The first release should still preserve the existing safety boundaries:

- never expose `clearHistory` in the first mobile release;
- require confirmation for `removeSource`, reset actions, and source-mode changes;
- never expose app reload, shutdown, or unrestricted settings;
- do not log session IDs, passwords, or credential-bearing URLs in any build;
- do not queue mutations offline;
- do not retry a timed-out mutation without first reading state.

### 10. Several controls have overlapping or confusing meanings

The UI must distinguish:

- phone microphone mute vs SSApp desktop capture-window mute;
- phone preview/video state vs SSApp source-window visibility;
- phone-local TTS vs SSN desktop/dock TTS;
- Social Stream transport mode (`Peer-to-Peer` or `Server`) vs a desktop source's connection mode (`classic`, `websocket`, or TikTok variants);
- VDO.Ninja publishing password vs Social Stream transport password;
- clearing the featured overlay vs clearing dock rows vs permanently clearing history.

Recommended labels include `Desktop capture audio`, `Desktop capture window`, `SSN TTS`, `Clear featured overlay`, and `Clear dock messages`.

## Recommended app experience

### Placement

Keep session and transport configuration in the existing Publishing Settings section.

Add `Social Stream Controls` to the in-call More menu and make the existing Social Stream cloud/status icon open the same panel. A live-control surface should not be buried inside the pre-stream configuration dialog.

Use a full-height bottom sheet or modal that works in portrait and compact landscape. It should remain usable with one hand and use large tap targets.

### Header

Show:

- Social Stream session label, partially masked if appropriate;
- chat connection state;
- control connection state;
- transport mode;
- detected runtime (`web` or `electron`);
- SSApp availability and version when advertised;
- refresh/reconnect control;
- last command result or concise error.

### Quick controls

Recommended first-release controls:

- Next queued message.
- Clear featured overlay.
- Feature next pinned message.
- Send a short chat response.
- User-defined quick-message presets.
- Start/pause timer.
- Restart a failed desktop capture source.

Phase 1 sends dock commands to the default, unlabeled target only. Selecting named dock targets is deferred to Phase 2.

Potential emergency macro after the necessary commands are standardized:

- clear featured overlay;
- stop or skip SSN desktop TTS;
- leave dock history and phone publishing untouched.

### Desktop sources

When `capabilities.ssapp.available` is true, show a source list with:

- platform and public identifier;
- current status: inactive, activating, active, or error;
- configured and active connection mode;
- desktop capture audio state;
- desktop window visibility;
- start, stop, and restart;
- explicit mute/unmute and show/hide controls.

Refresh sources when the panel opens and after every command. If no remote source-event stream is added, poll only while the panel is visible and use a conservative interval.

Advanced source controls should be separate:

- add a public source;
- edit username/video ID/public URL;
- change connection mode after stopping the source;
- remove source with confirmation.

Starting or restarting a source is asynchronous and may return `accepted` while still activating. The UI must treat `accepted` as work started, not success, and continue reading source state until it reaches `active` or `error`.

### Timer, polls, and giveaways

Timer is suitable for the first release once `gettimerstate` is consistent:

- start/pause;
- reset with confirmation;
- add/subtract common increments;
- display authoritative remaining/elapsed state.

Poll and giveaway controls should follow after readable state is added:

- select/load a saved poll preset;
- create/start/close/reset a poll;
- open/close giveaway entries;
- show entry count and current state;
- select winner with confirmation;
- reset waitlist/leaderboard only from an advanced destructive section.

`downloadwaitlist` downloads on the desktop and is of limited value from a phone. It should not be a prominent mobile control.

### Per-message actions

The in-app chat overlay can later expose a long-press action sheet for:

- pin;
- unpin;
- feature this exact message;
- block user;
- inspect recent user history.

Before shipping this, SSN should confirm that mobile-received message IDs map reliably to dock message IDs and add a stable `featureMessage` action instead of relying on the ambiguous `feature`/`content` paths.

## Recommended phased feature list

### Phase 0: Social Stream public protocol and routing (implemented)

The current Social Stream worktree now:

- publish a canonical, versioned remote-control contract at `docs/remote-control-protocol.md` and link it from `api.md`;
- define the exact WebRTC and WebSocket request envelopes;
- define one correlated result schema for every Phase 1 command and query;
- distinguish stable action support from current owner/page availability;
- add Social Stream host identity to WebRTC capability responses;
- validates the routing and result rules with focused tests and the existing Electron/SSApp bridge test.

Final device/browser coverage for every action over both transports remains release validation during the Flutter implementation.

### Phase 1: low-risk IRL controller

Required transport work:

- implement the Phase 0 contract in Flutter;
- capability discovery with support and availability handling;
- correlated commands and standardized results;
- reactive connection state;
- WebRTC command envelope support;
- WebRTC host discovery and binding to exactly one host peer;
- Social Stream WebRTC transport-password support using the existing SSN/VDO.Ninja encryption flow;
- dedicated server-mode control channel;
- safe timeout and disconnect behavior;
- secret-free logging in every build mode.

User-facing features:

- connection/capability status;
- next queued;
- clear featured overlay;
- next pinned;
- send chat and saved quick replies;
- list desktop sources;
- source start/stop/restart;
- source mute/unmute and show/hide;
- timer start/pause/reset and authoritative timer state;
- default unlabeled dock targeting only.

### Phase 2: interactive moderation and show tools

- Standardized SSN desktop TTS state, toggle, skip, clear, and volume.
- Per-message pin/unpin/feature/block.
- Reliable queue state and count.
- Poll presets and current poll state.
- Giveaway/waitlist state and winner selection.
- Viewer-count snapshot.
- Target-label selection for multi-dock setups.

### Phase 3: advanced administration

- Add or edit public desktop sources.
- Change inactive source connection mode.
- Remove source with confirmation.
- Map controls.
- User-configurable favorite actions or macros.
- Optional secure mobile pairing/controller token.

## Actions not recommended for the initial mobile release

- `clearHistory`
- SSApp reload or shutdown
- bulk stop/restart of all sources
- unrestricted settings changes
- arbitrary source URL editing
- source removal
- reset waitlist/leaderboard without an advanced confirmation flow
- any command not present in the runtime capability response

## Action safety classes

Every public action descriptor should declare one safety class and its confirmation policy.

| Class | Examples | Phase 1 policy |
| --- | --- | --- |
| Read-only | `getCapabilities`, `getSources`, `getSource`, `gettimerstate` | No confirmation. A read may be retried only while it still belongs to the current connection generation. |
| Mutating | `nextInQueue`, `clearOverlay`, `sendChat`, source mute/visibility, timer start/pause | Execute from an explicit tap and never replay automatically after a timeout. |
| Disruptive | stopping or restarting an active source, changing source connection mode | Confirm when an active source will be interrupted. A clearly labelled restart of an already failed source does not need an additional confirmation dialog. |
| Destructive | `removeSource`, `clearHistory`, timer/poll/waitlist/leaderboard resets | Always confirm. Keep destructive administration out of Phase 1 except timer reset with confirmation. |

## Proposed request and result rules

1. Request `getCapabilities` after the control transport becomes ready and after every reconnect.
2. Include a unique, unpredictable `get` token for every Phase 1 command and query.
3. Bound pending requests and command payload size.
4. Resolve a request exactly once.
5. Ignore late, duplicate, unknown, or mismatched callbacks.
6. Cancel pending requests on service disposal or connection-generation change.
7. Do not automatically retry a mutation.
8. After an ambiguous timeout, read the affected state before offering retry.
9. Render controls only for supported actions; disable known-unavailable actions with a safe reason.
10. Treat unknown availability as an explicit prerequisite, not proof that the command will succeed.
11. Send WebRTC mutations only to the selected Social Stream host peer.
12. Send Phase 1 dock actions to the default unlabeled target only.
13. Sanitize error text before displaying it; do not surface URLs, credentials, or internal stack traces.

Example request:

```json
{
  "action": "restartSource",
  "target": "ssapp",
  "get": "mobile-REQUEST_ID",
  "value": {
    "sourceId": "SOURCE_ID"
  }
}
```

Proposed universal correlated result shape after the Phase 0 protocol changes:

```json
{
  "callback": {
    "get": "mobile-REQUEST_ID",
    "result": {
      "ok": true,
      "status": "accepted",
      "payload": {
        "sourceId": "SOURCE_ID",
        "status": "activating"
      }
    }
  }
}
```

`completed` means a synchronous action or query finished. `accepted` means asynchronous work started and the client must read authoritative state until it completes or fails. Errors use `ok: false`, `status: "failed"`, and a structured `error` containing a stable code and safe message. A callback must describe the authoritative owner's result, not merely confirm that an intermediary forwarded the command.

## Repository ownership

| Repository | Recommended responsibility |
| --- | --- |
| `social_stream` | Canonical versioned remote-control documentation, public capability and result contracts, transport routing, host identity, state queries/events, action semantics, remote safety boundaries, and cross-transport tests. |
| `ssapp` | Preserve the existing source bridge, lifecycle correctness, sanitized capability/status data, and local tests. No new Phase 1 remote surface is expected unless cross-repository testing exposes a contract gap. Keep the versioned HTTP API loopback-only. |
| `vdon_flutter` | Mobile control client, request correlation, both transport lanes, selected-host binding, Social Stream WebRTC password support, reactive state, secret-free logging, modal UI, confirmations, accessibility, and device lifecycle tests. |

### Implementation order and Flutter handoff

The Social Stream contract and routing work is implemented. Continue in this order:

1. Hand the contract, JSON fixtures, password test vectors, supported-action list, and test procedure to `vdon_flutter`.
2. Implement the Flutter command client and lifecycle tests.
3. Run live extension/browser and SSApp acceptance tests over both transports.
4. Add the capability-driven control-panel UI after the transport tests pass.

The Flutter handoff should require the app to implement:

- command, capability, result, connection-state, and remote-event models;
- bounded request correlation, timeouts, cancellation, and no mutation replay;
- separate server-mode chat and control sockets;
- WebRTC capability discovery and binding to one Social Stream host peer;
- Social Stream WebRTC password support by sharing the app's existing VDO.Ninja-compatible crypto/signaling implementation;
- source polling while the source panel is visible;
- the capability-driven control panel, confirmations, accessibility, and device lifecycle handling.

### SSApp Phase 1 scope

SSApp already provides the required source capabilities, sanitized source snapshots, structured errors, asynchronous `accepted` responses, and the `inactive`, `activating`, `active`, and `error` lifecycle states. Phase 1 should use that existing bridge and poll `getSource` after an accepted start or restart.

No new SSApp feature is required initially. SSApp changes are limited to fixes found by cross-repository tests, such as an unstable source-state transition or unsafe error text. Remote source-status push events remain optional later work because Flutter can poll only while its source panel is open.

## Validation matrix

The following sections are release-gating for Phase 1. Later-phase cases are listed separately and do not block the first release.

### Phase 1: transport and runtime

- WebRTC with Social Stream web/extension runtime.
- WebRTC with SSApp runtime.
- Server/WebSocket with chat and control sockets connected.
- Chat connected while control is unavailable.
- Control connected while chat forwarding is disabled.
- SSApp unavailable.
- Older SSApp with partial capabilities.
- Current SSApp with all approved source capabilities.
- Remote API control disabled in Social Stream.
- Dock, featured, and timer pages absent and present as required.
- Supported actions whose current availability is available, unavailable, and unknown.
- WebRTC discovery with zero, one, and multiple Social Stream host peers.
- Default unlabeled dock targeting; no Phase 1 label selector.

### Phase 1: independence from VDO publishing settings

Run each Social Stream transport with:

- no VDO room and no VDO publishing password;
- VDO room and no password;
- no room and a publishing password where supported;
- VDO room and publishing password.

The Social Stream session, transport, capabilities, and commands must remain unchanged across those combinations.

Separately test Social Stream WebRTC with its own transport password enabled and disabled.

### Phase 1: lifecycle and resilience

- Connect before and after publishing begins.
- Open and close the control modal repeatedly.
- App background/foreground.
- Screen lock/unlock without attempting to unlock the device automatically.
- Wi-Fi/mobile-data transitions.
- Social Stream host restart.
- SSApp restart.
- Data-channel peer churn and multiple peers.
- Multiple host responses block mutations until exactly one host is selected.
- Duplicate, late, malformed, oversized, and out-of-order callbacks.
- Standardized `completed`, `accepted`, and `failed` results.
- Command timeout immediately before a successful remote mutation.
- Disconnect during a destructive confirmation.
- App hang-up/dispose with pending commands.

### Phase 1: source controls

- Source inactive, activating, active, error, and disappearing during refresh.
- Start returning accepted before activation completes.
- Restart failure after successful stop.
- Mute and visibility changes while active.
- Visibility rejected while inactive.

### Phase 1: UI

- Portrait and compact landscape.
- Camera, screen-share, and microphone-only publishing modes.
- PiP transition while the modal is open.
- Large font and screen-reader labels.
- One-handed tap targets.
- Clear separation of phone controls and desktop/SSN controls.
- Unsupported controls hidden, known-unavailable controls disabled with a reason, and unknown availability shown with its prerequisite.
- Concise success, timeout, and partial-availability feedback.

### Later-phase validation, not Phase 1 release-gating

- Named target labels with one or multiple dock pages.
- SSN desktop TTS state and controls.
- Per-message pin, feature, block, and history actions with stable message IDs.
- Poll, giveaway, waitlist, viewer-count, and map state and controls.
- Source add/update, connection-mode changes, platform validation, and removal confirmation.
- Credential-bearing remote source URLs rejected.
- User-defined macros and advanced administration.
- Optional controller pairing or authentication if that future hardening is pursued.

## Acceptance criteria for Phase 1

- The canonical versioned remote-control contract exists in Social Stream documentation and is linked from `api.md`.
- Phase 1 uses Social Stream's existing opt-in, session-based access model and does not depend on new pairing or authentication work.
- The control panel never depends on VDO publishing room/password state.
- Social Stream WebRTC works with and without its own transport password; WebSocket mode remains unchanged.
- Both Social Stream transport modes can discover supported capabilities, represent current availability, and receive standardized correlated results.
- Server mode continues receiving chat while commands and callbacks use the separate control lane.
- WebRTC capability responses identify Social Stream hosts, commands reach exactly one selected host peer, and mutations remain blocked when host selection is ambiguous.
- Phase 1 dock commands use the default unlabeled target only.
- Source controls appear only when SSApp advertises them.
- A source restart shows accepted/activating/active or a structured failure without claiming premature success.
- A timed-out mutation is not automatically replayed.
- Destructive actions require confirmation or are absent.
- The connection indicator updates after connect, reconnect, failure, and peer loss.
- No session IDs, passwords, or source credentials are written to logs in any build mode.
- Existing chat, local TTS, camera, audio, recording, and publishing behavior remains unchanged.

## Resolved Phase 1 scope decisions

- Use the existing opt-in, session-based Social Stream remote-control model; pairing and separate controller authentication are deferred.
- Control the default unlabeled dock only; named target selection is Phase 2.
- Support the Social Stream transport password in WebRTC mode only; WebSocket behavior is unchanged.
- Require standardized correlated results for the selected Phase 1 commands before building the production control UI.

## Remaining questions for SSN review

1. Which currently unadvertised actions should become supported public remote-control actions?
2. What should the authoritative queue-state response include beyond `queueLength`?
3. Should one bounded `getRemoteState` response aggregate overlay, queue, TTS, timer, poll, waitlist, viewer, and source summaries?
4. Which page or runtime owns authoritative SSN TTS state when dock, featured, and extension tabs may all exist?
5. Should source status changes eventually be pushed remotely, or should mobile continue polling only while its source panel is visible?
6. Are chat message IDs received by the Flutter dock-labelled peer guaranteed to match the IDs used by dock pin/unpin controls?
7. Should SSN add a direct `featureMessage` action with a stable message ID?

## Source-reviewed baseline

- `vdon_flutter` baseline commit: `79b4a2f3e464c9bcc8fb51a73c41d7b52aace492`
- Social Stream router, version 2 contract, password-vector, and transport regression tests passed after implementation.
- The existing SSApp Electron bridge end-to-end test passed against this Social Stream worktree.
- Flutter Social Stream parsing and lifecycle suites passed during review.
- Social Stream's host-side contract is implemented; Flutter mobile remote control is not yet implemented.
