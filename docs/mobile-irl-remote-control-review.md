# Mobile IRL Remote Control Review

Status: source-reviewed proposal; no implementation changes included  
Date: 2026-08-01  
Primary client: VDO.Ninja Publisher Flutter app  
Related repositories: `vdon_flutter`, `social_stream`, and `ssapp`

## Executive summary

The existing Social Stream transport can support a useful mobile remote-control panel for IRL streamers, but the Flutter app is not yet a production control client. It currently receives chat and has a debug-only send path; it does not discover capabilities, send correlated commands, process command results, maintain remote state, or expose SSApp source controls.

Social Stream currently advertises 42 SSN actions and remotely exposes 13 SSApp source actions. The safest first release is a capability-driven in-call control panel focused on:

- clearing or advancing the featured overlay;
- recovering failed desktop capture sources;
- starting, stopping, muting, hiding, or restarting individual sources;
- basic timer control;
- connection and command-result feedback.

Polls, giveaways, desktop TTS, per-message moderation, and source editing are valuable follow-ups, but their state and response contracts should be standardized first.

The SSApp localhost API must remain local-only. Mobile control should continue to use Social Stream's existing WebRTC or WebSocket transport and only the remotely approved SSApp subset.

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

### 4. The Flutter Social Stream password is displayed but unused

The settings UI exposes an optional Social Stream encryption password. `SocialStreamService` logs `config.password`, but it does not use it in WebRTC room joining, stream IDs, SDP setup, or encryption derivation.

This field currently creates a false expectation that password-protected Social Stream WebRTC sessions are supported.

Recommended resolution:

- implement password behavior compatible with Social Stream's VDO.Ninja transport and test it end to end; or
- temporarily hide/disable the field with an explicit unsupported message.

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

- category;
- display label;
- value schema;
- whether a state query exists;
- whether confirmation is required;
- whether the action is destructive;
- whether a dock, overlay, timer, poll, waitlist, SSApp, or another page must be open;
- whether target labels are supported;
- whether a callback is guaranteed.

This can be added without breaking current clients by retaining the boolean action map and adding a versioned descriptor map.

### 9. Remote control currently relies heavily on session secrecy

Server-mode API examples use the session ID as the practical control boundary. Anyone with the session can potentially issue commands when remote API control is enabled.

Before exposing destructive operations from a phone, SSN should consider an optional controller secret or pairing token that is independent of public overlay links. At minimum:

- never expose `clearHistory` in the first mobile release;
- require confirmation for `removeSource`, reset actions, and source-mode changes;
- never expose app reload, shutdown, or unrestricted settings;
- do not log session IDs, passwords, controller tokens, or credential-bearing URLs;
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

Starting a source is asynchronous and may return `accepted` while still activating. The UI must continue checking status instead of immediately showing it as active.

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

### Phase 1: low-risk IRL controller

Required transport work:

- capability discovery;
- correlated commands and callbacks;
- reactive connection state;
- WebRTC command envelope support;
- dedicated server-mode control channel;
- safe timeout and disconnect behavior.

User-facing features:

- connection/capability status;
- next queued;
- clear featured overlay;
- next pinned;
- send chat and saved quick replies;
- list desktop sources;
- source start/stop/restart;
- source mute/unmute and show/hide;
- timer start/pause/reset and authoritative timer state.

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

## Proposed request and result rules

1. Request `getCapabilities` after the control transport becomes ready and after every reconnect.
2. Include a unique, unpredictable `get` token for every command that needs confirmation.
3. Bound pending requests and command payload size.
4. Resolve a request exactly once.
5. Ignore late, duplicate, unknown, or mismatched callbacks.
6. Cancel pending requests on service disposal or connection-generation change.
7. Do not automatically retry a mutation.
8. After an ambiguous timeout, read the affected state before offering retry.
9. Render controls only from advertised capabilities.
10. Sanitize error text before displaying it; do not surface URLs, credentials, or internal stack traces.

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

Expected correlated result shape:

```json
{
  "callback": {
    "get": "mobile-REQUEST_ID",
    "result": {
      "ok": true,
      "payload": {}
    }
  }
}
```

## Repository ownership

| Repository | Recommended responsibility |
| --- | --- |
| `social_stream` | Public capability contract, transport routing, state queries/events, action semantics, remote safety boundaries, and cross-transport tests. |
| `ssapp` | Source bridge implementation, local API, source lifecycle correctness, sanitized capability/status data, and local tests. Keep the versioned HTTP API loopback-only. |
| `vdon_flutter` | Mobile control client, request correlation, both transport lanes, reactive state, modal UI, confirmations, accessibility, and device lifecycle tests. |

## Validation matrix

### Transport and runtime

- WebRTC with Social Stream web/extension runtime.
- WebRTC with SSApp runtime.
- Server/WebSocket with chat and control sockets connected.
- Chat connected while control is unavailable.
- Control connected while chat forwarding is disabled.
- SSApp unavailable.
- Older SSApp with partial capabilities.
- Current SSApp with all approved source capabilities.
- Remote API control disabled in Social Stream.
- Dock/featured/timer/poll/waitlist pages absent and present as required.

### Independence from VDO publishing settings

Run each Social Stream transport with:

- no VDO room and no VDO publishing password;
- VDO room and no password;
- no room and a publishing password where supported;
- VDO room and publishing password.

The Social Stream session, transport, capabilities, and commands must remain unchanged across those combinations.

Separately test Social Stream WebRTC with its own transport password after password support is implemented.

### Lifecycle and resilience

- Connect before and after publishing begins.
- Open and close the control modal repeatedly.
- App background/foreground.
- Screen lock/unlock without attempting to unlock the device automatically.
- Wi-Fi/mobile-data transitions.
- Social Stream host restart.
- SSApp restart.
- Data-channel peer churn and multiple peers.
- Duplicate, late, malformed, oversized, and out-of-order callbacks.
- Command timeout immediately before a successful remote mutation.
- Disconnect during a destructive confirmation.
- App hang-up/dispose with pending commands.

### Source controls

- Source inactive, activating, active, error, and disappearing during refresh.
- Start returning accepted before activation completes.
- Restart failure after successful stop.
- Mute and visibility changes while active.
- Visibility rejected while inactive.
- Connection-mode change rejected while active.
- Platform-specific connection-mode validation.
- Credential-bearing remote URL rejected.
- Source removal confirmation and no blind retry.

### UI

- Portrait and compact landscape.
- Camera, screen-share, and microphone-only publishing modes.
- PiP transition while the modal is open.
- Large font and screen-reader labels.
- One-handed tap targets.
- Clear separation of phone controls and desktop/SSN controls.
- Unsupported controls hidden rather than left enabled.
- Concise success, timeout, and partial-availability feedback.

## Acceptance criteria for Phase 1

- The control panel never depends on VDO publishing room/password state.
- Both Social Stream transport modes can discover capabilities and receive correlated results.
- Server mode continues receiving chat while commands and callbacks use the separate control lane.
- WebRTC commands reach exactly one intended Social Stream host peer.
- Source controls appear only when SSApp advertises them.
- A source restart shows accepted/activating/active or a structured failure without claiming premature success.
- A timed-out mutation is not automatically replayed.
- Destructive actions require confirmation or are absent.
- The connection indicator updates after connect, reconnect, failure, and peer loss.
- No session IDs, passwords, source credentials, or controller tokens are written to production logs.
- Existing chat, local TTS, camera, audio, recording, and publishing behavior remains unchanged.

## Questions for SSN review

1. Which currently unadvertised actions should become supported public remote-control actions?
2. Can SSN provide a versioned descriptor schema in addition to the current boolean action map?
3. What should the authoritative queue-state response be?
4. Should one bounded `getRemoteState` response aggregate overlay, queue, TTS, timer, poll, waitlist, viewer, and source summaries?
5. Which page or runtime owns authoritative SSN TTS state when dock, featured, and extension tabs may all exist?
6. Can source status changes be pushed remotely, or should mobile poll while its source panel is visible?
7. Are chat message IDs received by the Flutter dock-labelled peer guaranteed to match the IDs used by dock pin/unpin controls?
8. Should SSN add a direct `featureMessage` action with a stable message ID?
9. Should mobile control support target labels from the first release or initially control the default dock only?
10. What pairing/authentication model should protect server-mode mobile control beyond session secrecy?
11. What is the supported password derivation and signaling sequence for a non-SDK Flutter WebRTC client?
12. Is a second channels-1/2 WebSocket the preferred way to combine remote control with the existing channels-3/4 chat feed?

## Source-reviewed baseline

- `vdon_flutter` baseline commit: `79b4a2f3e464c9bcc8fb51a73c41d7b52aace492`
- Social Stream router test: `tests/streamdeck-remote-control-router.test.js` passed during review.
- Flutter Social Stream parsing and lifecycle suites passed during review.
- This document proposes follow-up work; it does not claim that mobile remote control is already implemented.
