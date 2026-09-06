# ISSUE-005: Legacy `/exec` endpoint allows arbitrary JS execution, contradicting documented security guarantee

- **Status**: open
- **Severity**: high
- **Area**: ssapp repo, `main.js`; docs `docs/skills/control-social-stream/references/control-api.md`
- **Found**: 2026-07-22, during ssapp LLM/MCP documentation pass

## Symptom

The legacy remote-control HTTP server exposes `POST /exec` (`main.js:2521-2544`): body `{windowId?, code}` runs `webContents.executeJavaScript(code)` in the chosen window (defaults to the first window). It is token-protected and only reachable with the legacy `--remote-control` / `SSAPP_REMOTE_CONTROL=1` flag (gate at `main.js:2252`), but it flatly contradicts the documented guarantee "It does not expose arbitrary JavaScript execution" (`control-api.md:124`) and the skill's own rule (`docs/skills/control-social-stream/SKILL.md:41`). Anyone with the token gets full renderer code execution.

## Expected

Either remove `/exec`, or document it loudly as an exception that only exists in legacy `--remote-control` mode.

## Evidence

- `main.js:2521-2544` — `/exec` handler
- `main.js:2252` — legacy flag gate
- `docs/skills/control-social-stream/references/control-api.md:124` — contradicting claim
- `docs/skills/control-social-stream/SKILL.md:41` — skill safety rule

## Notes

Recommend gating `/exec` behind its own explicit flag (e.g. `--remote-control-exec`) or removing it; update control-api.md and SKILL.md either way.
