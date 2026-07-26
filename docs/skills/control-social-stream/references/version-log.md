# SSApp Control Compatibility and Version Log

Always call `ssapp_get_capabilities` or `GET /api/v1/capabilities`. Its command list is authoritative, including when development builds share an application version.

| Control API | Minimum SSApp | Available surface |
| --- | --- | --- |
| 1.1.5 / MCP 1.0.3 | 0.4.7 | Adds downloaded-app `--ssapp-mcp` launch and copied setup while keeping the explicitly enabled tokenless API local and separate from headless mode |
| 1.1.4 / MCP 1.0.1 | 0.4.6 | Rejects inactive-only `updateSource` fields for running sources and directs live mute/visibility changes through their dedicated commands |
| 1.1.3 / MCP 1.0.1 | 0.4.4 | Omits stored source URLs, which may contain access tokens, from normalized source/status responses and exposes the active numeric `tabId` instead |
| 1.1.2 / MCP 1.0.1 | 0.4.2 | Keeps username-generated URLs consistent during full-form source updates and correctly ignores MCP JSON-RPC notifications |
| 1.1.1 | 0.4.2 | Rejects connection-mode updates that are unsupported by the selected source platform |
| 1.1.0 | 0.4.2 | Versioned responses, request and operation IDs, SSE status events, token-file and stored credentials, visible-app controls, expanded source/settings discovery, and version-aware MCP tools |
| 1.0.0 | 0.4.2 | Initial authenticated localhost status, capabilities, source lifecycle, supported settings, and headless control |

## Skill revisions

### 2026-07-26

- Documented no-source MCP setup through the downloaded app's `--ssapp-mcp` mode and
  **Copy MCP Setup** menu action (API 1.1.5 / MCP 1.0.3, minimum SSApp 0.4.7).
- Added MCP handshake instructions so a connected agent receives the core workflow without
  separately installing this skill.
- Clarified that headless mode does not enable a control interface and that remote control remains on Social Stream's existing WebRTC/WebSocket path.
- Limited that remote path to individual public-source operations; settings, app lifecycle,
  bulk-all commands, credentials, sign-in, files, and arbitrary code remain unavailable.

### 2026-07-25

- Documented accurate `mainWindowVisible` reporting for tray-hidden Linux windows (API 1.1.4, minimum SSApp 0.4.7 for this correction).

### 2026-07-22

- Documented active-source update safeguards and dedicated live mute/visibility commands (API 1.1.4, minimum SSApp 0.4.6).

### 2026-07-19

- Documented credential-safe normalized source responses and the `tabId` replacement (API 1.1.3, minimum SSApp 0.4.4).

### 2026-07-12

- Fixed full-form username/URL updates and MCP notification handling (API 1.1.2).
- Added platform-aware validation to source connection-mode update commands (API 1.1.1).
- Added MCP setup and runtime capability/version gating.
- Replaced command-line token guidance with stored, environment, or token-file credentials.
- Documented operations, authenticated status events, confirmation requirements, and API 1.1.0.

When an endpoint, command, schema, MCP tool, or compatibility requirement changes, update this log and the rest of this skill in the same change.
