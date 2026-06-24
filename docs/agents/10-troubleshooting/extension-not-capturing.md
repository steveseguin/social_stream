# Extension Not Capturing

Status: framework only. Detailed extraction not started.

## Purpose

Document what to check when the Chrome extension is installed but messages do not appear.

## Source Anchors

- `social_stream/manifest.json`
- `social_stream/service_worker.js`
- `social_stream/background.js`
- `social_stream/popup.html`
- `social_stream/sources/*.js`
- `stevesbot/resources/instructions/social-stream-support.md`

## Starter Notes

Support guidance says to check whether the extension icon is enabled, whether chat is popped out, whether the session ID matches, and whether other extensions or browser state are interfering.

## Planned Sections

- Enabled/disabled extension state
- Source page loaded
- Pop-out chat requirements
- Session mismatch
- Browser restrictions
- Platform-specific capture problems
