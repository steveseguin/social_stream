# ISSUE-001: Duplicate IPC handler and globalShortcut registration on window recreate

- **Status**: open
- **Severity**: high
- **Area**: ssapp repo, `main.js`
- **Found**: 2026-07-22, during ssapp architecture documentation pass

## Symptom

`createWindow` (`main.js:7267-13319`) registers ~40 `ipcMain.on`/`ipcMain.handle` listeners (`main.js:7398`-`main.js:13159`, including the `createWindow` channel itself at `main.js:12541`) and two `globalShortcut.register` calls (`main.js:13186`, `main.js:13203`) every time it runs. It is invoked at startup (`main.js:15151`) and again on macOS `activate` after all windows are closed (`main.js:15746-15752`). Listeners are only removed on quit (`main.js:8614-8642`).

Result: a macOS close→reopen cycle duplicates every handler (double prompt dialogs, `createWindow` handled twice → duplicate source windows) and shortcut re-registration fails.

## Expected

IPC handlers and global shortcuts registered exactly once per app lifetime, or removed before re-registration.

## Evidence

- `main.js:7398`-`main.js:13159` — registrations inside `createWindow`
- `main.js:15151` — startup call
- `main.js:15746-15752` — macOS `activate` re-call
- `main.js:8614-8642` — removal only on quit
- `main.js:13186`, `main.js:13203` — globalShortcut.register

## Notes

Move registrations out of `createWindow`, or guard with a `handlersRegistered` flag.
