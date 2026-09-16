# ISSUE-004: `tiktokSendResult` event has no renderer listener — send failures silently dropped

- **Status**: open
- **Severity**: medium
- **Area**: ssapp repo, `main.js`
- **Found**: 2026-07-22, during ssapp TikTok documentation pass

## Symptom

`main.js:13086-13103` sends `mainWindow.webContents.send('tiktokSendResult', ...)`, but no `ipcRenderer.on('tiktokSendResult')` listener exists anywhere in the renderer (checked index.html and preload.js). TikTok send failures from the dock path are silently dropped — the user sees no error.

## Expected

Renderer listens for `tiktokSendResult` and surfaces failures (toast/status), or the event is removed and errors propagated via the existing `sendToTab` response path.

## Evidence

- `main.js:13086-13103` — emit site
- No matching `ipcRenderer.on('tiktokSendResult', ...)` in `index.html` or `preload.js`

## Notes
