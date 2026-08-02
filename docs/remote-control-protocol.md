# Social Stream Remote-Control Protocol

Status: Implemented Phase 1 host contract  
Protocol: `ssn-remote-control` version `2`

This contract covers capability-driven remote control of Social Stream and the approved SSApp source subset. Existing unversioned HTTP, WebSocket, Dock, StreamDeck, and Companion commands remain supported.

## Request shape

Version 2 clients send a unique `get` value with every command or query:

```json
{
  "protocol": 2,
  "action": "restartSource",
  "target": "ssapp",
  "get": "mobile-REQUEST_ID",
  "value": {
    "sourceId": "SOURCE_ID"
  }
}
```

`protocolVersion: 2` is accepted as an alias for `protocol: 2`. Correlation values are identifiers, not authentication tokens. An action and non-empty string `get` are required. Correlation IDs are limited to 256 characters and serialized requests to 32,768 characters.

Phase 1 Dock commands omit `target` and control the default unlabeled Dock. Named Dock pages ignore these version 2 commands; named targets are reserved for a later phase.

## Capability discovery

Send:

```json
{
  "protocol": 2,
  "action": "getCapabilities",
  "get": "mobile-CAPABILITIES_ID"
}
```

The correlated result contains a capability payload with:

- `version: 2` and `protocol.name: "ssn-remote-control"`;
- `role: "social-stream-host"`;
- a runtime-scoped `hostInstanceId`;
- `runtime`, currently `web` or `electron`;
- the legacy `ssn.actions` boolean map;
- `ssn.actionDescriptors` and `ssn.actionAvailability`;
- the existing SSApp capability tree plus `remoteActions`, `actionDescriptors`, and `actionAvailability`.

`hostInstanceId` changes when the Social Stream runtime restarts. In WebRTC mode, bind commands to the peer UUID that returned the selected host capability response. Never broadcast a mutation. If more than one host responds, block mutations until one host is selected.

Availability states are:

- `available`: SSN can prove that the owner is ready;
- `unavailable`: SSN can prove that the owner is not ready;
- `unknown`: the action is supported, but SSN cannot prove that a separate Dock, overlay, or capture source is ready.

Unknown availability is not an error. Show the descriptor prerequisite and handle the command result normally.

## Result envelope

Version 2 correlated responses use:

```json
{
  "callback": {
    "get": "mobile-REQUEST_ID",
    "result": {
      "ok": true,
      "status": "completed",
      "request": "mobile-REQUEST_ID",
      "payload": {}
    }
  }
}
```

Statuses are:

- `completed`: a synchronous action or query finished;
- `accepted`: asynchronous work started;
- `failed`: the owner rejected or could not complete the request.

Errors use a stable code and a safe display message:

```json
{
  "callback": {
    "get": "mobile-REQUEST_ID",
    "result": {
      "ok": false,
      "status": "failed",
      "request": "mobile-REQUEST_ID",
      "error": {
        "code": "TARGET_UNAVAILABLE",
        "message": "No connected default Dock page is available."
      }
    }
  }
}
```

Clients resolve each `get` once and ignore late, duplicate, unknown, or mismatched callbacks. Never automatically retry a mutation. After an ambiguous timeout, read authoritative state before offering another attempt.

The host keeps at most 128 WebRTC Dock requests pending. A duplicate pending ID from the same controller is not executed again; conflicting IDs and overflow receive structured failures.

## Action ownership

Only the authoritative owner returns the version 2 result.

| Owner | Versioned actions implemented by this contract |
| --- | --- |
| Social Stream background | `sendChat`, `starttimer`, `pausetimer`, `resettimer`, `gettimerstate` |
| Default Dock | `nextInQueue`, `clearOverlay`, `nextPinned`, `getQueueSize` |
| SSApp bridge | `getSources`, `getSource`, `startSource`, `stopSource`, `restartSource`, `setSourceMute`, `toggleSourceMute`, `setSourceVisibility`, `toggleSourceVisibility` |

`getQueueSize` is implemented for contract completeness but remains a Phase 2 UI feature. SSApp also advertises remotely approved Phase 3 actions. The client must gate its UI by each descriptor's `phase` and current capability boolean.

`sendChat` returns `accepted` because Social Stream can confirm dispatch to its capture-source path, not platform delivery. Starting or restarting an SSApp source returns `accepted` while its source status is commonly `activating`. Poll `getSource` until the status becomes `active` or `error`.

Timer mutations return the authoritative timer snapshot. `resettimer` requires `value.confirm: true` for version 2 requests.

### Phase 1 request values and results

| Action | `value` | Successful payload |
| --- | --- | --- |
| `nextInQueue` | Omit | `featured`, `queueLength` |
| `clearOverlay` | Omit | `cleared` |
| `nextPinned` | Omit | `featured`, `messageId` |
| `sendChat` | Non-empty string, at most 2,000 characters | `accepted`, `action`, `destination` |
| `starttimer`, `pausetimer` | Omit | `action`, `timer` snapshot |
| `resettimer` | `{ "confirm": true }` | `action`, `timer` snapshot |
| `gettimerstate` | Omit | `action`, `timer` snapshot |
| `getSources` | Omit, or optional `target`, `groupId`, and `status` filters | `sources` array |
| `getSource`, `startSource`, `stopSource`, `restartSource`, `toggleSourceMute`, `toggleSourceVisibility` | `{ "sourceId": "SOURCE_ID" }` | `source` snapshot; start/restart may also include `accepted` |
| `setSourceMute` | `{ "sourceId": "SOURCE_ID", "isMuted": true }` | `source` snapshot |
| `setSourceVisibility` | `{ "sourceId": "SOURCE_ID", "isVisible": true }` | `source` snapshot |

Source snapshots are sanitized and contain only public state such as ID, platform, username/video ID, lifecycle status, connection mode, visibility, mute, auto-activate, and group ID. URLs and credentials are not returned.

## WebSocket transport

Keep chat and control on separate sockets:

```json
{ "join": "SESSION", "out": 3, "in": 4 }
```

```json
{ "join": "SESSION", "out": 1, "in": 2 }
```

The first socket receives chat. The second sends commands and receives callbacks. A server-connected Dock owns and answers Dock actions directly; the Social Stream background does not emit a duplicate version 2 result.

## WebRTC transport

Send the normalized request as the Social Stream `overlayNinja` payload through the selected host peer's open data channel. Social Stream returns capability and callback packets to that same peer UUID.

For Dock-owned actions, the host forwards the request to connected Dock peers, excludes the originating controller peer, and relays the first authoritative Dock callback. Duplicate deliveries sharing the same `get` value are executed once by each Dock page.

Signaling connectivity alone does not make control ready. At least one open data channel and one selected Social Stream host capability response are required.

## Social Stream WebRTC password

The Social Stream password applies to WebRTC only. WebSocket channels are unchanged.

Compatibility uses the existing VDO.Ninja behavior with salt `vdo.ninja`:

- password suffix: first 6 hexadecimal SHA-256 characters of `password + salt`;
- room hash: first 16 hexadecimal SHA-256 characters of `room + password + salt`;
- signaling encryption key: SHA-256 bytes of `password + salt`;
- encrypted signaling fields: AES-256-CBC with a random 16-byte IV, encoded as hexadecimal ciphertext and vector.

The non-secret interoperability fixture is [vdo-password-test-vectors.json](./vdo-password-test-vectors.json). Flutter should share its existing VDO.Ninja-compatible signaling helper rather than maintain a second implementation.

## Safety and logging

- Phase 1 uses Social Stream's existing opt-in, session-based access model.
- Do not queue mutations offline or replay them after reconnect.
- Confirm destructive actions according to capability descriptors.
- Never log session IDs, passwords, source credentials, credential-bearing URLs, or complete command payloads.
- Keep the SSApp HTTP Control API loopback-only; mobile uses only this remote contract.

## Backward compatibility

Requests without `protocol: 2` continue through the existing legacy action paths and retain their legacy result shapes. Version 2 adds fields to capability and SSApp results without removing the existing capability tree.
