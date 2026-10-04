# ISSUE-002: Dead `onbeforeunload` assigned on BrowserWindow — hide-instead-of-close never fires

- **Status**: open
- **Severity**: medium
- **Area**: ssapp repo, `main.js`
- **Found**: 2026-07-22, during ssapp architecture documentation pass

## Symptom

`main.js:11264-11278` assigns `view.onbeforeunload` on a `BrowserWindow` instance. `onbeforeunload` is a DOM/webContents concept; the assignment on the BrowserWindow object never fires, so the intended "hide instead of close" behavior (`e.preventDefault()` + `window-hidden` notification) is silently inert.

## Expected

Source windows hide instead of closing when the page navigates away / unloads, per the commented intent.

## Evidence

- `main.js:11264-11278` — dead assignment
- `main.js:15764-15776` — commented-out correct version using `window.on('close')`

## Notes

Either restore the `window.on('close')` approach or attach to `webContents` events (`will-prevent-unload` / `close`).
