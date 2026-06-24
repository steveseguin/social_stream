# Extension Not Capturing

Status: heavy extraction pass started from README, manifest/source patterns, platform docs, and existing triage notes.

## Source Anchors

- `README.md`
- `manifest.json`
- `service_worker.js`
- `background.js`
- `popup.html`
- `sources/*.js`
- `sources/websocket/*`
- `docs/agents/10-troubleshooting/quick-triage.md`
- `docs/agents/08-platform-sources/*.md`

## Fast Triage

Ask these first:

1. Is the extension icon green/enabled?
2. Was the chat page opened/reloaded after the extension was installed or reloaded?
3. Is the user on the correct source mode: popout chat, normal page, toggle-required page, manual picker, or WebSocket source page?
4. Is the chat page visible and not minimized?
5. Does `dock.html` use the same session ID as the extension?
6. Does VDO.Ninja/WebRTC work in the same browser/network?
7. Are other extensions, privacy tools, or browser profiles interfering?
8. Is the platform currently supported by a source file and manifest match?

## Enabled State

README guidance:

- Red extension icon means disabled/off.
- Green extension icon means enabled.
- If the extension is enabled after a chat page already loaded, reload the chat page.

If the user only loaded `dock.html`/`featured.html` but never opened a supported chat/source page, there is nothing to capture.

## Source Mode

Common setup types:

| Mode | Example | Support Check |
| --- | --- | --- |
| Popout chat | Twitch, YouTube live, Kick, Rumble variants | User opened exact popout/chat URL. |
| Standard page | Facebook Live, TikTok live, some meeting/chat sites | Chat panel is visible on the page. |
| Toggle-required | Discord, Slack, Telegram, WhatsApp, Google Meet, ChatGPT/static comments | Relevant extension setting is enabled, then page reloaded. |
| Manual picker | YouTube comments, X posts, Threads | User clicks SS/manual selection control. |
| WebSocket source | YouTube/Twitch/Kick/API/IRC style source pages | Source page is configured and connected. |
| App source | Standalone app managed source | Check app-specific source window and auth. |

Use `docs/js/sites.js`, README, manifest entries, and platform agent docs to identify the correct mode.

## Visibility And Browser Throttling

README notes browser pages can pause or throttle hidden/minimized chat windows.

Support steps:

- Do not minimize source chat windows.
- Keep the chat visible, even if only a small part is visible.
- Keep the chat scrolled to newest messages.
- Disable browser performance/background tab throttling if needed.
- Check `chrome://discards/` and disable auto-discard for source pages.
- Consider the standalone app when browser throttling keeps breaking capture.

## Session Mismatch

If the dock/overlay shows nothing, verify:

- Extension/app session ID.
- `dock.html?session=...`
- `featured.html?session=...`
- Any API/session field in source pages.

If the user opened a new dock/overlay link from the popup, the session may have changed from the old saved URL.

## Platform-Specific First Checks

| Platform | First Check |
| --- | --- |
| YouTube Live | Use popout/studio/guest live chat or supported watch URL; reload after extension changes. |
| YouTube Static Comments | Use SS manual comment selection control. |
| Twitch | Use Twitch popout chat for extension capture. |
| TikTok | Keep live chat open/visible when using extension capture. |
| Kick | Confirm chatroom/popout/source mode and current Kick source doc. |
| Facebook Live | Check viewer/publisher/producer chat mode and network/auth. |
| Discord/Slack/Telegram/WhatsApp/Meet | Enable required capture toggle and reload page. |
| ChatGPT/OpenAI page | Requires opt-in toggle. |

## Conflicts And Browser State

Try:

- Incognito/private window with only SSN enabled.
- Disable other extensions temporarily.
- New Chrome/Edge profile.
- Clear only the affected site/session if login/cookie state looks broken.
- Test on Chromium if Firefox is missing required feature support.

Do not immediately blame SSN source code until a clean profile is tested for extension conflict issues.

## Auto-Responder Is Not Capture

Capture can work while auto-responder/send-chat fails.

Auto-response requires:

- Source page can send chat manually.
- User is signed in and has permission to chat.
- Relevant command toggle is enabled.
- Chromium/debugger API behavior is available for that source/mode.

If the user sees a blue debugger bar, README says Chrome can be started with `--silent-debugger-extension-api` to hide that warning.

## Manifest/Source Verification For Agents

When a source is suspected broken:

1. Check `manifest.json` for URL match pattern.
2. Check the relevant `sources/*.js` or `sources/websocket/*.js`.
3. Confirm the source type used in payload (`data.type`).
4. Check whether a toggle gates that source.
5. Check recent platform agent doc notes.
6. If app-specific, check `ssapp` source loading/auth handling, not the fallback bundle.

## Common Resolutions

- Turn the extension on.
- Reload the source chat page.
- Use the correct popout/chat URL.
- Keep the chat visible/not minimized.
- Match the session ID.
- Enable the toggle-required source.
- Disable conflicting extensions.
- Use manual GitHub build if the store build is behind a recent fix.
- Use the standalone app if Chrome throttling is the main issue.

## Escalation Data To Collect

- Browser and extension install path/store/manual branch.
- Source platform and exact URL pattern, redacted if private.
- Screenshot of extension popup/source toggle state.
- Screenshot of dock URL, with session ID redacted.
- Console errors from the source page and dock.
- Whether it reproduces in a clean browser profile.
- Whether standalone app works for the same source.

## Follow-Up Extraction Needs

- Mine support DBs for high-frequency capture symptoms.
- Build a per-platform capture-mode table from manifest and site metadata.
- Add exact Firefox/MV3 limitation matrix.
- Add console-error examples for common source failures.
