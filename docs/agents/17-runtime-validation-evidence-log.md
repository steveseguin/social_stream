# Runtime Validation Evidence Log

Status: runtime evidence entries updated on 2026-06-24.

## Purpose

Use this file to record actual runtime validation results for the SSN AI documentation set.

This is separate from `16-runtime-validation-playbooks.md`, which describes how to validate things. This page records what was actually run and what the result proved.

Do not add a `runtime-tested`, `browser-validated`, `api-runtime-validated`, `app-e2e-validated`, or `obs-validated` claim unless the evidence entry names the exact surface, input, observed result, and what was not tested.

## Evidence Rules

- Keep evidence narrow. A browser validation of one page does not validate all overlays, OBS, app behavior, hosted relay behavior, or live platform capture.
- Do not record real session IDs, passwords, API keys, OAuth tokens, webhook URLs, private endpoints, private channel names, or private support identities.
- If a validation command uses synthetic payloads, say so.
- If OBS, app, live platform, or hosted relay behavior was not tested, say so.

## Evidence Entries

### Reactions Overlay Controlled Browser Validation

Validation date: 2026-06-24

Validator: Codex

Area: Live display utility page, `reactions.html`, plus popup-generated reactions URL behavior and a controlled TikTok-like source fixture

Evidence label: `browser-validated` for controlled local browser behavior only

Command run:

```powershell
node scripts/playwright-reactions-overlay-e2e.cjs
```

Result: passed with output `Reactions overlay test passed with 12 blocked external request(s).`

Product surface: local pages served by `scripts/playwright-static-server.cjs` and opened in headless Chromium through Playwright. Chrome extension APIs, WebSocket behavior, and external network requests were stubbed by the script.

URL shapes and modes exercised:

- `popup.html`, with stubbed `chrome.runtime.sendMessage({ cmd: "getSettings" })` returning `streamID: "testsession"` and `password: "pw"`.
- Popup-generated `reactions.html` link with `session`, `password`, `align=right`, `layout=fountain`, `scale=1.35`, `speed=1.25`, `burst=7`, `limit=90`, `pagebg=#123456`, and `triple`.
- `reactions.html` direct loads for `server`, `server2`, `server3`, `localserver`, and mixed server-flag precedence.
- Controlled TikTok source fixture at `https://www.tiktok.com/@playwright/live` with `sources/tiktok.js` injected into a fake page.

Input payloads or actions:

- Popup control changes for reactions alignment, layout, triple mode, scale, speed, burst, limit, and page background.
- Synthetic VDO bridge `postMessage` payload with `overlayNinja.event: "liked"` and `type: "tiktok"`.
- Direct overlay payloads for `reaction` and `liked` events, including inline image reaction markup.
- Fake WebSocket connections that captured join payloads.
- Controlled TikTok DOM insertion for anonymous `liked the LIVE` rows, with `capturelikeevent` both disabled and enabled.

Observed result:

- Popup generated the expected reactions URL parameters, including session and password.
- `reactions.html` parsed the expected visual and behavior parameters.
- VDO bridge `liked` payloads rendered reaction bursts.
- `triple`, `burst`, and `limit` changed the number of rendered reactions as expected in the script.
- `pagebg`, `align`, `layout`, `scale`, and `speed` affected rendered reaction state as expected in the script.
- Inline image reactions scaled to the wrapper size.
- Fake WebSocket joins used the expected endpoint and default channel pair for `server`, `server2`, `server3`, and `localserver` branches.
- Controlled TikTok like capture routed anonymous likes to `target: "reactions"` when `capturelikeevent` was false, and to the default target when it was true.

What was not tested:

- OBS browser-source behavior.
- Hosted `socialstream.ninja` page behavior.
- A real installed Chrome extension runtime.
- Real VDO.Ninja bridge delivery.
- Real WebSocket relay delivery beyond fake join payload capture.
- Real TikTok live page behavior, login state, selectors, or network behavior.
- Standalone app behavior.
- Long-running duplicate suppression or refresh persistence beyond the scripted windows.

Docs updated:

- `07-overlays-and-pages/live-display-utilities.md`
- `07-overlays-and-pages/page-capability-matrix.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

Follow-up:

- Validate `reactions.html` in OBS before making `obs-validated` claims.
- Validate real extension/bridge delivery and live platform reaction events before promoting platform-specific reaction support.

### Scoreboard Controlled Browser Validation

Validation date: 2026-06-24

Validator: Codex

Area: Live display utility page, `scoreboard.html`

Evidence label: `browser-validated` for controlled local browser behavior only

Command run:

```powershell
node scripts/playwright-scoreboard-e2e.cjs
```

Result: passed with output `PASS scoreboard e2e`.

Product surface: local page served by `scripts/playwright-static-server.cjs` and opened in headless Chromium through Playwright.

URL shapes exercised:

- `http://127.0.0.1:4181/scoreboard.html?preview&layout=ticker&theme=neon&title=Points%20Race&maxusers=3&minpoints=5&animations&highlightchanges`
- `http://127.0.0.1:4181/scoreboard.html?preview&chatpoints&donationpoints&customtriggers&hidepoints&layout=compact`

Input payloads or actions:

- Synthetic `postMessage` payload with `event: "points_leaderboard"` and four leaderboard rows.
- Synthetic ordinary chat payload for local `chatpoints`.
- Synthetic donation payload with `hasDonation`.
- Synthetic custom score payload with `meta.score`.

Observed result:

- `scoreboard.html` rendered three rows when `maxusers=3`.
- `minpoints=5` filtered out the low-score row.
- `layout=ticker`, `theme=neon`, and `title=Points Race` were reflected in page state.
- Subtitle summarized the rendered ranked viewers.
- `chatpoints`, `donationpoints`, and `customtriggers` produced two local scoring rows in compact layout.
- `hidepoints` prevented visible numeric point text in the local-scoring row.
- No Playwright page errors were reported by the script.

What was not tested:

- OBS browser-source behavior.
- Hosted `socialstream.ninja` page behavior.
- Extension iframe bridge behavior outside synthetic `postMessage`.
- Standalone app behavior.
- Live platform/source payloads.
- WebSocket server modes: `server`, `server2`, `server3`, `localserver`.
- Session/password/label routing.
- Long-running persistence or refresh behavior.

Docs updated:

- `07-overlays-and-pages/live-display-utilities.md`
- `07-overlays-and-pages/page-capability-matrix.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

Follow-up:

- Run equivalent controlled browser validation for `emotes.html`, `ticker.html`, and `map.html`.
- Validate `scoreboard.html` in OBS before making `obs-validated` claims.
- Validate WebSocket/server-mode delivery before making relay behavior claims.

### Multi-Alerts Controlled Browser Validation Attempt

Validation date: 2026-06-24

Validator: Codex

Area: Core overlay page, `multi-alerts.html`, plus popup-generated multi-alerts URL behavior

Evidence label: `validation-failed`; do not promote `multi-alerts.html` to `browser-validated` from this run

Command run:

```powershell
node scripts/playwright-multi-alerts-overlay-e2e.cjs
```

Result: failed with exit code 1.

Observed failure output:

```text
frame.waitForFunction: Timeout 30000ms exceeded.
    at waitForPreviewFrame (C:\Users\steve\Code\social_stream\scripts\playwright-multi-alerts-overlay-e2e.cjs:212:15)
    at async C:\Users\steve\Code\social_stream\scripts\playwright-multi-alerts-overlay-e2e.cjs:439:24
```

Product surface attempted: local `popup.html` and `multi-alerts.html` pages served by `scripts/playwright-static-server.cjs` and opened in headless Chromium through Playwright. Chrome extension APIs and audio playback were stubbed by the script.

Where the script stopped:

- The stack shows the run reached the first `waitForPreviewFrame(popupPage)` call after the popup preview iframe URL checks.
- The failure occurred while waiting for the preview iframe to expose `window.__multiAlertsOverlay.getSettings`.

What this proves:

- It proves only that the current validation attempt did not complete.
- It does not prove `multi-alerts.html` is broken for users, because this was a controlled test harness and the timeout was inside the test's preview-frame wait.

What was not tested:

- Alert card rendering assertions later in the script.
- Queue/no-queue behavior.
- Audio override behavior.
- Category filters, disabled categories, minimum donation filtering, TikTok gift combo handling, or server endpoint assertions.
- OBS browser-source behavior.
- Hosted page behavior.
- Real extension bridge, live platform payloads, or standalone app behavior.

Docs updated:

- `07-overlays-and-pages/multi-alerts.md`
- `07-overlays-and-pages/page-capability-matrix.md`
- `01-extraction-checklist.md`
- `02-resource-processing-ledger.md`

Follow-up:

- Re-run after investigating why the preview iframe did not expose `window.__multiAlertsOverlay`.
- Record a new evidence entry only if the script passes or if a narrower manual/browser validation is performed with exact observed results.
