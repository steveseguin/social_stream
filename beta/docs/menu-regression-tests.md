# Desktop menu regression checks

Run before pushing:

```sh
node tests/popup-search.test.js
node tests/popup-search-electron.test.cjs
```

The desktop suite requires Playwright in this checkout and an installed sibling `ssapp` checkout. Set `SSAPP_REPO` to use a different app checkout. It launches the actual Electron app with local Social Stream assets and a fresh temporary profile, restarts that profile, and closes its own app afterward. Existing app sessions and source channels are not used. A free loopback port is chosen for the local relay.

Coverage:

- Search keywords, result selection, no-results handling, Ctrl+F, and Escape.
- Search before/after enabled-only filtering, repeated filter cycles, preserved setting values, section state, and inline visibility.
- Global toggle, overlay toggle, and text-option persistence after a real app restart.
- Dock/featured page targets, matching sessions, encoded URL options, and no leakage of dock options into featured links. The full generated URLs are compared across restart, including their base, session, and query parameters.
- Beginner/full menu rendering with search and filtering.
- Narrow/wide Electron windows, scrolling, and light/dark media emulation.
- The actual fake-message button delivering through the app's local relay into a real dock page.

A failing check exits nonzero. Keep failures visible and investigate them before pushing; do not replace failures with skips. The suite does not cover live source capture, every menu setting, native theme preference persistence, or hosted/P2P transport reliability.

## Reload regression covered

The Windows local-source path must be normalized to a file URL before comparing it with iframe URLs. Otherwise enabling the local server can repeatedly reload the background and menu. The standalone app also uses the same generated-link base in its startup and server-change loaders and rechecks the current frame URL after asynchronous resolution.

The suite checks complete link persistence and stable menu content during actual local message delivery. It also fails on uncaught app JavaScript errors, including missing optional dock bridge helpers. These fixes require the updated sibling `ssapp/index.html` as well as this checkout's dock change.
