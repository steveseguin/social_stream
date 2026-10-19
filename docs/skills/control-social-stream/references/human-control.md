# Private human control

Minimum runtime: SSApp 0.4.40 advertising API 1.6.0, with MCP adapter 1.5.0.
Check `capabilities.humanControl` and the advertised `getHumanControlStatus` command.

When a person needs to sign in, direct them to the authorized human viewer.
The local viewer is `/api/v1/human/viewer` on the SSApp control API origin.
For another computer, use the bridge's authenticated viewer connection;
the host's localhost address is not a remote URL.

The person selects **Take private control**, chooses the correct SSApp window,
checks its site address, and completes sign-in directly. They select
**Done · return control to AI** to resume automation. Sign-in remains in SSApp's
host profile; opening a separate browser on their own computer is insufficient.

During takeover, ordinary API/MCP reads, writes, dialogs, event streams, and
screenshots are unavailable. `HUMAN_CONTROL_ACTIVE` is an instruction to wait,
not a reason to switch to another observation or execution interface. Use
`ssapp_get_human_control_status` to read `idle`, `waiting`, `active`, or `suspended`
and `automationPaused`. It contains no page content or viewer token.

Private viewing keeps a selected hidden Windows target rendering off-screen and
transparent. Disconnect or handback restores its hidden state and opacity while
preserving any window size manually chosen on the host during the session.

A disconnect or timeout keeps automation paused. Ask the person to reopen the
viewer and explicitly return control. Do not resume based on elapsed time alone.
After handback, rediscover targets and take fresh observations; navigation can
invalidate screenshots and element references. Input accepted before takeover
may have executed. Never retry it blindly.

The viewer's short-lived token belongs exclusively to the person and their
trusted bridge. Do not obtain it, print it, place it in a model conversation,
or call `/api/v1/human/start`, `/command`, `/frames`, `/finish`, or `/suspend`
on the person's behalf as an AI. These private routes are deliberately not MCP
tools. `confirm: true` is not remote authentication. The bridge authenticates
the person separately and keeps all private input and images out of agent logs.

The API pause affects the local automation interface; it does not isolate SSApp
from other host software or pause existing chat transports. Normal app use and
ordinary local sign-in do not activate this feature. No background viewing or
model activity runs just because the app is open.
